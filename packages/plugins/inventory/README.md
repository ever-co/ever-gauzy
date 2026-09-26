# @gauzy/plugin-inventory

## Overview

The inventory plugin owns the stock ledger and everything that holds, moves or corrects stock. It
extends the platform rather than replacing it: `warehouse`, `warehouse_product` and
`warehouse_product_variant` already model stock on hand, and this package adds the append-only ledger
beside them, the holds taken against them, and the documents that move or correct them.

## What it owns

| Table | Purpose |
|---|---|
| `stock_movement` | The append-only ledger. Every quantity change writes exactly one row, and the row carries the resulting quantity so the ledger can be summed back to the level. |
| `stock_reservation` | Stock held for a cart, an order or a post-purchase replacement, with an expiry. |
| `stock_transfer` | A movement of stock between two locations. |
| `stock_transfer_line` | The per-variant quantities of a transfer. |
| `stock_alert` | An explicit low-stock rule with its own recipients and cooling-off period. |
| `channel_warehouse` | The pivot that enables a location for a sales context. |
| `stock_adjustment` | The instruction row behind a manual correction, so every movement names a document. |
| `stock_count` | A physical count session. |
| `stock_count_line` | One variant's reading inside a session, with its variance. |

## The rules the package enforces

- **The ledger is append-only.** A movement is never updated and never deleted; a correction is a new
  reversing movement. The service refuses both, and the migration installs a trigger that refuses them
  at the database level too.
- **The ledger is written with the level.** `StockLevelService.applyMovement` writes the movement, the
  level row and the product-level aggregate inside one transaction, under a row lock, so the level can
  never disagree with the ledger that explains it.
- **Availability is derived, never stored.** `availableQuantity = quantity - reservedQuantity - safetyStock`.
- **A hold cannot oversell.** The reservation guard is evaluated against the locked level row on
  Postgres and MySQL, and inside the serialized transaction on SQLite.
- **Concurrent writers cannot lose an update.** The level update is a compare-and-set on the level's
  optimistic-lock counter, retried with backoff and then refused with a stated conflict.

## Building

Run `yarn nx build plugin-inventory` to build the library.

## Running unit tests

Run `yarn nx test plugin-inventory` to execute the unit tests via [Jest](https://jestjs.io).

## Publishing

After building your library with `yarn nx build plugin-inventory`, go to the dist folder
`dist/packages/plugins/inventory` and run `npm publish`.

## Installation

```bash
npm install @gauzy/plugin-inventory
# or
yarn add @gauzy/plugin-inventory
```
