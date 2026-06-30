# Chrome Web Store Listing Copy

Copy/paste these into the [Developer Dashboard](https://chrome.google.com/webstore/devconsole) listing fields.

---

## Extension name

```
AI Growth Coach
```

---

## Short description (max 132 characters)

```
AI growth coach for local businesses. GA4, Search Console, Ads & GMB insights. Bring your own OpenAI key.
```

(131 characters)

---

## Detailed description

```
AI Growth Coach helps small and local business owners understand their marketing performance — without needing a data analyst.

Connect your Google account to see a unified dashboard of website traffic, organic search, ad spend, and Google Business Profile metrics. The extension automatically detects issues like traffic drops, rising bounce rates, high ad costs, and low review ratings — then tells you exactly what to do about them.

✨ KEY FEATURES

• Unified Dashboard — GA4 sessions, Search Console clicks, Google Ads spend, and GMB reviews in one view
• Smart Issue Detection — Flags critical problems: traffic down 20%+, conversion drops, high CPA, poor ratings
• AI Growth Coach — Personalized advice powered by OpenAI (you provide your own API key)
• Ask the Coach — Natural-language Q&A about your marketing data
• Background Alerts — Notifications when critical issues are detected

🔑 BRING YOUR OWN OPENAI KEY

AI features require your own OpenAI API key (get one at platform.openai.com). Requests go directly from your browser to OpenAI — we do not proxy AI calls or charge for AI usage. You pay OpenAI directly per their pricing.

🔒 PRIVACY FIRST

• No backend servers — everything runs in your browser
• Read-only access to your Google marketing data
• OAuth tokens managed securely by Chrome
• Your data is never sold or shared

📊 INTEGRATIONS

• Google Analytics 4
• Google Search Console
• Google Ads (optional — requires Google-approved developer token)
• Google Business Profile (optional)

Perfect for restaurants, retail shops, contractors, salons, and any local business that wants to grow smarter.

Note: Google Ads integration requires a developer token from Google. New tokens may have test-only access until approved by Google.
```

---

## Category

**Productivity** or **Business Tools**

---

## Language

English

---

## Privacy policy URL

After enabling GitHub Pages on the `/docs` folder:

```
https://sentientsprite.github.io/MKTG-Chrome-Extenstion/privacy-policy.html
```

Or your own hosted URL for `docs/privacy-policy.html`.

---

## Permission justification (for review form)

**Why does your extension need `identity`?**  
To authenticate users with Google OAuth so they can access their own Analytics, Search Console, Ads, and Business Profile data.

**Why does your extension need `storage`?**  
To save user configuration (property IDs, business info, OpenAI API key) and cache API responses locally for performance.

**Why does your extension need `notifications`?**  
To alert users when critical marketing issues are detected during background monitoring.

**Why does your extension need host permission for `api.openai.com`?**  
Users provide their own OpenAI API key. The extension sends marketing data summaries directly from the user's browser to OpenAI to generate coaching advice. No intermediary server is used.

---

## Screenshot captions (optional)

1. **Dashboard** — "See all your marketing metrics in one place"
2. **Issues** — "Automatic detection of traffic drops, high CPAs, and more"
3. **AI Coach** — "Get personalized growth advice — bring your own OpenAI key"
