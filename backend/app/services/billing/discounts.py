"""Database-independent discount rule validation and evaluation."""

from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from enum import StrEnum
from typing import Iterable

from app.services.billing.calculator import DiscountInput, calculate_discount
from app.services.billing.dates import validate_billing_date
from app.utils.money import quantize_money, to_decimal


class DiscountRejectionReason(StrEnum):
    """Stable reasons a valid discount rule does not apply."""

    NOT_STARTED = "not_started"
    EXPIRED = "expired"
    INELIGIBLE = "ineligible"
    USAGE_LIMIT_REACHED = "usage_limit_reached"
    PRODUCT_SCOPE_MISMATCH = "product_scope_mismatch"
    SUBSCRIPTION_SCOPE_MISMATCH = "subscription_scope_mismatch"
    EXCEEDS_ELIGIBLE_SUBTOTAL = "exceeds_eligible_subtotal"


def _normalize_scope(values: Iterable[str] | None, field_name: str) -> frozenset[str]:
    if values is None:
        return frozenset()
    if isinstance(values, str):
        raise TypeError(f"{field_name} must be an iterable of strings, not a string")
    normalized: set[str] = set()
    for value in values:
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"{field_name} must contain non-empty strings")
        normalized.add(value.strip())
    return frozenset(normalized)


@dataclass(frozen=True, slots=True)
class DiscountRule:
    """A validated, non-persistent discount policy."""

    discount_type: str
    value: Decimal
    starts_on: date | None = None
    expires_on: date | None = None
    usage_limit: int | None = None
    product_ids: frozenset[str] = field(default_factory=frozenset)
    subscription_ids: frozenset[str] = field(default_factory=frozenset)

    def __post_init__(self) -> None:
        discount = DiscountInput(self.discount_type, self.value)
        object.__setattr__(self, "discount_type", discount.discount_type)
        object.__setattr__(self, "value", discount.value)

        if self.starts_on is not None:
            object.__setattr__(
                self, "starts_on", validate_billing_date(self.starts_on, "starts_on")
            )
        if self.expires_on is not None:
            object.__setattr__(
                self, "expires_on", validate_billing_date(self.expires_on, "expires_on")
            )
        if self.starts_on is not None and self.expires_on is not None:
            if self.starts_on > self.expires_on:
                raise ValueError("starts_on cannot be after expires_on")

        if self.usage_limit is not None:
            if isinstance(self.usage_limit, bool) or not isinstance(self.usage_limit, int):
                raise TypeError("usage_limit must be a nonnegative integer or None")
            if self.usage_limit < 0:
                raise ValueError("usage_limit must be nonnegative")

        object.__setattr__(self, "product_ids", _normalize_scope(self.product_ids, "product_ids"))
        object.__setattr__(
            self,
            "subscription_ids",
            _normalize_scope(self.subscription_ids, "subscription_ids"),
        )


@dataclass(frozen=True, slots=True)
class DiscountEvaluationContext:
    """Explicit facts used to evaluate a discount deterministically."""

    evaluation_date: date
    eligible: bool = True
    usage_count: int = 0
    product_ids: frozenset[str] = field(default_factory=frozenset)
    subscription_id: str | None = None

    def __post_init__(self) -> None:
        object.__setattr__(
            self,
            "evaluation_date",
            validate_billing_date(self.evaluation_date, "evaluation_date"),
        )
        if not isinstance(self.eligible, bool):
            raise TypeError("eligible must be a boolean")
        if isinstance(self.usage_count, bool) or not isinstance(self.usage_count, int):
            raise TypeError("usage_count must be a nonnegative integer")
        if self.usage_count < 0:
            raise ValueError("usage_count must be nonnegative")
        object.__setattr__(self, "product_ids", _normalize_scope(self.product_ids, "product_ids"))
        if self.subscription_id is not None:
            if not isinstance(self.subscription_id, str) or not self.subscription_id.strip():
                raise ValueError("subscription_id must be a non-empty string or None")
            object.__setattr__(self, "subscription_id", self.subscription_id.strip())


@dataclass(frozen=True, slots=True)
class DiscountEvaluation:
    """Result of evaluating a discount rule against a subtotal and context."""

    applies: bool
    discount_amount: Decimal
    rejection_reason: DiscountRejectionReason | None = None


def evaluate_discount(
    eligible_subtotal: object,
    rule: DiscountRule,
    context: DiscountEvaluationContext,
) -> DiscountEvaluation:
    """Evaluate a discount and calculate its amount when all rules pass.

    Activation and expiration dates are inclusive. An empty product or
    subscription scope means the rule is not restricted by that dimension.
    ``eligible_subtotal`` must already represent only the subtotal eligible for
    this rule; scope matching does not inspect invoice lines.
    """
    if not isinstance(rule, DiscountRule):
        raise TypeError("rule must be a DiscountRule")
    if not isinstance(context, DiscountEvaluationContext):
        raise TypeError("context must be a DiscountEvaluationContext")

    decimal_subtotal = to_decimal(eligible_subtotal, "eligible subtotal")
    if decimal_subtotal < 0:
        raise ValueError("eligible subtotal must be nonnegative")
    rounded_subtotal = quantize_money(decimal_subtotal)
    evaluation_date = context.evaluation_date

    if rule.starts_on is not None and evaluation_date < rule.starts_on:
        return _rejected(DiscountRejectionReason.NOT_STARTED)
    if rule.expires_on is not None and evaluation_date > rule.expires_on:
        return _rejected(DiscountRejectionReason.EXPIRED)
    if not context.eligible:
        return _rejected(DiscountRejectionReason.INELIGIBLE)
    if rule.usage_limit is not None and context.usage_count >= rule.usage_limit:
        return _rejected(DiscountRejectionReason.USAGE_LIMIT_REACHED)
    if rule.product_ids and not rule.product_ids.intersection(context.product_ids):
        return _rejected(DiscountRejectionReason.PRODUCT_SCOPE_MISMATCH)
    if rule.subscription_ids and context.subscription_id not in rule.subscription_ids:
        return _rejected(DiscountRejectionReason.SUBSCRIPTION_SCOPE_MISMATCH)

    discount = DiscountInput(rule.discount_type, rule.value)
    try:
        amount = calculate_discount(rounded_subtotal, discount)
    except ValueError as exc:
        if "cannot exceed subtotal" not in str(exc):
            raise
        return _rejected(DiscountRejectionReason.EXCEEDS_ELIGIBLE_SUBTOTAL)
    return DiscountEvaluation(applies=True, discount_amount=amount)


def _rejected(reason: DiscountRejectionReason) -> DiscountEvaluation:
    return DiscountEvaluation(
        applies=False,
        discount_amount=Decimal("0.00"),
        rejection_reason=reason,
    )
