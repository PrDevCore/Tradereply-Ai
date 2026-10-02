import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  attemptedModelOf,
  buildModelChain,
  cleanAndParseJSON,
  createOllamaCall,
  describeError,
  describeTarget,
  EngineChainError,
  generateWithFallback,
  isTransient,
  normaliseOllamaBaseUrl,
  parseOllamaResponse,
  splitTarget,
} from './engine.ts';

/** A Google-style transient upstream failure (503 UNAVAILABLE under load).
 *  The GenAI SDK throws an Error whose message is the raw API JSON, so this mirrors
 *  that shape exactly — the whole point is that the classification survives it. */
const overloaded = () =>
  new Error(
    JSON.stringify({
      error: {
        code: 503,
        status: 'UNAVAILABLE',
        message: 'This model is currently experiencing high demand. Spikes in demand are usually temporary.',
      },
    }),
  );

/** A permanent failure: retrying or falling back cannot help. */
const badKey = () =>
  new Error(
    JSON.stringify({
      error: { code: 400, status: 'INVALID_ARGUMENT', message: 'API key not valid. Please pass a valid API key.' },
    }),
  );

function config(overrides: Record<string, unknown> = {}) {
  return {
    primaryModel: 'primary',
    fallbackModels: ['fallback-a', 'fallback-b'],
    timeoutMs: 5000,
    totalBudgetMs: 60000,
    primaryAttempts: 2,
    sleep: async () => {},
    warn: () => {},
    ...overrides,
  };
}

test('describeError unwraps the whole cause chain, including error codes', () => {
  const err = new Error('fetch failed');
  (err as any).cause = Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
  assert.equal(describeError(err), 'fetch failed <- [ECONNREFUSED] connect ECONNREFUSED');
});

test('describeError never returns an empty string', () => {
  assert.equal(describeError(undefined), 'Unknown engine error');
  assert.equal(describeError({ message: '' }), 'Unknown engine error');
});

test('isTransient retries overload and network faults but not bad credentials', () => {
  assert.equal(isTransient(overloaded()), true);
  assert.equal(isTransient(badKey()), false);
  assert.equal(isTransient({ code: 'ECONNRESET', message: 'socket hang up' }), true);
  assert.equal(isTransient(Object.assign(new Error('fetch failed'), { code: 'UND_ERR_CONNECT_TIMEOUT' })), true);
  assert.equal(isTransient({ error: { code: 403, status: 'PERMISSION_DENIED', message: 'denied' } }), false);
});

test('transient detection survives a plain-object error with the status in a sibling field', () => {
  const plainObject = { error: { code: 503, status: 'UNAVAILABLE', message: 'This model is currently experiencing high demand.' } };
  assert.equal(isTransient(plainObject), true);
  assert.match(describeError(plainObject), /UNAVAILABLE/);
  assert.match(describeError(plainObject), /high demand/);
});

test('cleanAndParseJSON accepts bare, fenced and prose-wrapped JSON', () => {
  assert.deepEqual(cleanAndParseJSON('{"replyText":"hi"}'), { replyText: 'hi' });
  assert.deepEqual(cleanAndParseJSON('```json\n{"replyText":"hi"}\n```'), { replyText: 'hi' });
  assert.deepEqual(cleanAndParseJSON('```\n{"replyText":"hi"}\n```'), { replyText: 'hi' });
  assert.deepEqual(cleanAndParseJSON('Here you go:\n{"replyText":"hi"}\nHope that helps!'), { replyText: 'hi' });
});

test('cleanAndParseJSON still fails loudly on unusable output', () => {
  assert.throws(() => cleanAndParseJSON('not json at all'), SyntaxError);
});

test('buildModelChain keeps the primary first and drops duplicates', () => {
  assert.deepEqual(buildModelChain('a', ['b', 'a', 'c', 'b']), ['a', 'b', 'c']);
  assert.deepEqual(buildModelChain('a', []), ['a']);
});

test('generateWithFallback retries the primary in place before any fallback', async () => {
  const calls: string[] = [];
  const result = await generateWithFallback(config(), async (model) => {
    calls.push(model);
    if (calls.length === 1) throw overloaded();
    return { text: 'steady' };
  });

  assert.equal(result.model, 'primary');
  assert.equal(result.attempts, 2);
  assert.deepEqual(calls, ['primary', 'primary']);
  assert.equal((result.response as any).text, 'steady');
});

test('generateWithFallback walks the fallback chain, one try each, in order', async () => {
  const calls: string[] = [];
  const result = await generateWithFallback(config(), async (model) => {
    calls.push(model);
    if (model !== 'fallback-b') throw overloaded();
    return { text: 'from fallback-b' };
  });

  assert.equal(result.model, 'fallback-b');
  assert.deepEqual(calls, ['primary', 'primary', 'fallback-a', 'fallback-b']);
});

test('generateWithFallback fails fast on a permanent error without touching fallbacks', async () => {
  const calls: string[] = [];
  await assert.rejects(
    () =>
      generateWithFallback(config(), async (model) => {
        calls.push(model);
        throw badKey();
      }),
    /API key not valid/,
  );
  assert.deepEqual(calls, ['primary']);
});

test('generateWithFallback reports the model that was actually being tried', async () => {
  const err: any = await generateWithFallback(config(), async () => {
    throw overloaded();
  }).then(
    () => null,
    (failure) => failure,
  );

  assert.ok(err instanceof EngineChainError);
  assert.equal(err.attemptedModel, 'fallback-b');
  assert.match(err.message, /UNAVAILABLE/);
  assert.equal(attemptedModelOf(err, 'primary'), 'fallback-b');
  // A non-chain failure still reports the configured primary model.
  assert.equal(attemptedModelOf(new Error('boom'), 'primary'), 'primary');
});

test('the overall budget stops the chain instead of letting it stack up', async () => {
  let clock = 0;
  const calls: string[] = [];
  const err: any = await generateWithFallback(
    config({
      now: () => clock,
      totalBudgetMs: 1000,
      // The first backoff alone overruns the budget, so nothing else may be tried.
      sleep: async () => {
        clock += 5000;
      },
    }),
    async (model) => {
      calls.push(model);
      throw overloaded();
    },
  ).then(
    () => null,
    (failure) => failure,
  );

  assert.deepEqual(calls, ['primary']);
  assert.ok(err instanceof EngineChainError);
  assert.equal(err.attemptedModel, 'primary');
});

test('each attempt receives a time-bounded abort signal', async () => {
  const signals: AbortSignal[] = [];
  await generateWithFallback(config({ timeoutMs: 2500 }), async (_model, signal) => {
    signals.push(signal);
    return { text: 'ok' };
  });

  assert.equal(signals.length, 1);
  assert.ok(signals[0] instanceof AbortSignal);
  assert.equal(signals[0].aborted, false);
});

// ---------------------------------------------------------------------------
// Ollama as a second REAL provider
// ---------------------------------------------------------------------------

test('an unprefixed target stays Gemini, so existing config keeps working', () => {
  assert.deepEqual(splitTarget('gemini-3.8-flash'), { provider: 'gemini', model: 'gemini-3.8-flash' });
  assert.equal(describeTarget('gemini-3.8-flash'), 'gemini-3.8-flash');
});

test('an ollama: target splits into its provider and bare model id', () => {
  assert.deepEqual(splitTarget('ollama:llama3.2'), { provider: 'ollama', model: 'llama3.2' });
  assert.equal(describeTarget('ollama:llama3.2'), 'ollama:llama3.2');
  // Case-insensitive prefix, but the model id is returned verbatim.
  assert.deepEqual(splitTarget('OLLAMA:qwen2.5'), { provider: 'ollama', model: 'qwen2.5' });
});

test('a chain spanning both providers keeps order, retries, and reports the winner', async () => {
  const calls: string[] = [];
  const result = await generateWithFallback(
    config({ primaryModel: 'gemini-primary', fallbackModels: ['gemini-fallback', 'ollama:llama3.2'] }),
    async (target) => {
      calls.push(target);
      if (!target.startsWith('ollama:')) throw overloaded();
      return { text: 'from the local model' };
    },
  );

  // Gemini is retried in place first; Ollama is only reached once it is exhausted.
  assert.deepEqual(calls, [
    'gemini-primary',
    'gemini-primary',
    'gemini-fallback',
    'ollama:llama3.2',
  ]);
  assert.equal(result.model, 'ollama:llama3.2');
  assert.equal((result.response as any).text, 'from the local model');
});

test('normaliseOllamaBaseUrl strips trailing slashes and rejects unusable values', () => {
  assert.equal(normaliseOllamaBaseUrl('http://127.0.0.1:11434/'), 'http://127.0.0.1:11434');
  assert.equal(normaliseOllamaBaseUrl('  http://localhost:11434/api  '), 'http://localhost:11434');
  // Unset falls back to the daemon default rather than failing.
  assert.equal(normaliseOllamaBaseUrl(undefined), 'http://127.0.0.1:11434');
  assert.equal(normaliseOllamaBaseUrl(''), 'http://127.0.0.1:11434');
  assert.equal(normaliseOllamaBaseUrl('not a url'), null);
  assert.equal(normaliseOllamaBaseUrl('ftp://example.com'), null);
});

test('parseOllamaResponse prefers a real error over an empty-looking success', () => {
  assert.equal(parseOllamaResponse({ response: '{"replyText":"hi"}' }), '{"replyText":"hi"}');
  // Ollama can report a failure with HTTP 200 and an error string.
  assert.throws(() => parseOllamaResponse({ error: 'model "llama3.2" not found' }), /not found/);
  assert.throws(() => parseOllamaResponse({ response: '   ' }), /empty response/);
  assert.throws(() => parseOllamaResponse({}), /empty response/);
});

test('the Ollama call posts to the daemon with the model id and the shared prompt', async () => {
  const seen: any[] = [];
  const fakeFetch = (async (url: string, init: any) => {
    seen.push({ url, init });
    return {
      ok: true,
      status: 200,
      json: async () => ({ response: '{"revisedText":"ok"}' }),
    };
  }) as unknown as typeof fetch;

  const call = createOllamaCall({ baseUrl: 'http://127.0.0.1:11434', timeoutMs: 45000 });
  const result = await call('ollama:llama3.2', AbortSignal.timeout(5000), 'PROMPT TEXT', fakeFetch);

  assert.equal(seen[0].url, 'http://127.0.0.1:11434/api/generate');
  assert.equal(seen[0].init.method, 'POST');
  const body = JSON.parse(seen[0].init.body);
  // The "ollama:" prefix is stripped before the daemon ever sees it.
  assert.equal(body.model, 'llama3.2');
  assert.equal(body.prompt, 'PROMPT TEXT');
  assert.equal(body.stream, false);
  assert.equal(body.format, 'json');
  assert.equal(result.text, '{"revisedText":"ok"}');
});

test('the Ollama call surfaces an HTTP error instead of returning empty content', async () => {
  const fakeFetch = (async () => ({
    ok: false,
    status: 404,
    json: async () => ({ error: 'model "nope" not found, try pulling it first' }),
  })) as unknown as typeof fetch;

  const call = createOllamaCall({ baseUrl: 'http://127.0.0.1:11434', timeoutMs: 45000 });
  await assert.rejects(
    () => call('ollama:nope', AbortSignal.timeout(5000), 'p', fakeFetch),
    /HTTP 404.*not found/,
  );
});

test('an unusable Ollama base URL fails with a configuration message, not a fetch error', async () => {
  const fakeFetch = (async () => {
    throw new Error('Failed to fetch');
  }) as unknown as typeof fetch;

  const call = createOllamaCall({ baseUrl: 'not a url', timeoutMs: 45000 });
  await assert.rejects(
    () => call('ollama:llama3.2', AbortSignal.timeout(5000), 'p', fakeFetch),
    /OLLAMA_BASE_URL is not a valid/,
  );
});

test('a refused Ollama connection is transient, so the chain moves on instead of failing', () => {
  const refused = new Error('fetch failed');
  (refused as any).cause = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:11434'), {
    code: 'ECONNREFUSED',
  });
  assert.equal(isTransient(refused), true);
});
