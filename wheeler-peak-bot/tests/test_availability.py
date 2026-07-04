from __future__ import annotations

import json
from datetime import date
from unittest.mock import MagicMock, patch

import pytest

from bot.availability import AvailabilityClient, parse_iso_date
from bot.config import BotConfig, load_config


def test_parse_iso_date():
    assert parse_iso_date("2026-08-06T00:00:00Z") == date(2026, 8, 6)


def test_load_config_defaults(tmp_path):
    cfg_path = tmp_path / "config.yaml"
    cfg_path.write_text("facility_id: '10088563'\n", encoding="utf-8")
    config = load_config(cfg_path)
    assert config.facility_id == "10088563"
    assert len(config.targets) == 2
    assert config.targets[0].check_in == date(2026, 8, 6)


def test_release_datetime_pacific():
    config = BotConfig()
    release = config.release_datetime_for_checkin(date(2026, 8, 6))
    assert release.date().isoformat() == "2026-07-07"
    assert release.hour == 7
    assert str(release.tzinfo) in ("America/Los_Angeles", "PDT", "PST")


@pytest.fixture
def sample_month_payload():
    return {
        "campsites": {
            "999": {
                "site": "14",
                "loop": "Wheeler Peak",
                "availabilities": {
                    "2026-08-06T00:00:00Z": "Available",
                    "2026-08-07T00:00:00Z": "Available",
                    "2026-08-08T00:00:00Z": "Available",
                    "2026-08-09T00:00:00Z": "Open",
                },
            }
        }
    }


def test_find_matching_windows(sample_month_payload):
    config = BotConfig()
    client = AvailabilityClient(config)
    client.fetch_range = MagicMock(  # type: ignore[method-assign]
        return_value={
            "999": {
                "site_number": "14",
                "loop": "Wheeler Peak",
                "availabilities": sample_month_payload["campsites"]["999"]["availabilities"],
            }
        }
    )
    windows = client.find_matching_windows(check_in_dates=[date(2026, 8, 6)], nights=3)
    assert len(windows) == 1
    assert windows[0].site_number == "14"
    client.close()


def test_live_api_smoke():
    """Dry-run against live recreation.gov read API."""
    config = BotConfig(dry_run=True)
    with AvailabilityClient(config) as client:
        payload = client.fetch_month("10088563", date(2026, 8, 1))
    assert "campsites" in payload
    assert len(payload["campsites"]) >= 30
