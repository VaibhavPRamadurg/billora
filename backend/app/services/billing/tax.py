"""Database-independent tax rule validation and calculation."""

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal, DecimalException
from enum import StrEnum

from app.models import TaxRule as PersistedTaxRule
from app.services.billing.calculator import calculate_tax_amount
from app.services.billing.dates import validate_utc_timestamp
from app.utils.money import quantize_money, to_decimal


@dataclass(frozen=True, slots=True)
class TaxRule:
    """A percentage-only tax rule for an explicitly supplied taxable base."""

    rate_percent: Decimal

    def __post_init__(self) -> None:
        rate = to_decimal(self.rate_percent, "tax rate percent")
        if rate < 0 or rate > 100:
            raise ValueError("tax rate percent must be between 0 and 100")
        object.__setattr__(self, "rate_percent", rate)


@dataclass(frozen=True, slots=True)
class TaxCalculation:
    """The taxable base and tax produced by a tax rule."""

    taxable_base: Decimal
    rate_percent: Decimal
    tax_amount: Decimal


def calculate_tax(taxable_base: object, rule: TaxRule) -> TaxCalculation:
    """Calculate percentage tax on the supplied taxable base.

    The caller supplies the base explicitly. This engine does not infer
    jurisdictions, exemptions, or compound-tax behavior.
    """
    if not isinstance(rule, TaxRule):
        raise TypeError("rule must be a TaxRule")
    decimal_base = to_decimal(taxable_base, "taxable base")
    if decimal_base < 0:
        raise ValueError("taxable base must be nonnegative")
    rounded_base = quantize_money(decimal_base)
    return TaxCalculation(
        taxable_base=rounded_base,
        rate_percent=rule.rate_percent,
        tax_amount=calculate_tax_amount(rounded_base, rule.rate_percent),
    )


class TaxRejectionReason(StrEnum):
    """Reasons a persisted tax rule is not applicable to an invoice."""

    INACTIVE = "inactive"
    COUNTRY_MISMATCH = "country_mismatch"
    NOT_YET_VALID = "not_yet_valid"
    EXPIRED = "expired"


@dataclass(frozen=True, slots=True)
class TaxEvaluationContext:
    """Facts required to select a persisted tax rule deterministically."""

    country_code: str
    evaluated_at: datetime

    def __post_init__(self) -> None:
        if not isinstance(self.country_code, str) or len(self.country_code.strip()) != 2:
            raise ValueError("country_code must be a two-letter code")
        object.__setattr__(self, "country_code", self.country_code.strip().upper())
        object.__setattr__(
            self,
            "evaluated_at",
            validate_utc_timestamp(self.evaluated_at, "evaluated_at"),
        )


@dataclass(frozen=True, slots=True)
class PersistedTaxEvaluation:
    """Tax result expressed as net, tax, and gross monetary amounts."""

    applies: bool
    taxable_amount: Decimal
    tax_rate_percent: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    rejection_reason: TaxRejectionReason | None = None


def evaluate_persisted_tax_rule(
    amount_after_discount: object,
    rule: PersistedTaxRule,
    context: TaxEvaluationContext,
) -> PersistedTaxEvaluation:
    """Apply an active, valid persisted tax rule to a discounted invoice amount.

    For exclusive rules the supplied amount is net and tax is added. For inclusive
    rules it is gross and the tax component is extracted after the discount. Rule
    validity is ``[valid_from, valid_to)`` in UTC, matching invoice periods.
    """
    if not isinstance(rule, PersistedTaxRule):
        raise TypeError("rule must be a persisted TaxRule")
    if not isinstance(context, TaxEvaluationContext):
        raise TypeError("context must be a TaxEvaluationContext")
    amount = quantize_money(to_decimal(amount_after_discount, "amount_after_discount"))
    if amount < 0:
        raise ValueError("amount_after_discount must be nonnegative")

    if not rule.is_active:
        return _tax_rejected(amount, TaxRejectionReason.INACTIVE)
    if rule.country_code.strip().upper() != context.country_code:
        return _tax_rejected(amount, TaxRejectionReason.COUNTRY_MISMATCH)
    if rule.valid_from is not None and context.evaluated_at < validate_utc_timestamp(rule.valid_from, "rule.valid_from"):
        return _tax_rejected(amount, TaxRejectionReason.NOT_YET_VALID)
    if rule.valid_to is not None and context.evaluated_at >= validate_utc_timestamp(rule.valid_to, "rule.valid_to"):
        return _tax_rejected(amount, TaxRejectionReason.EXPIRED)

    rate = to_decimal(rule.rate, "tax rule rate")
    if rate < 0 or rate > 100:
        raise ValueError("tax rule rate must be between 0 and 100")
    if not rule.is_inclusive:
        tax_amount = calculate_tax_amount(amount, rate)
        return PersistedTaxEvaluation(
            applies=True,
            taxable_amount=amount,
            tax_rate_percent=rate,
            tax_amount=tax_amount,
            total_amount=quantize_money(amount + tax_amount),
        )

    try:
        tax_amount = quantize_money(amount * rate / (Decimal("100") + rate))
    except DecimalException as exc:
        raise ArithmeticError("inclusive tax calculation exceeds the supported Decimal context") from exc
    taxable_amount = quantize_money(amount - tax_amount)
    return PersistedTaxEvaluation(
        applies=True,
        taxable_amount=taxable_amount,
        tax_rate_percent=rate,
        tax_amount=tax_amount,
        total_amount=amount,
    )


def _tax_rejected(amount: Decimal, reason: TaxRejectionReason) -> PersistedTaxEvaluation:
    """Keep an inapplicable rule financially neutral."""
    return PersistedTaxEvaluation(
        applies=False,
        taxable_amount=amount,
        tax_rate_percent=Decimal("0"),
        tax_amount=Decimal("0.00"),
        total_amount=amount,
        rejection_reason=reason,
    )
