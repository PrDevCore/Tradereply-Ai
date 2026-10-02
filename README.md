
## Run locally

**Prerequisites:** Node.js 20.19+ (the test script relies on `node:test`)

1. Install dependencies: `npm install`
2. Set `GEMINI_API_KEY` in `.env.local` to your Gemini API key
3. Run the app: `npm run dev`

> `.env.local` holds a **live credential**. `.env*` is gitignored, but treat the whole
> folder as sensitive: never share or archive it with the key in place, and rotate the
> key in AI Studio if it has ever left your machine.

## Checks

| Command | What it does |
| --- | --- |
| `npm run build:extension` | Build and validate the unpacked MV3 extension in `dist-extension/` (optionally pass its API origin) |
| `npm run build:all` | Build both the web app and the unpacked extension |
| `npm test` | Unit tests for retry/fallback, API guards, templates, and extension source/export invariants |
| `npm run lint` | `tsc --noEmit`, full type check |
| `npm run build` | Production bundle into `dist/` (each tab is a lazy chunk) |

## Load the local extension

After `npm run build:extension`, open `chrome://extensions`, enable Developer mode, click **Load unpacked**, and select the **`dist-extension` folder itself** — the folder that directly contains `manifest.json`. Do not select the project root.

For a deployed API, build the extension with its origin first:

```bash
npm run build:extension -- https://your-api.example.com
```

## Live engine (no simulations)

All four AI endpoints call the Google Gemini API directly
(`gemini-3.8-flash` by default, override with `GEMINI_MODEL`):

| Endpoint | Purpose |
| --- | --- |
| `POST /api/analyze-lead` | Structured lead intelligence |
| `POST /api/generate-reply` | Personalized auto-reply draft |
| `POST /api/generate-template` | Reusable message template |
| `POST /api/rewrite-draft` | Rewrite / polish an existing draft |
| `GET /api/health` | Live liveness probe of the Gemini engine |

If neither `GEMINI_API_KEY` nor a usable local Ollama model is configured, these
endpoints return `503 AI_ENGINE_NOT_CONFIGURED`. There are deliberately no mock,
stub or canned fallback responses, so fabricated AI output can never be mistaken
for a real result. The app footer reports the probed engine state as **LIVE** or
**OFFLINE**.

Requests are retried with backoff on transient upstream conditions (Google's
`503 UNAVAILABLE` on newly released models), then served by the next model in
`GEMINI_FALLBACK_MODELS` (default
`gemini-3.6-flash,gemini-3.5-flash,gemini-3.5-flash-lite,gemini-3.1-flash-lite`) if
the primary is still overloaded. Each attempt is bounded by `GEMINI_TIMEOUT_MS`
(default 25000) and the whole chain by `GEMINI_TOTAL_BUDGET_MS` (default 60000), so a
congested model cannot stall the request. Every response reports the model that
actually answered as `engine`, so a fallback is never silent. This logic lives in
`src/utils/engine.ts` and is covered by unit tests.
Network errors are unwrapped from undici's opaque `"fetch failed"` message into
the real cause chain (DNS, TLS, reset, timeout) so failures are diagnosable
rather than mysterious.

### Local Ollama provider (optional)

A second **real** provider is supported: a local [Ollama](https://ollama.com)
daemon. It is not a mock and not a fallback simulation — it runs actual local
models with no API key and no per-token cost.

```bash
ollama serve
ollama pull llama3.2
```

```bash
OLLAMA_MODEL=llama3.2   # add to .env.local
```

How it slots into the chain:

| `GEMINI_API_KEY` | Resulting chain |
| --- | --- |
| set | `gemini-3.8-flash` → `GEMINI_FALLBACK_MODELS` → **`ollama:llama3.2`** |
| not set | **`ollama:llama3.2`** alone (the local model becomes primary) |

Entries are written as `ollama:<model>`; anything unprefixed is Gemini, so
existing configuration is unchanged. At startup the server calls the cheap
`GET /api/tags` and **disables** the Ollama targets if the daemon is unreachable
or the model has not been pulled, logging exactly which — so a configured-but-
absent Ollama degrades to the existing behaviour instead of failing requests.
A refused local connection is classified transient, so the chain moves on.

Local models get their own per-attempt ceiling, `OLLAMA_TIMEOUT_MS` (default
45000), because CPU inference is slower than a hosted flash model. Ollama output
is requested with `format: 'json'` and still passes through the same
`cleanAndParseJSON` fence-stripping as Gemini, so the JSON contract is identical.

Whichever provider served a request is reported in every response as `engine`
(`gemini-3.8-flash` or `ollama:llama3.2`), and `/api/health` adds `providers` and
the full `chain` order.

Observed model availability when measured: `gemini-3.8-flash` (slow under load),
`gemini-3.6-flash`, `gemini-3.5-flash`, `gemini-3.5-flash-lite` and
`gemini-3.1-flash-lite` respond; `gemini-3.7-flash` was returning 503 under load;
`gemini-2.5-flash` returns 404 "no longer available to new users".

Note: the "Checkatrade Simulator" tab renders a seeded sample inbox purely as a
UI preview of the browser extension. It is not a live Checkatrade connection —
real leads arrive through the exported Manifest V3 extension.

## API hardening

Every AI route proxies a paid model, so each request is bounded before it reaches
Gemini (see `src/utils/apiGuards.ts`, wired in `server.ts`):

| Control | Default | Env var |
| --- | --- | --- |
| Per-IP rate limit, fixed 1-minute window | 20 req/min per AI route | `RATE_LIMIT_PER_MINUTE` |
| Health-probe rate limit | 10 req/min | `HEALTH_RATE_LIMIT_PER_MINUTE` |
| JSON body ceiling | 64 KB (was 10 MB) | `MAX_REQUEST_BYTES` |
| Per-field ceilings | 4 000 chars of lead text, 6 000 for profile/analysis JSON, 8 000 for a draft | in `FIELD_LIMITS` |
| Enum whitelists | tone, reply length and call-to-action are validated, never interpolated | in `server.ts` |
| Shared token | off (a no-op until configured) | `TRADEREPLY_API_TOKEN` |

Failures are explicit: `400` for a bad field, `413` for an oversized body, `429`
with `Retry-After` when rate limited, `401 UNAUTHORIZED` when a token is configured
and missing. `/api/health` stays token-free on purpose — it is the footer's liveness
probe — but it is rate limited because it still spends one small model call.

**What this does not do:** `TRADEREPLY_API_TOKEN` is not user authentication. A token
that ships in a browser bundle or a distributed extension cannot be a secret — it only
stops scanners and casual abuse. Before exposing this server publicly, add real
per-user auth, a shared rate-limit store (the current limiter is per-process memory,
so N instances allow N × the limit) and a spending cap in the Google Cloud console.
The web hub sends the token only if `VITE_TRADEREPLY_API_TOKEN` is set at build time.

## Browser extension architecture

The exported extension keeps its network traffic in **one** place:

- `background.js` (service worker) performs every API call. Since **Chrome 85**
  cross-origin `fetch` from a content script is subject to the page's origin and is
  blocked by CORS, so a direct call from an injected script cannot work. Extension
  pages and workers are exempt, and the worker relays the result back to the page.
- The page context may only name an endpoint (`generate-reply`, `analyze-lead`,
  `generate-template`, `rewrite-draft`), never a URL, so a compromised page cannot use
  the worker as an open proxy.
- Reply text is inserted with `textContent`/text nodes, never `innerHTML`: it is
  derived from page content plus model output and must not be parsed as markup.
- The content script follows SPA route changes and DOM rebuilds through a
  `MutationObserver` plus `history.pushState`/`popstate` hooks instead of polling the
  document every two seconds.
- The options page persists the **full** business profile and the full reply-style
  settings (length, badge, call-to-action, formality, auto sign-off, custom rules), so
  the extension drafts with the same settings as the web hub.

## Handling untrusted lead text

A lead message is data from a stranger, and it is interpolated into prompts. Two
mitigations are in place: the model is told to treat anything inside triple quotes as
untrusted data rather than instructions, and the response is never rendered as HTML.
Replies are drafts for a human to review — the app and the extension never send a
message on the tradesperson's behalf. Also worth checking before production: the
terms of service of any marketplace you inject UI into.

