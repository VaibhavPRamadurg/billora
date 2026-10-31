"""Database-independent tax rule validation and calculation."""

from dataclasses import dataclass
from decimal import Decimal

from app.services.billing.calculator import calculate_tax_amount
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
