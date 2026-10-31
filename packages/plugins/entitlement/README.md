# @gauzy/plugin-entitlement

## Overview

What a purchase **grants**: a licence, a seat count, a service term, a metered
allowance. An entitlement is issued from an order line (or renewed by a
subscription billing cycle), and it is what a device, an instance or a named
user later activates against.

The domain is one package because an activation limit and a licence key mean
something only to the thing being sold, and no other domain reads them. It is
enabled by a tenant as a whole or not at all.

- **Entitlement**: The right itself: who holds it, what granted it, over what
  term, how many seats it carries, how many activations it permits, and whether
  it has been revoked
- **Activation**: One device, instance or named user occupying a slot of an
  entitlement — the scarce resource an activation limit counts
- **Licence key**: The credential a customer types into the product: issued
  against an entitlement, shown once, stored as a digest

## Tables

`entitlement`, `entitlement_activation`, `entitlement_key`.

## The rules the domain exists for

**The grant is derived from the purchase, never authored by hand.**
`ENTITLEMENT_GRANT` consumes the order and subscription events and grants the
right against the order line that produced it, so the grant and the purchase
cannot disagree. A replayed grant returns the original right instead of creating
a second one, and two deliveries of the same `order.placed` racing each other
cannot both create one either: `UQ_entitlement_live_line_grant` admits one live
(not revoked, not deleted) right per tenant, order line and kind, and the grant
that loses the race returns the winner's right. A line may be granted again once
its right is revoked; a derived number then takes the next revision (`…-L-2`).

**A settlement delivered early is not lost.** The grant path is reorderable, so
`order.completed` can be handled before a retried `order.placed`, when there is
nothing yet to put into force. When the installation binds
`ENTITLEMENT_ORDER_STATE_PORT` (the API's composition module binds it to the
order package's `OrderStateReader`), the placement reads where the order is now:

- an order already cancelled (`CANCELED`, or `canceledAt` once archived) or
  refunded in full (payment `REFUNDED`) grants nothing, and the skip is logged;
- on an order that settled since — `COMPLETED` or `completedAt`, or payment
  `CAPTURED` in full — the placement puts into force, line by line, the rights of
  the lines still paid for (`quantity` above `refundedQuantity`); a line refunded
  in full keeps its right `PENDING`, and so does every line of an order refunded
  in part when the port cannot answer the lines;
- an order cancelled or refunded in full while the placement was granting has
  what it granted withdrawn again, with the reason the matching event gives.

Left unbound, the rights stay `PENDING` until the next settlement event, as before.

**A right that has been withdrawn cannot be activated.** An entitlement that is
`REVOKED`, that is past `endsAt + gracePeriodDays`, or whose live activations
already fill its `quantity` refuses an activation with a stable code, and the
refusal is answered rather than hidden.

**A licence key leaves the service exactly once.** The plaintext is returned in
the response to the issuance call and never again: only its SHA-256 digest — the
lookup column — and, when the issuance asked for `storeKey`, a ciphertext, are
stored. Nothing logs, exports or publishes it, and nothing re-displays it: a key
is shown once, at issue (owner decision 2026-10-13), so `POST
/api/entitlement-keys/:id/reveal` answers `410 ENTITLEMENT_KEY_SHOWN_ONCE` and a
lost key is replaced with `/:id/reissue`.

**Seat arithmetic is a count, not a counter.** The number of seats in use is the
number of live activation rows; the counters on the tables are caches the usage
audit re-derives. Two devices activating at the same instant cannot both take
the last slot, because the check runs under a row lock on the entitlement.

## Conditions

There is deliberately no conditions table and no fifth enum. The *subject* of an
entitlement is a foreign key (`productId`, `variantId`, `customerId`); the
*conditions* attached to it are `rule` rows, evaluated by the platform rule
engine through the same `RuleOwnerType` mechanism every other conditional
capability uses.

## Endpoints

- `GET /api/entitlements`, `/api/entitlements/:id`, `/:id/activations`,
  `/:id/keys`: `ENTITLEMENTS_VIEW`
- `POST /api/entitlements/check`: `ENTITLEMENTS_VIEW`
- `POST /api/entitlements`, `POST /api/entitlements/:id/keys`:
  `ENTITLEMENTS_GRANT`
- `PUT /api/entitlements/:id`, `POST /api/entitlements/:id/suspend`, `/resume`,
  `/extend`, `/revoke`: `ENTITLEMENTS_EDIT`
- `POST /api/entitlement-activations`, `GET /api/entitlement-activations`,
  `/:id`: `ENTITLEMENTS_VIEW` / `ENTITLEMENTS_GRANT`
- `POST /api/entitlement-activations/:id/release`, `/:id/revoke`:
  `ENTITLEMENTS_EDIT`
- `GET /api/entitlement-keys`, `/:id`: `ENTITLEMENTS_VIEW`
- `POST /api/entitlement-keys`: `ENTITLEMENTS_GRANT`; `/:id/reveal` keeps that
  grant but is refused for every key (`410 ENTITLEMENT_KEY_SHOWN_ONCE`)
- `PUT /api/entitlement-keys/:id`, `POST /api/entitlement-keys/:id/revoke`,
  `/:id/reissue`: `ENTITLEMENTS_EDIT`

Every route is behind `FEATURE_ENTITLEMENT`, which defaults to **off**.

## GraphQL

The plugin contributes `Entitlement`, `EntitlementActivation` and
`EntitlementKey` with their connection types, five query fields, seven mutations
and three subscription fields, and composes them into the platform schema
through `extensions`. Every resolver calls the same service the REST controller
calls, so both surfaces obey one implementation of every rule.

## Money

The three tables carry no amount: what was paid for a right is a fact of the
order, which is the document that owns it. Where a domain does carry money, this
platform stores it as an exact decimal (`numeric(20,6)`) with a sibling ISO
currency column and never as a float.
