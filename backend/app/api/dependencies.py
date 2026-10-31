"""Reusable authentication and role authorization dependencies."""

from collections.abc import Callable
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.exceptions import InvalidTokenError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models import User, UserRole


bearer_scheme = HTTPBearer(scheme_name="BearerAuth", auto_error=False)
_CREDENTIALS_EXCEPTION = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Resolve an active user from a valid Bearer access token."""
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise _CREDENTIALS_EXCEPTION

    try:
        claims = decode_access_token(credentials.credentials)
        subject = claims.get("sub")
        user_id = UUID(str(subject))
    except (InvalidTokenError, TypeError, ValueError):
        raise _CREDENTIALS_EXCEPTION from None

    user = db.scalar(select(User).where(User.id == user_id))
    if user is None or not user.is_active:
        raise _CREDENTIALS_EXCEPTION
    return user


def require_roles(*allowed_roles: UserRole) -> Callable[..., User]:
    """Return a dependency that requires one of the supplied application roles."""
    allowed = frozenset(allowed_roles)

    def role_dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return current_user

    return role_dependency
