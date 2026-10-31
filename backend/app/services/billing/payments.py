"""Transactional, immutable manual payment recording for invoices."""

from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.models import Invoice, InvoiceStatus, Payment, PaymentStatus
from app.utils.money import quantize_money


class PaymentRecordingError(Exception):
    """Base class for payment-recording errors safe to expose through the API."""


class PaymentRecordingValidationError(PaymentRecordingError):
    """The requested payment is not valid for the invoice."""


class PaymentRecordingConflict(PaymentRecordingError):
    """A payment reference or invoice balance conflicts with this request."""


class PaymentRecordingDatabaseError(PaymentRecordingError):
    """The transaction could not be safely completed."""


@dataclass(frozen=True, slots=True)
class PaymentRecordingResult:
    """An idempotently retrieved or newly created payment event."""

    payment: Payment
    invoice: Invoice
    created: bool


_PAYABLE_STATUSES = frozenset(
    {InvoiceStatus.DRAFT, InvoiceStatus.CONFIRMED, InvoiceStatus.PARTIALLY_PAID}
)


def outstanding_balance(invoice: Invoice) -> Decimal:
    """Return the exact remaining balance while rejecting inconsistent stored totals."""
    balance = quantize_money(invoice.total - invoice.amount_paid)
    if balance < 0:
        raise PaymentRecordingConflict("Invoice balance is inconsistent")
    return balance


def record_manual_payment(
    db: Session,
    invoice_id: UUID,
    *,
    provider: str,
    provider_reference: str,
    currency: str,
    amount: Decimal,
    payment_status: PaymentStatus,
) -> PaymentRecordingResult:
    """Atomically persist one immutable manual payment and update its invoice.

    The invoice is locked before balance validation. A duplicate provider/reference
    returns the existing matching event; a conflicting reference never changes it.
    """
    normalized_provider = provider.strip()
    normalized_reference = provider_reference.strip()
    normalized_currency = currency.strip().upper()
    payment_amount = quantize_money(amount)
    _validate_request(
        normalized_provider,
        normalized_reference,
        normalized_currency,
        payment_amount,
        payment_status,
    )

    invoice = db.scalar(select(Invoice).where(Invoice.id == invoice_id).with_for_update())
    if invoice is None:
        raise PaymentRecordingValidationError("Invoice not found")

    existing = _find_by_reference(db, normalized_provider, normalized_reference)
    if existing is not None:
        return _resolve_duplicate(existing, invoice, normalized_currency, payment_amount, payment_status)

    _validate_payable_invoice(invoice, normalized_currency)
    if payment_amount > outstanding_balance(invoice):
        raise PaymentRecordingConflict("Payment amount exceeds the outstanding invoice balance")
    applied_amount = payment_amount if payment_status is PaymentStatus.SUCCEEDED else Decimal("0.00")

    payment = Payment(
        invoice_id=invoice.id,
        customer_id=invoice.customer_id,
        status=payment_status,
        provider=normalized_provider,
        provider_reference=normalized_reference,
        currency=normalized_currency,
        amount=payment_amount,
        applied_amount=applied_amount,
        paid_at=datetime.now(timezone.utc) if payment_status is PaymentStatus.SUCCEEDED else None,
    )
    db.add(payment)
    if payment_status is PaymentStatus.SUCCEEDED:
        invoice.amount_paid = quantize_money(invoice.amount_paid + applied_amount)
        invoice.status = (
            InvoiceStatus.PAID
            if invoice.amount_paid == invoice.total
            else InvoiceStatus.PARTIALLY_PAID
        )

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        duplicate = _find_by_reference(db, normalized_provider, normalized_reference)
        if duplicate is not None:
            duplicate_invoice = db.get(Invoice, duplicate.invoice_id)
            if duplicate_invoice is not None:
                return _resolve_duplicate(
                    duplicate,
                    duplicate_invoice,
                    normalized_currency,
                    payment_amount,
                    payment_status,
                )
        raise PaymentRecordingConflict("Payment recording conflicts with existing payment data") from None
    except SQLAlchemyError:
        db.rollback()
        raise PaymentRecordingDatabaseError("Payment recording could not be completed") from None

    db.refresh(payment)
    db.refresh(invoice)
    return PaymentRecordingResult(payment=payment, invoice=invoice, created=True)


def _validate_request(
    provider: str,
    provider_reference: str,
    currency: str,
    amount: Decimal,
    payment_status: PaymentStatus,
) -> None:
    if not provider:
        raise PaymentRecordingValidationError("provider is required")
    if not provider_reference:
        raise PaymentRecordingValidationError("provider_reference is required for idempotency")
    if len(currency) != 3 or not currency.isalpha():
        raise PaymentRecordingValidationError("currency must be a three-letter code")
    if amount <= 0:
        raise PaymentRecordingValidationError("amount must be greater than zero")
    if payment_status not in {PaymentStatus.PENDING, PaymentStatus.SUCCEEDED, PaymentStatus.FAILED}:
        raise PaymentRecordingValidationError("Payment status is not supported by the manual workflow")


def _validate_payable_invoice(invoice: Invoice, currency: str) -> None:
    if invoice.status not in _PAYABLE_STATUSES:
        raise PaymentRecordingValidationError("Invoice is not payable")
    if invoice.currency.upper() != currency:
        raise PaymentRecordingValidationError("Payment currency must match the invoice currency")


def _find_by_reference(db: Session, provider: str, provider_reference: str) -> Payment | None:
    return db.scalar(
        select(Payment).where(
            Payment.provider == provider,
            Payment.provider_reference == provider_reference,
        )
    )


def _resolve_duplicate(
    payment: Payment,
    invoice: Invoice,
    currency: str,
    amount: Decimal,
    payment_status: PaymentStatus,
) -> PaymentRecordingResult:
    if (
        payment.invoice_id != invoice.id
        or payment.currency.upper() != currency
        or payment.amount != amount
        or payment.status != payment_status
    ):
        raise PaymentRecordingConflict("Payment reference is already associated with different data")
    return PaymentRecordingResult(payment=payment, invoice=invoice, created=False)
