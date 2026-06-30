# Chrome Web Store Deployment Checklist

Use this checklist to publish **AI Growth Coach** to the Chrome Web Store.

---

## Pre-flight (repo)

- [x] Full extension merged to `main`
- [ ] Replace OAuth placeholder in `manifest.json` (see [OAUTH_SETUP.md](./OAUTH_SETUP.md))
- [ ] Host privacy policy and note the public URL (see [PRIVACY.md](./PRIVACY.md))
- [ ] Capture store screenshots (see [../store/README.md](../store/README.md))
- [ ] Review store listing copy ([STORE_LISTING.md](./STORE_LISTING.md))

---

## 1. Developer account

1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Pay the **one-time $5 registration fee**
3. Complete identity verification (may take 1–3 days)

---

## 2. First upload (get your permanent extension ID)

The Chrome Web Store assigns a **permanent extension ID** that differs from unpacked dev loads.

1. Zip the extension (see below)
2. Upload as a **draft** listing (unlisted is fine)
3. Note the **Extension ID** shown in the dashboard
4. Create/update your Google OAuth client with this ID ([OAUTH_SETUP.md](./OAUTH_SETUP.md))
5. Update `manifest.json` with the production Client ID
6. Re-zip and upload a new version

### Create the ZIP

```bash
cd /path/to/MKTG-Chrome-Extenstion
zip -r ai-growth-coach-v1.0.0.zip . \
  -x "*.git*" \
  -x "*node_modules*" \
  -x "*.DS_Store" \
  -x "store/screenshots/*.png"
```

`manifest.json` must be at the ZIP root.

---

## 3. Privacy policy URL

**Required** because the extension accesses Google account data.

### Option A — GitHub Pages (recommended)

1. Repo → **Settings** → **Pages**
2. Source: **Deploy from branch** → `main` → `/docs`
3. Privacy URL: `https://sentientsprite.github.io/MKTG-Chrome-Extenstion/privacy-policy.html`

> Move or symlink `docs/privacy-policy.html` to the docs root if GitHub Pages serves from `/docs` — the file is already at `docs/privacy-policy.html`.

### Option B — Your own domain

Host `docs/privacy-policy.html` anywhere public and use that URL.

---

## 4. Store listing assets

| Asset | Spec | Status |
|---|---|---|
| Icon | 128×128 PNG | ✅ `icons/icon128.png` |
| Screenshots | 1280×800 or 640×400, min 1 | Use demo mode or `store/screenshot-preview.html` |
| Small promo tile | 440×280 | Optional |
| Short description | Max 132 chars | See STORE_LISTING.md |
| Detailed description | Max 16,000 chars | See STORE_LISTING.md |
| Category | Productivity or Business | — |
| Privacy policy URL | Public HTTPS URL | See step 3 |

---

## 5. Permission justifications

Chrome reviewers may ask why each permission is needed:

| Permission | Justification |
|---|---|
| `identity` | Sign in with Google OAuth to access the user's Analytics, Search Console, Ads, and Business Profile data |
| `storage` | Store user settings (property IDs, business info) and cache API responses locally |
| `alarms` | Run periodic background checks (every 30 min) for critical marketing issues |
| `notifications` | Alert the user when critical issues are detected (e.g. traffic drop, conversion decline) |
| Host: `analyticsdata.googleapis.com` | Fetch GA4 traffic and conversion metrics |
| Host: `searchconsole.googleapis.com` | Fetch organic search performance data |
| Host: `googleads.googleapis.com` | Fetch Google Ads campaign metrics (optional, user-configured) |
| Host: `mybusiness*.googleapis.com` | Fetch Business Profile reviews and performance (optional) |
| Host: `api.openai.com` | Send marketing summaries to OpenAI using the **user's own API key** for AI advice |

---

## 6. Single purpose & data use

**Single purpose:** Help small business owners monitor marketing performance and receive actionable growth advice.

**Data handling disclosure:**
- Data is read from Google APIs using the user's OAuth token
- Data is processed locally in the browser
- AI features send summaries to OpenAI using the user's own API key (BYOK — we do not proxy)
- No data is sent to developer-operated servers

---

## 7. Google Ads API caveat

New Google Ads API applications often receive **Test Access** only. This limits API calls to test accounts. Document this in your listing:

> Google Ads integration requires a Google-approved developer token. New tokens may be limited to test accounts until Google grants Basic or Standard access.

Users with test-only tokens will see API errors for production ad accounts.

---

## 8. OpenAI BYOK disclosure

**Critical for review:** State clearly that users must provide their own OpenAI API key. The extension does not include bundled AI access and does not route requests through developer servers.

Include in listing description (see STORE_LISTING.md).

---

## 9. Submit for review

1. Complete all listing fields
2. Upload final ZIP with production OAuth Client ID
3. Set visibility: start **Unlisted** for testing, then go Public
4. Submit for review (typically 1–7 business days; OAuth extensions may take longer)

### Common rejection reasons

| Issue | Fix |
|---|---|
| Missing privacy policy | Host `docs/privacy-policy.html` and add URL |
| OAuth client mismatch | Use Chrome Extension type client with store extension ID |
| Vague permission justification | Copy from section 5 above |
| Placeholder client ID in manifest | Replace `YOUR_GOOGLE_OAUTH_CLIENT_ID` |
| Remote code (CDN scripts) | ✅ Not used — all scripts are bundled locally |

---

## 10. Post-publish

- [ ] Test install from the store listing URL
- [ ] Verify Google sign-in works with production OAuth client
- [ ] Monitor reviews and GitHub issues
- [ ] Bump `version` in `manifest.json` for each update

---

## Quick reference

| Item | Value |
|---|---|
| Repo | `https://github.com/sentientsprite/MKTG-Chrome-Extenstion` |
| Privacy policy file | `docs/privacy-policy.html` |
| OAuth setup | `docs/OAUTH_SETUP.md` |
| Store listing copy | `docs/STORE_LISTING.md` |
| Screenshot helper | `store/screenshot-preview.html` |
| Demo mode | Settings → enable "Demo mode" for screenshots without live APIs |
