# TradeReply AI - Google Chrome Extension

## Install (Chrome, Brave or Edge)

1. Download every file from the TradeReply AI **"Export Extension"** tab into one empty folder, e.g. `tradereply-ai-extension`.
2. Open `chrome://extensions` (Edge: `edge://extensions/`, Brave: `brave://extensions/`).
3. Toggle on **Developer mode** (top right).
4. Click **Load unpacked** (top left) and select the folder.
5. Click the extension icon, open **Options**, enter your real business details and press **Save Configuration**.
6. Open [trades.checkatrade.com](https://trades.checkatrade.com). The floating **⚡ TradeReply AI** bar appears above the message box whenever a customer enquiry is detected on the page.

## How the pieces fit together

| File | Role |
| --- | --- |
| `background.js` | Service worker. Owns every API call and relays the reply back to the page. |
| `content.js` | Injects the floating bar on Checkatrade/MyBuilder, reads the lead text, inserts the drafted reply. |
| `popup.js` | Toolbar popup: paste a message, get a reply. Same engine, same saved settings. |
| `options.js` | Stores your business profile, reply style and API settings in `chrome.storage.local`. |

Requests are made **only** from the service worker. That is deliberate: since Chrome 85 a content script's `fetch` inherits the page's origin, so calling the TradeReply API straight from the page would be blocked by CORS. The worker also rejects any endpoint name it does not recognise, so a compromised page cannot turn it into an open proxy.

## Configuration notes

- **API base URL** defaults to the address this extension was exported from. If you change it, add that host to `host_permissions` in `manifest.json` and reload the extension. Use `https://` for anything other than `http://localhost`.
- **Shared API token**: only needed when the server sets `TRADEREPLY_API_TOKEN`. Paste the same value in Options. It keeps scanners out; it is not user authentication, so never treat it as a secret.
- **Request limits**: the server rate limits each IP per minute and rejects oversized messages (HTTP 429 / 400). Those errors surface in the extension UI.
- **Nothing is sent anywhere except the TradeReply AI API you configure**, and lead text is only sent when you press a generate button.
- **Replies are drafts.** Review every message before sending; the extension never sends on your behalf.

## Privacy and platform terms

Injected UI and automated replies may be restricted by the terms of service of the marketplace you are using. Check the current terms before relying on this in production.