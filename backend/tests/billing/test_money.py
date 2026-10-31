from decimal import Decimal, DecimalException

import pytest

from app.utils.money import (
    MoneyArithmeticError,
    calculate_percentage,
    quantize_money,
    to_decimal,
)


@pytest.mark.parametrize("value", [1.5, True, False])
def test_to_decimal_rejects_float_and_boolean(value: object) -> None:
    with pytest.raises(TypeError):
        to_decimal(value, "amount")


@pytest.mark.parametrize("value", ["not-a-number", "NaN", "Infinity", "-Infinity"])
def test_to_decimal_rejects_invalid_or_non_finite_values(value: str) -> None:
    with pytest.raises(ValueError, match="amount"):
        to_decimal(value, "amount")


def test_to_decimal_accepts_decimal_integer_and_numeric_string() -> None:
    assert to_decimal(Decimal("12.30")) == Decimal("12.30")
    assert to_decimal(12) == Decimal("12")
    assert to_decimal("12.30") == Decimal("12.30")


def test_quantize_money_uses_round_half_up() -> None:
    assert quantize_money("1.005") == Decimal("1.01")
    assert quantize_money("1.004") == Decimal("1.00")
    # Negative values are rounded consistently; invoice callers reject them
    # where the business field must be nonnegative.
    assert quantize_money("-1.005") == Decimal("-1.01")


def test_calculate_percentage_rounds_money_result() -> None:
    assert calculate_percentage("10.03", "10") == Decimal("1.00")


def test_percentage_rejects_out_of_range_values() -> None:
    with pytest.raises(ValueError, match="percentage"):
        calculate_percentage("10", "-1")
    with pytest.raises(ValueError, match="percentage"):
        calculate_percentage("10", "100.01")


@pytest.mark.parametrize("amount", ["-1", Decimal("-0.01")])
def test_percentage_rejects_negative_amount(amount: object) -> None:
    with pytest.raises(ValueError, match="amount must be nonnegative"):
        calculate_percentage(amount, "10")


@pytest.mark.parametrize(
    ("amount", "percentage"),
    [("0", "10"), ("10", "0"), ("0", "0")],
)
def test_percentage_permits_zero_amount_and_percentage(
    amount: object, percentage: object
) -> None:
    assert calculate_percentage(amount, percentage) == Decimal("0.00")


@pytest.mark.parametrize("value", [Decimal("1e999999"), Decimal("9" * 27 + ".995")])
def test_unrepresentable_quantization_raises_documented_error(value: Decimal) -> None:
    with pytest.raises(MoneyArithmeticError, match="supported Decimal arithmetic context") as exc_info:
        quantize_money(value)
    assert isinstance(exc_info.value.__cause__, DecimalException)


def test_percentage_arithmetic_failure_preserves_decimal_cause() -> None:
    with pytest.raises(MoneyArithmeticError) as exc_info:
        calculate_percentage(Decimal("1e999999"), "100")
    assert isinstance(exc_info.value.__cause__, DecimalException)
