from __future__ import annotations

from datetime import date

from bot.windows import consecutive_nights, find_three_night_windows, is_available


def test_is_available_only_available_status():
    assert is_available("Available") is True
    assert is_available("Open") is False
    assert is_available("NYR") is False
    assert is_available("Reserved") is False


def test_consecutive_nights_three_day_window():
    available = {
        date(2026, 8, 6),
        date(2026, 8, 7),
        date(2026, 8, 8),
        date(2026, 8, 13),
        date(2026, 8, 14),
    }
    windows = consecutive_nights(available, 3)
    assert (date(2026, 8, 6), date(2026, 8, 9)) in windows
    assert (date(2026, 8, 13), date(2026, 8, 16)) not in windows


def test_find_three_night_windows_respects_check_in_filter():
    sites = {
        "101": {
            "site_number": "2",
            "availabilities": {
                "2026-08-06T00:00:00Z": "Available",
                "2026-08-07T00:00:00Z": "Available",
                "2026-08-08T00:00:00Z": "Available",
            },
        },
        "102": {
            "site_number": "7",
            "availabilities": {
                "2026-08-13T00:00:00Z": "Available",
                "2026-08-14T00:00:00Z": "Available",
                "2026-08-15T00:00:00Z": "Available",
            },
        },
    }
    windows = find_three_night_windows(
        sites,
        nights=3,
        check_in_dates=[date(2026, 8, 6)],
    )
    assert len(windows) == 1
    assert windows[0].site_number == "2"
    assert windows[0].check_out == date(2026, 8, 9)


def test_preferred_site_ordering():
    sites = {
        "101": {
            "site_number": "10",
            "availabilities": {
                "2026-08-06T00:00:00Z": "Available",
                "2026-08-07T00:00:00Z": "Available",
                "2026-08-08T00:00:00Z": "Available",
            },
        },
        "102": {
            "site_number": "3",
            "availabilities": {
                "2026-08-06T00:00:00Z": "Available",
                "2026-08-07T00:00:00Z": "Available",
                "2026-08-08T00:00:00Z": "Available",
            },
        },
    }
    windows = find_three_night_windows(
        sites,
        nights=3,
        allowed_site_numbers=["3", "10"],
        check_in_dates=[date(2026, 8, 6)],
    )
    assert windows[0].site_number == "3"
