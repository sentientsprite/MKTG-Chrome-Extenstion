#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

python3 -m venv .venv
source .venv/bin/activate
pip install -U pip
pip install -e ".[dev]"
playwright install chromium
echo "Installed wheeler-peak-bot. Next: ./scripts/login.sh"
