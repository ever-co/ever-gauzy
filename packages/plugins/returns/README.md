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

`CreateReturnTables1791000000300`, multi-dialect (PostgreSQL, MySQL, SQLite), with a `down` that
reverses every statement.

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
