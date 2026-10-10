/** Per-user platform connections: the social URLs a user wants replies on. */
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
export interface PlatformConnection { id: string; userId: string; url: string; origin: string; host: string; label: string; matchPatterns: string[]; createdAt: string; }
interface Shape { version: number; connections: PlatformConnection[]; }
export class ConnectionStore {
  private data: Shape = { version: 1, connections: [] };
  private queue: Promise<unknown> = Promise.resolve();
  private loaded = false;
  constructor(private filePath: string) {}
  async load(): Promise<void> {
    if (this.loaded) return;
    try { const p = JSON.parse(await readFile(this.filePath, 'utf8')) as Partial<Shape>; if (Array.isArray(p.connections)) this.data.connections = p.connections; }
    catch (e: any) { if (e?.code !== 'ENOENT') console.error('[connections] read failed:', e?.message); }
    this.loaded = true;
  }
  private async persist(): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(this.data, null, 2), 'utf8');
    await rename(tmp, this.filePath);
  }
  private enqueue<T>(fn: () => T | Promise<T>): Promise<T> {
    const n = this.queue.then(async () => { const r = await fn(); await this.persist(); return r; });
    this.queue = n.catch(() => undefined);
    return n;
  }
  listForUser(userId: string): PlatformConnection[] {
    return this.data.connections.filter((c) => c.userId === userId);
  }
  add(userId: string, parsed: { url: string; origin: string; host: string; label: string; matchPatterns: string[] }): Promise<PlatformConnection> {
    return this.enqueue(() => {
      const mine = this.listForUser(userId);
      if (mine.some((c) => c.host === parsed.host)) { const e: any = new Error(`You already connected ${parsed.label} (${parsed.host}).`); e.code = 'DUPLICATE_HOST'; throw e; }
      if (mine.length >= 20) { const e: any = new Error('Connection limit reached (20). Remove one to add another.'); e.code = 'LIMIT'; throw e; }
      const c: PlatformConnection = { id: `conn_${randomBytes(6).toString('hex')}`, userId, url: parsed.url.slice(0, 500), origin: parsed.origin, host: parsed.host, label: parsed.label.slice(0, 60), matchPatterns: parsed.matchPatterns, createdAt: new Date().toISOString() };
      this.data.connections.unshift(c);
      return c;
    });
  }
  remove(userId: string, id: string): Promise<boolean> {
    return this.enqueue(() => {
      const before = this.data.connections.length;
      this.data.connections = this.data.connections.filter((c) => !(c.id === id && c.userId === userId));
      return this.data.connections.length < before;
    });
  }
  patternsForUser(userId: string): string[] {
    const out = new Set<string>();
    for (const c of this.listForUser(userId)) for (const p of c.matchPatterns) out.add(p);
    return [...out];
  }
}
