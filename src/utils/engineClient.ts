/**
 * Single client for the local TradeReply AI API.
 *
 * Every view used to hand-roll the same fetch + "which field holds the error" dance,
 * which is how a failure ends up silently swallowed. This normalises both success and
 * failure into one result shape, and it is the only place that knows about the
 * optional shared token.
 */

export interface EngineResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  /** Human-readable failure reason, already unwrapped from the API error shape. */
  error?: string;
}

const CLIENT_TOKEN =
  ((import.meta as any).env?.VITE_TRADEREPLY_API_TOKEN as string | undefined)?.trim() || '';

function describeFailure(payload: any, status: number): string {
  if (payload && typeof payload === 'object') {
    if (typeof payload.message === 'string' && payload.message) return payload.message;
    if (typeof payload.error === 'string' && payload.error) return payload.error;
  }
  return `Engine request failed (HTTP ${status})`;
}

/** POST a JSON body to the API, never throwing: failures come back as `ok: false`. */
export async function postEngine<T>(path: string, body: unknown): Promise<EngineResult<T>> {
  return requestEngine<T>(path, { method: 'POST', body });
}

/**
 * Same contract as postEngine for the other verbs, so the workspace can read and
 * update the queue through one failure-shaped helper instead of raw fetch.
 */
export async function requestEngine<T>(
  path: string,
  init: { method: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown },
): Promise<EngineResult<T>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (CLIENT_TOKEN) headers['x-tradereply-token'] = CLIENT_TOKEN;

  try {
    const res = await fetch(path, {
      method: init.method,
      headers,
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    });

    const payload: any = await res.json().catch(() => null);

    if (!res.ok) {
      return { ok: false, status: res.status, data: payload, error: describeFailure(payload, res.status) };
    }
    return { ok: true, status: res.status, data: payload as T };
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: 'Could not reach the TradeReply AI engine: ' + (err?.message || 'network error'),
    };
  }
}
