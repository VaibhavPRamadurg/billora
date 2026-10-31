"""Protected invoice generation and retrieval endpoints."""

import re
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.dependencies import get_current_user, require_roles
from app.db.session import get_db
from app.models import Invoice, InvoiceStatus, User, UserRole
from app.schemas.invoices import InvoiceGenerateRequest, InvoicePage, InvoiceResponse
from app.services.billing.invoices import (
    InvoiceGenerationConflict,
    InvoiceGenerationDatabaseError,
    InvoiceGenerationValidationError,
    generate_initial_invoice,
    get_invoice_with_items,
)
from app.services.billing.pdf import render_invoice_pdf


router = APIRouter(tags=["invoices"])
_MANAGERS = (UserRole.ADMIN, UserRole.STAFF)


@router.post(
    "/subscriptions/{subscription_id}/invoices/generate",
    response_model=InvoiceResponse,
    status_code=status.HTTP_201_CREATED,
)
def generate_invoice(
    subscription_id: UUID,
    response: Response,
    payload: InvoiceGenerateRequest | None = None,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_roles(*_MANAGERS)),
) -> Invoice:
    """Explicitly generate the initial draft invoice for an active subscription."""
    try:
        result = generate_initial_invoice(
            db,
            subscription_id,
            discount_code=payload.discount_code if payload is not None else None,
        )
    except InvoiceGenerationValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)) from None
    except InvoiceGenerationConflict as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from None
    except InvoiceGenerationDatabaseError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Invoice generation could not be completed",
        ) from None
    if not result.created:
        response.status_code = status.HTTP_200_OK
    return result.invoice


@router.get("/invoices", response_model=InvoicePage)
def list_invoices(
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    customer_id: UUID | None = None,
    subscription_id: UUID | None = None,
    status_filter: InvoiceStatus | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InvoicePage:
    """List invoices visible to the authenticated customer or manager."""
    statement = select(Invoice).options(selectinload(Invoice.items))
    if current_user.role == UserRole.CUSTOMER:
        statement = statement.where(Invoice.customer_id == current_user.id)
    elif customer_id is not None:
        statement = statement.where(Invoice.customer_id == customer_id)
    if subscription_id is not None:
        statement = statement.where(Invoice.subscription_id == subscription_id)
    if status_filter is not None:
        statement = statement.where(Invoice.status == status_filter)
    invoices = db.scalars(
        statement.order_by(Invoice.created_at.desc()).offset(offset).limit(limit)
    ).all()
    return InvoicePage(items=invoices, offset=offset, limit=limit)


@router.get("/invoices/{invoice_id}", response_model=InvoiceResponse)
def get_invoice(
    invoice_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Invoice:
    """Retrieve an invoice with its immutable line-item snapshots."""
    invoice = get_invoice_with_items(db, invoice_id)
    if invoice is None or (
        current_user.role == UserRole.CUSTOMER and invoice.customer_id != current_user.id
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    return invoice


@router.get(
    "/invoices/{invoice_id}/pdf",
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}},
)
def export_invoice_pdf(
    invoice_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    """Download a PDF rendered from persisted invoice and line-item snapshots."""
    invoice = get_invoice_with_items(db, invoice_id)
    if invoice is None or (
        current_user.role == UserRole.CUSTOMER and invoice.customer_id != current_user.id
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    customer = db.get(User, invoice.customer_id)
    if customer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    safe_invoice_number = re.sub(r"[^A-Za-z0-9._-]", "_", invoice.invoice_number)
    filename = f"invoice-{safe_invoice_number}.pdf"
    return Response(
        content=render_invoice_pdf(invoice, customer),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
