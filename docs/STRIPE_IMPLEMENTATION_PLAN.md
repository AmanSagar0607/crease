# Crease: Stripe integration plan

Status: working plan written from the installed Stripe guidance and the current code. The requested `stripe_implementation_planner` MCP tool is now available but needs additional business context before it can return a guide; this document is not its output. The Stripe CLI is authorized for the `Crease development` sandbox; verify `stripe whoami --format json` reports that sandbox and `mode: test` before every test run. Never use live credentials for test runs.

## Business and scope

Crease is a multi-project analytics SaaS that needs to ingest a merchant's verified payment events and eventually attribute revenue. The user also requested Payments, Billing, Connect, and Invoicing, but the exact business model for Connect, pricing, invoices, and whether money flows between merchants has not been confirmed. Keep Crease's own subscription billing separate from a merchant's payment analytics. Do not provision connected accounts, products, prices, invoices, tax settings, or live endpoints before the corresponding design and authorization are established.

## Existing integration review

- `backend/payment_adapters.py` verifies raw Stripe webhook bytes with the official Python SDK and normalizes selected charge events.
- `backend/main.py` stores per-project signing secrets using a dedicated Fernet key, requires project ownership for connection management, limits webhook bodies and requests, and isolates test/live payments. Migration `0004_payment_foundation` has not been applied to production.
- Synthetic tests cover signature rejection, webhook deduplication, refund ordering, conflicting amounts, project isolation, and retention. One Stripe sandbox payment and partial refund were delivered to the local webhook and recorded correctly; broader sandbox tests and reconciliation remain outstanding. No browser event proves payment.
- Gaps: no customer-to-visitor association, revenue reporting, checkout, subscription and invoice lifecycle, production Connect onboarding, reconciliation, comprehensive payment states, or credential rotation workflow. The current charge-only event model must not be described as a complete Billing or Invoicing integration. Payments must remain unattributed when no trustworthy association exists.

## Sequence

1. **Sandbox and existing webhook**: use the authorized sandbox, an isolated local PostgreSQL database, and a temporary local webhook listener. Feed real sandbox events to the existing route; verify payload signatures, mode isolation, deduplication, partial/refund ordering, failed/uncaptured payments, and the retention boundary. Compare recorded amounts and currency against Stripe's test data. Keep test keys and signing secrets out of source control and logs. Do not mark production-ready based on synthetic fixtures alone.
2. **Merchant analytics**: establish an explicit, owner-authorized mapping from a merchant's customer/payment to a consented project-scoped visitor. Do not trust a browser-submitted payment or arbitrary metadata by itself; unmatched events stay unattributed. Define idempotency, delayed events, refunds and reconciliation before exposing revenue metrics. Keep amounts in original currency and minor units; do not aggregate currencies or invent exchange rates.
3. **Crease's own checkout and Billing**: once pricing and products are specified, use Stripe-hosted Checkout Sessions for subscription or one-time purchases. Use Stripe Products and Prices. Provision and revoke access from verified webhooks, including asynchronous checkout, `invoice.paid`, `invoice.payment_failed`, subscription changes, refunds and relevant dispute events. Test retry, cancellation and out-of-order delivery. Do not treat a success redirect as proof of payment.
4. **Invoicing**: confirm whether invoices are for Crease's own customers or for merchants. Use Stripe Invoicing and its webhook lifecycle for the chosen business workflow; reconcile invoice/payment relationships without double-counting charges. Do not store card details.
5. **Connect**: first establish whether Crease merely reads each merchant's analytics or actually routes funds between parties. Use Stripe's current Connect guidance and Accounts v2 when connected-account onboarding is warranted. Select dashboard access, fee collection, liability and charge pattern with explicit business confirmation; monitor capability/verification requirements and signed events. Do not create accounts or transfer funds during planning.
6. **Release**: test fresh and existing PostgreSQL upgrades on an isolated database, back up and separately approve production migrations, configure secrets through a server-only secret store, deploy, verify event delivery and reconciliation, and monitor. Use restricted API keys for the minimum necessary access. Do not enable automatic tax without confirming appropriate registrations.

## Open decisions

- Is amansagar.in or Crease itself selling a subscription, one-time products, or both? What are the prices and currencies?
- The user confirmed that merchants connect their existing Stripe accounts for analytics; Crease does not route payments or payouts between businesses.
- Who is the merchant of record, and which party handles fees and negative balances if funds are routed?
- Are invoices for Crease customers, merchant customers, or both? Which countries and tax registrations apply?
- What explicit server-side process will bind an authenticated merchant customer to a consented Crease visitor?

## References

- Stripe sandbox guidance: https://docs.stripe.com/sandboxes
- Stripe webhook security: https://docs.stripe.com/webhooks
- Stripe Checkout fulfillment: https://docs.stripe.com/checkout/fulfillment
- Stripe Billing webhooks: https://docs.stripe.com/billing/subscriptions/webhooks
- Stripe Connect: https://docs.stripe.com/connect
