from __future__ import annotations

from datetime import date

from bot.config import BotConfig, TargetWindow
from bot.scheduler import Scheduler
from bot.windows import StayWindow


def test_sort_windows_primary_before_secondary():
    config = BotConfig(
        targets=[
            TargetWindow(check_in=date(2026, 8, 6), nights=3, priority=1, tier="primary"),
            TargetWindow(check_in=date(2026, 8, 5), nights=3, priority=3, tier="secondary"),
        ]
    )
    scheduler = Scheduler(config)
    windows = [
        StayWindow(date(2026, 8, 5), date(2026, 8, 8), 3, "102", "7"),
        StayWindow(date(2026, 8, 6), date(2026, 8, 9), 3, "101", "2"),
    ]
    sorted_windows = scheduler._sort_windows_by_priority(windows)
    assert sorted_windows[0].check_in == date(2026, 8, 6)
    assert sorted_windows[1].check_in == date(2026, 8, 5)
    scheduler.close()
