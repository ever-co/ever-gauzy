# @gauzy/plugin-returns

## Overview

Returns, claims and exchanges: what happens after something was delivered and should not have been,
or arrived wrong.

The three flows live in one package because they answer one question, share the reason codes, the
numbering series and the receiving step, and are enabled by a tenant together or not at all.

| Flow | What it is | Where the money is |
|---|---|---|
| **Return** | Goods come back and may be refunded, with a governed reason and an explicit lifecycle | `order_return.refundAmount`, and a `refund` row written by the payment capability |
| **Claim** | A complaint about a delivered order plus the resolution chosen for it — money or a replacement | `order_claim.refundAmount` for a refund claim; a shipment for a replacement claim |
| **Exchange** | A return that immediately becomes a new shipment, priced against it | `order_exchange.differenceDue`, the frozen difference the customer owes or is owed |

## Tables

`order_return`, `order_return_line`, `order_return_reason`, `order_claim`, `order_claim_line`,
`order_exchange`, `order_exchange_line`.

## The rule the domain exists for

**A return may only cover what was actually fulfilled on the order, and the sum of the live returns
of one order line may never exceed it.** The check runs on the only path that writes a return line,
against the fulfilled quantities the order capability reports, and it is exact: quantities are
compared as scaled integers, never as floating point numbers near the boundary where the answer
matters.

Claims are bounded the same way: a claim about an order line is refused when that line was never
fulfilled, because a customer cannot claim about something that never shipped.

## Money

Every amount is an exact decimal at `numeric(20,6)` with a sibling ISO currency, and every
computation — a refund total, an exchange difference — goes through the platform money layer
(`packages/core/src/lib/money/`) rather than through inline arithmetic.

## Endpoints

REST, one controller per entity, on `/order-returns`, `/order-return-lines`, `/order-return-reasons`,
`/order-claims`, `/order-claim-lines`, `/order-exchanges`, `/order-exchange-lines`, with the lifecycle
as actions (`POST /order-returns/:id/approve`, `/reject`, `/receive`, `/refund`, `/shipping`,
`/cancel`, `/close`).

GraphQL, the same operations over the one platform schema: `orderReturns`, `orderReturn(id)`,
`orderReturnReasons`, `orderClaims`, `orderExchanges`, the three line lists, and the mutations
`requestOrderReturn`, `approveOrderReturn`, `rejectOrderReturn`, `receiveOrderReturn`,
`cancelOrderReturn`, `closeOrderReturn`, `createOrderReturnReason`, `updateOrderReturnReason`,
`deleteOrderReturnReason`, `requestOrderClaim`, `approveOrderClaim`, `rejectOrderClaim`,
`requestOrderExchange`, `approveOrderExchange`, `rejectOrderExchange`.

## Retry safety and the return's version

Two conventions ride on the routes that move goods and money, and both are the platform's own
(`packages/core/src/lib/idempotency/` and `packages/core/src/lib/concurrency/`).

**A retry key.** `POST /order-returns` and its mutation `requestOrderReturn` honour an
`Idempotency-Key` header — the `idempotencyKey` input member over GraphQL — when one is presented.
`POST /order-returns/:id/receive` and `receiveOrderReturn` require one, because receiving the same
goods twice restocks and refunds them twice. A retry under the same key and the same bytes is answered
with the first attempt's response instead of running the work again, and a key reused for a different
request is refused with `IDEMPOTENCY_KEY_REUSED`.

**A version.** A return carries a `version` that every write of its header moves on, and the version is
incremented by the same statement that checks it. A write states the version it read — an `If-Match`
header on REST, the `version` member of the mutation's input on GraphQL, or the mutation's own `version`
argument where it takes no input — and is refused with `ENTITY_VERSION_CONFLICT` when the return has
moved past it, or with `VERSION_REQUIRED` when it states none. Every response that carries the return
publishes the version in an `ETag`; a read states none, because reading is how a client learns the
version it has to state.

## Capabilities this plugin reaches through ports

Four things belong to other domains and are injected under tokens rather than implemented here:

| Token | Capability | Without it |
|---|---|---|
| `RETURNS_ORDER_FULFILLMENT` | The fulfilled quantities of an order | A return cannot be validated and is refused |
| `RETURNS_STOCK_LEDGER` | The stock ledger the received units are written to | Goods can be received, but no movement is written |
| `RETURNS_REFUND_GATEWAY` | The refund that sends money back | A refund cannot be issued |
| `RETURNS_SHIPMENT_GATEWAY` | The return leg's carrier and label | No return leg can be created |

A tenant with none of them can still run the whole lifecycle — nothing here writes a stock level or
a refund itself.

## Permissions and features

Declared in `returns.permissions.ts` (`RETURNS_*`, `CLAIMS_*`, `EXCHANGES_*`) and
`returns.features.ts` (`FEATURE_RETURNS`, off by default: post-purchase flows change financial and
stock behaviour and are enabled once the tenant's policy exists).

## Migrations

`CreateReturnTables1791000000300`, `AddReturnsLinePositiveChecks1791000000432` and
`AddOrderReturnVersionColumn1791000000590`, each multi-dialect (PostgreSQL, MySQL, SQLite) and each with
a `down` that reverses its own statements. The third gives a return the version its writes are
predicated on: `version int NOT NULL DEFAULT 1`, so every row that already exists carries the value the
entity declares.

## Building

Run `yarn nx build plugin-returns` to build the library.

## Running unit tests

Run `yarn nx test plugin-returns` to execute the unit tests via [Jest](https://jestjs.io).

## Publishing

After building your library with `yarn nx build plugin-returns`, go to the dist folder
`dist/packages/plugins/returns` and run `npm publish`.

## Installation

```bash
npm install @gauzy/plugin-returns
# or
yarn add @gauzy/plugin-returns
```
