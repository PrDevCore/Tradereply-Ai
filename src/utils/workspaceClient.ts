/**
 * Client for the workspace queue. Mirrors the engine client: failures always come
 * back as `ok: false` with a readable reason, never thrown, so a workspace panel can
 * never end up blank because a request failed.
 */

import { postEngine, requestEngine } from './engineClient.ts';
import type { EngineResult } from './engineClient.ts';

export type LeadStage = 'new' | 'analyzed' | 'drafted' | 'replied' | 'won' | 'lost';
export type LeadUrgency = 'emergency' | 'urgent' | 'flexible';

export interface WorkspaceMessage {
  id: string;
  author: 'customer' | 'tradesperson' | 'draft';
  body: string;
  createdAt: string;
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
  messageText: string;
  urgency: LeadUrgency;
  stage: LeadStage;
  receivedAt: string;
  budgetStated: string;
  isDemo: boolean;
  archived: boolean;
  messages: WorkspaceMessage[];
  createdAt: string;
  updatedAt: string;
  /** False until a real channel driver exists, so the UI cannot imply a live API. */
  channelLive?: boolean;
}

export interface QueueCounts {
  total: number;
  unresponded: number;
}

function query(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : '';
}

export async function listLeads(filters: {
  stage?: string;
  search?: string;
} = {}): Promise<EngineResult<{ leads: WorkspaceLead[]; counts: QueueCounts; liveChannels: boolean }>> {
  return requestEngine(`/api/leads${query({ stage: filters.stage, search: filters.search })}`, {
    method: 'GET',
  });
}

export async function createLead(payload: Record<string, unknown>): Promise<EngineResult<{ lead: WorkspaceLead }>> {
  return postEngine('/api/leads', payload);
}

export async function setStage(id: string, stage: LeadStage): Promise<EngineResult<{ lead: WorkspaceLead }>> {
  return requestEngine(`/api/leads/${encodeURIComponent(id)}`, { method: 'PATCH', body: { stage } });
}

export async function addMessage(
  id: string,
  body: string,
  author: WorkspaceMessage['author'],
): Promise<EngineResult<{ message: WorkspaceMessage; lead: WorkspaceLead }>> {
  return postEngine(`/api/leads/${encodeURIComponent(id)}/messages`, { body, author });
}

export async function deleteLead(id: string): Promise<EngineResult<{ deleted: boolean }>> {
  return requestEngine(`/api/leads/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/** Human-friendly age for a queue row, e.g. "4m", "3h", "2d". */
export function relativeAge(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const seconds = Math.max(0, Math.floor((now - then) / 1000));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

/**
 * Response-time pressure for an unanswered lead. Emergency work that has waited
 * over an hour is the case that loses a job, so that is where the UI shouts.
 */
export function slaState(lead: WorkspaceLead, now: number = Date.now()): 'ok' | 'warning' | 'breached' {
  if (lead.stage !== 'new') return 'ok';
  const minutes = (now - new Date(lead.receivedAt).getTime()) / 60000;
  if (lead.urgency === 'emergency') return minutes > 60 ? 'breached' : minutes > 30 ? 'warning' : 'ok';
  if (lead.urgency === 'urgent') return minutes > 240 ? 'breached' : minutes > 120 ? 'warning' : 'ok';
  return minutes > 1440 ? 'breached' : minutes > 720 ? 'warning' : 'ok';
}
