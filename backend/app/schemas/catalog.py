"""Pydantic schemas for the product catalog API."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ProductCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=10_000)
    is_active: bool = True


class ProductUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=10_000)
    is_active: bool | None = None


class ProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class ProductPage(BaseModel):
    items: list[ProductResponse]
    offset: int
    limit: int


class ProductVariantCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=160)
    sku: str | None = Field(default=None, min_length=1, max_length=100)
    attributes: dict[str, Any] | None = None
    is_active: bool = True


class ProductVariantUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str | None = Field(default=None, min_length=1, max_length=160)
    sku: str | None = Field(default=None, min_length=1, max_length=100)
    attributes: dict[str, Any] | None = None
    is_active: bool | None = None


class ProductVariantResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    product_id: UUID
    name: str
    sku: str | None
    attributes: dict[str, Any] | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class ProductVariantPage(BaseModel):
    items: list[ProductVariantResponse]
    offset: int
    limit: int
