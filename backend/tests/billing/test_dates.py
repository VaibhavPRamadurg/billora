from datetime import date, datetime, timedelta, timezone

import pytest

from app.services.billing.dates import (
    BillingInterval,
    BillingPeriod,
    SubscriptionBillingPeriod,
    calculate_billing_period,
    calculate_next_billing_date,
    calculate_next_subscription_billing_at,
    calculate_subscription_billing_period,
    validate_billing_date,
    validate_billing_interval,
    validate_subscription_frequency,
    validate_utc_timestamp,
)
from app.models import BillingFrequency


@pytest.mark.parametrize(
    ("interval", "expected"),
    [
        (BillingInterval.DAILY, BillingInterval.DAILY),
        ("weekly", BillingInterval.WEEKLY),
        (" MONTHLY ", BillingInterval.MONTHLY),
        ("YEARLY", BillingInterval.YEARLY),
    ],
)
def test_validate_billing_interval(interval: BillingInterval | str, expected: BillingInterval) -> None:
    assert validate_billing_interval(interval) is expected


@pytest.mark.parametrize("interval", ["hourly", "", 1, None])
def test_invalid_billing_interval_is_rejected(interval: object) -> None:
    with pytest.raises((TypeError, ValueError), match="billing_interval"):
        validate_billing_interval(interval)  # type: ignore[arg-type]


def test_daily_and_weekly_next_dates() -> None:
    start = date(2026, 1, 15)

    assert calculate_next_billing_date(start, BillingInterval.DAILY) == date(2026, 1, 16)
    assert calculate_next_billing_date(start, "weekly") == date(2026, 1, 22)


@pytest.mark.parametrize(
    ("current", "anchor", "expected"),
    [
        (date(2025, 1, 29), date(2025, 1, 29), date(2025, 2, 28)),
        (date(2024, 1, 29), date(2024, 1, 29), date(2024, 2, 29)),
        (date(2025, 1, 30), date(2025, 1, 30), date(2025, 2, 28)),
        (date(2024, 1, 30), date(2024, 1, 30), date(2024, 2, 29)),
        (date(2025, 1, 31), date(2025, 1, 31), date(2025, 2, 28)),
        (date(2024, 1, 31), date(2024, 1, 31), date(2024, 2, 29)),
    ],
)
def test_monthly_handles_month_end_and_leap_year(
    current: date, anchor: date, expected: date
) -> None:
    assert calculate_next_billing_date(current, "monthly", anchor) == expected


def test_monthly_schedule_recovers_original_anchor_day() -> None:
    anchor = date(2025, 1, 31)

    february = calculate_next_billing_date(anchor, "monthly", anchor)
    march = calculate_next_billing_date(february, "monthly", anchor)

    assert february == date(2025, 2, 28)
    assert march == date(2025, 3, 31)


def test_yearly_preserves_month_and_anchor_day_across_leap_years() -> None:
    anchor = date(2024, 2, 29)

    first = calculate_next_billing_date(anchor, "yearly", anchor)
    second = calculate_next_billing_date(first, "yearly", anchor)
    leap_recovery = calculate_next_billing_date(date(2027, 2, 28), "yearly", anchor)

    assert first == date(2025, 2, 28)
    assert second == date(2026, 2, 28)
    assert leap_recovery == date(2028, 2, 29)


def test_period_boundaries_are_inclusive() -> None:
    assert calculate_billing_period(date(2026, 1, 15), "daily") == BillingPeriod(
        date(2026, 1, 15), date(2026, 1, 15)
    )
    assert calculate_billing_period(date(2026, 1, 15), "weekly") == BillingPeriod(
        date(2026, 1, 15), date(2026, 1, 21)
    )
    assert calculate_billing_period(date(2025, 1, 31), "monthly", date(2025, 1, 31)) == BillingPeriod(
        date(2025, 1, 31), date(2025, 2, 27)
    )


def test_period_preserves_month_end_anchor() -> None:
    period = calculate_billing_period(
        date(2025, 2, 28), "monthly", anchor_date=date(2025, 1, 31)
    )

    assert period.start_date == date(2025, 2, 28)
    assert period.end_date == date(2025, 3, 30)


@pytest.mark.parametrize(
    "value",
    [datetime(2026, 1, 15), datetime(2026, 1, 15, tzinfo=timezone.utc), "2026-01-15", None],
)
def test_datetime_and_invalid_values_are_rejected_for_date_only_calculations(
    value: object,
) -> None:
    with pytest.raises(TypeError, match="date"):
        validate_billing_date(value)  # type: ignore[arg-type]


def test_anchor_date_cannot_be_after_current_date() -> None:
    with pytest.raises(ValueError, match="anchor_date"):
        calculate_next_billing_date(
            date(2026, 1, 15), "monthly", anchor_date=date(2026, 1, 16)
        )


def test_subscription_periods_are_utc_half_open_and_support_persisted_frequencies() -> None:
    start = datetime(2026, 1, 31, 9, 30, tzinfo=timezone.utc)

    assert calculate_subscription_billing_period(start, BillingFrequency.MONTHLY) == SubscriptionBillingPeriod(
        start_at=start,
        end_at=datetime(2026, 2, 28, 9, 30, tzinfo=timezone.utc),
    )
    assert calculate_subscription_billing_period(start, "quarterly").end_at == datetime(
        2026, 4, 30, 9, 30, tzinfo=timezone.utc
    )
    assert calculate_subscription_billing_period(start, "yearly").end_at == datetime(
        2027, 1, 31, 9, 30, tzinfo=timezone.utc
    )


def test_subscription_anchor_recovers_month_end_and_normalizes_offsets() -> None:
    anchor = datetime(2024, 1, 31, 10, tzinfo=timezone.utc)
    february = datetime(2024, 2, 29, 10, tzinfo=timezone.utc)

    assert calculate_next_subscription_billing_at(february, "monthly", anchor_at=anchor) == datetime(
        2024, 3, 31, 10, tzinfo=timezone.utc
    )
    assert validate_utc_timestamp(
        datetime(2026, 1, 1, 5, 30, tzinfo=timezone(timedelta(hours=5, minutes=30)))
    ) == datetime(2026, 1, 1, tzinfo=timezone.utc)


@pytest.mark.parametrize("value", [datetime(2026, 1, 1), "monthly", None])
def test_subscription_timestamp_calculations_reject_invalid_boundaries(value: object) -> None:
    with pytest.raises((TypeError, ValueError)):
        calculate_subscription_billing_period(value, "monthly")  # type: ignore[arg-type]
    with pytest.raises(ValueError, match="billing_frequency"):
        validate_subscription_frequency("weekly")
