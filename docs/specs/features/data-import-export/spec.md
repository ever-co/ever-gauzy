# Feature Specification: Data import and export

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `data-import-export`
**Branch**: `feat/data-import-export`
**Status**: `Draft`
**Created**: 2026-11-16
**Last updated**: 2026-11-23
**Owner**: evereq
**Feature flag**: `FEATURE_DATA_EXCHANGE` (tenant feature, default off) · the plugin loads only when
`GAUZY_DATA_EXCHANGE_ENABLED` is exactly `true` · the tenant export and import page keeps `FEATURE_IMPORT_EXPORT`

---

## 1. Overview

Today the platform exports a whole tenant as a zip of CSV files and imports it back (a backup and migration tool shaped
by table, with history and id mapping), offers bulk-create routes for employees, users, candidates, tasks, expenses,
tags and roles, and keeps most deleted records soft-deleted with a restore route (tasks have a trash page behind a
switch). Nobody can import a spreadsheet into a list with a column mapping, update records from a file, merge two
duplicates or restore deleted records of any kind from one place. This feature adds **mapped imports** on every
registered record type (create, update, create or update), with column mapping and saved **mapping templates**, value
mapping, validation, a **dry run**, a downloadable **error file**, child rows (lines, people, addresses) and trees,
processed in the background with progress; **exports** from any saved view or record type with child tables and
templates; **bulk change** of records matching a view or a file; **rename and merge** with every reference rewritten; a
**recycle bin** across record types with restore and retention; deletion safeguards; archive rules; and **migration
toolkits** that load a new organization in order. Clients: the Angular app, the MCP server and the SDKs. The tenant
export and import stays as it is at its own address and is also offered as one tab of the same data settings, with one
import history.

**Advanced capabilities.** Imports **learn mappings** from earlier files of the same shape. **Duplicates are
found before anything is written**, inside the file and against existing records, and each is decided (skip, update,
create, merge). A whole import **can be undone as a batch**. An **assistant cleans and maps a messy file** into
declarative steps the user previews row by row, and the engine, not the assistant, applies them. Import and export are
**MCP tools with a dry run**, so an agent can load data safely. Progress is live over the real-time channel, imports can
recur from a link or a drive folder, and merges can be undone. Marked `(advanced)`.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** an empty contacts list, **when** a sales administrator chooses "Import from a file" and drops an XLSX of
  1,000 rows, **then** columns are matched by header (custom field "Region" included), required fields without a column
  are named, the first 20 rows show as they will be saved, and a dry run reports 980 valid, 12 duplicates and 8 errors
  with a downloadable error file; **when** they run it, **then** progress shows live and 980 contacts are created.
- **Given** an export of items "for update" with their codes, **when** prices are changed in a spreadsheet and imported
  in update mode by code, **then** a preview shows each changed field before and after, only changed fields are
  written, and 3 unknown codes are listed.
- **Given** a file of invoices whose continuation rows leave the parent columns blank, **when** it is imported, **then**
  each invoice is created as a draft with its lines, and confirming after import is offered when the user may confirm.
- **Given** a chart of accounts file where parents appear before their children, **when** it is imported, **then** a tree
  preview shows the result and a row that would make an account its own ancestor is refused.
- **Given** status values "Won" and "Closed won" in a file, **when** the user maps both to the existing status and allows
  creating missing customer groups, **then** the import uses the status and creates the one missing group.
- **Given** two contacts for one company, **when** a manager merges them, **then** a preview lists the 37 deals, invoices,
  tasks, comments and files that will point to the kept contact, the manager picks the surviving value per field, and the
  other contact goes to the recycle bin marked "merged into".
- **Given** the recycle bin, **when** an administrator restores five deleted projects, **then** they reappear with their
  tasks; one whose name was taken meanwhile gets a suffix and says so.
- **Given** a vendor referenced by 12 purchase orders, **when** someone deletes it, **then** deletion is refused with the
  list of referencing orders.
- **Given** yesterday's import of 980 contacts, **when** the administrator undoes it, **then** 977 go to the recycle bin
  and the 3 edited since are kept and listed. `(advanced)`
- **Given** a messy file (two header rows, a "Full name" column, three date formats), **when** the user asks the
  assistant to prepare it, **then** proposed steps (skip a row, split a column, parse dates as day-month-year) show with
  20 rows before and after; accepted, they are saved with the mapping template. `(advanced)`
- **Given** a file shaped like one imported last month, **when** it is uploaded, **then** the earlier mapping and value
  choices are applied and marked as learned. `(advanced)`

### 2.2 Edge cases & failures

- **Given** a user without the create permission of a record type, **then** that type is not offered and its import route
  answers `403`; a user without `DATA_IMPORT_MANAGE` sees only their own import runs.
- **Given** a file over 200 MB or 1,000,000 rows, a password-protected spreadsheet or the legacy binary spreadsheet
  format, **then** it is refused with the reason and, for the legacy format, a hint to save as XLSX or CSV.
- **Given** a record changed between the dry run and the run, **then** its row is validated again and reported as
  "changed since preview" when it no longer passes.
- **Given** rows that fail, **then** the others are written, the run ends as partly done, and the error file holds the
  original columns of the failed rows with a reason column; nothing earlier is rolled back.
- **Given** a worker that stops during a run, **then** the run resumes from the last committed batch and no row is
  written twice.
- **Given** an import of 50,000 records, **then** their events carry the import as source and notifications to people are
  muted by default, so automations can tell imported changes apart.
- **Given** records of two organizations or of a type without declared references, **then** merging is not offered; a
  deleted record whose parent is deleted asks to restore the parent first.
- **Given** `FEATURE_DATA_EXCHANGE` off, **then** new routes answer `404`, and the tenant export and import page and the
  bulk-create routes behave exactly as today.

## 3. Functional Requirements

### 3.1 Scope, flags and compatibility

- **FR-1** The system loads only when `GAUZY_DATA_EXCHANGE_ENABLED` is exactly `true` and gates every new route, menu
  entry and MCP tool with `FEATURE_DATA_EXCHANGE`; off, they answer `404`.
- **FR-2** The system keeps the tenant export and import, its history, id mapping and redaction, the bulk-create routes,
  the soft delete and restore routes and the task trash working unchanged; with the feature on, the tenant export and
  import page also opens as a tab of Settings → Data while its own address keeps opening it as today, and its imports
  appear in the one import history of FR-40.
- **FR-3** The system only adds routes and fields; nothing existing is renamed, repurposed or removed.

### 3.2 Import targets

- **FR-4** The system offers as import targets every registered record type that declares how to create or update its
  records, custom record types included, with standard fields and the custom fields the user may edit. Time entries are
  imported through the existing time import (which checks entries against recorded time) and documents through the
  Documents import; neither is a target here.
- **FR-5** The system accepts from any plugin import profiles for composite targets (customers or suppliers with people
  and addresses, documents with lines, opening balances, a chart tree) with their match keys, child collections,
  references, checks and preview.
- **FR-6** The system ships composite profiles for customers and suppliers with their people and addresses in one file.
- **FR-7** A user with `DATA_IMPORT_RUN` can import into a target only with its create permission (create mode) or edit
  permission (update mode); custom record types follow their import access per role.
- **FR-8** The system offers a template file per target with the chosen fields as headers, required ones marked, a
  help row on request, sample rows, child columns, and, for updates, the existing records with their match key.
- **FR-9** The system starts an import from a list's empty state, a list's menu and Settings → Data, with a short guide
  for a first import.

### 3.3 Files and reading

- **FR-10** The system reads CSV (delimiter and quoting detected or chosen, UTF-8, UTF-16 and single-byte encodings
  detected or chosen), XLSX (sheet and header row chosen) and JSON arrays, up to 200 MB and 1,000,000 rows.
- **FR-11** The system reads a published file from an https address the user gives, refusing private network addresses
  and files over the size limit.
- **FR-12** The system detects per column the date, time and number format (decimal and thousands separators) and lets
  the user change it.
- **FR-13** The system shows the first 20 rows as they will be saved, with warnings per cell.
- **FR-14** The system refuses password-protected spreadsheets and the legacy binary spreadsheet format with the reason.

### 3.4 Mapping

- **FR-15** The system matches columns to fields by header, field label in any language and key, and lets the user map a
  column to a field, to a child field, or to nothing.
- **FR-16** The system lets the user set a constant or a default for a field without a column.
- **FR-17** The system maps file values to choices (statuses, options, tags) by key or label in any language, and lets the
  user map the rest by hand or skip their rows.
- **FR-18** The system resolves references by number, code, title, email or id as the target declares, and, when the user
  allows and may create them, creates missing referenced records of simple types (tags, groups, categories).
- **FR-19** The system applies declarative transforms to columns: trim, change case, replace, split into columns, join
  columns, parse a date with a format, parse a number with a unit, map empty to a value.
- **FR-20** A user with `DATA_IMPORT_RUN` can save the mapping, value mapping, transforms and options as a private mapping
  template; a user with `DATA_IMPORT_MANAGE` can share one with the organization.
- **FR-21** The system lists the fields of a target that no column fills and stops a run that would leave a required one
  empty.

### 3.5 Validation, dry run and duplicates

- **FR-22** The system validates each row as a form save would (required, unique, bounds, field rules, workflow state,
  field edit permissions, organization) and reports each problem with row, column, value and reason.
- **FR-23** The system offers a dry run that validates and resolves every row and reports per row "create", "update"
  (with each field before and after), "unchanged", "skip", "duplicate" or "error", writing nothing.
- **FR-24** The system finds duplicates inside the file by the target's match keys before writing.
- **FR-25** The system lets the user download the failed rows, the skipped rows and the full row log as CSV or XLSX, with
  the original columns and a reason column.
- **FR-26** The system distinguishes errors (the row is not written) from warnings (written, reported).
- **FR-27** The system keeps a dry run's result for 7 days so the run can start from it without reading the file again.

### 3.6 Modes and structures

- **FR-28** The system imports in create, update or create-or-update mode; update matches by id or a declared match key
  (number, code, email, external reference) chosen by the user.
- **FR-29** The system writes in update mode only fields that change; an empty cell leaves the value unless the user
  chose "empty cells clear".
- **FR-30** The system imports child rows given as continuation rows with blank parent columns, as repeated parent
  columns, or as a second sheet joined by a key column.
- **FR-31** The system imports trees by a parent column (code or title), resolves parents created earlier in the same
  file, refuses cycles, and shows a tree preview.
- **FR-32** The system resolves references declared as second pass (such as reporting lines between employees of the
  same file) after all rows are created.
- **FR-33** The system imports business documents as drafts and, when the user asks and may confirm them, confirms them
  through their lifecycle afterwards.

### 3.7 Running imports

- **FR-34** The system runs an import in the background in batches of 200 rows, each batch committed on its own, with
  live progress, rows per second, an estimated end and a cancel action.
- **FR-35** The system ends a run as done, partly done, failed, cancelled or timed out (3 hours by default), with counts
  of created, updated, unchanged, skipped and failed rows.
- **FR-36** The system resumes a run after a restart from its last committed batch without writing a row twice.
- **FR-37** A user with `DATA_IMPORT_RUN` can fix the failed rows and import them again into the same run with the same
  mapping.
- **FR-38** The system marks each written record with its import run, shows "Created by import" or "Updated by import" in
  the record's timeline, and opens the run's records as a list.
- **FR-39** The system mutes notifications to people during an import by default, publishes record events with the
  import as source, and runs automations unless the user turns them off for the run.
- **FR-40** A user with `DATA_IMPORT_RUN` sees their own runs; a user with `DATA_IMPORT_MANAGE` sees every run of the
  organization. Mapped imports and tenant archive imports are listed in one import history.

### 3.8 Exports

- **FR-41** A user with `DATA_EXPORT` can export a record type or a saved view: all matching, selected, a 10-row sample, or
  an empty template.
- **FR-42** The system exports chosen columns, custom fields and child collections (as extra sheets or repeated rows) as
  CSV, XLSX or JSON, in the user's language and formats, with a header row of labels or keys.
- **FR-43** The system offers "export for update": the match key and the fields an update import accepts, round-tripping
  without edits as all "unchanged".
- **FR-44** The system runs exports above 50,000 rows in the background and delivers a link in the inbox, up to 5,000,000.
- **FR-45** The system applies the reader's record access and field masks, redacts secrets as the tenant export does, and
  neutralises cells a spreadsheet would read as formulas.
- **FR-46** The system logs every export (who, when, target, filter, columns, row count, format).
- **FR-47** A user with `DATA_EXPORT` can save the columns and format of an export as an export template.

### 3.9 Bulk change

- **FR-48** A user with `DATA_BULK_CHANGE` can set fields on all records matching a saved view or listed in a file, with
  values or formulas over the record's fields, without a record cap.
- **FR-49** The system previews a bulk change with counts and the first 50 changes before and after, and writes nothing
  until confirmed.
- **FR-50** The system writes each record through its own update rules and permissions (the record type's existing bulk
  update where it has one), reports done, unchanged, refused or failed per record, and runs in the background with
  progress.
- **FR-51** The system undoes a bulk change within 7 days for records nobody changed since, listing the others.

### 3.10 Rename and merge

- **FR-52** A user with `RECORD_RENAME` can change the number, code or name a record type declares renamable, from the
  record or in bulk from a file of old and new values, with a log of refused rows.
- **FR-53** A user with `RECORD_MERGE` can merge one or more records into another of the same type and organization when
  they may edit the kept record and delete the others.
- **FR-54** The system previews a merge with the count of references per referencing type and lets the user choose the
  surviving value per field.
- **FR-55** The system repoints on merge every declared reference, polymorphic links (comments, mentions, followers,
  tags, reactions, favourites, files, activity, notes), custom-field references and child rows, in one transaction per
  merged record or as a background job above 10,000 references.
- **FR-56** The system sends the merged records to the recycle bin marked "merged into" and adds a timeline entry on the
  kept record.
- **FR-57** The system refuses a merge the record type's own rules forbid (a person with tracked time into another
  organization, a confirmed document) with the reason.
- **FR-58** The system undoes a merge within 7 days: references still on the kept record move back and the merged
  records return, unless they changed since. `(advanced)`

### 3.11 Recycle bin, safeguards and archiving

- **FR-59** The system lists deleted records of every registered record type in one recycle bin with type, title, who
  deleted them and when, filters and search.
- **FR-60** A user with `RECYCLE_BIN_VIEW` can restore what they deleted of types they may edit, and a user with
  `RECYCLE_BIN_MANAGE` anything; restoring brings back the dependents deleted with the record. Tasks and documents are
  restored and purged with the rules of their existing trash (who may restore, events published once); the existing
  task trash page stays and links to the bin filtered to tasks, showing the same tasks.
- **FR-61** The system gives a restored record a free name or number when its own was taken meanwhile, and says so.
- **FR-62** The system keeps deleted records as today, with no purge, unless a retention period is set for the
  organization (for every type or per type) in the platform's retention settings (`access-control-and-security`, where
  the recycle bin is declared with the default "keep as today" and legal holds are respected; the form suggests 120 days), and then purges the records deleted longer ago than that period; a user with
  `RECYCLE_BIN_MANAGE` can purge earlier after confirming that purging cannot be undone.
- **FR-63** The system lists, before a deletion, the records that reference it (recursively, up to 1,000) and offers to
  detach or delete dependents where the type allows; it refuses the deletion only on references that the record's type
  refuses today, that a record type added by a new feature declares blocking, or, where the organization turns on
  blocking deletion of referenced records (off by default), on any reference.
- **FR-64** A user with `DATA_ARCHIVE_MANAGE` can define archive rules (records of a saved view older than a period) that
  mark records archived, hide them from default lists, optionally after exporting them to a file.
- **FR-65** The system purges the import, error and export files of this feature after 30 days by default, a period of
  the platform's retention settings; the tenant export's archives are kept as today.

### 3.12 Migration toolkits

- **FR-66** The system offers migration toolkits: an ordered checklist of import steps (masters first, then open items
  and opening figures), each with a profile, a template file and a mapping, with dependencies between steps; the ids
  carried in the files are remembered, so later steps and re-imports resolve references by those ids,
  as the existing integration importers do.
- **FR-67** The system runs a dry run of every step of a toolkit before any is written and shows the progress of each.
- **FR-68** The system accepts toolkits from plugins and installed apps and ships a starter kit (organizations' teams and
  projects, contacts, suppliers, items, employees) and, with their plugins loaded, opening balances and open items.

### 3.13 Advanced capabilities

- **FR-69** The system remembers per target the mapping, value choices and transforms of past imports by the shape of the
  header row, applies them to a file of the same shape, and marks them as learned. `(advanced)`
- **FR-70** The system finds likely duplicates against existing records before writing (exact match keys, normalised
  email, phone and name similarity) and lets the user decide per row or for all: skip, update the existing, create
  anyway, or merge into it. `(advanced)`
- **FR-71** A user with `DATA_IMPORT_RUN` can undo their import as a batch within 7 days: created records go to the
  recycle bin and updated fields return to their values before the import, except records changed since, which are
  listed. `(advanced)`
- **FR-72** A user with `DATA_IMPORT_RUN` can ask the assistant to prepare a messy file; the assistant, given the headers
  and at most 20 sample rows, proposes a mapping and transforms with an explanation, shown as 20 rows before and after;
  the engine applies accepted steps to the whole file. `(advanced)`
- **FR-73** A user with `DATA_IMPORT_MANAGE` can schedule an import from an https address or a drive folder with a
  mapping template (hourly, daily, weekly, with the platform's recurrence rules), each run reported like a manual one.
  `(advanced)`
- **FR-74** A user with `DATA_EXPORT` can schedule an export of a saved view to a drive folder or to their inbox, daily,
  weekly or monthly, with the platform's recurrence rules. `(advanced)`
- **FR-75** The system proposes merge candidates among existing records of a type by the same duplicate rules, for a
  user with `RECORD_MERGE` to review. `(advanced)`

### 3.14 API, MCP, events and reports

- **FR-76** The system exposes targets, templates, mapping templates, import runs and rows, exports, bulk changes,
  renames, merges, the recycle bin, where-used checks, archive rules and toolkits through REST.
- **FR-77** The system offers MCP tools to list targets, start an import from a file or link with a dry run by default,
  read its report, commit or undo it, export a view or type, preview and run a merge, and restore from the recycle bin,
  under the caller's permissions. `(advanced)`
- **FR-78** The system publishes events for import runs (started, finished, undone), exports, merges, renames, restores
  and purges, for webhooks, real-time progress and automations.
- **FR-79** The system takes over exports of saved views above 50,000 rows and templated exports, and offers automations
  actions to export a view and to import from a link.
- **FR-80** The system lists mapping and export templates that use a custom field in that field's impact analysis.
- **FR-81** The system registers these reports with the report builder:

  | Report | Answers |
  |---|---|
  | Import runs | runs per target, user and outcome with row counts and duration |
  | Import errors | failed rows by target, field and reason; the most frequent problems |
  | Exports | who exported which target or view, when, how many rows and in which format |
  | Merges and renames | merged and renamed records per type and user, with undo status |
  | Recycle bin | deleted records per type and user, restored and purged per period |
  | Duplicate candidates | proposed merge candidates per type and their review status |

## 4. Non-Functional Requirements

- **Performance**: mapping preview of 20 rows under 1 s for files up to 50 MB; dry run of 10,000 rows under 30 s;
  imports of at least 200 rows per second for simple targets on PostgreSQL and MySQL (1,000 records under 10 s); exports
  of 1,000,000 rows within 10 minutes; recycle bin page under 500 ms P95; where-used check under 1 s for 1,000 references.
- **Volume**: 1,000,000 rows and 200 MB per file; 500 mapping templates and 10,000 runs per tenant kept for a year.
- **Reliability**: batches commit on their own; runs resume after a restart without writing a row twice; merges commit
  per merged record with a journal for undo; undo never overwrites a change made after the import.
- **Security & privacy**: imports validate as forms and respect field edit permissions; exports respect record access and
  masks, redact secrets and are logged; files are stored in the tenant's file storage and purged on schedule. Data leaving
  the platform: export files to users; links fetched from addresses the user gives (outbound https only); to the tenant's
  AI provider, the header row and at most 20 sample rows when the user asks for help with a file.
- **Observability**: run and row logs, export log, merge journal; metrics for rows per second, failure rate per target,
  queue depth and undo counts.
- **Accessibility and localisation**: the wizard is keyboard operable and announced; labels and choices match in every
  language; dates and numbers read in the formats chosen per column.
- **Compatibility**: PostgreSQL, MySQL, SQLite (single batch writer); both ORMs; cloud and self-hosted; OpenAPI additive.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| Import target, import profile | A record type that can be imported; a plugin's composite target with its checks |
| Import run, import row | One import of one file with options and outcome; one row's result and before-image |
| Mapping template | Saved column mapping, value mapping, transforms and options for a target |
| Learned mapping | Choices remembered for a header shape |
| Export run, export template | One export with its log entry; saved columns and format |
| Bulk change | A set of field changes over a view or file, with per-record results and undo |
| Merge, merge journal | Records folded into one; the references moved, for undo |
| Rename | A change of a record's declared identifier |
| Recycle bin entry | A deleted record with who, when and its dependents |
| Archive rule | A view and age that mark records archived |
| Migration toolkit | An ordered set of import steps for a new organization |

## 6. Out of Scope

- Backups and restore of a whole tenant or server: `platform-administration` (the tenant export stays as it is).
- Sync with outside shops and marketplaces: `commerce-connectors`; connectors and sync jobs: `integration-hub`.
- Files attached to records, folders and file storage: `drive`.
- Interface translations and translation management, system-wide settings: `platform-administration`.
- Number, date and currency formats and time zones per organization: `organization-setup`.
- People and organisations as records, address books and address formats: `crm-leads-and-deals`.
- Bank statement formats and their import: `banking-and-reconciliation`; structured electronic invoices:
  `regional-compliance-packs`.
- List exports up to 50,000 rows and bulk actions on a selection: `record-views-and-search`.
- Personal-data export and erasure, and the retention settings the recycle bin follows: `access-control-and-security`.
- Time entry import: the existing time import; document import and export: the Documents hub's own import and export.

## 7. Acceptance Criteria

- [ ] **AC-1** 1,000 contacts import from XLSX with a custom field, value mapping and an error file; the dry run counts
      equal the run's (FR-20, FR-23, FR-26).
- [ ] **AC-2** An "export for update" re-imported reports every row unchanged; a price change writes only that field (FR-23, FR-43, FR-50).
- [ ] **AC-3** Documents with lines (continuation rows and two sheets), a tree with a cycle, and a second-pass reference
      import as specified (FR-30–FR-32).
- [ ] **AC-4** A run stopped mid-way resumes without duplicates; failed rows re-import into the same run (FR-36, FR-37).
- [ ] **AC-5** CSV, XLSX and JSON exports match the view without masked columns, formulas neutralised, each logged (FR-42, FR-45).
- [ ] **AC-6** A bulk change over a view previews, writes per record through its rules and undoes (FR-48–FR-51).
- [ ] **AC-7** A merge repoints deals, invoices, tasks, comments, files and custom-field references and undoes (advanced:
      merge undo) (FR-55, FR-58).
- [ ] **AC-8** A bulk rename from a file logs refused rows (FR-52).
- [ ] **AC-9** The recycle bin restores three types with dependents and name conflicts; purges after a retention period
      set for the organization, and keeps every deleted record while none is set (FR-60, FR-61, FR-65).
- [ ] **AC-10** Deleting a vendor referenced by purchase orders or expenses is refused with the list of references, as
      that deletion is refused today; a record whose deletion is allowed today (a contact referenced by deals) is deleted
      as today unless the organization setting `data.blockReferencedDeletion` (off by default) is on (FR-63).
- [ ] **AC-11** The starter toolkit loads an empty organization in order after a dry run of every step (FR-66, FR-67).
- [ ] **AC-12** A second file of the same shape maps itself; a recurring import skips an unchanged file (advanced:
      learned mappings, schedules) (FR-69).
- [ ] **AC-13** Duplicates are flagged before writing and each decision applied; nightly merge candidates are proposed
      (advanced: duplicates; FR-24, FR-70, FR-75).
- [ ] **AC-14** An import undone the next day leaves edited records and lists them (advanced: undo; FR-71).
- [ ] **AC-15** The assistant's steps for a messy file preview 20 rows and the request holds only headers and 20 rows
      (advanced: assisted cleaning; FR-72).
- [ ] **AC-16** An agent imports through MCP with a dry run first and commits after (advanced: MCP; FR-77).
- [ ] **AC-17** The six reports of FR-81 return correct figures on seeded data.
- [ ] **AC-18** Feature off: `404` on new routes; tenant export and import, bulk routes and task trash as before (FR-1, FR-2).
- [ ] **AC-19** Feature on with default settings: no deleted record is purged, a record of an existing type is deleted
      wherever it could be deleted before, and the tenant export and import page opens at its own address as before (FR-62).
- [ ] **AC-20** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-1, FR-2).
- [ ] Works on PostgreSQL, MySQL and SQLite with both ORMs; all functional requirements have a passing test.

## 8. Open Questions

- Legacy binary spreadsheets are refused with a hint to save as XLSX or CSV (no approved reader). Default applied.
- Deleted records are kept as today unless a retention period is set for the organization (120 days suggested); import, error and
  export files of this feature are kept 30 days. Default applied.
- Automations run on imported records unless the user turns them off for the run; notifications to people are muted.
  Default applied.
- Undo of imports, bulk changes and merges is offered for 7 days. Default applied.

## 9. Constitution Gates

- [x] I Plugin-first — plugin pair `data-exchange`; core gains optional record type registry parts and a contributions member only.
- [x] II Tenant/organization scoping — every new record is scoped; merges never cross organizations.
- [x] III Both ORMs, additive migrations — new plugin tables on three dialects; no core table changes.
- [x] IV Default-off flag; nothing removed — deploy switch plus `FEATURE_DATA_EXCHANGE`; existing pages and routes stay.
- [x] V Contracts and API first — contracts, REST and SDKs before the wizard.
- [x] VI Permissions, privacy, security — new permissions, form-level validation, masked and logged exports (§4).
- [x] VII Real-time through the event bus — progress and record events through the outbox and the real-time channel.
- [x] VIII i18n and accessibility — keyboard wizard, labels and choices matched in every language.
- [x] IX Tests accompany the change — per requirement, with dialect and ORM parity specs.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Builds on: [`custom-fields-and-forms`](../custom-fields-and-forms/spec.md),
  [`record-views-and-search`](../record-views-and-search/spec.md), [`comments-and-trash`](../comments-and-trash/plan.md)
- Works with: [`report-builder-and-dashboards`](../report-builder-and-dashboards/spec.md),
  [`automation-and-notifications`](../automation-and-notifications/spec.md),
  [`business-document-engine`](../business-document-engine/spec.md), `access-control-and-security`, `drive`
- Code: `packages/core/src/lib/export-import/`, `packages/core/src/lib/api/{bulk-create,bulk-executor.service}.ts`,
  `packages/core/src/lib/operation/`, `apps/gauzy/src/app/pages/import-export/`
