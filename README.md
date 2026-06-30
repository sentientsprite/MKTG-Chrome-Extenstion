# AI Growth Coach — Chrome Extension

An AI-powered Chrome extension that acts as a **Growth Coach for small and local businesses**. It integrates with Google Analytics 4, Search Console, Google Ads, and Google Business Profile to surface issues (traffic drops, low-quality leads, poor review ratings, etc.) and deliver actionable, plain-English advice.

---

## Features

| Category | What it does |
|---|---|
| **Dashboard** | Unified view of traffic, organic search, ad spend, and GMB metrics — with period-over-period change indicators |
| **Issue Detection** | Automatically flags critical and warning-level issues: traffic drops ≥20%, high CPAs, low CTR, poor review ratings, unanswered reviews, etc. |
| **AI Coach** | One-click AI-generated growth advice via OpenAI (GPT-4o-mini), tailored to your business type and current data |
| **Ask the Coach** | Natural-language Q&A: ask anything about your marketing data |
| **Notifications** | Background alerts when critical issues are detected (every 30 min) |
| **Google APIs** | GA4 Data API, Search Console API, Google Ads REST API, Business Profile Performance API |

---

## Screenshots

The extension opens as a compact 400px popup with three tabs:

1. **Dashboard** — metric cards for all connected data sources
2. **Issues** — prioritised list of detected problems with action steps
3. **AI Coach** — AI advice panel + Q&A chat

---

## Installation (Development)

### Prerequisites

- Google Chrome (or any Chromium-based browser)
- A Google Cloud project with the required APIs enabled
- An OpenAI account (for AI advice)

### Step 1 — Clone & configure

```bash
git clone https://github.com/sentientsprite/MKTG-Chrome-Extenstion.git
cd MKTG-Chrome-Extenstion
```

### Step 2 — Create a Google Cloud OAuth Client

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. Create an **OAuth 2.0 Client ID** of type **Chrome Extension**
3. Add your extension's ID to the allowed origins (you'll get the ID after loading it unpacked)
4. Enable these APIs in your project:
   - Google Analytics Data API
   - Google Analytics Admin API
   - Google Search Console API
   - Google My Business API
   - Google Ads API
   - OAuth2 / userinfo

5. Copy your **Client ID** and paste it into `manifest.json`:
   ```json
   "oauth2": {
     "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
     ...
   }
   ```

### Step 3 — Load the extension

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** and select the `MKTG-Chrome-Extenstion` folder
4. Note your extension ID — you'll need it to update the OAuth client

### Step 4 — Configure Settings

Click the extension icon → click the ⚙️ gear icon (or right-click → Options).

| Setting | Required | Description |
|---|---|---|
| **Business Name / Industry / Location** | Recommended | Helps the AI Coach personalise advice |
| **GA4 Property ID** | Yes (for analytics) | Click **Discover** to auto-populate |
| **Search Console Site** | Yes (for SEO) | Click **Discover** to list verified sites |
| **Google Ads Customer ID** | Optional | 10-digit ID (dashes optional) |
| **Google Ads Developer Token** | Optional | Required alongside Customer ID |
| **GMB Location Name** | Optional | Click **Discover** to list your locations |
| **OpenAI API Key** | Yes (for AI) | Get one at platform.openai.com |

---

## Architecture

```
manifest.json          — Extension manifest (V3)
background.js          — Service worker: OAuth, data refresh, notifications
popup.html/js/css      — Main popup UI (dashboard, issues, AI coach)
options.html/js/css    — Settings page
content.js             — Floating button on Google Analytics/Ads/SC/GMB pages
lib/
  analytics.js         — Google Analytics 4 Data API
  searchconsole.js     — Google Search Console API
  googleads.js         — Google Ads REST API (GAQL)
  gmb.js               — Google Business Profile API
  ai-coach.js          — Issue detection rules + OpenAI integration
icons/                 — Extension icons (16, 32, 48, 128px)
```

### Data flow

```
popup.js  ──sendMessage──▶  background.js
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
             analytics.js  searchconsole  googleads.js
                    │       .js            gmb.js
                    └────────────┼────────────┘
                                 ▼
                           ai-coach.js
                         (detectIssues)
                                 │
                                 ▼
                           OpenAI API
                         (generateAdvice)
```

Data is cached in `chrome.storage.local` for 15 minutes. AI advice is cached for 1 hour.

---

## Issue Detection

The extension automatically detects the following issues:

| Issue | Severity | Trigger |
|---|---|---|
| Traffic Drop | Critical / Warning | Sessions ↓ ≥20% vs previous period |
| Rising Bounce Rate | Warning | Bounce rate ↑ ≥15% and > 60% |
| Conversion Drop | Critical | Conversions ↓ ≥25% |
| Organic Click Drop | Critical / Warning | Search clicks ↓ ≥20% |
| Low CTR | Warning | CTR < 3% and dropped ≥15% |
| Rank Drop | Warning | Avg position dropped ≥3 places and > 10 |
| High CPA | Critical | Cost/conversion > 3× estimated order value |
| Low Ad CTR | Warning | Ad CTR < 2% |
| Low Impression Share | Info | Search impression share < 40% |
| Low Review Rating | Critical | Average rating < 4.0 |
| Unanswered Reviews | Warning | > 3 reviews without a reply |
| Recent Negative Reviews | Warning | ≥3 negative reviews in last 30 days |
| Low GMB Visibility | Info | < 100 impressions in 28 days |

---

## Privacy

- All data stays within your browser and your own API calls
- No data is sent to any third-party servers (other than Google APIs and OpenAI)
- OAuth tokens are managed by Chrome's identity API and are never stored in plain text
- API keys are stored in `chrome.storage.sync` (encrypted by Chrome)
- Full policy: [docs/PRIVACY.md](./docs/PRIVACY.md) · Hostable HTML: [docs/privacy-policy.html](./docs/privacy-policy.html)

---

## Chrome Web Store

Ready to publish? See the deployment guides:

| Guide | Description |
|---|---|
| [STORE_DEPLOYMENT.md](./docs/STORE_DEPLOYMENT.md) | Full checklist from ZIP to review submission |
| [OAUTH_SETUP.md](./docs/OAUTH_SETUP.md) | Google OAuth client setup (dev + production) |
| [STORE_LISTING.md](./docs/STORE_LISTING.md) | Pre-written listing copy including BYOK disclosure |
| [store/README.md](./store/README.md) | Screenshot capture instructions |

### Demo mode for screenshots

Enable **Demo mode** in Settings to preview realistic sample data without API credentials — useful for store screenshots.

---

## Development

No build step required — the extension uses ES modules directly.

To update icons, replace the PNG files in the `icons/` directory.

### File structure notes

- `background.js` uses ES module syntax (`import`/`export`) — declared as `"type": "module"` in the manifest
- All API calls go through the background service worker (avoids CORS issues in popup)
- The popup communicates via `chrome.runtime.sendMessage`

---

## License

MIT
