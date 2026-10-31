"""Add a durable recurring-billing anchor to subscriptions.

Revision ID: 20261031_0003
Revises: 20261031_0002
Create Date: 2026-10-31 00:00:02
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20261031_0003"
down_revision: Union[str, Sequence[str], None] = "20261031_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add an optional UTC anchor without deriving values for existing rows."""
    op.add_column(
        "subscriptions",
        sa.Column("billing_anchor_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    """Remove the additive anchor column when rolling back this unapplied revision."""
    op.drop_column("subscriptions", "billing_anchor_at")
