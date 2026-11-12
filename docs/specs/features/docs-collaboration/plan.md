# Implementation Plan: Docs collaboration (spaces, follows, notifications, revision, Markdown, live sessions)

**Feature ID**: `docs-collaboration` · **Spec**: [`spec.md`](./spec.md) · **Branch**: `feat/docs-collaboration` · **Status**: Phase 1 in review (2026-11-07)

## 1. Summary

Extends `packages/plugins/docs` (no new plugin) behind `GAUZY_DOCS_COLLAB_ENABLED` (default off), in three
pull requests:

1. **Spaces, follows, notifications, revision** — a `TEAM` visibility with the team whose space the page is in;
   the spaces the caller sees and a space filter on the list; moving a page (with its subtree) between spaces;
   follow / unfollow / mute / unmute of a page; Inbox entries for a share, a review request and a review decision;
   `contentRevision` as the compare-and-set token of API writers.
2. **Markdown** — export of a page or a subtree (Markdown, zip), and a Markdown update of a page that changes only
   the blocks whose Markdown changed, with the revision check.
3. **Live sessions** — the authenticated per-page session that merges concurrent edits (the stored CRDT column,
   the realtime plugin's channel for presence and change hints), persisted back to `contentJson` / `contentHtml`.

Every existing Docs route, field, permission and UI route keeps working unchanged; Ever Teams builds its Docs UI on
the same API.

## 2. Reuse

| Need | Existing piece | How it is used |
| --- | --- | --- |
| Visibility and shares | `visibility` column, `document_share`, `document-access.predicate.ts` + `.sql.ts` (one rule, two surfaces) | `TEAM` added to both surfaces; team membership resolved at query time like team shares |
| Following | the platform's `EntitySubscription` (`CreateEntitySubscriptionEvent`), the comment fan-out and the mention service | follow = a `MANUAL` subscription; mentions are told by the mention service; comments on followed pages are told by the core follower fan-out (`FollowerFanOutService`), which runs only with `GAUZY_NOTIFICATION_FANOUT_ENABLED=true` (default off): a deployment that enables Docs collaboration must enable it too, or FR-10's follower-comment entries are not created |
| Notifications | `EmployeeCreateNotificationEvent` → the unified Inbox (`inbox` spec) | share / review entries, shares deduped per receiver and page |
| Concurrency | `expectedUpdatedAt` on the content save (409 `DOCS_CONTENT_CONFLICT`) | `expectedRevision` beside it; `contentRevision` moves on every content change |
| Tree operations | `DocumentTreeService.collectVisibleSubtree` | a space move takes the descendants the caller may write |
| HTML → Markdown | `turndown` (already a plugin dependency), the `contentHtml` render cache | export (phase 2) |
| Zip | `archiver` (a core dependency) | subtree export (phase 2) |
| CRDT state | `contentBinary` column, `@tiptap/extension-collaboration` in `docs-ui` | live sessions (phase 3) |
| Flags | the `parseBoolEnv` pattern of `docs.config.ts` | `collabEnabled`; 404 `DOCS_COLLAB_DISABLED` on the new routes |
| Migrations | the additive-column migration style (`1791000004700`) | `1791000004800-AddDocumentSpacesAndRevision` |

## 3. Modules (`packages/plugins/docs/src/lib`)

| Module | Responsibility |
| --- | --- |
| `contracts`: `document.model.ts` | `DocumentVisibilityEnum.TEAM`, `DocumentSpaceKindEnum`, `IDocumentSpace`, `IDocumentSpaceMoveInput`, `IDocumentFollowState`, `organizationTeamId`, `contentRevision` |
| `entities/document.entity.ts` | `organizationTeam` / `organizationTeamId` (SET NULL), `contentRevision`, index `IDX_document_tenant_org_team` |
| `services/document-access.predicate.ts`, `document-access.sql.ts`, `document-access.service.ts` | `isTeamSpaceMember`; a TEAM page reads like a PRIVATE one shared with its team at `EDIT`; the team bracket of the visibility scope |
| `services/document.service.ts` | the space fields of a create / update (team of the organization, member or `DOCS_MANAGE`, flag on), the space filter of the list, `expectedRevision`, the revision bump |
| `services/document-collaboration.service.ts`, `controllers/document-collaboration.controller.ts`, `dto/document-space.dto.ts` | spaces with counts, the space move, follow / unfollow / mute / unmute |
| `services/document-notifier.service.ts` | share, review request and review decision entries; dedupe; muted and actor left out |
| `services/document-collaboration.helpers.ts` (+spec) | the space of a document, the muted list in the metadata, the receivers of a notification |
| `services/document-share.service.ts`, `document-review.service.ts`, `dto/review-decision.dto.ts` | shares on TEAM pages; `reviewerEmployeeIds`; the notifications hooked in |
| `core/database/migrations/1791000004800-AddDocumentSpacesAndRevision.ts` | two columns, the index, the team foreign key; tri-dialect, idempotent |

Phase 2 adds `services/document-markdown.ts` (+spec: TipTap JSON ↔ Markdown for the stored subset, block diff) and
the routes `GET /documents/:id/export/markdown[?subtree=true]` and `PUT /documents/:id/content/markdown`. Phase 3
adds the live-session module (`GAUZY_DOCS_LIVE_ENABLED`, limits, access
re-checks, persistence): `live/` holds `DocsLivePlugin` and its module,
`document-live.service.ts` (sessions, persistence, relay between processes),
`document-live.yjs.ts` (TipTap JSON in and out of the shared document as
y-prosemirror does, the seed every process builds alike, the block-by-block
replacement of a server-side write, the stored state's lineage and revision
header), `Subscription.documentLive` and the `…/live/updates` and
`…/live/awareness` routes; `services/document-live.bridge.ts` is the seam the
content save, the restore, the duplicate and the share changes call (a no-op
with the flag off).

## 4. Rules

- **Spaces**: a TEAM page names a team of its organization; the writer belongs to it (or holds `DOCS_MANAGE`). A
  deleted team leaves its pages with no team: readable by their creator and managers until moved. A space move
  takes the descendants the caller may write; the others stay where they are. Only the owner (or `DOCS_MANAGE`)
  moves a page, as with visibility.
- **Follow / mute**: a mute removes the caller's subscriptions and keeps them out of the plugin's own
  notifications until they unmute; a direct mention subscribes them again, as everywhere on the platform.
- **Notifications**: `DocumentNotifierService.publish` files share, review-request and review-decision entries;
  the actor and the people who muted the page are never told. The same person is told of a share of the same
  page once per `DOCS_NOTIFICATION_DEDUPE_MINUTES` (10; `recentlyNotified` compares type and message line).
  The window is for shares only (`DEDUPED_DOCUMENT_NOTIFICATION_KINDS`): every review request and decision is a
  review round of its own (a request only moves a page that is not pending to pending, a decision only moves a
  pending one on), so a second round for the same person and page within ten minutes is an entry too
  (`document-notifier.service.spec`).
- **Revision**: `contentRevision` starts at 1 for every existing page and moves on every content change; a stale
  `expectedRevision` is 409 with the current one, nothing written.
- **Flag off**: `TEAM` writes and the collaboration routes answer 404 `DOCS_COLLAB_DISABLED`; existing TEAM pages
  keep their access rules; everything else is as before.
- **Rollout dependencies**: `GAUZY_DOCS_COLLAB_ENABLED` for the routes and the share / review entries;
  `GAUZY_NOTIFICATION_FANOUT_ENABLED` for the comments-on-followed-pages entries; `GAUZY_INBOX_ENABLED` for the
  entries to appear in the Inbox (the notification rows exist either way). The flags are not enough for FR-10:
  a receiver whose legacy notification switch for the type is off (`comment` for comments, `assignment` for
  shares and review requests, `preferences.taskUpdate` for review decisions) gets no notification row and so
  no entry. The Inbox fix (inbox plan §10.2, task T17) is a prerequisite for FR-10 to hold for every
  receiver.
- **Markdown merge** (`mergeMarkdownUpdate` in `services/document-markdown.ts`, behind
  `PUT /documents/:id/content/markdown`, merged with phase 2): the stored blocks and the incoming ones are
  matched by their Markdown, wherever they moved, in O((n + m) log(n + m)): a text found once on each side is
  the same block (moved or not); the longest run of those that kept their order are anchors, and a text with an
  identical twin is matched gap by gap between the anchors (a gap with as many incoming twins as stored ones
  pairs them in order). A matched block keeps its stored JSON (attributes, marks, block ids, so comment
  anchors), an unmatched incoming block is built from the Markdown, an unmatched stored block is dropped. When
  twins were added, removed or moved so that which is which is a guess (`ambiguousBlockIds`), and a comment is
  anchored to one of them (the `[[block:<blockId>]]` first line of an editor block thread), the update is
  refused with 409 `DOCS_MARKDOWN_AMBIGUOUS` (`currentRevision`, `blockIds`), nothing written; the MCP
  `update_page_markdown` tool answers that conflict without sending the client to read the page again. Known
  limitations: blocks still carry no identity in Markdown, so (1) the twin rule is conservative: removing one of
  two adjacent identical commented paragraphs is refused even when the intent is plain to a reader; (2) a block
  whose text changed is rebuilt from its Markdown, so its block id (and the anchor of a comment on it) goes, as
  before. Follow-up: stable block ids round-tripped in the exported Markdown (or targeted block edits).
- **Comment anchors** (phase 4, `services/document-comment-anchor.ts` and `document-comment-anchor.service.ts`,
  table `document_comment_anchor`, migration `1791000007530`): a root comment of a page may name a range of one
  block's text: the block id, UTF-16 offsets into the block's text (every text node under the block, in order,
  nothing between them), the quote (at most 1000 characters, its length the range's), up to 32 characters of
  context a side, and in a live session the range's ends as base64 `Y.RelativePosition`s of the shared document.
  One row per comment (unique `commentId`), removed with the comment and with the page (`CASCADE`); the comment's
  `[[block:<blockId>]]` first line stays, so a client that knows no ranges keeps the block. Every read finds the
  range again in the page as it is now, in this order: the live relative positions (when the page has a live state
  for its revision), the stored offsets, the quote in its block (the occurrence whose context and place fit best),
  then in the other blocks, the quote with at most a quarter of it edited (in its block, at least 6 characters),
  the block alone; else the anchor is orphaned (`exact` / `moved` / `block` / `orphaned`, with the method). Ever
  Teams applies the same rules in the editor (`docs-comment-anchors.ts`), so a range is found in the same place.
  Access: reading the ranges is the page's read rule (`findOneScoped`); setting or removing one takes the comment's
  author, a root comment of that page that is not withdrawn, and a page that takes the author's comments (the comment
  API's write rule, `DocumentCommentAccessPolicy.findWritableParent`: a page reached through a `VIEW` share is
  read-only). The ranges of withdrawn comments are not listed, and come back with the comment. `Comment.documentAnchor`
  reads the page in its own organization only when the caller reaches it, and a GraphQL `organizationId` argument
  must name an organization the caller reaches. The routes answer 404 `DOCS_COLLAB_DISABLED` while
  `GAUZY_DOCS_COLLAB_ENABLED` is off (the field is null), and a client then keeps every thread on its block.
- **Follower notifications name the comment** (phase 4, migration `1791000007540`): the follower fan-out writes the
  comment's id in `employee_notification.commentId` (nullable, no foreign key, as `entityId`); `entity` /
  `entityId` still name the record, so every reader of a notification keeps opening the record. The Inbox files
  such a notification as an entry about the comment (entity `Comment`, the comment's id, the record in
  `metadata.parentEntity` / `parentEntityId`, and in `taskId` for a task), the shape a mention in a comment already
  has, so a client opens the thread. A mention keeps its record (the Inbox finds its twins by it).
- **Search snippets** (phase 4, `services/document-search-snippet.ts`): `GET /documents?q=…` items carry
  `searchSnippet`: about 160 characters of plain text around the first match (the page's text, else a file's
  extracted text, else the description; the beginning of the first text there is when only the name matched), cut
  at word boundaries, with every match as `[start, end)` offsets and the name's matches. Never HTML. A content search
  reads the text of the first 50 results once more (a document that is not `searchable` keeps its content out of
  its snippet, as the search does); a result whose text cannot be read has no snippet.
- **Folder zip export** (phase 4): `GET /documents/:id/export/markdown?subtree=true` takes a folder too: its pages
  (as a page's subtree export writes them), its sub-folders as folders of the zip, its files copied beside the pages
  of their folder under their own names (within the export's byte budget, shared with the files the pages show; a
  file past it, or unreadable, is listed with its API link), and an `index.md` listing what the zip holds. Every node
  is read with the caller's access: an unreadable one is left out with its subtree. A page's export is unchanged; a
  file is still 409 `DOCS_NOT_A_PAGE`. The PDF export keeps reading pages only (`collectSubtreeWithin`).

## 5. Tests

`document-access.predicate.spec` (TEAM rows), `document-collaboration.helpers.spec`; the migration follows the
tested style of `1791000004700`. Phase 2: `document-markdown.spec` (round trip, block diff, moved and identical
blocks), `document-markdown.service.spec` (the 409 for a commented twin), `document-notifier.service.spec` (the
share-only dedupe window). The in-cluster build runs the plugin suite on `develop`.

Phase 4: `document-comment-anchor.spec` (block text, finding a range again, the approximate match, Yjs relative
positions over concurrent edits), `document-comment-anchor.service.spec` (author, reply, other page, a page that
takes no comments, the organization boundary, the flag, live state, GraphQL field cache, validation),
`document-search-snippet.spec`, `document-markdown.export.spec` (a folder's zip read back),
`document-markdown.service.spec` (the PDF's page-only collection), `follower-fan-out.spec` (the comment id),
`inbox-notification.bridge.spec` (the entry about the comment), `migration-timestamps.spec`.
