"""Plan API tests using temporary SQLite tables, never Supabase."""

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.core.security import create_access_token, hash_password
from app.db.session import get_db
from app.main import app
from app.models import (
    BillingFrequency,
    Plan,
    PlanProduct,
    Product,
    ProductVariant,
    Subscription,
    SubscriptionItem,
    SubscriptionStatus,
    User,
    UserRole,
)


PLAN_TABLES = (
    User.__table__,
    Product.__table__,
    ProductVariant.__table__,
    Plan.__table__,
    PlanProduct.__table__,
    Subscription.__table__,
    SubscriptionItem.__table__,
)


class PlanHarness:
    def __init__(self, session: Session, user: User, client: TestClient) -> None:
        self.session = session
        self.user = user
        self.client = client

    @property
    def headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {create_access_token(self.user.id)}"}

    def set_role(self, role: UserRole) -> None:
        self.user.role = role
        self.session.commit()

    def create_plan(self, name: str = "Starter", **extra):
        return self.client.post(
            "/api/v1/plans",
            headers=self.headers,
            json={
                "name": name,
                "billing_frequency": "monthly",
                "currency": "usd",
                "price": "10.00",
                **extra,
            },
        )

    def create_product(self, name: str = "Included product", **extra) -> Product:
        product = Product(name=name, **extra)
        self.session.add(product)
        self.session.commit()
        self.session.refresh(product)
        return product


@pytest.fixture(autouse=True)
def jwt_settings(monkeypatch):
    monkeypatch.setattr(settings, "jwt_secret_key", "plan-test-secret-with-at-least-32-bytes")
    monkeypatch.setattr(settings, "jwt_algorithm", "HS256")
    monkeypatch.setattr(settings, "access_token_expire_minutes", 30)


@pytest.fixture
def plans() -> PlanHarness:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    for table in PLAN_TABLES:
        table.create(engine)
    session = Session(engine)
    user = User(
        id=uuid4(),
        email="plan-admin@example.com",
        hashed_password=hash_password("secure-password"),
        role=UserRole.ADMIN,
        is_active=True,
    )
    session.add(user)
    session.commit()

    def override_get_db():
        yield session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as client:
        yield PlanHarness(session, user, client)
    app.dependency_overrides.clear()
    session.close()
    for table in reversed(PLAN_TABLES):
        table.drop(engine)
    engine.dispose()


def test_admin_can_create_list_retrieve_update_and_delete_plans(plans) -> None:
    created = plans.create_plan("Premium", description="Full access", trial_days=14)
    assert created.status_code == 201
    plan = created.json()
    assert plan["currency"] == "USD"
    assert plan["price"] == "10.00"

    listing = plans.client.get("/api/v1/plans?search=rem&billing_frequency=monthly", headers=plans.headers)
    assert listing.status_code == 200
    assert listing.json()["items"][0]["id"] == plan["id"]
    assert plans.client.get(f"/api/v1/plans/{plan['id']}", headers=plans.headers).status_code == 200

    updated = plans.client.patch(
        f"/api/v1/plans/{plan['id']}",
        headers=plans.headers,
        json={"price": "12.50", "is_active": False},
    )
    assert updated.status_code == 200
    assert updated.json()["price"] == "12.50"
    assert updated.json()["is_active"] is False
    assert plans.client.delete(f"/api/v1/plans/{plan['id']}", headers=plans.headers).status_code == 204


def test_plan_validation_missing_and_duplicate_errors(plans) -> None:
    assert plans.create_plan("", price="10.00").status_code == 422
    assert plans.create_plan("Negative", price="-1.00").status_code == 422
    assert plans.create_plan("Bad frequency", billing_frequency="weekly").status_code == 422
    assert plans.client.get("/api/v1/plans?billing_frequency=weekly", headers=plans.headers).status_code == 422
    assert plans.create_plan("Unique").status_code == 201
    assert plans.create_plan("Unique").status_code == 409
    assert plans.client.get(f"/api/v1/plans/{uuid4()}", headers=plans.headers).status_code == 404


def test_referenced_plan_cannot_be_deleted(plans) -> None:
    plan_id = UUID(plans.create_plan("Referenced").json()["id"])
    now = datetime.now(timezone.utc)
    plans.session.add(
        Subscription(
            customer_id=plans.user.id,
            plan_id=plan_id,
            status=SubscriptionStatus.ACTIVE,
            billing_frequency=BillingFrequency.MONTHLY,
            currency="USD",
            started_at=now,
            current_period_start=now,
            current_period_end=now + timedelta(days=30),
        )
    )
    plans.session.commit()

    response = plans.client.delete(f"/api/v1/plans/{plan_id}", headers=plans.headers)
    assert response.status_code == 409


def test_plan_product_associations_validate_ownership_and_constraints(plans) -> None:
    plan_id = plans.create_plan("Bundle").json()["id"]
    product = plans.create_product("Bundle product", is_active=True)
    other_product = plans.create_product("Other product", is_active=True)
    variant = ProductVariant(product_id=product.id, name="Annual", sku="BUNDLE-ANNUAL", is_active=True)
    plans.session.add(variant)
    plans.session.commit()

    incorrect_variant = plans.client.post(
        f"/api/v1/plans/{plan_id}/products",
        headers=plans.headers,
        json={"product_id": str(other_product.id), "product_variant_id": str(variant.id)},
    )
    assert incorrect_variant.status_code == 422

    created = plans.client.post(
        f"/api/v1/plans/{plan_id}/products",
        headers=plans.headers,
        json={
            "product_id": str(product.id),
            "product_variant_id": str(variant.id),
            "quantity": "2.000",
            "unit_price": "8.50",
            "position": 0,
        },
    )
    assert created.status_code == 201
    association = created.json()
    assert association["unit_price"] == "8.50"

    duplicate = plans.client.post(
        f"/api/v1/plans/{plan_id}/products",
        headers=plans.headers,
        json={"product_id": str(product.id), "product_variant_id": str(variant.id), "position": 1},
    )
    assert duplicate.status_code == 409
    assert plans.client.post(
        f"/api/v1/plans/{plan_id}/products",
        headers=plans.headers,
        json={"product_id": str(product.id), "quantity": "0"},
    ).status_code == 422

    updated = plans.client.patch(
        f"/api/v1/plans/{plan_id}/products/{association['id']}",
        headers=plans.headers,
        json={"quantity": "3.000", "position": 2},
    )
    assert updated.status_code == 200
    assert updated.json()["quantity"] == "3.000"
    assert plans.client.delete(
        f"/api/v1/plans/{plan_id}/products/{association['id']}", headers=plans.headers
    ).status_code == 204


def test_customer_visibility_and_manager_permissions(plans) -> None:
    active_id = plans.create_plan("Active").json()["id"]
    inactive_id = plans.create_plan("Inactive", is_active=False).json()["id"]
    plans.set_role(UserRole.CUSTOMER)

    listing = plans.client.get("/api/v1/plans?is_active=false", headers=plans.headers)
    assert listing.status_code == 200
    assert [item["id"] for item in listing.json()["items"]] == [active_id]
    assert plans.client.get(f"/api/v1/plans/{inactive_id}", headers=plans.headers).status_code == 404
    assert plans.create_plan("Forbidden").status_code == 403

    plans.set_role(UserRole.STAFF)
    staff_plan = plans.create_plan("Staff plan")
    assert staff_plan.status_code == 201
    assert plans.client.delete(f"/api/v1/plans/{staff_plan.json()['id']}", headers=plans.headers).status_code == 403


def test_customer_plan_association_listing_hides_inactive_catalog_records(plans) -> None:
    plan_id = plans.create_plan("Visible bundle").json()["id"]
    active_product = plans.create_product("Visible product", is_active=True)
    inactive_product = plans.create_product("Hidden product", is_active=False)
    for position, product in enumerate((active_product, inactive_product)):
        response = plans.client.post(
            f"/api/v1/plans/{plan_id}/products",
            headers=plans.headers,
            json={"product_id": str(product.id), "position": position},
        )
        assert response.status_code == 201

    plans.set_role(UserRole.CUSTOMER)
    listing = plans.client.get(f"/api/v1/plans/{plan_id}/products", headers=plans.headers)
    assert listing.status_code == 200
    assert [item["product_id"] for item in listing.json()["items"]] == [str(active_product.id)]
