"""Transactional initial-invoice generation for active subscriptions only."""

from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.models import (
    DiscountRedemption,
    DiscountRule,
    Invoice,
    InvoiceItem,
    InvoiceStatus,
    Product,
    ProductVariant,
    Subscription,
    SubscriptionItem,
    SubscriptionStatus,
    TaxRule,
)
from app.services.billing.calculator import (
    SubscriptionItemInvoiceInput,
    calculate_subscription_invoice,
)
from app.services.billing.discounts import (
    PersistedDiscountContext,
    evaluate_persisted_discount_rule,
)
from app.services.billing.tax import TaxEvaluationContext, evaluate_persisted_tax_rule
from app.utils.money import allocate_money_proportionally, quantize_money


class InvoiceGenerationError(Exception):
    """Base class for safe invoice-generation errors."""


class InvoiceGenerationValidationError(InvoiceGenerationError):
    """The subscription or explicitly requested rule cannot be invoiced."""


class InvoiceGenerationConflict(InvoiceGenerationError):
    """The requested period conflicts with an existing invoice."""


class InvoiceGenerationDatabaseError(InvoiceGenerationError):
    """A database operation failed without a safe idempotent resolution."""


@dataclass(frozen=True, slots=True)
class InvoiceGenerationResult:
    """The generated or pre-existing invoice and whether this call created it."""

    invoice: Invoice
    created: bool


def get_invoice_with_items(db: Session, invoice_id: UUID) -> Invoice | None:
    """Load an invoice with immutable line snapshots for an API response."""
    return db.scalar(
        select(Invoice)
        .options(selectinload(Invoice.items))
        .where(Invoice.id == invoice_id)
    )


def generate_initial_invoice(
    db: Session,
    subscription_id: UUID,
    *,
    discount_code: str | None = None,
    commit: bool = True,
) -> InvoiceGenerationResult:
    """Persist one draft invoice for the subscription's current active period.

    The database's unique and exclusion constraints are the final concurrency guard.
    An ``IntegrityError`` is resolved only by checking for the exact already-created
    period; other conflicts are returned to the caller without retries.
    """
    subscription = db.scalar(
        select(Subscription)
        .options(selectinload(Subscription.items))
        .where(Subscription.id == subscription_id)
        .with_for_update()
    )
    if subscription is None:
        raise InvoiceGenerationValidationError("Subscription not found")
    return generate_subscription_period_invoice(
        db,
        subscription,
        discount_code=discount_code,
        commit=commit,
    )


def generate_subscription_period_invoice(
    db: Session,
    subscription: Subscription,
    *,
    discount_code: str | None = None,
    commit: bool = True,
) -> InvoiceGenerationResult:
    """Generate or retrieve an invoice for a locked subscription's current period.

    ``commit=False`` is for callers which own a larger transaction, notably the
    recurring worker. It flushes inside a savepoint so an invoice uniqueness race
    can be resolved without discarding the caller's subscription row lock.
    """
    period_start, period_end = _validate_billable_subscription(subscription)

    exact_invoice = _find_exact_invoice(
        db, subscription.id, period_start, period_end
    )
    if exact_invoice is not None:
        return InvoiceGenerationResult(invoice=exact_invoice, created=False)
    if _find_overlapping_invoice(
        db, subscription.id, period_start, period_end
    ) is not None:
        raise InvoiceGenerationConflict("An invoice already overlaps the subscription billing period")

    source_items = _invoice_source_items(db, subscription.items)
    base_calculation = calculate_subscription_invoice(source_items)
    discount_rule, discount_amount = _resolve_discount(
        db, subscription, base_calculation.totals.subtotal, discount_code, period_start
    )
    amount_after_discount = quantize_money(base_calculation.totals.subtotal - discount_amount)
    tax_evaluation = _resolve_tax(db, amount_after_discount, period_start)

    line_subtotals = base_calculation.totals.line_subtotals
    line_discounts = allocate_money_proportionally(discount_amount, line_subtotals)
    post_discount_amounts = tuple(
        quantize_money(subtotal - line_discount)
        for subtotal, line_discount in zip(line_subtotals, line_discounts, strict=True)
    )
    line_taxes = allocate_money_proportionally(tax_evaluation.tax_amount, post_discount_amounts)
    line_totals = tuple(
        quantize_money(post_discount + line_tax)
        if not _is_inclusive_tax(tax_evaluation.total_amount, amount_after_discount)
        else post_discount
        for post_discount, line_tax in zip(post_discount_amounts, line_taxes, strict=True)
    )

    invoice = Invoice(
        invoice_number=_invoice_number(),
        subscription_id=subscription.id,
        customer_id=subscription.customer_id,
        status=InvoiceStatus.DRAFT,
        currency=subscription.currency,
        period_start=period_start,
        period_end=period_end,
        subtotal=base_calculation.totals.subtotal,
        discount_total=discount_amount,
        tax_total=tax_evaluation.tax_amount,
        total=tax_evaluation.total_amount,
        amount_paid=Decimal("0.00"),
    )
    invoice.items = [
        InvoiceItem(
            product_id=source_item.product_id,
            product_variant_id=source_item.product_variant_id,
            description=source_item.description,
            quantity=source_item.quantity,
            unit_price=source_item.unit_price,
            tax_rate=tax_evaluation.tax_rate_percent,
            tax_amount=line_tax,
            discount_amount=line_discount,
            line_total=line_total,
            position=position,
        )
        for position, (source_item, line_discount, line_tax, line_total) in enumerate(
            zip(source_items, line_discounts, line_taxes, line_totals, strict=True)
        )
    ]
    redemption: DiscountRedemption | None = None
    if discount_rule is not None and discount_amount > 0:
        redemption = DiscountRedemption(
            discount_rule_id=discount_rule.id,
            invoice=invoice,
            customer_id=subscription.customer_id,
            discount_amount=discount_amount,
        )

    if not commit:
        try:
            with db.begin_nested():
                db.add(invoice)
                if redemption is not None:
                    db.add(redemption)
                db.flush()
        except IntegrityError:
            exact_invoice = _find_exact_invoice(
                db, subscription.id, period_start, period_end
            )
            if exact_invoice is not None:
                return InvoiceGenerationResult(invoice=exact_invoice, created=False)
            raise InvoiceGenerationConflict("Invoice generation conflicts with existing billing data") from None
        except SQLAlchemyError:
            raise InvoiceGenerationDatabaseError("Invoice generation could not be completed") from None
        return InvoiceGenerationResult(invoice=invoice, created=True)

    db.add(invoice)
    if redemption is not None:
        db.add(redemption)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        exact_invoice = _find_exact_invoice(
            db, subscription.id, period_start, period_end
        )
        if exact_invoice is not None:
            return InvoiceGenerationResult(invoice=exact_invoice, created=False)
        raise InvoiceGenerationConflict("Invoice generation conflicts with existing billing data") from None
    except SQLAlchemyError:
        db.rollback()
        raise InvoiceGenerationDatabaseError("Invoice generation could not be completed") from None

    db.refresh(invoice)
    return InvoiceGenerationResult(invoice=invoice, created=True)


def _validate_billable_subscription(subscription: Subscription) -> tuple[datetime, datetime]:
    if subscription.status != SubscriptionStatus.ACTIVE:
        raise InvoiceGenerationValidationError("Only active subscriptions can be invoiced")
    if subscription.current_period_start is None or subscription.current_period_end is None:
        raise InvoiceGenerationValidationError("Active subscriptions require billing period boundaries")
    period_start = _database_utc(subscription.current_period_start)
    period_end = _database_utc(subscription.current_period_end)
    if period_start >= period_end:
        raise InvoiceGenerationValidationError("Subscription billing period is invalid")
    if not subscription.items:
        raise InvoiceGenerationValidationError("Subscription has no billable items")
    return period_start, period_end


def _database_utc(value: datetime) -> datetime:
    """Normalize a persisted UTC timestamp, including SQLite test-dialect results."""
    if value.tzinfo is None or value.utcoffset() is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _find_exact_invoice(
    db: Session, subscription_id: UUID, period_start: datetime, period_end: datetime
) -> Invoice | None:
    return db.scalar(
        select(Invoice)
        .options(selectinload(Invoice.items))
        .where(
            Invoice.subscription_id == subscription_id,
            Invoice.period_start == period_start,
            Invoice.period_end == period_end,
        )
    )


def _find_overlapping_invoice(
    db: Session, subscription_id: UUID, period_start: datetime, period_end: datetime
) -> Invoice | None:
    return db.scalar(
        select(Invoice.id).where(
            Invoice.subscription_id == subscription_id,
            Invoice.period_start < period_end,
            Invoice.period_end > period_start,
        )
    )


def _invoice_source_items(
    db: Session, subscription_items: list[SubscriptionItem]
) -> tuple[SubscriptionItemInvoiceInput, ...]:
    source_items: list[SubscriptionItemInvoiceInput] = []
    for item in subscription_items:
        product = db.get(Product, item.product_id)
        if product is None:
            raise InvoiceGenerationValidationError("Subscription item product is unavailable")
        description = product.name
        if item.product_variant_id is not None:
            variant = db.get(ProductVariant, item.product_variant_id)
            if variant is None or variant.product_id != product.id:
                raise InvoiceGenerationValidationError("Subscription item variant is unavailable")
            description = f"{product.name} — {variant.name}"
        source_items.append(
            SubscriptionItemInvoiceInput(
                subscription_item_id=item.id,
                product_id=item.product_id,
                product_variant_id=item.product_variant_id,
                description=description,
                quantity=item.quantity,
                unit_price=item.unit_price,
            )
        )
    return tuple(source_items)


def _resolve_discount(
    db: Session,
    subscription: Subscription,
    subtotal: Decimal,
    discount_code: str | None,
    evaluated_at: datetime,
) -> tuple[DiscountRule | None, Decimal]:
    if discount_code is None:
        return None, Decimal("0.00")
    rule = db.scalar(
        select(DiscountRule)
        .where(DiscountRule.code == discount_code.strip())
        .with_for_update()
    )
    if rule is None:
        raise InvoiceGenerationValidationError("Discount code is not available")
    usage_count = db.scalar(
        select(func.count())
        .select_from(DiscountRedemption)
        .where(DiscountRedemption.discount_rule_id == rule.id)
    ) or 0
    customer_usage_count = db.scalar(
        select(func.count())
        .select_from(DiscountRedemption)
        .where(
            DiscountRedemption.discount_rule_id == rule.id,
            DiscountRedemption.customer_id == subscription.customer_id,
        )
    ) or 0
    try:
        evaluation = evaluate_persisted_discount_rule(
            subtotal,
            rule,
            PersistedDiscountContext(
                evaluated_at=evaluated_at,
                currency=subscription.currency,
                usage_count=usage_count,
                customer_usage_count=customer_usage_count,
                customer_id=subscription.customer_id,
                plan_id=subscription.plan_id,
                subscription_id=subscription.id,
                product_ids=frozenset(item.product_id for item in subscription.items),
            ),
        )
    except (TypeError, ValueError):
        raise InvoiceGenerationValidationError("Discount rule is invalid") from None
    if not evaluation.applies:
        raise InvoiceGenerationValidationError(
            f"Discount code cannot be applied: {evaluation.rejection_reason.value}"
        )
    return rule, evaluation.discount_amount


def _resolve_tax(
    db: Session, amount_after_discount: Decimal, evaluated_at: datetime
):
    try:
        evaluations = [
            evaluation
            for rule in db.scalars(select(TaxRule).where(TaxRule.is_active.is_(True))).all()
            if (
                evaluation := evaluate_persisted_tax_rule(
                    amount_after_discount,
                    rule,
                    TaxEvaluationContext(settings.billing_country, evaluated_at),
                )
            ).applies
        ]
    except (TypeError, ValueError):
        raise InvoiceGenerationValidationError("Tax rule is invalid") from None
    if len(evaluations) > 1:
        raise InvoiceGenerationConflict("Multiple tax rules apply to the configured billing country")
    if evaluations:
        return evaluations[0]
    return evaluate_persisted_tax_rule(
        amount_after_discount,
        TaxRule(
            name="No tax",
            country_code=settings.billing_country,
            rate=Decimal("0"),
            is_inclusive=False,
            is_active=True,
        ),
        TaxEvaluationContext(settings.billing_country, evaluated_at),
    )


def _is_inclusive_tax(total_amount: Decimal, amount_after_discount: Decimal) -> bool:
    """Inclusive tax leaves the discounted gross total unchanged."""
    return total_amount == amount_after_discount


def _invoice_number() -> str:
    """Generate a collision-resistant, non-sequential invoice identifier."""
    return f"INV-{uuid4().hex.upper()}"
