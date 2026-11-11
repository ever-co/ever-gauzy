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

## 5. Tests

`document-access.predicate.spec` (TEAM rows), `document-collaboration.helpers.spec`; the migration follows the
tested style of `1791000004700`. Phase 2: `document-markdown.spec` (round trip, block diff, moved and identical
blocks), `document-markdown.service.spec` (the 409 for a commented twin), `document-notifier.service.spec` (the
share-only dedupe window). The in-cluster build runs the plugin suite on `develop`.
