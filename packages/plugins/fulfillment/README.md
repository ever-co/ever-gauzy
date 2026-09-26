# @gauzy/plugin-fulfillment

How a sold thing gets to the buyer: the shipping configuration, and the shipments themselves.

## What this package owns

| table | entity | what it is |
|---|---|---|
| `shipping_profile` | `ShippingProfile` | a set of variants that ship the same way |
| `shipping_profile_variant` | `ShippingProfileVariant` | the pivot that attaches a variant to a profile |
| `shipping_option` | `ShippingOption` | a configured, sellable delivery choice, with a price and a provider |
| `fulfillment` | `Fulfillment` | one shipment against an order, with its own lifecycle |
| `fulfillment_line` | `FulfillmentLine` | what is in that shipment |

The split is deliberate. A **profile** answers "does this variant ship at all, and with which options" —
which is why a cart containing only digital goods is never offered a courier. An **option** is what the
buyer chooses between. A **fulfilment** is what actually left the building, and it has a lifecycle of its
own: an order may be partially fulfilled, fulfilled from several locations, or fulfilled again after a
return.

## What a fulfilment does to an order

Creating a fulfilment consumes the matching stock reservations and writes the sale movements **in the
same transaction**; a fulfilment line can never take more than the order line has left
(`Σ fulfillment_line.quantity ≤ order_line.quantity − already fulfilled`). Writing or changing a
fulfilment line updates the order line's `fulfilledQuantity`, `shippedQuantity` and
`deliveredQuantity`, which is where the order's materialised `fulfillmentStatus` comes from.

The status moves forward only — `PENDING → SHIPPED → IN_TRANSIT → DELIVERED`, plus `→ CANCELED` from
`PENDING` or `SHIPPED`. A delivered fulfilment is never cancelled: a return is created instead, and a
return shipment is a fulfilment with `direction = RETURN`.

## What it does not own

The stock ledger, the reservations and the transfers belong to the inventory package, and the order
belongs to the order package. This package calls them; it keeps no copy of a stock level and no total of
its own. Eligibility and pricing conditions live in the core `rule` engine
(`ownerType = SHIPPING_OPTION`), so the columns here are only the option's identity and its physical
constraints.

## API

One surface, one controller per entity: `/api/shipping-profiles`, `/api/shipping-options`,
`/api/fulfillments`, and the shipment's own transitions on `/api/fulfillments/:id/ship`, `/deliver` and
`/cancel`.

## Retry safety

Creating a fulfilment and handing one to the carrier carry the platform's retry convention
(`packages/core/src/lib/idempotency/`).

`POST /api/fulfillments` and the mutation `createFulfillment` require an `Idempotency-Key` header — the
`idempotencyKey` input member over GraphQL — because creating a fulfilment twice ships the same goods
twice, and the second copy is not a duplicate row but a duplicate parcel. `POST
/api/fulfillments/:id/ship`, `shipFulfillment`, `POST /api/shipping-options`, `createShippingOption`,
`POST /api/shipping-profiles` and `createShippingProfile` honour a key when one is presented: a retry
under the same key and the same bytes is answered with the first attempt's response rather than running
the work again, and a caller that never sends a key is unaffected.

## Dependencies

`@gauzy/plugin-order` (a fulfilment is against an order, and it maintains that order's line counters) and
`@gauzy/plugin-inventory` (reservations are consumed and stock movements written through it). It also
adds the foreign keys its own set is responsible for: the cart's and the order's chosen shipping option.
