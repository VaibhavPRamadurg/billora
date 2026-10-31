"""Safe, explicit recurring-billing processing for active subscriptions."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Literal
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, selectinload

from app.models import Subscription, SubscriptionStatus
from app.services.billing.dates import calculate_subscription_billing_period
from app.services.billing.invoices import (
    InvoiceGenerationConflict,
    InvoiceGenerationDatabaseError,
    InvoiceGenerationValidationError,
    generate_subscription_period_invoice,
)


WorkerOutcome = Literal["processed", "skipped", "failed", "dry_run"]


@dataclass(frozen=True, slots=True)
class RecurringBillingReport:
    """One structured result that can be logged by the local worker entrypoint."""

    subscription_id: UUID
    outcome: WorkerOutcome
    reason: str
    invoice_id: UUID | None = None

    def as_log_record(self) -> dict[str, str | None]:
        """Return JSON-safe structured fields without exposing customer data."""
        record = asdict(self)
        record["subscription_id"] = str(self.subscription_id)
        record["invoice_id"] = str(self.invoice_id) if self.invoice_id else None
        return record


def run_recurring_billing(
    db: Session,
    *,
    now: datetime,
    batch_size: int,
    dry_run: bool,
) -> list[RecurringBillingReport]:
    """Process at most one due billing period per active subscription.

    Candidate IDs are deliberately rechecked under a PostgreSQL row lock. This
    keeps concurrent workers from advancing the same subscription and lets a
    second run safely catch up another overdue period if necessary.
    """
    current_time = _require_utc(now, "now")
    if batch_size < 1:
        raise ValueError("batch_size must be at least 1")

    due_conditions = (
        Subscription.status == SubscriptionStatus.ACTIVE,
        Subscription.next_billing_at.is_not(None),
        Subscription.next_billing_at <= current_time,
    )
    candidate_ids = db.scalars(
        select(Subscription.id)
        .where(
            *due_conditions,
            Subscription.billing_anchor_at.is_not(None),
            Subscription.current_period_start.is_not(None),
            Subscription.current_period_end.is_not(None),
        )
        .order_by(Subscription.next_billing_at, Subscription.id)
        .limit(batch_size)
    ).all()
    # Missing required schedule values make a subscription ineligible, but must
    # remain visible to operators rather than disappearing from worker output.
    incomplete_ids = db.scalars(
        select(Subscription.id)
        .where(
            *due_conditions,
            or_(
                Subscription.billing_anchor_at.is_(None),
                Subscription.current_period_start.is_(None),
                Subscription.current_period_end.is_(None),
            ),
        )
        .order_by(Subscription.next_billing_at, Subscription.id)
        .limit(batch_size)
    ).all()
    # The candidate query opens an implicit transaction in SQLAlchemy. Release it
    # before each independently locked processing transaction. The worker owns its
    # session, so this is a read-only transaction boundary rather than a caller
    # transaction to preserve.
    if not dry_run:
        db.commit()
    reports: list[RecurringBillingReport] = []
    for subscription_id in [*candidate_ids, *incomplete_ids]:
        reports.append(
            process_due_subscription(
                db,
                subscription_id=subscription_id,
                now=current_time,
                dry_run=dry_run,
            )
        )
    return reports


def process_due_subscription(
    db: Session,
    *,
    subscription_id: UUID,
    now: datetime,
    dry_run: bool,
) -> RecurringBillingReport:
    """Invoice and advance one subscription period, or safely report why not."""
    if dry_run:
        try:
            subscription = db.scalar(
                select(Subscription)
                .options(selectinload(Subscription.items))
                .where(Subscription.id == subscription_id)
            )
        except SQLAlchemyError:
            db.rollback()
            return RecurringBillingReport(subscription_id, "failed", "subscription_load_failed")
        if subscription is None:
            return RecurringBillingReport(subscription_id, "skipped", "no_longer_due")
        try:
            _validate_due_subscription(subscription, now)
        except ValueError as exc:
            return RecurringBillingReport(subscription.id, "skipped", str(exc))
        return RecurringBillingReport(subscription.id, "dry_run", "eligible")

    try:
        with db.begin():
            subscription = db.scalar(
                select(Subscription)
                .options(selectinload(Subscription.items))
                .where(Subscription.id == subscription_id)
                .with_for_update(skip_locked=True)
            )
            if subscription is None:
                return RecurringBillingReport(subscription_id, "skipped", "locked_or_no_longer_due")
            try:
                _current_start, current_end, anchor = _validate_due_subscription(subscription, now)
            except ValueError as exc:
                return RecurringBillingReport(subscription.id, "skipped", str(exc))
            invoice_result = generate_subscription_period_invoice(db, subscription, commit=False)
            next_period = calculate_subscription_billing_period(
                current_end,
                subscription.billing_frequency,
                anchor_at=anchor,
            )
            subscription.current_period_start = current_end
            subscription.current_period_end = next_period.end_at
            subscription.next_billing_at = next_period.end_at
    except (InvoiceGenerationValidationError, InvoiceGenerationConflict) as exc:
        db.rollback()
        return RecurringBillingReport(subscription_id, "failed", _safe_reason(exc))
    except (InvoiceGenerationDatabaseError, SQLAlchemyError, ValueError):
        db.rollback()
        return RecurringBillingReport(subscription_id, "failed", "billing_transaction_failed")

    return RecurringBillingReport(
        subscription_id,
        "processed",
        "invoice_created" if invoice_result.created else "invoice_already_exists",
        invoice_result.invoice.id,
    )


def _validate_due_subscription(
    subscription: Subscription,
    now: datetime,
) -> tuple[datetime, datetime, datetime]:
    """Validate persisted scheduling data; never repair it in the worker."""
    if subscription.status != SubscriptionStatus.ACTIVE:
        raise ValueError("not_active")
    if subscription.billing_anchor_at is None:
        raise ValueError("missing_billing_anchor")
    if subscription.current_period_start is None or subscription.current_period_end is None:
        raise ValueError("missing_billing_period")
    if subscription.next_billing_at is None:
        raise ValueError("missing_next_billing_at")

    anchor = _require_utc(subscription.billing_anchor_at, "billing_anchor_at")
    current_start = _require_utc(subscription.current_period_start, "current_period_start")
    current_end = _require_utc(subscription.current_period_end, "current_period_end")
    next_billing_at = _require_utc(subscription.next_billing_at, "next_billing_at")
    if current_start >= current_end:
        raise ValueError("invalid_billing_period")
    if next_billing_at != current_end:
        raise ValueError("next_billing_at_does_not_match_period_end")
    if next_billing_at > now:
        raise ValueError("not_yet_due")
    try:
        expected = calculate_subscription_billing_period(
            current_start,
            subscription.billing_frequency,
            anchor_at=anchor,
        )
    except ValueError as exc:
        raise ValueError("invalid_billing_cadence") from exc
    if expected.end_at != current_end:
        raise ValueError("billing_period_conflicts_with_anchor")
    return current_start, current_end, anchor


def _require_utc(value: datetime, field_name: str) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"{field_name}_is_not_timezone_aware")
    return value.astimezone(timezone.utc)


def _safe_reason(exc: Exception) -> str:
    """Use stable operational categories without logging SQL or customer details."""
    if isinstance(exc, InvoiceGenerationValidationError):
        return "invoice_validation_failed"
    return "invoice_conflict"
