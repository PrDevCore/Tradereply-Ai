// TradeReply AI service worker (Manifest V3).
//
// Why this file exists: every engine call must originate from the extension's own
// origin. Since Chrome 85 a content script's fetch inherits the PAGE's origin, so a
// cross-origin call to the TradeReply engine is blocked by CORS. An extension
// service worker is exempt from that rule, so it owns the request and relays only
// the result back to the page.
const DEFAULT_API_BASE = '__TRADEREPLY_API_ORIGIN__';

// The only endpoints this worker will ever call. The page context sends an endpoint
// NAME, never a URL, so this cannot be turned into an open proxy even if the page it
// runs on is compromised.
const ALLOWED_ENDPOINTS = ['generate-reply', 'analyze-lead', 'generate-template', 'rewrite-draft'];

async function resolveApiBase() {
  try {
    const stored = await chrome.storage.local.get('tradereplyApiUrl');
    const configured = (stored.tradereplyApiUrl || '').trim();
    if (configured) return configured.endsWith('/') ? configured.slice(0, -1) : configured;
  } catch (e) {
    // Storage unavailable — fall back to the origin this build was generated from.
  }
  return DEFAULT_API_BASE;
}

async function readSharedToken() {
  try {
    const stored = await chrome.storage.local.get('tradereplyApiToken');
    return (stored.tradereplyApiToken || '').trim();
  } catch (e) {
    return '';
  }
}

async function callEngine(endpoint, payload) {
  const apiBase = await resolveApiBase();
  const token = await readSharedToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['x-tradereply-token'] = token;

  const res = await fetch(apiBase + '/api/' + endpoint, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(payload || {})
  });

  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data: data };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== 'TRADEREPLY_REQUEST') return undefined;

  if (ALLOWED_ENDPOINTS.indexOf(message.endpoint) === -1) {
    sendResponse({ ok: false, status: 400, error: 'Unsupported endpoint: ' + String(message.endpoint) });
    return undefined;
  }

  callEngine(message.endpoint, message.payload)
    .then(sendResponse)
    .catch((err) => {
      sendResponse({ ok: false, status: 0, error: (err && err.message) || 'network error' });
    });

  return true; // keeps the message channel open for the async reply
});
