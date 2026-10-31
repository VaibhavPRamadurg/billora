"""Password hashing helpers for server-side authentication flows."""

from pwdlib import PasswordHash


password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:
    """Return an Argon2 password hash; never persist the plaintext password."""
    return password_hash.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    """Verify a candidate password against a stored Argon2 hash."""
    return password_hash.verify(password, hashed_password)
