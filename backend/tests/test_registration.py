"""Registration tests using an in-memory session substitute, never Supabase."""

from datetime import datetime, timezone
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError

from app.core.security import hash_password, verify_password
from app.db.session import get_db
from app.main import app
from app.models import User


class InMemoryUserSession:
    """Minimal SQLAlchemy-session substitute for route-level behavior tests."""

    def __init__(self) -> None:
        self.users: list[User] = []
        self.pending_user: User | None = None
        self.rolled_back = False

    def scalar(self, statement):
        email = next(iter(statement.compile().params.values()))
        return next((user for user in self.users if user.email == email), None)

    def add(self, user: User) -> None:
        self.pending_user = user

    def commit(self) -> None:
        assert self.pending_user is not None
        user = self.pending_user
        if any(existing.email == user.email for existing in self.users):
            raise IntegrityError("insert", {}, Exception("duplicate email"))
        user.id = uuid4()
        user.is_active = True
        now = datetime.now(timezone.utc)
        user.created_at = now
        user.updated_at = now
        self.users.append(user)
        self.pending_user = None

    def rollback(self) -> None:
        self.rolled_back = True

    def refresh(self, _user: User) -> None:
        return None


@pytest.fixture
def registration_client():
    session = InMemoryUserSession()

    def override_get_db():
        yield session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as client:
        yield client, session
    app.dependency_overrides.clear()


def test_registers_normalized_customer_and_never_returns_hash(registration_client) -> None:
    client, session = registration_client

    response = client.post(
        "/api/v1/auth/register",
        json={"email": "  ALICE@EXAMPLE.COM  ", "password": "secure-password"},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "alice@example.com"
    assert body["role"] == "customer"
    assert body["is_active"] is True
    assert "hashed_password" not in body
    assert "password" not in body
    assert verify_password("secure-password", session.users[0].hashed_password)


def test_rejects_duplicate_normalized_email(registration_client) -> None:
    client, _session = registration_client
    payload = {"email": "customer@example.com", "password": "secure-password"}

    assert client.post("/api/v1/auth/register", json=payload).status_code == 201
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "CUSTOMER@EXAMPLE.COM", "password": "other-password"},
    )

    assert response.status_code == 409
    assert response.json() == {"detail": "Email already registered"}


@pytest.mark.parametrize(
    "payload",
    [
        {"email": "not-an-email", "password": "secure-password"},
        {"email": "customer@example.com", "password": "short"},
        {"email": "customer@example.com"},
    ],
)
def test_rejects_invalid_registration_input(registration_client, payload) -> None:
    client, _session = registration_client

    response = client.post("/api/v1/auth/register", json=payload)

    assert response.status_code == 422


def test_rejects_public_role_escalation_attempt(registration_client) -> None:
    client, _session = registration_client

    response = client.post(
        "/api/v1/auth/register",
        json={"email": "admin@example.com", "password": "secure-password", "role": "admin"},
    )

    assert response.status_code == 422


def test_password_hashing_and_verification() -> None:
    password = "secure-password"
    hashed_password = hash_password(password)

    assert hashed_password != password
    assert verify_password(password, hashed_password)
    assert not verify_password("incorrect-password", hashed_password)


def test_duplicate_integrity_error_is_returned_safely(monkeypatch, registration_client) -> None:
    client, session = registration_client

    def raise_integrity_error() -> None:
        raise IntegrityError("insert", {}, Exception("duplicate email"))

    monkeypatch.setattr(session, "commit", raise_integrity_error)
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "race@example.com", "password": "secure-password"},
    )

    assert response.status_code == 409
    assert response.json() == {"detail": "Email already registered"}
    assert session.rolled_back is True
