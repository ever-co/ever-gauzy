# Feature Specification: Spreadsheets

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `spreadsheets`
**Branch**: `feat/spreadsheets`
**Status**: `Draft`
**Created**: 2026-11-16
**Last updated**: 2026-11-23
**Owner**: platform maintainers
**Feature flag**: `FEATURE_SPREADSHEETS` (tenant feature, default off) · the plugin loads only when `GAUZY_SHEETS_ENABLED`
is exactly `true` · needs the documents hub (`FEATURE_DOCUMENTS`) with the file kinds of `drive`; co-editing needs
`GAUZY_DOCS_LIVE_ENABLED`, without it a workbook keeps single-writer autosave with the revision check

---

## 1. Overview

Today an uploaded spreadsheet file is stored in the documents hub with its cell text extracted for search and AI
knowledge; nobody can see it as a grid, edit it or create one. This feature adds the **workbook**: a file kind of the
hub, so a workbook has the tree, shares, trash, favourites, search and versions of every file and downloads as an XLSX
copy (one storage model, owned by `drive`). A workbook holds **sheets** with a virtualized grid, formulas,
formats, conditional formats, validation, sort and filter, slicers, pivots, charts, sparklines, named ranges,
server-enforced protection, cell comments, co-editing on the hub's live co-editing server (the same session, presence
and permission model as pages), history down to one cell, and XLSX, ODS, CSV and PDF import and export. Clients: the
Angular app (one workbook editor, shown in the documents hub), Ever Teams over the same API (its screens in
the Ever Teams spec `workspace-collaboration-clients`), the MCP server, the SDKs.

**Advanced capabilities.** A **live range** shows the rows of any report definition or saved view, refreshed
on demand, on open, on a schedule or when the data changes, and each reader sees **only the rows they may read**, with
a **lineage panel** naming each figure's source and opening the records behind it. **Typed tables** validate like form
fields, and a **record-backed table** edits records through the platform's bulk change with a preview and per-row
results. **"Ask this sheet"** turns a question into a formula shown, editable and inserted only on acceptance.
**Scheduled snapshots** highlight what changed since the last one. Agents work through MCP tools with a preview.
Marked `(advanced)`.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** an employee with `DOCS_CREATE` in a hub folder, **when** they choose New → Spreadsheet, **then** an empty
  workbook with one sheet opens, appears in the tree and recents, and takes the folder's visibility.
- **Given** a workbook shared at Edit, **when** two people type in different cells of one sheet, **then** each sees the
  other's selection and name, both edits stay, dependent formulas recalculate for both within a second.
- **Given** an uploaded `.xlsx` file, **when** the user chooses Open with → Spreadsheet, **then** a workbook is created beside
  it with each worksheet as a sheet, the file is untouched, and an import report lists what could not be kept.
- **Given** a manager who inserts a live range from the report definition "Hours by project this month", **then** it
  fills with the report's rows and shows "as of 10:42", and a colleague who may read only their team's time sees only
  their team's rows in the same workbook. `(advanced)`
- **Given** a live cell, **when** a reader opens Lineage, **then** they see the source, its filters, the refresh time, the
  formulas that use the cell and a link to the records behind it. `(advanced)`
- **Given** a record-backed table over the saved view "Open deals", **when** a manager changes three amounts and chooses
  Apply changes, **then** a preview shows each field before and after, nothing is written until confirmed, and each row
  then shows done or why it was refused. `(advanced)`
- **Given** a typed table with a date column and a choice column, **when** someone types an invalid date or an unknown
  choice, **then** the cell is marked with the message a form would show and a reject rule keeps the old value.
  `(advanced)`
- **Given** the question "average deal size per region for Q3", **then** the sheet proposes a formula, its target cells
  and an explanation, and changes nothing until the user accepts or edits it. `(advanced)`
- **Given** a weekly snapshot schedule, **when** the owner opens the workbook on Monday, **then** cells changed since the
  last snapshot are highlighted with who changed them. `(advanced)`
- **Given** an administrator who set the assistant's sample rows to 0, **then** questions send headers and types only;
  **given** an AI agent with Edit, **when** it updates a range with `preview: true`, **then** nothing is written.

### 2.2 Edge cases & failures

- **Given** a View share, **then** the workbook opens read-only with the reason; an API write is refused with `403`.
- **Given** a protected range, **when** an editor not allowed pastes over it, **then** the server refuses the change, the
  grid rolls back and says "This range is protected".
- **Given** two people changing one cell at the same moment, **then** both end with the later value, the cell history
  lists both, and no other edit is lost; an editor offline for ten minutes merges the same way on reconnect.
- **Given** the live co-editing service off or unreachable, **then** saves state the revision they read and a stale save
  is refused with a conflict notice.
- **Given** a circular reference or a deleted sheet that formulas use, **then** those cells show typed errors with the
  path or reference while every other cell computes; undo or restore brings the values back.
- **Given** a live range whose source plugin is off, or a reader without permission to run it, **then** that reader sees
  "source unavailable" or "you cannot read this source" and no values; other readers are unaffected.
- **Given** a write-back where 2 of 40 records changed since the refresh, **then** those two are refused as stale and stay
  pending with the reason; the other 38 are written.
- **Given** a file over 50 MB or over 500,000 non-empty cells, **then** the import is refused with the limit and a pointer
  to the record import; macros, links to other files and pivot caches are dropped and listed.
- **Given** a workbook moved to the trash, **then** sessions close with the reason, live ranges and snapshots pause, and a
  restore resumes them; **given** no AI provider, **then** the assistant says why it is unavailable.
- **Given** `FEATURE_SPREADSHEETS` off, **then** new routes answer `404`, workbooks download as their last saved XLSX
  copy and keep sharing, versions and trash, and uploaded spreadsheet files keep today's preview.

## 3. Functional Requirements

### 3.1 Scope, workbooks and sheets

- **FR-1** The system loads only when `GAUZY_SHEETS_ENABLED` is exactly `true` and gates every new route, GraphQL field,
  menu entry and MCP tool with `FEATURE_SPREADSHEETS`; off, they answer `404`. Only the bringing up to date of a
  workbook's downloadable copy keeps running with the flag off, so a download always holds the last save.
- **FR-2** The system stores a workbook as a hub file of the spreadsheet kind, so tree, move, duplicate, favourites,
  recents, sharing, visibility, team spaces, trash, quotas and search apply without a second model, every existing hub
  route, field, permission, preview and extraction keeps working, and an uploaded spreadsheet stays a file until opened.
- **FR-3** The system offers the same workbook behaviour through REST, GraphQL reads, the SDKs and the MCP server.
- **FR-4** A user with `DOCS_CREATE` can create a workbook in a folder or team space they can write, empty or from a
  template, with one sheet.
- **FR-5** A user with Edit access can add, rename, duplicate, reorder, colour, hide, unhide and delete sheets; the last
  visible sheet cannot be hidden or deleted.
- **FR-6** The system keeps a workbook's locale, time zone and first day of week (the organization's by default) and uses
  them to parse input, format values and evaluate date functions.
- **FR-7** The system enforces per workbook at most 200 sheets and 500,000 non-empty cells, and per sheet 1,048,576 rows
  and 16,384 columns, naming the limit before refusing an action.
- **FR-8** A user with Edit access can mark a workbook as a template in the documents hub's one template gallery
  (pages, workbooks and decks), for themselves, a space or the organization.

### 3.2 Grid, navigation and input

- **FR-9** The system renders any allowed sheet as a virtualized grid with smooth scrolling, zoom from 50% to 200% and
  keyboard navigation of the whole sheet.
- **FR-10** A user with Edit access can freeze leading rows and columns and resize, hide, insert and delete rows and
  columns; every reference, format, rule and range spanning them adjusts.
- **FR-11** A user can select cells, ranges, rows, columns and several ranges; the status bar shows sum, average, count,
  minimum and maximum of the selection.
- **FR-12** A user with Edit access can drag the fill handle to copy with relative references or extend a series (FR-26).
- **FR-13** The system parses input by the workbook's locale into numbers, money, percentages, dates, times, booleans and
  text, and keeps leading zeros in text-formatted cells.
- **FR-14** The system offers keyboard shortcuts for navigation, selection, editing, formatting and history,
  with a help dialog listing them.
- **FR-15** The system copies selections as values, formulas and formats between workbooks and as tab-separated text and
  an HTML table to other programs; pasting keeps rows, columns and basic formats; paste values or formats only.

### 3.3 Formulas and formats

- **FR-16** The system evaluates at least 200 functions across maths, statistics, logic, lookup and reference, text with
  regular expressions, date and time with working days and holiday lists, financial, information and dynamic arrays
  that spill into neighbouring cells.
- **FR-17** The system recalculates only cells that depend on a change, across sheets, with the same result in the
  browser, the API and background jobs for the same inputs, locale and time zone.
- **FR-18** The system suggests functions, arguments and names while a formula is typed, colours referenced ranges and
  shows help for the function under the cursor.
- **FR-19** The system shows typed errors (division by zero, wrong type, unknown name, bad reference, not available,
  circular reference with its path, spill blocked) with a reason, never stops other cells for an error, and evaluates
  volatile functions once per recalculation in the workbook's time zone without recording them as edits.
- **FR-20** A user can define local names inside a formula and reusable named functions in the workbook.
  `(advanced)`
- **FR-21** A formula can refer to a range of another workbook the reader may read; the value follows that workbook and is
  a reference error for a reader who cannot read it. `(advanced)`
- **FR-22** The system offers no function that runs code, calls an outside address or reads records; platform data enters
  only through live ranges (FR-58).
- **FR-23** A user with Edit access can set number formats (number, money in any platform currency, percentage,
  scientific, date, time, duration, text, custom patterns), decimals, font, size, bold, italic, underline, strike,
  colours, alignment, wrapping, rotation, borders on any set of sides, merges, a format painter and clearing of formats,
  values or both.
- **FR-24** A user with Edit access can add conditional formats by comparisons, between, text contains, blanks,
  duplicates or unique values, top or bottom N or percent, dates in a period or a custom formula, and as colour scales,
  data bars and icon sets; rules apply in order with "stop if true" and move with inserted and deleted rows and columns.

### 3.4 Data tools and charts

- **FR-25** A user with Edit access can add validation (list of values or a range, numbers or dates with comparisons, text
  length, checkbox, custom formula) with reject or warn, an input hint and an invalid marker.
- **FR-26** A user with Edit access can extend series of numbers, dates, times, weekdays, months, numbered text and the
  organization's custom lists, and fill a column from two or three examples, with the assistant as a fallback.
- **FR-27** A user with Edit access can split a column by a delimiter or fixed widths with a preview, confirming before any
  non-empty cell is overwritten.
- **FR-28** A user with Edit access can sort a range or table by several keys, as one undo step.
- **FR-29** A user can filter by values, conditions or colours; an editor's filter applies to everyone, and any reader can
  open a personal filter view that only they see. `(advanced)`
- **FR-30** A user with Edit access can add slicers that drive the filter of a table, range or pivot.
- **FR-31** A user with Edit access can build a pivot from a range, table or live range with rows, columns, values (sum,
  count, average, minimum, maximum, distinct count, percent of total) and filters, refreshing when its source changes.
- **FR-32** A user with Edit access can define, rename and delete named ranges at workbook or sheet scope for formulas,
  validation, charts and links.
- **FR-33** A user can find text, numbers or formula text in a sheet or workbook with match case, whole cell and regular
  expressions; an editor can replace one or all matches as one undo step.
- **FR-34** A user with Edit access can link cells to web addresses, cells, sheets, names, hub documents and platform
  records; a web link shows its title, description and icon from the platform's link preview service (the one chat
  uses, with its outbound guard and cache) where it is available, and a record link shows the record's card. `(advanced)`
- **FR-35** A user with Edit access can chart a range, table, pivot or live range as line, column, bar (stacked and 100%
  stacked), area, pie, doughnut, scatter, bubble, columns with lines, histogram or waterfall, with titles, axes, legend,
  labels, palette and aggregation of repeated categories.
- **FR-36** The system redraws a chart when its source changes, lets it move and resize over the grid, and offers a table
  view of its data for screen readers.
- **FR-37** A user with Edit access can put a line, column or win-loss sparkline in a cell through a function.

### 3.5 Protection, comments, co-editing and sharing

- **FR-38** A user with Edit access can protect a sheet or range for named people or teams (the owner and `DOCS_MANAGE`
  holders always may edit).
- **FR-39** The server refuses any change to a protected cell from someone not allowed, from the editor, a paste, a fill,
  a sort, an import, the API or an MCP tool, and the protection follows inserted and deleted rows and columns.
- **FR-40** A protection can be a warning only: allowed people edit after confirming, and the change is recorded.
- **FR-41** A user with Comment or Edit access can comment on a cell with threads, replies, mentions, edit and delete of
  their own comments, resolve and reopen; the thread follows its cell, and mentioned people, followers and participants
  are told through the Inbox with a link to the cell.
- **FR-42** The system lets several people edit at once over the documents hub's live session with cell-level merging,
  each person's selection and name, presence avatars, and offline edits merged on reconnect.
- **FR-43** The system applies server-side writes (API, MCP, import into a sheet, restore, freeze, write-back results) to
  open sessions at once, keeping each editor's unsaved edits.
- **FR-44** The system re-checks a session's access on the hub's schedule and on share, move, lock and trash, turns it
  read-only or closes it with a reason, and degrades to read-only, never corrupts, at its limits.
- **FR-45** The system applies the hub's share levels: View reads, Comment reads and comments, Edit edits; sharing notifies
  the receiver and unsharing closes their open session.

### 3.6 History

- **FR-46** The system keeps automatic versions at most every 10 minutes while edited and before every import, restore and
  write-back; a user with Edit access can name and pin a version.
- **FR-47** A reader can open a version read-only and compare it with another or the current state (cells added, changed
  and removed per sheet, before and after); an editor can restore it as a new version.
- **FR-48** The system records each cell change on the server with person, time, value before and after and version, and
  a user can open the history of one cell.
- **FR-49** A user can undo and redo their own changes, including sort, paste, replace and import into an existing
  workbook, without undoing other people's changes.
- **FR-50** The system thins automatic versions older than 30 days to one per day and cell history older than 90 days to
  daily totals per person, keeping named and pinned versions.

### 3.7 Import, export and lifecycle

- **FR-51** A user with `DOCS_CREATE` can import an XLSX, ODS, CSV or TSV file of up to 50 MB into a new workbook, or as
  new sheets of one they can edit, without changing existing sheets.
- **FR-52** The system imports values, formulas, number formats, styles, merges, sizes, frozen panes, hidden rows and
  columns, validation, conditional formats, names, comments and representable charts, and reports what it dropped.
- **FR-53** The system detects a CSV file's encoding, delimiter and header, previews 20 rows, and imports over 10,000 rows
  in the background with progress.
- **FR-54** A reader can export a workbook as XLSX or ODS, a sheet as CSV, and a sheet, range or workbook as PDF with page
  setup (orientation, paper, fit to width, margins, gridlines, header rows, page numbers); a download is the XLSX copy.
- **FR-55** The system neutralizes cells starting with formula characters in CSV exports, and every export uses the
  exporter's own live range rows (FR-60).
- **FR-56** The system keeps a workbook's cell text available to the hub's search and, when marked as knowledge, to the AI
  knowledge pipeline.
- **FR-57** The system treats a trashed workbook like any hub document: sessions close, live refreshes and snapshot
  schedules pause and resume on restore; permanent deletion removes its history and bindings.

### 3.8 Live data from the platform `(advanced)`

- **FR-58** A user with `SHEETS_LIVE_RANGE_MANAGE` and Edit access can insert a live range bound to a report definition
  (with prompts) or a saved view (with filter and columns) they may run, choosing columns and anchor.
- **FR-59** The system refreshes a live range on open (results reused for 5 minutes), on demand, on a schedule (hourly,
  daily or weekly in the workbook's time zone) or when the source's data changes while open, and shows the values' time.
- **FR-60** The system computes a live range for each reader with that reader's access: rows, records and columns they may
  not read are absent, and formulas, charts, pivots and exports over it use that reader's rows.
- **FR-61** The system grows and shrinks a live range with its result and never overwrites cells outside it, showing a
  "spill blocked" error that names the blocking cell.
- **FR-62** A user can open any cell's lineage: source, filters, prompts, refresh time and mode, the formulas that read it
  and, for a live cell, a link to the records behind it.
- **FR-63** A user with Edit access can freeze a live range into plain values only after confirming that every reader of
  the workbook will see the values computed with their access; an administrator can switch freezing off.
- **FR-64** The system shows a source that is unavailable or forbidden to a reader as such without values, and notifies the
  range's owner once after three failed scheduled refreshes in a row.
- **FR-65** A user with Edit access can make a typed table (FR-68) over a saved view record-backed: each row is a record,
  and an edit becomes a pending change marked on the cell and visible only to its author.
- **FR-66** A user with `SHEETS_WRITE_BACK_RUN` can apply their pending changes: a preview shows each field before and
  after, nothing is written until confirmed, then the platform's bulk change writes through each record's own rules and
  permissions and reports done, unchanged, refused or failed per row.
- **FR-67** The system refuses a pending change as stale when its record changed after the refresh, keeps it pending with
  the reason, and refreshes the table after a write-back.

### 3.9 Typed tables `(advanced)`

- **FR-68** A user with Edit access can turn a range into a table (header, banded rows, total row, automatic growth) and
  type each column (text, long text, number, money, percentage, date, date and time, duration, choice, multiple choice,
  checkbox, person, record reference, email, phone, link).
- **FR-69** The system validates typed values with the rules and messages of a form field of that type, including custom
  field rules on record-backed tables, and offers choice, person and record pickers limited to what the user may read.
- **FR-70** The system offers a typed table to report definitions as a dataset, so a dashboard card or a deck chart can
  show it to readers of the workbook.

### 3.10 Assistant and snapshots `(advanced)`

- **FR-71** A user with `SHEETS_ASSISTANT_USE` can ask about the selection or sheet in plain language and gets a proposed
  formula, its target cells and an explanation; the sheet computes it and inserts it only when accepted or edited.
- **FR-72** A user can ask the assistant to explain a formula, fix a cell in error, or suggest a chart or pivot; each
  answer is a proposal to accept, edit or discard.
- **FR-73** The system sends the assistant only headers, column types and at most the configured sample rows of the
  selection (20 by default, 0 for none), never live values the user may not read, and marks accepted formulas as assisted.
- **FR-74** The system answers common requests (totals, averages, conditional counts, lookups, date differences) with
  built-in rules first, also when no AI provider is configured.
- **FR-75** A user with `SHEETS_SNAPSHOT_MANAGE` and Edit access can schedule daily, weekly or monthly snapshots kept as
  named versions for a chosen number of periods.
- **FR-76** The system highlights cells changed since the last snapshot, with a panel per sheet of before, after and who.
- **FR-77** The system can notify followers after a snapshot with the number of changed cells and a link to the
  comparison, and sends nothing when nothing changed.
- **FR-78** The system stores live values in a snapshot only when its owner confirmed that readers will see values
  computed with the owner's access; otherwise the snapshot keeps the binding without values.

### 3.11 API, MCP, real time and reports

- **FR-79** The system exposes ranges (values, formulas, text), range writes with the revision read, sheets, import,
  export, live ranges, write-back, versions, cell history and snapshots through documented endpoints.
- **FR-80** The system offers MCP tools to list and read workbooks and ranges, write a range, append table rows, insert a
  live range, explain a cell and apply pending changes; writing tools default to `preview: true` and run with the agent's
  permissions.
- **FR-81** The system pushes live range refreshes, comments, protection changes and write-back results to open clients
  over the platform's real-time channel.

| Report | Question it answers | Content |
| --- | --- | --- |
| **FR-82** Version timeline | What changed in this workbook and who changed it? | changes per day and person, named versions, cells changed between two versions, one cell's history |
| **FR-83** Live range refresh log | Is the data current? | per live range: refreshes with time, mode, requester or schedule, rows, duration, failures |
| **FR-84** Write-back results | What did my changes do to the records? | per run: records, fields before and after, outcome, reason, link |

- **FR-85** The system exports each report of this table as CSV.

## 4. Non-Functional Requirements

- **Performance**: open 100,000 cells under 2 s P95 warm; scroll at 60 frames per second; recalculate 10,000 dependent
  cells under 200 ms; edits reach co-editors under 300 ms on one instance; a 5,000-row live range refreshes under 3 s
  P95 from a cached run; 100,000 CSV rows import under 60 s; XLSX export of 100,000 cells under 10 s.
- **Volume**: FR-7 limits; 50 co-editors per workbook; 100 live ranges of 50,000 rows each; 10 million cell changes per
  tenant before thinning.
- **Reliability**: no lost edits across reconnects; state persisted within 10 s of the first unsaved edit; one engine for
  server and browser; background imports, exports and refreshes resume after a restart.
- **Security & privacy**: hub access on every call; protection and per-reader live data enforced by the server; link
  previews only through the outbound guard. Leaving the platform: exported files to the requester; to the tenant's AI
  provider, headers, types and the configured sample rows of a selection.
- **Observability**: activity entries for create, share, import, export, restore, protection, freeze and write-back;
  metrics for recalculation, sessions, refreshes, imports and exports.
- **Accessibility and localization**: keyboard grid announcing address, value and formula; high-contrast selection;
  chart tables; labels in every locale; locale formats; English function names with the locale's separator.
- **Compatibility**: PostgreSQL, MySQL, SQLite; both ORMs; cloud and self-hosted; one API process needs no shared bus;
  OpenAPI additive; SDKs regenerated.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| Workbook | A hub file of the spreadsheet kind holding sheets, styles, names, tables, charts and bindings |
| Sheet | One tab of a workbook with its grid, frozen panes, protections, filters and objects |
| Cell, range, named range | One value with its formula and format; a rectangle of cells; a range with a name |
| Table, typed column | A range with header, totals and growth; a column with a field type and its rules |
| Live range, live range result | A range bound to a report definition or saved view; its rows for one access |
| Record-backed table, pending change | A typed table whose rows are records; one person's unapplied edit of a field |
| Write-back run | One application of pending changes through the bulk change, with per-row outcomes |
| Chart, sparkline, pivot, slicer | Visual and summary objects over ranges |
| Protection, cell comment | A protected sheet or range and who may edit it; a platform comment thread on a cell |
| Workbook version, cell change, snapshot schedule | A saved state; one recorded change of a cell; when named versions are taken |
| Assistant proposal | A formula, chart or pivot suggested from a question, awaiting acceptance |

## 6. Out of Scope

- Folders, storage, the share dialog, public links, trash screens, favourites, recents and quotas: `drive`.
- Rich pages, wiki spaces, page comments and the page editor: `documents-and-wiki`; slides: `presentations`.
- Dashboards and report content: `report-builder-and-dashboards`; saved views: `record-views-and-search`; the bulk
  change engine and record imports: `data-import-export`; record and field rules: `access-control-and-security`.
- Macros and server-side scripts: not offered; repeatable work is a flow of `automation-and-notifications`.
- Outside sources: `integration-hub`; Ever Teams screens: the Ever Teams spec `workspace-collaboration-clients`.
- The template gallery and cell comment anchors as such: `documents-and-wiki` (workbooks use them).

## 7. Acceptance Criteria

- [ ] **AC-1** A workbook created in a folder keeps three sheets through rename, reorder, colour, hide and delete and
      appears in tree, search and recents with the folder's visibility (FR-4, FR-5).
- [ ] **AC-2** A 300-case formula conformance set gives the same values in browser and API; circular references and
      deleted sheets show errors while other cells compute (FR-16, FR-17, FR-19).
- [ ] **AC-3** Formats, conditional formats, validation, sort, filters, personal views, slicers, pivots, names, find and
      replace, series, split text and links behave as FR-23 to FR-34; every chart type of FR-35 and a sparkline render.
- [ ] **AC-4** A protected range refuses a paste, an API write and an MCP write; a warning protection records the change (FR-39, FR-40).
- [ ] **AC-5** Two browsers co-edit with cursors; an offline edit merges; an API write reaches both; a View share is
      read-only; with `GAUZY_DOCS_LIVE_ENABLED` off saves are single-writer; a cell comment mention notifies (FR-42, FR-45).
- [ ] **AC-6** A comparison lists changed cells; one cell's history lists its changes; restore creates a version; undo
      leaves another person's edits (FR-46–FR-48).
- [ ] **AC-7** An XLSX file with formats, merges, validation and conditional formats round-trips; macros are listed as
      dropped; 100,000 CSV rows import in the background; CSV export neutralizes formulas; PDF honours page setup (FR-51, FR-52).
- [ ] **AC-8** A live range shows different rows to two readers, its lineage opens the records behind a figure, a
      forbidden reader sees no values, and a freeze needs confirmation (advanced: live data; FR-60, FR-62).
- [ ] **AC-9** Pending changes preview, write through the bulk change, refuse a stale row and report per row (advanced:
      write-back) (FR-66, FR-67).
- [ ] **AC-10** Typed date and choice columns reject invalid input with the form's messages; a typed table feeds a report
      card (advanced: typed tables; FR-25, FR-68–FR-70).
- [ ] **AC-11** A question yields an editable formula that changes nothing until accepted; without a provider the rules
      still answer a total (advanced: assistant; FR-72, FR-74).
- [ ] **AC-12** A weekly snapshot highlights changed cells with who changed them and notifies followers; without
      confirmation it keeps no live values (advanced: snapshots; FR-75–FR-77).
- [ ] **AC-13** The reports FR-82 to FR-84 return correct rows on seeded data and export as CSV.
- [ ] **AC-14** Feature off: `404` on new routes and tools; workbooks download as XLSX; file previews unchanged (FR-1, FR-54).
- [ ] **AC-15** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-1).
- [ ] Works on PostgreSQL, MySQL and SQLite with both ORMs; all functional requirements have a passing test.

## 8. Open Questions

- Live ranges are per reader (FR-60); freeze and snapshots need confirmation. Default applied.
- At most 500,000 non-empty cells per workbook (FR-7), within the hub's live limits. Default applied.
- Write-back only from record-backed tables over saved views, granted to managers and administrators. Default applied.
- The assistant receives at most 20 sample rows by default; an administrator can set 0. Default applied.
- Building blocks for grid, formulas and files are fixed by the plan's first task. Default applied.

## 9. Constitution Gates

- [x] I Plugin-first — new plugin triple `sheets` with one editor; a file kind of `drive`; the hub's live module gains a codec seam.
- [x] II Tenant/organization scoping — workbooks are hub files; every new record is tenant and organization scoped.
- [x] III Both ORMs, additive migrations — new plugin tables on three dialects; no destructive change to hub tables.
- [x] IV Default-off flag; nothing removed — deploy switch plus `FEATURE_SPREADSHEETS`; uploads and previews unchanged.
- [x] V Contracts and API first — range, live range and write-back contracts in REST, GraphQL and SDKs before the UI.
- [x] VI Permissions, privacy, security — hub access, server-side protection, per-reader live data, outbound guard.
- [x] VII Real-time through the event bus — co-editing on the hub's live session, other changes as real-time hints.
- [x] VIII i18n and accessibility — locale formats, translated labels, screen-reader grid and chart tables.
- [x] IX Tests accompany the change — conformance set, per-requirement tests, file round trips.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md) · Builds on: [`drive`](../drive/spec.md) (file kinds),
  [`documents-and-wiki`](../documents-and-wiki/spec.md), [`report-builder-and-dashboards`](../report-builder-and-dashboards/spec.md),
  [`record-views-and-search`](../record-views-and-search/spec.md), [`data-import-export`](../data-import-export/spec.md),
  [`custom-fields-and-forms`](../custom-fields-and-forms/spec.md), [`access-control-and-security`](../access-control-and-security/spec.md);
  works with `presentations`, [`print-and-pdf-designer`](../print-and-pdf-designer/spec.md)
- Code: `packages/plugins/docs/` (`live/`, `entities/document.entity.ts`, `knowledge/extraction/xlsx.extractor.ts`),
  `packages/plugins/docs-ui/`, `docs/specs/features/docs-collaboration/`, `packages/core/src/lib/comment/`
