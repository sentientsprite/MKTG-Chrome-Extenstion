# Privacy Policy — AI Growth Coach

**Last updated:** June 30, 2026  
**Extension name:** AI Growth Coach  
**Contact:** [Open a GitHub issue](https://github.com/sentientsprite/MKTG-Chrome-Extenstion/issues)

---

## Summary

AI Growth Coach is a Chrome extension that helps small businesses understand their marketing performance. **We do not operate any backend servers.** All data processing happens locally in your browser, with direct API calls from your device to Google and (optionally) OpenAI using credentials you provide.

---

## What data we access

When you sign in with Google, the extension may access read-only data from services you connect in Settings:

| Source | Data accessed | Purpose |
|---|---|---|
| **Google Analytics 4** | Sessions, users, bounce rate, conversions, channel breakdown | Dashboard metrics and issue detection |
| **Google Search Console** | Clicks, impressions, CTR, average position, top queries | SEO performance and issue detection |
| **Google Ads** (optional) | Spend, clicks, conversions, campaign metrics | Paid media performance and issue detection |
| **Google Business Profile** (optional) | Reviews, ratings, listing impressions, website clicks | Local presence monitoring |
| **Google account** | Email address and display name | Display in the extension UI |

---

## What data we store

| Data | Where stored | Retention |
|---|---|---|
| OAuth tokens | Managed by Chrome (`chrome.identity`) | Until you sign out or revoke access |
| Your settings (property IDs, business info) | `chrome.storage.sync` on your device | Until you uninstall or clear extension data |
| Cached analytics summaries | `chrome.storage.local` on your device | Up to 15 minutes, then refreshed |
| Cached AI advice | `chrome.storage.local` on your device | Up to 1 hour, then refreshed |
| **OpenAI API key** | `chrome.storage.sync` on your device | Until you remove it in Settings |

We do **not** store your marketing data on any server we control.

---

## Third-party services

### Google APIs

The extension calls Google APIs directly from your browser using your authenticated Google account. Google's privacy policy applies: [https://policies.google.com/privacy](https://policies.google.com/privacy)

### OpenAI (bring your own key)

AI features require **your own OpenAI API key**, entered in Settings. When you use AI Coach or Ask the Coach:

- A summary of your marketing metrics and detected issues is sent **directly from your browser** to OpenAI's API
- **We do not proxy, log, or store these requests on any intermediary server**
- OpenAI's privacy policy applies: [https://openai.com/policies/privacy-policy](https://openai.com/policies/privacy-policy)
- You are billed by OpenAI according to your account's usage

If you do not add an OpenAI API key, no data is sent to OpenAI.

---

## What we do not do

- We do not sell your data
- We do not share your data with advertisers
- We do not run analytics or tracking on you beyond what is needed for the extension to function
- We do not modify your Google Analytics, Ads, Search Console, or Business Profile data (read-only access)

---

## Permissions explained

| Permission | Why it's needed |
|---|---|
| `identity` | Google OAuth sign-in |
| `storage` | Save your settings and cache data locally |
| `alarms` | Periodic background checks for critical marketing issues |
| `notifications` | Alert you when critical issues are detected |

---

## Your choices

- **Sign out** at any time in Settings to revoke the cached OAuth token
- **Remove your OpenAI API key** in Settings to stop AI features
- **Uninstall the extension** to remove all locally stored data
- **Revoke access** in your [Google Account permissions](https://myaccount.google.com/permissions)

---

## Children's privacy

This extension is intended for business owners and marketers. It is not directed at children under 13.

---

## Changes to this policy

We may update this policy when the extension changes. The "Last updated" date at the top will reflect the latest revision. Continued use after changes constitutes acceptance of the updated policy.

---

## Contact

Questions about this privacy policy? Open an issue at:  
[https://github.com/sentientsprite/MKTG-Chrome-Extenstion/issues](https://github.com/sentientsprite/MKTG-Chrome-Extenstion/issues)
