"""Model metadata tests that never connect to PostgreSQL."""

from sqlalchemy import CheckConstraint, DateTime, Numeric, UniqueConstraint, insert
from sqlalchemy.dialects import postgresql
from sqlalchemy.dialects.postgresql import ExcludeConstraint

from app.db.base import Base
from app.models import (
    BillingFrequency,
    DiscountRule,
    DiscountType,
    Invoice,
    InvoiceStatus,
    Payment,
    PaymentStatus,
    Plan,
    QuotationStatus,
    QuotationTemplate,
    Subscription,
    SubscriptionStatus,
    User,
    UserRole,
)


def test_all_shared_tables_are_registered_with_base_metadata() -> None:
    expected_tables = {
        "users",
        "products",
        "product_variants",
        "plans",
        "plan_products",
        "subscriptions",
        "subscription_items",
        "quotation_templates",
        "quotation_template_items",
        "invoices",
        "invoice_items",
        "payments",
        "tax_rules",
        "discount_rules",
        "discount_redemptions",
        "audit_logs",
    }

    assert expected_tables <= set(Base.metadata.tables)


def test_shared_enum_values_match_the_business_contract() -> None:
    assert {role.value for role in UserRole} == {"admin", "staff", "customer"}
    assert {state.value for state in SubscriptionStatus} == {
        "draft",
        "quotation",
        "confirmed",
        "active",
        "paused",
        "closed",
        "cancelled",
        "expired",
    }
    assert {state.value for state in InvoiceStatus} == {
        "draft",
        "confirmed",
        "partially_paid",
        "paid",
        "cancelled",
    }


def test_money_and_timestamps_use_exact_aware_types() -> None:
    assert isinstance(Invoice.__table__.c.total.type, Numeric)
    assert Invoice.__table__.c.total.type.scale == 2
    assert isinstance(User.__table__.c.created_at.type, DateTime)
    assert User.__table__.c.created_at.type.timezone is True


def test_subscription_lifecycle_metadata_supports_pre_activation_periods() -> None:
    subscription = Subscription.__table__

    assert subscription.c.status.default.arg is SubscriptionStatus.DRAFT
    assert subscription.c.status.server_default.arg == "draft"
    assert subscription.c.current_period_start.nullable is True
    assert subscription.c.current_period_end.nullable is True
    assert subscription.c.billing_anchor_at.nullable is True
    assert isinstance(subscription.c.billing_anchor_at.type, DateTime)
    assert subscription.c.billing_anchor_at.type.timezone is True
    assert any(
        isinstance(constraint, CheckConstraint)
        and constraint.name == "ck_subscriptions_period_order"
        and "quotation" in str(constraint.sqltext)
        and "current_period_start < current_period_end" in str(constraint.sqltext)
        for constraint in subscription.constraints
    )


def test_invoice_period_constraints_preserve_idempotency_and_non_overlap() -> None:
    constraints = list(Invoice.__table__.constraints)
    unique_period_constraint = next(
        constraint
        for constraint in constraints
        if isinstance(constraint, UniqueConstraint)
        and constraint.name == "uq_invoices_subscription_period"
    )

    assert tuple(column.name for column in unique_period_constraint.columns) == (
        "subscription_id",
        "period_start",
        "period_end",
    )
    assert any(isinstance(constraint, ExcludeConstraint) for constraint in constraints)
    assert any(
        isinstance(constraint, CheckConstraint) and constraint.name == "ck_invoices_period_order"
        for constraint in constraints
    )


def test_postgresql_enum_binds_use_lowercase_database_labels() -> None:
    """Verify bind processing used by PostgreSQL INSERT statements, without a database."""
    enum_columns = {
        User.__table__.c.role: UserRole.CUSTOMER,
        Plan.__table__.c.billing_frequency: BillingFrequency.MONTHLY,
        Subscription.__table__.c.status: SubscriptionStatus.PAUSED,
        Subscription.__table__.c.billing_frequency: BillingFrequency.YEARLY,
        QuotationTemplate.__table__.c.status: QuotationStatus.ACCEPTED,
        Invoice.__table__.c.status: InvoiceStatus.PARTIALLY_PAID,
        Payment.__table__.c.status: PaymentStatus.SUCCEEDED,
        DiscountRule.__table__.c.discount_type: DiscountType.PERCENTAGE,
    }
    dialect = postgresql.dialect()

    for column, enum_member in enum_columns.items():
        processor = column.type.bind_processor(dialect)
        assert processor is not None
        assert processor(enum_member) == enum_member.value

    # The User INSERT's role parameter uses the same PostgreSQL column type processor.
    compiled_insert = insert(User).values(
        email="customer@example.com",
        hashed_password="argon2-hash",
        role=UserRole.CUSTOMER,
        is_active=True,
    ).compile(dialect=dialect)
    role_processor = User.__table__.c.role.type.bind_processor(dialect)
    assert role_processor(compiled_insert.params["role"]) == "customer"
