# Architecture

Billora is a modular monolith: one FastAPI deployable and one React client. This keeps the hackathon setup operationally small while establishing clear module boundaries.

Backend feature code should keep HTTP routes in `app/api/v1`, validation schemas in `app/schemas`, database models in `app/models`, business rules in `app/services`, and scheduled work in `app/workers`. Routes call services; services coordinate persistence and infrastructure. The `/api/v1` prefix is reserved for product APIs, while `/health` remains a simple health probe.

## Database infrastructure

Billora uses Supabase-hosted PostgreSQL through SQLAlchemy 2.x and the Psycopg 3 driver; it does not use the Supabase Python SDK. `app.db.base.Base` is the shared declarative base, while `app.db.session` supplies a lazily-created synchronous engine, a shared session factory, and the `get_db` FastAPI dependency. The engine uses pre-ping and a conservative pool for the managed database.

`DATABASE_URL` is loaded only by the backend from `backend/.env`. Supabase connection strings carry their own SSL settings (for example, `sslmode=require`) and must never be sent to the frontend or logged. `/api/v1/health/db` performs a minimal `SELECT 1` and intentionally returns a generic 503 response when the database is unavailable.

The frontend separates reusable components, layouts, routes, pages, API access, hooks, contexts, types, and utilities. Pages are organized by audience under `pages/admin`, `pages/customer`, and `pages/auth`.

## Team responsibilities

| Branch | Ownership |
| --- | --- |
| `feature/core-backend` | Database, authentication, products, plans, subscriptions |
| `feature/billing` | Billing, invoices, payments, tax, discounts, analytics |
| `feature/frontend` | React UI, routes, dashboards, API integration |

Avoid merge conflicts by keeping changes inside the owned area, coordinating updates to shared contracts and configuration first, and keeping commits small and focused. No branches are created by this Phase 0 setup.
