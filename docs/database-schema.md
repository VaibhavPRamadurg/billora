# Database Schema Design

This document defines Billora's Step 2A SQLAlchemy metadata. It does not create any Supabase tables; Alembic migrations will be introduced only after schema review.

## Shared conventions

- Every primary key is a UUID.
- All timestamps are `TIMESTAMP WITH TIME ZONE` and application defaults use UTC.
- Currency amounts use `NUMERIC(18,2)`, quantities use `NUMERIC(14,3)`, and rates use fixed-scale `NUMERIC`; no monetary field uses a floating-point type.
- The database URL is used only by the backend. Models neither open a connection nor call `Base.metadata.create_all()`.
- `created_at` and `updated_at` are included on durable editable records. Immutable events retain `created_at`/event timestamps.

## Authentication and catalog

| Table | Key columns | Relationships and constraints |
| --- | --- | --- |
| `users` | `email`, `hashed_password`, `role`, `is_active`, timestamps | Unique indexed email; role enum is `admin`, `staff`, or `customer`. |
| `products` | `name`, `description`, `is_active` | A product has variants and can appear in plans. |
| `product_variants` | `product_id`, `name`, `sku`, `attributes` | Unique `(product_id, name)` and optional globally unique SKU. |
| `plans` | `name`, `billing_frequency`, `price`, `currency`, `trial_days` | Unique name; frequency is monthly, quarterly, or yearly; non-negative trial length. |
| `plan_products` | `plan_id`, `product_id`, optional `product_variant_id`, `quantity`, optional `unit_price`, `position` | A plan's catalog composition and per-plan override price. Unique plan positions and PostgreSQL partial unique indexes prevent duplicate base-product or variant entries in a plan. |

## Subscriptions and quotations

| Table | Key columns | Relationships and constraints |
| --- | --- | --- |
| `subscriptions` | `customer_id`, `plan_id`, `status`, frequency snapshot, currency, optional `billing_anchor_at`, current-period bounds, `next_billing_at`, pause/resume/cancel fields | Indexed by customer/status and status/next billing time. New subscriptions default to `draft`. Pre-activation states (`draft`, `quotation`, `confirmed`) have no billing period; active/paused and all period-bearing records require both ordered UTC period timestamps. `billing_anchor_at` is the immutable original activation boundary used to preserve month-end and leap-year renewal schedules. `paused_at`, `resume_at`, `cancel_at`, `cancel_at_period_end`, and `auto_renew` support the lifecycle. Paused subscriptions are excluded by the billing worker, not a model hook. |
| `subscription_items` | `subscription_id`, plan-product reference, product/variant snapshots, quantity, `unit_price` | Non-negative quantity rule. Keeps chosen plan composition and price available even if the plan changes later. |
| `quotation_templates` | optional `customer_id`, status, currency, `valid_until`, `converted_subscription_id`, `converted_at` | Enables a quote/template to be linked once to its resulting subscription. Status supports draft through converted/cancelled. |
| `quotation_template_items` | quote ID, product/variant, quantity, unit price, position | Unique item position per quote and positive quantity. |

## Billing and finance

| Table | Key columns | Relationships and constraints |
| --- | --- | --- |
| `invoices` | subscription/customer, invoice number, status, period bounds, totals, `amount_paid` | Unique invoice number and unique `(subscription_id, period_start, period_end)` provide idempotent generation. A PostgreSQL exclusion constraint additionally prevents *overlapping* half-open billing periods for the same subscription. Indexed for customer/status/due date and finance reporting. |
| `invoice_items` | invoice, optional catalog references, description, quantity, unit price, tax rate/amount, discount amount, line total | Immutable financial snapshot fields preserve historic prices and tax values. Unique display position per invoice. |
| `payments` | invoice/customer, provider/reference, status, amount, `applied_amount`, `paid_at` | Provider/reference pair is unique when a provider reference exists. `0 <= applied_amount <= amount` supports partial payments; Member 2 updates invoice `amount_paid` and invoice status transactionally. |
| `tax_rules` | name, country, rate, inclusion flag, active and validity window | Rate constrained to 0–100 and validity bounds must be ordered. |
| `discount_rules` | unique code, fixed/percentage type, value, cap, currency, JSON eligibility, validity and limits | Percentage cannot exceed 100. Eligibility JSON accommodates customer/product/plan criteria; Member 2 owns its evaluation. |
| `discount_redemptions` | discount, invoice, customer, amount, redemption time | Unique discount/invoice pair prevents duplicate application; indexed for limit checks. |

## Audit

`audit_logs` captures optional actor, action, affected entity type/UUID, JSON change details, IP address, and UTC creation time. Composite indexes support entity and actor timelines.

## Billing-period guarantee

Invoices represent billing-in-advance periods as `[period_start, period_end)`. The unique constraint protects exact retries; `excl_invoices_subscription_period_overlap` protects overlapping periods. When migrations are added, they must create PostgreSQL's `btree_gist` extension before adding this GiST exclusion constraint, because it uses UUID equality alongside timestamp-range overlap.

## Subscription lifecycle

The persisted subscription workflow is `draft → quotation → confirmed → active → closed`,
with `paused`, `cancelled`, and `expired` retained as additional operational states.
Revision `20261031_0002` adds the four missing PostgreSQL enum labels without changing
existing rows. It makes period boundaries nullable only for pre-activation records and
sets the database and ORM default to `draft` for new subscriptions. The revision is
forward-only: PostgreSQL enum labels cannot be safely removed, so its downgrade refuses
to perform a destructive rollback.

Activation is the point at which application code must assign a valid billing period.
This schema migration deliberately does not create invoices or invoke billing behavior.

## Recurring billing anchor

Revision `20261031_0003` adds nullable `subscriptions.billing_anchor_at` as a UTC
timestamp. It is intentionally not backfilled: `started_at` can predate activation,
`current_period_start` changes after renewals, and `next_billing_at` can be cleared while
paused, so none can reliably reconstruct the original cadence.

When a subscription first transitions to `active`, the lifecycle API must set
`billing_anchor_at` to that initial `current_period_start` in the same transaction and
never change it. Pause/resume preserves it. A recurring worker calculates each next
half-open period from the previous period end, the persisted frequency, and this anchor
via `calculate_subscription_billing_period(..., anchor_at=billing_anchor_at)`.
Existing subscriptions with a null anchor must be skipped by recurring automation until
an operator supplies an authoritative anchor; guessing would drift month-end schedules.
The local `scripts/remediate_billing_anchor.py` command requires one subscription UUID,
an explicit UTC anchor, and `--confirm`; it validates known current/invoice periods but
does not alter them or any financial records.

## Decisions to confirm

1. `QuotationTemplate` is modeled as a customer-optional quotation record with a one-time `converted_subscription_id`, because no separate `Quotation` entity was requested. Confirm whether reusable templates and customer-issued quotations should instead be separate models.
2. Payment allocation is one payment to one invoice for the MVP. Partial payment is supported through `applied_amount`; allocating one payment across multiple invoices would require a future `payment_allocations` table.
3. Product/variant consistency (a variant must belong to the selected product) is validated in services initially. A cross-table SQL constraint is not practical; a migration-time trigger can be considered if needed.
