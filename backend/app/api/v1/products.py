"""Product and product-variant catalog endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, require_roles
from app.db.session import get_db
from app.models import PlanProduct, Product, ProductVariant, SubscriptionItem, User, UserRole
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


router = APIRouter(prefix="/products", tags=["products"])
_CATALOG_MANAGERS = (UserRole.ADMIN, UserRole.STAFF)


def _not_found(resource: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{resource} not found")


def _get_product_or_404(db: Session, product_id: UUID) -> Product:
    product = db.get(Product, product_id)
    if product is None:
        raise _not_found("Product")
    return product


def _get_visible_product_or_404(db: Session, product_id: UUID, current_user: User) -> Product:
    product = _get_product_or_404(db, product_id)
    if current_user.role == UserRole.CUSTOMER and not product.is_active:
        raise _not_found("Product")
    return product


def _get_variant_or_404(db: Session, product_id: UUID, variant_id: UUID) -> ProductVariant:
    variant = db.get(ProductVariant, variant_id)
    if variant is None or variant.product_id != product_id:
        raise _not_found("Product variant")
    return variant


def _catalog_conflict(db: Session, message: str) -> HTTPException:
    db.rollback()
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=message)


@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    payload: ProductCreate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_roles(*_CATALOG_MANAGERS)),
) -> Product:
    product = Product(**payload.model_dump())
    db.add(product)
    try:
        db.commit()
    except IntegrityError:
        raise _catalog_conflict(db, "Product conflicts with an existing record") from None
    db.refresh(product)
    return product


@router.get("", response_model=ProductPage)
def list_products(
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    search: str | None = Query(default=None, max_length=160),
    is_active: bool | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProductPage:
    statement = select(Product)
    if search:
        statement = statement.where(Product.name.ilike(f"%{search.strip()}%"))
    if current_user.role == UserRole.CUSTOMER:
        statement = statement.where(Product.is_active.is_(True))
    elif is_active is not None:
        statement = statement.where(Product.is_active.is_(is_active))

    products = db.scalars(statement.order_by(Product.name).offset(offset).limit(limit)).all()
    return ProductPage(items=products, offset=offset, limit=limit)


@router.get("/{product_id}", response_model=ProductResponse)
def get_product(
    product_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Product:
    return _get_visible_product_or_404(db, product_id, current_user)


@router.patch("/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: UUID,
    payload: ProductUpdate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_roles(*_CATALOG_MANAGERS)),
) -> Product:
    product = _get_product_or_404(db, product_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(product, field, value)
    try:
        db.commit()
    except IntegrityError:
        raise _catalog_conflict(db, "Product conflicts with an existing record") from None
    db.refresh(product)
    return product


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    product_id: UUID,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_roles(UserRole.ADMIN)),
) -> Response:
    product = _get_product_or_404(db, product_id)
    is_referenced = any(
        db.scalar(statement) is not None
        for statement in (
            select(ProductVariant.id).where(ProductVariant.product_id == product.id).limit(1),
            select(PlanProduct.id).where(PlanProduct.product_id == product.id).limit(1),
            select(SubscriptionItem.id).where(SubscriptionItem.product_id == product.id).limit(1),
        )
    )
    if is_referenced:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Product is referenced and cannot be deleted; deactivate it instead",
        )
    db.delete(product)
    try:
        db.commit()
    except IntegrityError:
        raise _catalog_conflict(db, "Product is referenced and cannot be deleted") from None
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{product_id}/variants", response_model=ProductVariantResponse, status_code=status.HTTP_201_CREATED)
def create_product_variant(
    product_id: UUID,
    payload: ProductVariantCreate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_roles(*_CATALOG_MANAGERS)),
) -> ProductVariant:
    _get_product_or_404(db, product_id)
    variant = ProductVariant(product_id=product_id, **payload.model_dump())
    db.add(variant)
    try:
        db.commit()
    except IntegrityError:
        raise _catalog_conflict(db, "Variant name or SKU already exists") from None
    db.refresh(variant)
    return variant


@router.get("/{product_id}/variants", response_model=ProductVariantPage)
def list_product_variants(
    product_id: UUID,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    is_active: bool | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProductVariantPage:
    _get_visible_product_or_404(db, product_id, current_user)
    statement = select(ProductVariant).where(ProductVariant.product_id == product_id)
    if current_user.role == UserRole.CUSTOMER:
        statement = statement.where(ProductVariant.is_active.is_(True))
    elif is_active is not None:
        statement = statement.where(ProductVariant.is_active.is_(is_active))
    variants = db.scalars(statement.order_by(ProductVariant.name).offset(offset).limit(limit)).all()
    return ProductVariantPage(items=variants, offset=offset, limit=limit)


@router.get("/{product_id}/variants/{variant_id}", response_model=ProductVariantResponse)
def get_product_variant(
    product_id: UUID,
    variant_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProductVariant:
    _get_visible_product_or_404(db, product_id, current_user)
    variant = _get_variant_or_404(db, product_id, variant_id)
    if current_user.role == UserRole.CUSTOMER and not variant.is_active:
        raise _not_found("Product variant")
    return variant


@router.patch("/{product_id}/variants/{variant_id}", response_model=ProductVariantResponse)
def update_product_variant(
    product_id: UUID,
    variant_id: UUID,
    payload: ProductVariantUpdate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_roles(*_CATALOG_MANAGERS)),
) -> ProductVariant:
    _get_product_or_404(db, product_id)
    variant = _get_variant_or_404(db, product_id, variant_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(variant, field, value)
    try:
        db.commit()
    except IntegrityError:
        raise _catalog_conflict(db, "Variant name or SKU already exists") from None
    db.refresh(variant)
    return variant


@router.delete("/{product_id}/variants/{variant_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product_variant(
    product_id: UUID,
    variant_id: UUID,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_roles(UserRole.ADMIN)),
) -> Response:
    _get_product_or_404(db, product_id)
    variant = _get_variant_or_404(db, product_id, variant_id)
    is_referenced = any(
        db.scalar(statement) is not None
        for statement in (
            select(PlanProduct.id).where(PlanProduct.product_variant_id == variant.id).limit(1),
            select(SubscriptionItem.id).where(SubscriptionItem.product_variant_id == variant.id).limit(1),
        )
    )
    if is_referenced:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Product variant is referenced and cannot be deleted; deactivate it instead",
        )
    db.delete(variant)
    try:
        db.commit()
    except IntegrityError:
        raise _catalog_conflict(db, "Product variant is referenced and cannot be deleted") from None
    return Response(status_code=status.HTTP_204_NO_CONTENT)
