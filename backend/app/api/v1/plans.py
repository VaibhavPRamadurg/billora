"""Subscription plan and plan-product association endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, require_roles
from app.db.session import get_db
from app.models import BillingFrequency, Plan, PlanProduct, Product, ProductVariant, Subscription, User, UserRole
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


router = APIRouter(prefix="/plans", tags=["plans"])
_PLAN_MANAGERS = (UserRole.ADMIN, UserRole.STAFF)


def _not_found(resource: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{resource} not found")


def _conflict(db: Session, message: str) -> HTTPException:
    db.rollback()
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=message)


def _get_plan_or_404(db: Session, plan_id: UUID) -> Plan:
    plan = db.get(Plan, plan_id)
    if plan is None:
        raise _not_found("Plan")
    return plan


def _get_visible_plan_or_404(db: Session, plan_id: UUID, current_user: User) -> Plan:
    plan = _get_plan_or_404(db, plan_id)
    if current_user.role == UserRole.CUSTOMER and not plan.is_active:
        raise _not_found("Plan")
    return plan


def _get_association_or_404(db: Session, plan_id: UUID, association_id: UUID) -> PlanProduct:
    association = db.get(PlanProduct, association_id)
    if association is None or association.plan_id != plan_id:
        raise _not_found("Plan product association")
    return association


def _validate_product_and_variant(
    db: Session, product_id: UUID, product_variant_id: UUID | None
) -> None:
    product = db.get(Product, product_id)
    if product is None:
        raise _not_found("Product")
    if product_variant_id is None:
        return
    variant = db.get(ProductVariant, product_variant_id)
    if variant is None or variant.product_id != product_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Product variant does not belong to the selected product",
        )


def _is_visible_association(db: Session, association: PlanProduct) -> bool:
    """Customer plans must not leak unavailable catalog records."""
    product = db.get(Product, association.product_id)
    if product is None or not product.is_active:
        return False
    if association.product_variant_id is None:
        return True
    variant = db.get(ProductVariant, association.product_variant_id)
    return variant is not None and variant.is_active


@router.post("", response_model=PlanResponse, status_code=status.HTTP_201_CREATED)
def create_plan(
    payload: PlanCreate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_roles(*_PLAN_MANAGERS)),
) -> Plan:
    plan = Plan(**payload.model_dump())
    db.add(plan)
    try:
        db.commit()
    except IntegrityError:
        raise _conflict(db, "Plan name already exists") from None
    db.refresh(plan)
    return plan


@router.get("", response_model=PlanPage)
def list_plans(
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    search: str | None = Query(default=None, max_length=160),
    is_active: bool | None = Query(default=None),
    billing_frequency: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PlanPage:
    statement = select(Plan)
    if search:
        statement = statement.where(Plan.name.ilike(f"%{search.strip()}%"))
    if current_user.role == UserRole.CUSTOMER:
        statement = statement.where(Plan.is_active.is_(True))
    elif is_active is not None:
        statement = statement.where(Plan.is_active.is_(is_active))
    if billing_frequency is not None:
        try:
            statement = statement.where(Plan.billing_frequency == BillingFrequency(billing_frequency))
        except ValueError:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Invalid billing frequency") from None

    plans = db.scalars(statement.order_by(Plan.name).offset(offset).limit(limit)).all()
    return PlanPage(items=plans, offset=offset, limit=limit)


@router.get("/{plan_id}", response_model=PlanResponse)
def get_plan(
    plan_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Plan:
    return _get_visible_plan_or_404(db, plan_id, current_user)


@router.patch("/{plan_id}", response_model=PlanResponse)
def update_plan(
    plan_id: UUID,
    payload: PlanUpdate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_roles(*_PLAN_MANAGERS)),
) -> Plan:
    plan = _get_plan_or_404(db, plan_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(plan, field, value)
    try:
        db.commit()
    except IntegrityError:
        raise _conflict(db, "Plan name already exists") from None
    db.refresh(plan)
    return plan


@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_plan(
    plan_id: UUID,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_roles(UserRole.ADMIN)),
) -> Response:
    plan = _get_plan_or_404(db, plan_id)
    if db.scalar(select(Subscription.id).where(Subscription.plan_id == plan.id).limit(1)) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Plan is referenced by subscriptions and cannot be deleted; deactivate it instead",
        )
    db.delete(plan)
    try:
        db.commit()
    except IntegrityError:
        raise _conflict(db, "Plan is referenced and cannot be deleted") from None
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{plan_id}/products", response_model=PlanProductResponse, status_code=status.HTTP_201_CREATED)
def create_plan_product(
    plan_id: UUID,
    payload: PlanProductCreate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_roles(*_PLAN_MANAGERS)),
) -> PlanProduct:
    _get_plan_or_404(db, plan_id)
    _validate_product_and_variant(db, payload.product_id, payload.product_variant_id)
    association = PlanProduct(plan_id=plan_id, **payload.model_dump())
    db.add(association)
    try:
        db.commit()
    except IntegrityError:
        raise _conflict(db, "Plan product association conflicts with an existing record") from None
    db.refresh(association)
    return association


@router.get("/{plan_id}/products", response_model=PlanProductPage)
def list_plan_products(
    plan_id: UUID,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PlanProductPage:
    _get_visible_plan_or_404(db, plan_id, current_user)
    associations = db.scalars(
        select(PlanProduct).where(PlanProduct.plan_id == plan_id).order_by(PlanProduct.position).offset(offset).limit(limit)
    ).all()
    if current_user.role == UserRole.CUSTOMER:
        associations = [association for association in associations if _is_visible_association(db, association)]
    return PlanProductPage(items=associations, offset=offset, limit=limit)


@router.patch("/{plan_id}/products/{association_id}", response_model=PlanProductResponse)
def update_plan_product(
    plan_id: UUID,
    association_id: UUID,
    payload: PlanProductUpdate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_roles(*_PLAN_MANAGERS)),
) -> PlanProduct:
    _get_plan_or_404(db, plan_id)
    association = _get_association_or_404(db, plan_id, association_id)
    updates = payload.model_dump(exclude_unset=True)
    product_id = updates.get("product_id", association.product_id)
    variant_id = updates.get("product_variant_id", association.product_variant_id)
    _validate_product_and_variant(db, product_id, variant_id)
    for field, value in updates.items():
        setattr(association, field, value)
    try:
        db.commit()
    except IntegrityError:
        raise _conflict(db, "Plan product association conflicts with an existing record") from None
    db.refresh(association)
    return association


@router.delete("/{plan_id}/products/{association_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_plan_product(
    plan_id: UUID,
    association_id: UUID,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_roles(*_PLAN_MANAGERS)),
) -> Response:
    _get_plan_or_404(db, plan_id)
    association = _get_association_or_404(db, plan_id, association_id)
    db.delete(association)
    try:
        db.commit()
    except IntegrityError:
        raise _conflict(db, "Plan product association is referenced and cannot be deleted") from None
    return Response(status_code=status.HTTP_204_NO_CONTENT)
