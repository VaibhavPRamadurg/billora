# Architecture

Billora is a modular monolith: one FastAPI deployable and one React client. This keeps the hackathon setup operationally small while establishing clear module boundaries.

Backend feature code should keep HTTP routes in `app/api/v1`, validation schemas in `app/schemas`, database models in `app/models`, business rules in `app/services`, and scheduled work in `app/workers`. Routes call services; services coordinate persistence and infrastructure. The `/api/v1` prefix is reserved for product APIs, while `/health` remains a simple health probe.

The frontend separates reusable components, layouts, routes, pages, API access, hooks, contexts, types, and utilities. Pages are organized by audience under `pages/admin`, `pages/customer`, and `pages/auth`.

## Team responsibilities

| Branch | Ownership |
| --- | --- |
| `feature/core-backend` | Database, authentication, products, plans, subscriptions |
| `feature/billing` | Billing, invoices, payments, tax, discounts, analytics |
| `feature/frontend` | React UI, routes, dashboards, API integration |

Avoid merge conflicts by keeping changes inside the owned area, coordinating updates to shared contracts and configuration first, and keeping commits small and focused. No branches are created by this Phase 0 setup.
