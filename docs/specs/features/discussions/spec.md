# Feature Specification: Discussions

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `discussions`
**Branch**: `feat/discussions`
**Status**: `Draft`
**Created**: 2026-11-16
**Last updated**: 2026-11-23
**Owner**: evereq
**Feature flag**: `FEATURE_DISCUSSIONS` (tenant feature, default off) · the plugin loads only when
`GAUZY_DISCUSSIONS_ENABLED` is exactly `true` · notifications appear in the Inbox when `GAUZY_INBOX_ENABLED` is on, and
by email or push when the Inbox delivery switches are on

---

## 1. Overview

Today the platform has comments with one level of replies, mentions and reactions on records, followers of a record,
broadcasts (titled posts on a record with an audience, without any screen), a product changelog, chat channels with
threads, and an Inbox for notifications and digests; it has no place for **long-form, asynchronous discussion** where a
team proposes, debates and decides over days. This feature adds **spaces** (per team, project, client or topic, open or
private, optionally grouped into **space groups**) holding **discussions**: a title and a rich body, with **replies**,
quotes, reactions, polls, tags, mentions, pins, closing, drafts and scheduled publishing, unread tracking, bookmarks,
following, Inbox notifications, email digests, search, an activity feed, pages of the documents hub inside a space,
tasks made from a discussion, and guests limited to the spaces they are invited to. Replies are the platform's
comments, reactions its reactions, mentions its mentions, following its followers, bookmarks its favourites and
announcements its existing **broadcasts**, which get their screens here. Real-time channels stay with `chat-messaging`.
Clients: the Angular app, the MCP server and the SDKs.

**Advanced capabilities.** A long thread gets a **summary**, and **"what changed since my last visit"** sums up the
replies since the reader's last visit, each point linked to the replies it comes from. **Resolve with decision** records the outcome, owner and due date,
creates the tasks, keeps a decision log per space and can announce the decision. **Must-read announcements** carry read
receipts with reminders and a list of who has not read them. **Digests** arrive at the hour each person chose in their
own time zone, and every notification email can be **answered by email** to post a reply. Spaces **live on records**: a
project's or client's space shows on the record, and a discussion can start from any record. Marked `(advanced)`.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** a manager with `DISCUSSIONS_SPACE_CREATE`, **when** they create the open space "Product roadmap" with a
  description and cover, **then** members of the organization can find, join and follow it, and the space shows in their
  sidebar once joined.
- **Given** a member of the space, **when** they publish the discussion "Q1 priorities" with a body, a mention of a
  colleague and a poll, **then** followers of the space are told, the colleague gets an Inbox entry, and the space lists
  the discussion with its reply count and unread marker.
- **Given** a reader who opens a discussion with 40 unread replies, **then** the view starts at the first unread reply,
  the space's unread count drops, and "mark as unread" brings the marker back.
- **Given** a reply quoting a passage of the body, **then** the quote shows its author and links to the source, and the
  quoted author is told.
- **Given** a draft scheduled for Monday 09:00, **then** it is published at that time in the author's time zone and the
  author can reschedule or cancel it until then.
- **Given** a discussion with 120 replies, **when** a reader chooses "What changed since my last visit", **then** a summary of what changed since
  their last visit lists points with links to the replies they come from. `(advanced)`
- **Given** a discussion that has converged, **when** the owner chooses Resolve with decision with an outcome, owner
  "Ana" and due date, **then** the decision is recorded, the discussion is marked resolved, a task is created for Ana in
  the space's project linked back to the decision, and the decision appears in the space's decision log.
  `(advanced)`
- **Given** an announcement marked must-read for the Sales team, **then** each member sees it pinned until they confirm
  "I have read this", unconfirmed members are reminded after three days, and the author sees who has not read it.
  `(advanced)`
- **Given** a member in Singapore with a weekly digest on Monday at 08:00, **then** the digest arrives at 08:00 Singapore
  time with mentions, decisions, unanswered questions to them and the most active discussions of their spaces.
  `(advanced)`
- **Given** an email notifying a new reply, **when** the receiver answers it by email, **then** their answer is posted as a
  reply under their name, without the quoted text. `(advanced)`
- **Given** a project with a space, **when** a member opens the project, **then** its Discussions panel lists the
  project's recent discussions and broadcasts, and "Start a discussion" creates one in that space. `(advanced)`
- **Given** a guest invited by email to the space "Client X", **then** after accepting they see only that space, can reply
  where guests may post, and lose access when the invitation expires.
- **Given** an AI agent with the discussions write scope, **when** it calls the reply tool with `preview: true`, **then** it
  receives the reply as it would appear and nothing is posted.

### 2.2 Edge cases & failures

- **Given** a private space, **then** non-members do not see it in lists, search, digests, notifications or links;
  `DISCUSSIONS_MANAGE` holders see its name and members and read its content only after adding themselves, which is
  recorded.
- **Given** a closed discussion, **then** new replies are refused (`409`) with the reason; reopening allows them again.
- **Given** an archived space, **then** it is read-only with a banner and its discussions keep their links; unarchiving
  restores posting.
- **Given** two people editing the same reply, **then** the second save is refused as stale with the latest text; every
  saved edit is kept in the revision history.
- **Given** a reply deleted by its author, **then** it shows "reply removed" with its date, its replies stay, and a space
  admin can restore it within 30 days.
- **Given** a mention of a person who cannot read the space, **then** they are not told and the author sees "not a member";
  a space-wide mention is offered only to space admins unless the space allows it.
- **Given** a scheduled draft whose space was archived or whose author lost access, **then** it is not published, stays a
  draft and the author is told.
- **Given** an email reply from an address that does not belong to a member, or to a closed discussion, **then** nothing is
  posted and the sender receives one explanation.
- **Given** a decision whose task cannot be created (project archived, no permission), **then** the decision is still
  recorded and the decision shows "task not created" with the reason.
- **Given** no AI provider, **then** summaries and decision proposals are not offered and say why.
- **Given** `FEATURE_DISCUSSIONS` off, **then** new routes answer `404`; comments, reactions, broadcasts' API, followers,
  the changelog and chat behave exactly as today.

## 3. Functional Requirements

### 3.1 Scope and compatibility

- **FR-1** The system loads only when `GAUZY_DISCUSSIONS_ENABLED` is exactly `true` and gates every new route, GraphQL
  field, menu entry and MCP tool with `FEATURE_DISCUSSIONS`; off, they answer `404`.
- **FR-2** The system stores replies as platform comments, reactions as platform reactions, mentions as platform
  mentions, following as platform followers, bookmarks as platform favourites and announcements as broadcasts, so their
  existing APIs, notifications and permissions keep working and see the new records.
- **FR-3** The system keeps every existing comment, reaction, mention, follower, favourite, broadcast, changelog and chat
  route, field and behaviour unchanged.

### 3.2 Spaces and space groups

- **FR-4** A user with `DISCUSSIONS_SPACE_CREATE` can create a space with a name, icon, description, cover image and
  readme page, open (any organization member can join) or private (members only), in a space group or on its own.
- **FR-5** A space's members are a list kept by its admins, or follow a team or a project's members automatically; its
  creator is its first admin.
- **FR-6** A member can join and leave an open space; a space admin can add and remove members, make admins, and set
  whether guests may post and whether space-wide mentions are open to members.
- **FR-7** A user with `DISCUSSIONS_MANAGE` can create space groups with a name, icon, cover, readme, admins and a private
  flag; group admins manage the group's spaces except the content of private spaces they are not members of.
- **FR-8** A space or group admin can rename, archive and unarchive a space or group, move discussions between spaces they
  administer, and merge a space into another, keeping every discussion's link working.
- **FR-9** An archived space or group is read-only with a banner and stays searchable for its members.
- **FR-10** A member can follow or mute a space, pin spaces to their sidebar in their own order, and see spaces sorted by
  recent activity or by name with inactive spaces hidden.
- **FR-11** A space admin can choose a cover image from uploads, hub files or the media gallery.
- **FR-12** A first-time user is offered a short start: create a first space, or spaces suggested from their teams and
  projects, and invite teammates. `(advanced: suggested spaces)`

### 3.3 Discussions and replies

- **FR-13** A user with `DISCUSSIONS_POST` who may post in a space can publish a discussion (a question or an open
  discussion) with a title and a rich body (formatting, mentions, images, files from the hub, links to records); each
  discussion has a readable address.
- **FR-14** The system lists discussions per space and across the user's spaces, with author, last activity, reply and
  participant counts, the last reply's author, unread markers, pins first.
- **FR-15** A member can reply to a discussion and to a reply (one level), edit and delete their own; the system keeps the
  revision history of every edit of a discussion or reply, readable by members; the history of replies is the platform's
  comment history, kept for every comment on a discussion whatever route edits it; comments on other records keep a
  history only once the tenant switches comment edit history on (off by default), so their edits behave as today.
- **FR-16** A member can quote a passage of a discussion or reply in a reply; the quote links to its source and its author
  is told.
- **FR-17** A space admin or the author can pin a discussion to the space, a group admin to the group, and a holder of
  `DISCUSSIONS_MANAGE` to the organization's feed; pinned discussions show first in their scope.
- **FR-18** The author or a space admin can close and reopen a discussion; a closed discussion refuses new replies and
  reactions stay possible.
- **FR-19** The author of a question or a space admin can mark a reply as the accepted answer, shown under the question.
- **FR-20** A member can tag discussions and replies with the organization's tags and filter by tag.
- **FR-21** A member can mention people and teams who may read the space, and a space-wide mention where allowed; only
  readers of the space are told.
- **FR-22** The system saves drafts of discussions and replies while they are written and restores them on return; a
  member can schedule a discussion to be published at a date and time, reschedule or cancel it.

### 3.4 Reactions, polls and bookmarks

- **FR-23** A member can react with emoji to discussions, replies, broadcasts and polls, keep a personal set of quick
  reactions, and use the organization's custom emoji; the author is told of reactions in a bundled entry.
- **FR-24** A user with `DISCUSSIONS_MANAGE` can add and archive custom emoji for the organization.
- **FR-25** A member can add a poll to a discussion or a reply with options, single or multiple answers, anonymous votes,
  an optional closing time; members vote, change or withdraw their vote until it closes, and the author can close it.
- **FR-26** The system shows poll results with counts and percentages, hiding who voted on anonymous polls from everyone.
- **FR-27** A member can bookmark discussions and replies and open their bookmarks list.

### 3.5 Announcements and must-read

- **FR-28** A member allowed to post can publish an announcement in a space, or on a record they may update, as a
  broadcast with a category, an audience and a publish time; announcements show in the space's feed and on the record;
  an announcement in a space never gets a public link.
- **FR-29** The system shows broadcasts published on a record in the space linked to that record, with replies and
  reactions like discussions.
- **FR-30** A user with `DISCUSSIONS_MUST_READ` can mark a discussion or announcement as must-read for the space, teams or
  roles; it stays pinned for each reader until they confirm reading it. `(advanced)`
- **FR-31** The system reminds readers who have not confirmed after a chosen number of days (three by default), at most
  three times, and shows the author and space admins who has and has not confirmed, with each time. `(advanced)`

### 3.6 Unread, following and notifications

- **FR-32** The system tracks for each member the last read reply of every discussion and the unread discussions of every
  space, opens a discussion at the first unread reply, and offers mark as read, mark as unread and mark a space or all
  spaces as read.
- **FR-33** A member can choose whether the sidebar shows unread spaces as a dot or a count.
- **FR-34** The system makes a member a follower of a discussion when they start, reply to or are mentioned in it, and a
  member can follow or mute any discussion.
- **FR-35** The system creates Inbox entries for mentions, quotes, replies to followed discussions, new discussions in
  followed spaces, reactions (bundled), must-read announcements, decisions, accepted answers and guest invitations, with
  read and unread filters and mark all as read, and pushes them to open clients.
- **FR-36** The system delivers those entries by email and push according to each person's Inbox delivery choices
  (immediate, digest, off) and quiet hours, so every event can reach email, not only the digest.
- **FR-37** The system puts a reply address in notification emails about a discussion, and an answer by email from a
  member who may reply is posted as their reply without the quoted text and signature, with attachments as hub files.
  `(advanced)`
- **FR-38** With the feature on, the system shows an unseen marker on the existing "what's new" panel until the user
  opens the newest entries; with it off the panel looks and behaves as today.

### 3.7 Digests

- **FR-39** A member can choose a daily or weekly digest, the weekday and the hour, which the system applies in the
  member's own time zone (else the organization's); the choice is made in their notification preferences and sets the
  person's one digest, of which discussions is a section. `(advanced)`
- **FR-40** The digest lists, for the period and the member's spaces only: mentions and quotes of them, questions waiting
  for them, decisions made, must-read items not yet confirmed, new discussions in followed spaces and the most active
  discussions, at most five items per section with a link to the rest.
- **FR-41** The system ranks "most active" by replies and participants above reactions over the period, skips empty
  sections, sends nothing when every section is empty, and never sends a period twice.

### 3.8 Decisions, tasks and pages

- **FR-42** A member can create a platform task from a discussion or a reply, prefilled with its title, link and space's
  project; the task and the discussion link to each other.
- **FR-43** The author or a space admin can resolve a discussion with a decision: outcome, owner, due date and the replies
  it rests on; the discussion is marked resolved and the decision joins the space's decision log. `(advanced)`
- **FR-44** The system creates the decision's tasks for the chosen owners in the space's project (or a chosen project)
  when asked, linked to the decision, and shows on the decision the tasks' progress. `(advanced)`
- **FR-45** A user can announce a decision as a decision broadcast on the space's linked record, and a later decision
  can supersede an earlier one, which then shows as superseded. `(advanced)`
- **FR-46** A space member can create and open pages of the documents hub inside the space; space members read and edit
  them and non-members cannot, unless a page is shared with them.

### 3.9 Summaries and assistant `(advanced)`

- **FR-47** A member with `DISCUSSIONS_ASSISTANT_USE` can ask for a summary of a discussion or for "what changed since my last visit" since
  their last read reply; every point links to the replies it comes from and the summary is marked as generated.
- **FR-48** The author or a space admin can ask for proposed decisions extracted from the replies, each with outcome,
  suggested owner and due date and its source replies; nothing is recorded until they confirm or edit one.
- **FR-49** A member can ask the assistant to draft a reply or shorten their own text; the draft is shown for editing and
  is posted only by the member.
- **FR-50** The system sends the assistant only the discussion's text the member may read, never other spaces' content.

### 3.10 People, guests and permissions

- **FR-51** A member can see the members of a space, and a person's profile shows a discussions tab with the discussions
  and replies the viewer may read.
- **FR-52** A user with `DISCUSSIONS_INVITE_GUESTS` and admin rights on a space can invite people by email as members or
  guests to chosen spaces; invitations expire after 14 days unless accepted, and can be resent or withdrawn.
- **FR-53** The system gives a guest access only to the spaces they were invited to, lets them reply or post only where the
  space allows guests to, never shows them other spaces, people lists beyond those spaces, or the organization's feed,
  and ends their access at the date the inviter set.
- **FR-54** The system applies roles: organization permissions decide who may use discussions, create spaces, manage and
  invite; space admins moderate their spaces; group admins their groups; private spaces are visible to members only.
- **FR-55** A space admin can edit or remove any reply in their space and restore a removed one within 30 days; every
  moderation action is recorded.

### 3.11 Search, activity and migration

- **FR-56** A member can search discussions and replies of the spaces they may read, with filters for author, space,
  space group, kind, tag, status and period, ranked by title matches and recency; spaces and discussions also appear in
  the command palette.
- **FR-57** A member can mark a search result as not useful; results marked by several members rank lower for that query,
  and administrators can review the feedback.
- **FR-58** The system keeps an activity feed per space and per discussion (published, edited, moved, closed, reopened,
  pinned, decided, archived, merged, members added and removed).
- **FR-59** A user with `DISCUSSIONS_MANAGE` can import discussions from a file in the documented import format (categories to spaces,
  topics to discussions, posts to replies, people matched by email) through the platform's migration toolkit, with a dry
  run, a report and an identifier map so a repeated import updates instead of duplicating.

### 3.12 Records, clients and API

- **FR-60** A space admin can link a space to a record (project, team, client, deal or any registered record type) it may
  read; the record shows a discussions panel with its space's latest discussions and broadcasts. `(advanced)`
- **FR-61** A user can start a discussion from any record they may read; it goes to the record's linked space (created on
  first use with the record's members when the record type declares members) and appears on the record's timeline. The
  record's timeline shows its comments, its space's discussions and the chat messages carrying it together; "Comment" on
  a record keeps creating a comment on the record. `(advanced)`
- **FR-62** The system lays out every discussions page for phone-width screens with a home of unread items and spaces.
- **FR-63** The system exposes spaces, groups, members, discussions, replies, polls, drafts, read states, decisions,
  receipts, digests, invitations and search through documented endpoints.
- **FR-64** The system offers MCP tools to list spaces and discussions, read a discussion with its replies, search, post a
  discussion, reply, react, vote, summarise, propose and record a decision and mark as read; writing tools default to
  `preview: true` and run with the agent's permissions.
- **FR-65** The system pushes new discussions, replies, reactions, poll results and read states to open clients over the
  platform's real-time channel.

### 3.13 Reports

| Report | Question it answers | Content |
| --- | --- | --- |
| **FR-66** Digest email | What did I miss? | the sections of FR-40 for one member and period, with links |
| **FR-67** Space activity | How alive is this space? | per period: discussions, replies, participants, median time to first reply, unanswered questions |
| **FR-68** Decision log | What did we decide and is it done? | per space: decisions with outcome, owner, due date, linked tasks and their status, superseded marks |
| **FR-69** Must-read confirmations | Who has read it? | per item: audience, confirmed with time, not confirmed, reminders sent |

- **FR-70** The system exports the reports FR-67 to FR-69 as CSV and lets a member preview their next digest.

## 4. Non-Functional Requirements

- **Performance**: a space's discussion list under 300 ms P95 at 100,000 discussions per tenant; opening a discussion with
  500 replies under 1 s; a new reply reaches open clients under 1 s; unread counts for all of a member's spaces in one
  call under 200 ms; digests for 10,000 members within 30 minutes of their hour.
- **Volume**: 5,000 spaces and 1 million replies per tenant; 10,000 members per space; 50 polls per discussion.
- **Reliability**: scheduled publishing within a minute of its time; digests never sent twice for a period; email replies
  deduplicated by message id; notification fan-out through the outbox survives restarts.
- **Security & privacy**: space membership on every read, search, notification, digest and summary; guests limited by
  their invitation; rich text sanitised. Leaving the platform: notification and digest emails to members; to the tenant's
  AI provider, the text of one discussion the member may read.
- **Observability**: activity feed and platform activity log entries; metrics for posts, replies, fan-out time, digest
  sends, email replies accepted and refused.
- **Accessibility and localisation**: keyboard navigation through lists and replies, labelled reactions and poll
  controls, readable unread markers; labels in every shipped locale; dates in the reader's time zone.
- **Compatibility**: PostgreSQL, MySQL, SQLite; both ORMs; cloud and self-hosted; OpenAPI additive; SDKs regenerated.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| Space group | A named group of spaces with its own admins |
| Space, space member | A place for discussions of a team, project, client or topic; a person in it with a role |
| Discussion | A titled long-form thread (open discussion or question) in a space |
| Reply, revision | A platform comment on a discussion; a stored earlier text of a discussion or reply |
| Announcement | A broadcast shown in a space's feed and on its record |
| Poll, vote | A question with options on a discussion, reply, broadcast or slide session; one member's answer |
| Draft | An unpublished or scheduled discussion or reply |
| Read state | A member's last read reply of a discussion and unread state of a space |
| Decision | An outcome with owner, due date, source replies and tasks |
| Receipt | A member's confirmation of a must-read item |
| Digest section | The discussions part of a member's periodic digest email |
| Guest | A portal user invited to chosen spaces until a date |
| Summary | A generated summary of a discussion with links to its replies |

## 6. Out of Scope

- Real-time channels, direct messages, chat threads and chat polls' screens: `chat-messaging`.
- Page editing, wiki spaces and page permissions: `documents-and-wiki`; files and their sharing: `drive`.
- Portal user provisioning and sign-in of guests: `access-control-and-security`; the migration toolkit engine:
  `data-import-export`; notification preferences, quiet hours and delivery: `automation-and-notifications`; email
  transport and the reply address: `email-and-communications`.
- Profile editing (photo, biography, cover) beyond the discussions tab: existing employee profile pages.

## 7. Acceptance Criteria

- [ ] **AC-1** An open and a private space with groups, admins, members from a team, join and leave, follow, pin, archive,
      merge and move behave as FR-4 to FR-12; private spaces never leak to non-members in lists, search or digests.
- [ ] **AC-2** A discussion with a mention, a quote, tags, a poll and replies notifies the right people; edits keep their
      revisions; a closed discussion refuses replies; a scheduled draft publishes on time in the author's time zone (FR-16, FR-20, FR-21).
- [ ] **AC-3** Reactions with custom emoji, anonymous and multiple-answer polls and bookmarks work through the platform's
      reaction, poll and favourite APIs (FR-23–FR-25, FR-27).
- [ ] **AC-4** Unread tracking opens at the first unread reply; mark as unread and mark all as read work; sidebar badges
      follow the chosen style; the what's new panel shows its unseen marker (FR-32).
- [ ] **AC-5** Inbox entries and immediate emails arrive for each event of FR-35; an email reply posts a reply, an unknown
      sender's does not (advanced: reply by email).
- [ ] **AC-6** Weekly digests arrive at 08:00 in two members' own time zones with only their spaces' items and are not
      sent twice (advanced: time zones; FR-39, FR-40).
- [ ] **AC-7** Resolve with decision records the decision, creates a linked task, joins the decision log and can be
      announced; a failed task creation is shown (advanced: decisions; FR-43–FR-45).
- [ ] **AC-8** A must-read announcement stays pinned until confirmed, reminds after three days and lists who has not read
      it (advanced: receipts; FR-30, FR-31).
- [ ] **AC-9** "What changed since my last visit" and the decision proposals link each point to its source replies and record nothing unasked;
      without a provider they are unavailable (advanced: summaries; FR-47, FR-48).
- [ ] **AC-10** A project's space shows on the project; a discussion started from a deal lands in the deal's space and on
      its timeline; a broadcast on the project shows in the space (advanced: records; FR-60, FR-61).
- [ ] **AC-11** A guest sees only the invited space, posts only where allowed and loses access at expiry (FR-52, FR-53).
- [ ] **AC-12** Search filters, search feedback, the activity feed and an import of discussions from a file in the documented import format (dry run, report, repeat
      without duplicates) behave as FR-56 to FR-59.
- [ ] **AC-13** The reports FR-66 to FR-69 return correct rows on seeded data and export as CSV.
- [ ] **AC-14** Feature off: `404` on new routes and tools; comments, reactions, broadcasts, followers, changelog and chat
      unchanged (FR-1, FR-3).
- [ ] **AC-15** Feature off, the plugin loaded: editing a task or page comment keeps no earlier text, the "what's new"
      panel shows no marker, and a person's Inbox digest has the same content and layout as before (FR-3, FR-15, FR-38).
- [ ] **AC-16** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-1, FR-3).
- [ ] Works on PostgreSQL, MySQL and SQLite with both ORMs; all functional requirements have a passing test.

## 8. Open Questions

- Announcements are the existing broadcasts (FR-28) rather than a second post type; broadcasts gain screens here.
  Default applied.
- Polls become a platform module on any record (FR-25), owned here and reused by `presentations` and `chat-messaging`;
  custom emoji likewise. Default applied.
- Guests need the portal user type of `access-control-and-security`; without it only members are invited. Default applied.
- `DISCUSSIONS_MANAGE` holders see private spaces' names and members but read content only after joining, which is
  recorded. Default applied.
- Discussions is a section of each person's one digest email (beside the follow digest sections of
  `automation-and-notifications`), sent at the frequency, weekday and hour of their notification preferences, with the
  same quiet hours. Default applied.

## 9. Constitution Gates

- [x] I Plugin-first — new plugin triple `discussions`; core gains only shared pieces used by several plugins (polls,
      custom emoji, broadcast audience resolvers).
- [x] II Tenant/organization scoping — every new record is tenant and organization scoped; spaces filter every read.
- [x] III Both ORMs, additive migrations — plugin and core tables on three dialects; existing tables unchanged.
- [x] IV Default-off flag; nothing removed — deploy switch plus `FEATURE_DISCUSSIONS`; existing APIs unchanged.
- [x] V Contracts and API first — contracts, REST, GraphQL reads and SDKs before the UI.
- [x] VI Permissions, privacy, security — new permission keys, space membership checks, guests, sanitised rich text.
- [x] VII Real-time through the event bus — outbox events to the Inbox and the platform's real-time channel.
- [x] VIII i18n and accessibility — labels in every locale, keyboard-operable lists, polls and reactions.
- [x] IX Tests accompany the change — per-requirement tests, access tests for private spaces and guests.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Builds on: [`automation-and-notifications`](../automation-and-notifications/spec.md),
  [`email-and-communications`](../email-and-communications/spec.md),
  [`access-control-and-security`](../access-control-and-security/spec.md),
  [`record-views-and-search`](../record-views-and-search/spec.md), [`data-import-export`](../data-import-export/spec.md),
  `documents-and-wiki`; works with `chat-messaging`, `presentations`
- Code: `packages/core/src/lib/comment/`, `reaction/`, `mention/`, `entity-subscription/`, `favorite/`, `broadcast/`,
  `packages/plugins/inbox/`, `packages/plugins/changelog/`, `packages/plugins/chat/`, `docs/specs/features/inbox/`
