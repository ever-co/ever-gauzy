# Task Breakdown: Data import and export

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `data-import-export`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind `GAUZY_DATA_EXCHANGE_ENABLED` and `FEATURE_DATA_EXCHANGE`: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it. `dx/` means
  `packages/plugins/data-exchange/src/lib/`, `ui/` means `packages/ui-core/shared/src/lib/data-exchange/`, `dxui/` means
  `packages/plugins/data-exchange-ui/src/lib/`, `mcp/` means `packages/mcp-server/src/lib/`.
- Phases 1 to 4 deliver plan phase 1; Phase 5 delivers plan phase 2 (depth); Phase 6 plan phase 3 (advanced).
- Depends on the record type registry of `custom-fields-and-forms` and the record writers of `record-views-and-search`.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts `packages/contracts/src/lib/data-exchange.model.ts` (targets, profiles, mapping, transform
  grammar, value mapping, run and row results, export, merge, recycle entry, toolkit, ports) and the optional `import`,
  `rename`, `trash`, `mergeGuard` parts in `record-type.model.ts`; export from `packages/contracts/src/index.ts`. Test: transform grammar
  validation spec.
- [ ] **T2**. `PluginContributions.dataExchange` (`importProfiles`, `migrationToolkits`, `mergeParticipants`) in
  `packages/plugin/src/lib/plugin-contributions.ts` with its registry in `packages/core/src/lib/plugin-contributions/`
  (`plugin-data-exchange.registry.ts`)
  and the helpers `registerImportProfiles`, `registerMigrationToolkits`, `registerMergeParticipants`; `core-record-import.ts`
  next to the record type registry (creators and match keys for contacts, vendors, employees, candidates, projects,
  tasks, items, expenses, incomes, tags, equipment over their bulk-create services and the core bulk contract where they
  exist). Test: registry spec; creator spec per type (permission refused).
- [ ] **T3** (parallel). `RECORD_DELETION_LISTENERS` hook in `packages/core/src/lib/core/entities/subscribers/`
  (`record-deletion-listeners.subscriber.ts`) after a
  registered type's soft removal. Test: unbound port changes nothing; bound listener receives type, ids and actor.
- [ ] **T4**. Plugin scaffold `packages/plugins/data-exchange` (`package.json`, `project.json`, `tsconfig.json`,
  `tsconfig.lib.json`, `tsconfig.spec.json`, `jest.config.ts`, `src/index.ts`, `dx/data-exchange.plugin.ts`,
  `dx/data-exchange.module.ts`),
  `dx/data-exchange-enabled.ts` (exact `true`); `PluginContributions` on `@GauzyCorePlugin`:
  `dx/data-exchange.features.ts` (`FEATURE_DATA_EXCHANGE`), `dx/data-exchange.permissions.ts` (with `defaultFor`);
  `apps/api/src/plugins.ts`, `apps/worker/src/plugins.ts`; `.env.sample`. Test: flag and contribution specs.
- [ ] **T5**. On the shared core migration helpers of `procurement` T4 (`@gauzy/core`), entities and migrations
  `1791000035100` to `1791000035140` (no retention setting or toolkit run table): entities
  `dx/import/entities/{data-import-run,data-import-row,data-mapping-template,data-value-memory}.entity.ts`,
  `dx/export/entities/{data-export-run,data-export-template}.entity.ts`,
  `dx/merge/entities/{data-merge,data-merge-journal,data-duplicate-candidate}.entity.ts`,
  `dx/recycle/entities/{data-recycle-entry,data-archive-rule}.entity.ts`, `dx/schedule/entities/data-schedule.entity.ts`
  with TypeORM and MikroORM repositories beside them; migrations
  `dx/database/migrations/1791000035100-CreateDataImportTables.ts`, `1791000035110-CreateDataExportTables.ts`,
  `1791000035120-CreateDataMergeTables.ts`, `1791000035130-CreateDataRecycleTables.ts`,
  `1791000035140-CreateDataScheduleTables.ts`, listed in `dx/database/data-exchange-migrations.ts`. Test: migration specs on SQLite (up
  twice); mapping under both ORMs. Migration timestamps: `1791000035100` to `1791000035199` (`packages/plugins/data-exchange`).
- [ ] **T6**. Default grants of plan §9 through `defaultFor` on the permission contributions; no seed migration. Files:
  `dx/data-exchange.permissions.ts`. Test:
  grants present on a new tenant and after the permission reload; `IMPORT_ADD` and `EXPORT_ADD` untouched.

## Phase 2 — Services, endpoints, events

- [ ] **T7**. Readers `dx/read/` (`csv.reader.ts`, `xlsx.reader.ts`, `json.reader.ts`, `link.reader.ts`): CSV (`csv-parser`, `iconv-lite`, delimiter and encoding detection), XLSX (`exceljs`
  streaming, sheet and header row), JSON (`stream-json`), archives through core `import-archive-extract.ts`, tenant
  storage and limits through the Docs import's `import-tenant-storage.ts` and `import-limits.ts` moved into
  `packages/core/src/lib/export-import/import/` (re-exported by docs), link fetch under the outbound endpoint policy;
  refusals for protected and legacy files; size and row caps. Test: fixtures per format and encoding; private address
  refused; Docs import specs unchanged.
- [ ] **T8**. Mapper `dx/map/` (`header-matcher.ts`, `value-mapper.ts`, `reference-resolver.ts`, `format-detector.ts`,
  `transforms.ts`): header and label matching in every language, constants and defaults, value mapping,
  reference resolution by declared keys, format detection per column, transforms. Test: matching in two languages;
  each transform; unresolved reference reported.
- [ ] **T9**. Validator and dry run `dx/validate/` (`row-validator.ts`, `dry-run.service.ts`, `in-file-duplicates.ts`): form-equivalent validation through creators, writers and
  `CUSTOM_FIELD_VALUE_WRITER` in check mode, in-file duplicates by match keys, outcomes per row with before and after,
  and the validated values of each `CREATE`, `UPDATE` and `DUPLICATE` row stored in `data_import_row.values` with the
  matched record's version in `matchedVersion`.
  Test: dry run writes nothing (row counts unchanged); masked field cannot be mapped; every `CREATE`, `UPDATE` and
  `DUPLICATE` row keeps its values.
- [ ] **T10**. Import operation `data-exchange.import`: batches of 200 committed on their own, resume from the last batch
  (operation lease), cancel, time limit, totals, record origin on events, notifications muted, error, skipped and log
  files; external ids written to core `integration_map` under the `integration_tenant` of the files' origin. Files:
  `dx/import/data-import.operation.ts`, `dx/import/data-import-runner.service.ts`, `dx/import/import-result-files.ts`. Test: crash in batch 3 resumes
  without duplicates; partial run lists failed rows only; a second file resolves "customer 123" by its source id; a run
  started from a dry run with the source file deleted creates the dry run's records from the stored values, and a
  row whose matched record changed since the dry run is `CHANGED_SINCE_PREVIEW`.
- [ ] **T11**. Import controllers and DTOs (`imports`, `preview`, `rows`, `dry-run`, `run`, `cancel`, `retry`, files,
  `imports/history` merging `import_history` rows), own runs versus `DATA_IMPORT_MANAGE`: `dx/import/data-import.controller.ts`,
  `dx/import/data-import-history.controller.ts`, `dx/import/dto/`, `dx/targets/data-target.controller.ts`. Test: e2e (permissions per
  target, `404` with the feature off, idempotent run); a tenant archive import appears in the history with its download.
- [ ] **T12**. Exports `dx/export/` (`data-export.service.ts`, `data-export.controller.ts`, `data-export.operation.ts`,
  `writers/`): record types and views through `RECORD_VIEWS_QUERY` and `RECORD_VIEWS_SELECTION`,
  scopes (all, selected, sample, template, for update), CSV (`csv-writer`), XLSX and JSON, masks, redaction, formula
  neutralizing, export log with one `AUDIT_EVENT_SINK` event per row, background above 50,000 rows. Test: exported rows
  equal the view; masked column absent; log row written once and referenced by the sink event.
- [ ] **T13**. Recycle bin: `RECORD_DELETION_LISTENERS` binding, entries with deletion groups, list, restore through the
  `trash` part (existing recover behaviour; tasks through `PUT /tasks/:id/recover` and `DELETE /tasks/:id/trashed` with
  the `comments-and-trash` rules, documents through `recover-document.handler.ts`), name conflicts;
  `data-exchange.recycle-backfill`. Files: `dx/recycle/recycle-bin.service.ts`, `dx/recycle/recycle-bin.controller.ts`,
  `dx/recycle/recycle-backfill.job.ts`. Test: restore of a group; parent-deleted refusal; backfill indexes existing
  soft-deleted rows; a task restored from the bin publishes its event once and follows the task trash rights.
- [ ] **T14**. Events `data_import.*`, `data_export.finished`, `record.restored` declared with `SubscriptionCatalogue`;
  progress hints `data-import:<runId>`; notification categories. Files: `dx/events/data-exchange.events.ts`,
  `dx/events/data-exchange-realtime.ts`. Test: payloads carry ids only.
- [ ] **T48**. Export templates (spec FR-47): `/api/data-exchange/export-templates` CRUD saving the columns, format and
  options of an export, private or shared. Files: `dx/export/data-export-template.service.ts`,
  `dx/export/data-export-template.controller.ts`, `dx/export/dto/data-export-template.dto.ts`. Test:
  `data-export-template.service.spec.ts`: a saved template reproduces the same columns and format; another user's
  private template is not listed.

## Phase 3 — UI surfaces

- [ ] **T15**. `packages/plugins/data-exchange-ui` scaffold (`dxui/data-exchange-ui.plugin.ts`, `dxui/data-exchange.routes.ts`,
  `dxui/pages/data-hub/data-hub-page.component.ts`): Settings → Data hub (Imports with the one history, Tenant
  archive tab hosting the existing `pages/import-export` component, whose old route stays unchanged, Exports, Recycle
  bin), routes, hidden on `404`, i18n keys `DATA_EXCHANGE.*` in every locale. Test: rendering specs; hidden when off;
  the old route opens the existing page with the feature on and off.
- [ ] **T16**. Import wizard `/pages/data/import/:runId`: source, sheet and formats, mapping, preview, dry run results
  with filters, live progress, results and downloads; first-import guide. Files: `dxui/pages/import-wizard/import-wizard.component.ts`,
  `dxui/pages/import-wizard/mapping-step.component.ts`, `dxui/pages/import-wizard/dry-run-step.component.ts`. Test: keyboard-only walk-through spec.
- [ ] **T17**. `ui/` embeddables `ngx-import-button`, `ngx-export-dialog` (`ui/import-button.component.ts`,
  `ui/export-dialog.component.ts`); placement on contacts, vendors, items,
  employees, candidates, tasks and expenses lists (empty state and menu); link from the task trash page
  (`apps/gauzy/src/app/pages/tasks/components/task-trash/task-trash-page.component.ts`) to the bin filtered to tasks. Test: hidden without permission; the task trash
  page unchanged apart from the link.
- [ ] **T18** (parallel). Bulk paths: bulk changes and match-key upserts written through `packages/core/src/lib/api/bulk.ts`
  (`BulkExecutorService`) for expenses, organizations and products (`product.bulk.ts`) and through
  `packages/core/src/lib/tasks/bulk-update.ts` for tasks, with the record writers for other types. Test: a task bulk
  change obeys `TASK_BULK_UPDATE_MAX` batching and the task rules; a product upsert matches by its natural key.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T19**. MCP `mcp/tools/data-exchange.ts`: `data_list_targets`, `data_import_start` (dry run by default),
  `data_import_report`, `data_import_commit`, `data_export`, `recycle_bin_list`, `recycle_bin_restore`;
  `mcp/tools/register-all-tools.ts`. Test: tool specs; commit refused before a dry run when the caller asked for one.
- [ ] **T20**. Port bindings in `apps/api/src/plugin-composition.ts`: `RECORD_VIEWS_EXPORT`, `RECORD_DELETION_LISTENERS`,
  `RECORD_TIMELINE_SOURCES` contribution (`dx/timeline/data-exchange-timeline.source.ts`: "Created by import", "Updated
  by import"). Test: composition spec with each plugin absent.
- [ ] **T21**. OpenAPI regenerated; SDK regeneration noted; docs site pages (profile contract for plugin authors);
  `docs/specs/README.md` row. Test: OpenAPI diff additive only.

## Phase 5 — Depth (plan phase 2)

- [ ] **T22**. Every registered target: custom fields and custom record types (import access per role), templates with
  help row and existing records. Files: `dx/targets/data-target.service.ts`, `dx/targets/target-template.builder.ts`.
  Test: custom record type importable at publish; template round trip; a `withRecords` template passes the read scope,
  record rules and field masks of an export, and a caller who may create but not read the target gets no record.
- [ ] **T23**. Update and create-or-update modes: match keys, changed fields only, "empty cells clear", changed since
  preview, export for update round trip. Files: `dx/import/update-mode.ts`, `dx/export/export-for-update.ts`. Test: re-import unchanged reports all rows unchanged.
- [ ] **T24**. Child rows (continuation rows, repeated parent columns, second sheet by key) and the party profiles
  (customers and suppliers with people and addresses). Files: `dx/map/child-rows.ts`, `dx/profiles/party.profile.ts`.
  Test: invoices with lines; contact with three people.
- [ ] **T25**. Trees (parent column, in-file parents, cycle refusal, tree preview) and second-pass references. Files:
  `dx/map/tree-resolver.ts`, `dx/import/second-pass.ts`. Test:
  chart tree with a cycle; reporting lines resolved after creation.
- [ ] **T26**. Documents as drafts with optional confirmation through `DATA_EXCHANGE_DOCUMENTS`. Files:
  `dx/import/document-confirmation.ts`. Test: hidden when
  unbound; confirmation refused without the permission.
- [ ] **T27**. Profiles: `registerImportProfiles` execution (`validateBatch`, writer, `afterRun`), `DATA_IMPORT_ENGINE`
  (also `ACCOUNTING_IMPORT_ENGINE`). Files: `dx/profiles/import-profile.runner.ts`, `dx/profiles/data-import-engine.port.ts`,
  `apps/api/src/plugin-composition.ts`. Test: a fake profile with a tree check and an after-run hook.
- [ ] **T28**. Mapping templates (private, shared), value mapping UI, transforms UI, retry of fixed rows into the same
  run. Files: `dx/import/data-mapping-template.service.ts`, `dx/import/data-mapping-template.controller.ts`,
  `dxui/pages/import-wizard/value-mapping.component.ts`, `dxui/pages/import-wizard/transforms.component.ts`. Test: shared template needs `DATA_IMPORT_MANAGE`; retry reuses the mapping.
- [ ] **T29**. Bulk change: `bulk-changes` route as an import run with source `VIEW` or a file, values and formulas,
  preview of 50, writes through the T18 bulk paths, per-record results, undo within 7 days. Files:
  `dx/bulk-change/bulk-change.service.ts`, `dx/bulk-change/bulk-change.controller.ts`. Test: 20,000-record change in
  the background; undo skips records changed since.
- [ ] **T30**. Rename: renamable parts, single and file runs (mode `RENAME`), log. Files: `dx/rename/rename.service.ts`,
  `dx/rename/rename.controller.ts`, `ui/rename-dialog.component.ts`. Test: duplicate new value refused.
- [ ] **T31**. Reference discovery `dx/merge/references.ts` (TypeORM relations, MikroORM many-to-one properties,
  `BasePerEntityType` tables, custom-field reference values, record-views tables, participants). Test: ORM parity spec
  listing the same references for contacts on both ORMs.
- [ ] **T32**. Merge: preview with counts and field choices, `mergeGuard`, repoint per table with duplicate-row
  strategies, journal with the before-image of every deleted duplicate row, merged records to the recycle bin "merged into", timeline entry, background above 10,000
  references, `ngx-merge-dialog`. Files: `dx/merge/merge.service.ts`, `dx/merge/merge.controller.ts`,
  `dx/merge/merge.operation.ts`, `ui/merge-dialog.component.ts`. Test: post-merge check finds no reference to merged ids; cross-organization refused.
- [ ] **T33**. Where-used: `where-used` route, `DATA_WHERE_USED`, recursive listing up to 1,000, blocking flags (today's
  refusals, references declared blocking by new types, every reference only with the organization setting
  `data.blockReferencedDeletion`, off by default), detach or delete dependents, `ngx-where-used-dialog`. Files:
  `dx/merge/where-used.service.ts`, `dx/merge/where-used.controller.ts`, `ui/where-used-dialog.component.ts`. Test: vendor
  with purchase orders refused with the list, as today; a contact referenced by deals is deleted as today with the setting off and
  refused with it on; a requester who may read the vendor but not two of its purchase orders sees only the readable
  orders, no count of the others, and `hiddenBlocking: true` when one of the hidden orders blocks the deletion.
- [ ] **T34**. Retention kinds `recycle-bin:<recordType>` (declared with the default `KEEP`: no purge unless a period is set for the
  organization; 120 days suggested) and
  `data-exchange.files` (30 days, this plugin's files only) declared through `RETENTION_SOURCES` and purged by the runner
  of `access-control-and-security` (own `data-exchange.purge` only while it is not loaded, and only for this plugin's files); confirmed purge route.
  Files: `dx/recycle/data-exchange-retention-sources.ts`, `dx/recycle/data-exchange-purge.job.ts`,
  `dx/recycle/recycle-bin.controller.ts`. Test: purge after a period set for the organization; nothing purged while none is set, also while
  `access-control-and-security` is not loaded; a legal hold keeps an entry; purge without
  `confirm` refused.
- [ ] **T35** (parallel). Archive rules with optional export first, due by the core recurrence module of
  `business-document-engine` T62 (`packages/core/src/lib/recurrence/`), `data-exchange.archive`. Files:
  `dx/recycle/data-archive-rule.service.ts`, `dx/recycle/data-archive-rule.controller.ts`, `dx/recycle/data-archive.job.ts`.
  Test: archived records marked and exported; preview writes nothing.
- [ ] **T36**. Migration toolkits: `registerMigrationToolkits`, the starter kit, checklist page, toolkit runs as parent
  core operations with one child import operation per step, dry run of all steps, step dependencies, external ids shared
  through `integration_map`. Files: `dx/toolkits/toolkit.service.ts`, `dx/toolkits/toolkit.controller.ts`,
  `dx/toolkits/toolkit.operation.ts`, `dx/toolkits/starter-kit.ts`, `dxui/pages/toolkits/toolkit-checklist.component.ts`.
  Test: the starter kit loads an empty organization in order.
- [ ] **T37** (parallel). Automation actions `data.export_view` and `data.import_from_link`; impact analysis contribution
  for custom fields used by templates. Files: `dx/automation/data-exchange-automation-actions.ts`,
  `dx/automation/custom-field-impact.contribution.ts`. Test: a flow exports a view once per run key.
- [ ] **T38** (parallel). Report definitions of spec FR-81 registered with `registerReportDatasets`. Files:
  `dx/reports/data-exchange-reports.ts`. Test: figures on
  seeded data.

## Phase 6 — Advanced capabilities (plan phase 3)

- [ ] **T39**. Learned mappings: header shape, `LEARNED` templates, `data_value_memory`, fuzzy shape match. Files:
  `dx/map/learned-mappings.ts`. Test: a second
  file of the same shape maps itself; a different shape is not touched.
- [ ] **T40**. Duplicates before writing against existing records (blocking keys, similarity), decisions per row or for
  all, merge decision through the merge engine. Files: `dx/validate/existing-duplicates.ts`,
  `dx/import/data-import.controller.ts` (`decisions`). Test: 12 seeded duplicates found; each decision applied, and with
  the source file deleted after the dry run a `CREATE` and an `UPDATE_EXISTING` decision write the stored values.
- [ ] **T41**. Batch undo of imports (created to the recycle bin, updated fields restored, changed records kept and
  listed); MCP `data_import_undo` with preview. Files: `dx/import/import-undo.service.ts`, `mcp/tools/data-exchange.ts`.
  Test: undo after edits keeps the edited records.
- [ ] **T42**. Merge undo from the journal within 7 days. Files: `dx/merge/merge-undo.service.ts`. Test: references moved back; changed rows left and listed; two contacts carrying the same tag, merged and undone, both carry the tag again.
- [ ] **T43**. Assisted cleaning: `assist` route through `DATA_EXCHANGE_ASSISTANT`, headers and 20 rows only, proposed
  transforms validated against the grammar, before-and-after preview, saved as an `ASSISTANT` template. Files:
  `dx/assist/import-assistant.service.ts`, `dxui/pages/import-wizard/assistant-pane.component.ts`. Test: payload
  spec; an invalid proposal is refused.
- [ ] **T44**. Recurring imports from a link or a drive folder and scheduled exports (`data_schedule` on the shared
  recurrence and period-claim rules, the run carrying `scheduleId` and `periodKey`, `data-exchange.schedules`, unchanged
  files skipped, owner losing permission pauses). Files: `dx/schedule/data-schedule.service.ts`,
  `dx/schedule/data-schedule.controller.ts`, `dx/schedule/data-schedules.job.ts`. Test: same file twice imports once; one run per period after a retry.
- [ ] **T45** (parallel). Duplicate candidates nightly job and review page; MCP `records_merge_preview`, `records_merge`.
  Files: `dx/merge/duplicate-candidates.job.ts`, `dxui/pages/duplicates/duplicates-page.component.ts`,
  `mcp/tools/data-exchange.ts`. Test: candidate pair unique; dismissed pair not proposed again.
- [ ] **T46**. Benchmarks: 1,000 and 100,000 contacts import, 1,000,000-row export, merge with 10,000 references on
  PostgreSQL and MySQL. Files: `tools/perf/data-exchange-bench.mjs`. Test: report attached to the PR.
- [ ] **T47**. Provide the ports other features bind to (plan, **Consumer tokens answered**): `ACCOUNTING_DATA_EXCHANGE`, `SHEETS_BULK_CHANGE`. Files: `apps/api/src/plugin-composition.ts`. Test: one contract test per token over the shape its consumer plan states; with this feature off each consumer keeps its stated fallback.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Scope, flags and compatibility | T4, T11 |
| FR-2 | §3.1 Scope, flags and compatibility | T11, T13, T15, T17 |
| FR-3 | §3.1 Scope, flags and compatibility | T4, T21 |
| FR-4 | §3.2 Import targets | T2, T22 |
| FR-5 | §3.2 Import targets | T2, T27 |
| FR-6 | §3.2 Import targets | T24 |
| FR-7 | §3.2 Import targets | T6, T11, T22 |
| FR-8 | §3.2 Import targets | T22 |
| FR-9 | §3.2 Import targets | T15, T16, T17 |
| FR-10–FR-11 | §3.3 Files and reading | T7 |
| FR-12 | §3.3 Files and reading | T8 |
| FR-13 | §3.3 Files and reading | T9, T11, T16 |
| FR-14 | §3.3 Files and reading | T7 |
| FR-15–FR-19 | §3.4 Mapping | T8 |
| FR-20 | §3.4 Mapping | T28 |
| FR-21 | §3.4 Mapping | T8 |
| FR-22–FR-24 | §3.5 Validation, dry run and duplicates | T9 |
| FR-25 | §3.5 Validation, dry run and duplicates | T10, T11 |
| FR-26 | §3.5 Validation, dry run and duplicates | T9 |
| FR-27 | §3.5 Validation, dry run and duplicates | T9, T10 |
| FR-28–FR-29 | §3.6 Modes and structures | T23 |
| FR-30 | §3.6 Modes and structures | T24 |
| FR-31–FR-32 | §3.6 Modes and structures | T25 |
| FR-33 | §3.6 Modes and structures | T26 |
| FR-34–FR-36 | §3.7 Running imports | T10 |
| FR-37 | §3.7 Running imports | T11, T28 |
| FR-38 | §3.7 Running imports | T10, T20 |
| FR-39 | §3.7 Running imports | T10 |
| FR-40 | §3.7 Running imports | T11 |
| FR-41 | §3.8 Exports | T12 |
| FR-42 | §3.8 Exports | T12 |
| FR-43 | §3.8 Exports | T23 |
| FR-44 | §3.8 Exports | T12 |
| FR-45–FR-46 | §3.8 Exports | T12 |
| FR-47 | §3.8 Exports | T48 |
| FR-48–FR-51 | §3.9 Bulk change | T29 |
| FR-52 | §3.10 Rename and merge | T30 |
| FR-53–FR-54 | §3.10 Rename and merge | T32 |
| FR-55 | §3.10 Rename and merge | T31, T32 |
| FR-56–FR-57 | §3.10 Rename and merge | T32 |
| FR-58 | §3.10 Rename and merge | T42 |
| FR-59 | §3.11 Recycle bin, safeguards and archiving | T13, T15 |
| FR-60–FR-61 | §3.11 Recycle bin, safeguards and archiving | T13 |
| FR-62 | §3.11 Recycle bin, safeguards and archiving | T34 |
| FR-63 | §3.11 Recycle bin, safeguards and archiving | T33 |
| FR-64 | §3.11 Recycle bin, safeguards and archiving | T35 |
| FR-65 | §3.11 Recycle bin, safeguards and archiving | T34 |
| FR-66–FR-67 | §3.12 Migration toolkits | T36 |
| FR-68 | §3.12 Migration toolkits | T2, T36 |
| FR-69 | §3.13 Advanced capabilities | T39 |
| FR-70 | §3.13 Advanced capabilities | T40 |
| FR-71 | §3.13 Advanced capabilities | T41 |
| FR-72 | §3.13 Advanced capabilities | T43 |
| FR-73–FR-74 | §3.13 Advanced capabilities | T44 |
| FR-75 | §3.13 Advanced capabilities | T45 |
| FR-76 | §3.14 API, MCP, events and reports | T11, T12, T13 |
| FR-77 | §3.14 API, MCP, events and reports | T19, T41, T45 |
| FR-78 | §3.14 API, MCP, events and reports | T14 |
| FR-79 | §3.14 API, MCP, events and reports | T20, T37 |
| FR-80 | §3.14 API, MCP, events and reports | T37 |
| FR-81 | §3.14 API, MCP, events and reports | T38 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off; enabling it in dev shows the feature end to end.
- Constitution gates in `spec.md` §9 confirmed.
- Feature checks: imports validate exactly as forms and never write a row twice; a dry run writes nothing; exports never
  show a masked field or an unreadable record; a merge leaves no reference to a merged id and undoes; undo never
  reverts a record changed afterwards; 1,000 records import in under 10 seconds; with `FEATURE_DATA_EXCHANGE` off every
  new route answers `404` and the tenant export and import behaves as before (AC-18).
