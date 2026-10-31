from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import uuid4

import pytest

from app.services.billing.discounts import (
    DiscountEvaluation,
    DiscountEvaluationContext,
    DiscountRejectionReason,
    DiscountRule,
    PersistedDiscountContext,
    evaluate_discount,
    evaluate_persisted_discount_rule,
)
from app.models import DiscountRule as PersistedDiscountRule, DiscountType


def context(**kwargs: object) -> DiscountEvaluationContext:
    return DiscountEvaluationContext(date(2026, 6, 15), **kwargs)


def test_fixed_discount_applies() -> None:
    result = evaluate_discount(
        "2500",
        DiscountRule("fixed", "200"),
        context(),
    )

    assert result == DiscountEvaluation(True, Decimal("200.00"))


def test_percentage_discount_applies() -> None:
    result = evaluate_discount(
        "2500",
        DiscountRule("percentage", "10"),
        context(),
    )

    assert result == DiscountEvaluation(True, Decimal("250.00"))


@pytest.mark.parametrize(
    ("rule", "evaluation_date", "reason"),
    [
        (
            DiscountRule("fixed", "10", starts_on=date(2026, 6, 16)),
            date(2026, 6, 15),
            DiscountRejectionReason.NOT_STARTED,
        ),
        (
            DiscountRule("fixed", "10", expires_on=date(2026, 6, 14)),
            date(2026, 6, 15),
            DiscountRejectionReason.EXPIRED,
        ),
    ],
)
def test_date_boundaries_reject_outside_activation_window(
    rule: DiscountRule,
    evaluation_date: date,
    reason: DiscountRejectionReason,
) -> None:
    result = evaluate_discount(
        "100",
        rule,
        DiscountEvaluationContext(evaluation_date),
    )

    assert result.applies is False
    assert result.discount_amount == Decimal("0.00")
    assert result.rejection_reason is reason


def test_activation_and_expiration_dates_are_inclusive() -> None:
    rule = DiscountRule(
        "fixed",
        "10",
        starts_on=date(2026, 6, 15),
        expires_on=date(2026, 6, 15),
    )

    result = evaluate_discount("100", rule, context())

    assert result == DiscountEvaluation(True, Decimal("10.00"))


def test_eligibility_failure_is_reported() -> None:
    result = evaluate_discount(
        "100",
        DiscountRule("fixed", "10"),
        context(eligible=False),
    )

    assert result.rejection_reason is DiscountRejectionReason.INELIGIBLE
    assert result.discount_amount == Decimal("0.00")


def test_usage_limit_is_checked_against_prior_usage() -> None:
    result = evaluate_discount(
        "100",
        DiscountRule("fixed", "10", usage_limit=2),
        context(usage_count=2),
    )

    assert result.rejection_reason is DiscountRejectionReason.USAGE_LIMIT_REACHED


def test_product_scope_requires_a_matching_product() -> None:
    rule = DiscountRule("fixed", "10", product_ids={"product-a"})

    rejected = evaluate_discount("100", rule, context(product_ids={"product-b"}))
    accepted = evaluate_discount("100", rule, context(product_ids={"product-a"}))

    assert rejected.rejection_reason is DiscountRejectionReason.PRODUCT_SCOPE_MISMATCH
    assert accepted.applies is True


def test_subscription_scope_requires_a_matching_subscription() -> None:
    rule = DiscountRule("fixed", "10", subscription_ids={"subscription-a"})

    rejected = evaluate_discount("100", rule, context(subscription_id="subscription-b"))
    accepted = evaluate_discount("100", rule, context(subscription_id="subscription-a"))

    assert rejected.rejection_reason is DiscountRejectionReason.SUBSCRIPTION_SCOPE_MISMATCH
    assert accepted.applies is True


def test_discount_exceeding_eligible_subtotal_is_rejected() -> None:
    result = evaluate_discount(
        "100",
        DiscountRule("fixed", "100.01"),
        context(),
    )

    assert result.applies is False
    assert result.rejection_reason is DiscountRejectionReason.EXCEEDS_ELIGIBLE_SUBTOTAL
    assert result.discount_amount == Decimal("0.00")


def test_invalid_discount_rule_values_raise() -> None:
    with pytest.raises(ValueError, match="cannot exceed 100"):
        DiscountRule("percentage", "100.01")
    with pytest.raises(ValueError, match="discount value"):
        DiscountRule("fixed", "-1")
    with pytest.raises(ValueError, match="starts_on"):
        DiscountRule(
            "fixed",
            "10",
            starts_on=date(2026, 6, 16),
            expires_on=date(2026, 6, 15),
        )


def test_invalid_evaluation_inputs_raise() -> None:
    with pytest.raises(ValueError, match="eligible subtotal"):
        evaluate_discount("-0.01", DiscountRule("fixed", "1"), context())
    with pytest.raises(TypeError, match="usage_count"):
        DiscountEvaluationContext(date(2026, 6, 15), usage_count=True)  # type: ignore[arg-type]
    with pytest.raises(ValueError, match="usage_count"):
        DiscountEvaluationContext(date(2026, 6, 15), usage_count=-1)


def persisted_rule(**overrides: object) -> PersistedDiscountRule:
    fields: dict[str, object] = {
        "code": "WELCOME",
        "name": "Welcome discount",
        "discount_type": DiscountType.PERCENTAGE,
        "value": Decimal("10"),
        "max_discount_amount": None,
        "currency": "INR",
        "eligibility": None,
        "usage_limit": None,
        "per_customer_usage_limit": None,
        "is_active": True,
        "valid_from": None,
        "valid_to": None,
    }
    fields.update(overrides)
    return PersistedDiscountRule(**fields)


def persisted_context(**overrides: object) -> PersistedDiscountContext:
    fields: dict[str, object] = {
        "evaluated_at": datetime(2026, 6, 15, tzinfo=timezone.utc),
        "currency": "INR",
    }
    fields.update(overrides)
    return PersistedDiscountContext(**fields)


def test_persisted_discount_applies_cap_before_tax() -> None:
    result = evaluate_persisted_discount_rule(
        "2500",
        persisted_rule(max_discount_amount=Decimal("125.00")),
        persisted_context(),
    )

    assert result == DiscountEvaluation(True, Decimal("125.00"))


@pytest.mark.parametrize(
    ("rule", "context", "reason"),
    [
        (persisted_rule(is_active=False), persisted_context(), DiscountRejectionReason.INACTIVE),
        (persisted_rule(currency="USD"), persisted_context(), DiscountRejectionReason.CURRENCY_MISMATCH),
        (persisted_rule(usage_limit=1), persisted_context(usage_count=1), DiscountRejectionReason.USAGE_LIMIT_REACHED),
        (
            persisted_rule(per_customer_usage_limit=1),
            persisted_context(customer_usage_count=1),
            DiscountRejectionReason.PER_CUSTOMER_USAGE_LIMIT_REACHED,
        ),
    ],
)
def test_persisted_discount_rejects_inapplicable_rule(
    rule: PersistedDiscountRule,
    context: PersistedDiscountContext,
    reason: DiscountRejectionReason,
) -> None:
    result = evaluate_persisted_discount_rule("100", rule, context)

    assert result.applies is False
    assert result.rejection_reason is reason


def test_persisted_discount_uses_documented_json_eligibility_scopes() -> None:
    customer_id, product_id, plan_id, subscription_id = (uuid4() for _ in range(4))
    rule = persisted_rule(
        eligibility={
            "customer_ids": [str(customer_id)],
            "product_ids": [str(product_id)],
            "plan_ids": [str(plan_id)],
            "subscription_ids": [str(subscription_id)],
        }
    )

    accepted = evaluate_persisted_discount_rule(
        "100",
        rule,
        persisted_context(
            customer_id=customer_id,
            product_ids=frozenset({product_id}),
            plan_id=plan_id,
            subscription_id=subscription_id,
        ),
    )
    rejected = evaluate_persisted_discount_rule("100", rule, persisted_context())

    assert accepted == DiscountEvaluation(True, Decimal("10.00"))
    assert rejected.rejection_reason is DiscountRejectionReason.CUSTOMER_SCOPE_MISMATCH
