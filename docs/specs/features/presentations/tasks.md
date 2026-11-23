# Task Breakdown: Presentations

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `presentations`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind `GAUZY_SLIDES_ENABLED` and `FEATURE_PRESENTATIONS`: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it. `sl/` means
  `packages/plugins/slides/src/lib/`, `ui/` means `packages/plugins/slides-ui/src/lib/`, `model/` means
  `packages/slides-model/src/lib/`, `rui/` means `packages/plugins/slides-react-ui/src/lib/`.
- Phases 1 to 4 deliver plan phase 1; Phase 5 plan phase 2 (depth); Phase 6 plan phase 3 (advanced).
- Needs: drive's file kind registry, file store, record files and New menu (drive T9, T27, T37) and the live codec seam
  of `spreadsheets` (its T4, T5, T6) before T8; the hub's template fields and gallery and the `SLIDE` comment anchor kind
  (`documents-and-wiki` T4, T17) before T9 and T26; `REPORT_CARDS`, the spreadsheets range reader and `discussions`'
  core polls in Phase 6 only.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Building-block spike in `packages/slides-model/spike/` (not shipped): render 40 fixture slides with the
  candidate canvases in the browser and in Node, compare images, try handles and marquee, export one PPTX; record the
  choice, versions and licence files in `packages/slides-model/BUILDING-BLOCKS.md`. Test: the image comparison harness
  the renderer tasks keep.
- [ ] **T2**. Contracts `packages/contracts/src/lib/slides.model.ts`; `BaseEntityEnum.SlideSession`; the `deck` purpose
  of drive's `folderFor`; export from `packages/contracts/src/index.ts`. Test: contract specs (existing values unchanged).
- [ ] **T3**. Library scaffold `packages/slides-model` (package, project, tsconfig, jest, eslint, licence gate entry):
  `model/deck/` (CRDT layout, stable ids, fractional order, rich-text fragments of the hub schema). Test: concurrent
  reorder and element edits in two documents merge.
- [ ] **T4**. `model/render/`: SVG renderer for every element type, theme tokens and layouts, fonts bundled, the same
  output in jsdom and Node. Test: image snapshots of the fixture slides on both runtimes.
- [ ] **T5**. Plugin scaffold `packages/plugins/slides` (package, project, tsconfig, jest, eslint),
  `sl/slides-enabled.ts` (exact `true`), `sl/slides.features.ts`, `apps/api/src/plugins.ts`, `apps/worker/src/plugins.ts`,
  `.env.sample` (`GAUZY_SLIDES_ENABLED`, `GAUZY_MCP_TOOLS_SLIDES`). Test: flag spec; plugin list specs.
- [ ] **T6**. On the shared core migration helpers of `procurement` T4 (`@gauzy/core`), entities `sl/entities/`
  (`slide-deck.entity.ts`, `slide-thumbnail.entity.ts`, `slide-theme.entity.ts`, `slide-brand-rules.entity.ts`,
  `slide-linked-slide.entity.ts`, `slide-chart-binding.entity.ts`, `slide-session.entity.ts`,
  `slide-session-attendee.entity.ts`, `slide-session-slide.entity.ts`, `slide-guest-vote.entity.ts`,
  `slide-rehearsal.entity.ts`) and migrations
  `sl/database/migrations/1791000064200-CreateSlideDeckTables.ts`, `1791000064210-CreateSlideChartTables.ts`,
  `1791000064220-CreateSlideSessionTables.ts`. Test: migration specs on SQLite (up twice); mapping under both ORMs. Migration timestamps: `1791000064200` to `1791000064299` (`packages/plugins/slides`).
- [ ] **T7**. Seed `sl/database/migrations/1791000064230-SeedSlidesSystemThemes.ts` (system themes and layouts); contributions of the plugin
  (`sl/slides.plugin.ts`, `sl/slides.settings.ts`): the `FEATURE_PRESENTATIONS` feature, the permissions of plan §9 with
  `defaultFor`, the settings. Test: idempotent seed; the plugin contributions report lists the feature (off), the
  permissions and the settings; grants as plan §9.

## Phase 2 — Services, endpoints, events

- [ ] **T8**. `deck` file kind registration (`createBlank`, `render` to PPTX, `extractText`, `thumbnail`, `openRoute`) and
  codec `sl/live/deck-live.codec.ts`: seed, `assertAcceptable` (schema, limits), `toStored` (manifest, counts),
  `applyServerUpdate`, `onPersist` for thumbnails and linked slides; the stale mark written by the persist and the
  render-only `SlidesRenditionModule` (`sl/rendition/slides-rendition.module.ts`, loaded by `apps/api/src/plugins.ts` with
  the flag off too; plan §3 Deck state). Test: codec spec; two sessions edit one slide through the docs live service and
  persist one state; a save followed within 60 s by an unclean stop and a restart with `GAUZY_SLIDES_ENABLED` off, and a
  save followed by switching `FEATURE_PRESENTATIONS` off, both download a PPTX holding that save.
- [ ] **T9**. Deck service and controller: create (blank, theme, from a template of the hub's gallery through the kind's
  `createBlank`), manifest, settings; template marking through the hub's `/documents/:id/template`; GraphQL reads.
  Files: `sl/decks/deck.service.ts`, `sl/decks/deck.controller.ts`, `sl/decks/dto/create-deck.dto.ts`,
  `sl/graphql/schema-extensions.ts`, `sl/graphql/deck.resolver.ts`. Test: e2e (hub permissions, `404` with the feature
  off, a deck template listed under `kind=deck`).
- [ ] **T10**. Slide service and controller: add from layout, update elements and notes with `expectedRevision` and
  `preview`, reorder, hide, sections, merged into open sessions through `DOCS_LIVE_SESSIONS`. Files:
  `sl/slides/slide.service.ts`, `sl/slides/slide.controller.ts`, `sl/slides/dto/update-slide.dto.ts`. Test: e2e; a write reaches an open
  session; stale revision is `409`.
- [ ] **T11**. Themes and layouts service and controller with system themes; theme change restyles theme-bound
  elements. Files: `sl/themes/theme.service.ts`, `sl/themes/theme.controller.ts`, `model/deck/theme-restyle.ts`. Test:
  theme switch spec on fixtures.
- [ ] **T12**. Media: uploads as hub files in the deck media folder (`folderFor`, `DOCS_RECORD_FILES.attach`), served by
  the deck's media route, `slides.media` queue (optimised images, poster frames), SVG
  sanitizing, limits. Files: `sl/media/deck-media.service.ts`, `sl/media/deck-media.controller.ts`,
  `sl/media/slides-media.worker.ts`, `sl/media/svg-sanitizer.ts`. Test: oversize refused; SVG script removed; a non-reader gets `404` on media.
- [ ] **T13**. Thumbnails: `slides.thumbnails` queue through the renderer, `slide_thumbnail`, cover through the kind's `thumbnail`, route.
  Files: `sl/thumbnails/slide-thumbnail.service.ts`, `sl/thumbnails/slides-thumbnails.worker.ts`,
  `sl/thumbnails/slide-thumbnail.controller.ts`. Test: a changed slide re-renders once per revision; the cover follows slide 1.
- [ ] **T14**. PDF export through `SLIDES_PRINT` and the fallback through the docs plugin's `pdf/pdf-render.ts` (slides,
  handouts with notes). Files: `sl/export/deck-pdf-export.service.ts`. Test: page count and notes; fallback without the print plugin.
- [ ] **T15**. Events `sl/events/slides.events.ts` and `sl/events/slides-realtime.hints.ts` (`slides.*` through the outbox), realtime hints `deck:<documentId>`, notification
  categories; `DOCS_LIVE_SESSIONS.onAccessChanged` handling (trash ends sessions). Test: event specs.

## Phase 3 — UI surfaces

- [ ] **T16**. Angular `packages/plugins/slides-ui`: registration, routes `deck/:id`, `deck/:id/present`,
  `deck/:id/presenter` and `deck/:id/version/:versionId` as host pages mounting the React components with
  `LazyReactHostDirective` of `@gauzy/ui-react` (host context: docs live client, translation, theme, navigation), entry
  points over drive's New and Open with menus (the hub's template gallery, icon, opener), Settings → Presentations;
  i18n `SLIDES.*` in every locale; the scaffold of `packages/plugins/slides-react-ui` (package, project and the entry
  components `DeckEditor`, `DeckViewer` and `PresentMode` exported as placeholders, which T20 and T19 fill). Files:
  `packages/plugins/slides-react-ui/package.json`, `packages/plugins/slides-react-ui/project.json`,
  `rui/index.ts`. Test: host pages render the entry components of the scaffold; hidden on `404`; no canvas code in the
  Angular package.
- [ ] **T17**. Editor live binding in `packages/plugins/slides-react-ui/src/lib/live/deck-live.binding.ts` over the docs
  live client passed by the host (sync, updates, awareness, read-only modes, single-writer fallback), presence avatars
  and selections, rich-text boxes bound like page text. Test: binding spec with a fake channel; two tabs co-edit.
- [ ] **T18**. In the React editor: formatting panels (text, fill, border, shadow, opacity, background, table cells),
  element library (shapes, icons, lines and connectors), media and embed inserts (playback options and alternative
  text), outline mode, shortcut dialog. Files: `rui/editor/panels/`, `rui/editor/element-library/ElementLibrary.tsx`,
  `rui/editor/outline/OutlineMode.tsx`, `rui/editor/ShortcutDialog.tsx`. Test:
  panel specs; connectors stay attached in a component test.
- [ ] **T19**. Presenting in the React package (`PresenterView` host at `…/deck/:id/present`): full screen, keyboard,
  clicker and touch, overview, black and white screens, end screen. Files: `rui/present/PresentMode.tsx`,
  `ui/pages/deck-present-host.component.ts`. Test: navigation spec; hidden slides skipped.
- [ ] **T20**. React `packages/plugins/slides-react-ui` (the one editor and viewer): `DeckEditor` (slide sorter with
  sections, canvas with selection, handles, snapping and spacing hints, layout and theme pickers, notes pane),
  `DeckViewer`, `useDeckLive`. Files: `rui/editor/DeckEditor.tsx`, `rui/viewer/DeckViewer.tsx`,
  `rui/live/useDeckLive.ts`. Test: rendering tests; keyboard move and resize spec.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T21**. MCP group `slides` (`packages/mcp-server/src/lib/tools/collaboration/slides.ts`, switch, scopes in
  `packages/mcp-server/src/lib/tools/collaboration/scopes.ts`): `list_decks`, `get_deck`,
  `create_deck_from_outline`, `update_slide`, `export_deck` with `preview` defaults. Test: tool specs (scopes, preview
  writes nothing).
- [ ] **T22**. OpenAPI regenerated; SDK regeneration noted; user docs page for presentations; plugin README. Files: `packages/core/src/lib/bootstrap/swagger.ts`. Test: OpenAPI
  snapshot includes the new routes.

## Phase 5 — Depth

- [ ] **T23**. Element-tracking transitions (link id, identical text or media, manual match), build steps,
  automatic advance and loop. Files: `model/deck/element-matching.ts`, `model/render/transitions.ts`,
  `rui/editor/panels/TransitionPanel.tsx`. Test: matching spec on fixture pairs; build order spec.
- [ ] **T24**. Presenter view `…/deck/:id/presenter` (current and next slide, notes, timer, clock), pointer, spotlight and
  temporary drawing, rehearsal timings (`slide_rehearsal`). Files: `rui/present/PresenterView.tsx`,
  `sl/sessions/rehearsal.service.ts`, `sl/sessions/rehearsal.controller.ts`. Test: rehearsal times feed automatic advance.
- [ ] **T25**. Phone remote: presenter session control from a second signed-in device over ephemeral signals. Files:
  `sl/sessions/presenter-remote.service.ts`, `rui/present/PhoneRemote.tsx`. Test: a
  remote move reaches the presenting window.
- [ ] **T26**. Comments on slides and elements: core comments on the deck's `Document` anchored by
  `document_comment_anchor` rows of kind `SLIDE` (locator: slide key, element key, x, y) through the hub's existing
  anchor routes, markers, thread panel, `ORPHANED` state when the element or slide is deleted. Files:
  `sl/comments/slide-comment-anchors.service.ts`, `rui/editor/comments/SlideComments.tsx`. Test: mention notifies;
  anchor follows a moved element; a page's text anchors are untouched.
- [ ] **T27**. Versions: open, name, restore deck, restore one slide (drive's versions, `DOCS_LIVE_SESSIONS`). Files:
  `sl/versions/deck-version.service.ts`, `ui/pages/deck-version-host.component.ts`. Test: slide restore leaves other
  slides untouched.
- [ ] **T28**. PPTX import reader `model/files/pptx-read/` (layouts, theme colours and fonts, text, shapes, images,
  video, tables, notes) with the import report; `POST /decks/from-file`, `…/import`. Files:
  `sl/import/deck-import.service.ts`. Test: fixtures from several
  producers; dropped features listed.
- [ ] **T29** (parallel). PPTX export through the writer of plan §2, ODP read and write over the ODF utilities, PNG and SVG images.
  Files: `model/files/pptx-write/`, `model/files/odp/`, `sl/export/deck-export.service.ts`. Test: exported files reopen through our reader with the same slide count and text.
- [ ] **T30**. Public viewer `/share/deck/:token` in `public-layout-ui` mounting the React `DeckViewer` through
  `@gauzy/ui-react`, the link resolved by `SLIDES_PUBLIC_LINKS` over drive's `shared_entity` links (notes only when the
  link allows them). Files: `packages/plugins/public-layout-ui/src/lib/public-layout.routes.ts`,
  `sl/public/public-deck.controller.ts`. Test: no editor routes reachable; notes hidden by default.
- [ ] **T31**. Offline: a `deck-packages` data group in the existing `apps/gauzy/ngsw-config.json` and
  `ngsw-config.prod.json` (no second worker), deck state and media of a kept deck in IndexedDB of `ui-core`, progress
  and failures, presenting offline, merge on reconnect. Files: `rui/offline/useDeckOffline.ts`. Test: offline presenting in an e2e browser test; the app still
  registers one service worker.

## Phase 6 — Advanced capabilities

- [ ] **T32**. Bound charts `sl/charts/` (`chart-binding.service.ts`, `chart-binding.controller.ts`): bindings through `REPORT_CARDS` (results cached per access hash by the report
  builder) and `SLIDES_SHEET_RANGES`, read per reader with no chart result table, refresh on Present and on demand,
  freeze with `confirmAudience` (frozen values on the binding), chart tables. Test: two readers see different figures;
  guests see only frozen values; a second read within the cache time does not run the report again.
- [ ] **T33**. Linked slides: insert linked or copied, `slides.linked-sync` consumer, detach, restricted rendering,
  orphan notice. Files: `sl/linked-slides/linked-slide.service.ts`, `sl/linked-slides/linked-slide.controller.ts`,
  `sl/linked-slides/slides-linked-sync.consumer.ts`. Test: a source change updates a `SYNC` copy; a reader without access sees a restricted slide.
- [ ] **T34**. Brand rules: CRUD, the default rules created on first use from the organization's `brandColor` and logo
  (`organization.entity.ts`), check route, editor suggestions, enforcement in the codec and imports, nearest-colour
  mapping, font confirmation. Files: `sl/brand-rules/brand-rules.service.ts`, `sl/brand-rules/brand-rules.controller.ts`,
  `sl/brand-rules/brand-check.ts`. Test: the default rules carry the organization's colour and logo; enforced brand rules
  refuse an off-brand colour through the API; import maps colours.
- [ ] **T35**. Generation `sl/generation/` (`deck-generation.service.ts`, `slides-generate.operation.ts`,
  `deck-assist.controller.ts`): `SLIDES_ASSISTANT` port, outline from a page, report or range, headings-only
  fallback, draft private to the requester, bound charts from report cards, the core operation `slides.generate`
  (registered in `OperationRegistry`; source and options in its state, deck id in its result; `generatedFrom` on the
  deck); assist route for rewrite, notes and layout. Test: provider request holds only source text and figures;
  fallback without a provider; status readable on `/operations/:id`.
- [ ] **T36**. Audience sessions: start, join link and code, audience tokens on the realtime plugin, ephemeral position
  signals, attendee view rendered per slide (`/join/:code` in `public-layout-ui` mounting the React `AudienceView`),
  guests on public decks, `slides.session-sweep`. Files: `sl/sessions/slide-session.service.ts`,
  `sl/sessions/slide-session.controller.ts`, `sl/sessions/session-sweep.job.ts`, `rui/audience/AudienceView.tsx`. Test: 50 simulated attendees
  follow within a second; a guest token opens only its session.
- [ ] **T37**. Questions and votes over core comments and reactions on `SlideSession` (policy, anonymous mode, answer,
  hide, show on screen, turn into a task or discussion post); guest votes in `slide_guest_vote`, counted with the
  reactions (plan §3). Files: `sl/sessions/session-questions.service.ts`,
  `sl/comments/slide-session-comment-access.policy.ts`, `rui/audience/QuestionsPanel.tsx`. Test: votes order questions; hidden questions leave
  attendee views; two guests voting the same emoji on one question count two votes, a guest's repeated vote withdraws
  only their own, and a member's vote is a core reaction of that member.
- [ ] **T38**. Polls through `CORE_POLLS` (the core polls of [`discussions`](../discussions/spec.md) T42): poll element, ad-hoc polls, open and close, one vote per attendee, live results
  on the slide. Files: `sl/sessions/session-polls.service.ts`, `rui/editor/elements/PollElement.tsx`. Test: duplicate vote refused; results update live.
- [ ] **T39**. Reports FR-64 and FR-65 (`/sessions/:id/summary`, `/decks/:id/activity`), CSV and PDF; MCP tools
  `generate_deck` and `get_session_summary`; Settings → Presentations. Files: `sl/reports/session-summary.service.ts`,
  `sl/reports/deck-activity.service.ts`, `packages/mcp-server/src/lib/tools/collaboration/slides.ts`,
  `ui/settings/presentations-settings.component.ts`. Test: seeded session summary rows.
- [ ] **T40**. Load test of audience fan-out (1,000 attendees) and render parity check; spec status `Implemented` after
  the checks below. Files: `docs/specs/features/presentations/spec.md`, `sl/benchmarks/audience-fanout.bench.ts`. Test: latency under 1 s at the 95th percentile.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Scope, decks and templates | T5, T9, T16 |
| FR-2 | §3.1 Scope, decks and templates | T8 |
| FR-3 | §3.1 Scope, decks and templates | T9, T21, T22 |
| FR-4 | §3.1 Scope, decks and templates | T9, T28 |
| FR-5 | §3.1 Scope, decks and templates | T8, T13 |
| FR-6 | §3.1 Scope, decks and templates | T9 |
| FR-7 | §3.2 Themes, layouts and brand rules | T11 |
| FR-8 | §3.2 Themes, layouts and brand rules | T11 |
| FR-9 | §3.2 Themes, layouts and brand rules | T10, T11, T20 |
| FR-10–FR-11 | §3.2 Themes, layouts and brand rules | T34 |
| FR-12 | §3.3 Slides and elements | T10, T20 |
| FR-13 | §3.3 Slides and elements | T18 |
| FR-14 | §3.3 Slides and elements | T20 |
| FR-15–FR-16 | §3.3 Slides and elements | T18 |
| FR-17 | §3.3 Slides and elements | T10, T20 |
| FR-18 | §3.3 Slides and elements | T17, T20 |
| FR-19 | §3.3 Slides and elements | T18 |
| FR-20–FR-21 | §3.4 Media | T12 |
| FR-22 | §3.4 Media | T12, T18 |
| FR-23–FR-26 | §3.5 Charts (advanced) | T32 |
| FR-27–FR-29 | §3.6 Linked slides (advanced) | T33 |
| FR-30–FR-33 | §3.7 Transitions and builds | T23 |
| FR-34 | §3.8 Presenting | T19 |
| FR-35–FR-37 | §3.8 Presenting | T24 |
| FR-38 | §3.8 Presenting | T25 |
| FR-39 | §3.9 Audience (advanced) | T36 |
| FR-40 | §3.9 Audience (advanced) | T36 |
| FR-41 | §3.9 Audience (advanced) | T37 |
| FR-42 | §3.9 Audience (advanced) | T38 |
| FR-43 | §3.9 Audience (advanced) | T37, T39 |
| FR-44 | §3.10 Comments, co-editing and sharing | T26 |
| FR-45 | §3.10 Comments, co-editing and sharing | T17 |
| FR-46 | §3.10 Comments, co-editing and sharing | T8, T10 |
| FR-47 | §3.10 Comments, co-editing and sharing | T15, T17 |
| FR-48 | §3.10 Comments, co-editing and sharing | T9, T15 |
| FR-49 | §3.10 Comments, co-editing and sharing | T30 |
| FR-50 | §3.11 History, thumbnails and offline | T27 |
| FR-51 | §3.11 History, thumbnails and offline | T13, T20 |
| FR-52 | §3.11 History, thumbnails and offline | T28 |
| FR-53 | §3.11 History, thumbnails and offline | T14, T29 |
| FR-54 | §3.11 History, thumbnails and offline | T31 |
| FR-55 | §3.11 History, thumbnails and offline | T8 |
| FR-56 | §3.11 History, thumbnails and offline | T15, T33 |
| FR-57–FR-60 | §3.12 Generation (advanced) | T35 |
| FR-61 | §3.13 API, MCP and real time | T9, T10, T11, T29 |
| FR-62 | §3.13 API, MCP and real time | T21, T39 |
| FR-63 | §3.13 API, MCP and real time | T15, T36 |
| FR-64–FR-66 | §3.14 Reports | T39 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off; enabling it in dev shows the feature end to end.
- Constitution gates in `spec.md` §9 confirmed.
- Renderer image snapshots match in the browser and in Node; two browsers co-edit one deck on a dev environment.
- A PPTX fixture round-trips; a bound chart shows different figures to two readers; an audience follows a presenter.
- Only permissively licensed packages are used; the dependency licence gate checks every package.
