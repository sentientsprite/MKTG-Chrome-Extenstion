"""End-to-end dry-run tests (live API, no booking)."""

from __future__ import annotations

from datetime import date

from bot.availability import AvailabilityClient
from bot.booker import Booker
from bot.config import BotConfig
from bot.windows import find_three_night_windows, StayWindow


def test_plaskett_creek_has_bookable_windows():
    """Validate matcher against a campground with live Available cells."""
    config = BotConfig(
        facility_id="233115",
        facility_url="https://www.recreation.gov/camping/campgrounds/233115",
    )
    with AvailabilityClient(config) as client:
        sites = client.fetch_range("233115", date(2026, 8, 1), date(2026, 8, 31))
    windows = find_three_night_windows(sites, nights=2)
    assert len(windows) > 0


def test_dry_run_booker_skips_playwright_when_no_session():
    config = BotConfig(dry_run=True)
    booker = Booker(config)
    window = StayWindow(
        check_in=date(2026, 8, 6),
        check_out=date(2026, 8, 9),
        nights=3,
        site_id="1",
        site_number="2",
    )
    result = booker.book_window(window)
    booker.close()
    assert result.status == "dry_run"
    assert "Would book" in result.message
