# Task Breakdown: CRM forecasting and analytics

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `crm-forecasting-and-analytics`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind `FEATURE_CRM`: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it.
- Starts after `crm-leads-and-deals` T1–T16 (deal value fields, stage history, the `crm` plugin) have landed.
- Plan phase 1 (surface what exists) = T1–T8, T12 (the definitions over deal, lead and stage data), T13, T14, T18,
  T22, T35, T36; phase 2 (depth) = the rest of phases 1–4; phase 3 (advanced) = phase 5 below.
- Depends on: the report definition registry and dashboard engine (`report-builder-and-dashboards`), targets
  (`sales-order-management`; fallback core goal KPIs), fiscal periods (`accounting-foundation`), sales hierarchy
  (`crm-engagement`). Each is behind a port with the fallback named in the plan.
- Builds on, unchanged in shape: core report catalogue (the nullable `featureKey` of the shared catalogue feature filter, added in T4),
  dashboards and widget registry, goal KPIs and time frames, the operation runtime, the settings store and permission
  contributions.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts `packages/contracts/src/lib/crm-analytics.model.ts`, `crm-forecast.model.ts`,
  `crm-dashboard.model.ts`; additive fields on `deal.model.ts` and `pipeline.model.ts`. Test: enum and type guard specs.
- [ ] **T2**. Core columns on `deal.entity.ts` and `pipeline-stage.entity.ts`; core migration
  `1791000051600-AddDealValuationAndForecastColumns` (three dialects, backfill for organization-currency deals). Test:
  migration spec on SQLite; PostgreSQL and MySQL in the migration suite. Migration timestamps: `1791000051500` to `1791000051599` (`packages/plugins/crm`); `1791000051600` to `1791000051699` (`packages/core`).
- [ ] **T3**. Plugin entities and repositories `packages/plugins/crm/src/lib/forecast/entities/` (`crm_forecast_entry`,
  `crm_forecast_snapshot`, `_deal`, `_rollup`, `crm_forecast_accuracy`); analytics keys added to `crm.settings.ts`
  (plan §2); migration `1791000051520-CreateCrmForecastTables`. Test: migration spec, entity specs, settings defaults.
- [ ] **T4**. Permission contributions with `defaultFor` in `crm.permissions.ts`; migration
  `1791000051540-SeedCrmReportCatalogue` (the "Sales" `report_category` and one `report` row per definition of spec §3.7,
  idempotent on `slug`), its category keyed `FEATURE_CRM` in the shared catalogue feature filter of
  `report-builder-and-dashboards` T51 (`packages/core/src/lib/reports/`), which leaves out categories and rows whose
  feature is off for the tenant; no core migration here.
  Test: registry spec for grants; catalogue rows listed by the existing `/report` routes with `FEATURE_CRM` on; with it
  off the report list and menu are identical to a run without the migration.

## Phase 2 — Services, endpoints, events

- [ ] **T5**. Rate resolution (pure) `valuation/rate-resolution.ts` (typed, stored, inverse, cross, none) and port
  `CRM_EXCHANGE_RATES` bound to the pricing plugin's exchange-rate lookup in `plugin-composition.ts`. Test: unit specs per
  rule, missing rate is never 1:1.
- [ ] **T6**. Valuation service `valuation/crm-deal-valuation.service.ts` (on deal change, closed-date freeze, re-rate on
  reopen; a deal without a rate saved as "rate missing"), `valuation/crm-valuation.controller.ts` with
  `valuation/dto/update-deal-valuation.dto.ts`: `/crm/deals/:id/valuation`, `/crm/rates` (currencies of open deals with
  latest rate, date and source; deals without a rate). Test: e2e including won deal freeze and a deal without a rate.
- [ ] **T7**. Reporting currency and scope rule: `analytics/reporting-currency.ts`, `analytics/scope.ts` (owner and managed
  teams, refused owner filters, the CRM record rules through `RECORD_ACCESS_FILTER` where loaded, and the scope key of
  the figure cache). Test: unit specs; e2e refusal of an unrelated owner; a team manager without
  `CRM_ANALYTICS_VIEW_ALL` receives the managed team's figures; a deal hidden by a record rule is left out of figures.
- [ ] **T8**. Pipeline summary `analytics/pipeline-summary.service.ts` and `/crm/pipeline/summary` in
  `analytics/crm-analytics.controller.ts` (group by stage, owner, team, source, type, territory, campaign, period;
  one-time and recurring measures; currency mode; deals without a rate counted, out of the converted money totals
  (organization and reporting currency) and in their own currency's totals in the deal-currency mode; deals with an
  expected close date in the past flagged "overdue to close"). Test: figures on the demo data set, including a deal
  without a rate (in the CHF total of the deal-currency mode, out of converted totals) and an overdue deal.
- [ ] **T9**. Periods: `forecast/periods.ts` (fiscal calendar from `CRM_FISCAL_PERIODS` or `fiscalStartDate`, period keys).
  Test: unit specs incl. a changed fiscal start.
- [ ] **T10**. Categories: `forecast/category.ts` (stage category, probability bands, manual override until stage change),
  `PUT /crm/deals/:id/forecast` in `forecast/crm-forecast.controller.ts` with `forecast/dto/update-deal-forecast.dto.ts`
  (category, delivery team, expected delivery start). Test: unit specs; e2e sets a delivery team and a manual category
  that a stage change clears.
- [ ] **T11**. Forecast service `forecast/crm-forecast.service.ts` (roll-up by teams or sales hierarchy, targets through
  `CRM_SALES_TARGETS` bound to the Sales app's targets or to `forecast/crm-goal-targets.adapter.ts` over core goal KPIs
  and time frames, gap) and `GET /crm/forecast` in `forecast/crm-forecast.controller.ts`. Test: roll-up with a person in
  two teams; a goal KPI target with the Sales app off.
- [ ] **T12**. Report definitions: `analytics/definitions/*.ts` for every row of spec §3.7 over deal, lead, stage and
  forecast data (the snapshot, accuracy, recurring and capacity rows are added by T28–T31), with filters, measures,
  drill-down filters and the builder's export formats and email schedules; registration with the report builder
  registry (`analytics/crm-report-definitions.registry.ts`), keyed by the `slug` of their core `report` row, which also
  takes definitions other plugins tag for CRM (a contribution with a built-in key is ignored and logged); read-only
  viewer endpoints `/cards/:key`, `/reports/:key`, `/drill/:key` in `analytics/crm-analytics.controller.ts` (the
  catalogue is the core report list); drill-down re-reads each record under the reader's rights and record rules, listing
  exactly the records the figure counts. Test: each definition returns the expected figures on the demo data set; a
  contributed duplicate key is logged and ignored; a record the reader cannot open is in neither the figure nor the
  drill-down.
- [ ] **T13**. Stage reach and conversion between stages from `crm_stage_history` (`analytics/stage-reach.ts`: distinct reach, re-entry once,
  lost option). Test: unit specs with re-entry and lost deals.
- [ ] **T14** (parallel). Time to close, won and lost deals, results per source, campaign and owner calculations
  (`analytics/metrics/*.ts`). Test: unit specs.
- [ ] **T15**. Engagement-dependent reports (first response, active leads without a deal, path from lead to customer with
  interactions and tickets; activities in the per-owner results) reading the ports of `crm-engagement` and helpdesk;
  hidden while unbound. Files: `packages/plugins/crm/src/lib/analytics/metrics/first-response.ts`,
  `analytics/metrics/active-leads.ts`, `analytics/metrics/lead-to-customer.ts`,
  `analytics/definitions/first-response-time.ts`, `analytics/definitions/active-leads-without-deal.ts`,
  `analytics/definitions/lead-to-customer-path.ts`. Test: bound and unbound.
- [ ] **T16**. Figure cache and invalidation consumer `analytics/crm-analytics-cache.ts`, debounced
  `crm.analytics.changed` hint. Test: invalidation on deal change; 60 s maximum age; two callers with the same definition and filters but different
  permitted owners get separate entries; a report over a 500 k-deal data
  set answers P95 under 2 s.
- [ ] **T17**. Daily re-rate job `schedule/crm-revalue.{scheduler,worker}.ts` with the inline fallback. Test: idempotent
  rerun.
- [ ] **T35**. Feature gate for this spec under `FEATURE_CRM`: `@FeatureFlag(FEATURE_CRM)` on every controller of
  `valuation/`, `forecast/` and `analytics/`, the schedulers of `schedule/` skip tenants with the flag off, and the CRM
  report definitions and MCP tools are not registered for them. Files:
  `packages/plugins/crm/src/lib/valuation/crm-valuation.controller.ts`, `forecast/crm-forecast.controller.ts`,
  `analytics/crm-analytics.controller.ts`, `schedule/crm-revalue.scheduler.ts`,
  `packages/plugins/crm/src/lib/specs/crm-forecasting-feature-gate.e2e.spec.ts`. Test: e2e, with the flag off every route of this spec
  answers `404` and no snapshot or re-rate job runs.

## Phase 3 — UI surfaces

- [ ] **T18**. `crm-ui` dashboard page `/pages/crm/dashboard`: default layout, period presets and comparison, owner and
  team filters, table view per chart, drill-down to saved-view lists, manual refresh and the time each figure was
  computed, refetch on the `crm.analytics.changed` hint; `CRM.ANALYTICS.*` keys in every locale. Files:
  `packages/plugins/crm-ui/src/lib/components/crm-dashboard/crm-dashboard-page.component.ts`,
  `components/crm-dashboard/crm-chart-card.component.ts`, `services/crm-analytics.service.ts`, `crm-ui.routes.ts`.
  Test: component specs; a figure refetched after the hint shows its new computed time.
- [ ] **T19**. Dashboard editing: catalogue picker (type then metric), add, remove, resize, reorder, reset, copy;
  `/crm/dashboards` routes on the core dashboard records. Files:
  `packages/plugins/crm/src/lib/analytics/crm-dashboard.service.ts`, `analytics/crm-dashboard.controller.ts`,
  `analytics/dto/update-crm-dashboard.dto.ts`,
  `packages/plugins/crm-ui/src/lib/components/crm-dashboard/crm-dashboard-editor.component.ts`,
  `components/crm-dashboard/crm-catalogue-picker.component.ts`. Test: personal copy kept; reset restores the default.
- [ ] **T20**. Forecast page `/pages/crm/forecast`: period picker, roll-up tree, categories, target and gap, entry
  history; refetch within 5 s on the `crm.analytics.changed` hint, with a refresh button. Files:
  `packages/plugins/crm-ui/src/lib/components/crm-forecast/crm-forecast-page.component.ts`,
  `components/crm-forecast/crm-forecast-tree.component.ts`, `services/crm-forecast.service.ts`. Test: component specs;
  a deal change refreshes the figures.
- [ ] **T21** (parallel). Rates page and Settings → CRM Analytics tab; deal page valuation, category and delivery team
  fields. Files: `packages/plugins/crm-ui/src/lib/components/crm-rates/crm-rates-page.component.ts`,
  `settings/crm-analytics-settings.component.ts`,
  `components/crm-deal-forecast/crm-deal-forecast-fields.component.ts`. Test: component specs.
- [ ] **T22**. CRM widgets for the existing custom dashboards
  (`packages/ui-core/shared/src/lib/dashboard/widgets/crm/crm.widgets.ts`), each with `featureKey: FEATURE_CRM`. Test:
  widget renders from `/cards/:key`; with the flag off the widget list is unchanged.
- [ ] **T23** (parallel). Phone use of the installed web app: read-only cards at 360 px that keep the last figures and
  their computed time offline; the Reports page opens CRM definitions from the "Sales" category. Files:
  `packages/plugins/crm-ui/src/lib/components/crm-dashboard/crm-phone-cards.component.ts`,
  `services/crm-offline-figures.service.ts`, `crm-ui.routes.ts`. Test: offline card spec; report link spec.
- [ ] **T36**. Read-only report viewer `/pages/crm/reports/:key` for the CRM definitions while the report builder is not
  loaded (filters, table and chart, export through the definition's formats), and the default dashboard shown without
  editing in that case. Files:
  `packages/plugins/crm-ui/src/lib/components/crm-report-viewer/crm-report-viewer.component.ts`,
  `components/crm-dashboard/crm-dashboard-page.component.ts`, `crm-ui.routes.ts`. Test: component spec with the
  builder absent: the default dashboard and a report render read-only with their filters.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T24**. `packages/mcp-server/src/lib/tools/crm-analytics.ts` read tools (`get_pipeline_summary`, `get_forecast`,
  `run_crm_report`, `get_crm_dashboard`) and `register-all-tools.ts`; `AiChatToolRegistry` registration. Test: scope rule
  applied to tool calls.
- [ ] **T25**. OpenAPI regenerated; SDK regeneration noted; user docs page; `docs/specs/README.md` row. Test: OpenAPI diff is additive; docs build.

## Phase 5 — Advanced capabilities

- [ ] **T26**. Submissions and overrides: `forecast/crm-forecast-entry.service.ts`, `/crm/forecast/submissions`,
  `/overrides`, `/entries`; roll-up uses overrides; events and manager notice; MCP `submit_forecast`,
  `override_forecast` with preview. Test: append-only history, latest current, scope refusal.
- [ ] **T27**. Snapshots: `forecast/crm-forecast-snapshot.service.ts` with the run registered as an operation type of the
  core runtime (batches as steps, resumed by the runtime), scheduler `schedule/crm-forecast-snapshot.scheduler.ts` and
  manual request (`/crm/forecast/snapshots`), retention job `schedule/crm-snapshot-retention.scheduler.ts`;
  `crm.forecast.snapshot_taken` event; snapshot reads through `forecast/snapshot-reader.ts`, which serves a stored
  roll-up only where the reader's record rules hide no deal of its scope and otherwise sums the snapshot deal rows the
  reader may read (plan §9), used by T28 and T29 as well. Test: interrupted run completes without duplicates; snapshot
  immutable; a second run for the same date is refused while one is live; one event per completed snapshot; a manager
  with `CRM_ANALYTICS_VIEW_ALL` from whom a record rule hides one deal gets roll-up, trend and accuracy figures without
  that deal, while a reader the rules hide nothing from gets the stored totals.
- [ ] **T28**. Movement and trend: `forecast/movement.ts` (new, increased, decreased, pulled in, pushed out, won, lost),
  `/crm/forecast/movement`, `/trend`, the "Changes between two snapshots" definition, pages
  (`packages/plugins/crm-ui/src/lib/components/crm-forecast-movement/crm-forecast-movement.component.ts`,
  `components/crm-forecast-trend/crm-forecast-trend.component.ts`) and MCP `compare_forecast_snapshots`,
  `get_forecast_trend`. Test: unit specs; trend of committed, probable and weighted per snapshot.
- [ ] **T29**. Accuracy: `forecast/accuracy.ts`, job `schedule/crm-forecast-accuracy.scheduler.ts` after the period-end
  snapshot with the `crm.forecast.accuracy_computed` event, `/crm/forecast/accuracy`, the "Forecast error and bias"
  definition, page `packages/plugins/crm-ui/src/lib/components/crm-forecast-accuracy/crm-forecast-accuracy.component.ts`
  and MCP `get_forecast_accuracy`. Test: error and bias per basis; one event per computed period.
- [ ] **T30**. Recurring forecast: recurring parts from deal lines, renewals from contracts and renewal deals, at-risk
  subscriptions through `CRM_SUBSCRIPTIONS`; `/crm/forecast/recurring`, the "Recurring revenue outlook" definition,
  page, MCP `get_recurring_forecast`. Files: `packages/plugins/crm/src/lib/forecast/recurring.ts`,
  `forecast/crm-forecast.controller.ts`,
  `packages/plugins/crm-ui/src/lib/components/crm-forecast-recurring/crm-forecast-recurring.component.ts`,
  `packages/mcp-server/src/lib/tools/crm-analytics.ts`. Test: run-rate normalisation.
- [ ] **T31**. Delivery capacity: `forecast/capacity.ts` (weekly limit or 12-week tracked average, approved time off, open
  task estimates), `/crm/forecast/capacity`, the "Delivery hours needed and available" definition, page
  `packages/plugins/crm-ui/src/lib/components/crm-forecast-capacity/crm-forecast-capacity.component.ts`, MCP
  `get_delivery_capacity`. Test: gap with the deals that cause it.
- [ ] **T32**. Team and organization dashboards with `CRM_DASHBOARD_MANAGE`, live refetch on the debounced hint. Files:
  `packages/plugins/crm/src/lib/analytics/crm-dashboard.service.ts`, `analytics/crm-dashboard.controller.ts`,
  `packages/plugins/crm-ui/src/lib/components/crm-dashboard/crm-dashboard-page.component.ts` (scope switch). Test:
  team dashboard visible to members; chart updates within 5 s.
- [ ] **T33**. Explanations: `/crm/forecast/explain`, `/crm/analytics/explain`, MCP `explain_forecast_change`,
  `explain_crm_figure` (structured without a provider, text with one through `CRM_TEXT_GENERATION`, usage recorded by the
  agent runtime; the figure explanation gives the definition, filters, rate rule and the records behind it). Files:
  `packages/plugins/crm/src/lib/forecast/crm-forecast-explain.service.ts`,
  `analytics/crm-figure-explain.service.ts`, `packages/mcp-server/src/lib/tools/crm-analytics.ts`. Test: names the top
  movers; a figure explanation lists its definition and records; writes nothing.
- [ ] **T34**. Demo data: weekly snapshots over one quarter, submissions, an override and a closed period in the demo seed.
  Files: `packages/plugins/crm/src/lib/seeds/crm-forecast-demo.seed.ts`, run from `onPluginRandomSeed` in
  `crm.plugin.ts`. Test: accuracy and movement pages on the demo data set.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Presence and access | T4, T35 |
| FR-2 | §3.1 Presence and access | T7, T18 |
| FR-3 | §3.1 Presence and access | T7, T12, T27 |
| FR-4 | §3.2 Deal currency and rates | T2, T6 |
| FR-5 | §3.2 Deal currency and rates | T5 |
| FR-6 | §3.2 Deal currency and rates | T6, T17 |
| FR-7 | §3.2 Deal currency and rates | T5, T6, T8, T12 |
| FR-8 | §3.2 Deal currency and rates | T6, T21 |
| FR-9 | §3.2 Deal currency and rates | T7, T21 |
| FR-10 | §3.2 Deal currency and rates | T7, T8 |
| FR-11 | §3.3 Weighted pipeline | T8 |
| FR-12 | §3.3 Weighted pipeline | T8, T30 |
| FR-13 | §3.3 Weighted pipeline | T8 |
| FR-14 | §3.4 Forecast | T9 |
| FR-15 | §3.4 Forecast | T10 |
| FR-16–FR-17 | §3.4 Forecast | T11 |
| FR-18–FR-19 | §3.4 Forecast | T26 |
| FR-20 | §3.4 Forecast | T27 |
| FR-21 | §3.4 Forecast | T27 |
| FR-22 | §3.4 Forecast | T28 |
| FR-23 | §3.4 Forecast | T29 |
| FR-24 | §3.4 Forecast | T28 |
| FR-25 | §3.4 Forecast | T30 |
| FR-26 | §3.4 Forecast | T31 |
| FR-27 | §3.4 Forecast | T10, T21 |
| FR-28 | §3.4 Forecast | T16, T20 |
| FR-29 | §3.4 Forecast | T33 |
| FR-30 | §3.5 CRM dashboard | T18 |
| FR-31 | §3.5 CRM dashboard | T19 |
| FR-32 | §3.5 CRM dashboard | T19, T32 |
| FR-33 | §3.5 CRM dashboard | T9, T18 |
| FR-34 | §3.5 CRM dashboard | T16, T18, T32 |
| FR-35 | §3.5 CRM dashboard | T12, T18 |
| FR-36 | §3.5 CRM dashboard | T12 |
| FR-37 | §3.5 CRM dashboard | T12, T36 |
| FR-38 | §3.6 Reports | T4, T12 |
| FR-39 | §3.6 Reports | T13 |
| FR-40 | §3.6 Reports | T14 |
| FR-41 | §3.6 Reports | T14 |
| FR-42 | §3.6 Reports | T14 |
| FR-43 | §3.6 Reports | T14, T15 |
| FR-44–FR-45 | §3.6 Reports | T15 |
| FR-46 | §3.6 Reports | T2, T16 |
| FR-47 | §3.7 Report definitions, cards and charts | T4, T12 |
| FR-48 | §3.8 MCP tools and assistants | T24, T26, T28–T31 |
| FR-49 | §3.8 MCP tools and assistants | T33 |
| FR-50 | §3.8 MCP tools and assistants | T26, T27, T29 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off for existing tenants; enabling it in dev shows the feature end to end; with it off the
  Reports page, custom dashboards and pipeline and deal pages behave exactly as before (spec AC-18).
- Constitution gates in `spec.md` §9 confirmed.
- Every definition of spec §3.7 returns the expected figures on the demo data set and exports.
- Scope rule verified: a user without `CRM_ANALYTICS_VIEW_ALL` receives only figures of records they own and of the
  teams they manage, never those of an unrelated owner, through REST, MCP, drill-down or the figure cache.
- Performance budgets of spec §4 measured on a 500 k-deal data set.
