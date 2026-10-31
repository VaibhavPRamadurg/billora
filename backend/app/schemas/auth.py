"""Request and response schemas for public authentication flows."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models import UserRole


class RegisterRequest(BaseModel):
    """Public registration input. Public clients cannot choose an account role."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    email: EmailStr = Field(max_length=320)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        """Store one consistent, case-insensitive representation of each email."""
        return str(value).casefold()


class UserResponse(BaseModel):
    """Public user representation that intentionally excludes password material."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    role: UserRole
    is_active: bool
    created_at: datetime
    updated_at: datetime
