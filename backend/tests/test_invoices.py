"""Invoice generation and retrieval tests using temporary SQLite tables only."""

from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.dialects.postgresql import ExcludeConstraint
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.core.security import create_access_token, hash_password
from app.db.session import get_db
from app.main import app
from app.models import (
    BillingFrequency,
    DiscountRedemption,
    DiscountRule,
    DiscountType,
    Invoice,
    InvoiceItem,
    Plan,
    Product,
    ProductVariant,
    Subscription,
    SubscriptionItem,
    SubscriptionStatus,
    TaxRule,
    User,
    UserRole,
)


INVOICE_TABLES = (
    User.__table__,
    Product.__table__,
    ProductVariant.__table__,
    Plan.__table__,
    Subscription.__table__,
    SubscriptionItem.__table__,
    TaxRule.__table__,
    DiscountRule.__table__,
    Invoice.__table__,
    InvoiceItem.__table__,
    DiscountRedemption.__table__,
)


class InvoiceHarness:
    def __init__(self, session: Session, admin: User, customer: User, other_customer: User, subscription: Subscription, client: TestClient) -> None:
        self.session = session
        self.admin = admin
        self.customer = customer
        self.other_customer = other_customer
        self.subscription = subscription
        self.client = client

    def headers(self, user: User | None = None) -> dict[str, str]:
        identity = user or self.admin
        return {"Authorization": f"Bearer {create_access_token(identity.id)}"}

    @property
    def generation_url(self) -> str:
        return f"/api/v1/subscriptions/{self.subscription.id}/invoices/generate"


@pytest.fixture(autouse=True)
def jwt_and_billing_settings(monkeypatch):
    monkeypatch.setattr(settings, "jwt_secret_key", "invoice-test-secret-with-at-least-32-bytes")
    monkeypatch.setattr(settings, "jwt_algorithm", "HS256")
    monkeypatch.setattr(settings, "access_token_expire_minutes", 30)
    monkeypatch.setattr(settings, "billing_country", "IN")


@pytest.fixture
def invoices() -> InvoiceHarness:
    exclusion = next(
        constraint for constraint in Invoice.__table__.constraints if isinstance(constraint, ExcludeConstraint)
    )
    Invoice.__table__.constraints.remove(exclusion)
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    try:
        for table in INVOICE_TABLES:
            table.create(engine)
        session = Session(engine)
        admin = User(id=uuid4(), email="invoice-admin@example.com", hashed_password=hash_password("password"), role=UserRole.ADMIN, is_active=True)
        customer = User(id=uuid4(), email="invoice-customer@example.com", hashed_password=hash_password("password"), role=UserRole.CUSTOMER, is_active=True)
        other_customer = User(id=uuid4(), email="invoice-other@example.com", hashed_password=hash_password("password"), role=UserRole.CUSTOMER, is_active=True)
        product = Product(id=uuid4(), name="Managed support", is_active=True)
        variant = ProductVariant(id=uuid4(), product_id=product.id, name="Priority", is_active=True)
        plan = Plan(id=uuid4(), name="Invoice plan", billing_frequency=BillingFrequency.MONTHLY, currency="INR", price=Decimal("250.00"), trial_days=0, is_active=True)
        subscription = Subscription(
            id=uuid4(),
            customer_id=customer.id,
            plan_id=plan.id,
            status=SubscriptionStatus.ACTIVE,
            billing_frequency=BillingFrequency.MONTHLY,
            currency="INR",
            current_period_start=datetime(2026, 1, 1, tzinfo=timezone.utc),
            current_period_end=datetime(2026, 2, 1, tzinfo=timezone.utc),
            next_billing_at=datetime(2026, 2, 1, tzinfo=timezone.utc),
        )
        subscription.items = [
            SubscriptionItem(
                id=uuid4(),
                product_id=product.id,
                product_variant_id=variant.id,
                quantity=Decimal("2.000"),
                unit_price=Decimal("100.00"),
            )
        ]
        session.add_all([admin, customer, other_customer, product, variant, plan, subscription])
        session.commit()

        def override_get_db():
            yield session

        app.dependency_overrides[get_db] = override_get_db
        with TestClient(app) as client:
            yield InvoiceHarness(session, admin, customer, other_customer, subscription, client)
        app.dependency_overrides.clear()
        session.close()
        for table in reversed(INVOICE_TABLES):
            table.drop(engine)
        engine.dispose()
    finally:
        Invoice.__table__.constraints.add(exclusion)


def test_manager_generates_invoice_with_item_snapshots_and_totals(invoices: InvoiceHarness) -> None:
    response = invoices.client.post(invoices.generation_url, headers=invoices.headers())

    assert response.status_code == 201
    body = response.json()
    assert body["currency"] == "INR"
    assert body["subtotal"] == "200.00"
    assert body["discount_total"] == "0.00"
    assert body["tax_total"] == "0.00"
    assert body["total"] == "200.00"
    assert body["period_start"].startswith("2026-01-01T00:00:00")
    assert body["items"] == [
        {
            **body["items"][0],
            "description": "Managed support — Priority",
            "quantity": "2.000",
            "unit_price": "100.00",
            "discount_amount": "0.00",
            "tax_amount": "0.00",
            "line_total": "200.00",
        }
    ]
    assert invoices.subscription.status is SubscriptionStatus.ACTIVE
    assert invoices.subscription.next_billing_at.replace(tzinfo=timezone.utc) == datetime(
        2026, 2, 1, tzinfo=timezone.utc
    )


def test_generation_applies_explicit_discount_then_configured_country_tax(invoices: InvoiceHarness) -> None:
    invoices.session.add_all(
        [
            DiscountRule(
                id=uuid4(),
                code="WELCOME",
                name="Welcome",
                discount_type=DiscountType.PERCENTAGE,
                value=Decimal("10"),
                currency="INR",
                is_active=True,
            ),
            TaxRule(
                id=uuid4(),
                name="GST",
                country_code="IN",
                rate=Decimal("18"),
                is_inclusive=False,
                is_active=True,
            ),
        ]
    )
    invoices.session.commit()

    response = invoices.client.post(
        invoices.generation_url,
        headers=invoices.headers(),
        json={"discount_code": "WELCOME"},
    )

    assert response.status_code == 201
    assert response.json()["discount_total"] == "20.00"
    assert response.json()["tax_total"] == "32.40"
    assert response.json()["total"] == "212.40"
    assert response.json()["items"][0]["discount_amount"] == "20.00"
    assert response.json()["items"][0]["tax_amount"] == "32.40"
    assert invoices.session.scalars(select(DiscountRedemption)).one().discount_amount == Decimal("20.00")


def test_generation_is_idempotent_and_rejects_overlapping_periods(invoices: InvoiceHarness) -> None:
    first = invoices.client.post(invoices.generation_url, headers=invoices.headers())
    second = invoices.client.post(invoices.generation_url, headers=invoices.headers())

    assert first.status_code == 201
    assert second.status_code == 200
    assert second.json()["id"] == first.json()["id"]
    assert len(invoices.session.scalars(select(Invoice)).all()) == 1

    invoices.subscription.current_period_start = datetime(2026, 1, 15, tzinfo=timezone.utc)
    invoices.subscription.current_period_end = datetime(2026, 2, 15, tzinfo=timezone.utc)
    invoices.session.commit()
    overlap = invoices.client.post(invoices.generation_url, headers=invoices.headers())

    assert overlap.status_code == 409


def test_generation_requires_active_subscription_and_rolls_back_invalid_discount(invoices: InvoiceHarness) -> None:
    invoices.subscription.status = SubscriptionStatus.PAUSED
    invoices.session.commit()
    assert invoices.client.post(invoices.generation_url, headers=invoices.headers()).status_code == 422
    assert invoices.session.scalars(select(Invoice)).all() == []

    invoices.subscription.status = SubscriptionStatus.ACTIVE
    invoices.session.commit()
    invalid = invoices.client.post(
        invoices.generation_url,
        headers=invoices.headers(),
        json={"discount_code": "MISSING"},
    )
    assert invalid.status_code == 422
    assert invoices.session.scalars(select(Invoice)).all() == []


def test_invoice_visibility_and_generation_permissions(invoices: InvoiceHarness) -> None:
    created = invoices.client.post(invoices.generation_url, headers=invoices.headers())
    invoice_id = created.json()["id"]

    assert invoices.client.post(invoices.generation_url, headers=invoices.headers(invoices.customer)).status_code == 403
    assert invoices.client.get("/api/v1/invoices", headers=invoices.headers(invoices.customer)).json()["items"][0]["id"] == invoice_id
    assert invoices.client.get(f"/api/v1/invoices/{invoice_id}", headers=invoices.headers(invoices.customer)).status_code == 200
    assert invoices.client.get(f"/api/v1/invoices/{invoice_id}", headers=invoices.headers(invoices.other_customer)).status_code == 404


def test_generation_rolls_back_when_the_database_rejects_the_write(invoices: InvoiceHarness, monkeypatch) -> None:
    def reject_commit() -> None:
        raise IntegrityError("insert", {}, Exception("constraint violation"))

    monkeypatch.setattr(invoices.session, "commit", reject_commit)
    response = invoices.client.post(invoices.generation_url, headers=invoices.headers())

    assert response.status_code == 409
    assert invoices.session.scalars(select(Invoice)).all() == []
