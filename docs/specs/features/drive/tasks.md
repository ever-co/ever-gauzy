# Task Breakdown: Drive (files and folders of the Documents hub)

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `drive`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind the feature flag: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it.
- Paths without a package prefix are relative to `packages/plugins/docs/src/lib/` in Phases 1, 2, 4 and 5 and to
  `packages/plugins/docs-ui/src/lib/` in Phase 3 (and where a task says `docs-ui`).

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts: `packages/contracts/src/lib/document.model.ts` (enum values `LINK`, `UPLOAD`, `MANAGE`, `GUEST`, `guest-upload`; new fields), `shared-entity.model.ts` (`expiresAt`), `employee-settings.model.ts` (`DOCS_VIEWS`) and `document-drive.model.ts` (link options over a shared link, accesses, upload sessions, versions, labels, quotas, reservations, zip operation result, access panel, docs chat scope, duplicates, file kinds, record actions, port tokens and interfaces); exported from `packages/contracts/src/index.ts`. Test: `document-drive.model.spec.ts` (enum values unchanged, new ones present).
- [ ] **T2**. Feature and switches: `FeatureEnum.FEATURE_DRIVE` in `contracts/src/lib/feature.model.ts`, entry in `packages/core/src/lib/feature/default-features.ts`, `FEATURE_DRIVE` default off in `packages/config/src/lib/environments/environment.ts` and `environment.prod.ts`; `GAUZY_DRIVE_PUBLIC_LINKS_ENABLED`, `GAUZY_DRIVE_WEBDAV_ENABLED`, `GAUZY_DRIVE_MAX_FILE_SIZE`, `GAUZY_DRIVE_UPLOAD_PART_BYTES` in `packages/plugins/docs/src/lib/docs.config.ts` and `.env.sample`. Test: `docs.config.drive.spec.ts` (exact `true`, defaults).
- [ ] **T3**. Permissions as contributions of the docs plugin (`docs.plugin.ts`, `PluginPermissionContribution` of `packages/plugin/src/lib/plugin-contributions.ts`): `DRIVE_LINK_CREATE`, `DRIVE_SETTINGS_MANAGE`, `DRIVE_RETENTION_MANAGE`, `DRIVE_WEBDAV_USE` with `defaultFor` as plan §9 in `docs.permissions.ts`; drive setting contributions in `docs.settings.ts`. Test: plugin contributions report lists them; a new tenant gets the grants; the permission reload adds them to an existing tenant.
- [ ] **T4**. Entity changes: `entities/document.entity.ts` (owner, `inheritsAccess`, `treePath`, `accessPath`, retention, `editorKind`, `linkUrl`, `archivedByUserId` set by the existing archive command in `commands/handlers/archive-document.handler.ts`), `entities/document-share.entity.ts` (`expiresAt`, `message`), `entities/document-version.entity.ts` (number, label, pin, source, file columns excluded from JSON), `entities/document-category.entity.ts` (defaults). Test: `entities/plugin-entity-registration.spec.ts`, `entities/column-type-portability.spec.ts` extended.
- [ ] **T5**. New entities and repositories (the eight tables of plan §3): `entities/{document-link-access,document-upload-session,document-retention-label,document-filing-log,document-storage-reservation,document-quota-override,document-dav-lock,document-text-fingerprint}.entity.ts`, each with `repositories/type-orm-<name>.repository.ts` and `repositories/mikro-orm-<name>.repository.ts`, added to `ALL_DOC_ENTITIES` in `entities/index.ts`. Test: entity registration spec lists them.
- [ ] **T6**. Migration `packages/core/src/lib/database/migrations/1791000046100-AddDriveDocumentColumns.ts` with batched backfills (owner, version numbers, paths by recursive query) for PostgreSQL, MySQL and SQLite. Test: migration spec on SQLite with a three-level tree and old versions. Migration timestamps: `1791000046100` to `1791000046199` (`packages/core`).
- [ ] **T7** (parallel). Migration `packages/core/src/lib/database/migrations/1791000046110-CreateDriveTables.ts`. Test: up twice is a no-op on SQLite.
- [ ] **T8** (parallel). Core shared links on the `shared_entity` extension of `access-control-and-security` (its core migration of T5 and the hashed-token, expiry and revocation checks of its T69 in `shared-entity.service.ts`); this task adds only the `Document` rule: `packages/core/src/lib/shared-entity/shared-entity.access.ts` lists `Document` as a plugin-managed type the generic routes refuse for new links while `FEATURE_DRIVE` is on for the tenant; a `Document` row created before keeps its `token`, so its author and the organization's managers copy it again as today. Test: existing shared-entity specs pass unchanged; a hashed row resolves only by its token; an expired row answers 404; the generic routes refuse a new `Document` link with `FEATURE_DRIVE` on and create it as today with it off; a `Document` row created before still resolves by its token and is copied again by its author and by a manager.
- [ ] **T9**. Core registries `packages/core/src/lib/document-registry/` (`document-file-kind.registry.ts` with `registerDocumentFileKinds`, `document-record-action.registry.ts` with `registerDocumentRecordActions`, read accessors, `index.ts`), exported from `@gauzy/core`. Test: `document-registry.spec.ts` (duplicate key refused, inert without readers).

## Phase 2 — Services, endpoints, events

- [ ] **T10**. Drive gate: `services/drive-feature.service.ts` (tenant feature read, cached), `@FeatureFlag(FEATURE_DRIVE)` helper, `DRIVE_DISABLED` 404 filter (`interceptors/drive-disabled.filter.ts`). Test: routes answer 404 with the feature off.
- [ ] **T11**. Paths: `services/document-path.service.ts` maintaining `treePath` / `accessPath` on create, move, restrict, unrestrict and duplicate (prefix replace up to 10,000 rows, `repath` queue stage beyond, in `knowledge/queue/docs-pipeline.service.ts`). Test: `document-path.service.spec.ts` (moves, restricted descendants, deep trees).
- [ ] **T12**. Inherited access: `services/document-access.predicate.ts`, `services/document-access.sql.ts`, `services/document-access.service.ts` gain folder-chain shares, `UPLOAD` and `MANAGE` ranks, ownership through `ownerUserId`, gated by the tenant feature; retrieval filters (`knowledge/retrieval/retrieval-filters.ts`) and live re-checks (`live/document-live.service.ts` access fields) follow. Test: predicate truth table spec, SQL spec on SQLite at depth 32, retrieval parity spec.
- [ ] **T13**. Shares: `services/document-share.service.ts` (any visibility with drive on, manage-level sharers, ceiling, expiry, message), restrict and unrestrict, ownership transfer command (`commands/transfer-document-ownership.command.ts`, `commands/handlers/transfer-document-ownership.handler.ts`, inbox notice to the new owner), access panel query (`queries/get-document-access.query.ts`, `queries/handlers/get-document-access.handler.ts`); controller routes in `controllers/document-share.controller.ts` and `controllers/document.controller.ts`, DTOs in `dto/document-share.dto.ts`. Test: service spec (ceiling, manager-only changes, expiry), ownership transfer gives the new owner manage level, controller e2e where the docs suite exists.
- [ ] **T14**. Home: Recent over core `employee_recent_visit` (`entity = Document`, written through `EmployeeRecentVisitService.create` at most once a minute per item, count and last action in `data`, latest 200 `Document` visits kept; the core module gains deleting one's own visits by entity, one or all), `/home`, `/recent`, `/shared-with-me` queries and controller; view choices as `employee_setting` rows of type `DOCS_VIEWS` through the existing `/employee-settings` routes. Files: `controllers/document-home.controller.ts`, `services/document-home.service.ts`, `services/document-recent.service.ts`, `packages/core/src/lib/employee-recent-visit/employee-recent-visit.service.ts` and `employee-recent-visit.controller.ts`. Test: visit debounce, shared-with-me excludes owned, prune to 200 drive visits with task and project visits untouched, remove and clear touch only the caller's rows, Recent lists only readable items.
- [ ] **T15**. Trash over today's archive: the existing list with `archived=only&scope=trash` (every archived item the reader may read, `mine=true` for archived by me or in what I manage, `archivedAt`, `archivedByUserId`, original path, days left), unarchive with `targetParentId` when the folder is gone, today's delete (archived only, today's rights) as delete forever with a manage-level check only where `drive.trash.deleteNeedsManage` is on, `POST /trash/empty` as a `docs.trash-empty` operation; the "archived" preset and the Trash view read the same query. Files: `services/document-trash.service.ts`, `controllers/document-tree.controller.ts`, `dto/get-documents-query.dto.ts`, `commands/handlers/unarchive-document.handler.ts`, `commands/handlers/delete-document.handler.ts`, `operations/docs-trash-empty.operation.ts`. Test: `document-trash.service.spec.ts` (restore in place, delete refused on an unarchived item as today, recover returns a deleted item to the trash, empty skips held items, an edit-level sharer deletes and unarchives as today with the setting off, the archived preset lists the same rows as before).
- [ ] **T16**. Resumable uploads: `services/document-upload-session.service.ts`, `controllers/document-upload-session.controller.ts`, parts storage, ranges, assembly as the core operation `docs.upload-assemble` (`operations/docs-upload-assemble.operation.ts`, registered in `OperationRegistry`) streaming into the existing checks of `services/document-upload.service.ts`, folder creation from `relativePath`, collision policy (`keep both`, `replace`, `skip`; `services/name-collision.ts`) shared with move and duplicate (`commands/handlers/move-document.handler.ts`), today's behaviour when an existing route names none. Test: out-of-order parts, resume, expiry, quota refusal before bytes, collision naming, assembly resumes after a restart, an existing upload or move without a choice keeps both names as given.
- [ ] **T17**. Link items and copy: `kind: LINK` on create (address validation, never previewed or zipped), duplicate with target parent and byte copies, copy past 500 items as the core operation `docs.copy`; bulk actions (`POST /documents/bulk`) through core `BulkExecutor`. Files: `dto/create-document.dto.ts`, `commands/handlers/create-document.handler.ts`, `dto/duplicate-document.dto.ts`, `commands/handlers/duplicate-document.handler.ts`, `operations/docs-copy.operation.ts`, `dto/bulk-action.dto.ts`, `commands/handlers/bulk-document-action.handler.ts`, `controllers/document.controller.ts`. Test: create-document DTO spec, copy quota spec, one result per bulk item.
- [ ] **T18**. File versions: `commands/handlers/replace-document-file.handler.ts` keeps the previous blob as a `document_version` row when drive is on; version list, label, pin, download, restore and delete for files on `controllers/document-version.controller.ts` and `services/document-version.service.ts`. Test: handler spec (feature on and off), restore adds a version, current version never deleted.
- [ ] **T19**. Quotas and reservations: `services/document-quota.service.ts` scopes per person and team space with overrides and a per-owner lock, `DocumentStorageReservationService` (`services/document-storage-reservation.service.ts`, `DOCS_STORAGE_RESERVATIONS`), thresholds at 80 % and 95 %, `/storage/*` routes (`controllers/document-storage.controller.ts`). Test: `services/quota.calculator.spec.ts` extended (versions, trash, reservations), concurrent last-bytes spec.
- [ ] **T20**. Public links (switch): `services/document-public-link.service.ts` over core `shared_entity` rows of entity `Document` (hashed tokens and `tokenEncrypted` through T8, link options in `sharedOptions`, password hashing, limits counted from `document_link_access`, suspension, revoke through `revokedAt`), owner routes (`controllers/document-public-link.controller.ts`), public controller `/api/public/docs/links/**` (`controllers/public-document-link.controller.ts`, added by `docs.module.ts` only with the switch on) with unlock, code (`ACCESS_ONE_TIME_CODES` when bound), item listing, preview, download, throttling. Test: link e2e (password limit, expiry, exhausted, archived item, suspended creator, one page for every end reason); no `document_*` link table exists.
- [ ] **T21**. External recipients and file requests: `/documents/:id/external-shares`, guest uploads with `source = GUEST`, review `PENDING` (`guest-upload`), owner notice, optional `DOCS_CONTENT_SCANNERS`. Files: `controllers/document-external-share.controller.ts`, `services/document-external-share.service.ts`, `dto/document-external-share.dto.ts`, `services/document-guest-upload.service.ts`, `services/document-review.service.ts`. Test: guest upload kept out of knowledge until approved; an invitation expires after its period.
- [ ] **T22**. Link policy settings (`drive.links.*`) in `document-settings` and enforcement in T20 and T21. Files: `docs.settings.ts`, `dto/document-settings.dto.ts`, `services/document-settings.service.ts`, `services/document-link-policy.ts`. Test: settings DTO spec, domain allow-list spec.
- [ ] **T23**. Previews: code, CSV and TSV tables, archive listing, optional preview cap (none by default), safe dispositions in `controllers/document-upload.controller.ts` (`/raw`); `DOCS_PREVIEW_CONVERTER` stage `preview` with cached rendition (`services/document-preview.service.ts`); video frame thumbnails (`knowledge/thumbnail/`). Test: disposition spec for script-capable types, converter unbound fallback.
- [ ] **T24**. Purge, pruning and expiry jobs: `schedule/` (`docs.drive.trash-purge` over rows deleted forever only where `drive.trash.purgeDays` is set, plus automatic emptying only where `drive.trash.autoEmptyDays` is set, `version-prune`, `share-expiry`, `upload-sweep`, `zip-sweep`, `reservation-sweep`) in `schedule/docs-drive.scheduler.ts` and `schedule/docs-drive.worker.ts`, `DocsDriveSchedulePlugin` (`schedule/docs-drive-schedule.plugin.ts`) for `apps/worker/src/plugins.ts`, in-process fallback timer and lock. Test: each job idempotent on SQLite; an archived item nobody deleted survives the purge with automatic emptying off; a deleted item stays recoverable with no purge period set; worker plugin list spec.
- [ ] **T25**. Zips: `/zips` routes, the core operation `docs.zip` (archive and manifest, storage key and expiry in the operation result, progress through operation events), inline path below 100 items or 200 MB. Files: `controllers/document-zip.controller.ts`, `services/document-zip.service.ts`, `operations/docs-zip.operation.ts`. Test: 1,000-file stream without buffering, manifest lists link items, status readable on `/operations/:id`.
- [ ] **T26**. Record files: `DOCS_RECORD_FILES` service (`services/document-record-files.service.ts`), record-granted reads through `RECORD_ACCESS_FILTER` or the registry entry, `Records/<type>` folders, per-type limits, duplicate-bytes attach, `/records/attachments` (`controllers/document-record.controller.ts`), record actions from `registerDocumentRecordActions`, attach by address (`dto/upload-from-url.dto.ts`) through core `createSsrfSafeHttpsAgent()` after the `@gauzy/utils` URL check (no redirects, size and time caps). Test: reader of the record reads the file, others 404; limits spec; a private address is refused.
- [ ] **T27**. File store port: `DocumentFileStoreService` (`services/document-file-store.service.ts`, `DOCS_FILE_STORE`) with `editorKind`, native state in `contentBinary`, rendition refresh, `APP` versions, `folderFor` (mail, meeting, chat); bound in `apps/api/src/plugin-composition.ts`. Test: a fake file kind round trip, download without its plugin.
- [ ] **T28**. Storage imports: `/storage-imports/preview` and `/storage-imports` over core storage and `STORAGE_TARGETS`, run as the core operation `docs.storage-import`, idempotent by `externalSource`/`externalId`. Files: `controllers/document-storage-import.controller.ts`, `services/document-storage-import.service.ts`, `operations/docs-storage-import.operation.ts`. Test: second run creates nothing.
- [ ] **T29**. Network drive (switch): `dav/` controller (`dav/document-dav.controller.ts`, added by `docs.module.ts` only with the switch on; `dav/document-dav.service.ts`, `dav/dav-lock.service.ts`, `dav/dav-xml.ts`; class 1 and 2 methods, token auth through `packages/core/src/lib/auth/user-api-token`, locks, ETags from digests, quotas, trash on delete, versions on write, read-only mode). Test: protocol e2e with a scripted client (PROPFIND depth 1, PUT, MOVE, LOCK conflict, read-only refusal).
- [ ] **T30**. Events: outbox appends for plan §5 (`events/drive-outbox.events.ts`), `registerAutomationTriggers`, `registerNotificationCategories` (`events/drive-notification-categories.ts`), inbox items through `INBOX_ITEM_WRITER` or `services/document-notifier.service.ts`, realtime hint kinds in `packages/plugins/realtime/src/lib/realtime-hints.service.ts`. Test: one outbox row per fact after commit, none on rollback.
- [ ] **T31**. Audit and activity: `AUDIT_EVENT_SINK` calls and `activity/document-activity-log.subscriber.ts` entries for shares, restrictions, links, accesses, permanent deletions. Test: subscriber spec.
- [ ] **T32**. GraphQL reads `driveHome`, `sharedWithMe`, `documentAccess`, `documentFileVersions`, `documentTrash` in `graphql/docs.schema.ts` and `graphql/docs-drive.resolver.ts`; field binding check entry. Test: resolver spec.
- [ ] **T33**. Privacy handler `docs.files` registered as `PERSONAL_DATA_HANDLERS` entry; `DOCS_PUBLIC_LINK_SOURCE`, `RECORD_TIMELINE_SOURCES` and palette entries. Files: `privacy/docs-personal-data.handler.ts`, `services/document-public-link-source.ts`, `services/document-timeline-source.ts`, `services/document-palette.provider.ts`, `apps/api/src/plugin-composition.ts`. Test: handler find and export spec, held items refused.
- [ ] **T52** (plan phase 1). Legacy organization documents: a `docs.storage-import` run reading `packages/core/src/lib/organization-document` rows and their `image_asset` files into an "Organization documents" folder of the organization space (`externalSource = 'organization-document'`, idempotent through `UQ_document_external_provenance`), started when `FEATURE_DRIVE` is first on or on demand; legacy rows and routes unchanged. Files: `services/organization-document-import.service.ts`, `operations/docs-storage-import.operation.ts`. Test: second run creates nothing; a row without a file is reported and skipped; the legacy route still lists the rows.
- [ ] **T54**. Search filters (spec FR-53): today's name and content search gains kind, file type, owner, changed between, size range, folder with its sub-folders (`treePath` prefix), shared with me, label and guest uploads in `dto/get-documents-query.dto.ts`, `queries/handlers/get-documents.handler.ts` and `queries/handlers/get-document-facets.handler.ts`, under the access predicate of T12. Test: `get-documents.handler.spec.ts`: each filter narrows the list; the folder filter includes sub-folders; a call without the new filters answers as today.
- [ ] **T55**. Team space ownership and departed owners (spec FR-62, FR-63): files in a team space count against the space and stay there when their uploader leaves the team or the organization; space managers are the team's managers and people shared at manage on the space; a daily job `docs.drive.departed-owner` (`schedule/docs-drive.scheduler.ts`) offers a deactivated employee's personal files to their manager after 30 days through an inbox item and the ownership transfer of T13. Files: `services/document-space-ownership.service.ts`, `services/document-quota.service.ts`. Test: `document-space-ownership.service.spec.ts`: a leaver's space file stays in the space quota; the manager gets the offer on day 30 and not before; accepting transfers ownership.

## Phase 3 — UI surfaces

- [ ] **T34**. `docs-ui` sidebar sections and pages Home, Recent, Shared with me (`packages/plugins/docs-ui/src/lib/pages/{home,recent,shared}`), the Trash entry opening the browse page's existing "archived" preset with trash columns and actions (`components/filter-bar/preset-chips.component.ts`), routes in `docs.routes.ts`, drive guard (`guards/drive-feature.guard.ts`), view choices read and saved through employee settings; i18n `DOCS.DRIVE.*` in every locale of `docs-ui/src/i18n`. Test: rendering specs, hidden on 404, the archived preset and the Trash entry show the same rows.
- [ ] **T35**. Upload queue with parts and resume, folder upload, collision dialog (`components/upload/upload-progress.component.ts`, `components/upload/upload-dropzone.directive.ts`, `dialogs/name-collision-dialog.component.ts`). Test: component spec with a simulated drop and resume.
- [ ] **T36**. Share dialog: levels, inheritance source, restrict, external recipients, access panel, links tab and link editor (`dialogs/share-dialog.component.ts`, `dialogs/link-editor-dialog.component.ts`). Test: component spec (ceiling disables higher levels).
- [ ] **T37** (parallel). File versions panel in `pages/file-view` (`pages/file-view/document-file-versions.component.ts`) and the detail panel (`components/detail/docs-detail-panel.component.ts`); New menu with link item and registered file kinds (`dialogs/create-dialog.component.ts`); copy and move with collisions (`dialogs/move-dialog.component.ts`). Test: component specs.
- [ ] **T38** (parallel). Storage page (meter, breakdown, largest files, quota overrides for managers), Settings → Documents → Drive and Retention labels. Files: `pages/storage/docs-storage-page.component.ts`, `pages/settings/docs-drive-settings.component.ts`, `pages/settings/docs-retention-labels.component.ts`. Test: component specs.
- [ ] **T39** (parallel). "Attached to records" page and `gz-document-links-panel` registration through `PageTabRegistryService` for record types declaring files. Files: `pages/records/docs-records-page.component.ts`, `components/links/document-links-panel.registration.ts`. Test: panel registration spec; the five existing hosts unchanged.
- [ ] **T40**. Public link pages in `packages/plugins/public-layout-ui` (`/share/:token`: unlock, code, acknowledgement, folder browser, preview, download, file request; `packages/plugins/public-layout-ui/src/lib/components/document-share/document-share-page.component.ts`, route in `packages/plugins/public-layout-ui/src/lib/public-layout.routes.ts`). Test: rendering specs, keyboard path.
- [ ] **T41** (parallel). Keyboard shortcuts and help overlay (`pages/browse/docs-browse-shortcuts.ts`); phone-width layout of drive pages (upload from the device camera). Test: shortcut map spec.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T42**. MCP in `packages/mcp-server/src/lib/tools/collaboration/docs.ts`: `list_pages` (`kind`, `parentId`), `search_pages` (drive filters, `scope` with cited passages) and `get_page` (file metadata, text, versions) extended; action tools `drive_upload_text`, `drive_move`, `drive_copy`, `drive_share`, `drive_create_link`, `drive_list_versions`, `drive_restore_version`, `drive_trash`, `drive_restore`, `drive_find_duplicates` with previews and scopes; route check entry. Test: tool specs (existing tools answer as before without the new arguments, preview first, no delete-forever tool, agent link policy).
- [ ] **T43** (parallel). Report datasets and definitions (`registerReportDatasets`, `registerReportDefinitions`) in `packages/plugins/docs/src/lib/reports/`: `reports/docs-report-datasets.ts`, `reports/docs-report-definitions.ts`. Test: figures equal the storage routes on a seeded tenant.
- [ ] **T44** (parallel). Integration hooks: `FILE_PICKER_SOURCES` attach flow on record panels (`docs-ui` `components/links/document-attach-dialog.component.ts`), `DOCS_LEGAL_HOLDS` binding to the access-control hold register in `apps/api/src/plugin-composition.ts`. Test: unbound ports hide the actions.
- [ ] **T45**. OpenAPI regenerated, SDK note for release; `packages/plugins/docs/README.md` drive section; user docs; `docs/specs/README.md` row; spec status `Implemented`. Test: OpenAPI diff is additive; docs build.

## Phase 5 — Advanced capabilities (plan phase 3)

- [ ] **T46**. Ask your files on the AI chat: a `docsScope` (folder subtree by `treePath` prefix, space, ids) in the `ai-chat` conversation's tool context, applied by `docs_search` and `docs_read` (`knowledge/chat-tools/docs-chat-tools.service.ts`) through `knowledge/retrieval/retrieval.service.ts` with a content-search fallback, `untrusted-content.ts` wrapping and `knowledge/chat-tools/docs-citations.ts`; the "Ask" action in `docs-ui` opens the chat panel with that scope (the same scope serves `documents-and-wiki`). Test: never cites an unreadable file (two users, one restricted folder), "no answer found" path, a chat without a scope behaves as today.
- [ ] **T47**. Filing and retention suggestions from classification (`knowledge/classification/document-classifier.service.ts` result → category defaults), `document_filing_log`, accept, dismiss, undo for 7 days (`services/document-filing.service.ts`, `controllers/document-suggestion.controller.ts`); chips in the detail panel. Test: automatic filing logged and undoable.
- [ ] **T48**. Retention labels: CRUD, inheritance to contents, `retainUntil` computation, refusals in purge, prune and delete forever, `docs.drive.retention` end actions. Files: `controllers/document-retention-label.controller.ts`, `services/document-retention.service.ts`, `dto/document-retention-label.dto.ts`, `schedule/docs-drive.scheduler.ts`. Test: label blocks each destructive path until its date.
- [ ] **T49**. Duplicates: exact groups by the stored `document.sha256` (index `IDX_document_tenant_org_sha256`, written by `services/document-upload.service.ts`), near groups by the queue stage `fingerprint` (SimHash bands into `document_text_fingerprint`), `/duplicates` groups (`controllers/document-duplicates.controller.ts`, `services/document-duplicates.service.ts`), merge with record links, favourites and page references moved. Test: exact groups need no fingerprint, near-duplicate threshold spec, merge preview equals result.
- [ ] **T50**. Acknowledgement, watermark (`sharp`, `pdf-lib`) and signed receipts with export and verification. Files: `services/document-watermark.service.ts`, `services/document-receipt.service.ts`, `controllers/document-public-link.controller.ts`, `controllers/public-document-link.controller.ts`. Test: stamped output has no unmarked copy path; a changed receipt fails verification.
- [ ] **T51**. Legal holds: checks through `DOCS_LEGAL_HOLDS` on item and ancestors in delete forever, purge, prune, retention actions and moves out of held folders; hold badge. Files: `services/document-legal-holds.service.ts`, `commands/handlers/delete-document.handler.ts`, `commands/handlers/move-document.handler.ts`, `schedule/docs-drive.worker.ts`, `docs-ui` `components/detail/docs-detail-panel.component.ts`. Test: each refused path names the hold; release lifts it.
- [ ] **T53**. Provide the ports other features bind to (plan, **Consumer tokens answered**): `CALENDAR_FILES`, `CRM_DOCUMENTS`, `DATA_EXCHANGE_DRIVE`, `EXPENSE_RECEIPT_MAILBOX`, `LEARNING_FILES`, `MAIL_ATTACHMENT_TEXT`, `MEETINGS_FILES`, `PAYROLL_DOCUMENT_READER`, `SLIDES_PUBLIC_LINKS`. Files: `apps/api/src/plugin-composition.ts`. Test: one contract test per token over the shape its consumer plan states; with this feature off each consumer keeps its stated fallback.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Scope, flags and the one tree | T1, T4, T5 |
| FR-2 | §3.1 Scope, flags and the one tree | T10, T34 |
| FR-3 | §3.1 Scope, flags and the one tree | T2, T20, T29 |
| FR-4 | §3.1 Scope, flags and the one tree | T10 |
| FR-5–FR-6 | §3.2 Upload and organise | T16 |
| FR-7 | §3.2 Upload and organise | T16, T35 |
| FR-8 | §3.2 Upload and organise | T16, T35 |
| FR-9 | §3.2 Upload and organise | T17 |
| FR-10 | §3.2 Upload and organise | T9, T37 |
| FR-11 | §3.2 Upload and organise | T17 |
| FR-12 | §3.2 Upload and organise | T13 |
| FR-13 | §3.3 Sharing and permissions | T12, T13, T15 |
| FR-14 | §3.3 Sharing and permissions | T11, T12 |
| FR-15 | §3.3 Sharing and permissions | T11, T13, T36 |
| FR-16 | §3.3 Sharing and permissions | T13, T36 |
| FR-17 | §3.3 Sharing and permissions | T21 |
| FR-18 | §3.3 Sharing and permissions | T13, T24, T30 |
| FR-19 | §3.3 Sharing and permissions | T14, T34 |
| FR-20 | §3.3 Sharing and permissions | T13, T36 |
| FR-21 | §3.4 Public links and file requests | T20, T40 |
| FR-22 | §3.4 Public links and file requests | T20, T40 |
| FR-23 | §3.4 Public links and file requests | T20, T40 |
| FR-24 | §3.4 Public links and file requests | T20 |
| FR-25 | §3.4 Public links and file requests | T20, T40 |
| FR-26 | §3.4 Public links and file requests | T21 |
| FR-27 | §3.4 Public links and file requests | T20, T40 |
| FR-28 | §3.4 Public links and file requests | T22 |
| FR-29 | §3.4 Public links and file requests | T40, T50 |
| FR-30–FR-31 | §3.4 Public links and file requests | T50 |
| FR-32–FR-33 | §3.5 Previews and thumbnails | T23 |
| FR-34 | §3.5 Previews and thumbnails | T23, T37 |
| FR-35 | §3.5 Previews and thumbnails | T23 |
| FR-36–FR-38 | §3.6 File versions | T18 |
| FR-39 | §3.6 File versions | T18, T24 |
| FR-40 | §3.6 File versions | T18, T19 |
| FR-41 | §3.7 Trash, retention and holds | T15 |
| FR-42 | §3.7 Trash, retention and holds | T15 |
| FR-43 | §3.7 Trash, retention and holds | T15, T24 |
| FR-44 | §3.7 Trash, retention and holds | T24 |
| FR-45–FR-46 | §3.7 Trash, retention and holds | T48 |
| FR-47 | §3.7 Trash, retention and holds | T47 |
| FR-48 | §3.7 Trash, retention and holds | T51 |
| FR-49 | §3.7 Trash, retention and holds | T33 |
| FR-50 | §3.8 Home, recents and favourites | T14 |
| FR-51–FR-52 | §3.8 Home, recents and favourites | T14, T34 |
| FR-53 | §3.9 Search and asking | T54 |
| FR-54 | §3.9 Search and asking | T46 |
| FR-55 | §3.9 Search and asking | T49 |
| FR-56–FR-60 | §3.10 Quotas, storage and reservations | T19 |
| FR-61 | §3.10 Quotas, storage and reservations | T28, T52 |
| FR-62 | §3.11 Team spaces | T19, T38, T55 |
| FR-63 | §3.11 Team spaces | T55 |
| FR-64 | §3.12 Files on records | T26, T39, T44 |
| FR-65 | §3.12 Files on records | T26, T39 |
| FR-66–FR-67 | §3.12 Files on records | T26 |
| FR-68 | §3.12 Files on records | T26, T39 |
| FR-69 | §3.12 Files on records | T26, T41 |
| FR-70 | §3.13 Downloads and bulk | T25 |
| FR-71 | §3.13 Downloads and bulk | T17 |
| FR-72 | §3.14 Network drive, clients and keyboard | T29 |
| FR-73 | §3.14 Network drive, clients and keyboard | T29, T38 |
| FR-74–FR-75 | §3.14 Network drive, clients and keyboard | T41 |
| FR-76–FR-78 | §3.15 Editor apps | T9, T27 |
| FR-79 | §3.16 Activity, notifications, events | T31 |
| FR-80–FR-81 | §3.16 Activity, notifications, events | T30 |
| FR-82 | §3.16 Activity, notifications, events | T30 |
| FR-83–FR-84 | §3.17 Agents and MCP | T42 |
| FR-85 | §3.18 Reports | T43 |
| FR-86 | §3.18 Reports | T8 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off; enabling it in dev shows the feature end to end.
- Constitution gates in `spec.md` §9 confirmed.
- Feature checks: with `FEATURE_DRIVE` off the Documents hub behaves byte for byte as before (replace in place, archive, delete-after-archive and recover as today, no new routes); with the two switches off the public and network routes are absent from the OpenAPI document; the access predicate benchmark at 1 million rows stays under the list budget; no orphan blobs after the purge, prune and crash specs.
