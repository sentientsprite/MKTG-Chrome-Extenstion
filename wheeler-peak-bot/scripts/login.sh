#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -d .venv ]]; then
  source .venv/bin/activate
fi

echo "Opening headed browser for Recreation.gov login..."
echo "Save payment method at https://www.recreation.gov/account/payment before release day."
python -m bot.cli session login "$@"

echo "Verifying session..."
python -m bot.cli session health
