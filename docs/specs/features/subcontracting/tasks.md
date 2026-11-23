# Task Breakdown: Subcontracting

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `subcontracting`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold. A spec file named in a `Test:` clause without a full path sits under the `src/lib/` folder of the package the task changes (beside the file it tests).
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind `FEATURE_SUBCONTRACTING`: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it. Paths are relative to the repository root;
  `sub/` means `packages/plugins/subcontracting/src/lib/`, `sui/` means `packages/plugins/subcontracting-ui/src/lib/`.
- Gate: every route, GraphQL field, menu entry, slot, job, consumer and MCP tool of these tasks is gated by
  `FEATURE_SUBCONTRACTING` (`@FeatureFlag` + `FeatureFlagGuard`).
- Depends on: the purchasing line kinds ([`procurement`](../procurement/tasks.md) T23), the purchasing ports including
  `PurchasingSubcontractFacade` ([`procurement`](../procurement/tasks.md) T14), the goods receipt hook
  `GOODS_RECEIPT_SUBCONTRACT` ([`procurement`](../procurement/tasks.md) T61) and purchase returns
  ([`procurement`](../procurement/tasks.md) T34); location owners `ownerVendorId` / `ownerContactId` (`warehouse-and-stock-movements` T3), the
  purposes registry and stock movement documents (`warehouse-and-stock-movements` T12), reservations
  (`warehouse-and-stock-movements` T20); `allocateCharges` (`stock-ledger-and-valuation` T18). Ports to absent plugins
  stay unbound and their features hidden.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts `packages/contracts/src/lib/subcontracting.model.ts` (enums, service, order, output, material,
  receipt line and the goods receipt's subcontract block, production report, progress report, count decision, material
  position, cost breakdown, port and hook shapes); export from `index.ts`. Files: `packages/contracts/src/lib/subcontracting.model.ts`,
  `packages/contracts/src/index.ts`. Test: `packages/contracts/src/lib/subcontracting.model.spec.ts` contract compile spec.
- [ ] **T2**. Plugin scaffold `packages/plugins/subcontracting` (package, project, tsconfig, jest, eslint, README),
  path mapping, `sub/subcontracting.plugin.ts` with `dependsOn` inventory, warehouse and purchasing. Files:
  `packages/plugins/subcontracting/{package.json,project.json,tsconfig.json,jest.config.ts,eslint.config.cjs,README.md,src/index.ts}`,
  `sub/{subcontracting.plugin.ts,subcontracting.module.ts}`, `tsconfig.json`. Test: `sub/subcontracting.plugin.spec.ts` plugin
  bootstrap spec.
- [ ] **T3**. Feature code `sub/subcontracting.features.ts` (`FEATURE_SUBCONTRACTING`, default off), settings
  `sub/subcontracting.settings.ts` (FR-52, platform settings store), permissions `sub/subcontracting.permissions.ts`
  (7 values, contributions with `defaultFor`). Files: `sub/{subcontracting.features.ts,subcontracting.settings.ts,subcontracting.permissions.ts}`.
  Test: `sub/subcontracting.contributions.spec.ts` contribution specs (feature off by default, settings keys and defaults, permissions).
- [ ] **T4**. Plugin migration set `sub/database/migrations/` on the shared core migration helpers of `procurement` T4 (`@gauzy/core`), no copy in the plugin. Files: `sub/database/migrations/index.ts`, `sub/database/subcontracting-migrations.ts`. Test:
  `sub/database/subcontracting-migrations.spec.ts`, an empty migration run on SQLite. Migration timestamps: `1791000092100` to `1791000092199` (`packages/plugins/subcontracting`).
- [ ] **T5**. Entities `sub/service/` (service), `sub/contractor/` (supplier ↔ employee link) + repositories for both
  ORMs; migration `CreateSubcontractServiceTables`. Files: `sub/service/subcontract-service.entity.ts`,
  `sub/contractor/subcontract-contractor-link.entity.ts`, each with `repository/type-orm-<name>.repository.ts` and
  `repository/mikro-orm-<name>.repository.ts`, `sub/database/migrations/1791000092100-CreateSubcontractServiceTables.ts`.
  Test: `sub/database/create-subcontract-service-tables.migration.spec.ts` (up twice) and `sub/service/subcontract-service.entity.spec.ts` mapping spec.
- [ ] **T6**. Entities `sub/order/` (order, output, material); migration `CreateSubcontractOrderTables`. Files:
  `sub/order/{subcontract-order.entity.ts,subcontract-order-output.entity.ts,subcontract-order-material.entity.ts}` with
  their repositories, `sub/database/migrations/1791000092110-CreateSubcontractOrderTables.ts`. Test:
  `sub/database/create-subcontract-order-tables.migration.spec.ts`.
- [ ] **T7** (parallel). Entities `sub/receipt/` (receipt lines keyed by goods receipt and goods receipt line,
  production report); migration `CreateSubcontractReceiptTables`. Files: `sub/receipt/{subcontract-receipt-line.entity.ts,subcontract-production-report.entity.ts}`
  with their repositories, `sub/database/migrations/1791000092120-CreateSubcontractReceiptTables.ts`. Test:
  `sub/database/create-subcontract-receipt-tables.migration.spec.ts`.
- [ ] **T8** (parallel). Entities `sub/collaboration/` (progress report, count decision keyed by stock count line);
  migration `CreateSubcontractCollaborationTables`. Files: `sub/collaboration/{subcontract-progress-report.entity.ts,subcontract-count-decision.entity.ts}`
  with their repositories, `sub/database/migrations/1791000092130-CreateSubcontractCollaborationTables.ts`. Test:
  `sub/database/create-subcontract-collaboration-tables.migration.spec.ts`.
- [ ] **T9**. Default role grants as `defaultFor` of the permission contributions (no seed migration); registration in
  `apps/api/src/plugins.ts` and its spec. Files: `sub/subcontracting.permissions.ts`, `apps/api/src/plugins.ts`. Test:
  `sub/subcontracting.permissions.spec.ts` contribution spec (grants added for an existing tenant once), plugin
  list spec.
- [ ] **T10**. Ports in `sub/subcontracting.types.ts` and bindings in `apps/api/src/plugin-composition.ts`
  (`SUBCONTRACTING_PURCHASING`, `_SALES`, `_STOCK`, `_VALUATION`, `_BOM`, `_WORK_ORDERS`, `_QUALITY`, `_BILLS`,
  `_PORTAL`, `_DOCUMENTS`); the `GOODS_RECEIPT_SUBCONTRACT` hook bound to this plugin's receipt service; purposes
  registered at bootstrap. Files: `sub/subcontracting.types.ts`, `sub/subcontracting.purposes.ts`,
  `apps/api/src/plugin-composition.ts`. Test: `sub/subcontracting.composition.spec.ts` composition spec with unbound
  ports (outward refused without purchasing, inward without sales, materials entered per order without manufacturing);
  the six purposes registered.

## Phase 2 — Services, endpoints, events

- [ ] **T11**. Service definitions: validation (non-stock service item, bill of materials of the item, one active
  service per finished item and service item), suppliers, preference, price and lead time read from the service item's
  `vendor_product_term` rows, resolution by finished item and supplier (best term priority) or service item;
  controller. Files: `sub/service/{subcontract-service.service.ts,subcontract-service.controller.ts,subcontract-service.resolver-query.ts,dto/}`.
  Test: `sub/service/subcontract-service.service.spec.ts` unit spec; a supplier without a term for the service item is not offered; a stocked service item, a foreign bill of materials and a duplicate active service are refused.
- [ ] **T12**. Party locations reader over core `warehouse` owners (supplier-held `THIRD_PARTY` location with
  `ownerVendorId`, customer-owned location with `ownerContactId`; default = best `warehouse.priority`); no location
  table or route. Files: `sub/locations/party-location.reader.ts`. Test: `sub/locations/party-location.reader.spec.ts`
  unit spec; a location not owned by the order's party is refused; a supplier location is never offered as a reserve location.
- [ ] **T13**. Order service, outward creation from a purchase order (source state, party and organization checks,
  service quantity, unit cost parts with the service cost from the supplier term, materials from the bill of materials
  or by hand, exploded option); basis switch; confirm, close, reopen, cancel. Files:
  `sub/order/{subcontract-order.service.ts,outward-order.factory.ts,subcontract-order-lifecycle.service.ts}`. Test:
  `sub/order/outward-order.factory.spec.ts` and `sub/order/subcontract-order-lifecycle.service.spec.ts` unit specs per
  refusal; unit cost is the sum of its parts; service quantity equals the purchase line quantity.
- [ ] **T14**. Pure helpers `sub/engine/` (required quantities, consumption per basis, progress derivation, secondary
  output valuation); additional costs spread by the inventory plugin's `allocateCharges`. Files:
  `sub/engine/{required-quantities.ts,consumption.ts,progress.ts,secondary-output-valuation.ts,index.ts}`. Test:
  `sub/engine/consumption.spec.ts` and `sub/engine/progress.spec.ts` property specs; the
  receipt shares equal `allocateCharges` for each basis.
- [ ] **T15**. Reservations through `SUBCONTRACTING_STOCK` (reserve, change, release, hand to sends, release on
  completion; the reserved figure read from the line's reservations, no counter). Files: `sub/order/material-reservation.service.ts`.
  Test: `sub/order/material-reservation.service.spec.ts` DB spec on SQLite.
- [ ] **T16**. Material sends and returns as stock movement documents of purposes `SUBCONTRACT_SEND` and
  `SUBCONTRACT_RETURN_IN`; over-send refusal; counters in the same transaction. Files: `sub/order/material-movement.service.ts`.
  Test: `sub/order/material-movement.service.spec.ts` DB spec (quantity still to send, over-send refused, return within
  what is held), idempotency spec.
- [ ] **T17**. Receipt hook `sub/receipt/goods-receipt-subcontract.hook.ts` answering `GOODS_RECEIPT_SUBCONTRACT` in the
  goods receipt transaction: lines checked against the subcontract orders (multi-order receipts of one supplier),
  service quantity per line for the receipt's received-quantity roll-up, consumption at the supplier location with
  tolerance and override, secondary outputs and process loss as one `SUBCONTRACT_RECEIPT` document, additional costs
  through `allocateCharges`, the unit cost handed back for valuation, subcontract receipt lines; preview route. Files:
  `sub/receipt/{goods-receipt-subcontract.hook.ts,subcontract-receipt-preview.service.ts,subcontract-receipt.controller.ts}`. Test:
  `sub/receipt/goods-receipt-subcontract.hook.spec.ts` golden receipt specs (AC-2, AC-3); a finished unit needing two service units at 10 each carries 20 of service cost; `purchase_order_line.receivedQuantity` written once, by the goods receipt; a line with neither accepted nor rejected quantity refused.
- [ ] **T18**. Returns of finished goods as procurement purchase returns (from rejected too): consumer of
  `purchasing.purchase_return.confirmed` updating returned quantities; the hook's `reverse` step reversing consumption,
  secondary outputs and counters inside the receipt reversal's transaction. Files:
  `sub/receipt/{purchase-return.consumer.ts,goods-receipt-subcontract.hook.ts}`. Test:
  `sub/receipt/purchase-return.consumer.spec.ts` unit and DB specs (proportional cost reversal by valuation);
  `sub/receipt/goods-receipt-subcontract.hook.spec.ts`: a reversed receipt and its consumption reversal commit together,
  and a failing consumption reversal leaves the receipt posted.
- [ ] **T19** (parallel). Inspection hold through `SUBCONTRACTING_QUALITY`; landed cost targets on the goods receipt
  lines. Files: `sub/receipt/{inspection-hold.service.ts,landed-cost-targets.ts}`. Test: `sub/receipt/inspection-hold.service.spec.ts` port contract specs.
- [ ] **T20**. Sources: from requisition lines and production plan lines; work order operation proposals and
  completion report-back; write-back of subcontracted quantities. Files:
  `sub/sources/{requisition-source.service.ts,production-plan-source.service.ts,work-order-operation.consumer.ts}`. Test:
  `sub/sources/work-order-operation.consumer.spec.ts` and `sub/sources/requisition-source.service.spec.ts` consumer specs with fixtures.
- [ ] **T21**. Inward orders: creation from sales order lines, customer material receipt at no cost into the
  customer-owned location, reservations handed to work orders, work order creation, production reports, return of
  unused material, delivered and returned quantities from delivery events, secondary output delivery, own-material
  billing quantities. Files: `sub/inward/{inward-order.service.ts,customer-material.service.ts,inward-work-orders.service.ts,production-report.service.ts,inward-fulfilment.consumer.ts}`.
  Test: `sub/inward/inward-order.service.spec.ts` unit specs and the AC-5 DB scenario.
- [ ] **T22**. Domain events of plan §5 through the outbox; consumers `subscriber:subcontracting-sources` and
  `-fulfilment`; automatic order creation on purchase approval (setting). Files:
  `sub/events/{subcontracting.events.ts,subcontracting-sources.consumer.ts,subcontracting-fulfilment.consumer.ts,subcontracting-realtime.publisher.ts,index.ts}`.
  Test: `sub/events/subcontracting-sources.consumer.spec.ts` consumer specs, idempotency; automatic order created once on approval.
- [ ] **T23**. Controllers and DTOs for every route of plan §4 with `@FeatureFlag`, `@Permissions`, Swagger; GraphQL
  reads. Files: `sub/order/{subcontract-order.controller.ts,dto/}`, `sub/inward/inward-order.controller.ts`,
  `sub/settings/subcontracting-settings.controller.ts`, `sub/graphql/{schema-extensions.ts,resolvers/subcontract-order.resolver.ts}`.
  Test: `sub/order/subcontract-order.controller.spec.ts` and one e2e spec per controller (flag off refused, permissions).
- [ ] **T43**. Document registration (FR-2): subcontract order, material send and material return document types with
  the business document engine through `SUBCONTRACTING_DOCUMENTS` (series, lifecycle, links, roll-ups, tolerances;
  fallback core `sequence`). Files: `sub/documents/subcontracting.document-types.ts`. Test:
  `sub/documents/subcontracting.document-types.spec.ts`: number assigned once; lifecycle transitions publish
  `document.subcontract_order.*`; fallback numbering without the engine.

## Phase 3 — UI surfaces

- [ ] **T24**. `packages/plugins/subcontracting-ui` scaffold, menu, routes, i18n keys in every locale. Files:
  `packages/plugins/subcontracting-ui/{package.json,project.json,ng-package.json,src/index.ts}`,
  `sui/{subcontracting-ui.plugin.ts,subcontracting-ui.routes.ts,services/subcontracting-api.service.ts}`,
  `packages/ui-core/i18n/assets/i18n/*.json`. Test: `sui/subcontracting-ui.plugin.spec.ts` rendering
  spec; menu hidden with the feature off.
- [ ] **T25**. Pages: services, outward orders (outputs, materials, where it is, cost), send and return dialogs with lot
  pickers, "Receive" opening the goods receipt form; supplier and customer locations through the Warehouses page.
  Files: `sui/components/{services-page/services-page.component.ts,orders-page/orders-page.component.ts,order-detail/order-detail.component.ts,send-materials-dialog/send-materials-dialog.component.ts,return-materials-dialog/return-materials-dialog.component.ts}`.
  Test: `order-detail.component.spec.ts` and `send-materials-dialog.component.spec.ts` component specs.
- [ ] **T26** (parallel). Pages: inward orders, production reports, returns. Files: `sui/components/{inward-orders-page/inward-orders-page.component.ts,production-report-dialog/production-report-dialog.component.ts,customer-material-return-dialog/customer-material-return-dialog.component.ts}`. Test: `inward-orders-page.component.spec.ts` component specs.
- [ ] **T27** (parallel). Purchase order and goods receipt form slots in `purchasing-ui` (subcontract line kind,
  "Create subcontract order", the receipt's subcontract block with consumption, secondary outputs and preview). Files:
  `sui/slots/{purchase-line-kind.slot.ts,create-subcontract-order.slot.ts,goods-receipt-subcontract-block.component.ts}`. Test:
  `sui/slots/goods-receipt-subcontract-block.component.spec.ts` slot spec (flag off → unchanged forms).
- [ ] **T28**. `packages/plugins/subcontracting-react-ui`: order card, progress form and count answer form as portal
  blocks. Files: `packages/plugins/subcontracting-react-ui/{package.json,project.json,src/index.ts}`,
  `packages/plugins/subcontracting-react-ui/src/lib/components/{subcontract-order-card.tsx,progress-report-form.tsx,count-answer-form.tsx}`.
  Test: `subcontract-order-card.spec.tsx` and `progress-report-form.spec.tsx` rendering specs.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T29**. Print templates: subcontract order with materials, material send document, subcontract receipt. Files: `sub/print/subcontracting.print-templates.ts`. Test:
  `sub/print/subcontracting.print-templates.spec.ts` rendering spec.
- [ ] **T30**. Report definitions of FR-54 and the dashboard of FR-55 with the report builder. Files:
  `sub/reports/{subcontracting.report-definitions.ts,subcontracting.report-datasets.ts,subcontracting.dashboard.ts}`,
  `sui/components/dashboard-page/dashboard-page.component.ts`. Test: `sub/reports/subcontracting.report-datasets.spec.ts` dataset spec per
  report.
- [ ] **T31**. MCP tools `packages/mcp-server/src/lib/tools/subcontracting.ts`, registered in `register-all-tools.ts`.
  Files: `packages/mcp-server/src/lib/tools/subcontracting.ts`, `packages/mcp-server/src/lib/tools/register-all-tools.ts`.
  Test: `packages/mcp-server/src/lib/tools/subcontracting.spec.ts` input-schema spec; preview tools write nothing.
- [ ] **T32** (parallel). OpenAPI regenerated; SDK regeneration noted; import and export templates for services and
  locations. Files: `sub/import/subcontracting.import-profiles.ts`, `packages/core/src/lib/bootstrap/swagger.ts`. Test: OpenAPI diff (additive only); `sub/import/subcontracting.import-profiles.spec.ts`.

## Phase 5 — Advanced capabilities

- [ ] **T33**. Portal subcontracting controller `/portal/subcontracting/*` (orders, material sent, progress reports)
  through `SUBCONTRACTING_PORTAL`; costs omitted. Files: `sub/portal/{portal-subcontracting.controller.ts,portal-subcontracting.service.ts}`,
  `sub/collaboration/progress-report.service.ts`. Test: `sub/portal/portal-subcontracting.controller.spec.ts` cross-party isolation e2e; a progress report updates the board.
- [ ] **T34**. Live board endpoint and page; realtime hints on progress, sends and receipts. Files:
  `sub/board/{subcontracting-board.service.ts,subcontracting-board.controller.ts}`, `sui/components/board-page/board-page.component.ts`.
  Test: `sub/board/subcontracting-board.service.spec.ts` board spec; `sub/events/subcontracting-realtime.publisher.spec.ts` push
  spec.
- [ ] **T35**. Completion prediction (`sub/engine/prediction.ts`: progress, tracked time, past lead times, the supplier
  term's and supplier's `leadTimeDays`) and job `subcontracting.predictions.recompute`; late prediction event to the
  procurement exception queue. Files: `sub/engine/prediction.ts`, `sub/jobs/predictions-recompute.job.ts`. Test:
  `sub/engine/prediction.spec.ts` with a frozen clock; without progress the term lead time decides.
- [ ] **T36**. Holding sweep (age and value per supplier, held-too-long event). Files: `sub/jobs/holding-sweep.job.ts`. Test: `sub/jobs/holding-sweep.job.spec.ts` sweep spec.
- [ ] **T37**. Reconciliations as stock counts: schedule job opening a `stock_count` (mode `SPOT`) of each supplier
  location, portal count form writing through the count route, comparison from the count lines, decisions per line in
  `subcontract_count_decision`, corrections by closing the count, debit note request through `SUBCONTRACTING_BILLS` for
  `CHARGE` lines; allocation of each line's difference to the order material lines of the location in the closing
  consumer (`countAdjustedQuantity`, `unallocatedQuantity`, plan §1 Reconciliation). Files: `sub/collaboration/{subcontract-count.service.ts,subcontract-count.controller.ts,stock-count-closed.consumer.ts}`,
  `sub/jobs/counts-schedule.job.ts`, `sui/components/counts-page/counts-page.component.ts`. Test:
  `sub/collaboration/subcontract-count.service.spec.ts` AC-8 DB scenario; no reconciliation table; the count's variance value is the decision's value;
  a shortage of 5 at a location shared by two orders is taken from the line with the oldest send first, never below
  zero, and an excess with no line holding the item stays unallocated on the decision.
- [ ] **T38**. Contractor links (supplier ↔ employee), order tasks per output or operation, consumer
  `subscriber:subcontracting-time` (hours, labour cost at each log's stored pay rate, progress; logs by task only), bill
  draft proposal from approved time at the service's supplier term price with claimed logs. Files:
  `sub/contractor/{contractor-link.service.ts,contractor-link.controller.ts}`,
  `sub/time/{order-tasks.service.ts,subcontracting-time.consumer.ts,bill-proposal.service.ts}`. Test:
  `sub/time/subcontracting-time.consumer.spec.ts` AC-9 scenario; `sub/time/bill-proposal.service.spec.ts`
  no-double-billing spec.
- [ ] **T39**. Cost explanation and "where is material" services behind the MCP tools; integrity check job comparing
  supplier location balances with the material still held on every order, open or closed. Files: `sub/explain/{cost-explanation.service.ts,material-position.service.ts}`,
  `sub/jobs/integrity-check.job.ts`, `packages/mcp-server/src/lib/tools/subcontracting.ts`. Test:
  `sub/explain/cost-explanation.service.spec.ts` and `sub/jobs/integrity-check.job.spec.ts` unit specs (an order closed with
  material still at the supplier reports no drift; 100 sent and a closed count of 97 reports no drift).
- [ ] **T40**. Worker `SubcontractingSchedulePlugin` in `apps/worker/src/plugins.ts`, in-process fallback timers.
  Files: `sub/schedule/subcontracting-schedule.plugin.ts`, `apps/worker/src/plugins.ts`.
  Test: `sub/schedule/subcontracting-schedule.plugin.spec.ts` worker plugin list spec.
- [ ] **T41**. User docs (docs site) and `docs/specs/README.md` index row; spec status `Implemented`. Files:
  `docs/specs/README.md`, `docs/specs/features/subcontracting/spec.md`. Test: docs build.
- [ ] **T42**. Provide the ports other features bind to (plan, **Consumer tokens answered**): `MANUFACTURING_SUBCONTRACT`, `PURCHASING_SUBCONTRACT`. Files: `apps/api/src/plugin-composition.ts`, `sub/subcontracting.consumer-tokens.ts`. Test: `sub/subcontracting.consumer-tokens.spec.ts`, one contract test per token over the shape its consumer plan states; with this feature off each consumer keeps its stated fallback.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Scope and compatibility | T3, T10, T23 |
| FR-2 | §3.1 Scope and compatibility | T43, T17, T22 |
| FR-3 | §3.1 Scope and compatibility | T10, T16, T17 |
| FR-4 | §3.1 Scope and compatibility | T6, T13 |
| FR-5–FR-7 | §3.2 Subcontract services and locations | T11 |
| FR-8 | §3.2 Subcontract services and locations | T12 |
| FR-9 | §3.3 Outward orders | T13, T22 |
| FR-10–FR-11 | §3.3 Outward orders | T13, T17 |
| FR-12–FR-13 | §3.3 Outward orders | T13 |
| FR-14 | §3.3 Outward orders | T15 |
| FR-15–FR-16 | §3.3 Outward orders | T16 |
| FR-17 | §3.3 Outward orders | T16, T17, T18 |
| FR-18 | §3.3 Outward orders | T14 |
| FR-19 | §3.3 Outward orders | T13 |
| FR-20 | §3.4 Outward receipts and returns | T17, T25, T27 |
| FR-21–FR-23 | §3.4 Outward receipts and returns | T17 |
| FR-24 | §3.4 Outward receipts and returns | T14, T17 |
| FR-25–FR-26 | §3.4 Outward receipts and returns | T17 |
| FR-27 | §3.4 Outward receipts and returns | T19 |
| FR-28 | §3.4 Outward receipts and returns | T18 |
| FR-29 | §3.4 Outward receipts and returns | T19 |
| FR-30–FR-32 | §3.5 Sources of outward work | T20 |
| FR-33–FR-36 | §3.6 Inward orders | T21 |
| FR-37 | §3.6 Inward orders | T21, T26 |
| FR-38–FR-41 | §3.6 Inward orders | T21 |
| FR-42 | §3.6 Inward orders | T21, T26 |
| FR-43 | §3.7 Work in progress and reconciliation (advanced) | T34 |
| FR-44 | §3.7 Work in progress and reconciliation (advanced) | T28, T33 |
| FR-45 | §3.7 Work in progress and reconciliation (advanced) | T35 |
| FR-46 | §3.7 Work in progress and reconciliation (advanced) | T36 |
| FR-47–FR-48 | §3.7 Work in progress and reconciliation (advanced) | T37 |
| FR-49 | §3.8 Contractors and tracked time (advanced) | T5, T38 |
| FR-50–FR-51 | §3.8 Contractors and tracked time (advanced) | T38 |
| FR-52 | §3.9 Settings, reports and agents | T3, T23 |
| FR-53 | §3.9 Settings, reports and agents | T29 |
| FR-54–FR-55 | §3.9 Settings, reports and agents | T30 |
| FR-56 | §3.9 Settings, reports and agents | T31, T39 |
| FR-57 | §3.9 Settings, reports and agents | T22, T34 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off; enabling it in dev shows the feature end to end.
- Constitution gates in `spec.md` §9 confirmed.
- Stock at every supplier location equals the material still held there on open and closed orders (integrity check
  green) after the AC scenarios.
- Customer-owned stock never appears in own available or valued stock.
- Every acceptance criterion AC-1 to AC-12 demonstrated on a fresh tenant with the flags on.
