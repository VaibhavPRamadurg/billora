"""Analytics API tests using isolated SQLite data and SQL aggregations."""

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, delete
from sqlalchemy.dialects.postgresql import ExcludeConstraint
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.core.security import create_access_token
from app.db.session import get_db
from app.main import app
from app.models import (
    BillingFrequency,
    Invoice,
    InvoiceStatus,
    Payment,
    PaymentStatus,
    Plan,
    Product,
    Subscription,
    SubscriptionItem,
    SubscriptionStatus,
    User,
    UserRole,
)


ANALYTICS_TABLES = (
    User.__table__, Product.__table__, Plan.__table__, Subscription.__table__,
    SubscriptionItem.__table__, Invoice.__table__, Payment.__table__,
)


class AnalyticsHarness:
    def __init__(self, session: Session, admin: User, staff: User, customer: User, client: TestClient) -> None:
        self.session = session
        self.admin = admin
        self.staff = staff
        self.customer = customer
        self.client = client

    def headers(self, user: User | None = None) -> dict[str, str]:
        identity = user or self.admin
        return {"Authorization": f"Bearer {create_access_token(identity.id)}"}


@pytest.fixture(autouse=True)
def jwt_settings(monkeypatch):
    monkeypatch.setattr(settings, "jwt_secret_key", "analytics-test-secret-with-at-least-32-bytes")
    monkeypatch.setattr(settings, "jwt_algorithm", "HS256")
    monkeypatch.setattr(settings, "access_token_expire_minutes", 30)


@pytest.fixture
def analytics() -> AnalyticsHarness:
    exclusion = next(constraint for constraint in Invoice.__table__.constraints if isinstance(constraint, ExcludeConstraint))
    Invoice.__table__.constraints.remove(exclusion)
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    try:
        for table in ANALYTICS_TABLES:
            table.create(engine)
        session = Session(engine)
        now = datetime.now(timezone.utc)
        admin = User(id=uuid4(), email="analytics-admin@example.com", hashed_password="hash", role=UserRole.ADMIN, is_active=True)
        staff = User(id=uuid4(), email="analytics-staff@example.com", hashed_password="hash", role=UserRole.STAFF, is_active=True)
        customer = User(id=uuid4(), email="analytics-customer@example.com", hashed_password="hash", role=UserRole.CUSTOMER, is_active=True)
        other_customer = User(id=uuid4(), email="analytics-other@example.com", hashed_password="hash", role=UserRole.CUSTOMER, is_active=True)
        product = Product(id=uuid4(), name="Analytics product", is_active=True)
        plan = Plan(id=uuid4(), name="Analytics plan", billing_frequency=BillingFrequency.MONTHLY, currency="INR", price=Decimal("100.00"), trial_days=0, is_active=True)
        active = _subscription(customer, plan, product, SubscriptionStatus.ACTIVE, BillingFrequency.MONTHLY)
        paused = _subscription(customer, plan, product, SubscriptionStatus.PAUSED, BillingFrequency.MONTHLY)
        draft = _subscription(other_customer, plan, product, SubscriptionStatus.DRAFT, BillingFrequency.YEARLY)
        invoices = [
            _invoice("INV-ANALYTICS-PAID", active, customer, "INR", InvoiceStatus.PAID, "100.00", "100.00", now - timedelta(days=60), now - timedelta(days=45)),
            _invoice("INV-ANALYTICS-PARTIAL", paused, customer, "INR", InvoiceStatus.PARTIALLY_PAID, "200.00", "50.00", now - timedelta(days=20), now - timedelta(days=1)),
            _invoice("INV-ANALYTICS-USD", active, customer, "USD", InvoiceStatus.DRAFT, "40.00", "0.00", now - timedelta(days=10), now + timedelta(days=5)),
            _invoice("INV-ANALYTICS-CANCELLED", active, customer, "INR", InvoiceStatus.CANCELLED, "100.00", "0.00", now - timedelta(days=5), now + timedelta(days=1)),
        ]
        payments = [
            _payment(invoices[0], customer, "paid-inr", PaymentStatus.SUCCEEDED, "100.00", "100.00", now - timedelta(days=50)),
            _payment(invoices[1], customer, "partial-inr", PaymentStatus.SUCCEEDED, "50.00", "50.00", now - timedelta(days=8)),
            _payment(invoices[1], customer, "pending-inr", PaymentStatus.PENDING, "25.00", "0.00", None),
            _payment(invoices[1], customer, "failed-inr", PaymentStatus.FAILED, "25.00", "0.00", None),
        ]
        session.add_all([admin, staff, customer, other_customer, product, plan, active, paused, draft, *invoices, *payments])
        session.commit()

        def override_get_db():
            yield session

        app.dependency_overrides[get_db] = override_get_db
        with TestClient(app) as client:
            yield AnalyticsHarness(session, admin, staff, customer, client)
        app.dependency_overrides.clear()
        session.close()
        for table in reversed(ANALYTICS_TABLES):
            table.drop(engine)
        engine.dispose()
    finally:
        Invoice.__table__.constraints.add(exclusion)


def _subscription(customer: User, plan: Plan, product: Product, state: SubscriptionStatus, frequency: BillingFrequency) -> Subscription:
    period_start = datetime(2026, 1, 1, tzinfo=timezone.utc) if state is not SubscriptionStatus.DRAFT else None
    period_end = datetime(2026, 2, 1, tzinfo=timezone.utc) if state is not SubscriptionStatus.DRAFT else None
    subscription = Subscription(
        id=uuid4(), customer_id=customer.id, plan_id=plan.id, status=state, billing_frequency=frequency,
        currency="INR", billing_anchor_at=period_start, current_period_start=period_start,
        current_period_end=period_end, next_billing_at=period_end,
    )
    subscription.items = [SubscriptionItem(id=uuid4(), product_id=product.id, quantity=Decimal("1.000"), unit_price=Decimal("100.00"))]
    return subscription


def _invoice(number: str, subscription: Subscription, customer: User, currency: str, state: InvoiceStatus, total: str, paid: str, created_at: datetime, due_at: datetime) -> Invoice:
    return Invoice(
        id=uuid4(), invoice_number=number, subscription_id=subscription.id, customer_id=customer.id,
        status=state, currency=currency, period_start=created_at, period_end=created_at + timedelta(days=1),
        subtotal=Decimal(total), tax_total=Decimal("0.00"), discount_total=Decimal("0.00"), total=Decimal(total),
        amount_paid=Decimal(paid), due_at=due_at, created_at=created_at, updated_at=created_at,
    )


def _payment(invoice: Invoice, customer: User, reference: str, state: PaymentStatus, amount: str, applied: str, paid_at: datetime | None) -> Payment:
    return Payment(
        id=uuid4(), invoice_id=invoice.id, customer_id=customer.id, status=state, provider="manual",
        provider_reference=reference, currency=invoice.currency, amount=Decimal(amount), applied_amount=Decimal(applied), paid_at=paid_at,
    )


def test_analytics_overview_keeps_currency_totals_separate_and_uses_settled_cash(analytics: AnalyticsHarness) -> None:
    response = analytics.client.get("/api/v1/analytics/overview", headers=analytics.headers())

    assert response.status_code == 200
    body = response.json()
    assert body["total_customers"] == 2
    assert body["total_subscriptions"] == 3
    assert body["active_subscriptions"] == 1
    assert body["paused_subscriptions"] == 1
    assert body["total_invoiced"] == [{"currency": "INR", "amount": "300.00"}, {"currency": "USD", "amount": "40.00"}]
    assert body["total_collected"] == [{"currency": "INR", "amount": "150.00"}]
    assert body["outstanding_balance"] == [{"currency": "INR", "amount": "150.00"}, {"currency": "USD", "amount": "40.00"}]
    assert body["overdue_invoice_count"] == 1


def test_analytics_revenue_date_filter_and_subscription_breakdown(analytics: AnalyticsHarness) -> None:
    now = datetime.now(timezone.utc).date()
    response = analytics.client.get(
        f"/api/v1/analytics/revenue?start_date={now - timedelta(days=25)}&end_date={now}",
        headers=analytics.headers(analytics.staff),
    )
    subscriptions = analytics.client.get("/api/v1/analytics/subscriptions", headers=analytics.headers())
    invalid_range = analytics.client.get(
        "/api/v1/analytics/revenue?start_date=2026-02-01&end_date=2026-01-01", headers=analytics.headers()
    )

    assert response.status_code == 200
    assert {entry["currency"]: entry["amount"] for entry in response.json()["invoiced"]} == {"INR": "200.00", "USD": "40.00"}
    assert response.json()["collected"] == [{"month": response.json()["collected"][0]["month"], "currency": "INR", "amount": "50.00"}]
    assert subscriptions.status_code == 200
    assert {entry["status"]: entry["count"] for entry in subscriptions.json()["by_status"]} == {"active": 1, "draft": 1, "paused": 1}
    assert {entry["billing_frequency"]: entry["count"] for entry in subscriptions.json()["by_billing_frequency"]} == {"monthly": 2, "yearly": 1}
    assert subscriptions.json()["active_count"] == 1
    assert subscriptions.json()["inactive_count"] == 2
    assert invalid_range.status_code == 422


def test_invoice_analytics_and_manager_only_access(analytics: AnalyticsHarness) -> None:
    invoices = analytics.client.get("/api/v1/analytics/invoices?recent_limit=2", headers=analytics.headers())
    customer = analytics.client.get("/api/v1/analytics/overview", headers=analytics.headers(analytics.customer))

    assert invoices.status_code == 200
    body = invoices.json()
    balances = {entry["currency"]: entry for entry in body["balances"]}
    assert balances["INR"] == {"currency": "INR", "paid": "100.00", "partially_paid": "150.00", "unpaid": "0.00", "overdue": "150.00"}
    assert balances["USD"] == {"currency": "USD", "paid": "0.00", "partially_paid": "0.00", "unpaid": "40.00", "overdue": "0.00"}
    assert {entry["status"]: entry["count"] for entry in body["by_status"]} == {"cancelled": 1, "draft": 1, "paid": 1, "partially_paid": 1}
    assert len(body["recent_invoices"]) == 2
    assert customer.status_code == 403


def test_analytics_empty_financial_data_returns_empty_series(analytics: AnalyticsHarness) -> None:
    analytics.session.execute(delete(Payment))
    analytics.session.execute(delete(Invoice))
    analytics.session.commit()

    overview = analytics.client.get("/api/v1/analytics/overview", headers=analytics.headers())
    revenue = analytics.client.get("/api/v1/analytics/revenue", headers=analytics.headers())
    invoices = analytics.client.get("/api/v1/analytics/invoices", headers=analytics.headers())

    assert overview.status_code == 200
    assert overview.json()["total_invoiced"] == []
    assert overview.json()["total_collected"] == []
    assert overview.json()["outstanding_balance"] == []
    assert revenue.json()["invoiced"] == []
    assert revenue.json()["collected"] == []
    assert invoices.json()["balances"] == []
    assert invoices.json()["recent_invoices"] == []
