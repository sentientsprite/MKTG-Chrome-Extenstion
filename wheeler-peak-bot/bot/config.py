from __future__ import annotations

import os
from datetime import date, datetime, time
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

import yaml
from pydantic import BaseModel, Field, field_validator


class TargetWindow(BaseModel):
    check_in: date
    nights: int = 3
    priority: int = 1
    tier: str = "primary"  # primary | secondary

    @property
    def check_out(self) -> date:
        from datetime import timedelta

        return self.check_in + timedelta(days=self.nights)


class BotConfig(BaseModel):
    facility_id: str = "10088563"
    facility_name: str = "Wheeler Peak Campground"
    facility_url: str = "https://www.recreation.gov/camping/campgrounds/10088563"
    timezone: str = "America/Los_Angeles"

    release_hour: int = 7
    release_minute: int = 0

    targets: list[TargetWindow] = Field(default_factory=list)
    nights: int = 3
    max_vehicle_length_ft: int = 24
    max_party_size: int = 8
    preferred_sites: list[str] = Field(default_factory=list)

    completion_mode: str = "booking"  # booking | cart_only
    session_path: str = "~/.wheeler-peak-bot/session.json"
    success_path: str = "~/.wheeler-peak-bot/success.json"
    log_dir: str = "~/.wheeler-peak-bot/logs"

    cancel_poll_interval: float = 75.0
    release_poll_interval: float = 3.0
    prewarm_seconds: int = 600

    dry_run: bool = False
    max_reservations: int = 1
    headed: bool = False

    telegram_bot_token: str = ""
    telegram_chat_id: str = ""
    webhook_url: str = ""

    @field_validator("preferred_sites", mode="before")
    @classmethod
    def normalize_sites(cls, value: Any) -> list[str]:
        if value is None:
            return []
        return [str(v) for v in value]

    @property
    def tz(self) -> ZoneInfo:
        return ZoneInfo(self.timezone)

    def expand_path(self, raw: str) -> Path:
        return Path(os.path.expanduser(raw))

    @property
    def session_file(self) -> Path:
        return self.expand_path(self.session_path)

    @property
    def success_file(self) -> Path:
        return self.expand_path(self.success_path)

    @property
    def log_path(self) -> Path:
        return self.expand_path(self.log_dir)

    def release_datetime_for_checkin(self, check_in: date) -> datetime:
        from datetime import timedelta

        open_day = check_in - timedelta(days=30)
        return datetime.combine(
            open_day,
            time(self.release_hour, self.release_minute),
            tzinfo=self.tz,
        )

    def sorted_targets(self) -> list[TargetWindow]:
        return sorted(self.targets, key=lambda t: t.priority)


def load_config(path: str | Path | None = None) -> BotConfig:
    config_path = Path(path or os.environ.get("WHEELER_BOT_CONFIG", "config.yaml"))
    if not config_path.is_absolute():
        candidates = [
            config_path,
            Path.cwd() / config_path,
            Path(__file__).resolve().parent.parent / config_path,
        ]
        for candidate in candidates:
            if candidate.exists():
                config_path = candidate
                break

    data: dict[str, Any] = {}
    if config_path.exists():
        with config_path.open(encoding="utf-8") as handle:
            data = yaml.safe_load(handle) or {}

    if not data.get("targets"):
        data["targets"] = [
            {"check_in": "2026-08-06", "nights": 3, "priority": 1, "tier": "primary"},
            {"check_in": "2026-08-13", "nights": 3, "priority": 2, "tier": "primary"},
            {"check_in": "2026-08-05", "nights": 3, "priority": 3, "tier": "secondary"},
            {"check_in": "2026-08-12", "nights": 3, "priority": 4, "tier": "secondary"},
        ]

    return BotConfig.model_validate(data)
