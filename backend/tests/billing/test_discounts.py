from datetime import date
from decimal import Decimal

import pytest

from app.services.billing.discounts import (
    DiscountEvaluation,
    DiscountEvaluationContext,
    DiscountRejectionReason,
    DiscountRule,
    evaluate_discount,
)


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
