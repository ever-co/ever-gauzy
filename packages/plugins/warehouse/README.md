# @gauzy/plugin-warehouse

## Overview

Warehouse management: the physical organisation of a stock location, the work of picking and packing,
and the manifest handed to a carrier.

A stock location says *how much* of a variant is on hand. This package says *where inside the building*
it sits, *who* walks to fetch it, what went into the parcel and what was handed over — so it owns the
inside of the building and no quantity of its own. The ledger stays the single authority for stock, and
every physical move this domain causes is a movement written through the inventory capability.

| Concept | What it is | Where the quantity lives |
|---|---|---|
| **Zone** | A named area of one location: receiving, storage, picking, packing, staging, shipping, returns, quarantine, damage | Nowhere — a zone holds bins, not stock |
| **Bin** | One addressable position inside a zone, in a tree (aisle → rack → level → position) | Derived from the movement ledger |
| **Wave** | A batch of picking work released to the floor together | Nowhere — its counters are caches of its lists |
| **Pick list** | The work for one picker, derived from the shipments that are due to leave | Nowhere — a pick does not move stock |
| **Pick line** | What, how much, from which bin, and what actually happened | A short pick writes an adjustment through the ledger |
| **Pack slip** | The packing record: packages, weight, tracking, label | The weight of record, never recomputed |
| **Carrier manifest** | The document a carrier accepts, and the custody boundary | The members' packed weights, frozen at close |

## Tables

`warehouse_zone`, `warehouse_bin`, `pick_wave`, `pick_list`, `pick_list_line`, `pack_slip`,
`carrier_manifest`, plus the derived `warehouse_bin_closure`, which the ORM and the bin service
maintain and which is never declared as an entity.

## The rules the domain exists for

**A pick list asks for exactly what its shipments still need.** The lines are derived from the shipment
side, never authored, and generation is idempotent per shipment and area — so a re-run of the generator
cannot double the work and a list can never ask for more or less than the shipment it serves.

**Picking does not move stock, but a short pick corrects it.** The level was already decremented when
the shipment consumed its reservations, so a plain pick leaves the ledger alone. A bin that held less
than the list asked for is a stock error, and the missing quantity is written back through the inventory
capability in the same transaction as the line.

**A bin is blocked, never deleted, while it holds anything.** Its balance is derived from the ledger, the
foreign key from a pick line is `SET NULL`, and deleting a position would silently erase where stock was
picked from. The service refuses it.

**The bin tree and its closure never disagree.** Every re-parent rewrites the closure rows in the same
transaction as the row itself, so "everything under this rack" is one indexed join and it is always
right.

**A manifest's membership is derived while it is a draft and frozen at close.** Closing writes
`fulfillment.metadata.manifestId` for every member in one transaction, which is what stops a parcel
appearing on two manifests. Adding a column to the fulfilment table was the alternative and it was
rejected: the manifest covers shipments, and the shipment is the row that knows which carrier took it.

## Endpoints

REST, one controller per entity, on `/warehouse-zones`, `/warehouse-bins`, `/pick-waves`, `/pick-lists`,
`/pick-list-lines`, `/pack-slips` and `/carrier-manifests`, with the lifecycle as actions
(`POST /pick-waves/:id/release`, `/start`, `/complete`, `/close`, `/close-short`, `/cancel`;
`POST /pick-lists/:id/lines/:lineId/pick`, `/substitute`, `/skip`; `POST /pack-slips/:id/pack`, `/void`;
`POST /carrier-manifests/:id/submit`, `/handover`, `/cancel`).

GraphQL, the same operations over the one platform schema: `warehouseZones`, `warehouseZone(id)`,
`warehouseBins`, `warehouseBin(id)`, `warehouseBinSubtree(id)`, `warehouseBinContents(id)`,
`pickWaves`, `pickWave(id)`, `pickLists`, `pickList(id)`, `pickListLines(pickListId)`,
`pickListLine(id)`, `packSlips`, `packSlip(id)`, `carrierManifests`, `carrierManifest(id)`, and the
mutations `createWarehouseZone`, `updateWarehouseZone`, `reorderWarehouseZones`,
`setWarehouseZoneBlocked`, `deleteWarehouseZone`, `createWarehouseBin`, `createWarehouseBinRange`,
`updateWarehouseBin`, `reparentWarehouseBin`, `setWarehouseBinBlocked`, `deleteWarehouseBin`,
`reconcileWarehouseBins`, `createPickWave`, `releasePickWave`, `startPickWave`, `completePickWave`,
`closePickWave`, `closePickWaveShort`, `cancelPickWave`, `createPickList`, `assignPickList`,
`startPickList`, `completePickList`, `cancelPickList`, `pickPickListLine`, `substitutePickListLine`,
`skipPickListLine`, `createPackSlip`, `packPackSlip`, `voidPackSlip`, `createCarrierManifest`,
`submitCarrierManifest`, `handOverCarrierManifest`, `cancelCarrierManifest`.

## Capabilities this plugin reaches through ports

Two things belong to other domains and are injected under tokens rather than implemented here:

| Token | Capability | Without it |
|---|---|---|
| `WAREHOUSE_STOCK_LEDGER` | Bin balances, home bins, movements and relocations | A short pick, a substitution and a reconciliation are refused; contents cannot be derived |
| `WAREHOUSE_FULFILLMENT` | The lines of the shipments due to leave, and the shipments a manifest covers | Work cannot be derived and no manifest can resolve its members |

Nothing here registers a provider under either token: the plugin that owns the capability does, and this
package works — zones, bins, waves, empty lists, packing records — with neither installed.

## Permissions and features

Declared in `warehouse.permissions.ts` (`WAREHOUSE_ZONES_*`, `WAREHOUSE_BINS_*`, `PICK_LISTS_*`) and
`warehouse.features.ts` (`FEATURE_WAREHOUSE`, off by default: adopting it changes how a location
addresses the units inside it, and a location with no pickable zone routes every generated line to
nowhere). Packing and manifests are authorised by the fulfilment permissions, which the fulfilment
domain owns and this package references rather than redeclaring.

## Migrations

`CreateWarehouseLayoutTables1791000000180` — `warehouse_zone`, `warehouse_bin`, the derived
`warehouse_bin_closure`, and the foreign key `warehouse_product_variant.binId` → `warehouse_bin(id)`,
added only when that column is present.

`CreateWarehouseWorkTables1791000000190` — `pick_wave`, `pick_list`, `pack_slip`, `pick_list_line`,
`carrier_manifest`.

Both are multi-dialect (PostgreSQL, MySQL, SQLite), each with a `down` that reverses every statement.

## Building

Run `yarn nx build plugin-warehouse` to build the library.

## Running unit tests

Run `yarn nx test plugin-warehouse` to execute the unit tests.

## Publishing

After building your library with `yarn nx build plugin-warehouse`, go to the dist folder
`dist/packages/plugins/warehouse` and run `npm publish`.

## Installation

```bash
npm install @gauzy/plugin-warehouse
# or
yarn add @gauzy/plugin-warehouse
```
