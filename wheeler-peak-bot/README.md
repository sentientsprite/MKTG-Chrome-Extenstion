# Wheeler Peak Campground Reservation Bot

Automated reservation helper for [Wheeler Peak Campground](https://www.recreation.gov/camping/campgrounds/10088563) (Great Basin National Park) on Recreation.gov.

**Goal:** Secure a 3-night Thu→Sun stay (Aug 6–9 or Aug 13–16, 2026) by hitting the 30-day release windows and monitoring cancellations until success.

## Important

- Recreation.gov **prohibits automated booking** in its terms of service. Use at your own risk on a **home residential IP** for personal, single-reservation use only.
- Run on a Mac/PC at home — not a cloud VM (Akamai bot scoring).
- Save a payment method in your Recreation.gov account before release day.
- Release time default: **7:00 AM Pacific** (30 days before check-in). Adjust `release_hour` in `config.yaml` if needed.

## Critical dates

| Check-in | Checkout | Release opens |
|----------|----------|---------------|
| Thu Aug 6, 2026 | Sun Aug 9 | **Tue Jul 7, 2026 @ 7:00 AM PT** |
| Thu Aug 13, 2026 | Sun Aug 16 | **Tue Jul 14, 2026 @ 7:00 AM PT** |

## Quick start

```bash
cd wheeler-peak-bot
chmod +x scripts/*.sh
./scripts/install.sh
./scripts/login.sh          # one-time headed login → ~/.wheeler-peak-bot/session.json
wheeler-bot status
wheeler-bot scan            # read-only availability check
wheeler-bot run --dry-run   # full flow without booking
wheeler-bot run             # snipe releases + monitor until success
```

## Commands

| Command | Description |
|---------|-------------|
| `wheeler-bot session login` | Interactive login, saves session |
| `wheeler-bot session health` | Verify session + Akamai cookie state |
| `wheeler-bot scan` | List bookable 3-night windows via API |
| `wheeler-bot prewarm` | Open campground page in browser |
| `wheeler-bot snipe --check-in 2026-08-06` | Release-day sniper |
| `wheeler-bot monitor` | Cancellation polling + book |
| `wheeler-bot run` | Snipe then monitor until `success.json` |
| `wheeler-bot snapshot` | Write availability JSON snapshot |

## Configuration

Edit [`config.yaml`](config.yaml):

- `targets` — check-in dates and priority (Aug 6 first, Aug 13 second)
- `preferred_sites` — ranked site numbers, or `[]` for any site
- `completion_mode` — `booking` (full checkout) or `cart_only`
- `release_hour` / `release_minute` — default 7:00 AM PT
- `telegram_bot_token` / `telegram_chat_id` — optional alerts
- `dry_run` — detect only, skip cart

## systemd (Linux home server)

Copy units from `systemd/` and adjust paths:

```bash
mkdir -p ~/.config/systemd/user
cp systemd/* ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now wheeler-snipe-aug6.timer
systemctl --user enable --now wheeler-monitor.service
```

## Release-day checklist

1. `wheeler-bot session health` → `ok: true`
2. Payment method saved on recreation.gov
3. Machine awake, NTP synced to Pacific time
4. `wheeler-bot scan --dry-run` passes
5. Phone ready for captcha / confirmation

## Architecture

- **Availability:** Recreation.gov public read API (`/api/camps/availability/campground/{id}/month`)
- **Booking:** Playwright browser automation with persisted `storage_state` session (Akamai requires in-browser cart POST)
- **Matching:** Consecutive 3-night windows; only `"Available"` status is bookable (`"Open"` / `"NYR"` are not)

## Success

When confirmed, writes `~/.wheeler-peak-bot/success.json` and stops.

## Tests

```bash
pip install -e ".[dev]"
pytest
```
