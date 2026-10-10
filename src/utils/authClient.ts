/** Session-token client for accounts + connections. Token lives in localStorage. */
const KEY = 'tradereply_session_token';
const USER_KEY = 'tradereply_session_user';
export function getSessionToken(): string { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } }
export function getSessionUser(): { id: string; email: string; displayName: string } | null {
  try { const raw = localStorage.getItem(USER_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
export function setSession(token: string, user: any) {
  try { localStorage.setItem(KEY, token); localStorage.setItem(USER_KEY, JSON.stringify(user)); } catch {}
}
export function clearSession() { try { localStorage.removeItem(KEY); localStorage.removeItem(USER_KEY); } catch {} }
export function authHeaders(): Record<string, string> {
  const t = getSessionToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}
async function req<T>(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: any; error?: string }> {
  try {
    const res = await fetch(path, { ...(init || {}), headers: { 'Content-Type': 'application/json', ...authHeaders(), ...((init?.headers as any) || {}) } });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, status: res.status, data, error: (data && (data.message || data.error)) || `HTTP ${res.status}` };
    return { ok: true, status: res.status, data: data as T };
  } catch (e: any) { return { ok: false, status: 0, data: null, error: e?.message || 'network error' }; }
}
export const authApi = {
  me: () => req<{ user: any }>('/api/auth/me'),
  signup: (email: string, password: string, displayName: string) => req<{ user: any; token: string }>('/api/auth/signup', { method: 'POST', body: JSON.stringify({ email, password, displayName }) }),
  login: (email: string, password: string) => req<{ user: any; token: string }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => req('/api/auth/logout', { method: 'POST' }),
  connections: () => req<{ connections: any[] }>('/api/connections'),
  addConnection: (url: string) => req<{ connection: any }>('/api/connections', { method: 'POST', body: JSON.stringify({ url }) }),
  removeConnection: (id: string) => req(`/api/connections/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  extensionConfig: () => req<{ connections: any[]; matchPatterns: string[] }>('/api/extension-config'),
};
