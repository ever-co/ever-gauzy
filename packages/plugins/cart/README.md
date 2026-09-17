# @gauzy/plugin-cart

The cart family of the Ever Gauzy platform: what a buyer is assembling before it becomes an order.

## What this package owns

| table | entity | what it is |
|---|---|---|
| `commerce_cart` | `CommerceCart` | the pricing and validation workspace; fully re-priceable |
| `commerce_cart_line` | `CommerceCartLine` | one line, with its snapshot of the title, SKU and price at add time |
| `commerce_cart_shipping_method` | `CommerceCartShippingMethod` | a delivery choice held against a cart before an order exists |
| `commerce_cart_promotion` | `CommerceCartPromotion` | a snapshot of a promotion applied to the cart |
| `commerce_checkout_session` | `CommerceCheckoutSession` | the state of an in-progress checkout, which expires |

The five `commerce_`-prefixed names are the only ones in the platform that carry a domain prefix, and
they carry it for one reason: a cart has no meaning outside an online purchase, and the bare name is
ambiguous next to a purchase-requisition basket and a point-of-sale basket. Every other table of this
programme is named for its concept.

## What it does not own

Money that modifies an amount payable is **not** invented here. A cart's discounts, fees, loyalty
redemptions and cash rounding are rows of the core `adjustment` ledger, and its tax breakdown is rows
of the core `tax_line` ledger. The cart's own total columns are a **cache** of those ledgers plus its
lines, and `CartTotalsCalculator` is the one function that writes them.

A buyer is an `organization_contact` — the row the rest of the platform already uses for a client, a
customer or a lead. This package never creates a customer table.

## Totals

`CartTotalsCalculator.compute()` implements the authoritative computation order:

```
unit prices  -> line subtotal -> line discounts -> line tax
             -> shipping subtotal -> shipping discounts -> shipping tax
             -> discountTotal / taxTotal / grandTotal
```

Money is an exact decimal (`numeric(20,6)`) with a sibling ISO-4217 currency, computed through the
core `Money` value object and rounded only at the boundaries the money specification names. No
monetary value is ever a JavaScript float.

## API

One surface, one controller per entity, guards and permissions exactly as the rest of the platform:
`/api/carts`, `/api/cart-lines`, `/api/cart-shipping-methods`, `/api/cart-promotions`,
`/api/checkout-sessions`. Checkout itself is `POST /api/carts/:id/complete`.

## Dependencies

`@gauzy/plugin-catalog` (a line is only addable for a published variant), `@gauzy/plugin-pricing`
(the price a line carries is resolved, never authored) and `@gauzy/plugin-inventory` (availability and
the reservations checkout takes).
