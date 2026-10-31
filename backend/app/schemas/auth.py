"""Request and response schemas for public authentication flows."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models import UserRole


def normalize_email(value: EmailStr) -> str:
    """Return Billora's consistent case-insensitive email representation."""
    return str(value).casefold()


class EmailPasswordRequest(BaseModel):
    """Shared validated credentials input for registration and login."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    email: EmailStr = Field(max_length=320)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email_address(cls, value: EmailStr) -> str:
        return normalize_email(value)


class RegisterRequest(EmailPasswordRequest):
    """Public registration input. Public clients cannot choose an account role."""


class LoginRequest(EmailPasswordRequest):
    """Credentials used to issue an access token."""


class UserResponse(BaseModel):
    """Public user representation that intentionally excludes password material."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    role: UserRole
    is_active: bool
    created_at: datetime
    updated_at: datetime


class AccessTokenResponse(BaseModel):
    """Bearer access token response returned after a successful login."""

    access_token: str
    token_type: str = "bearer"
