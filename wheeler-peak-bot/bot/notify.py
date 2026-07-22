from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx

from bot.config import BotConfig

logger = logging.getLogger(__name__)


class Notifier:
    def __init__(self, config: BotConfig) -> None:
        self.config = config

    def send(self, title: str, message: str, **extra: Any) -> None:
        text = f"{title}\n\n{message}"
        if extra:
            text += f"\n\n{json.dumps(extra, indent=2, default=str)}"
        logger.info("%s — %s", title, message)
        self._telegram(text)
        self._webhook(title, message, extra)

    def _telegram(self, text: str) -> None:
        token = self.config.telegram_bot_token.strip()
        chat_id = self.config.telegram_chat_id.strip()
        if not token or not chat_id:
            return
        url = f"https://api.telegram.org/bot{token}/sendMessage"
        try:
            httpx.post(url, json={"chat_id": chat_id, "text": text[:4000]}, timeout=15)
        except Exception as exc:
            logger.warning("Telegram notify failed: %s", exc)

    def _webhook(self, title: str, message: str, extra: dict[str, Any]) -> None:
        url = self.config.webhook_url.strip()
        if not url:
            return
        payload = {
            "title": title,
            "message": message,
            "extra": extra,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        try:
            httpx.post(url, json=payload, timeout=15)
        except Exception as exc:
            logger.warning("Webhook notify failed: %s", exc)


def write_success(config: BotConfig, reservation: dict[str, Any]) -> Path:
    path = config.success_file
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "confirmed_at": datetime.now(timezone.utc).isoformat(),
        **reservation,
    }
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return path


def read_success(config: BotConfig) -> dict[str, Any] | None:
    path = config.success_file
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))
