"""Deterministic billing calendar calculations.

Billing schedules in this module use calendar dates rather than instants. This
keeps month-end and leap-year behavior independent of a system clock or a
timezone conversion. Datetime inputs are rejected explicitly because applying
UTC or a local timezone would require a product-level billing-time policy.
"""

from calendar import monthrange
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from enum import StrEnum


class BillingInterval(StrEnum):
    """Supported recurring billing intervals."""

    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    YEARLY = "yearly"


@dataclass(frozen=True, slots=True)
class BillingPeriod:
    """An inclusive calendar billing period."""

    start_date: date
    end_date: date


def validate_billing_interval(value: BillingInterval | str) -> BillingInterval:
    """Return a supported billing interval or raise a clear validation error."""
    if isinstance(value, BillingInterval):
        return value
    if not isinstance(value, str):
        raise TypeError("billing_interval must be a BillingInterval or string")
    try:
        return BillingInterval(value.strip().lower())
    except ValueError as exc:
        raise ValueError(
            "billing_interval must be one of: daily, weekly, monthly, yearly"
        ) from exc


def validate_billing_date(value: date, field_name: str = "billing_date") -> date:
    """Validate a date-only billing value.

    ``datetime`` is rejected even though it subclasses ``date``. Converting a
    datetime to a calendar date without an agreed timezone policy could select
    the wrong billing day.
    """
    if isinstance(value, datetime):
        raise TypeError(f"{field_name} must be a date, not a datetime")
    if not isinstance(value, date):
        raise TypeError(f"{field_name} must be a date")
    return value


def _resolve_anchor_date(current_date: date, anchor_date: date | None) -> date:
    validated_current = validate_billing_date(current_date, "current_date")
    if anchor_date is None:
        return validated_current
    validated_anchor = validate_billing_date(anchor_date, "anchor_date")
    if validated_anchor > validated_current:
        raise ValueError("anchor_date cannot be after current_date")
    return validated_anchor


def _date_in_month(year: int, month: int, day: int) -> date:
    last_day = monthrange(year, month)[1]
    return date(year, month, min(day, last_day))


def _next_monthly_date(current_date: date, anchor_date: date) -> date:
    if current_date.month == 12:
        target_year, target_month = current_date.year + 1, 1
    else:
        target_year, target_month = current_date.year, current_date.month + 1
    return _date_in_month(target_year, target_month, anchor_date.day)


def _next_yearly_date(current_date: date, anchor_date: date) -> date:
    return _date_in_month(current_date.year + 1, anchor_date.month, anchor_date.day)


def calculate_next_billing_date(
    current_date: date,
    interval: BillingInterval | str,
    anchor_date: date | None = None,
) -> date:
    """Calculate the next billing date after ``current_date``.

    ``anchor_date`` is the original schedule date. Retaining it is necessary
    for month-end recovery, such as January 31 -> February 28 -> March 31,
    and for leap-year recovery, such as February 29 -> February 28 -> February
    29 in the next leap year.
    """
    validated_current = validate_billing_date(current_date, "current_date")
    validated_interval = validate_billing_interval(interval)
    resolved_anchor = _resolve_anchor_date(validated_current, anchor_date)

    if validated_interval is BillingInterval.DAILY:
        return validated_current + timedelta(days=1)
    if validated_interval is BillingInterval.WEEKLY:
        return validated_current + timedelta(weeks=1)
    if validated_interval is BillingInterval.MONTHLY:
        return _next_monthly_date(validated_current, resolved_anchor)
    return _next_yearly_date(validated_current, resolved_anchor)


def calculate_billing_period(
    period_start: date,
    interval: BillingInterval | str,
    anchor_date: date | None = None,
) -> BillingPeriod:
    """Return the inclusive period beginning on ``period_start``.

    The end date is the calendar day immediately before the next billing date.
    """
    validated_start = validate_billing_date(period_start, "period_start")
    next_date = calculate_next_billing_date(
        validated_start,
        interval,
        anchor_date=anchor_date,
    )
    return BillingPeriod(
        start_date=validated_start,
        end_date=next_date - timedelta(days=1),
    )
