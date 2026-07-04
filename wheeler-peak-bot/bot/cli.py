from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import date
from pathlib import Path

from bot import __version__
from bot.availability import AvailabilityClient, dump_availability_snapshot
from bot.booker import Booker
from bot.config import BotConfig, load_config
from bot.notify import read_success
from bot.scheduler import Scheduler, upcoming_releases
from bot.session import SessionManager

LOG_FORMAT = "%(asctime)s %(levelname)s %(name)s — %(message)s"


def setup_logging(verbose: bool = False) -> None:
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(level=level, format=LOG_FORMAT)


def cmd_session_login(config: BotConfig, _args: argparse.Namespace) -> int:
    manager = SessionManager(config.model_copy(update={"headed": True}))
    manager.login_interactive()
    manager.stop()
    return 0


def cmd_session_health(config: BotConfig, args: argparse.Namespace) -> int:
    manager = SessionManager(config)
    result = manager.health_check()
    manager.stop()
    print(json.dumps(result, indent=2))
    return 0 if result.get("ok") else 1


def cmd_availability_scan(config: BotConfig, args: argparse.Namespace) -> int:
    with AvailabilityClient(config) as client:
        check_ins = [date.fromisoformat(d) for d in args.check_in] if args.check_in else [
            t.check_in for t in config.sorted_targets()
        ]
        windows = client.find_matching_windows(check_in_dates=check_ins, nights=args.nights)
        payload = [
            {
                "site_number": w.site_number,
                "site_id": w.site_id,
                "check_in": w.check_in.isoformat(),
                "check_out": w.check_out.isoformat(),
            }
            for w in windows
        ]
        print(json.dumps(payload, indent=2))
    return 0


def cmd_prewarm(config: BotConfig, args: argparse.Namespace) -> int:
    booker = Booker(config)
    booker.prewarm(seconds=args.seconds)
    booker.close()
    return 0


def cmd_snipe(config: BotConfig, args: argparse.Namespace) -> int:
    scheduler = Scheduler(config)
    try:
        if args.check_in:
            from bot.config import TargetWindow

            target = TargetWindow(
                check_in=date.fromisoformat(args.check_in),
                nights=args.nights or config.nights,
                priority=1,
            )
            ok = scheduler.snipe_target(target)
        else:
            ok = scheduler.snipe_all_releases()
        return 0 if ok else 1
    finally:
        scheduler.close()


def cmd_monitor(config: BotConfig, args: argparse.Namespace) -> int:
    scheduler = Scheduler(config)
    try:
        ok = scheduler.monitor_cancellations(until_success=args.until_success)
        return 0 if ok else 1
    finally:
        scheduler.close()


def cmd_run(config: BotConfig, args: argparse.Namespace) -> int:
    scheduler = Scheduler(config)
    try:
        ok = scheduler.run_until_success()
        return 0 if ok else 1
    finally:
        scheduler.close()


def cmd_status(config: BotConfig, _args: argparse.Namespace) -> int:
    success = read_success(config)
    releases = [
        {
            "check_in": t.check_in.isoformat(),
            "release_at": config.release_datetime_for_checkin(t.check_in).isoformat(),
            "priority": t.priority,
        }
        for t in config.sorted_targets()
    ]
    print(
        json.dumps(
            {
                "version": __version__,
                "facility": config.facility_name,
                "facility_id": config.facility_id,
                "success": success,
                "session_exists": config.session_file.exists(),
                "releases": releases,
                "dry_run": config.dry_run,
            },
            indent=2,
        )
    )
    return 0


def cmd_snapshot(config: BotConfig, args: argparse.Namespace) -> int:
    out = args.output or str(config.log_path / "availability-snapshot.json")
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    dump_availability_snapshot(config, out)
    print(out)
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="wheeler-bot",
        description="Wheeler Peak Campground reservation bot for Recreation.gov",
    )
    parser.add_argument("--config", default=None, help="Path to config.yaml")
    parser.add_argument("-v", "--verbose", action="store_true")
    parser.add_argument("--dry-run", action="store_true", help="Detect only; skip cart/checkout")

    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("status", help="Show config, releases, and success state")

    p_login = sub.add_parser("session", help="Session management")
    session_sub = p_login.add_subparsers(dest="session_cmd", required=True)
    session_sub.add_parser("login", help="Interactive headed login")
    session_sub.add_parser("health", help="Verify saved session")

    p_scan = sub.add_parser("scan", help="Scan availability API for matching windows")
    p_scan.add_argument("--check-in", action="append", help="YYYY-MM-DD (repeatable)")
    p_scan.add_argument("--nights", type=int, default=None)

    p_prewarm = sub.add_parser("prewarm", help="Pre-warm browser on campground page")
    p_prewarm.add_argument("--seconds", type=int, default=15)

    p_snipe = sub.add_parser("snipe", help="Release-day sniper for a target check-in")
    p_snipe.add_argument("--check-in", help="YYYY-MM-DD; default = all upcoming releases")
    p_snipe.add_argument("--nights", type=int, default=None)

    p_monitor = sub.add_parser("monitor", help="Poll for cancellations and book")
    p_monitor.add_argument("--until-success", action="store_true", default=True)

    sub.add_parser("run", help="Snipe releases then monitor until success")

    p_snap = sub.add_parser("snapshot", help="Write availability snapshot JSON")
    p_snap.add_argument("-o", "--output", default=None)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    setup_logging(args.verbose)

    config = load_config(args.config)
    if args.dry_run:
        config = config.model_copy(update={"dry_run": True})

    config.log_path.mkdir(parents=True, exist_ok=True)

    handlers = {
        ("session", "login"): cmd_session_login,
        ("session", "health"): cmd_session_health,
        ("scan", None): cmd_availability_scan,
        ("prewarm", None): cmd_prewarm,
        ("snipe", None): cmd_snipe,
        ("monitor", None): cmd_monitor,
        ("run", None): cmd_run,
        ("status", None): cmd_status,
        ("snapshot", None): cmd_snapshot,
    }

    key = (args.command, getattr(args, "session_cmd", None))
    handler = handlers.get(key) or handlers.get((args.command, None))
    if not handler:
        parser.error(f"Unknown command: {args.command}")
    return handler(config, args)


if __name__ == "__main__":
    sys.exit(main())
