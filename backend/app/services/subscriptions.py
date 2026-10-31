"""Pure subscription lifecycle transition rules; billing is intentionally excluded."""

from app.models import SubscriptionStatus


ALLOWED_TRANSITIONS: dict[SubscriptionStatus, frozenset[SubscriptionStatus]] = {
    SubscriptionStatus.DRAFT: frozenset({SubscriptionStatus.QUOTATION}),
    SubscriptionStatus.QUOTATION: frozenset({SubscriptionStatus.CONFIRMED}),
    SubscriptionStatus.CONFIRMED: frozenset({SubscriptionStatus.ACTIVE}),
    SubscriptionStatus.ACTIVE: frozenset(
        {SubscriptionStatus.PAUSED, SubscriptionStatus.CLOSED, SubscriptionStatus.CANCELLED, SubscriptionStatus.EXPIRED}
    ),
    SubscriptionStatus.PAUSED: frozenset(
        {SubscriptionStatus.ACTIVE, SubscriptionStatus.CLOSED, SubscriptionStatus.CANCELLED, SubscriptionStatus.EXPIRED}
    ),
    SubscriptionStatus.CLOSED: frozenset(),
    SubscriptionStatus.CANCELLED: frozenset(),
    SubscriptionStatus.EXPIRED: frozenset(),
}


def can_transition(current: SubscriptionStatus, target: SubscriptionStatus) -> bool:
    return target in ALLOWED_TRANSITIONS[current]
