# Task Breakdown: Business document engine

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `business-document-engine`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold. A spec file named in a `Test:` clause without a full path sits under the `src/lib/` folder of the package the task changes (beside the file it tests).
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind `FEATURE_BUSINESS_DOCUMENTS`: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it. Paths are relative to the repository
  root; `bd/` means `packages/plugins/business-documents/src/lib/`, `bdui/` means
  `packages/plugins/business-documents-ui/src/lib/`.
- Gate: every route, GraphQL field, menu entry, job, consumer and MCP tool of these tasks is gated by
  `FEATURE_BUSINESS_DOCUMENTS` (`@FeatureFlag` + `FeatureFlagGuard`); the core tasks T61 and T62 carry no gate and keep
  today's behaviour; the core `/api/sequences` routes stay available under `SEQUENCES_VIEW` / `SEQUENCES_EDIT` whatever
  the flag; the numbering page (new, behind the flag like every menu entry here) lists plain core sequences under
  `SEQUENCES_VIEW` beside the document series.
- Plan phase 1 is T1 to T17 with T41 (numbering screen over every core sequence), T61 and T62; phase 2 is T18 to T33 with T42; phase 3
  is T34 to T40 with T43 to T47; phase 4 (advanced) is T48 to T55; T56 to T59 belong to phase 2.
- Owners register their types in their own specs' tasks; T17 gives them the contract-test kit first.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts `packages/contracts/src/lib/business-document.model.ts` (enums, registration, adapter, engine
  facade, snapshot, finding, event, series, number, link, roll-up, tolerance, change set, totals, recurrence, bulk run,
  flow, effects); `RuleOwnerType` gains `DOCUMENT_SERIES`, `DOCUMENT_RECURRENCE_SKIP`; export from `index.ts`. Files:
  `packages/contracts/src/lib/business-document.model.ts`, `packages/contracts/src/lib/rule.model.ts`,
  `packages/contracts/src/lib/recurrence.model.ts` (new: `IRecurrenceRule` and its enums), `packages/contracts/src/index.ts`. Test:
  `packages/contracts/src/lib/business-document.model.spec.ts`, contract compile spec and enum snapshot.
- [ ] **T2**. Plugin scaffold `packages/plugins/business-documents` (package, project, tsconfig, jest, eslint,
  `business-documents.plugin.ts`, `business-documents.module.ts`), feature contribution `FEATURE_BUSINESS_DOCUMENTS`
  (default off) in `bd/business-documents.features.ts`, setting contributions in `bd/business-documents.settings.ts`
  (change-set expiry, price tolerance, series pick, `businessDocuments.typePolicies` at `ORGANIZATION` scope), path mapping,
  `apps/api/src/plugins.ts` entry. Files: `packages/plugins/business-documents/{package.json,project.json,tsconfig.json,jest.config.ts,eslint.config.cjs,src/index.ts}`,
  `bd/{business-documents.plugin.ts,business-documents.module.ts,business-documents.features.ts,business-documents.settings.ts,business-documents.types.ts}`,
  `tsconfig.json`, `apps/api/src/plugins.ts`. Test: `bd/business-documents.plugin.spec.ts` plugin list spec; flag off → routes `404`; owners' numbering and statuses unchanged.
- [ ] **T3**. Permissions `bd/business-documents.permissions.ts` (eleven keys with labels, groups and `defaultFor`;
  series and counters use the core `SEQUENCES_VIEW` / `SEQUENCES_EDIT`). Files: `bd/business-documents.permissions.ts`.
  Test: `bd/business-documents.permissions.spec.ts` catalogue spec.
- [ ] **T4**. Plugin migration set `bd/database/migrations/` on the shared core migration helpers of `procurement` T4 (`@gauzy/core`), no copy in the plugin. Files: `bd/database/migrations/index.ts`, `bd/database/business-documents-migrations.ts`. Test: `bd/database/business-documents-migrations.spec.ts`, an empty migration run on SQLite. Migration timestamps: `1791000070100` to `1791000070199` (`packages/plugins/business-documents`).
- [ ] **T5**. Entities and MikroORM repositories `bd/entities/` for document, line, line roll-up, link (with
  `ownerLinkId`); migration `CreateBusinessDocumentIndexTables`. Files:
  `bd/entities/{business-document.entity.ts,business-document-line.entity.ts,business-document-line-rollup.entity.ts,business-document-link.entity.ts,index.ts}`,
  `bd/repositories/` (`type-orm-` and `mikro-orm-` repository per entity),
  `bd/database/migrations/1791000070100-CreateBusinessDocumentIndexTables.ts`. Test:
  `bd/database/create-business-document-index-tables.migration.spec.ts` on SQLite (up twice), `bd/entities/business-document.entities.spec.ts` mapping spec for both ORMs.
- [ ] **T6** (parallel). Entities series and number; migration `CreateBusinessDocumentNumberingTables`. Files:
  `bd/entities/{business-document-series.entity.ts,business-document-number.entity.ts}` with their repositories in
  `bd/repositories/`, `bd/database/migrations/1791000070110-CreateBusinessDocumentNumberingTables.ts`. Test:
  `bd/database/create-business-document-numbering-tables.migration.spec.ts`, migration and unique-index specs.
- [ ] **T7** (parallel). Entities tolerance, change set (`openKey`), totals; migration
  `CreateBusinessDocumentControlTables`. Files: `bd/entities/{business-document-tolerance.entity.ts,business-document-change-set.entity.ts,business-document-totals.entity.ts}`
  with their repositories, `bd/database/migrations/1791000070120-CreateBusinessDocumentControlTables.ts`. Test:
  `bd/database/create-business-document-control-tables.migration.spec.ts`: one-open-change-set uniqueness on three dialects.
- [ ] **T8** (parallel). Entities recurrence, recurrence run, bulk item (keyed by the core `operationId`); migration
  `CreateBusinessDocumentAutomationTables`. Files: `bd/entities/{business-document-recurrence.entity.ts,business-document-recurrence-run.entity.ts,business-document-bulk-item.entity.ts}`
  with their repositories, `bd/database/migrations/1791000070130-CreateBusinessDocumentAutomationTables.ts`. Test:
  `bd/database/create-business-document-automation-tables.migration.spec.ts`.
- [ ] **T9**. Default role grants through the permission contributions' `defaultFor` (no migration); existing tenants
  through the platform permission reload. Files: `bd/business-documents.permissions.ts`. Test: `bd/business-documents.permissions.spec.ts`: grants per role on a new tenant and after a reload.
- [ ] **T61**. Core: `SequenceService.allocateWithin(manager, key, options)` (lock or compare-and-swap on the caller's
  transaction) and `advanceSeries(id, nextValue)` (forward only) in `packages/core/src/lib/sequence/sequence.service.ts`;
  `POST /sequences/:id/advance` and the `keyPrefix` filter in `sequence.controller.ts`; optional
  `SEQUENCE_COUNTER_GUARD` token consulted by `advanceSeries` and `resetSeries`. Files:
  `packages/core/src/lib/sequence/{sequence.service.ts,sequence.controller.ts,sequence-counter-guard.ts,dto/}`. Test:
  `packages/core/src/lib/sequence/sequence.service.spec.ts`, `sequence.service.orm-parity.spec.ts`: rollback returns
  the value, advance refused at or below the current value and for a guarded key; existing allocation and
  administration specs (`sequence.administration.spec.ts`) unchanged.
- [ ] **T62**. Core recurrence module `packages/core/src/lib/recurrence/` lifted from `invoice-schedule.rules.ts`
  (day-key periods, re-exports kept in `invoice-schedule.rules.ts`), extended with daily, quarterly, half-yearly and
  yearly cadences, intervals and last-day rules, plus the run helper (claim before create, author permission re-read,
  pause with reason) (FR-92; the run rules of FR-85 and FR-89); no dependency on this plugin or its flag. Files:
  `packages/core/src/lib/recurrence/{recurrence.rules.ts,recurrence-run.helper.ts,index.ts}`,
  `packages/core/src/lib/invoice-schedule/invoice-schedule.rules.ts`. Test:
  existing `invoice-schedule.rules.spec.ts` unchanged; `packages/core/src/lib/recurrence/recurrence.rules.spec.ts`, a table spec over two years of dates.

## Phase 2 — Services, endpoints, events

- [ ] **T10**. Sequence allocation inside the caller's transaction: built by T61 (Phase 1, `packages/core/src/lib/sequence/`); its tests are T61's.
- [ ] **T11**. Type registry `bd/registry/business-document-type.registry.ts` with start-up validation (FR-1, FR-2).
  Files: `bd/registry/{business-document-type.registry.ts,registration.validator.ts}`.
  Test: `bd/registry/business-document-type.registry.spec.ts`: invalid registrations refused with their reason.
- [ ] **T12**. Pattern engine `bd/numbering/pattern.ts` (tokens of FR-20, resolved prefix, counter padding) and fiscal
  label through `DOCUMENT_FISCAL_CALENDAR` with the organization fiscal-date fallback. Files: `bd/numbering/{pattern.ts,fiscal-label.ts}`.
  Test: `bd/numbering/pattern.spec.ts`, a table-driven spec across
  year, fiscal-year, month, week and day-of-year boundaries; `{ORG}` without a short code and a pattern without a counter refused.
- [ ] **T13**. Numbering service `bd/numbering/numbering.service.ts`: series selection with rule-kernel selectors,
  `ensure` per prefix, allocation, number records, preview, explicit numbers, voids, the `SEQUENCE_COUNTER_GUARD`
  binding for gap-free series (FR-19 to FR-24, FR-28 to FR-32). Files: `bd/numbering/{numbering.service.ts,series-selection.ts,sequence-counter-guard.binding.ts}`.
  Test: `bd/numbering/numbering.service.spec.ts` unit and `bd/numbering/numbering.service.db.spec.ts` SQLite specs: a
  used number cannot be voided; an explicit duplicate refused and the counter moved past it; a type named by a field
  refuses a duplicate code; preview consumes nothing.
- [ ] **T14**. Index service `bd/index/business-document-index.service.ts` (`track`, snapshot to index, version check)
  and the history writer onto core `activity_log` (entity, entity id, state and version before and after, actor type,
  reason and change set in `data`), with the history read merging `adapter.history`. Files:
  `bd/index/business-document-index.service.ts`, `bd/history/{document-history.writer.ts,document-history.reader.ts}`. Test:
  `bd/index/business-document-index.service.spec.ts`: draft tracking, stale
  version `409`; `bd/history/document-history.writer.spec.ts`: one activity-log row per action with the actor type, order history merged.
- [ ] **T15**. Lifecycle service `bd/lifecycle/lifecycle.service.ts`: confirm order of plan §4.1, cancel, hold,
  release, delete rules, `DOCUMENT_CHECKS` slot, outbox append with partition `document:<rootId>`, adapter `apply`
  (FR-9 to FR-18, FR-107). Files: `bd/lifecycle/{lifecycle.service.ts,document-checks.ts,document-action-refused.exception.ts}`,
  `bd/events/business-document.events.ts`. Test: `bd/lifecycle/lifecycle.service.spec.ts`: all-or-nothing on a blocking finding; event once per action; a document of another organization answers `404`;
  `bd/lifecycle/lifecycle.service.orm-parity.spec.ts`; a
  `preexisting` test type with its policies off can still be edited, deleted and cancelled after confirmation.
- [ ] **T16**. Controllers `bd/controllers/` for types, series (under the core `SEQUENCES_VIEW` / `SEQUENCES_EDIT`),
  numbers, documents (list, entry, history, generic actions through `adapter.perform`), DTOs, `@FeatureFlag`, Swagger.
  Files: `bd/controllers/{types.controller.ts,series.controller.ts,numbers.controller.ts,documents.controller.ts}`, `bd/dto/`.
  Test: `bd/controllers/documents.controller.spec.ts` and `bd/controllers/series.controller.spec.ts` controller specs and e2e on SQLite (type permissions checked per action).
- [ ] **T17**. Contract-test kit `bd/testing/` (a test document type with adapter, fixtures, shared expectations)
  exported for owners; `apps/api/src/plugin-composition.ts` comment block naming the tokens owners bind. Files:
  `bd/testing/{test-document.type.ts,test-document.adapter.ts,fixtures.ts,owner-contract.suite.ts,index.ts}`,
  `apps/api/src/plugin-composition.ts`. Test: `bd/testing/owner-contract.suite.spec.ts`, the kit
  runs green against the engine.
- [ ] **T18**. Link and roll-up service `bd/links/link.service.ts`: pending and active links, owner-stored links
  through `adapter.link` (order billing lines are `order_line_invoice` rows, `_link` their index entry), roll-ups on
  confirm and cancel written to the owner counters of plan §3 through `adapter.apply`, chains, progress percentages
  with the 100 % snap, `remaining`, quantities through the core decimal helpers (FR-33 to FR-38, FR-44). Files:
  `bd/links/{link.service.ts,rollup.service.ts,progress.ts}`. Test: `bd/links/link.service.spec.ts` unit;
  `bd/links/link-chain.db.spec.ts` chain spec (order → invoice → credit note) with exactly one `order_line_invoice` row
  per billed line; a link from a closed, held or draft source line refused; cancellation releases the roll-ups.
- [ ] **T19**. Roll-up concurrency: row lock per source line on PostgreSQL and MySQL, single writer on SQLite. Files: `bd/links/rollup-lock.ts`. Test:
  `bd/links/rollup-lock.db.spec.ts`, a parallel confirmation spec on PostgreSQL in CI (second refused with the quantity left).
- [ ] **T20**. Return rules `bd/links/return.rules.ts` and `DOCUMENT_LOT_BUNDLES` call (FR-39, FR-40). Files: `bd/links/return.rules.ts`.
  Test: `bd/links/return.rules.spec.ts`: each refusal with its code and message with the type's return policy on; with it off, a return of an existing document type above the returnable quantity or the original's price is saved as today.
- [ ] **T21**. Tolerance service `bd/tolerance/tolerance.service.ts`: resolution chain of plan §4.1 with owner-held
  levels through `adapter.toleranceLevels` (purchasing: delivery allowance, supplier term, order allowance) and the
  setting `purchasing.overReceiptTolerancePercent`, epsilon, exempt roll-ups, overrides with reason, under-tolerance
  completion (FR-45 to FR-50). Files: `bd/tolerance/{tolerance.service.ts,tolerance-chain.ts}`. Test:
  `bd/tolerance/tolerance.service.spec.ts`, a unit table; a receipt gets the same allowance from the engine and from
  `GoodsReceiptService.resolveOverReceiptTolerance`; a `preexisting` type without a saved tolerance has no limit.
- [ ] **T22**. Line close and reopen with owner veto, document close and reopen events (FR-51 to FR-54). Files: `bd/lifecycle/line-close.service.ts`. Test:
  `bd/lifecycle/line-close.service.spec.ts` unit and SQLite specs.
- [ ] **T23**. Create-from checks and copying `bd/links/create-from.checks.ts` (FR-41, FR-76, FR-77) with
  `DOCUMENT_UNITS`. Files: `bd/links/{create-from.checks.ts,create-from.copy.ts}`. Test: `bd/links/create-from.checks.spec.ts`: each check, merge refused across parties.
- [ ] **T24**. Totals pipeline `bd/totals/totals-pipeline.ts`: stage order, `adapter.totalsStage` for owners with a
  calculator (`OrderTotalsService`, cart totals, invoice totals), stage ports, discount distribution for the others,
  tax breakdown as core `tax_line` rows, rounding and cash rounding, amount in words per locale, net weight, snapshot
  per version (FR-55 to FR-59). Files: `bd/totals/{totals-pipeline.ts,discount-distribution.ts,rounding.ts,amount-in-words.ts}`.
  Test: `bd/totals/totals-pipeline.golden.spec.ts`, a golden set of existing invoices and orders replayed through their own
  calculators to the smallest unit on three dialects.
- [ ] **T25**. Totals preview route and draft refresh consumer (FR-60, FR-61). Files: `bd/totals/{totals.controller.ts,totals-refresh.consumer.ts}`.
  Test: `bd/totals/totals.controller.spec.ts` latency spec at 200 lines; `bd/totals/totals-refresh.consumer.spec.ts`: out-of-
  date marking on `tax.configuration.changed`.
- [ ] **T26**. Preview service `bd/preview/preview.service.ts` over `DOCUMENT_EFFECTS_PROVIDERS` with per-area timeout
  and no writes (FR-78 to FR-80). Files: `bd/preview/preview.service.ts`. Test: `bd/preview/preview.service.spec.ts`: providers stubbed; transaction rolled back; area timeout marked.
- [ ] **T27**. Change-set service `bd/change-sets/change-set.service.ts`: propose, field allow-list, one open,
  re-validation, diff builder, withdraw, reject, expire, apply as next version with `amended`; types with
  `changeSet.store = 'OWNER'` go through `adapter.proposeChangeSet` / `applyChangeSet` and write no `_change_set` row
  (FR-62 to FR-69); free fields applied at once with a history entry and no new version. Files:
  `bd/change-sets/{change-set.service.ts,change-set.diff.ts,change-set-expire.job.ts}`. Test:
  `bd/change-sets/change-set.service.spec.ts` unit and SQLite specs including "below rolled-up quantity"; a free field
  applies without a new version.
- [ ] **T28**. Change-set approval through `DOCUMENT_APPROVALS` with the permission fallback and the type policies
  read from the settings store, never both for one type. Files: `bd/change-sets/change-set-approval.service.ts`. Test:
  `bd/change-sets/change-set-approval.service.spec.ts`: threshold policy spec; with the port bound the policy
  threshold is ignored.
- [ ] **T29**. Amendments `bd/change-sets/amendment.service.ts`: copy, suffix naming, link and roll-up move, refusal
  over dependents, single `amended` event (FR-70, FR-71). Files: `bd/change-sets/amendment.service.ts`. Test:
  `bd/change-sets/amendment.service.db.spec.ts` SQLite spec; a series set to fresh numbers gives the amendment a new number.
- [ ] **T30**. Order changes as the change sets of `sales_order`: the order adapter's `proposeChangeSet` /
  `applyChangeSet` create and drive `order_change` and `order_change_action`, expiry by `order.changeTtlMinutes`
  (FR-68, FR-72). Files: `bd/change-sets/owner-change-set.bridge.ts`,
  `packages/plugins/order/src/lib/order-change/order-change.service.ts` (driven, unchanged in shape). Test:
  `bd/change-sets/owner-change-set.bridge.spec.ts`: proposing on an order creates one order change and no `_change_set` row; a second proposal is
  refused by the order plugin's one-open rule; the change appears in history with its diff.
- [ ] **T31**. Dependent drafts `bd/dependents/dependents.service.ts` with unlink and delete, and the
  `LEDGER_CLOSE_CHECK` contribution "drafts in period" (FR-73 to FR-75). Files: `bd/dependents/{dependents.service.ts,drafts-in-period.close-check.ts}`.
  Test: `bd/dependents/dependents.service.spec.ts` unit spec.
- [ ] **T32**. Controllers for links, lines, change sets, tolerances, policies, totals preview, preview, dependents.
  Files: `bd/controllers/{links.controller.ts,lines.controller.ts,change-sets.controller.ts,tolerances.controller.ts,policies.controller.ts,preview.controller.ts,dependents.controller.ts}`, `bd/dto/`.
  Test: `bd/controllers/change-sets.controller.spec.ts` and one e2e spec per controller on SQLite.
- [ ] **T33**. Read-only flow service `bd/flow/flow.service.ts` with permission filtering and hidden counts (FR-101,
  FR-103). Files: `bd/flow/{flow.service.ts,flow.controller.ts}`. Test: `bd/flow/flow.service.spec.ts`: hidden documents counted, never described.
- [ ] **T34**. The engine's recurrence service `bd/recurrence/` on the core recurrence module of T62: period shifting,
  preview, owner permissions, end rules (FR-83 to FR-85, FR-89 to FR-92). Files:
  `bd/recurrence/{recurrence.service.ts,recurrence.controller.ts,recurrence-runner.ts}`. Test:
  `bd/recurrence/recurrence.service.spec.ts`, an occurrence table spec over two years
  of dates; a document recurrence and an invoice schedule share one rule model; the owner losing the permission pauses the recurrence.
- [ ] **T35**. Recurrence schedule: `BusinessDocumentsSchedulePlugin` in `apps/worker/src/plugins.ts`, queue worker in
  the API, in-process fallback, unique occurrence claim. Files: `bd/schedule/{business-documents-schedule.plugin.ts,recurrence-tick.job.ts,recurrence.worker.ts}`,
  `apps/worker/src/plugins.ts`. Test: `bd/schedule/recurrence-tick.job.spec.ts`: double tick creates once; plugin list specs.
- [ ] **T36**. Bulk runs `bd/bulk/` as core operation type `BUSINESS_DOCUMENT_BULK` registered with
  `OperationRegistry`: selection (ids or saved-view filter), grouping, per-item permission and skip rules, one step per
  slice through `BulkExecutor`, counts in the operation state, `business_document_bulk_item` rows, cancel through
  `cancelRequested()`, CSV through `spreadsheet-safe`, `@AcceptedOperation` start (FR-93 to FR-95, FR-99, FR-100).
  Files: `bd/bulk/{bulk-run.operation.ts,bulk-run.service.ts,bulk-run.controller.ts,bulk-items.csv.ts}`.
  Test: `bd/bulk/bulk-run.operation.db.spec.ts`, a SQLite spec of 400 items with holds and failures; a duplicate start returns the same operation.
- [ ] **T37**. First-enable index run `bd/index/first-enable.job.ts` through `adapter.enumerate` (FR-4). Files: `bd/index/first-enable.job.ts`.
  Test: `bd/index/first-enable.job.spec.ts`, a resumable cursor spec; existing numbers kept.
- [ ] **T38**. Lookups `bd/lookups/lookup.service.ts` with `ORGANIZATION` allow-list and party restrictions, text
  through `DOCUMENT_TEXT_SEARCH` (the search plugin's provider), also used by the document list `q` (FR-104). Files:
  `bd/lookups/{lookup.service.ts,lookups.controller.ts}`. Test:
  `bd/lookups/lookup.service.spec.ts` with the port bound and unbound.
- [ ] **T39**. Report definitions `bd/reports/` (trends, number audit, overrides, closed lines, change sets, bulk
  results) registered in the core reports catalogue (category keyed `FEATURE_BUSINESS_DOCUMENTS` in the shared catalogue feature
  filter, `report` rows with `showInMenu`, per-organization rows) and served by `/reports/:key`; also offered through `DOCUMENT_REPORTS` when bound (FR-105, FR-106).
  Files: `bd/reports/{business-documents.report-definitions.ts,business-documents-reports.service.ts,reports.controller.ts}`. Test:
  `bd/reports/business-documents-reports.service.spec.ts` on seeded data; the definitions appear in the Reports menu with the feature on and not with it off.
- [ ] **T40**. Read-only list of core invoice schedules on the recurrences routes (FR-92). Files: `bd/recurrence/invoice-schedules.reader.ts`. Test:
  `bd/recurrence/invoice-schedules.reader.spec.ts`: schedules listed, untouched.

## Phase 3 — UI surfaces

- [ ] **T41**. Angular `packages/plugins/business-documents-ui`: the numbering page `/pages/settings/numbering` over
  every core sequence (list, move forward, restart under `SEQUENCES_*`) with document series, pattern editor, live
  preview and audit; tolerances, policies (including the rules of spec FR-113 for existing types); menu entries with
  feature code and permissions; `BUSINESS_DOCUMENTS.*` keys in every locale. Files:
  `packages/plugins/business-documents-ui/{package.json,project.json,ng-package.json,src/index.ts}`,
  `bdui/{business-documents-ui.plugin.ts,business-documents-ui.routes.ts}`,
  `bdui/pages/{numbering-page.component.ts,pattern-editor.component.ts,tolerances-page.component.ts,policies-page.component.ts}`,
  `packages/ui-core/i18n/assets/i18n/*.json`. Test: `bdui/pages/numbering-page.component.spec.ts` component rendering specs; plain
  sequences listed beside document series; no menu entry with the flag off.
- [ ] **T42**. Exported document components (flow with list view, history, effects panel, change-set dialog and diff,
  dependent drafts, line close, recurrence dialog, state badge) and tab registration through `PageTabRegistryService`.
  Files: `bdui/components/{document-flow.component.ts,document-history.component.ts,effects-preview-panel.component.ts,change-set-dialog.component.ts,change-set-diff.component.ts,dependent-drafts-dialog.component.ts,line-close-dialog.component.ts,recurrence-dialog.component.ts,document-state-badge.component.ts}`.
  Test: `bdui/components/document-flow.component.spec.ts` rendering and keyboard specs (list view with the same content).
- [ ] **T43**. Recurrences page (with the core invoice schedules read-only) and bulk-run page over the core
  operations of type `BUSINESS_DOCUMENT_BULK` with live progress from the operation events, the item log, and the
  saved-view bulk action. Files: `bdui/pages/{recurrences-page.component.ts,bulk-runs-page.component.ts}`,
  `bdui/components/bulk-run-launcher.component.ts`. Test: `bdui/pages/bulk-runs-page.component.spec.ts` component specs with a stubbed channel.
- [ ] **T44** (parallel). `DocumentFormShellComponent` in `business-documents-ui` with panel slots other features
  fill (accounting's effects panel), around the flow, effects, change-set diff and progress components; no separate
  React package. Files: `bdui/components/document-form-shell.component.ts`. Test: `bdui/components/document-form-shell.component.spec.ts` rendering specs with a registered panel.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T45**. MCP read tools in `packages/mcp-server/src/lib/tools/business-documents.ts` (types, get, flow,
  dependents, series list, audit, recurrence preview, bulk status) registered in `register-all-tools.ts`. Files:
  `packages/mcp-server/src/lib/tools/business-documents.ts`, `packages/mcp-server/src/lib/tools/register-all-tools.ts`. Test:
  `packages/mcp-server/src/lib/tools/business-documents.spec.ts` tool input-schema spec.
- [ ] **T46**. OpenAPI regenerated; SDK regeneration noted for the release. Files: `packages/core/src/lib/bootstrap/swagger.ts`. Test: OpenAPI diff is additive.
- [ ] **T47**. User docs (numbering, flow, change sets, recurrence, bulk runs) and `docs/specs/README.md` row. Files: `docs/specs/README.md`. Test:
  docs build.

## Phase 5 — Advanced capabilities

- [ ] **T48**. Gap-free series: `allocateWithin` path, chronology, voids for numbered drafts, nightly audit with gap
  events and inbox items (FR-25 to FR-27). Files: `bd/numbering/{gap-free.allocator.ts,chronology.ts,number-audit.job.ts}`.
  Test: `bd/numbering/gap-free.allocator.db.spec.ts`: 50 parallel confirmations with 10 failures on PostgreSQL and MySQL
  leave no gap and no duplicate; SQLite single-writer spec.
- [ ] **T49**. Live flow: realtime hints on every state, link and progress change; client refresh within 2 s
  (FR-102). Files: `bd/flow/flow-realtime.publisher.ts`, `bdui/components/document-flow.component.ts`. Test:
  `bd/flow/flow-realtime.publisher.spec.ts`: hint emitted per change; component spec.
- [ ] **T50**. Readable diff with effects difference and the approval inbox items (FR-65, FR-66). Files: `bd/change-sets/{change-set.diff.ts,change-set-inbox.consumer.ts}`. Test:
  `bd/change-sets/change-set.diff.spec.ts`, a diff snapshot spec for header, lines, totals and effects.
- [ ] **T51**. Preview tokens (HMAC, actor-bound, 10 minutes) required for agent confirmations, and MCP write tools
  (preview, confirm, cancel, close lines, change-set propose and submit, recurrence create, pause and resume, bulk start
  and retry) (FR-81, FR-82, FR-108, FR-109). Files: `bd/preview/preview-token.ts`,
  `packages/mcp-server/src/lib/tools/business-documents.ts`. Test: `bd/preview/preview-token.spec.ts`: stale and
  foreign tokens refused; agent marked in history.
- [ ] **T52**. Recurrence skip dates, holiday policy through the core recurrence module and `OfficialHolidayService`,
  skip conditions, pause and resume, catch-up policies (FR-86 to FR-88, FR-90). Files: `bd/recurrence/{recurrence-skip.ts,recurrence-catch-up.ts}`,
  `packages/core/src/lib/recurrence/recurrence.rules.ts`. Test: `bd/recurrence/recurrence-catch-up.spec.ts`: three-day downtime under each policy.
- [ ] **T53**. Resumable bulk runs on the core runtime: lease and stalled-run recovery resume the operation, step
  retry policy with backoff (5, 30, 120 min, three attempts), manual retry of failed items as a child operation,
  progress from the operation step events, inbox item from the `operation.completed` consumer (FR-96 to FR-98). Files:
  `bd/bulk/{bulk-run.operation.ts,bulk-retry.service.ts,operation-completed.consumer.ts}`. Test:
  `bd/bulk/bulk-run.resume.db.spec.ts`: process killed half-way resumes without duplicates.
- [ ] **T54**. Counterpart consumer `bd/events/counterpart.consumer.ts` with `DOCUMENT_ORGANIZATION_PROFILE`, once per
  source, cancellation in step (FR-42, FR-43). Files: `bd/events/counterpart.consumer.ts`. Test:
  `bd/events/counterpart.consumer.db.spec.ts`, a SQLite spec with two organizations; redelivery creates nothing.
- [ ] **T55**. Real-time state hints for document lists and the progress event (FR-110). Files: `bd/events/document-state-realtime.publisher.ts`. Test:
  `bd/events/document-state-realtime.publisher.spec.ts` hint spec.
- [ ] **T56**. Chain cancellation: `cancel` with `withDependents` and `preview`, dependency order leaves first,
  permission on every member, limit of 100, all or nothing in one transaction whose manager every `adapter.perform`
  joins (FR-13). Files: `bd/lifecycle/chain-cancel.service.ts`. Test:
  `bd/lifecycle/chain-cancel.service.db.spec.ts`, a SQLite spec of order, delivery and invoice
  cancelled together; one missing permission refuses the whole chain; an owner refusing the last member's
  cancellation rolls back the cancellations of the members before it.
- [ ] **T57**. Amendment of cancelled documents (FR-70). Files: `bd/change-sets/amendment.service.ts`. Test:
  `bd/change-sets/amendment-of-cancelled.db.spec.ts`: copy linked to the cancelled original, which stays
  cancelled; suffix naming.
- [ ] **T58**. Background actions as core operations: types `BUSINESS_DOCUMENT_CONFIRM`, `_CANCEL`, `_CANCEL_CHAIN`
  registered with `OperationRegistry`, registration `background`, `aggregateType` / `aggregateId` = the document,
  `@AcceptedOperation` `202` answers, listing through `/api/operations?aggregateType=`, inbox on finish or failure from
  the `operation.completed` consumer (FR-111, FR-112). Files: `bd/lifecycle/{background-actions.operation.ts,background-actions.registry.ts}`,
  `bd/bulk/operation-completed.consumer.ts`. Test: `bd/lifecycle/background-actions.operation.spec.ts`: a 2,000-line confirmation returns `202`, a second action
  on the same document is refused by `UQ_operation_aggregate_live`, the document refuses edits meanwhile, the outcome
  is notified.
- [ ] **T59**. Existing document types (spec FR-113, AC-18): `preexisting` registration flag, the per-type policy keys
  of plan §2 read by the lifecycle, link, tolerance, return, create-from and totals services, owners' existing routes
  without a required version. Files: `bd/policies/{type-policy.service.ts,type-policy.keys.ts}`,
  `bd/lifecycle/lifecycle.service.ts`, `bd/links/link.service.ts`, `bd/tolerance/tolerance.service.ts`. Test:
  `bd/policies/preexisting-types.spec.ts`: with the feature on and policies off, the invoice, estimate, order and purchase
  order suites pass unchanged (edit and delete after sending, typed invoice numbers, over-billing and over-delivery, returns above the returnable
  quantity or the original's price);
  each policy turned on applies its rule.
- [ ] **T60**. Provide the ports other features bind to (plan, **Consumer tokens answered**): `CUSTOM_FIELDS_NUMBERING`, `DATA_EXCHANGE_DOCUMENTS`, `MANUFACTURING_DOCUMENTS`, `MARKETING_DOCUMENT_FLOW`, `ORGANIZATION_DOCUMENTS`, `PAYROLL_DOCUMENTS`, `PRINT_DOCUMENTS`, `SUBCONTRACTING_DOCUMENTS`, `WORKFLOW_DOCUMENTS`. Files: `apps/api/src/plugin-composition.ts`, `bd/business-documents.consumer-tokens.ts`. Test: `bd/business-documents.consumer-tokens.spec.ts`, one contract test per token over the shape its consumer plan states; with this feature off each consumer keeps its stated fallback.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1–FR-2 | §3.1 Registration, scope and compatibility | T11 |
| FR-3 | §3.1 Registration, scope and compatibility | T5, T14 |
| FR-4 | §3.1 Registration, scope and compatibility | T37 |
| FR-5 | §3.1 Registration, scope and compatibility | T2, T59 |
| FR-6 | §3.1 Registration, scope and compatibility | T15, T16 |
| FR-7 | §3.1 Registration, scope and compatibility | T18, T59 |
| FR-8 | §3.1 Registration, scope and compatibility | T11, T16 |
| FR-9–FR-12 | §3.2 Lifecycle | T15 |
| FR-13 | §3.2 Lifecycle | T15, T56 |
| FR-14 | §3.2 Lifecycle | T15, T18 |
| FR-15 | §3.2 Lifecycle | T15 |
| FR-16 | §3.2 Lifecycle | T14 |
| FR-17–FR-18 | §3.2 Lifecycle | T15 |
| FR-19 | §3.3 Numbering series | T13, T16, T41 |
| FR-20–FR-24 | §3.3 Numbering series | T12, T13 |
| FR-25–FR-27 | §3.3 Numbering series | T48 |
| FR-28–FR-30 | §3.3 Numbering series | T13 |
| FR-31 | §3.3 Numbering series | T13, T61 |
| FR-32 | §3.3 Numbering series | T29 |
| FR-33–FR-38 | §3.4 Links, roll-ups and returns | T18 |
| FR-39–FR-40 | §3.4 Links, roll-ups and returns | T20 |
| FR-41 | §3.4 Links, roll-ups and returns | T23 |
| FR-42–FR-43 | §3.4 Links, roll-ups and returns | T54 |
| FR-44 | §3.4 Links, roll-ups and returns | T18 |
| FR-45–FR-50 | §3.5 Tolerances and line close | T21 |
| FR-51–FR-54 | §3.5 Tolerances and line close | T22 |
| FR-55–FR-59 | §3.6 Totals pipeline | T24 |
| FR-60–FR-61 | §3.6 Totals pipeline | T25 |
| FR-62–FR-64 | §3.7 Change sets and amendments | T27 |
| FR-65 | §3.7 Change sets and amendments | T27, T50 |
| FR-66 | §3.7 Change sets and amendments | T28, T50 |
| FR-67 | §3.7 Change sets and amendments | T27 |
| FR-68 | §3.7 Change sets and amendments | T27, T30 |
| FR-69 | §3.7 Change sets and amendments | T27 |
| FR-70 | §3.7 Change sets and amendments | T29, T57 |
| FR-71 | §3.7 Change sets and amendments | T29 |
| FR-72 | §3.7 Change sets and amendments | T30 |
| FR-73–FR-75 | §3.8 Dependent drafts and document checks | T31 |
| FR-76–FR-77 | §3.8 Dependent drafts and document checks | T23 |
| FR-78–FR-80 | §3.9 Effects preview | T26 |
| FR-81 | §3.9 Effects preview | T26, T42, T51 |
| FR-82 | §3.9 Effects preview | T51 |
| FR-83–FR-85 | §3.10 Recurrence | T34, T35, T62 |
| FR-86–FR-88 | §3.10 Recurrence | T52 |
| FR-89 | §3.10 Recurrence | T34, T62 |
| FR-90 | §3.10 Recurrence | T34, T52 |
| FR-91 | §3.10 Recurrence | T34 |
| FR-92 | §3.10 Recurrence | T34, T40, T62 |
| FR-93–FR-95 | §3.11 Bulk creation | T36 |
| FR-96–FR-98 | §3.11 Bulk creation | T53 |
| FR-99–FR-100 | §3.11 Bulk creation | T36 |
| FR-101 | §3.12 Document flow, lookups and trends | T33, T42 |
| FR-102 | §3.12 Document flow, lookups and trends | T49 |
| FR-103 | §3.12 Document flow, lookups and trends | T33, T42 |
| FR-104 | §3.12 Document flow, lookups and trends | T38 |
| FR-105–FR-106 | §3.12 Document flow, lookups and trends | T39 |
| FR-107 | §3.13 Events, agents and real time | T15 |
| FR-108 | §3.13 Events, agents and real time | T45, T51 |
| FR-109 | §3.13 Events, agents and real time | T14, T51 |
| FR-110 | §3.13 Events, agents and real time | T55 |
| FR-111–FR-112 | §3.14 Background actions | T58 |
| FR-113 | §3.15 Document types that exist today | T41, T59 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off; enabling it in dev shows numbering, flow, preview, change sets, recurrence and bulk runs end
  to end on the test document type and on the first owner that registers.
- Constitution gates in `spec.md` §9 confirmed.
- Contract-test kit published and green for every owner that has registered so far.
- Confirmation overhead, preview and flow latency budgets of spec §4 measured in CI on PostgreSQL.
- With the flag off, the owners' existing numbering, order-change and invoice-schedule suites pass unchanged; the
  invoice-schedule suite also passes unchanged after the recurrence rules move to core.
