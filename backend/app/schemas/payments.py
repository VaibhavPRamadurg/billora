"""Request and response schemas for manual payment recording."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models import PaymentStatus


class PaymentCreate(BaseModel):
    """An immutable manual payment event with an external/operator reference."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    provider: str = Field(min_length=1, max_length=50)
    provider_reference: str = Field(min_length=1, max_length=255)
    currency: str = Field(pattern=r"^[A-Za-z]{3}$")
    amount: Decimal = Field(gt=0, max_digits=18, decimal_places=2)
    status: PaymentStatus

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        return value.upper()

    @field_validator("status")
    @classmethod
    def reject_unsupported_manual_state(cls, value: PaymentStatus) -> PaymentStatus:
        if value is PaymentStatus.REFUNDED:
            raise ValueError("refunded payments are not supported by the manual workflow")
        return value


class PaymentResponse(BaseModel):
    """Safe payment record accompanied by its current invoice balance."""

    id: UUID
    invoice_id: UUID
    customer_id: UUID
    status: PaymentStatus
    provider: str
    provider_reference: str | None
    currency: str
    amount: Decimal
    applied_amount: Decimal
    paid_at: datetime | None
    created_at: datetime
    updated_at: datetime
    outstanding_balance: Decimal


class PaymentPage(BaseModel):
    items: list[PaymentResponse]
    offset: int
    limit: int
