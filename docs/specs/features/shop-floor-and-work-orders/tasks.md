# Task Breakdown: Shop floor and work orders

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `shop-floor-and-work-orders`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind the feature flag: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it.
- The plugin scaffold and flag come from `manufacturing-bom-and-routing` T1 to T5; migrations use the shared core
  migration helpers of `procurement` T4. Paths are
  relative to `packages/plugins/manufacturing/src/lib/` unless they start with `packages/`, `apps/` or `docs/`;
  `MU/` = `packages/plugins/manufacturing-ui/src/lib/`. Entities sit in the `entities/` folder of their area with their
  MikroORM repositories; migrations live in `database/migrations/` and are listed in `database/manufacturing-migrations.ts`
  (`manufacturing-bom-and-routing` T5); Angular components sit in `MU/components/<name>/<name>.component.ts` with their
  `*.component.spec.ts`.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts `packages/contracts/src/lib/manufacturing-shop-floor.model.ts` (+ `index.ts`): enums, interfaces,
  release preview, console sync and signal shapes. Files: `packages/contracts/src/lib/manufacturing-shop-floor.model.ts`,
  `packages/contracts/src/index.ts`. Test: `packages/contracts/src/lib/manufacturing-shop-floor.model.spec.ts` (contracts
  build; enum snapshot).
- [ ] **T2**. Permission values of plan §9 in `manufacturing.permissions.ts` (contributions with `defaultFor`); shop floor
  settings (spec FR-79) as setting contributions in `manufacturing.settings.ts`. Files: `manufacturing.permissions.ts`,
  `manufacturing.settings.ts`. Test: `manufacturing.permissions.spec.ts` and `manufacturing.settings.spec.ts`
  (contributions and defaults).
- [ ] **T3**. Work centre entities in `shop-floor/work-centre/entities/` (group, centre, status change, cost kind, cost
  component, working hour, calendar exception, operator roster, shop floor, station link `work_centre_station`). Files:
  `shop-floor/work-centre/entities/work-centre-group.entity.ts`, `work-centre.entity.ts`,
  `work-centre-status-change.entity.ts`, `work-centre-cost-kind.entity.ts`, `work-centre-cost-component.entity.ts`,
  `work-centre-working-hour.entity.ts`, `work-centre-calendar-exception.entity.ts`, `work-centre-operator.entity.ts`,
  `shop-floor.entity.ts`, `work-centre-station.entity.ts` (all in `shop-floor/work-centre/entities/`). Test:
  `shop-floor/work-centre/entities/work-centre.entities.spec.ts` (metadata for both ORMs).
- [ ] **T4**. Migration `CreateManufacturingWorkCentreTables` (PostgreSQL, SQLite, MySQL). Files:
  `database/migrations/1791000090100-CreateManufacturingWorkCentreTables.ts`, `database/manufacturing-migrations.ts`.
  Test: `database/shop-floor-migrations.spec.ts` (SQLite). Migration timestamps: `1791000090100` to `1791000090199` (`packages/plugins/manufacturing`).
- [ ] **T5**. Work order entities (`shop-floor/work-order/entities/`) and migration `CreateManufacturingWorkOrderTables`.
  Files: `shop-floor/work-order/entities/work-order.entity.ts`, `work-order-material.entity.ts`,
  `work-order-operation.entity.ts`, `work-order-output.entity.ts` (in `shop-floor/work-order/entities/`),
  `database/migrations/1791000090110-CreateManufacturingWorkOrderTables.ts`. Test: `database/shop-floor-migrations.spec.ts`.
- [ ] **T6** (parallel). Card entities (`shop-floor/operation-card/entities/`) and migration
  `CreateManufacturingOperationCardTables`. Files: `shop-floor/operation-card/entities/operation-card.entity.ts`,
  `operation-card-session.entity.ts`, `operation-card-entry.entity.ts`, `operation-card-material.entity.ts`,
  `operation-card-step.entity.ts` (in `shop-floor/operation-card/entities/`),
  `database/migrations/1791000090120-CreateManufacturingOperationCardTables.ts`. Test:
  `database/shop-floor-migrations.spec.ts`.
- [ ] **T7** (parallel). Downtime, stop reason, signal and effectiveness entities and migration
  `CreateManufacturingDowntimeAndSignalTables`. Files: `shop-floor/downtime/entities/stop-reason.entity.ts`,
  `shop-floor/downtime/entities/downtime.entity.ts`, `shop-floor/signals/entities/signal-source.entity.ts`,
  `shop-floor/signals/entities/machine-signal.entity.ts`, `shop-floor/effectiveness/entities/effectiveness-bucket.entity.ts`,
  `database/migrations/1791000090130-CreateManufacturingDowntimeAndSignalTables.ts`. Test:
  `database/shop-floor-migrations.spec.ts`.
- [ ] **T8** (parallel). Console session entity (`deviceId` of the attendance device) and migration
  `CreateManufacturingConsoleTables`. Files: `shop-floor/console/entities/console-session.entity.ts`,
  `database/migrations/1791000090140-CreateManufacturingConsoleTables.ts`. Test: `database/shop-floor-migrations.spec.ts`.
- [ ] **T9**. Default role grants of plan §9 as `defaultFor` of the permission contributions; no seed migration. Files:
  `manufacturing.permissions.ts`. Test: `manufacturing.permissions.spec.ts` (employee gets only operations work; the
  permission reload adds the grants to an existing tenant).
- [ ] **T10**. Ports `MANUFACTURING_STOCK`, `_LOTS`, `_PURCHASING`, `_SALES`, `_SUBCONTRACT`, `_ASSETS`, `_LEDGER`,
  `_BADGES` with fallbacks; bindings in `apps/api/src/plugin-composition.ts`; purposes registered at
  bootstrap through `STOCK_PURPOSE_REGISTRY`; work centre registered as an `ANALYTIC_DIMENSION_SOURCE`
  (`manufacturing.work_centre`). Files: `shop-floor/shop-floor.ports.ts`, `shop-floor/shop-floor-purposes.ts`,
  `shop-floor/work-centre/work-centre.dimension-source.ts`, `apps/api/src/plugin-composition.ts`. Test:
  `shop-floor/shop-floor.ports.spec.ts` (fallbacks); `shop-floor/shop-floor-purposes.spec.ts` (purposes and dimension
  source registered).

## Phase 2 — Services, endpoints, events

- [ ] **T11**. Work centres, groups, cost kinds and components (`shop-floor/work-centre/work-centre.service.ts`): derived
  rates, copy from group, roster, deactivation guard, `rate_changed` event; `WorkCentreRateService` bound to the
  `MANUFACTURING_WORK_CENTRES` reader of `manufacturing-bom-and-routing` T11. Files:
  `shop-floor/work-centre/work-centre.controller.ts`, `shop-floor/work-centre/work-centre-group.service.ts`,
  `shop-floor/work-centre/work-centre-rate.service.ts`. Test: `shop-floor/work-centre/work-centre.service.spec.ts`
  (derived rates; duplicate component refusal; deactivation refused with open cards).
- [ ] **T12**. Calendar `shop-floor/calendar/calendar.ts` (pure: slots, overlaps, exceptions, official holidays by country,
  asset maintenance windows) and availability route. Files: `shop-floor/calendar/calendar.controller.ts`. Test:
  `shop-floor/calendar/calendar.spec.ts` (a week with a holiday and an exception; overlapping slots refused).
- [ ] **T13**. Shop floors and floor page data (centres, stock summary through `MANUFACTURING_STOCK`, draft stock document
  prefill). Files: `shop-floor/floor/shop-floor.service.ts`, `shop-floor/floor/shop-floor.controller.ts`. Test:
  `shop-floor/floor/shop-floor.controller.spec.ts` (stock summary; draft document prefilled).
- [ ] **T14**. Work order service (`shop-floor/work-order/work-order.service.ts`): create from structure via
  `StructureReader`, refusals of spec FR-17, numbering through `MANUFACTURING_DOCUMENTS`, materials from explosion,
  operations, outputs preview, links. Files: `shop-floor/work-order/work-order.controller.ts`. Test:
  `shop-floor/work-order/work-order.service.spec.ts`; `shop-floor/work-order/work-order.db.spec.ts` (template refused,
  explosion one level and all).
- [ ] **T15**. Lifecycle (`work-order-lifecycle.service.ts`): release (preview, reservations per setting, shortage rule),
  hold and resume, close (stop running cards option, release reservations), cancel (return draft), state derivation and
  material state. Files: `shop-floor/work-order/work-order-lifecycle.service.ts`,
  `shop-floor/work-order/work-order.controller.ts`. Test: `shop-floor/work-order/work-order-lifecycle.spec.ts` (state
  machine; hold refuses card actions); `shop-floor/work-order/work-order-lifecycle.db.spec.ts` (close with a running
  card).
- [ ] **T16**. Production project and card tasks (`shop-floor/time/card-task.service.ts`): production project per
  organization, `TaskCreateCommand` per card in a system actor context, roster operators as project members. Test:
  `shop-floor/time/card-task.service.db.spec.ts` (task per card, membership).
- [ ] **T17**. Card creation and sequencing (`shop-floor/operation-card/`): batches, states, sequence rule, completion
  rule, loss propagation, operation-step steps, cancel rule. Files: `shop-floor/operation-card/operation-card.service.ts`,
  `shop-floor/operation-card/card-sequence.ts`. Test: `shop-floor/operation-card/card-sequence.spec.ts` (40 available,
  45 refused; loss reduces later input: a 100-unit card after an operation that completed 98 and lost 2 completes
  with 98 completed and no loss of its own, and two 50-unit cards of a later operation after it complete with 50
  and 48, together 98).
- [ ] **T18**. Materials (`shop-floor/materials/`): reserve (reservations of reference `PRODUCTION_ORDER` per line; the
  reserved figure read from them), issue (allowance), return, per-card issue, backflush and consume-at-source,
  substitutes, stock documents through `MANUFACTURING_STOCK` with the order's `dimensionSetId`, issued, consumed and
  returned counters in the same transaction. Files: `shop-floor/materials/materials.service.ts`,
  `shop-floor/materials/materials.controller.ts`, `shop-floor/materials/backflush.ts`. Test:
  `shop-floor/materials/materials.db.spec.ts` (ledger, levels, reservations and counters agree; over-issue refused;
  extra issued items flagged; no reserved counter is written).
- [ ] **T19**. Output (`shop-floor/output/output.service.ts`): output document with inputs by basis, secondary outputs with
  shares, process loss, additional cost lines (labour, machine, overhead per centre, each with its cost kind and
  dimension set), overproduction rules (order and sales line), lots and serial units through `MANUFACTURING_LOTS`;
  output held until its inspection is accepted, rejected quantity to a non-sellable location. Files:
  `shop-floor/output/output.controller.ts`. Test: `shop-floor/output/output.db.spec.ts` (secondary outputs; held output);
  `shop-floor/output/output.service.spec.ts` (allowances; a 100-unit sales line covered by its 100-unit work order
  accepts that order's first output, and another order's open 40 on the same line lowers the room by 40).
- [ ] **T20**. Conversion, disassembly and make-structure. Files: `shop-floor/output/conversion.service.ts`,
  `shop-floor/output/disassembly.service.ts`, `shop-floor/output/make-structure.service.ts`. Test:
  `shop-floor/output/disassembly.service.spec.ts` (limit; lots returned); `shop-floor/output/conversion.service.spec.ts`.
- [ ] **T21**. Costing `shop-floor/costing/work-order-cost.ts` (pure: actual, absorbed, variances by kind) and close facts
  for `document.work_order.closed`; `LEDGER_POSTING_SOURCE` and `LEDGER_ACCOUNT_RESOLVER` answers. Files:
  `shop-floor/costing/work-order-close-facts.ts`, `shop-floor/costing/costing.controller.ts`. Test:
  `shop-floor/costing/work-order-cost.spec.ts` (worked examples; facts balance; two outputs of 50 of an order of 100
  with 100 of cost and no new cost are valued at 50 each, and output values never sum above the order's cost).
- [ ] **T22**. Card actions controller (start, pause, resume, complete, entries, steps) with roster check, parallel
  capacity, inspection gate through `MANUFACTURING_QUALITY`, corrective cards and assignment; every shop floor
  controller carries the feature guard of `manufacturing-bom-and-routing` T2. Files:
  `shop-floor/operation-card/operation-card.controller.ts`, `shop-floor/operation-card/card-actions.service.ts`,
  `shop-floor/operation-card/corrective-card.service.ts`. Test: `shop-floor/operation-card/operation-card.controller.spec.ts`
  (inspection missing, unfinished or rejected each refused with its message; routes answer `404` with
  `FEATURE_MANUFACTURING` off); `shop-floor/operation-card/card-flow.e2e-spec.ts`.
- [ ] **T23**. Downtime and stop reasons: manual entry, overlap refusal, numbering, pause-opened downtime, confirm; a
  maintenance downtime of a centre with an asset links the asset's repair through `MANUFACTURING_ASSETS` and writes its
  downtime hours when it closes. Files: `shop-floor/downtime/downtime.service.ts`, `shop-floor/downtime/downtime.controller.ts`,
  `shop-floor/downtime/stop-reason.service.ts`. Test: `shop-floor/downtime/downtime.service.spec.ts` (overlap refused;
  pause opens and resume closes; repair hours equal the linked rows).
- [ ] **T24**. Capacity check `shop-floor/capacity/placement.ts` (pure: look-ahead, holidays, capacity, gaps, parallel
  sequences) used by release. Test: `shop-floor/capacity/placement.spec.ts` (a full calendar and a free slot on day
  12; holiday refused naming the dates).
- [ ] **T25**. Events and realtime hints (`shop-floor-streamed-events.ts`), inbox items (shortage, late, downtime, failed
  inspection). Files: `shop-floor/shop-floor-streamed-events.ts`, `shop-floor/shop-floor-inbox.ts`. Test:
  `shop-floor/shop-floor-streamed-events.spec.ts` (events appended in the write transaction; inbox items written once
  per key).
- [ ] **T26**. Consumers `subscriber:manufacturing-shop-floor-stock`, `-quality`, `-subcontract` (pick list issues, valued
  documents, inspection results, subcontract receipts). Files: `shop-floor/consumers/shop-floor-stock.consumer.ts`,
  `shop-floor/consumers/shop-floor-quality.consumer.ts`, `shop-floor/consumers/shop-floor-subcontract.consumer.ts`. Test:
  one `*.consumer.spec.ts` beside each (idempotent per event; a received subcontract operation reported done).
- [ ] **T27**. Port answers `SUBCONTRACTING_WORK_ORDERS`, `PURCHASING_MAKE`, `SALES_PRODUCTION` (planning off); sales
  write-back through `MANUFACTURING_SALES`; requisitions and pick lists for pending materials. Files:
  `shop-floor/ports/subcontracting-work-orders.answer.ts`, `shop-floor/ports/purchasing-make.answer.ts`,
  `shop-floor/ports/sales-production.answer.ts`, `shop-floor/materials/pending-materials.service.ts`. Test:
  `shop-floor/ports/shop-floor-port-answers.spec.ts` (sales line check and write-back; inward subcontract limit).
- [ ] **T28**. Status derivation and `shop-floor.status-sweep`, late-orders job. Files:
  `shop-floor/status/centre-status.ts`, `shop-floor/status/status-sweep.scheduler.ts`,
  `shop-floor/status/late-orders.scheduler.ts`. Test: `shop-floor/status/centre-status.spec.ts` (over a calendar
  boundary).
- [ ] **T29**. Report datasets (spec FR-80) and dashboard (FR-81) behind `/reports/:key` and `/dashboard`. Files:
  `shop-floor/reports/shop-floor-report.definitions.ts`, `shop-floor/reports/shop-floor-dashboard.ts`,
  `shop-floor/reports/reports.controller.ts`. Test: `shop-floor/reports/shop-floor-report.definitions.spec.ts` (one
  dataset per report).
- [ ] **T30**. Settings route and its effect on release, issue, output and cards. Files:
  `shop-floor/settings/shop-floor-settings.controller.ts`, `shop-floor/settings/shop-floor-settings.service.ts`. Test:
  `shop-floor/settings/shop-floor-settings.service.spec.ts` (one case per setting group; materials changed after
  release only with the setting).

## Phase 3 — UI surfaces

- [ ] **T31**. Angular work centre, group, shop floor, stop reason and station pages (stations list attendance `TERMINAL`
  devices with their centres); i18n `MANUFACTURING.SHOP_FLOOR.*`. Files: `MU/components/work-centres/`,
  `MU/components/work-centre-groups/`, `MU/components/shop-floors/`, `MU/components/stop-reasons/`,
  `MU/components/stations/`, `packages/ui-core/i18n/assets/i18n/*.json`. Test: their component specs (rendering; menu
  hidden with the feature off).
- [ ] **T32**. Work order list (saved views, calendar, board) and detail (materials, operations, cards, outputs, cost,
  flow) with release preview and close dialog. Files: `MU/components/work-orders/`, `MU/components/work-order-detail/`,
  `MU/components/release-preview/`, `MU/components/close-dialog/`. Test: their component specs (rendering; keyboard
  navigation).
- [ ] **T33**. Card list and card page for supervisors (assign with a warning on approved time off or unavailability,
  corrective, cancel). Files: `MU/components/operation-cards/`, `MU/components/operation-card-page/`. Test: their
  component specs (states by colour and text; warning shown for an operator on approved time off).
- [ ] **T34**. "Create work order" actions on sales order and requisition pages through plugin slots. Files:
  `MU/components/create-work-order-action/`. Test: its component spec (hidden with the flag off).
- [ ] **T35**. Reports, dashboard and settings pages. Files: `MU/components/shop-floor-reports/`,
  `MU/components/shop-floor-dashboard/`, `MU/components/shop-floor-settings/`. Test: their component specs
  (rendering).

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T36**. MCP tools `packages/mcp-server/src/lib/tools/manufacturing-shop-floor.ts` (status, create, release, issue,
  output with `preview` default true, list downtime), registered in `register-all-tools.ts`. Files:
  `packages/mcp-server/src/lib/tools/manufacturing-shop-floor.ts`, `packages/mcp-server/src/lib/tools/register-all-tools.ts`.
  Test: `packages/mcp-server/src/lib/tools/manufacturing-shop-floor.spec.ts` (input schemas; preview writes nothing;
  no tool starts or completes cards).
- [ ] **T37** (parallel). Print templates (work order, card with barcode, output label) and import definitions (centres,
  calendars, stop reasons), templates registered through `registerPrintTemplates` (`print-and-pdf-designer` T36).
  Files: `shop-floor/print/work-order.template.ts`, `shop-floor/print/operation-card.template.ts`,
  `shop-floor/print/output-label.template.ts`, `shop-floor/import/shop-floor-import.definitions.ts`. Test:
  `shop-floor/print/shop-floor-print-templates.spec.ts` (render); `shop-floor/import/shop-floor-import.definitions.spec.ts`
  (validation).
- [ ] **T38**. OpenAPI regenerated, SDK note, user docs "Shop floor and work orders", `docs/specs/README.md` row.
  Files: docs site `website/docs/manufacturing/`, `docs/specs/README.md`. Test: OpenAPI diff additive; docs build.

## Phase 5 — Advanced capabilities

- [ ] **T39**. Card timer (`shop-floor/time/card-timer.service.ts`): start, pause, resume, complete through core
  `StartTimerCommand` / `StopTimerCommand` in the operator's request context; one running card per operator; break through
  the core break type. Files: `shop-floor/time/card-timer.controller.ts`. Test:
  `shop-floor/time/card-timer.service.db.spec.ts` (time log on the card task; second start pauses the first).
- [ ] **T40**. Card time capture of core `TimerStartedEvent` / `TimerStoppedEvent` onto the outbox and the labour roll-up
  job (`shop-floor/time/labour-rollup.service.ts`) under the labour attribution rule of plan §2: logs by the card's task
  only; productive, idle, break seconds; cost from stored pay rate; nightly recompute. Test: roll-up spec with mixed log
  types; recompute after a log edit; a log carrying the card's task is counted on the card even where its interval
  overlaps another work record's, and a log carrying the other record's task is not counted here, whatever its
  interval; pay never serialised. Files: `shop-floor/time/card-time.capture.ts`, `shop-floor/time/labour-rollup.scheduler.ts`. Spec file:
  `shop-floor/time/labour-rollup.service.spec.ts`.
- [ ] **T41**. Labour source setting (rate split vs actual), estimated labour for untracked operators, efficiency figures.
  Files: `shop-floor/time/labour-source.ts`, `shop-floor/time/efficiency.ts`, `shop-floor/costing/work-order-cost.ts`.
  Test: `shop-floor/time/labour-source.spec.ts` (costing for both sources; estimated labour marked);
  `shop-floor/time/efficiency.spec.ts`.
- [ ] **T42**. Idle detection: console prompt contract and server `shop-floor.idle-guard` job writing the idle gap.
  Files: `shop-floor/time/idle-guard.scheduler.ts`, `shop-floor/time/idle-guard.service.ts`. Test:
  `shop-floor/time/idle-guard.service.spec.ts` (stops at last activity and records idle).
- [ ] **T43**. Console back end: queue, offline pack (no costs), and the console operation kinds (start, pause, resume,
  complete, output, loss, step done, downtime confirm, issue confirm) contributed through `OFFLINE_OPERATION_KINDS` to the
  core offline-sync module, each with its apply handler, permission and conflict rules; exceptions resolved through
  `/api/offline-sync/exceptions`. Files: `shop-floor/console/console-queue.service.ts`,
  `shop-floor/console/console-offline-pack.service.ts`, `shop-floor/console/console-offline-kinds.ts`,
  `shop-floor/console/console.controller.ts`. Test: `shop-floor/console/console-offline-kinds.db.spec.ts`: sync through `/api/offline-sync/batches` (13 operations once; conflict
  becomes an `offline_exception` of a manufacturing kind).
- [ ] **T44**. Stations: centres per attendance `TERMINAL` device (`work_centre_station`), device-key and badge and PIN
  sign-in through `MANUFACTURING_BADGES` (attendance profile and lockout), operator sessions, actions in the operator's
  context marked `viaStationId`, session sweep; console under the operator's own sign-in when attendance is off. Files:
  `shop-floor/stations/station.service.ts`, `shop-floor/stations/station.controller.ts`,
  `shop-floor/stations/operator-session.service.ts`, `shop-floor/stations/session-sweep.scheduler.ts`. Test:
  `shop-floor/stations/station.service.db.spec.ts` (roster only; the attendance lockout refuses after its failures; a
  kiosk badge signs in on a station).
- [ ] **T45**. Console module of the floor app: screens in `manufacturing-ui` registered with the module registry of
  `floor-ui` (queue, card screen, checklist, materials, shortcuts, themes); install, service worker, device queue and
  scanning are the floor app's (`warehouse-and-stock-movements` T44). Files: `MU/console/console.module.ts`,
  `MU/console/components/console-queue/`, `MU/console/components/console-card/`, `MU/console/components/console-checklist/`,
  `MU/console/components/console-materials/`. Test: their component specs (rendering; scans of cards, lots, badges and
  labels; actions queue offline through the floor app's queue).
- [ ] **T46**. Plant-floor board component and Angular embedding, realtime subscription. Files:
  `MU/components/shop-floor-board/`, `shop-floor/shop-floor-realtime-hints.ts`. Test:
  `MU/components/shop-floor-board/shop-floor-board.component.spec.ts` (tile update on a hint).
- [ ] **T47**. Signal sources and receiver: deploy flag registration, token hash lookup through the core `hashed-token.ts` of
  `automation-and-notifications` T58, `verifyWebhookSignature`,
  dedupe, rate limit, async apply in machine-time order. Files: `shop-floor/signals/signal-source.service.ts`,
  `shop-floor/signals/signal-source.controller.ts`, `shop-floor/signals/signal-receiver.controller.ts`,
  `shop-floor/signals/signal-apply.worker.ts`. Test: `shop-floor/signals/signal-receiver.e2e-spec.ts` (401 for a
  missing, wrong or stale signature on a source with a signature secret; a source whose secret was removed accepted by
  its address; 404, duplicate no-op, accepted batch).
- [ ] **T48**. Signal-driven downtime and counts: stop code mapping, to-confirm state, running closes, count proposals on
  the card. Files: `shop-floor/signals/signal-downtime.service.ts`, `shop-floor/signals/signal-counts.service.ts`. Test:
  `shop-floor/signals/signal-downtime.service.spec.ts` (the scenario of spec 2.1).
- [ ] **T49**. Effectiveness buckets and figures (`shop-floor/effectiveness/`): planned, run, ideal, counts from signals or
  cards and inspections; route; board and report use. Files: `shop-floor/effectiveness/effectiveness.service.ts`,
  `shop-floor/effectiveness/effectiveness.controller.ts`. Test: `shop-floor/effectiveness/effectiveness.service.spec.ts`
  (worked example for one hour).
- [ ] **T50**. Genealogy route through `MANUFACTURING_LOTS` trace, shown on order, console and lot page. Files:
  `shop-floor/genealogy/genealogy.controller.ts`, `shop-floor/genealogy/genealogy.service.ts`, `MU/components/genealogy/`.
  Test: `shop-floor/genealogy/genealogy.service.spec.ts` (from a finished serial unit to component lots and forward).
- [ ] **T51**. MCP tools `manufacturing_explain_cost_variance`, `manufacturing_shop_floor_status` and the "why late"
  explanation in `manufacturing_work_order_status`. Files: `packages/mcp-server/src/lib/tools/manufacturing-shop-floor.ts`,
  `shop-floor/costing/variance-explanation.service.ts`. Test: `packages/mcp-server/src/lib/tools/manufacturing-shop-floor.spec.ts`
  (explanation with downtime and shortage facts).
- [ ] **T52**. Provide the ports other features bind to (plan, **Consumer tokens answered**): `PORTAL_PRODUCTION`. Files: `apps/api/src/plugin-composition.ts`. Test:
`shop-floor/shop-floor-consumer-tokens.contract.spec.ts`, one contract test per token over the shape its consumer plan states; with this feature off each consumer keeps its stated fallback.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Scope and compatibility | T22, T31, T36 |
| FR-2 | §3.1 Scope and compatibility | T10, T18, T19, T20 |
| FR-3 | §3.1 Scope and compatibility | T14, T15, T25 |
| FR-4 | §3.1 Scope and compatibility | T39, T40 |
| FR-5 | §3.2 Work centres | T3, T11, T31 |
| FR-6–FR-7 | §3.2 Work centres | T3, T11 |
| FR-8 | §3.2 Work centres | T40, T41 |
| FR-9 | §3.2 Work centres | T12, T24 |
| FR-10 | §3.2 Work centres | T12, T24 |
| FR-11 | §3.2 Work centres | T12 |
| FR-12 | §3.3 Shop floors and live status | T13 |
| FR-13 | §3.3 Shop floors and live status | T13 |
| FR-14 | §3.3 Shop floors and live status | T25, T28 |
| FR-15 | §3.3 Shop floors and live status | T46, T49 |
| FR-16 | §3.4 Work orders | T14 |
| FR-17 | §3.4 Work orders | T14 |
| FR-18 | §3.4 Work orders | T15 |
| FR-19 | §3.4 Work orders | T15, T18 |
| FR-20 | §3.4 Work orders | T15 |
| FR-21 | §3.4 Work orders | T15 |
| FR-22 | §3.4 Work orders | T15 |
| FR-23 | §3.4 Work orders | T14, T18 |
| FR-24 | §3.4 Work orders | T18, T30 |
| FR-25 | §3.4 Work orders | T14, T17 |
| FR-26–FR-27 | §3.4 Work orders | T14 |
| FR-28 | §3.4 Work orders | T32 |
| FR-29 | §3.4 Work orders | T27 |
| FR-30 | §3.5 Materials | T15, T18 |
| FR-31 | §3.5 Materials | T18 |
| FR-32 | §3.5 Materials | T18 |
| FR-33 | §3.5 Materials | T18 |
| FR-34 | §3.5 Materials | T27 |
| FR-35 | §3.5 Materials | T18 |
| FR-36 | §3.5 Materials | T27 |
| FR-37–FR-38 | §3.6 Output | T19 |
| FR-39 | §3.6 Output | T19 |
| FR-40 | §3.6 Output | T20 |
| FR-41 | §3.6 Output | T20 |
| FR-42 | §3.6 Output | T20 |
| FR-43 | §3.6 Output | T19 |
| FR-44 | §3.7 Costing | T19, T21 |
| FR-45 | §3.7 Costing | T19, T21 |
| FR-46–FR-47 | §3.7 Costing | T21 |
| FR-48 | §3.7 Costing | T21, T32 |
| FR-49 | §3.8 Operation cards | T17 |
| FR-50 | §3.8 Operation cards | T17, T33 |
| FR-51–FR-52 | §3.8 Operation cards | T17 |
| FR-53 | §3.8 Operation cards | T6, T17 |
| FR-54 | §3.8 Operation cards | T18 |
| FR-55 | §3.8 Operation cards | T17, T19 |
| FR-56 | §3.8 Operation cards | T22, T33 |
| FR-57 | §3.8 Operation cards | T22 |
| FR-58 | §3.8 Operation cards | T17 |
| FR-59 | §3.9 Time on cards (advanced) | T39 |
| FR-60 | §3.9 Time on cards (advanced) | T22, T39, T40 |
| FR-61 | §3.9 Time on cards (advanced) | T39 |
| FR-62 | §3.9 Time on cards (advanced) | T39, T40 |
| FR-63 | §3.9 Time on cards (advanced) | T42 |
| FR-64 | §3.9 Time on cards (advanced) | T40 |
| FR-65 | §3.9 Time on cards (advanced) | T41 |
| FR-66 | §3.9 Time on cards (advanced) | T41 |
| FR-67 | §3.10 Downtime and machine signals | T23 |
| FR-68 | §3.10 Downtime and machine signals | T23 |
| FR-69 | §3.10 Downtime and machine signals | T47 |
| FR-70 | §3.10 Downtime and machine signals | T47 |
| FR-71 | §3.10 Downtime and machine signals | T48 |
| FR-72 | §3.10 Downtime and machine signals | T49 |
| FR-73 | §3.11 Capacity checks | T24 |
| FR-74 | §3.12 Operator console (advanced) | T45 |
| FR-75 | §3.12 Operator console (advanced) | T45 |
| FR-76 | §3.12 Operator console (advanced) | T44 |
| FR-77 | §3.12 Operator console (advanced) | T43, T45 |
| FR-78 | §3.13 Genealogy (advanced) | T50 |
| FR-79 | §3.14 Settings | T2, T30 |
| FR-80–FR-81 | §3.15 Reports and dashboards | T29 |
| FR-82 | §3.15 Reports and dashboards | T37 |
| FR-83 | §3.16 Other areas, agents and events | T25, T26 |
| FR-84 | §3.16 Other areas, agents and events | T27 |
| FR-85 | §3.16 Other areas, agents and events | T27 |
| FR-86 | §3.16 Other areas, agents and events | T36, T51 |
| FR-87 | §3.16 Other areas, agents and events | T25 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off; enabling it in dev shows the feature end to end; the signal receiver is absent unless
  `GAUZY_MANUFACTURING_SIGNALS_ENABLED` is `true`.
- Constitution gates in `spec.md` §9 confirmed.
- On the demo tenant a work order runs from release to close with stock, value and counters agreeing; card labour equals
  stored-rate time; every report of spec FR-80 returns rows; no pay rate appears in any response.
