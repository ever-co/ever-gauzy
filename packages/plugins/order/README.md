# @gauzy/plugin-order

The canonical order of the Ever Gauzy platform. The platform had no order table before this package;
this is it.

## What this package owns

| table | entity | what it is |
|---|---|---|
| `order` | `Order` | the aggregate root: identity, statuses, snapshotted totals, version |
| `order_line` | `OrderLine` | what was bought, with its own price snapshot |
| `order_address` | `OrderAddress` | the shipping and billing addresses as they were |
| `order_shipping_method` | `OrderShippingMethod` | the delivery chosen and what it cost |
| `order_summary` | `OrderSummary` | the totals of each version, so "what did this total at v3, and why?" is answerable |
| `order_transaction` | `OrderTransaction` | the order's payment ledger |
| `order_change` | `OrderChange` | a post-placement modification, as an ordered set of actions |
| `order_change_action` | `OrderChangeAction` | one action inside a change |
| `order_credit_line` | `OrderCreditLine` | money owed back to the buyer |
| `order_history` | `OrderHistory` | the order's own timeline |

## The four rules this package exists to enforce

1. **Money is exact.** Every amount is a `numeric(20,6)` decimal with a sibling ISO-4217 currency,
   computed through the core `Money` value object. No monetary value is ever a JavaScript float, and
   `TotalsCalculator` — one function, shared with the cart — is the only writer of a total column.
2. **A placed order is immutable.** Every post-placement mutation is an `order_change` carrying an
   ordered list of typed `order_change_action` rows, applied atomically, and at most one change per
   order may be non-terminal at any moment.
3. **Snapshots, not joins.** The title, SKU, price, tax breakdown, shipping price, currency decimals
   and addresses are copied onto the order. Reading a placed order never depends on the current state
   of a product, a price list, a tax rate or an address book entry.
4. **The number comes from the platform.** `order.number` is allocated from the core `sequence`
   service with `key = 'ORDER'` — never from a counter of this package's own.

## What it does not own, and reuses instead

- A buyer is an **`organization_contact`** — the row the platform already carries for a client, a
  customer or a lead, including its CLIENT / CUSTOMER / LEAD contact types. There is no customer table.
- Discounts, fees, loyalty redemptions, cash rounding and credits are rows of the core **`adjustment`**
  ledger; the tax breakdown is rows of the core **`tax_line`** ledger. This package keeps no parallel
  tax or discount columns.
- Durable checkout work is the core **`operation`** runtime, and observable changes are emitted through
  the core **`event_outbox`**.
- The accounting document is the core **`invoice`**, produced by the order-to-invoice bridge.

## API

One surface, one controller per entity: `/api/orders`, `/api/order-lines`, `/api/order-addresses`,
`/api/order-shipping-methods`, `/api/order-summaries`, `/api/order-transactions`, `/api/order-changes`,
`/api/order-change-actions`, `/api/order-credit-lines`, `/api/order-history`.

## Dependencies

`@gauzy/plugin-cart` (an order is placed from a cart, and the two share one totals function),
`@gauzy/plugin-pricing` (a line is priced by the price resolver) and `@gauzy/plugin-tax` (a tax line is
produced by the tax resolver). It registers itself as the cart's checkout handler at bootstrap, which is
what keeps the dependency one-way.
