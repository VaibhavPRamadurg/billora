"""Password hashing and JWT helpers for server-side authentication flows."""

from datetime import datetime, timedelta, timezone
from uuid import UUID

import jwt
from jwt.exceptions import InvalidTokenError

from pwdlib import PasswordHash

from app.core.config import settings


password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:
    """Return an Argon2 password hash; never persist the plaintext password."""
    return password_hash.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    """Verify a candidate password against a stored Argon2 hash."""
    return password_hash.verify(password, hashed_password)


def create_access_token(subject: UUID | str) -> str:
    """Create a signed access token with subject, issued-at, and expiry claims."""
    if not settings.jwt_secret_key:
        raise RuntimeError("JWT_SECRET_KEY must be configured")

    issued_at = datetime.now(timezone.utc)
    expires_at = issued_at + timedelta(minutes=settings.access_token_expire_minutes)
    return jwt.encode(
        {"sub": str(subject), "iat": issued_at, "exp": expires_at},
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def decode_access_token(token: str) -> dict[str, object]:
    """Validate a signed access token and return its claims.

    ``InvalidTokenError`` is deliberately propagated so HTTP dependencies can return a
    single safe authentication error for expired, malformed, or tampered tokens.
    """
    if not settings.jwt_secret_key:
        raise InvalidTokenError("JWT secret is not configured")
    return jwt.decode(
        token,
        settings.jwt_secret_key,
        algorithms=[settings.jwt_algorithm],
    )
