from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Any

from playwright.sync_api import Browser, BrowserContext, Page, Playwright, sync_playwright

from bot.config import BotConfig

logger = logging.getLogger(__name__)

LOGIN_URL = "https://www.recreation.gov/log-in"
PROFILE_URL = "https://www.recreation.gov/account/profile"


class SessionManager:
    def __init__(self, config: BotConfig) -> None:
        self.config = config
        self._playwright: Playwright | None = None
        self._browser: Browser | None = None

    def _ensure_parent(self) -> None:
        self.config.session_file.parent.mkdir(parents=True, exist_ok=True)

    def start(self) -> None:
        if self._playwright is None:
            self._playwright = sync_playwright().start()
        if self._browser is None:
            self._browser = self._playwright.chromium.launch(headless=not self.config.headed)

    def stop(self) -> None:
        if self._browser:
            self._browser.close()
            self._browser = None
        if self._playwright:
            self._playwright.stop()
            self._playwright = None

    def new_context(self, storage_state: str | Path | None = None) -> BrowserContext:
        self.start()
        assert self._browser is not None
        kwargs: dict[str, Any] = {
            "viewport": {"width": 1440, "height": 900},
            "user_agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            ),
            "locale": "en-US",
            "timezone_id": self.config.timezone,
        }
        state_path = Path(storage_state) if storage_state else self.config.session_file
        if state_path.exists():
            kwargs["storage_state"] = str(state_path)
        return self._browser.new_context(**kwargs)

    def login_interactive(self) -> Path:
        """Headed login — human completes authentication, session persisted."""
        self._ensure_parent()
        headed_config = self.config.model_copy(update={"headed": True})
        manager = SessionManager(headed_config)
        context = manager.new_context(storage_state=None)
        page = context.new_page()
        page.goto(LOGIN_URL, wait_until="domcontentloaded")
        logger.info(
            "Complete Recreation.gov login in the browser window. "
            "Press Enter here after you reach your account dashboard."
        )
        try:
            input("Press Enter after successful login... ")
        except EOFError:
            page.wait_for_url("**/account/**", timeout=300_000)

        page.goto(PROFILE_URL, wait_until="domcontentloaded")
        if "/log-in" in page.url:
            raise RuntimeError("Login failed — still redirected to log-in page.")

        self.config.session_file.write_text("{}", encoding="utf-8")  # ensure path writable
        context.storage_state(path=str(self.config.session_file))
        context.close()
        manager.stop()
        logger.info("Session saved to %s", self.config.session_file)
        return self.config.session_file

    def health_check(self) -> dict[str, Any]:
        if not self.config.session_file.exists():
            return {"ok": False, "reason": "session_missing", "abck_state": None}

        context = self.new_context()
        page = context.new_page()
        try:
            page.goto(PROFILE_URL, wait_until="domcontentloaded", timeout=60_000)
            logged_in = "/log-in" not in page.url
            cookies = context.cookies()
            abck = next((c["value"] for c in cookies if c["name"] == "_abck"), "")
            abck_state = parse_abck_state(abck)
            ok = logged_in and abck_state not in {"invalid", "challenge"}
            return {
                "ok": ok,
                "logged_in": logged_in,
                "url": page.url,
                "abck_state": abck_state,
            }
        finally:
            context.close()

    def with_page(self, fn: Any) -> Any:
        context = self.new_context()
        page = context.new_page()
        try:
            return fn(page, context)
        finally:
            context.close()


def parse_abck_state(abck_value: str) -> str:
    if not abck_value:
        return "missing"
    if "~0~" in abck_value:
        return "no_sensor"
    if "~-1~" in abck_value:
        return "challenge"
    if re.search(r"~[0-9a-f]{16,}~", abck_value, re.I):
        return "valid"
    return "unknown"
