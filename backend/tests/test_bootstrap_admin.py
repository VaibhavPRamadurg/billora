"""Tests for the local-only initial-administrator bootstrap command."""

from datetime import datetime, timezone
from uuid import uuid4

import pytest
from sqlalchemy.exc import IntegrityError, OperationalError

from app.core.security import verify_password
from app.models import User, UserRole
from scripts.bootstrap_admin import (
    AdminAlreadyExistsError,
    AdminBootstrapDatabaseError,
    AdminBootstrapValidationError,
    create_admin,
    main,
)


class InMemoryAdminSession:
    """Small session substitute that verifies command behavior without Supabase."""

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
        self.pending_user.id = uuid4()
        self.pending_user.created_at = datetime.now(timezone.utc)
        self.pending_user.updated_at = self.pending_user.created_at
        self.users.append(self.pending_user)
        self.pending_user = None

    def rollback(self) -> None:
        self.rolled_back = True


def test_creates_normalized_admin_with_argon2_hash() -> None:
    session = InMemoryAdminSession()

    user = create_admin(
        session,
        email="  FIRST.ADMIN@EXAMPLE.COM  ",
        password="secure-password",
    )

    assert user.email == "first.admin@example.com"
    assert user.role is UserRole.ADMIN
    assert user.hashed_password != "secure-password"
    assert verify_password("secure-password", user.hashed_password)
    assert session.users == [user]


def test_rejects_existing_account_without_promoting_it() -> None:
    session = InMemoryAdminSession()
    existing = User(
        email="customer@example.com",
        hashed_password="existing-hash",
        role=UserRole.CUSTOMER,
    )
    session.users.append(existing)

    with pytest.raises(AdminAlreadyExistsError, match="no role was changed"):
        create_admin(session, email="CUSTOMER@example.com", password="secure-password")

    assert existing.role is UserRole.CUSTOMER
    assert session.pending_user is None


@pytest.mark.parametrize(
    ("email", "password"),
    [("not-an-email", "secure-password"), ("admin@example.com", "short")],
)
def test_rejects_invalid_registration_credentials(email: str, password: str) -> None:
    session = InMemoryAdminSession()

    with pytest.raises(AdminBootstrapValidationError):
        create_admin(session, email=email, password=password)

    assert session.pending_user is None
    assert session.users == []


def test_rolls_back_and_reports_duplicate_race() -> None:
    session = InMemoryAdminSession()

    def raise_integrity_error() -> None:
        raise IntegrityError("insert", {}, Exception("duplicate email"))

    session.commit = raise_integrity_error  # type: ignore[method-assign]
    with pytest.raises(AdminAlreadyExistsError):
        create_admin(session, email="admin@example.com", password="secure-password")

    assert session.rolled_back is True


def test_rolls_back_and_hides_database_failure() -> None:
    session = InMemoryAdminSession()

    def raise_operational_error() -> None:
        raise OperationalError("insert", {}, Exception("connection failure"))

    session.commit = raise_operational_error  # type: ignore[method-assign]
    with pytest.raises(AdminBootstrapDatabaseError, match="Unable to create"):
        create_admin(session, email="admin@example.com", password="secure-password")

    assert session.rolled_back is True


def test_cli_requires_confirmation_before_prompting_or_opening_a_session(capsys) -> None:
    assert main(["--email", "admin@example.com"]) == 2
    assert "rerun with --confirm" in capsys.readouterr().err
