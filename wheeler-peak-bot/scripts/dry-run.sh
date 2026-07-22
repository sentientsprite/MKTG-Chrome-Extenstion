#!/usr/bin/env bash
# Dry-run validation against Plaskett Creek (233115) — has live "Available" cells.
# Does NOT book anything; verifies API + CLI + dry-run booker path.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
source .venv/bin/activate

echo "=== Live API smoke (Wheeler Peak) ==="
python -m bot.cli scan --check-in 2026-08-06
echo "(empty = expected before Jul 7 release — Aug 6-8 status is NYR/Open)"

echo ""
echo "=== Live API smoke (Plaskett Creek 233115 — has availability) ==="
WHEELER_BOT_CONFIG=/dev/null python3 <<'PY'
from datetime import date
from bot.config import BotConfig
from bot.availability import AvailabilityClient
from bot.windows import find_three_night_windows

cfg = BotConfig(
    facility_id="233115",
    facility_name="Plaskett Creek",
    facility_url="https://www.recreation.gov/camping/campgrounds/233115",
)
with AvailabilityClient(cfg) as client:
    sites = client.fetch_range("233115", date(2026, 8, 1), date(2026, 8, 31))
    windows = find_three_night_windows(sites, nights=2)
    print(f"Found {len(windows)} two-night windows in August 2026")
    for w in windows[:3]:
        print(f"  site {w.site_number}: {w.check_in} -> {w.check_out}")
PY

echo ""
echo "=== Dry-run booker (no session required) ==="
python -m bot.cli --dry-run scan --check-in 2026-08-06

echo ""
echo "=== Snapshot ==="
python -m bot.cli snapshot -o /tmp/wheeler-availability-snapshot.json
echo "Wrote /tmp/wheeler-availability-snapshot.json"
echo ""
echo "Dry-run complete. Before Jul 7: run ./scripts/login.sh on your home machine."
