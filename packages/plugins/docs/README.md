# @gauzy/plugin-docs

The Ever Gauzy **Documents** backend plugin: a single hub for uploaded files, authored wiki pages
(TipTap), folders, categories, versions, links to business records, and (in later milestones) the AI
knowledge pipeline.

## Overview

- One tree, one entity: `Document` discriminated by `kind` (`FOLDER` | `PAGE` | `FILE`).
- Satellite entities: `DocumentCategory`, `DocumentVersion`, `DocumentChunk`, `DocumentIndexState`,
  `DocumentShare`, `DocumentLink`.
- HTTP API under `/api/plugins/docs/...`, guarded by `TenantPermissionGuard` + `PermissionGuard` +
  `FeatureFlagGuard` (`FeatureEnum.FEATURE_DOCUMENTS`) with per-route `DOCS_*` permissions.
- Controllers contain no business logic — every mutation dispatches a CQRS command, every read a query.
- Migrations do **not** live in this package — they ship in `packages/core/src/lib/database/migrations/`.

## ⚠️ The `Document` name-shadowing gotcha

The entity class name `Document` shadows the DOM `Document` global available in TypeScript's ambient
lib. **Always import it explicitly** (`import { Document } from './entities/document.entity';`) — a
missing import compiles silently against the DOM type and fails at runtime. The package
`eslint.config.js` carries a `no-restricted-globals` rule so a bare `Document` reference is a lint
error, not a silent DOM fallback.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `GAUZY_DOCS_MAX_FILE_SIZE` | `52428800` | Per-file upload size limit in bytes (50 MB) |
| `GAUZY_DOCS_MAX_BINARY_BYTES` | `10485760` | Cap on the PAGE `contentBinary` CRDT column (10 MB) |
| `GAUZY_DOCS_AI_ENABLED` | `true` | Master switch for the AI pipeline (classification, embedding, retrieval). The AI stages are skipped when no AI provider is registered; set `false` to keep them off even when one is |
| `GAUZY_DOCS_EMBEDDING_MODEL` | `text-embedding-3-small` | Embedding model id (1536 dims) |
| `GAUZY_DOCS_CLASSIFY_MODEL` | *(chat default)* | Classification model id |
| `GAUZY_DOCS_OCR_ENABLED` | `true` | Provider-vision OCR for scanned PDFs and image uploads: one provider call per rendered page. Runs only when `GAUZY_DOCS_AI_ENABLED` is also on and a provider resolves credentials (tenant BYOK → environment → platform), using the classification model; otherwise a file with no text layer stays an extraction failure |
| `GAUZY_DOCS_OCR_MAX_PAGES` | `20` | Hard cap on the pages OCR renders and transcribes per document (the OCR cost fuse). Read like the other integer variables here, with `Number.parseInt(value, 10)`: the base-10 digits after optional leading whitespace and a `+`/`-` sign count, so `100pages` caps at 100, `+2pages` at 2 and `2.5` at 2; when the result is not a finite number of at least 1 (empty, `0`, negative, no leading digits), the default applies |
| `GAUZY_DOCS_VERSION_DEBOUNCE_MINUTES` | `10` | Server-side debounce window for PAGE version snapshots |
| `GAUZY_DOCS_QUEUE_CONCURRENCY` | `2` | `docs-processing` worker concurrency per process (queued mode only) |
| `GAUZY_DOCS_QUEUE_ENABLED` | *(follows `isSchedulerQueueRootEnabled()`)* | Register the BullMQ queue. Off ⇒ the pipeline runs **inline** |
| `GAUZY_DOCS_QUEUE_WORKER_ENABLED` | `true` | Also run the `docs-processing` consumer here. Set `false` on the API when a dedicated `apps/worker` is deployed |
| `GAUZY_DOCS_IMPORT_ENABLED` | `false` | Import of exported workspaces (a Markdown vault or an HTML export zip); off ⇒ `/plugins/docs/imports` answers 404 `DOCS_IMPORT_DISABLED` |
| `GAUZY_DOCS_IMPORT_MAX_ZIP_BYTES` | `104857600` | The largest import zip (100 MiB) |
| `GAUZY_DOCS_IMPORT_MAX_ENTRIES` | `5000` | The most entries one import zip may hold |
| `GAUZY_DOCS_IMPORT_MAX_UNCOMPRESSED_BYTES` | `1073741824` | The most an import zip may unpack to (1 GiB) |
| `GAUZY_DOCS_PDF_EXPORT_ENABLED` | `false` | PDF export of a page or a subtree; off ⇒ the PDF routes answer 404 `DOCS_PDF_EXPORT_DISABLED` |
| `GAUZY_DOCS_PDF_MAX_PAGES` | `200` | The most pages one subtree PDF export takes (413 `DOCS_PDF_TOO_MANY_PAGES` past it); at most `499`, a larger value is read as `499` |

## Pipeline dispatch: queued vs inline

The `extract → classify → chunk → embed → index` pipeline has **one** definition
(`DocsPipelineService`) and **two** dispatchers:

- **Queued** — `DocsProcessingWorker`, the BullMQ worker host. Requires a `@gauzy/scheduler` root
  (`SchedulerModule.forRoot({ enableQueueing: true })`) in the process. Every process that loads
  the plugin list registers one under the same condition — `@gauzy/core`'s `AppModule` (the API)
  and `SeederModule.forPlugins()` (the `yarn seed` CLI) register a **producer-only** root
  (`{ enabled: false, enableQueueing: true }` — queueing on, cron off), and `apps/worker`
  registers both halves because it also consumes. Jobs get `attempts: 3` with exponential backoff
  from a 120 s base and a deterministic `docs:<stage>:<documentId>` job id, so duplicate triggers
  coalesce in Redis.
- **Inline** — `DocsQueueService` runs the same stage handlers **in-process on a background task**
  when no scheduler root is present (any deployment without Redis: single-container, dev, or
  `SCHEDULER_QUEUE_ENABLED=false`), so the HTTP request is never blocked. Inline runs get
  a single immediate attempt; a failure dead-letters onto the document row (`FAILED` +
  `statusMessage`) exactly like the queue's final attempt, and an in-flight guard keyed on
  `docs:<stage>:<documentId>` stops a duplicate trigger from running the same stage twice at once.

`SchedulerQueueService` is injected `@Optional()` for exactly this reason — a required dependency
made the whole API fail to bootstrap the moment this plugin was registered. The active mode is
logged once at startup by `DocsQueueService` (`docs-processing dispatch mode: QUEUED|INLINE`).

### Turning it off

`SCHEDULER_QUEUE_ENABLED=false` removes the BullMQ root from every process at once and puts the
whole fleet back on the inline path; `GAUZY_DOCS_QUEUE_ENABLED=false` does the same for this
plugin alone. Either is a safe, reversible rollback — inline dispatch is a supported mode, not a
degraded one.

## Building

Run `yarn nx build plugin-docs` to build the library.

## Markdown (export and update)

- `GET /plugins/docs/documents/:id/export/markdown` answers a page as Markdown (`text/markdown`, a download named after
  the page); `?subtree=true` answers the page and the pages under it the caller may read as a zip: `index.md` for the
  root, one file per page (`<slug>.md`, or `<slug>/index.md` when it has children) under its parent's folder, the
  links between the pages relative, the files the pages show (images and attachments served by the Documents API)
  under `assets/`. Up to 500 pages, and up to 256 MB of files (a file past the budget keeps its API link); a page the
  caller may not read is left out with what is under it. The route shares the bulk route's rate limit
  (`GAUZY_DOCS_ADMIN_OPS_RATE_LIMIT`).
- `PUT /plugins/docs/documents/:id/content/markdown` `{ markdown, expectedRevision? }` applies a Markdown text to a
  page: the text is read back into the canonical JSON, and only the blocks whose Markdown changed are replaced — a
  block whose Markdown is the same keeps its stored JSON, attributes the Markdown cannot carry and all (a longest
  common subsequence of the blocks' Markdown decides). The content route's rules apply: a stale `expectedRevision` is
  409 `DOCS_CONTENT_CONFLICT` with the current one, a locked page 423, the schema, the version snapshot, the HTML
  render cache, the mention and link sync. Nothing is written when the text changes nothing. Answers the document,
  its revision, and `changedBlocks` / `keptBlocks`.
- The stored subset Markdown carries: paragraphs, headings, bullet / ordered / task lists (nested), code blocks with a
  language, quotes, rules, tables, images, hard breaks; bold, italic, strike, code and links. Mentions, emoji, maths,
  callouts, details, files and embeds are written as text or links on export; what Markdown cannot say (alignment,
  colours, block ids) survives an update on the blocks it did not change. `services/document-markdown.ts` (pure, with a
  spec) does the two directions and the block diff; `marked` reads the Markdown, `archiver` writes the zip.

## Import of exported workspaces (`GAUZY_DOCS_IMPORT_ENABLED`)

Spec: [`docs/specs/features/docs-import-export/`](../../../docs/specs/features/docs-import-export/spec.md).

- `POST /plugins/docs/imports` (multipart: `file` = one zip; `parentId`, or `visibility` + `organizationTeamId`;
  `DOCS_CREATE`) stores the zip under `documents/<tenant>/<org>/imports/`, inspects it (`import/import-archive.ts`:
  entry count, declared and actual uncompressed size, a 200:1 inflation cap above 1 MiB, absolute / drive / NUL / `..`
  paths and symbolic links refused, at least one page file), resolves the target as a page create does (a parent the
  caller may write, whose space the pages take; or a space), and queues `docs.import` (the `docs-processing` queue, or
  inline). A refused zip is deleted and answered 400 / 413 with its `code`. The request checks what the archive
  declares (its central directory); an entry that inflates past its declared size is caught when the run reads it,
  and the import then ends `FAILED` with `DOCS_IMPORT_ZIP_BOMB` (the zip deleted) rather than the request answering
  413.
- `GET /plugins/docs/imports/:id` answers the state, the phase (PLANNING → TREE → CONTENT → DONE), the progress and the
  report (imported, skipped and failed items with reasons; unresolved links per page) — to its starter, or to a Docs
  manager. `GET /plugins/docs/imports` lists the caller's last ten and the zip limit (the clients' probe).
- The run (`import/document-import.runner.ts`) detects the layout (`import/import-plan.ts`: an HTML export by the
  trailing 32-hex ids of its files and folders, a Markdown vault otherwise), builds the tree (a page file and a folder
  of the same name, a folder's `index.md` or its folder note are one page), creates folders and pages, then the
  attachments through the upload checks (sniffing, the per-file limit, the organization quota) under the page that
  first shows them, then converts every page (`import/import-content.ts`: front matter and the export header for the
  title, emoji icon and created date; HTML sanitized and turned into Markdown; wiki links and embeds; relative links;
  `markdownToDocument`; page links become page mentions, files become stored images or attachment cards) and writes it.
  Every created document carries `externalSource = docs-import:<importId>` and a digest of its path, so a resumed run
  (a queue retry, the read of a stalled import, the startup sweep) never creates anything twice.

## PDF export (`GAUZY_DOCS_PDF_EXPORT_ENABLED`)

- `GET /plugins/docs/documents/:id/export.pdf` answers a page as a PDF (`DOCS_READ`, the Markdown export's access);
  `?subtree=true` the page and the readable pages under it as one PDF with a table of contents (each page from a new
  sheet); `?subtree=true&format=zip` a zip with one PDF per page at the Markdown export's paths.
  `GET /plugins/docs/exports/pdf` is the clients' probe.
- `pdf/tiptap-pdf.ts` (pure) turns the stored JSON into pdfmake content; `pdf/pdf-render.ts` adds the header (title,
  date) and footer (page numbers), embeds the page's images (read through the file's own access check, re-encoded with
  `sharp`, 64 MiB per export) and renders with pdfmake and its bundled Roboto font (Latin, Greek, Cyrillic). The
  renderer fetches nothing: every URL is denied and an external image is its alternative text.

## Running unit tests

Run `yarn nx test plugin-docs` to execute the unit tests via [Jest](https://jestjs.io).

## Inbound email capture

Documents emailed to an organization's capture address land in Documents as `source: EMAIL`,
`reviewStatus: PENDING`, `knowledgeStatus: NONE` — a human approves them before anything reaches the
AI knowledge base.

### Two kinds of address

| Kind | Address | Armed when |
|---|---|---|
| `PLATFORM` | `docs-<128-bit hex>@$GAUZY_DOCS_INBOUND_DOMAIN` | immediately — minted on first read of `GET /plugins/docs/inbound-addresses` |
| `CUSTOM_DOMAIN` | `<mailbox>@<the tenant's own domain>` | only once `_gauzy-docs.<domain> IN TXT` carries the value the settings UI shows |

A platform address is unguessable, so the address *is* the credential. A custom-domain mailbox name
is chosen by the tenant and therefore guessable, which is why that kind stays inert until domain
ownership is proven. Re-verifying a `VERIFIED` domain whose record has disappeared moves it to
`FAILED` and it stops accepting mail — a domain that changes hands does not keep delivering.

### How a delivery proves itself

Either proof is sufficient:

1. **Deployment-wide HMAC** — `hex(HMAC_SHA256(secret, "<timestamp>.<rawBody>"))` in
   `x-gauzy-docs-signature`, with `x-gauzy-docs-timestamp`. Fails closed when
   `GAUZY_DOCS_INBOUND_WEBHOOK_SECRET` is unset; enforces a 5-minute tolerance, a constant-time
   compare, and single-use replay consumption.
2. **Per-address relay secret** — presented in `x-gauzy-docs-address-secret`, issued once at creation
   or rotation and stored only as SHA-256. Prefer this for tenant-owned domains: the deployment-wide
   secret can post as *any* tenant, a per-address secret only as one.

🛑 The HMAC is computed over the **raw request bytes**. `packages/core/src/lib/bootstrap/index.ts`
preserves them via the body-parser `verify` hook; the adapter falls back to canonical JSON only when
they are absent, and that fallback will not match a real provider's signature.

🛑 **Failure ordering is deliberate.** "No valid proof" (403) is raised *before* "unknown address"
(404), because a per-address secret cannot be checked until the address has been resolved. If the
404 came first, an unauthenticated caller could sweep addresses and learn which ones exist.

### Gates, in order

1. Channel enabled (`GAUZY_DOCS_INBOUND_EMAIL_ENABLED`, default `true`) — otherwise 404, as if the route did not exist
2. Authentication — either proof above, else 403
3. Recipient resolves to an armed address — else 404
4. SPF/DKIM verdicts, when the provider reports them
5. Sender allowlist — empty means "any sender that passed gate 4"; matches a full address or a whole
   domain, compared exactly (`acme.com` admits neither `evil-acme.com` nor `acme.com.evil.tld`)
6. Size caps, per message and per attachment
7. Attachments only, then the same magic-byte sniffing the upload endpoint runs

### Operational notes

- Addresses live in `document_inbound_address`, with a **deployment-wide UNIQUE index on `address`**.
  That is a security control, not an optimization: routing is by recipient alone, so two rows sharing
  an address would make the destination tenant depend on row order.
- Rotating a platform address changes the address itself; the previous one stops resolving at once.
- Setting an address inactive rejects mail while keeping its history — capture data is never deleted.

## Collaboration: spaces, follows, notifications (`GAUZY_DOCS_COLLAB_ENABLED`)

Off by default. With the flag on:

- **Spaces.** A page is in the organization's space (`visibility: ORGANIZATION`), a team's space
  (`visibility: TEAM` + `organizationTeamId`, a team of the organization the writer belongs to — or
  administers with `DOCS_MANAGE`) or the writer's private space (`visibility: PRIVATE`). A team's
  pages are its current members' to read and write, like a page shared with the team at `EDIT`;
  membership resolves at query time, so leaving a team hides its pages on the next request. Shares
  apply to PRIVATE and TEAM pages. `GET /plugins/docs/documents/spaces` lists the spaces the caller
  sees with their counts; `GET /documents?space=organization|team|private[&organizationTeamId=…]`
  lists one space; `POST /documents/:id/space` moves a page — and, by default, the descendants the
  caller may write — to another space (the owner's or a `DOCS_MANAGE` holder's call, like visibility).
  With the flag off, a `TEAM` write answers 404 `DOCS_COLLAB_DISABLED`; existing TEAM pages keep
  their access rules.
- **Follow / mute.** `GET|POST /documents/:id/follow`, `POST /documents/:id/unfollow`,
  `POST /documents/:id/mute`, `POST /documents/:id/unmute`. Following is the platform's entity
  subscription (what the comment fan-out and the mention service already create); muting removes
  the caller's subscriptions and is remembered in `metadata.collaboration.mutedEmployeeIds`, so the
  plugin's own notifications leave them out until they unmute (a direct mention still subscribes
  them again, as everywhere on the platform).
- **Inbox entries.** A page shared with me (or with my team), a review asked of me
  (`reviewerEmployeeIds` on the review request), a decision on a page I created — through the
  platform's notifications, which the unified Inbox lists; mentions and comments on followed pages
  were already the platform's. The same person is told of the same thing on one page once per ten
  minutes (`DOCS_NOTIFICATION_DEDUPE_MINUTES`).
- **`contentRevision`.** Moves on every content change (content save, version restore; the Markdown
  update of the next phase). A content save may state `expectedRevision`; a stale one is 409
  `DOCS_CONTENT_CONFLICT` with `currentRevision`, like a stale `expectedUpdatedAt`.

Migration `1791000004800` adds `document.organizationTeamId` (foreign key to `organization_team`,
`SET NULL` — a deleted team leaves its pages in place for a manager to move) and
`document.contentRevision` (default 1), plus the index `IDX_document_tenant_org_team`.


## Live co-editing (`GAUZY_DOCS_LIVE_ENABLED`)

Off by default (exactly `true` turns it on). Off, `DocsLivePlugin` is not loaded: no route, no GraphQL field, and the
editor keeps its single-writer autosave with the revision check. On:

The server half is described here; an editor co-edits only once its client binds to it (the Angular Docs editor in
`docs-ui` and the Ever Teams editor do, in their own changes). A client that does not keeps its autosave, and its saves
reach the live editors as server-side writes.

- **The session.** `Subscription.documentLive(documentId, connectionId)` (the platform's GraphQL subscription
  channel, the same socket as `collaborationEvents`) opens a live session of a page the caller may read
  (`DOCS_READ`; 404 otherwise). Its frames carry base64 payloads: `sync` first (the page's Yjs state, its state
  vector, the co-editors' awareness, `readOnly` + `reason`, the state's `lineage` and `revision`), then `update`
  (someone's edit, or a server-side write), `awareness` (cursors, presence), `mode` (read-only or writable again) and,
  last, `closed` with the reason. The client sends its edits to `POST /plugins/docs/documents/:id/live/updates`
  `{ connectionId, update }` (`DOCS_UPDATE`) and its cursor to `…/live/awareness` `{ connectionId, awareness }`; after
  `sync` it sends what the server lacks (`Y.encodeStateAsUpdate(doc, stateVector)`), which is how an editor that was
  offline merges. A client holding a document of another lineage drops it first: the two would not merge. An edit is
  applied to a copy of the page first and refused (400 `DOCS_LIVE_UPDATE_INVALID`, nothing applied) when a block it
  touches is not one the page's schema accepts; an awareness update may write only the client ids its own session
  reported (at most eight per session).
- **The document.** The editor binds TipTap's `Collaboration` extension to the `default` fragment; the server reads
  and writes it the way y-prosemirror does (`live/document-live.yjs.ts`, with a spec that runs the editor binding on
  the server's state). A page is seeded from its stored JSON alike in every process (the seed's client id is derived
  from the page and its revision), so two processes that seed one page hold one lineage, and the seed is stored at
  once. `contentBinary` holds the state with a header naming its lineage and revision — outside the shared document,
  so an editor cannot rewrite it — and the editor's older autosave seed (no header) is not a live state.
- **Saving.** Two seconds after the last edit (`GAUZY_DOCS_LIVE_PERSIST_DEBOUNCE_MS`), at most ten seconds after the
  first unsaved one (`GAUZY_DOCS_LIVE_PERSIST_MAX_WAIT_MS`), when the page's last session closes and when the process
  stops: `contentJson`, `contentHtml` and `contentBinary`, under a claimed `contentRevision`, with the version
  snapshot, the mention and cross-link sync and the `updated` event of a content save, attributed to the editor whose
  edit came last. A persist merges the stored state first, so two processes saving one page keep each other's edits.
  A save that fails is tried again (2 s, then longer, up to a minute), and the page stays loaded until it is saved.
  A state over `GAUZY_DOCS_MAX_BINARY_BYTES` is not stored: the content is saved without it and the sessions turn
  read-only (`size_limit`).
- **Server-side writes.** An API or Markdown save and a version restore write the page as before; the plugin then
  works the change out against the state the write found (the stored state of the previous revision) and applies it
  to the live document, so open editors see it at once and keep what they typed, saved or not, in the blocks the
  write did not change; it stores the state for the new revision. While a page has a live
  state, a content save's `contentBinary` (the editor's seed) and a restored version's binary are not written over
  it. A duplicate saves the live document first.
- **Access and limits.** Read-only without write access (`no_write_access`), on a locked page (`locked`), past
  `GAUZY_DOCS_LIVE_MAX_SESSIONS_PER_PAGE` editors (50, `session_limit`) and at `GAUZY_DOCS_MAX_BINARY_BYTES`
  (`size_limit`). Every session is checked again every `GAUZY_DOCS_LIVE_RECHECK_SECONDS` (60), when the page changes
  (a move, a lock, the trash) and when a share changes: one that lost read access closes (`access_revoked`), a
  trashed page closes them all (`trashed`). A user holds at most `GAUZY_DOCS_LIVE_MAX_SESSIONS_PER_USER` sessions per
  process (20; 429 `DOCS_LIVE_USER_LIMIT`); one edit is at most `GAUZY_DOCS_LIVE_MAX_UPDATE_BYTES` (1 MB, 413).
- **Several API processes** need the shared pub/sub (Redis, `GRAPHQL_PUBSUB_REDIS`): each process holding a page
  relays its edits to the others on the page's tenant topic, and an edit posted to a process that does not hold its
  session is handed to the one that does, which answers with what it did (its 403 or 400; no answer within three
  seconds is the 404 of a session no process holds). A lock, a move or the trash in one process is told to the
  others, which check their sessions again. With one process (SQLite, `GAUZY_API_SINGLE_PROCESS=true`) nothing else is
  needed. `GET /plugins/docs/live/status` answers this process's pages and sessions of the caller's tenant and whether other
  processes are reached (`shared`).

Known limits: team membership changes reach open sessions on the next periodic check (a minute), and a copy taken
while another process holds the page reads what that process last saved (at most the persist window old).
