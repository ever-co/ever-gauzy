# Feature Specification: Presentations

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `presentations`
**Branch**: `feat/presentations`
**Status**: `Draft`
**Created**: 2026-11-16
**Last updated**: 2026-11-23
**Owner**: platform maintainers
**Feature flag**: `FEATURE_PRESENTATIONS` (tenant feature, default off) · the plugin loads only when
`GAUZY_SLIDES_ENABLED` is exactly `true` · needs the documents hub (`FEATURE_DOCUMENTS`) with the file kinds of `drive`; co-editing
needs `GAUZY_DOCS_LIVE_ENABLED`, without it a deck keeps single-writer autosave with the revision check

---

## 1. Overview

Today an uploaded presentation file is stored in the documents hub with its slide text extracted for search and AI
knowledge, and its preview shows that text; nobody can see the slides, present them or make a deck. This feature adds
the **deck**: a file kind of the hub, so a deck has the tree, shares, trash, favourites, search and versions of every
file and downloads as a PPTX copy (one storage model, owned by `drive`). A deck holds **slides**
built from **layouts** of a **theme**, with text, images, video, audio, shapes, lines and connectors, tables, charts and
embeds; direct manipulation with snapping and alignment; formatting panels; transitions, element builds and automatic
advance; a **presenter view** with speaker notes, timer and pointer; slides linked from other decks; templates; media
optimised on upload; offline presenting; slide thumbnails; co-editing on the hub's live co-editing server (the same
session, presence and permission model as pages and workbooks); and import and export of PPTX, ODP, PDF and images.
Clients: the Angular app (one editor, viewer and presenter, shown in the documents hub), Ever Teams over the same API
(its screens in the Ever Teams spec `workspace-collaboration-clients`), the MCP server and the SDKs.

**Advanced capabilities.** A **deck is generated** from a page, a report definition or a workbook range as a
draft with speaker notes that the user edits, never published unseen. **Live charts** are bound to report definitions or
workbook ranges, refresh before presenting and show each reader only what they may read. While presenting, the
**audience** follows on their own devices, **asks questions** with votes and **answers polls** whose results appear on
the slide. **Brand rules** keep every deck of an organization within its colours, fonts, logos and themes. **Linked
slides** stay in sync with the deck they come from. Agents build and change decks through MCP tools with a preview.
Marked `(advanced)`.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** an employee with `DOCS_CREATE` in a hub folder, **when** they choose New → Presentation and the theme of
  their organization, **then** a deck with a title slide opens, appears in the tree with a thumbnail and takes the
  folder's visibility.
- **Given** a deck shared at Edit, **when** two people move shapes and type in different text boxes of one slide,
  **then** each sees the other's selection and name, and both changes stay.
- **Given** an uploaded `.pptx` file, **when** the user chooses Open with → Presentation, **then** a deck is created beside it
  with slides, text, shapes, images, tables and notes; the file is untouched and a report lists what was simplified.
- **Given** a presenter who chooses Present, **then** the slides fill the screen, a presenter view on the second screen
  shows notes, the next slide and a timer, and arrow keys and a clicker move through slides and builds.
  `(advanced)`
- **Given** a project status page, **when** a manager chooses Generate deck, **then** a draft deck with one slide per
  section, bullet points and speaker notes opens for editing, marked as generated. `(advanced)`
- **Given** a chart bound to the report definition "Revenue by month", **when** the presenter starts presenting,
  **then** the chart refreshes and shows its "as of" time; a reader who may see only their region's revenue sees only
  that in the editor. `(advanced)`
- **Given** a presentation with audience on, **when** attendees open the join link, **then** their screens follow the
  presenter's slide, they can ask and vote on questions, and a poll slide shows live results. `(advanced)`
- **Given** an organization with enforced brand rules, **when** an editor picks a colour, **then** only brand colours are
  offered, and an imported deck's off-brand colours are mapped to the nearest brand colour. `(advanced)`
- **Given** a deck that inserts three slides linked from the company introduction deck, **when** the source slides
  change, **then** the linked slides update; a detached slide keeps its own copy. `(advanced)`
- **Given** an AI agent with Edit on a deck, **when** it calls the slide text update tool with `preview: true`, **then** it
  receives the slide before and after and nothing is written.

### 2.2 Edge cases & failures

- **Given** a View share, **then** the deck opens in the viewer and can be presented, but not edited; an API write is
  refused with `403`.
- **Given** two people resizing one shape at the same moment, **then** both end with the later size and no other change
  is lost; an editor offline on a plane merges on reconnect the same way.
- **Given** the live co-editing service off, **then** saves state the revision read and a stale save is refused with a
  conflict notice; the same person in two tabs simply co-edits, nothing is locked.
- **Given** a linked slide whose source deck the reader cannot read, **then** it shows "restricted slide" to that reader
  and presents as a blank slide with that label.
- **Given** a live chart whose source is unavailable or forbidden, **then** that reader sees "data unavailable" and the
  last frozen values only if the owner froze them for all readers.
- **Given** a video over 200 MB or an image over 25 MB, **then** the upload is refused with the limit; images are stored
  optimised and the original is kept only when the user chooses so.
- **Given** a PPTX with features the deck cannot represent (macros, embedded objects, 3D models), **then** they are
  dropped or placed as images and listed in the import report.
- **Given** a guest audience on a public link, **then** guests see only the presented slide, never the deck's other
  slides or notes, and can vote and ask only when the presenter allowed it.
- **Given** a presenter who closes the browser, **then** the audience sees "presentation paused" and the session ends
  after 15 minutes without the presenter.
- **Given** no AI provider, **then** generation from a page uses its headings and lists only and says so.
- **Given** `FEATURE_PRESENTATIONS` off, **then** new routes answer `404`, decks download as their last saved PPTX copy
  with sharing, versions and trash, and uploaded presentation files keep today's preview.

## 3. Functional Requirements

### 3.1 Scope, decks and templates

- **FR-1** The system loads only when `GAUZY_SLIDES_ENABLED` is exactly `true` and gates every new route, GraphQL field,
  menu entry and MCP tool with `FEATURE_PRESENTATIONS`; off, they answer `404`.
- **FR-2** The system stores a deck as a hub file of the presentation kind, so tree, move, duplicate, rename, delete, favourites,
  recents, sharing, visibility, team spaces, trash, quotas and search apply without a second model, and every existing
  hub route, preview and extraction keeps working; an uploaded presentation stays a file until opened as a deck.
- **FR-3** The system offers the same deck behaviour through REST, GraphQL reads, the SDKs and the MCP server.
- **FR-4** A user with `DOCS_CREATE` can create a deck in a folder or team space they can write, empty with a theme, from
  a template, or from a file (FR-52), in 16:9, 4:3 or a custom size.
- **FR-5** The system shows decks in hub lists with the first slide as cover, the slide count and the last editor.
- **FR-6** A user with Edit access can mark a deck as a template in the documents hub's one template gallery (pages,
  workbooks and decks); organization and system templates appear there with covers, and starting from one copies its
  slides, theme and layouts.

### 3.2 Themes, layouts and brand rules

- **FR-7** A user with Edit access can choose a deck's theme and change it later; the theme sets colours, fonts,
  backgrounds and element defaults, and changing it restyles every element that uses theme values.
- **FR-8** A user with `SLIDES_THEME_MANAGE` can create, edit and archive organization themes with their layouts.
- **FR-9** A user with Edit access can insert a slide from a layout picker with thumbnails, change a slide's layout, and
  reset a slide to its layout; placeholders keep their content when the layout changes.
- **FR-10** A user with `SLIDES_BRAND_RULES_MANAGE` can define an organization's brand rules: colours, fonts, logos, approved
  themes and templates, and an enforcement mode (off, suggest, enforce); the first brand rules of an organization start
  from the brand colour and logo already set on the organization. `(advanced)`
- **FR-11** The system, in suggest mode, flags off-brand colours and fonts with a one-click fix; in enforce mode, offers only
  brand colours and fonts, limits new decks to approved themes and templates, and maps imported colours and fonts to the
  nearest brand values. `(advanced)`

### 3.3 Slides and elements

- **FR-12** A user with Edit access can add, duplicate, reorder by drag, hide, skip in presenting, group into sections
  and delete slides in a slide sorter.
- **FR-13** A user with Edit access can add text boxes with rich text (headings, lists, links, mentions, emoji), images,
  video, audio, shapes from a library, lines and connectors with arrowheads that stay attached to moved shapes, tables,
  charts, icons, and embeds of platform records and web links shown as cards.
- **FR-14** A user with Edit access can select, marquee-select, multi-select, move, resize, rotate, set corner radius,
  crop images, group and ungroup, lock elements, align and distribute with snap guides and equal-spacing hints, change
  stacking order, pan and zoom, copy and paste between slides and decks, and duplicate.
- **FR-15** A user with Edit access can format text (font, size, weight, colour, paragraph spacing, alignment, lists,
  auto-fit), fills (solid, gradient, image), borders, shadows, opacity and slide backgrounds; text that overflows its box
  is marked.
- **FR-16** A user with Edit access can edit table cells, merge and split them, add and remove rows and columns, and set
  table and cell styles.
- **FR-17** A user with Edit access can write speaker notes per slide with rich text.
- **FR-18** A user can undo and redo their own changes without undoing other people's.
- **FR-19** The system offers keyboard shortcuts for editing, arranging and presenting, with a help dialog
  listing them.

### 3.4 Media

- **FR-20** A user with Edit access can add images, video and audio from their device, the hub and the media gallery;
  uploads pass the hub's checks (content sniffing, size limits, quota) and are kept with the deck.
- **FR-21** The system stores images in an optimised web format at the largest displayed size, keeps a poster frame for
  each video, and never serves media to someone who cannot read the deck.
- **FR-22** A user with Edit access can set video and audio to start on click or automatically, loop, mute and trim the
  start and end, and add alternative text to images and descriptions to media.

### 3.5 Charts `(advanced)`

- **FR-23** A user with Edit access can insert a chart with typed data, or bound to a report definition (with prompts) or
  to a range or typed table of a workbook they may read, using the chart types of the report builder.
- **FR-24** The system computes a bound chart for each reader with that reader's access, shows the data's time, and
  refreshes bound charts when presenting starts and on demand.
- **FR-25** A user with Edit access can freeze a bound chart's values only after confirming that every reader of the deck
  will see the values computed with their access; guests on a public link see only frozen values.
- **FR-26** The system shows "data unavailable" to a reader whose source is unavailable or forbidden, and offers a table
  view of every chart for screen readers.

### 3.6 Linked slides `(advanced)`

- **FR-27** A user with Edit access can insert slides from another deck they may read, either linked (kept in sync) or
  copied.
- **FR-28** The system updates linked slides when their source slides change, marks them as linked with a link to the
  source, and lets an editor detach one into a copy.
- **FR-29** The system shows a linked slide whose source the reader cannot read as a restricted slide, and keeps a
  deleted source's last state as a detached copy with a notice to the deck's editors.

### 3.7 Transitions and builds

- **FR-30** A user with Edit access can set a transition per slide (none, fade, push, wipe, zoom) with a duration, or a
  element-tracking transition that moves, resizes and recolors elements present on both slides and fades the rest.
- **FR-31** The system matches elements between consecutive slides by their link (an element duplicated from the
  previous slide) or else by identical text or media, and lets an editor match or unmatch two elements by hand.
- **FR-32** A user with Edit access can set build steps so elements appear, disappear or highlight on click in order.
- **FR-33** A user with Edit access can make a slide advance automatically after a time between 1 and 600 seconds, and a
  deck loop for unattended display.

### 3.8 Presenting

- **FR-34** A user with read access can present a deck full screen from the first or current slide, with keyboard,
  clicker and touch navigation, a slide overview, black and white screens and an end screen.
- **FR-35** The system offers a presenter view with the current and next slide, speaker notes, a timer, the clock, the
  slide number and per-slide rehearsed times, on a second screen or in a second window. `(advanced)`
- **FR-36** The presenter can use a pointer, a spotlight and temporary drawing on the slide that is cleared on the next
  slide. `(advanced)`
- **FR-37** The presenter can rehearse a deck, keeping each slide's time, and use those times as automatic advance.
- **FR-38** A presenter can control the presentation from a phone signed in as the same person, as a remote with notes.
  `(advanced)`

### 3.9 Audience `(advanced)`

- **FR-39** A presenter can open an audience session with a join link and code; signed-in members who may read the deck
  join, and guests join only on a deck published by public link and when the presenter holds `SLIDES_PRESENT_PUBLIC`.
- **FR-40** The system makes every attendee's screen follow the presenter's slide and builds within a second, shows
  attendees only presented slides (never hidden slides or notes), and lets members step back through slides already
  shown.
- **FR-41** An attendee can ask questions, anonymously when the presenter allows it, and vote on others' questions; the
  presenter sees them by votes, marks them answered, hides them and can show one on screen.
- **FR-42** A user with Edit access can add a poll slide (single or multiple choice, rating, word answers), and an ad-hoc
  poll can be opened during the session; attendees vote once, the presenter opens and closes voting, and results show
  live on the slide.
- **FR-43** The system keeps each session's attendance count, questions and poll results with the deck, and the
  presenter can turn questions into tasks or discussion posts.

### 3.10 Comments, co-editing and sharing

- **FR-44** A user with Comment or Edit access can comment on a slide or an element with threads, mentions, resolve and
  reopen; the thread follows its element, and mentioned people and followers are told through the Inbox.
- **FR-45** The system lets several people edit a deck at once over the hub's live session with element-level and
  character-level merging, each person's selection and name, presence avatars and offline edits merged on reconnect;
  several tabs of one person are sessions like any other and nothing is locked.
- **FR-46** The system applies server-side writes (API, MCP, import, restore, linked slide updates, generation) to open
  sessions at once, keeping each editor's unsaved edits.
- **FR-47** The system re-checks a session's access on the hub's schedule and on share, move, lock and trash, turns it
  read-only or closes it with a reason, and degrades to read-only, never corrupts, at its limits.
- **FR-48** The system applies the hub's share levels to a deck: View reads and presents, Comment also comments, Edit
  edits; sharing notifies the receiver and unsharing closes their open session.
- **FR-49** The system opens a deck reached through a public link of `drive` in a read-only viewer that can present it,
  without notes unless the link allows them, and without the editor.

### 3.11 History, thumbnails and offline

- **FR-50** The system keeps automatic versions at most every 10 minutes while edited and before import, restore and
  generation; a reader can open a version, and an editor can name it, restore the whole deck or restore one slide.
- **FR-51** The system renders a thumbnail of every slide within 30 s of its last change, with the same rendering as the
  editor, for the slide sorter, hub lists, the layout picker and the link preview.
- **FR-52** A user with `DOCS_CREATE` can import a PPTX or ODP file of up to 200 MB into a new deck (slides, layouts,
  theme colours and fonts, text, shapes, images, video, tables, notes) and receives a report of what was simplified.
- **FR-53** A reader can export a deck as PDF (slides, or handouts with notes), PPTX, ODP, or PNG images of chosen
  slides, with bound charts as that reader sees them.
- **FR-54** A user can keep a deck available offline on a device: the deck and its media are stored on the device with
  progress and a list of failures, presenting works without a connection, and edits made offline merge on reconnect.
- **FR-55** The system keeps a deck's slide text and notes available to the hub's search and, when marked as knowledge,
  to the AI knowledge pipeline.
- **FR-56** The system treats a trashed deck like any hub document: sessions close, audience sessions end, linked copies
  elsewhere keep their last state, and a restore resumes them.

### 3.12 Generation `(advanced)`

- **FR-57** A user with `SLIDES_GENERATE` can generate a draft deck from a page, a report definition, a workbook range or
  a typed outline, choosing length, audience and theme; the draft has titles, content, speaker notes and, from a report,
  charts bound to its figures.
- **FR-58** The system opens a generated deck as a draft only the requester can see until they share or move it, marks it
  as generated, and records its source.
- **FR-59** The system builds a deck from a page's headings and lists without an AI provider, and sends the provider only
  the source's text and the report's computed figures the requester may read.
- **FR-60** A user can ask the assistant to rewrite a slide's text shorter or for an audience, draft speaker notes, or
  suggest a layout; each answer is a proposal to accept, edit or discard.

### 3.13 API, MCP and real time

- **FR-61** The system exposes decks, slides, elements, notes, themes, brand rules, linked slides, bound charts, import,
  export, thumbnails, versions and sessions through documented endpoints, with the revision read on writes.
- **FR-62** The system offers MCP tools to list and read decks (outline and notes), create a deck from an outline, add or
  update slides and notes, generate a draft from a source, export, and read a session's summary; writing tools default
  to `preview: true` and run with the agent's permissions.
- **FR-63** The system pushes thumbnails, chart refreshes, linked slide updates, comments and the presenter's position to
  open clients over the platform's real-time channel.

### 3.14 Reports

| Report | Question it answers | Content |
| --- | --- | --- |
| **FR-64** Presentation summary | How did this presentation go? | per session: time, presenter, attendees (members and guests), slides shown with time on each, questions with votes and status, poll results |
| **FR-65** Deck activity | Who works on this deck and where is it used? | versions with editors, slides changed per version, decks linking its slides, sessions held, exports |

- **FR-66** The system exports each report of this table as CSV and the presentation summary as PDF.

## 4. Non-Functional Requirements

- **Performance**: open a 100-slide deck under 2 s P95 warm; element edits reach co-editors under 300 ms on one
  instance; slide change reaches 500 attendees under 1 s; thumbnails within 30 s; PDF export of 100 slides under 60 s in
  the background; PPTX import of 100 slides under 2 minutes.
- **Volume**: 500 slides and 2,000 elements per deck; 50 co-editors; 1,000 attendees per audience session; media per deck
  within the organization's quota.
- **Reliability**: no lost edits across reconnects; state persisted within 10 s of the first unsaved edit; the same
  renderer for editor, thumbnails, presenting and PDF; audience sessions survive a presenter reconnect for 15 minutes.
- **Security & privacy**: hub access on every call; bound charts per reader; attendees see only presented slides; guest
  votes and questions are rate limited and carry no account. Leaving the platform: exported files to the requester; to
  the tenant's AI provider, source text and computed figures for generation.
- **Observability**: activity entries for create, share, import, export, restore, generation, sessions; metrics for
  render time, thumbnail queue, session attendance, import and export durations.
- **Accessibility and localization**: keyboard-operable canvas with a structured outline mode, alternative text,
  reading order per slide, chart tables, captions on uploaded video when provided; labels in every shipped locale.
- **Compatibility**: PostgreSQL, MySQL, SQLite; both ORMs; cloud and self-hosted; one API process needs no shared bus;
  OpenAPI additive; SDKs regenerated.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| Deck | A hub file of the presentation kind holding slides, theme, layouts, media and bindings |
| Slide, element, speaker notes | One page of a deck; an object on it (text, media, shape, line, table, chart, embed); notes |
| Theme, layout | Colours, fonts, backgrounds and defaults of a deck; a slide arrangement with placeholders |
| Brand rules | An organization's colours, fonts, logos, approved themes and templates with an enforcement mode |
| Template | A deck marked as a starting point for others |
| Linked slide | A slide kept in sync with a slide of another deck |
| Bound chart | A chart whose data comes from a report definition or workbook range, computed per reader |
| Transition, build step | How a slide enters; when an element appears during presenting |
| Presentation session, attendee | One run of presenting with its audience; a member or guest who joined |
| Audience question, poll | A question with votes; a vote on choices whose results show on a slide |
| Deck version, slide thumbnail | A saved state of a deck; a rendered image of one slide |
| Generation | A draft deck made from a page, report, range or outline |

## 6. Out of Scope

- Folders, storage, the share dialog, public links and their settings, trash screens and quotas: `drive`.
- Rich pages and their editor: `documents-and-wiki`; workbooks: `spreadsheets`; report definitions and chart types:
  `report-builder-and-dashboards`.
- Presenting inside a video meeting and its recording: `meetings`; long-form discussion of a deck: `discussions`.
- The platform's poll records are shared with `discussions`, which owns their model.
- Ever Teams screens of the editor and viewer: the Ever Teams spec `workspace-collaboration-clients`.
- The template gallery and comment anchors as such: `documents-and-wiki` (decks use them).

## 7. Acceptance Criteria

- [ ] **AC-1** A deck created in a folder from a theme shows a thumbnail cover and slide count in the hub, and survives
      duplicate, move, trash and restore (FR-4, FR-5, FR-51).
- [ ] **AC-2** Layouts, themes and templates behave as FR-6 to FR-9; changing the theme restyles theme-bound elements.
- [ ] **AC-3** Every element type of FR-13 can be added, formatted and arranged with snapping; connectors stay attached
      to moved shapes; overflowing text is marked.
- [ ] **AC-4** Two browsers co-edit one slide with cursors; an offline edit merges; an API write reaches both; a View share
      presents but cannot edit; with `GAUZY_DOCS_LIVE_ENABLED` off saves are single-writer (FR-45, FR-46).
- [ ] **AC-5** An element-tracking transition moves an element present on two slides; builds and automatic advance run in order (FR-30, FR-32, FR-33, FR-37).
- [ ] **AC-6** Presenting shows the presenter view with notes, next slide and timer; a phone remote moves the slides
      (advanced: presenter tools; FR-35, FR-38).
- [ ] **AC-7** A PPTX fixture imports with its report; PDF with notes, PPTX, ODP and PNG exports open in standard viewers;
      a public link opens the viewer without the editor or notes (FR-52, FR-53).
- [ ] **AC-8** A bound chart shows different figures to two readers, refreshes on Present and shows guests only frozen
      values after confirmation (advanced: live charts; FR-24, FR-26).
- [ ] **AC-9** A deck generated from a page has one slide per section with notes and stays private until shared; without a
      provider it is built from headings (advanced: generation; FR-57–FR-59).
- [ ] **AC-10** 50 attendees follow the presenter within a second, ask and vote on questions, and answer a poll whose
      results show live; guests see no notes or hidden slides (advanced: audience; FR-41–FR-43).
- [ ] **AC-11** Enforced brand rules limit colours and fonts and map an import's colours (advanced: brand rules; FR-10, FR-11).
- [ ] **AC-12** A linked slide updates after its source changes; a restricted source shows a restricted slide; detach
      makes a copy (advanced: linked slides; FR-28, FR-29).
- [ ] **AC-13** The reports FR-64 and FR-65 return correct rows on seeded data and export as CSV and PDF.
- [ ] **AC-14** Feature off: `404` on new routes and tools; decks download as PPTX; file previews unchanged (FR-1).
- [ ] **AC-15** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-1).
- [ ] Works on PostgreSQL, MySQL and SQLite with both ORMs; all functional requirements have a passing test.

## 8. Open Questions

- Bound charts are per reader (FR-24); guests see only frozen values, which need confirmation. Default
  applied.
- Guests in audience sessions only on decks published by a public link of `drive`, by presenters holding
  `SLIDES_PRESENT_PUBLIC` (granted to managers and administrators). Default applied.
- Uploaded fonts in brand rules must be fonts the organization may embed; the brand rules form asks the uploader to confirm.
  Default applied.
- Building blocks for the canvas, rendering and file formats are fixed by the plan's first task. Default
  applied.

## 9. Constitution Gates

- [x] I Plugin-first — new plugin triple `slides` with one editor; a file kind of `drive`; the live codec seam of `spreadsheets` is reused.
- [x] II Tenant/organization scoping — decks are drive files; every new record is tenant and organization scoped.
- [x] III Both ORMs, additive migrations — new plugin tables on three dialects; no destructive change to hub tables.
- [x] IV Default-off flag; nothing removed — deploy switch plus `FEATURE_PRESENTATIONS`; uploads and previews unchanged.
- [x] V Contracts and API first — deck, slide, chart and session contracts in REST, GraphQL and SDKs before the UI.
- [x] VI Permissions, privacy, security — hub access, per-reader charts, attendee isolation, guest rate limits.
- [x] VII Real-time through the event bus — co-editing on the hub's live session; audience and hints on the channel.
- [x] VIII i18n and accessibility — translated labels, outline mode, alternative text, reading order, chart tables.
- [x] IX Tests accompany the change — renderer snapshots, codec and per-requirement tests, file round trips.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Builds on: [`drive`](../drive/spec.md) (file kinds), [`documents-and-wiki`](../documents-and-wiki/spec.md), [`spreadsheets`](../spreadsheets/spec.md),
  [`report-builder-and-dashboards`](../report-builder-and-dashboards/spec.md), `discussions` (polls),
  [`access-control-and-security`](../access-control-and-security/spec.md),
  [`print-and-pdf-designer`](../print-and-pdf-designer/spec.md)
- Code: `packages/plugins/docs/` (`live/`, `knowledge/extraction/pptx.extractor.ts`, `office-package.util.ts`),
  `packages/plugins/docs-ui/`, `docs/specs/features/docs-collaboration/`, `packages/core/src/lib/comment/`,
  `packages/core/src/lib/reaction/`
