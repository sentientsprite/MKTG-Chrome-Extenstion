#!/usr/bin/env bash
# Capture store screenshots from screenshot-preview.html
# Requires Google Chrome or Chromium

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_DIR="$SCRIPT_DIR/screenshots"
PREVIEW="file://$SCRIPT_DIR/screenshot-preview.html"
mkdir -p "$OUT_DIR"

CHROME=""
for candidate in google-chrome google-chrome-stable chromium chromium-browser; do
  if command -v "$candidate" &>/dev/null; then
    CHROME="$candidate"
    break
  fi
done

if [[ -z "$CHROME" ]]; then
  echo "Chrome/Chromium not found. Open store/screenshot-preview.html manually and capture screenshots."
  exit 1
fi

TABS=(dashboard issues coach)
i=1
for tab in "${TABS[@]}"; do
  echo "Capturing $tab..."
  "$CHROME" --headless=new --disable-gpu \
    --user-data-dir="/tmp/chrome-screenshots-$$" \
    --window-size=1280,800 \
    --screenshot="$OUT_DIR/$(printf '%02d' $i)-${tab}.png" \
    "$PREVIEW?tab=$tab" 2>/dev/null || true
  i=$((i + 1))
done

rm -rf "/tmp/chrome-screenshots-$$" 2>/dev/null || true

echo "Done. Check $OUT_DIR/"
ls -la "$OUT_DIR/" 2>/dev/null || true
