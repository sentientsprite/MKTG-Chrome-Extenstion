from __future__ import annotations

import json
import logging
from datetime import date, datetime
from typing import Any
from urllib.parse import quote

import httpx

from bot.config import BotConfig
from bot.windows import StayWindow, find_three_night_windows, is_available

logger = logging.getLogger(__name__)

BASE_URL = "https://www.recreation.gov"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)


def parse_iso_date(value: str) -> date:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).date()


def month_start(d: date) -> date:
    return date(d.year, d.month, 1)


class AvailabilityClient:
    def __init__(self, config: BotConfig, timeout: float = 30.0) -> None:
        self.config = config
        self.client = httpx.Client(
            base_url=BASE_URL,
            timeout=timeout,
            headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
        )

    def close(self) -> None:
        self.client.close()

    def __enter__(self) -> AvailabilityClient:
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()

    def fetch_month(self, facility_id: str, month: date) -> dict[str, Any]:
        start = month_start(month)
        encoded = quote(f"{start.isoformat()}T00:00:00.000Z", safe="")
        url = f"/api/camps/availability/campground/{facility_id}/month"
        response = self.client.get(url, params={"start_date": f"{start.isoformat()}T00:00:00.000Z"})
        response.raise_for_status()
        return response.json()

    def fetch_range(
        self,
        facility_id: str,
        start: date,
        end: date,
    ) -> dict[str, dict[str, Any]]:
        """Fetch and merge monthly availability between start and end."""
        from dateutil.relativedelta import relativedelta

        merged: dict[str, dict[str, Any]] = {}
        cursor = month_start(start)
        last = month_start(end)

        while cursor <= last:
            payload = self.fetch_month(facility_id, cursor)
            for site_id, site in payload.get("campsites", {}).items():
                entry = merged.setdefault(
                    site_id,
                    {
                        "site_number": str(site.get("site", site_id)),
                        "loop": site.get("loop", ""),
                        "availabilities": {},
                    },
                )
                entry["availabilities"].update(site.get("availabilities", {}))
            cursor += relativedelta(months=1)

        return merged

    def fetch_campsites_metadata(self, facility_id: str) -> list[dict[str, Any]]:
        sites: list[dict[str, Any]] = []
        start = 0
        page_size = 100
        while True:
            response = self.client.get(
                "/api/search/campsites",
                params={
                    "start": start,
                    "size": page_size,
                    "fq": f"asset_id:{facility_id}",
                    "include_non_site_specific_campsites": "true",
                },
            )
            response.raise_for_status()
            payload = response.json()
            batch = payload.get("campsites") or payload.get("results") or []
            sites.extend(batch)
            total = payload.get("total", len(sites))
            start += page_size
            if start >= total or not batch:
                break
        return sites

    def filter_sites_by_vehicle(
        self,
        sites: list[dict[str, Any]],
        max_length_ft: int,
    ) -> set[str]:
        allowed: set[str] = set()
        for site in sites:
            site_number = str(site.get("campsite_name") or site.get("site") or "")
            site_id = str(site.get("campsite_id") or site.get("id") or "")
            length = self._attribute_value(site, "Driveway Length")
            if length is not None:
                try:
                    if float(length) > max_length_ft:
                        continue
                except ValueError:
                    pass
            key = site_id or site_number
            if key:
                allowed.add(key)
        return allowed

    @staticmethod
    def _attribute_value(site: dict[str, Any], name: str) -> str | None:
        for attr in site.get("attributes", []):
            if attr.get("attribute_name") == name:
                return str(attr.get("attribute_value", ""))
        details = site.get("site_details_map") or {}
        if name in details:
            return str(details[name])
        return None

    def find_matching_windows(
        self,
        check_in_dates: list[date] | None = None,
        nights: int | None = None,
    ) -> list[StayWindow]:
        nights = nights or self.config.nights
        from datetime import timedelta

        if check_in_dates:
            start = min(check_in_dates)
            end = max(check_in_dates) + timedelta(days=nights + 2)
        else:
            start = min(t.check_in for t in self.config.targets)
            end = max(t.check_in for t in self.config.targets) + timedelta(days=nights + 2)

        sites_by_id = self.fetch_range(self.config.facility_id, start, end)

        if self.config.preferred_sites:
            preferred = self.config.preferred_sites
        else:
            preferred = []

        return find_three_night_windows(
            sites_by_id,
            nights=nights,
            allowed_site_numbers=preferred or None,
            check_in_dates=check_in_dates,
        )

    def summarize_target(self, target_check_in: date, nights: int) -> dict[str, Any]:
        windows = self.find_matching_windows(check_in_dates=[target_check_in], nights=nights)
        return {
            "check_in": target_check_in.isoformat(),
            "nights": nights,
            "matching_sites": len({w.site_id for w in windows}),
            "windows": [
                {
                    "site_number": w.site_number,
                    "site_id": w.site_id,
                    "check_in": w.check_in.isoformat(),
                    "check_out": w.check_out.isoformat(),
                }
                for w in windows
            ],
        }


def dump_availability_snapshot(config: BotConfig, path: str) -> None:
    with AvailabilityClient(config) as client:
        summary = {
            "facility_id": config.facility_id,
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "targets": [
                client.summarize_target(t.check_in, t.nights) for t in config.sorted_targets()
            ],
        }
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(summary, handle, indent=2)
