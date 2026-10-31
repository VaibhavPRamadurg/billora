# Billora backend

## Supabase PostgreSQL setup

1. Create a project in the [Supabase dashboard](https://supabase.com/dashboard).
2. In the project dashboard, open **Connect** and copy a PostgreSQL connection URI appropriate for direct connections or the supplied pooler.
3. Create `backend/.env` and set `DATABASE_URL` using the SQLAlchemy Psycopg dialect. Preserve the SSL query parameter supplied by Supabase, normally `sslmode=require`.

   ```env
   DATABASE_URL=postgresql+psycopg://postgres:YOUR_PASSWORD@db.YOUR_PROJECT.supabase.co:5432/postgres?sslmode=require
   JWT_SECRET_KEY=development-only-placeholder
   JWT_ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=30
   FRONTEND_URL=http://localhost:5173
   BILLING_COUNTRY=IN
   ```

   Do not commit this file. Database credentials remain server-side: the browser only receives the API base URL and must never receive a Supabase database password, service-role key, or direct connection string.

`BILLING_COUNTRY` is the MVP tax-country assumption used only by server-side invoice
generation. It defaults to `IN`; it is not a verified customer billing address.

## Run locally

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --reload-dir app
```

`--reload-dir app` limits development reload monitoring to Billora application
source code and prevents virtual-environment packages in `.venv` from triggering
restart loops.

Check the application at `http://localhost:8000/health`. With a valid Supabase `DATABASE_URL`, check its connection at `http://localhost:8000/api/v1/health/db`.

Run the test suite without live Supabase credentials:

```bash
pytest
```

## Create the initial administrator

After the approved migrations have been applied, a trusted local operator can create
the first administrator. The command reads the password (and its confirmation) from
the terminal; it never accepts a password argument and will not write unless
`--confirm` is supplied:

```bash
cd backend
source .venv/bin/activate
python scripts/bootstrap_admin.py --email admin@example.com --confirm
```

Omit `--email` to enter it interactively. The command applies the same email
normalization and password policy as registration, rejects an existing email without
changing its role, and uses `backend/.env` for the server-side Supabase connection.
Run it only from a secured operator machine; never expose the database URL, password,
or this capability to the frontend.

## Remediate a historical billing anchor

After revision `20261031_0003` has been reviewed and applied, recurring billing must
skip active or paused subscriptions whose `billing_anchor_at` is null. Never infer an
anchor from `started_at`, `current_period_start`, or `next_billing_at`. First obtain an
authoritative original billing timestamp, then use the local operator command below;
it changes only that one anchor after validating the stored cadence and invoice history.

```bash
cd backend
source .venv/bin/activate
python scripts/remediate_billing_anchor.py \
  --subscription-id 8fdf9e75-cf5d-4f01-a1e1-8ae86af5d9ef \
  --anchor-at 2026-01-31T00:00:00Z \
  --confirm
```

The anchor must use `Z` or `+00:00`; local offsets are rejected. The command never
changes subscription periods, lifecycle status, invoices, or payments.

To inventory records before remediation, run this read-only query manually against an
approved database connection (it is not run by Billora):

```sql
SELECT id, customer_id, billing_frequency, status, current_period_start, current_period_end
FROM subscriptions
WHERE status IN ('active', 'paused')
  AND billing_anchor_at IS NULL
ORDER BY current_period_start NULLS LAST, id;
```

## Run recurring billing manually

Recurring billing is intentionally an operator-run local batch in the MVP; no scheduler
or hosted job is configured. Review due records first without writing, then explicitly
confirm execution from a secured backend environment:

```bash
cd backend
source .venv/bin/activate
python scripts/run_recurring_billing.py --dry-run --batch-size 50
python scripts/run_recurring_billing.py --confirm --batch-size 50
```

The command emits one JSON record per processed, skipped, failed, or dry-run
subscription. It processes only active, due subscriptions and skips/report records with
missing anchors or malformed schedule data. A due subscription's current period is
invoiced first (or its existing manually generated invoice is reused), then exactly one
next anchored period is scheduled. Use the existing manual invoice endpoint immediately
after activation when an initial invoice must be issued in advance; the worker catches
up that initial period at its first due run if it was missed. Re-run the command to
process another overdue period; it never uses the worker execution time as a billing
anchor.

## Alembic migrations

Alembic reads `DATABASE_URL` from `backend/.env` through the same Pydantic settings
used by the application. The connection string is deliberately not stored in
`alembic.ini`.

Review the initial migration before any database operation:

```bash
cd backend
alembic history
alembic upgrade head --sql > initial-schema.sql
```

`--sql` renders PostgreSQL SQL for review and does not connect to or modify
Supabase. Do not run `alembic upgrade head` against a shared Supabase project until
the team approves the schema. The initial revision installs `btree_gist` only if
needed for the invoice-period overlap constraint. Its downgrade intentionally keeps
the extension because extensions can be shared by other schemas.

After the initial schema is approved and applied, create future model revisions with:

```bash
alembic revision --autogenerate -m "describe schema change"
```
