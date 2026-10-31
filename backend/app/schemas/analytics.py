"""Dashboard-oriented response schemas for persisted Billora analytics."""

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel

from app.models import BillingFrequency, InvoiceStatus, SubscriptionStatus


class CurrencyAmount(BaseModel):
    currency: str
    amount: Decimal


class AnalyticsOverview(BaseModel):
    total_customers: int
    total_subscriptions: int
    active_subscriptions: int
    paused_subscriptions: int
    total_invoiced: list[CurrencyAmount]
    total_collected: list[CurrencyAmount]
    outstanding_balance: list[CurrencyAmount]
    overdue_invoice_count: int


class MonthlyCurrencyAmount(CurrencyAmount):
    month: str


class RevenueTrend(BaseModel):
    start_date: date | None
    end_date: date | None
    invoiced: list[MonthlyCurrencyAmount]
    collected: list[MonthlyCurrencyAmount]


class SubscriptionStatusCount(BaseModel):
    status: SubscriptionStatus
    count: int


class BillingFrequencyCount(BaseModel):
    billing_frequency: BillingFrequency
    count: int


class SubscriptionAnalytics(BaseModel):
    by_status: list[SubscriptionStatusCount]
    by_billing_frequency: list[BillingFrequencyCount]
    active_count: int
    inactive_count: int


class InvoiceStatusCount(BaseModel):
    status: InvoiceStatus
    count: int


class InvoiceBalanceSummary(BaseModel):
    currency: str
    paid: Decimal
    partially_paid: Decimal
    unpaid: Decimal
    overdue: Decimal


class RecentInvoiceSummary(BaseModel):
    id: UUID
    invoice_number: str
    customer_id: UUID
    customer_email: str
    status: InvoiceStatus
    currency: str
    total: Decimal
    amount_paid: Decimal
    outstanding_balance: Decimal
    due_at: datetime | None
    created_at: datetime


class InvoiceAnalytics(BaseModel):
    by_status: list[InvoiceStatusCount]
    balances: list[InvoiceBalanceSummary]
    recent_invoices: list[RecentInvoiceSummary]
