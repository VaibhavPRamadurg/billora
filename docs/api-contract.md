# API Contract

## Conventions

- Base API prefix: `/api/v1`
- Primary resource identifiers are UUIDs.
- JSON property names use `snake_case`.
- Decimal monetary amounts are serialized as strings, for example `"19.99"`, to avoid precision loss.
- Timestamps use UTC ISO 8601 format, for example `2026-10-31T10:15:30Z`.
- Protected endpoints use JWT Bearer authentication: `Authorization: Bearer <token>`.

## Errors

Product endpoints should consistently return:

```json
{
  "detail": "Human-readable explanation",
  "code": "machine_readable_error_code"
}
```

Use an appropriate HTTP status code. FastAPI validation responses may use the framework default until the team introduces a shared validation error adapter.

## Registration

`POST /api/v1/auth/register` creates a public customer account. The request accepts an
email address and password only; a client cannot choose `admin` or `staff` roles.

```json
{
  "email": "customer@example.com",
  "password": "at-least-eight-characters"
}
```

Successful responses return HTTP 201 and never include password hashes:

```json
{
  "id": "8fdf9e75-cf5d-4f01-a1e1-8ae86af5d9ef",
  "email": "customer@example.com",
  "role": "customer",
  "is_active": true,
  "created_at": "2026-10-31T10:15:30Z",
  "updated_at": "2026-10-31T10:15:30Z"
}
```

Duplicate normalized emails return HTTP 409. Invalid email addresses, passwords shorter
than eight characters, missing required fields, and role fields submitted by public
clients return HTTP 422.

## Login and authenticated profile

`POST /api/v1/auth/login` accepts the same normalized email and password fields as
registration. Invalid credentials and inactive accounts return HTTP 401.

```json
{
  "email": "customer@example.com",
  "password": "at-least-eight-characters"
}
```

Successful login response:

```json
{
  "access_token": "<signed-jwt>",
  "token_type": "bearer"
}
```

Use the token with protected endpoints, including `GET /api/v1/auth/me`:

```http
Authorization: Bearer <signed-jwt>
```

Tokens include the user UUID subject (`sub`), issued-at (`iat`), and expiration (`exp`)
claims and use `JWT_SECRET_KEY`, `JWT_ALGORITHM`, and `ACCESS_TOKEN_EXPIRE_MINUTES`
from the backend environment. Missing, invalid, expired, inactive-user, or
nonexistent-user tokens return HTTP 401. Authenticated users lacking a required role
return HTTP 403.

## Products and variants

All catalog endpoints require a Bearer token. Admins and staff can create and update;
only admins can delete. Customers can only retrieve active products and active variants
of active products. Catalog managers can also inspect inactive records.

| Method | Endpoint | Access |
| --- | --- | --- |
| `POST` | `/api/v1/products` | Admin, staff |
| `GET` | `/api/v1/products` | Authenticated users |
| `GET` | `/api/v1/products/{product_id}` | Authenticated users |
| `PATCH` | `/api/v1/products/{product_id}` | Admin, staff |
| `DELETE` | `/api/v1/products/{product_id}` | Admin |
| `POST` | `/api/v1/products/{product_id}/variants` | Admin, staff |
| `GET` | `/api/v1/products/{product_id}/variants` | Authenticated users |
| `GET` | `/api/v1/products/{product_id}/variants/{variant_id}` | Authenticated users |
| `PATCH` | `/api/v1/products/{product_id}/variants/{variant_id}` | Admin, staff |
| `DELETE` | `/api/v1/products/{product_id}/variants/{variant_id}` | Admin |

Create a product:

```json
{
  "name": "Premium support",
  "description": "Priority support coverage",
  "is_active": true
}
```

Create a variant:

```json
{
  "name": "Annual",
  "sku": "SUPPORT-ANNUAL",
  "attributes": {"term": "annual"},
  "is_active": true
}
```

List endpoints support `offset` and `limit` (1–100). Product listing additionally
supports `search` and, for admin/staff, `is_active`; variant listing supports
`is_active` for admin/staff. Product-variant ownership is always validated against the
URL's `product_id`.

Duplicate variant names within a product and duplicate non-null SKUs return HTTP 409.
Deleting a product or variant that is referenced by catalog composition or subscription
records returns HTTP 409 and the caller should deactivate it instead. Missing resources
return HTTP 404.

## Subscription plans

All plan endpoints require a Bearer token. Admins and staff can create and update plans
and their product associations; only admins can delete plans. Customers only retrieve
active plans and only see associations whose product and optional variant are active.

| Method | Endpoint | Access |
| --- | --- | --- |
| `POST` | `/api/v1/plans` | Admin, staff |
| `GET` | `/api/v1/plans` | Authenticated users |
| `GET` | `/api/v1/plans/{plan_id}` | Authenticated users |
| `PATCH` | `/api/v1/plans/{plan_id}` | Admin, staff |
| `DELETE` | `/api/v1/plans/{plan_id}` | Admin |
| `POST` | `/api/v1/plans/{plan_id}/products` | Admin, staff |
| `GET` | `/api/v1/plans/{plan_id}/products` | Authenticated users |
| `PATCH` | `/api/v1/plans/{plan_id}/products/{association_id}` | Admin, staff |
| `DELETE` | `/api/v1/plans/{plan_id}/products/{association_id}` | Admin, staff |

Create a plan using an existing billing frequency (`monthly`, `quarterly`, or `yearly`)
and a decimal amount serialized as a string:

```json
{
  "name": "Premium annual",
  "description": "Annual premium service",
  "billing_frequency": "yearly",
  "currency": "INR",
  "price": "120.00",
  "trial_days": 14,
  "is_active": true
}
```

Add a product to a plan, optionally selecting a variant and overriding the plan item
price. `unit_price` does not implement billing calculations; it is only the plan's
configured price data for Member 2's billing engine.

```json
{
  "product_id": "8fdf9e75-cf5d-4f01-a1e1-8ae86af5d9ef",
  "product_variant_id": "b7c5883c-2948-4bc4-9ec7-ea9b399cdc1f",
  "quantity": "1.000",
  "unit_price": "10.00",
  "position": 0
}
```

Plan listing supports `offset`, `limit` (1–100), `search`, `is_active` for catalog
managers, and `billing_frequency`. Product associations enforce that a variant belongs
to its selected product. Duplicate positions and duplicate product/variant associations
return HTTP 409. Plans referenced by subscriptions cannot be deleted and should instead
be deactivated. Existing association deletion follows the schema's `SET NULL` behavior
for downstream subscription-item references.

## Subscription lifecycle

Subscription endpoints require a Bearer token. Admins and staff create, update, and
transition subscriptions; customers can list and retrieve only their own subscriptions.
Customer-specific quotation data is stored on the subscription record for the MVP.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/v1/subscriptions` | Create a draft subscription |
| `GET` | `/api/v1/subscriptions` | List visible subscriptions |
| `GET` | `/api/v1/subscriptions/{subscription_id}` | Retrieve a visible subscription |
| `PATCH` | `/api/v1/subscriptions/{subscription_id}` | Update a draft only |
| `POST` | `/api/v1/subscriptions/{subscription_id}/quotation` | Draft → quotation |
| `POST` | `/api/v1/subscriptions/{subscription_id}/confirm` | Quotation → confirmed |
| `POST` | `/api/v1/subscriptions/{subscription_id}/activate` | Confirmed → active |
| `POST` | `/api/v1/subscriptions/{subscription_id}/pause` | Active → paused |
| `POST` | `/api/v1/subscriptions/{subscription_id}/resume` | Paused → active |
| `POST` | `/api/v1/subscriptions/{subscription_id}/close` | Active/paused → closed |
| `POST` | `/api/v1/subscriptions/{subscription_id}/cancel` | Active/paused → cancelled |
| `POST` | `/api/v1/subscriptions/{subscription_id}/expire` | Active/paused → expired |

Create a draft from an active plan and its plan-product associations. Values are copied
into immutable subscription-item snapshots; no billing calculation is performed.

```json
{
  "customer_id": "8fdf9e75-cf5d-4f01-a1e1-8ae86af5d9ef",
  "plan_id": "b7c5883c-2948-4bc4-9ec7-ea9b399cdc1f",
  "items": [
    {
      "plan_product_id": "eb892c57-f1f0-48ee-a37e-2b6cdfc967c5",
      "quantity": "1.000",
      "unit_price": "20.00"
    }
  ]
}
```

Activation requires ordered, timezone-aware UTC billing boundaries:

```json
{
  "current_period_start": "2026-01-01T00:00:00Z",
  "current_period_end": "2026-02-01T00:00:00Z"
}
```

Allowed transitions are `draft → quotation → confirmed → active`; `active ↔ paused`;
and `active` or `paused` to `closed`, `cancelled`, or `expired`. Terminal states cannot
transition further. Invalid transitions return HTTP 409. Expiration is an explicit
admin/staff operation now; a future scheduler may call the same transition after its
own eligibility checks. These endpoints do not generate invoices, charge payments, or
invoke Member 2's billing engine. Pre-activation subscriptions have null period bounds
and must not be selected for billing.

## Invoices

Invoice endpoints require a Bearer token. Admins and staff explicitly generate the
initial draft invoice for an active subscription; customers cannot generate invoices.
Generation uses the subscription's existing UTC half-open current period and does not
change its status or `next_billing_at`.

| Method | Endpoint | Access |
| --- | --- | --- |
| `POST` | `/api/v1/subscriptions/{subscription_id}/invoices/generate` | Admin, staff |
| `GET` | `/api/v1/invoices` | Authenticated users; customers see only their own |
| `GET` | `/api/v1/invoices/{invoice_id}` | Authenticated users; customers see only their own |
| `GET` | `/api/v1/invoices/{invoice_id}/pdf` | Authenticated users; customers see only their own |

An optional, explicit discount code can be supplied by an administrator or staff
member. Discounts are applied before the tax rule selected for the configured MVP
`BILLING_COUNTRY` (default `IN`); this configuration is not a customer address.

```json
{
  "discount_code": "WELCOME"
}
```

Successful new generation returns HTTP 201. Repeating the exact same subscription and
period returns the existing invoice with HTTP 200. An overlapping, non-identical period
returns HTTP 409. Only active subscriptions with non-null ordered period boundaries and
at least one snapshot item may be invoiced. No payment, PDF, lifecycle transition, or
recurring scheduling action occurs.

`GET /api/v1/invoices/{invoice_id}/pdf` returns an in-memory downloadable
`application/pdf` document. It is rendered from persisted invoice and invoice-item
snapshots and includes invoice details, the customer's stored email, line items,
discounts, tax, totals, amount paid, and outstanding balance. Customer access to a
different customer's PDF returns HTTP 404, matching invoice retrieval behavior.

## Payments

Payments are manual, immutable records for the MVP; no gateway integration, refund, or
payment-update endpoint exists. Admins and staff can record them, while customers can
only view payments for invoices they own.

| Method | Endpoint | Access |
| --- | --- | --- |
| `POST` | `/api/v1/invoices/{invoice_id}/payments` | Admin, staff |
| `GET` | `/api/v1/invoices/{invoice_id}/payments` | Authenticated invoice owner or manager |
| `GET` | `/api/v1/payments/{payment_id}` | Authenticated invoice owner or manager |

```json
{
  "provider": "manual",
  "provider_reference": "RECEIPT-2026-0001",
  "currency": "INR",
  "amount": "500.00",
  "status": "succeeded"
}
```

`provider_reference` is required for idempotency. Repeating the same provider/reference
and payment fields returns the original payment with HTTP 200; reusing it with different
data returns HTTP 409. Payment currency must match the invoice and the amount must be
positive and no greater than the current outstanding balance.

Only an explicit `succeeded` record is settled: it increases `invoice.amount_paid` and
sets the invoice to `partially_paid` or `paid`. `pending` and `failed` records have an
applied amount of zero and do not change the invoice balance. `refunded` is rejected in
this MVP because no refund allocation workflow exists. Draft, confirmed, and
partially-paid invoices are payable; paid and cancelled invoices are not. Payment
responses include the current `outstanding_balance`.

## Analytics

Analytics endpoints are available only to Admin and Staff users. Customers receive HTTP
403. Monetary values are returned as per-currency arrays; frontend clients must not sum
different currencies.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/analytics/overview` | Operational counts and global money totals |
| `GET` | `/api/v1/analytics/revenue` | Monthly invoiced and collected-revenue chart series |
| `GET` | `/api/v1/analytics/subscriptions` | Status and billing-frequency distribution |
| `GET` | `/api/v1/analytics/invoices` | Invoice status, balances, and recent summaries |

`/analytics/revenue` accepts optional inclusive `start_date` and `end_date` values in
`YYYY-MM-DD` format. Invoiced trends use persisted invoice creation timestamps because
draft invoices do not necessarily have `issued_at`; collected trends use `paid_at` from
successful payments only. Cancelled invoices are excluded from invoiced revenue.

Example overview response:

```json
{
  "total_customers": 42,
  "total_subscriptions": 56,
  "active_subscriptions": 39,
  "paused_subscriptions": 4,
  "total_invoiced": [{"currency": "INR", "amount": "125000.00"}],
  "total_collected": [{"currency": "INR", "amount": "93000.00"}],
  "outstanding_balance": [{"currency": "INR", "amount": "32000.00"}],
  "overdue_invoice_count": 3
}
```

Invoice balance summaries separate settled paid amounts, remaining partially-paid
balances, unpaid balances, and overdue balances. Overdue is calculated only where
`due_at` is before the current UTC time and `total > amount_paid`, independent of an
invoice status label.

Example revenue response:

```json
{
  "start_date": "2026-01-01",
  "end_date": "2026-03-31",
  "invoiced": [{"month": "2026-01", "currency": "INR", "amount": "42000.00"}],
  "collected": [{"month": "2026-01", "currency": "INR", "amount": "31500.00"}]
}
```

`/analytics/subscriptions` returns `by_status`, `by_billing_frequency`, `active_count`,
and `inactive_count`. `/analytics/invoices` returns `by_status`, per-currency
`balances` (`paid`, `partially_paid`, `unpaid`, and `overdue`), plus the most recent
invoice summaries. The optional `recent_limit` parameter is 1-50 and defaults to 10.
