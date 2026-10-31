"""Shared SQLAlchemy model metadata for Billora.

These definitions intentionally declare no database connections or migrations.  Alembic
will import ``app.models`` later to discover the shared metadata.
"""

from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Index,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    text,
)
from sqlalchemy.dialects.postgresql import ExcludeConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


Money = Numeric(18, 2)
Quantity = Numeric(14, 3)
Rate = Numeric(7, 4)


def utc_now() -> datetime:
    """Return an aware UTC timestamp for application-side defaults."""
    return datetime.now(timezone.utc)


class UserRole(str, Enum):
    ADMIN = "admin"
    STAFF = "staff"
    CUSTOMER = "customer"


class BillingFrequency(str, Enum):
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"


class SubscriptionStatus(str, Enum):
    DRAFT = "draft"
    QUOTATION = "quotation"
    CONFIRMED = "confirmed"
    ACTIVE = "active"
    PAUSED = "paused"
    CLOSED = "closed"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


class InvoiceStatus(str, Enum):
    DRAFT = "draft"
    CONFIRMED = "confirmed"
    PARTIALLY_PAID = "partially_paid"
    PAID = "paid"
    CANCELLED = "cancelled"


class PaymentStatus(str, Enum):
    PENDING = "pending"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    REFUNDED = "refunded"


class DiscountType(str, Enum):
    FIXED = "fixed"
    PERCENTAGE = "percentage"


class QuotationStatus(str, Enum):
    DRAFT = "draft"
    SENT = "sent"
    ACCEPTED = "accepted"
    CONVERTED = "converted"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


def enum_values(enum_class: type[Enum]) -> list[str]:
    """Persist enum values, rather than Python member names, in PostgreSQL."""
    return [member.value for member in enum_class]


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False, index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
    )


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole, name="user_role", values_callable=enum_values),
        nullable=False,
        default=UserRole.CUSTOMER,
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)

    subscriptions: Mapped[list["Subscription"]] = relationship(back_populates="customer")
    quotations: Mapped[list["QuotationTemplate"]] = relationship(back_populates="customer")
    payments: Mapped[list["Payment"]] = relationship(back_populates="customer")
    discount_redemptions: Mapped[list["DiscountRedemption"]] = relationship(back_populates="customer")


class Product(TimestampMixin, Base):
    __tablename__ = "products"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)

    variants: Mapped[list["ProductVariant"]] = relationship(
        back_populates="product", cascade="all, delete-orphan"
    )
    plan_products: Mapped[list["PlanProduct"]] = relationship(back_populates="product")


class ProductVariant(TimestampMixin, Base):
    __tablename__ = "product_variants"
    __table_args__ = (
        UniqueConstraint("product_id", "name", name="uq_product_variants_product_name"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    product_id: Mapped[UUID] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    sku: Mapped[str | None] = mapped_column(String(100), unique=True, index=True)
    attributes: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)

    product: Mapped["Product"] = relationship(back_populates="variants")
    plan_products: Mapped[list["PlanProduct"]] = relationship(back_populates="product_variant")


class Plan(TimestampMixin, Base):
    __tablename__ = "plans"
    __table_args__ = (
        CheckConstraint("trial_days >= 0", name="ck_plans_trial_days_non_negative"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(160), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    billing_frequency: Mapped[BillingFrequency] = mapped_column(
        SAEnum(BillingFrequency, name="billing_frequency", values_callable=enum_values),
        nullable=False,
        index=True,
    )
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="INR")
    price: Mapped[Decimal] = mapped_column(Money, nullable=False)
    trial_days: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)

    plan_products: Mapped[list["PlanProduct"]] = relationship(
        back_populates="plan", cascade="all, delete-orphan", order_by="PlanProduct.position"
    )
    subscriptions: Mapped[list["Subscription"]] = relationship(back_populates="plan")


class PlanProduct(Base):
    __tablename__ = "plan_products"
    __table_args__ = (
        UniqueConstraint("plan_id", "position", name="uq_plan_products_plan_position"),
        CheckConstraint("quantity > 0", name="ck_plan_products_quantity_positive"),
        Index(
            "uq_plan_products_plan_product_no_variant",
            "plan_id",
            "product_id",
            unique=True,
            postgresql_where=text("product_variant_id IS NULL"),
        ),
        Index(
            "uq_plan_products_plan_variant",
            "plan_id",
            "product_variant_id",
            unique=True,
            postgresql_where=text("product_variant_id IS NOT NULL"),
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    plan_id: Mapped[UUID] = mapped_column(
        ForeignKey("plans.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[UUID] = mapped_column(
        ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    product_variant_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("product_variants.id", ondelete="RESTRICT"), index=True
    )
    quantity: Mapped[Decimal] = mapped_column(Quantity, nullable=False, default=Decimal("1"))
    unit_price: Mapped[Decimal | None] = mapped_column(Money)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    plan: Mapped["Plan"] = relationship(back_populates="plan_products")
    product: Mapped["Product"] = relationship(back_populates="plan_products")
    product_variant: Mapped["ProductVariant | None"] = relationship(back_populates="plan_products")
    subscription_items: Mapped[list["SubscriptionItem"]] = relationship(back_populates="plan_product")


class Subscription(TimestampMixin, Base):
    __tablename__ = "subscriptions"
    __table_args__ = (
        CheckConstraint(
            """
            (
                (status IN ('draft', 'quotation', 'confirmed')
                    AND current_period_start IS NULL
                    AND current_period_end IS NULL)
                OR
                (current_period_start IS NOT NULL
                    AND current_period_end IS NOT NULL
                    AND current_period_start < current_period_end)
            )
            """,
            name="ck_subscriptions_period_order",
        ),
        Index("ix_subscriptions_status_next_billing", "status", "next_billing_at"),
        Index("ix_subscriptions_customer_status", "customer_id", "status"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    customer_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    plan_id: Mapped[UUID] = mapped_column(
        ForeignKey("plans.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    status: Mapped[SubscriptionStatus] = mapped_column(
        SAEnum(SubscriptionStatus, name="subscription_status", values_callable=enum_values),
        nullable=False,
        default=SubscriptionStatus.DRAFT,
        server_default=SubscriptionStatus.DRAFT.value,
    )
    billing_frequency: Mapped[BillingFrequency] = mapped_column(
        SAEnum(
            BillingFrequency,
            name="subscription_billing_frequency",
            values_callable=enum_values,
        ),
        nullable=False,
    )
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)
    current_period_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    next_billing_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    paused_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resume_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancel_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancel_at_period_end: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    auto_renew: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    customer: Mapped["User"] = relationship(back_populates="subscriptions")
    plan: Mapped["Plan"] = relationship(back_populates="subscriptions")
    items: Mapped[list["SubscriptionItem"]] = relationship(
        back_populates="subscription", cascade="all, delete-orphan"
    )
    invoices: Mapped[list["Invoice"]] = relationship(back_populates="subscription")


class SubscriptionItem(Base):
    __tablename__ = "subscription_items"
    __table_args__ = (CheckConstraint("quantity > 0", name="ck_subscription_items_quantity_positive"),)

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    subscription_id: Mapped[UUID] = mapped_column(
        ForeignKey("subscriptions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    plan_product_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("plan_products.id", ondelete="SET NULL"), index=True
    )
    product_id: Mapped[UUID] = mapped_column(ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)
    product_variant_id: Mapped[UUID | None] = mapped_column(ForeignKey("product_variants.id", ondelete="RESTRICT"))
    quantity: Mapped[Decimal] = mapped_column(Quantity, nullable=False, default=Decimal("1"))
    unit_price: Mapped[Decimal] = mapped_column(Money, nullable=False)

    subscription: Mapped["Subscription"] = relationship(back_populates="items")
    plan_product: Mapped["PlanProduct | None"] = relationship(back_populates="subscription_items")


class QuotationTemplate(TimestampMixin, Base):
    __tablename__ = "quotation_templates"
    __table_args__ = (Index("ix_quotation_templates_customer_status", "customer_id", "status"),)

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    customer_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    status: Mapped[QuotationStatus] = mapped_column(
        SAEnum(QuotationStatus, name="quotation_status", values_callable=enum_values),
        nullable=False,
        default=QuotationStatus.DRAFT,
    )
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="INR")
    valid_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    converted_subscription_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("subscriptions.id", ondelete="SET NULL"), unique=True
    )
    converted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    customer: Mapped["User | None"] = relationship(back_populates="quotations")
    items: Mapped[list["QuotationTemplateItem"]] = relationship(
        back_populates="quotation_template", cascade="all, delete-orphan", order_by="QuotationTemplateItem.position"
    )
    converted_subscription: Mapped["Subscription | None"] = relationship(foreign_keys=[converted_subscription_id])


class QuotationTemplateItem(Base):
    __tablename__ = "quotation_template_items"
    __table_args__ = (
        UniqueConstraint("quotation_template_id", "position", name="uq_quotation_items_position"),
        CheckConstraint("quantity > 0", name="ck_quotation_items_quantity_positive"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    quotation_template_id: Mapped[UUID] = mapped_column(
        ForeignKey("quotation_templates.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[UUID] = mapped_column(ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)
    product_variant_id: Mapped[UUID | None] = mapped_column(ForeignKey("product_variants.id", ondelete="RESTRICT"))
    quantity: Mapped[Decimal] = mapped_column(Quantity, nullable=False, default=Decimal("1"))
    unit_price: Mapped[Decimal] = mapped_column(Money, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    quotation_template: Mapped["QuotationTemplate"] = relationship(back_populates="items")


class Invoice(TimestampMixin, Base):
    __tablename__ = "invoices"
    __table_args__ = (
        UniqueConstraint("subscription_id", "period_start", "period_end", name="uq_invoices_subscription_period"),
        CheckConstraint("period_start < period_end", name="ck_invoices_period_order"),
        CheckConstraint("subtotal >= 0", name="ck_invoices_subtotal_non_negative"),
        CheckConstraint("tax_total >= 0", name="ck_invoices_tax_total_non_negative"),
        CheckConstraint("discount_total >= 0", name="ck_invoices_discount_total_non_negative"),
        CheckConstraint("total >= 0", name="ck_invoices_total_non_negative"),
        CheckConstraint("amount_paid >= 0", name="ck_invoices_amount_paid_non_negative"),
        ExcludeConstraint(
            ("subscription_id", "="),
            (text("tstzrange(period_start, period_end, '[)')"), "&&"),
            name="excl_invoices_subscription_period_overlap",
            using="gist",
        ),
        Index("ix_invoices_customer_status_due", "customer_id", "status", "due_at"),
        Index("ix_invoices_status_issued", "status", "issued_at"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    invoice_number: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    subscription_id: Mapped[UUID] = mapped_column(
        ForeignKey("subscriptions.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    customer_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    status: Mapped[InvoiceStatus] = mapped_column(
        SAEnum(InvoiceStatus, name="invoice_status", values_callable=enum_values),
        nullable=False,
        default=InvoiceStatus.DRAFT,
    )
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    period_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    issued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    subtotal: Mapped[Decimal] = mapped_column(Money, nullable=False, default=Decimal("0"))
    tax_total: Mapped[Decimal] = mapped_column(Money, nullable=False, default=Decimal("0"))
    discount_total: Mapped[Decimal] = mapped_column(Money, nullable=False, default=Decimal("0"))
    total: Mapped[Decimal] = mapped_column(Money, nullable=False, default=Decimal("0"))
    amount_paid: Mapped[Decimal] = mapped_column(Money, nullable=False, default=Decimal("0"))

    subscription: Mapped["Subscription"] = relationship(back_populates="invoices")
    items: Mapped[list["InvoiceItem"]] = relationship(
        back_populates="invoice", cascade="all, delete-orphan", order_by="InvoiceItem.position"
    )
    payments: Mapped[list["Payment"]] = relationship(back_populates="invoice")
    discount_redemptions: Mapped[list["DiscountRedemption"]] = relationship(back_populates="invoice")


class InvoiceItem(Base):
    __tablename__ = "invoice_items"
    __table_args__ = (
        UniqueConstraint("invoice_id", "position", name="uq_invoice_items_position"),
        CheckConstraint("quantity > 0", name="ck_invoice_items_quantity_positive"),
        CheckConstraint("unit_price >= 0", name="ck_invoice_items_unit_price_non_negative"),
        CheckConstraint("tax_amount >= 0", name="ck_invoice_items_tax_amount_non_negative"),
        CheckConstraint("discount_amount >= 0", name="ck_invoice_items_discount_amount_non_negative"),
        CheckConstraint("line_total >= 0", name="ck_invoice_items_line_total_non_negative"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    invoice_id: Mapped[UUID] = mapped_column(
        ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[UUID | None] = mapped_column(ForeignKey("products.id", ondelete="SET NULL"))
    product_variant_id: Mapped[UUID | None] = mapped_column(ForeignKey("product_variants.id", ondelete="SET NULL"))
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Quantity, nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Money, nullable=False)
    tax_rate: Mapped[Decimal] = mapped_column(Rate, nullable=False, default=Decimal("0"))
    tax_amount: Mapped[Decimal] = mapped_column(Money, nullable=False, default=Decimal("0"))
    discount_amount: Mapped[Decimal] = mapped_column(Money, nullable=False, default=Decimal("0"))
    line_total: Mapped[Decimal] = mapped_column(Money, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    invoice: Mapped["Invoice"] = relationship(back_populates="items")


class Payment(TimestampMixin, Base):
    __tablename__ = "payments"
    __table_args__ = (
        UniqueConstraint("provider", "provider_reference", name="uq_payments_provider_reference"),
        CheckConstraint("amount > 0", name="ck_payments_amount_positive"),
        CheckConstraint("applied_amount >= 0", name="ck_payments_applied_amount_non_negative"),
        CheckConstraint("applied_amount <= amount", name="ck_payments_applied_amount_within_amount"),
        Index("ix_payments_invoice_status", "invoice_id", "status"),
        Index("ix_payments_customer_created", "customer_id", "created_at"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    invoice_id: Mapped[UUID] = mapped_column(
        ForeignKey("invoices.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    customer_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    status: Mapped[PaymentStatus] = mapped_column(
        SAEnum(PaymentStatus, name="payment_status", values_callable=enum_values),
        nullable=False,
        default=PaymentStatus.PENDING,
    )
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    provider_reference: Mapped[str | None] = mapped_column(String(255))
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Money, nullable=False)
    applied_amount: Mapped[Decimal] = mapped_column(Money, nullable=False, default=Decimal("0"))
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)

    invoice: Mapped["Invoice"] = relationship(back_populates="payments")
    customer: Mapped["User"] = relationship(back_populates="payments")


class TaxRule(TimestampMixin, Base):
    __tablename__ = "tax_rules"
    __table_args__ = (
        UniqueConstraint("name", "country_code", name="uq_tax_rules_name_country"),
        CheckConstraint("rate >= 0 AND rate <= 100", name="ck_tax_rules_rate_range"),
        CheckConstraint(
            "valid_to IS NULL OR valid_from IS NULL OR valid_from < valid_to",
            name="ck_tax_rules_validity_order",
        ),
        Index("ix_tax_rules_active_validity", "is_active", "valid_from", "valid_to"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    country_code: Mapped[str] = mapped_column(String(2), nullable=False, index=True)
    rate: Mapped[Decimal] = mapped_column(Rate, nullable=False)
    is_inclusive: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    valid_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    valid_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class DiscountRule(TimestampMixin, Base):
    __tablename__ = "discount_rules"
    __table_args__ = (
        UniqueConstraint("code", name="uq_discount_rules_code"),
        CheckConstraint("value > 0", name="ck_discount_rules_value_positive"),
        CheckConstraint(
            "discount_type != 'percentage' OR value <= 100",
            name="ck_discount_rules_percentage_maximum",
        ),
        CheckConstraint("usage_limit IS NULL OR usage_limit >= 0", name="ck_discount_rules_usage_limit"),
        CheckConstraint(
            "per_customer_usage_limit IS NULL OR per_customer_usage_limit >= 0",
            name="ck_discount_rules_per_customer_usage_limit",
        ),
        CheckConstraint(
            "valid_to IS NULL OR valid_from IS NULL OR valid_from < valid_to",
            name="ck_discount_rules_validity_order",
        ),
        Index("ix_discount_rules_active_validity", "is_active", "valid_from", "valid_to"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    discount_type: Mapped[DiscountType] = mapped_column(
        SAEnum(DiscountType, name="discount_type", values_callable=enum_values), nullable=False
    )
    value: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    max_discount_amount: Mapped[Decimal | None] = mapped_column(Money)
    currency: Mapped[str | None] = mapped_column(String(3))
    eligibility: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    usage_limit: Mapped[int | None] = mapped_column(Integer)
    per_customer_usage_limit: Mapped[int | None] = mapped_column(Integer)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    valid_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    valid_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    redemptions: Mapped[list["DiscountRedemption"]] = relationship(back_populates="discount_rule")


class DiscountRedemption(Base):
    __tablename__ = "discount_redemptions"
    __table_args__ = (
        UniqueConstraint("discount_rule_id", "invoice_id", name="uq_discount_redemptions_rule_invoice"),
        CheckConstraint("discount_amount > 0", name="ck_discount_redemptions_amount_positive"),
        Index("ix_discount_redemptions_rule_customer", "discount_rule_id", "customer_id"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    discount_rule_id: Mapped[UUID] = mapped_column(
        ForeignKey("discount_rules.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    invoice_id: Mapped[UUID] = mapped_column(
        ForeignKey("invoices.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    customer_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    discount_amount: Mapped[Decimal] = mapped_column(Money, nullable=False)
    redeemed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)

    discount_rule: Mapped["DiscountRule"] = relationship(back_populates="redemptions")
    invoice: Mapped["Invoice"] = relationship(back_populates="discount_redemptions")
    customer: Mapped["User"] = relationship(back_populates="discount_redemptions")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("ix_audit_logs_entity_created", "entity_type", "entity_id", "created_at"),
        Index("ix_audit_logs_actor_created", "actor_id", "created_at"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    actor_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    entity_type: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_id: Mapped[UUID] = mapped_column(Uuid, nullable=False)
    changes: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    ip_address: Mapped[str | None] = mapped_column(String(45))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)
