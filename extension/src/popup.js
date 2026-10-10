// @ts-nocheck
// Popup: sign in to the TradeReply account, manage connected platform URLs,
// draft replies. Relays engine calls through background.js (single place
// that resolves API base + session token).
function requestEngine(endpoint, payload) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'TRADEREPLY_REQUEST', endpoint: endpoint, payload: payload }, (response) => {
      if (chrome.runtime.lastError) { resolve({ ok: false, status: 0, error: chrome.runtime.lastError.message }); return; }
      resolve(response || { ok: false, status: 0, error: 'No response from the extension worker.' });
    });
  });
}
function syncSites() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'TRADEREPLY_SYNC_SITES' }, (r) => resolve(r || { ok: false }));
  });
}
function engineErrorMessage(result) {
  const detail = result && result.data && (result.data.message || result.data.error);
  return detail || (result && result.error) || ('HTTP ' + (result && result.status));
}
const $ = (id) => document.getElementById(id);
async function apiBase() {
  const s = await chrome.storage.local.get('tradereplyApiUrl');
  const v = (s.tradereplyApiUrl || '').trim();
  return v ? v.replace(/\/$/, '') : null;
}
async function refreshAuthUI() {
  const s = await chrome.storage.local.get('tradereplySessionToken');
  const signedIn = Boolean((s.tradereplySessionToken || '').trim());
  $('auth-section').style.display = signedIn ? 'none' : 'block';
  $('main-section').style.display = signedIn ? 'block' : 'none';
  if (signedIn) void renderConnections();
}
async function renderConnections() {
  const s = await chrome.storage.local.get('tradereplyConnections');
  const list = s.tradereplyConnections || [];
  const el = $('conn-list');
  el.innerHTML = '';
  list.forEach((c) => {
    const d = document.createElement('div');
    d.textContent = (c.label || 'Site') + ' — ' + (c.host || c.url || '');
    el.appendChild(d);
  });
}
async function doAuth(mode) {
  const base = await apiBase();
  const status = $('status');
  const email = $('email').value.trim();
  const password = $('password').value;
  if (!base) { alert('Set the backend API URL on the options page first.'); return; }
  if (!email || !password) { alert('Enter email + password.'); return; }
  try {
    const res = await fetch(base + '/api/auth/' + (mode === 'signup' ? 'signup' : 'login'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password, displayName: email.split('@')[0] }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { alert('Auth failed: ' + (data.message || data.error || res.status)); return; }
    await chrome.storage.local.set({ tradereplySessionToken: data.token });
    await refreshAuthUI();
    const sync = await syncSites();
    alert(sync.ok ? 'Signed in. Extension activated on ' + (sync.count || 0) + ' connected site(s).' : 'Signed in. Open the web app Account tab to connect platform URLs.');
  } catch (e) { alert('Auth error: ' + e.message); }
}
document.getElementById('signin-btn').addEventListener('click', () => doAuth('login'));
document.getElementById('signup-btn').addEventListener('click', () => doAuth('signup'));
document.getElementById('signout-btn').addEventListener('click', async () => {
  await chrome.storage.local.remove(['tradereplySessionToken', 'tradereplyConnections', 'tradereplyMatchPatterns']);
  await refreshAuthUI();
});
document.getElementById('add-url-btn').addEventListener('click', async () => {
  const base = await apiBase();
  const s = await chrome.storage.local.get('tradereplySessionToken');
  const token = (s.tradereplySessionToken || '').trim();
  const url = $('new-url').value.trim();
  if (!url) return;
  try {
    const res = await fetch(base + '/api/connections', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ url: url }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { alert('Could not connect: ' + (data.message || data.error || res.status)); return; }
    $('new-url').value = '';
    await syncSites();
    await refreshAuthUI();
  } catch (e) { alert('Error: ' + e.message); }
});
document.getElementById('draft-btn').addEventListener('click', async () => {
  const msg = document.getElementById('msg').value;
  const tone = document.getElementById('tone').value;
  const status = document.getElementById('status');
  if (!msg.trim()) { status.innerText = 'Please paste a customer message.'; return; }
  status.innerText = 'Drafting live reply...';
  try {
    const stored = await chrome.storage.local.get(['tradereplyProfile', 'tradereplyToneSettings']);
    const businessProfile = stored.tradereplyProfile || {};
    const toneSettings = stored.tradereplyToneSettings || {};
    const result = await requestEngine('generate-reply', {
      leadMessage: msg, tone: tone, businessProfile: businessProfile,
      replyLength: toneSettings.replyLength || 'standard',
      includeCheckatradeBadge: toneSettings.includeCheckatradeBadge !== false,
      includeCallToAction: toneSettings.includeCallToAction || 'site_visit',
      formalityLevel: toneSettings.formalityLevel || 3,
      autoSignOff: toneSettings.autoSignOff !== false,
      customInstructions: toneSettings.customRulePrompt || ''
    });
    if (!result.ok || !result.data || !result.data.replyText) { status.innerText = 'Engine error: ' + engineErrorMessage(result); return; }
    document.getElementById('msg').value = result.data.replyText;
    status.innerText = 'Live reply generated — copy it into the chat.';
  } catch (e) { status.innerText = 'Error: ' + e.message; }
});
refreshAuthUI();
