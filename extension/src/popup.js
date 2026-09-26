// The popup is an extension page, so it could call the network directly — it still
// relays through background.js so the API base URL and the shared token are resolved
// in exactly one place.
function requestEngine(endpoint, payload) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'TRADEREPLY_REQUEST', endpoint: endpoint, payload: payload }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, status: 0, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(response || { ok: false, status: 0, error: 'No response from the extension worker.' });
    });
  });
}

function engineErrorMessage(result) {
  const detail = result && result.data && (result.data.message || result.data.error);
  return detail || (result && result.error) || ('HTTP ' + (result && result.status));
}

document.getElementById('draft-btn').addEventListener('click', async () => {
  const msg = document.getElementById('msg').value;
  const tone = document.getElementById('tone').value;
  const status = document.getElementById('status');

  if (!msg.trim()) {
    status.innerText = 'Please paste a customer message.';
    return;
  }

  status.innerText = 'Drafting live reply...';
  try {
    const stored = await chrome.storage.local.get(['tradereplyProfile', 'tradereplyToneSettings']);
    const businessProfile = stored.tradereplyProfile || {};
    const toneSettings = stored.tradereplyToneSettings || {};

    const result = await requestEngine('generate-reply', {
      leadMessage: msg,
      tone: tone,
      businessProfile: businessProfile,
      replyLength: toneSettings.replyLength || 'standard',
      includeCheckatradeBadge: toneSettings.includeCheckatradeBadge !== false,
      includeCallToAction: toneSettings.includeCallToAction || 'site_visit',
      formalityLevel: toneSettings.formalityLevel || 3,
      autoSignOff: toneSettings.autoSignOff !== false,
      customInstructions: toneSettings.customRulePrompt || ''
    });

    if (!result.ok || !result.data || !result.data.replyText) {
      status.innerText = 'Engine error: ' + engineErrorMessage(result);
      return;
    }

    document.getElementById('msg').value = result.data.replyText;
    status.innerText = 'Live reply generated — copy or insert it into Checkatrade.';
  } catch (e) {
    status.innerText = 'Error: ' + e.message;
  }
});