from decimal import Decimal, DecimalException, Inexact, localcontext

import pytest

from app.services.billing.calculator import (
    DiscountInput,
    InvoiceLineInput,
    calculate_discount,
    calculate_invoice_totals,
    calculate_line_subtotal,
    calculate_subtotal,
    calculate_tax_amount,
)
from app.utils.money import MoneyArithmeticError


def line(description: str, quantity: object, unit_price: object) -> InvoiceLineInput:
    return InvoiceLineInput(description, quantity, unit_price)


def test_basic_calculation() -> None:
    totals = calculate_invoice_totals(
        [line("Service A", 2, "1000"), line("Service B", 1, "500")]
    )

    assert totals.line_subtotals == (Decimal("2000.00"), Decimal("500.00"))
    assert totals.subtotal == Decimal("2500.00")
    assert totals.discount_amount == Decimal("0.00")
    assert totals.taxable_amount == Decimal("2500.00")
    assert totals.tax_amount == Decimal("0.00")
    assert totals.total == Decimal("2500.00")


def test_percentage_discount_and_tax() -> None:
    totals = calculate_invoice_totals(
        [line("Subscription", 1, "2500")],
        DiscountInput("percentage", "10"),
        "18",
    )

    assert totals.discount_amount == Decimal("250.00")
    assert totals.taxable_amount == Decimal("2250.00")
    assert totals.tax_amount == Decimal("405.00")
    assert totals.total == Decimal("2655.00")


def test_fixed_discount() -> None:
    totals = calculate_invoice_totals(
        [line("Subscription", 1, "2500")],
        DiscountInput("fixed", "200"),
        "18",
    )

    assert totals.discount_amount == Decimal("200.00")
    assert totals.taxable_amount == Decimal("2300.00")
    assert totals.tax_amount == Decimal("414.00")
    assert totals.total == Decimal("2714.00")


def test_multiple_lines_sum_rounded_line_subtotals() -> None:
    totals = calculate_invoice_totals(
        [line("Fractional A", 1, "1.005"), line("Fractional B", 1, "1.005")]
    )

    assert totals.line_subtotals == (Decimal("1.01"), Decimal("1.01"))
    assert totals.subtotal == Decimal("2.02")


def test_zero_tax_equals_taxable_amount() -> None:
    totals = calculate_invoice_totals(
        [line("Subscription", 1, "100")],
        DiscountInput("fixed", "25"),
        "0",
    )

    assert totals.tax_amount == Decimal("0.00")
    assert totals.total == totals.taxable_amount == Decimal("75.00")


def test_full_percentage_discount_produces_zero_taxable_and_tax() -> None:
    totals = calculate_invoice_totals(
        [line("Subscription", 1, "100")], DiscountInput("percentage", "100"), "18"
    )

    assert totals.discount_amount == Decimal("100.00")
    assert totals.taxable_amount == Decimal("0.00")
    assert totals.tax_amount == Decimal("0.00")
    assert totals.total == Decimal("0.00")


def test_calculation_helpers_are_independently_testable() -> None:
    assert calculate_line_subtotal("2", "1000") == Decimal("2000.00")
    assert calculate_subtotal([line("A", 2, "1000")]) == Decimal("2000.00")
    assert calculate_discount("2500", DiscountInput("fixed", "200")) == Decimal("200.00")
    assert calculate_tax_amount("2300", "18") == Decimal("414.00")


@pytest.mark.parametrize(
    ("quantity", "unit_price", "message"),
    [(0, "10", "quantity"), (-1, "10", "quantity"), (1, "-10", "unit_price")],
)
def test_invalid_line_values(quantity: object, unit_price: object, message: str) -> None:
    with pytest.raises(ValueError, match=message):
        line("Service", quantity, unit_price)


def test_empty_invoice_lines_are_rejected() -> None:
    with pytest.raises(ValueError, match="at least one line item"):
        calculate_invoice_totals([])


def test_empty_description_is_rejected() -> None:
    with pytest.raises(ValueError, match="description"):
        line("  ", 1, "10")


def test_invalid_discount_inputs_are_rejected() -> None:
    with pytest.raises(ValueError, match="discount value"):
        DiscountInput("fixed", "-1")
    with pytest.raises(ValueError, match="cannot exceed 100"):
        DiscountInput("percentage", "100.01")
    with pytest.raises(ValueError, match="discount_type"):
        DiscountInput("unknown", "10")
    with pytest.raises(ValueError, match="cannot exceed subtotal"):
        calculate_discount("100", DiscountInput("fixed", "100.01"))


def test_invalid_tax_rates_are_rejected() -> None:
    with pytest.raises(ValueError, match="tax_rate_percent"):
        calculate_invoice_totals([line("Service", 1, "10")], tax_rate_percent="-1")
    with pytest.raises(ValueError, match="tax_rate_percent"):
        calculate_invoice_totals([line("Service", 1, "10")], tax_rate_percent="100.01")


def test_negative_taxable_amount_is_rejected() -> None:
    with pytest.raises(ValueError, match="taxable_amount must be nonnegative"):
        calculate_tax_amount("-1", "18")


def test_extreme_line_arithmetic_raises_without_partial_totals() -> None:
    with pytest.raises(MoneyArithmeticError) as exc_info:
        calculate_invoice_totals([line("Huge", 1, Decimal("1e999999"))])
    assert isinstance(exc_info.value.__cause__, DecimalException)


def test_subtotal_aggregation_arithmetic_failure_is_wrapped() -> None:
    large_line_amount = Decimal("9" * 26)
    with localcontext() as context:
        context.traps[Inexact] = True
        with pytest.raises(MoneyArithmeticError) as exc_info:
            calculate_invoice_totals(
                [
                    line("Large A", 1, large_line_amount),
                    line("Large B", 1, large_line_amount),
                ]
            )

    assert isinstance(exc_info.value.__cause__, DecimalException)


@pytest.mark.parametrize("value", [1.5, True, object()])
def test_calculator_invalid_input_types_are_clear(value: object) -> None:
    with pytest.raises(TypeError, match="quantity"):
        line("Service", value, "10")


@pytest.mark.parametrize("value", [1.5, True, "NaN", "Infinity", "invalid"])
def test_financial_inputs_reject_unsafe_values(value: object) -> None:
    with pytest.raises((TypeError, ValueError)):
        line("Service", value, "10")
