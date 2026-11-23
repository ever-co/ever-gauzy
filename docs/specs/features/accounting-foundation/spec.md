# Feature Specification: Accounting foundation

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `accounting-foundation`
**Branch**: `feat/accounting-foundation`
**Status**: `Draft`
**Created**: 2026-11-15
**Last updated**: 2026-11-23
**Owner**: evereq
**Feature flag**: `FEATURE_ACCOUNTING` (default off)

---

## 1. Overview

An organization can keep its books inside the platform. This feature adds the master data every ledger needs: a chart of
accounts per organization (tree, account types, categories, controls), chart templates and an importer, fiscal years and
periods, ledger books, opening balances, and analytic dimensions (cost centres, projects, teams and any other axis) with
their rules and seasonal distributions. It is the first part of the new `accounting` plugin; journals, posting, locks
and closing are in `general-ledger`. Clients: the Angular app (whose account and dimension pickers the forms of other
features reuse), the REST and GraphQL API, the SDKs and the MCP server.

The hand-off fields for an outside accounting system stay and keep working; with the feature off nothing changes.

**Advanced capabilities.** Analytic dimensions are sourced from records the platform already has
(projects, teams, departments, employees, tags of a tag type) and filled in from tasks, tracked time and the tags on a
document, so analysis needs no re-keying;
shared costs can be allocated by tracked hours with the figures as evidence. Charts are versioned (a template upgrade is
a reviewed difference), can be shared down an organization tree, and an account merge is a reversible mapping that never
rewrites ledger lines. Setup is assisted: a readiness check, a mapping assistant for an existing trial balance, MCP tools
with previews, and live updates in every open client.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** an administrator of an organization without accounting, **when** they open Accounting → Setup, pick the
  general chart template and accept the fiscal year proposed from the organization's fiscal dates, **then** chart,
  monthly periods, primary ledger book and default dimensions exist and the readiness check lists what is missing.
- **Given** an accountant with a chart in a spreadsheet, **when** they upload it and map the columns, **then** they see
  the resulting tree with every problem marked on its row and can apply it once no blocking problem is left.
- **Given** subsidiaries that follow their parent's chart, **when** the group accountant adds an account in the parent,
  **then** each subsidiary has it within seconds, linked to the parent's, and cannot rename it locally.
- **Given** two accounts that mean the same, **when** an accountant merges one into the other after the preview,
  **then** ledgers show both histories under the target, no ledger line was rewritten, and the merge can be undone.
- **Given** an organization with an existing trial balance, **when** the accountant uploads the closing trial balance and
  the unpaid customer and supplier documents, lets the assistant map its existing accounts, previews and posts, **then** every
  account opens with its balance and each unpaid document is an open item with its due date.
- **Given** an employee tracking time on a task of project "Website" in team "Design", **when** that time reaches an
  invoice line or a cost posting, **then** the line carries project, team and department without anyone choosing.
- **Given** a shared cost centre and an allocation driven by tracked hours per project, **when** the period ends,
  **then** the system proposes an allocation journal with each project's hours and share, posted after a preview.
- **Given** an AI agent with chart permissions asked to "prepare a chart for a 20-person software agency", **then** it
  returns a template choice and proposed changes as a preview; nothing exists until a permitted person confirms.

### 2.2 Edge cases & failures

- **Given** a user without `ACCOUNTING_CHART_EDIT`, **when** they call a chart write route, **then** they receive `403`;
  with the tenant feature off every route of the feature is refused and the menu is hidden.
- **Given** two accountants editing one account, **when** the second saves, **then** they get a conflict with the
  current values and nothing is overwritten.
- **Given** an account with ledger lines, a designation or a rule naming it, **when** someone deletes, regroups or
  archives it, **then** the request is refused with the reason and the list of references.
- **Given** a follower that already has a local account with the same code, **when** the parent creates that code,
  **then** that follower reports a conflict finding and the other followers receive the account.
- **Given** an import of 8,000 rows interrupted by a restart, **when** it resumes or the file is uploaded again,
  **then** the chart ends as one complete import, never a partial tree.
- **Given** an opening balance that differs by more than the rounding tolerance, **when** it is posted, **then** it is
  refused and the difference is shown per currency.
- **Given** an archived project used as a dimension value, **when** a new line names it, **then** the line is refused,
  while past lines and reports keep showing it.

## 3. Functional Requirements

### 3.1 Activation and accounting profile

- **FR-1** The system exposes the routes, GraphQL fields, MCP tools and menu entries of this feature only where the
  plugin is loaded and `FEATURE_ACCOUNTING` is on; otherwise no existing page, route or document behaves differently.
- **FR-2** The system keeps one accounting profile per organization: a state (not started, in setup, live), a go-live
  date from which documents are posted and a ledger currency taken from the organization's currency at setup. The
  organization's currency stays editable as today; a later difference from the ledger currency is an advisory readiness
  finding and never changes the ledger. Refusing a change of the organization's currency once live is an organization
  setting, off by default.
- **FR-3** A user with `ACCOUNTING_SETTINGS_EDIT` can run a resumable setup: chart source (template, copy, import,
  empty), first fiscal year, period pattern, ledger books, dimensions to activate, default designations.
- **FR-4** The system runs a readiness check on demand and after every setup change, listing blocking findings (missing
  class root or required designation, no open fiscal year, required dimension without values, organization without a
  currency, control accounts without the open-item register) and advisory ones, each with a link to its fix.
- **FR-5** The system refuses go-live while a blocking finding exists and records who went live and when.
- **FR-6** The system keeps the tax plugin's posting key and every existing hand-off identifier untouched, so a tenant
  can run its books here and still feed an outside system.

### 3.2 Chart of accounts

- **FR-7** The system holds one chart per organization; every account belongs to one of five classes (asset, liability,
  equity, income, expense), from which its statement and natural balance side derive.
- **FR-8** The system distinguishes group accounts (hold children, never posted) from posting accounts; a parent is a
  group of the same organization and class; the five class roots cannot be moved, re-classed, archived or deleted.
- **FR-9** A user with `ACCOUNTING_CHART_VIEW` can browse the chart as a tree and a saved-view list, search by code or
  name, and see class, type, category, currency, state and (with `ACCOUNTING_LEDGER_VIEW`) the balance.
- **FR-10** A user with `ACCOUNTING_CHART_EDIT` can create, rename, recode, move within the class, reorder, archive and
  restore accounts; an account keeps its identity and history through every such change.
- **FR-11** The system enforces a code unique in the organization (case-insensitive), optional or required and shaped
  per organization setting, and a name unique among siblings; names accept translations per language.
- **FR-12** The system refuses to turn a group into a posting account while it has children, and a posting account into
  a group while it has ledger lines, a behavioural type, a designation or a rule naming it.
- **FR-13** The system deletes only an account that never had a ledger line and is referenced nowhere; any other can
  only be archived, which hides it from pickers and refuses new lines while keeping it in reports.
- **FR-14** A user with `ACCOUNTING_CHART_EDIT` can renumber a branch with a previewed bulk change (prefix, range shift,
  padding), applied completely or not at all.
- **FR-15** The system answers a concurrent edit with a conflict carrying the current values, and records who changed
  what, when, with before and after, for every chart change.

### 3.3 Account types, designations and controls

- **FR-16** The system assigns each posting account one account type; a type carries traits that drive behaviour:

  | Trait | Effect |
  |---|---|
  | money | offered as a bank or cash account in payments and banking |
  | control | every line needs a party of one role (customer, supplier, employee) and becomes an open item |
  | tax | offered to the tax engine when it maps tax amounts to accounts |
  | system-posted | only postings generated by the owning feature are accepted; manual lines are refused |
  | clearing | expected to return to zero; watched by the ledger integrity checks |
  | carry-forward | receives the result of the year at year-end close |
  | rounding, exchange difference, deferral | eligible for the matching designation and automatic lines |

- **FR-17** The system lets other plugins contribute account types with traits and allowed classes (stock, fixed assets,
  payroll); types of a plugin that is later switched off stay readable. `(advanced)`
- **FR-18** The system refuses a type change that adds or removes the control or system-posted trait, or changes the
  party role, on an account with ledger lines, and a type not allowed for the account's class.
- **FR-19** A user with `ACCOUNTING_CHART_EDIT` can designate, per organization, the one account for each default role
  (default receivable and payable, rounding, opening rounding, opening offset, retained earnings, realised and
  unrealised exchange difference, dimension clearing, inter-organization balances, roles of other features).
- **FR-20** The system refuses to archive, delete or regroup an account that holds a designation or is named by an
  account rule, posting rule, party account, tax mapping or item default, and lists those references.
- **FR-21** A user with `ACCOUNTING_CHART_EDIT` can fix an account to one currency; only lines in that currency are then
  accepted, and the currency can be set or changed only while every existing line matches it.
- **FR-22** A user with `ACCOUNTING_CHART_EDIT` can set an expected balance side with the action warn or block, which
  the ledger evaluates on every posting to the account.
- **FR-23** A user with `ACCOUNTING_CHART_EDIT` can mark an account restricted; postings started by a user without
  `ACCOUNTING_ACCOUNT_POST_RESTRICTED` are then refused, while system procedures keep posting.

### 3.4 Shared charts and merge

- **FR-24** A user with `ACCOUNTING_CHART_EDIT` in a child organization can make its chart follow an ancestor's: every
  structural change in the source is applied to each follower, whose accounts keep a link to their source.
- **FR-25** The system makes followed accounts read-only in the follower for code, name, parent, class and type, and
  allows local designations, controls and, when the source permits, local accounts under followed groups.
- **FR-26** The system applies a change to each follower completely or not at all; a follower that cannot apply it (code
  conflict) gets a finding visible in both organizations, and the others proceed.
- **FR-27** A user with `ACCOUNTING_CHART_EDIT` can stop following, for one account or the whole chart, when the
  source's policy allows it; accounts and links stay.
- **FR-28** The system offers the source-to-follower links as the default account mapping for consolidated statements.
  `(advanced)`
- **FR-29** A user with `ACCOUNTING_CHART_MERGE` can merge posting account A into B of the same organization when class,
  currency restriction and type traits agree and B is active, after a preview of line counts, balances per period before
  and after, the references that will move and the expected-balance result.
- **FR-30** The system refuses a merge whose combined balance would break a blocking expected balance side of B.
- **FR-31** The system merges without changing any ledger line: A becomes an archived alias of B, references and new
  postings go to B, and ledgers and reports show A's history under B with each line's original account kept.
  `(advanced)`
- **FR-32** A user with `ACCOUNTING_CHART_MERGE` can undo a merge until the first period close after it.
  `(advanced)`
- **FR-92** A user with `ACCOUNTING_CHART_MERGE` can merge several posting accounts into one in a single background run
  that previews and checks each source as in FR-29 and FR-30, shows progress, and ends done, partly done or failed with
  a result per account.

### 3.5 Chart templates, copy and importer

- **FR-33** The system offers a template catalogue: a general chart with codes and one without, templates contributed by
  country packs and other plugins, and tenant-saved ones, each with name, country, languages, version, review status and
  a browsable tree.
- **FR-34** A user with `ACCOUNTING_CHART_EDIT` can apply a template to an organization without ledger lines; after a
  tree preview the system creates accounts, types, categories, designations and suggested dimension rules in one
  all-or-nothing operation.
- **FR-35** The system offers templates marked "not reviewed" only when a tenant setting allows them, marks them in the
  catalogue, and records the user's acknowledgement when one is applied.
- **FR-36** The system records the template and version a chart came from and, when a newer version exists, shows the
  difference and applies the additions and renames a user selects; it never removes an account on upgrade.
  `(advanced)`
- **FR-37** A user with `ACCOUNTING_CHART_EDIT` can create a chart by copying another organization of the tenant (codes,
  names, types, categories, controls, designations; never balances) and save a chart as a tenant template.
- **FR-38** A user with `ACCOUNTING_CHART_IMPORT` can download the file layout (empty or filled with the current chart,
  CSV or spreadsheet), upload a file, map columns, see the resulting tree before anything is saved, and export the chart
  at any time in a form the importer accepts; import and export run through the platform's data import and export
  feature and are offered only where it is available.
- **FR-39** The system validates an import and marks each problem on its row:

  | Check | Result |
  |---|---|
  | required column missing, unreadable file | file refused |
  | parent not found, circular parentage | blocking, per row |
  | duplicate code in file or chart; duplicate name among siblings | blocking, per row |
  | branch not under exactly one class root; class differs from parent | blocking, per row |
  | unknown type or category; type not allowed for the class | blocking, per row |
  | a required designation role has no candidate account (replace mode) | blocking, for the file |
  | account without code where codes are required; unusual code length | advisory |

- **FR-40** The system imports in replace mode only for an organization that is not live and has no ledger line, and in
  merge mode (add; rename, recode or move matched accounts; never delete) at any time. `(advanced)`
- **FR-41** The system refuses an import into a chart that follows another organization until it stops following.
- **FR-42** The system runs large imports and template applications in the background with progress, a result log and an
  error file, all-or-nothing, and treats a repeated upload of the same file and mode as the same run.

### 3.6 Account categories

- **FR-43** A user with `ACCOUNTING_CHART_EDIT` can maintain account categories per class (name, description, order,
  optional parent) and link each account to at most one; each template ships a default set.
- **FR-44** The system lets a category carry reporting attributes used by statements: the margin tier it counts toward
  (direct, operating, other) and a cash-flow section.
- **FR-45** The system refuses to delete a category in use and to change the class of a category in use.

### 3.7 Fiscal years and periods

- **FR-46** A user with `ACCOUNTING_FISCAL_YEAR_EDIT` can create a fiscal year (name, start, end) of twelve months, or
  of irregular length (one day to eighteen months) when explicitly marked; years of an organization never overlap and,
  once it is live, leave no gap.
- **FR-47** The system proposes the first fiscal year from the organization's existing fiscal start and end dates.
  Those dates stay editable as today; when they differ from the current fiscal year the readiness check says so and
  offers to update them, and they follow the current fiscal year automatically only where the organization setting
  "keep organization fiscal dates in step" is on (default off).
- **FR-48** A user with `ACCOUNTING_FISCAL_YEAR_EDIT` can create the same year for several organizations at once, and a
  child organization can follow its parent's fiscal calendar.
- **FR-49** The system divides a year into periods by a pattern (calendar months; quarters; thirteen four-week periods;
  4-4-5, 4-5-4 or 5-4-4 weeks; custom boundaries) covering it without gap or overlap, plus optional adjustment periods
  on the last day for closing entries.
- **FR-50** The system allows a period pattern to change only while the year has no ledger line, and the open end of a
  year to move only across dates without lines.
- **FR-51** The system gives each year a state (planned, open, closed), refuses a posting date outside an open year, and
  stamps year and period on every ledger line (enforced by `general-ledger`).
- **FR-52** The system creates the next fiscal year with the same pattern a configurable number of days (default 30)
  before the last open year ends, tells the accounting administrators in the inbox, and can be switched off.
- **FR-53** The system deletes a fiscal year only while it has no ledger line.

### 3.8 Ledger books

- **FR-54** The system creates one primary ledger book per organization, and a user with `ACCOUNTING_LEDGER_BOOK_EDIT`
  can add up to five more (name, code, purpose) for parallel reporting bases.
- **FR-55** The system treats a journal as common to all books unless it names one; the view of a book is the common
  journals plus its own, on ledgers, balances, reports and depreciation schedules.
- **FR-56** The system archives rather than deletes a book that has lines, and never archives the primary book.

### 3.9 Opening balances

- **FR-57** A user with `ACCOUNTING_OPENING_BALANCE_EDIT` can prepare an opening balance worksheet for a cut-over date:
  a balance per account, currency (with rate), dimension set and ledger book, typed or imported, saved as a draft that
  several people can work on.
- **FR-58** The system requires, for each control account, the open items behind its balance (party, document number and
  date, due date, amount, currency, dimensions) and refuses a worksheet whose items do not add up.
- **FR-59** The system creates customers and suppliers named in the open items that do not exist yet, when the user asks
  for it and may create them, and lists what it created.
- **FR-60** The system refuses a worksheet that does not balance; a difference within the rounding tolerance goes to the
  designated opening rounding account, and a user may assign a stated remainder to the opening offset account.
- **FR-61** A user with `ACCOUNTING_OPENING_BALANCE_POST` can preview and post the worksheet through the ledger's
  posting contract: lines are marked as opening (kept out of the period's result), its open items are opened in the
  receivables and payables open-item register (the same place opening invoices put theirs) and become allocatable, and
  the posting succeeds or fails as a whole, in the background when large.
- **FR-62** The system corrects a posted worksheet only by reversal and a new version, and allows several worksheets per
  organization (staged migration, one per ledger book).
- **FR-63** The system suggests, for an uploaded existing trial balance, the chart account for each of its accounts from
  code, name and balance side, lets the user change each suggestion, and remembers the mapping. `(advanced)`

### 3.10 Analytic dimensions and values

- **FR-64** A user with `ANALYTIC_DIMENSION_EDIT` can define up to twelve active analytic dimensions per organization,
  each with name, code, order and a value source: an own list, an own tree, a platform record type, or the tags of one
  tag type.
- **FR-65** The system ships cost centre (own tree) and project (sourced from projects) active, and team, department,
  employee and customer ready to activate; the values of a sourced dimension are the records or tags themselves, so
  they appear, rename and archive with them without maintenance. `(advanced)`
- **FR-66** The system lets plugins and custom record types register as value sources (warehouse, item group, sales
  channel, region), so a dimension can be created from any registered record type.
- **FR-67** A user with `ANALYTIC_DIMENSION_EDIT` can maintain own values (code, name, parent, validity dates, active
  flag), renumber and rename them without losing history, and import and export them.
- **FR-68** The system never posts to a group value, refuses to turn a leaf value with ledger lines into a group, never
  moves a value to another dimension or organization, and archives instead of deleting a value with lines.
- **FR-69** The system records the dimension values of a line as a dimension set (at most one value per dimension);
  equal combinations are one set, a set never changes, and document, ledger and budget lines refer to sets.
- **FR-70** A user with `ANALYTIC_DIMENSION_EDIT` can deactivate a dimension: it leaves entry and stays on history,
  filters and reports; reactivating restores it.

### 3.11 Dimension rules, derivation and allocation

- **FR-71** A user with `ANALYTIC_DIMENSION_EDIT` can set default values per organization, party, item, project,
  employee or warehouse; a line's value resolves in this order: entered, derived from the line's references, default of
  the item, of the party, of the organization.
- **FR-72** The system derives sourced dimensions from what a line refers to (project from a task or time entry; team
  from the time entry or task; department from the employee; customer from the document; a tag-type dimension from
  the single tag of that type on the document) and keeps a user's override, marked as manual. `(advanced)`
- **FR-73** A user with `ANALYTIC_DIMENSION_EDIT` can state, per dimension, whether it is required, optional or not
  allowed for a scope (statement, class, category, account group with descendants, account); the most specific scope
  wins.
- **FR-74** A user with `ANALYTIC_DIMENSION_EDIT` can restrict a dimension's values for a scope with an allow list or
  a deny list (a group value covers its descendants); a scope has at most one list per dimension.
- **FR-75** The system answers, for an account, a dimension set and a date, whether the combination is valid, with the
  refusing rule and the acceptable values; forms use the answer while typing and the ledger at posting.
- **FR-76** A user with `ANALYTIC_DIMENSION_EDIT` can define a fixed split rule: from a date, lines on a source value
  are divided over target values by percentages totalling exactly 100; the rule has a recorded lifecycle (draft, active,
  ended) and the ledger applies it at posting time.
- **FR-77** The system allows one active split rule per source value and date, refuses a target that is itself the
  source of an active rule, and refuses a start date earlier than the latest posted line of the source value.
- **FR-78** A user entering a document line can distribute it over up to twenty values of one dimension by percentage or
  amount; the ledger posts one line per share.
- **FR-79** A user with `ANALYTIC_DIMENSION_EDIT` can define a driver-based allocation whose shares are computed each
  period from tracked hours per project or team, headcount per department, or ledger amounts of chosen accounts; the
  system proposes the period's allocation journal with the driver figures as evidence, posted through the ledger only
  after a permitted user confirms the preview. `(advanced)`
- **FR-80** A user with `ANALYTIC_DIMENSION_EDIT` can mark a dimension as balanced; the ledger then keeps every value
  of it in balance within each journal by offsetting lines on the designated dimension clearing account.
- **FR-81** The system dates every rule, default and split (valid from, valid until), applies the version valid on the
  posting date, and never changes posted lines when a rule changes.

### 3.12 Seasonal distributions

- **FR-82** A user with `ANALYTIC_DIMENSION_EDIT` can define named seasonal distributions: one weight per period of a
  period pattern, totalling 100 % within 0.01, for use by budgets and sales targets.
- **FR-83** The system offers starting points: even, by calendar days, by working days of the organization's holiday
  calendar, or a copy of another distribution.
- **FR-84** The system can derive a distribution from history: last year's ledger amounts of chosen accounts and
  dimension values, or tracked hours of a project or team. `(advanced)`
- **FR-85** The system keeps earlier versions of an edited distribution for their consumers and refuses to delete one in
  use.

### 3.13 API, assistance and real time

- **FR-86** The system offers every capability above through the REST API with cursor pagination, idempotency keys on
  creating, applying and posting calls, and bulk calls answering per row; chart, periods and dimensions are also
  readable through GraphQL.
- **FR-87** The system offers MCP tools for the same capabilities under the same permissions; every tool that applies a
  template, imports, merges or posts accepts `preview: true` and then changes nothing.
- **FR-88** The system can propose a chart from a description of the business or an uploaded existing chart: a template
  choice plus a list of changes as a preview that only a user with `ACCOUNTING_CHART_EDIT` can apply; proposal and
  confirmation are audited with the agent marked. `(advanced)`
- **FR-89** The system pushes changes of the chart, fiscal calendar, dimension values, readiness findings and opening
  worksheets to every open client within two seconds, without polling. `(advanced)`
- **FR-90** The system publishes an event for every change of this feature's records, for automation rules, webhooks and
  other plugins.
- **FR-91** The system registers accounts, dimension values and fiscal periods as record types for saved views, custom
  fields, global search and mapped import and export.

## 4. Non-Functional Requirements

- **Performance**: a chart of 5,000 accounts loads under 300 ms P95; a 10,000-row import validates under 10 s and
  applies under 60 s in the background; a 2,000-account template applies under 5 s; resolving a dimension set and
  validating a line take under 30 ms P95; a change reaches 50 follower organizations within 5 s.
- **Data volume**: 20,000 accounts and 12 dimensions per organization, 100,000 values per dimension, 5 million dimension
  sets and 1,000 organizations per tenant.
- **Concurrency and reliability**: optimistic conflict detection on every master record; one import, merge or template
  application per organization at a time; these and opening postings are all-or-nothing and resumable.
- **Security & privacy**: tenant and organization scoped; visible only with the view permissions; uploaded files stay
  inside the platform; nothing is sent to third parties.
- **Auditability**: who, when, before and after for every change; agent-made changes are marked.
- **Accessibility and localisation**: tree, grid and importer are keyboard operable and labelled; all strings in every
  shipped locale; account, category and dimension names are translatable.
- **Compatibility**: PostgreSQL, MySQL and SQLite; both ORMs; multi-tenant cloud and self-hosted single tenant; additive
  OpenAPI changes only.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| Accounting profile | Accounting state of one organization: setup progress, ledger currency, go-live date, chart origin |
| Ledger account | A node of the chart: a group or a posting account of one class |
| Account type, designation | A catalogue entry whose traits decide behaviour; the account playing a default role |
| Account category | A reporting group of accounts within a class |
| Chart template, import run | A versioned reusable chart; one upload with mapping, findings, preview and outcome |
| Chart follow link, account merge | A child chart following an ancestor's; the mapping of one account into another |
| Fiscal year, fiscal period | The accounting calendar of an organization |
| Ledger book | A parallel reporting basis of the same organization |
| Opening balance worksheet | Balances and open items at cut-over, posted once as opening journals |
| Analytic dimension, value | A user-defined axis of analysis and its members (own or sourced from records) |
| Dimension set | An immutable combination of dimension values carried by a line |
| Dimension rule, default | Requirement, allow or deny list, and default value for a scope |
| Split rule, driver-based allocation | Fixed or computed division of amounts across dimension values |
| Seasonal distribution | A named curve of weights across the periods of a year |
| Readiness finding | One blocking or advisory result of the setup check |

## 6. Out of Scope

- Journals, posting rules, account determination, applying dimension rules at posting, period locks, period and year-end
  close, revaluation, sub-ledgers: `general-ledger`.
- Content of country charts and statutory mappings: `regional-compliance-packs`; mapping tax amounts to accounts and the
  rate held for a tax account: `tax-engine`.
- Statement layouts, consolidated statements and printed reports: `financial-reports`.
- Budgets: `budgets-and-revenue-schedules`; sales targets: `sales-order-management`; project budgets:
  `project-costing-and-billing`.
- Organization tree, group defaults, setup assistant shell: `organization-setup`.
- Opening documents meant to be printed or sent: `invoicing-receivables-payables`; opening stock:
  `stock-ledger-and-valuation`; opening asset values: `fixed-assets`.
- Generic import engine and error files: `data-import-export`; an accountant role bundle: `access-control-and-security`.

## 7. Acceptance Criteria

- [ ] **AC-1** A fresh organization reaches "in setup" from a template in one pass; go-live is refused until the
      readiness check has no blocking finding (FR-3, FR-5).
- [ ] **AC-2** Class, group, uniqueness, type and designation rules hold: each refusal of FR-8, FR-11 to FR-13, FR-18
      and FR-20 is reproducible and names its reason and references.
- [ ] **AC-3** A parent chart change reaches all followers; one with a conflicting local code reports a finding (FR-25, FR-26).
- [ ] **AC-4** `(advanced)` Merging leaves every ledger line unchanged, shows the combined history under the
      target, and undo restores both accounts (FR-31).
- [ ] **AC-5** `(advanced)` A newer template version shows a difference and applies only selected additions (FR-36).
- [ ] **AC-6** The importer marks each problem of FR-39 on its row, applies nothing while one is blocking, imports
      10,000 rows as one unit, and re-importing the exported chart changes nothing.
- [ ] **AC-7** Fiscal years cannot overlap; each pattern covers the year exactly; the next year is created by the daily
      job and announced in the inbox (FR-49, FR-50, FR-52, FR-53).
- [ ] **AC-8** An opening worksheet with open items posts as one unit into opening journals and open items, refuses an
      imbalance beyond tolerance, and is correctable only by reversal (FR-58, FR-59, FR-61, FR-62).
- [ ] **AC-9** `(advanced)` A time entry on a task yields project, team and department on the resulting line
      without input; a manual override survives (FR-72).
- [ ] **AC-10** Required, allow and deny rules refuse the right lines naming the rule; the most specific scope wins; a
      split rule totals 100, cannot chain, and cannot start before the last posted line (FR-73, FR-74).
- [ ] **AC-11** `(advanced)` A driver-based allocation proposes a journal whose shares equal the period's tracked
      hours, shows them as evidence, and posts only after confirmation (FR-79).
- [ ] **AC-12** `(advanced)` A distribution derived from last year's actuals reproduces their proportions (FR-84).
- [ ] **AC-13** `(advanced)` Chart proposal and trial balance mapping return previews, change nothing until
      confirmed, and are audited with the agent marked; every MCP tool honours `preview: true` (FR-63, FR-88).
- [ ] **AC-14** `(advanced)` A change made in one browser appears in another within two seconds (FR-89).
- [ ] **AC-15** Works on PostgreSQL, MySQL and SQLite with both ORMs (§4).
- [ ] **AC-16** Behind `FEATURE_ACCOUNTING`; with it off nothing changes and the tax posting key still works (FR-1, FR-6).
- [ ] **AC-17** All functional requirements have a passing test (§3).
- [ ] **AC-18** With the feature on and the organization live, the organization's currency and fiscal dates can still
      be changed on the organization form as before (the ledger currency is unchanged and a finding is shown), unless
      the organization switched on the settings of FR-2 and FR-47.
- [ ] **AC-19** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-1).

## 8. Open Questions

- Applied default: the ledger is opt-in per tenant and hand-off fields stay.
- Deploy-level switch. Applied default: the plugin also needs `GAUZY_ACCOUNTING_ENABLED` (exactly `true`) for the first
  releases; the tenant feature decides per tenant.
- Default grants. Applied default: super admin and admin get every permission; the dimension view permission also goes
  to managers and employees; an accountant role bundle is added through `access-control-and-security`.
- Limits. Applied defaults: twelve active dimensions, six ledger books, twenty shares per distributed line.
- Templates shipped here. Applied default: two general charts; country charts come from `regional-compliance-packs`.
- Account code. Applied default: optional, numeric, no fixed length; an organization can require and shape it.

## 9. Constitution Gates

- [x] I Plugin-first — new plugin `packages/plugins/accounting` with `accounting-ui`.
- [x] II Tenant/organization scoping — organization-scoped records; tenant templates with an allow-list.
- [x] III Both ORMs, additive migrations — new tables only, three dialects, both ORMs.
- [x] IV Default-off flag; nothing removed — `FEATURE_ACCOUNTING` off by default; hand-off fields kept.
- [x] V Contracts and API first; backwards compatible — contracts in `packages/contracts`, REST before UI.
- [x] VI Permissions, privacy, security — `ACCOUNTING_*` keys per action; merge, import, opening post separate.
- [x] VII Real-time through the event bus — outbox events and platform push; no private channel.
- [x] VIII i18n and accessibility — keys in every locale; keyboard-operable tree, grid and importer.
- [x] IX Tests accompany the change — unit, database and e2e tests listed in `tasks.md`.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Builds on this: [`../general-ledger/spec.md`](../general-ledger/spec.md),
  [`../budgets-and-revenue-schedules/spec.md`](../budgets-and-revenue-schedules/spec.md),
  [`../financial-reports/spec.md`](../financial-reports/spec.md), [`../tax-engine/spec.md`](../tax-engine/spec.md)
- Depends on: [`../organization-setup/spec.md`](../organization-setup/spec.md); uses
  [`../data-import-export/spec.md`](../data-import-export/spec.md),
  [`../record-views-and-search/spec.md`](../record-views-and-search/spec.md)
- Architecture: [platform architecture](../../architecture/business-suite.md) §3.4, §5, §6
- Code extended: `packages/core/src/lib/organization` (fiscal dates, currency), `packages/core/src/lib/money`,
  `packages/core/src/lib/event-outbox`, `tags` and `tag-type` (dimension values), `rule` (dimension rule scopes),
  `operation`, `packages/plugins/tax` (posting key kept)
