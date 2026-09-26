// TradeReply AI Content Script for Checkatrade & Trade Portals
// IMPORTANT: this file never calls the API itself. Since Chrome 85 a content
// script's fetch/XHR inherits the page's origin, so a cross-origin call to the
// TradeReply engine is blocked by CORS. Every request is relayed to background.js,
// which runs in the extension's own origin and is therefore exempt.
(function() {
  console.log('[TradeReply AI] Extension initialized on Checkatrade');

  const REQUEST_TIMEOUT_MS = 90000;

  // Relay one request through the service worker. The endpoint NAME is the only
  // thing the page context controls — never a full URL — so a compromised page
  // cannot turn this into an open proxy.
  function requestEngine(endpoint, payload) {
    return new Promise((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        resolve({ ok: false, status: 0, error: 'The extension worker did not respond in time.' });
      }, REQUEST_TIMEOUT_MS);

      chrome.runtime.sendMessage(
        { type: 'TRADEREPLY_REQUEST', endpoint: endpoint, payload: payload },
        (response) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          if (chrome.runtime.lastError) {
            resolve({ ok: false, status: 0, error: chrome.runtime.lastError.message });
            return;
          }
          resolve(response || { ok: false, status: 0, error: 'No response from the extension worker.' });
        }
      );
    });
  }

  // One place that turns a relay result into something a tradesperson can act on.
  function engineErrorMessage(result) {
    if (!result) return 'no response from the extension worker';
    const detail = result.data && (result.data.message || result.data.error);
    return detail || result.error || ('HTTP ' + result.status);
  }

  // Coalesce bursts of DOM mutations into a single re-scan.
  function debounce(fn, waitMs) {
    let timer = null;
    return function () {
      if (timer) clearTimeout(timer);
      timer = setTimeout(fn, waitMs);
    };
  }

  function findChatInput() {
    return document.querySelector('textarea[name="message"], textarea[placeholder*="message" i], textarea[placeholder*="reply" i], div[contenteditable="true"]');
  }

  function findCustomerMessage() {
    // Detect Checkatrade lead text container
    const msgElements = document.querySelectorAll('.message-body, .lead-description, [data-testid="lead-message"], .chat-bubble--customer');
    if (msgElements.length > 0) {
      return Array.from(msgElements).map(el => el.innerText.trim()).join('\n\n');
    }
    return '';
  }

  // Insert generated text into the composer without ever using innerHTML: the text
  // is derived from page content plus model output, so it must be treated as data.
  function insertReply(text) {
    // Re-query rather than reusing the node captured at injection time: Checkatrade
    // re-renders the composer on many interactions, leaving the old node detached.
    const target = findChatInput();
    if (!target) return;

    if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
      target.value = text;
      target.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }

    target.textContent = '';
    text.split('\n').forEach((line, index) => {
      if (index > 0) target.appendChild(document.createElement('br'));
      target.appendChild(document.createTextNode(line));
    });
    target.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function injectFloatingBar() {
    if (document.getElementById('tradereply-floating-widget')) return;

    // Only activate on a page that genuinely contains a customer enquiry.
    // Never inject speculatively and never invent a lead message.
    if (!findCustomerMessage()) return;

    const inputArea = findChatInput();
    if (!inputArea) return;

    const widget = document.createElement('div');
    widget.id = 'tradereply-floating-widget';
    // Static, developer-authored markup only — there is deliberately no interpolation
    // here. Never splice page or model text into this string; use textContent or DOM
    // nodes for anything untrusted (see insertReply and the preview below).
    widget.innerHTML = `
      <div class="tr-badge">
        <span class="tr-logo">⚡</span>
        <span class="tr-title">TradeReply AI</span>
        <select id="tr-tone-select">
          <option value="professional_polished">👔 Professional</option>
          <option value="friendly_approachable">🤝 Friendly</option>
          <option value="urgent_fasttrack">🚨 Urgent Dispatch</option>
          <option value="direct_pricing">💷 Direct Pricing</option>
          <option value="consultative_expert">🧠 Consultative</option>
        </select>
        <button id="tr-generate-btn" class="tr-primary-btn">✨ Draft Auto-Reply</button>
        <button id="tr-open-options-btn" class="tr-secondary-btn" title="Template library & options">📚 Templates</button>
      </div>
      <div id="tr-preview-box" style="display:none;"></div>
    `;

    inputArea.parentNode.insertBefore(widget, inputArea);

    document.getElementById('tr-generate-btn').addEventListener('click', async () => {
      const btn = document.getElementById('tr-generate-btn');
      const previewBox = document.getElementById('tr-preview-box');
      const tone = document.getElementById('tr-tone-select').value;
      const leadText = findCustomerMessage();

      if (!leadText) {
        alert('TradeReply AI: no customer enquiry text detected on this page. Open the actual lead thread, or use the extension popup to paste the message manually.');
        return;
      }

      btn.disabled = true;
      btn.innerText = '⏳ Drafting...';

      try {
        const stored = await chrome.storage.local.get(['tradereplyProfile', 'tradereplyToneSettings']);
        const businessProfile = stored.tradereplyProfile || {};
        const toneSettings = stored.tradereplyToneSettings || {};

        const result = await requestEngine('generate-reply', {
          leadMessage: leadText,
          businessProfile: businessProfile,
          tone: tone,
          replyLength: toneSettings.replyLength || 'standard',
          includeCheckatradeBadge: toneSettings.includeCheckatradeBadge !== false,
          includeCallToAction: toneSettings.includeCallToAction || 'site_visit',
          formalityLevel: toneSettings.formalityLevel || 3,
          autoSignOff: toneSettings.autoSignOff !== false,
          customInstructions: toneSettings.customRulePrompt || ''
        });

        if (!result.ok || !result.data || !result.data.replyText) {
          alert('TradeReply AI engine error: ' + engineErrorMessage(result));
          return;
        }

        const data = result.data;

        const matchLabel = typeof data.confidenceScore === 'number'
          ? ' (' + data.confidenceScore + '% match)'
          : '';

        previewBox.textContent = '';
        const previewHeader = document.createElement('div');
        previewHeader.className = 'tr-preview-header';

        const previewLabel = document.createElement('strong');
        previewLabel.textContent = '✨ Suggested Reply' + matchLabel + ':';

        const insertBtn = document.createElement('button');
        insertBtn.id = 'tr-insert-btn';
        insertBtn.className = 'tr-insert-btn';
        insertBtn.textContent = '📋 Insert to Chat';

        previewHeader.appendChild(previewLabel);
        previewHeader.appendChild(insertBtn);

        // Built from DOM nodes, never from markup: the reply is model output derived
        // from text scraped off the page, so it must never be parsed as HTML.
        const previewText = document.createElement('p');
        previewText.className = 'tr-preview-text';
        data.replyText.split('\n').forEach((line, index) => {
          if (index > 0) previewText.appendChild(document.createElement('br'));
          previewText.appendChild(document.createTextNode(line));
        });

        previewBox.appendChild(previewHeader);
        previewBox.appendChild(previewText);
        previewBox.style.display = 'block';

        insertBtn.addEventListener('click', () => {
          insertReply(data.replyText);
          previewBox.style.display = 'none';
        });
      } catch (err) {
        alert('Could not reach the TradeReply AI engine: ' + err.message);
      } finally {
        btn.disabled = false;
        btn.innerText = '✨ Draft Auto-Reply';
      }
    });
  }

  // Checkatrade is a single-page app, so follow DOM rebuilds and route changes
  // instead of polling the whole document on a fixed timer.
  const rescan = debounce(injectFloatingBar, 400);

  (function watchForLeads() {
    ['pushState', 'replaceState'].forEach((name) => {
      const original = history[name];
      history[name] = function () {
        const result = original.apply(this, arguments);
        rescan();
        return result;
      };
    });
    window.addEventListener('popstate', rescan);
    window.addEventListener('hashchange', rescan);

    const watchTarget = document.body || document.documentElement;
    if (watchTarget) {
      new MutationObserver(rescan).observe(watchTarget, { childList: true, subtree: true });
    }
  })();

  rescan();
})();