"""Tests for the local-only historical billing-anchor remediation command."""

from datetime import datetime, timezone
from uuid import uuid4

import pytest
from sqlalchemy.exc import OperationalError

from app.models import BillingFrequency, Subscription, SubscriptionStatus
from scripts.remediate_billing_anchor import (
    BillingAnchorDatabaseError,
    BillingAnchorValidationError,
    parse_authoritative_utc_anchor,
    remediate_billing_anchor,
)


class _ScalarResult:
    def __init__(self, values) -> None:
        self.values = values

    def all(self):
        return self.values


class InMemoryAnchorSession:
    def __init__(self, subscription: Subscription, invoices=()) -> None:
        self.subscription = subscription
        self.invoices = list(invoices)
        self.committed = False
        self.rolled_back = False

    def scalar(self, _statement):
        return self.subscription

    def scalars(self, _statement):
        return _ScalarResult(self.invoices)

    def commit(self) -> None:
        self.committed = True

    def rollback(self) -> None:
        self.rolled_back = True
        self.subscription.billing_anchor_at = None

    def refresh(self, _subscription) -> None:
        return None


def subscription(**overrides: object) -> Subscription:
    fields: dict[str, object] = {
        "id": uuid4(),
        "customer_id": uuid4(),
        "plan_id": uuid4(),
        "status": SubscriptionStatus.ACTIVE,
        "billing_frequency": BillingFrequency.MONTHLY,
        "currency": "INR",
        "current_period_start": datetime(2026, 1, 31, tzinfo=timezone.utc),
        "current_period_end": datetime(2026, 2, 28, tzinfo=timezone.utc),
        "billing_anchor_at": None,
    }
    fields.update(overrides)
    return Subscription(**fields)


def test_sets_only_missing_authoritative_anchor_after_cadence_validation() -> None:
    target = subscription()
    session = InMemoryAnchorSession(target)
    original_status = target.status
    original_period = (target.current_period_start, target.current_period_end)

    result = remediate_billing_anchor(
        session,
        subscription_id=target.id,
        billing_anchor_at=datetime(2026, 1, 31, tzinfo=timezone.utc),
    )

    assert result is target
    assert target.billing_anchor_at == datetime(2026, 1, 31, tzinfo=timezone.utc)
    assert target.status is original_status
    assert (target.current_period_start, target.current_period_end) == original_period
    assert session.committed is True


def test_rejects_existing_anchor_and_conflicting_cadence() -> None:
    anchored = subscription(billing_anchor_at=datetime(2026, 1, 31, tzinfo=timezone.utc))
    with pytest.raises(BillingAnchorValidationError, match="already has"):
        remediate_billing_anchor(
            InMemoryAnchorSession(anchored),
            subscription_id=anchored.id,
            billing_anchor_at=datetime(2026, 1, 31, tzinfo=timezone.utc),
        )

    conflicting = subscription(current_period_start=datetime(2026, 2, 28, tzinfo=timezone.utc), current_period_end=datetime(2026, 3, 28, tzinfo=timezone.utc))
    with pytest.raises(BillingAnchorValidationError, match="conflicts"):
        remediate_billing_anchor(
            InMemoryAnchorSession(conflicting),
            subscription_id=conflicting.id,
            billing_anchor_at=datetime(2026, 1, 31, tzinfo=timezone.utc),
        )


def test_rejects_non_active_historical_subscription_and_utc_offsets() -> None:
    target = subscription(status=SubscriptionStatus.CLOSED)
    with pytest.raises(BillingAnchorValidationError, match="active or paused"):
        remediate_billing_anchor(
            InMemoryAnchorSession(target),
            subscription_id=target.id,
            billing_anchor_at=datetime(2026, 1, 31, tzinfo=timezone.utc),
        )
    with pytest.raises(BillingAnchorValidationError, match="UTC"):
        parse_authoritative_utc_anchor("2026-01-31T05:30:00+05:30")


def test_rolls_back_anchor_on_database_failure() -> None:
    target = subscription()
    session = InMemoryAnchorSession(target)

    def reject_commit() -> None:
        raise OperationalError("update", {}, Exception("connection failure"))

    session.commit = reject_commit  # type: ignore[method-assign]
    with pytest.raises(BillingAnchorDatabaseError, match="could not be completed"):
        remediate_billing_anchor(
            session,
            subscription_id=target.id,
            billing_anchor_at=datetime(2026, 1, 31, tzinfo=timezone.utc),
        )

    assert session.rolled_back is True
    assert target.billing_anchor_at is None
