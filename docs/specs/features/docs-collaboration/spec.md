# Feature Specification: Docs collaboration (spaces, live co-editing, notifications, export)

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `docs-collaboration`
**Branch**: `feat/docs-collaboration`
**Status**: `Draft`
**Created**: 2026-11-07
**Last updated**: 2026-11-07
**Owner**: platform maintainers
**Feature flag**: `GAUZY_DOCS_COLLAB_ENABLED` (default off; requires `FEATURE_DOCUMENTS`)

---

## 1. Overview

The platform's Docs already give an organization a tree of folders, pages and files with a
rich block editor, versions with restore, sharing with people and teams (view, comment,
edit), links from any record, block comments with mentions, favourites, review, search
and AI knowledge. This feature completes Docs as a team collaboration surface, for the
Angular app and for Ever Teams through the same API:

- **Spaces**: every page lives in a team space (one per organization team, plus a
  shared organization space) or a person's private space; project pages appear in the
  project; the tree, search and recent lists are space-aware.
- **Live co-editing**: several people edit a page at once with cursors and presence,
  changes merge without conflicts, and server-side edits (restore, import, API writes)
  reach open editors live.
- **Notifications**: sharing a page, mentioning someone, commenting on a page a person
  follows, and review decisions create Inbox entries.
- **Export and API editing**: Markdown export (page or subtree as a zip) and PDF; API and
  MCP writers update a page from Markdown changing only the edited blocks.
- **Page essentials**: cover, icon, full width, lock, duplicate with sub-pages, move
  between spaces, trash with restore, recent pages — where not already present.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** an organization with teams Design and API, **when** a member opens Docs,
  **then** they see Favourites, the Organization space, the spaces of the teams they
  belong to, Private and Trash; pages of other teams are not listed.
- **Given** two members with the same page open, **when** both type, **then** each sees
  the other's cursor and text within a second, nothing is lost or duplicated, and the
  header shows the co-editors' avatars and "Live".
- **Given** a member offline for a minute, **when** they reconnect, **then** their edits
  merge with what others wrote meanwhile.
- **Given** a page restored to an older version, **when** the restore is saved, **then**
  co-editors see the restored content immediately.
- **Given** a member shares a page with a colleague for commenting, **when** the share
  is saved, **then** the colleague gets an Inbox entry opening the page.
- **Given** a member who created a page, **when** someone comments on it, **then** the
  creator gets an Inbox entry unless they muted the page.
- **Given** an API client updating a page from Markdown, **when** only one paragraph
  differs, **then** only that paragraph changes; callouts, colours, comments and toggles
  elsewhere stay intact; open editors see the change live.
- **Given** a project page tree, **when** a member opens the project's Docs tab,
  **then** they see pages attached to that project and can create one there.
- **Given** a member exports a page with sub-pages, **when** the export completes,
  **then** a zip with Markdown files, relative links and an assets folder downloads.

### 2.2 Edge cases & failures

- **Given** a locked page, **when** a member tries to edit it, **then** the editor is
  read-only, co-editing connections close, and API writes answer "locked".
- **Given** a member removed from a team, **when** that happens, **then** their
  co-editing sessions on that team's pages close and the pages disappear from their tree.
- **Given** a document over the size limit, **when** a write would exceed it, **then**
  the write is rejected with the limit named and the editor warns before that point.
- **Given** fifty people on one page, **when** the limit is reached, **then** further
  openers get read-only mode with a notice.
- **Given** the co-editing service is unavailable, **when** a member edits, **then**
  the editor falls back to single-writer autosave with conflict detection (today's
  behaviour) and shows "Not live".
- **Given** a mention of the same person twice in ten minutes on one page, **when** the
  second is saved, **then** no second Inbox entry is created.

## 3. Functional Requirements

### Spaces and tree

- **FR-1** The platform MUST scope pages to a space: organization, team (one per
  organization team) or private (one per employee); project pages MUST be reachable
  from the project and listed in their space.
- **FR-2** Listing, search, recent and favourites MUST respect space visibility: team
  spaces are visible to team members (and organization admins), private spaces only to
  their owner, organization space to all employees; existing per-page shares MUST keep
  granting access across spaces.
- **FR-3** Members MUST be able to move pages between spaces they can edit, duplicate
  with sub-pages, and trash/restore subtrees as today.

### Live co-editing

- **FR-4** The platform MUST provide an authenticated live editing session per page
  that merges concurrent edits without conflicts, broadcasts cursors and presence, and
  persists the merged state so a reload shows the latest content.
- **FR-5** The stored page content (JSON and HTML) MUST stay in sync with the live
  document for search, history, exports and API readers.
- **FR-6** Server-side writes (version restore, import, Markdown update, duplicate)
  MUST apply to the live document so open editors receive them.
- **FR-7** Access MUST be re-checked periodically and on share/move/trash/lock/member
  changes; sessions MUST close with a reason the client can show.
- **FR-8** Limits (sessions per page, per user, document size) MUST be enforced and
  documented; exceeding them MUST degrade to read-only, never corrupt.
- **FR-9** With the flag off or the service unreachable, the editor MUST keep the
  current single-writer autosave with version checks.

### Notifications

- **FR-10** The platform MUST create Inbox entries for: page shared with me, mention in
  a page, mention in a page comment, comment on a page I created or follow, review
  requested from me, review approved/rejected on my page; with the Inbox dedupe rules
  (the ten-minute window is for mentions and repeated shares; every distinct review
  request and decision is an entry of its own). Comment entries need the platform's
  follower notifications (`GAUZY_NOTIFICATION_FANOUT_ENABLED`) to be on, and a receiver
  who switched the legacy notification type off gets no entry until the Inbox's T17
  lands (plan §4).
- **FR-11** Members MUST be able to follow or mute a page.

### Export and API

- **FR-12** Members MUST be able to export a page, or a page with its sub-pages, as
  Markdown (zip with assets and relative links) and print to PDF.
- **FR-13** The API MUST accept a Markdown update for a page with a version check and
  MUST change only the blocks whose Markdown changed; a block the text only moved keeps
  its formatting and comments, and an update that cannot tell which of identical blocks
  a comment belongs to MUST be refused with a conflict rather than move or drop it.
- **FR-14** Pages MUST expose a stable version that changes on every content change,
  for compare-and-set by API and MCP writers.

### Comments and search (phase 4)

- **FR-16** A member MUST be able to comment on a range of a page's text, not
  only on a block; every reader MUST see the range found again in the page as it
  is now (moved with the text, approximately when it was edited, on its block
  when its text is gone), and a client that knows no ranges MUST keep seeing the
  thread on its block.
- **FR-17** A notification about a comment on a page or task a person follows
  MUST name the comment, so the Inbox entry opens the thread; the record it is
  on stays named.
- **FR-18** A search of pages MUST answer, for each result, a short plain-text
  snippet around the first match with the matches marked by offsets.
- **FR-19** A member MUST be able to export a folder, with its pages,
  sub-folders and files, as a zip with an index.

### Compatibility

- **FR-15** Every existing Docs endpoint, entity field, permission and UI route MUST
  keep working unchanged; Ever Teams MUST be able to build its Docs UI on the same API.

## 4. Non-Functional Requirements

- **Performance**: cursor/text propagation under 300 ms between co-editors on one
  instance; page open with live session under 1 s warm.
- **Reliability**: no lost edits across reconnects within the retention window; merged
  state persisted at least every few seconds while editing.
- **Security & privacy**: space and share checks on every list, read, write and live
  session; private pages never leak through search, links or exports.
- **Observability**: live sessions, merges and rejected writes counted; activity log
  entries for share, move, lock, restore.
- **Compatibility**: PostgreSQL, SQLite, MySQL; both ORMs; additive migrations; works
  behind the existing ingress; multi-instance through the shared bus.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| `Document` (existing) | Folder, page or file with content, versions, shares, links; gains a space |
| `DocumentSpace`  | Organization, team or private container of a page tree |
| `LiveSession`    | A member's live editing connection to one page |
| `PageFollow`     | A member following or muting a page (existing subscription mechanism) |
| `MarkdownUpdate` | An API write expressed as Markdown with a version check |

## 6. Out of Scope

- Public sharing links and guest access.
- Databases/properties inside pages, templates.
- Changing the editor engine; the existing editor and JSON format stay.

## 7. Acceptance Criteria

- [ ] Team, organization and private spaces list the right pages for the right people;
      project pages appear in the project.
- [ ] Two editors co-edit with cursors; a reconnect merges; restore and API Markdown
      writes reach open editors.
- [ ] Share, mention, comment and review events create Inbox entries with dedupe.
- [ ] Markdown export (page, subtree) and Markdown API update work as specified.
- [ ] Flag off: nothing changes; service down: single-writer autosave still works.
- [ ] Works on PostgreSQL, MySQL and SQLite with both ORMs.
- [ ] All functional requirements have a passing test.

## 8. Open Questions

- Resolved (phase 3): the live editing sessions run in the API process
  (`DocsLivePlugin`), horizontally scaled through the shared GraphQL pub/sub
  (Redis); no compaction job yet (Yjs garbage-collects deleted content in the
  stored state).

## 9. Constitution Gates

- [x] I Plugin-first — extends `packages/plugins/docs` (+ `docs-ui`); no new plugin needed except the live session server module.
- [x] II Tenant/organization scoping.
- [x] III Both ORMs, additive migrations — space and follow tables, new columns.
- [x] IV Default-off flag; nothing removed.
- [x] V Contracts and API first.
- [x] VI Permissions, privacy, security — existing docs permissions, space checks.
- [x] VII Real-time through the event bus — presence and change hints on the platform channel; live editing session is the documented exception for CRDT sync.
- [x] VIII i18n and accessibility.
- [x] IX Tests accompany the change.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Depends on: [`../realtime-channel/spec.md`](../realtime-channel/spec.md), [`../inbox/spec.md`](../inbox/spec.md)
- Consumers: Ever Teams `docs` spec; [`../mcp-collaboration-tools/spec.md`](../mcp-collaboration-tools/spec.md)
