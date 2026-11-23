# Feature Specification: Documents and wiki (pages, wiki spaces, review, publishing)

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `documents-and-wiki`
**Branch**: `feat/documents-and-wiki`
**Status**: `Draft`
**Created**: 2026-11-16
**Last updated**: 2026-11-23
**Owner**: platform maintainers
**Feature flag**: `FEATURE_WIKI` (tenant feature, default off; requires `FEATURE_DOCUMENTS` and `FEATURE_DRIVE`, whose one tree, inherited access, owners, versions and visit write wiki spaces build on). Publication to public sites also needs the tenant sub-feature `FEATURE_WIKI_PUBLIC` and the deployment switch `GAUZY_DOCS_PUBLIC_SITES_ENABLED` (off unless exactly `true`), which together turn on the public read feed. Co-editing, import and PDF export keep their existing switches (`GAUZY_DOCS_COLLAB_ENABLED`, `GAUZY_DOCS_LIVE_ENABLED`, `GAUZY_DOCS_IMPORT_ENABLED`, `GAUZY_DOCS_PDF_EXPORT_ENABLED`).

---

## 1. Overview

Pages already live in the Documents hub next to files and folders: a block editor with headings, lists, task lists, quotes, code, tables, images, attachments, video, embed cards, callouts, toggles, emoji, maths, mentions of people and links to pages; autosave with conflict detection, versions with restore, comments (anchored to text where collaboration is on), follow and mute, organization, team and private spaces, live co-editing that also merges server-side writes, Markdown export and block-preserving Markdown update, import of exported workspaces, PDF export, a review step and AI knowledge with cited retrieval. This feature completes pages as a **document writer** and turns those spaces into a **wiki**, for the Angular app, Ever Teams (same API; its screens are the Ever Teams spec `workspace-collaboration-clients`), the MCP server and the SDKs: richer formatting and blocks (diagrams, tabs, page layout), **suggestions** (tracked changes), version **comparison** and named versions, **templates**, office-format import and export, **wiki properties on the existing spaces** (name, address, icon, home page, roles, review rules), readable addresses, **proposed edits** reviewed and merged block by block, **publication** of a space to a public site built with Ever Works through a public read feed, page feedback and reading figures, and sync of a space from a source repository. Pages, files and folders stay one tree, one sharing model and one versions model with `drive`, and the organization, team and private spaces stay the only spaces: drive owns files and folders, this spec owns pages and the wiki properties of spaces. Help articles for customers are pages of a help space of the same hub.

**Advanced capabilities.** AI writing help and every edit through the new agent tools arrive as **suggestions or proposals**, marked with the agent and the person it acts for (today's direct page tool keeps writing only where that person is an editor and the space requires no review); pages have **owners and review-by dates**, go **stale** visibly and can be **verified**, and search and cited answers prefer verified pages; pages carry **structured properties** and a page can **list its sub-pages as a table, board or calendar**; **decision and meeting-note templates turn action items into tasks** that tick back when done; followers get **change summaries per space** in their Inbox; and reading figures report the **in-app searches that found nothing** so writers know what to document next.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** a writer on a page, **when** they switch to suggestion mode and rewrite a paragraph, **then** the insertion and deletion show highlighted with their name, the page owner gets an inbox item, and accepting it applies the text for everyone editing live.
- **Given** a page with twelve versions, **when** a reader compares version 4 with the current page, **then** they see changed blocks side by side with word-level marks, can switch to inline, and can restore one paragraph from version 4.
- **Given** a team lead who saves "Weekly sync" as a space template with sub-pages, **when** a member chooses New → From template, **then** the page and its sub-pages are created with today's date and the member's name filled in.
- **Given** decision notes with "☐ @Ana send the offer by Friday", **when** the author chooses Create tasks, **then** a task assigned to Ana due Friday exists in the chosen project, the item shows the task chip, and the box ticks when Ana completes the task. `(advanced)`
- **Given** a DOCX handbook uploaded to the drive, **when** someone chooses Convert to page, **then** an editable page with its headings, lists, tables and images appears beside it and the file stays.
- **Given** a manager who opens the Engineering team's space, names it "Engineering handbook" with the slug `handbook`, keeps the team's members as editors and adds two reviewers, **then** the space shows under that name, icon and colour in the space list of every member who may read it, and no page of it moved or changed.
- **Given** a reader with contributor role, **when** they edit two pages and add a new one, **then** nothing changes for others until they submit the proposal; reviewers see the three pages as differences, approve, and the merge creates versions that link to the proposal.
- **Given** a proposal started before a colleague changed the same page, **when** the reviewer merges, **then** changes to different blocks are combined and the one block changed by both is offered with both versions to choose from.
- **Given** a space published to its public site, **when** the site asks the public read feed for `handbook/onboarding/first-week`, **then** it receives the page's content, its table of contents, the space's navigation tree and the previous and next pages, and a visitor's rating and PDF download go through the feed's own routes.
- **Given** a page renamed from "Laptop setup" to "Workstation setup", **when** someone opens the old address in the app, or a site asks the feed for it, **then** they are pointed to the new one.
- **Given** a page whose owner set a 90-day review interval, **when** the date passes, **then** the owner gets an inbox item, readers see "This page may be out of date", and after the owner verifies it the page shows "Verified by Ana until 14 Feb". `(advanced)`
- **Given** a "Vendors" page whose sub-pages carry the properties contract end and owner, **when** it is shown as a board grouped by status, **then** each sub-page is a card and dragging a card changes its property. `(advanced)`
- **Given** an agent asked to "tighten the onboarding page", **when** it acts, **then** its changes appear as suggestions marked "by Assistant for Ben", and nothing changes until Ben or an editor accepts. `(advanced)`
- **Given** a person who follows the space "Sales playbook" and chose the weekly summary in their Inbox notification settings, **when** Monday comes, **then** their Inbox (and their e-mail digest, if they get one) holds one summary naming the pages created and changed last week, with a short summary of each change and the proposals merged. `(advanced)`
- **Given** a space synced from a folder of a source repository, **when** a commit changes two Markdown files, **then** the two pages update after the push notification, the sync history lists the run, and editing in the app shows "This space is maintained in a repository".
- **Given** a space's reading figures for 30 days, **when** a manager opens them, **then** they see reads, readers, top pages, feedback and the in-app searches with no result, each against the previous 30 days. `(advanced)`

### 2.2 Edge cases & failures

- **Given** two reviewers who approve and merge one proposal at the same moment, **when** both requests arrive, **then** one merge happens and the other answers that the proposal is already merged.
- **Given** a proposal whose page was deleted meanwhile, **when** it is merged, **then** that page's change is listed as a conflict ("page no longer exists") and the rest merges.
- **Given** a suggestion on text another person then deleted, **when** the page is read, **then** the suggestion is listed as orphaned with its text and can only be dismissed.
- **Given** a reader without access to a linked page, **when** they open a page linking to it, **then** the link shows as plain text, not the target's title.
- **Given** a published space with one unpublished page, **when** the feed is asked for that page's address, **then** it answers "not found", the same as for a page that never existed.
- **Given** a feedback spammer, **when** an address rates more than 10 pages within an hour, **then** further ratings are refused quietly and not counted.
- **Given** the same slug requested for two pages of a space, **when** the second is saved, **then** it is refused with a suggestion ("first-week-2").
- **Given** a repository sync whose Markdown has a script tag or an image larger than the upload limit, **when** it runs, **then** the script never reaches the page, the image is skipped with a reason in the run report, and the rest syncs.
- **Given** an office file with an unsupported construct (a macro, an embedded spreadsheet), **when** it is converted, **then** the construct is left out and the result lists what was not converted.
- **Given** the browser closed with unsaved edits in single-writer mode, **when** the page is reopened within 7 days, **then** the editor offers the unsaved edits back, and if the page changed meanwhile, offers them as a copy or merges blocks nobody else touched.
- **Given** a tenant that switches `FEATURE_WIKI` off, **when** members open Docs, **then** pages, spaces, comments and versions work as before; spaces show without their wiki properties; the public read feed answers "not found"; proposals, suggestions, templates and space properties stay stored for when it is switched on again.
- **Given** a user without the space manager role, **when** they try to publish or change space settings, **then** they are refused with `403`.

## 3. Functional Requirements

### 3.1 Scope, flags and the one tree

- **FR-1** The system keeps every page as a row of the one documents tree shared with `drive`, and every wiki space is one of the existing spaces (the organization's, a team's or a person's private one) with added properties; there is no second page store, kind of space, share model or version history.
- **FR-2** The system answers `404 WIKI_DISABLED` on every route this spec adds while `FEATURE_WIKI` is off, or while `FEATURE_DRIVE` it builds on is off, and leaves the Documents hub as today: the editor then offers only today's blocks, controls and menus, so no page gains content that today's editors and clients cannot save.
- **FR-3** The system serves the public read feed only when `GAUZY_DOCS_PUBLIC_SITES_ENABLED` is exactly `true` and the tenant has `FEATURE_WIKI_PUBLIC`.
- **FR-4** The system keeps every existing Docs endpoint, field, permission, route, editor block and the stored page format working unchanged; Ever Teams can build its pages on the same API.

### 3.2 Writing

- **FR-5** The editor offers headings of four levels, an insertable table of contents block kept up to date, and keeps today's blocks, slash menu, Markdown shortcuts, bubble and table menus, outline panel, lock and full width.
- **FR-6** The editor offers controls for font family (from an organization list), size, text colour, highlight and alignment, clear formatting, and a format painter that copies the marks of a selection onto other text.
- **FR-7** A writer can set line height and space above and below per paragraph, with defaults per page and per organization.
- **FR-8** Images carry a caption, alternative text, alignment, width and an optional image for the dark theme; PDF files show as an inline viewer block with download.
- **FR-9** The new framed embeds accept only addresses of hosts on the organization's embed list (a default list ships), convert a host's share address to its embed address where the host offers one, and render in a sandbox; other addresses become link cards, as every embed card is today; today's video block keeps accepting every address it accepts today, whatever the list holds.
- **FR-10** The editor offers a diagram block written in a text diagram syntax (flowchart, sequence, class, state, entity relation, gantt, pie, timeline, mind map) with live preview in light and dark themes; exports and prints show the rendered diagram.
- **FR-11** A writer can split a page into named tabs, reorder them, link to a tab and export the current tab or all tabs.
- **FR-12** A writer can insert page breaks and set, for print and PDF, page size, orientation, margins, header and footer text and page numbers.

### 3.3 Co-editing and drafts

- **FR-13** In a wiki space with live co-editing switched on, pages open live by default with presence and cursors; people reaching a page through a public link or a public site never edit.
- **FR-14** The editor keeps unsaved edits in the browser for 7 days and offers them back after a reload; when the page changed meanwhile it merges blocks only the writer touched and offers the rest as a copy.

### 3.4 Comments, mentions and suggestions

- **FR-15** The comments panel filters open, resolved and orphaned threads (their text deleted), jumps to a thread's text, and hides resolved threads by default.
- **FR-16** A mention of a team in a page or comment notifies its members once (per the Inbox dedupe), as a mention of a person does today.
- **FR-17** A person with comment level or more can switch to suggestion mode: their insertions, deletions and format changes become suggestions marked with author and time, shown highlighted to everyone.
- **FR-18** A person with edit level can accept or reject a suggestion, all suggestions of an author or all of the page; accepting applies the change as a server-side write that reaches live editors at once; each suggestion can carry a comment thread.
- **FR-19** The suggestions panel lists open and decided suggestions with filters by author and state; the author is told of each decision through the inbox.
- **FR-20** A page or space can require suggestions from everyone except its editors; the editor then opens in suggestion mode for others.

### 3.5 Versions and history

- **FR-21** A writer can name a version when saving it now or later; named versions are kept by pruning; the list filters automatic and named versions.
- **FR-22** A reader can compare a version with the current page or two versions, side by side or inline, with word-level changes per block and a "changes only" switch.
- **FR-23** A person with edit level can restore a whole version (as today) or a single block of it.
- **FR-24** Each version records its origin: editor save, live session, API or Markdown write, restore, accepted suggestion, merged proposal (linked), repository sync (with the source revision) or agent.
- **FR-25** A space shows its history: changes grouped by day with page, author and origin, filterable by page and author.

### 3.6 Templates

- **FR-26** A person with edit level can make a page a template for themselves, a space or the organization (`WIKI_TEMPLATE_MANAGE` for the organization); the gallery lists readable templates with search, category and preview; workbooks and decks are marked as templates and listed the same way, by kind.
- **FR-27** New from template copies the template and its sub-pages, fills variables (date, author, space, a title asked at creation) and remembers the template.
- **FR-28** A writer can insert a template into the current page from the slash menu or a shortcut set on the template.
- **FR-29** A space can set default templates for new pages; built-in starter templates ship for meeting notes, decision record, how-to, project brief, retrospective and runbook, in every shipped language.
- **FR-30** Task list items with a person mention and a date in any page can be turned into platform tasks in a chosen project, linked both ways; the item ticks when its task is done and unticking reopens nothing. `(advanced)`
- **FR-31** A meeting-notes page started from a meeting or calendar event is pre-filled with its title, time, attendees and agenda through the meetings feature when loaded, and is linked to it. `(advanced)`

### 3.7 Import and export

- **FR-32** A reader can export a page or a page with its sub-pages as DOCX and HTML, and as ODT where the deployment configured a document conversion service, alongside today's Markdown and PDF; PDF follows the page layout of FR-12.
- **FR-33** A person with `DOCS_CREATE` can import DOCX files (and ODT with the conversion service) as pages (headings, lists, tables, images, links, footnotes as text) and convert such a file of the drive into a page beside it; what could not be converted is listed.
- **FR-34** A Markdown file in the drive previews rendered, with its front matter as page properties and its double-bracket links resolved to pages and files of the space by name, and can be converted into a page; today's vault import keeps working.

### 3.8 Wiki spaces

- **FR-35** A user with `WIKI_SPACE_MANAGE` (or a manager of the team, for its team space) can give the organization space or a team space wiki properties: a display name, a slug unique in the organization, an icon or logo, a colour, a description, a home page, member roles (reader, contributor, editor, reviewer, manager) for people and teams, and the default role of the space's own members; a group without a team gets a space by creating its team; a person's private space can take a name, icon, colour and home page.
- **FR-36** The system grants space roles as shares on the space itself, in the one sharing model of pages and folders (reader view, contributor comment and propose, editor edit, reviewer edit and approve, manager manage), applied to every page and file of the space through drive's inherited access with the space at the top, so search and AI retrieval apply unchanged; a team's members are editors and its managers space managers unless the space sets another default, the organization space keeps today's access until a manager sets a default role, and a page inside a space can still be restricted.
- **FR-37** The space list the Documents hub already shows (the organization's, each team's and the person's private space) shows each space with its name, icon and colour, in the organization's order and the person's own pins; space managers set whether a space is listed; the platform's command palette finds readable spaces and pages by title and text.
- **FR-38** Giving a space wiki properties, or removing them, changes no page: ids, addresses, links, shares, comments and history stay as they are, and a team space's pages need no conversion or move.
- **FR-39** The space sidebar shows the page tree with drag-and-drop order (today's), section headings (folders) and external link entries (drive link items).
- **FR-40** A space manager can archive a space (read-only, out of the space list) and restore it; archiving a space archives neither its pages nor its team.

### 3.9 Addresses and links

- **FR-41** Each page of a wiki space gets an address made from its title, unique in the space, kept when the title changes unless an editor changes it; an old address redirects to the current one after a rename or move.
- **FR-42** Typing `[[` searches readable pages of every space and offers to create a missing page; page links keep working across moves and renames (today's mentions) and render as plain text for readers who cannot open the target.
- **FR-43** The backlinks panel lists the pages linking to the page and the page's broken links.

### 3.10 Proposed edits and review

- **FR-44** A contributor, or any member of a space that accepts contributions, can propose changes: edits of several pages, new pages, moves, renames and deletions gather in one proposal with a title and description, visible only to its author until submitted.
- **FR-45** Submitting names reviewers (default: the space's reviewers), refuses an empty proposal and sends inbox items; the author can withdraw it, or edit and submit again after a reviewer returned it; a proposal is a draft, pending review, returned, approved, merged, rejected or withdrawn (the review words the platform already uses).
- **FR-46** A reviewer sees each proposed page side by side or inline with "changes only", can comment on a block, approve, return it to the author or reject it (returning and rejecting need a comment).
- **FR-47** Merging applies the proposal as is when its pages are unchanged since it started; otherwise it combines changes to different blocks and lists each block changed on both sides for the reviewer to keep one or the other; moves and deletions need a space manager; merging creates versions linked to the proposal and reaches live editors at once.
- **FR-48** A space can let every signed-in reader propose; readers of a public site are asked to sign in first.
- **FR-49** One review queue shows document reviews (today's) and proposals, split into what I submitted, what waits for my decision and, for space managers, everything open in their spaces, filterable by state and space.
- **FR-50** A space synced from a repository refuses proposals and edits with a notice naming the repository.

### 3.11 Page settings, freshness and structure

- **FR-51** Page settings hold title, address, icon, cover image, summary, search-engine title, description and image, an exclusion from search engines, and show word count, reading time and last editor; in a space that requires review, these changes go through proposals.
- **FR-52** Each page has an owner (default its creator) and an optional review interval; when the date passes the owner gets an inbox item and readers see "may be out of date". `(advanced)`
- **FR-53** An owner or editor can verify a page until its next review date; verified pages show who verified and until when, and search results and cited answers rank verified pages first and mark stale ones. `(advanced)`
- **FR-54** A space or a parent page can define page properties (text, number, date, person, choice, link to a record) shown at the top of its pages, filterable and sortable in search. `(advanced)`
- **FR-55** A page can show its sub-pages as a table, board, calendar or gallery by their properties, with inline editing and "new" creating a sub-page. `(advanced)`

### 3.12 Publication and the public read feed

- **FR-56** A user with `WIKI_PUBLISH` can publish a wiki space, all pages or chosen ones (each page's public flag); unpublished pages are never served; publishing and unpublishing are recorded and reversible.
- **FR-57** The public read feed gives, for a published space, its navigation tree (order, section headings, previous and next) and, for each published page, its sanitised content, table of contents, title, summary, cover and search-engine fields, so the space's public site, built with Ever Works, renders it; the platform renders no public page, theme or menu.
- **FR-58** A space records the public address of the site that renders it, so the app offers "View on site" and copies a page's public address; the site's domain and its certificate belong to the site.
- **FR-59** The feed lists the published pages changed, unpublished or removed since a given time, so a site keeps its copy and its own search current; search of a public site is the site's.
- **FR-60** Readers of a site can download a page as PDF through the feed when the space allows it.
- **FR-61** Each published page is also served as Markdown (by suffix or by the Markdown media type), under the same publication rules; site maps and indexes for crawlers are built by the site from the feed.
- **FR-62** The feed gives each page's own preview image (its search-engine image or cover) when one is set; generated preview cards are the site's.
- **FR-63** A space manager sets what the feed offers and how it shows people: PDF downloads, ratings, the contents panel, and whether names of people are shown; the site's look (logo placement, colours, styles, header links, scripts) is set on the site.
- **FR-64** The feed never returns comments, suggestions, proposals, history or links to unpublished pages; mentions of people come as names without a link, or are left out when the space says so.
- **FR-65** A published change (merge, publish, edit of a published page) is in the feed within 30 seconds, and a publication event reaches webhooks and the Ever Works integration so the site refreshes.

### 3.13 Feedback and reading figures

- **FR-66** Site readers (through the feed's rating route) and members can rate a page helpful, partly or not helpful with an optional comment, once per page per day per reader; more than 10 ratings per network address per hour are dropped.
- **FR-67** Page owners and space managers see feedback in the app, filter it by page, rating and state, and close it with a note; a "not helpful" with a comment creates an inbox item for the page owner.
- **FR-68** The system counts reads per page and space per day from members' visits, and site reads only where a feature posts them through a read route of its own; it keeps no visitor identity, referrer or site search log (visitor analytics of a site are the site's); it counts the in-app searches made within a space with and without results.
- **FR-69** Space managers see, for a quick range (this week, this month, this quarter, the last 12 months) or any range up to 24 months, reads and readers over time by day, week or month, the most read and least helpful pages, the in-app searches that found nothing and the trend against the preceding range, for a space or one page. `(advanced)`

### 3.14 Repository sync

- **FR-70** A user with `WIKI_SPACE_MANAGE` can connect a space to a folder of a branch of a source repository reached through a connected integration; Markdown files become pages, folders sections, index files their section's content, front matter title, order and address are honoured and images are imported.
- **FR-71** A sync runs on the repository's push notification or on "sync now", creates no version when a file did not change, moves pages whose file was deleted to the trash, keeps a history of the last 50 runs with counts and errors, and leaves pages outside the synced folder alone.

### 3.15 AI and agents

- **FR-72** With an AI provider, the editor offers drafting from a prompt, continuing, summarising, shortening, changing tone, translating, fixing spelling and explaining a selection; results arrive as suggestions. `(advanced)`
- **FR-73** Agents (MCP tools and the in-app assistant) change pages only as suggestions, or as proposals in spaces that require review; each is marked with the agent and the person it acts for; a direct write is offered only where that person is an editor and the space requires no review. `(advanced)`
- **FR-74** A reader can ask a question of a page or a space in the platform's assistant chat, opened already limited to that page or space, and get an answer with citations limited to pages they may read, verified pages preferred; "copy as Markdown" keeps working. `(advanced)`
- **FR-75** The MCP server offers: list spaces, list templates, create from template, suggest an edit, propose a change, list proposals and their differences, comment on a page, verify a page, and search a space for cited passages (the existing search tool with a space scope), beside today's page tools; publishing is not offered to agents. `(advanced)`

### 3.16 Notifications, summaries and events

- **FR-76** The system sends inbox entries for: a proposal submitted to me, a decision on my proposal, a suggestion on my page, a decision on my suggestion, my page due for review, feedback on my page and a failed sync; today's share, mention, comment and review entries stay.
- **FR-77** Followers of a space get a daily or weekly summary of pages created and changed (with a one-line summary of each change, written by the AI provider where one exists), proposals merged and pages gone stale, as one Inbox item per period; they choose daily or weekly, and whether it also reaches their e-mail digest, in their Inbox notification settings. `(advanced)`
- **FR-78** Trees, proposals, suggestion panels and the review queue update live through the platform's real-time channel.
- **FR-79** The system appends page and wiki facts to the event outbox (page published or unpublished, proposal submitted, merged or rejected, suggestion decided, page stale, feedback received, sync finished) for automations and webhooks.

### 3.17 Quality, print and reports

- **FR-80** The system reports broken links: links to missing, trashed or unreadable pages and files, and, checked weekly through the platform's outbound safety check, outside addresses that answer with an error.
- **FR-81** A reader can print a page with the space name, breadcrumb, title, last updated date and the page's header and footer.
- **FR-82** The system registers report definitions: space health (reading trend, most read and least helpful pages, in-app searches that found nothing, proposals waiting and how long, pages gone stale), space and page reading, feedback list, review queue, broken links and stale pages by owner.

## 4. Non-Functional Requirements

- **Performance**: a feed page answers P95 < 200 ms when cached and < 800 ms otherwise; the feed's change list answers P95 < 300 ms at 50,000 published pages; a comparison of two versions of a 2,000-block page renders in < 1 s; a merge of a 20-page proposal completes in < 3 s; suggestion accept reaches live editors in < 300 ms.
- **Data volume**: 1 million pages and 10 million versions per tenant; 5,000 pages per space; reading figures kept as daily aggregates for 25 months.
- **Concurrency**: merges and suggestion decisions take the page's revision lock; two merges of one proposal produce one result; live sessions keep the limits of today.
- **Reliability**: imports, conversions and syncs are resumable and idempotent; a failed merge changes nothing.
- **Security & privacy**: imported, converted, synced and pasted HTML is sanitised; embeds only from listed hosts, sandboxed; the public read feed serves only published pages and never names beyond what the space allows; feedback stores no personal data beyond an address hash; what leaves the platform: published pages to the sites and readers of the feed, page text to the configured AI provider for writing help, summaries and asking, office files to the conversion service when configured, repository reads through the connected integration.
- **Auditability**: publish, unpublish, space role changes, merges, suggestion decisions and verifications are in the page or space activity and the audit trail.
- **Accessibility and localization**: editor keyboard operable with labelled controls and visible focus; alternative text prompted for images; the feed's content keeps heading order; strings and starter templates in every shipped locale; right-to-left text renders correctly.
- **Compatibility**: PostgreSQL, MySQL and SQLite with both ORMs; cloud and self-hosted; the stored page format stays readable by today's editors (new blocks degrade to text in older clients).

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| `Document` (existing, kind page) | A page of the tree; gains owner, review interval, verification, template scope, address, public flag and properties |
| `DocumentVersion` (existing) | A page snapshot; gains a name, a pin and its origin |
| Space (existing) | The organization's space, a team's space or a person's private space, as the Documents hub lists them today |
| Space properties | The wiki properties of one existing space: display name, slug, look, home page, default role, review rules, publication and site address |
| Space role | A member's role in a space, held as a share on the space |
| `DocumentSuggestion` | One suggested change inside a page with its author, state and thread |
| `DocumentChangeRequest` | A proposal: several page changes submitted for review and merged together |
| `DocumentChangeRequestItem` | One proposed page change (edit, create, move, rename, delete) with its base revision |
| `DocumentRoute` | A page address of a space and its earlier addresses for redirects |
| Template | A page, workbook or deck offered as a starting point to a person, a space or the organization |
| `DocumentFeedback` | One rating of a page with an optional comment |
| Reading figures | Daily reads and readers per page and space, and in-app searches per space with and without results |
| `DocumentRepositorySync` | The link of a space to a repository folder, with its run history |
| Page property | A structured field on pages of a space or parent page |
| Action item link | The link between a task list item and the task made from it |

## 6. Out of Scope

- Files and folders as such (uploads, file versions, public links to files, trash, quotas): `drive`.
- Grids and slides: `spreadsheets`, `presentations` (they use the template marking and gallery of this spec).
- Help articles for customers are pages of an organization's one help space (an existing space of this hub marked as
  such, each page in its own language); the help audiences, the help read API, ticket deflection, help-specific figures and copying articles from the existing help centre, which keeps working with its pages and routes, are `helpdesk-portal-and-knowledge-base`'s.
- Public sites, their look, domains, site search, site maps, preview cards and visitor analytics: built with Ever Works from the public read feed; blog posts and website pages too (a page can be pushed to a linked Work).
- Recording, transcripts and summaries of meetings: `meetings` (they can write a notes page through this spec).
- Ever Teams page screens: the Ever Teams spec `workspace-collaboration-clients`.
- Field definitions and saved views as such: `custom-fields-and-forms`, `record-views-and-search` (pages use them).

## 7. Acceptance Criteria

- [ ] **AC-1** New formatting controls, diagram, tab, page break and page layout blocks save, reload, export to PDF and degrade to text in an older client (FR-5–FR-12).
- [ ] **AC-2** Unsaved edits survive a reload; a concurrent change merges untouched blocks (FR-14).
- [ ] **AC-3** Suggestion mode creates suggestions; accept and reject reach a second live editor; authors are told (FR-17–FR-20).
- [ ] **AC-4** Two versions compare side by side and inline; a single block restores (FR-22, FR-23).
- [ ] **AC-5** A template with sub-pages and variables creates pages; starter templates exist in every locale; the gallery lists workbook and deck templates by kind (FR-26–FR-29).
- [ ] **AC-6** Action items become tasks and tick back when the task is done (FR-30).
- [ ] **AC-7** DOCX import and export round-trip headings, lists, tables and images; ODT works with a conversion service and is hidden without one; the not-converted list is shown (FR-32, FR-33).
- [ ] **AC-8** A team space given wiki properties keeps every page, address and share; roles grant exactly the drive levels they map to; restricting a page hides it from inherited members; the space list shows one entry per space (FR-35–FR-38).
- [ ] **AC-9** A renamed page's old address redirects; `[[` creates a missing page; unreadable links render as text (FR-41, FR-42).
- [ ] **AC-10** A proposal of three pages is reviewed with differences, merged with one conflict resolved, and creates linked versions; a double merge yields one result (FR-44–FR-47).
- [ ] **AC-11** The review queue shows document reviews and proposals split by submitter, decider and space manager (FR-49).
- [ ] **AC-12** Stale pages notify owners and show the banner; verified pages rank first in search and cited answers (FR-52, FR-53).
- [ ] **AC-13** Page properties filter in search; a page shows its sub-pages as a board and edits a property by drag (FR-54, FR-55).
- [ ] **AC-14** The public read feed returns the navigation tree, page content, Markdown, PDF and the change list of a published space, and never returns an unpublished page on any route (FR-56–FR-64).
- [ ] **AC-15** A space's site address is stored and used for "View on site"; the platform has no public page rendering, domain or site search route (FR-58, FR-62, FR-63).
- [ ] **AC-16** Feedback is limited per address, listed in the app and notifies owners on "not helpful" with a comment (FR-66, FR-67).
- [ ] **AC-17** Reading figures show reads, readers, top pages and in-app searches that found nothing with their trend; no visitor identity or referrer is stored (FR-68, FR-69).
- [ ] **AC-18** A repository sync creates, updates and trashes pages idempotently and blocks edits in the app (FR-70, FR-71).
- [ ] **AC-19** AI writing help and an MCP agent edit through `docs_suggest_edit` or `docs_propose_change` produce suggestions or proposals only, marked with agent and person; today's `update_page_markdown` writes directly only where the person it acts for is an editor and the space requires no review, and in a space that requires review answers with the hint to use `docs_suggest_edit` (FR-72, FR-73).
- [ ] **AC-20** A weekly space summary reaches each follower once, in the Inbox and in their e-mail digest when they chose it (FR-77).
- [ ] **AC-21** A meeting-notes page started from a meeting is pre-filled and linked to it; asking a space answers with citations to readable pages only, verified pages first (FR-31, FR-74).
- [ ] **AC-22** The reports of FR-82 return figures matching the reading figures and review queue.
- [ ] **AC-23** With `FEATURE_WIKI` off nothing changes; with `FEATURE_WIKI` on and `FEATURE_DRIVE` off every route of this spec answers `404 WIKI_DISABLED` and no wiki menu entry shows; with the public switch off no public route exists (FR-2, FR-3).
- [ ] **AC-24** Works on PostgreSQL, MySQL and SQLite with both ORMs; all functional requirements have a passing test (§4).
- [ ] **AC-25** With `FEATURE_WIKI` off the editor shows exactly today's blocks and controls, a page saved there opens and saves in today's clients, a video block with any address it accepts today still plays, and today's `update_page_markdown` writes every page it writes today (FR-2, FR-4, FR-9).
- [ ] **AC-26** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-2, FR-4).

## 8. Open Questions

- A documentation-site template on Ever Works (navigation tree, table of contents, previous and next) that reads this feed: proposed as an Ever Works template; the feed does not depend on it and any site can read it.
- A proposal back to the source repository from a synced space: proposed later; synced spaces stay read-only in the app.

## 9. Constitution Gates

- [x] I Plugin-first — extends `packages/plugins/docs` and `docs-ui`; no public pages rendered by the platform.
- [x] II Tenant/organization scoping — every new row on the tenant and organization base; the feed resolves them from the space's public key.
- [x] III Both ORMs, additive migrations — new tables and columns only, three dialects.
- [x] IV Default-off flag; nothing removed — `FEATURE_WIKI`, `FEATURE_WIKI_PUBLIC` and the deployment switch off; existing switches and spaces keep their meaning.
- [x] V Contracts and API first — contracts and REST before UI; the stored page format extended, never changed.
- [x] VI Permissions, privacy, security — new keys; sanitizing; sandboxed embeds; feed exposure limited to published pages.
- [x] VII Real-time through the event bus — outbox facts, realtime hints and the existing live sessions.
- [x] VIII i18n and accessibility — strings and templates in every locale; keyboard operable editor.
- [x] IX Tests accompany the change.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Builds on existing Docs behaviour:

| Requirement | Existing behaviour it extends |
| --- | --- |
| FR-1, FR-4, FR-36 | the documents tree and spaces of [`../docs-collaboration/spec.md`](../docs-collaboration/spec.md) FR-1–FR-3, and the inherited sharing of [`../drive/spec.md`](../drive/spec.md) FR-13–FR-16 |
| FR-35–FR-40 | the organization, team and private spaces the hub already lists, and its move-to-space action |
| FR-13, FR-18, FR-47 | live co-editing with server-side writes merged into open editors (docs-collaboration FR-4–FR-9) |
| FR-14 | single-writer autosave with revision check (docs-collaboration FR-9, FR-14) |
| FR-15, FR-16 | text-range comment threads and Inbox mentions (docs-collaboration FR-10, FR-16, FR-17) and [`../comments-and-trash/plan.md`](../comments-and-trash/plan.md) |
| FR-21–FR-25 | page versions with debounce, "save version now" and restore |
| FR-32 | Markdown export (docs-collaboration FR-12) and PDF export of [`../docs-import-export/spec.md`](../docs-import-export/spec.md) FR-13–FR-16 |
| FR-33, FR-34, FR-70 | the workspace import of docs-import-export FR-1–FR-12 and the block-preserving Markdown update (docs-collaboration FR-13) |
| FR-42, FR-43 | page mentions with backlinks (document links) |
| FR-49 | the document review request, approve and reject |
| FR-53, FR-74 | the knowledge pipeline's cited retrieval and its access filter, and the assistant chat's documents tools |
| FR-68 | the existing page read route of the documents plugin, beside the recent visits drive records for each employee |
| FR-70 | the repository integration the platform already runs |
| FR-73, FR-75 | the docs tools and scopes of [`../mcp-collaboration-tools/spec.md`](../mcp-collaboration-tools/spec.md) FR-3 |
| FR-77 | page follow and the Inbox's delivery settings with their digest hour |

- Contracts used: [`../drive/spec.md`](../drive/spec.md) (one tree, shares, link items, public link reader, asking scope, recent visits), [`../access-control-and-security/spec.md`](../access-control-and-security/spec.md) (audit, record access), [`../custom-fields-and-forms/spec.md`](../custom-fields-and-forms/spec.md) (page properties), [`../record-views-and-search/spec.md`](../record-views-and-search/spec.md) (saved views, palette, global search), [`../integration-hub/spec.md`](../integration-hub/spec.md) (connected repositories), [`../report-builder-and-dashboards/spec.md`](../report-builder-and-dashboards/spec.md), [`../automation-and-notifications/spec.md`](../automation-and-notifications/spec.md).
- Consumers: `helpdesk-portal-and-knowledge-base` (help spaces, addresses, feedback, reading figures), `spreadsheets` and `presentations` (templates, comment anchors), `meetings`, the Ever Teams spec `workspace-collaboration-clients`.
