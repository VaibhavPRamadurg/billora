#!/usr/bin/env python3
"""Set one authoritative recurring-billing anchor from a trusted operator terminal."""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Protocol
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.session import get_session_factory
from app.models import Invoice, Subscription, SubscriptionStatus
from app.services.billing.dates import calculate_subscription_billing_period


class BillingAnchorRemediationError(Exception):
    """Base class for safe, operator-facing remediation failures."""


class BillingAnchorValidationError(BillingAnchorRemediationError):
    """The subscription or proposed authoritative anchor is not safe to update."""


class BillingAnchorDatabaseError(BillingAnchorRemediationError):
    """The anchor update could not be completed transactionally."""


class BillingAnchorSession(Protocol):
    """Minimal session interface used by the remediation operation."""

    def scalar(self, statement: object) -> Subscription | None: ...

    def scalars(self, statement: object): ...

    def commit(self) -> None: ...

    def rollback(self) -> None: ...

    def refresh(self, instance: Subscription) -> None: ...


def parse_authoritative_utc_anchor(value: str) -> datetime:
    """Parse an explicit UTC ISO 8601 timestamp without accepting local offsets."""
    if not isinstance(value, str):
        raise BillingAnchorValidationError("anchor timestamp must be a UTC ISO 8601 string")
    try:
        parsed = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    except ValueError as exc:
        raise BillingAnchorValidationError("anchor timestamp must be valid ISO 8601") from exc
    if parsed.tzinfo is None or parsed.utcoffset() != timedelta(0):
        raise BillingAnchorValidationError("anchor timestamp must use UTC (Z or +00:00)")
    return parsed.astimezone(timezone.utc)


def remediate_billing_anchor(
    session: BillingAnchorSession,
    *,
    subscription_id: UUID,
    billing_anchor_at: datetime,
) -> Subscription:
    """Set one missing anchor after cadence consistency checks.

    This intentionally changes only ``billing_anchor_at``. It never derives an
    anchor automatically and does not modify periods, invoices, payments, or status.
    """
    if billing_anchor_at.tzinfo is None or billing_anchor_at.utcoffset() != timedelta(0):
        raise BillingAnchorValidationError("billing_anchor_at must be an aware UTC timestamp")
    anchor = billing_anchor_at.astimezone(timezone.utc)
    try:
        subscription = session.scalar(
            select(Subscription)
            .where(Subscription.id == subscription_id)
            .with_for_update()
        )
    except SQLAlchemyError as exc:
        raise BillingAnchorDatabaseError("Unable to load the subscription for remediation.") from exc
    if subscription is None:
        raise BillingAnchorValidationError("Subscription not found")
    if subscription.status not in {SubscriptionStatus.ACTIVE, SubscriptionStatus.PAUSED}:
        raise BillingAnchorValidationError("Only active or paused subscriptions can be remediated")
    if subscription.billing_anchor_at is not None:
        raise BillingAnchorValidationError("Subscription already has a billing anchor")
    if subscription.current_period_start is None or subscription.current_period_end is None:
        raise BillingAnchorValidationError("Subscription does not have a valid current billing period")

    current_start = _database_utc(subscription.current_period_start, "current_period_start")
    current_end = _database_utc(subscription.current_period_end, "current_period_end")
    _validate_period_against_anchor(subscription, current_start, current_end, anchor)

    try:
        invoice_history = session.scalars(
            select(Invoice)
            .where(Invoice.subscription_id == subscription.id)
            .order_by(Invoice.period_start)
        ).all()
    except SQLAlchemyError as exc:
        raise BillingAnchorDatabaseError("Unable to validate subscription billing history.") from exc
    for invoice in invoice_history:
        _validate_period_against_anchor(
            subscription,
            _database_utc(invoice.period_start, "invoice.period_start"),
            _database_utc(invoice.period_end, "invoice.period_end"),
            anchor,
        )

    subscription.billing_anchor_at = anchor
    try:
        session.commit()
    except SQLAlchemyError as exc:
        session.rollback()
        raise BillingAnchorDatabaseError("Billing-anchor remediation could not be completed.") from exc
    session.refresh(subscription)
    return subscription


def _database_utc(value: datetime, field_name: str) -> datetime:
    """Normalize persisted PostgreSQL values; SQLite tests omit timezone metadata."""
    if not isinstance(value, datetime):
        raise BillingAnchorValidationError(f"{field_name} must be a timestamp")
    if value.tzinfo is None or value.utcoffset() is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _validate_period_against_anchor(
    subscription: Subscription,
    period_start: datetime,
    period_end: datetime,
    anchor: datetime,
) -> None:
    if anchor > period_start:
        raise BillingAnchorValidationError("Anchor cannot be later than known billing history")
    if period_start >= period_end:
        raise BillingAnchorValidationError("Subscription billing history has an invalid period")
    expected = calculate_subscription_billing_period(
        period_start,
        subscription.billing_frequency,
        anchor_at=anchor,
    )
    if expected.end_at != period_end:
        raise BillingAnchorValidationError(
            "Anchor conflicts with the subscription's persisted billing cadence"
        )


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Set one authoritative Billora billing anchor.")
    parser.add_argument("--subscription-id", type=UUID, required=True)
    parser.add_argument(
        "--anchor-at",
        required=True,
        help="Authoritative UTC ISO 8601 timestamp, for example 2026-01-31T00:00:00Z.",
    )
    parser.add_argument("--confirm", action="store_true", help="Confirm this single-record update.")
    return parser


def main(argv: list[str] | None = None) -> int:
    """Run the operator-only remediation command and return a shell exit status."""
    args = _parser().parse_args(argv)
    if not args.confirm:
        print("Refusing to write: rerun with --confirm.", file=sys.stderr)
        return 2
    try:
        anchor = parse_authoritative_utc_anchor(args.anchor_at)
    except BillingAnchorValidationError as exc:
        print(str(exc), file=sys.stderr)
        return 2
    try:
        session = get_session_factory()()
    except (SQLAlchemyError, RuntimeError):
        print("Unable to open the database session.", file=sys.stderr)
        return 1
    try:
        subscription = remediate_billing_anchor(
            session,
            subscription_id=args.subscription_id,
            billing_anchor_at=anchor,
        )
    except BillingAnchorRemediationError as exc:
        print(str(exc), file=sys.stderr)
        return 1
    finally:
        session.close()
    print(f"Billing anchor set for subscription {subscription.id}: {anchor.isoformat()}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
