from __future__ import annotations

import logging
import re
import time
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any

from playwright.sync_api import BrowserContext, Page, TimeoutError as PlaywrightTimeout

from bot.config import BotConfig
from bot.session import SessionManager
from bot.windows import StayWindow

logger = logging.getLogger(__name__)


@dataclass
class BookResult:
    status: str  # confirmed | cart | captcha | unavailable | dry_run | error
    message: str
    cart_url: str | None = None
    reservation_id: str | None = None
    screenshot: str | None = None


class Booker:
    AVAILABILITY_PATH = "/camping/campgrounds/{facility_id}/availability"

    def __init__(self, config: BotConfig) -> None:
        self.config = config
        self.session = SessionManager(config)

    def prewarm(self, seconds: int | None = None) -> None:
        wait = seconds if seconds is not None else self.config.prewarm_seconds

        def _warm(page: Page, _ctx: BrowserContext) -> None:
            page.goto(self.config.facility_url, wait_until="domcontentloaded", timeout=120_000)
            page.wait_for_timeout(min(wait, 15) * 1000)
            logger.info("Pre-warmed campground page for %ss", min(wait, 15))

        self.session.with_page(_warm)

    def book_window(self, window: StayWindow) -> BookResult:
        if self.config.dry_run:
            return BookResult(
                status="dry_run",
                message=(
                    f"Would book site {window.site_number} "
                    f"{window.check_in} → {window.check_out}"
                ),
            )

        if not self.config.session_file.exists():
            return BookResult(status="error", message="No session — run: wheeler-bot session login")

        try:
            return self.session.with_page(lambda page, ctx: self._book(page, ctx, window))
        except Exception as exc:
            logger.exception("Booking failed")
            return BookResult(status="error", message=str(exc))

    def _book(self, page: Page, context: BrowserContext, window: StayWindow) -> BookResult:
        url = self.config.facility_url.rstrip("/") + "/availability"
        page.goto(url, wait_until="domcontentloaded", timeout=120_000)
        page.wait_for_timeout(5000)

        self._set_dates(page, window.check_in, window.check_out)
        page.wait_for_timeout(2000)

        if not self._select_site(page, window):
            return BookResult(
                status="unavailable",
                message=f"Could not select site {window.site_number}",
            )

        cart_result = self._add_to_cart(page)
        if cart_result.status != "cart":
            return cart_result

        if self.config.completion_mode == "cart_only":
            return cart_result

        checkout = self._complete_checkout(page)
        return checkout

    def _set_dates(self, page: Page, check_in: date, check_out: date) -> None:
        check_in_str = check_in.strftime("%m/%d/%Y")
        check_out_str = check_out.strftime("%m/%d/%Y")

        selectors_in = [
            'input[aria-label*="Check in" i]',
            'input[name*="checkin" i]',
            'input[placeholder*="Check in" i]',
            "#campground-start-date",
        ]
        selectors_out = [
            'input[aria-label*="Check out" i]',
            'input[name*="checkout" i]',
            'input[placeholder*="Check out" i]',
            "#campground-end-date",
        ]

        if not self._fill_first(page, selectors_in, check_in_str):
            self._click_calendar_dates(page, check_in, check_out)
        else:
            self._fill_first(page, selectors_out, check_out_str)

        page.keyboard.press("Escape")
        page.wait_for_timeout(800)

    def _fill_first(self, page: Page, selectors: list[str], value: str) -> bool:
        for selector in selectors:
            locator = page.locator(selector).first
            if locator.count() == 0:
                continue
            try:
                locator.click(timeout=3000)
                locator.fill(value)
                page.keyboard.press("Tab")
                return True
            except PlaywrightTimeout:
                continue
        return False

    def _click_calendar_dates(self, page: Page, check_in: date, check_out: date) -> None:
        for target in (check_in, check_out):
            label = f"{target.strftime('%A, %B')} {target.day}, {target.year}"
            alt = target.strftime("%B %d, %Y")
            for text in (label, alt):
                cell = page.get_by_role("button", name=re.compile(re.escape(text.split(",")[0]), re.I))
                if cell.count():
                    cell.first.click()
                    page.wait_for_timeout(400)
                    break

    def _select_site(self, page: Page, window: StayWindow) -> bool:
        site_num = window.site_number

        strategies = [
            lambda: page.locator(f'[data-campsite-id="{window.site_id}"]').first,
            lambda: page.locator(f'button[aria-label*="Site {site_num}" i]').first,
            lambda: page.locator(f'a[aria-label*="Site {site_num}" i]').first,
            lambda: page.get_by_text(re.compile(rf"\bSite\s*{re.escape(site_num)}\b", re.I)).first,
            lambda: page.locator(".rec-grid-selectable").filter(has_text=re.compile(rf"\b{re.escape(site_num)}\b")).first,
        ]

        for factory in strategies:
            locator = factory()
            try:
                if locator.count() == 0:
                    continue
                locator.click(timeout=5000)
                page.wait_for_timeout(500)
                return True
            except PlaywrightTimeout:
                continue

        available_cell = page.locator(".available .rec-availability-date, [class*='available']").first
        if available_cell.count():
            available_cell.click(timeout=5000)
            return True

        return False

    def _add_to_cart(self, page: Page) -> BookResult:
        cart_selectors = [
            'button:has-text("Add to Cart")',
            'button:has-text("Add To Cart")',
            '[data-testid="add-to-cart"]',
            'button[aria-label*="Add to Cart" i]',
        ]

        with page.expect_response(lambda r: "cart" in r.url and r.request.method == "POST", timeout=30_000) as resp_info:
            clicked = False
            for selector in cart_selectors:
                btn = page.locator(selector).first
                if btn.count() == 0:
                    continue
                try:
                    btn.click(timeout=8000)
                    clicked = True
                    break
                except PlaywrightTimeout:
                    continue

            if not clicked:
                return BookResult(status="error", message="Add to Cart button not found")

        response = resp_info.value
        cart_url = page.url if "cart" in page.url else "https://www.recreation.gov/cart"

        if response.status >= 400:
            return BookResult(status="unavailable", message=f"Cart POST failed: {response.status}")

        if page.locator('iframe[src*="hcaptcha"], div.h-captcha').count():
            shot = self._screenshot(page, "captcha-cart")
            return BookResult(
                status="captcha",
                message="hCaptcha detected at cart — complete manually",
                cart_url=cart_url,
                screenshot=shot,
            )

        return BookResult(status="cart", message="Site added to cart", cart_url=cart_url)

    def _complete_checkout(self, page: Page) -> BookResult:
        if "cart" not in page.url:
            page.goto("https://www.recreation.gov/cart", wait_until="domcontentloaded")

        proceed_selectors = [
            'button:has-text("Proceed to Checkout")',
            'button:has-text("Checkout")',
            'a:has-text("Proceed to Checkout")',
        ]
        for selector in proceed_selectors:
            btn = page.locator(selector).first
            if btn.count():
                btn.click(timeout=10_000)
                break

        page.wait_for_timeout(2000)

        if page.locator('iframe[src*="hcaptcha"], div.h-captcha').count():
            shot = self._screenshot(page, "captcha-checkout")
            return BookResult(
                status="captcha",
                message="hCaptcha at checkout — finish payment manually within 15 minutes",
                cart_url=page.url,
                screenshot=shot,
            )

        order_selectors = [
            'button:has-text("Place Order")',
            'button:has-text("Complete Reservation")',
            'button:has-text("Confirm")',
            'button[type="submit"]:has-text("Pay")',
        ]
        for selector in order_selectors:
            btn = page.locator(selector).first
            if btn.count():
                btn.click(timeout=10_000)
                break

        page.wait_for_timeout(5000)

        body = page.content()
        reservation_id = self._extract_reservation_id(body, page.url)
        if reservation_id or "confirmation" in page.url.lower():
            return BookResult(
                status="confirmed",
                message="Reservation confirmed",
                reservation_id=reservation_id,
                cart_url=page.url,
            )

        return BookResult(
            status="cart",
            message="Added to cart but checkout could not be confirmed automatically",
            cart_url=page.url,
        )

    @staticmethod
    def _extract_reservation_id(body: str, url: str) -> str | None:
        for pattern in (
            r"Reservation\s*(?:Number|#|ID)[:\s#]*([A-Z0-9-]{6,})",
            r"confirmation[^0-9A-Z]*([A-Z0-9-]{8,})",
            r"orderId[\"':=\s]+([a-zA-Z0-9-]{8,})",
        ):
            match = re.search(pattern, body, re.I)
            if match:
                return match.group(1)
        url_match = re.search(r"/confirmation/([A-Za-z0-9-]+)", url)
        return url_match.group(1) if url_match else None

    def _screenshot(self, page: Page, name: str) -> str:
        self.config.log_path.mkdir(parents=True, exist_ok=True)
        path = self.config.log_path / f"{name}-{int(time.time())}.png"
        page.screenshot(path=str(path), full_page=True)
        return str(path)

    def close(self) -> None:
        self.session.stop()
