# Implementation Plan: Spreadsheets

> Translates an approved `spec.md` into architecture and tech choices. The plan owns
> implementation details; the spec owns behaviour.

**Feature ID**: `spreadsheets`
**Spec**: `./spec.md`
**Tasks**: `./tasks.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## 1. Architecture Summary

A new plugin triple, `@gauzy/plugin-sheets` (`packages/plugins/sheets`), `sheets-ui` (Angular: registration, routes,
menus and settings inside the documents hub) and `sheets-react-ui` (the one workbook editor and the read-only range
view, written once in React and mounted in the Angular app through the existing React bridge `@gauzy/ui-react`,
`ReactHostDirective` / `LazyReactHostDirective`, the way `dashboard-time-track-react-ui` and `ai-chat-react-ui` are),
loaded by `apps/api/src/plugins.ts` only when `GAUZY_SHEETS_ENABLED` is exactly `true` (its render-only module of §3
loads whenever the package is installed) and gated per tenant by
`FEATURE_SPREADSHEETS`. An isomorphic library, `@gauzy/sheets-model` (`packages/sheets-model`), holds what the browser,
the API and the worker must compute alike: the workbook model over a shared CRDT document, the formula engine adapter,
the file codecs and the version diff. It builds on what exists:

- **One storage model.** A workbook is a **file kind** of `drive`: an ordinary `FILE` row of the documents hub with
  `editorKind = 'sheet'`, registered with drive's core registry `registerDocumentFileKinds` and written through drive's
  `DOCS_FILE_STORE` port. Its native state lives in `contentBinary`, the downloadable XLSX copy in the stored blob
  (refreshed by the kind's `render`), versions in `document_version` with `source = APP`; tree, shares, visibility, team
  spaces, trash, quotas, favourites, search (the kind's `extractText`), thumbnails, New and "Open with" are drive's. The
  plugin never writes hub tables.
- **One co-editing transport.** The docs plugin's live module (`packages/plugins/docs/src/lib/live/`,
  `Subscription.documentLive`, `POST …/live/updates`, `…/live/awareness`, persistence, relay over the shared pub/sub,
  access re-checks, limits, server-side writes merged into open sessions) gains a **live codec** seam: a file kind may
  declare a codec, and pages keep today's ProseMirror mapping as the page codec with no behaviour change. This plugin
  adds the seam (shared with `presentations`) and registers the `sheet` codec.
- **Platform data** comes from `REPORT_RUNS` (report-builder) and the record query of `record-views-and-search`, computed
  per reader; write-back goes through the bulk change of `data-import-export` inside a core operation; comments are core
  comments on the workbook's `Document` record, governed by the docs plugin's existing `DocumentCommentAccessPolicy`,
  and their cell anchors are rows of the hub's one `document_comment_anchor` table (kind `CELL`).
- **Hub pieces, not copies**: templates are the hub's template fields and gallery (`documents-and-wiki`); link previews
  come from the chat plugin's link preview service and its `chat_link_preview` cache
  (`packages/plugins/chat/src/lib/link-preview/`, behind its egress guard) through a port; the PDF fallback is the docs
  plugin's `pdf/pdf-render.ts`; snapshot schedules use the core recurrence module; permissions, the feature and
  settings are plugin contributions.

```mermaid
flowchart LR
    NG[Angular sheets-ui in the documents hub, hosting the React WorkbookEditor through @gauzy/ui-react] --> API
    TEAMS[Ever Teams client over the same API] --> API
    MCP[MCP sheets tools] --> API
    NG <-- documentLive frames --> LIVE
    API[sheets controllers + GraphQL reads] --> SVC[Workbook, range, live range, write-back, snapshot services]
    SVC --> MODEL[[@gauzy/sheets-model: CRDT workbook, formula engine, codecs, diff]]
    SVC --> HOST[[DOCS_FILE_STORE + DOCS_LIVE_SESSIONS: drive files, versions, access, live writes]]
    LIVE[docs live service] --> CODEC[sheet live codec: seed, protection check, persist, cell history]
    CODEC --> MODEL
    HOST & LIVE --> DB[(document FILE editorKind sheet, document_version)]
    SVC --> SDB[(sheet_* tables)]
    SVC --> RR[[REPORT_RUNS]] & RV[[SHEETS_RECORD_ROWS → record views]]
    SVC --> BC[[SHEETS_BULK_CHANGE → data exchange]]
    SVC --> PR[[SHEETS_PRINT → print templates, else docs pdf-render]]
    SVC --> LP[[LINK_PREVIEWS → chat link preview service and cache]]
    SVC --> OPS[[core operations: sheets.import, sheets.export, sheets.write-back]]
    SVC -. ask, explain .-> AI[[SHEETS_ASSISTANT]]
    OB[[event outbox: dataset and record events]] --> SUB[subscriber:sheets-live-ranges] --> RT[realtime hints sheet:id]
    SCHED[worker: refresh tick, snapshot tick, thinning] --> SVC
    SVC --> OUT[[outbox: sheets.*]] --> INBOX[NOTIFICATION_DISPATCHER / Inbox]
```

## 2. Tech Choices

| Concern | Choice | Rationale |
| ------- | ------ | --------- |
| Package | new `packages/plugins/sheets`, `-ui`, `-react-ui`; library `packages/sheets-model` | Principle I; one engine for browser, API and worker |
| Editor | one React editor (`sheets-react-ui`) mounted by `sheets-ui` through `@gauzy/ui-react` with Angular services (docs live client, translation, theme) passed in the host context; no Angular grid | one editor to build and test; the range view is reused by pages and decks |
| Templates | the hub's template fields on `document` (`templateScope`, `templateCategory`) and `/templates?kind=sheet` of `documents-and-wiki` | one template model |
| Cell comment anchors | `document_comment_anchor` with `kind = CELL` and a locator (sheet, row and column keys, label) on the existing `/documents/:id/comment-anchors` routes | one anchor table per hub comment |
| Link previews | `LINK_PREVIEWS` port offered by the chat plugin over `chat-link-preview.service.ts` (its egress guard and `chat_link_preview` cache); unbound → links show without a card | one preview cache |
| Snapshot schedules | core recurrence rules (`packages/core/src/lib/recurrence/`) | one recurrence implementation |
| Permissions, feature, settings | contributions of the plugin (`sheets.plugin.ts`, `sheets.settings.ts`): permissions with `defaultFor`, the `FEATURE_SPREADSHEETS` feature, settings in `tenant_setting` | the platform's catalogue and settings store |
| Storage | drive file kind `sheet` (`FILE` row, `editorKind`); CRDT state in `contentBinary`, XLSX copy as the blob, manifest in `contentJson` | one storage model with drive |
| Co-editing | docs live module with a `sheet` codec | no second transport, presence or permission model |
| CRDT | `yjs` and `y-protocols` (already docs dependencies) | same lineage and persistence rules as pages |
| Background work | core operations (`/api/operations`) on queue `sheets` for imports, exports and write-backs; scheduler jobs in the worker | durable, resumable; no run table of the plugin |
| Push | outbox → `RealtimeHintsService.appendHint` (`packages/plugins/realtime`) | Principle VII |
| Charts | `chart.js` (already in `ui-core`), the stack the report builder uses | one charting stack |
| PDF | `PrintService.render` of `print-and-pdf-designer`; fallback the docs plugin's `pdf/pdf-render.ts` (`pdfmake` with its bundled font, no browser) | one PDF path |
| Assistant | `SHEETS_ASSISTANT` → `ai-agents-and-assistants`; fallback `ai-chat` `AiProviderRegistry` | tenant's own provider |

**Open-source building blocks.** Our data model, permissions, persistence, co-editing and screens stay ours. Task T1
runs a spike against a 300-case formula conformance set and the CRDT mapping before the choice is fixed. Only
permissively licensed packages are used; the dependency licence gate checks every package.

| Building block | Candidates | Default |
| --- | --- | --- |
| Grid and editing surface | `@univerjs/core`, `@univerjs/sheets`, `@univerjs/sheets-ui` and the number format, conditional format, data validation, filter, sort, find and replace, hyperlink and thread comment packages of the same family; `@glideapps/glide-data-grid` | the `@univerjs/*` packages listed, mounted in our one React editor, driven by our CRDT model; fallback `@glideapps/glide-data-grid` with our own feature layer |
| Formula engine | `@univerjs/engine-formula` (runs headless in Node); IronCalc (WebAssembly in browser and Node) | the grid's engine, run in the browser, API and worker from `@gauzy/sheets-model`; IronCalc as the fallback |
| File import and export | `exceljs` (already a docs dependency) for XLSX; our ODF reader and writer over the docs extraction utilities (`office-xml.util.ts`, `odf.extractor.ts`) for ODS; SheetJS `xlsx` as a fallback for ODS; `papaparse` for CSV in a web worker | `exceljs`, our ODF code, `papaparse` |

## 3. Data Model

### Workbook state (in the hub's `document` row, kind `FILE`, `editorKind = 'sheet'`)

`contentBinary` holds the CRDT state with the docs lineage and revision header. Inside the shared document: a
`workbook` map (locale, time zone, week start, styles registry, named ranges, named functions, tables, protections,
live range anchors, charts, pivots, slicers, conditional formats, validations) and one map per sheet (`sheet:<key>`:
name, colour, hidden, frozen panes, row and column sizes, filters, merges) whose cells are keyed `<rowId>:<colId>` with
value, formula and style id. Rows and columns have **stable ids** ordered by fractional position keys, so an insert or
delete touches no cell; formulas are stored with references to row and column ids and shown in A1 form, so concurrent
inserts never break a reference. `contentJson` holds the **manifest** (sheets with keys, names, sizes, cell counts;
table and live range keys), rewritten on every persist. The kind's `extractText` gives the cells as Markdown tables (at
most 2 MB) to search and the knowledge pipeline; its `render` writes the shared XLSX copy to the blob
from the shared state only (cells, formulas and styles every reader of the workbook sees; live ranges keep their anchor
and their frozen or snapshot values, never any reader's live rows), 60 s after a persist (debounced). A persist marks
the copy stale (the manifest's `blobRevision` behind the document's `contentRevision`) until that render; while the
plugin is loaded, a download that finds the copy stale renders it from the saved state first, whatever the tenant
feature, and the plugin renders every stale copy at API shutdown, so the copy served with the feature or the plugin off
holds every saved edit. This does not depend on a clean shutdown: the stale mark is written in the persist transaction,
the XLSX codec lives in `@gauzy/sheets-model`, and the render-only `SheetsRenditionModule`
(`packages/plugins/sheets/src/lib/rendition/`, no route, table, job or page) is loaded by `apps/api/src/plugins.ts`
whenever the package is installed, also with `GAUZY_SHEETS_ENABLED` off; it registers only the `sheet` kind's `render`
with drive's file-kind registry, so a download through the hub that finds the copy stale renders it from the saved state
first, and after a start it renders every stale copy in batches. After an unclean stop and a restart with the plugin
off, the copy served is therefore the saved revision. A download or export with the feature on is rendered per request with the requester's own live
rows (FR-55) and streamed, never written to the blob. Versions are drive's `document_version` rows (`source = APP`, `label`, `isPinned`).

### New tables (plugin; all `TenantOrganizationBaseEntity`, soft delete; JSON as `text`; keys `varchar(32)`)

| Table | Columns (besides base) | Indexes and uniqueness |
| --- | --- | --- |
| `sheet_workbook` | `documentId` FK `document` cascade, `locale` varchar(16), `timeZone` varchar(64), `weekStart` int, `sheetCount` int, `cellCount` int, `liveRangeCount` int (template marking is the hub's `templateScope` on the `document` row) | unique `(documentId)` |
| `sheet_cell_change` | `documentId`, `sheetKey`, `rowKey`, `colKey`, `address` varchar(16), `kind` (`VALUE`, `FORMULA`, `FORMAT`, `CLEAR`), `before` text, `after` text, `actorUserId`, `actorType` (`USER`, `AGENT`, `SYSTEM`), `source` (`EDITOR`, `API`, `MCP`, `IMPORT`, `RESTORE`, `WRITE_BACK`, `ASSISTANT`), `versionId` null, `changedAt` | idx `(documentId, sheetKey, rowKey, colKey, changedAt)`, `(documentId, changedAt)`, `(tenantId, actorUserId, changedAt)` |
| `sheet_cell_change_daily` | `documentId`, `day` date, `actorUserId`, `changes` int | unique `(documentId, day, actorUserId)` |
| `sheet_live_range` | `documentId`, `rangeKey`, `sheetKey`, `anchorRowKey`, `anchorColKey`, `sourceKind` (`REPORT`, `VIEW`), `sourceKey` varchar(160), `parameters` text (prompts, filter, columns), `refreshMode` (`ON_OPEN`, `MANUAL`, `SCHEDULE`, `LIVE`), `recurrence` text null, `timeZone`, `nextRefreshAt` null, `recordBacked` bool, `recordType` varchar(64) null, `ownerUserId`, `status` (`ACTIVE`, `PAUSED`, `UNAVAILABLE`), `consecutiveFailures` int, `lastRefreshAt` | unique `(documentId, rangeKey)`; idx `(status, nextRefreshAt)` |
| `sheet_live_range_result` | `liveRangeId` FK cascade, `accessHash` varchar(64), `readerUserId` uuid (the reader whose read last produced this hash), `columns` text, `rows` text or `fileId` null (over 1 MB), `rowCount` int, `sourceRef` varchar(64) null, `fetchedAt`, `expiresAt` | unique `(liveRangeId, accessHash)`; idx `(expiresAt)` |
| `sheet_live_range_refresh` | `liveRangeId` FK cascade, `mode`, `requestedByUserId` null, `status` (`DONE`, `FAILED`, `FORBIDDEN`, `UNAVAILABLE`), `rowCount`, `durationMs`, `error` text | idx `(liveRangeId, createdAt)` |
| `sheet_pending_change` | `liveRangeId` FK cascade, `userId`, `recordId`, `field` varchar(128), `before` text, `after` text, `recordVersion` varchar(64), `status` (`PENDING`, `APPLYING`, `REFUSED`), `reason` text | unique `(liveRangeId, userId, recordId, field)` |
| `sheet_write_back_result` (the per-row outcome of a `sheets.write-back` operation; run state and progress are the operation's and the bulk change run's) | `operationId` (core `operation`, cascade), `documentId`, `liveRangeId`, `recordId`, `outcome` (`DONE`, `UNCHANGED`, `REFUSED`, `FAILED`), `reason` text, `fields` text | idx `(operationId, outcome)`, `(liveRangeId, createdAt)` |
| `sheet_snapshot_schedule` | `documentId`, core recurrence rule columns (`frequency` `DAILY`, `WEEKLY` or `MONTHLY`, `interval`, `weekday`, `dayOfMonth`, `timeZone`, as defined by `packages/core/src/lib/recurrence/`), `sendTime` varchar(5), `keep` int, `notifyFollowers` bool, `includeLiveValues` bool, `confirmedByUserId` null, `ownerUserId`, `nextRunAt` (from the core recurrence module), `lastRunAt`, `status` (`ACTIVE`, `PAUSED`) | idx `(status, nextRunAt)`; idx `(documentId)` |
| `sheet_snapshot` | `scheduleId` FK null, `documentId`, `versionId`, `periodKey` varchar(16), `changedCells` int, `summary` text | unique `(scheduleId, periodKey)`; idx `(documentId, createdAt)` |

Not tables of this plugin: write-back runs and their counters (core `operation` with type `sheets.write-back`; counts
read from the bulk change run it submits), cell comment anchors (the hub's `document_comment_anchor`, kind `CELL`),
link previews (the chat plugin's `chat_link_preview`), template flags (the hub's template fields).

### Changes outside the plugin (additive)

- Uses drive's pieces unchanged: `registerDocumentFileKinds` (core `document-registry/`, drive T9), `DOCS_FILE_STORE`
  (`create`, `read`, `write` with `expectedRevision` and `versionSource: 'APP'`, `access`; drive T27), the New and
  "Open with" menus (drive T37). The `sheet` registration: mime types and extensions it opens (XLSX, ODS, CSV),
  `canCreate`, `createBlank`, `render(doc, format)` (XLSX, ODS, CSV, PDF), `extractText`, `thumbnail` (first sheet),
  `openRoute: '/pages/documents/sheet/:id'`.
- Additive fields on a drive file kind entry (contracts `document-drive.model.ts`): `live?: IDocumentLiveCodec` and
  `maxStateBytes?` (default `GAUZY_DOCS_MAX_BINARY_BYTES`; the `sheet` kind declares `GAUZY_SHEETS_MAX_STATE_BYTES`,
  64 MB), honoured by the file store and the live module for that kind only.
- `packages/plugins/docs/src/lib/live/`: `document-live.codec.ts` (the `IDocumentLiveCodec` interface: `seed`,
  `assertAcceptable(doc, update, session)`, `toStored`, `applyServerUpdate`, `onPersist`), `page-live.codec.ts` (today's
  functions of `document-live.yjs.ts` behind it, including the suggestion validator of `documents-and-wiki`),
  `DocumentLiveService` opening sessions on a page or on a file whose kind declares a codec. The existing live specs
  pass unchanged.
- `packages/plugins/docs/src/lib/live/document-live-sessions.service.ts`: the `DOCS_LIVE_SESSIONS` port
  (`applyServerUpdate(documentId, update, actor, source)` merged into open sessions or into the stored state through
  `DOCS_FILE_STORE.write`, `readState(documentId)` after a flush, `onAccessChanged(documentId, listener)`), bound in
  `apps/api/src/plugin-composition.ts`.
- `packages/plugins/chat/src/lib/link-preview/`: the chat plugin offers its `ChatLinkPreviewService` as the
  `LINK_PREVIEWS` port (`preview(viewer, url)`: title, description, icon through its egress guard and its
  `chat_link_preview` cache), bound in `apps/api/src/plugin-composition.ts`; chat behaviour unchanged.
- Uses `documents-and-wiki`'s hub pieces unchanged: the template fields and `/templates?kind=sheet` gallery (its T4,
  T17) and the `CELL` kind of `document_comment_anchor` on the existing anchor routes (its T4).
- `contracts`: `sheets.model.ts` (manifest, cell and range references, range read and write shapes, live range, result
  page, lineage, pending change, write-back operation state and row result, snapshot schedule, assistant proposal);
  the `LINK_PREVIEWS` token. The feature, the permissions of §9 and the settings are contributions of the plugin, not
  enum edits.

### Migrations

**Migration timestamps**: `packages/plugins/sheets` `1791000064100` to `1791000064199`.

Plugin migrations with the shared core migration helpers of `@gauzy/core`; PostgreSQL, SQLite and MySQL
branches; idempotent, forward-only, both ORMs:

1. `1791000064100-CreateSheetWorkbookTables` — workbook.
2. `1791000064110-CreateSheetHistoryTables` — cell change, daily totals.
3. `1791000064120-CreateSheetLiveRangeTables` — live range, result, refresh, pending change, write-back result.
4. `1791000064130-CreateSheetSnapshotTables` — schedule, snapshot.

The `FEATURE_SPREADSHEETS` feature (off for every tenant), the permissions with their default grants and the settings
are contributions of the plugin (§9), not a migration.

### Contracts

`sheets.model.ts` and the additive fields of `document-drive.model.ts` in `packages/contracts`, listed under "Changes outside the plugin (additive)"; they reach the SDKs and Ever Teams through the OpenAPI document.

## 4. API Surface

All routes under `/api/plugins/sheets`, `@FeatureFlag(FEATURE_SPREADSHEETS)`, `TenantPermissionGuard`,
`PermissionGuard`, class-validator DTOs, Swagger; the hub's access (`DOCS_FILE_STORE.access`) is checked on
every route; `Idempotency-Key` on creating routes; cursor pagination.

| Method | Endpoint | Permission | Description | Status |
| ------ | -------- | ---------- | ----------- | ------ |
| `POST` | `/workbooks` | `DOCS_CREATE` | `{ parentId, name, templateId? }` → hub file of kind `sheet` through `DOCS_FILE_STORE.create` | New |
| `POST` | `/workbooks/from-file` | `DOCS_CREATE` + read of the file | hub file → new workbook beside it (`202` over 10,000 rows) | New |
| `GET` | `/workbooks/:id` | read | manifest, settings, counts, my access, live mode | New |
| `PATCH` | `/workbooks/:id/settings` | edit | locale, time zone, week start (template marking: the hub's `/documents/:id/template`) | New |
| `GET` | `/workbooks/:id/ranges?ref=&render=values\|formulas\|text` | read | cells of a range; live cells computed for the caller | New |
| `PUT` | `/workbooks/:id/ranges` | edit | `{ ref, values \| formulas, expectedRevision, preview }`; protection checked | New |
| `POST` | `/workbooks/:id/sheets`, `PATCH`/`DELETE …/sheets/:key` | edit | add, rename, reorder, colour, hide, delete | New |
| `POST` | `/workbooks/:id/import` | edit | file as new sheets → operation | New |
| `GET` | `/workbooks/:id/export?format=xlsx\|ods\|csv\|pdf&sheet=&ref=` | read | stream, or `202` with an operation | New |
| `GET` `POST` `PUT` `DELETE` | `/workbooks/:id/live-ranges[/:key]` | `SHEETS_LIVE_RANGE_MANAGE` + edit (read: read) | bindings | New |
| `POST` | `/workbooks/:id/live-ranges/:key/{refresh,freeze}` | read / edit (+ `confirmAudience: true`) | refresh for me; freeze | New |
| `GET` | `/workbooks/:id/live-ranges/:key/{result,refreshes}` | read | my rows with time; refresh log (FR-83) | New |
| `GET` | `/workbooks/:id/lineage?cell=` | read | source, dependents, drill link | New |
| `GET` `PUT` `DELETE` | `/workbooks/:id/live-ranges/:key/pending` | edit | my pending changes | New |
| `POST` | `/workbooks/:id/live-ranges/:key/apply` | `SHEETS_WRITE_BACK_RUN` | `{ preview }` → preview, or `202` with a `sheets.write-back` operation | New |
| `GET` | `/write-backs[/:operationId]` | requester / `SHEETS_SETTINGS_MANAGE` | write-back operations with counts from the bulk change run, and per-row results (FR-84); status also on the core `/operations/:id` | New |
| `GET` | `/workbooks/:id/versions/:versionId/diff?against=` | read | changed cells per sheet | New |
| `GET` | `/workbooks/:id/cells/history?cell=`, `/workbooks/:id/timeline` | read | one cell's history; FR-82 timeline | New |
| `GET` `POST` `PATCH` `DELETE` | `/workbooks/:id/snapshot-schedules[/:sid]` | `SHEETS_SNAPSHOT_MANAGE` + edit | schedules | New |
| `GET` | `/workbooks/:id/changes-since-snapshot` | read | highlighted cells, before, after, who | New |
| `POST` | `/workbooks/:id/{ask,explain}` | `SHEETS_ASSISTANT_USE` + read | proposal (formula, target, explanation) | New |
| `GET` | `/link-preview?url=` | read of any workbook | title, description, icon from `LINK_PREVIEWS` (the chat link preview service and its cache); `404` when unbound; no cache of its own | New |
| `GET` `PUT` | `/settings` | `SHEETS_SETTINGS_MANAGE` | sample rows, freeze allowed, snapshot retention | New |
| `*` | `/api/plugins/docs/**` including `…/live/*`, versions, shares, comments on `Document`, `/documents/:id/comment-anchors` (kind `CELL`), `/templates?kind=sheet` | unchanged | the hub's routes serve workbooks too | Unchanged |

Errors: `SHEETS_LIMIT_EXCEEDED`, `SHEETS_PROTECTED` (403), `SHEETS_REVISION_STALE` (409), `SHEETS_SPILL_BLOCKED`,
`SHEETS_SOURCE_UNAVAILABLE`, `SHEETS_SOURCE_FORBIDDEN`, `SHEETS_FREEZE_DISABLED`, `SHEETS_FILE_UNSUPPORTED`,
`SHEETS_FILE_TOO_LARGE`. GraphQL reads `workbook`, `workbookRange`, `workbookLiveRanges` in
`graphql/schema-extensions.ts`.

**Ports consumed** (contracts tokens, injected `@Optional()`, bound in `apps/api/src/plugin-composition.ts`; unbound →
the capability is not offered): `DOCS_FILE_STORE` (drive; required), `DOCS_LIVE_SESSIONS` (docs live; required for co-editing and server writes), `REPORT_RUNS` (`run(key, prompts, viewer, { mode:
'LIVE' })`, report-builder), `SHEETS_RECORD_ROWS` (record-views' record query service: `page(recordType, viewRef |
definition, fields, viewer, { after, limit })` with `RECORD_VIEWS_QUERY.compile` and the record's version per row),
`SHEETS_BULK_CHANGE` (data-exchange bulk change with a file-listed change set: `preview`, `start`, `status`),
`CUSTOM_FIELD_METADATA` (typed columns of record-backed tables and field rules), `SHEETS_PRINT` (`PrintService.render`),
`SHEETS_ASSISTANT`, `LINK_PREVIEWS` (chat), `NOTIFICATION_DISPATCHER` (else `INBOX_ITEM_WRITER`, else the employee
notification), `AUDIT_EVENT_SINK`.

**Ports offered**: the `sheet` file kind (`registerDocumentFileKinds`) with its live codec; a computed report dataset
`sheets.table_rows` (`registerReportDatasets`, provider `WorkbookTableDatasetProvider`, parameter `table` = workbook and
table key, filtered by the reader's hub access) for FR-70; `RECORD_TIMELINE_SOURCES` entries for write-backs on records.

**Consumer tokens answered** (bound in `apps/api/src/plugin-composition.ts` to the range service; each consumer plan states the shape it calls and its fallback): `SLIDES_SHEET_RANGES`.

## 5. Events, Real-Time and Notifications

| Event | Emitted when | Consumers |
| ----- | ------------ | --------- |
| `sheets.workbook.created` / `.imported` / `.exported` / `.restored` | lifecycle actions | activity log, webhooks, audit sink (exports) |
| `sheets.live_range.refreshed` / `.failed` / `.frozen` | a refresh ends; a freeze | realtime hint `sheet:<documentId>` to that reader; owner notice after three failures |
| `sheets.write_back.completed` | a `sheets.write-back` operation ends | requester notice, record timelines; progress through the core operation events |
| `sheets.snapshot.taken` | a scheduled snapshot is stored | follower notice when cells changed |
| `sheets.protection.changed` | a protection is added, changed or removed | activity log, realtime hint |
| In: `invalidatedBy` events of a report dataset, list-source events of a view's record type | records change | `subscriber:sheets-live-ranges`: expire results of affected live ranges, hint open workbooks with `LIVE` mode, coalesced per second |
| In: hub events (trash, restore, share, move) through `DOCS_LIVE_SESSIONS.onAccessChanged` | hub changes | pause or resume schedules, close or re-check sessions |

Co-editing frames ride `Subscription.documentLive`. Notification categories (`registerNotificationCategories`):
`sheets.live-range-failure`, `sheets.snapshot-changes`, `sheets.write-back`; comments and mentions keep the core
comment and mention notifications. Events carry ids, never cell values.

## 6. UI Surface

- **Angular `packages/plugins/sheets-ui`** (lazy, hidden on `404`): plugin registration, routes contributed at the
  hub's `documents-sections` location: `/pages/documents/sheet/:id` and `…/sheet/:id/version/:versionId`, each a thin
  host page that mounts the React `WorkbookEditor` with `LazyReactHostDirective` of `@gauzy/ui-react` and passes the
  Angular services it needs (docs live client, translation, theme, navigation) in the host context; "New →
  Spreadsheet" with the hub's template gallery and "Open with → Spreadsheet" on XLSX, ODS and CSV files come from
  drive's New and Open with menus over the `sheet` registration (icon, opener); Settings → Spreadsheets at
  `settings-sections` (Angular form over the setting contributions). i18n keys `SHEETS.*` in every locale of
  `packages/ui-core/i18n`, read by the React editor through the host context.
- **React `packages/plugins/sheets-react-ui`** (the one editor): `WorkbookEditor` with grid host, formula bar with
  function help, sheet tabs, toolbar, side panels (comments, lineage, versions and changes, cell history, live range
  builder with the report and view pickers, pending changes and write-back preview, protection, conditional formats,
  validation, chart and pivot editors, assistant question box), presence avatars from the live awareness, shortcut
  dialog; `RangeView` (read-only, for embeds in pages and decks); hooks `useWorkbookLive`, `useLiveRange`,
  `useWorkbookHistory`. Ever Teams depends on no `@gauzy/*` package: it uses the same API with its own screens.
- Accessibility: a grid accessibility layer that mirrors the active cell and its row and column headers for screen
  readers, a table view of each chart, focus order across panels.

## 7. MCP Tools, SDKs and Integrations

New group `sheets` in `packages/mcp-server/src/lib/tools/collaboration/sheets.ts`, switch `GAUZY_MCP_TOOLS_SHEETS`
(exactly `true`), scopes `sheets:read` and `sheets:write` in `collaboration/scopes.ts`:

| Tool | Input | Output |
| --- | --- | --- |
| `list_workbooks` / `get_workbook` | folder, search / id | workbooks; manifest and my access |
| `read_range` | id, A1 reference, render | values, formulas or text; live cells for the agent's access |
| `update_range` | id, reference, values or formulas, `preview` (default true) | cells before and after, or the new revision |
| `append_table_rows` | id, table, rows, `preview` (default true) | rows as validated, or the appended range |
| `create_workbook` | folder, name, sheets with headers | workbook |
| `insert_live_range` | id, anchor, report key or view, columns, `preview` (default true) | first rows, or the binding |
| `explain_cell` | id, cell | formula in words, lineage |
| `apply_pending_changes` | id, live range, `preview` (default true) | before and after per record, or the run |

OpenAPI additive; Kiota SDKs regenerated after merge. Formats: XLSX (Office Open XML SpreadsheetML), ODS
(OpenDocument), CSV and TSV (RFC 4180, UTF-8 with optional byte-order mark), PDF. CSV cells pass core
`spreadsheet-safe-row.ts`. No new outside integration; webhooks receive `sheets.*` events through the outbox.

## 8. Background Jobs

| Trigger | When | What it does | Idempotency |
| ------- | ---- | ------------ | ----------- |
| operation `sheets.import` (queue `sheets`) | file import over 10,000 rows | parse, map styles, write the state through `DOCS_FILE_STORE`, report | per operation and file hash |
| operation `sheets.export` | export over 100,000 cells or PDF | compute with the requester's live results, write the file, notify | per operation |
| `sheets.live-refresh-tick` | every minute | due `SCHEDULE` ranges: recompute results for the access hashes read in the last 7 days (at most 50 per range), each in the request context of its `readerUserId`, re-authorized first: when that reader's current access no longer gives the same hash, the row is dropped instead of refreshed | per range and due time |
| outbox consumer `subscriber:sheets-live-ranges` | dataset or record events | expire results, hint `LIVE` workbooks | delivery record per event |
| operation `sheets.write-back` | apply confirmed | submit the change set to `SHEETS_BULK_CHANGE`, follow its run (counts and status from it), write per-row results, refresh | the operation's idempotency key |
| `sheets.snapshot-tick` | every 15 minutes | due schedules (next run from the core recurrence module): flush, snapshot version, diff with the previous, notice, prune past `keep` | unique `(scheduleId, periodKey)` |
| `sheets.history-thin` | daily | versions over 30 days to one per day; cell changes over 90 days to daily totals | per document and day |
| `sheets.result-expiry` | hourly | delete expired live results and their files | status checks |

Queue jobs run in the API; schedules in the worker (`SheetsSchedulePlugin` in `apps/worker/src/plugins.ts`); without
a queue root the API runs them on in-process timers under a database lock (the task automations layout). Scheduled
refreshes never read as the range's owner: each result is recomputed with the access of the reader it is keyed by
(`readerUserId`, re-authorized), so a stored result never holds rows outside its hash's access (FR-60); results are
stored per access hash, never shared.

## 9. Security & Permissions

Permission contributions of the plugin (`PluginPermissionContribution`, `defaultFor`): `SHEETS_LIVE_RANGE_MANAGE`,
`SHEETS_WRITE_BACK_RUN`, `SHEETS_SNAPSHOT_MANAGE`, `SHEETS_ASSISTANT_USE`, `SHEETS_SETTINGS_MANAGE`; all to `SUPER_ADMIN`
and `ADMIN`; all but `SETTINGS_MANAGE` to `MANAGER`; `LIVE_RANGE_MANAGE`, `SNAPSHOT_MANAGE`, `ASSISTANT_USE` to
`EMPLOYEE`; `ASSISTANT_USE` to `DATA_ENTRY`; none to `VIEWER`. Settings (`sheets.assistant.sampleRows`,
`sheets.freeze.allowed`, `sheets.snapshots.retention`) are setting contributions in `sheets.settings.ts`. Hub keys stay the gate for reading, creating and editing (`DOCS_READ`, `DOCS_CREATE`, `DOCS_UPDATE`,
`DOCS_MANAGE`); a write-back also needs `DATA_BULK_CHANGE` and edit of each record (the bulk change checks both).

- **Protection** is enforced in the `sheet` codec's `assertAcceptable(doc, update, session)`: the update is applied to a
  copy and refused (`SHEETS_PROTECTED`, nothing applied) when it touches a protected cell the session's user may not
  edit; `applyServerUpdate` runs the same check for API, MCP, import and restore writes.
- **Cell history** is captured per accepted update, never from the merged state at persist: the same check that applies
  an update to a copy yields that update's cell changes (before and after per cell), recorded with the identity of the
  session that sent it (`assertAcceptable`) or the `actor` and `source` of `applyServerUpdate`, in the document's
  pending change list; `onPersist` writes each pending change as its own `sheet_cell_change` row in the persist's
  transaction, so two people editing one cell before one save give two rows with their own person, time and values
  (spec FR-48).
- **Per-reader live data**: results are keyed by the access hash of `REPORT_RUNS` (report-builder `ReportAccessService`)
  or of the compiled record view read scope; a reader never receives another hash's rows; the client feeds them to the
  formula engine as an outside source, so computed cells over them are per reader and never enter the shared state.
  Freeze and snapshot values require `confirmAudience`; exports and API reads compute with the requester's results.
- **Assistant**: headers, column types and `sheets.assistant.sampleRows` sample rows of the selection, without masked
  fields or live cells the user may not read; the model answers through a structured proposal and never returns values.
- **Link previews**: the chat link preview service through `LINK_PREVIEWS` (its egress guard: public addresses, pinned
  DNS answers, redirect re-checks, time and size caps; its `chat_link_preview` cache); the browser never loads the
  linked site.
- **Input**: cell text is stored as data and rendered as text; links accept `http`, `https`, `mailto` and platform paths.
- **Audit**: hub activity log entries; `AUDIT_EVENT_SINK` for exports, freezes and write-backs.

## 10. Observability

Metrics `sheets_recalc_ms`, `sheets_live_sessions`, `sheets_live_refresh_ms{source}`, `sheets_live_refresh_failures_total`,
`sheets_import_ms`, `sheets_export_ms`, `sheets_writeback_rows_total{outcome}`; the refresh log and write-back results
tables; the docs live status route includes `sheet` sessions.

## 11. Phased Rollout

1. **Phase 1 — Foundation** (flag off): building-block spike, contracts, `@gauzy/sheets-model`, the live codec seam and
   sessions port in the docs plugin (page codec unchanged), the `sheet` file kind, plugin scaffold and tables, workbook creation, grid, formulas,
   formats, sheets, clipboard and shortcuts, co-editing, XLSX, ODS and CSV import and export, open an uploaded file.
2. **Phase 2 — Depth**: conditional formats, validation, sort, filters and personal views, slicers, pivots, charts and
   sparklines, named ranges and functions, cross-workbook references, protection on the server, cell comments, versions
   with comparison and cell history, PDF, link previews, MCP read and write tools.
3. **Phase 3 — Advanced capabilities**: live ranges with per-reader results and lineage, typed and record-backed tables,
   write-back, the table dataset, assistant, snapshot schedules with change highlights, the three reports.
4. **Phase 4 — General availability**: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it.

## 12. Constitution Reconciliation

- I Plugin-first: plugin triple `sheets` (one React editor in an Angular host) plus the `sheets-model` library; drive's
  file kind registry; the hub's templates and comment anchors; chat's link previews through a port; core operations
  and recurrence.
- II Tenant/organization scoping: workbooks are drive files; every `sheet_*` row is tenant and organization scoped.
- III Both ORMs, additive migrations: four plugin migrations on three dialects; no change to hub columns here (the anchor
  kinds and template fields are `documents-and-wiki`'s).
- IV Default-off flag; nothing removed: `GAUZY_SHEETS_ENABLED` plus `FEATURE_SPREADSHEETS`; previews and extraction stay.
- V Contracts and API first: contracts, REST, GraphQL reads and MCP before the screens.
- VI Permissions, privacy, security: §9; data leaving the platform listed in the spec §4.
- VII Real-time through the event bus: the hub's live session for co-editing, outbox hints for everything else.
- VIII i18n and accessibility: `SHEETS.*` keys in every locale; screen-reader grid; chart tables.
- IX Tests: conformance set, codec specs, per-endpoint e2e, file round trips.
- X Behaviour-first spec: implementation details only here.
- XI Documentation describes our platform only.

## 13. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| Mapping the grid library's commands onto our CRDT model loses edits | Medium | High | spike T1; property tests of concurrent edits; fallback grid with our own command layer |
| Formula results differ between browser and server | Medium | High | one engine in `sheets-model`; conformance set in CI on both runtimes |
| Per-reader values leak through freeze, snapshot, export or the assistant | Low | High | access-hash keyed results; confirmation; tests per surface |
| Large workbooks exceed the live state limit | Medium | Medium | FR-7 limits; per-codec limit; read-only `size_limit` like pages |
| Write-back surprises (stale or refused rows) | Medium | Medium | preview, stale check by record version, per-row results, versions before apply |

## 14. References

- Spec: `./spec.md` · Tasks: `./tasks.md`
- `docs/specs/features/docs-collaboration/` (live sessions), `packages/plugins/docs/README.md` (Live co-editing)
- Code reused: `packages/ui-react` (`ReactHostDirective`, `LazyReactHostDirective`), `packages/plugin-ui`,
  `packages/plugins/docs/src/lib/{live,pdf/pdf-render.ts,entities/document-comment-anchor.entity.ts,controllers/document-comment-anchor.controller.ts}`,
  `packages/plugins/chat/src/lib/link-preview/`, `packages/core/src/lib/{operation,recurrence}`,
  `packages/plugin/src/lib/plugin-contributions.ts`
- Related plans: `report-builder-and-dashboards` (`REPORT_RUNS`, datasets), `record-views-and-search`
  (`RECORD_VIEWS_QUERY`), `data-import-export` (bulk change), `custom-fields-and-forms`, `access-control-and-security`,
  `print-and-pdf-designer`, `automation-and-notifications`, `documents-and-wiki` (templates, comment anchor kinds),
  `business-document-engine` (core recurrence), `presentations` (the `DECK` codec on the same seam)
