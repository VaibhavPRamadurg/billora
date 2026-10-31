"""Pydantic request and response schemas."""

from app.schemas.auth import AccessTokenResponse, LoginRequest, RegisterRequest, UserResponse
from app.schemas.catalog import (
    ProductCreate,
    ProductPage,
    ProductResponse,
    ProductUpdate,
    ProductVariantCreate,
    ProductVariantPage,
    ProductVariantResponse,
    ProductVariantUpdate,
)

__all__ = [
    "AccessTokenResponse",
    "LoginRequest",
    "ProductCreate",
    "ProductPage",
    "ProductResponse",
    "ProductUpdate",
    "ProductVariantCreate",
    "ProductVariantPage",
    "ProductVariantResponse",
    "ProductVariantUpdate",
    "RegisterRequest",
    "UserResponse",
]
