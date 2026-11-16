"""Provider-neutral payment event types and verified Stripe charge normalization."""
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Protocol
import re

import stripe


@dataclass(frozen=True)
class Payment:
    transaction_id: str
    customer_id: str | None
    amount_minor: int
    refunded_minor: int
    currency: str
    occurred_at: datetime


@dataclass(frozen=True)
class PaymentEvent:
    event_id: str
    event_type: str
    live_mode: bool
    payment: Payment | None


class PaymentAdapter(Protocol):
    def verify(self, payload: bytes, signature: str, secret: str) -> PaymentEvent: ...


class StripeAdapter:
    """Verify raw bytes using Stripe's SDK; never treat browser events as payments."""
    accepted_types = frozenset(('charge.succeeded', 'charge.captured', 'charge.refunded'))

    def verify(self, payload: bytes, signature: str, secret: str) -> PaymentEvent:
        try:
            event = stripe.Webhook.construct_event(payload, signature, secret).to_dict()
        except (ValueError, stripe.SignatureVerificationError) as exc:
            raise ValueError('Invalid webhook signature or payload') from exc
        event_id, event_type, live = event.get('id'), event.get('type'), event.get('livemode')
        if not isinstance(event_id, str) or not re.fullmatch(r'evt_[A-Za-z0-9]{1,250}', event_id):
            raise ValueError('Invalid event id')
        if not isinstance(event_type, str) or len(event_type) > 128 or not isinstance(live, bool):
            raise ValueError('Invalid event metadata')
        if event_type not in self.accepted_types:
            return PaymentEvent(event_id, event_type, live, None)
        charge = event.get('data', {}).get('object', {})
        if not isinstance(charge, dict) or charge.get('object') != 'charge':
            raise ValueError('Invalid charge')
        # Uncaptured authorizations are not revenue.
        if charge.get('paid') is not True or charge.get('captured') is not True:
            return PaymentEvent(event_id, event_type, live, None)
        transaction_id, customer = charge.get('id'), charge.get('customer')
        amount, refunded, currency, timestamp = charge.get('amount_captured'), charge.get('amount_refunded'), charge.get('currency'), charge.get('created')
        if not isinstance(transaction_id, str) or not re.fullmatch(r'ch_[A-Za-z0-9]{1,250}', transaction_id):
            raise ValueError('Invalid transaction id')
        if customer is not None and (not isinstance(customer, str) or not re.fullmatch(r'cus_[A-Za-z0-9]{1,250}', customer)):
            raise ValueError('Invalid customer id')
        if type(amount) is not int or type(refunded) is not int or not 0 <= refunded <= amount <= 2**63-1:
            raise ValueError('Invalid payment amount')
        if not isinstance(currency, str) or not re.fullmatch(r'[a-z]{3}', currency):
            raise ValueError('Invalid currency')
        if type(timestamp) is not int:
            raise ValueError('Invalid payment timestamp')
        try:
            occurred_at = datetime.fromtimestamp(timestamp, timezone.utc)
        except (ValueError, OverflowError, OSError) as exc:
            raise ValueError('Invalid payment timestamp') from exc
        return PaymentEvent(event_id, event_type, live, Payment(transaction_id, customer, amount, refunded, currency.upper(), occurred_at))
