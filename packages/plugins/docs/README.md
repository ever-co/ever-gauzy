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
  under `assets/`. Up to 500 pages; a page the caller may not read is left out with what is under it.
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

