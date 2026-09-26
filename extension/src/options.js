// TradeReply AI options page — persists REAL settings to chrome.storage.local.
// An external file is required because inline scripts are blocked by the Manifest V3 CSP.
const PROFILE_FIELDS = [
  ['company', 'companyName'],
  ['tradeType', 'tradeType'],
  ['contactPerson', 'contactPerson'],
  ['phone', 'phone'],
  ['email', 'email'],
  ['website', 'website'],
  ['years', 'yearsInBusiness'],
  ['score', 'checkatradeRating'],
  ['reviews', 'reviewsCount'],
  ['callout', 'calloutFee'],
  ['hourlyRate', 'hourlyRate'],
  ['travelRadius', 'travelRadius'],
  ['guarantee', 'guaranteeDetails'],
  ['timeslots', 'availableTimeslots'],
  ['accreditation', 'accreditationBadge']
];

// These must be numbers rather than strings so the generated prompt agrees with the
// web app's BusinessProfile type.
const NUMERIC_FIELDS = ['yearsInBusiness', 'checkatradeRating', 'reviewsCount'];

const statusEl = document.getElementById('tr-save-status');

async function loadSettings() {
  const stored = await chrome.storage.local.get([
    'tradereplyProfile',
    'tradereplyToneSettings',
    'tradereplyApiUrl',
    'tradereplyApiToken'
  ]);
  const profile = stored.tradereplyProfile || {};
  const toneSettings = stored.tradereplyToneSettings || {};

  PROFILE_FIELDS.forEach((pair) => {
    const el = document.getElementById(pair[0]);
    if (!el) return;
    const value = profile[pair[1]];
    el.value = value === undefined || value === null ? '' : String(value);
  });

  if (stored.tradereplyApiUrl) document.getElementById('api').value = stored.tradereplyApiUrl;
  if (stored.tradereplyApiToken) document.getElementById('apiToken').value = stored.tradereplyApiToken;

  // Every reply-shaping setting the engine understands is persisted here, not just
  // the tone: otherwise the extension silently replies with server defaults.
  if (toneSettings.activeTone) document.getElementById('tone').value = toneSettings.activeTone;
  if (toneSettings.replyLength) document.getElementById('replyLength').value = toneSettings.replyLength;
  if (toneSettings.includeCallToAction) document.getElementById('cta').value = toneSettings.includeCallToAction;
  if (typeof toneSettings.formalityLevel === 'number') {
    document.getElementById('formality').value = String(toneSettings.formalityLevel);
  }
  document.getElementById('badge').checked = toneSettings.includeCheckatradeBadge !== false;
  document.getElementById('signOff').checked = toneSettings.autoSignOff !== false;
  document.getElementById('customRules').value = toneSettings.customRulePrompt || '';

  statusEl.textContent = Object.keys(profile).length
    ? 'Loaded your saved configuration.'
    : 'No configuration saved yet — enter your real business details.';
}

function readProfileFromForm() {
  const profile = {};
  PROFILE_FIELDS.forEach((pair) => {
    const el = document.getElementById(pair[0]);
    if (!el) return;
    const raw = el.value.trim();
    if (NUMERIC_FIELDS.indexOf(pair[1]) !== -1) {
      const parsed = Number(raw);
      profile[pair[1]] = raw === '' || !isFinite(parsed) ? 0 : parsed;
    } else {
      profile[pair[1]] = raw;
    }
  });
  return profile;
}

document.getElementById('tr-save-btn').addEventListener('click', async () => {
  const formality = Number(document.getElementById('formality').value);

  await chrome.storage.local.set({
    tradereplyProfile: readProfileFromForm(),
    tradereplyToneSettings: {
      activeTone: document.getElementById('tone').value,
      replyLength: document.getElementById('replyLength').value,
      includeCallToAction: document.getElementById('cta').value,
      includeCheckatradeBadge: document.getElementById('badge').checked,
      formalityLevel: isFinite(formality) && formality >= 1 && formality <= 5 ? Math.round(formality) : 3,
      autoSignOff: document.getElementById('signOff').checked,
      customRulePrompt: document.getElementById('customRules').value.trim()
    },
    tradereplyApiUrl: document.getElementById('api').value.trim(),
    tradereplyApiToken: document.getElementById('apiToken').value.trim()
  });

  statusEl.textContent = 'Saved to chrome.storage.local at ' + new Date().toLocaleTimeString();
});

loadSettings();