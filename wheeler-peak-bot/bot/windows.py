from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta


# Status values that mean a site cannot be booked (camply-style denylist).
UNAVAILABLE_STATUSES = frozenset(
    {
        "Reserved",
        "Not Available",
        "Closed",
        "NYR",  # Not Yet Released
        "Walk To",
        "Maintenance",
        "Blocked",
        "Unavailable",
    }
)


def is_available(status: str) -> bool:
    return status not in UNAVAILABLE_STATUSES and status == "Available"


@dataclass(frozen=True)
class StayWindow:
    check_in: date
    check_out: date
    nights: int
    site_id: str
    site_number: str


def consecutive_nights(
    available_dates: set[date],
    nights: int,
    start_on_or_after: date | None = None,
) -> list[tuple[date, date]]:
    """Return (check_in, check_out) pairs for consecutive available nights."""
    if nights < 1 or not available_dates:
        return []

    sorted_dates = sorted(available_dates)
    windows: list[tuple[date, date]] = []

    for start in sorted_dates:
        if start_on_or_after and start < start_on_or_after:
            continue
        ok = True
        for offset in range(nights):
            if start + timedelta(days=offset) not in available_dates:
                ok = False
                break
        if ok:
            windows.append((start, start + timedelta(days=nights)))

    return windows


def find_three_night_windows(
    sites_by_id: dict[str, dict[str, str]],
    nights: int,
    allowed_site_numbers: list[str] | None = None,
    check_in_dates: list[date] | None = None,
) -> list[StayWindow]:
    """Match consecutive available nights per site."""
    from bot.availability import parse_iso_date

    results: list[StayWindow] = []
    preferred = [s.strip() for s in (allowed_site_numbers or []) if s.strip()]

    ordered_site_ids = list(sites_by_id.keys())
    if preferred:
        ordered_site_ids.sort(
            key=lambda sid: (
                preferred.index(sites_by_id[sid]["site_number"])
                if sites_by_id[sid]["site_number"] in preferred
                else len(preferred) + int(sid)
            )
        )

    for site_id in ordered_site_ids:
        meta = sites_by_id[site_id]
        site_number = meta["site_number"]
        if preferred and site_number not in preferred:
            continue

        available: set[date] = set()
        for iso_day, status in meta["availabilities"].items():
            if is_available(status):
                available.add(parse_iso_date(iso_day))

        for check_in, check_out in consecutive_nights(available, nights):
            if check_in_dates and check_in not in check_in_dates:
                continue
            results.append(
                StayWindow(
                    check_in=check_in,
                    check_out=check_out,
                    nights=nights,
                    site_id=site_id,
                    site_number=site_number,
                )
            )

    return results
