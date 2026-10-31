#!/usr/bin/env python3
"""Create the first Billora administrator from a trusted operator terminal.

This command intentionally has no HTTP equivalent. It reads the password from the
terminal, uses the application's configured database session, and requires an
explicit confirmation before it can write anything.
"""

from __future__ import annotations

import argparse
import sys
from getpass import getpass
from pathlib import Path
from typing import Protocol

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

# Allow ``python scripts/bootstrap_admin.py`` from the backend directory while
# retaining normal package imports when this module is tested or imported.
if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.security import hash_password
from app.db.session import get_session_factory
from app.models import User, UserRole
from app.schemas.auth import RegisterRequest


class AdminBootstrapError(Exception):
    """Base exception for safe, operator-facing bootstrap failures."""


class AdminBootstrapValidationError(AdminBootstrapError):
    """Raised when the supplied email or password violates registration policy."""


class AdminAlreadyExistsError(AdminBootstrapError):
    """Raised when the requested email is already registered."""


class AdminBootstrapDatabaseError(AdminBootstrapError):
    """Raised when the database cannot safely create the administrator."""


class AdminSession(Protocol):
    """Minimal session interface required by :func:`create_admin`."""

    def scalar(self, statement: object) -> User | None: ...

    def add(self, instance: User) -> None: ...

    def commit(self) -> None: ...

    def rollback(self) -> None: ...


def _validated_credentials(email: str, password: str) -> RegisterRequest:
    """Apply the exact registration validation and normalization rules."""
    try:
        return RegisterRequest(email=email, password=password)
    except ValidationError as exc:
        raise AdminBootstrapValidationError(
            "Email or password does not meet the registration requirements."
        ) from exc


def create_admin(session: AdminSession, *, email: str, password: str) -> User:
    """Create a new admin account, never promoting an existing account.

    The caller owns the session lifetime. This function commits only after input,
    duplicate, and password-hashing checks have completed.
    """
    credentials = _validated_credentials(email, password)

    try:
        existing_user = session.scalar(select(User).where(User.email == credentials.email))
    except SQLAlchemyError as exc:
        session.rollback()
        raise AdminBootstrapDatabaseError("Unable to check the administrator account.") from exc

    if existing_user is not None:
        raise AdminAlreadyExistsError("An account with this email already exists; no role was changed.")

    user = User(
        email=credentials.email,
        hashed_password=hash_password(credentials.password),
        role=UserRole.ADMIN,
    )
    session.add(user)

    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        # A concurrent registration can win after the explicit duplicate check.
        raise AdminAlreadyExistsError(
            "An account with this email already exists; no role was changed."
        ) from exc
    except SQLAlchemyError as exc:
        session.rollback()
        raise AdminBootstrapDatabaseError("Unable to create the administrator account.") from exc

    return user


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Create Billora's initial administrator account.")
    parser.add_argument("--email", help="Administrator email address; prompted when omitted.")
    parser.add_argument(
        "--confirm",
        action="store_true",
        help="Confirm that this command may create a new administrator account.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    """Run the interactive operator command and return a shell exit status."""
    args = _parser().parse_args(argv)
    if not args.confirm:
        print("Refusing to write: rerun with --confirm.", file=sys.stderr)
        return 2

    email = args.email if args.email is not None else input("Administrator email: ")
    password = getpass("Administrator password: ")
    password_confirmation = getpass("Confirm administrator password: ")
    if password != password_confirmation:
        print("Passwords do not match; no account was created.", file=sys.stderr)
        return 2

    try:
        session = get_session_factory()()
    except (SQLAlchemyError, RuntimeError):
        print("Unable to open the database session.", file=sys.stderr)
        return 1

    try:
        user = create_admin(session, email=email, password=password)
    except AdminBootstrapError as exc:
        print(str(exc), file=sys.stderr)
        return 1
    finally:
        session.close()

    print(f"Administrator account created for {user.email}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
