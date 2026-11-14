# Task Breakdown: Docs collaboration

**Feature ID**: `docs-collaboration`
**Plan**: `./plan.md`
**Status**: `In review`
**Last updated**: 2026-11-13 (T19–T24b)

---

## Phase 1 — Spaces, follows, notifications, revision (lane G5, PR 1)

- [x] **T1**. Contracts: `TEAM` visibility, space kinds, `IDocumentSpace`, the space move input, the follow state, `organizationTeamId`, `contentRevision`
- [x] **T2**. Entity and migration `1791000004800`: `organizationTeamId` (SET NULL), `contentRevision`, the team index, the team foreign key
- [x] **T3**. Access: `isTeamSpaceMember` in the pure predicate and the SQL scope; shares on TEAM pages; the by-id gates carry the team
- [x] **T4**. Create / update: the space fields checked (team of the organization, member or `DOCS_MANAGE`, flag on); the owner-only rule covers the team
- [x] **T5**. `GET /documents/spaces`, `GET /documents?space=…`, `POST /documents/:id/space` (subtree by default)
- [x] **T6**. Follow / unfollow / mute / unmute on the platform's entity subscription; the mute remembered in the metadata
- [x] **T7**. Inbox entries: share with me or my team, review asked of me (`reviewerEmployeeIds`), decision on my page; dedupe; muted and actor left out
- [x] **T8**. `contentRevision` moved by the content save and the version restore; `expectedRevision` on the content save
- [x] **T9**. `GAUZY_DOCS_COLLAB_ENABLED` flag; `.env.sample`; README section; specs (predicate rows, helpers)
- [ ] **T10**. Bot threads answered; manual check on dev (team page hidden from a non-member, space move with subtree, mute stops the share entry, 409 on a stale revision)

## Phase 2 — Markdown (lane G5, PR 2)

- [x] **T11**. TipTap JSON ↔ Markdown for the stored subset (paragraphs, headings, lists, code, quotes, rules, links, marks) with a spec
- [x] **T12**. `GET /documents/:id/export/markdown` (one page) and `?subtree=true` (zip with relative links)
- [x] **T13**. `PUT /documents/:id/content/markdown` with `expectedRevision`: block diff, only the changed blocks replaced, HTML cache refreshed, mentions and links synced
- [x] **T14**. MCP docs tools take the Markdown route
  (`mcp-collaboration-tools`): `get_page` reads
  `GET /documents/:id/export/markdown` between two reads of the revision;
  `create_page` and `update_page_markdown` write
  `PUT /documents/:id/content/markdown` with `expectedRevision`
  (ever-gauzy #11722 and its rounds). `docs.markdown-route.spec` drives the
  tools from an MCP client through the real API client to a stand-in of the
  routes (requests, a Markdown round trip, one edited block, a stale
  revision, slices)

## Phase 3 — Live sessions (lane G5, PR 3)

- [x] **T15**. Authenticated per-page session over the realtime plugin's
  channel; merged state persisted to `contentBinary`, `contentJson`,
  `contentHtml`
  (`DocsLivePlugin`, `live/`): `Subscription.documentLive` on the platform's
  GraphQL subscription socket streams the page's Yjs state and the edits;
  the client posts its edits and awareness to `…/live/updates` and
  `…/live/awareness`. Seeds are alike in every process; the state is stored
  with a lineage + revision header; saves claim `contentRevision` and merge
  the stored state first; several API processes relay over the shared
  pub/sub (`document-live.yjs.spec`, `document-live.service.spec`)
- [x] **T16**. Presence and cursors; access re-checked on share / move / trash
  / lock / member changes; limits; read-only degradation;
  `GAUZY_DOCS_LIVE_ENABLED`
  (awareness relayed and removed on leave; re-checks every 60 s, on a
  `DocumentEvent` and on a share change; team membership changes reach
  sessions on the periodic check)
- [x] **T17**. Server-side writes (restore, Markdown update, duplicate)
  applied to the live document
  (`DocumentLiveBridge`: an API / Markdown save and a restore are applied
  block by block and stored for the new revision; a duplicate saves the
  live document first)
- [x] **T18**. Ever Teams and the Angular Docs UI: spaces in the tree, follow /
  mute, live editing after T15 (Angular: ui-core socket #11785, live editor
  #11786, spaces in the tree and follow / mute #11787, move to space #11793;
  Ever Teams: ever-teams #5049 behind `NEXT_PUBLIC_DOCS_LIVE_ENABLED`; a run
  against a platform with `GAUZY_DOCS_LIVE_ENABLED=true` is still to do)

**Status 2026-11-07:** phase 1 in ever-gauzy `feat/docs-collaboration` (PR opened with the lane; bot threads next).

## Phase 4 — Platform gaps found by the Ever Teams Docs lane (ever-gauzy #11813)

- [x] **T19**. Text-range comment anchors (FR-16): contracts, table
      `document_comment_anchor` (migration `1791000007530`, both ORMs), REST
      (`GET …/comment-anchors`, `PUT|DELETE …/comments/:commentId/anchor`) and
      GraphQL (`Comment.documentAnchor`, `documentCommentAnchors`, set /
      remove), behind `GAUZY_DOCS_COLLAB_ENABLED`; the comment API's write rule
      for a page
- [x] **T20**. Follower notifications name the comment (FR-17):
      `employee_notification.commentId` (migration `1791000007540`), the
      fan-out, the Inbox entry about the comment
- [x] **T21**. Search snippets (FR-18): `searchSnippet` on `GET /documents?q=…`
- [x] **T22**. Folder zip export (FR-19): `…/export/markdown?subtree=true` on a
      folder
- [x] **T23**. Ever Teams: range comments (highlight, panel, live relative
      positions), the anchor proxies, the folder zip export (ever-teams
      `feat/docs-platform-gaps`)
- [x] **T24**. The Angular Docs UI: snippets in the search results and the zip
      export of a folder or a page with sub-pages ([#11846](https://github.com/ever-co/ever-gauzy/pull/11846))
- [x] **T24b**. Range comments in the Angular editor: a thread on selected text
      keeps its range, the text is lit and found again after edits (live by its
      relative positions), the rail shows the text it is on now; block threads
      unchanged, ranges shared with Ever Teams ([#11929](https://github.com/ever-co/ever-gauzy/pull/11929))
- [ ] **T25**. Manual check on dev with `GAUZY_DOCS_COLLAB_ENABLED=true` (a
      range found again after edits, live and saved; a follower's Inbox entry
      opens the thread; a folder's zip opened)
