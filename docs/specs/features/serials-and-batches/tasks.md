# Task Breakdown: Lots and serial units

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `serials-and-batches`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind the feature flag: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it.
- Paths: `lst/` = `packages/plugins/lot-serial-tracking/src/lib/`, `lst-ui/` =
  `packages/plugins/lot-serial-tracking-ui/src/lib/`. Each entity folder `lst/<name>/` holds `<name>.entity.ts` and
  `repository/type-orm-<name>.repository.ts` and `repository/mikro-orm-<name>.repository.ts`, as in
  `packages/plugins/purchasing/src/lib/`.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts `packages/contracts/src/lib/lot-serial.model.ts`, `stock-trace.model.ts`, `lot-recall.model.ts`;
  exports. Test: contracts build.
- [ ] **T2**. Plugin scaffold `packages/plugins/lot-serial-tracking` (package, project, tsconfig, jest, eslint),
  `lot-serial-tracking.plugin.ts` (`dependsOn` inventory), `lot-serial-tracking.features.ts`
  (`FEATURE_LOT_SERIAL_TRACKING`, default off), registration in `apps/api/src/plugins.ts` and the worker. Test:
  plugin metadata spec.
- [ ] **T3**. Entities and repositories for policies (shelf-life and warranty overrides), lots, status changes, serial
  units (`equipmentId`, `deliveryOrderLineId`; no service contract columns) and events; migration
  `CreateLotSerialTables`. Files: `lst/database/migrations/1791000087100-CreateLotSerialTables.ts`,
  `lst/item-tracking-policy/item-tracking-policy.entity.ts`, `lst/stock-lot/stock-lot.entity.ts`,
  `lst/stock-lot-status-change/stock-lot-status-change.entity.ts`, `lst/serial-unit/serial-unit.entity.ts`,
  `lst/serial-unit-event/serial-unit-event.entity.ts`, with their repositories. Test: SQLite migration spec; uniqueness spec (per item and per organization scope). Migration timestamps: `1791000087100` to `1791000087199` (`packages/plugins/lot-serial-tracking`).
- [ ] **T4** (parallel). Migrations and entities `CreateBundleTables` (bundles, entries with `signedQuantity` and the
  balance index) and `CreateTraceAndRecallTables`. Files:
  `lst/database/migrations/1791000087110-CreateBundleTables.ts`,
  `lst/database/migrations/1791000087120-CreateTraceAndRecallTables.ts`,
  `lst/lot-serial-bundle/lot-serial-bundle.entity.ts`, `lst/lot-serial-bundle-entry/lot-serial-bundle-entry.entity.ts`,
  `lst/trace-link/trace-link.entity.ts`, `lst/lot-recall/lot-recall.entity.ts`,
  `lst/lot-recall-subject/lot-recall-subject.entity.ts`, `lst/lot-recall-impact/lot-recall-impact.entity.ts`,
  `lst/shelf-life-rule/shelf-life-rule.entity.ts`, with their repositories. Test: SQLite migration specs.
- [ ] **T5**. Permissions as contributions with `defaultFor` in `lot-serial-tracking.permissions.ts` (no seed
  migration); settings keys (default picking policy, warning days) in `lot-serial-tracking.settings.ts`. Test:
  catalogue spec with default roles.

## Phase 2 — Services, endpoints, events

- [ ] **T6**. Policy service: resolution item → group, item shelf life and warranty from `item-catalogue` with the
  policy's overrides, `trackInventory` required for lot or serial tracking, numbering series hooks, tracking start
  document with preview (adoption lot, serial generation). Files:
  `lst/item-tracking-policy/item-tracking-policy.service.ts`, `lst/item-tracking-policy/tracking-start.service.ts`.
  Test: service spec (direct switch refused with stock; override over item default).
- [ ] **T7**. Lot service: create (series or manual) appending `lot.created` in the creating transaction, expiry from
  shelf life, statuses with reasons and history, disable, lineage. Files: `lst/stock-lot/stock-lot.service.ts`,
  `lst/stock-lot/stock-lot-status.service.ts`, `lst/stock-lot/stock-lot-lineage.ts`. Test: service spec (FR-4 to FR-7,
  FR-9, FR-10); one `lot.created` per new lot.
- [ ] **T8**. Serial unit service: generation, ranges, statuses through documents, warranty start and end from the
  item's warranty period or the override, equipment link, history events. Files: `lst/serial-unit/serial-unit.service.ts`,
  `lst/serial-unit/serial-range.ts`, `lst/serial-unit/serial-warranty.ts`. Test: service spec (FR-11 to FR-15).
- [ ] **T9**. Bundle service: draft bundles on draft lines, inward fill (entry, scan, ranges, generation, file import
  and template), outward suggestion, validation (FR-19). Files: `lst/lot-serial-bundle/lot-serial-bundle.service.ts`,
  `lst/lot-serial-bundle/bundle-validation.ts`, `lst/lot-serial-bundle/bundle-import.ts`. Test: validation spec with
  every refusal reason.
- [ ] **T10**. Movement hook bound to `STOCK_MOVEMENT_HOOKS`: validate before (lot balance derived from posted
  entries, those of canceled originals and their reversals included, and checked under the level lock), then serial statuses, entry `movementId` and `signedQuantity`, and trace
  links after, in the movement transaction; cancellation reversal by a reversing bundle. Files:
  `lst/hooks/lot-serial-movement.hook.ts`, `lst/lot-serial-bundle-entry/lot-balance.reader.ts`,
  `lst/trace-link/trace-link.writer.ts`. Test: SQLite spec through `applyMovement` (receipt, issue, transfer, return,
  repack split, production output, cancel; derived balance equals the expected per bin; a canceled receipt of 10 gives
  a balance of zero, not −10).
- [ ] **T11**. Picker bound to `STOCK_LOT_PICKER`: first expiry, first in or last in first out on derived lot
  balances less the active reservations naming the lot; exclusions; used by pick lists, deliveries, transfers, issues
  and consumption. Files: `lst/picking/lot-picker.ts`. Test: selection spec on fixtures.
- [ ] **T12**. Expired-lot block on every outward purpose with override tokens (`/lot-serial/override`). Files:
  `lst/picking/expired-lot.guard.ts`, `lst/override/lot-serial-override.controller.ts`,
  `lst/override/lot-serial-override.service.ts`. Test: spec per outward purpose; token single use.
- [ ] **T13**. Mirrors of the free-text fields: bind `PURCHASING_LOT_BUNDLES` in
  `packages/plugins/purchasing/src/lib/goods-receipt/` and `WAREHOUSE_LOT_BUNDLES` in
  `packages/plugins/warehouse/src/lib/pick-list-line/` (ports declared there); for tracked items text in builds a
  bundle and the bundle writes text back; for untracked items the text stays as typed and never refuses a movement.
  Files: `lst/mirrors/text-bundle.mirror.ts`, `apps/api/src/plugin-composition.ts`. Test: purchasing and pick line specs
  with and without the plugin bound; an untracked line with a past expiry text confirms as today.
- [ ] **T14**. Scan resolver binding `STOCK_LOT_SCAN_RESOLVER` (lot and serial lookup, composite parts). Files:
  `lst/scan/lot-serial-scan.resolver.ts`. Test: spec.
- [ ] **T15**. Valuation keys: expose bundle entries in the movement context for `inventory-valuation`; lot and serial
  keys when `valuationBy` is set. Files: `lst/valuation/lot-serial-valuation-keys.ts`,
  `lst/hooks/lot-serial-movement.hook.ts`. Test: SQLite spec with the valuation plugin (lot-valued issue cost).
- [ ] **T16**. Trace service: breadth-first walk through any number of levels with cycle detection, the per-answer
  depth and the continuation cursor of plan §2 Traces, both directions, customer nodes permission-checked.
  Files: `lst/trace-link/stock-trace.service.ts`, `lst/trace-link/stock-trace.controller.ts`. Test: five-level trace
  spec; a twelve-level chain is fully reached by following `next`; a cycle in the edges ends the walk without repeats.
- [ ] **T17**. Expiry job and the one warranty job with notices (inbox and email) and events; service contract expiry
  read from field service when bound; in-process fallback. Files: `lst/jobs/lot-expiry.scheduler.ts`,
  `lst/jobs/serial-warranty.scheduler.ts`, `lst/jobs/lot-serial-tracking.worker.ts`. Test: job idempotency specs.
- [ ] **T18**. Integrity checks contributed to the valuation monitor (item quantity equals the sum of derived lot
  balances, serial counts, orphans, negative lots, bundles versus movements, serial-valued costs). Files:
  `lst/checks/lot-serial-integrity.checks.ts`. Test: one spec per check with a seeded issue.
- [ ] **T19**. Quality binding: `QUALITY_LOTS.setStatus` bound in `apps/api/src/plugin-composition.ts` to the lot status
  service, which sets the lot status with the inspection as source inside the decision's transaction.
  Files: `lst/quality/quality-lot-status.binding.ts`, `apps/api/src/plugin-composition.ts`. Test: binding spec (one
  history entry when an inspection's status is set twice; a rolled-back decision leaves the status unchanged).
- [ ] **T20**. Controllers and DTOs for all routes of plan §4; additive `bundle` field on inventory, purchasing,
  warehouse, returns and fulfillment line DTOs. Files: `lst/item-tracking-policy/item-tracking-policy.controller.ts`,
  `lst/stock-lot/stock-lot.controller.ts`, `lst/serial-unit/serial-unit.controller.ts`,
  `lst/lot-serial-bundle/lot-serial-bundle.controller.ts`, `lst/lot-recall/lot-recall.controller.ts`,
  `lst/shelf-life-rule/shelf-life-rule.controller.ts`,
  `packages/plugins/inventory/src/lib/stock-transfer-line/dto/stock-transfer-line.dto.ts`,
  `packages/plugins/inventory/src/lib/stock-count-line/dto/stock-count-line.dto.ts`,
  `packages/plugins/purchasing/src/lib/goods-receipt-line/dto/goods-receipt-line.dto.ts`,
  `packages/plugins/warehouse/src/lib/pick-list-line/dto/pick-list-line.dto.ts`,
  `packages/plugins/returns/src/lib/order-return-line/dto/order-return-line.dto.ts`,
  `packages/plugins/fulfillment/src/lib/fulfillment-line/dto/fulfillment-line.dto.ts`. Test: controller specs; e2e on
  SQLite.
- [ ] **T21**. Report definitions FR-31 to FR-42 and lot and serial label print templates. Files:
  `lst/reports/lot-serial-report.definitions.ts`, `lst/print/lot-label.template.ts`, `lst/print/serial-label.template.ts`.
  Test: dataset spec per report; render spec per label.

## Phase 3 — UI surfaces

- [ ] **T22**. `packages/plugins/lot-serial-tracking-ui` scaffold, menu, availability on 404, i18n in every locale.
  Files: `lst-ui/lot-serial-tracking-ui.plugin.ts`, `lst-ui/lot-serial-tracking-ui.routes.ts`,
  `packages/ui-core/i18n/assets/i18n/en.json` (and every other locale file there). Test: plugin spec.
- [ ] **T23**. Lots, serial units, tracking policies and tracking start pages. Files:
  `lst-ui/pages/lots/lots-page.component.ts`, `lst-ui/pages/serial-units/serial-units-page.component.ts`,
  `lst-ui/pages/tracking-policies/tracking-policies-page.component.ts`,
  `lst-ui/pages/tracking-start/tracking-start-page.component.ts`. Test: rendering specs.
- [ ] **T24**. Bundle editor component registered on stock document, receipt, pick, return and fulfilment line
  editors. Files: `lst-ui/components/bundle-editor/bundle-editor.component.ts`, `lst-ui/lot-serial-tracking-ui.plugin.ts`.
  Test: component spec (ranges, import, suggestion).
- [ ] **T25** (parallel). Trace page (list view) and reports entry. Files: `lst-ui/pages/trace/trace-page.component.ts`.
  Test: rendering spec.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T26**. MCP tools `packages/mcp-server/src/lib/tools/lot-serial.ts`. Test: tool specs.
- [ ] **T27**. OpenAPI regenerated; SDK regeneration noted. Files: `packages/core/src/lib/bootstrap/swagger.ts`. Test: OpenAPI diff is additive.
- [ ] **T28**. User docs (tracking, lots, serials, bundles, expiry, traceability) and the specs index row. Files: `docs/specs/README.md`. Test: docs build.

## Phase 5 — Advanced capabilities

- [ ] **T29**. Shelf-life rules (customer, channel, item) applied by the picker with a shortfall report before
  picking. Files: `lst/shelf-life-rule/shelf-life-rule.service.ts`, `lst/picking/lot-picker.ts`. Test: picker spec.
- [ ] **T30**. Recall service: open, block at once, impact from the whole forward trace (walked to the end as steps of
  a core operation, plan §2 Traces), containment with preview
  (transfers to quarantine, holds and picks released), notice drafts through communications, returns linked,
  progress, close. Files: `lst/lot-recall/lot-recall.service.ts`, `lst/lot-recall/recall-impact.service.ts`,
  `lst/lot-recall/recall-containment.service.ts`. Test: SQLite end-to-end recall spec; a lot eight levels downstream
  of the recalled lot is in the impact.
- [ ] **T31**. Recall pages (impact, containment preview, notices, progress). Files:
  `lst-ui/pages/recalls/recalls-page.component.ts`, `lst-ui/pages/recalls/recall-detail.component.ts`. Test: rendering
  specs.
- [ ] **T32**. Trace graph view (SVG, node expansion, export, keyboard navigation). Files:
  `lst-ui/components/trace-graph/trace-graph.component.ts`. Test: component spec.
- [ ] **T33**. Expiry-risk job and agent (registered with `ai-agents-and-assistants`): lots versus production
  planning's forecast read through `STOCK_DEMAND_FORECAST`, previewed proposals for transfer, reservation or front-bin
  move. Files: `lst/jobs/expiry-risk.scheduler.ts`, `lst/agents/expiry-risk.agent.ts`. Test: proposal spec on fixtures.
- [ ] **T34**. Capture module of the floor app in `lot-serial-tracking-ui` (Angular): composite parsing, on-device
  series, offline lot cache; operations of kind `lot-serial.capture` through the core offline-sync module, duplicate
  serials at sync become `offline_exception` rows. Files: `lst-ui/floor/lot-serial-capture.module.ts`,
  `lst-ui/floor/composite-code.parser.ts`, `lst/offline/lot-serial-capture.handler.ts`. Test: component and replay
  specs.
- [ ] **T35**. Live updates and automation triggers of FR-50. Files: `lst/events/lot-serial-outbox.ts`,
  `lst/events/lot-serial-automation-triggers.ts`. Test: push spec; trigger catalogue spec.
- [ ] **T36**. Bundles on order return, claim and exchange lines (`RETURNS_LOT_BUNDLES`, declared in
  `packages/plugins/returns/src/lib/returns.types.ts`) and on fulfilment lines (`FULFILLMENT_LOT_BUNDLES`, declared in
  `packages/plugins/fulfillment/src/lib/fulfillment.types.ts`); delivered serial units record `deliveryOrderLineId`;
  a returned serial or lot is checked against the delivering bundles of the return line's `orderLineId`. Test:
  returns and fulfilment specs with and without the plugin bound (undelivered serial refused).
- [ ] **T37**. Defaults keep today's stock flows (spec FR-52, AC-16): with the feature on, untracked items move as
  today; the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it. Files:
  `lst/lot-serial-tracking.features.ts`, `lst/hooks/lot-serial-movement.hook.ts`. Test: the existing purchasing, warehouse,
  returns and fulfillment suites pass with the feature on and no tracking policy; a tenant created before the change
  keeps the feature off.
- [ ] **T38**. Provide the ports other features bind to (plan, **Consumer tokens answered**): `DOCUMENT_LOT_BUNDLES`, `FIELD_SERVICE_SERIALS`, `MANUFACTURING_LOTS`. Files: `apps/api/src/plugin-composition.ts`. Test: one contract test per token over the shape its consumer plan states; with this feature off each consumer keeps its stated fallback.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Tracking policies | T6, T23 |
| FR-2 | §3.1 Tracking policies | T6, T23 |
| FR-3 | §3.1 Tracking policies | T9, T10 |
| FR-4–FR-7 | §3.2 Lots | T7 |
| FR-8 | §3.2 Lots | T10, T11, T18 |
| FR-9–FR-10 | §3.2 Lots | T7, T10 |
| FR-11–FR-13 | §3.3 Serial units | T8 |
| FR-14 | §3.3 Serial units | T8, T17 |
| FR-15 | §3.3 Serial units | T8 |
| FR-16 | §3.4 Bundles | T9, T20, T24, T36 |
| FR-17–FR-18 | §3.4 Bundles | T9, T24 |
| FR-19 | §3.4 Bundles | T9, T36 |
| FR-20 | §3.4 Bundles | T10 |
| FR-21 | §3.4 Bundles | T13 |
| FR-22–FR-24 | §3.5 Picking by expiry or age | T11 |
| FR-25 | §3.5 Picking by expiry or age | T12 |
| FR-26 | §3.6 Expiry and valuation hooks | T17 |
| FR-27 | §3.6 Expiry and valuation hooks | T15 |
| FR-28 | §3.6 Expiry and valuation hooks | T18 |
| FR-29 | §3.7 Traceability | T10 |
| FR-30 | §3.7 Traceability | T16, T25 |
| FR-31–FR-43 | §3.8 Reports | T21 |
| FR-44 | §3.9 Shelf life, recall, graph and agents (advanced) | T29 |
| FR-45–FR-46 | §3.9 Shelf life, recall, graph and agents (advanced) | T30, T31 |
| FR-47 | §3.9 Shelf life, recall, graph and agents (advanced) | T32 |
| FR-48 | §3.9 Shelf life, recall, graph and agents (advanced) | T33 |
| FR-49 | §3.9 Shelf life, recall, graph and agents (advanced) | T34 |
| FR-50 | §3.9 Shelf life, recall, graph and agents (advanced) | T35 |
| FR-51 | §3.9 Shelf life, recall, graph and agents (advanced) | T26 |
| FR-52 | §3.10 Compatibility | T37 |
| FR-53 | §3.10 Compatibility | T5 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off; enabling it in dev shows the feature end to end.
- Constitution gates in `spec.md` §9 confirmed.
- After the full e2e suite the lot and serial checks report zero issues (derived lot balances sum to the levels, serial
  counts match).
- With the flag off, goods receipt and pick line free-text fields behave byte-for-byte as before.
