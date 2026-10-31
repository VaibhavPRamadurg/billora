"""Protected immutable manual-payment endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, require_roles
from app.db.session import get_db
from app.models import Invoice, Payment, User, UserRole
from app.schemas.payments import PaymentCreate, PaymentPage, PaymentResponse
from app.services.billing.payments import (
    PaymentRecordingConflict,
    PaymentRecordingDatabaseError,
    PaymentRecordingValidationError,
    outstanding_balance,
    record_manual_payment,
)


router = APIRouter(tags=["payments"])
_MANAGERS = (UserRole.ADMIN, UserRole.STAFF)


def _payment_response(payment: Payment, invoice: Invoice) -> PaymentResponse:
    return PaymentResponse(
        id=payment.id,
        invoice_id=payment.invoice_id,
        customer_id=payment.customer_id,
        status=payment.status,
        provider=payment.provider,
        provider_reference=payment.provider_reference,
        currency=payment.currency,
        amount=payment.amount,
        applied_amount=payment.applied_amount,
        paid_at=payment.paid_at,
        created_at=payment.created_at,
        updated_at=payment.updated_at,
        outstanding_balance=outstanding_balance(invoice),
    )


def _visible_invoice_or_404(db: Session, invoice_id: UUID, current_user: User) -> Invoice:
    invoice = db.get(Invoice, invoice_id)
    if invoice is None or (
        current_user.role == UserRole.CUSTOMER and invoice.customer_id != current_user.id
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    return invoice


@router.post(
    "/invoices/{invoice_id}/payments",
    response_model=PaymentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_payment(
    invoice_id: UUID,
    payload: PaymentCreate,
    response: Response,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_roles(*_MANAGERS)),
) -> PaymentResponse:
    """Record an explicit manual payment event; existing events are immutable."""
    try:
        result = record_manual_payment(
            db,
            invoice_id,
            provider=payload.provider,
            provider_reference=payload.provider_reference,
            currency=payload.currency,
            amount=payload.amount,
            payment_status=payload.status,
        )
    except PaymentRecordingValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)) from None
    except PaymentRecordingConflict as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from None
    except PaymentRecordingDatabaseError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Payment recording could not be completed",
        ) from None
    if not result.created:
        response.status_code = status.HTTP_200_OK
    return _payment_response(result.payment, result.invoice)


@router.get("/invoices/{invoice_id}/payments", response_model=PaymentPage)
def list_invoice_payments(
    invoice_id: UUID,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PaymentPage:
    """List payments for an invoice visible to the current customer or manager."""
    invoice = _visible_invoice_or_404(db, invoice_id, current_user)
    payments = db.scalars(
        select(Payment)
        .where(Payment.invoice_id == invoice.id)
        .order_by(Payment.created_at.desc())
        .offset(offset)
        .limit(limit)
    ).all()
    return PaymentPage(
        items=[_payment_response(payment, invoice) for payment in payments],
        offset=offset,
        limit=limit,
    )


@router.get("/payments/{payment_id}", response_model=PaymentResponse)
def get_payment(
    payment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PaymentResponse:
    """Retrieve one payment if its invoice belongs to the current customer."""
    payment = db.get(Payment, payment_id)
    if payment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")
    invoice = _visible_invoice_or_404(db, payment.invoice_id, current_user)
    return _payment_response(payment, invoice)
