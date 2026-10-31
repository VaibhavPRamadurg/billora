"""Decimal-safe helpers for monetary calculations.

Arithmetic uses the active :mod:`decimal` context as its safety boundary. A
value that cannot be represented or quantized in that context raises
``MoneyArithmeticError`` rather than being truncated or replaced with zero.
The planned database ``NUMERIC`` precision must be selected to accommodate the
same supported range when persistence is introduced.
"""

from decimal import Decimal, DecimalException, InvalidOperation, ROUND_DOWN, ROUND_HALF_UP
from typing import Iterable


MONEY_QUANTUM = Decimal("0.01")


class MoneyArithmeticError(ArithmeticError):
    """A Decimal calculation exceeded the active arithmetic context."""


def to_decimal(value: object, field_name: str = "amount") -> Decimal:
    """Convert an accepted numeric input to a finite ``Decimal``.

    Floats and booleans are rejected so binary floating-point or boolean values
    cannot enter financial calculations accidentally.
    """
    if isinstance(value, bool):
        raise TypeError(f"{field_name} must not be a boolean")
    if isinstance(value, float):
        raise TypeError(f"{field_name} must not be a float; use Decimal or a numeric string")

    if isinstance(value, Decimal):
        decimal_value = value
    elif isinstance(value, int):
        decimal_value = Decimal(value)
    elif isinstance(value, str):
        try:
            decimal_value = Decimal(value)
        except InvalidOperation as exc:
            raise ValueError(f"{field_name} must be a valid numeric string") from exc
    else:
        raise TypeError(
            f"{field_name} must be a Decimal, integer, or numeric string"
        )

    if not decimal_value.is_finite():
        raise ValueError(f"{field_name} must be finite")
    return decimal_value


def quantize_money(value: object) -> Decimal:
    """Round a monetary value to two places using half-up rounding.

    This helper permits negative values because it is a rounding primitive;
    invoice-specific callers enforce nonnegative financial fields.
    """
    decimal_value = to_decimal(value)
    try:
        return decimal_value.quantize(MONEY_QUANTUM, rounding=ROUND_HALF_UP)
    except DecimalException as exc:
        raise MoneyArithmeticError(
            "money quantization exceeds the supported Decimal arithmetic context"
        ) from exc


def calculate_percentage(amount: object, percentage: object) -> Decimal:
    """Calculate ``amount * percentage / 100`` and round it as money."""
    decimal_amount = to_decimal(amount, "amount")
    if decimal_amount < 0:
        raise ValueError("amount must be nonnegative")
    decimal_percentage = to_decimal(percentage, "percentage")
    if decimal_percentage < 0 or decimal_percentage > 100:
        raise ValueError("percentage must be between 0 and 100")
    try:
        result = decimal_amount * decimal_percentage / Decimal("100")
    except DecimalException as exc:
        raise MoneyArithmeticError(
            "percentage calculation exceeds the supported Decimal arithmetic context"
        ) from exc
    return quantize_money(result)


def allocate_money_proportionally(total: object, weights: Iterable[object]) -> tuple[Decimal, ...]:
    """Allocate a rounded amount across nonnegative weights without losing cents.

    The largest-remainder rule assigns any remaining cents by descending fractional
    remainder, preserving input order as a deterministic tie-breaker.
    """
    allocated_total = quantize_money(total)
    if allocated_total < 0:
        raise ValueError("total must be nonnegative")
    decimal_weights = tuple(to_decimal(weight, "weight") for weight in weights)
    if any(weight < 0 for weight in decimal_weights):
        raise ValueError("weight must be nonnegative")
    if not decimal_weights:
        raise ValueError("weights must not be empty")
    if allocated_total == 0:
        return tuple(Decimal("0.00") for _ in decimal_weights)
    weight_sum = sum(decimal_weights, Decimal("0"))
    if weight_sum == 0:
        raise ValueError("weights must sum to more than zero for a positive total")

    try:
        exact_cents = tuple(allocated_total * Decimal("100") * weight / weight_sum for weight in decimal_weights)
    except DecimalException as exc:
        raise MoneyArithmeticError("money allocation exceeds the supported Decimal arithmetic context") from exc
    whole_cents = [int(value.to_integral_value(rounding=ROUND_DOWN)) for value in exact_cents]
    cents_remaining = int(allocated_total * Decimal("100")) - sum(whole_cents)
    ranked_indices = sorted(
        range(len(exact_cents)),
        key=lambda index: (exact_cents[index] - Decimal(whole_cents[index]), -index),
        reverse=True,
    )
    for index in ranked_indices[:cents_remaining]:
        whole_cents[index] += 1
    return tuple(Decimal(cents) / Decimal("100") for cents in whole_cents)
