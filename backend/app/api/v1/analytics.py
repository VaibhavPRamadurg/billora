"""Admin and staff dashboard analytics over persisted financial records."""

from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import case, extract, func, select
from sqlalchemy.orm import Session

from app.api.dependencies import require_roles
from app.db.session import get_db
from app.models import (
    Invoice,
    InvoiceStatus,
    Payment,
    PaymentStatus,
    Subscription,
    SubscriptionStatus,
    User,
    UserRole,
)
from app.schemas.analytics import (
    AnalyticsOverview,
    BillingFrequencyCount,
    CurrencyAmount,
    InvoiceAnalytics,
    InvoiceBalanceSummary,
    InvoiceStatusCount,
    MonthlyCurrencyAmount,
    RecentInvoiceSummary,
    RevenueTrend,
    SubscriptionAnalytics,
    SubscriptionStatusCount,
)
from app.utils.money import quantize_money


router = APIRouter(prefix="/analytics", tags=["analytics"])
_MANAGERS = (UserRole.ADMIN, UserRole.STAFF)
_ZERO = Decimal("0.00")


def _range_conditions(column, start_date: date | None, end_date: date | None) -> list:
    if start_date is not None and end_date is not None and start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="start_date must be on or before end_date",
        )
    conditions = []
    if start_date is not None:
        conditions.append(column >= datetime.combine(start_date, time.min, tzinfo=timezone.utc))
    if end_date is not None:
        conditions.append(
            column < datetime.combine(end_date + timedelta(days=1), time.min, tzinfo=timezone.utc)
        )
    return conditions


def _currency_amounts(db: Session, statement) -> list[CurrencyAmount]:
    return [
        CurrencyAmount(currency=currency, amount=quantize_money(amount or _ZERO))
        for currency, amount in db.execute(statement).all()
    ]


@router.get("/overview", response_model=AnalyticsOverview)
def overview(
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_roles(*_MANAGERS)),
) -> AnalyticsOverview:
    """Return global operational metrics, with all money separated by currency."""
    total_customers = db.scalar(
        select(func.count()).select_from(User).where(User.role == UserRole.CUSTOMER)
    ) or 0
    total_subscriptions = db.scalar(select(func.count()).select_from(Subscription)) or 0
    active_subscriptions = db.scalar(
        select(func.count()).select_from(Subscription).where(Subscription.status == SubscriptionStatus.ACTIVE)
    ) or 0
    paused_subscriptions = db.scalar(
        select(func.count()).select_from(Subscription).where(Subscription.status == SubscriptionStatus.PAUSED)
    ) or 0

    invoiced = _currency_amounts(
        db,
        select(Invoice.currency, func.sum(Invoice.total))
        .where(Invoice.status != InvoiceStatus.CANCELLED)
        .group_by(Invoice.currency)
        .order_by(Invoice.currency),
    )
    collected = _currency_amounts(
        db,
        select(Payment.currency, func.sum(Payment.applied_amount))
        .where(Payment.status == PaymentStatus.SUCCEEDED)
        .group_by(Payment.currency)
        .order_by(Payment.currency),
    )
    outstanding = _currency_amounts(
        db,
        select(Invoice.currency, func.sum(Invoice.total - Invoice.amount_paid))
        .where(
            Invoice.status != InvoiceStatus.CANCELLED,
            Invoice.total > Invoice.amount_paid,
        )
        .group_by(Invoice.currency)
        .order_by(Invoice.currency),
    )
    now = datetime.now(timezone.utc)
    overdue_invoice_count = db.scalar(
        select(func.count())
        .select_from(Invoice)
        .where(Invoice.due_at.is_not(None), Invoice.due_at < now, Invoice.total > Invoice.amount_paid)
    ) or 0
    return AnalyticsOverview(
        total_customers=int(total_customers),
        total_subscriptions=int(total_subscriptions),
        active_subscriptions=int(active_subscriptions),
        paused_subscriptions=int(paused_subscriptions),
        total_invoiced=invoiced,
        total_collected=collected,
        outstanding_balance=outstanding,
        overdue_invoice_count=int(overdue_invoice_count),
    )


@router.get("/revenue", response_model=RevenueTrend)
def revenue(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_roles(*_MANAGERS)),
) -> RevenueTrend:
    """Return month/currency chart series for invoice totals and settled cash."""
    invoice_conditions = [Invoice.status != InvoiceStatus.CANCELLED, *_range_conditions(Invoice.created_at, start_date, end_date)]
    payment_conditions = [
        Payment.status == PaymentStatus.SUCCEEDED,
        Payment.paid_at.is_not(None),
        *_range_conditions(Payment.paid_at, start_date, end_date),
    ]
    invoice_year, invoice_month = extract("year", Invoice.created_at), extract("month", Invoice.created_at)
    payment_year, payment_month = extract("year", Payment.paid_at), extract("month", Payment.paid_at)
    invoiced = [
        MonthlyCurrencyAmount(month=_month_label(year, month), currency=currency, amount=quantize_money(amount or _ZERO))
        for year, month, currency, amount in db.execute(
            select(invoice_year, invoice_month, Invoice.currency, func.sum(Invoice.total))
            .where(*invoice_conditions)
            .group_by(invoice_year, invoice_month, Invoice.currency)
            .order_by(invoice_year, invoice_month, Invoice.currency)
        ).all()
    ]
    collected = [
        MonthlyCurrencyAmount(month=_month_label(year, month), currency=currency, amount=quantize_money(amount or _ZERO))
        for year, month, currency, amount in db.execute(
            select(payment_year, payment_month, Payment.currency, func.sum(Payment.applied_amount))
            .where(*payment_conditions)
            .group_by(payment_year, payment_month, Payment.currency)
            .order_by(payment_year, payment_month, Payment.currency)
        ).all()
    ]
    return RevenueTrend(start_date=start_date, end_date=end_date, invoiced=invoiced, collected=collected)


@router.get("/subscriptions", response_model=SubscriptionAnalytics)
def subscriptions(
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_roles(*_MANAGERS)),
) -> SubscriptionAnalytics:
    """Return subscription state and cadence distribution without loading rows."""
    by_status = [
        SubscriptionStatusCount(status=subscription_status, count=int(count))
        for subscription_status, count in db.execute(
            select(Subscription.status, func.count().label("count"))
            .group_by(Subscription.status)
            .order_by(Subscription.status)
        ).all()
    ]
    by_frequency = [
        BillingFrequencyCount(billing_frequency=billing_frequency, count=int(count))
        for billing_frequency, count in db.execute(
            select(Subscription.billing_frequency, func.count().label("count"))
            .group_by(Subscription.billing_frequency)
            .order_by(Subscription.billing_frequency)
        ).all()
    ]
    active_count = db.scalar(
        select(func.count()).select_from(Subscription).where(Subscription.status == SubscriptionStatus.ACTIVE)
    ) or 0
    inactive_count = db.scalar(
        select(func.count()).select_from(Subscription).where(Subscription.status != SubscriptionStatus.ACTIVE)
    ) or 0
    return SubscriptionAnalytics(
        by_status=by_status,
        by_billing_frequency=by_frequency,
        active_count=int(active_count),
        inactive_count=int(inactive_count),
    )


@router.get("/invoices", response_model=InvoiceAnalytics)
def invoices(
    recent_limit: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_roles(*_MANAGERS)),
) -> InvoiceAnalytics:
    """Return invoice status, balance, and recent-invoice dashboard data."""
    by_status = [
        InvoiceStatusCount(status=invoice_status, count=int(count))
        for invoice_status, count in db.execute(
            select(Invoice.status, func.count().label("count"))
            .group_by(Invoice.status)
            .order_by(Invoice.status)
        ).all()
    ]
    now = datetime.now(timezone.utc)
    outstanding = Invoice.total - Invoice.amount_paid
    balances = [
        InvoiceBalanceSummary(
            currency=row.currency,
            paid=quantize_money(row.paid or _ZERO),
            partially_paid=quantize_money(row.partially_paid or _ZERO),
            unpaid=quantize_money(row.unpaid or _ZERO),
            overdue=quantize_money(row.overdue or _ZERO),
        )
        for row in db.execute(
            select(
                Invoice.currency.label("currency"),
                func.sum(case((Invoice.status == InvoiceStatus.PAID, Invoice.amount_paid), else_=_ZERO)).label("paid"),
                func.sum(case((Invoice.status == InvoiceStatus.PARTIALLY_PAID, outstanding), else_=_ZERO)).label("partially_paid"),
                func.sum(case(((Invoice.status != InvoiceStatus.CANCELLED) & (Invoice.amount_paid == _ZERO), outstanding), else_=_ZERO)).label("unpaid"),
                func.sum(case(((Invoice.due_at.is_not(None)) & (Invoice.due_at < now) & (outstanding > _ZERO), outstanding), else_=_ZERO)).label("overdue"),
            )
            .group_by(Invoice.currency)
            .order_by(Invoice.currency)
        ).all()
    ]
    recent_invoices = [
        RecentInvoiceSummary(
            id=row.id,
            invoice_number=row.invoice_number,
            customer_id=row.customer_id,
            customer_email=row.customer_email,
            status=row.status,
            currency=row.currency,
            total=row.total,
            amount_paid=row.amount_paid,
            outstanding_balance=quantize_money(row.total - row.amount_paid),
            due_at=row.due_at,
            created_at=row.created_at,
        )
        for row in db.execute(
            select(
                Invoice.id,
                Invoice.invoice_number,
                Invoice.customer_id,
                User.email.label("customer_email"),
                Invoice.status,
                Invoice.currency,
                Invoice.total,
                Invoice.amount_paid,
                Invoice.due_at,
                Invoice.created_at,
            )
            .join(User, User.id == Invoice.customer_id)
            .order_by(Invoice.created_at.desc(), Invoice.id.desc())
            .limit(recent_limit)
        ).all()
    ]
    return InvoiceAnalytics(by_status=by_status, balances=balances, recent_invoices=recent_invoices)


def _month_label(year: object, month: object) -> str:
    return f"{int(year):04d}-{int(month):02d}"
