from datetime import datetime, timezone
from decimal import Decimal

import pytest

from app.models import TaxRule as PersistedTaxRule
from app.services.billing.tax import (
    PersistedTaxEvaluation,
    TaxCalculation,
    TaxEvaluationContext,
    TaxRejectionReason,
    TaxRule,
    calculate_tax,
    evaluate_persisted_tax_rule,
)


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


def persisted_rule(**overrides: object) -> PersistedTaxRule:
    fields: dict[str, object] = {
        "name": "GST",
        "country_code": "IN",
        "rate": Decimal("18"),
        "is_inclusive": False,
        "is_active": True,
        "valid_from": None,
        "valid_to": None,
    }
    fields.update(overrides)
    return PersistedTaxRule(**fields)


def test_persisted_exclusive_tax_uses_country_and_utc_validity() -> None:
    result = evaluate_persisted_tax_rule(
        "100.00",
        persisted_rule(valid_from=datetime(2026, 1, 1, tzinfo=timezone.utc)),
        TaxEvaluationContext("in", datetime(2026, 1, 1, tzinfo=timezone.utc)),
    )

    assert result == PersistedTaxEvaluation(
        applies=True,
        taxable_amount=Decimal("100.00"),
        tax_rate_percent=Decimal("18"),
        tax_amount=Decimal("18.00"),
        total_amount=Decimal("118.00"),
    )


def test_persisted_inclusive_tax_extracts_tax_after_discount() -> None:
    result = evaluate_persisted_tax_rule(
        "118.00",
        persisted_rule(is_inclusive=True),
        TaxEvaluationContext("IN", datetime(2026, 1, 1, tzinfo=timezone.utc)),
    )

    assert result.taxable_amount == Decimal("100.00")
    assert result.tax_amount == Decimal("18.00")
    assert result.total_amount == Decimal("118.00")


@pytest.mark.parametrize(
    ("rule", "reason"),
    [
        (persisted_rule(is_active=False), TaxRejectionReason.INACTIVE),
        (persisted_rule(country_code="US"), TaxRejectionReason.COUNTRY_MISMATCH),
        (persisted_rule(valid_to=datetime(2026, 1, 1, tzinfo=timezone.utc)), TaxRejectionReason.EXPIRED),
    ],
)
def test_persisted_tax_rules_reject_inapplicable_contexts(
    rule: PersistedTaxRule, reason: TaxRejectionReason
) -> None:
    result = evaluate_persisted_tax_rule(
        "100",
        rule,
        TaxEvaluationContext("IN", datetime(2026, 1, 1, tzinfo=timezone.utc)),
    )

    assert result.applies is False
    assert result.tax_amount == Decimal("0.00")
    assert result.rejection_reason is reason
