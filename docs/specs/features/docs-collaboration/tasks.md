# Task Breakdown: Docs collaboration

**Feature ID**: `docs-collaboration`
**Plan**: `./plan.md`
**Status**: `In review`
**Last updated**: 2026-11-07

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

- [ ] **T11**. TipTap JSON ↔ Markdown for the stored subset (paragraphs, headings, lists, code, quotes, rules, links, marks) with a spec
- [ ] **T12**. `GET /documents/:id/export/markdown` (one page) and `?subtree=true` (zip with relative links)
- [ ] **T13**. `PUT /documents/:id/content/markdown` with `expectedRevision`: block diff, only the changed blocks replaced, HTML cache refreshed, mentions and links synced
- [ ] **T14**. MCP docs tools take the Markdown route (`mcp-collaboration-tools`)

## Phase 3 — Live sessions (lane G5, PR 3)

- [ ] **T15**. Authenticated per-page session over the realtime plugin's channel; merged state persisted to `contentBinary`, `contentJson`, `contentHtml`
- [ ] **T16**. Presence and cursors; access re-checked on share / move / trash / lock / member changes; limits; read-only degradation; `GAUZY_DOCS_LIVE_ENABLED`
- [ ] **T17**. Server-side writes (restore, Markdown update, duplicate) applied to the live document
- [ ] **T18**. Ever Teams and the Angular Docs UI: spaces in the tree, follow / mute, live editing after T15

**Status 2026-11-07:** phase 1 in ever-gauzy `feat/docs-collaboration` (PR opened with the lane; bot threads next).
