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
   ```

   Do not commit this file. Database credentials remain server-side: the browser only receives the API base URL and must never receive a Supabase database password, service-role key, or direct connection string.

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
