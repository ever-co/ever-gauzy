# @gauzy/plugin-payment

The payment domain of the Ever Gauzy platform: how money is asked for,
authorised, taken, given back and reported back to us by the provider that moved
it.

## What this package owns

- `payment_provider` (`PaymentProvider`): a provider registration: a code, a
  name, non-secret configuration and the integration whose settings hold the
  credentials
- `payment_collection` (`PaymentCollection`): the money side of one order or
  cart: what must be collected, authorised, captured and returned
- `payment_session` (`PaymentSession`): one attempt with one provider, including
  the off-session attempt that charges a saved instrument
- `payment_capture` (`PaymentCapture`): money actually taken, append-only: a
  partial capture is another row
- `refund` (`Refund`): money given back, linked to the order and to the return
  or claim that caused it
- `refund_line` (`RefundLine`): which order lines a refund paid back, as rows:
  the refund's amount is the ceiling of their sum, and a goodwill refund — which
  has no return at all — is expressible here
- `refund_reason` (`RefundReason`): the governed reason tree refund reporting is
  grouped by
- `payment_webhook_event` (`PaymentWebhookEvent`): an inbound provider callback,
  recorded before anything is parsed

## What it does not own

**The payment row is the core `payment` table.** A payment is a payment
whichever document it settles, so this package extends that table (additively,
through the core schema) instead of declaring a second one:
`paymentCollectionId`, `paymentSessionId` and `paymentProviderId` are
identifiers into this domain, and the money columns on the row are the ones the
captures and refunds here maintain.

**No card data, anywhere.** The platform stores a provider-issued reference and
nothing that could be a primary account number, a verification value or a bank
account number: there is no column for one and no route in this package accepts
one. The saved-instrument tables themselves are core (`payment_account_holder`,
`payment_method_token`) and this package reads them; a session that names one is
off-session, carries no client secret and never waits for a next action from a
buyer who is not there.

**No secrets in provider configuration.** `payment_provider.configuration` holds
a capture mode, a statement descriptor and a webhook path; credentials live in
`integration_setting`, and a write that carries a key such as `secret`,
`apiKey`, `password`, `token` or `clientSecret` is refused rather than stored.

## Money

Every amount is an exact decimal (`numeric(20,6)`) with a sibling ISO-4217
currency, computed through the kernel `Money` value object. A capture may never
exceed what is left of an authorisation, a refund may never exceed what was
captured, and the collections and payments carry statuses that are **derived**
from those amounts — never set by a caller.

## API

One surface, one controller per table, guards and permissions exactly as the
rest of the platform: `/api/payment-providers`, `/api/payment-collections`,
`/api/payment-sessions`, `/api/payment-captures`, `/api/refunds`,
`/api/refund-reasons`, `/api/payment-webhook-events`. The same concepts are
served over GraphQL by the resolvers this package contributes.

## Retry safety

A write that moves money is safe to retry under a client-supplied key. A REST
caller presents one in the `Idempotency-Key` header; a GraphQL caller states
`idempotencyKey` beside the input it qualifies, because one request may select
several mutations and a header could not say which of them it belongs to. The
first attempt claims the key, owns the work and records its answer; a repeat of
the same key with the same body is answered from that record and the work does
not run again; the same key with a different body is refused with
`IDEMPOTENCY_KEY_REUSED` rather than applied.

Capturing a payment, recording a refund, recording a provider account and its
verification, and saving an instrument **require** a key, because a retry that
lost its answer must not move the money twice. The package's other unsafe routes
honour a key when one is presented and are unchanged when none is: registering a
provider, creating a collection, opening or authorising an attempt, cancelling
one, creating a refund reason, and re-processing an inbound callback.

## Dependencies

`@gauzy/plugin-order` — a collection settles an order, and the order rows are
read by the reconciliation that compares what was collected with what was
ordered.

## Invoices paid online

A client who received an invoice by email opens it on its public page and pays it there
(`src/lib/invoice-payment`). The organization connects a **payment connector**: a small service it runs next to
the payment provider it already has, holding that provider's keys. The API never holds them and no card data
reaches it.

1. **Connect.** `PUT /api/invoice-payments/connection` with the connector's HTTPS `checkoutEndpoint`
   (`PAYMENT_PROVIDERS_EDIT`) registers a provider of code `signed-checkout` and answers, once, the
   `signingSecret` the connector signs with, and the `notificationUrl` it posts to.
   `POST /api/invoice-payments/connection/rotate-secret` gives a new secret; the old one stops working at once.
   The secret is derived from the API's `ENCRYPTION_KEY` (or `JWT_SECRET` when that is unset), never stored.
2. **Checkout.** The public page asks `GET /api/public/invoice-payments/invoice/:id/:token` whether to offer
   Pay, and `POST /api/public/invoice-payments/invoice/:id/:token/checkout` with its `returnUrl` opens a
   checkout. The API posts to the connector, signed:

    ```json
    {
    	"reference": "<invoice id>",
    	"invoiceNumber": 42,
    	"amount": "120.50",
    	"currency": "EUR",
    	"returnUrl": "https://…",
    	"isTestMode": false
    }
    ```

    and the connector answers `{ "url": "https://…" }`, the provider's checkout page the client is sent to. The
    amount is what is still due, computed by the API from the invoice and its payments.

3. **Notification.** Once the provider confirms, the connector posts to the `notificationUrl`, signed:

    ```json
    {
    	"id": "<notification id>",
    	"type": "payment.succeeded",
    	"data": {
    		"reference": "<invoice id>",
    		"paymentId": "<provider payment id>",
    		"amount": "120.50",
    		"currency": "EUR",
    		"isTestMode": false
    	}
    }
    ```

    The API records the payment against the invoice (once per `paymentId`, which a success must carry) and sets
    it Paid, Partially paid or Overpaid. `payment.failed` and `payment.canceled` change nothing. A payment taken in
    test mode (`isTestMode` not `false`), or through a connector in test mode, is logged and never recorded. A
    payment on a voided invoice is recorded for a refund and the invoice stays void.

Every message carries `x-gauzy-payment-timestamp` (Unix seconds) and
`x-gauzy-payment-signature: hex(HMAC_SHA256(signingSecret, "<timestamp>.<raw body>"))`. A notification that is
not signed with the connector's secret, or was signed more than five minutes ago, is refused before anything is
written.
