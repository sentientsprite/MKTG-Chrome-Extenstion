from __future__ import annotations

import logging
import time
from datetime import date, datetime, timedelta
from typing import Iterator

from bot.availability import AvailabilityClient
from bot.booker import Booker
from bot.config import BotConfig, TargetWindow
from bot.notify import Notifier, read_success, write_success
from bot.windows import StayWindow

logger = logging.getLogger(__name__)


class Scheduler:
    def __init__(self, config: BotConfig) -> None:
        self.config = config
        self.notifier = Notifier(config)
        self.booker = Booker(config)

    def already_succeeded(self) -> bool:
        return read_success(self.config) is not None

    def wait_until(self, moment: datetime) -> None:
        while True:
            now = datetime.now(moment.tzinfo)
            remaining = (moment - now).total_seconds()
            if remaining <= 0:
                return
            sleep_for = min(remaining, 30)
            logger.info("Waiting %.0fs until %s", sleep_for, moment.isoformat())
            time.sleep(sleep_for)

    def attempt_windows(self, windows: list[StayWindow]) -> bool:
        if not windows:
            logger.warning("No matching availability windows")
            return False

        seen_sites: set[str] = set()
        for window in windows:
            key = f"{window.site_id}:{window.check_in.isoformat()}"
            if key in seen_sites:
                continue
            seen_sites.add(key)

            logger.info(
                "Attempting site %s (%s) %s → %s",
                window.site_number,
                window.site_id,
                window.check_in,
                window.check_out,
            )
            result = self.booker.book_window(window)
            self.notifier.send(
                f"Booking attempt: {result.status}",
                result.message,
                site=window.site_number,
                check_in=str(window.check_in),
                cart_url=result.cart_url,
            )

            if result.status == "confirmed":
                write_success(
                    self.config,
                    {
                        "reservation_id": result.reservation_id,
                        "site_number": window.site_number,
                        "site_id": window.site_id,
                        "check_in": window.check_in.isoformat(),
                        "check_out": window.check_out.isoformat(),
                        "url": result.cart_url,
                    },
                )
                self.notifier.send(
                    "Reservation confirmed",
                    f"Site {window.site_number} {window.check_in} → {window.check_out}",
                    reservation_id=result.reservation_id,
                )
                return True

            if result.status == "cart" and self.config.completion_mode == "cart_only":
                write_success(
                    self.config,
                    {
                        "status": "cart",
                        "site_number": window.site_number,
                        "check_in": window.check_in.isoformat(),
                        "cart_url": result.cart_url,
                    },
                )
                return True

            if result.status == "captcha":
                logger.warning("Captcha — waiting 120s for manual solve then retrying checkout")
                time.sleep(120)

        return False

    def snipe_target(self, target: TargetWindow) -> bool:
        if self.already_succeeded():
            logger.info("Success file exists — skipping snipe")
            return True

        release_at = self.config.release_datetime_for_checkin(target.check_in)
        prewarm_at = release_at - timedelta(seconds=self.config.prewarm_seconds)

        now = datetime.now(self.config.tz)
        if now < prewarm_at:
            self.wait_until(prewarm_at)
        self.booker.prewarm(seconds=15)

        if datetime.now(self.config.tz) < release_at:
            self.wait_until(release_at)

        logger.info("Release sniper active for %s", target.check_in)

        deadline = release_at + timedelta(minutes=10)
        with AvailabilityClient(self.config) as client:
            while datetime.now(self.config.tz) < deadline:
                if self.already_succeeded():
                    return True

                windows = client.find_matching_windows(
                    check_in_dates=[target.check_in],
                    nights=target.nights,
                )
                if windows:
                    if self.attempt_windows(windows):
                        return True

                time.sleep(self.config.release_poll_interval)

        self.notifier.send(
            "Release snipe finished",
            f"No confirmed booking for check-in {target.check_in}",
        )
        return False

    def snipe_all_releases(self) -> bool:
        for target in self.config.sorted_targets():
            release_at = self.config.release_datetime_for_checkin(target.check_in)
            if datetime.now(self.config.tz) <= release_at + timedelta(hours=1):
                if self.snipe_target(target):
                    return True
            else:
                logger.info("Skipping past release for %s", target.check_in)
        return self.already_succeeded()

    def monitor_cancellations(self, until_success: bool = True) -> bool:
        if self.already_succeeded():
            return True

        check_ins = [t.check_in for t in self.config.sorted_targets()]
        self.notifier.send(
            "Cancellation monitor started",
            f"Watching {self.config.facility_name} for {check_ins}",
        )

        with AvailabilityClient(self.config) as client:
            while True:
                if self.already_succeeded():
                    return True

                windows = client.find_matching_windows(check_in_dates=check_ins)
                if windows:
                    logger.info("Found %d bookable windows", len(windows))
                    if self.attempt_windows(windows):
                        return True

                if not until_success:
                    return False

                time.sleep(self.config.cancel_poll_interval)

    def run_until_success(self) -> bool:
        if self.already_succeeded():
            logger.info("Already have success.json")
            return True

        if self.snipe_all_releases():
            return True

        return self.monitor_cancellations(until_success=True)

    def close(self) -> None:
        self.booker.close()


def upcoming_releases(config: BotConfig) -> Iterator[tuple[TargetWindow, datetime]]:
    now = datetime.now(config.tz)
    for target in config.sorted_targets():
        release_at = config.release_datetime_for_checkin(target.check_in)
        if release_at >= now - timedelta(hours=1):
            yield target, release_at
