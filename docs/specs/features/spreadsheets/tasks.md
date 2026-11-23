# Task Breakdown: Spreadsheets

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `spreadsheets`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold. A spec file named in a `Test:` clause without a full path sits under the `src/lib/` folder of the package the task changes (beside the file it tests).
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind `GAUZY_SHEETS_ENABLED` and `FEATURE_SPREADSHEETS`: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it. `sh/` means
  `packages/plugins/sheets/src/lib/`, `ui/` means `packages/plugins/sheets-ui/src/lib/`, `react/` means
  `packages/plugins/sheets-react-ui/src/lib/`, `model/` means `packages/sheets-model/src/lib/`.
- Gate: every route, GraphQL field, menu entry and MCP tool of these tasks is gated by `FEATURE_SPREADSHEETS` (`@FeatureFlag`); the MCP group also needs `GAUZY_MCP_TOOLS_SHEETS`. The library `packages/sheets-model` and the docs live codec seam (T4 to T6) carry no gate: they keep today's behaviour for every existing kind.
- Phases 1 to 4 deliver plan phase 1; Phase 5 plan phase 2 (depth); Phase 6 plan phase 3 (advanced).
- Needs: `REPORT_RUNS` (report-builder), the record query of record-views and the bulk change of data-exchange for
  Phase 6 only; drive's file kind registry, file store and New menu (drive T9, T27, T37) before T12 and T17; the hub's
  template fields and gallery and the `CELL` comment anchor kind (`documents-and-wiki` T4, T17) before T12 and T31;
  the core recurrence module (`business-document-engine` T62) before T45; the live codec seam (T4 to T6) is shared with
  `presentations`, which waits for it.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Building-block spike in `packages/sheets-model/spike/` (not shipped): mount the candidate grid in a React
  component shown in the Angular app through `@gauzy/ui-react`, map its commands onto the CRDT model of plan §3, run the 300-case formula conformance set in the
  browser and in Node, read and write XLSX and ODS fixtures; record the choice, versions and licence files in
  `packages/sheets-model/BUILDING-BLOCKS.md`. Files: `packages/sheets-model/spike/`, `packages/sheets-model/BUILDING-BLOCKS.md`,
  `packages/sheets-model/fixtures/conformance/` (the 300 cases), `packages/sheets-model/fixtures/files/` (XLSX and ODS).
  Test: `model/formula/conformance.spec.ts` and `model/workbook/concurrent-edit.property.spec.ts`, the conformance and concurrent-edit property tests the later tasks keep.
- [ ] **T2**. Contracts `packages/contracts/src/lib/sheets.model.ts` (plan §3); `IDocumentLiveCodec`, the
  `DOCS_LIVE_SESSIONS` token and the `live` and `maxStateBytes` fields of a file kind entry in `document-drive.model.ts`;
  the `LINK_PREVIEWS` token; export from `index.ts`. Files: `packages/contracts/src/lib/sheets.model.ts`,
  `packages/contracts/src/lib/document-drive.model.ts` (created by `drive` T1), `packages/contracts/src/index.ts`. Test:
  `packages/contracts/src/lib/sheets.model.spec.ts` contract specs (existing values unchanged).
- [ ] **T3**. Library scaffold `packages/sheets-model` (package, project, tsconfig, jest, eslint, licence gate entry):
  `model/workbook/` (CRDT layout, stable row and column ids, fractional positions, id-form references and A1 rendering).
  Files: `packages/sheets-model/{package.json,project.json,tsconfig.json,jest.config.ts,eslint.config.cjs,src/index.ts}`,
  `model/workbook/{workbook-doc.ts,row-col-ids.ts,fractional-position.ts,references.ts,a1.ts}`, `tsconfig.json`.
  Test: `model/workbook/references.spec.ts`: insert and delete rows concurrently in two documents; references stay correct after merge.
- [ ] **T4**. File kind fields in drive's registry and file store: `maxStateBytes` honoured by `DocumentFileStoreService`
  for that kind only, `live` read by the live module. Files: `packages/core/src/lib/document-registry/document-file-kind.registry.ts`
  (drive T9), `packages/plugins/docs/src/lib/services/document-file-store.service.ts` (drive T27). Test:
  `packages/plugins/docs/src/lib/services/document-file-store.max-state.spec.ts`: a fake kind with a larger limit stores a bigger state; other
  kinds keep `GAUZY_DOCS_MAX_BINARY_BYTES`.
- [ ] **T5**. Live codec seam in `packages/plugins/docs/src/lib/live/`: `document-live.codec.ts`, `page-live.codec.ts` (today's
  `document-live.yjs.ts` behaviour), `DocumentLiveService` opening sessions on pages and on files whose kind declares a codec.
  Files: `packages/plugins/docs/src/lib/live/{document-live.codec.ts,page-live.codec.ts,document-live.service.ts,document-live.yjs.ts}`.
  Test: the existing `document-live.service.spec.ts` and `document-live.yjs.spec.ts` pass unchanged; `live/document-live.codec.spec.ts`: a fake kind's codec
  is used for its files.
- [ ] **T6**. `packages/plugins/docs/src/lib/live/document-live-sessions.service.ts` (`DOCS_LIVE_SESSIONS`: `applyServerUpdate`, `readState`,
  `onAccessChanged`), bound in `apps/api/src/plugin-composition.ts`. Files: `packages/plugins/docs/src/lib/live/document-live-sessions.service.ts`,
  `packages/plugins/docs/src/lib/live/docs-live.module.ts`, `apps/api/src/plugin-composition.ts`. Test:
  `live/document-live-sessions.service.spec.ts`: a server update merges into an open session of
  a fake kind, and into the stored state through `DOCS_FILE_STORE.write` when none is open.
- [ ] **T7**. Plugin scaffold `packages/plugins/sheets` (package, project, tsconfig, jest, eslint), `sh/sheets-enabled.ts`
  (exact `true`), `sh/sheets.features.ts`, `apps/api/src/plugins.ts`, `apps/worker/src/plugins.ts`, `.env.sample`
  (`GAUZY_SHEETS_ENABLED`, `GAUZY_SHEETS_MAX_STATE_BYTES`, `GAUZY_MCP_TOOLS_SHEETS`). Files:
  `packages/plugins/sheets/{package.json,project.json,tsconfig.json,jest.config.ts,eslint.config.cjs,src/index.ts}`,
  `sh/{sheets-enabled.ts,sheets.features.ts,sheets.module.ts}`, `apps/api/src/plugins.ts`, `apps/worker/src/plugins.ts`,
  `.env.sample`. Test: `sh/sheets-enabled.spec.ts` flag spec; plugin list specs.
- [ ] **T8**. On the shared core migration helpers of `procurement` T4 (`@gauzy/core`), entities and migrations
  `1791000064100` to `1791000064130`. Files: `sh/database/migrations/{1791000064100-CreateSheetWorkbookTables.ts,1791000064110-CreateSheetHistoryTables.ts,1791000064120-CreateSheetLiveRangeTables.ts,1791000064130-CreateSheetSnapshotTables.ts,index.ts}`,
  `sh/workbook/sheet-workbook.entity.ts`, `sh/history/{sheet-cell-change.entity.ts,sheet-cell-change-daily.entity.ts}`,
  `sh/live-ranges/{sheet-live-range.entity.ts,sheet-live-range-result.entity.ts,sheet-live-range-refresh.entity.ts}`,
  `sh/write-back/{sheet-pending-change.entity.ts,sheet-write-back-result.entity.ts}`,
  `sh/snapshots/{sheet-snapshot-schedule.entity.ts,sheet-snapshot.entity.ts}`, each with its TypeORM and MikroORM
  repository in `repository/` beside it. Test: `sh/database/sheets.migration.spec.ts` on SQLite (up twice); mapping under both ORMs. Migration timestamps: `1791000064100` to `1791000064199` (`packages/plugins/sheets`).
- [ ] **T9**. Contributions of the plugin (`sh/sheets.plugin.ts`, `sh/sheets.settings.ts`): the `FEATURE_SPREADSHEETS`
  feature, the permissions of plan §9 with `defaultFor`, the settings. Files: `sh/{sheets.plugin.ts,sheets.settings.ts,sheets.permissions.ts}`.
  Test: `sh/sheets.plugin.spec.ts`: the plugin contributions report lists them;
  the feature starts off for every tenant; grants as plan §9 on a new tenant and through the permission reload.

## Phase 2 — Services, endpoints, events

- [ ] **T10**. `sheet` codec `sh/live/sheet-live.codec.ts`: seed from the stored state, `assertAcceptable` (schema of
  the workbook map, limits), `toStored` (manifest, counts into `sheet_workbook`), `applyServerUpdate`, `onPersist`.
  Files: `sh/live/sheet-live.codec.ts`. Test: `sh/live/sheet-live.codec.spec.ts`; two sessions edit one sheet through the docs live service and persist one state.
- [ ] **T11**. Formula engine adapter `model/formula/` (the engine chosen in T1, workbook time zone and locale, volatile
  functions, typed errors, circular paths, spill) and server recalculation `sh/services/workbook-compute.service.ts`.
  Files: `model/formula/{formula-engine.ts,locale-input.ts,errors.ts}`, `sh/services/workbook-compute.service.ts`.
  Test: `model/formula/conformance.spec.ts` in Node and jsdom with identical results; `model/formula/locale-input.spec.ts`:
  input parsed by the workbook's locale, leading zeros kept in text cells.
- [ ] **T12**. `sheet` file kind registration (`createBlank`, also from a template's state, `render` to XLSX, ODS, CSV
  and PDF, `extractText`, `thumbnail`, `openRoute`); workbook service and controller over `DOCS_FILE_STORE`: create
  (blank, from a template of the hub's gallery), manifest, settings, sheets operations, limits of FR-7; template
  marking through the hub's `/documents/:id/template`; GraphQL reads. A download without the plugin is the XLSX copy.
  Files: `sh/workbook/{sheet-file-kind.ts,workbook.service.ts,workbook.controller.ts,workbook-limits.ts,dto/}`,
  `sh/graphql/{schema-extensions.ts,resolvers/workbook.resolver.ts}`. Test: `sh/workbook/workbook.controller.spec.ts`
  e2e (permissions through the hub, `404` with the feature off, limit refusals, the last visible sheet cannot be hidden
  or deleted); `sh/workbook/sheet-file-kind.spec.ts`: `extractText` gives the cells to search; every existing hub
  route keeps working for an uploaded spreadsheet that is not opened.
- [ ] **T13**. Range service and controller: read (values, formulas, text), write with `expectedRevision` and `preview`,
  merged into open sessions through `DOCS_LIVE_SESSIONS`. Files: `sh/ranges/{range.service.ts,range.controller.ts,dto/}`.
  Test: `sh/ranges/range.controller.spec.ts` e2e; a write reaches an open session; stale revision is `409`.
- [ ] **T14**. File codecs `model/files/`: XLSX through the library of plan §2, ODS through our ODF code, CSV and TSV with encoding,
  delimiter and header detection; import report. Files: `model/files/{xlsx.codec.ts,ods.codec.ts,csv.codec.ts,import-report.ts}`.
  Test: `model/files/xlsx.codec.spec.ts`, `model/files/ods.codec.spec.ts`, `model/files/csv.codec.spec.ts` round-trip fixtures (formats, merges, widths, frozen panes,
  validation, conditional formats, names); macros listed as dropped; 20-row CSV preview.
- [ ] **T15**. Import and export services: `POST /workbooks/from-file`, `…/import`, `…/export`; operations
  `sheets.import`, `sheets.export`; automatic version before an import; CSV through `spreadsheet-safe-row.ts`. Files:
  `sh/import-export/{workbook-import.service.ts,workbook-export.service.ts,import-export.controller.ts,sheets-import.operation.ts,sheets-export.operation.ts}`,
  `packages/core/src/lib/export-import/spreadsheet-safe-row.ts` (used unchanged). Test: `sh/import-export/import-export.controller.spec.ts` e2e
  for each format; a 100,000-row CSV runs in the background; injection cells neutralised; import as new sheets leaves existing sheets unchanged.
- [ ] **T16**. Events `sh/events/` (`sheets.*` through the outbox), realtime hints `sheet:<documentId>`, notification
  categories; `DOCS_LIVE_SESSIONS.onAccessChanged` handling (trash pauses, restore resumes). Files:
  `sh/events/{sheets.events.ts,sheets-realtime.publisher.ts,sheets-access.listener.ts,index.ts}`,
  `sh/sheets.notification-categories.ts`. Test: `sh/events/sheets.events.spec.ts` event specs;
  `sh/events/sheets-access.listener.spec.ts`: trash closes sessions; unsharing closes the receiver's session; permanent
  deletion removes cell history, live ranges and schedules.

## Phase 3 — UI surfaces

- [ ] **T17**. Hub entry points over drive's New and Open with menus (drive T37): the template gallery behind New →
  Spreadsheet, Open with → Spreadsheet creating a workbook beside the file, the `sheet` icon and opener. Files:
  `ui/sheets-ui.plugin.ts`, `ui/entry-points/{sheet-file-kind.ui.ts,sheet-icon.ts}`,
  `packages/plugins/docs-ui/src/lib/dialogs/create-dialog.component.ts` (drive T37). Test:
  `ui/entry-points/sheet-file-kind.ui.spec.ts` rendering specs with the registered kind; the original file is untouched.
- [ ] **T18**. Angular `packages/plugins/sheets-ui`: plugin registration, routes `sheet/:id` and
  `sheet/:id/version/:versionId` at `documents-sections` as host pages mounting the React `WorkbookEditor` with
  `LazyReactHostDirective` of `@gauzy/ui-react` (host context: docs live client, translation, theme, navigation),
  Settings → Spreadsheets page; i18n `SHEETS.*` in every locale. Files:
  `packages/plugins/sheets-ui/{package.json,project.json,ng-package.json,src/index.ts}`,
  `ui/{sheets-ui.plugin.ts,sheets-ui.routes.ts,pages/workbook-host-page.component.ts,pages/workbook-version-host-page.component.ts,settings/sheets-settings-page.component.ts}`,
  `packages/ui-core/i18n/assets/i18n/*.json`. Test: `ui/pages/workbook-host-page.component.spec.ts`: host page renders the editor; hidden on `404`;
  no grid code in the Angular package.
- [ ] **T19**. Editor live binding in `react/live/workbook-live.binding.ts` over the
  docs live client passed by the host (sync, updates, awareness, read-only modes, single-writer fallback with the
  revision check), presence avatars and selections. Files: `react/live/workbook-live.binding.ts`,
  `react/components/presence-avatars.tsx`. Test: `react/live/workbook-live.binding.spec.ts` with a fake channel;
  fallback spec with the live flag off; a session turned read-only on an access change.
- [ ] **T20**. Clipboard and shortcuts in the React editor (`react/clipboard/`, `react/shortcuts/`),
  shortcut help dialog; import dialog with CSV preview, export dialog. Files: `react/clipboard/{clipboard.ts,html-table.ts}`,
  `react/shortcuts/{shortcuts.ts,shortcut-help-dialog.tsx}`, `react/dialogs/{import-dialog.tsx,export-dialog.tsx}`.
  Test: `react/clipboard/clipboard.spec.ts` clipboard round trip (values, formulas, formats, tab-separated text and HTML table); dialog specs.
- [ ] **T21**. React `packages/plugins/sheets-react-ui` (the one editor): `WorkbookEditor` (grid host, formula bar with
  suggestions and help, sheet tabs, toolbar for formats, status bar aggregates, zoom, freeze, resize, insert and delete,
  side panels), `RangeView` (read-only, for embeds in pages and decks), `useWorkbookLive`. Files:
  `packages/plugins/sheets-react-ui/{package.json,project.json,src/index.ts}`,
  `react/components/{workbook-editor.tsx,grid-host.tsx,formula-bar.tsx,sheet-tabs.tsx,format-toolbar.tsx,status-bar.tsx,range-view.tsx}`,
  `react/hooks/use-workbook-live.ts`. Test: `react/components/workbook-editor.spec.tsx` rendering tests;
  `react/components/grid-host.keyboard.spec.tsx` keyboard navigation spec; `formula-bar.spec.tsx`: function suggestions and help.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T22**. MCP group `sheets` (`collaboration/sheets.ts`, switch, scopes): `list_workbooks`, `get_workbook`,
  `read_range`, `update_range`, `append_table_rows`, `create_workbook` with `preview` defaults. Files:
  `packages/mcp-server/src/lib/tools/collaboration/{sheets.ts,scopes.ts,index.ts}`. Test:
  `packages/mcp-server/src/lib/tools/collaboration/sheets.spec.ts` collaboration tool
  specs (scopes, preview writes nothing).
- [ ] **T23**. OpenAPI regenerated; SDK regeneration noted for release; user docs page for spreadsheets; plugin README.
  Files: `packages/core/src/lib/bootstrap/swagger.ts`, `packages/plugins/sheets/README.md`, `docs/specs/README.md`. Test: OpenAPI snapshot includes the new routes.

## Phase 5 — Depth

- [ ] **T24**. Conditional formats and validation (`model/rules/`, editor panels), order and stop-if-true, range shifting.
  Files: `model/rules/{conditional-format.ts,validation.ts,range-shift.ts}`, `react/panels/{conditional-format-panel.tsx,validation-panel.tsx}`.
  Test: `model/rules/conditional-format.spec.ts` and `model/rules/validation.spec.ts` rule evaluation specs; ranges move with inserts.
- [ ] **T25**. Sort, shared filters, personal filter views (per user, outside the shared state), slicers. Files:
  `model/data/{sort.ts,filter.ts,slicer.ts}`, `react/panels/{filter-panel.tsx,slicer.tsx}`,
  `sh/workbook/filter-views.service.ts`. Test: `sh/workbook/filter-views.service.spec.ts`: a personal
  view does not change another session; `model/data/slicer.spec.ts`: slicer drives a table filter; sort is one undo step.
- [ ] **T26**. Pivots `model/pivot/` (rows, columns, values, filters, refresh on source change) and the pivot editor.
  Files: `model/pivot/{pivot.ts,pivot-refresh.ts}`, `react/panels/pivot-editor.tsx`.
  Test: `model/pivot/pivot.spec.ts` pivot results on fixtures; refresh after a source edit.
- [ ] **T27**. Charts and sparklines on the platform charting stack (types of FR-35, table view), chart editor. Files:
  `react/charts/{chart-layer.tsx,chart-editor.tsx,chart-table-view.tsx}`, `model/charts/{chart-spec.ts,sparkline.ts}`.
  Test: `react/charts/chart-layer.spec.tsx`: each type renders
  from a range and a pivot; accessible table present; `model/charts/sparkline.spec.ts`.
- [ ] **T28** (parallel). Named ranges, named functions, local names, cross-workbook references with the reader's access.
  Files: `model/formula/{names.ts,named-functions.ts}`, `sh/ranges/cross-workbook-reference.service.ts`. Test:
  `sh/ranges/cross-workbook-reference.service.spec.ts`: reference error for an unreadable workbook; value follows the source; `model/formula/names.spec.ts`.
- [ ] **T29**. Fill series and pattern fill, split text, find and replace across sheets. Files:
  `model/data/{fill-series.ts,pattern-fill.ts,split-text.ts,find-replace.ts}`, `react/dialogs/{split-text-dialog.tsx,find-replace-dialog.tsx}`.
  Test: `model/data/fill-series.spec.ts` and `model/data/pattern-fill.spec.ts` series and pattern specs;
  `model/data/find-replace.spec.ts`: replace is one undo step.
- [ ] **T30**. Protection: editor panel, codec check, host write check, warning protections. Files:
  `model/rules/protection.ts`, `sh/live/sheet-live.codec.ts`, `sh/ranges/protection.guard.ts`, `react/panels/protection-panel.tsx`.
  Test: `sh/ranges/protection.guard.spec.ts`: paste, API write, MCP
  write and import into a protected range refused; warning records the change.
- [ ] **T31**. Cell comments: core comments on the workbook's `Document` anchored by `document_comment_anchor` rows of
  kind `CELL` (locator: sheet, row and column keys, label) through the hub's existing anchor routes, markers, threads
  panel, anchors follow moved cells through the stable row and column ids, `ORPHANED` state when the row or column is
  deleted. Files: `sh/comments/cell-comment-anchors.service.ts`, `react/panels/comments-panel.tsx`,
  `react/components/comment-markers.tsx`. Test: `sh/comments/cell-comment-anchors.service.spec.ts`: comment with mention notifies; anchor survives a row insert; a page's text anchors are untouched.
- [ ] **T32**. Cell history: change capture in the codec's persist (`sheet_cell_change`), cell history route and popover,
  version diff route and comparison view, named and pinned versions, restore. Files:
  `sh/history/{cell-history.service.ts,cell-history.controller.ts,version-diff.service.ts}`, `model/diff/workbook-diff.ts`,
  `react/panels/{cell-history-popover.tsx,versions-panel.tsx}`. Test: `sh/history/cell-history.service.spec.ts`: two edits by two people listed;
  `model/diff/workbook-diff.spec.ts`: diff of two versions; restore creates a version; automatic versions at most every 10 minutes.
- [ ] **T33** (parallel). Personal undo and redo over the user's own origins, including sort, paste, replace and import.
  Files: `react/history/personal-undo.ts`. Test: `react/history/personal-undo.spec.ts`: undo leaves another session's edits.
- [ ] **T34**. PDF export through `SHEETS_PRINT` (standard template registered with `registerPrintTemplates`, page setup)
  and the fallback through the docs plugin's `pdf/pdf-render.ts`. Files: `sh/import-export/{workbook-pdf.service.ts,sheets.print-templates.ts}`,
  `packages/plugins/docs/src/lib/pdf/pdf-render.ts` (used unchanged). Test: `sh/import-export/workbook-pdf.service.spec.ts`: page setup honoured; fallback without the print
  plugin.
- [ ] **T35**. Link previews through `LINK_PREVIEWS`: the chat plugin binds its `ChatLinkPreviewService` (its egress
  guard and `chat_link_preview` cache) as the port in `apps/api/src/plugin-composition.ts`; `GET /link-preview` and the
  cell card; record cards on hover. Files: `packages/plugins/chat/src/lib/link-preview/chat-link-preview.service.ts`,
  `apps/api/src/plugin-composition.ts`, `sh/links/{link-preview.controller.ts,record-card.service.ts}`,
  `react/components/link-card.tsx`. Test: chat link preview specs unchanged; `sh/links/link-preview.controller.spec.ts`: a blocked private address yields no card;
  the second request is a cache hit in `chat_link_preview`; without the chat plugin links show without a card.
- [ ] **T36**. `sheets.history-thin` job and FR-82 timeline route and page; CSV export of the timeline. Files:
  `sh/jobs/history-thin.job.ts`, `sh/history/timeline.controller.ts`, `ui/pages/version-timeline-page.component.ts`.
  Test: `sh/jobs/history-thin.job.spec.ts`: thinning keeps named versions;
  `sh/history/timeline.controller.spec.ts`: timeline counts on seeded data; CSV export.

## Phase 6 — Advanced capabilities

- [ ] **T37**. Live range service `sh/live-ranges/`: bindings CRUD, refresh through `REPORT_RUNS` and `SHEETS_RECORD_ROWS`,
  per-access results, growth and spill-blocked rule, refresh log (FR-83). Files:
  `sh/live-ranges/{live-range.service.ts,live-range.controller.ts,live-range-refresh.service.ts,live-range-result.store.ts,dto/}`.
  Test: `sh/live-ranges/live-range.service.spec.ts`: two readers with different access get
  different rows; a forbidden reader gets none; growth never overwrites a cell outside the range (spill blocked names the cell); each refresh logged.
- [ ] **T38**. Client live overlay: results fed to the formula engine as an outside source, live badge with time, refresh
  button, source pickers (report definitions with prompts, saved views with columns). Files:
  `react/live-ranges/{live-overlay.ts,live-badge.tsx,live-range-builder.tsx}`, `react/hooks/use-live-range.ts`.
  Test: `react/live-ranges/live-overlay.spec.ts`: formulas over a live range
  compute per reader; nothing enters the shared state.
- [ ] **T39**. Refresh modes: on open, manual, `sheets.live-refresh-tick` schedules, `subscriber:sheets-live-ranges` for
  `LIVE`; owner notice after three failures; `sheets.result-expiry`. Files: `sh/jobs/{live-refresh-tick.job.ts,result-expiry.job.ts}`,
  `sh/live-ranges/sheets-live-ranges.subscriber.ts`, `sh/schedule/sheets-schedule.plugin.ts`. Test:
  `sh/live-ranges/sheets-live-ranges.subscriber.spec.ts`: a dataset event refreshes an open `LIVE`
  range; `sh/jobs/live-refresh-tick.job.spec.ts`: three failures notify once; results reused for 5 minutes on open.
- [ ] **T40**. Lineage route and panel; freeze with `confirmAudience` and the tenant switch. Files:
  `sh/live-ranges/{lineage.service.ts,lineage.controller.ts,live-range-freeze.service.ts}`, `react/panels/lineage-panel.tsx`.
  Test: `sh/live-ranges/lineage.service.spec.ts`: lineage drill link opens
  the records; `sh/live-ranges/live-range-freeze.service.spec.ts`: freeze refused without confirmation or when switched off.
- [ ] **T41**. Typed tables `model/tables/`: header, totals, growth, field types and validation with the form rules of
  `CUSTOM_FIELD_METADATA` and the shared field validators; choice, person and record reference pickers. Files:
  `model/tables/{typed-table.ts,column-types.ts,table-validation.ts}`, `react/tables/{typed-table-panel.tsx,reference-pickers.tsx}`.
  Test: `model/tables/table-validation.spec.ts`: invalid date
  and choice rejected with the form's messages; pickers list only readable values.
- [ ] **T42**. Record-backed tables and pending changes (`sheet_pending_change`, per user), apply with preview through
  `SHEETS_BULK_CHANGE`, the core operation `sheets.write-back` (registered in `OperationRegistry`; status and counts from
  the bulk change run), per-row results in `sheet_write_back_result` (FR-84), stale refusal, version before apply.
  Files: `sh/write-back/{pending-change.service.ts,write-back.controller.ts,sheets-write-back.operation.ts,write-back-results.controller.ts}`,
  `react/panels/pending-changes-panel.tsx`. Test: `sh/write-back/sheets-write-back.operation.spec.ts` e2e preview writes nothing; one stale row refused; 38 written; the operation resumes after a restart.
- [ ] **T43** (parallel). Report dataset `sheets.table_rows` (`registerReportDatasets`, `WorkbookTableDatasetProvider`).
  Files: `sh/reports/workbook-table-dataset.provider.ts`. Test: `sh/reports/workbook-table-dataset.provider.spec.ts`: a card over a table shows only to readers of the workbook.
- [ ] **T44**. Assistant: `SHEETS_ASSISTANT` port, built-in rules first, question box, explain, fix error, suggest chart or
  pivot; sample size setting; assisted mark in cell history. Files: `sh/assistant/{sheets-assistant.service.ts,sheets-assistant.controller.ts,built-in-rules.ts}`,
  `react/panels/assistant-panel.tsx`. Test: `sh/assistant/sheets-assistant.service.spec.ts`: the provider request holds no more than the sample;
  nothing changes before acceptance; rules answer without a provider.
- [ ] **T45**. Snapshot schedules on core recurrence rules (`packages/core/src/lib/recurrence/` computes the next run):
  routes, `sheets.snapshot-tick`, diff with the previous snapshot, change highlights and panel, follower notice, live
  values only with confirmation, pruning. Files: `sh/snapshots/{snapshot-schedule.service.ts,snapshot-schedule.controller.ts,changes-since-snapshot.controller.ts}`,
  `sh/jobs/snapshot-tick.job.ts`, `react/panels/changes-panel.tsx`. Test: `sh/jobs/snapshot-tick.job.spec.ts`: weekly snapshot highlights two changed
  cells; no notice when nothing changed; live values stored only after the owner's confirmation.
- [ ] **T46**. MCP tools `insert_live_range`, `explain_cell`, `apply_pending_changes`; Settings → Spreadsheets fields
  over the setting contributions. Files: `packages/mcp-server/src/lib/tools/collaboration/sheets.ts`,
  `ui/settings/sheets-settings-page.component.ts`, `sh/settings/sheets-settings.controller.ts`. Test:
  `packages/mcp-server/src/lib/tools/collaboration/sheets.spec.ts` tool specs with `preview`; settings saved per tenant in `tenant_setting`.
- [ ] **T47**. Write-back results and refresh log pages with CSV export; spec status `Implemented` after the checks below.
  Files: `ui/pages/{write-back-results-page.component.ts,refresh-log-page.component.ts}`,
  `docs/specs/features/spreadsheets/spec.md`. Test: `ui/pages/write-back-results-page.component.spec.ts`: report pages render seeded rows and export CSV.
- [ ] **T48**. Provide the ports other features bind to (plan, **Consumer tokens answered**): `SLIDES_SHEET_RANGES`. Files: `apps/api/src/plugin-composition.ts`, `sh/ranges/slides-sheet-ranges.binding.ts`. Test: `sh/ranges/slides-sheet-ranges.binding.spec.ts`, one contract test per token over the shape its consumer plan states; with this feature off each consumer keeps its stated fallback.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Scope, workbooks and sheets | T7, T9, T12 |
| FR-2 | §3.1 Scope, workbooks and sheets | T4, T12, T17 |
| FR-3 | §3.1 Scope, workbooks and sheets | T12, T22, T23 |
| FR-4 | §3.1 Scope, workbooks and sheets | T12 |
| FR-5 | §3.1 Scope, workbooks and sheets | T12, T21 |
| FR-6 | §3.1 Scope, workbooks and sheets | T11, T12 |
| FR-7–FR-8 | §3.1 Scope, workbooks and sheets | T12 |
| FR-9 | §3.2 Grid, navigation and input | T21 |
| FR-10 | §3.2 Grid, navigation and input | T3, T21 |
| FR-11 | §3.2 Grid, navigation and input | T21 |
| FR-12 | §3.2 Grid, navigation and input | T29 |
| FR-13 | §3.2 Grid, navigation and input | T11 |
| FR-14–FR-15 | §3.2 Grid, navigation and input | T20 |
| FR-16–FR-17 | §3.3 Formulas and formats | T11 |
| FR-18 | §3.3 Formulas and formats | T21 |
| FR-19 | §3.3 Formulas and formats | T11 |
| FR-20–FR-21 | §3.3 Formulas and formats | T28 |
| FR-22 | §3.3 Formulas and formats | T11 |
| FR-23 | §3.3 Formulas and formats | T21 |
| FR-24 | §3.3 Formulas and formats | T24 |
| FR-25 | §3.4 Data tools and charts | T24 |
| FR-26–FR-27 | §3.4 Data tools and charts | T29 |
| FR-28 | §3.4 Data tools and charts | T25, T33 |
| FR-29–FR-30 | §3.4 Data tools and charts | T25 |
| FR-31 | §3.4 Data tools and charts | T26 |
| FR-32 | §3.4 Data tools and charts | T28 |
| FR-33 | §3.4 Data tools and charts | T29 |
| FR-34 | §3.4 Data tools and charts | T35 |
| FR-35–FR-37 | §3.4 Data tools and charts | T27 |
| FR-38–FR-40 | §3.5 Protection, comments, co-editing and sharing | T30 |
| FR-41 | §3.5 Protection, comments, co-editing and sharing | T31 |
| FR-42 | §3.5 Protection, comments, co-editing and sharing | T10, T19 |
| FR-43 | §3.5 Protection, comments, co-editing and sharing | T6, T13 |
| FR-44 | §3.5 Protection, comments, co-editing and sharing | T16, T19 |
| FR-45 | §3.5 Protection, comments, co-editing and sharing | T12, T16 |
| FR-46–FR-48 | §3.6 History | T32 |
| FR-49 | §3.6 History | T33 |
| FR-50 | §3.6 History | T36 |
| FR-51 | §3.7 Import, export and lifecycle | T14, T15 |
| FR-52 | §3.7 Import, export and lifecycle | T14 |
| FR-53 | §3.7 Import, export and lifecycle | T14, T15 |
| FR-54 | §3.7 Import, export and lifecycle | T14, T15, T34 |
| FR-55 | §3.7 Import, export and lifecycle | T15 |
| FR-56 | §3.7 Import, export and lifecycle | T12 |
| FR-57 | §3.7 Import, export and lifecycle | T16 |
| FR-58 | §3.8 Live data from the platform (advanced) | T37, T38 |
| FR-59 | §3.8 Live data from the platform (advanced) | T37, T39 |
| FR-60 | §3.8 Live data from the platform (advanced) | T37, T38 |
| FR-61 | §3.8 Live data from the platform (advanced) | T37 |
| FR-62 | §3.8 Live data from the platform (advanced) | T40 |
| FR-63 | §3.8 Live data from the platform (advanced) | T40 |
| FR-64 | §3.8 Live data from the platform (advanced) | T37, T39 |
| FR-65 | §3.8 Live data from the platform (advanced) | T41, T42 |
| FR-66–FR-67 | §3.8 Live data from the platform (advanced) | T42 |
| FR-68–FR-69 | §3.9 Typed tables (advanced) | T41 |
| FR-70 | §3.9 Typed tables (advanced) | T43 |
| FR-71–FR-74 | §3.10 Assistant and snapshots (advanced) | T44 |
| FR-75–FR-78 | §3.10 Assistant and snapshots (advanced) | T45 |
| FR-79 | §3.11 API, MCP, real time and reports | T13, T23 |
| FR-80 | §3.11 API, MCP, real time and reports | T22, T46 |
| FR-81 | §3.11 API, MCP, real time and reports | T16 |
| FR-82 | §3.11 API, MCP, real time and reports | T36 |
| FR-83 | §3.11 API, MCP, real time and reports | T37, T47 |
| FR-84 | §3.11 API, MCP, real time and reports | T42, T47 |
| FR-85 | §3.11 API, MCP, real time and reports | T36, T47 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off; enabling it in dev shows the feature end to end.
- Constitution gates in `spec.md` §9 confirmed.
- The page codec's live specs pass unchanged; two browsers co-edit one workbook on a dev environment.
- The formula conformance set gives identical results in the browser and the API.
- An XLSX fixture round-trips; a live range shows different rows to two readers; a write-back preview writes nothing.
- Only permissively licensed packages are used; the dependency licence gate checks every package.
