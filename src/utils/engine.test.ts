import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  attemptedModelOf,
  buildModelChain,
  cleanAndParseJSON,
  describeError,
  EngineChainError,
  generateWithFallback,
  isTransient,
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
