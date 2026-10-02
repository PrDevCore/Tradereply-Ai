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
// runs on is compromised. 'file-lead' is included so a real Checkatrade enquiry the
// content script detects can be filed into the workspace queue.
const ALLOWED_ENDPOINTS = [
  'generate-reply',
  'analyze-lead',
  'generate-template',
  'rewrite-draft',
  'file-lead',
];

// A malformed or unsubstituted base URL produces an opaque "Failed to fetch" from
// fetch, so it is rejected here where the real cause can still be named.
function isUsableApiBase(value) {
  if (!value || value.indexOf('__TRADEREPLY_API_ORIGIN__') !== -1) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  } catch (e) {
    return false;
  }
}

async function resolveApiBase() {
  try {
    const stored = await chrome.storage.local.get('tradereplyApiUrl');
    const configured = (stored.tradereplyApiUrl || '').trim();
    if (configured) {
      const trimmed = configured.endsWith('/') ? configured.slice(0, -1) : configured;
      if (isUsableApiBase(trimmed)) return trimmed;
      return null; // configured but unusable — say so instead of failing opaquely
    }
  } catch (e) {
    // Storage unavailable — fall back to the origin this build was generated from.
  }
  return isUsableApiBase(DEFAULT_API_BASE) ? DEFAULT_API_BASE : null;
}

async function readSharedToken() {
  try {
    const stored = await chrome.storage.local.get('tradereplyApiToken');
    return (stored.tradereplyApiToken || '').trim();
  } catch (e) {
    return '';
  }
}

// A cold instance answers in ~25s, a warm one in well under a second. Waking it
// through the cheap /api/health route first means the real call lands on a warm
// socket instead of racing the cold start and losing the connection.
const COLD_START_WAKE_TIMEOUT_MS = 60000;
const ENGINE_CALL_TIMEOUT_MS = 90000;
const RETRY_BACKOFF_MS = 1500;

// Chrome's fetch reports every network-level problem as "Failed to fetch" with no
// cause. Retry once: cold starts, dropped mobile sockets and brief DNS blips all
// succeed on the second attempt, while a genuinely wrong URL still fails fast.
const MAX_ATTEMPTS = 2;

async function callEngine(endpoint, payload) {
  const apiBase = await resolveApiBase();
  if (!apiBase) {
    return {
      ok: false,
      status: 0,
      error: 'No usable TradeReply AI API URL is configured. Open the extension options and set it to your server address, for example https://your-server.onrender.com.'
    };
  }

  const token = await readSharedToken();
  const url = apiBase + '/api/' + endpoint;

  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['x-tradereply-token'] = token;

  let lastError = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (attempt > 1) await new Promise((resolve) => setTimeout(resolve, RETRY_BACKOFF_MS * attempt));

    // Only on the first attempt: once the instance is known warm, retrying the
    // health probe only adds latency before the call that the user is waiting on.
    if (attempt === 1) {
      await wakeInstance(apiBase);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ENGINE_CALL_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload || {}),
        signal: controller.signal
      });

      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data: data };
    } catch (err) {
      lastError = err;
    } finally {
      clearTimeout(timer);
    }
  }

  // Only a network-level failure reaches this point; an HTTP error status was
  // already returned above with its real body.
  const aborted = lastError && lastError.name === 'AbortError';
  return {
    ok: false,
    status: 0,
    error: describeNetworkFailure(apiBase, aborted),
    cause: (lastError && lastError.message) || 'network error'
  };
}

// Bring the API host up without making the user pay for a failed attempt.
async function wakeInstance(apiBase) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), COLD_START_WAKE_TIMEOUT_MS);
  try {
    const res = await fetch(apiBase + '/api/health', { method: 'GET', signal: controller.signal });
    if (res.ok) await res.json().catch(() => ({}));
    return true;
  } catch (e) {
    // A failed wake-up is not fatal: the POST below reports the real problem.
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// An actionable message instead of a bare "Failed to fetch": the two usual causes
// are a mistyped API URL in the options page and a blocked host permission.
function describeNetworkFailure(apiBase, aborted) {
  if (aborted) {
    return 'The engine at ' + apiBase + ' did not respond in time. It may be starting up or overloaded — try again in a moment.';
  }
  return 'Could not reach the engine at ' + apiBase +
    '. Check the API URL in the extension options, and confirm the extension has permission for that host.';
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
