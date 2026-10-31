"""Request and response schemas for invoice generation and retrieval."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models import InvoiceStatus


class InvoiceGenerateRequest(BaseModel):
    """Optional explicit discount selection for an initial invoice."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    discount_code: str | None = Field(default=None, min_length=1, max_length=64)


class InvoiceItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    product_id: UUID | None
    product_variant_id: UUID | None
    description: str
    quantity: Decimal
    unit_price: Decimal
    tax_rate: Decimal
    tax_amount: Decimal
    discount_amount: Decimal
    line_total: Decimal
    position: int


class InvoiceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    invoice_number: str
    subscription_id: UUID
    customer_id: UUID
    status: InvoiceStatus
    currency: str
    period_start: datetime
    period_end: datetime
    issued_at: datetime | None
    due_at: datetime | None
    subtotal: Decimal
    tax_total: Decimal
    discount_total: Decimal
    total: Decimal
    amount_paid: Decimal
    created_at: datetime
    updated_at: datetime
    items: list[InvoiceItemResponse]


class InvoicePage(BaseModel):
    items: list[InvoiceResponse]
    offset: int
    limit: int
