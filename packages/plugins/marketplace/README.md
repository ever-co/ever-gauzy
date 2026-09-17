# @gauzy/plugin-marketplace

## Overview

The marketplace plugin turns the platform into a multi-vendor marketplace: independent seller
accounts with their own offerings, their own prices, a commission the platform charges them, a
per-seller ledger of what each one earned or owes, scheduled payouts and the provider settlements that
report them.

It is **backend only**. Sellers and operators work through the platform's single API surface — REST
and GraphQL with identical guards, permissions and scoping. There is no operator console, no seller
console and no storefront in this package.

## What it owns

| Table | What it is |
|---|---|
| `seller` | A merchant on the marketplace: a party plus the lifecycle, the commission, the tax registration, the payout terms and the balance that make the party a participant. |
| `seller_offering` | A seller's right to sell one catalogue variant, at its price, under its SKU, in a set of channels, for a period. |
| `seller_transaction` | The per-seller split of an order's money: the ledger the whole marketplace is reconciled against. |
| `seller_payout` | One instruction to move one seller's settleable balance, in one currency, to the seller's bank account. |
| `seller_payout_line` | The join between a payout and the ledger rows it pays. |
| `seller_settlement` | What the payment provider reported it did, recorded as reported. |

## The seller is a party plus a participation, not a new party

The platform already has the party row — `organization_contact`, with its buyer relationship, its
invoices, its payments and its audit trail — and it already has a payee master, `merchant`. Neither is
the seller, and neither is duplicated here:

- **`merchant` keeps its existing meaning.** It is a label the organization pays by invoice, with no
  lifecycle, no commission and no balance. Where the same business is both, `seller.merchantId` links
  the two so nobody types the business twice, and the marketplace never reads `merchant` for
  commission, split or payout arithmetic.
- **`seller` hangs off `organization_contact`.** `seller.contactId` is unique per organization, which
  is what makes "one seller account per party per organization" true, while the same party may be a
  buyer on one channel and a seller on another.
- **`organization_vendor` is not reused**: a vendor is whom the organization buys *from*, which is the
  opposite direction of trade.

## The ledger is the truth; the payout is derived

Every monetary column is an exact decimal with its own ISO currency, and every computation goes
through the platform's money helper rather than through inline arithmetic. Two identities hold
exactly, at the row's currency precision:

```
netAmount = grossAmount + taxAmount + sellerDiscountAmount − commissionAmount          (per row)
Σ (net + commission + platformDiscount) + platformOwnCaptured = capturedAmount        (per order)
```

Consequences the code enforces rather than documents:

- **The commission is computed once and snapshotted.** The resolved rate, basis and basis amount are
  stored on the ledger row, so a later change to the offering, the seller or the platform default never
  moves a past transaction.
- **The ledger is append only.** A correction is a reversal row naming the row it reverses; a settled
  payout is never rewritten to agree with a later reversal — the negative is carried forward.
- **A payout is built from settleable transactions of one seller in one currency and by nothing else**,
  its amount is the sum of its lines, and its reserve is computed at each run rather than stored.
- **A transaction is in at most one live payout** (`UQ_seller_payout_line_tx`), so a scheduler that
  fires twice pays nobody twice, and cancelling a payout releases its lines.
- **A payout never exceeds the unsettled balance**: it is those rows, and a balance that is negative
  produces no payout at all rather than a negative one.
- **Commission bases never move with someone else's promotion.** A platform-funded discount reduces
  what the buyer pays and the tax on it, and never the commission basis or the seller's net.

## Money movement

**The platform holds no funds.** There is no platform wallet, no escrow and no commingled balance: no
table here is a cash balance and no column here is a bank account number. The seller's money sits at
the payment provider, in the seller's own account, and:

- `seller_transaction` is a **liability the platform records**, not cash it controls;
- `seller_payout` is the record of an **instruction** given to a regulated provider;
- `seller_settlement` is what the provider **reported**, and where the provider's figures and the
  platform's ledger disagree, the difference is stored as `discrepancyAmount` and reported — the
  ledger is never edited to agree with an external report;
- the destination is a verified account holder the platform references by id,
  `seller.payoutAccountHolderId`, not a string it stores.

A provider that cannot hold the account itself is a provider the marketplace is not enabled with.

## Seller isolation

A seller sees its own rows and nothing else, and it is isolation rather than filtering: every
seller-scoped service method takes a seller scope as its first argument, the guard refuses a request
that names a seller outside the caller's membership set (`403`, naming the seller, rather than an
empty page), and a channel-scoped read applies the channel predicate *in addition to* the seller one.
Platform-wide figures, another seller's rows and the money the platform earns are staff-only, and the
commission a seller reads is its own.

## API

One surface, one controller per concept. Everything under `CrudController` inherits the standard route
set; the marketplace adds the lifecycle and money operations.

| Resource | Path | Notable operations |
|---|---|---|
| Sellers | `/sellers` | `submit`, `verify`, `activate`, `suspend`, `reinstate`, `reject`, `offboard`, `statement`, `balance` |
| Offerings | `/seller-offerings` | `submit`, `publish`, `unpublish`, `PUT /:id/channels`, `DELETE /:id` (withdraw) |
| Ledger | `/seller-transactions` | `reconciliation`, `:id/settle`, `:id/hold` |
| Payouts | `/seller-payouts` | `POST /run`, `:id/approve`, `:id/pay`, `:id/cancel`, `:id/retry` |
| Payout lines | `/seller-payout-lines` | read |
| Settlements | `/seller-settlements` | `:id/reconcile`, `:id/close`, `:id/dispute` |

GraphQL exposes the same resources with the same permissions, including the `sellerChanged`,
`sellerPayoutChanged` and `sellerSettlementChanged` event roots the platform's subscription model uses.

## Permissions and features

Permissions are declared in `src/lib/marketplace.permissions.ts` and unioned into the platform's
catalogue at bootstrap; features in `src/lib/marketplace.features.ts`, all **off** by default, because
third-party selling changes who may be paid and how much. `SELLER_PAYOUTS_APPROVE` is deliberately
separate from `SELLER_PAYOUTS_CREATE`: creating a payout is preparation, approving one moves money,
and a tenant that wants four-eyes control assigns the two to different roles.

## Migration

`1791000000380-CreateMarketplaceTables` creates all six tables for PostgreSQL, MySQL and SQLite, with a
true inverse. Two properties of it are deliberate:

- **Cross-package foreign keys.** Constraints onto kernel tables that exist (`organization_contact`,
  `merchant`, `user`, `product`, `product_variant`, `warehouse`) are created by this migration.
  Identifiers that point at tables another package owns (`order`, `order_line`, `order_transaction`,
  `refund`, `product_price`, `payment_account_holder`) are created as **indexed columns without a
  constraint**, which is the programme's own convention for a cross-package reference: the owning
  package's migration adds the constraint, so this migration still runs while the package set is being
  assembled. Each such column names the constraint it is waiting for in the migration's doc block.
- **MySQL has no partial indexes**, so each predicate-stated uniqueness is expressed over a stored
  `deletedKey` column (and, where the predicate is a null guard, over the nullable column itself,
  because MySQL treats `NULL`s as distinct). The writing service re-checks the predicate, so the
  guarantee is never weaker than the code relying on it.

## What is deliberately not here

- **No UI of any kind**, and no `-ui` package.
- **No funds and no money transmission**: no wallet, no escrow, no platform balance, and therefore no
  third payout mode. A payout instruction to a provider whose model would leave the seller's money in
  the platform's account is refused by configuration rather than supported by code.
- **No third-party eligibility-rule storage**: seller and offering eligibility is a `rule` row with
  `ownerType = SELLER`, evaluated by the platform's one rule evaluator; this package does not add a
  second condition mechanism.
- **No new price resolver**: a seller's price is a `product_price` row with the seller set, resolved by
  the platform's one price-resolution algorithm, so a seller-scoped row wins for that seller's lines
  and for nobody else's.
- **No seller notification templates**: the events are emitted on the outbox and delivered through the
  platform's existing webhook and notification machinery. A profile edit emits no event, because the
  event catalogue this package implements names a state change for every lifecycle transition and does
  not name a profile edit.
- **The scheduled jobs** (`seller-payout-run`, `seller-transaction-settleable`, the reconciliation and
  expiry passes) are specified by the programme and are invoked through the platform's scheduler and
  durable-operation machinery. This package provides the services they drive — `run()`,
  `recordExecution()`, `reconcile()` — and the feature flag that switches the automatic run on.

## Building and testing

```bash
yarn nx build plugin-marketplace
yarn nx test plugin-marketplace
```
