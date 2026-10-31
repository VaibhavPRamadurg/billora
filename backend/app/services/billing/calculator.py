"""Database-independent invoice financial calculations."""

from dataclasses import dataclass
from decimal import Decimal, DecimalException
from typing import Iterable
from uuid import UUID

from app.utils.money import (
    MoneyArithmeticError,
    calculate_percentage,
    quantize_money,
    to_decimal,
)


@dataclass(frozen=True, slots=True)
class InvoiceLineInput:
    """A validated invoice line used by the calculation engine."""

    description: str
    quantity: Decimal
    unit_price: Decimal

    def __post_init__(self) -> None:
        if not isinstance(self.description, str) or not self.description.strip():
            raise ValueError("description must not be empty")
        object.__setattr__(self, "description", self.description.strip())

        quantity = to_decimal(self.quantity, "quantity")
        if quantity <= 0:
            raise ValueError("quantity must be greater than zero")
        object.__setattr__(self, "quantity", quantity)

        unit_price = to_decimal(self.unit_price, "unit_price")
        if unit_price < 0:
            raise ValueError("unit_price must be nonnegative")
        object.__setattr__(self, "unit_price", unit_price)


@dataclass(frozen=True, slots=True)
class DiscountInput:
    """A validated fixed or percentage discount."""

    discount_type: str
    value: Decimal

    def __post_init__(self) -> None:
        if not isinstance(self.discount_type, str):
            raise TypeError("discount_type must be a string")
        discount_type = self.discount_type.strip().lower()
        if discount_type not in {"fixed", "percentage"}:
            raise ValueError("discount_type must be 'fixed' or 'percentage'")
        object.__setattr__(self, "discount_type", discount_type)

        value = to_decimal(self.value, "discount value")
        if value < 0:
            raise ValueError("discount value must be nonnegative")
        if discount_type == "percentage" and value > 100:
            raise ValueError("percentage discount cannot exceed 100")
        object.__setattr__(self, "value", value)


@dataclass(frozen=True, slots=True)
class InvoiceTotals:
    """Immutable, rounded invoice totals."""

    line_subtotals: tuple[Decimal, ...]
    subtotal: Decimal
    discount_amount: Decimal
    taxable_amount: Decimal
    tax_rate_percent: Decimal
    tax_amount: Decimal
    total: Decimal


@dataclass(frozen=True, slots=True)
class SubscriptionItemInvoiceInput:
    """Invoice-ready pricing snapshot supplied by Step 4B's persistence service.

    ``SubscriptionItem`` already preserves quantity and unit price. The invoice
    service must supply a human-readable description from its catalog snapshot,
    because the current subscription-item schema intentionally does not store one.
    """

    subscription_item_id: UUID
    product_id: UUID
    product_variant_id: UUID | None
    description: str
    quantity: Decimal
    unit_price: Decimal

    def as_invoice_line(self) -> InvoiceLineInput:
        """Convert this immutable source snapshot into a validated calculation line."""
        return InvoiceLineInput(self.description, self.quantity, self.unit_price)


@dataclass(frozen=True, slots=True)
class SubscriptionInvoiceCalculation:
    """Pure totals and source lines that Step 4B can persist transactionally."""

    source_items: tuple[SubscriptionItemInvoiceInput, ...]
    totals: InvoiceTotals


def calculate_line_subtotal(quantity: object, unit_price: object) -> Decimal:
    """Calculate and round one invoice line subtotal."""
    decimal_quantity = to_decimal(quantity, "quantity")
    if decimal_quantity <= 0:
        raise ValueError("quantity must be greater than zero")

    decimal_unit_price = to_decimal(unit_price, "unit_price")
    if decimal_unit_price < 0:
        raise ValueError("unit_price must be nonnegative")
    try:
        line_amount = decimal_quantity * decimal_unit_price
    except DecimalException as exc:
        raise MoneyArithmeticError(
            "line subtotal calculation exceeds the supported Decimal arithmetic context"
        ) from exc
    return quantize_money(line_amount)


def _validated_lines(lines: Iterable[InvoiceLineInput]) -> tuple[InvoiceLineInput, ...]:
    materialized = tuple(lines)
    if not materialized:
        raise ValueError("invoice must contain at least one line item")
    if any(not isinstance(line, InvoiceLineInput) for line in materialized):
        raise TypeError("lines must contain InvoiceLineInput instances")
    return materialized


def calculate_subtotal(lines: Iterable[InvoiceLineInput]) -> Decimal:
    """Sum correctly rounded line subtotals."""
    validated_lines = _validated_lines(lines)
    try:
        subtotal = sum(
            (calculate_line_subtotal(line.quantity, line.unit_price) for line in validated_lines),
            Decimal("0"),
        )
    except DecimalException as exc:
        raise MoneyArithmeticError(
            "subtotal calculation exceeds the supported Decimal arithmetic context"
        ) from exc
    return quantize_money(subtotal)


def calculate_discount(subtotal: object, discount: DiscountInput | None) -> Decimal:
    """Calculate a discount, rejecting discounts larger than the subtotal."""
    decimal_subtotal = to_decimal(subtotal, "subtotal")
    if decimal_subtotal < 0:
        raise ValueError("subtotal must be nonnegative")
    decimal_subtotal = quantize_money(decimal_subtotal)
    if discount is None:
        return Decimal("0.00")
    if not isinstance(discount, DiscountInput):
        raise TypeError("discount must be a DiscountInput or None")

    if discount.discount_type == "fixed":
        discount_amount = quantize_money(discount.value)
        if discount_amount > decimal_subtotal:
            raise ValueError("fixed discount cannot exceed subtotal")
        return discount_amount
    return calculate_percentage(decimal_subtotal, discount.value)


def calculate_tax_amount(taxable_amount: object, tax_rate_percent: object) -> Decimal:
    """Calculate and round invoice-level tax."""
    decimal_taxable_amount = to_decimal(taxable_amount, "taxable_amount")
    if decimal_taxable_amount < 0:
        raise ValueError("taxable_amount must be nonnegative")
    decimal_taxable_amount = quantize_money(decimal_taxable_amount)
    return calculate_percentage(decimal_taxable_amount, tax_rate_percent)


def calculate_invoice_totals(
    lines: Iterable[InvoiceLineInput],
    discount: DiscountInput | None = None,
    tax_rate_percent: object = Decimal("0"),
) -> InvoiceTotals:
    """Calculate invoice totals using the approved subtotal-to-tax sequence."""
    validated_lines = _validated_lines(lines)
    line_subtotals = tuple(
        calculate_line_subtotal(line.quantity, line.unit_price)
        for line in validated_lines
    )
    try:
        subtotal = quantize_money(sum(line_subtotals, Decimal("0")))
    except DecimalException as exc:
        raise MoneyArithmeticError(
            "subtotal aggregation exceeds the supported Decimal arithmetic context"
        ) from exc
    discount_amount = calculate_discount(subtotal, discount)
    try:
        taxable_amount = quantize_money(subtotal - discount_amount)
    except DecimalException as exc:
        raise MoneyArithmeticError(
            "taxable amount calculation exceeds the supported Decimal arithmetic context"
        ) from exc
    if taxable_amount < 0:
        raise ValueError("taxable_amount must be nonnegative")

    tax_rate = to_decimal(tax_rate_percent, "tax_rate_percent")
    if tax_rate < 0 or tax_rate > 100:
        raise ValueError("tax_rate_percent must be between 0 and 100")
    tax_amount = calculate_tax_amount(taxable_amount, tax_rate)
    try:
        total = quantize_money(taxable_amount + tax_amount)
    except DecimalException as exc:
        raise MoneyArithmeticError(
            "invoice total calculation exceeds the supported Decimal arithmetic context"
        ) from exc
    if total < 0:
        raise ValueError("total must be nonnegative")

    return InvoiceTotals(
        line_subtotals=line_subtotals,
        subtotal=subtotal,
        discount_amount=discount_amount,
        taxable_amount=taxable_amount,
        tax_rate_percent=tax_rate,
        tax_amount=tax_amount,
        total=total,
    )


def calculate_subscription_invoice(
    items: Iterable[SubscriptionItemInvoiceInput],
    discount: DiscountInput | None = None,
    tax_rate_percent: object = Decimal("0"),
) -> SubscriptionInvoiceCalculation:
    """Calculate pre-persistence invoice totals from subscription-item snapshots.

    This deliberately has no database side effects. Step 4B is responsible for
    selecting applicable persisted rules and allocating invoice-level tax and
    discounts to individual ``InvoiceItem`` rows in one transaction.
    """
    source_items = tuple(items)
    if not source_items:
        raise ValueError("invoice must contain at least one subscription item")
    if any(not isinstance(item, SubscriptionItemInvoiceInput) for item in source_items):
        raise TypeError("items must contain SubscriptionItemInvoiceInput instances")
    return SubscriptionInvoiceCalculation(
        source_items=source_items,
        totals=calculate_invoice_totals(
            (item.as_invoice_line() for item in source_items),
            discount=discount,
            tax_rate_percent=tax_rate_percent,
        ),
    )
