# Feature Specification: Report builder and dashboards

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `report-builder-and-dashboards`
**Branch**: `feat/report-builder-and-dashboards`
**Status**: `Draft`
**Created**: 2026-11-16
**Last updated**: 2026-11-23
**Owner**: platform maintainers
**Feature flag**: `FEATURE_REPORT_BUILDER` (tenant feature, default off) · the plugin loads only when
`GAUZY_REPORT_BUILDER_ENABLED` is exactly `true` · existing reports and dashboards keep `FEATURE_REPORT` and
`FEATURE_DASHBOARD` and behave as today while the feature is off

---

## 1. Overview

Today the platform has eleven fixed reports (each a coded endpoint and a coded screen), saved reports for the Time and
Activity report only (with no screen in the Angular app), custom dashboards on a drag-and-drop canvas fed by 47 coded
widgets, built-in accounting, human resources, time, project and team dashboards, fixed charts, and CSV export on three
screens. This feature turns the catalogue into a **registry of report definitions**: a **dataset** (a registered record
type with its custom fields, or a computed dataset of a plugin), filters and prompts, columns, group-by, pivot, formula
columns, totals and a chart. Every plugin registers its reports as definitions; users run, clone and change them, build
their own on any record type, show any of them as a chart or **metric card**, compose **dashboards** with a shared filter
bar, run heavy reports in the background, schedule them by email and export CSV, XLSX and PDF. The existing reports,
saved reports and dashboards keep their pages and are registered as definitions and templates. Clients: the Angular
app, the MCP server and the SDKs; the existing time report routes stay unchanged.

**Advanced capabilities.** A user asks for a report in plain language and gets a reviewable definition, never a
silent result. **Every figure drills down** to the records behind it. Reports, cards and dashboards **update live** over
the real-time channel. A **semantic layer** defines measures and dimensions once per dataset so a number agrees on every
report and card. **Scheduled report packs** can carry a commentary an assistant writes from the figures. **Row-level and
field-level security** is enforced by the engine on every definition, export, schedule and card, not by each report.
Heavy datasets are answered from **aggregate snapshots** that need no code. Marked `(advanced)`.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** a sales manager on Reports → New, **when** they pick the dataset Deals, add owner, stage, the custom field
  "Region" and the sum of value, group by owner, pivot by stage, choose a stacked bar chart and save "Pipeline by owner"
  shared with the Sales role, **then** each member of that role finds it and sees only the deals they may read, with
  totals over those deals only.
- **Given** a dashboard with a filter bar (organization, period, team), **when** the user picks "last quarter" and team
  "Support" and then clicks the "Won" segment of a chart, **then** every card follows the bar and the other cards filter to
  won deals until cleared.
- **Given** a time report over three million time entries, **when** it is run, **then** it continues in the background
  and notifies the user, and the result stays downloadable for 7 days.
- **Given** a schedule "Every Monday 08:00, last week, PDF and XLSX, skip when empty" for the Sales team, **when** it fires,
  **then** each recipient receives the pack computed with their own access; a recipient without rows receives nothing.
- **Given** a card "Active employees: 42", **when** the manager clicks the figure, **then** the list of those 42
  employees opens with the card's filters. `(advanced)`
- **Given** the request "monthly revenue by customer group this year against last year", **when** the assistant answers,
  **then** the builder shows a draft (dataset, measure, dimensions, comparison) with an explanation and a preview run;
  nothing is saved until accepted. `(advanced)`
- **Given** a deals dashboard open on two screens, **when** a deal is won, **then** the affected cards change within
  3 seconds on both, highlighted. `(advanced)`
- **Given** a monthly pack with commentary, **when** it runs, **then** the email opens with a short text on the main
  changes against last month, each claim linked to its figure, marked as written by an assistant. `(advanced)`

### 2.2 Edge cases & failures

- **Given** a shared definition with the column "Salary", **when** a reader without the permission that reveals it runs
  it, **then** the column is absent (not empty), a notice says one column is hidden, and grouping by it is refused.
- **Given** an HR dataset with a minimum group size of 5, **then** a group of 3 shows "fewer than 5" everywhere.
- **Given** a definition using an archived custom field, **then** that column or filter shows as invalid with a remove
  action and the rest runs; **given** a dataset whose plugin is off, **then** its definitions show "source unavailable",
  their schedules pause and owners get one notice.
- **Given** two editors saving one shared definition, **then** the second is refused with the latest version; an export
  above 1,000,000 rows is refused with a suggestion to narrow the filters.
- **Given** a recipient who left the organization, or an email transport failing three times, **then** that delivery is
  listed as skipped or failed with the reason and the owner is notified once per run.
- **Given** a background run past its 30-minute limit, **then** it is marked timed out and the requester notified; a
  snapshot whose refresh failed answers with its "as of" time and a warning.
- **Given** no AI provider, **then** drafting, commentary and explanations are not offered and say why.
- **Given** `FEATURE_REPORT_BUILDER` off, **then** new routes answer `404` and the eleven reports, saved reports and
  dashboards behave exactly as today.

## 3. Functional Requirements

### 3.1 Scope, flags and compatibility

- **FR-1** The system loads only when `GAUZY_REPORT_BUILDER_ENABLED` is exactly `true` and gates every new route, GraphQL
  field, menu entry, widget kind and MCP tool with `FEATURE_REPORT_BUILDER`; off, they answer `404`.
- **FR-2** The system keeps the eleven report pages, their routes, filters and CSV exports, the per-organization "show in
  menu" switch, saved reports with their public links, and every dashboard and widget working unchanged.
- **FR-3** The system only adds routes, fields and widget kinds; nothing existing is renamed, repurposed or removed.

### 3.2 Datasets and the definition registry

- **FR-4** The system offers every registered record type that declares a list as a dataset, with its standard fields,
  the custom fields the viewer may see, fields one reference away and its declared child collections (lines).
- **FR-5** The system accepts from any plugin computed datasets (rows computed from parameters, such as a trial balance)
  with parameters, columns, measures, dimensions, drill targets, sensitive columns and invalidating events.
- **FR-6** The system accepts from any plugin system definitions with a catalogue category, a key, labels per language
  and a version; system definitions are read-only and can be cloned.
- **FR-7** The system runs and exports a definition its plugin marks as locked (statutory) exactly as shipped, refuses
  edits to it, and marks its clones as not the statutory version.
- **FR-8** The system registers the eleven existing reports as system definitions over their existing data, with the
  filters, groupings and figures of their pages, so they can be cloned, exported, scheduled and put on dashboards.
- **FR-9** The system shows saved Time and Activity reports as variants of that definition with their period rule,
  filters, grouping and public link unchanged.
- **FR-10** The system registers the built-in accounting, human resources, time, project and team dashboards as templates
  a user can copy into a dashboard of their own.
- **FR-11** The system lists in the catalogue, per category, system definitions, shared definitions, the user's own and
  those shared with them, with search, favourites and recently run, kept with the user's other favourites and recent
  items of the platform.
- **FR-12** The system links a clone to its base and version, shows a later base change and offers to apply it.

### 3.3 Semantic layer `(advanced)`

- **FR-13** The system defines measures (count, distinct count, sum, average, minimum, maximum, ratio, formula) and
  dimensions (fields, date grains, fiscal periods, hierarchies) once per dataset, picked by key. `(advanced)`
- **FR-14** A user with `REPORT_MEASURE_MANAGE` can add calculated measures and bucketed dimensions to a dataset for the
  tenant or one organization, with a description and an owner. `(advanced)`
- **FR-15** A user with `REPORT_MEASURE_MANAGE` can certify a measure; the system badges it and warns on a definition that
  redefines it inline that its figure may differ. `(advanced)`
- **FR-16** The system lists per measure the definitions, cards and schedules using it and refuses to delete one in use.
  `(advanced)`

### 3.4 Builder: columns, filters and prompts

- **FR-17** A user with `REPORT_DEFINITION_CREATE` can create a definition by picking a dataset, columns, measures,
  filters, prompts, sorting, grouping, a chart and a name, with a live preview of the first 100 rows.
- **FR-18** A user with `REPORT_DEFINITION_CREATE` can add, order, rename, resize, format (number, money, percent,
  duration, date) and hide columns, including custom fields, fields one reference away and child collection fields.
- **FR-19** The system reads a definition over a child collection as one row per line with its parent's fields, and lets
  group-by and measures combine the parent's and the line's fields.
- **FR-20** The system offers the filter conditions of saved views (all/any groups, negation, operators by field kind,
  relative dates, me, my teams, my reports, under a tree node) and starts a definition from a saved view.
- **FR-21** The system offers prompts the reader sets at run time: date range with presets, values from a list,
  reference picker with search, number range, yes or no, text contains; each with a default, required or optional.
- **FR-22** The system offers in prompt pickers only values the reader may read, and validates every filter, prompt,
  column and measure against the dataset on save and on run, refusing an unknown or unreadable item by name.
- **FR-23** The system computes formula columns with the platform's formula language (arithmetic, text, dates,
  conditions, rounding); a formula error leaves the cell empty and is listed once per run.
- **FR-24** A user with `REPORT_DEFINITION_CREATE` can set the default print template and letterhead of their definition
  when print templates are loaded.

### 3.5 Grouping, pivot, totals and comparisons

- **FR-25** The system groups rows by up to three dimensions with collapsible subtotals per level and a grand total.
- **FR-26** The system pivots one or two dimensions on rows, one on columns and one or more measures as values, with row
  and column totals; column values beyond 50 fold into "Others".
- **FR-27** The system keeps the top or bottom N groups by a measure (the rest folded into "Others") and shows running
  totals and shares of the total when a definition asks.
- **FR-28** The system compares measures with the previous period, a year earlier or a fixed range (difference, %).
- **FR-29** The system totals money per currency and, when asked, converts to one currency at the row's date or the report
  date, naming a missing rate instead of totalling without it.
- **FR-30** The system colours cells or rows by rules on a measure (above, below, between, top N).

### 3.6 Charts and metric cards

- **FR-31** The system shows a definition as a chart: bar, column, stacked, 100 % stacked, line, area, bar with line,
  pie, donut, scatter, heatmap, funnel or gauge, with axis titles, value labels, a target line and an accessible palette.
- **FR-32** The system draws time charts (a measure by day to year over last N periods, this period or a custom range,
  gaps as zero) and group charts (a measure per value of a dimension, with a group limit and "Others").
- **FR-33** The system shows metric cards of one measure (count, sum, average, minimum, maximum) with filters, the change
  against the previous day, week, month, quarter or year, a colour rule, and an abbreviated or full number.
- **FR-34** The system gives every chart a table alternative and a text summary for screen readers, and applies the
  viewer's references ("me", "my teams") and the dashboard filter bar to charts and cards.

### 3.7 Viewer

- **FR-35** A user with `REPORT_DEFINITION_VIEW` can run a definition they may see, set prompts, sort, group, hide,
  reorder and resize columns, search inside the result, switch between table, pivot and chart, and refresh.
- **FR-36** The system keeps each user's last prompts, column settings and layout per definition on every device.
- **FR-37** The system opens a result's referenced record in a side panel and offers save as, export, print, schedule
  and add to dashboard.
- **FR-38** The system shows when figures were computed, from live data or from a snapshot with its "as of" time.
- **FR-39** The system pages interactive results up to 200,000 rows and beyond offers an export or narrower filters.
- **FR-40** The system keeps labels of definitions, columns, prompts and categories per language and shows the reader's.

### 3.8 Dashboards

- **FR-41** The system lets a dashboard hold report cards (charts, metric cards, tables and pivots), the existing coded
  widgets, saved-view cards and text blocks on the existing canvas, with size and position per card.
- **FR-42** The system gives a dashboard a filter bar of chosen prompts (organization, period, team, project, employee,
  any dimension) that every card using that dimension follows unless the card opts out.
- **FR-43** The system filters the other cards by a value clicked in a chart or table (cross-filter) until cleared, and
  opens the records behind a clicked figure (FR-74).
- **FR-44** A user with `DASHBOARD_SHARE` can share a dashboard with people or teams (`REPORT_DEFINITION_MANAGE`: roles,
  organization) through the record sharing of `access-control-and-security`; each reader sees each card with their own
  access. Without that feature a dashboard is private or open to the whole organization. A dashboard that exists keeps
  the readers it has today: sharing only adds readers, and making it private is its owner's choice.
- **FR-45** The system lets a reader of a shared dashboard hide and rearrange cards for themselves only.
- **FR-46** A user with `DASHBOARD_READ` can set a dashboard as their home page (the existing default dashboard switch);
  a user with `REPORT_DEFINITION_MANAGE` can set a default dashboard per role; a user's own choice wins over the role's.
- **FR-47** The system accepts dashboard templates (cards and filter bar) shipped by plugins; a copy links to its template.
- **FR-48** The system shows a dashboard full screen with automatic refresh for a wall display.
- **FR-49** The system makes cards embeddable in record pages (the dashboard layout of saved views) and summary digests.

### 3.9 Sharing and access enforced by the engine `(advanced)`

- **FR-50** A user with `REPORT_DEFINITION_SHARE` can share a definition for reading or editing with people or teams, and
  a user with `REPORT_DEFINITION_MANAGE` with roles or the organization; a definition is private otherwise. Sharing with
  people, teams and roles is the record sharing of `access-control-and-security`; without it a definition is private or
  open to the whole organization.
- **FR-51** The system applies the reader's record access (read scope, organization membership, employee visibility, and
  `access-control-and-security` record rules when loaded) to every run, total, card, drill, export and schedule.
  `(advanced)`
- **FR-52** The system drops columns, measures and dimensions over fields the reader may not see (custom field and
  permission-gated fields, sensitive columns, field-level rules when loaded) and refuses filters on them.
  `(advanced)`
- **FR-53** The system honours a dataset's minimum group size: smaller groups show "fewer than N" and are left out of
  drill-down for readers without the permission the dataset names. `(advanced)`
- **FR-54** The system never widens access through sharing: a reader sees what they could read in a list.
- **FR-55** The system logs each run, export, print and delivery (who, when, definition, prompts, columns, row count); a
  user with `REPORT_DEFINITION_MANAGE` can read the log, and the access audit of `access-control-and-security` shows its
  entries without copying them.

### 3.10 Background runs, snapshots and performance

- **FR-56** The system runs a definition in the background when it is marked heavy, when its last three runs took over
  5 seconds, or when the reader asks, and notifies the reader when it is ready.
- **FR-57** A user with `REPORT_DEFINITION_VIEW` can list their background runs with status, duration, rows and size,
  cancel one and download results; a user with `REPORT_RUN_ADMIN` sees and cancels all.
- **FR-58** The system keeps background results 7 days (72 hours when sent by email), expires runs stalled for 30 minutes,
  and stops runs at 30 minutes by default; results and the run log (90 days) follow the platform's retention settings.
- **FR-59** The system splits a background run over a dataset that declares partitions (organization, month) into parts
  run in parallel and merged, and offers the same runner to computed datasets.
- **FR-60** A user with `REPORT_DEFINITION_MANAGE` can snapshot a dataset's aggregates (dimensions, grain, measures,
  refreshed hourly, daily, weekly or on events) without code; covered runs read it with its "as of" time. `(advanced)`
- **FR-61** The system caches identical runs per reader access for 60 s, dropped when an invalidating event arrives.

### 3.11 Schedules and delivery

- **FR-62** A user with `REPORT_SCHEDULE_MANAGE` can schedule one or several definitions (a pack) daily, on weekdays,
  weekly on chosen days, monthly on a day or the last day, quarterly, or by a custom rule, at a time in a time zone,
  with the same recurrence rules as recurring invoices.
- **FR-63** A user with `REPORT_SCHEDULE_MANAGE` can set prompts as values or ranges relative to the run date, formats
  (email body, XLSX, CSV, PDF), a row limit, an introduction and "skip when empty".
- **FR-64** The system sends a conditional schedule only when its measure condition holds ("overdue amount above
  10,000") and records the run as skipped otherwise. `(advanced)`
- **FR-65** The system sends to people, teams and roles, each internal recipient getting the pack computed with their own
  access; addresses outside the tenant need `REPORT_SCHEDULE_EXTERNAL` and receive the owner's access.
- **FR-66** The system sends each delivery once per schedule, period and recipient however often a run is retried,
  through the platform's email and in-app notices honouring each recipient's preferences.
- **FR-67** The system lists each schedule's runs and deliveries (sent, skipped, failed with reason), pauses a schedule
  after three failed runs in a row and notifies its owner; a user can send a test to themselves.
- **FR-68** The system limits a user to 50 schedules by default (tenant setting) and pauses a schedule whose owner leaves,
  offering it to an administrator.

### 3.12 Exports and print

- **FR-69** A user with `REPORT_EXPORT` can export a result as CSV, XLSX (styled header, totals row, number and date
  formats, frozen header, a sheet per first-level group on request), PDF or JSON, or copy it to the clipboard.
- **FR-70** The system keeps in exports the viewer's columns, order, formats, totals and language, applies masking, and
  neutralizes cells a spreadsheet would read as formulas.
- **FR-71** The system runs exports above 50,000 rows in the background and delivers a link in the inbox, up to 1,000,000.
- **FR-72** The system prints a definition with its print template and letterhead when print templates are loaded, else
  as a plain table with header, page numbers, prompts and computation time.
- **FR-73** A user with `REPORT_EXPORT` can export a chart or card as an image and its data as CSV.

### 3.13 Drill-down, plain language, live updates and commentary `(advanced)`

- **FR-74** The system drills down from every cell, total, chart point and card figure to the records behind it, under the
  definition's filters, the cell's values and the reader's access; computed rows drill on to records. `(advanced)`
- **FR-75** The system lets a drilled list be saved as a view, exported or acted on in bulk. `(advanced)`
- **FR-76** A user with `REPORT_DEFINITION_CREATE` can describe a report in plain language; the assistant, given only the
  dataset catalogue and the user's own references, returns a draft with an explanation per choice and a preview under
  the user's access; nothing is saved until accepted. `(advanced)`
- **FR-77** The system refreshes the affected figures of an open report, card or dashboard within 3 seconds of an
  invalidating event of its dataset, highlights what changed, and lets the reader freeze the page. `(advanced)`
- **FR-78** The system adds a commentary when a schedule asks: an assistant gets only the pack's masked figures and the
  previous period's, writes up to 200 words linking each claim to a figure, marked as an assistant's. `(advanced)`
- **FR-79** The system holds a commentary for the owner's review when asked, up to 24 hours. `(advanced)`
- **FR-80** The system answers "Explain this figure" with the dimension values that moved it most against the comparison
  period, computed by the engine and worded by the assistant. `(advanced)`

### 3.14 API, MCP, events and other engines

- **FR-81** The system exposes datasets, measures, definitions, runs, results, drill-down, exports, dashboards, schedules
  and deliveries through REST, with GraphQL for reads.
- **FR-82** The system offers MCP tools to list datasets and definitions, run a definition with prompts, drill a figure,
  draft a definition from text (preview), export, and create a schedule (preview), under the caller's permissions.
- **FR-83** The system publishes events for definitions (created, updated, shared, deleted), finished background runs and
  deliveries, for webhooks, real-time updates and automations.
- **FR-84** The system offers automations an action that sends a definition or pack, and offers summary digests its cards.
- **FR-85** The system creates a definition from a saved view's filter, columns, grouping and aggregates ("Save as
  report") and pins a saved view to a dashboard as a card.
- **FR-86** The system lists definitions, cards and schedules that use a custom field in that field's impact analysis.

### 3.15 Platform reports and the administration dashboard

- **FR-87** The system registers these definitions and cards over platform data:

  | Report or card | Answers |
  |---|---|
  | Background runs | runs per definition with duration, rows, status and requester; slowest definitions |
  | Report usage | runs, readers, exports and schedules per definition; definitions nobody ran in 90 days |
  | Schedule deliveries | sent, skipped and failed deliveries per schedule and period, with reasons |
  | Plugin contributions | what each loaded plugin registers (record types, datasets, definitions, permissions, widgets, menu entries) and keys claimed twice |
  | Job activity | background job runs per day by job and outcome; failed jobs and dead letters; jobs running now (cards) |
  | Notifications by kind | in-app notifications per kind and period |
  | Email activity | emails sent per day by template and status |
  | Sign-in activity | sessions started per day; failed sign-ins when the sign-in audit is loaded |
  | Users and members | users by role and status, members by kind (people, agents), totals as cards |
  | Parties, addresses and people | one row per address of customers, suppliers and employees with the people under them |
  | Open work items | open tasks and assignments by status, priority, assignee and linked record |

- **FR-88** The system ships an Administration dashboard of the cards of FR-87 for users with `REPORT_RUN_ADMIN`.
- **FR-89** The system lists the catalogue entries it adds (the "Platform" category and the rows of FR-87) on the Reports
  page, in the Reports menu and in a new organization's report switches only for tenants with `FEATURE_REPORT_BUILDER`
  on; with it off, the Reports page and menu show exactly today's reports.
- **FR-90** The system lists a report catalogue category or row that another feature adds with its feature code only
  for tenants with that feature on; categories and rows without a feature code, every existing one included, are listed
  as today.

## 4. Non-Functional Requirements

- **Performance**: a grouped run over one million rows with two dimensions under 2 s P95 (PostgreSQL, MySQL); a card
  under 500 ms P95 from cache or snapshot; a 12-card dashboard under 2 s; live refresh within 3 s; 1,000,000 rows
  exported within 10 minutes; schedules fire within 2 minutes; SQLite the same behaviour up to 200,000 rows per dataset.
- **Volume**: 5,000 definitions, 500 dashboards and 1,000 schedules per tenant; 50 pivot columns.
- **Reliability**: background runs resume after a worker restart; deliveries deduplicated per schedule, period and
  recipient; snapshots are rebuildable projections, never a source of truth.
- **Security & privacy**: every surface runs under the reader's access (FR-51 to FR-54); exports and deliveries logged.
  Leaving the platform: emails and files to recipients (outside addresses only with `REPORT_SCHEDULE_EXTERNAL`); to the
  tenant's AI provider, the dataset catalogue for drafting (no record data) and computed figures for commentary.
- **Observability**: the run log; metrics for run time, cache hits, snapshot freshness, queue depth, deliveries, fan-out.
- **Accessibility and localization**: chart alternatives, keyboard-operable builder and canvas, colour-blind-safe
  palette; labels per language; the reader's number, date and money formats; files in the recipient's language.
- **Compatibility**: PostgreSQL, MySQL, SQLite; both ORMs; cloud and self-hosted; OpenAPI additive; SDKs regenerated.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| Dataset | A registered source of rows: a record type, or a computed dataset of a plugin |
| Measure, dimension | A figure and an axis defined once per dataset (the semantic layer) |
| Report definition | Dataset, filters, prompts, columns, grouping, pivot, formulas, chart; system (code) or user (stored) |
| Definition version, variant, share | A saved state; a clone linked to its base; who may read or edit |
| Report run, run partition | One execution, live or in the background; one slice of a partitioned run |
| Aggregate snapshot | Maintained aggregates of a dataset by chosen dimensions and grain |
| Chart, metric card, report card | Visuals of a definition; a dashboard widget that shows one |
| Dashboard, filter bar | The existing dashboard; the prompts its cards follow |
| Report schedule (pack), delivery, commentary | When and to whom definitions go; one send; an assistant's text on it |
| Drill target | The records or rows behind a figure |

## 6. Out of Scope

- Written queries and outside data sources are not part of this feature.
- Each domain's report content (statements, ageing, stock, payroll and others): the domain specs.
- Print template design and letterheads: `print-and-pdf-designer`; email transport: `email-and-communications`.
- Record-level rules, field-level permissions, record sharing (definitions and dashboards are shared through it), the
  retention settings and the sharing, permitted-records and permission-matrix reports: `access-control-and-security`.
- Database storage usage, system health, job monitor pages: `platform-administration`.
- Saved views, list exports up to 50,000 rows and bulk actions: `record-views-and-search`; mapped imports and large
  templated record exports: `data-import-export`; summary digests: `automation-and-notifications`.

## 7. Acceptance Criteria

- [ ] **AC-1** A user-built definition on Deals with a custom field, two-level grouping, a pivot and a stacked chart saves,
      shares with a role and returns per-reader rows and totals (FR-25, FR-31, FR-32, FR-52).
- [ ] **AC-2** The eleven reports run as definitions with their pages' figures on seeded data; the pages still work; a
      saved Time and Activity report opens as a variant with its public link intact (FR-2, FR-8, FR-38).
- [ ] **AC-3** A clone applies its base's later change on request; a locked definition cannot be edited; prompts,
      formula columns, comparisons, top N, running totals and per-currency totals are correct (FR-12).
- [ ] **AC-4** A dashboard filter bar and cross-filter drive every card; a shared dashboard shows per-reader figures (FR-42, FR-43, FR-45, FR-47).
- [ ] **AC-5** A slow run goes to the background, notifies, downloads, expires; a partitioned run equals the live one (FR-56–FR-59).
- [ ] **AC-6** A weekly pack delivers once per recipient with their access, honours "skip when empty" and conditions (FR-63, FR-65, FR-66).
- [ ] **AC-7** CSV, XLSX and PDF exports match the viewer; 200,000 rows export in the background; formulas neutralised (FR-63, FR-69, FR-70, FR-73).
- [ ] **AC-8** A hidden column, a refused filter and a "fewer than 5" group behave as FR-52 and FR-53 in viewer, export,
      card and schedule (advanced: engine security).
- [ ] **AC-9** A card figure drills to exactly the records behind it (advanced: drill-down; FR-74, FR-75).
- [ ] **AC-10** A plain-language request yields an editable draft and preview without saving; the provider request holds
      no record data (advanced: drafting; FR-76).
- [ ] **AC-11** A won deal changes an open card on two clients within 3 seconds (advanced: live; FR-77).
- [ ] **AC-12** A certified measure gives one figure on three definitions and a card (advanced: semantic layer; FR-14–FR-16).
- [ ] **AC-13** A pack commentary links each claim to a figure and waits in review mode; "Explain this figure" returns
      drivers that add up to the change (advanced: commentary; FR-78, FR-79).
- [ ] **AC-14** A snapshot answers a covered run with its "as of" time (advanced: snapshots; FR-38, FR-60).
- [ ] **AC-15** The reports and cards of FR-87 and the Administration dashboard return correct figures on seeded data.
- [ ] **AC-16** Feature off: `404` on new routes; reports, saved reports and dashboards behave as before (FR-2).
- [ ] **AC-17** With the feature off the Reports page and menu list no "Platform" entry; with it on, every dashboard that
      existed is visible to the same people as before until its owner changes that (FR-89, FR-90).
- [ ] **AC-18** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-1).
- [ ] Works on PostgreSQL, MySQL and SQLite with both ORMs; all functional requirements have a passing test.

## 8. Open Questions

- The eleven report pages stay; the builder's viewer is a second way to run them; interactive pages stop at 200,000
  rows and exports at 1,000,000. Default applied.
- Outside email recipients need `REPORT_SCHEDULE_EXTERNAL`, granted to no role by default; commentary is sent without
  review unless the schedule's owner turns review on. Default applied.
- A minimum group size applies only where a dataset declares one (HR datasets declare 5); snapshots are aggregate rows
  in the database, not files. Default applied.

## 9. Constitution Gates

- [x] I Plugin-first — plugin pair `report-builder`; core gains only a plugin contributions member for datasets and definitions.
- [x] II Tenant/organization scoping — every new record is tenant and organization scoped; runs apply the reader's scope.
- [x] III Both ORMs, additive migrations — new plugin tables on three dialects; core tables unchanged.
- [x] IV Default-off flag; nothing removed — deploy switch plus `FEATURE_REPORT_BUILDER`; existing pages stay.
- [x] V Contracts and API first — registry contracts, REST, GraphQL reads and SDKs before the UI.
- [x] VI Permissions, privacy, security — new permission keys, engine-level scope and masking, data leaving in §4.
- [x] VII Real-time through the event bus — live figures from outbox events over the platform's real-time channel.
- [x] VIII i18n and accessibility — labels per language, chart alternatives, keyboard-operable builder.
- [x] IX Tests accompany the change — per requirement, with consistency checks against the existing reports.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Builds on: [`record-views-and-search`](../record-views-and-search/spec.md), [`custom-fields-and-forms`](../custom-fields-and-forms/spec.md),
  [`automation-and-notifications`](../automation-and-notifications/spec.md), [`realtime-channel`](../realtime-channel/spec.md)
- Works with: `access-control-and-security`, `print-and-pdf-designer`,
  [`financial-reports`](../financial-reports/spec.md), [`data-import-export`](../data-import-export/spec.md)
- Code: `packages/core/src/lib/reports/`, `packages/core/src/lib/saved-report/`, `packages/core/src/lib/dashboard/`,
  `packages/ui-core/core/src/lib/services/widget/`, `apps/gauzy/src/app/pages/reports/`,
  `apps/gauzy/src/app/pages/dashboard/custom-dashboard/`, `packages/ui-core/shared/src/lib/report/export/`
