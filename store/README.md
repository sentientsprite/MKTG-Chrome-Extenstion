# Store Assets

Screenshots and promotional images for the Chrome Web Store listing.

## Required sizes

| Asset | Dimensions | Notes |
|---|---|---|
| Screenshot | 1280×800 or 640×400 | At least 1, recommend 3–5 |
| Icon | 128×128 | Already in `icons/icon128.png` |
| Small promo tile | 440×280 | Optional |
| Marquee promo | 1400×560 | Optional |

## Option 1 — Demo mode in the extension (recommended)

1. Load the extension unpacked in Chrome
2. Open **Settings** → enable **Demo mode (screenshots)**
3. Click **Save Settings**
4. Open the extension popup — you'll see realistic sample data without API credentials
5. Screenshot each tab: **Dashboard**, **Issues**, **AI Coach**
6. Resize/crop to 1280×800 if needed

## Option 2 — Screenshot preview page

Open `store/screenshot-preview.html` in Chrome. It renders the popup UI at 400px width with demo data. For store screenshots:

1. Open the file in Chrome (`file://` or via a local server)
2. Use DevTools → device toolbar, or zoom the page
3. Capture each tab panel
4. Composite onto a 1280×800 canvas if you want padding/background

## Option 3 — Capture script

If Chrome/Chromium is installed:

```bash
# From repo root — opens preview and saves PNGs (requires display or xvfb)
./store/capture-screenshots.sh
```

## Suggested screenshots

Save as `store/screenshots/01-dashboard.png`, etc.:

1. **Dashboard** — metric cards showing traffic, SEO, ads, GMB
2. **Issues** — list of detected critical/warning issues
3. **AI Coach** — sample advice + Ask the Coach UI

## After capturing

Add PNGs to this folder and reference them when uploading to the Chrome Web Store developer dashboard.
