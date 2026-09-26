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

  // The composer is matched from most-specific to most-generic. A generic
  // contenteditable/textarea anywhere on the page is the last resort, because
  // matching a search box would insert a reply into the wrong field.
  const COMPOSER_SELECTOR_FAMILIES = [
    'textarea[name="message"]',
    'textarea[name="reply"]',
    'textarea[id*="message" i]',
    'textarea[id*="reply" i]',
    'textarea[placeholder*="write a reply" i]',
    'textarea[placeholder*="message" i]',
    'textarea[placeholder*="reply" i]',
    'textarea[aria-label*="message" i]',
    'textarea[aria-label*="reply" i]',
    'div[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"]',
    'textarea',
  ];

  function findChatInput() {
    for (const selector of COMPOSER_SELECTOR_FAMILIES) {
      let found;
      try {
        found = document.querySelector(selector);
      } catch (e) {
        continue; // an unsupported selector must not abort the whole scan
      }
      if (!found) continue;
      // Never target a field that is hidden or disabled.
      if (found.disabled) continue;
      const rect = found.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      return found;
    }
    return null;
  }

  // Selector families tried in order. Checkatrade redesigns its trade portal
  // periodically, so detection must not depend on any single class name: we try
  // the most specific known containers first, then test-id hooks, then a
  // structural heuristic. A miss is reported, never silently invented.
  const LEAD_SELECTOR_FAMILIES = [
    '[data-testid="lead-message"]',
    '[data-testid="customer-message"]',
    '.message-body',
    '.lead-description',
    '.chat-bubble--customer',
    '[class*="CustomerMessage"]',
    '[class*="customer-message"]',
    '[class*="leadDetail"]',
    '[class*="MessageBody"]',
  ];

  // The tradesperson's own sent messages must never be read as the enquiry, or the
  // model would be asked to reply to the reply.
  const OWN_MESSAGE_SELECTOR =
    '.chat-bubble--trader, .chat-bubble--self, [class*="sentMessage"], [class*="SentMessage"], [class*="MessageSent"], [class*="ownMessage"]';

  function normaliseLeadText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  // Read one element's text only if it is not the tradesperson's own message.
  function textFromCandidate(element) {
    if (!element) return '';
    if (element.matches && element.matches(OWN_MESSAGE_SELECTOR)) return '';
    // A candidate nested inside an own-message wrapper is also the tradesperson's.
    if (element.closest && element.closest(OWN_MESSAGE_SELECTOR)) return '';
    return normaliseLeadText(element.innerText);
  }

  // Last-resort structural heuristic: find the main conversation region and read
  // the customer-side blocks within it. Kept last because it is the most likely
  // to produce noise on a layout we have never seen.
  function detectByConversationRegion() {
    const region = document.querySelector(
      'main, [role="main"], [class*="conversation" i], [class*="thread" i], [class*="chat" i]'
    );
    if (!region) return [];

    const blocks = region.querySelectorAll('p, li, div');
    const collected = [];
    blocks.forEach((block) => {
      // Only leaf-ish nodes carry a single message rather than a whole container.
      if (block.children.length > 2) return;
      const text = textFromCandidate(block);
      if (text.length >= 25) collected.push(text);
    });
    // Cap the fallback so a long thread cannot blow the server's field ceiling.
    return collected.slice(-8);
  }

  // Returns the detected enquiry text, or '' when nothing could be read.
  function findCustomerMessage() {
    for (const selector of LEAD_SELECTOR_FAMILIES) {
      let matched;
      try {
        matched = document.querySelectorAll(selector);
      } catch (e) {
        continue; // an unsupported selector must not abort the whole scan
      }
      const parts = [];
      matched.forEach((el) => {
        const text = textFromCandidate(el);
        if (text) parts.push(text);
      });
      if (parts.length > 0) return parts.join('\n\n');
    }

    const fallback = detectByConversationRegion();
    return fallback.length > 0 ? fallback.join('\n\n') : '';
  }

  // Insert generated text into the composer without ever using innerHTML: the text
  // is derived from page content plus model output, so it must be treated as data.
  // Returns true when the text was actually written somewhere. A silent no-op here
  // is the single most confusing failure mode, so callers must be able to tell.
  function insertReply(text) {
    // Re-query rather than reusing the node captured at injection time: Checkatrade
    // re-renders the composer on many interactions, leaving the old node detached.
    const target = findChatInput();
    if (!target) return false;

    if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
      target.value = text;
      target.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }

    target.textContent = '';
    text.split('\n').forEach((line, index) => {
      if (index > 0) target.appendChild(document.createElement('br'));
      target.appendChild(document.createTextNode(line));
    });
    target.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }

  function injectFloatingBar() {
    if (document.getElementById('tradereply-floating-widget')) return;

    // Never inject speculatively and never invent a lead message: the bar only
    // appears once a real enquiry has been read from the page.
    if (!findCustomerMessage()) return;

    const inputArea = findChatInput();
    // If no composer was found the bar is still useful — the tradesperson can
    // paste the message manually and copy the draft out — so anchor it to the
    // conversation region or the body rather than bailing out silently.
    const anchor = inputArea
      ? inputArea.parentNode
      : document.querySelector('main, [role="main"]') || document.body;
    if (!anchor) return;

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

    // When no composer was detected, offer a manual entry box so a detection miss
    // degrades into "type it yourself" instead of "the extension does nothing".
    // Built with DOM nodes, never innerHTML, since its value is user/model data.
    if (!inputArea) {
      const manualWrap = document.createElement('div');
      manualWrap.id = 'tr-manual-wrap';
      manualWrap.style.marginTop = '8px';

      const manualLabel = document.createElement('label');
      manualLabel.className = 'tr-manual-label';
      manualLabel.htmlFor = 'tr-manual-lead';
      manualLabel.textContent = 'Lead not detected automatically — paste the enquiry here:';

      const manualInput = document.createElement('textarea');
      manualInput.id = 'tr-manual-lead';
      manualInput.className = 'tr-manual-input';
      manualInput.rows = 3;
      manualInput.placeholder = 'Paste the customer message…';

      manualWrap.appendChild(manualLabel);
      manualWrap.appendChild(manualInput);
      widget.appendChild(manualWrap);
    }

    anchor.insertBefore(widget, inputArea || null);

    // The generate handler reads the manual box first when detection found nothing.
    function resolveLeadText() {
      const detected = findCustomerMessage();
      if (detected) return detected;
      const manual = document.getElementById('tr-manual-lead');
      return manual ? normaliseLeadText(manual.value) : '';
    }

    document.getElementById('tr-generate-btn').addEventListener('click', async () => {
      const btn = document.getElementById('tr-generate-btn');
      const previewBox = document.getElementById('tr-preview-box');
      const tone = document.getElementById('tr-tone-select').value;
      const leadText = resolveLeadText();

      if (!leadText) {
        alert('TradeReply AI: no customer enquiry text detected on this page. Open the actual lead thread, or paste the message into the box above.');
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
          const inserted = insertReply(data.replyText);
          previewBox.style.display = 'none';
          if (!inserted) {
            // Never fail silently — the user must know the draft is still recoverable.
            alert('TradeReply AI could not find the message box on this page, so the reply was NOT inserted.\n\nSelect the text above and copy it, then paste it into Checkatrade yourself.');
          }
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