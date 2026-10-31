"""Initial Billora PostgreSQL schema.

Revision ID: 20261031_0001
Revises: None
Create Date: 2026-10-31 00:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "20261031_0001"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


user_role = postgresql.ENUM("admin", "staff", "customer", name="user_role", create_type=False)
billing_frequency = postgresql.ENUM("monthly", "quarterly", "yearly", name="billing_frequency", create_type=False)
subscription_billing_frequency = postgresql.ENUM(
    "monthly", "quarterly", "yearly", name="subscription_billing_frequency", create_type=False
)
subscription_status = postgresql.ENUM(
    "active", "paused", "cancelled", "expired", name="subscription_status", create_type=False
)
invoice_status = postgresql.ENUM(
    "draft", "confirmed", "partially_paid", "paid", "cancelled", name="invoice_status", create_type=False
)
payment_status = postgresql.ENUM(
    "pending", "succeeded", "failed", "refunded", name="payment_status", create_type=False
)
discount_type = postgresql.ENUM("fixed", "percentage", name="discount_type", create_type=False)
quotation_status = postgresql.ENUM(
    "draft", "sent", "accepted", "converted", "expired", "cancelled", name="quotation_status", create_type=False
)


def _create_enums() -> None:
    bind = op.get_bind()
    for enum_type in (
        user_role,
        billing_frequency,
        subscription_billing_frequency,
        subscription_status,
        invoice_status,
        payment_status,
        discount_type,
        quotation_status,
    ):
        enum_type.create(bind, checkfirst=True)


def _drop_enums() -> None:
    bind = op.get_bind()
    for enum_type in (
        quotation_status,
        discount_type,
        payment_status,
        invoice_status,
        subscription_status,
        subscription_billing_frequency,
        billing_frequency,
        user_role,
    ):
        enum_type.drop(bind, checkfirst=True)


def upgrade() -> None:
    # UUID equality in the invoice period GiST constraint requires btree_gist.
    # IF NOT EXISTS makes this safe where a Supabase project already has it.
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")
    _create_enums()

    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("role", user_role, nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index("ix_users_email", "users", ["email"])
    op.create_index("ix_users_role", "users", ["role"])
    op.create_index("ix_users_is_active", "users", ["is_active"])
    op.create_index("ix_users_created_at", "users", ["created_at"])

    op.create_table(
        "products",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_products_name", "products", ["name"])
    op.create_index("ix_products_is_active", "products", ["is_active"])
    op.create_index("ix_products_created_at", "products", ["created_at"])

    op.create_table(
        "plans",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("billing_frequency", billing_frequency, nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("price", sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column("trial_days", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("trial_days >= 0", name="ck_plans_trial_days_non_negative"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_index("ix_plans_billing_frequency", "plans", ["billing_frequency"])
    op.create_index("ix_plans_is_active", "plans", ["is_active"])
    op.create_index("ix_plans_created_at", "plans", ["created_at"])

    op.create_table(
        "tax_rules",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("country_code", sa.String(length=2), nullable=False),
        sa.Column("rate", sa.Numeric(precision=7, scale=4), nullable=False),
        sa.Column("is_inclusive", sa.Boolean(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("valid_from", sa.DateTime(timezone=True)),
        sa.Column("valid_to", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("rate >= 0 AND rate <= 100", name="ck_tax_rules_rate_range"),
        sa.CheckConstraint("valid_to IS NULL OR valid_from IS NULL OR valid_from < valid_to", name="ck_tax_rules_validity_order"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", "country_code", name="uq_tax_rules_name_country"),
    )
    op.create_index("ix_tax_rules_country_code", "tax_rules", ["country_code"])
    op.create_index("ix_tax_rules_created_at", "tax_rules", ["created_at"])
    op.create_index("ix_tax_rules_active_validity", "tax_rules", ["is_active", "valid_from", "valid_to"])

    op.create_table(
        "discount_rules",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("discount_type", discount_type, nullable=False),
        sa.Column("value", sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column("max_discount_amount", sa.Numeric(precision=18, scale=2)),
        sa.Column("currency", sa.String(length=3)),
        sa.Column("eligibility", sa.JSON()),
        sa.Column("usage_limit", sa.Integer()),
        sa.Column("per_customer_usage_limit", sa.Integer()),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("valid_from", sa.DateTime(timezone=True)),
        sa.Column("valid_to", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("value > 0", name="ck_discount_rules_value_positive"),
        sa.CheckConstraint("discount_type != 'percentage' OR value <= 100", name="ck_discount_rules_percentage_maximum"),
        sa.CheckConstraint("usage_limit IS NULL OR usage_limit >= 0", name="ck_discount_rules_usage_limit"),
        sa.CheckConstraint("per_customer_usage_limit IS NULL OR per_customer_usage_limit >= 0", name="ck_discount_rules_per_customer_usage_limit"),
        sa.CheckConstraint("valid_to IS NULL OR valid_from IS NULL OR valid_from < valid_to", name="ck_discount_rules_validity_order"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code", name="uq_discount_rules_code"),
    )
    op.create_index("ix_discount_rules_created_at", "discount_rules", ["created_at"])
    op.create_index("ix_discount_rules_active_validity", "discount_rules", ["is_active", "valid_from", "valid_to"])

    op.create_table(
        "product_variants",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("product_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("sku", sa.String(length=100)),
        sa.Column("attributes", sa.JSON()),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("product_id", "name", name="uq_product_variants_product_name"),
        sa.UniqueConstraint("sku"),
    )
    op.create_index("ix_product_variants_product_id", "product_variants", ["product_id"])
    op.create_index("ix_product_variants_sku", "product_variants", ["sku"])
    op.create_index("ix_product_variants_is_active", "product_variants", ["is_active"])
    op.create_index("ix_product_variants_created_at", "product_variants", ["created_at"])

    op.create_table(
        "plan_products",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("plan_id", sa.Uuid(), nullable=False),
        sa.Column("product_id", sa.Uuid(), nullable=False),
        sa.Column("product_variant_id", sa.Uuid()),
        sa.Column("quantity", sa.Numeric(precision=14, scale=3), nullable=False),
        sa.Column("unit_price", sa.Numeric(precision=18, scale=2)),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.CheckConstraint("quantity > 0", name="ck_plan_products_quantity_positive"),
        sa.ForeignKeyConstraint(["plan_id"], ["plans.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["product_variant_id"], ["product_variants.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("plan_id", "position", name="uq_plan_products_plan_position"),
    )
    op.create_index("ix_plan_products_plan_id", "plan_products", ["plan_id"])
    op.create_index("ix_plan_products_product_id", "plan_products", ["product_id"])
    op.create_index("ix_plan_products_product_variant_id", "plan_products", ["product_variant_id"])
    op.create_index("uq_plan_products_plan_product_no_variant", "plan_products", ["plan_id", "product_id"], unique=True, postgresql_where=sa.text("product_variant_id IS NULL"))
    op.create_index("uq_plan_products_plan_variant", "plan_products", ["plan_id", "product_variant_id"], unique=True, postgresql_where=sa.text("product_variant_id IS NOT NULL"))

    op.create_table(
        "subscriptions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("customer_id", sa.Uuid(), nullable=False),
        sa.Column("plan_id", sa.Uuid(), nullable=False),
        sa.Column("status", subscription_status, nullable=False),
        sa.Column("billing_frequency", subscription_billing_frequency, nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("current_period_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("next_billing_at", sa.DateTime(timezone=True)),
        sa.Column("paused_at", sa.DateTime(timezone=True)),
        sa.Column("resume_at", sa.DateTime(timezone=True)),
        sa.Column("cancel_at", sa.DateTime(timezone=True)),
        sa.Column("cancel_at_period_end", sa.Boolean(), nullable=False),
        sa.Column("auto_renew", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("current_period_start < current_period_end", name="ck_subscriptions_period_order"),
        sa.ForeignKeyConstraint(["customer_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["plan_id"], ["plans.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_subscriptions_customer_id", "subscriptions", ["customer_id"])
    op.create_index("ix_subscriptions_plan_id", "subscriptions", ["plan_id"])
    op.create_index("ix_subscriptions_next_billing_at", "subscriptions", ["next_billing_at"])
    op.create_index("ix_subscriptions_created_at", "subscriptions", ["created_at"])
    op.create_index("ix_subscriptions_status_next_billing", "subscriptions", ["status", "next_billing_at"])
    op.create_index("ix_subscriptions_customer_status", "subscriptions", ["customer_id", "status"])

    op.create_table(
        "quotation_templates",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("customer_id", sa.Uuid()),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("status", quotation_status, nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("valid_until", sa.DateTime(timezone=True)),
        sa.Column("converted_subscription_id", sa.Uuid()),
        sa.Column("converted_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["customer_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["converted_subscription_id"], ["subscriptions.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("converted_subscription_id"),
    )
    op.create_index("ix_quotation_templates_customer_id", "quotation_templates", ["customer_id"])
    op.create_index("ix_quotation_templates_valid_until", "quotation_templates", ["valid_until"])
    op.create_index("ix_quotation_templates_created_at", "quotation_templates", ["created_at"])
    op.create_index("ix_quotation_templates_customer_status", "quotation_templates", ["customer_id", "status"])

    op.create_table(
        "subscription_items",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("subscription_id", sa.Uuid(), nullable=False),
        sa.Column("plan_product_id", sa.Uuid()),
        sa.Column("product_id", sa.Uuid(), nullable=False),
        sa.Column("product_variant_id", sa.Uuid()),
        sa.Column("quantity", sa.Numeric(precision=14, scale=3), nullable=False),
        sa.Column("unit_price", sa.Numeric(precision=18, scale=2), nullable=False),
        sa.CheckConstraint("quantity > 0", name="ck_subscription_items_quantity_positive"),
        sa.ForeignKeyConstraint(["subscription_id"], ["subscriptions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["plan_product_id"], ["plan_products.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["product_variant_id"], ["product_variants.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_subscription_items_subscription_id", "subscription_items", ["subscription_id"])
    op.create_index("ix_subscription_items_plan_product_id", "subscription_items", ["plan_product_id"])

    op.create_table(
        "quotation_template_items",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("quotation_template_id", sa.Uuid(), nullable=False),
        sa.Column("product_id", sa.Uuid(), nullable=False),
        sa.Column("product_variant_id", sa.Uuid()),
        sa.Column("quantity", sa.Numeric(precision=14, scale=3), nullable=False),
        sa.Column("unit_price", sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.CheckConstraint("quantity > 0", name="ck_quotation_items_quantity_positive"),
        sa.ForeignKeyConstraint(["quotation_template_id"], ["quotation_templates.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["product_variant_id"], ["product_variants.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("quotation_template_id", "position", name="uq_quotation_items_position"),
    )
    op.create_index("ix_quotation_template_items_quotation_template_id", "quotation_template_items", ["quotation_template_id"])

    op.create_table(
        "invoices",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("invoice_number", sa.String(length=64), nullable=False),
        sa.Column("subscription_id", sa.Uuid(), nullable=False),
        sa.Column("customer_id", sa.Uuid(), nullable=False),
        sa.Column("status", invoice_status, nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("period_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("period_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("issued_at", sa.DateTime(timezone=True)),
        sa.Column("due_at", sa.DateTime(timezone=True)),
        sa.Column("subtotal", sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column("tax_total", sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column("discount_total", sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column("total", sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column("amount_paid", sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("period_start < period_end", name="ck_invoices_period_order"),
        sa.CheckConstraint("subtotal >= 0", name="ck_invoices_subtotal_non_negative"),
        sa.CheckConstraint("tax_total >= 0", name="ck_invoices_tax_total_non_negative"),
        sa.CheckConstraint("discount_total >= 0", name="ck_invoices_discount_total_non_negative"),
        sa.CheckConstraint("total >= 0", name="ck_invoices_total_non_negative"),
        sa.CheckConstraint("amount_paid >= 0", name="ck_invoices_amount_paid_non_negative"),
        sa.ForeignKeyConstraint(["subscription_id"], ["subscriptions.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["customer_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("invoice_number"),
        sa.UniqueConstraint("subscription_id", "period_start", "period_end", name="uq_invoices_subscription_period"),
        postgresql.ExcludeConstraint(
            ("subscription_id", "="),
            (sa.text("tstzrange(period_start, period_end, '[)')"), "&&"),
            name="excl_invoices_subscription_period_overlap",
            using="gist",
        ),
    )
    op.create_index("ix_invoices_invoice_number", "invoices", ["invoice_number"])
    op.create_index("ix_invoices_subscription_id", "invoices", ["subscription_id"])
    op.create_index("ix_invoices_customer_id", "invoices", ["customer_id"])
    op.create_index("ix_invoices_issued_at", "invoices", ["issued_at"])
    op.create_index("ix_invoices_due_at", "invoices", ["due_at"])
    op.create_index("ix_invoices_created_at", "invoices", ["created_at"])
    op.create_index("ix_invoices_customer_status_due", "invoices", ["customer_id", "status", "due_at"])
    op.create_index("ix_invoices_status_issued", "invoices", ["status", "issued_at"])

    op.create_table(
        "invoice_items",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("invoice_id", sa.Uuid(), nullable=False),
        sa.Column("product_id", sa.Uuid()),
        sa.Column("product_variant_id", sa.Uuid()),
        sa.Column("description", sa.String(length=500), nullable=False),
        sa.Column("quantity", sa.Numeric(precision=14, scale=3), nullable=False),
        sa.Column("unit_price", sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column("tax_rate", sa.Numeric(precision=7, scale=4), nullable=False),
        sa.Column("tax_amount", sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column("discount_amount", sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column("line_total", sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.CheckConstraint("quantity > 0", name="ck_invoice_items_quantity_positive"),
        sa.CheckConstraint("unit_price >= 0", name="ck_invoice_items_unit_price_non_negative"),
        sa.CheckConstraint("tax_amount >= 0", name="ck_invoice_items_tax_amount_non_negative"),
        sa.CheckConstraint("discount_amount >= 0", name="ck_invoice_items_discount_amount_non_negative"),
        sa.CheckConstraint("line_total >= 0", name="ck_invoice_items_line_total_non_negative"),
        sa.ForeignKeyConstraint(["invoice_id"], ["invoices.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["product_variant_id"], ["product_variants.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("invoice_id", "position", name="uq_invoice_items_position"),
    )
    op.create_index("ix_invoice_items_invoice_id", "invoice_items", ["invoice_id"])

    op.create_table(
        "payments",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("invoice_id", sa.Uuid(), nullable=False),
        sa.Column("customer_id", sa.Uuid(), nullable=False),
        sa.Column("status", payment_status, nullable=False),
        sa.Column("provider", sa.String(length=50), nullable=False),
        sa.Column("provider_reference", sa.String(length=255)),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("amount", sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column("applied_amount", sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column("paid_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("amount > 0", name="ck_payments_amount_positive"),
        sa.CheckConstraint("applied_amount >= 0", name="ck_payments_applied_amount_non_negative"),
        sa.CheckConstraint("applied_amount <= amount", name="ck_payments_applied_amount_within_amount"),
        sa.ForeignKeyConstraint(["invoice_id"], ["invoices.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["customer_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("provider", "provider_reference", name="uq_payments_provider_reference"),
    )
    op.create_index("ix_payments_invoice_id", "payments", ["invoice_id"])
    op.create_index("ix_payments_customer_id", "payments", ["customer_id"])
    op.create_index("ix_payments_paid_at", "payments", ["paid_at"])
    op.create_index("ix_payments_created_at", "payments", ["created_at"])
    op.create_index("ix_payments_invoice_status", "payments", ["invoice_id", "status"])
    op.create_index("ix_payments_customer_created", "payments", ["customer_id", "created_at"])

    op.create_table(
        "discount_redemptions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("discount_rule_id", sa.Uuid(), nullable=False),
        sa.Column("invoice_id", sa.Uuid(), nullable=False),
        sa.Column("customer_id", sa.Uuid(), nullable=False),
        sa.Column("discount_amount", sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column("redeemed_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("discount_amount > 0", name="ck_discount_redemptions_amount_positive"),
        sa.ForeignKeyConstraint(["discount_rule_id"], ["discount_rules.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["invoice_id"], ["invoices.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["customer_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("discount_rule_id", "invoice_id", name="uq_discount_redemptions_rule_invoice"),
    )
    op.create_index("ix_discount_redemptions_discount_rule_id", "discount_redemptions", ["discount_rule_id"])
    op.create_index("ix_discount_redemptions_invoice_id", "discount_redemptions", ["invoice_id"])
    op.create_index("ix_discount_redemptions_customer_id", "discount_redemptions", ["customer_id"])
    op.create_index("ix_discount_redemptions_rule_customer", "discount_redemptions", ["discount_rule_id", "customer_id"])

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("actor_id", sa.Uuid()),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("entity_type", sa.String(length=100), nullable=False),
        sa.Column("entity_id", sa.Uuid(), nullable=False),
        sa.Column("changes", sa.JSON()),
        sa.Column("ip_address", sa.String(length=45)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_audit_logs_actor_id", "audit_logs", ["actor_id"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])
    op.create_index("ix_audit_logs_entity_created", "audit_logs", ["entity_type", "entity_id", "created_at"])
    op.create_index("ix_audit_logs_actor_created", "audit_logs", ["actor_id", "created_at"])


def downgrade() -> None:
    # Table drops remove their indexes and constraints. Keep btree_gist installed: it
    # may be shared by other Supabase schemas or future migrations.
    op.drop_table("audit_logs")
    op.drop_table("discount_redemptions")
    op.drop_table("payments")
    op.drop_table("invoice_items")
    op.drop_table("invoices")
    op.drop_table("quotation_template_items")
    op.drop_table("subscription_items")
    op.drop_table("quotation_templates")
    op.drop_table("subscriptions")
    op.drop_table("plan_products")
    op.drop_table("product_variants")
    op.drop_table("discount_rules")
    op.drop_table("tax_rules")
    op.drop_table("plans")
    op.drop_table("products")
    op.drop_table("users")
    _drop_enums()
