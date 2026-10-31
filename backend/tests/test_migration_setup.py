"""Alembic setup checks that do not open a database connection."""

import importlib.util
import io
from pathlib import Path

from alembic import op
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.operations import Operations
from alembic.script import ScriptDirectory


BACKEND_ROOT = Path(__file__).resolve().parents[1]
REVISION_PATH = BACKEND_ROOT / "alembic" / "versions" / "20261031_0001_initial_billora_schema.py"


def _load_revision_module():
    spec = importlib.util.spec_from_file_location("initial_billora_schema", REVISION_PATH)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_alembic_config_discovers_the_initial_revision() -> None:
    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    script_directory = ScriptDirectory.from_config(config)

    assert script_directory.get_current_head() == "20261031_0001"


def test_initial_revision_declares_postgresql_safety_requirements() -> None:
    migration = _load_revision_module()
    source = REVISION_PATH.read_text(encoding="utf-8")

    assert migration.revision == "20261031_0001"
    assert migration.down_revision is None
    assert "CREATE EXTENSION IF NOT EXISTS btree_gist" in source
    assert "tstzrange(period_start, period_end, '[)')" in source
    assert "excl_invoices_subscription_period_overlap" in source
    assert "DROP EXTENSION" not in source


def test_initial_revision_defines_all_shared_postgresql_enums() -> None:
    migration = _load_revision_module()

    assert {enum.name for enum in (
        migration.user_role,
        migration.billing_frequency,
        migration.subscription_billing_frequency,
        migration.subscription_status,
        migration.invoice_status,
        migration.payment_status,
        migration.discount_type,
        migration.quotation_status,
    )} == {
        "user_role",
        "billing_frequency",
        "subscription_billing_frequency",
        "subscription_status",
        "invoice_status",
        "payment_status",
        "discount_type",
        "quotation_status",
    }


def test_initial_revision_compiles_offline_for_postgresql() -> None:
    """Compile all operations to SQL without opening a Supabase connection."""
    migration = _load_revision_module()
    output = io.StringIO()
    context = MigrationContext.configure(
        dialect_name="postgresql",
        opts={"as_sql": True, "output_buffer": output},
    )
    op._proxy = Operations(context)
    try:
        migration.upgrade()
    finally:
        del op._proxy

    sql = output.getvalue()
    assert sql.count("CREATE TABLE") == 16
    assert "CREATE EXTENSION IF NOT EXISTS btree_gist" in sql
    assert "EXCLUDE USING gist" in sql
