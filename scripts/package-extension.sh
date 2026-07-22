#!/usr/bin/env bash
# Package the Chrome extension for Web Store upload.
# Usage: ./scripts/package-extension.sh [version]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

VERSION="${1:-}"
if [[ -z "$VERSION" ]]; then
  VERSION="$(python3 -c "import json; print(json.load(open('manifest.json'))['version'])")"
fi

OUT_DIR="$ROOT/dist"
ZIP_NAME="ai-growth-coach-v${VERSION}.zip"
ZIP_PATH="$OUT_DIR/$ZIP_NAME"

mkdir -p "$OUT_DIR"
rm -f "$ZIP_PATH"

# Verify OAuth placeholder warning
CLIENT_ID="$(python3 -c "import json; print(json.load(open('manifest.json'))['oauth2']['client_id'])")"
if [[ "$CLIENT_ID" == *"YOUR_GOOGLE_OAUTH"* ]]; then
  echo "WARNING: manifest.json still has the OAuth placeholder Client ID."
  echo "         Upload as a DRAFT first to get your store extension ID,"
  echo "         then update the Client ID and re-package before final submit."
  echo
fi

zip -r "$ZIP_PATH" \
  manifest.json \
  background.js \
  content.js \
  popup.html popup.js popup.css \
  options.html options.js options.css \
  lib \
  icons \
  -x "*.DS_Store" \
  -x "*__pycache__*" \
  -x "*.git*"

echo
echo "Created: $ZIP_PATH"
echo "Size:    $(du -h "$ZIP_PATH" | cut -f1)"
echo
echo "Next:"
echo "  1. Upload this ZIP to https://chrome.google.com/webstore/devconsole"
echo "  2. Privacy policy URL (after Pages is enabled):"
echo "     https://sentientsprite.github.io/MKTG-Chrome-Extenstion/privacy-policy.html"
echo "  3. Listing copy: docs/STORE_LISTING.md"
echo "  4. Screenshots: store/screenshots/"
ls -la "$ZIP_PATH"
