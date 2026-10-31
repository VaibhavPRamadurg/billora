# Billora

Billora is a subscription management platform for customer roles, products, plans, subscriptions, billing, payments, and revenue analytics. This repository provides the shared Phase 0 foundation for a three-person hackathon team.

## Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, Axios, TanStack Query
- Backend: Python and FastAPI
- Planned data layer: PostgreSQL, SQLAlchemy, Alembic
- Planned authentication: JWT and Argon2

## Local setup (macOS/Linux)

Copy the placeholder environment values before running services:

```bash
cp .env.example .env
```

Start the backend:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Check `http://localhost:8000/health` for `{"status":"ok"}`.

In a separate terminal, start the frontend:

```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal, normally `http://localhost:5173`.

## Collaboration

Create `feature/core-backend`, `feature/billing`, and `feature/frontend` manually after this shared foundation is committed to `main`. Keep implementation within the owning area, document changes to `docs/api-contract.md` before cross-team integration, and coordinate changes to root configuration files to avoid merge conflicts.
