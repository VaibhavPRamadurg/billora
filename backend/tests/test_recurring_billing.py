"""Recurring billing worker tests using temporary SQLite tables only."""

from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.dialects import postgresql
from sqlalchemy.dialects.postgresql import ExcludeConstraint
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.models import (
    BillingFrequency,
    DiscountRule,
    Invoice,
    InvoiceItem,
    Plan,
    Product,
    Subscription,
    SubscriptionItem,
    SubscriptionStatus,
    TaxRule,
    User,
    UserRole,
)
from app.services.billing.invoices import generate_initial_invoice
from app.services.billing.recurring import process_due_subscription, run_recurring_billing


WORKER_TABLES = (
    User.__table__,
    Product.__table__,
    Plan.__table__,
    Subscription.__table__,
    SubscriptionItem.__table__,
    TaxRule.__table__,
    DiscountRule.__table__,
    Invoice.__table__,
    InvoiceItem.__table__,
)


@pytest.fixture
def worker_session() -> Session:
    exclusion = next(
        constraint for constraint in Invoice.__table__.constraints if isinstance(constraint, ExcludeConstraint)
    )
    Invoice.__table__.constraints.remove(exclusion)
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    try:
        for table in WORKER_TABLES:
            table.create(engine)
        session = Session(engine, expire_on_commit=False)
        customer = User(
            id=uuid4(), email="worker-customer@example.com", hashed_password="hash",
            role=UserRole.CUSTOMER, is_active=True,
        )
        product = Product(id=uuid4(), name="Worker product", is_active=True)
        plan = Plan(
            id=uuid4(), name="Worker plan", billing_frequency=BillingFrequency.MONTHLY,
            currency="INR", price=Decimal("100.00"), trial_days=0, is_active=True,
        )
        session.add_all([customer, product, plan])
        session.commit()
        session.info["customer"] = customer
        session.info["product"] = product
        session.info["plan"] = plan
        yield session
        session.close()
        for table in reversed(WORKER_TABLES):
            table.drop(engine)
        engine.dispose()
    finally:
        Invoice.__table__.constraints.add(exclusion)


def _subscription(
    session: Session,
    *,
    frequency: BillingFrequency = BillingFrequency.MONTHLY,
    start: datetime = datetime(2026, 1, 31, tzinfo=timezone.utc),
    end: datetime = datetime(2026, 2, 28, tzinfo=timezone.utc),
    anchor: datetime | None = datetime(2026, 1, 31, tzinfo=timezone.utc),
    next_billing_at: datetime | None = datetime(2026, 2, 28, tzinfo=timezone.utc),
    status: SubscriptionStatus = SubscriptionStatus.ACTIVE,
) -> Subscription:
    customer = session.info["customer"]
    product = session.info["product"]
    plan = session.info["plan"]
    subscription = Subscription(
        id=uuid4(), customer_id=customer.id, plan_id=plan.id, status=status,
        billing_frequency=frequency, currency="INR", billing_anchor_at=anchor,
        current_period_start=start, current_period_end=end, next_billing_at=next_billing_at,
    )
    subscription.items = [
        SubscriptionItem(id=uuid4(), product_id=product.id, quantity=Decimal("1.000"), unit_price=Decimal("100.00"))
    ]
    session.add(subscription)
    session.commit()
    return subscription


def test_worker_generates_unbilled_initial_period_then_advances_with_anchor(worker_session: Session) -> None:
    subscription = _subscription(worker_session)

    reports = run_recurring_billing(
        worker_session, now=datetime(2026, 3, 1, tzinfo=timezone.utc), batch_size=10, dry_run=False
    )

    assert [(report.outcome, report.reason) for report in reports] == [("processed", "invoice_created")]
    invoice = worker_session.scalars(select(Invoice)).one()
    assert invoice.period_start == datetime(2026, 1, 31, tzinfo=timezone.utc)
    assert invoice.period_end == datetime(2026, 2, 28, tzinfo=timezone.utc)
    assert subscription.billing_anchor_at == datetime(2026, 1, 31, tzinfo=timezone.utc)
    assert subscription.current_period_start == datetime(2026, 2, 28, tzinfo=timezone.utc)
    assert subscription.current_period_end == datetime(2026, 3, 31, tzinfo=timezone.utc)
    assert subscription.next_billing_at == datetime(2026, 3, 31, tzinfo=timezone.utc)


def test_worker_reuses_manually_generated_initial_invoice_without_duplicate(worker_session: Session) -> None:
    subscription = _subscription(worker_session)
    existing = generate_initial_invoice(worker_session, subscription.id).invoice

    reports = run_recurring_billing(
        worker_session, now=datetime(2026, 3, 1, tzinfo=timezone.utc), batch_size=10, dry_run=False
    )

    assert reports[0].reason == "invoice_already_exists"
    assert reports[0].invoice_id == existing.id
    assert worker_session.scalars(select(Invoice)).all() == [existing]
    assert subscription.current_period_start == datetime(2026, 2, 28, tzinfo=timezone.utc)


@pytest.mark.parametrize(
    ("frequency", "start", "end", "expected_end"),
    [
        (BillingFrequency.MONTHLY, datetime(2026, 2, 28, tzinfo=timezone.utc), datetime(2026, 3, 31, tzinfo=timezone.utc), datetime(2026, 4, 30, tzinfo=timezone.utc)),
        (BillingFrequency.QUARTERLY, datetime(2026, 1, 31, tzinfo=timezone.utc), datetime(2026, 4, 30, tzinfo=timezone.utc), datetime(2026, 7, 31, tzinfo=timezone.utc)),
        (BillingFrequency.YEARLY, datetime(2027, 2, 28, tzinfo=timezone.utc), datetime(2028, 2, 29, tzinfo=timezone.utc), datetime(2029, 2, 28, tzinfo=timezone.utc)),
    ],
)
def test_worker_preserves_month_end_and_leap_year_anchor(
    worker_session: Session, frequency: BillingFrequency, start: datetime, end: datetime, expected_end: datetime
) -> None:
    anchor = datetime(2024, 2, 29, tzinfo=timezone.utc) if frequency is BillingFrequency.YEARLY else datetime(2026, 1, 31, tzinfo=timezone.utc)
    subscription = _subscription(worker_session, frequency=frequency, start=start, end=end, anchor=anchor, next_billing_at=end)

    report = process_due_subscription(worker_session, subscription_id=subscription.id, now=end, dry_run=False)

    assert report.outcome == "processed"
    assert subscription.current_period_start == end
    assert subscription.current_period_end == expected_end
    assert subscription.billing_anchor_at == anchor


def test_worker_excludes_not_due_and_reports_missing_or_malformed_schedules(worker_session: Session) -> None:
    not_due = _subscription(worker_session, next_billing_at=datetime(2026, 4, 30, tzinfo=timezone.utc))
    missing_anchor = _subscription(worker_session, anchor=None)
    malformed = _subscription(worker_session, next_billing_at=datetime(2026, 2, 27, tzinfo=timezone.utc))
    _subscription(worker_session, status=SubscriptionStatus.PAUSED, next_billing_at=datetime(2026, 2, 1, tzinfo=timezone.utc))

    reports = run_recurring_billing(
        worker_session, now=datetime(2026, 3, 1, tzinfo=timezone.utc), batch_size=10, dry_run=False
    )

    report_by_id = {report.subscription_id: report for report in reports}
    assert not_due.id not in report_by_id
    assert report_by_id[missing_anchor.id].reason == "missing_billing_anchor"
    assert report_by_id[malformed.id].reason == "next_billing_at_does_not_match_period_end"
    assert worker_session.scalars(select(Invoice)).all() == []


def test_dry_run_writes_nothing_and_repeated_execution_does_not_duplicate(worker_session: Session) -> None:
    subscription = _subscription(worker_session)

    dry_reports = run_recurring_billing(
        worker_session, now=datetime(2026, 3, 1, tzinfo=timezone.utc), batch_size=10, dry_run=True
    )
    assert dry_reports[0].outcome == "dry_run"
    assert worker_session.scalars(select(Invoice)).all() == []
    assert subscription.current_period_start == datetime(2026, 1, 31, tzinfo=timezone.utc)

    first = run_recurring_billing(
        worker_session, now=datetime(2026, 3, 1, tzinfo=timezone.utc), batch_size=10, dry_run=False
    )
    second = run_recurring_billing(
        worker_session, now=datetime(2026, 3, 1, tzinfo=timezone.utc), batch_size=10, dry_run=False
    )
    assert first[0].outcome == "processed"
    assert second == []
    assert len(worker_session.scalars(select(Invoice)).all()) == 1


def test_worker_rolls_back_invoice_and_schedule_when_invoice_write_fails(worker_session: Session, monkeypatch) -> None:
    subscription = _subscription(worker_session)

    def reject_flush() -> None:
        raise OperationalError("flush", {}, Exception("database unavailable"))

    monkeypatch.setattr(worker_session, "flush", reject_flush)
    report = process_due_subscription(
        worker_session, subscription_id=subscription.id, now=datetime(2026, 3, 1, tzinfo=timezone.utc), dry_run=False
    )

    assert report.outcome == "failed"
    monkeypatch.undo()
    assert worker_session.scalars(select(Invoice)).all() == []
    assert subscription.current_period_start.replace(tzinfo=timezone.utc) == datetime(2026, 1, 31, tzinfo=timezone.utc)
    assert subscription.current_period_end.replace(tzinfo=timezone.utc) == datetime(2026, 2, 28, tzinfo=timezone.utc)


def test_worker_uses_postgresql_skip_locked_row_lock() -> None:
    statement = select(Subscription).where(Subscription.id == uuid4()).with_for_update(skip_locked=True)
    assert "FOR UPDATE SKIP LOCKED" in str(statement.compile(dialect=postgresql.dialect()))
