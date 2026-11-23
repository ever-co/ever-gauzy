# Task Breakdown: Record views and search

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `record-views-and-search`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind `GAUZY_RECORD_VIEWS_ENABLED` and `FEATURE_RECORD_VIEWS`: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it. `rv/` means
  `packages/plugins/record-views/src/lib/`, `ui/` means `packages/ui-core/shared/src/lib/record-views/`, `sp/` means
  `packages/plugins/search/src/lib/`, `rvui/` means `packages/plugins/record-views-ui/src/lib/`.
- Phases 1 to 4 deliver plan phase 1; Phase 5 delivers plan phase 2 (depth); Phase 6 plan phase 3 (advanced).
- Depends on the record type registry of `custom-fields-and-forms`.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts `packages/contracts/src/lib/record-view.model.ts` (definition schema, layouts, shares, pins, bulk
  actions and results, timeline entry, card, palette command, ports) and the optional `list`, `writer`, `card` parts in
  `record-type.model.ts`; export from `packages/contracts/src/index.ts`. Test: contract compile spec; definition schema validation spec.
- [ ] **T2**. Core: list source and writer support in `packages/core/src/lib/record-type/record-type.registry.ts`
  (registry refuses a list source without a read scope), `packages/core/src/lib/record-type/core-record-writers.ts` for
  the first types (task through `TaskUpdateCommand`). Test:
  registry spec; writer spec per type (permission refused, stale version refused).
- [ ] **T3** (parallel). Query schemas for the first types beside their controllers (for example
  `packages/core/src/lib/tasks/task.query-schema.ts`,
  `packages/core/src/lib/organization-contact/organization-contact.query-schema.ts`) and listed in
  `packages/core/src/lib/api/query-schemas.ts`. Test: the contract gate passes; GraphQL inputs generated; existing
  routes' specs unchanged.
- [ ] **T4** (parallel). Widen `BasePerEntityType.entity` validation to registered record type keys
  (`packages/core/src/lib/core/entities/entity-type-base.entity.ts`, a custom validator
  `packages/core/src/lib/core/entities/record-type-key.validator.ts`). Test: comment, follower and reaction on a plugin type accepted; an
  unknown key refused; existing values unchanged.
- [ ] **T5**. Plugin scaffold `packages/plugins/record-views` (package, project, tsconfig, jest, eslint),
  `rv/record-views-enabled.ts` (exact `true`), `rv/record-views.features.ts` (`FEATURE_RECORD_VIEWS`),
  `rv/record-views.permissions.ts`; `apps/api/src/plugins.ts`, `apps/worker/src/plugins.ts`; `.env.sample`. Test: flag
  and contribution specs; plugin list specs.
- [ ] **T6**. Migrations on the shared core migration helpers (`@gauzy/core`, `procurement` T4); entities
  `rv/entities/record-view-share.entity.ts`, `record-view-pin.entity.ts` (audience pin), `record-view-order.entity.ts`,
  and `record-tag.entity.ts` (links to core `tag`) and migrations
  `rv/database/migrations/1791000036100-CreateRecordViewTables.ts`, `1791000036110-CreateRecordTagTable.ts`; core migration
  `packages/core/src/lib/database/migrations/1791000036300-ExtendTaskViewCommentRecentVisit.ts` (additive `task_view`
  view columns in `packages/core/src/lib/tasks/views/view.entity.ts`, `comment` note
  columns, `employee_recent_visit` counter and user key, their indexes). Test: migration specs on SQLite (up twice);
  mapping under both ORMs; existing task view, comment and recent-visit specs unchanged. Migration timestamps: `1791000036100` to `1791000036199` (`packages/plugins/record-views`); `1791000036200` to `1791000036299` (`packages/plugins/search`); `1791000036300` to `1791000036399` (`packages/core`).
- [ ] **T7**. Default role grants through the permission contributions' `defaultFor` (plan §9); the search plugin's
  `SEARCH_VIEW` contribution unchanged; no migration. Files: `rv/record-views.permissions.ts`, `sp/search.permissions.ts` (unchanged).
  Test: grants present on a new tenant and after the permission
  reload; the holders of `SEARCH_VIEW` are the same before and after the reload.
- [ ] **T50**. Core record timeline contract: the multi slot `RECORD_TIMELINE_SOURCES` (`list(ref, { after, limit,
  kinds, viewer })` returning the timeline entry of `record-view.model.ts`, T1), no dependency on this plugin or its
  flag. Files: `packages/core/src/lib/record-type/record-timeline-sources.ts`, `packages/core/src/lib/record-type/index.ts`.
  Test: `packages/core/src/lib/record-type/record-timeline-sources.spec.ts`: contract spec; two fake sources contribute
  without this plugin loaded.
- [ ] **T51**. Knowledge-embedding seam in core: the docs knowledge pipeline (chunker, token counter, embedding service,
  vector-store registry with the PostgreSQL vector and lexical providers, its queue) moved into core with re-exports in
  the docs plugin, no behaviour change. Files: `packages/core/src/lib/knowledge-embedding/{markdown-chunker.ts,token-counter.ts,embedding.service.ts,vector-store.registry.ts,index.ts}`,
  `packages/plugins/docs/src/lib/knowledge/chunking/markdown-chunker.ts`,
  `packages/plugins/docs/src/lib/knowledge/chunking/token-counter.ts`,
  `packages/plugins/docs/src/lib/knowledge/embedding/embedding.service.ts`,
  `packages/plugins/docs/src/lib/knowledge/vector-store/vector-store.registry.ts`. Test: the docs plugin's knowledge
  specs pass unchanged against the re-exports.
- [ ] **T52**. Record links in core (FR-72): a core migration (record target columns and keys of `resource_link`,
  `hasColumn` guards, `url` nullable) and `ResourceLinkService.link` / `unlink` / `linksOf` in both directions with the
  viewer's read scope, safe from any feature that writes record links; the existing resource link routes and panels keep
  answering only rows with a `url`. Files:
  `packages/core/src/lib/database/migrations/1791000036310-AddResourceLinkRecordTarget.ts`,
  `packages/core/src/lib/resource-link/resource-link.entity.ts`,
  `packages/core/src/lib/resource-link/resource-link.service.ts`. Test:
  `packages/core/src/lib/resource-link/resource-link.record-target.spec.ts`: migration twice is a no-op on
  the three dialects; a link to a record the viewer cannot read is hidden; existing URL links unchanged.

## Phase 2 — Services, endpoints, events

- [ ] **T8**. Record query service `rv/query/record-query.service.ts` (with `rv/query/view-compiler.ts`): view definition → `ApiQuery`; custom fields as `cf.<key>` dynamic fields
  of the query protocol (one filter grammar); workflow state through `RECORD_VIEWS_WORKFLOW_STATE`; read scope applied last; estimated and
  exact counts; relative dates in the caller's time zone. Test: compile specs per operator; restricted reader sees only
  readable rows; ORM parity spec.
- [ ] **T9**. Group and aggregate service (two levels, counts, sums per currency, totals). Files:
  `rv/query/group-aggregate.service.ts`. Test: figures on seeded data;
  masked field refused as group or aggregate.
- [ ] **T10**. View service over the generalized core `task_view` (every record type): CRUD, `If-Match` versions,
  duplicate, audience defaults in the `views` section of the `recordType.<key>` setting and personal defaults in
  `IUserUiPreferences.recordViews`, system views, invalid-condition marking. Files: `rv/views/record-view.service.ts`,
  `rv/views/view-defaults.service.ts`, `rv/views/system-views.registry.ts`,
  `packages/core/src/lib/tasks/views/view.service.ts`, `packages/contracts/src/lib/user.model.ts`. Test: round trip of a task view between the
  old routes and the new ones; a contact view is a `task_view` row with `recordType = OrganizationContact` that the task
  view routes never list; conflict on stale save.
- [ ] **T11**. Shares, audience pins, personal pins as core `favorite` rows (`entity = TaskView`), manual order
  (`manualOrder` for task views, fractional ranks in `record_view_order` for other types), type settings in the `views`
  section of the `recordType.<key>` setting. Files: `rv/views/view-share.service.ts`, `rv/views/view-pin.service.ts`,
  `rv/views/view-order.service.ts`, `rv/views/type-settings.service.ts`. Test: share never widens access; reorder touches one row; a personal pin
  appears in the sidebar favourite links.
- [ ] **T12**. Controllers and DTOs for views, records, groups, defaults, type settings; GraphQL reads. Files:
  `rv/views/record-view.controller.ts`, `rv/records/records.controller.ts`, `rv/views/type-settings.controller.ts`,
  `rv/views/dto/`, `rv/records/dto/`, `rv/graphql/schema-extensions.ts`, `rv/graphql/record-views.resolver.ts`. Test: e2e
  (permissions, `404` with the feature off, cursor paging).
- [ ] **T13**. Recents on core `employee_recent_visit` (upsert per person and record with the visit counter, user key for
  people without an employee record, existing route), palette suggestions with `registerPaletteProviders`, upcoming
  items (assignments and reminders through optional ports, tasks due). Files:
  `packages/core/src/lib/employee-recent-visit/employee-recent-visit.service.ts`, `rv/palette/palette.service.ts`,
  `rv/palette/palette.controller.ts`, `rv/palette/palette-providers.registry.ts`, `rv/palette/upcoming.service.ts`. Test: the palette lists the newest 200 recents
  and no visit row is deleted; the existing recent-visit route answers as before; the same recents on two devices;
  providers only when loaded.
- [ ] **T14**. Events `record_view.*` declared with `SubscriptionCatalogue`; realtime hints to view audiences. Files:
  `rv/events/record-view.events.ts`, `rv/events/record-view-realtime.hints.ts`. Test: event
  payloads carry ids only.
- [ ] **T15** (parallel). Search page support in `sp/` (`sp/search.controller.ts`, `sp/services/search.service.ts`):
  hybrid mode flag on `GET /search` (keyword only until Phase 6),
  parent record and snippet on hits, exact reference and number match first, one-typo matching. Test: ranking specs;
  unreadable hits dropped.
- [ ] **T53**. List search box (FR-18): the records route takes `q`, matched against the list source's search fields
  and the type's searchable custom fields (through `CUSTOM_FIELD_METADATA` when loaded), combined with the view's
  filter. Files: `rv/query/list-search.ts`, `rv/query/record-query.service.ts`, `rv/records/records.controller.ts`.
  Test: a contact is found by its name and by a searchable custom field's value; a field without the search flag finds
  nothing; the read scope still applies.

## Phase 3 — UI surfaces

- [ ] **T16**. Move generic `task-views-ui` models (`packages/plugins/task-views-ui/src/lib/models/filter-tree.ts`,
  `row-groups.ts`, `selection.ts`, `bulk-undo.ts`, `timeline.ts`) to `ui/models/` and the shortcut registry, recorder
  and help (`packages/plugins/task-views-ui/src/lib/keyboard/shortcut-registry.ts`, `shortcut-recorder.ts`,
  `shortcut-help-dialog.component.ts`) to `packages/ui-core/core/src/lib/services/shortcuts/`, with re-exports left
  in `task-views-ui`. Test: the task views UI specs pass unchanged.
- [ ] **T17**. `ngx-record-list` host with view menu, filter builder, quick filters, column chooser, sort, grouping,
  layout switcher, address state; `ngx-record-table` (virtual scroll) and `ngx-record-board` (drag through writers,
  swimlanes, limits). Files: `ui/record-list/record-list.component.ts`, `ui/filter-builder/filter-builder.component.ts`,
  `ui/column-chooser/column-chooser.component.ts`, `ui/record-table/record-table.component.ts`,
  `ui/record-board/record-board.component.ts`. Test: rendering specs; keyboard-only board move.
- [ ] **T18**. `record-views-ui` plugin: palette in the header (mod+K unless a person's quick action holds that key,
  pages, quick actions as commands, records, recents; the Quick Actions dialog unchanged on its own shortcut),
  `/pages/search`, `/pages/records/:recordType` as the one owner of those routes (detail and create forms from
  `custom-fields-and-forms`), Settings → Views; hidden on `404`; i18n in every locale. Files:
  `rvui/record-views-ui.plugin.ts`, `rvui/components/command-palette/command-palette.component.ts`,
  `packages/ui-core/core/src/lib/services/command-palette/command-palette.registry.ts`,
  `rvui/pages/search-page/search-page.component.ts`, `rvui/pages/records-page/records-page.component.ts`,
  `rvui/settings/views-settings/views-settings.component.ts`, `packages/ui-core/i18n/assets/i18n/*.json`. Test: rendering specs; palette
  keyboard navigation spec; the Quick Actions dialog, its customization and a quick action bound to ctrl+K behave as
  before with the feature on.
- [ ] **T19**. Adoption on contacts, deals, projects and tasks pages: the existing table, board and actions stay the
  default; the shared list is a second layout, opened first only by the type's `listMode` or the person's choice. Files:
  `rvui/adoption/list-mode-switch.component.ts`, `apps/gauzy/src/app/pages/contacts/contacts.component.ts`,
  `apps/gauzy/src/app/pages/pipelines/pipeline-deals/pipeline-deals.component.ts`,
  `apps/gauzy/src/app/pages/projects/components/project-list/list.component.ts`,
  `packages/plugins/task-views-ui/src/lib/task-views-ui.plugin.ts`. Test:
  page specs for feature off, feature on with defaults (existing table), `listMode = VIEWS`, and a person's choice.
- [ ] **T20** (parallel). API compatibility of the task view routes after the generalization (`/api/task-views/**`,
  including the order route): they list and write only `recordType = 'Task'` rows and answer as before; no React package.
  Files: `packages/core/src/lib/tasks/views/view.controller.ts`, `packages/core/src/lib/tasks/views/view.service.ts`.
  Test: contract snapshot of the task view routes before and after.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T21**. MCP `packages/mcp-server/src/lib/tools/record-views.ts`: `views_list`, `views_run`, `search_everything`;
  `register-all-tools.ts`. Test:
  tool specs against a mocked API.
- [ ] **T22**. Port bindings in `apps/api/src/plugin-composition.ts`: `RECORD_VIEWS_QUERY`, `RECORD_VIEWS_SELECTION`
  (also as `AUTOMATION_VIEWS`), `RECORD_VIEWS_WORKFLOW_STATE`. Test: composition spec with each plugin absent.
- [ ] **T23**. OpenAPI regenerated; SDK regeneration noted; docs site pages; `docs/specs/README.md` row. Test: OpenAPI
  diff additive only.

## Phase 5 — Depth (plan phase 2)

- [ ] **T24**. Calendar (`@fullcalendar/*`) and timeline layouts with field mapping, drag through writers, dependencies
  from task links. Files: `ui/record-calendar/record-calendar.component.ts`,
  `ui/record-timeline-layout/record-timeline-layout.component.ts`, `ui/layout-field-mapping.ts`. Test: refused move reverts with the reason; DST spec.
- [ ] **T25** (parallel). Tree layout (cdk tree, counts, move with cycle check, path search) and gallery layout. Files:
  `ui/record-tree/record-tree.component.ts`, `ui/record-gallery/record-gallery.component.ts`,
  `rv/records/tree-move.service.ts`. Test:
  cycle refused; path shown.
- [ ] **T26** (parallel). Map layout (Leaflet, lazy, `GAUZY_MAP_TILE_URL`, clustering, area filter). Files:
  `ui/record-map/record-map.component.ts`, `rv/views/layout-availability.ts`. Test: not offered
  without a tile URL.
- [ ] **T27**. Dashboard layout and "Save as report" through `RECORD_VIEWS_REPORTS`; time-report filters stay core
  `saved_report` definitions. Files: `ui/record-dashboard/record-dashboard.component.ts`,
  `rv/views/save-as-report.service.ts`. Test: hidden when unbound.
- [ ] **T28**. Group sidebar with counts; aggregates and totals row in the table. Files:
  `ui/group-sidebar/group-sidebar.component.ts`, `ui/record-table/record-table.component.ts`. Test: counts match the list.
- [ ] **T29**. Bulk work as core operation `RECORD_BULK` registered with `OperationRegistry`: actions (edit field,
  assign, tags, follow, delete, restore, form action, start flow, workflow transition, assignment rule, plugin actions
  via `registerBulkActions`), per-record results through `BulkExecutor` into the operation steps (`output`, and the previous values in
  `compensationData` for undo), inline under 500 and
  `202` above, undo within 10 minutes as a child operation. Files: `rv/bulk/record-bulk.operation.ts`,
  `rv/bulk/bulk-actions.registry.ts`, `rv/bulk/record-bulk.controller.ts`, `rv/bulk/record-bulk-undo.service.ts`,
  `ui/bulk-toolbar/bulk-toolbar.component.ts`. Test: 700-record run with refusals and undo; per-record
  atomicity; a restart resumes the operation; results and undo read only the operation's rows.
- [ ] **T30**. Inline edit and cell paste in the table and on cards. Files: `rv/records/records.controller.ts`
  (`PATCH …/records/:id`), `ui/record-table/inline-edit.directive.ts`, `ui/record-table/cell-paste.service.ts`. Test: stale version shows the current value; 500-cell
  paste reports per cell.
- [ ] **T31** (parallel). Export CSV (core export writer) and XLSX of a view through `spreadsheet-safe` (streamed, 50,000
  rows), print through `RECORD_VIEWS_PRINT`, large exports through `RECORD_VIEWS_EXPORT`. Files:
  `rv/export/record-export.service.ts`, `rv/export/record-export.controller.ts`,
  `packages/utils/src/lib/spreadsheet-safe.ts`. Test: exported rows equal the
  screen's filter and columns; a cell starting with `=` is neutralised.
- [ ] **T32** (parallel). Tags on any registered type (`record_tag` for types without their own), tag filter and counts.
  Files: `rv/tags/record-tag.service.ts`, `rv/query/record-query.service.ts`. Test: types with their own tags keep
  using them.
- [ ] **T33**. Timeline merger over the `RECORD_TIMELINE_SOURCES` contract of T50 (comments and notes, activity log with custom-field
  changes) and `ngx-record-timeline`; notes as core `comment` rows with `kind = NOTE`, `visibility` and `isPinned`
  through the existing comment routes and `entity-comments` component (readers or private, pin, sanitise). Files:
  `rv/timeline/timeline-merger.service.ts`, `rv/timeline/comment-timeline.source.ts`,
  `rv/timeline/activity-log-timeline.source.ts`, `rv/timeline/timeline.controller.ts`,
  `ui/record-timeline/record-timeline.component.ts`, `packages/core/src/lib/comment/comment.service.ts`. Test: merged
  order across sources; private note hidden from others; a mention in a note notifies like a comment's.
- [ ] **T34**. Record sidebar (assignees, followers, tags, favourite through `favorite`, reminders, the core
  `shared_entity` share link, attachments when loaded) and pager. Files:
  `ui/record-sidebar/record-sidebar.component.ts`, `ui/record-pager/record-pager.component.ts`. Test: rendering specs with each optional part absent.
- [ ] **T35**. Hover cards (`card` route, type settings, people cards) and quick entry from palette, list and pickers
  (custom-fields quick-entry dialog when loaded). Files: `rv/cards/record-card.service.ts`,
  `ui/record-hover-card.directive.ts`, `rvui/components/quick-entry-launcher/quick-entry-launcher.component.ts`. Test: card respects masks; quick entry selects the new record.
- [ ] **T36**. Search coverage: index definitions in code for comments with notes (private notes excluded), linked emails
  and every registered type beside the existing `definitions/*.definition.ts`, active only for tenants with the feature
  on, quoted-reply stripping, admin weights page. Files: `sp/definitions/comment.definition.ts`,
  `sp/definitions/linked-email.definition.ts`, `sp/definitions/registered-record-types.definition.ts`,
  `sp/definitions/index.ts`, `rvui/settings/search-weights/search-weights.component.ts`. Test: hit in a comment shows its record; reindex progress; a tenant
  with the feature off gets the same index documents and results as before.
- [ ] **T37**. Unsaved-changes guard and form undo and redo; per-user preferences (`recordViews` UI preferences); phone
  card layout with swipe actions. Files: `ui/unsaved-guard/unsaved-guard.service.ts`,
  `ui/record-list/record-list-preferences.service.ts`, `ui/record-cards-phone/record-cards-phone.component.ts`. Test: guard on navigation; preference round trip.
- [ ] **T38**. Adoption on employees, candidates, invoices, expenses, incomes, vendors, products, equipment, goals and
  time-off pages, as T19 (existing table the default). Files: `rvui/adoption/list-mode-switch.component.ts` and the
  list pages under `apps/gauzy/src/app/pages/` (`employees/`, `candidates/`, `invoices/`, `expenses/`, `income/`,
  `vendors/`, `inventory/`, `equipment/`, `goals/`, `time-off/`). Test: page specs with the feature off, on with defaults, and
  with `listMode = VIEWS`.
- [ ] **T39**. Report definitions of FR-71 registered in the core reports catalogue and with the report builder when
  loaded, listed through the shared catalogue feature filter of `report-builder-and-dashboards` (its T51; their category keyed
  `FEATURE_RECORD_VIEWS`). Files: `rv/reports/record-views-report-catalogue.ts`,
  `rv/reports/record-views-reports.service.ts`. Test: figures on seeded data; the reports appear in the Reports menu with the feature on and
  are absent from the Reports page and menu with it off.
- [ ] **T54**. Note and comment composer on the record page (FR-42): the platform's rich-text editor (formatting,
  lists, tables, code, images, emoji, mentions); the mention list offers people who can read the record and warns
  before mentioning someone who cannot. Files: `ui/record-composer/record-composer.component.ts`,
  `rv/timeline/mention-candidates.service.ts`. Test: the mention list holds only readers of the record; mentioning a
  non-reader shows the warning; a table and a code block survive save and reload.

## Phase 6 — Advanced capabilities (plan phase 3)

- [ ] **T40**. Plain-language filters: `interpret` route through `RECORD_VIEWS_ASSISTANT` bound to
  `ai-agents-and-assistants` (unbound → not offered), catalogue-only prompt, chips UI, MCP `views_create_from_text`.
  Files: `rv/assistant/filter-interpreter.service.ts`, `rv/records/records.controller.ts` (`…/interpret`),
  `ui/filter-chips/filter-chips.component.ts`, `packages/mcp-server/src/lib/tools/record-views.ts`. Test: the prompt holds no record data; unknown fields dropped with a notice.
- [ ] **T41**. Live lists, boards and calendars: subscribe to the list source's events, re-read changed visible ids,
  highlight, keep rows under edit. Files: `ui/live/record-live-updates.service.ts`,
  `ui/record-list/record-list.component.ts`. Test: two-client spec within 2 s.
- [ ] **T42**. Presence on records (`record.viewing` signals, avatars, warning before overwriting a field changed by
  someone else). Files: `ui/live/record-presence.service.ts`, `ui/record-sidebar/record-sidebar.component.ts`. Test: audience limited to readers; nothing stored.
- [ ] **T43**. Meaning-based search on the core knowledge-embedding seam of T51: migration
  `sp/database/migrations/1791000036200-AddSearchDocumentEmbedding.ts`; ranking in `sp/services/hybrid-ranking.ts`;
  records embedded through the same seam and queue; hybrid ranking with
  document hits from `DOCS_KNOWLEDGE_SEARCH_SERVICE`, `FEATURE_SEMANTIC_SEARCH`. Test: a query sharing no word finds the document;
  unreadable hits dropped; off without a provider.
- [ ] **T44**. Sharing with roles and the organization, audience pins, pins to the existing custom dashboards as core
  `dashboard_widget` rows (`options.kind = 'record-view'`) rendered by a record-view widget in the widget palette.
  Files: `rv/views/view-share.service.ts`, `rv/views/dashboard-pin.service.ts`,
  `ui/record-view-widget/record-view-widget.component.ts`. Test: per-reader results on a role-shared view; the widget shows on the custom dashboard.
- [ ] **T45**. Offline pinned views: service worker registration behind the flag, encrypted IndexedDB sets, edit queue
  with version checks, conflict list. Files: `packages/ui-core/core/src/lib/services/offline/offline-sets.service.ts`,
  `packages/ui-core/core/src/lib/services/offline/offline-edit-queue.service.ts`, `apps/gauzy/ngsw-config.json`. Test: offline read; replay with one conflict; sensitive types never cached.
- [ ] **T46**. MCP `record_timeline`, `record_card`, `records_bulk_update` (preview). Files:
  `packages/mcp-server/src/lib/tools/record-views.ts`. Test: tool specs.
- [ ] **T47**. Benchmarks: one million rows per type on PostgreSQL and MySQL for list, groups and board; five million
  search documents. Files: `rv/benchmarks/record-list.bench.ts`, `sp/benchmarks/search.bench.ts`. Test: report attached to the PR.
- [ ] **T48**. Record links on the record page (FR-72): the related-records section and its timeline entries over the
  core record links of T52 (`ui/related-records/related-records.component.ts`,
  `rv/timeline/record-link-timeline.source.ts`). Test: a link to a record the viewer cannot
  read is hidden; a task with a record link shows the same resource link panel as before.
- [ ] **T49**. Provide the ports other features bind to (plan, **Consumer tokens answered**): `DOCUMENT_TEXT_SEARCH`, `MEETINGS_RECORD_NOTES`, `RECORD_VIEWS_SAVED_VIEWS`, `SHEETS_RECORD_ROWS`. Files: `apps/api/src/plugin-composition.ts`. Test: one contract test per token over the shape its consumer plan states; with this feature off each consumer keeps its stated fallback.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Scope, flags and compatibility | T5, T12, T18, T21 |
| FR-2 | §3.1 Scope, flags and compatibility | T6, T10, T16, T20 |
| FR-3 | §3.1 Scope, flags and compatibility | T7, T15, T18 |
| FR-4 | §3.1 Scope, flags and compatibility | T20, T23 |
| FR-5 | §3.2 Lists and layouts | T8, T12, T17 |
| FR-6 | §3.2 Lists and layouts | T19, T38 |
| FR-7 | §3.2 Lists and layouts | T17, T24, T25, T26, T27 |
| FR-8 | §3.2 Lists and layouts | T24–T26 |
| FR-9 | §3.3 Saved views and sharing | T1, T10 |
| FR-10 | §3.3 Saved views and sharing | T10, T17 |
| FR-11 | §3.3 Saved views and sharing | T11, T44 |
| FR-12 | §3.3 Saved views and sharing | T10, T11 |
| FR-13 | §3.3 Saved views and sharing | T10, T11 |
| FR-14 | §3.3 Saved views and sharing | T11 |
| FR-15 | §3.3 Saved views and sharing | T10, T17 |
| FR-16 | §3.4 Filters, sorting and list search | T8, T17 |
| FR-17 | §3.4 Filters, sorting and list search | T17 |
| FR-18 | §3.4 Filters, sorting and list search | T53 |
| FR-19 | §3.4 Filters, sorting and list search | T8, T17 |
| FR-20 | §3.4 Filters, sorting and list search | T10 |
| FR-21 | §3.5 Columns, grouping and aggregates | T8, T17 |
| FR-22 | §3.5 Columns, grouping and aggregates | T9 |
| FR-23 | §3.5 Columns, grouping and aggregates | T28 |
| FR-24 | §3.5 Columns, grouping and aggregates | T9, T28 |
| FR-25 | §3.5 Columns, grouping and aggregates | T27 |
| FR-26 | §3.6 Board, calendar, timeline, tree, map, gallery, dashboard | T17 |
| FR-27–FR-28 | §3.6 Board, calendar, timeline, tree, map, gallery, dashboard | T24 |
| FR-29 | §3.6 Board, calendar, timeline, tree, map, gallery, dashboard | T25 |
| FR-30 | §3.6 Board, calendar, timeline, tree, map, gallery, dashboard | T26 |
| FR-31 | §3.6 Board, calendar, timeline, tree, map, gallery, dashboard | T25 |
| FR-32 | §3.6 Board, calendar, timeline, tree, map, gallery, dashboard | T27 |
| FR-33–FR-35 | §3.7 Selection, bulk actions, inline edit, export and tags | T29 |
| FR-36 | §3.7 Selection, bulk actions, inline edit, export and tags | T30 |
| FR-37–FR-38 | §3.7 Selection, bulk actions, inline edit, export and tags | T31 |
| FR-39 | §3.7 Selection, bulk actions, inline edit, export and tags | T32 |
| FR-40 | §3.8 Record page shell | T33, T50 |
| FR-41 | §3.8 Record page shell | T6, T33 |
| FR-42 | §3.8 Record page shell | T54 |
| FR-43 | §3.8 Record page shell | T34, T42 |
| FR-44 | §3.8 Record page shell | T34 |
| FR-45–FR-46 | §3.8 Record page shell | T35 |
| FR-47 | §3.8 Record page shell | T37 |
| FR-48 | §3.9 Command palette and global search | T18 |
| FR-49 | §3.9 Command palette and global search | T13 |
| FR-50 | §3.9 Command palette and global search | T13, T18 |
| FR-51 | §3.9 Command palette and global search | T15, T18 |
| FR-52 | §3.9 Command palette and global search | T36 |
| FR-53–FR-54 | §3.9 Command palette and global search | T15 |
| FR-55 | §3.9 Command palette and global search | T36 |
| FR-56 | §3.9 Command palette and global search | T13, T18 |
| FR-57 | §3.10 Keyboard, history, preferences and phones | T16 |
| FR-58 | §3.10 Keyboard, history, preferences and phones | T13 |
| FR-59–FR-60 | §3.10 Keyboard, history, preferences and phones | T37 |
| FR-61 | §3.11 Advanced capabilities | T40 |
| FR-62 | §3.11 Advanced capabilities | T41 |
| FR-63 | §3.11 Advanced capabilities | T42 |
| FR-64 | §3.11 Advanced capabilities | T43, T51 |
| FR-65 | §3.11 Advanced capabilities | T44 |
| FR-66 | §3.11 Advanced capabilities | T45 |
| FR-67 | §3.11 Advanced capabilities | T22 |
| FR-68 | §3.12 API, MCP, events and reports | T12 |
| FR-69 | §3.12 API, MCP, events and reports | T21, T40, T46 |
| FR-70 | §3.12 API, MCP, events and reports | T14, T29, T33 |
| FR-71 | §3.12 API, MCP, events and reports | T39 |
| FR-72 | §3.8 Record page shell | T48, T52 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off; enabling it in dev shows the feature end to end.
- Constitution gates in `spec.md` §9 confirmed.
- Feature checks: a restricted reader never sees an unreadable record in lists, groups, aggregates, exports, cards,
  search or the palette; task views behave identically through both routes; bulk work is per-record atomic with undo;
  the list budget holds at one million rows; with `FEATURE_RECORD_VIEWS` off every new route answers `404` and every
  page shows its existing list (AC-15); with it on and no setting changed, AC-16 holds.
