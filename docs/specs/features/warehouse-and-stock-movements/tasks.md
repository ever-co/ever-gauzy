# Task Breakdown: Warehouse and stock movements

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `warehouse-and-stock-movements`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind the feature flag: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it.
- `INV/` = `packages/plugins/inventory/src/lib/`, `WH/` = `packages/plugins/warehouse/src/lib/`,
  `CW/` = `packages/core/src/lib/warehouse/`, `IU/` = `packages/plugins/inventory-ui/src/lib/`,
  `WU/` = `packages/plugins/warehouse-ui/src/lib/`, `FL/` = `packages/plugins/floor-ui/src/lib/`,
  `PG/` = `apps/gauzy/src/app/pages/inventory/components/`. Every new entity file has its
  `repository/type-orm-<name>.repository.ts` and `repository/mikro-orm-<name>.repository.ts` beside it and every new
  controller its `dto/` folder; plugin migrations are listed in `INV/database/migrations/index.ts` or the warehouse
  plugin's `WH/database/migrations/index.ts`; Angular components sit in `components/<name>/<name>.component.ts` with
  their `*.component.spec.ts`.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts `packages/contracts/src/lib/stock-document.model.ts`, `stock-projection.model.ts`,
  `stock-reorder.model.ts`, `stock-scan.model.ts`, `warehouse-task.model.ts`, `offline-sync.model.ts`; optional tree,
  purpose and owner fields on `IWarehouse` (`packages/contracts/src/lib/product.model.ts`); exports in
  `packages/contracts/src/index.ts`. Test: contracts build and the type-only spec
  `packages/contracts/src/lib/stock-document.model.spec.ts`.
- [ ] **T2**. Feature wiring: `FeatureFlagGuard` + `@FeatureFlag(FEATURE_INVENTORY)` on every controller under
  `packages/plugins/inventory/src/lib/**/**.controller.ts` and resolvers; menu entries read the code; data step
  `EnableInventoryForActiveTenants` switching the code on for tenants holding inventory rows. Files: the controllers
  under `INV/` (`stock-level/stock-level.controller.ts`, `stock-movement/stock-movement.controller.ts`,
  `stock-adjustment/stock-adjustment.controller.ts`, `stock-alert/stock-alert.controller.ts`,
  `stock-count/stock-count.controller.ts`, `stock-count-line/stock-count-line.controller.ts`,
  `stock-reservation/stock-reservation.controller.ts`, `stock-transfer/stock-transfer.controller.ts`,
  `stock-transfer-line/stock-transfer-line.controller.ts`, `channel-warehouse/channel-warehouse.controller.ts`), the
  resolvers under `INV/graphql/`, `INV/inventory.features.ts`,
  `INV/database/migrations/1791000085100-EnableInventoryForActiveTenants.ts`. Test: `INV/inventory-feature-gate.spec.ts`
  (guard metadata on every controller and resolver; code off answers 404; a tenant with inventory rows keeps access).
- [ ] **T3**. Core migration `packages/core/src/lib/database/migrations/1791000085900-AddStockLocationTree.ts` + entity columns in `packages/core/src/lib/warehouse/warehouse.entity.ts`
  (`parentId`, `isGroup`, `path`, `isNonSellable`, `nonSellablePurpose`, `inTransitWarehouseId`, `expectedTransitDays`,
  `ownerContactId`, `ownerVendorId`), `WarehouseType.TRANSIT`. Test:
  `packages/core/src/lib/database/stock-location-tree-migration.spec.ts` on SQLite; `CW/warehouse.resolver.spec.ts`
  (entity metadata for both ORMs; one owner column at most). Migration timestamps: `1791000085100` to `1791000085199` (`packages/plugins/inventory`); `1791000085200` to `1791000085299` (`packages/plugins/warehouse`); `1791000085900` to `1791000085999` (`packages/core`).
- [ ] **T4** (parallel). Core migration `packages/core/src/lib/database/migrations/1791000085910-AddStockLevelProjection.ts`
  (`inTransitQuantity`, `requestedQuantity`, `plannedQuantity` on `CW/warehouse-product-variant.entity.ts`;
  `incomingQuantity` keeps its documented meaning). Test: `packages/core/src/lib/database/stock-level-projection-migration.spec.ts`
  on SQLite.
- [ ] **T5**. Inventory migration `INV/database/migrations/1791000085110-AddStockDocumentTables.ts` and entities
  `INV/stock-document/stock-document-type.entity.ts`, `INV/stock-document/stock-movement-document.entity.ts`,
  `INV/stock-document/stock-movement-document-line.entity.ts` (`dimensionSetId`),
  `INV/stock-document/stock-document-additional-cost.entity.ts`, `INV/stock-document/stock-issue-reason.entity.ts` with
  MikroORM repositories; `INV/database/migrations/1791000085120-AddStockMovementReferenceLine.ts` and
  `INV/stock-movement/stock-movement.entity.ts` (`referenceLineId`). Test: `INV/database/stock-document-migrations.spec.ts`
  (SQLite); `INV/stock-document/stock-document.repository.spec.ts`.
- [ ] **T6** (parallel). Inventory migrations `AddStockReorderTables` (reorder rule without a stored level for
  stock-holding locations, proposal with run key, internal price policy) and `ExtendStockReservationTransferAndAlert`
  (`stock_alert.threshold` nullable). Files: `INV/database/migrations/1791000085130-AddStockReorderTables.ts`,
  `INV/database/migrations/1791000085140-ExtendStockReservationTransferAndAlert.ts`,
  `INV/stock-reorder/stock-reorder-rule.entity.ts`, `INV/stock-reorder/stock-reorder-proposal.entity.ts`,
  `INV/inter-organization/internal-price-policy.entity.ts`, `INV/stock-reservation/stock-reservation.entity.ts`,
  `INV/stock-transfer/stock-transfer.entity.ts`, `INV/stock-transfer-line/stock-transfer-line.entity.ts`,
  `INV/stock-alert/stock-alert.entity.ts`. Test: `INV/database/stock-reorder-migrations.spec.ts` (SQLite; existing alerts
  keep their threshold).
- [ ] **T7** (parallel). Warehouse migrations `AddPutawayTaskAndSlottingTables` (putaway rule, task, slotting) and
  `ExtendPickListAndBinForWork`; entities under `packages/plugins/warehouse/src/lib/{putaway-rule,warehouse-task,slotting}/`.
  Files: `WH/database/migrations/1791000085200-AddPutawayTaskAndSlottingTables.ts`,
  `WH/database/migrations/1791000085210-ExtendPickListAndBinForWork.ts`, `WH/database/migrations/index.ts`,
  `WH/putaway-rule/putaway-rule.entity.ts`, `WH/warehouse-task/warehouse-task.entity.ts`,
  `WH/slotting/slotting-proposal.entity.ts`, `WH/slotting/slotting-proposal-line.entity.ts`,
  `WH/pick-list/pick-list.entity.ts`, `WH/pick-list-line/pick-list-line.entity.ts`, `WH/warehouse-bin/warehouse-bin.entity.ts`.
  Test: `WH/database/putaway-task-migrations.spec.ts` (SQLite).
- [ ] **T8**. Permissions as contributions with `defaultFor` in `inventory.permissions.ts` and
  `warehouse.permissions.ts` (no seed migration; existing tenants through the permission reload); settings keys in
  `inventory.settings.ts` and `warehouse.settings.ts`. Files: `INV/inventory.permissions.ts`, `WH/warehouse.permissions.ts`,
  `INV/inventory.settings.ts`, `WH/warehouse.settings.ts`. Test: `INV/inventory.permissions.spec.ts` and
  `WH/warehouse.permissions.spec.ts` (default roles; existing keys keep their meaning).
- [ ] **T59**. Core offline-sync module `packages/core/src/lib/offline-sync/`, entities and migration: the
  `offline_operation` log and `offline_exception` queue with their repositories, the core migration
  `AddOfflineSyncTables` and the kind registry (`OFFLINE_OPERATION_KINDS` contributions), on the contract of T1; no
  dependency on this plugin or its flag. Files: `packages/core/src/lib/database/migrations/1791000085920-AddOfflineSyncTables.ts`,
  `packages/core/src/lib/offline-sync/offline-operation.entity.ts`, `packages/core/src/lib/offline-sync/offline-exception.entity.ts`,
  `packages/core/src/lib/offline-sync/offline-operation-kinds.registry.ts`, `packages/core/src/lib/offline-sync/offline-sync.module.ts`.
  Test: `packages/core/src/lib/offline-sync/offline-sync.migration.spec.ts` (SQLite: tables and the unique client
  operation id; up twice is a no-op).
- [ ] **T61**. Core offline-sync service and routes: `OfflineSyncService` applying each operation of a batch in sequence
  through `IdempotencyService.claim`, per-operation results, exceptions instead of loss, `/offline-sync/batches` and
  `/offline-sync/exceptions`, over the tables and kind registry of T59; no dependency on this plugin or its flag.
  Files: `packages/core/src/lib/offline-sync/offline-sync.service.ts`, `packages/core/src/lib/offline-sync/offline-sync.controller.ts`,
  `packages/core/src/lib/offline-sync/offline-sync.module.ts`. Test:
  `packages/core/src/lib/offline-sync/offline-sync.service.sqlite.spec.ts` (replayed batch, conflicting operation kept
  as an exception, per-kind permission refusal) with a fake kind.

## Phase 2 — Services, endpoints, events

- [ ] **T9**. Ports in `packages/plugins/inventory/src/lib/inventory.ports.ts`: `STOCK_MOVEMENT_HOOKS` (before/after
  hooks inside `applyMovement`), `STOCK_NEGATIVE_POLICY` (consulted only when bound),
  `STOCK_PERIOD_GUARD`, `STOCK_VALUE_PREVIEW`, `STOCK_LOT_PICKER`, `STOCK_LOT_SCAN_RESOLVER`,
  `STOCK_PURPOSE_REGISTRY`, `STOCK_REQUISITION_WRITER`, `STOCK_DIMENSION_SETS`, `STOCK_DEMAND_FORECAST`,
  `STOCK_REPLENISHMENT_PRECEDENCE`; `applyMovement` calls the hooks and stores `referenceLineId`. Files:
  `INV/inventory.ports.ts`, `INV/stock-level/stock-level.service.ts`. Test: `INV/stock-level/stock-level.service.spec.ts`
  (a refusing hook rolls back; unbound ports = today's behaviour).
- [ ] **T10**. `STOCK_QUANTITY_WRITER` port in `packages/core/src/lib/warehouse/`, used by
  `WarehouseProductService.updateWarehouseProductVariantQuantity` and `updateWarehouseProductQuantity` when the port is
  bound and `FEATURE_WAREHOUSE` is on; inventory binds it to a "set" adjustment with opening-balance adoption (levels
  without movements, variant quantities without levels); consumer `subscriber:variant-quantity` writes
  `product_variant.quantity` from the level rows; binding in `apps/api/src/plugin-composition.ts`. Files:
  `CW/stock-quantity-writer.port.ts`, `CW/warehouse-product-service.ts`, `INV/stock-adjustment/stock-quantity-writer.adapter.ts`,
  `INV/stock-adjustment/opening-balance-adoption.ts`, `INV/events/variant-quantity.consumer.ts`,
  `apps/api/src/plugin-composition.ts`. Test: `CW/warehouse-product-service.spec.ts` (off = unchanged);
  `INV/stock-adjustment/stock-quantity-writer.adapter.sqlite.spec.ts` (route writes one "set" adjustment; adoption once);
  `INV/events/variant-quantity.consumer.spec.ts` (recomputed, duplicate delivery harmless).
- [ ] **T11**. Stock location service `stock-location/stock-location.service.ts`: tree, group rules, deactivate and
  delete guards while `stock.protectLocationsInUse` is on (a confirmation naming what is affected otherwise), kind,
  purpose, owner and in-transit checks, path rewrite on re-parent, `FEATURE_MULTI_WAREHOUSE` gate
  for the tree and in-transit locations; channel, merchant, pickup and fulfilment refusals for group, in-transit,
  non-sellable and owned locations; controller `/stock-locations`. Files: `INV/stock-location/stock-location.service.ts`,
  `INV/stock-location/stock-location.controller.ts`, `INV/stock-location/location-path.ts`. Test:
  `INV/stock-location/stock-location.service.spec.ts` (FR-1 to FR-6); `INV/stock-location/stock-location.sqlite.spec.ts`
  (roll-ups).
- [ ] **T12**. Purpose registry and document types: `stock-document/stock-purpose.registry.ts`,
  `stock-document-type.service.ts`, controllers. Files: `INV/stock-document/stock-purpose.registry.ts`,
  `INV/stock-document/stock-document-type.service.ts`, `INV/stock-document/stock-document-type.controller.ts`,
  `INV/stock-document/stock-movement-purpose.controller.ts`. Test: `INV/stock-document/stock-purpose.registry.spec.ts`
  (contributed purposes); `INV/stock-document/stock-document-type.service.spec.ts` (type-in-use refusal).
- [ ] **T13**. `StockDocumentService` draft CRUD, unit conversion through `/units/convert`, allow-list check, numbering
  and lifecycle through the business document engine. Files: `INV/stock-document/stock-document.service.ts`,
  `INV/stock-document/stock-document.controller.ts`. Test: `INV/stock-document/stock-document.service.spec.ts` (FR-13,
  FR-14, FR-17, FR-8).
- [ ] **T14**. Confirm and cancel: all lines in one transaction through `applyMovement`, lines sorted by level, per-line
  errors, reversing cancellation with the later-negative check, backdating rules. Files:
  `INV/stock-document/stock-document-confirm.service.ts`, `INV/stock-document/stock-document.controller.ts`. Test:
  `INV/stock-document/stock-document-confirm.sqlite.spec.ts` (all-or-nothing, reversal, backdate refused in a frozen
  period through the hook).
- [ ] **T15**. Preview: dry run of the movements plus hook previews (values through `STOCK_VALUE_PREVIEW`); nothing
  written. Files: `INV/stock-document/stock-document-preview.service.ts`. Test:
  `INV/stock-document/stock-document-preview.service.spec.ts` (no rows written; incoming and outgoing totals and values).
- [ ] **T16**. Purposes receipt, issue (reasons seeded from the outgoing `StockReasonCode` values; issues consume,
  adjustments correct), repack, conversion, return (stock documents only; sales returns stay with the returns
  plugin); additional cost lines (with the producer's `costKind` and `dimensionSetId`) spread by the shared `allocateCharges` in `stock-document/cost-allocation.ts`;
  opening flag. Files: `INV/stock-document/purposes/receipt.purpose.ts`, `INV/stock-document/purposes/issue.purpose.ts`,
  `INV/stock-document/purposes/repack.purpose.ts`, `INV/stock-document/purposes/conversion.purpose.ts`,
  `INV/stock-document/purposes/return.purpose.ts`, `INV/stock-document/cost-allocation.ts`,
  `INV/stock-document/stock-issue-reason.service.ts`, `INV/stock-document/stock-issue-reason.controller.ts`. Test: one
  `INV/stock-document/purposes/<purpose>.purpose.spec.ts` per purpose (FR-19, FR-22 to FR-27);
  `INV/stock-document/cost-allocation.spec.ts` (per basis with remainder).
- [ ] **T17**. Create from source documents (`from-source`) with line links and roll-back of moved quantities; purchase
  orders refused (received through goods receipts). Files: `INV/stock-document/stock-document-from-source.service.ts`,
  `INV/stock-document/stock-document.controller.ts`. Test: `INV/stock-document/stock-document-from-source.service.spec.ts`
  (a requisition and a goods receipt return; a closed subcontract order refused).
- [ ] **T18**. Inspection gate hook for quality management and the rejected-quantity route. Files:
  `INV/stock-document/inspection-gate.hook.ts`. Test: `INV/stock-document/inspection-gate.hook.spec.ts` (stub inspection
  port; rejected quantity to a non-sellable location in the same confirmation).
- [ ] **T19**. Transfers: `isTwoStep`, in-transit routing, bins on lines, over-receipt and item checks, fulfilment of
  requisitions and pick lists in `stock-transfer.service.ts`; incoming and in-transit figures of the destination.
  Files: `INV/stock-transfer/stock-transfer.service.ts`, `INV/stock-transfer/stock-transfer.controller.ts`,
  `INV/stock-transfer-line/stock-transfer-line.service.ts`. Test: `INV/stock-transfer/stock-transfer.sqlite.spec.ts`
  (one-step and two-step with damage).
- [ ] **T20**. Reservations depth in `stock-reservation.service.ts`: new demand kinds, consumed and released parts,
  by lot or serial, partial rule, whole-unit rounding, hand-over, automatic triggers. Files:
  `INV/stock-reservation/stock-reservation.service.ts`, `INV/stock-reservation/stock-reservation.controller.ts`,
  `INV/stock-reservation/reservation-triggers.consumer.ts`. Test: `INV/stock-reservation/stock-reservation.service.spec.ts`
  (FR-44 to FR-51); `INV/stock-reservation/stock-reservation.oversell.sqlite.spec.ts`.
- [ ] **T21**. Projection: consumer `subscriber:stock-projection` for procurement, production and planning events,
  delta updates of incoming, in transit, requested and planned, reserved by kind, recalculation in `reconcile`;
  `/stock-levels/projection` and `/availability`; the enable-time operation `stock-projection.initialize` of plan §8
  (figures from the open source documents and delivery records for the events in its snapshot, in one transaction).
  Files: `INV/stock-projection/stock-projection-initialize.operation.ts`, `INV/stock-projection/stock-projection.consumer.ts`,
  `INV/stock-projection/stock-projection.service.ts`, `INV/stock-level/stock-level.controller.ts`,
  `INV/stock-level/stock-level.service.ts` (`reconcile`). Test: `INV/stock-projection/stock-projection.consumer.spec.ts`
  (duplicate delivery applies once; group roll-up); `INV/stock-level/stock-level.service.spec.ts` (reconcile before and
  after); `INV/stock-projection/stock-projection-initialize.operation.spec.ts` (a purchase order approved before
  `FEATURE_WAREHOUSE` is switched on shows as incoming right after the operation, its approval event delivered later
  adds nothing, a purchase order approved during the operation is counted once, and reorder raises no duplicate
  requisition).
- [ ] **T22**. Reorder: rules CRUD reading and writing `restockThreshold` (variant level row, or `warehouse_product`
  for item rules; `groupReorderLevel` for groups), leaving the thresholds of `stock_alert` rows as they are; run
  service (scheduled pass in `job_execution`, on-demand run as a core operation `STOCK_REORDER_RUN`), items reported
  planned by `STOCK_REPLENISHMENT_PRECEDENCE` skipped, proposal rounding to the preferred `vendor_product_term`
  pack size and minimum quantity, requisitions through `STOCK_REQUISITION_WRITER`, skip rules, notices; scheduler and
  worker in `inventory-maintenance.module.ts`, in-process fallback. Files: `INV/stock-reorder/stock-reorder-rule.service.ts`,
  `INV/stock-reorder/stock-reorder-rule.controller.ts`, `INV/stock-reorder/stock-reorder-run.service.ts`,
  `INV/stock-reorder/stock-reorder.controller.ts`, `INV/stock-reorder/stock-reorder.scheduler.ts`,
  `INV/stock-reorder/stock-reorder.worker.ts`, `INV/inventory-maintenance.module.ts`. Test:
  `INV/stock-reorder/stock-reorder-run.service.spec.ts` (FR-52 to FR-54; planned items skipped);
  `INV/stock-reorder/stock-reorder.worker.spec.ts` (job idempotency).
- [ ] **T23** (parallel). Low-stock schedule: `stock-alert-scan.scheduler.ts` + worker calling
  `StockAlertService.evaluate()`, which reads the level's `restockThreshold` when the alert stores none; notices through
  the inbox writer and email. Files: `INV/stock-alert/stock-alert-scan.scheduler.ts`, `INV/stock-alert/stock-alert-scan.worker.ts`,
  `INV/stock-alert/stock-alert.service.ts`. Test: `INV/stock-alert/stock-alert-scan.worker.spec.ts` (schedule;
  cool-down; one threshold read from the level when the alert stores none).
- [ ] **T24**. Putaway: rules CRUD (capacity within the bin's declared capacity), item rules feeding
  `WarehouseZoneService.findPutAwayPath`, planner (priority split, bundle split hook) and overfill guard on confirm
  through `WarehouseBinService.checkCapacity`, capacity view `GET /warehouse-bins/capacity` from `checkCapacity`, derived
  contents and `capacityWarnings`. Files: `WH/putaway-rule/putaway-rule.service.ts`, `WH/putaway-rule/putaway-rule.controller.ts`,
  `WH/putaway-rule/putaway-planner.ts`, `WH/warehouse-zone/warehouse-zone.service.ts`,
  `WH/warehouse-bin/warehouse-bin.controller.ts` (`capacity`). Test: `WH/putaway-rule/putaway-planner.spec.ts` (FR-57 to
  FR-60).
- [ ] **T25**. Pick lists for transfers and production; free-stock rules, manual pick and over-pick allowance, kit
  expansion, roll-back to orders, re-pick refusal, binless locations; a delivery created from several pick lists of one
  customer and order. Files: `WH/pick-list/pick-list.service.ts`, `WH/pick-list/pick-list.controller.ts` (`from-source`),
  `WH/pick-list/free-stock.rules.ts`. Test: `WH/pick-list/pick-list.service.spec.ts` additions.
- [ ] **T26**. Scan resolver `stock-scan/stock-scan.service.ts`: precedence, unit-bound barcodes, vendor and customer
  codes, composite application-identifier parsing, lot and serial through a port. Files:
  `INV/stock-scan/stock-scan.service.ts`, `INV/stock-scan/stock-scan.controller.ts`, `INV/stock-scan/application-identifier.parser.ts`.
  Test: `INV/stock-scan/application-identifier.parser.spec.ts` (fixtures); `INV/stock-scan/stock-scan.service.spec.ts` (precedence;
  ambiguous code asks to choose).
- [ ] **T27**. Inter-organization flows: counterpart creation on confirm through procurement and sales ports, internal
  receipt cap, price policy. Files: `INV/inter-organization/inter-organization-flow.service.ts`,
  `INV/inter-organization/inter-organization-flow.controller.ts`, `INV/inter-organization/internal-price-policy.service.ts`.
  Test: `INV/inter-organization/inter-organization-flow.sqlite.spec.ts` (two organizations).
- [ ] **T28**. Stock settings service and `/stock-settings` with effective value and source; dispatch notice defaults.
  Files: `INV/stock-settings/stock-settings.service.ts`, `INV/stock-settings/stock-settings.controller.ts`. Test:
  `INV/stock-settings/stock-settings.service.spec.ts` (organization over default, with the source).
- [ ] **T29**. Events: outbox events of plan §5, bridge of the CQRS level events (coalesced), transfer overdue job.
  Files: `INV/events/inventory-streamed-events.ts`, `INV/events/level-events.bridge.ts`,
  `INV/stock-transfer/stock-transfer-overdue.scheduler.ts`. Test: `INV/events/inventory-streamed-events.spec.ts` (per
  emitter); `INV/stock-transfer/stock-transfer-overdue.scheduler.spec.ts` (overdue raised once).
- [ ] **T30**. Report definitions FR-76 to FR-83 registered with the report builder, group roll-ups and drill-down
  links. Files: `INV/reports/stock-report.definitions.ts`. Test: `INV/reports/stock-report.definitions.sqlite.spec.ts`
  (one dataset per report; group roll-up).
- [ ] **T31**. Print templates for movement document, transfer note, pick list, putaway list and bin label, registered
  through `registerPrintTemplates` (`print-and-pdf-designer` T36). Files: `INV/print/stock-document.template.ts`,
  `INV/print/transfer-note.template.ts`, `WH/print/pick-list.template.ts`, `WH/print/putaway-list.template.ts`,
  `WH/print/bin-label.template.ts`. Test: `INV/print/stock-print-templates.spec.ts` and
  `WH/print/warehouse-print-templates.spec.ts` (render per template).
- [ ] **T53**. Item-level reorder rules: `itemId` on `stock_reorder_rule` (exactly one of item or variant), level from
  `warehouse_product.restockThreshold`, rules CRUD validation, run service expanding an item rule to each variant
  without its own rule for that location. Files: `INV/stock-reorder/stock-reorder-rule.service.ts`,
  `INV/stock-reorder/stock-reorder-run.service.ts`. Test: `INV/stock-reorder/stock-reorder-run.service.spec.ts` (FR-103:
  one variant has its own rule and two inherit the item's).
- [ ] **T54**. Sellable stock only: `StockAvailabilityService` (cart availability), `StockReservationService.assertAvailable`
  and `ChannelWarehouseService` skip or refuse group, `TRANSIT`, non-sellable, customer-owned, supplier-held and
  inactive locations (reservations of a customer's own inward subcontract or work order on its location excepted, plan §2
  Availability); new quarantine and damage zones only in non-sellable locations while
  `warehouse.quarantineZonesNonSellable` is on, with the one-action move of existing ones under a non-sellable child
  offered (never forced). Files: `INV/stock-availability/stock-availability.service.ts`,
  `INV/stock-reservation/stock-reservation.service.ts`, `INV/channel-warehouse/channel-warehouse.service.ts`,
  `WH/warehouse-zone/warehouse-zone.service.ts`, `WH/warehouse-zone/zone-move.service.ts`. Test:
  `INV/stock-availability/stock-availability.service.spec.ts` (per location kind);
  `INV/stock-reservation/stock-reservation.service.spec.ts` (refusal; a `SUBCONTRACT_ORDER` reservation of an inward
  order on its customer's location is accepted, a sales reservation there and one by another customer's order are
  refused, the same reservation on that customer's inactive or non-sellable location is refused, and cart
  availability still skips that location); `INV/channel-warehouse/channel-warehouse.service.spec.ts`
  (mapping refusal); `WH/warehouse-zone/zone-move.sqlite.spec.ts` (move; with the setting off a quarantine zone is
  created in a sellable location as today).
- [ ] **T55**. Level events from every stock write (FR-104): one `StockLevelWriter` in the inventory plugin through
  which movements, adjustments, counts, reservations, transfers, recalculation, the variant quantity bridge and imports
  change level rows, raising `InventoryLevelChangedEvent`, `InventoryLevelLowEvent` and `InventoryLevelOutOfStockEvent`
  after commit. Files: `INV/stock-level/stock-level-writer.ts`, `INV/stock-level/stock-level.service.ts`,
  `INV/stock-adjustment/stock-adjustment.service.ts`, `INV/stock-count/stock-count.service.ts`,
  `INV/stock-reservation/stock-reservation.service.ts`, `INV/stock-transfer/stock-transfer.service.ts`,
  `INV/events/inventory-level-changed.event.ts`. Test: `INV/stock-level/stock-level-writer.spec.ts` (one case per write
  path asserting the events, none on a rolled-back write; the commerce connector and register consumers receive them
  without polling).
- [ ] **T56**. Settings `stock.protectLocationsInUse`, `warehouse.quarantineZonesNonSellable` (default off),
  `stock.routeQuantityEdits`, `stock.lowStockNotices`, and the data step `EnableWarehouseSettingsAsToday` storing the
  last two as off for organizations of tenants that had `FEATURE_WAREHOUSE` on before the release (spec FR-105); the
  quantity writer, low-stock scan, projection and variant-quantity consumers read them. Files: `INV/inventory.settings.ts`,
  `WH/warehouse.settings.ts`, `WH/database/migrations/1791000085220-EnableWarehouseSettingsAsToday.ts`. Test:
  `WH/database/warehouse-settings-as-today.spec.ts`: a tenant with the flag on
  before the release keeps today's quantity edits, zones and silent alerts; a low-stock rule keeps its threshold after
  a reorder rule is saved.
- [ ] **T57**. Location tags as targets (spec FR-7): the tags already kept on stock locations accepted as a location
  filter by stock report datasets, putaway rules, reorder rules and transfer proposals, in
  `packages/plugins/inventory/src/lib/stock-location/` and `packages/plugins/warehouse/src/lib/`. Files:
  `INV/stock-location/location-tag.filter.ts`, `INV/reports/stock-report.definitions.ts`,
  `INV/stock-reorder/stock-reorder-run.service.ts`, `WH/putaway-rule/putaway-planner.ts`. Test:
  `INV/stock-location/location-tag.filter.spec.ts`: a putaway rule, a reorder rule and a stock report filtered by one
  tag act only on the locations carrying it.
- [ ] **T60**. Line roles of production purposes and disassembly: input, output and secondary output lines
  (co-product, by-product, scrap) with their cost basis, process loss as quantity or percent, movement to and from work
  in progress for purposes contributed through `STOCK_PURPOSE_REGISTRY`; a disassembly names the output it reverses,
  stays within that output minus earlier disassemblies and returns components with the source's lots and serial units
  where known. Files: `INV/stock-document/purposes/production-lines.ts`, `INV/stock-document/purposes/disassembly.purpose.ts`.
  Test: `INV/stock-document/purposes/production-lines.spec.ts` (a contributed purpose with a by-product and a 2 % loss);
  `INV/stock-document/purposes/disassembly.purpose.spec.ts` (over-disassembly refused; lots returned).

## Phase 3 — UI surfaces

- [ ] **T32**. `packages/plugins/inventory-ui` scaffold (plugin registration, availability service hiding on 404,
  menu, i18n keys in every locale). Files: `packages/plugins/inventory-ui/` (`package.json`, `project.json`,
  `jest.config.ts`), `IU/inventory-ui.plugin.ts`, `IU/inventory-ui.routes.ts`, `IU/services/inventory-availability.service.ts`,
  `apps/gauzy/src/plugin-ui.config.ts`, `packages/ui-core/i18n/assets/i18n/*.json` (`INVENTORY.*`). Test:
  `IU/inventory-ui.plugin.spec.ts` (menu hidden on 404 or with the feature off).
- [ ] **T33**. Pages stock levels (projection grid), movements, transfers, adjustments, reservations, alerts. Files:
  `IU/components/stock-levels/`, `IU/components/stock-movements/`, `IU/components/stock-transfers/`,
  `IU/components/stock-adjustments/`, `IU/components/stock-reservations/`, `IU/components/stock-alerts/`. Test: their
  component specs (rendering; group rows show the sum of their descendants).
- [ ] **T34**. Document list and editor with scan field, preview panel, per-line errors, confirm and cancel. Files:
  `IU/components/stock-documents/`, `IU/components/stock-document-editor/`, `IU/components/stock-document-preview/`,
  `IU/components/scan-field/`. Test: the editor and preview component specs (incoming, outgoing and value totals; a scan
  increments a line).
- [ ] **T35** (parallel). Location tree on the existing Warehouses page
  (`apps/gauzy/src/app/pages/inventory/components/manage-warehouses/`: tree table with roll-ups, form fields parent,
  group, kind, purpose, in-transit default, owner, list of quarantine zones to move), reorder pages (rules, runs,
  proposals), settings page, reports entry. Files: `PG/manage-warehouses/warehouses-table/warehouses-table.component.ts`,
  `PG/manage-warehouses/warehouse-form/warehouse-form.component.ts`, `IU/components/stock-reorder/`,
  `IU/components/stock-settings/`, `IU/components/stock-reports/`. Test:
  `PG/manage-warehouses/warehouses-table/warehouses-table.component.spec.ts` (tree with roll-ups) and the component
  specs of the new pages.
- [ ] **T36**. `packages/plugins/warehouse-ui`: zones and bins tree, range creation, block, bin labels, putaway rules,
  capacity, waves, pick lists. Files: `packages/plugins/warehouse-ui/` (`package.json`, `project.json`), `WU/warehouse-ui.plugin.ts`,
  `WU/warehouse-ui.routes.ts`, `WU/components/zones-bins-tree/`, `WU/components/putaway-rules/`, `WU/components/bin-capacity/`,
  `WU/components/pick-waves/`, `WU/components/pick-lists/`. Test: their component specs (rendering).
- [ ] **T37**. Old Inventory screen hint ("recorded as an adjustment") in
  `apps/gauzy/src/app/pages/inventory/components/` and on the variant form's quantity, which stays editable and writes
  through `STOCK_QUANTITY_WRITER` (`edit-inventory-item-variant/variant-form.component.ts`) when the flag is on. Files:
  `PG/manage-warehouses/manage-quantity/manage-quantity.component.ts`, `PG/edit-inventory-item-variant/variant-form.component.ts`.
  Test: `PG/edit-inventory-item-variant/variant-form.component.spec.ts` (hint on and off; an edit writes one "set"
  adjustment).
- [ ] **T38** (parallel). Offline-kind registration documented for the shop floor, quality and lot capture modules
  (kinds, permissions, exception choices) in `packages/core/src/lib/offline-sync/README.md` (the module of T59 and T61; the
  floor-app module registration is documented with the app in T44). Test: docs build.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T39**. MCP tools `packages/mcp-server/src/lib/tools/stock.ts` (reads, drafts, preview and confirm with
  `preview`), registered in `register-all-tools.ts`; tree, kind, purpose and owner fields on the existing
  `warehouses.ts` tools. Files: `packages/mcp-server/src/lib/tools/stock.ts`,
  `packages/mcp-server/src/lib/tools/warehouses.ts`, `packages/mcp-server/src/lib/tools/register-all-tools.ts`. Test:
  `packages/mcp-server/src/lib/tools/stock.spec.ts` (mocked API; preview writes nothing);
  `packages/mcp-server/src/lib/tools/input-schema-json.spec.ts`.
- [ ] **T40**. OpenAPI document regenerated; SDK regeneration noted for release. Files: `packages/core/src/lib/bootstrap/swagger.ts`. Test: OpenAPI diff is additive.
- [ ] **T41**. User docs (stock locations, documents, transfers, reorder, putaway, picking) and the specs index row;
  spec status `Implemented` for phases 1–2. Files: docs site `website/docs/inventory/`,
  `docs/specs/features/warehouse-and-stock-movements/spec.md`, `docs/specs/README.md`. Test: docs build.

## Phase 5 — Advanced capabilities

- [ ] **T42**. Warehouse tasks: creation from receipts, putaway plans, pick lists, transfers, counts and relocations;
  queue and lease rows over their source (assignee of picks stays `pick_list.assignedToUserId`, status and progress
  read from the source); a core task per warehouse task in the warehouse-work project; claim starts and release stops
  the core timer; `/warehouse-tasks` routes. Files: `WH/warehouse-task/warehouse-task.service.ts`,
  `WH/warehouse-task/warehouse-task.controller.ts`, `WH/warehouse-task/warehouse-task-creation.consumer.ts`,
  `WH/warehouse-maintenance.module.ts` (lease expiry). Test: `WH/warehouse-task/warehouse-task.service.spec.ts` (lease
  refusal, reassignment, no copied progress).
- [ ] **T43**. Warehouse kinds on the core offline-sync module of T59 and T61 (`packages/plugins/warehouse/src/lib/`): receive,
  put away, pick, transfer, count through `POST /stock-counts/:id/count`, relocate; and the offline pack. Files:
  `WH/offline/warehouse-offline-kinds.ts`, `WH/warehouse-task/warehouse-task-offline-pack.service.ts`. Test:
  `WH/offline/warehouse-offline-kinds.sqlite.spec.ts` (replayed batch, conflicting scan, per-kind permission refusal).
- [ ] **T44**. `packages/plugins/floor-ui` Angular floor app at `/pages/floor`: install through the existing
  `apps/gauzy/src/manifest.json` and Angular service worker (data groups in `ngsw-config.prod.json`), IndexedDB queue,
  module registry, camera and wedge scanners, feedback; warehouse modules from `warehouse-ui` for receive, putaway,
  pick, transfer, count, relocate; the README documents how other features register floor-app modules. Files:
  `packages/plugins/floor-ui/` (`package.json`, `project.json`, `README.md`), `FL/floor-ui.plugin.ts`, `FL/floor-ui.routes.ts`,
  `FL/services/offline-queue.service.ts`, `FL/services/scanner.service.ts`, `FL/floor-module.registry.ts`,
  `WU/floor/receive.module.ts`, `WU/floor/putaway.module.ts`, `WU/floor/pick.module.ts`, `WU/floor/transfer.module.ts`,
  `WU/floor/count.module.ts`, `WU/floor/relocate.module.ts`, `apps/gauzy/src/manifest.json`,
  `apps/gauzy/ngsw-config.prod.json`. Test: `FL/services/offline-queue.service.spec.ts` (offline replay); component specs
  (a wrong bin refused with the next bin in walk order).
- [ ] **T45**. Supervisor task board with live progress and exception resolution (`offline_exception` of warehouse
  kinds) in `warehouse-ui`. Files: `WU/components/task-board/`. Test: `WU/components/task-board/task-board.component.spec.ts`
  (rendering with push events; reassignment).
- [ ] **T46**. Live updates: push of level, reservation, document and task changes; order line availability badge
  through the order screens' extension point. Files: `INV/events/inventory-realtime-hints.ts`,
  `IU/components/order-line-availability-badge/`. Test: `INV/events/inventory-realtime-hints.spec.ts` (push within 2 s;
  coalescing).
- [ ] **T47**. Walk order: the existing pick-path sort behind `pick_list_line.position` reads `warehouse_bin.walkSequence`
  first; putaway lines in the same order. Files: `WH/pick-list/pick-list.service.ts`, `WH/putaway-rule/putaway-planner.ts`.
  Test: `WH/pick-list/pick-path-order.spec.ts` (walk sequence first, then zone priority and coordinates).
- [ ] **T48**. Slotting job and proposals, accept into relocation tasks. Files: `WH/slotting/slotting.service.ts`,
  `WH/slotting/slotting.controller.ts`, `WH/slotting/slotting.scheduler.ts`. Test: `WH/slotting/slotting.service.spec.ts`
  (proposal on fixtures; an accepted line becomes a relocation task).
- [ ] **T49**. Forecast-mode reorder levels: suggestion (demand over the supplier lead time from `vendor_product_term`,
  else `organization_vendor.leadTimeDays`, plus safety stock for a service level) from production planning's forecast
  read through `STOCK_DEMAND_FORECAST`; applied as the `restockThreshold`; proposal basis. Files:
  `INV/stock-reorder/forecast-level.service.ts`, `INV/stock-reorder/stock-reorder-run.service.ts`. Test:
  `INV/stock-reorder/forecast-level.service.spec.ts` (known forecast lines; an unbound port leaves fixed levels).
- [ ] **T50**. Labour roll-up from the `time_log` rows of each task's work item at their stored pay rate, nightly
  re-roll, labour report, hand-off of receipt labour to valuation as a landed cost charge. Files:
  `WH/warehouse-task/warehouse-labour.service.ts`, `WH/warehouse-task/warehouse-labour.controller.ts`,
  `WH/warehouse-task/warehouse-labour.scheduler.ts`. Test: `WH/warehouse-task/warehouse-labour.service.spec.ts` (a timer
  per task; no log counted twice).
- [ ] **T51**. Replenishment agent registered with `ai-agents-and-assistants` (tools in `warehouse-work.ts`): group
  proposals, explain, draft requisitions for approval. Files: `packages/mcp-server/src/lib/tools/warehouse-work.ts`,
  `INV/agent/replenishment-agent.definition.ts`. Test: `packages/mcp-server/src/lib/tools/warehouse-work.spec.ts`
  (drafts only, never approved by the agent).
- [ ] **T52**. Automation triggers registered for the events of FR-100. Files: `INV/inventory.automation-triggers.ts`,
  `WH/warehouse.automation-triggers.ts`. Test: `INV/inventory.automation-triggers.spec.ts` (every event of FR-100 in
  the trigger catalogue).
- [ ] **T58**. Provide the ports other features bind to (plan, **Consumer tokens answered**): `MANUFACTURING_STOCK`, `OFFLINE_OPERATION_KINDS`, `PROJECT_STOCK_ISSUES`, `PURCHASING_STOCK_DOCUMENTS`, `PURCHASING_STOCK_FIGURES`, `STOCK_MOVEMENT_WRITER`, `SUBCONTRACTING_STOCK`. Files: `apps/api/src/plugin-composition.ts`. Test:
`INV/inventory-consumer-tokens.contract.spec.ts`, one contract test per token over the shape its consumer plan states; with this feature off each consumer keeps its stated fallback.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1–FR-4 | §3.1 Stock locations | T11 |
| FR-5–FR-6 | §3.1 Stock locations | T11, T54 |
| FR-7 | §3.1 Stock locations | T57 |
| FR-8 | §3.1 Stock locations | T13 |
| FR-9 | §3.2 Balances and projection | T4, T21 |
| FR-10 | §3.2 Balances and projection | T21 |
| FR-11 | §3.2 Balances and projection | T21, T33 |
| FR-12 | §3.2 Balances and projection | T21 |
| FR-13–FR-14 | §3.3 Stock movement documents | T13 |
| FR-15 | §3.3 Stock movement documents | T5, T14, T16 |
| FR-16 | §3.3 Stock movement documents | T14 |
| FR-17 | §3.3 Stock movement documents | T13 |
| FR-18 | §3.3 Stock movement documents | T14 |
| FR-19 | §3.3 Stock movement documents | T16 |
| FR-20 | §3.3 Stock movement documents | T5, T15, T34 |
| FR-21 | §3.3 Stock movement documents | T15 |
| FR-22–FR-27 | §3.3 Stock movement documents | T16 |
| FR-28 | §3.3 Stock movement documents | T18 |
| FR-29 | §3.3 Stock movement documents | T31 |
| FR-30 | §3.4 Purposes and source documents | T12, T16, T17 |
| FR-31 | §3.4 Purposes and source documents | T12 |
| FR-32 | §3.4 Purposes and source documents | T12, T60 |
| FR-33 | §3.4 Purposes and source documents | T60 |
| FR-34 | §3.4 Purposes and source documents | T12, T17 |
| FR-35 | §3.4 Purposes and source documents | T17 |
| FR-36–FR-38 | §3.5 Transfers and in-transit | T19 |
| FR-39 | §3.5 Transfers and in-transit | T29 |
| FR-40 | §3.5 Transfers and in-transit | T19 |
| FR-41–FR-43 | §3.6 Old quantity edits through the ledger | T10, T37 |
| FR-44–FR-51 | §3.7 Reservations | T20 |
| FR-52–FR-54 | §3.8 Reorder and low stock | T22 |
| FR-55 | §3.8 Reorder and low stock | T23 |
| FR-56 | §3.9 Bins, putaway and capacity | T36 |
| FR-57–FR-60 | §3.9 Bins, putaway and capacity | T24 |
| FR-61 | §3.10 Pick lists | T25 |
| FR-62 | §3.10 Pick lists | T25, T54 |
| FR-63 | §3.10 Pick lists | T25 |
| FR-64 | §3.10 Pick lists | T20, T25 |
| FR-65 | §3.10 Pick lists | T25 |
| FR-66 | §3.10 Pick lists | T25 |
| FR-67–FR-69 | §3.11 Barcode scanning | T26 |
| FR-70–FR-72 | §3.12 Inter-organization stock flows | T27 |
| FR-73 | §3.13 Stock policy settings | T8, T28 |
| FR-74–FR-75 | §3.13 Stock policy settings | T28 |
| FR-76–FR-84 | §3.14 Reports | T30 |
| FR-85 | §3.15 Floor app (advanced) | T43, T44, T59, T61 |
| FR-86 | §3.15 Floor app (advanced) | T44, T47 |
| FR-87 | §3.15 Floor app (advanced) | T43, T44, T59, T61 |
| FR-88 | §3.15 Floor app (advanced) | T43, T45, T59, T61 |
| FR-89 | §3.15 Floor app (advanced) | T42, T45 |
| FR-90 | §3.16 Live stock, slotting, forecast, labour and agents (advanced) | T45, T46 |
| FR-91 | §3.16 Live stock, slotting, forecast, labour and agents (advanced) | T46 |
| FR-92 | §3.16 Live stock, slotting, forecast, labour and agents (advanced) | T47 |
| FR-93 | §3.16 Live stock, slotting, forecast, labour and agents (advanced) | T48 |
| FR-94–FR-95 | §3.16 Live stock, slotting, forecast, labour and agents (advanced) | T49 |
| FR-96–FR-97 | §3.16 Live stock, slotting, forecast, labour and agents (advanced) | T50 |
| FR-98 | §3.16 Live stock, slotting, forecast, labour and agents (advanced) | T39, T51 |
| FR-99 | §3.16 Live stock, slotting, forecast, labour and agents (advanced) | T51 |
| FR-100 | §3.16 Live stock, slotting, forecast, labour and agents (advanced) | T52 |
| FR-101 | §3.17 Compatibility | T2 |
| FR-102 | §3.17 Compatibility | T8 |
| FR-103 | §3.8 Reorder and low stock | T53 |
| FR-104 | §3.2 Balances and projection | T55 |
| FR-105 | §3.17 Compatibility | T56 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off; enabling it in dev shows the feature end to end.
- Constitution gates in `spec.md` §9 confirmed.
- With `FEATURE_WAREHOUSE` off, the existing inventory routes and the old Inventory screen behave byte-for-byte as before
  (snapshot e2e).
- `POST /stock-levels/reconcile` reports zero corrections after the full e2e suite (ledger, levels and variant
  quantities agree).
- An offline batch replayed twice produces the same movements once.
- No stock of a group, in-transit, non-sellable, customer-owned or supplier-held location is offered to a cart,
  reservation or sales channel.
