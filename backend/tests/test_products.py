"""Product API tests using temporary SQLite tables, never Supabase."""

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
    User,
    UserRole,
)


CATALOG_TABLES = (
    User.__table__,
    Product.__table__,
    ProductVariant.__table__,
    Plan.__table__,
    PlanProduct.__table__,
    Subscription.__table__,
    SubscriptionItem.__table__,
)


class CatalogHarness:
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

    def create_product(self, name: str = "Starter", **extra):
        return self.client.post(
            "/api/v1/products",
            headers=self.headers,
            json={"name": name, **extra},
        )


@pytest.fixture(autouse=True)
def jwt_settings(monkeypatch):
    monkeypatch.setattr(settings, "jwt_secret_key", "catalog-test-secret-with-at-least-32-bytes")
    monkeypatch.setattr(settings, "jwt_algorithm", "HS256")
    monkeypatch.setattr(settings, "access_token_expire_minutes", 30)


@pytest.fixture
def catalog() -> CatalogHarness:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    for table in CATALOG_TABLES:
        table.create(engine)
    session = Session(engine)
    user = User(
        id=uuid4(),
        email="catalog-admin@example.com",
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
        yield CatalogHarness(session, user, client)
    app.dependency_overrides.clear()
    session.close()
    for table in reversed(CATALOG_TABLES):
        table.drop(engine)
    engine.dispose()


def test_admin_can_create_list_retrieve_and_update_products(catalog) -> None:
    created = catalog.create_product("Premium", description="Full access")

    assert created.status_code == 201
    product = created.json()
    assert product["name"] == "Premium"
    assert product["is_active"] is True

    listing = catalog.client.get("/api/v1/products?search=rem", headers=catalog.headers)
    assert listing.status_code == 200
    assert listing.json()["items"][0]["id"] == product["id"]

    retrieved = catalog.client.get(f"/api/v1/products/{product['id']}", headers=catalog.headers)
    assert retrieved.status_code == 200

    updated = catalog.client.patch(
        f"/api/v1/products/{product['id']}",
        headers=catalog.headers,
        json={"name": "Premium Plus", "is_active": False},
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Premium Plus"
    assert updated.json()["is_active"] is False


def test_product_missing_invalid_and_delete_behaviors(catalog) -> None:
    assert catalog.create_product("").status_code == 422
    assert catalog.client.get(f"/api/v1/products/{uuid4()}", headers=catalog.headers).status_code == 404

    product_id = catalog.create_product("Disposable").json()["id"]
    deleted = catalog.client.delete(f"/api/v1/products/{product_id}", headers=catalog.headers)
    assert deleted.status_code == 204
    assert catalog.client.get(f"/api/v1/products/{product_id}", headers=catalog.headers).status_code == 404


def test_product_deletion_is_blocked_by_variants_and_plan_references(catalog) -> None:
    product_id = UUID(catalog.create_product("Referenced").json()["id"])
    created_variant = catalog.client.post(
        f"/api/v1/products/{product_id}/variants",
        headers=catalog.headers,
        json={"name": "Blue", "sku": "REFERENCED-BLUE"},
    )
    assert created_variant.status_code == 201
    assert catalog.client.delete(f"/api/v1/products/{product_id}", headers=catalog.headers).status_code == 409

    variant_id = UUID(created_variant.json()["id"])
    assert catalog.client.delete(f"/api/v1/products/{product_id}/variants/{variant_id}", headers=catalog.headers).status_code == 204
    plan = Plan(
        id=uuid4(),
        name="Reference plan",
        billing_frequency=BillingFrequency.MONTHLY,
        currency="USD",
        price=Decimal("10.00"),
        trial_days=0,
        is_active=True,
    )
    catalog.session.add(plan)
    catalog.session.add(PlanProduct(plan_id=plan.id, product_id=product_id, quantity=Decimal("1"), position=0))
    catalog.session.commit()
    assert catalog.client.delete(f"/api/v1/products/{product_id}", headers=catalog.headers).status_code == 409


def test_variant_crud_duplicate_constraints_and_ownership(catalog) -> None:
    product_id = catalog.create_product("Variant product").json()["id"]
    other_product_id = catalog.create_product("Other product").json()["id"]
    created = catalog.client.post(
        f"/api/v1/products/{product_id}/variants",
        headers=catalog.headers,
        json={"name": "Small", "sku": "SMALL-SKU", "attributes": {"size": "S"}},
    )
    assert created.status_code == 201
    variant = created.json()

    assert catalog.client.post(
        f"/api/v1/products/{product_id}/variants",
        headers=catalog.headers,
        json={"name": "Small", "sku": "SECOND-SKU"},
    ).status_code == 409
    assert catalog.client.post(
        f"/api/v1/products/{other_product_id}/variants",
        headers=catalog.headers,
        json={"name": "Other", "sku": "SMALL-SKU"},
    ).status_code == 409

    listing = catalog.client.get(f"/api/v1/products/{product_id}/variants", headers=catalog.headers)
    assert listing.status_code == 200
    assert listing.json()["items"][0]["id"] == variant["id"]
    assert catalog.client.get(
        f"/api/v1/products/{other_product_id}/variants/{variant['id']}", headers=catalog.headers
    ).status_code == 404

    updated = catalog.client.patch(
        f"/api/v1/products/{product_id}/variants/{variant['id']}",
        headers=catalog.headers,
        json={"name": "Small updated", "is_active": False},
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Small updated"
    assert updated.json()["is_active"] is False
    assert catalog.client.delete(
        f"/api/v1/products/{product_id}/variants/{variant['id']}", headers=catalog.headers
    ).status_code == 204


def test_variant_deletion_is_blocked_when_plan_references_it(catalog) -> None:
    product_id = UUID(catalog.create_product("Plan variant").json()["id"])
    variant_id = UUID(
        catalog.client.post(
            f"/api/v1/products/{product_id}/variants",
            headers=catalog.headers,
            json={"name": "Plan-only", "sku": "PLAN-ONLY"},
        ).json()["id"]
    )
    plan = Plan(
        id=uuid4(),
        name="Variant reference plan",
        billing_frequency=BillingFrequency.MONTHLY,
        currency="USD",
        price=Decimal("10.00"),
        trial_days=0,
        is_active=True,
    )
    catalog.session.add(plan)
    catalog.session.add(
        PlanProduct(
            plan_id=plan.id,
            product_id=product_id,
            product_variant_id=variant_id,
            quantity=Decimal("1"),
            position=0,
        )
    )
    catalog.session.commit()

    response = catalog.client.delete(
        f"/api/v1/products/{product_id}/variants/{variant_id}", headers=catalog.headers
    )
    assert response.status_code == 409


def test_customers_only_see_active_catalog_and_cannot_manage_it(catalog) -> None:
    active_id = catalog.create_product("Active").json()["id"]
    inactive_id = catalog.create_product("Inactive", is_active=False).json()["id"]
    catalog.client.post(
        f"/api/v1/products/{active_id}/variants",
        headers=catalog.headers,
        json={"name": "Active variant", "sku": "ACTIVE-VARIANT"},
    )
    inactive_variant_id = catalog.client.post(
        f"/api/v1/products/{active_id}/variants",
        headers=catalog.headers,
        json={"name": "Inactive variant", "sku": "INACTIVE-VARIANT", "is_active": False},
    ).json()["id"]
    catalog.set_role(UserRole.CUSTOMER)

    listing = catalog.client.get("/api/v1/products?is_active=false", headers=catalog.headers)
    assert listing.status_code == 200
    assert [item["id"] for item in listing.json()["items"]] == [active_id]
    assert catalog.client.get(f"/api/v1/products/{inactive_id}", headers=catalog.headers).status_code == 404
    assert catalog.client.post(
        "/api/v1/products", headers=catalog.headers, json={"name": "Forbidden"}
    ).status_code == 403
    assert catalog.client.get(
        f"/api/v1/products/{active_id}/variants/{inactive_variant_id}", headers=catalog.headers
    ).status_code == 404


def test_staff_can_manage_but_not_delete_products(catalog) -> None:
    catalog.set_role(UserRole.STAFF)
    created = catalog.create_product("Staff product")
    assert created.status_code == 201
    product_id = created.json()["id"]
    assert catalog.client.patch(
        f"/api/v1/products/{product_id}", headers=catalog.headers, json={"description": "updated"}
    ).status_code == 200
    assert catalog.client.delete(f"/api/v1/products/{product_id}", headers=catalog.headers).status_code == 403
