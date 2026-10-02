/**
 * Shared Gemini resilience helpers.
 *
 * These live outside server.ts purely so the retry / fallback / parsing behaviour
 * can be unit tested without booting Express, opening a port or holding a real API
 * key. This module performs no I/O of its own — the network call is injected by
 * the caller — with one exception: the per-attempt AbortSignal timer.
 *
 * Behaviour preserved from the original inline implementation in server.ts:
 *  - only transient upstream conditions are retried (auth / bad-request fail fast),
 *  - the primary model gets `primaryAttempts` tries with exponential backoff,
 *  - each fallback model gets exactly one try,
 *  - the whole chain is bounded by `totalBudgetMs`,
 *  - the model that actually answered is always reported back to the caller.
 */

/** Substrings that mark an upstream failure as worth retrying. */
export const TRANSIENT_MARKERS = [
  'UNAVAILABLE',
  'RESOURCE_EXHAUSTED',
  'DEADLINE_EXCEEDED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'ENOTFOUND',
  'ECONNREFUSED',
  'ENETUNREACH',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_SOCKET',
  'TIMEOUT',
  'ABORT',
  'FETCH FAILED',
] as const;

export interface FallbackEngineConfig {
  /** Primary model id — the only model retried in place. */
  primaryModel: string;
  /** Further REAL models tried, in order, once the primary is exhausted. */
  fallbackModels: string[];
  /** Hard ceiling for a single attempt, in milliseconds. */
  timeoutMs: number;
  /** Overall budget for the entire chain, in milliseconds. */
  totalBudgetMs: number;
  /** Tries per model when it is the primary (default 2). */
  primaryAttempts?: number;
  /** Injectable clock so tests are deterministic (default Date.now). */
  now?: () => number;
  /** Injectable sleep so tests do not wait on real backoff (default setTimeout). */
  sleep?: (ms: number) => Promise<void>;
  /** Log sink for fallback/retry notices (default console.warn). */
  warn?: (message: string) => void;
}

/**
 * Raised when every model in the chain has been tried and the last failure was
 * transient. Carries the model that was being attempted so the API layer can
 * report it instead of always blaming the primary model.
 */
export class EngineChainError extends Error {
  readonly attemptedModel: string;

  constructor(message: string, attemptedModel: string, cause?: unknown) {
    super(message);
    this.name = 'EngineChainError';
    this.attemptedModel = attemptedModel;
    if (cause !== undefined) (this as { cause?: unknown }).cause = cause;
  }
}

/**
 * Unwrap the whole `cause` chain into one actionable string.
 *
 * Node's fetch reports only "fetch failed" and buries the real reason (DNS, TLS,
 * reset, timeout) inside `err.cause`, which makes upstream failures undiagnosable.
 */
export function describeError(err: unknown): string {
  const parts: string[] = [];
  let cursor: any = err;
  let depth = 0;
  while (cursor && depth < 6) {
    const code = cursor.code ? `[${cursor.code}] ` : '';
    // The GenAI SDK throws Errors whose message is the raw API JSON, but other
    // layers throw a plain object, so look one level in for a message too.
    const message = cursor.message || (cursor.error && cursor.error.message) || '';
    // Some shapes carry the upstream status in a sibling field rather than inside
    // the message text; include it so transient detection still works.
    const status = cursor.error && cursor.error.status ? ` (${cursor.error.status})` : '';
    if (message) parts.push(`${code}${message}${status}`);
    cursor = cursor.cause;
    depth += 1;
  }
  return parts.length ? parts.join(' <- ') : 'Unknown engine error';
}

/** True only for conditions where trying again could plausibly succeed. */
export function isTransient(err: unknown): boolean {
  const text = describeError(err).toUpperCase();
  return TRANSIENT_MARKERS.some((marker) => text.includes(marker));
}

function stripCodeFence(text: string): string {
  if (text.startsWith('```json')) {
    return text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  }
  if (text.startsWith('```')) {
    return text.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  return text;
}

function sliceOutermostObject(text: string): string | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  return start !== -1 && end > start ? text.slice(start, end + 1) : null;
}

/**
 * Parse a model response that should be JSON.
 *
 * Handles the two shapes schema-constrained output actually arrives in: bare
 * JSON, and JSON wrapped in a ```json fence. A stray prose prefix/suffix is
 * recovered by slicing the outermost object. If nothing parses we rethrow the
 * original SyntaxError so the route fails loudly — never with fabricated data.
 */
export function cleanAndParseJSON<T = any>(raw: string): T {
  const withoutFence = stripCodeFence((raw ?? '').trim());
  try {
    return JSON.parse(withoutFence) as T;
  } catch (firstError) {
    const sliced = sliceOutermostObject(withoutFence);
    if (sliced && sliced !== withoutFence) {
      try {
        return JSON.parse(sliced) as T;
      } catch {
        // fall through and report the original, more informative error
      }
    }
    throw firstError;
  }
}

/** Primary model first, then each fallback, with duplicates removed. */
export function buildModelChain(primaryModel: string, fallbackModels: string[]): string[] {
  return Array.from(new Set([primaryModel, ...fallbackModels.filter(Boolean)]));
}

/**
 * Run one generation call across the model chain, retrying only transient
 * failures. `call` receives the model id and the per-attempt abort signal, and is
 * the only place that touches the network.
 */
export async function generateWithFallback<T>(
  config: FallbackEngineConfig,
  call: (model: string, abortSignal: AbortSignal) => Promise<T>,
): Promise<{ response: T; model: string; attempts: number }> {
  const now = config.now ?? (() => Date.now());
  const sleep = config.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const warn = config.warn ?? ((message: string) => console.warn(message));
  const primaryAttempts = Math.max(1, config.primaryAttempts ?? 2);

  const modelChain = buildModelChain(config.primaryModel, config.fallbackModels);
  const deadline = now() + config.totalBudgetMs;
  let lastError: unknown;
  let lastModel = config.primaryModel;
  let attempts = 0;

  for (const model of modelChain) {
    if (now() >= deadline) break;
    const maxAttempts = model === config.primaryModel ? primaryAttempts : 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      if (now() >= deadline) break;
      lastModel = model;
      attempts += 1;
      const remainingMs = deadline - now();

      try {
        const response = await call(
          model,
          // Bound each attempt by the smaller of the per-attempt timeout and
          // whatever remains of the overall budget.
          AbortSignal.timeout(Math.max(1000, Math.min(config.timeoutMs, remainingMs))),
        );
        if (attempt > 1 || model !== config.primaryModel) {
          warn(`[TradeReply AI] request served by ${model} (attempt ${attempt})`);
        }
        return { response, model, attempts };
      } catch (err: unknown) {
        lastError = err;

        // Auth / validation / bad-request errors are permanent: fail fast.
        if (!isTransient(err)) throw err;

        warn(
          `[TradeReply AI] ${model} transient failure (attempt ${attempt}/${maxAttempts}): ${describeError(err)}`,
        );

        if (attempt < maxAttempts) {
          await sleep(800 * 3 ** (attempt - 1));
        }
      }
    }
  }

  throw new EngineChainError(describeError(lastError), lastModel, lastError);
}

/**
 * Local Ollama transport.
 *
 * Ollama is a SECOND REAL provider, not a mock: every call here is a live
 * HTTP request to a running Ollama daemon. It exists so the same prompt and the
 * same JSON contract can be served by a local model — no API key, no per-token
 * cost — and so the Gemini chain has a real fallback that does not depend on
 * Google's quota.
 *
 * As in engine.ts, the network call is injected by the caller so the request
 * shaping and response parsing can be unit tested without a daemon.
 */

export interface OllamaConfig {
  /** Daemon base URL, e.g. http://127.0.0.1:11434. */
  baseUrl: string;
  /** Wall-clock budget for one generate call, in milliseconds. */
  timeoutMs: number;
}

/** Default daemon address. Ollama binds 127.0.0.1:11434 by default. */
export const DEFAULT_OLLAMA_BASE_URL = 'http://127.0.0.1:11434';

/**
 * Normalise the configured base URL: no trailing slash, and an absolute URL only.
 *
 * Returns null for anything unusable so the caller can report a real
 * configuration error instead of letting fetch fail with "Failed to fetch".
 */
export function normaliseOllamaBaseUrl(value: string | undefined | null): string | null {
  const trimmed = (value || '').trim() || DEFAULT_OLLAMA_BASE_URL;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * The JSON body for a generate call.
 *
 * `format: 'json'` is Ollama's schema-free way of constraining output to valid
 * JSON, which is the closest equivalent to Gemini's responseMimeType. It does not
 * enforce a schema, so `cleanAndParseJSON` on the way back still matters.
 */
export function buildOllamaRequest(model: string, prompt: string): {
  url: string;
  body: Record<string, unknown>;
} {
  const base = normaliseOllamaBaseUrl(null) || DEFAULT_OLLAMA_BASE_URL;
  return {
    url: `${base}/api/generate`,
    body: {
      model,
      prompt,
      // Non-streaming keeps the response shape identical to what the chain expects.
      stream: false,
      format: 'json',
      options: { temperature: 0.4 },
    },
  };
}

/**
 * Reduce an Ollama response to the text field the chain reads.
 *
 * Ollama reports failures with HTTP 200 and an `error` string in some versions,
 * so the error field is checked first — otherwise a failed generation would be
 * parsed as empty content and look like a successful, empty reply.
 */
export function parseOllamaResponse(payload: any): string {
  if (payload && typeof payload.error === 'string' && payload.error.trim()) {
    throw new Error(payload.error.trim());
  }
  const text = payload && (payload.response ?? payload.message?.content);
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('Ollama returned an empty response');
  }
  return text;
}

/**
 * Build the live call for one chain entry.
 *
 * `fetchImpl` is injectable for tests; the default is the global fetch. The
 * per-attempt abort signal comes from generateWithFallback, so this call obeys
 * exactly the same timeout and budget rules as the Gemini one.
 */
export function createOllamaCall(config: OllamaConfig) {
  return async (
    target: string,
    abortSignal: AbortSignal,
    contents: string,
    fetchImpl: typeof fetch = fetch,
  ): Promise<{ text: string }> => {
    const baseUrl = normaliseOllamaBaseUrl(config.baseUrl);
    if (!baseUrl) {
      throw new Error('OLLAMA_BASE_URL is not a valid http(s) URL');
    }

    const model = target.startsWith(OLLAMA_PREFIX)
      ? target.slice(OLLAMA_PREFIX.length)
      : target;
    if (!model) throw new Error('No Ollama model configured for this target');

    const request = buildOllamaRequest(model, contents);
    const res = await fetchImpl(request.url.replace(DEFAULT_OLLAMA_BASE_URL, baseUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request.body),
      signal: abortSignal,
    });

    const payload: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`Ollama HTTP ${res.status}: ${payload?.error || 'request failed'}`);
    }
    return { text: parseOllamaResponse(payload) };
  };
}

/** Model name to report for a failed request, whatever the failure shape. */
export function attemptedModelOf(err: unknown, fallbackModel: string): string {
  return err instanceof EngineChainError ? err.attemptedModel : fallbackModel;
}

// ---------------------------------------------------------------------------
// PROVIDER-PREFIXED TARGETS
//
// The fallback chain is a flat list of strings, so a second provider has to be
// distinguishable from the first one by name alone. Targets are therefore written
// as "<provider>:<model>" and dispatched on that prefix (see splitTarget).
//
// `buildModelChain` and the rest of the chain logic stay untouched: a prefixed
// target is just another string, so a bare Gemini model id keeps working and all
// existing behaviour — and its tests — remain valid.
// ---------------------------------------------------------------------------

/** Prefix marking a target as served by a local Ollama daemon. */
export const OLLAMA_PREFIX = 'ollama:';

export interface EngineTarget {
  provider: 'gemini' | 'ollama';
  /** Model id with the provider prefix removed, as the provider itself expects it. */
  model: string;
}

/**
 * Split a chain entry into provider and bare model id.
 *
 * Anything unprefixed is Gemini, so every previously configured model id keeps
 * its meaning without having to be rewritten. `splitTarget('ollama:')` yields no
 * model, which the caller rejects rather than calling a provider with no model.
 */
export function splitTarget(target: string): EngineTarget {
  const trimmed = (target || '').trim();
  if (trimmed.toLowerCase().startsWith(OLLAMA_PREFIX)) {
    return { provider: 'ollama', model: trimmed.slice(OLLAMA_PREFIX.length).trim() };
  }
  return { provider: 'gemini', model: trimmed };
}

/** Canonical, human-readable name for a chain entry — reported back as `engine`. */
export function describeTarget(target: string): string {
  const { provider, model } = splitTarget(target);
  return provider === 'ollama' ? `${OLLAMA_PREFIX}${model}` : model;
}
