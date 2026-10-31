from decimal import Decimal

import pytest

from app.services.billing.tax import TaxCalculation, TaxRule, calculate_tax


def test_tax_uses_explicit_taxable_base_and_existing_rounding() -> None:
    result = calculate_tax(Decimal("2250.005"), TaxRule("18"))

    assert result == TaxCalculation(
        taxable_base=Decimal("2250.01"),
        rate_percent=Decimal("18"),
        tax_amount=Decimal("405.00"),
    )


@pytest.mark.parametrize("rate", ["-0.01", "100.01"])
def test_tax_rate_must_be_between_zero_and_one_hundred(rate: object) -> None:
    with pytest.raises(ValueError, match="tax rate percent"):
        TaxRule(rate)


@pytest.mark.parametrize("rate", ["0", "18", "100"])
def test_valid_tax_rates_are_supported(rate: object) -> None:
    result = calculate_tax("100", TaxRule(rate))

    assert result.rate_percent == Decimal(str(rate))
    assert result.taxable_base == Decimal("100.00")
    assert result.tax_amount == Decimal(str(rate)).quantize(Decimal("0.01"))


def test_negative_taxable_base_is_rejected() -> None:
    with pytest.raises(ValueError, match="taxable base"):
        calculate_tax("-0.01", TaxRule("18"))


def test_invalid_tax_rule_and_base_types_are_rejected() -> None:
    with pytest.raises(TypeError, match="rule"):
        calculate_tax("100", "18")  # type: ignore[arg-type]
    with pytest.raises(TypeError, match="taxable base"):
        calculate_tax(1.5, TaxRule("18"))
