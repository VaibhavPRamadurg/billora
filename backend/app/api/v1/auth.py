"""Public authentication endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models import User, UserRole
from app.schemas.auth import AccessTokenResponse, LoginRequest, RegisterRequest, UserResponse


router = APIRouter(prefix="/auth", tags=["auth"])


_INVALID_CREDENTIALS = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Incorrect email or password",
    headers={"WWW-Authenticate": "Bearer"},
)


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(payload: RegisterRequest, db: Session = Depends(get_db)) -> User:
    """Create a customer account from a public registration request."""
    existing_user = db.scalar(select(User).where(User.email == payload.email))
    if existing_user is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=UserRole.CUSTOMER,
    )
    db.add(user)

    try:
        db.commit()
    except IntegrityError:
        # Handles the race between the duplicate pre-check and the unique index.
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered") from None

    db.refresh(user)
    return user


@router.post("/login", response_model=AccessTokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> AccessTokenResponse:
    """Verify credentials and issue a signed JWT access token."""
    user = db.scalar(select(User).where(User.email == payload.email))
    if user is None or not user.is_active or not verify_password(payload.password, user.hashed_password):
        raise _INVALID_CREDENTIALS

    return AccessTokenResponse(access_token=create_access_token(user.id))


@router.get("/me", response_model=UserResponse)
def current_user_profile(current_user: User = Depends(get_current_user)) -> User:
    """Return the authenticated user's safe profile."""
    return current_user
