# Implementation Plan: Presentations

> Translates an approved `spec.md` into architecture and tech choices. The plan owns
> implementation details; the spec owns behaviour.

**Feature ID**: `presentations`
**Spec**: `./spec.md`
**Tasks**: `./tasks.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## 1. Architecture Summary

A new plugin triple, `@gauzy/plugin-slides` (`packages/plugins/slides`), `slides-ui` (Angular: registration, routes,
menus and settings inside the documents hub) and `slides-react-ui` (the one editor, viewer, presenter view and audience
view, written once in React and mounted in the Angular app and in `public-layout-ui` through the existing React bridge
`@gauzy/ui-react`, the way `dashboard-time-track-react-ui` and `ai-chat-react-ui` are), loaded by
`apps/api/src/plugins.ts` only when `GAUZY_SLIDES_ENABLED` is exactly `true` (its render-only module of §3 loads
whenever the package is installed) and gated per tenant by
`FEATURE_PRESENTATIONS`. An isomorphic library, `@gauzy/slides-model` (`packages/slides-model`), holds what the browser,
the API and the worker must do alike: the deck model over a shared CRDT document, the theme and layout engine, the
**SVG renderer** (one rendering for editor, thumbnails, presenting, PDF and images) and the PPTX and ODP codecs. It
builds on what exists:

- **One storage model.** A deck is a **file kind** of `drive`: a `FILE` row with `editorKind = 'deck'`, registered with
  `registerDocumentFileKinds` and written through `DOCS_FILE_STORE`; the native state is in `contentBinary`, the PPTX
  copy in the blob (the kind's `render`), versions in `document_version` (`source = APP`). Its media are hub files in
  the owner's deck media folder (`DOCS_FILE_STORE.folderFor`, purpose `deck`) attached to the deck through
  `DOCS_RECORD_FILES`, so quota and sniffing apply; they are served only through the deck's media route. The plugin
  never writes hub tables.
- **One co-editing transport.** The live codec seam and `DOCS_LIVE_SESSIONS` added by `spreadsheets` (its T4 to T6)
  serve the `deck` codec: the same `Subscription.documentLive` session, persistence, relay, access re-checks and
  server-side writes as pages and workbooks. Text boxes are rich-text fragments of the hub editor's schema, so typing
  merges character by character as on pages.
- **Platform pieces**: bound charts read through `REPORT_CARDS` (report-builder, whose results are cached per access
  hash) and the workbook range reader of `spreadsheets` (whose live values are cached per reader there), so decks keep
  no chart result cache of their own; audience questions are core comments with core reactions as members' votes (guests' votes in `slide_guest_vote`, §3); polls are the
  core poll records of `discussions`; public viewing rides `drive`'s public links (core `shared_entity` rows); PDF
  through `print-and-pdf-designer`, else the docs plugin's `pdf/pdf-render.ts`.
- **Hub and app pieces, not copies**: templates are the hub's template fields and gallery and comment anchors the hub's
  `document_comment_anchor` (kind `SLIDE`), both from `documents-and-wiki`; generation runs as a core operation;
  offline presenting extends the Angular app's existing service worker (`apps/gauzy/ngsw-config.json`,
  `ngsw-config.prod.json`, `serviceWorker: true` in `apps/gauzy/project.json`); the first brand rules start from the
  organization's `brandColor` and logo (`packages/core/src/lib/organization/organization.entity.ts`); permissions, the
  feature and settings are plugin contributions.

```mermaid
flowchart LR
    NG[Angular slides-ui in the documents hub, hosting the React DeckEditor through @gauzy/ui-react] --> API
    TEAMS[Ever Teams client over the same API] --> API
    MCP[MCP slides tools] --> API
    AUD[Audience view in public-layout-ui: members, guests] --> API
    NG <-- documentLive frames --> LIVE[docs live service] --> CODEC[deck live codec]
    API[slides controllers + GraphQL reads] --> SVC[Deck, theme, brand rules, chart, linked slide, session, generation services]
    SVC & CODEC --> MODEL[[@gauzy/slides-model: CRDT deck, layouts, SVG renderer, codecs]]
    SVC --> HOST[[DOCS_FILE_STORE, DOCS_RECORD_FILES, DOCS_LIVE_SESSIONS]] --> DB[(document FILE editorKind deck, versions, media)]
    SVC --> SDB[(slide_* tables)]
    SVC --> RC[[REPORT_CARDS]] & SR[[SLIDES_SHEET_RANGES → spreadsheets]] & PRT[[SLIDES_PRINT]]
    SVC --> CMT[[core comments, reactions, polls; hub comment anchors]]
    SVC --> OPS[[core operations: slides.import, slides.export, slides.generate]]
    SVC -. generate, rewrite .-> AI[[SLIDES_ASSISTANT]]
    SVC --> OUT[[outbox: slides.*]] --> RT[realtime hints and signals: deck:id, session:id]
    WORK[worker and queues: thumbnails, media, linked sync, exports, sweep] --> SVC
```

## 2. Tech Choices

| Concern | Choice | Rationale |
| ------- | ------ | --------- |
| Package | new `packages/plugins/slides`, `-ui`, `-react-ui`; library `packages/slides-model` | Principle I; one renderer everywhere |
| Editor, viewer, presenter | one React package (`slides-react-ui`) mounted by `slides-ui` and `public-layout-ui` through `@gauzy/ui-react` (`LazyReactHostDirective`) with Angular services in the host context; no Angular canvas | one editor to build and test |
| Templates | the hub's template fields on `document` and `/templates?kind=deck` of `documents-and-wiki` | one template model |
| Comment anchors | `document_comment_anchor` with `kind = SLIDE` and a locator (slide key, element key, x, y) on the existing `/documents/:id/comment-anchors` routes | one anchor table per hub comment |
| Generation | core operation `slides.generate` (state: source, options; result: deck id, assistant used); the deck keeps `generatedFrom` | one runtime for long work |
| Brand rules | the first rules of an organization seeded from its `brandColor` and logo | branding is set once |
| Permissions, feature, settings | contributions of the plugin (`slides.plugin.ts`, `slides.settings.ts`) | the platform's catalogue and settings store |
| Storage | drive file kind `deck` (`FILE` row, `editorKind`); CRDT in `contentBinary`, PPTX copy as the blob, manifest in `contentJson` | one storage model |
| Co-editing | docs live module with a `deck` codec | no second transport |
| CRDT and text | `yjs`, `y-protocols`, `y-prosemirror`, TipTap and ProseMirror (already docs-ui dependencies) | same text behaviour as pages |
| Charts | `chart.js` (the report builder's stack); server drawing on `@napi-rs/canvas` | one charting stack |
| Images | `sharp` (already a docs dependency) for optimisation and thumbnails | no new image stack |
| Push | outbox → realtime hints; presenter position as ephemeral signals | Principle VII |
| Offline | the app's existing Angular service worker (`apps/gauzy/ngsw-config.json`, `ngsw-config.prod.json`) gains a data group `deck-packages` for decks a person keeps offline; deck state and media in IndexedDB of `ui-core`; no second worker is registered | one offline mechanism |
| Assistant | `SLIDES_ASSISTANT` → `ai-agents-and-assistants`; fallback `ai-chat` `AiProviderRegistry` | tenant's own provider |

**Open-source building blocks.** Data model, permissions, persistence, co-editing and screens stay ours. Task T1 is a
spike that renders 40 fixture slides with each candidate in the browser and in Node and compares the images. Only
permissively licensed packages are used; the dependency licence gate checks every package.

| Building block | Candidates | Default |
| --- | --- | --- |
| Slide canvas and direct manipulation | our SVG scene from `slides-model` with `moveable` and `selecto` for handles and marquee; `konva` | our SVG scene with `moveable` and `selecto` (the same renderer runs on the server); `konva` as the fallback for heavy slides |
| Presenting runtime | our renderer with the browser full-screen API | our renderer |
| PPTX and ODP | `pptxgenjs` for PPTX export; our PPTX reader extending `office-package.util.ts` and `pptx.extractor.ts` of the docs plugin; our ODF reader and writer over `office-xml.util.ts` and `odf.extractor.ts`; `jszip` | `pptxgenjs`, our readers and ODF code |
| PDF | `PrintService.render` of `print-and-pdf-designer`; the docs plugin's `pdf/pdf-render.ts` (`pdfmake`, bundled font, draws SVG) | print service, docs PDF helpers as fallback |

## 3. Data Model

### Deck state (in the hub's `document` row)

`contentBinary` holds the CRDT state with the docs lineage and revision header: a `deck` map (size, theme key, brand rules
id, layouts, sections, slide order as fractional position keys) and one map per slide (`slide:<key>`: layout key,
background, transition, advance time, hidden, notes as a rich-text fragment, elements keyed by stable ids with
geometry, style, z-order position key, link id for element tracking, build steps; text elements hold a rich-text fragment).
`contentJson` holds the manifest (slides with keys, titles, layout, hidden, media and chart keys). The kind's
`extractText` gives slide titles, text and notes as Markdown to search and knowledge, `thumbnail` the cover (slide 1),
`render` the PPTX copy after a persist (debounced 60 s) and on download. A persist marks the copy stale in its own
transaction (the manifest's `blobRevision` behind the document's `contentRevision`) until that render. The PPTX codec
lives in `@gauzy/slides-model`, and the render-only `SlidesRenditionModule` (`packages/plugins/slides/src/lib/rendition/`,
no route, table, job or page) is loaded by `apps/api/src/plugins.ts` whenever the package is installed, also with
`GAUZY_SLIDES_ENABLED` off; it registers only the `deck` kind's `render` with drive's file-kind registry, so a download
that finds the copy stale renders it from the saved state first, and after a start it renders every stale copy in
batches; the plugin also renders stale copies at shutdown. With the feature or the plugin off, even after an unclean
stop, a download is the last saved state (spec §2.2). Versions are drive's `document_version` rows.

### New tables (plugin; all `TenantOrganizationBaseEntity`, soft delete; JSON as `text`; keys `varchar(32)`)

| Table | Columns (besides base) | Indexes and uniqueness |
| --- | --- | --- |
| `slide_deck` | `documentId` FK `document` cascade, `aspect` varchar(16), `themeId` null, `brandRulesId` null, `slideCount` int, `generatedFrom` text null (the source of a generated deck; template marking is the hub's `templateScope` on the `document` row) | unique `(documentId)` |
| `slide_thumbnail` | `documentId`, `slideKey`, `revision` int, `storageKey` varchar(1024), `width`, `height` int, `renderedAt` | unique `(documentId, slideKey)` |
| `slide_theme` | `name`, `tokens` text (colours, fonts, backgrounds, element defaults), `layouts` text, `isSystem` bool, `systemKey` varchar(64) null, `brandRulesId` null, `version` int | unique `(tenantId, organizationId, name)`; unique `(systemKey)` where set |
| `slide_brand_rules` | `name`, `colours` text, `fonts` text (file ids and families), `logos` text (file ids), `themeIds` text, `templateIds` text, `enforcement` (`OFF`, `SUGGEST`, `ENFORCE`), `isDefault` bool; the default row is created on first use from the organization's `brandColor` and logo (`imageUrl`) | unique `(tenantId, organizationId, name)` |
| `slide_linked_slide` | `documentId`, `slideKey`, `sourceDocumentId`, `sourceSlideKey`, `mode` (`SYNC`, `DETACHED`), `sourceRevision` int, `lastSyncedAt` | unique `(documentId, slideKey)`; idx `(sourceDocumentId)` |
| `slide_chart_binding` | `documentId`, `elementKey`, `sourceKind` (`REPORT`, `SHEET_RANGE`, `SHEET_TABLE`), `sourceKey` varchar(160), `parameters` text, `frozen` text null, `frozenByUserId` null, `frozenAt` null | unique `(documentId, elementKey)`; idx `(sourceKind, sourceKey)` |
| `slide_session` | `documentId`, `presenterUserId`, `status` (`LIVE`, `PAUSED`, `ENDED`), `joinCodeHash` varchar(64), `currentSlideKey`, `buildStep` int, `allowGuests` bool, `anonymousQuestions` bool, `publicLinkRef` varchar(64) null, `startedAt`, `endedAt`, `peakAudience` int | idx `(documentId, startedAt)`; idx `(status, updatedAt)` |
| `slide_session_attendee` | `sessionId` FK cascade, `userId` null, `guestKeyHash` varchar(64) null, `joinedAt`, `leftAt` null | idx `(sessionId)`; unique `(sessionId, userId)` and `(sessionId, guestKeyHash)` where set |
| `slide_session_slide` | `sessionId` FK cascade, `slideKey`, `shownAt`, `seconds` int | idx `(sessionId, shownAt)` |
| `slide_guest_vote` (votes of guests, who have no employee for a core reaction) | `sessionId` FK cascade, `commentId` (the question's core `comment`), `guestKeyHash` varchar(64), `emoji` varchar(32) | unique `(commentId, guestKeyHash, emoji)`; idx `(sessionId)` |
| `slide_rehearsal` | `documentId`, `userId`, `timings` text (slide key → seconds), `totalSeconds` int | idx `(documentId, userId)` |

Not tables of this plugin: chart results (read per reader from `REPORT_CARDS`, cached by access hash in the report
builder, and from the spreadsheets range reader; only frozen values live on the binding), comment anchors (the hub's
`document_comment_anchor`, kind `SLIDE`), generation runs (core `operation`, type `slides.generate`, with `sourceKind`
`PAGE`, `REPORT`, `SHEET_RANGE` or `OUTLINE`, the options and the requester in its state, the deck id and whether the
assistant was used in its result), template flags (the hub's template fields).

Audience questions are core `comment` rows on entity `SlideSession` (answered = resolved, hidden = withdrawn by the
presenter); a member's vote is a core `reaction` row on the question's `Comment`, written with that member's own
employee as today's reactions are; a guest's vote is a `slide_guest_vote` row keyed by the guest's key hash, so two
guests voting the same emoji each count and one guest's vote never removes or replaces another's (a second vote of the
same guest withdraws only that guest's own); a question's count is its reactions plus its guest votes. Anonymous
questions are written by the system actor with a guest key hash in the comment's metadata. Polls are core `poll` rows of `discussions` with host
`SlideSession` or a poll element key.

### Changes outside the plugin (additive)

- `contracts`: `BaseEntityEnum.SlideSession`; `slides.model.ts` (manifest, slide and element
  shapes, theme tokens, layout, brand rules, binding, session, attendee, question view, generation operation state and
  result). The feature, the permissions of §9 and the settings are contributions of the plugin, not enum edits.
- `apps/gauzy/ngsw-config.json` and `ngsw-config.prod.json`: a data group `deck-packages` (deck state and media routes
  of decks a person keeps offline, `freshness` strategy); the existing worker registration is unchanged.
- Uses `documents-and-wiki`'s hub pieces unchanged: the template fields and `/templates?kind=deck` gallery and the
  `SLIDE` kind of `document_comment_anchor` on the existing anchor routes (its T4, T17).
- `packages/plugins/slides/src/lib/comments/slide-session-comment-access.policy.ts`: a `@CommentParentAccessPolicy()`
  for `SlideSession` (readers: attendees of a live session and readers of the deck; writers: attendees while live).
- `packages/plugins/realtime`: audience-scoped tokens (scope `slides-audience:<sessionId>`, 12 hours) accepted on the
  collaboration socket for that session's topic only, so guests follow without an account; polling `GET /sessions/:id`
  every 2 s is the documented fallback.
- The `deck` file kind is registered through drive's `registerDocumentFileKinds` with its live codec (PPTX and ODP
  types, `createBlank`, `render`, `extractText`, `thumbnail`, `openRoute: '/pages/documents/deck/:id'`); drive's
  `folderFor` gains the purpose `deck` (additive); no further docs change.

### Migrations

**Migration timestamps**: `packages/plugins/slides` `1791000064200` to `1791000064299`.

Plugin migrations with the shared core migration helpers of `@gauzy/core`; PostgreSQL, SQLite and MySQL branches;
idempotent, forward-only, both ORMs:

1. `1791000064200-CreateSlideDeckTables` — deck, thumbnail, theme, brand rules, linked slide.
2. `1791000064210-CreateSlideChartTables` — chart binding.
3. `1791000064220-CreateSlideSessionTables` — session, attendee, session slide, guest vote, rehearsal.
4. `1791000064230-SeedSlidesSystemThemes` — system themes and layouts; `down` no-op.

The `FEATURE_PRESENTATIONS` feature (off for every tenant), the permissions with their default grants and the settings
are contributions of the plugin (§9), not a migration.

### Contracts

`slides.model.ts` and `BaseEntityEnum.SlideSession` in `packages/contracts`, listed under "Changes outside the plugin (additive)"; they reach the SDKs and Ever Teams through the OpenAPI document.

## 4. API Surface

All routes under `/api/plugins/slides`, `@FeatureFlag(FEATURE_PRESENTATIONS)`, `TenantPermissionGuard`,
`PermissionGuard`, class-validator DTOs, Swagger; `DOCS_FILE_STORE.access` on every deck route;
`Idempotency-Key` on creating routes; cursor pagination.

| Method | Endpoint | Permission | Description | Status |
| ------ | -------- | ---------- | ----------- | ------ |
| `POST` | `/decks`, `/decks/from-file` | `DOCS_CREATE` | blank with theme, from template; from a hub PPTX or ODP file (`202`) | New |
| `GET` `PATCH` | `/decks/:id` | read / edit | manifest, my access, live mode; size, theme, brand rules (template marking: the hub's `/documents/:id/template`) | New |
| `POST` `PATCH` `DELETE` | `/decks/:id/slides[/:key]`, `PUT …/order` | edit | add from layout, update elements and notes (`expectedRevision`, `preview`), reorder | New |
| `GET` | `/decks/:id/thumbnails/:slideKey` | read | PNG or WebP | New |
| `POST` `GET` | `/decks/:id/import`, `/decks/:id/export?format=pdf\|pptx\|odp\|png&slides=&notes=` | edit / read | operations or streams | New |
| `GET` `POST` `PATCH` `DELETE` | `/themes[/:id]` | read / `SLIDES_THEME_MANAGE` | organization themes and layouts | New |
| `GET` `POST` `PATCH` `DELETE` | `/brand-rules[/:id]` | read / `SLIDES_BRAND_RULES_MANAGE` | brand rules; `POST …/:id/check` reports a deck's off-brand values | New |
| `POST` | `/decks/:id/linked-slides`, `POST …/:key/{sync,detach}` | edit + read of the source | link or copy; sync; detach | New |
| `GET` `PUT` `DELETE` | `/decks/:id/charts/:elementKey/binding`, `POST …/{refresh,freeze}` | edit (read: read) | bindings; per-reader data; freeze with `confirmAudience` | New |
| `POST` | `/decks/generate` | `SLIDES_GENERATE` + read of the source | `{ source, length, audience, themeId, preview }` → outline, or `202` with a `slides.generate` operation whose result is the draft deck | New |
| `POST` | `/decks/:id/assist` | `SLIDES_GENERATE` | rewrite text, draft notes, suggest a layout → proposal | New |
| `POST` `GET` `PATCH` | `/decks/:id/sessions`, `/sessions/:id` | read (guests: `SLIDES_PRESENT_PUBLIC`) | start; state; move, pause, end | New |
| `POST` | `/sessions/join` | public, rate limited | `{ code }` → session view and audience token | New |
| `GET` `POST` | `/sessions/:id/questions`, `POST …/:qid/{vote,answer,hide,show}` | attendee / presenter | questions over core comments and reactions | New |
| `POST` `GET` | `/sessions/:id/polls`, `POST /polls/:id/{open,close,vote}` | presenter / attendee | ad-hoc and slide polls over core polls | New |
| `GET` | `/sessions/:id/summary`, `/decks/:id/activity` | presenter or editor | FR-64, FR-65 (CSV, PDF) | New |
| `GET` `PUT` | `/decks/:id/rehearsals/me` | read | my rehearsal timings | New |
| `GET` `PUT` | `/settings` | `SLIDES_SETTINGS_MANAGE` | media limits, guest audiences allowed, freeze allowed (setting contributions) | New |
| `*` | `/api/plugins/docs/**` including `…/live/*`, versions, shares, comments on `Document`, `/documents/:id/comment-anchors` (kind `SLIDE`), `/templates?kind=deck` | unchanged | the hub's routes serve decks too | Unchanged |

Errors: `SLIDES_LIMIT_EXCEEDED`, `SLIDES_REVISION_STALE` (409), `SLIDES_SOURCE_FORBIDDEN`, `SLIDES_BRAND_ENFORCED`,
`SLIDES_FREEZE_DISABLED`, `SLIDES_FILE_UNSUPPORTED`, `SLIDES_SESSION_CLOSED`, `SLIDES_GUESTS_NOT_ALLOWED`. GraphQL reads
`deck`, `deckSlides`, `slideSession` in `graphql/schema-extensions.ts`.

**Ports consumed** (contracts tokens, injected `@Optional()`, bound in `apps/api/src/plugin-composition.ts`; unbound →
the capability is not offered): `DOCS_FILE_STORE`, `DOCS_RECORD_FILES` and `DOCS_LIVE_SESSIONS` (required), `REPORT_CARDS` (`render(cardRef, viewer, { format:
'data' })`), `SLIDES_SHEET_RANGES` (spreadsheets' range service: `read(documentId, ref, viewer)` with live cells per
reader), `SLIDES_PRINT` (`PrintService.render`), `SLIDES_ASSISTANT`, `SLIDES_PUBLIC_LINKS` (drive: resolve a public link, a core `shared_entity` row of entity
`Document`, to a deck and its options), `CORE_POLLS` (`discussions`' poll service), `NOTIFICATION_DISPATCHER` (else
`INBOX_ITEM_WRITER`), `AUDIT_EVENT_SINK`.

**Ports offered**: the `deck` file kind with its codec; `SLIDES_DECK_EXPORT` for `meetings` (render a slide image for a meeting
screen) and `email-and-communications` attachments; `RECORD_TIMELINE_SOURCES` entries for sessions held about a record.

## 5. Events, Real-Time and Notifications

| Event | Emitted when | Consumers |
| ----- | ------------ | --------- |
| `slides.deck.created` / `.imported` / `.exported` / `.generated` | lifecycle actions | activity log, webhooks, audit sink (exports) |
| `slides.thumbnail.rendered` | a slide image is ready | realtime hint `deck:<documentId>` |
| `slides.linked_slide.updated` / `.orphaned` | a source slide changed or was deleted | editors' notice when orphaned; hint |
| `slides.chart.refreshed` | a bound chart refreshed for a reader | hint to that reader |
| `slides.session.started` / `.ended` | presenting with an audience | followers' notice (optional), summary ready |
| Signal `slides.session.position` (ephemeral) | the presenter moves | attendees on `session:<id>` within a second |
| In: docs persist of a deck (through the codec's persist hook) | a source deck changes | `slides.linked-sync`: update `SYNC` copies through `DOCS_LIVE_SESSIONS.applyServerUpdate` |
| In: `invalidatedBy` events of a chart's dataset; spreadsheets range changes | data changes | hint open decks to read the chart again (the report builder and spreadsheets keep the cached results) |

Notification categories: `slides.linked-orphaned`, `slides.session-summary`, `slides.generation-ready`; mentions and
comments keep core notifications. Events carry ids, never slide content.

## 6. UI Surface

- **Angular `packages/plugins/slides-ui`** (lazy, hidden on `404`): plugin registration, routes at the hub's
  `documents-sections` location: `/pages/documents/deck/:id` (editor), `…/deck/:id/present`, `…/deck/:id/presenter`,
  `…/deck/:id/version/:versionId`, each a thin host page that mounts the matching React component with
  `LazyReactHostDirective` of `@gauzy/ui-react` and passes the Angular services it needs (docs live client, translation,
  theme, navigation) in the host context; public viewer `/share/deck/:token` and audience view `/join/:code` in
  `public-layout-ui`, mounting `DeckViewer` and `AudienceView` the same way; "New → Presentation" with the hub's template
  gallery and "Open with → Presentation" over drive's New and Open with menus (drive T37); Settings → Presentations
  (themes, brand rules, limits) as Angular forms.
- **React `packages/plugins/slides-react-ui`** (the one editor, viewer and presenter): `DeckEditor` (slide sorter with
  sections, canvas with handles, snapping and smart spacing, toolbar and formatting panels, layout picker, theme picker
  with brand rules checks, notes pane, comments, versions, chart binding panel, linked slide badges, outline mode,
  shortcut dialog, presence avatars), `DeckViewer`, `PresenterView`, `AudienceView`, hooks `useDeckLive`, `useSession`.
  Ever Teams depends on no `@gauzy/*` package: it uses the same API with its own screens.
- i18n keys `SLIDES.*` in every locale of `packages/ui-core/i18n`; outline mode lists slides and elements in reading
  order for keyboard and screen-reader editing.

## 7. MCP Tools, SDKs and Integrations

New group `slides` in `packages/mcp-server/src/lib/tools/collaboration/slides.ts`, switch `GAUZY_MCP_TOOLS_SLIDES`
(exactly `true`), scopes `slides:read` and `slides:write`:

| Tool | Input | Output |
| --- | --- | --- |
| `list_decks` / `get_deck` | folder, search / id | decks; outline with titles, text and notes |
| `create_deck_from_outline` | folder, title, theme, slides (title, bullets, notes), `preview` (default true) | slides as laid out, or the deck |
| `update_slide` | id, slide key, title, bullets, notes, layout, `preview` (default true) | slide before and after, or the new revision |
| `generate_deck` | source (page, report, range), length, audience, `preview` (default true) | outline, or the draft deck |
| `export_deck` | id, format, slides | file link or operation |
| `get_session_summary` | session id | attendance, questions, poll results |

OpenAPI additive; Kiota SDKs regenerated after merge. Formats: PPTX (Office Open XML PresentationML), ODP (OpenDocument),
PDF, PNG, SVG for single slides. No new outside integration; webhooks receive `slides.*` events through the outbox.

## 8. Background Jobs

| Trigger | When | What it does | Idempotency |
| ------- | ---- | ------------ | ----------- |
| queue `slides.thumbnails` | 10 s after a persist that changed slides | render changed slides through the SVG renderer, store images, cover | per slide and revision |
| queue `slides.media` | media upload | optimize images, poster frames for video | per file hash |
| operation `slides.import` / `slides.export` | import; PDF, PPTX, ODP or images | parse or render, report, notify | per operation |
| outbox consumer `slides.linked-sync` | a source deck persisted | update `SYNC` copies; orphan on delete | per source revision |
| operation `slides.generate` | generation request | outline (assistant or headings), layout, notes, bound charts, draft deck | the operation's idempotency key |
| `slides.session-sweep` | every 5 minutes | pause sessions without a presenter, end them after 15 minutes, write summaries | status checks |

Queue jobs run in the API; scheduled ones in the worker (`SlidesSchedulePlugin` in `apps/worker/src/plugins.ts`); without
a queue root the API runs them on in-process timers under a database lock.

## 9. Security & Permissions

Permission contributions of the plugin (`PluginPermissionContribution`, `defaultFor`): `SLIDES_THEME_MANAGE`,
`SLIDES_BRAND_RULES_MANAGE`, `SLIDES_PRESENT_PUBLIC`, `SLIDES_GENERATE`, `SLIDES_SETTINGS_MANAGE`; all to `SUPER_ADMIN` and
`ADMIN`; `THEME_MANAGE`, `PRESENT_PUBLIC`, `GENERATE` to `MANAGER`; `GENERATE` to `EMPLOYEE`; none to `DATA_ENTRY` and
`VIEWER`. Hub keys stay the gate for reading, creating and editing decks.

- **Per-reader charts**: each reader's figures come from `REPORT_CARDS` (cached per access hash by the report builder)
  or the spreadsheets range reader with that reader's access; freezing requires `confirmAudience`; guests receive only
  frozen values.
- **Attendee isolation**: the audience view receives only the slide being presented, rendered without notes or hidden
  slides; guest tokens open only their session topic; joins and guest actions are rate limited (10 per minute per key)
  and votes are one per attendee and poll.
- **Brand enforcement** is checked in the `deck` codec's `assertAcceptable` (refused values: `SLIDES_BRAND_ENFORCED`)
  and in imports, not only in the editor.
- **Media**: hub upload checks; SVG uploads sanitised (scripts and outside references removed) before storage; embeds
  shown as cards, never as live third-party frames.
- **Assistant**: source text and computed figures the requester may read; drafts private to the requester.
- **Audit**: hub activity log; `AUDIT_EVENT_SINK` for exports, public sessions and freezes.

## 10. Observability

Metrics `slides_render_ms{surface}`, `slides_thumbnail_queue_depth`, `slides_session_attendees`, `slides_position_latency_ms`,
`slides_import_ms`, `slides_export_ms`, `slides_generation_total{assistant}`; session summaries; the docs live status
includes `deck` sessions.

## 11. Phased Rollout

1. **Phase 1 — Foundation** (flag off; needs spreadsheets T4 to T6): spike, contracts, `slides-model` with the SVG
   renderer, the `deck` file kind and codec, plugin tables, decks, slides, elements, themes, layouts, templates, media, co-editing,
   thumbnails, presenting full screen, PDF export.
2. **Phase 2 — Depth**: element-tracking transitions, builds, automatic advance, presenter view, pointer and remote,
   rehearsal, comments, versions with slide restore, PPTX and ODP import and export, images, offline, public viewer,
   MCP tools.
3. **Phase 3 — Advanced capabilities**: bound charts, linked slides, brand rules, generation and assistance, audience sessions
   with questions and polls (polls need `discussions`' core poll task), the two reports.
4. **Phase 4 — General availability**: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it.

## 12. Constitution Reconciliation

- I Plugin-first: plugin triple `slides` (one React editor, viewer and presenter in Angular hosts) plus the
  `slides-model` library; the hub seam comes from `spreadsheets`; templates and comment anchors from
  `documents-and-wiki`; core operations; the app's existing service worker.
- II Tenant/organization scoping: decks are drive files; every `slide_*` row is tenant and organization scoped.
- III Both ORMs, additive migrations: four plugin migrations on three dialects; no change to hub columns here.
- IV Default-off flag; nothing removed: `GAUZY_SLIDES_ENABLED` plus `FEATURE_PRESENTATIONS`; previews unchanged.
- V Contracts and API first: contracts, REST, GraphQL reads and MCP before screens.
- VI Permissions, privacy, security: §9; data leaving the platform listed in the spec §4.
- VII Real-time through the event bus: hub live session; outbox hints and ephemeral signals; documented polling fallback.
- VIII i18n and accessibility: `SLIDES.*` keys; outline mode; alternative text; reading order; chart tables.
- IX Tests: renderer image snapshots on both runtimes, codec specs, e2e per endpoint, file round trips.
- X Behaviour-first spec: implementation details only here.
- XI Documentation describes our platform only.

## 13. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| Server and browser render slides differently (fonts, text wrapping) | Medium | High | one SVG renderer; bundled fonts; image snapshot tests on both runtimes |
| PPTX fidelity disappoints | High | Medium | import report; fixtures from many producers; images for what cannot be represented |
| Audience fan-out overloads the push channel | Medium | Medium | ephemeral signals with coalescing; 1,000-attendee load test; polling fallback |
| Guests reach deck content beyond the presented slide | Low | High | server-rendered audience view per slide; token scope tests |

## 14. References

- Spec: `./spec.md` · Tasks: `./tasks.md`
- `docs/specs/features/docs-collaboration/`, `packages/plugins/docs/README.md` (Live co-editing),
  `packages/plugins/docs/src/lib/knowledge/extraction/pptx.extractor.ts`
- Code reused: `packages/ui-react` (`LazyReactHostDirective`), `packages/plugin-ui`, `packages/plugins/public-layout-ui`,
  `apps/gauzy/ngsw-config.json`, `apps/gauzy/ngsw-config.prod.json`, `packages/core/src/lib/organization/organization.entity.ts`
  (`brandColor`, `imageUrl`), `packages/core/src/lib/operation/`, `packages/plugins/docs/src/lib/{pdf/pdf-render.ts,knowledge/extraction/pdf-rasterizer.service.ts,entities/document-comment-anchor.entity.ts}`
- Related plans: `drive` (file kinds, file store, public links), `spreadsheets` (live codec seam, range reader),
  `documents-and-wiki` (templates, comment anchor kinds), `report-builder-and-dashboards` (`REPORT_CARDS`),
  `discussions` (core polls), `print-and-pdf-designer`, `access-control-and-security`, `meetings`
