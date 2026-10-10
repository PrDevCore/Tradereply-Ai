/**
 * Platform URL helpers shared by server routes.
 *
 * Users bring ANY social / marketplace URL (e.g. a Facebook page inbox,
 * Instagram profile, X account, TikTok, LinkedIn, Checkatrade profile…).
 * We never validate that the URL is reachable or scrape it server-side —
 * the browser extension does the on-page work. We only:
 *  - require http(s),
 *  - normalise to an origin + host,
 *  - guess a friendly platform label for the UI,
 *  - derive MV3 match patterns for the extension.
 */

export interface ParsedPlatformUrl {
  /** Normalised origin, e.g. https://www.facebook.com */
  origin: string;
  /** Lower-cased hostname, e.g. www.facebook.com */
  host: string;
  /** Full normalised URL (origin + path, no hash). */
  url: string;
  /** Friendly label, e.g. "Facebook". */
  label: string;
  /** MV3 match patterns covering apex + www + subdomains. */
  matchPatterns: string[];
}

const KNOWN: Array<{ test: RegExp; label: string }> = [
  { test: /(^|\.)facebook\.com$/i, label: 'Facebook' },
  { test: /(^|\.)fb\.com$/i, label: 'Facebook' },
  { test: /(^|\.)instagram\.com$/i, label: 'Instagram' },
  { test: /(^|\.)x\.com$/i, label: 'X (Twitter)' },
  { test: /(^|\.)twitter\.com$/i, label: 'X (Twitter)' },
  { test: /(^|\.)tiktok\.com$/i, label: 'TikTok' },
  { test: /(^|\.)linkedin\.com$/i, label: 'LinkedIn' },
  { test: /(^|\.)youtube\.com$/i, label: 'YouTube' },
  { test: /(^|\.)whatsapp\.com$/i, label: 'WhatsApp' },
  { test: /(^|\.)web\.whatsapp\.com$/i, label: 'WhatsApp Web' },
  { test: /(^|\.)messenger\.com$/i, label: 'Messenger' },
  { test: /(^|\.)telegram\.me$/i, label: 'Telegram' },
  { test: /(^|\.)t\.me$/i, label: 'Telegram' },
  { test: /(^|\.)discord\.com$/i, label: 'Discord' },
  { test: /(^|\.)reddit\.com$/i, label: 'Reddit' },
  { test: /(^|\.)pinterest\./i, label: 'Pinterest' },
  { test: /(^|\.)snapchat\.com$/i, label: 'Snapchat' },
  { test: /(^|\.)threads\.net$/i, label: 'Threads' },
  { test: /(^|\.)checkatrade\.com$/i, label: 'Checkatrade' },
  { test: /(^|\.)mybuilder\.com$/i, label: 'MyBuilder' },
  { test: /(^|\.)ratedpeople\.com$/i, label: 'Rated People' },
  { test: /(^|\.)bark\.com$/i, label: 'Bark' },
  { test: /(^|\.)trustatrader\.com$/i, label: 'TrustATrader' },
  { test: /(^|\.)ebay\./i, label: 'eBay' },
  { test: /(^|\.)etsy\.com$/i, label: 'Etsy' },
  { test: /(^|\.)amazon\./i, label: 'Amazon' },
  { test: /(^|\.)airbnb\./i, label: 'Airbnb' },
];

export function detectLabel(host: string): string {
  const h = host.toLowerCase();
  for (const k of KNOWN) if (k.test.test(h)) return k.label;
  // Fallback: prettify the registrable-ish host.
  const bare = h.replace(/^www\./, '');
  const first = bare.split('.')[0] || bare;
  return first.charAt(0).toUpperCase() + first.slice(1);
}

function apexHost(host: string): string {
  const parts = host.toLowerCase().split('.').filter(Boolean);
  if (parts.length <= 2) return parts.join('.');
  // Keep last two labels (good enough without a PSL dependency).
  return parts.slice(-2).join('.');
}

export function matchPatternsFor(host: string): string[] {
  const h = host.toLowerCase();
  const apex = apexHost(h.replace(/^www\./, ''));
  return [`*://*.${apex}/*`, `*://${apex}/*`];
}

export function parsePlatformUrl(raw: unknown): ParsedPlatformUrl {
  if (typeof raw !== 'string' || !raw.trim()) throw new Error('Enter the URL of the social page or inbox you want replies on.');
  let url: URL;
  try {
    // Allow bare "facebook.com/page" by prepending https://.
    const candidate = /^\w+:\/\//.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`;
    url = new URL(candidate);
  } catch {
    throw new Error('That URL is not valid. Copy it from your browser address bar, e.g. https://www.facebook.com/yourpage.');
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('URL must start with http:// or https://.');
  if (url.username || url.password) throw new Error('URLs with embedded credentials are not accepted.');
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (!host.includes('.') && host !== 'localhost') throw new Error('That host does not look like a public website.');
  url.hash = '';
  return {
    origin: url.origin,
    host,
    url: url.toString(),
    label: detectLabel(host),
    matchPatterns: matchPatternsFor(host),
  };
}
