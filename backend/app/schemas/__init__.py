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
from app.schemas.plans import (
    PlanCreate,
    PlanPage,
    PlanProductCreate,
    PlanProductPage,
    PlanProductResponse,
    PlanProductUpdate,
    PlanResponse,
    PlanUpdate,
)
from app.schemas.subscriptions import (
    ActivationRequest,
    SubscriptionCreate,
    SubscriptionDraftUpdate,
    SubscriptionItemInput,
    SubscriptionItemResponse,
    SubscriptionPage,
    SubscriptionResponse,
)

__all__ = [
    "AccessTokenResponse",
    "ActivationRequest",
    "LoginRequest",
    "PlanCreate",
    "PlanPage",
    "PlanProductCreate",
    "PlanProductPage",
    "PlanProductResponse",
    "PlanProductUpdate",
    "PlanResponse",
    "PlanUpdate",
    "ProductCreate",
    "ProductPage",
    "ProductResponse",
    "ProductUpdate",
    "ProductVariantCreate",
    "ProductVariantPage",
    "ProductVariantResponse",
    "ProductVariantUpdate",
    "RegisterRequest",
    "SubscriptionCreate",
    "SubscriptionDraftUpdate",
    "SubscriptionItemInput",
    "SubscriptionItemResponse",
    "SubscriptionPage",
    "SubscriptionResponse",
    "UserResponse",
]
