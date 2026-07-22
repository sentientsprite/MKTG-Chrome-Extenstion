# How to get the extension onto your Mac (Desktop Cursor)

Your earlier `git pull` failed because the shell was in a **`portfolio`** folder — not this repo.

## Option A — Clone fresh (recommended)

```bash
cd ~
git clone https://github.com/sentientsprite/MKTG-Chrome-Extenstion.git
cd MKTG-Chrome-Extenstion
git checkout main
git pull origin main
```

Then in Cursor: **File → Open Folder** → select `MKTG-Chrome-Extenstion`.

## Option B — If you already cloned it somewhere

```bash
# Find it
find ~ -type d -name "MKTG-Chrome-Extenstion" 2>/dev/null

# Then
cd /path/to/MKTG-Chrome-Extenstion
git fetch origin
git checkout main
git pull origin main
```

## Verify you're in the right place

```bash
pwd
git remote -v
# should show: sentientsprite/MKTG-Chrome-Extenstion
ls manifest.json popup.js docs/
```

## Load in Chrome

1. Open `chrome://extensions`
2. Enable Developer mode
3. Load unpacked → select this folder
4. Settings → enable **Demo mode** to preview without API keys
