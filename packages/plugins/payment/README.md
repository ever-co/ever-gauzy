# @gauzy/plugin-payment

The payment domain of the Ever Gauzy platform: how money is asked for, authorised, taken, given back
and reported back to us by the provider that moved it.

## What this package owns

| table | entity | what it is |
|---|---|---|
| `payment_provider` | `PaymentProvider` | a provider registration: a code, a name, non-secret configuration and the integration whose settings hold the credentials |
| `payment_collection` | `PaymentCollection` | the money side of one order or cart: what must be collected, authorised, captured and returned |
| `payment_session` | `PaymentSession` | one attempt with one provider, including the off-session attempt that charges a saved instrument |
| `payment_capture` | `PaymentCapture` | money actually taken, append-only: a partial capture is another row |
| `refund` | `Refund` | money given back, linked to the order and to the return or claim that caused it |
| `refund_reason` | `RefundReason` | the governed reason tree refund reporting is grouped by |
| `payment_webhook_event` | `PaymentWebhookEvent` | an inbound provider callback, recorded before anything is parsed |

## What it does not own

**The payment row is the core `payment` table.** A payment is a payment whichever document it settles,
so this package extends that table (additively, through the core schema) instead of declaring a second
one: `paymentCollectionId`, `paymentSessionId` and `paymentProviderId` are identifiers into this
domain, and the money columns on the row are the ones the captures and refunds here maintain.

**No card data, anywhere.** The platform stores a provider-issued reference and nothing that could be
a primary account number, a verification value or a bank account number: there is no column for one
and no route in this package accepts one. The saved-instrument tables themselves are core
(`payment_account_holder`, `payment_method_token`) and this package reads them; a session that names
one is off-session, carries no client secret and never waits for a next action from a buyer who is not
there.

**No secrets in provider configuration.** `payment_provider.configuration` holds a capture mode, a
statement descriptor and a webhook path; credentials live in `integration_setting`, and a write that
carries a key such as `secret`, `apiKey`, `password`, `token` or `clientSecret` is refused rather than
stored.

## Money

Every amount is an exact decimal (`numeric(20,6)`) with a sibling ISO-4217 currency, computed through
the kernel `Money` value object. A capture may never exceed what is left of an authorisation, a refund
may never exceed what was captured, and the collections and payments carry statuses that are
**derived** from those amounts — never set by a caller.

## API

One surface, one controller per table, guards and permissions exactly as the rest of the platform:
`/api/payment-providers`, `/api/payment-collections`, `/api/payment-sessions`, `/api/payment-captures`,
`/api/refunds`, `/api/refund-reasons`, `/api/payment-webhook-events`. The same concepts are served over
GraphQL by the resolvers this package contributes.

## Dependencies

`@gauzy/plugin-order` — a collection settles an order, and the order rows are read by the reconciliation
that compares what was collected with what was ordered.
