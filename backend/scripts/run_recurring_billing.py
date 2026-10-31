#!/usr/bin/env python3
"""Run one local, operator-controlled recurring-billing batch."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy.exc import SQLAlchemyError

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.session import get_session_factory
from app.services.billing.recurring import run_recurring_billing


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Process one safe Billora recurring-billing batch."
    )
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--dry-run", action="store_true", help="Report eligible records without writes.")
    mode.add_argument("--confirm", action="store_true", help="Confirm invoice and schedule updates.")
    parser.add_argument(
        "--batch-size",
        type=int,
        default=50,
        help="Maximum due subscriptions to inspect (default: 50).",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    """Run the batch and emit one JSON structured log record per outcome."""
    args = _parser().parse_args(argv)
    if args.batch_size < 1:
        print("batch-size must be at least 1", file=sys.stderr)
        return 2

    try:
        session = get_session_factory()()
    except (SQLAlchemyError, RuntimeError):
        print("Unable to open the database session.", file=sys.stderr)
        return 1
    try:
        reports = run_recurring_billing(
            session,
            now=datetime.now(timezone.utc),
            batch_size=args.batch_size,
            dry_run=args.dry_run,
        )
    except (SQLAlchemyError, ValueError):
        session.rollback()
        print("Recurring billing batch could not be started.", file=sys.stderr)
        return 1
    finally:
        session.close()

    for report in reports:
        print(json.dumps({"event": "recurring_billing", **report.as_log_record()}, sort_keys=True))
    return 1 if any(report.outcome == "failed" for report in reports) else 0


if __name__ == "__main__":
    raise SystemExit(main())
