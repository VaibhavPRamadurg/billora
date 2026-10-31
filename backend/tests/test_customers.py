from uuid import uuid4
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from app.core.config import settings
from app.core.security import create_access_token
from app.db.session import get_db
from app.main import app
from app.models import User, UserRole

def test_customer_directory_is_paginated_and_manager_only(monkeypatch):
    monkeypatch.setattr(settings, "jwt_secret_key", "customer-directory-test-secret-at-least-32-bytes")
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    User.__table__.create(engine)
    session = Session(engine)
    admin = User(id=uuid4(), email="admin@example.com", hashed_password="hash", role=UserRole.ADMIN, is_active=True)
    customer = User(id=uuid4(), email="customer@example.com", hashed_password="hash", role=UserRole.CUSTOMER, is_active=True)
    session.add_all([admin, customer]); session.commit()
    def override(): yield session
    app.dependency_overrides[get_db] = override
    with TestClient(app) as client:
        headers = {"Authorization": f"Bearer {create_access_token(admin.id)}"}
        response = client.get("/api/v1/customers?limit=1", headers=headers)
        forbidden = client.get("/api/v1/customers", headers={"Authorization": f"Bearer {create_access_token(customer.id)}"})
    assert response.status_code == 200
    assert response.json()["items"][0]["id"] == str(customer.id)
    assert "hashed_password" not in response.json()["items"][0]
    assert forbidden.status_code == 403
    app.dependency_overrides.clear(); session.close(); User.__table__.drop(engine)
