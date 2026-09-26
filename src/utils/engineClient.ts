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

/**
 * Vite inlines this at build time, so it is NOT a secret — anyone can read it in the
 * bundle. It exists only so a deployment that sets TRADEREPLY_API_TOKEN stops random
 * scanners from spending the Gemini budget.
 */
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
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (CLIENT_TOKEN) headers['x-tradereply-token'] = CLIENT_TOKEN;

  try {
    const res = await fetch(path, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
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
