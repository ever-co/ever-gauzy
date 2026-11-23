# Task Breakdown: Production planning

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `production-planning`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind the feature flag: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it.
- Builds on `manufacturing-bom-and-routing` (scaffold, `StructureReader`) and `shop-floor-and-work-orders` (work orders,
  cards, calendars, ports). Paths are relative to `packages/plugins/manufacturing/src/lib/` unless they start with
  `packages/` or `apps/`.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. `FEATURE_PRODUCTION_PLANNING` in `manufacturing.features.ts` (`defaultEnabled: false`, `dependsOn:
  FEATURE_MANUFACTURING`); planning permission contributions with `defaultFor` and setting contributions (spec FR-53) in
  the platform settings store. Test: contribution specs; guard 404.
- [ ] **T2**. Contracts `packages/contracts/src/lib/manufacturing-planning.model.ts` (+ `index.ts`). Test: contracts build.
- [ ] **T3**. Plan entities (`planning/plan/entities/production-plan.entity.ts`, `production-plan-row.entity.ts`,
  `production-plan-sub-assembly.entity.ts`, `production-plan-material.entity.ts`, `production-plan-source.entity.ts`)
  and migration `database/migrations/1791000091100-CreateProductionPlanTables.ts`. Test: SQLite migration. Migration timestamps: `1791000091100` to `1791000091199` (`packages/plugins/manufacturing`).
- [ ] **T4** (parallel). Schedule and forecast entities (`manufacturing_demand_forecast`, `_line`, kinds `PLANNER` and
  `ROLLING`) and migration. Files: `planning/schedule/entities/production-schedule.entity.ts`,
  `planning/schedule/entities/production-schedule-bucket.entity.ts`,
  `planning/forecast/entities/manufacturing-demand-forecast.entity.ts`,
  `planning/forecast/entities/manufacturing-demand-forecast-line.entity.ts`,
  `database/migrations/1791000091110-CreateProductionScheduleAndForecastTables.ts`. Test: SQLite migration spec; no
  table name shared with another plugin.
- [ ] **T5** (parallel). Requirement entities (item state, periods, planned orders with `operationId`, pegging,
  exceptions; no run table) and migration. Files: `planning/requirements/entities/planning-item-state.entity.ts`,
  `planning/requirements/entities/planning-period.entity.ts`, `planning/requirements/entities/planned-order.entity.ts`,
  `planning/requirements/entities/planned-order-peg.entity.ts`, `planning/requirements/entities/planning-exception.entity.ts`,
  `database/migrations/1791000091120-CreateMaterialRequirementTables.ts`. Test: SQLite migration spec.
- [ ] **T6** (parallel). Capacity and scenario entities (`capacity_slot` for planned operations and scenario copies only)
  and migration. Files: `planning/scheduler/entities/capacity-slot.entity.ts`,
  `planning/scenarios/entities/planning-scenario.entity.ts`, `planning/scenarios/entities/planning-scenario-change.entity.ts`,
  `database/migrations/1791000091130-CreateCapacitySchedulingTables.ts`. Test: SQLite migration spec; a real card cannot
  get a slot row.
- [ ] **T7**. Default role grants as `defaultFor` of the planning permission contributions; core operation types
  `MANUFACTURING_REQUIREMENTS_RUN` (aggregate = organization) and `MANUFACTURING_SCENARIO_COMPUTE` (aggregate = scenario)
  registered with `OperationRegistry`. Files: `manufacturing.permissions.ts`, `planning/planning-operations.ts`. Test:
  contribution spec; registry spec; second live requirement run refused.
- [ ] **T8**. Ports `MANUFACTURING_ROSTERS` (fallback adapter over core approved `time-off-request`,
  `employee-availability`, `availability-slots`, `official-holiday`) and `MANUFACTURING_DEMAND_HISTORY` with bindings;
  extensions of `MANUFACTURING_PURCHASING` (supplier terms with `minQuantity`, `packSize`, `leadTimeDays`, priority; the
  supplier's `leadTimeDays`; open lines, draft orders), `MANUFACTURING_CATALOG` (item `minOrderQuantity`, `orderMultiple`,
  `leadTimeDays`), `MANUFACTURING_SALES` (open lines, kits) and `MANUFACTURING_SUBCONTRACT` (open orders, from plan
  lines); answers `STOCK_DEMAND_FORECAST` and `STOCK_REPLENISHMENT_PRECEDENCE` bound in `plugin-composition.ts`. Test:
  fallback specs (operators on approved time off are unavailable without attendance); composition spec.

## Phase 2 — Services, endpoints, events

- [ ] **T9**. Plan service (`planning/plan/production-plan.service.ts`): create, lifecycle as a business document engine
  type (numbering, lifecycle, links), pull orders (pending net of other plans and work orders, kits expanded, empty
  refused), pull requisitions and planned orders, combine with references, row limits. Test: DB spec over two sales
  orders and an existing plan; a plan gets its number from the engine.
- [ ] **T10**. Sub-assembly and material explosion (`planning/plan/plan-explosion.ts`, pure, via `StructureReader`):
  levels, back-scheduled dates, options, projected quantity and safety stock from `MANUFACTURING_STOCK`, routes,
  minimums and multiples from supplier terms or the item with `quantitySources`. Test: pure specs per option; projection
  never recomputed (port mock asserted); copied values show their source.
- [ ] **T11**. Document creation (`planning/plan/plan-documents.service.ts`): work orders through the shop floor service,
  subcontract orders, requisitions split by route and supplier, draft purchase orders with preview; links; cancel rule;
  produced and ordered roll-back from events. Test: DB spec (links, cancel keeps released orders).
- [ ] **T12**. Plan reservations with reference `PRODUCTION_PLAN` and hand-over to work orders. Files:
  `planning/plan/plan-reservations.service.ts`. Test: port spec.
- [ ] **T13**. Plan scheduling (`planning/plan/plan-schedule.ts`, pure forward schedule with shifts) with preview, apply and
  signature-based clearing. Test: pure spec; stale clearing spec.
- [ ] **T14**. Plan controllers, DTOs, export and visual overview route. Files:
  `planning/plan/production-plan.controller.ts`, `planning/plan/dto/create-production-plan.dto.ts`,
  `planning/plan/dto/update-production-plan.dto.ts`, `planning/plan/plan-visual.service.ts`. Test: controller specs;
  e2e create → documents; the visual overview route returns rows, materials and documents.
- [ ] **T15**. Master production schedule (`planning/schedule/production-schedule.service.ts`,
  `planning/schedule/production-schedule.controller.ts`, `planning/schedule/demand-gathering.ts`): business document
  engine type, buckets, demand gathering, consumption rules, lead-time offsets through levels, firm into plan. Test:
  consumption spec (120 orders, 100 forecast); lead-time spec.
- [ ] **T16**. Manual forecasts (`planning/forecast/demand-forecast.service.ts`,
  `planning/forecast/demand-forecast.controller.ts`): business document engine type, create, validate (stock items,
  periods), one schedule per forecast, schedule from forecast. Test: refusal specs.
- [ ] **T17**. Requirement netting `planning/requirements/netting.ts` (pure: gross demand, receipts, projected stock, lot
  sizing, time fence, planned orders, exceptions) and pegging `pegging.ts`. Test: property-based tests (supply covers
  demand, no negative projected stock after planned receipts, pegged sum equals planned quantity).
- [ ] **T18**. Requirement service: gather demand and supply through ports and shop floor, low-level codes from the
  explosion, lead time from the override, supplier term, supplier, item, then organization default ("no lead time" only
  when all are empty), persist periods, planned orders, pegging and exceptions; nightly full run as core operation
  `MANUFACTURING_REQUIREMENTS_RUN`. Files: `planning/requirements/requirement.service.ts`,
  `planning/requirements/requirements-run.operation.ts`, `planning/requirements/lead-time.resolver.ts`. Test: DB spec on
  SQLite; same result twice writes nothing (hash); a supplier term lead time prevents the "no lead time" exception.
- [ ] **T19**. Firm, dismiss, acknowledge; item settings routes (overrides only, sources shown); requirement grid, planned
  orders, exceptions and capacity per work centre and bucket (load against available) reads;
  `STOCK_REPLENISHMENT_PRECEDENCE` answer from `isPlanned`. Files: `planning/requirements/requirements.controller.ts`,
  `planning/requirements/planned-order.service.ts`, `planning/requirements/item-planning-settings.controller.ts`,
  `planning/requirements/capacity-view.query.ts`, `planning/requirements/replenishment-precedence.adapter.ts`. Test:
  controller specs; firmed survives regeneration; a planned item-location is reported planned and a non-planned one is
  not.
- [ ] **T20**. Events and realtime hints (`planning-streamed-events.ts`), inbox items for expedite and release-overdue
  exceptions, daily digest. Test: one inbox item per exception key.
- [ ] **T21**. `SALES_PRODUCTION` answer while planning is on (production request → plan row). Files:
  `planning/plan/sales-production.adapter.ts`, `apps/api/src/plugin-composition.ts`. Test: port spec switching with the
  tenant feature.
- [ ] **T22**. Report datasets (spec FR-52) behind `/reports/:key`, including the statistical forecast report. Files:
  `planning/reports/planning-report-datasets.ts`, `planning/reports/planning-reports.controller.ts`. Test: dataset spec
  per report.
- [ ] **T23**. Settings route and its effect on engine, schedules and scenarios. Files:
  `planning/settings/planning-settings.controller.ts`, `planning/settings/planning-settings.service.ts`. Test: settings
  specs; scenario retention follows the setting.

## Phase 3 — UI surfaces

- [ ] **T24**. Angular planning menu and routes, i18n `MANUFACTURING.PLANNING.*` in every locale. Files:
  `packages/plugins/manufacturing-ui/src/lib/planning/planning.routes.ts`, `packages/plugins/manufacturing-ui/src/lib/planning/planning-menu.ts`,
  `packages/ui-core/i18n/assets/i18n/en.json` and every other locale file there. Test: routing and menu specs (hidden
  with the flag off).
- [ ] **T25**. Plan list and plan page (sources, rows, sub-assemblies, materials, documents, schedule, visual). Files:
  `packages/plugins/manufacturing-ui/src/lib/planning/plans/production-plans-list.component.ts`,
  `packages/plugins/manufacturing-ui/src/lib/planning/plans/production-plan-page.component.ts`, `packages/plugins/manufacturing-ui/src/lib/planning/plans/plan-visual-overview.component.ts`,
  `packages/plugins/manufacturing-ui/src/lib/planning/services/production-plans.service.ts`. Test: rendering specs; keyboard navigation of grids.
- [ ] **T26**. Schedules and forecasts pages. Files:
  `packages/plugins/manufacturing-ui/src/lib/planning/schedules/production-schedule-page.component.ts`,
  `packages/plugins/manufacturing-ui/src/lib/planning/forecasts/demand-forecast-page.component.ts`. Test: rendering specs.
- [ ] **T27** (parallel). `RequirementGrid` (React) and requirements page with planned orders, exceptions and the
  capacity view. Files: `packages/plugins/manufacturing-react-ui/src/lib/components/RequirementGrid.tsx`,
  `packages/plugins/manufacturing-ui/src/lib/planning/requirements/requirements-page.component.ts`,
  `packages/plugins/manufacturing-ui/src/lib/planning/requirements/capacity-view.component.ts`. Test: rendering tests; pegged demands shown per planned order.
- [ ] **T28**. Reports and settings pages. Files:
  `packages/plugins/manufacturing-ui/src/lib/planning/reports/planning-reports.component.ts`,
  `packages/plugins/manufacturing-ui/src/lib/planning/settings/planning-settings-page.component.ts`. Test: rendering specs.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T29**. MCP tools `packages/mcp-server/src/lib/tools/manufacturing-planning.ts` (build plan, item requirement,
  schedule plan, promise date) registered in `register-all-tools.ts`. Test: input schema specs; previews write nothing.
- [ ] **T30** (parallel). Print templates (plan, materials list) and spreadsheet export. Files:
  `planning/print/production-plan.template.ts`, `planning/print/plan-materials.template.ts`,
  `planning/plan/plan-materials.export.ts`. Test: render spec; the export lists every material row.
- [ ] **T31**. OpenAPI regenerated, SDK note, user docs "Production planning", `docs/specs/README.md` row. Test: OpenAPI
  diff additive.

## Phase 5 — Advanced capabilities

- [ ] **T32**. Incremental recomputation: consumer `subscriber:manufacturing-planning` marking dirty items, queue job in
  low-level-code order with debounce and per-item locks, component propagation. Files:
  `planning/requirements/planning-dirty-items.consumer.ts`, `planning/requirements/incremental-recompute.worker.ts`.
  Test: DB spec (sales order confirmed → planned orders within one job pass; failure of one item raises an exception,
  others computed).
- [ ] **T33**. Explanations (`planning/requirements/explain.ts`): facts to plain-language text for planned orders and
  exceptions; routes and panel. Test: explanation spec for the 800-screw scenario.
- [ ] **T34**. Draft documents with preview (`planning/requirements/draft-documents.service.ts`): group by supplier,
  prices and terms from purchasing, requisitions, work orders, transfers, subcontract orders; drafts only; links. Test:
  preview writes nothing; confirm creates drafts only.
- [ ] **T35**. MCP tools `planning_explain_planned_order`, `planning_draft_documents`. Files:
  `packages/mcp-server/src/lib/tools/manufacturing-planning.ts`. Test: tool specs; preview is the default.
- [ ] **T36**. Firm from the schedule into work orders and requisitions. Files: `planning/schedule/schedule-firming.service.ts`,
  `planning/schedule/production-schedule.controller.ts`. Test: DB spec.
- [ ] **T37**. Statistical forecasting `planning/forecast/methods.ts` (moving average, trend and seasonal smoothing with
  weekly or yearly season, seasonal repeat), back-test and choice, adjustments kept, generation preview; history through
  `MANUFACTURING_DEMAND_HISTORY`; the nightly rolling forecast per location (daily, 90 days, 8 weeks of history) and the
  `STOCK_DEMAND_FORECAST` answer ("none" while planning is off for the tenant). Test: pure specs on seasonal and trend
  series; adjustment survives regeneration; reorder reads the same lines the forecast page shows.
- [ ] **T38**. Forecast accuracy job and report; MCP `planning_generate_forecast`. Files:
  `planning/forecast/forecast-accuracy.scheduler.ts`, `planning/reports/planning-report-datasets.ts`,
  `packages/mcp-server/src/lib/tools/manufacturing-planning.ts`. Test: job spec; actual demand and error recorded per
  item and method after a period.
- [ ] **T39**. Finite scheduler `planning/scheduler/finite-scheduler.ts` (pure: priority rules, calendars, capacity,
  set-up, sequence, material dates, operator availability, pins, unscheduled list). Test: pure specs including a full
  centre, a holiday, a pin and an operator absence.
- [ ] **T40**. Board API: board read (cards from `operation_card`, planned operations from `capacity_slot`), moves with
  preview, hard and soft conflicts, apply to the cards' own planned times, pins and operators and to orders through the
  shop floor service in one change, undo, stale refusal, live hints. Files: `planning/scheduler/planning-board.service.ts`,
  `planning/scheduler/planning-board.controller.ts`, `planning/scheduler/board-conflicts.ts`. Test: DB spec (move applies
  to the card row; no slot row written for a real card; stale move refused).
- [ ] **T41**. `PlanningBoard` React component with `@dnd-kit/core` (pointer and keyboard moves, announcements), list
  alternative, embedded in the Angular board page. Files:
  `packages/plugins/manufacturing-react-ui/src/lib/components/PlanningBoard.tsx`,
  `packages/plugins/manufacturing-ui/src/lib/planning/board/planning-board-page.component.ts`. Test: rendering and
  keyboard move tests.
- [ ] **T42**. Reschedule proposals on downtime and late completion. Files:
  `planning/scheduler/reschedule-proposal.listener.ts`. Test: proposal spec.
- [ ] **T43**. Scenarios: copy, changes, compute as core operation `MANUFACTURING_SCENARIO_COMPUTE` with the same engine
  and scheduler in scenario scope, compare, apply as one change with base-stamp check, expiry job; `ScenarioCompare`
  component; MCP scenario tools. Files: `planning/scenarios/planning-scenario.service.ts`,
  `planning/scenarios/scenario-compute.operation.ts`, `planning/scenarios/planning-scenarios.controller.ts`,
  `planning/scenarios/scenario-expiry.scheduler.ts`,
  `packages/plugins/manufacturing-react-ui/src/lib/components/ScenarioCompare.tsx`,
  `packages/mcp-server/src/lib/tools/manufacturing-planning.ts`. Test: DB spec (late orders shown; apply refused after a
  conflicting change).
- [ ] **T44**. Promise dates from the finite schedule and materials for sales through `SALES_PRODUCTION`; MCP
  `planning_promise_date`. Files: `planning/scheduler/promise-date.service.ts`, `planning/plan/sales-production.adapter.ts`,
  `packages/mcp-server/src/lib/tools/manufacturing-planning.ts`. Test: promise spec with and without capacity.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Scope and compatibility | T1, T24 |
| FR-2 | §3.1 Scope and compatibility | T11, T34 |
| FR-3 | §3.1 Scope and compatibility | T10, T18, T19 |
| FR-4 | §3.1 Scope and compatibility | T9, T15, T16, T20 |
| FR-5–FR-9 | §3.2 Production plans | T9 |
| FR-10 | §3.2 Production plans | T10, T25 |
| FR-11 | §3.2 Production plans | T10 |
| FR-12 | §3.2 Production plans | T30 |
| FR-13–FR-14 | §3.2 Production plans | T11 |
| FR-15 | §3.2 Production plans | T12 |
| FR-16 | §3.2 Production plans | T11 |
| FR-17–FR-19 | §3.3 Master production schedule | T15 |
| FR-20 | §3.3 Master production schedule | T16 |
| FR-21 | §3.3 Master production schedule | T15 |
| FR-22 | §3.3 Master production schedule | T36 |
| FR-23 | §3.4 Material requirements | T17, T18 |
| FR-24 | §3.4 Material requirements | T18, T32 |
| FR-25–FR-26 | §3.4 Material requirements | T17 |
| FR-27 | §3.4 Material requirements | T17, T27 |
| FR-28 | §3.4 Material requirements | T17, T18 |
| FR-29 | §3.4 Material requirements | T19, T27 |
| FR-30 | §3.4 Material requirements | T33 |
| FR-31 | §3.4 Material requirements | T34 |
| FR-32 | §3.4 Material requirements | T19 |
| FR-33 | §3.4 Material requirements | T18, T19 |
| FR-34 | §3.5 Demand forecasts | T16 |
| FR-35–FR-36 | §3.5 Demand forecasts | T37 |
| FR-37 | §3.5 Demand forecasts | T38 |
| FR-38 | §3.5 Demand forecasts | T16 |
| FR-39–FR-40 | §3.6 Plan scheduling | T13 |
| FR-41 | §3.7 Finite-capacity scheduling (advanced) | T39 |
| FR-42 | §3.7 Finite-capacity scheduling (advanced) | T40, T41 |
| FR-43 | §3.7 Finite-capacity scheduling (advanced) | T40 |
| FR-44 | §3.7 Finite-capacity scheduling (advanced) | T42 |
| FR-45 | §3.8 What-if scenarios (advanced) | T43 |
| FR-46 | §3.8 What-if scenarios (advanced) | T43 |
| FR-47 | §3.8 What-if scenarios (advanced) | T23, T43 |
| FR-48 | §3.9 Visualiser and other areas | T14, T25 |
| FR-49 | §3.9 Visualiser and other areas | T21 |
| FR-50 | §3.9 Visualiser and other areas | T44 |
| FR-51 | §3.9 Visualiser and other areas | T11 |
| FR-52 | §3.10 Reports, settings, agents and events | T22, T28 |
| FR-53 | §3.10 Reports, settings, agents and events | T1, T23 |
| FR-54 | §3.10 Reports, settings, agents and events | T29, T35, T38, T43 |
| FR-55 | §3.10 Reports, settings, agents and events | T20 |
| FR-56 | §3.10 Reports, settings, agents and events | T30 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off for existing tenants; enabling it in dev shows the feature end to end; with it off nothing
  changes (spec AC-10).
- Constitution gates in `spec.md` §9 confirmed.
- On the demo tenant a confirmed sales order yields pegged planned orders within 60 s, the explanation names its facts,
  drafted documents are drafts only, the board moves an operation that the console shows, and every report of spec
  FR-52 returns rows.
