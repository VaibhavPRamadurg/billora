"""Database-independent discount rule validation and evaluation."""

from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum
from typing import Iterable
from uuid import UUID

from app.models import DiscountRule as PersistedDiscountRule
from app.models import DiscountType
from app.services.billing.calculator import DiscountInput, calculate_discount
from app.services.billing.dates import validate_billing_date, validate_utc_timestamp
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
    INACTIVE = "inactive"
    CURRENCY_MISMATCH = "currency_mismatch"
    PER_CUSTOMER_USAGE_LIMIT_REACHED = "per_customer_usage_limit_reached"
    CUSTOMER_SCOPE_MISMATCH = "customer_scope_mismatch"
    PLAN_SCOPE_MISMATCH = "plan_scope_mismatch"
    MAX_DISCOUNT_REACHED = "max_discount_reached"


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


def _normalized_identifier(value: UUID | str | None, field_name: str) -> str | None:
    if value is None:
        return None
    if isinstance(value, UUID):
        return str(value)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{field_name} must be a UUID/string identifier or None")
    return value.strip()


@dataclass(frozen=True, slots=True)
class PersistedDiscountContext:
    """Database-derived facts required to evaluate a persisted discount rule.

    ``usage_count`` and ``customer_usage_count`` must be calculated by Step 4B
    from committed ``DiscountRedemption`` records while generating an invoice.
    """

    evaluated_at: datetime
    currency: str
    usage_count: int = 0
    customer_usage_count: int = 0
    customer_id: UUID | str | None = None
    plan_id: UUID | str | None = None
    subscription_id: UUID | str | None = None
    product_ids: frozenset[UUID | str] = field(default_factory=frozenset)

    def __post_init__(self) -> None:
        object.__setattr__(
            self, "evaluated_at", validate_utc_timestamp(self.evaluated_at, "evaluated_at")
        )
        if not isinstance(self.currency, str) or len(self.currency.strip()) != 3:
            raise ValueError("currency must be a three-letter code")
        object.__setattr__(self, "currency", self.currency.strip().upper())
        for field_name in ("usage_count", "customer_usage_count"):
            value = getattr(self, field_name)
            if isinstance(value, bool) or not isinstance(value, int) or value < 0:
                raise ValueError(f"{field_name} must be a nonnegative integer")
        for field_name in ("customer_id", "plan_id", "subscription_id"):
            object.__setattr__(self, field_name, _normalized_identifier(getattr(self, field_name), field_name))
        object.__setattr__(
            self,
            "product_ids",
            frozenset(
                _normalized_identifier(product_id, "product_ids")
                for product_id in self.product_ids
            ),
        )


def _scope_values(eligibility: dict[str, object] | None, key: str) -> frozenset[str]:
    """Read the documented identifier-list eligibility format from JSON."""
    if eligibility is None:
        return frozenset()
    if not isinstance(eligibility, dict):
        raise ValueError("discount eligibility must be a JSON object")
    value = eligibility.get(key)
    if value is None:
        return frozenset()
    if not isinstance(value, list):
        raise ValueError(f"discount eligibility {key} must be a list")
    normalized: set[str] = set()
    for identifier in value:
        if not isinstance(identifier, str) or not identifier.strip():
            raise ValueError(f"discount eligibility {key} must contain non-empty strings")
        normalized.add(identifier.strip())
    return frozenset(normalized)


def evaluate_persisted_discount_rule(
    eligible_subtotal: object,
    rule: PersistedDiscountRule,
    context: PersistedDiscountContext,
) -> DiscountEvaluation:
    """Evaluate a persisted rule before tax using its database-backed semantics.

    Supported ``eligibility`` JSON keys are identifier lists named
    ``customer_ids``, ``product_ids``, ``plan_ids``, and ``subscription_ids``.
    Validity is UTC ``[valid_from, valid_to)``. A configured max-discount cap is
    applied after calculating a fixed or percentage discount.
    """
    if not isinstance(rule, PersistedDiscountRule):
        raise TypeError("rule must be a persisted DiscountRule")
    if not isinstance(context, PersistedDiscountContext):
        raise TypeError("context must be a PersistedDiscountContext")
    subtotal = quantize_money(to_decimal(eligible_subtotal, "eligible subtotal"))
    if subtotal < 0:
        raise ValueError("eligible subtotal must be nonnegative")

    if not rule.is_active:
        return _rejected(DiscountRejectionReason.INACTIVE)
    if rule.currency is not None and rule.currency.strip().upper() != context.currency:
        return _rejected(DiscountRejectionReason.CURRENCY_MISMATCH)
    if rule.valid_from is not None and context.evaluated_at < validate_utc_timestamp(rule.valid_from, "rule.valid_from"):
        return _rejected(DiscountRejectionReason.NOT_STARTED)
    if rule.valid_to is not None and context.evaluated_at >= validate_utc_timestamp(rule.valid_to, "rule.valid_to"):
        return _rejected(DiscountRejectionReason.EXPIRED)
    if rule.usage_limit is not None and context.usage_count >= rule.usage_limit:
        return _rejected(DiscountRejectionReason.USAGE_LIMIT_REACHED)
    if rule.per_customer_usage_limit is not None and context.customer_usage_count >= rule.per_customer_usage_limit:
        return _rejected(DiscountRejectionReason.PER_CUSTOMER_USAGE_LIMIT_REACHED)

    customer_ids = _scope_values(rule.eligibility, "customer_ids")
    product_ids = _scope_values(rule.eligibility, "product_ids")
    plan_ids = _scope_values(rule.eligibility, "plan_ids")
    subscription_ids = _scope_values(rule.eligibility, "subscription_ids")
    if customer_ids and context.customer_id not in customer_ids:
        return _rejected(DiscountRejectionReason.CUSTOMER_SCOPE_MISMATCH)
    if product_ids and not product_ids.intersection(context.product_ids):
        return _rejected(DiscountRejectionReason.PRODUCT_SCOPE_MISMATCH)
    if plan_ids and context.plan_id not in plan_ids:
        return _rejected(DiscountRejectionReason.PLAN_SCOPE_MISMATCH)
    if subscription_ids and context.subscription_id not in subscription_ids:
        return _rejected(DiscountRejectionReason.SUBSCRIPTION_SCOPE_MISMATCH)

    discount_type = rule.discount_type.value if isinstance(rule.discount_type, DiscountType) else rule.discount_type
    try:
        amount = calculate_discount(subtotal, DiscountInput(discount_type, rule.value))
    except ValueError as exc:
        if "cannot exceed subtotal" not in str(exc):
            raise
        return _rejected(DiscountRejectionReason.EXCEEDS_ELIGIBLE_SUBTOTAL)
    if rule.max_discount_amount is not None:
        cap = quantize_money(to_decimal(rule.max_discount_amount, "max_discount_amount"))
        if cap < 0:
            raise ValueError("max_discount_amount must be nonnegative")
        amount = min(amount, cap)
    if amount == 0:
        return _rejected(DiscountRejectionReason.MAX_DISCOUNT_REACHED)
    return DiscountEvaluation(applies=True, discount_amount=amount)
