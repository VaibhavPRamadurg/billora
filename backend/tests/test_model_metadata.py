"""Model metadata tests that never connect to PostgreSQL."""

from sqlalchemy import CheckConstraint, DateTime, Numeric, UniqueConstraint
from sqlalchemy.dialects.postgresql import ExcludeConstraint

from app.db.base import Base
from app.models import Invoice, InvoiceStatus, SubscriptionStatus, User, UserRole


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
    assert {state.value for state in SubscriptionStatus} == {"active", "paused", "cancelled", "expired"}
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
