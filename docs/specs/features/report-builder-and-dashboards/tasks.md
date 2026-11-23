# Task Breakdown: Report builder and dashboards

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `report-builder-and-dashboards`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind `GAUZY_REPORT_BUILDER_ENABLED` and `FEATURE_REPORT_BUILDER`: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it. `rb/` means
  `packages/plugins/report-builder/src/lib/`, `ui/` means `packages/ui-core/shared/src/lib/report-builder/`, `rbui/` means
  `packages/plugins/report-builder-ui/src/lib/`.
- Phases 1 to 4 deliver plan phase 1; Phase 5 delivers plan phase 2 (depth); Phase 6 plan phase 3 (advanced).
- Needs: the core record type registry (`custom-fields-and-forms` T2) and `RECORD_VIEWS_QUERY` (`record-views-and-search`
  T8, T22) for record-type datasets (Phase 5). Phases 1 to 4 need neither.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts `packages/contracts/src/lib/report-builder.model.ts` (dataset, field, measure, dimension,
  parameter, definition document, chart, card, dashboard template, run, result page, drill token, schedule, provider and
  port interfaces); export from `packages/contracts/src/index.ts`. Test: definition document schema validation spec.
- [ ] **T2**. `PluginContributions.reports` (`datasets`, `definitions`, `dashboardTemplates`) in
  `packages/plugin/src/lib/plugin-contributions.ts` and `PluginReportRegistry` in
  `packages/core/src/lib/plugin-contributions/plugin-report.registry.ts` beside the permission, feature and setting
  registries of `plugin-contribution.registry.ts`; helpers
  `registerReportDatasets`, `registerReportDefinitions`, `registerDashboardTemplates`; duplicate keys refused and
  listed in the contributions report. Test: registry spec (duplicates, versions, lookup by catalogue slug).
- [ ] **T3**. Plugin scaffold `packages/plugins/report-builder` (package, project, tsconfig, jest, eslint),
  `rb/report-builder-enabled.ts` (exact `true`); `PluginContributions` on `@GauzyCorePlugin`:
  `rb/report-builder.features.ts` (`FEATURE_REPORT_BUILDER`), `rb/report-builder.permissions.ts` (with `defaultFor`),
  `rb/report-builder.settings.ts` (`reports.maxSchedulesPerUser`, 50); `apps/api/src/plugins.ts`,
  `apps/worker/src/plugins.ts`; `.env.sample`. Test: flag and contribution specs; plugin list specs.
- [ ] **T4**. Entities `rb/entities/` (`report-definition.entity.ts`, `report-definition-version.entity.ts`,
  `report-measure.entity.ts`, `report-user-setting.entity.ts`, `report-run.entity.ts`, `report-snapshot.entity.ts`,
  `report-snapshot-row.entity.ts`, `report-schedule.entity.ts`, `report-schedule-run.entity.ts`,
  `report-delivery.entity.ts`, `report-dashboard-setting.entity.ts`, `report-dashboard-user-layout.entity.ts`,
  `report-home.entity.ts`) and migrations `rb/database/migrations/1791000037100-CreateReportDefinitionTables.ts`,
  `1791000037110-CreateReportRunTables.ts`, `1791000037120-CreateReportSnapshotTables.ts`,
  `1791000037130-CreateReportScheduleTables.ts`, `1791000037140-CreateReportDashboardTables.ts` on the shared core
  migration helpers (`@gauzy/core`, `procurement` T4), no copy in the plugin. Test: migration specs on SQLite (up twice); mapping under both ORMs. Migration timestamps: `1791000037100` to `1791000037199` (`packages/plugins/report-builder`).
- [ ] **T5**. Seed `rb/database/migrations/1791000037160-SeedPlatformReportCatalogue.ts` with its "Platform" category keyed `FEATURE_REPORT_BUILDER` in
  the shared catalogue feature filter (T51); default grants through `defaultFor` (no permission seed). Test: idempotent seed; grants present on a new tenant
  and after the permission reload; `REPORT_SCHEDULE_EXTERNAL` granted to no role; with the feature off the Reports page,
  menu and a new organization's report switches equal today's.
- [ ] **T51**. Shared catalogue feature filter, one for every feature that adds rows to the core report catalogue
  (safe from any feature): core migration
  `packages/core/src/lib/database/migrations/1791000037900-AddReportCategoryFeatureKey.ts` (nullable `featureKey`
  varchar(64) on `report_category` and on `report`, null for every existing row) and the filter in
  `packages/core/src/lib/reports/report.service.ts` (`findAllReports`, `getMenuItems`), `report-category.service.ts`
  and `report-organization.service.ts` (`bulkCreateOrganizationReport`), which leave out categories and rows whose
  feature is off for the tenant (spec FR-90); no dependency on this plugin or its flag. Test: with every keyed feature
  off the Reports page, menu and a new organization's report switches equal today's; a row keyed apart from its
  category follows its own key; rows without a key are listed as today.
  Migration timestamps: `1791000037900` to `1791000037999` (`packages/core`).

## Phase 2 — Services, endpoints, events

- [ ] **T6**. `rb/access/report-access.service.ts`: access context (organizations, employee visibility, scope values),
  `accessHash`, field masks from `CUSTOM_FIELD_METADATA`, `@VisibleWith` metadata and dataset `sensitive`. Test: a masked
  column is removed before execution; a filter on it is refused with `REPORT_FIELD_MASKED`.
- [ ] **T7**. `rb/engine/` (`query-planner.ts`, `provider-runner.ts`, `post-processor.ts`): query planner, provider
  runner, post-processor (formula columns through `@gauzy/utils`,
  grouping with subtotals, totals per currency, sorting, paging up to 200,000 rows). Test: post-processor specs on fixed
  rows; formula error leaves the cell empty and is listed.
- [ ] **T8**. Existing-report providers `rb/existing/` (one `<report>.provider.ts` per report, `existing-definitions.ts`)
  for the eleven reports over the services and query handlers their routes call
  (time and activity, weekly, apps and URLs, manual time edits, expense, amounts owed, payments, weekly and daily limits,
  project and client budgets); system definitions and catalogue slugs. Test: consistency spec per report against its route
  on seeded data.
- [ ] **T9**. `SavedReportVariantStore` over `saved_report` (variants of `time-activity`, public link untouched). Files:
  `rb/existing/saved-report-variant.store.ts`, `packages/core/src/lib/saved-report/saved-report.service.ts` (read). Test:
  round trip with the saved-report routes; public link still answers.
- [ ] **T10**. Definition service and controller: CRUD, versions, `If-Match`, clone, apply base, catalogue with
  favourites and recents from T18 and shared definitions from `RECORD_SHARES`; GraphQL reads. Files:
  `rb/definitions/report-definition.service.ts`, `rb/definitions/report-definition.controller.ts`,
  `rb/definitions/dto/report-definition.dto.ts`, `rb/definitions/report-catalogue.service.ts`,
  `rb/graphql/schema-extensions.ts`, `rb/graphql/report-builder.resolver.ts`. Test: e2e (permissions,
  `404` with the feature off, conflict on stale save, locked refused).
- [ ] **T11**. Run controller: `run`, `preview`, `runs` (background status from the core operation), cancel, result
  download; `report_run` log rows for every mode, each with one `AUDIT_EVENT_SINK` event pointing at it. Files:
  `rb/runs/report-run.controller.ts`, `rb/runs/report-run.service.ts`, `rb/runs/report-run-log.writer.ts`. Test: e2e;
  restricted reader gets per-reader rows and totals; the sink receives one event per log row.
- [ ] **T12**. Exports `rb/export/` (`csv.writer.ts`, `xlsx.writer.ts`, `pdf.writer.ts`, `json.writer.ts`,
  `report-export.controller.ts`): CSV writer, XLSX through `exceljs` (styled header, totals, formats, frozen header,
  sheet per group), PDF through `REPORT_PRINT` or `pdfmake`, JSON; `spreadsheet-safe-row.ts` on every cell. Test: file
  contents equal the viewer page; formula-like cells neutralised.
- [ ] **T13**. Events `report_definition.*`, `report_run.*` declared with `SubscriptionCatalogue`; notification categories
  through `registerNotificationCategories`. Files: `rb/events/report-builder.events.ts`,
  `rb/events/report-builder-notification-categories.ts`. Test: payloads carry ids only.
- [ ] **T53**. Labels per language (FR-40): definitions, columns, prompts and categories keep labels per language
  (`labels` of the definition document and of shipped definitions) and every surface shows the reader's language with
  the default language as fallback. Files: `rb/definitions/definition-labels.ts`, `rb/definitions/report-catalogue.service.ts`.
  Test: a definition labelled in two languages shows each reader their own; a missing translation falls back to the
  default language.
- [ ] **T54**. Run cache (FR-61): identical runs are answered from a cache keyed by definition, prompts and the
  reader's `accessHash` for 60 seconds, dropped when an invalidating event of the dataset arrives. Files:
  `rb/engine/run-cache.ts`, `rb/runs/report-run.service.ts`. Test: a second identical run within 60 s does not reach
  the provider; a reader with another access hash is not served the cached page; an invalidating event drops the entry.

## Phase 3 — UI surfaces

- [ ] **T14**. `packages/plugins/report-builder-ui` scaffold: routes `/pages/reports/library`, `/pages/reports/view/:key`,
  menu entries, hidden on `404`, i18n keys `REPORT_BUILDER.*` in every locale. Files: `rbui/report-builder-ui.plugin.ts`,
  `rbui/report-builder-ui.routes.ts`, `rbui/pages/library/library-page.component.ts`,
  `packages/ui-core/i18n/assets/i18n/*.json`. Test: rendering specs; hidden when off.
- [ ] **T15**. `ui/` embeddables `ngx-report-table`, `ngx-report-chart` (chart.js with table alternative and text
  summary), `ngx-report-card`. Files: `ui/report-table/report-table.component.ts`,
  `ui/report-chart/report-chart.component.ts`, `ui/report-card/report-card.component.ts`. Test: rendering specs; keyboard and screen-reader summary spec.
- [ ] **T16**. Viewer page: prompts, sort, hide and reorder columns, search in result, export menu, side panel,
  per-user settings (`report_user_setting`). Files: `rbui/pages/viewer/viewer-page.component.ts`,
  `rbui/pages/viewer/result-side-panel.component.ts`, `rb/definitions/report-user-setting.service.ts`. Test: settings round trip across sessions.
- [ ] **T17**. Canvas: widget `report-card` in category `reports` (`WidgetCategory` member added), definition and visual
  picker, templates gallery from the built-in dashboards; "Open in report builder" action on the existing report pages.
  Files: `packages/ui-core/core/src/lib/services/widget/widget-registry.types.ts` (`WidgetCategory`),
  `rbui/widgets/report-card-widget.component.ts`, `rbui/widgets/report-card-picker.component.ts`,
  `rbui/pages/dashboard-templates/dashboard-templates.component.ts`. Test: existing widgets render unchanged; template
  copy creates a dashboard.
- [ ] **T18** (parallel). Definitions as a platform record type: `BaseEntityEnum.ReportDefinition`, favourites through
  core `favorite` (`GlobalFavoriteService`), recently run through `employee_recent_visit`, `ReportDefinition` and
  `Dashboard` registered for the share dialog and `RECORD_SHARES` of `access-control-and-security`. Files:
  `packages/contracts/src/lib/base-entity.model.ts` (`BaseEntityEnum`), `rb/report-builder.record-types.ts`,
  `rb/definitions/report-catalogue.service.ts`. Test: catalogue
  favourites and recents come from the core tables; a definition shared with a team is listed for its members; without
  the share port only private and organization-wide definitions are offered.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T19**. MCP `packages/mcp-server/src/lib/tools/report-builder.ts`: `reports_list_datasets`, `reports_list_definitions`, `reports_run`,
  `reports_export`; `register-all-tools.ts`. Test: tool specs against a mocked API.
- [ ] **T20**. Port bindings in `apps/api/src/plugin-composition.ts`: `REPORT_RUNS`, `REPORT_CARDS` (also as
  `AUTOMATION_REPORT_CARDS`), `RECORD_VIEWS_REPORTS`. Test: composition spec with each plugin absent.
- [ ] **T21**. OpenAPI regenerated; SDK regeneration noted; docs site pages (registration contract for plugin authors);
  `docs/specs/README.md` row. Test: OpenAPI diff additive only.

## Phase 5 — Depth (plan phase 2)

- [ ] **T22**. Record-type datasets: dataset descriptors from the core registry, `RECORD_VIEWS_QUERY.compile`,
  `AggregateQueryBuilder` (TypeORM and MikroORM) with per-dialect date grains, custom fields as `cf.<key>`
  fields of the core query protocol, one-hop references, child collections. Files: `rb/datasets/record-type-dataset.ts`,
  `rb/engine/aggregate-query.builder.ts`, `rb/engine/date-grains.ts`. Test: ORM parity spec; dialect spec for grains; read
  scope applied.
- [ ] **T23**. Builder page `…/builder/new` and `…/builder/:key`: dataset picker, field tree, measures, saved-view filter
  builder, prompts, formulas, preview of 100 rows, start from a saved view. Files:
  `rbui/pages/builder/builder-page.component.ts`, `rbui/pages/builder/field-tree.component.ts`,
  `rb/definitions/report-preview.controller.ts`. Test: rendering and keyboard specs; invalid
  field flagged.
- [ ] **T24**. Prompts and validation: pickers limited to readable values, relative dates, required prompts. Files:
  `rb/definitions/definition-validator.ts`, `rb/prompts/prompt-values.service.ts`. Test:
  unreadable prompt value refused.
- [ ] **T25**. Grouping (three levels), pivot (`ngx-report-pivot`, 50 columns then "Others"), top N, running totals,
  shares, conditional formatting. Files: `rb/engine/pivot.ts`, `rb/engine/grouping.ts`, `rb/engine/conditional-format.ts`,
  `ui/report-pivot/report-pivot.component.ts`. Test: figures on seeded data.
- [ ] **T26**. Comparisons (previous period, a year earlier, fixed range) and currency conversion through
  `REPORT_FX_RATES`. Files: `rb/engine/comparisons.ts`, `rb/engine/currency-conversion.ts`. Test: missing rate named, no partial total.
- [ ] **T27**. Charts: every chart type of spec FR-31, time and group charts, metric cards with change and colour rules;
  heatmap through `chartjs-chart-matrix` lazily. Files: `ui/report-chart/chart-types.ts`,
  `ui/report-card/metric-card.component.ts`, `rb/engine/time-series.ts`. Test: chart specs per type; gaps filled with zero.
- [ ] **T28**. Dashboards: `report_dashboard_setting`, filter bar, cross-filter, card opt-out, personal layout, sharing
  through `RECORD_SHARES`, home dashboards (a user's own through `dashboard.isDefault` in `dashboard.service.ts`, role
  defaults in `report_home`), wall display; existing dashboards keep today's readers. Files:
  `rb/dashboards/dashboard-settings.service.ts`, `rb/dashboards/dashboard-settings.controller.ts`,
  `rb/dashboards/report-home.service.ts`, `packages/core/src/lib/dashboard/dashboard.service.ts`,
  `rbui/dashboards/filter-bar.component.ts`. Test: per-reader figures on a
  shared dashboard; personal layout does not change others'; a user's own default wins over the role's; a dashboard
  created before the feature is listed for the same users with the feature on.
- [ ] **T29**. Background runs: operation `report-builder.run`, automatic heavy detection, partitions as child operations
  (`parentOperationId`, `deadlineAt`), merge as a step, results in file storage, results and run log declared as
  retention kinds through `RETENTION_SOURCES`, `report-builder.expire`. Files: `rb/runs/report-builder-run.operation.ts`,
  `rb/runs/run-partitions.ts`, `rb/runs/report-builder-expire.job.ts`. Test: partitioned result equals the live one;
  timed out after the limit; stalled run expired; no status kept outside the operation.
- [ ] **T30**. Large exports in the background with an inbox link; 1,000,000-row limit. Files:
  `rb/export/background-export.operation.ts`. Test: 200,000-row export spec.
- [ ] **T31**. Schedules: entities service and controller, recurrence in a time zone through the core recurrence module
  `packages/core/src/lib/recurrence/` of `business-document-engine` T62 and its period claim (weekday and custom rules
  added there), `report-builder.schedule-tick`, per-recipient runs, formats, "skip when empty", row limit,
  introduction, test send, outside addresses with `REPORT_SCHEDULE_EXTERNAL`. Files:
  `rb/schedules/report-schedule.service.ts`, `rb/schedules/report-schedule.controller.ts`,
  `rb/schedules/report-builder-schedule-tick.job.ts`. Test: next-run computation across DST;
  per-recipient access; invoice schedule specs unchanged.
- [ ] **T32**. Deliveries: `report-builder.deliver`, email through `REPORT_EMAIL` or core email (row in `email_sent`),
  internal recipients through an inbox item and the Inbox plugin's `inbox_delivery` (its retries and preferences) when
  loaded, else `NOTIFICATION_DISPATCHER`; `report_delivery` keeps the outcome with `inboxItemId` or `emailSentId`;
  deduplication per recipient, failures, pause after three failed runs, owner leaving. Files:
  `rb/schedules/report-delivery.service.ts`, `rb/schedules/report-builder-deliver.worker.ts`. Test: retried run sends once;
  paused schedule notifies the owner.
- [ ] **T33**. Minimum group size and sensitive columns in viewer, export, card and schedule. Files:
  `rb/access/min-group-size.ts`, `rb/engine/post-processor.ts`. Test: "fewer than 5" shown
  everywhere; drill refused for that group.
- [ ] **T34** (parallel). Platform providers and definitions of spec FR-87 over the sources named in plan §3 (operations
  and the run log, the plugin contribution registries, `job_execution` and `job_dead_letter`, `employee_notification`,
  `email_sent`, sessions and login attempts, users and `employee.kind`, the core address book, tasks) with totals cards
  from `StatsService`, and the Administration dashboard template. Files: `rb/platform/` (one `<report>.provider.ts` per
  report of FR-87), `rb/platform/platform-definitions.ts`, `rb/platform/administration-dashboard.template.ts`. Test: figures on seeded data.
- [ ] **T35** (parallel). `RECORD_VIEWS_REPORTS`: save a view as a report, cards for the dashboard layout, pin a view to
  a dashboard. Files: `rb/ports/record-views-reports.provider.ts`. Test: hidden when record-views is absent.
- [ ] **T36** (parallel). Automation action `report.send` through `registerAutomationActions`; `report_schedule.*` events.
  Files: `rb/automation/report-send.action.ts`, `rb/events/report-builder.events.ts`. Test: a flow sends a pack once
  per run key.
- [ ] **T37** (parallel). Impact analysis contribution to custom fields (definitions, cards, schedules using a field).
  Files: `rb/ports/custom-field-usage.contributor.ts`. Test: an archived field lists its definitions.
- [ ] **T38**. Access log page (Settings → Reports) and runs page. Files: `rbui/pages/access-log/access-log.component.ts`,
  `rbui/pages/runs/runs-page.component.ts`, `rb/runs/access-log.controller.ts`. Test: entries for run, export, print, delivery.
- [ ] **T39**. MCP `reports_schedule_create` (preview). Files: `packages/mcp-server/src/lib/tools/report-builder.ts`. Test: preview lists recipients and next runs without saving.
- [ ] **T52**. Print settings of a definition (FR-24): the default print template and letterhead of a definition, offered
  only while print templates are loaded and used by its print and scheduled PDF. Files:
  `rb/definitions/report-print-settings.ts`, `rbui/pages/builder/print-settings.component.ts`. Test: the chosen template
  and letterhead are used by print; without the print plugin the setting is not offered and print is a plain table.
- [ ] **T55**. Chart and card images (FR-73): a holder of `REPORT_EXPORT` exports a chart or card as an image and its
  data as CSV. Files: `ui/report-chart/report-chart-export.service.ts`, `rb/export/card-data.export.ts`. Test: the image
  has the chart's size and title; the CSV holds the card's figures under the reader's access.

## Phase 6 — Advanced capabilities (plan phase 3)

- [ ] **T40**. Semantic layer: dataset measures and dimensions in descriptors, `report_measure` (calculated measures,
  bucketed dimensions), certification and inline-redefinition warning, usage list, delete refused when used, measures page.
  Files: `rb/measures/report-measure.service.ts`, `rb/measures/report-measure.controller.ts`,
  `rbui/pages/measures/measures-page.component.ts`. Test: one certified measure gives one figure on three definitions
  and a card.
- [ ] **T41**. Drill-down: drill tokens on every cell, total, point and card; record-type drill through
  `RECORD_VIEWS_SELECTION` to a filtered list; provider `drill()`; MCP `reports_drill`. Files:
  `rb/drill/drill-token.ts`, `rb/drill/drill.controller.ts`, `packages/mcp-server/src/lib/tools/report-builder.ts`. Test: drilled count equals the
  figure; restricted reader drills only to readable records.
- [ ] **T42**. Live figures: `subscriber:report-builder-live`, cache drop, coalesced hints `report-dataset:<key>`, client
  refetch of affected cards, highlight and freeze. Files: `rb/live/report-builder-live.consumer.ts`,
  `ui/report-card/report-card-live.service.ts`. Test: two-client spec within 3 seconds.
- [ ] **T43**. Aggregate snapshots: `report_snapshot*`, covered-query check, additive partials by `scopeKey`, refresh
  jobs and dirty periods from events, "as of" in the viewer. Files: `rb/snapshots/report-snapshot.service.ts`,
  `rb/snapshots/report-snapshot.controller.ts`, `rb/snapshots/snapshot-refresh.job.ts`. Test: covered run equals the live result; uncovered goes
  live; reader filtered by scope.
- [ ] **T44**. Plain-language drafting: `interpret` route through `REPORT_ASSISTANT`, catalogue-only prompt, draft shown
  in the builder with explanations, MCP `reports_draft_from_text`. Files: `rb/assistant/report-interpreter.service.ts`,
  `packages/mcp-server/src/lib/tools/report-builder.ts`. Test: the provider payload holds no record data.
- [ ] **T45**. Commentary and review: `report-builder.commentary`, figures-only payload, claim links, review in the
  owner's inbox for 24 hours. Files: `rb/assistant/report-commentary.service.ts`. Test: payload spec; review hold and timeout.
- [ ] **T46**. "Explain this figure": driver analysis by dimension against the comparison period, worded by the
  assistant; MCP `reports_explain_figure`. Files: `rb/assistant/explain-figure.service.ts`,
  `packages/mcp-server/src/lib/tools/report-builder.ts`. Test: drivers on seeded data sum to the change.
- [ ] **T47**. Conditional schedules (measure condition as core `rule` rows of owner type `REPORT_SCHEDULE`, evaluated by
  `rule.evaluator.ts`; skipped runs recorded). Files: `rb/schedules/schedule-condition.ts`,
  `packages/contracts/src/lib/rule.model.ts` (`REPORT_SCHEDULE`). Test: below-threshold run skipped.
- [ ] **T48**. Benchmarks: grouped runs over one million rows on PostgreSQL and MySQL, 12-card dashboard, 1,000,000-row
  export. Files: `rb/benchmarks/report-builder.bench.ts`. Test: report attached to the PR.
- [ ] **T49**. Shared catalogue feature filter: built by T51 (Phase 1, `packages/core/src/lib/reports/`); its tests
  are T51's.
- [ ] **T50**. Provide the ports other features bind to (plan, **Consumer tokens answered**): `DOCUMENT_REPORTS`, `PRINT_REPORTS`, `REPORT_SCHEDULES`, `TAX_PACK_SCHEDULES`. Files: `apps/api/src/plugin-composition.ts`. Test: one contract test per token over the shape its consumer plan states; with this feature off each consumer keeps its stated fallback.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Scope, flags and compatibility | T3, T10, T14, T19 |
| FR-2 | §3.1 Scope, flags and compatibility | T9, T17, T28 |
| FR-3 | §3.1 Scope, flags and compatibility | T21 |
| FR-4 | §3.2 Datasets and the definition registry | T22 |
| FR-5 | §3.2 Datasets and the definition registry | T1, T2 |
| FR-6 | §3.2 Datasets and the definition registry | T2 |
| FR-7 | §3.2 Datasets and the definition registry | T2, T10 |
| FR-8 | §3.2 Datasets and the definition registry | T8 |
| FR-9 | §3.2 Datasets and the definition registry | T9 |
| FR-10 | §3.2 Datasets and the definition registry | T2, T17 |
| FR-11 | §3.2 Datasets and the definition registry | T10, T18 |
| FR-12 | §3.2 Datasets and the definition registry | T10 |
| FR-13–FR-16 | §3.3 Semantic layer (advanced) | T40 |
| FR-17 | §3.4 Builder: columns, filters and prompts | T10, T23 |
| FR-18 | §3.4 Builder: columns, filters and prompts | T22, T23 |
| FR-19 | §3.4 Builder: columns, filters and prompts | T22 |
| FR-20 | §3.4 Builder: columns, filters and prompts | T23 |
| FR-21–FR-22 | §3.4 Builder: columns, filters and prompts | T24 |
| FR-23 | §3.4 Builder: columns, filters and prompts | T7, T23 |
| FR-24 | §3.4 Builder: columns, filters and prompts | T52 |
| FR-25–FR-27 | §3.5 Grouping, pivot, totals and comparisons | T25 |
| FR-28–FR-29 | §3.5 Grouping, pivot, totals and comparisons | T26 |
| FR-30 | §3.5 Grouping, pivot, totals and comparisons | T25 |
| FR-31–FR-33 | §3.6 Charts and metric cards | T27 |
| FR-34 | §3.6 Charts and metric cards | T15, T28 |
| FR-35 | §3.7 Viewer | T16 |
| FR-36–FR-37 | §3.7 Viewer | T16 |
| FR-38 | §3.7 Viewer | T43 |
| FR-39 | §3.7 Viewer | T7, T16 |
| FR-40 | §3.7 Viewer | T53 |
| FR-41 | §3.8 Dashboards | T17 |
| FR-42 | §3.8 Dashboards | T28 |
| FR-43 | §3.8 Dashboards | T28, T41 |
| FR-44 | §3.8 Dashboards | T18, T28 |
| FR-45–FR-46 | §3.8 Dashboards | T28 |
| FR-47 | §3.8 Dashboards | T2, T17, T28 |
| FR-48 | §3.8 Dashboards | T28 |
| FR-49 | §3.8 Dashboards | T20, T35 |
| FR-50 | §3.9 Sharing and access enforced by the engine (advanced) | T18 |
| FR-51 | §3.9 Sharing and access enforced by the engine (advanced) | T6, T18, T41 |
| FR-52 | §3.9 Sharing and access enforced by the engine (advanced) | T6 |
| FR-53 | §3.9 Sharing and access enforced by the engine (advanced) | T33 |
| FR-54 | §3.9 Sharing and access enforced by the engine (advanced) | T6 |
| FR-55 | §3.9 Sharing and access enforced by the engine (advanced) | T11, T38 |
| FR-56 | §3.10 Background runs, snapshots and performance | T29 |
| FR-57 | §3.10 Background runs, snapshots and performance | T11 |
| FR-58–FR-59 | §3.10 Background runs, snapshots and performance | T29 |
| FR-60 | §3.10 Background runs, snapshots and performance | T43 |
| FR-61 | §3.10 Background runs, snapshots and performance | T54 |
| FR-62–FR-63 | §3.11 Schedules and delivery | T31 |
| FR-64 | §3.11 Schedules and delivery | T47 |
| FR-65 | §3.11 Schedules and delivery | T31, T32 |
| FR-66 | §3.11 Schedules and delivery | T32 |
| FR-67–FR-68 | §3.11 Schedules and delivery | T31, T32 |
| FR-69–FR-70 | §3.12 Exports and print | T12 |
| FR-71 | §3.12 Exports and print | T30 |
| FR-72 | §3.12 Exports and print | T12 |
| FR-73 | §3.12 Exports and print | T55 |
| FR-74–FR-75 | §3.13 Drill-down, plain language, live updates and commentary (advanced) | T41 |
| FR-76 | §3.13 Drill-down, plain language, live updates and commentary (advanced) | T44 |
| FR-77 | §3.13 Drill-down, plain language, live updates and commentary (advanced) | T42 |
| FR-78–FR-79 | §3.13 Drill-down, plain language, live updates and commentary (advanced) | T45 |
| FR-80 | §3.13 Drill-down, plain language, live updates and commentary (advanced) | T46 |
| FR-81 | §3.14 API, MCP, events and other engines | T10, T11 |
| FR-82 | §3.14 API, MCP, events and other engines | T19, T39, T41, T44 |
| FR-83 | §3.14 API, MCP, events and other engines | T13, T36 |
| FR-84 | §3.14 API, MCP, events and other engines | T20, T36 |
| FR-85 | §3.14 API, MCP, events and other engines | T35 |
| FR-86 | §3.14 API, MCP, events and other engines | T37 |
| FR-87–FR-88 | §3.15 Platform reports and the administration dashboard | T34 |
| FR-89 | §3.15 Platform reports and the administration dashboard | T5 |
| FR-90 | §3.15 Platform reports and the administration dashboard | T51 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off; enabling it in dev shows the feature end to end.
- Constitution gates in `spec.md` §9 confirmed.
- Feature checks: the eleven reports give the same figures through the builder as through their pages; a restricted
  reader never sees an unreadable row or a masked column in a run, total, card, drill, export, snapshot or delivery;
  deliveries go once per recipient and period; the performance budgets of spec §4 hold; with `FEATURE_REPORT_BUILDER` off
  every new route answers `404` and reports, saved reports and dashboards behave as before (AC-16); the catalogue
  entries and dashboard readers follow AC-17.
