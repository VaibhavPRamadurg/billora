"""Customer subscription lifecycle endpoints without billing side effects."""

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, require_roles
from app.db.session import get_db
from app.models import Plan, PlanProduct, Product, ProductVariant, Subscription, SubscriptionItem, SubscriptionStatus, User, UserRole
from app.schemas.subscriptions import (
    ActivationRequest,
    SubscriptionCreate,
    SubscriptionDraftUpdate,
    SubscriptionItemInput,
    SubscriptionPage,
    SubscriptionResponse,
)
from app.services.subscriptions import can_transition


router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])
_MANAGERS = (UserRole.ADMIN, UserRole.STAFF)


def _not_found() -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")


def _conflict(db: Session, message: str) -> HTTPException:
    db.rollback()
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=message)


def _get_subscription_for_user(db: Session, subscription_id: UUID, current_user: User) -> Subscription:
    subscription = db.get(Subscription, subscription_id)
    if subscription is None:
        raise _not_found()
    if current_user.role == UserRole.CUSTOMER and subscription.customer_id != current_user.id:
        raise _not_found()
    return subscription


def _validate_customer_and_plan(db: Session, customer_id: UUID, plan_id: UUID) -> Plan:
    customer = db.get(User, customer_id)
    if customer is None or customer.role != UserRole.CUSTOMER:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="customer_id must reference a customer")
    plan = db.get(Plan, plan_id)
    if plan is None or not plan.is_active:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="plan_id must reference an active plan")
    return plan


def _build_item_snapshots(
    db: Session, plan_id: UUID, inputs: list[SubscriptionItemInput]
) -> list[SubscriptionItem]:
    seen_associations: set[UUID] = set()
    snapshots: list[SubscriptionItem] = []
    for item in inputs:
        if item.plan_product_id in seen_associations:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="plan product associations must be unique")
        seen_associations.add(item.plan_product_id)
        association = db.get(PlanProduct, item.plan_product_id)
        if association is None or association.plan_id != plan_id:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="plan_product_id does not belong to the plan")
        product = db.get(Product, association.product_id)
        if product is None or not product.is_active:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="plan product is not active")
        if association.product_variant_id is not None:
            variant = db.get(ProductVariant, association.product_variant_id)
            if variant is None or variant.product_id != product.id or not variant.is_active:
                raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="plan product variant is not active")
        unit_price = item.unit_price if item.unit_price is not None else association.unit_price
        if unit_price is None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="unit_price is required for this plan product")
        snapshots.append(
            SubscriptionItem(
                plan_product_id=association.id,
                product_id=association.product_id,
                product_variant_id=association.product_variant_id,
                quantity=item.quantity if item.quantity is not None else association.quantity,
                unit_price=unit_price,
            )
        )
    return snapshots


def _transition(subscription: Subscription, target: SubscriptionStatus) -> None:
    if not can_transition(subscription.status, target):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot transition subscription from {subscription.status.value} to {target.value}",
        )
    subscription.status = target


def _commit_transition(db: Session, subscription: Subscription) -> Subscription:
    try:
        db.commit()
    except IntegrityError:
        raise _conflict(db, "Subscription transition conflicts with the current data") from None
    db.refresh(subscription)
    return subscription


@router.post("", response_model=SubscriptionResponse, status_code=status.HTTP_201_CREATED)
def create_subscription(
    payload: SubscriptionCreate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_roles(*_MANAGERS)),
) -> Subscription:
    plan = _validate_customer_and_plan(db, payload.customer_id, payload.plan_id)
    items = _build_item_snapshots(db, plan.id, payload.items)
    subscription = Subscription(
        customer_id=payload.customer_id,
        plan_id=plan.id,
        status=SubscriptionStatus.DRAFT,
        billing_frequency=plan.billing_frequency,
        currency=plan.currency,
        items=items,
    )
    db.add(subscription)
    try:
        db.commit()
    except IntegrityError:
        raise _conflict(db, "Subscription could not be created") from None
    db.refresh(subscription)
    return subscription


@router.get("", response_model=SubscriptionPage)
def list_subscriptions(
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    customer_id: UUID | None = None,
    plan_id: UUID | None = None,
    status_filter: SubscriptionStatus | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SubscriptionPage:
    statement = select(Subscription)
    if current_user.role == UserRole.CUSTOMER:
        statement = statement.where(Subscription.customer_id == current_user.id)
    else:
        if customer_id is not None:
            statement = statement.where(Subscription.customer_id == customer_id)
    if plan_id is not None:
        statement = statement.where(Subscription.plan_id == plan_id)
    if status_filter is not None:
        statement = statement.where(Subscription.status == status_filter)
    subscriptions = db.scalars(statement.order_by(Subscription.created_at.desc()).offset(offset).limit(limit)).all()
    return SubscriptionPage(items=subscriptions, offset=offset, limit=limit)


@router.get("/{subscription_id}", response_model=SubscriptionResponse)
def get_subscription(
    subscription_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Subscription:
    return _get_subscription_for_user(db, subscription_id, current_user)


@router.patch("/{subscription_id}", response_model=SubscriptionResponse)
def update_draft_subscription(
    subscription_id: UUID,
    payload: SubscriptionDraftUpdate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_roles(*_MANAGERS)),
) -> Subscription:
    subscription = db.get(Subscription, subscription_id)
    if subscription is None:
        raise _not_found()
    if subscription.status != SubscriptionStatus.DRAFT:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only draft subscriptions can be updated")
    updates = payload.model_dump(exclude_unset=True)
    customer_id = updates.get("customer_id", subscription.customer_id)
    plan_id = updates.get("plan_id", subscription.plan_id)
    plan = _validate_customer_and_plan(db, customer_id, plan_id)
    if plan_id != subscription.plan_id and "items" not in updates:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="items are required when changing plan_id")
    if "items" in updates:
        subscription.items = _build_item_snapshots(db, plan.id, payload.items or [])
    subscription.customer_id = customer_id
    subscription.plan_id = plan.id
    subscription.billing_frequency = plan.billing_frequency
    subscription.currency = plan.currency
    return _commit_transition(db, subscription)


@router.post("/{subscription_id}/quotation", response_model=SubscriptionResponse)
def move_to_quotation(subscription_id: UUID, db: Session = Depends(get_db), _current_user: User = Depends(require_roles(*_MANAGERS))) -> Subscription:
    subscription = db.get(Subscription, subscription_id)
    if subscription is None:
        raise _not_found()
    _transition(subscription, SubscriptionStatus.QUOTATION)
    return _commit_transition(db, subscription)


@router.post("/{subscription_id}/confirm", response_model=SubscriptionResponse)
def confirm_subscription(subscription_id: UUID, db: Session = Depends(get_db), _current_user: User = Depends(require_roles(*_MANAGERS))) -> Subscription:
    subscription = db.get(Subscription, subscription_id)
    if subscription is None:
        raise _not_found()
    _transition(subscription, SubscriptionStatus.CONFIRMED)
    return _commit_transition(db, subscription)


@router.post("/{subscription_id}/activate", response_model=SubscriptionResponse)
def activate_subscription(
    subscription_id: UUID,
    payload: ActivationRequest,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_roles(*_MANAGERS)),
) -> Subscription:
    subscription = db.get(Subscription, subscription_id)
    if subscription is None:
        raise _not_found()
    _transition(subscription, SubscriptionStatus.ACTIVE)
    subscription.current_period_start = payload.current_period_start
    subscription.current_period_end = payload.current_period_end
    if subscription.billing_anchor_at is None:
        subscription.billing_anchor_at = payload.current_period_start
    subscription.next_billing_at = payload.current_period_end
    return _commit_transition(db, subscription)


def _terminal_transition(subscription: Subscription, target: SubscriptionStatus) -> None:
    _transition(subscription, target)
    subscription.next_billing_at = None
    subscription.auto_renew = False
    subscription.cancel_at = datetime.now(timezone.utc)


@router.post("/{subscription_id}/pause", response_model=SubscriptionResponse)
def pause_subscription(subscription_id: UUID, db: Session = Depends(get_db), _current_user: User = Depends(require_roles(*_MANAGERS))) -> Subscription:
    subscription = db.get(Subscription, subscription_id)
    if subscription is None:
        raise _not_found()
    _transition(subscription, SubscriptionStatus.PAUSED)
    subscription.paused_at = datetime.now(timezone.utc)
    subscription.next_billing_at = None
    return _commit_transition(db, subscription)


@router.post("/{subscription_id}/resume", response_model=SubscriptionResponse)
def resume_subscription(subscription_id: UUID, db: Session = Depends(get_db), _current_user: User = Depends(require_roles(*_MANAGERS))) -> Subscription:
    subscription = db.get(Subscription, subscription_id)
    if subscription is None:
        raise _not_found()
    _transition(subscription, SubscriptionStatus.ACTIVE)
    subscription.resume_at = datetime.now(timezone.utc)
    subscription.next_billing_at = subscription.current_period_end
    return _commit_transition(db, subscription)


@router.post("/{subscription_id}/close", response_model=SubscriptionResponse)
def close_subscription(subscription_id: UUID, db: Session = Depends(get_db), _current_user: User = Depends(require_roles(*_MANAGERS))) -> Subscription:
    subscription = db.get(Subscription, subscription_id)
    if subscription is None:
        raise _not_found()
    _terminal_transition(subscription, SubscriptionStatus.CLOSED)
    return _commit_transition(db, subscription)


@router.post("/{subscription_id}/cancel", response_model=SubscriptionResponse)
def cancel_subscription(subscription_id: UUID, db: Session = Depends(get_db), _current_user: User = Depends(require_roles(*_MANAGERS))) -> Subscription:
    subscription = db.get(Subscription, subscription_id)
    if subscription is None:
        raise _not_found()
    _terminal_transition(subscription, SubscriptionStatus.CANCELLED)
    return _commit_transition(db, subscription)


@router.post("/{subscription_id}/expire", response_model=SubscriptionResponse)
def expire_subscription(subscription_id: UUID, db: Session = Depends(get_db), _current_user: User = Depends(require_roles(*_MANAGERS))) -> Subscription:
    """Administrative/scheduled expiration; no invoice or payment action occurs."""
    subscription = db.get(Subscription, subscription_id)
    if subscription is None:
        raise _not_found()
    _terminal_transition(subscription, SubscriptionStatus.EXPIRED)
    return _commit_transition(db, subscription)
