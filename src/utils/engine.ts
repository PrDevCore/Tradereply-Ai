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

/** Model name to report for a failed request, whatever the failure shape. */
export function attemptedModelOf(err: unknown, fallbackModel: string): string {
  return err instanceof EngineChainError ? err.attemptedModel : fallbackModel;
}
