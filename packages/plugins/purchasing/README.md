# @gauzy/plugin-purchasing

## Overview

Purchasing: what the organization buys, what actually arrives, and how the two are reconciled.

A **purchase order** is an intention — a supplier, a receiving location and the lines that are
expected. A **goods receipt** is the fact — what physically turned up, and the stock movements that
make it sellable. Keeping the two apart is what makes a short delivery visible: the order still
expects the remainder, the receipt records only what came.

## Tables

`purchase_order`, `purchase_order_line`, `goods_receipt`, `goods_receipt_line`, `vendor_product_term`.

`vendor_product_term` is the row that carries the agreement: many negotiated terms per vendor **and**
product, each with its own quantity break, lead time, pack, validity window and over-receipt tolerance. It
is deliberately not a role-discriminated price row — a seller and a supplier are two concepts the design
keeps strictly disjoint — and the six `organization_vendor` columns are the vendor-level **defaults** the
resolution falls through to. The precedence is stated once: **term row → vendor row → organization
setting → none**.

The supplier is **not** a table of this package. `organization_vendor` is the platform's supplier
master and already models the concept, so the six purchasing columns it was missing — `code`,
`currency`, `paymentTermsDays`, `leadTimeDays`, `minimumOrderAmount`, `metadata` — are added to it by
this package's migration, guarded, and `purchase_order.vendorId` points at that row.

## The lifecycle

```
DRAFT ──approve──▶ (approved) ──send──▶ SENT ──acknowledge──▶ ACKNOWLEDGED
  │                                       │                          │
  │ cancel                                │ cancel                   │ receive
  ▼                                       ▼                          ▼
CANCELED                              CANCELED        PARTIALLY_RECEIVED ⇄ RECEIVED
                                                                       │
                                                          close ───────┴──▶ CLOSED
```

Approval is recorded **as a fact** — `approvedAt`, `approvedByUserId`, `approvalId` — rather than as a
status, because a draft waiting for a decision is still a draft and a refused approval has to leave the
order where it was. An order that has not been approved cannot be sent; a tenant that does not want the
step grants `PURCHASE_ORDERS_APPROVE` and `PURCHASE_ORDERS_SEND` to the same role.

`CANCELED` is reachable only from `DRAFT` and `SENT`: once goods have arrived the order is finished by
`CLOSED`, which is the state that says the remainder was abandoned deliberately and keeps the receipts
explained. `receivedAt` is non-null exactly when the status is `RECEIVED` or `CLOSED`.

Each edge has its own permission, because the edges are not equivalent decisions: approving commits the
money, sending tells the supplier, acknowledging records what the supplier said back, and receiving is a
warehouse event with stock consequences.

## The rules the domain exists for

**A receipt may not push a line past its ordered quantity beyond the allowance it is received
under.** The check is exact — quantities are compared as scaled integers, on the boundary where a
floating point comparison would give the wrong answer — and a breach is refused with
`RECEIPT_OVER_TOLERANCE` (the refusal `PURCHASE_ORDER_RECEIPT_QUANTITY_EXCEEDS_ORDERED` named, under the
allowance resolution below). Because goods that have physically arrived must be recordable, the ceiling
is the ordered quantity **plus an allowance**, resolved per line: what the caller states for one
delivery, then the fraction the line's own winning term negotiated, then the organization's
`purchasing.overReceiptTolerancePercent` setting, then `metadata.overReceiptTolerance` on the order, and
none of them means no allowance at all.

**A receipt's location must equal the location of every order its lines belong to.** Receiving into a
different building is a transfer, not a receipt; allowing it here would move stock between locations
silently. The receipt's **order anchor is optional** — a consolidated delivery covering several orders
states none, and what the header column cannot state the service checks: when it is set, every line has
to belong to that order (`RECEIPT_ORDER_MISMATCH`).

**The three-way match is three quantities, and only two of them are counters.** Ordered and received are
written by the order and by receipts; **billed is a cache re-derived** from the bill lines rather than
incremented, so a voided bill leaves it equal to the sum of the bills that stand. What is still unbilled
(`toBillQuantity`, under the variant's `ON_ORDERED` / `ON_RECEIVED` policy) is **derived at read and
never stored**, and a bill that would pass what the policy allows is refused as
`PURCHASE_LINE_OVERBILLED`, one from another supplier's order as `PURCHASE_BILL_VENDOR_MISMATCH`.

**This domain never writes an inventory table.** Every movement goes through the inventory capability,
injected under `PURCHASING_INVENTORY`. A good unit is a `RECEIPT`, a unit that arrived broken is a
`DAMAGE` that leaves the level unchanged, and reversing a receipt is a `WRITE_OFF` of exactly what the
receipt added. Put-away — a line that names a bin — goes through the same seam.

## The agreement

`vendor_product_term` is the row a purchase line is priced and dated from, and the resolution that reads
it is one documented method (`resolve()`), in this order: the `ACTIVE` rows of that supplier and variant
whose window contains the date and whose quantity break the quantity reaches; ordered by `priority`,
then `minQuantity` **descending**, then unit cost, then id; the winner's price and negotiated fraction
applied and snapshotted on the line. A term stated in another currency is **refused**
(`PRICE_EXCHANGE_RATE_MISSING`) rather than converted at an assumed 1:1 — this package holds no rate
reader, and a guessed price snapshotted onto a placed order cannot be told apart from a real one. When
nothing matches, the variant's own cost price is used if it is stated, and otherwise the line is entered
by hand: a missing term is a **warning** (`VENDOR_TERM_NOT_FOUND`) on the line's `metadata.pricing`,
never a refusal.

`purchase_order_line.vendorTermId` is **provenance**: the line never re-reads the term, so a term
renegotiated today changes future orders only. Two live rows of one supplier, variant and currency may
not claim the same quantity band (`VENDOR_TERM_OVERLAP`, re-checked nightly), and a term a placed order
used is never deleted — its `status` moves to `INACTIVE`.

## Snapshots taken when an order is placed

`vendorReference` (the supplier's own number, which their acknowledgement and their bill quote),
`buyerUserId`, and the settlement schedule — `paymentTermId`, `paymentTermsDaysSnapshot` and the
`dueDate` they produce — are recorded on the order. Each line's `expectedAt` comes from the lead time its
own term resolved, snapshotted on the line so the send transition can date it
(`expectedAt = orderedAt + leadTimeDays`) without re-reading anything, and the header's `expectedAt` is
the minimum over the lines.

## Money

Every amount is an exact decimal at `numeric(20,6)` with a sibling ISO currency column, and every
computation goes through the platform money layer (`packages/core/src/lib/money/`) rather than through
inline arithmetic. The header totals are **derived on every write** from the lines, so the documented
formula — `subtotal − discountTotal + taxTotal + shippingTotal` — holds by construction.

## Endpoints

REST, one controller per entity: `/purchase-orders`, `/purchase-order-lines`, `/goods-receipts`,
`/goods-receipt-lines`, `/vendor-product-terms`, with the lifecycle as actions
(`POST /purchase-orders/:id/approve`, `/send`, `/acknowledge`, `/cancel`, `/close`, `/receipts`,
`POST /goods-receipts/:id/cancel`, and `POST /vendor-product-terms/bulk` for a product-wide agreement
written as one row per variant).

GraphQL, over the one platform schema: `purchaseOrders`, `purchaseOrder(id)`, `goodsReceipts`,
`goodsReceipt(id)`, `vendorProductTerms`, `vendorProductTerm(id)`, `resolveVendorProductTerm(input)`, and
the mutations `createPurchaseOrder`, `updatePurchaseOrder`, `deletePurchaseOrder`, `sendPurchaseOrder`,
`closePurchaseOrder`, `cancelPurchaseOrder`, `createGoodsReceipt`, `recordGoodsReceiptLine`,
`closeGoodsReceipt`, `createVendorProductTerm`, `updateVendorProductTerm`, `bulkVendorProductTerms`,
`deleteVendorProductTerm`. A line's unbilled remainder is the field `toBillQuantity(policy)`.

Every route takes the caller's `If-Match` version where the document carries one, so two buyers acting
on one purchase order cannot both win.

## Capabilities this plugin reaches through ports

| Token | Capability | Without it |
|---|---|---|
| `PURCHASING_INVENTORY` | The stock ledger and put-away | A receipt with units to move is refused; nothing here writes a level itself |
| `PURCHASING_APPROVAL` | The platform approval request | The approval is recorded on the order alone, which is what a role-based approval needs |

## Permissions and features

`PURCHASE_ORDERS_VIEW`, `PURCHASE_ORDERS_CREATE`, `PURCHASE_ORDERS_EDIT`, `PURCHASE_ORDERS_APPROVE`,
`PURCHASE_ORDERS_SEND`, `GOODS_RECEIPTS_VIEW`, `GOODS_RECEIPTS_CREATE`, `VENDOR_TERMS_VIEW`,
`VENDOR_TERMS_EDIT`, and `FEATURE_PURCHASING` — off by default, because procurement is a separate
process with its own approval policy and enabling it by default would expose the endpoints to tenants
that keep no supplier data. The vendor terms are their own pair of values: a buyer sees the price that
was applied on a line and the term it came from, which is provenance on the order, and
`PURCHASE_ORDERS_VIEW` deliberately does not reveal the standing agreement.

## Migrations

`CreatePurchasingTables1791000000340` creates the four documents and extends the supplier master, and
`CreateVendorProductTermTable1791000000345` creates the agreement, adds the columns and indexes the
documents gained for it, and widens the line's business key from `(order, variant)` to
`(order, variant, expected date)`. Both are multi-dialect (PostgreSQL, MySQL, SQLite) with a `down` that
reverses every statement.

The second file's timestamp is not the one the programme's plan reserved for it: that plan placed the
file at `1791000000425`, while this package's shipped set occupies `1791000000340`, and a migration's
timestamp is frozen once it has run. It therefore takes the next free tick inside the package's own
sub-range, `1791000000345` — the same position in the run order, without renumbering a file that has
already shipped.

Every `ALTER TABLE … ADD COLUMN` in it is guarded by `hasColumn`, so a second run adds nothing; the
indexes use `IF NOT EXISTS` (and a catalogue check on MySQL, which has none); and the two changes SQLite
has no `ALTER TABLE` for — adding a constraint and dropping `NOT NULL` — are performed by rebuilding the
two tables from their own recorded definitions, replaying the indexes a rebuilt table would otherwise
lose.

## Building

Run `yarn nx build plugin-purchasing` to build the library.

## Running unit tests

Run `yarn nx test plugin-purchasing` to execute the unit tests via [Jest](https://jestjs.io).

## Publishing

After building your library with `yarn nx build plugin-purchasing`, go to the dist folder
`dist/packages/plugins/purchasing` and run `npm publish`.

## Installation

```bash
npm install @gauzy/plugin-purchasing
# or
yarn add @gauzy/plugin-purchasing
```
