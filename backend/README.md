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
uvicorn app.main:app --reload
```

Check the application at `http://localhost:8000/health`. With a valid Supabase `DATABASE_URL`, check its connection at `http://localhost:8000/api/v1/health/db`.

Run the test suite without live Supabase credentials:

```bash
pytest
```
