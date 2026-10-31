"""JWT authentication and authorization tests without a database connection."""

from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

import jwt
import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.api.dependencies import require_roles
from app.core.config import settings
from app.core.security import create_access_token, hash_password
from app.db.session import get_db
from app.main import app
from app.models import User, UserRole


class AuthenticationSession:
    """Minimal scalar-query session substitute for authentication routes."""

    def __init__(self, users: list[User]) -> None:
        self.users = users

    def scalar(self, statement):
        value = next(iter(statement.compile().params.values()))
        if isinstance(value, UUID):
            return next((user for user in self.users if user.id == value), None)
        return next((user for user in self.users if user.email == value), None)


def make_user(role: UserRole = UserRole.CUSTOMER, *, is_active: bool = True) -> User:
    now = datetime.now(timezone.utc)
    return User(
        id=uuid4(),
        email=f"{role.value}-{uuid4()}@example.com",
        hashed_password=hash_password("secure-password"),
        role=role,
        is_active=is_active,
        created_at=now,
        updated_at=now,
    )


@pytest.fixture(autouse=True)
def jwt_settings(monkeypatch):
    monkeypatch.setattr(settings, "jwt_secret_key", "test-jwt-secret-with-at-least-32-bytes")
    monkeypatch.setattr(settings, "jwt_algorithm", "HS256")
    monkeypatch.setattr(settings, "access_token_expire_minutes", 30)


@pytest.fixture
def auth_client():
    user = make_user()
    session = AuthenticationSession([user])

    def override_get_db():
        yield session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as client:
        yield client, user, session
    app.dependency_overrides.clear()


def test_login_returns_signed_access_token_for_normalized_email(auth_client) -> None:
    client, user, _session = auth_client

    response = client.post(
        "/api/v1/auth/login",
        json={"email": user.email.upper(), "password": "secure-password"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    claims = jwt.decode(body["access_token"], settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    assert claims["sub"] == str(user.id)
    assert "iat" in claims
    assert "exp" in claims


@pytest.mark.parametrize(
    "email,password",
    [
        ("unknown@example.com", "secure-password"),
        ("unknown@example.com", "wrong-password"),
        ("placeholder@example.com", "wrong-password"),
    ],
)
def test_login_rejects_unknown_or_incorrect_credentials(auth_client, email, password) -> None:
    client, user, _session = auth_client
    if email == "placeholder@example.com":
        email = user.email

    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})

    assert response.status_code == 401
    assert response.json() == {"detail": "Incorrect email or password"}


def test_login_rejects_inactive_user() -> None:
    user = make_user(is_active=False)
    session = AuthenticationSession([user])

    def override_get_db():
        yield session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/auth/login",
            json={"email": user.email, "password": "secure-password"},
        )
    app.dependency_overrides.clear()

    assert response.status_code == 401
    assert response.json() == {"detail": "Incorrect email or password"}


def test_me_returns_safe_profile_for_valid_jwt(auth_client) -> None:
    client, user, _session = auth_client
    token = create_access_token(user.id)

    response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json()["id"] == str(user.id)
    assert response.json()["role"] == "customer"
    assert "hashed_password" not in response.json()


@pytest.mark.parametrize("token", ["not-a-jwt", "invalid.header.payload"])
def test_me_rejects_invalid_tokens(auth_client, token) -> None:
    client, _user, _session = auth_client

    response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401


def test_me_rejects_expired_and_tampered_tokens(auth_client) -> None:
    client, user, _session = auth_client
    now = datetime.now(timezone.utc)
    expired_token = jwt.encode(
        {"sub": str(user.id), "iat": now - timedelta(minutes=2), "exp": now - timedelta(minutes=1)},
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )
    valid_token = create_access_token(user.id)
    tampered_token = valid_token[:-1] + ("a" if valid_token[-1] != "a" else "b")

    for token in (expired_token, tampered_token):
        response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 401


def test_me_rejects_missing_header_inactive_and_nonexistent_users(auth_client) -> None:
    client, user, session = auth_client

    assert client.get("/api/v1/auth/me").status_code == 401

    user.is_active = False
    inactive_response = client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {create_access_token(user.id)}"}
    )
    assert inactive_response.status_code == 401

    user.is_active = True
    session.users.clear()
    missing_response = client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {create_access_token(user.id)}"}
    )
    assert missing_response.status_code == 401


def test_role_dependencies_allow_the_matching_role_and_forbid_others() -> None:
    role_app = FastAPI()

    @role_app.get("/admin")
    def admin_only(current_user: User = Depends(require_roles(UserRole.ADMIN))):
        return {"role": current_user.role.value}

    @role_app.get("/staff-or-admin")
    def staff_or_admin(current_user: User = Depends(require_roles(UserRole.STAFF, UserRole.ADMIN))):
        return {"role": current_user.role.value}

    @role_app.get("/customer")
    def customer_only(current_user: User = Depends(require_roles(UserRole.CUSTOMER))):
        return {"role": current_user.role.value}

    users = [make_user(UserRole.ADMIN), make_user(UserRole.STAFF), make_user(UserRole.CUSTOMER)]
    session = AuthenticationSession(users)

    def override_get_db():
        yield session

    role_app.dependency_overrides[get_db] = override_get_db
    with TestClient(role_app) as client:
        admin_token = create_access_token(users[0].id)
        staff_token = create_access_token(users[1].id)
        customer_token = create_access_token(users[2].id)

        assert client.get("/admin", headers={"Authorization": f"Bearer {admin_token}"}).status_code == 200
        assert client.get("/staff-or-admin", headers={"Authorization": f"Bearer {staff_token}"}).status_code == 200
        assert client.get("/customer", headers={"Authorization": f"Bearer {customer_token}"}).status_code == 200
        assert client.get("/admin", headers={"Authorization": f"Bearer {customer_token}"}).status_code == 403


def test_openapi_includes_bearer_security_for_protected_profile() -> None:
    schema = app.openapi()

    assert schema["components"]["securitySchemes"]["BearerAuth"]["scheme"] == "bearer"
    assert schema["paths"]["/api/v1/auth/me"]["get"]["security"] == [{"BearerAuth": []}]
