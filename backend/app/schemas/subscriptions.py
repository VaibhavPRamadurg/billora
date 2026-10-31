"""Pydantic schemas for customer-specific subscription lifecycle APIs."""

from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models import BillingFrequency, SubscriptionStatus


def _utc_datetime(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("timestamp must include a UTC offset")
    return value.astimezone(timezone.utc)


class SubscriptionItemInput(BaseModel):
    plan_product_id: UUID
    quantity: Decimal | None = Field(default=None, gt=0, max_digits=14, decimal_places=3)
    unit_price: Decimal | None = Field(default=None, ge=0, max_digits=18, decimal_places=2)


class SubscriptionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    customer_id: UUID
    plan_id: UUID
    items: list[SubscriptionItemInput] = Field(min_length=1)


class SubscriptionDraftUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    customer_id: UUID | None = None
    plan_id: UUID | None = None
    items: list[SubscriptionItemInput] | None = Field(default=None, min_length=1)


class ActivationRequest(BaseModel):
    current_period_start: datetime
    current_period_end: datetime

    @field_validator("current_period_start", "current_period_end")
    @classmethod
    def require_timezone_aware_utc(cls, value: datetime) -> datetime:
        return _utc_datetime(value)

    @model_validator(mode="after")
    def require_ordered_period(self) -> "ActivationRequest":
        if self.current_period_start >= self.current_period_end:
            raise ValueError("current_period_start must be earlier than current_period_end")
        return self


class SubscriptionItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    plan_product_id: UUID | None
    product_id: UUID
    product_variant_id: UUID | None
    quantity: Decimal
    unit_price: Decimal


class SubscriptionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    customer_id: UUID
    plan_id: UUID
    status: SubscriptionStatus
    billing_frequency: BillingFrequency
    currency: str
    started_at: datetime
    billing_anchor_at: datetime | None
    current_period_start: datetime | None
    current_period_end: datetime | None
    next_billing_at: datetime | None
    paused_at: datetime | None
    resume_at: datetime | None
    cancel_at: datetime | None
    cancel_at_period_end: bool
    auto_renew: bool
    created_at: datetime
    updated_at: datetime
    items: list[SubscriptionItemResponse]


class SubscriptionPage(BaseModel):
    items: list[SubscriptionResponse]
    offset: int
    limit: int
