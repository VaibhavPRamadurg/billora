"""Pydantic schemas for subscription plans and plan catalog associations."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models import BillingFrequency


class PlanFields(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=10_000)
    billing_frequency: BillingFrequency
    currency: str = Field(default="INR", pattern=r"^[A-Za-z]{3}$")
    price: Decimal = Field(ge=0, max_digits=18, decimal_places=2)
    trial_days: int = Field(default=0, ge=0)
    is_active: bool = True

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        return value.upper()


class PlanCreate(PlanFields):
    """Plan creation input."""


class PlanUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=10_000)
    billing_frequency: BillingFrequency | None = None
    currency: str | None = Field(default=None, pattern=r"^[A-Za-z]{3}$")
    price: Decimal | None = Field(default=None, ge=0, max_digits=18, decimal_places=2)
    trial_days: int | None = Field(default=None, ge=0)
    is_active: bool | None = None

    @field_validator("currency")
    @classmethod
    def normalize_optional_currency(cls, value: str | None) -> str | None:
        return value.upper() if value is not None else value


class PlanResponse(PlanFields):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime


class PlanPage(BaseModel):
    items: list[PlanResponse]
    offset: int
    limit: int


class PlanProductCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    product_id: UUID
    product_variant_id: UUID | None = None
    quantity: Decimal = Field(default=Decimal("1"), gt=0, max_digits=14, decimal_places=3)
    unit_price: Decimal | None = Field(default=None, ge=0, max_digits=18, decimal_places=2)
    position: int = Field(default=0, ge=0)


class PlanProductUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    product_id: UUID | None = None
    product_variant_id: UUID | None = None
    quantity: Decimal | None = Field(default=None, gt=0, max_digits=14, decimal_places=3)
    unit_price: Decimal | None = Field(default=None, ge=0, max_digits=18, decimal_places=2)
    position: int | None = Field(default=None, ge=0)


class PlanProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    plan_id: UUID
    product_id: UUID
    product_variant_id: UUID | None
    quantity: Decimal
    unit_price: Decimal | None
    position: int


class PlanProductPage(BaseModel):
    items: list[PlanProductResponse]
    offset: int
    limit: int
