# Task Breakdown: Documents and wiki (pages, wiki spaces, review, publishing)

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `documents-and-wiki`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind the feature flag: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it.
- Paths starting with `services/`, `controllers/`, `entities/`, `repositories/`, `commands/`, `events/`, `live/`,
  `import/`, `pdf/`, `validation/`, `knowledge/`, `graphql/` or `reports/` are under `packages/plugins/docs/src/lib/`;
  paths starting with `docs/src/` or `docs-ui/src/` are under `packages/plugins/`. Each new service, controller or pure
  helper ships with a `.spec.ts` beside it.
- Starts after `drive` T1–T12 (one tree, paths, inherited shares, extended versions) have merged; T49 needs drive T46 (the AI chat docs scope) and T25 drive T14 (recent visits).

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts: `packages/contracts/src/lib/document.model.ts` (page fields, version sources, import kinds; `IDocumentSpace` gains `properties?` and `spaceKey`) and `packages/contracts/src/lib/document-wiki.model.ts` (space properties and keys, roles, routes, suggestions, change requests, comparison, merge preview, templates with kind, feedback, reading figures, repository sync, property sets, writing, comment anchor kinds and locators, feed shapes; ports `DOCS_MEETING_CONTEXT`, `DOCS_ASSISTANT`; `IPublishedPageSerializer`); `BaseEntityEnum` values `DocumentChangeRequest`, `DocumentSpace` in `packages/contracts/src/lib/base-entity.model.ts`. Test: contract spec (existing enum values unchanged).
- [ ] **T2**. Feature and switch: `FEATURE_WIKI` (needs `FEATURE_DOCUMENTS` and `FEATURE_DRIVE`, all three checked on the wiki controllers and menu entries), `FEATURE_WIKI_PUBLIC` in `packages/contracts/src/lib/feature.model.ts`, `packages/core/src/lib/feature/default-features.ts`, env defaults off in `packages/config/src/lib/environments/environment*.ts`; `GAUZY_DOCS_PUBLIC_SITES_ENABLED` (it turns on the public read feed) in `packages/plugins/docs/src/lib/docs.config.ts` and `.env.sample`. Test: config spec (exact `true`); with `FEATURE_WIKI` on and `FEATURE_DRIVE` off a wiki route answers `404 WIKI_DISABLED` and the wiki menu entry is hidden.
- [ ] **T3**. Permissions as contributions of the docs plugin (`docs/src/lib/docs.plugin.ts`, `PluginPermissionContribution` with `defaultFor` as plan §9): `WIKI_SPACE_MANAGE`, `WIKI_PUBLISH`, `WIKI_TEMPLATE_MANAGE`, `WIKI_ANALYTICS_VIEW`; wiki setting contributions in `docs/src/lib/docs.settings.ts`. Test: plugin contributions report; grants on a new tenant; the permission reload adds them to an existing tenant.
- [ ] **T4**. Entity changes: `entities/document.entity.ts` (slug, public flag, search-engine fields, cover, layout, suggestion mode, review and verification, template fields), `entities/document-share.entity.ts` (`spaceId`, `spaceRole`, `documentId` nullable with the one-of check), `entities/document-version.entity.ts` (`sourceRef`), `entities/document-import.entity.ts` (`kind`, `repositorySyncId`, `sourceRevision`), `entities/document-comment-anchor.entity.ts` (`kind`, `locator`, `state`; text columns nullable). Test: entity registration and portability specs; the existing comment anchor specs pass unchanged.
- [ ] **T5**. New entities and MikroORM repositories (`document_space` as properties of an existing space, `document_route`, `document_suggestion`, `document_change_request`, `document_change_request_item`, `document_feedback`, `document_view_stat`, `document_search_stat`, `document_repository_sync`, `document_property_set`) as `entities/document-space.entity.ts`, `entities/document-route.entity.ts`, `entities/document-suggestion.entity.ts`, `entities/document-change-request.entity.ts`, `entities/document-change-request-item.entity.ts`, `entities/document-feedback.entity.ts`, `entities/document-view-stat.entity.ts`, `entities/document-search-stat.entity.ts`, `entities/document-repository-sync.entity.ts`, `entities/document-property-set.entity.ts` with their repositories in `repositories/`, added to `ALL_DOC_ENTITIES` (`entities/index.ts`). Test: registration spec.
- [ ] **T6**. Migrations `packages/core/src/lib/database/migrations/1791000047100-AddWikiDocumentColumns.ts` and `packages/core/src/lib/database/migrations/1791000047110-CreateWikiTables.ts` for PostgreSQL, MySQL, SQLite. Test: migration spec on SQLite, idempotent; existing shares and anchors unchanged after up. Migration timestamps: `1791000047100` to `1791000047199` (`packages/core`).
- [ ] **T7** (parallel). Starter templates per locale in `docs/src/lib/seeds/templates/` (`starter-templates.ts` and one `<locale>.json` per shipped locale: meeting notes, decision record, how-to, project brief, retrospective, runbook) loaded by the existing `DocsSeederService` (`docs/src/lib/seeds/docs-seeder.service.ts`); notification categories `docs.space-summary.daily` and `.weekly` and the other wiki inbox kinds registered in `docs/src/lib/docs.plugin.ts` so the Inbox delivers and e-mails them with its own templates. Test: templates per locale; categories listed in the Inbox settings.
- [ ] **T8**. Editor schema additions (heading 4, table of contents, diagram, PDF viewer, page break, tabs, sub-page view, image and paragraph attributes, suggestion marks, task item attributes) in `docs-ui/src/lib/editor/extensions/` (`table-of-contents.node.ts`, `diagram.node.ts`, `pdf-viewer.node.ts`, `page-break.node.ts`, `tabs.node.ts`, `sub-page-view.node.ts`, `suggestion.marks.ts`, registered in `document-extensions.ts`) and the server schema validator `validation/tiptap-schema.validator.ts`, `docs-ui/src/lib/editor/extensions/editor-schema.inventory.json`, Markdown and PDF fallbacks (`services/document-markdown.ts`, the PDF content builder `pdf/tiptap-pdf.ts`); the editor offers the new nodes and controls only while `FEATURE_WIKI` is on; today's video block keeps its address handling. Test: `editor-schema-inventory.spec.ts`, Markdown round trip keeps unknown blocks as text, PDF renders each node; with the flag off the slash menu and bubble menus list exactly today's entries (AC-25).

## Phase 2 — Services, endpoints, events

- [ ] **T9**. Wiki gate and space access: `services/wiki-feature.service.ts`, space shares and the default role in `services/document-access.predicate.ts` and `services/document-access.sql.ts` (the space at the top of drive's chain, stopped by a restriction), `services/wiki-space-access.ts` (roles), `WIKI_DISABLED` 404. Test: role matrix spec; a space without properties keeps today's access exactly; every new route answers `404 WIKI_DISABLED` with the flag off.
- [ ] **T10**. Space properties: `services/wiki-space.service.ts` (create or change the properties of the organization space, a team space or a private space keyed by `spaceKey`, members as role shares on the space, default role, order, listed flag, archive, restore, remove properties, space history by day), `GET /documents/spaces` in `services/document-collaboration.service.ts` returning each space with its properties, controller `controllers/wiki-space.controller.ts` (with `GET /wiki/spaces/:id/history`). Test: giving a team space properties changes no page, id, address, share, comment or version; removing them restores today's listing; a team's managers manage its space; history filters by page and author.
- [ ] **T11**. Addresses: `services/wiki-route.service.ts` (slugs, uniqueness with suggestion, paths, redirects on rename and move, subtree rebuild), `/wiki/resolve`, `/documents/:id/slug` in `controllers/wiki-route.controller.ts`. Test: rename and move redirects, collision suggestion.
- [ ] **T12**. Compare and block restore: pure `services/document-compare.ts` (block alignment, word-level changes), `/versions/compare`, `/versions/:versionId/restore-block` in `controllers/document-version.controller.ts` and `services/document-version.service.ts`; names and pins on page versions. Test: compare spec on 2,000 blocks under 1 s; restore one block.
- [ ] **T13**. Suggestions: `services/document-suggestion.service.ts` and `controllers/document-suggestion.controller.ts` (rows from marks on save and live persist, accept and reject as server-side writes, bulk decide, orphan detection), suggest-only validation in the content save path (`commands/handlers/update-document-content.handler.ts`) and `live/document-live.service.ts` update validator, suggestion mode. Test: a comment-level writer can only add own suggestion marks; accept reaches a second live session.
- [ ] **T14**. Three-way merge: pure `services/document-merge3.ts` (per block: theirs, ours, conflict; insertions by neighbours; tree operations), with conflict and preview output. Test: property-based spec (no lost block, identical changes do not conflict).
- [ ] **T15**. Proposals: `services/edit-proposal.service.ts` (drafts with item autosave, submit, withdraw, review decisions, merge with resolutions and preview, linked versions, double-merge guard), controller `controllers/edit-proposal.controller.ts` and diff route, comments on `DocumentChangeRequest`. Test: merge e2e with one conflict; concurrent merges give one result; synced space refuses.
- [ ] **T16**. Review queue: `/review/queue` over today's document review and proposals (submitted by me, waiting for me, space manager view, state filter); existing review routes (`controllers/document-review.controller.ts`) unchanged. Files: `services/review-queue.service.ts`, `controllers/review-queue.controller.ts`. Test: view membership spec.
- [ ] **T17**. Templates: `services/document-template.service.ts` and `controllers/document-template.controller.ts` (scopes, gallery query by kind for pages, workbooks and decks, new from template with sub-pages and variables, a workbook or deck through its file kind's `createBlank`, insert into a page, shortcuts, space defaults). Test: variables filled; organization scope needs `WIKI_TEMPLATE_MANAGE`; a registered test file kind is listed and created from its template.
- [ ] **T18**. Page settings: `/documents/:id/page-settings` (address, search-engine fields, cover, layout, owner, interval) answering `202` with a proposal in review-required spaces. Files: `services/document-page-settings.service.ts`, `controllers/document-page-settings.controller.ts`. Test: review-required path creates a proposal.
- [ ] **T19**. Office formats: DOCX export (`docx`), DOCX import (`mammoth`) into `import/import-content.ts`, ODT both ways through `DOCS_PREVIEW_CONVERTER`, HTML export, subtree zips, convert-to-page for drive files, Markdown file preview with front matter and double-bracket links; queue stages `convert`, `export-office`. Files: `services/document-office-export.service.ts`, `import/docx-import.ts`, `controllers/document-export.controller.ts`. Test: round trip of headings, lists, tables, images; not-converted list; ODT hidden without the converter.
- [ ] **T20**. Drafts and team mentions: team mention fan-out in the mention sync (`commands/handlers/update-document-content.handler.ts`); comment filters (open, resolved, orphaned from the anchor `state`) on the comments query (`services/document-comment-anchor.service.ts`) and in the comments panel (`docs-ui/src/lib/components/comments/document-comments.component.ts`: filters, jump to text, resolved hidden by default). Test: team mention notifies members once; a deleted range marks its thread orphaned.
- [ ] **T21**. Public read feed (switch): `services/published-page.serializer.ts` (sanitised HTML, Markdown, table of contents, cover, search-engine fields, previous and next, names per space setting), `controllers/public-space-feed.controller.ts` (space and navigation tree, change list since a time, page by path with Markdown copies, PDF when allowed, rating), `feedKey` resolution, ETag from `publicationRevision`, cache invalidation on `docs.page.published` and merges; integration-token rate limits. Test: unpublished and missing answer the same 404 on every route; a change is in the feed within 30 s; help spaces are not served here.
- [ ] **T22**. Publication and feed settings: `/publication`, `/publish`, `/feed` (PDF downloads, ratings, contents panel, hidden names, site address), `feedKey` creation and rotation; `docs.page.published` and `docs.page.unpublished` reach webhooks and the Ever Works integration. Files: `services/wiki-publication.service.ts`, `controllers/wiki-publication.controller.ts`. Test: publication state machine; a rotated key stops the old one; events carry ids only.
- [ ] **T23**. Feed images: each page's own preview image (its search-engine image, else its cover) served through the feed with size variants from the existing thumbnail service (`services/document-upload.service.ts`); nothing generated. Files: `services/published-page-image.service.ts`, `controllers/public-space-feed.controller.ts`. Test: the search-engine image wins over the cover; no image when neither is set.
- [ ] **T24**. Feedback: feed and member rating routes with per-address limits, feedback list and close, inbox on "not helpful" with comment. Files: `services/document-feedback.service.ts`, `controllers/document-feedback.controller.ts`. Test: eleventh rating in an hour is dropped.
- [ ] **T25**. Reading figures: daily upsert into `document_view_stat` from drive's recent-visit write (`MEMBER`; a page's new reader of the day when the previous `visitedAt` of that page is before today; the space's new reader only when no other page of the space has a visit of the employee today; the unique key includes `organizationId`), in-app search counts per space into `document_search_stat`, `/wiki/analytics`. Files: `services/wiki-reading-stats.service.ts`, `controllers/wiki-analytics.controller.ts`. Test: counts survive two processes; a second read the same day adds a view, not a reader; a member who opens two pages of one space on the same day counts one space reader; two organizations of one tenant keep separate `space:organization` rows; a `space:private:<userId>` key is stored on each dialect; no visitor identity is stored.
- [ ] **T26**. Repository sync: `services/wiki-repository-sync.service.ts` and `controllers/wiki-repository-sync.controller.ts` over `DocumentImporterRegistry` in update mode (provenance index upserts); the first importer in `packages/plugins/integration-github` (`packages/plugins/integration-github/src/lib/github/github-document.importer.ts`; installation as connected account, repositories from `github/repository/`, push from `github/github-event.subscriber.ts` as `DocumentRepositoryPushedEvent`); "sync now", run history on `document_import`, read-only enforcement. Test: second run with no change creates no version; deleted file trashes its page; an unverified webhook is ignored.
- [ ] **T27**. Freshness and verification: owner and interval, `docs.wiki.freshness` job (`services/wiki-freshness.service.ts`, `services/wiki-freshness.scheduler.ts`), `/verify`, `/unverify`, `/wiki/stale` (`controllers/wiki-freshness.controller.ts`), stale and verified flags in the search plugin documents index and `knowledge/retrieval/retrieval.service.ts` ranking. Test: stale notice once per due date; verified ranks first.
- [ ] **T28**. Broken links and print: `/wiki/broken-links` (internal from document links and mentions; `docs.wiki.link-check` for outside links through core `createSsrfSafeHttpsAgent()`), print layout with space, breadcrumb and dates. Files: `services/wiki-broken-links.service.ts`, `services/wiki-link-check.scheduler.ts`, `controllers/wiki-broken-links.controller.ts`, `pdf/tiptap-pdf.ts`. Test: trashed target listed; a private address is not fetched.
- [ ] **T29**. Events and notifications: outbox appends of plan §5 (`events/wiki.events.ts`), `registerAutomationTriggers`, `registerNotificationCategories`, inbox items (`services/document-notifier.service.ts`), realtime hint kinds in `packages/plugins/realtime/src/lib/realtime-hints.service.ts`. Test: one row per fact, written in the change's transaction; none on rollback.
- [ ] **T30**. GraphQL reads `wikiSpaces` (the space list with properties), `documentSuggestions`, `editProposals`, `reviewQueue`, `documentTemplates`; `registerPaletteProviders` entry for spaces and pages. Files: `graphql/docs.schema.ts`, `graphql/wiki.resolver.ts`, `services/wiki-palette.provider.ts`. Test: resolver spec, field binding check, palette returns only readable pages.

## Phase 3 — UI surfaces

- [ ] **T31**. Editor formatting: font family and size, clear formatting, format painter (`docs-ui/src/lib/editor/menus/text-bubble-menu.component.ts`), paragraph spacing dialog (`docs-ui/src/lib/editor/dialogs/paragraph-spacing-dialog.component.ts`), heading 4, table of contents block; i18n in every locale (`docs-ui/src/i18n/*.json`). Test: component specs.
- [ ] **T32** (parallel). Editor blocks: image caption, alternative text and dark image; PDF viewer; diagram node view (lazy); tabs; page break; page layout dialog (`docs-ui/src/lib/editor/node-views/image-node-view.component.ts`, `pdf-viewer-node-view.component.ts`, `diagram-node-view.component.ts`, `tabs-node-view.component.ts`, `docs-ui/src/lib/editor/dialogs/page-layout-dialog.component.ts`). Test: node view specs, keyboard operation.
- [ ] **T33**. Suggestions UI in `docs-ui/src/lib/editor/track-changes/` (`suggestion-mode.extension.ts`, `suggestions-panel.component.ts`): suggestion mode toggle, mark rendering, suggestions panel with filters, accept and reject; local draft store and restore prompt (`docs-ui/src/lib/editor/services/local-draft.store.ts`). Test: component specs, draft restored after reload.
- [ ] **T34** (parallel). Versions UI: name, pin, compare views and block restore in `docs-ui/src/lib/editor/version-history/` (`version-history-panel.component.ts`, `version-compare.component.ts`). Test: compare rendering spec.
- [ ] **T35** (parallel). Templates UI: gallery dialog (by kind), New from template, template settings, slash menu entries. Files: `docs-ui/src/lib/dialogs/template-gallery-dialog.component.ts`, `docs-ui/src/lib/dialogs/template-settings-dialog.component.ts`, `docs-ui/src/lib/editor/suggestion/slash-menu.items.ts`. Test: gallery spec.
- [ ] **T36**. Spaces UI: the tree's existing space list (`docs-ui/src/lib/components/tree/docs-tree.component.ts`, `docs-ui/src/lib/services/document-tree.store.ts`) shows names, icons, colours, order and pins; a space settings dialog from it (`docs-ui/src/lib/dialogs/space-settings-dialog.component.ts`: general, members and roles, default role, publication and feed, feedback, reading figures, repository sync); the move-space dialog (`docs-ui/src/lib/dialogs/move-space-dialog.component.ts`) shows space names; wiki pages space home and history (`docs-ui/src/lib/pages/wiki/space-home.component.ts`, `docs-ui/src/lib/pages/wiki/space-history.component.ts`, routes in `docs-ui/src/lib/docs.routes.ts`). Test: rendering specs, hidden on 404, one entry per space.
- [ ] **T37**. Proposals UI: proposal editing mode, proposal page with differences, review actions and conflict choices; review queue views in `docs-ui/src/lib/pages/review/review-page.component.ts`. Files: `docs-ui/src/lib/pages/wiki/proposal-page.component.ts`, `docs-ui/src/lib/editor/services/proposal-mode.service.ts`. Test: conflict choice spec.
- [ ] **T38** (parallel). Feedback list, reading figures page, stale pages and broken links pages. Files: `docs-ui/src/lib/pages/wiki/feedback-list.component.ts`, `docs-ui/src/lib/pages/wiki/reading-figures.component.ts`, `docs-ui/src/lib/pages/wiki/stale-pages.component.ts`, `docs-ui/src/lib/pages/wiki/broken-links.component.ts`. Test: rendering specs.
- [ ] **T39** (parallel). Publication UI: publish toggles on the space and each page, feed address and key rotation, site address with "View on site". Files: `docs-ui/src/lib/components/publish-toggle/publish-toggle.component.ts`, `docs-ui/src/lib/dialogs/space-settings-dialog.component.ts`. Test: rendering spec; "View on site" opens the stored address with the page path.
- [ ] **T51**. Framed embeds behind `FEATURE_WIKI`: a framed embed block accepting only hosts of the organization's embed list (setting in `docs/src/lib/docs.settings.ts` with a shipped default list), converting a host's share address to its embed address, rendered in a sandboxed frame without same-origin; other addresses become link cards; today's video block keeps every address it accepts. Files: `docs-ui/src/lib/editor/extensions/framed-embed.node.ts`, `services/embed-address.ts`, `validation/tiptap-schema.validator.ts`. Test: `services/embed-address.spec.ts` (known share address converted, unlisted host refused); node spec where an unlisted address becomes a link card and the video block accepts an unlisted address as today (FR-9).
- [ ] **T52**. Live by default in wiki spaces behind `FEATURE_WIKI`: where live co-editing is switched on, pages of a space with properties open live with presence and cursors; sessions reached through a public link or the feed are read-only. Files: `docs-ui/src/lib/editor/document-editor.component.ts`, `live/document-live.service.ts`. Test: `docs-ui/src/lib/editor/document-editor.live-fallback.spec.ts` (a wiki page opens live, a page outside a space with properties keeps today's choice); `live/document-live.service.spec.ts` (a public-link session cannot write) (FR-13).
- [ ] **T53**. Page links typed as `[[` behind `FEATURE_WIKI`: the trigger searches readable pages of every space and offers to create a missing page; links stay page mentions (kept across moves and renames) and render as plain text for readers who cannot open the target. Files: `docs-ui/src/lib/editor/suggestion/document-mention.suggestion.ts`, `services/document-link.service.ts`. Test: suggestion spec (unreadable pages never offered, "create page" adds the page in the current space); read spec where a reader without access to the target sees plain text (FR-42).

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T40**. MCP tools `docs_list_spaces`, `docs_list_templates`, `docs_create_from_template`, `docs_suggest_edit`, `docs_propose_change`, `docs_list_proposals`, `docs_get_proposal_diff`, `docs_comment`, `docs_verify_page`; a space `scope` on `search_pages` (drive T42) for asking; the review-required hint on `update_page_markdown`, only in spaces whose manager switched review on. Files: `packages/mcp-server/src/lib/tools/collaboration/docs.ts`. Test: tool specs; today's tools unchanged on every page outside review-required spaces, existing team-space pages included.
- [ ] **T41** (parallel). Report datasets and definitions in `packages/plugins/docs/src/lib/reports/` (`wiki-report-datasets.ts`, `wiki-report-definitions.ts`: space health, space and page reading, feedback, review queue, broken links, stale pages). Test: figures equal the reading figures route.
- [ ] **T42**. OpenAPI regenerated (`packages/core/src/lib/bootstrap/swagger.ts`), SDK note (the feed documented for site builders); `packages/plugins/docs/README.md` wiki section; user docs; `docs/specs/README.md` row; spec status `Implemented`. Test: OpenAPI diff is additive; docs build.

## Phase 5 — Advanced capabilities (plan phase 3)

- [ ] **T43**. Writing help: `services/document-writing.service.ts` and `controllers/document-writing.controller.ts` over `DOCS_ASSISTANT` (bound by `ai-agents-and-assistants`, fallback `AiProviderRegistry`) (draft, continue, summarise, shorten, tone, translate, spelling, explain) returning suggestions; editor menu `docs-ui/src/lib/editor/menus/writing-help-menu.component.ts`. Test: result only as suggestion marks; untrusted content wrapped.
- [ ] **T44**. Agent edits as suggestions or proposals: agent marker in the request context, `onBehalfOfUserId` on suggestions, proposals and versions; direct writes refused in review-required spaces. Files: `services/document-agent-context.ts`, `services/document-suggestion.service.ts`, `services/edit-proposal.service.ts`, `commands/handlers/update-document-content.handler.ts`. Test: an agent session cannot change content directly there.
- [ ] **T45**. Page properties and sub-page views: `document_property_set`, custom field values on record type `Document` through `CUSTOM_FIELD_METADATA` and `cf.<key>` fields of the core query protocol, properties header, sub-page view block over `RECORD_VIEWS_QUERY`. Files: `services/document-property-set.service.ts`, `controllers/wiki-property-set.controller.ts`, `docs-ui/src/lib/components/page-properties-header/page-properties-header.component.ts`, `docs-ui/src/lib/editor/node-views/sub-page-view-node-view.component.ts`. Test: filter by property; board drag edits a value; hidden without the plugins.
- [ ] **T46**. Action items to tasks: `/action-items/tasks` with preview through the core task create command, document links both ways, tick on task done through a task event handler and server-side write. Files: `services/document-action-items.service.ts`, `controllers/document-action-items.controller.ts`, `events/document-task-done.handler.ts`. Test: done task ticks the item in a live session.
- [ ] **T47**. Meeting notes from a meeting through `DOCS_MEETING_CONTEXT`. Files: `services/document-meeting-notes.service.ts`, `controllers/document-collaboration.controller.ts`. Test: unbound port hides the action.
- [ ] **T48**. Space summaries: follow and unfollow as core `entity_subscription` on `DocumentSpace`, hourly `docs.wiki.space-summaries` job writing one Inbox item per follower and period (daily or weekly kind, chosen in the Inbox settings) in the hour before that follower's digest hour in their time zone, summaries through `DOCS_ASSISTANT` when present. Files: `services/wiki-space-summaries.service.ts`, `services/wiki-space-summaries.scheduler.ts`, follow routes in `controllers/wiki-space.controller.ts`. Test: one item per follower and period; a person who switched the weekly kind off gets none; the Inbox digest e-mail includes it, also for a follower whose digest hour is 05:00 in another time zone.
- [ ] **T49**. Ask a page or space: the space key and page ids as a `docsScope` of drive's AI chat scope (drive T46), verified pages ranked first in `knowledge/retrieval/retrieval.service.ts`; the Ask action in the editor and space home (`docs-ui/src/lib/pages/wiki/space-home.component.ts`). Test: never cites an unreadable page; verified pages come first.
- [ ] **T50**. Provide the ports other features bind to (plan, **Consumer tokens answered**): `DISCUSSIONS_PAGES`, `DOCS_LIVE_SESSIONS`, `LEARNING_CONTENT_INDEX`, `MEETINGS_NOTES`. Files: `apps/api/src/plugin-composition.ts`. Test: one contract test per token over the shape its consumer plan states; with this feature off each consumer keeps its stated fallback.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Scope, flags and the one tree | T5, T10, T36 |
| FR-2 | §3.1 Scope, flags and the one tree | T2, T8, T9 |
| FR-3 | §3.1 Scope, flags and the one tree | T2, T21 |
| FR-4 | §3.1 Scope, flags and the one tree | T4, T8, T42 |
| FR-5 | §3.2 Writing | T8, T31 |
| FR-6–FR-7 | §3.2 Writing | T31 |
| FR-8 | §3.2 Writing | T32 |
| FR-9 | §3.2 Writing | T8, T51 |
| FR-10 | §3.2 Writing | T8, T32 |
| FR-11 | §3.2 Writing | T8, T32 |
| FR-12 | §3.2 Writing | T8, T32 |
| FR-13 | §3.3 Co-editing and drafts | T52 |
| FR-14 | §3.3 Co-editing and drafts | T33 |
| FR-15–FR-16 | §3.4 Comments, mentions and suggestions | T20 |
| FR-17–FR-18 | §3.4 Comments, mentions and suggestions | T13, T33 |
| FR-19 | §3.4 Comments, mentions and suggestions | T13, T29, T33 |
| FR-20 | §3.4 Comments, mentions and suggestions | T13 |
| FR-21–FR-23 | §3.5 Versions and history | T12, T34 |
| FR-24 | §3.5 Versions and history | T4, T12, T13 |
| FR-25 | §3.5 Versions and history | T10, T36 |
| FR-26–FR-28 | §3.6 Templates | T17, T35 |
| FR-29 | §3.6 Templates | T7, T17 |
| FR-30 | §3.6 Templates | T46 |
| FR-31 | §3.6 Templates | T47 |
| FR-32–FR-34 | §3.7 Import and export | T19 |
| FR-35 | §3.8 Wiki spaces | T10, T36 |
| FR-36 | §3.8 Wiki spaces | T3, T9, T10 |
| FR-37 | §3.8 Wiki spaces | T10, T30, T36 |
| FR-38 | §3.8 Wiki spaces | T10 |
| FR-39 | §3.8 Wiki spaces | T36 |
| FR-40 | §3.8 Wiki spaces | T10 |
| FR-41 | §3.9 Addresses and links | T11 |
| FR-42 | §3.9 Addresses and links | T11, T53 |
| FR-43 | §3.9 Addresses and links | T28, T38 |
| FR-44 | §3.10 Proposed edits and review | T15, T37 |
| FR-45 | §3.10 Proposed edits and review | T15 |
| FR-46 | §3.10 Proposed edits and review | T15, T37 |
| FR-47 | §3.10 Proposed edits and review | T14, T15, T37 |
| FR-48 | §3.10 Proposed edits and review | T10, T15 |
| FR-49 | §3.10 Proposed edits and review | T16, T37 |
| FR-50 | §3.10 Proposed edits and review | T15, T26 |
| FR-51 | §3.11 Page settings, freshness and structure | T18 |
| FR-52 | §3.11 Page settings, freshness and structure | T18, T27 |
| FR-53 | §3.11 Page settings, freshness and structure | T27, T49 |
| FR-54–FR-55 | §3.11 Page settings, freshness and structure | T45 |
| FR-56–FR-57 | §3.12 Publication and the public read feed | T21, T22 |
| FR-58 | §3.12 Publication and the public read feed | T22, T39 |
| FR-59 | §3.12 Publication and the public read feed | T21 |
| FR-60 | §3.12 Publication and the public read feed | T21, T22 |
| FR-61 | §3.12 Publication and the public read feed | T21 |
| FR-62 | §3.12 Publication and the public read feed | T23 |
| FR-63 | §3.12 Publication and the public read feed | T22 |
| FR-64 | §3.12 Publication and the public read feed | T21 |
| FR-65 | §3.12 Publication and the public read feed | T21, T22 |
| FR-66 | §3.13 Feedback and reading figures | T24 |
| FR-67 | §3.13 Feedback and reading figures | T24, T38 |
| FR-68 | §3.13 Feedback and reading figures | T25 |
| FR-69 | §3.13 Feedback and reading figures | T25, T38 |
| FR-70–FR-71 | §3.14 Repository sync | T26 |
| FR-72 | §3.15 AI and agents | T43 |
| FR-73 | §3.15 AI and agents | T44 |
| FR-74 | §3.15 AI and agents | T49 |
| FR-75 | §3.15 AI and agents | T40 |
| FR-76 | §3.16 Notifications, summaries and events | T29 |
| FR-77 | §3.16 Notifications, summaries and events | T48 |
| FR-78–FR-79 | §3.16 Notifications, summaries and events | T29 |
| FR-80–FR-81 | §3.17 Quality, print and reports | T28 |
| FR-82 | §3.17 Quality, print and reports | T41 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off; enabling it in dev shows the feature end to end.
- Constitution gates in `spec.md` §9 confirmed.
- Feature checks: with `FEATURE_WIKI` off the Documents hub, its spaces and today's MCP tools behave as before; with the public switch off no feed route is in the OpenAPI document; an older editor cannot save over suggestion marks; no feed route serves an unpublished page; no second list or kind of space exists.
