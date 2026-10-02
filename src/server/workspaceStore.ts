/**
 * File-backed workspace store.
 *
 * WHY NOT node:sqlite: it is still flagged experimental on Node 24 and prints a
 * warning on every boot. A tradesperson's queue is small (hundreds of leads, not
 * millions), so a single JSON file with atomic writes is the better trade here:
 * zero native dependencies, trivially portable to any free host, and easy to back
 * up or inspect. Swap this module for Postgres later without touching the routes.
 *
 * Writes are serialised through a promise chain and land via a temp file + rename,
 * so a crash mid-write can never leave a half-written queue on disk.
 */

import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import path from 'node:path';

export type LeadStage = 'new' | 'analyzed' | 'drafted' | 'replied' | 'won' | 'lost';
export type LeadUrgency = 'emergency' | 'urgent' | 'flexible';

export interface WorkspaceMessage {
  id: string;
  author: 'customer' | 'tradesperson' | 'draft';
  body: string;
  createdAt: string;
  /** Set when this row came from a real channel adapter rather than the demo. */
  channel?: string;
}

export interface WorkspaceLead {
  id: string;
  customerName: string;
  platform: string;
  phone: string;
  email: string;
  location: string;
  postcode: string;
  tradeCategory: string;
  jobTitle: string;
  /** The opening enquiry, retained verbatim so the UI and the AI always agree. */
  messageText: string;
  urgency: LeadUrgency;
  stage: LeadStage;
  /** ISO timestamp, used for SLA maths (the old UI only had "6 minutes ago"). */
  receivedAt: string;
  budgetStated: string;
  isDemo: boolean;
  archived: boolean;
  messages: WorkspaceMessage[];
  createdAt: string;
  updatedAt: string;
}

interface StoreShape {
  version: number;
  leads: WorkspaceLead[];
}

const SCHEMA_VERSION = 1;

export function newId(prefix: string): string {
  // crypto.randomUUID avoids a timestamp-based id that would collide when two
  // leads arrive in the same millisecond.
  return `${prefix}_${globalThis.crypto.randomUUID().slice(0, 8)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

const URGENCIES: readonly LeadUrgency[] = ['emergency', 'urgent', 'flexible'];
const STAGES: readonly LeadStage[] = ['new', 'analyzed', 'drafted', 'replied', 'won', 'lost'];

/** Normalise an inbound lead. Every field is clamped so a hostile payload cannot
 *  bloat the store or break the UI that renders it. */
export function normaliseLead(input: any, now: string): WorkspaceLead {
  const message = typeof input?.messageText === 'string' ? input.messageText.trim() : '';
  return {
    id: typeof input?.id === 'string' && input.id ? input.id : newId('lead'),
    customerName: String(input?.customerName ?? 'Unknown customer').slice(0, 120),
    platform: String(input?.platform ?? 'Checkatrade').slice(0, 40),
    phone: String(input?.phone ?? '').slice(0, 40),
    email: String(input?.email ?? '').slice(0, 160),
    location: String(input?.location ?? '').slice(0, 120),
    postcode: String(input?.postcode ?? '').slice(0, 16),
    tradeCategory: String(input?.tradeCategory ?? '').slice(0, 120),
    jobTitle: String(input?.jobTitle ?? message.slice(0, 80)).slice(0, 160),
    messageText: message.slice(0, 4000),
    urgency: URGENCIES.includes(input?.urgency) ? input.urgency : 'flexible',
    stage: STAGES.includes(input?.stage) ? input.stage : 'new',
    receivedAt: typeof input?.receivedAt === 'string' ? input.receivedAt : now,
    budgetStated: String(input?.budgetStated ?? '').slice(0, 120),
    isDemo: input?.isDemo !== false,
    archived: input?.archived === true,
    messages: Array.isArray(input?.messages) ? input.messages.slice(0, 200) : [],
    createdAt: now,
    updatedAt: now,
  };
}

export class WorkspaceStore {
  private data: StoreShape = { version: SCHEMA_VERSION, leads: [] };
  private loaded = false;
  /** Serialises writes so two concurrent requests cannot interleave a save. */
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as StoreShape;
      if (parsed && Array.isArray(parsed.leads)) {
        this.data = { version: SCHEMA_VERSION, leads: parsed.leads };
      }
    } catch (err: any) {
      // A missing file is the normal first-run case, not an error worth throwing on.
      if (err?.code !== 'ENOENT') {
        console.error('[workspace] could not read store, starting empty:', err?.message);
      }
    }
    this.loaded = true;
  }

  private async persist(): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(this.data, null, 2), 'utf8');
    // rename is atomic on the same filesystem, so a crash can never leave a
    // half-written queue on disk.
    await rename(tmp, this.filePath);
  }

  /** Queue a mutation, then save. Resolves once the write has landed. */
  private enqueue<T>(fn: () => T | Promise<T>): Promise<T> {
    const next = this.queue.then(async () => {
      const result = await fn();
      await this.persist();
      return result;
    });
    // Keep the chain alive even when this mutation throws.
    this.queue = next.catch(() => undefined);
    return next;
  }

  listLeads(): WorkspaceLead[] {
    return this.data.leads;
  }

  getLead(id: string): WorkspaceLead | undefined {
    return this.data.leads.find((l) => l.id === id);
  }

  addLead(input: any): Promise<WorkspaceLead> {
    return this.enqueue(() => {
      const lead = normaliseLead(input, nowIso());
      // The first customer message becomes the first row in the thread, so the UI
      // never has to special-case a lead that exists only as a flat message.
      if (lead.messageText) {
        lead.messages.unshift({
          id: newId('msg'),
          author: 'customer',
          body: String(lead.messageText).slice(0, 4000),
          createdAt: lead.receivedAt,
        });
      }
      this.data.leads.unshift(lead);
      return lead;
    });
  }

  updateLead(id: string, patch: any): Promise<WorkspaceLead | undefined> {
    return this.enqueue(() => {
      const lead = this.getLead(id);
      if (!lead) return undefined;
      if (STAGES.includes(patch?.stage)) lead.stage = patch.stage;
      if (typeof patch?.archived === 'boolean') lead.archived = patch.archived;
      if (typeof patch?.customerName === 'string' && patch.customerName) {
        lead.customerName = patch.customerName.slice(0, 120);
      }
      lead.updatedAt = nowIso();
      return lead;
    });
  }

  addMessage(leadId: string, message: any): Promise<WorkspaceMessage | undefined> {
    return this.enqueue(() => {
      const lead = this.getLead(leadId);
      if (!lead) return undefined;
      const entry: WorkspaceMessage = {
        id: newId('msg'),
        author: (['customer', 'tradesperson', 'draft'] as const).includes(message?.author)
          ? message.author
          : 'tradesperson',
        body: String(message?.body ?? '').slice(0, 8000),
        createdAt: typeof message?.createdAt === 'string' ? message.createdAt : nowIso(),
        channel: message?.channel ? String(message.channel).slice(0, 40) : undefined,
      };
      lead.messages.push(entry);
      // Sending a real reply advances the pipeline; saving a draft must not.
      if (entry.author === 'tradesperson') lead.stage = 'replied';
      lead.updatedAt = nowIso();
      return entry;
    });
  }

  deleteLead(id: string): Promise<boolean> {
    return this.enqueue(() => {
      const before = this.data.leads.length;
      this.data.leads = this.data.leads.filter((l) => l.id !== id);
      return this.data.leads.length < before;
    });
  }
}
