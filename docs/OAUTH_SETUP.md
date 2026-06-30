# OAuth Setup Guide

AI Growth Coach uses Google OAuth via Chrome's `chrome.identity` API. You need a **Chrome Extension** OAuth client — not a "Web application" client.

---

## Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Your extension │────▶│  chrome.identity │────▶│  Google OAuth   │
│  (popup/bg)     │     │  (Chrome manages │     │  (access token) │
└─────────────────┘     │   the token)     │     └────────┬────────┘
                        └──────────────────┘              │
                                                            ▼
                                                   Google APIs (GA4, SC, etc.)
```

The OAuth **Client ID** in `manifest.json` must match the extension ID Chrome assigns.

---

## Step 1 — Get your extension ID

### During development (unpacked)

1. Load the extension at `chrome://extensions` → **Load unpacked**
2. Copy the **ID** shown on the extension card (32-character string)

### For production (Chrome Web Store)

1. Upload a draft to the [Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. The store assigns a **permanent ID** — different from unpacked dev ID
3. Use this ID for your production OAuth client

> **Important:** You will likely need **two** OAuth clients: one for local dev (unpacked ID) and one for the store build (published ID). Or update the client when you get the store ID.

---

## Step 2 — Create a Google Cloud project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (e.g. "AI Growth Coach")
3. Enable these APIs (**APIs & Services → Library**):

| API | Required for |
|---|---|
| Google Analytics Data API | GA4 dashboard |
| Google Analytics Admin API | Property discovery |
| Google Search Console API | SEO metrics |
| Google My Business API / Business Profile APIs | GMB data |
| Google Ads API | Ads metrics (optional) |

---

## Step 3 — Configure OAuth consent screen

1. **APIs & Services → OAuth consent screen**
2. User type: **External** (unless using Google Workspace internally)
3. Fill in app name, support email, developer contact
4. Add scopes (or they'll be requested at runtime):
   - `analytics.readonly`
   - `webmasters.readonly`
   - `business.manage`
   - `adwords`
   - `userinfo.profile`
   - `userinfo.email`
5. Add yourself as a **test user** while in "Testing" status
6. For public release: submit for **Google verification** (required for sensitive scopes like `adwords`)

---

## Step 4 — Create OAuth Client ID

1. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
2. Application type: **Chrome Extension** (not Web application!)
3. **Item ID:** paste your extension ID from Step 1
4. Click **Create**
5. Copy the **Client ID** (ends in `.apps.googleusercontent.com`)

---

## Step 5 — Update manifest.json

Replace the placeholder:

```json
"oauth2": {
  "client_id": "123456789012-abcdefghijklmnop.apps.googleusercontent.com",
  "scopes": [
    "https://www.googleapis.com/auth/analytics.readonly",
    "https://www.googleapis.com/auth/webmasters.readonly",
    "https://www.googleapis.com/auth/business.manage",
    "https://www.googleapis.com/auth/adwords",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/userinfo.email"
  ]
}
```

Reload the extension after saving.

---

## Step 6 — Verify sign-in

1. Open the extension popup
2. Click **Sign in with Google**
3. Complete the consent flow
4. If you see `OAuth2 request failed` or `bad client id`:
   - Confirm client type is **Chrome Extension**
   - Confirm Item ID matches extension ID exactly
   - Confirm Client ID in manifest matches the credential

---

## Store publish workflow

Because the store extension ID ≠ unpacked dev ID:

```
1. Upload draft ZIP to Chrome Web Store
2. Note the published Extension ID
3. Create NEW OAuth client (Chrome Extension) with store ID
4. Update manifest.json with production Client ID
5. Re-zip and upload v1.0.0 (or v1.0.1) to the store
```

---

## Troubleshooting

| Error | Likely cause | Fix |
|---|---|---|
| `bad client id` | Wrong client type or ID mismatch | Use Chrome Extension client with correct extension ID |
| `access_denied` | User not in test users list | Add email to OAuth consent screen test users |
| `idpiframe_initialization_failed` | Third-party cookies blocked | Rare in extensions; try incognito with extensions allowed |
| APIs return 403 | API not enabled | Enable the API in Google Cloud Console |
| Ads API 401 | Missing developer token | Add token in Settings; apply at developers.google.com/google-ads |

---

## Security notes

- Never commit real Client IDs to public repos if you want to restrict usage — though Chrome Extension client IDs are considered public
- The Client ID alone cannot access user data without the user's consent
- Users revoke access at [myaccount.google.com/permissions](https://myaccount.google.com/permissions)
