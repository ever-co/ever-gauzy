# Feature Specification: Record views and search

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `record-views-and-search`
**Branch**: `feat/record-views-and-search`
**Status**: `Draft`
**Created**: 2026-11-16
**Last updated**: 2026-11-23
**Owner**: platform maintainers
**Feature flag**: `FEATURE_RECORD_VIEWS` (tenant feature, default off) · the plugin loads only when
`GAUZY_RECORD_VIEWS_ENABLED` is exactly `true` · search keeps `FEATURE_SEARCH`; meaning-based search also needs
`FEATURE_SEMANTIC_SEARCH` (default off)

---

## 1. Overview

Today saved views, filters, grouping, bulk actions and rebindable shortcuts exist for tasks only (behind a deploy
switch), boards exist for deals and per project, tags, favourites, comments, mentions and reactions exist on most
records, a search index with ranked endpoints exists without a page, and every other list is a hand-built table. This
feature offers **the saved view as a list of every registered record type**, beside the existing tables, which stay:
list, table, board, calendar, timeline,
tree, map, gallery and dashboard layouts over one view definition (filters, quick filters, sorting, grouping, columns,
aggregates), with sharing, pinning, bulk actions, inline edit and export. It adds the **record page shell** that other
features fill (a timeline of comments, changes, notes, emails, calls and runs; a sidebar; hover cards; quick entry), a
**command palette**, a **global search page** with full-text search inside comments, notes and messages, and
**keyboard shortcuts** everywhere. Field definitions and form layouts come from custom fields; report definitions from
the report builder. Clients: the Angular app, the MCP server and the SDKs.

**Advanced capabilities.** A filter typed in plain language ("overdue invoices of my customers over 5,000")
compiles into an editable saved view; lists and boards **update live** over the real-time channel with **presence** on
records; **meaning-based search** spans records, documents and messages and never shows what the reader may not see;
views are **shared with roles or teams** and **pinned to dashboards**; pinned lists **work offline** in the installable
web app; every view is a selection other engines (automation, digests, exports, document runs) can use. Marked
`(advanced)`.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** a sales manager on Contacts, **when** they filter active customers of region North, group by owner, add the
  custom column "Contract renewal", save "North customers" shared with the Sales team and pin it, **then** team members
  see it in their sidebar with a live count, and a copied link reopens the same view and layout.
- **Given** a board of deals by stage with swimlanes by owner and a limit of 10 cards on "Negotiation", **when** a user
  drags a card to "Lost", **then** the lost reason is asked, the move is written through the deal's own rules, an
  eleventh card in "Negotiation" shows the limit warning, and a refused move snaps back with the reason.
- **Given** invoices in table layout grouped by customer with a sum of totals, **when** the user selects 700 invoices
  and sets a payment term, **then** the job runs in the background with progress, lists 12 refusals with reasons, and an
  undo within 10 minutes restores the 688 that nobody changed since.
- **Given** time-off requests in calendar layout mapped to start and end, **when** a manager drags a pending request
  to the next week, **then** its dates change through the time-off rules; an approved request does not move.
- **Given** any page, **when** a user presses mod+K and types "acme", **then** the contact, project and invoice named
  Acme appear grouped by type with recent records first; "new task" opens quick entry; on an invoice "assign to me"
  creates the assignment.
- **Given** the search page, **when** a user searches "renewal clause", **then** a comment on a contract record and a
  document page are found with highlighted snippets and their parent records; a record the user may not read is absent.
- **Given** a contact page, **when** the user opens the timeline, **then** comments, emails, field changes, automation
  runs and notes appear newest first; filtering "notes" and adding a private note shows it only to its author.
- **Given** the request "overdue invoices of my customers over 5,000", **when** the assistant answers, **then** editable
  chips appear (status overdue, customer owner is me, total greater than 5,000) and the user saves them as a view.
  `(advanced)`
- **Given** two people on the same board, **when** one moves a card, **then** it moves on the other's board within 2 s,
  and avatars on the record show who is viewing it. `(advanced)`

### 2.2 Edge cases & failures

- **Given** a view shared with a team, **when** a member opens it, **then** only records they may read appear and counts
  and aggregates cover only those.
- **Given** a filter on a deleted custom field or option, **then** it shows as invalid with a remove action and the rest
  of the view applies; a view with an unknown layout opens as a list.
- **Given** two editors saving one shared view, **then** the second gets a conflict with the latest version; an inline
  edit on a stale row shows the current value and asks again.
- **Given** a tree move that would make a record its own ancestor, **then** it is refused; a map layout with no map
  service configured is not offered.
- **Given** the search index still building, **then** the search page shows the progress and the palette offers pages,
  commands and recent records; with no AI provider, meaning-based search is off with a notice and keyword search works.
- **Given** an offline phone with queued edits, **when** it reconnects and a record changed meanwhile, **then** the
  conflict is listed for the user to keep theirs or the server's. `(advanced)`
- **Given** `FEATURE_RECORD_VIEWS` off, **then** new routes answer `404`, pages show their existing lists, and task views,
  task bulk actions, shortcuts and search behave exactly as today.

## 3. Functional Requirements

### 3.1 Scope, flags and compatibility

- **FR-1** The system loads only when `GAUZY_RECORD_VIEWS_ENABLED` is exactly `true` and gates every route, GraphQL field,
  menu entry and MCP tool with `FEATURE_RECORD_VIEWS`; off, they answer `404` and pages keep their existing lists.
- **FR-2** The system keeps saved task views, their routes, built-in task views, task bulk actions and keyboard bindings
  working unchanged, serves task views as the saved views of the task record type, and keeps the saved views of every
  other type in that same model (one model, not two).
- **FR-3** The system keeps the search endpoints, permissions and `FEATURE_SEARCH` unchanged and builds the page and the
  palette on them.
- **FR-4** The system only adds routes and fields; nothing existing is renamed, repurposed or removed.

### 3.2 Lists and layouts

- **FR-5** The system gives every registered record type that declares a list a shared list: cursor paging, a count
  (estimated above 10,000, exact on request), standard and custom field columns, coloured status badges, tags, people
  avatars and declared counters (comments, assignments).
- **FR-6** The system offers the shared list first, behind the flag, on: tasks, projects, contacts, deals, employees,
  candidates, invoices and estimates, expenses, incomes, vendors, items, equipment, time-off requests and goals; on each
  of these pages the existing table, board and actions stay the default, the shared list is a second layout a person
  can switch to, and it becomes the page's default only when an administrator chooses so per record type (setting, off
  by default) or a person chooses it for themselves; plugin types without a page of their own get the shared list.
- **FR-7** The system offers list, table, board, calendar, timeline, tree, map, gallery and dashboard layouts, and keeps
  the view and layout in the address so a link reopens them.
- **FR-8** The system offers a layout only when the type has fields of the kind it needs and lets the user map them in
  the view (dates for calendar and timeline, grouping field for board, parent for tree, coordinates for map, image for
  gallery); no field naming convention is assumed.

### 3.3 Saved views and sharing

- **FR-9** A saved view holds record type, name, icon, description, layout and its settings, filter, quick filters,
  sort, grouping, columns (order, width, label, wrap), aggregates, page size, manual order and a version.
- **FR-10** A user can save the current state as a view or update one they may edit; an unsaved-changes bar offers save,
  save as and discard; saving on an older version is refused with the latest.
- **FR-11** A view is private or shared for reading or editing with people or teams (`RECORD_VIEW_SHARE`) or with roles
  or the organization (`RECORD_VIEW_MANAGE`); a shared view never shows a reader records they may not read.
  `(advanced)`
- **FR-12** A user can choose their default view per type; a user with `RECORD_VIEW_MANAGE` can set defaults per
  audience and quick filters per type; plugins ship system views that can be duplicated but not edited.
- **FR-13** A user can duplicate, rename, reorder and delete views they may edit; deleting a shared view needs its owner
  or `RECORD_VIEW_MANAGE` and removes its pins.
- **FR-14** A user can pin a view to their sidebar as one of their favourites, with an optional live count;
  `RECORD_VIEW_MANAGE` pins for an audience.
- **FR-15** The system lists views per type grouped as pinned, mine, shared with me and system, with search.

### 3.4 Filters, sorting and list search

- **FR-16** The filter builder offers conditions in all/any groups with negation (two levels) and operators by field
  kind: equals, not equals, one of, none of, contains, starts with, empty, not empty, comparisons, between, relative
  dates (today; last, this or next N days, weeks, months, quarters, years), me, my teams, my reports, under or above a
  tree node, by referenced record; custom fields and workflow states included.
- **FR-17** Quick filters show chosen fields above the list for one-click filtering, per type and per user.
- **FR-18** A search box inside a list matches the type's search fields and searchable custom fields.
- **FR-19** Sorting takes several fields with directions; kinds that cannot sort are not offered.
- **FR-20** An invalid condition (deleted field, option or record) shows as invalid with a remove action; the rest applies.

### 3.5 Columns, grouping and aggregates

- **FR-21** The column chooser adds, orders, resizes, relabels and resets columns, including custom fields and fields of
  a referenced record one hop away.
- **FR-22** The system groups by choice, reference, person, status, tag and date fields (day, week, month) up to two
  levels, with counts and paging per group.
- **FR-23** A group sidebar shows counts by assignee, owner, tag, status, creator and any groupable field; a click filters.
- **FR-24** The table layout shows count, sum, average, minimum and maximum per column, per group and in a totals row;
  money is totalled per currency.
- **FR-25** "Save as report" hands filter, columns, grouping and aggregates to the report builder when it is loaded.

### 3.6 Board, calendar, timeline, tree, map, gallery, dashboard

- **FR-26** The board groups cards by a choice, status, reference or person field in that field's order, shows a title,
  image and up to six fields, swimlanes by a second field, column limits with a warning, inline add, collapsible
  columns and paging per column; dragging writes the field through the record's rules, asks for inputs they require and
  reverts with the reason when refused.
- **FR-27** The calendar shows month, week, day and agenda from a start and optional end or all-day field, colours by a
  field, toggles weekends, creates on a slot, and moves or resizes by dragging through the record's rules.
- **FR-28** The timeline draws bars from start and end with progress, colour, milestones and dependencies (task links of
  kind "blocks"), scales by day, week, month and quarter, marks today and reschedules by dragging.
- **FR-29** The tree browses types with a parent field: expand with counts, add child, move by dragging (a cycle is
  refused) and search showing the path.
- **FR-30** The map shows markers from coordinate fields with clustering, a card on click and filtering by visible area;
  it is offered only when the deployment configures a map tile service.
- **FR-31** The gallery shows cards with the image field, title and fields, and opens a viewer.
- **FR-32** The dashboard layout shows the type's report cards filtered by the view when the report builder is loaded.

### 3.7 Selection, bulk actions, inline edit, export and tags

- **FR-33** A user can select rows, a page, or all matching records (up to 10,000); work on more than 500 runs in the
  background with progress and a notice when done.
- **FR-34** Bulk actions: edit a field, assign, add or remove tags, follow, delete to trash, restore, export, print, run a
  bulk form action, start a flow, perform a workflow transition, apply an assignment rule, and actions plugins declare;
  each offered only with its permission and when its plugin is loaded.
- **FR-35** The system applies bulk work per record atomically, reports done, refused (with reason) or failed per record,
  and undoes field edits within 10 minutes for records nobody changed since.
- **FR-36** Inline edit in list, table and board writes editable fields with the form's validation, permissions and a
  version check, errors shown in place; pasting a block of up to 500 cells applies as a bulk edit with per-cell results.
- **FR-37** Export writes the view's visible columns for all matching or selected records as CSV or XLSX, streamed, up to
  50,000 rows; larger or templated exports go to data import and export.
- **FR-38** Print of a selection uses print templates when they are loaded.
- **FR-39** Every registered record type can carry tags (types with their own tags keep them), filtered and counted in
  lists.

### 3.8 Record page shell

- **FR-40** The record timeline merges into one stream, contributed by their plugins: comments, field changes, notes,
  assignments, reminders, automation runs and milestones, workflow events, emails, calls, meetings, files and
  recognitions, and the chat messages carrying the record's card where `FEATURE_CHAT_RECORD_CARDS` of
  `chat-agents-and-record-actions` is on; filters by kind, newest or oldest first per user, absolute or relative times, cursor paging.
- **FR-41** A person can add a note to a record, visible to its readers or private to them, pin notes on top, and edit
  or delete their own; a note is a comment of the record marked as a note, so mentions, reactions and search treat both
  alike.
- **FR-42** The comment and note composer uses the platform's rich-text editor (formatting, lists, tables, code, images,
  emoji, mentions); the mention list offers people who can read the record and warns for others.
- **FR-43** The record sidebar shows assignees and assignments, followers and a follow toggle, tags, favourite, reminders,
  the platform's public share link, attachments when files are loaded, and who is viewing now. `(advanced)`
- **FR-44** The record page offers next and previous record within the list the user came from.
- **FR-45** Hovering or focusing a record reference, mention, avatar or card shows a card with title, image, status, up to
  six fields chosen per type and actions (open, copy link, follow); people cards add role, team, presence and local time;
  cards respect permissions.
- **FR-46** Quick entry creates a record of any type from the palette, a list, a reference picker or a shortcut, using the
  quick-entry layout of custom fields when loaded or else the type's required fields, and opens or selects the record.
- **FR-47** Unsaved form and inline edits are guarded on leaving, and a form offers undo and redo of unsaved edits.
- **FR-72** A record link ties one record to another record of any registered type, with a role (primary or related)
  and who made it (a person, the system, a match, an intake); every feature that links records (emails and messages,
  calls, tickets, deals and their documents, tasks raised from a record) writes record links, and the record page shows
  a record's links in both directions, each only to people who may view the other record; the existing resource link
  lists of tasks and projects keep showing only the web links they show today.

### 3.9 Command palette and global search

- **FR-48** The palette opens from anywhere with a shortcut (default mod+K): go to pages and settings, find records,
  create records, run commands on the current record (assign, assign to me, follow, comment, remind, run a form action,
  start a flow, copy link or id, go to a tab), switch organization, and evaluate a calculation. The existing Quick
  Actions dialog keeps its shortcut, customization and behaviour; a key a person already bound to a quick action keeps
  that action, and the palette then takes another shortcut the person can rebind.
- **FR-49** An empty palette shows recent records (last 20, shared across devices), pinned views and what is coming up in
  7 days (assignments, reminders, tasks due; overdue ones first, up to three days back).
- **FR-50** Plugins add palette commands and server suggestions; commands show only with permission and plugin loaded;
  the existing quick actions appear as commands with their shortcuts.
- **FR-51** The search page shows results grouped by record type with counts, facets (type, organization, owner, date,
  tags), relevance or date order, highlighted snippets and keyboard navigation; a search can be saved as a view.
- **FR-52** Full-text search covers search fields and searchable custom fields of every registered type, comments, notes,
  emails linked to records, chat messages, documents and file text for tenants with the feature on (with it off the
  index and the search results cover what they cover today); a hit inside a comment, note or email shows its record and
  a snippet; quoted earlier replies are left out of email text.
- **FR-53** Every hit is re-read under the reader's rights; hits on records they may no longer read are dropped.
- **FR-54** Search finds references and numbers exactly first (task keys, document numbers), then prefix matches, then
  words with one typo for words of five letters or more.
- **FR-55** A user with `SEARCH_INDEX_DEFINITIONS_EDIT` chooses per type whether it is searched and its field weights,
  and sees index status and rebuild progress.
- **FR-56** The palette answers within 150 ms P95 for pages, commands and recents and shows records as they arrive.

### 3.10 Keyboard, history, preferences and phones

- **FR-57** Global shortcuts open the palette, search and the shortcut help, create, save, edit, go to next or previous
  record, and move and select in lists; help lists every shortcut including plugins'; each is rebindable per user with
  conflicts refused, stored with the user and applied on every device.
- **FR-58** The system records the records a user opens and shows the last 200 in recents and the palette; no earlier
  visit is deleted.
- **FR-59** Each user chooses timeline order and time format, list density, the group sidebar, the bulk toolbar, the
  layout switcher and a landing view per type.
- **FR-60** On phones a list shows cards with the first fields, two swipe actions and filters in a sheet.

### 3.11 Advanced capabilities

- **FR-61** A user can type a filter in plain language; the assistant, given only the type's field catalogue and the
  user's own references (me, my teams), returns a filter shown as editable chips with an explanation; nothing is applied
  until accepted, and it can be saved as a view. `(advanced)`
- **FR-62** Records of an open list, board or calendar that others create, change or delete update in place within 2 s,
  highlighted; a row the user is editing is not overwritten (a notice offers the new value). `(advanced)`
- **FR-63** A record shows who is viewing or editing it now, and warns before saving a field someone else changed in
  the meantime; presence is not stored. `(advanced)`
- **FR-64** Meaning-based search finds records, documents, messages, comments, notes and emails by meaning as well as
  words, ranked together with keyword hits, through the tenant's AI provider and the platform's one embedding pipeline
  (the one documents use); every hit passes FR-53. `(advanced)`
- **FR-65** A view can be pinned to one of the platform's custom dashboards as a list card or a count tile for its
  audience. `(advanced)`
- **FR-66** In the installable web app, pinned views marked for offline keep their last 500 records readable offline
  with an "as of" time; offline edits queue and apply on reconnect with version checks, and conflicts are listed; types
  marked sensitive are never kept offline. `(advanced)`
- **FR-67** Other engines take a saved view as their selection: automation schedules, digest counts, exports, report
  definitions and document bulk creation. `(advanced)`

### 3.12 API, MCP, events and reports

- **FR-68** The system exposes views, record queries, groups, aggregates, bulk work, export, timeline, notes, cards,
  recents, palette suggestions and plain-language filters through REST, with GraphQL for reads.
- **FR-69** MCP tools list and run views, create a view from text (preview), search everything, read a record's timeline
  and card, and bulk-update with a preview, under the caller's permissions.
- **FR-70** The system publishes events for views (created, updated, shared, deleted), notes and finished bulk work, for
  webhooks, real-time updates and automations.
- **FR-71** The system registers these report definitions in the Reports menu of tenants with the feature on (with it
  off, the Reports page and menu show exactly today's reports):

  | Report | Answers |
  |---|---|
  | View usage | views per type, opens per period, shared and pinned views, unused views |
  | Search quality | top queries, queries without results, clicked positions, slow queries |
  | Bulk work | bulk runs per action and type with done, refused and failed counts |

## 4. Non-Functional Requirements

- **Performance**: a 50-row page with counts under 300 ms P95 at one million records per type and tenant (PostgreSQL,
  MySQL); group counts under 500 ms; board columns of 50 cards under 400 ms; keyword search under 200 ms P95 at five
  million index documents; meaning-based search under 800 ms; live updates within 2 s; bulk 500 records under 10 s.
- **Volume**: 1,000 views per type and tenant; 200 recents per user; timeline pages of 50 merged from every source.
- **Reliability**: view saves version-checked; bulk work per record atomic and resumable; the search index is a
  rebuildable projection; offline queues survive app restarts.
- **Security & privacy**: every query runs under the reader's record rules and field masks; shared views never widen
  access; plain-language filters send field names, not record data, to the AI provider; meaning-based search sends
  indexed text to the tenant's own provider only when enabled; offline caches are per user, cleared on sign-out.
- **Observability**: activity entries for view sharing and bulk work; metrics for query time, cache hits, index lag and
  search without results.
- **Accessibility and localization**: every layout operable by keyboard (moving cards and events included), announced
  by screen readers; labels per language; dates, numbers and money in the user's formats.
- **Compatibility**: PostgreSQL, MySQL, SQLite (meaning-based search needs a vector store, else keyword only); both ORMs;
  cloud and self-hosted; OpenAPI additive; SDKs regenerated.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| Saved view | A named list configuration of one record type: layout, filter, sort, grouping, columns, aggregates |
| View share, view pin | Who may read or edit a view; where it appears (sidebar, dashboard) |
| View type settings | Per record type: quick filters, card and hover fields, allowed layouts, live updates |
| Manual order | A view's own order of records for list and board |
| Record timeline entry | One dated item of a record's history contributed by a plugin |
| Record note | A comment of a record marked as a note, shared with its readers or private |
| Record visit | A user's opening of a record, for recents |
| Palette command | An action reachable from the palette with its shortcut |
| Search document, search embedding | The keyword projection of a record or text; its meaning vector |
| Offline set | The records of a pinned view kept on a device |

## 6. Out of Scope

- Field definitions, form layouts, quick-entry layouts, the related-records panel: `custom-fields-and-forms`.
- Report definitions, the report builder, dashboards and home pages built from cards: `report-builder-and-dashboards`.
- Large and templated imports and exports: `data-import-export`; print templates: `print-and-pdf-designer`.
- Mail views and threads on records: `email-and-communications`; file browser: `drive`.
- External calendar sync: `calendar-and-scheduling`.
- Guided tours, onboarding checklists and the app switcher: `platform-administration`.
- Workflow states themselves: `approval-workflows`; flows started from views: `automation-and-notifications`.

## 7. Acceptance Criteria

- [ ] **AC-1** Contacts, deals, invoices and tasks offer saved-view lists beside their existing tables, which stay the
      default until the organization's per-type setting or the person's own choice changes it; a shared, pinned view
      reaches a team member (FR-6, FR-7).
- [ ] **AC-2** Filters, quick filters, multi-sort, grouping with counts, columns and aggregates round-trip and reopen from a
      link; invalid conditions are flagged (FR-16, FR-17, FR-19, FR-23).
- [ ] **AC-3** Board drag, calendar drag and timeline drag write through the record's rules and revert on refusal; tree
      cycles are refused (FR-26, FR-27).
- [ ] **AC-4** Bulk work over 700 records reports per record and undoes; inline edit and cell paste respect versions (FR-33, FR-35, FR-36).
- [ ] **AC-5** Export of a filtered view matches the screen's columns and rows (FR-37).
- [ ] **AC-6** The timeline merges comments, changes, notes and runs; private notes stay private (FR-40, FR-41).
- [ ] **AC-7** The palette finds records, creates through quick entry and runs record commands; shortcuts rebind across
      devices (FR-46, FR-48, FR-50).
- [ ] **AC-8** The search page finds text inside comments and emails with parent records and never shows unreadable
      records (FR-52).
- [ ] **AC-9** A plain-language filter becomes editable chips and a saved view (advanced: language filters; FR-61).
- [ ] **AC-10** A card moved by one user moves on another's board within 2 s; viewers show on the record (advanced:
      live) (FR-62, FR-63).
- [ ] **AC-11** Meaning-based search returns a document for a query sharing no word with it, permission-filtered (advanced:
      semantic search) (FR-64).
- [ ] **AC-12** A view shared with a role and pinned to a dashboard shows per reader (advanced: sharing; FR-11, FR-65).
- [ ] **AC-13** A pinned view reads offline and replays queued edits with conflicts listed (advanced: offline; FR-66).
- [ ] **AC-14** The three reports of FR-71 return correct figures on seeded data.
- [ ] **AC-15** Feature off: `404` on new routes; task views, task bulk actions, shortcuts and search behave as before (FR-1–FR-3).
- [ ] **AC-16** Feature on, with no setting changed: every adopted page opens its existing table, board and actions; the
      Quick Actions dialog and a person's quick-action shortcuts work as before; search permission holders are the
      same as before; no recent visit is deleted; existing resource link lists show the same links (FR-6).
- [ ] **AC-17** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-1, FR-3).
- [ ] Works on PostgreSQL, MySQL and SQLite with both ORMs; all functional requirements have a passing test.

## 8. Open Questions

- Every saved view is stored in the task view model, extended with a record type and layout; task views keep their
  columns and routes (FR-2). Default applied.
- Map tiles come from a service the deployment configures; none is called by default. Default applied.
- Offline is limited to pinned views marked by the user, 500 records each. Default applied.
- Meaning-based search uses a vector store where the database offers one; elsewhere keyword search only. Default applied.

## 9. Constitution Gates

- [x] I Plugin-first — new plugin pair `record-views`; extends `search` and `task-views-ui`; core gets a record writer
      contract, a widened record type check and additive columns on task views, comments and recent visits.
- [x] II Tenant/organization scoping — views, shares, notes, visits and embeddings carry tenant and organization.
- [x] III Both ORMs, additive migrations — new tables and additive columns on three dialects; task view routes unchanged.
- [x] IV Default-off flag; nothing removed — deploy switch plus `FEATURE_RECORD_VIEWS`; existing lists stay.
- [x] V Contracts and API first — query protocol, REST, GraphQL reads, SDK regeneration before UI.
- [x] VI Permissions, privacy, security — reader rights on every query, sharing permission, minimal AI payloads.
- [x] VII Real-time through the event bus — live lists and presence over the platform's real-time channel.
- [x] VIII i18n and accessibility — keyboard-operable layouts, labels per language.
- [x] IX Tests accompany the change — per requirement, with dialect and ORM parity specs.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Builds on: [`task-views-and-bulk-actions`](../task-views-and-bulk-actions/spec.md),
  [`realtime-channel`](../realtime-channel/spec.md), [`comments-and-trash`](../comments-and-trash/plan.md)
- Works with: [`custom-fields-and-forms`](../custom-fields-and-forms/spec.md),
  [`automation-and-notifications`](../automation-and-notifications/spec.md),
  [`approval-workflows`](../approval-workflows/spec.md)
- Code: `packages/core/src/lib/tasks/views/`, `packages/plugins/task-views-ui`, `packages/plugins/search`,
  `packages/core/src/lib/api/` (query protocol), `packages/ui-core/shared/src/lib/record-view/`
