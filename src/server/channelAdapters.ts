/**
 * Channel adapter seam.
 *
 * Checkatrade and MyBuilder expose no public API without a commercial agreement,
 * so there is nothing to integrate against today. Rather than pretend otherwise
 * (or scatter `if (platform === ...)` through the routes), every channel is
 * expressed as this one interface and a driver is registered for it.
 *
 * Real leads reach the workspace through the browser extension today. When
 * official API access is granted, implement `ChannelDriver` for that platform,
 * register it in `DRIVERS`, and the workspace ingests real leads with no route
 * or UI changes.
 */

import type { WorkspaceLead } from './workspaceStore.ts';

export interface IncomingLead {
  externalId: string;
  platform: string;
  customerName: string;
  messageText: string;
  receivedAt: string;
  phone?: string;
  email?: string;
  location?: string;
  postcode?: string;
  tradeCategory?: string;
  budgetStated?: string;
  raw?: unknown;
}

export interface ChannelDriver {
  readonly platform: string;
  /** False until real API access is granted, so the UI can label the source honestly. */
  readonly live: boolean;
  /** Fetch leads that have arrived since `since`. Return [] when not implemented. */
  fetchLeads(since: string): Promise<IncomingLead[]>;
  /**
   * Send a message to the customer. NOT IMPLEMENTED for any driver: TradeReply AI
   * drafts replies and a human sends them, so no credential can ever be used to
   * send unsolicited messages on a user's behalf.
   */
  sendMessage?(lead: WorkspaceLead, body: string): Promise<void>;
}

export class DemoChannelDriver implements ChannelDriver {
  readonly platform = 'demo';
  /** The demo driver fabricates nothing: it is an explicit, labelled preview. */
  readonly live = false;

  async fetchLeads(): Promise<IncomingLead[]> {
    return [];
  }
}

export const DRIVERS: ChannelDriver[] = [new DemoChannelDriver()];

export function driverFor(platform: string): ChannelDriver | undefined {
  const key = platform.trim().toLowerCase();
  return DRIVERS.find((d) => d.platform === key);
}

/** True only when a real, credentialed driver backs this platform. */
export function isLiveChannel(platform: string): boolean {
  return driverFor(platform)?.live === true;
}
