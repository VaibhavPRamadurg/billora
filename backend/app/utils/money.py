"""Decimal-safe helpers for monetary calculations.

Arithmetic uses the active :mod:`decimal` context as its safety boundary. A
value that cannot be represented or quantized in that context raises
``MoneyArithmeticError`` rather than being truncated or replaced with zero.
The planned database ``NUMERIC`` precision must be selected to accommodate the
same supported range when persistence is introduced.
"""

from decimal import Decimal, DecimalException, InvalidOperation, ROUND_HALF_UP


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
