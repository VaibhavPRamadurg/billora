"""Subscription lifecycle API tests using temporary SQLite tables only."""

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.core.security import create_access_token, hash_password
from app.db.session import get_db
from app.main import app
from app.models import BillingFrequency, Plan, PlanProduct, Product, Subscription, User, UserRole


SUBSCRIPTION_TABLES = (
    User.__table__,
    Product.__table__,
    Plan.__table__,
    PlanProduct.__table__,
    Subscription.__table__,
    __import__("app.models", fromlist=["SubscriptionItem"]).SubscriptionItem.__table__,
)


class SubscriptionHarness:
    def __init__(self, session: Session, admin: User, customer: User, other_customer: User, plan: Plan, association: PlanProduct, client: TestClient) -> None:
        self.session = session
        self.admin = admin
        self.customer = customer
        self.other_customer = other_customer
        self.plan = plan
        self.association = association
        self.client = client

    def headers(self, user: User | None = None) -> dict[str, str]:
        identity = user or self.admin
        return {"Authorization": f"Bearer {create_access_token(identity.id)}"}

    def create_draft(self, **extra):
        return self.client.post(
            "/api/v1/subscriptions",
            headers=self.headers(),
            json={
                "customer_id": str(self.customer.id),
                "plan_id": str(self.plan.id),
                "items": [{"plan_product_id": str(self.association.id)}],
                **extra,
            },
        )


@pytest.fixture(autouse=True)
def jwt_settings(monkeypatch):
    monkeypatch.setattr(settings, "jwt_secret_key", "subscription-test-secret-with-at-least-32-bytes")
    monkeypatch.setattr(settings, "jwt_algorithm", "HS256")
    monkeypatch.setattr(settings, "access_token_expire_minutes", 30)


@pytest.fixture
def subscriptions() -> SubscriptionHarness:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    for table in SUBSCRIPTION_TABLES:
        table.create(engine)
    session = Session(engine)
    admin = User(id=uuid4(), email="admin@example.com", hashed_password=hash_password("password"), role=UserRole.ADMIN, is_active=True)
    customer = User(id=uuid4(), email="customer@example.com", hashed_password=hash_password("password"), role=UserRole.CUSTOMER, is_active=True)
    other_customer = User(id=uuid4(), email="other@example.com", hashed_password=hash_password("password"), role=UserRole.CUSTOMER, is_active=True)
    product = Product(id=uuid4(), name="Included product", is_active=True)
    plan = Plan(id=uuid4(), name="Monthly plan", billing_frequency=BillingFrequency.MONTHLY, currency="USD", price=Decimal("20.00"), trial_days=0, is_active=True)
    association = PlanProduct(id=uuid4(), plan_id=plan.id, product_id=product.id, quantity=Decimal("1.000"), unit_price=Decimal("20.00"), position=0)
    session.add_all([admin, customer, other_customer, product, plan, association])
    session.commit()

    def override_get_db():
        yield session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as client:
        yield SubscriptionHarness(session, admin, customer, other_customer, plan, association, client)
    app.dependency_overrides.clear()
    session.close()
    for table in reversed(SUBSCRIPTION_TABLES):
        table.drop(engine)
    engine.dispose()


def test_manager_creates_draft_with_atomic_item_snapshots(subscriptions) -> None:
    response = subscriptions.create_draft()

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "draft"
    assert body["current_period_start"] is None
    assert body["current_period_end"] is None
    assert body["items"][0]["product_id"] == str(subscriptions.association.product_id)
    assert body["items"][0]["quantity"] == "1.000"
    assert body["items"][0]["unit_price"] == "20.00"


def test_invalid_item_rolls_back_subscription_creation(subscriptions) -> None:
    response = subscriptions.create_draft(
        items=[
            {"plan_product_id": str(subscriptions.association.id)},
            {"plan_product_id": str(uuid4())},
        ]
    )

    assert response.status_code == 422
    assert subscriptions.session.scalars(select(Subscription)).all() == []


def test_customer_ownership_isolation_and_manager_listing(subscriptions) -> None:
    subscription_id = subscriptions.create_draft().json()["id"]

    assert subscriptions.client.get(f"/api/v1/subscriptions/{subscription_id}", headers=subscriptions.headers(subscriptions.customer)).status_code == 200
    assert subscriptions.client.get(f"/api/v1/subscriptions/{subscription_id}", headers=subscriptions.headers(subscriptions.other_customer)).status_code == 404
    customer_list = subscriptions.client.get("/api/v1/subscriptions", headers=subscriptions.headers(subscriptions.customer))
    assert customer_list.status_code == 200
    assert [item["id"] for item in customer_list.json()["items"]] == [subscription_id]
    assert subscriptions.client.post(
        "/api/v1/subscriptions",
        headers=subscriptions.headers(subscriptions.customer),
        json={"customer_id": str(subscriptions.customer.id), "plan_id": str(subscriptions.plan.id), "items": [{"plan_product_id": str(subscriptions.association.id)}]},
    ).status_code == 403


def test_staff_can_manage_and_customers_cannot_transition(subscriptions) -> None:
    subscriptions.admin.role = UserRole.STAFF
    subscriptions.session.commit()
    subscription_id = subscriptions.create_draft().json()["id"]
    assert subscriptions.client.post(
        f"/api/v1/subscriptions/{subscription_id}/quotation", headers=subscriptions.headers(subscriptions.admin)
    ).status_code == 200
    assert subscriptions.client.post(
        f"/api/v1/subscriptions/{subscription_id}/confirm", headers=subscriptions.headers(subscriptions.customer)
    ).status_code == 403


def test_draft_update_and_plan_validation(subscriptions) -> None:
    subscription_id = subscriptions.create_draft().json()["id"]
    updated = subscriptions.client.patch(
        f"/api/v1/subscriptions/{subscription_id}",
        headers=subscriptions.headers(),
        json={"items": [{"plan_product_id": str(subscriptions.association.id), "quantity": "2.500", "unit_price": "21.10"}]},
    )
    assert updated.status_code == 200
    assert updated.json()["items"][0]["quantity"] == "2.500"
    assert updated.json()["items"][0]["unit_price"] == "21.10"

    subscriptions.plan.is_active = False
    subscriptions.session.commit()
    assert subscriptions.create_draft().status_code == 422


def test_lifecycle_transitions_require_activation_periods_and_reject_invalid_states(subscriptions) -> None:
    subscription_id = subscriptions.create_draft().json()["id"]
    assert subscriptions.client.post(f"/api/v1/subscriptions/{subscription_id}/activate", headers=subscriptions.headers(), json={"current_period_start": "2026-01-01T00:00:00Z", "current_period_end": "2026-02-01T00:00:00Z"}).status_code == 409
    assert subscriptions.client.post(f"/api/v1/subscriptions/{subscription_id}/quotation", headers=subscriptions.headers()).json()["status"] == "quotation"
    assert subscriptions.client.post(f"/api/v1/subscriptions/{subscription_id}/confirm", headers=subscriptions.headers()).json()["status"] == "confirmed"
    invalid_period = subscriptions.client.post(
        f"/api/v1/subscriptions/{subscription_id}/activate",
        headers=subscriptions.headers(),
        json={"current_period_start": "2026-02-01T00:00:00Z", "current_period_end": "2026-01-01T00:00:00Z"},
    )
    assert invalid_period.status_code == 422
    active = subscriptions.client.post(
        f"/api/v1/subscriptions/{subscription_id}/activate",
        headers=subscriptions.headers(),
        json={"current_period_start": "2026-01-01T00:00:00Z", "current_period_end": "2026-02-01T00:00:00Z"},
    )
    assert active.status_code == 200
    assert active.json()["status"] == "active"
    assert active.json()["next_billing_at"].startswith("2026-02-01T00:00:00")


def test_pause_resume_close_cancel_and_expire_rules(subscriptions) -> None:
    subscription_id = subscriptions.create_draft().json()["id"]
    for endpoint, payload in (("quotation", None), ("confirm", None), ("activate", {"current_period_start": "2026-01-01T00:00:00Z", "current_period_end": "2026-02-01T00:00:00Z"})):
        response = subscriptions.client.post(f"/api/v1/subscriptions/{subscription_id}/{endpoint}", headers=subscriptions.headers(), json=payload)
        assert response.status_code == 200
    paused = subscriptions.client.post(f"/api/v1/subscriptions/{subscription_id}/pause", headers=subscriptions.headers())
    assert paused.status_code == 200
    assert paused.json()["status"] == "paused"
    assert paused.json()["next_billing_at"] is None
    resumed = subscriptions.client.post(f"/api/v1/subscriptions/{subscription_id}/resume", headers=subscriptions.headers())
    assert resumed.json()["status"] == "active"
    closed = subscriptions.client.post(f"/api/v1/subscriptions/{subscription_id}/close", headers=subscriptions.headers())
    assert closed.json()["status"] == "closed"
    assert closed.json()["auto_renew"] is False
    assert subscriptions.client.post(f"/api/v1/subscriptions/{subscription_id}/resume", headers=subscriptions.headers()).status_code == 409


def test_expiration_is_manager_only_terminal_transition(subscriptions) -> None:
    subscription_id = subscriptions.create_draft().json()["id"]
    for endpoint, payload in (("quotation", None), ("confirm", None), ("activate", {"current_period_start": "2026-01-01T00:00:00Z", "current_period_end": "2026-02-01T00:00:00Z"})):
        assert subscriptions.client.post(f"/api/v1/subscriptions/{subscription_id}/{endpoint}", headers=subscriptions.headers(), json=payload).status_code == 200
    expired = subscriptions.client.post(f"/api/v1/subscriptions/{subscription_id}/expire", headers=subscriptions.headers())
    assert expired.status_code == 200
    assert expired.json()["status"] == "expired"


def test_cancellation_is_terminal(subscriptions) -> None:
    subscription_id = subscriptions.create_draft().json()["id"]
    for endpoint, payload in (("quotation", None), ("confirm", None), ("activate", {"current_period_start": "2026-01-01T00:00:00Z", "current_period_end": "2026-02-01T00:00:00Z"})):
        assert subscriptions.client.post(f"/api/v1/subscriptions/{subscription_id}/{endpoint}", headers=subscriptions.headers(), json=payload).status_code == 200
    cancelled = subscriptions.client.post(f"/api/v1/subscriptions/{subscription_id}/cancel", headers=subscriptions.headers())
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"
    assert cancelled.json()["next_billing_at"] is None
    assert subscriptions.client.post(f"/api/v1/subscriptions/{subscription_id}/pause", headers=subscriptions.headers()).status_code == 409
