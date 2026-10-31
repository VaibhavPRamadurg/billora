# Billing calculation policy

## Scope

The calculation utilities are pure: they open no database sessions or trigger lifecycle
or worker actions. Step 4B's invoice-generation service calls them inside its database
transaction after selecting an active subscription and its immutable subscription-item
price snapshots.

## Currency and precision

- INR is the application default for newly created plans and quotation templates.
- Three-letter currency values remain supported. A discount with a configured currency
  applies only when it matches the invoice currency case-insensitively.
- Inputs reject floats and use `Decimal`. Money is rounded to two places with
  `ROUND_HALF_UP`; line subtotals are rounded before the invoice subtotal is summed.
- The deterministic order is line subtotal, discount, then tax.

## Subscription periods

`calculate_subscription_billing_period()` produces UTC, timezone-aware half-open
intervals: `[start_at, end_at)`. It supports the persisted `monthly`, `quarterly`, and
`yearly` frequencies and preserves clock time while resolving month ends and leap
years. The legacy date-only helpers remain available for their existing callers but
must not be used to create invoice periods.

Month-end recovery requires the original billing anchor timestamp. For example, a
January 31 schedule needs that anchor to recover March 31 after February 28/29. The
current subscription schema does not persist a dedicated billing-anchor field, so Step
4D must receive an approved anchor source or add a migration before automated renewals
can safely recover month-end schedules. Step 4B can use the existing activated period
boundaries directly for the initial invoice.

## Tax

`evaluate_persisted_tax_rule()` accepts the SQLAlchemy `TaxRule` model and a UTC
country/timestamp context. A rule applies only when active, country-matched, and valid
over `[valid_from, valid_to)`. Exclusive tax adds tax to the discounted net amount.
Inclusive tax treats the discounted amount as gross and extracts the tax component.
The MVP evaluates one selected tax rule; jurisdiction selection and compound taxes are
outside this milestone.

## Discounts

`evaluate_persisted_discount_rule()` accepts the SQLAlchemy `DiscountRule` model and
a context whose usage counts are supplied from committed `DiscountRedemption` records.
It honors active state, UTC validity windows, currency, global and per-customer limits,
fixed/percentage values, and `max_discount_amount`.

The supported `eligibility` JSON format is an object containing optional identifier
lists: `customer_ids`, `product_ids`, `plan_ids`, and `subscription_ids`. Any present
scope must match. The calculation utility does not query or mutate redemptions; Step
4B owns those transactional checks and writes.

## Step 4B interface

`SubscriptionItemInvoiceInput` and `calculate_subscription_invoice()` provide the
database-independent bridge from subscription-item snapshots to invoice totals. The
invoice service freezes a current product/variant display description because
`SubscriptionItem` does not persist one. Invoice-level discounts and tax are allocated
proportionally using a largest-remainder cent allocation, so persisted item amounts add
up exactly to the invoice totals.
