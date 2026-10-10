/** File-backed accounts: email+password with scrypt hashes + token sessions. */
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
export interface AccountUser { id: string; email: string; displayName: string; passwordHash: string; createdAt: string; }
export interface AccountSession { token: string; userId: string; createdAt: string; expiresAt: string; }
interface StoreShape { version: number; users: AccountUser[]; sessions: AccountSession[]; }
const SESSION_TTL_MS = 30 * 24 * 3600 * 1000;
function newId(p: string) { return `${p}_${randomBytes(8).toString('hex')}`; }
function nowIso() { return new Date().toISOString(); }
function hashPassword(pw: string, saltHex?: string) {
  const salt = saltHex ?? randomBytes(16).toString('hex');
  const key = scryptSync(pw, Buffer.from(salt, 'hex'), 64);
  return `scrypt$${salt}$${key.toString('hex')}`;
}
function verifyPassword(pw: string, stored: string) {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const a = Buffer.from(hashPassword(pw, parts[1]));
  const b = Buffer.from(stored);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function normaliseEmail(raw: unknown) { return String(raw ?? '').trim().toLowerCase(); }
export function validateSignup(input: any): string | null {
  const email = normaliseEmail(input?.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return 'Enter a valid email address.';
  const pw = String(input?.password ?? '');
  if (pw.length < 8) return 'Password must be at least 8 characters.';
  if (pw.length > 200) return 'Password must be under 200 characters.';
  if (String(input?.displayName ?? '').trim().length > 80) return 'Display name must be under 80 characters.';
  return null;
}
export class AuthStore {
  private data: StoreShape = { version: 1, users: [], sessions: [] };
  private queue: Promise<unknown> = Promise.resolve();
  private loaded = false;
  constructor(private filePath: string) {}
  async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const p = JSON.parse(raw) as Partial<StoreShape>;
      if (Array.isArray(p.users)) this.data.users = p.users;
      if (Array.isArray(p.sessions)) this.data.sessions = p.sessions;
    } catch (e: any) { if (e?.code !== 'ENOENT') console.error('[auth] read failed:', e?.message); }
    this.loaded = true;
  }
  private async persist(): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(this.data, null, 2), 'utf8');
    await rename(tmp, this.filePath);
  }
  private enqueue<T>(fn: () => T | Promise<T>): Promise<T> {
    const next = this.queue.then(async () => { const r = await fn(); await this.persist(); return r; });
    this.queue = next.catch(() => undefined);
    return next;
  }
  private issue(userId: string): AccountSession {
    const now = Date.now();
    return { token: `tr_${randomBytes(24).toString('hex')}`, userId, createdAt: new Date(now).toISOString(), expiresAt: new Date(now + SESSION_TTL_MS).toISOString() };
  }
  private safe(u: AccountUser): AccountUser { return { ...u, passwordHash: '' }; }
  signup(email: string, password: string, displayName: string): Promise<{ user: AccountUser; token: string }> {
    return this.enqueue(() => {
      const clean = normaliseEmail(email);
      if (this.data.users.some((u) => u.email === clean)) { const e: any = new Error('An account with that email already exists — sign in instead.'); e.code = 'EMAIL_TAKEN'; throw e; }
      const user: AccountUser = { id: newId('user'), email: clean, displayName: displayName.trim() || clean.split('@')[0], passwordHash: hashPassword(password), createdAt: nowIso() };
      const s = this.issue(user.id);
      this.data.users.push(user); this.data.sessions.push(s);
      return { user: this.safe(user), token: s.token };
    });
  }
  login(email: string, password: string): Promise<{ user: AccountUser; token: string }> {
    return this.enqueue(() => {
      const clean = normaliseEmail(email);
      const found = this.data.users.find((u) => u.email === clean);
      if (!found || !verifyPassword(password, found.passwordHash)) { const e: any = new Error('Incorrect email or password.'); e.code = 'BAD_CREDENTIALS'; throw e; }
      const s = this.issue(found.id);
      const mine = this.data.sessions.filter((x) => x.userId === found.id);
      if (mine.length > 20) { const drop = new Set(mine.slice(0, mine.length - 20).map((x) => x.token)); this.data.sessions = this.data.sessions.filter((x) => !drop.has(x.token)); }
      this.data.sessions.push(s);
      return { user: this.safe(found), token: s.token };
    });
  }
  logout(token: string): Promise<void> {
    return this.enqueue(() => { this.data.sessions = this.data.sessions.filter((s) => s.token !== token); });
  }
  userForToken(token: string): AccountUser | null {
    if (!token) return null;
    const s = this.data.sessions.find((x) => x.token === token);
    if (!s || new Date(s.expiresAt).getTime() < Date.now()) return null;
    const u = this.data.users.find((x) => x.id === s.userId);
    return u ? this.safe(u) : null;
  }
}
