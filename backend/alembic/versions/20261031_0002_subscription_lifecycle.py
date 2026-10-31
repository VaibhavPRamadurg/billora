"""Extend subscription lifecycle states and defer periods until activation.

Revision ID: 20261031_0002
Revises: 20261031_0001
Create Date: 2026-10-31 00:00:01
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20261031_0002"
down_revision: Union[str, Sequence[str], None] = "20261031_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


PERIOD_VALIDITY_CONSTRAINT = """
(
    (status IN ('draft', 'quotation', 'confirmed')
        AND current_period_start IS NULL
        AND current_period_end IS NULL)
    OR
    (current_period_start IS NOT NULL
        AND current_period_end IS NOT NULL
        AND current_period_start < current_period_end)
)
"""


def upgrade() -> None:
    """Add forward-only lifecycle support while preserving existing subscriptions."""
    # PostgreSQL must commit newly added enum labels before they can be used by the
    # status default and check constraint below. This does not touch existing rows.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'draft' BEFORE 'active'")
        op.execute("ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'quotation' AFTER 'draft'")
        op.execute("ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'confirmed' AFTER 'quotation'")
        op.execute("ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'closed' AFTER 'paused'")

    op.drop_constraint("ck_subscriptions_period_order", "subscriptions", type_="check")
    op.alter_column(
        "subscriptions",
        "current_period_start",
        existing_type=sa.DateTime(timezone=True),
        nullable=True,
    )
    op.alter_column(
        "subscriptions",
        "current_period_end",
        existing_type=sa.DateTime(timezone=True),
        nullable=True,
    )
    op.alter_column(
        "subscriptions",
        "status",
        existing_type=sa.String(),
        existing_nullable=False,
        server_default=sa.text("'draft'"),
    )
    op.create_check_constraint("ck_subscriptions_period_order", "subscriptions", PERIOD_VALIDITY_CONSTRAINT)


def downgrade() -> None:
    """Refuse destructive enum rollback; PostgreSQL cannot safely remove labels."""
    raise NotImplementedError(
        "20261031_0002 is forward-only because PostgreSQL enum labels cannot be safely removed"
    )
