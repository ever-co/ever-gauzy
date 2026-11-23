# Feature Specification: Budgets and revenue schedules

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `budgets-and-revenue-schedules`
**Branch**: `feat/budgets-and-revenue-schedules`
**Status**: `Draft`
**Created**: 2026-11-15
**Last updated**: 2026-11-23
**Owner**: platform maintainers
**Feature flag**: `FEATURE_BUDGETS`, `FEATURE_REVENUE_SCHEDULES` (default off)

---

## 1. Overview

Two capabilities on top of the ledger, each behind its own feature code. **Budgets**: an organization plans income and
spending per ledger account and analytic dimensions for a fiscal year, has the plan approved and revised under control,
and the platform checks requisitions, purchase orders and actual postings against what is left, counting what is already
committed. **Recognition schedules**: revenue invoiced ahead of delivery and costs paid ahead of use are held on a
deferral account and released to income or expense over the service period, or as the work is actually delivered, with a
report of deferred balances and upcoming postings. Both are modules of the `accounting` plugin and post only through the
ledger's posting engine. Clients: the Angular app (whose budget and recognition panels the document forms of other
features show), the REST API, the SDKs and the MCP server. Project and client budgets that exist today are unchanged:
they stay the hours and cost caps of their projects and clients, can fill a budget, and are shown beside it.

**Advanced capabilities.** A budget spans several dimensions at once (cost centre and project and team),
can target an account group or category, has scenarios, approvals through the workflow engine and controlled transfers,
and tracks commitments: an approved purchase order reserves budget until its bills arrive, and tracked time appears as
pending labour before payroll posts. "Over budget" can route a document to its budget owner for approval instead of
simply refusing it. Recognition can follow reality: milestones reached, quantities delivered, units used, or hours
tracked against a plan, each posting with its evidence. A credit note adjusts its schedule automatically. Availability
is real time, and an assistant can explain a variance, forecast a breach before it happens, or draft next year's budget
from actuals, always as a preview.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** a controller, **when** they create the operating budget for next year with the axes department and project,
  copy this year's actuals with a 5 % uplift, apply the "summer low" seasonal distribution to travel and submit it,
  **then** the department heads named as approvers receive it, and once approved it is the control budget from the first
  day of the year.
- **Given** an approved budget with 10,000 left on "Marketing / Trade fairs" for the year, 6,000 of it reserved by an
  open purchase order, **when** a buyer confirms another purchase order of 5,000 on the same line with the action
  "require approval", **then** the order is not refused but waits for the budget owner, who sees budget, spent,
  committed and the shortfall of 1,000 and approves or declines.
- **Given** the same line with the action "block" for actual postings, **when** an accountant confirms a bill that
  exceeds what is left, **then** confirmation is refused naming the budget, the line, and the amounts.
- **Given** a purchase order of 6,000 that reserved budget, **when** bills for 4,000 are posted and the remaining order
  line is closed, **then** 4,000 moves from committed to actual and 2,000 is released.
- **Given** a team that has tracked 320 hours on a project this month and payroll is not yet posted, **when** the
  project manager opens the budget monitor, **then** the labour line shows those hours valued as pending labour beside
  actual and committed.
- **Given** a department that needs more travel budget, **when** its head requests a transfer of 2,000 from training to
  travel for the fourth quarter, **then** after approval both lines change, the total does not, and the transfer is in
  the budget's history.
- **Given** a twelve-month support contract invoiced up front on 15 March, **when** the invoice is posted, **then** the
  revenue sits on the deferral account, a schedule shows seventeen days of March, ten full months and the remaining
  days, and each period end posts that period's share to income.
- **Given** a fixed-price project invoiced in advance with recognition by tracked time against 400 planned hours,
  **when** 100 hours have been tracked, **then** a quarter of the amount has been recognised, and the entry shows the
  hours behind it.
- **Given** a customer who is credited three unused months of a prepaid year, **when** the credit note is posted,
  **then** the schedule shrinks by those months without anyone touching past entries.
- **Given** a finance manager, **when** they open the deferred revenue and expense report for the year by month,
  **then** they see opening balance, additions, recognised and closing balance per month, the amounts still to be
  recognised in each future period, and the total agrees with the deferral accounts in the ledger.
- **Given** an AI agent with budget view permission, **when** asked "which budgets will run out before year end?",
  **then** it lists the lines whose run rate exceeds the budget with the expected period of breach and the documents
  driving it.

### 2.2 Edge cases & failures

- **Given** a user without `ACCOUNTING_BUDGET_EDIT`, **when** they change a budget, **then** they receive `403`; with
  `FEATURE_BUDGETS` off every route of this feature is refused and no document is checked, while project, client
  and campaign budgets work as today.
- **Given** two purchase orders confirmed at the same moment against a line that can afford only one, **when** both are
  checked, **then** exactly one passes.
- **Given** an approved budget, **when** someone edits an amount directly, **then** it is refused; a revision or a
  transfer is offered.
- **Given** a budget line on an account group and a more specific line on one of its accounts, **when** a document hits
  that account, **then** the more specific line is the one checked and consumed.
- **Given** a purchase order amended from 6,000 to 4,500, **when** the amendment is confirmed, **then** the commitment
  falls by 1,500; **when** the order is cancelled, **then** the rest is released.
- **Given** a recognition entry due in a locked period, **when** the run posts, **then** the amount is posted in the
  earliest open period and marked as catch-up.
- **Given** a recognition run of 30,000 entries in which 40 fail (an archived account), **when** it ends, **then** the
  others are posted, the 40 are listed with reasons and can be retried, and nothing is posted twice.
- **Given** a delivery that is partly returned after revenue was recognised by delivery, **when** the return is
  confirmed, **then** the matching share of revenue is reversed in the current period.
- **Given** a manual journal on a deferral account that no schedule explains, **when** the integrity check runs,
  **then** the difference is listed and the period's close check fails until it is explained or scheduled.
- **Given** a schedule whose source invoice is cancelled, **when** the cancellation is posted, **then** unposted entries
  are void and posted ones are reversed through the ledger.

## 3. Functional Requirements

### 3.1 Activation

- **FR-1** The system offers budgets when `FEATURE_BUDGETS` is on and recognition schedules when
  `FEATURE_REVENUE_SCHEDULES` is on, each only for an organization whose accounting is live; either can be on without
  the other, and with a code off its routes, tools, menu entries, checks and jobs do nothing.
- **FR-2** The system leaves the existing project and client budgets, their reports and the campaign budgets of
  promotions exactly as they are.

### 3.2 Budgets and lines

- **FR-3** A user with `ACCOUNTING_BUDGET_EDIT` can create a budget with a name, one or more consecutive fiscal years, a
  ledger book, a type (operating or capital), a scenario, up to four analytic dimensions as its axes, a period grain
  (period, quarter or year) and an owner.
- **FR-4** A user with `ACCOUNTING_BUDGET_EDIT` can add lines, each naming a target (a posting account, an account group
  or an account category), one value per axis (a group value covers its descendants; blank means any) and an amount per
  period of each year in the organization currency.
- **FR-5** The system accepts income and expense targets in an operating budget and asset targets in a capital budget,
  and refuses any other class.
- **FR-6** The system spreads an annual amount over periods evenly, by a seasonal distribution, by quarter or half year,
  or as typed per period; the periods always add up to the annual amount, the remainder going to the last.
- **FR-7** The system keeps the years of a multi-year budget separate and refuses overlapping years in one budget.
- **FR-8** The system refuses, among approved control budgets of one ledger book, a second line for the same target,
  axis values and period, naming the budget that already holds it.
- **FR-9** A user with `ACCOUNTING_BUDGET_EDIT` can fill a draft by copying another budget or the actuals of a year with
  a percentage change, from the cost budgets of the projects on a project axis, from the organization's recurring
  expenses (monthly amount times the periods they cover, by category mapped to an account), by importing a file, and
  by pasting into a grid of lines and periods.
- **FR-10** A user with `ACCOUNTING_BUDGET_EDIT` can plan a line as a quantity and a rate (hours and an hourly cost,
  units and a unit cost); the amount is their product and the quantity is kept for reporting.
- **FR-11** The system allows several scenarios per year (plan, forecast, alternatives) and exactly one of them as the
  control scenario that checks documents; the others are for comparison only. `(advanced)`
- **FR-12** The system takes a budget through draft, submitted, approved and closed; approval runs through the approval
  workflow with steps by amount, owner or dimension, and only a user with `ACCOUNTING_BUDGET_APPROVE` who is a named
  approver can approve.
- **FR-13** A user with `ACCOUNTING_BUDGET_EDIT` can revise an approved budget: a new version with a reason, a
  difference per line and period against the previous version, its own approval, and an effective period; the earlier
  versions stay readable and control uses the latest approved one.
- **FR-14** A user with `ACCOUNTING_BUDGET_EDIT` can request a transfer between lines or periods of one budget that
  leaves its total unchanged; the transfer has its own approval rule and history. `(advanced)`
- **FR-15** The system refuses any direct change to an approved budget, answers concurrent edits of a draft with a
  conflict, and records who changed what, when and why.

### 3.3 Budget control

- **FR-16** The system matches a document line to a budget line by its account (the account itself, else the nearest
  group, else its category) and its dimension set on the budget's axes; the most specific line wins, and a line of a
  more specific budget wins over a general one.
- **FR-17** A user with `ACCOUNTING_BUDGET_CONTROL_EDIT` can set, per budget or line, the action for each control point
  and basis:

  | Control point | Basis | Actions |
  |---|---|---|
  | requisition confirmed | period, year to date, year | allow, warn, block, require approval |
  | purchase order confirmed | period, year to date, year | allow, warn, block, require approval |
  | actual posting (bill, expense claim, manual journal, any document that posts to a budgeted account) | period, year to date, year | allow, warn, block, require approval |
  | line without any budget | — | allow, warn, block |

- **FR-18** The system counts as consumed, per control point, the actual ledger amounts of the line's accounts and
  dimensions in the budget's book, plus open commitments, plus open pre-commitments, and allows a tolerance per budget
  as a percentage, an amount, or both. A bill for an order line is checked against that line's open commitment first,
  so only the part above it adds to consumed and a bill of a fully committed order is never counted twice.
- **FR-19** The system evaluates control when a document is confirmed, as part of the ledger's posting check, and shows
  the same figures in the document's effects preview: budget, consumed, this document, remaining.
- **FR-20** The system refuses a blocked confirmation naming budget, line, basis and amounts; for "warn" it lets the
  confirmation pass and records the warning on the document.
- **FR-21** The system sends a document whose action is "require approval" to the budget owner as an approval request
  with the figures; approval records an override for that document only, and decline leaves it a draft.
  `(advanced)`
- **FR-22** A user with `ACCOUNTING_BUDGET_OVERRIDE` can grant a one-time override for a stated document and amount,
  with a reason.
- **FR-23** The system never applies control to reversals, credit notes (which give budget back), closing, revaluation,
  depreciation, allocation and recognition journals.
- **FR-24** The system decides concurrent confirmations against one budget line one after another, so their sum cannot
  pass a limit that each alone would respect.

### 3.4 Commitments

- **FR-25** The system records a pre-commitment when a requisition is approved and a commitment when a purchase order is
  confirmed, per line, with the account and dimension set the eventual bill would post to, in the period of the expected
  date. `(advanced)`
- **FR-26** The system converts a pre-commitment into a commitment when the requisition becomes an order, moves a
  commitment to actual as bills for the order line are posted (by billed amount), adjusts it by the difference when the
  order is amended, and releases the rest when the line is closed or the order cancelled. `(advanced)`
- **FR-27** The system values a commitment in a foreign currency at the order's rate and releases exactly what it
  reserved, whatever rate the bill carries.
- **FR-28** The system lets other features register commitment sources (approved expense claims not yet posted, approved
  pay runs), each stating amount, account, dimension set, period and when it is released.
- **FR-29** The system shows tracked time that is not yet a ledger cost (hours on a project or team in the period,
  valued at the applicable cost rate) as pending labour on the matching budget lines, updated as time is tracked and
  removed as the cost posts. `(advanced)`
- **FR-30** The system handles commitments still open at year end by the budget's policy: they lapse, or carry into next
  year's budget with the same amount added there, with a list of what was carried.
- **FR-31** The system only ever adds commitment records (a release is a new record), lists them per budget line with
  their documents, and reports any difference between open commitments and open purchase order amounts.

### 3.5 Monitoring and assistance

- **FR-32** The system answers, for an account, a dimension set and a date, the budget, actual, committed,
  pre-committed, pending labour and available amounts for the period, year to date and year, within 100 ms, and pushes
  changes to open clients within two seconds. `(advanced)`
- **FR-33** A user with `ACCOUNTING_BUDGET_VIEW` can open the budget monitor: lines by period with budget, actual,
  committed, variance and percentage used, the project's own budget beside lines on a project axis, filters by
  dimension and scenario, comparison of versions and scenarios, and drill-down to journals and documents.
- **FR-34** The system notifies the owner of a line once when its use passes each threshold (defaults 80 % and 100 %)
  for a period or the year.
- **FR-35** The system forecasts, per line, the year-end amount from actuals, commitments and the line's distribution,
  and warns the owner when a breach is expected, naming the period. `(advanced)`
- **FR-36** The system can explain a variance of a line or group: the documents, parties and dimension values that
  contribute most, against budget and against the previous period. `(advanced)`
- **FR-37** The system can propose a budget for a year from the actuals of earlier years, a growth assumption and
  seasonal distributions, as a draft that changes nothing until a user saves it. `(advanced)`
- **FR-38** The system exposes budget, commitment and availability figures as datasets for reports and dashboards, and
  exports the monitor to a file.

### 3.6 Recognition templates and schedules

- **FR-39** A user with `ACCOUNTING_SCHEDULE_TEMPLATE_EDIT` can define recognition templates: direction (revenue or
  expense), method, default term, start rule (document date, service start, first delivery, first day of next period),
  part-period convention (by days, full period, half period), deferral account role and a minimum amount below which
  nothing is deferred.
- **FR-40** A user with `ACCOUNTING_SCHEDULE_TEMPLATE_EDIT` can set a default template per item and organization; a user
  editing an invoice or bill line can choose or clear the template and set the service start and end.
- **FR-41** The system, when an invoice or bill with such a line is posted, books that line on the deferral account
  instead of income or expense and creates one schedule for it with the planned entries.
- **FR-42** The system also creates schedules from subscription billing cycles (service period of the cycle), from
  opening balances of deferral accounts, and by hand for an amount already on a deferral account.
- **FR-43** The system offers these methods:

  | Method | A period's amount is |
  |---|---|
  | straight line by days | the amount times the days of the period within the service period over all days |
  | straight line by periods | equal shares per period, first and last by the part-period convention |
  | manual plan | what the user entered per period, totalling the amount |
  | milestone | the share attached to each milestone, when it is reached |
  | delivery | the amount times delivered over ordered quantity |
  | usage | the amount times units used over units entitled |
  | tracked time | the amount times hours tracked over hours planned, or hours tracked times a rate drawn from a prepaid amount |

- **FR-44** The system makes the planned entries of a schedule add up exactly to its amount (rounding to the last
  entry), one entry per fiscal period, and shows planned against posted.
- **FR-45** A user with `ACCOUNTING_SCHEDULE_VIEW` can list schedules by direction, party, item, project, account and
  state (active, paused, completed, cancelled) and open one with its entries, source document, postings and evidence.

### 3.7 Recognition runs and postings

- **FR-46** A user with `ACCOUNTING_SCHEDULE_RUN` can run recognition for a date range, direction, accounts or party and
  see every entry and journal it would post; a user with `ACCOUNTING_SCHEDULE_POST` can post them.
- **FR-47** The system runs recognition by itself at each period end for time-based methods and daily for event-driven
  ones, and either posts or leaves proposals for review, per organization policy.
- **FR-48** The system posts recognition only through the ledger's posting engine as recognition journals (debit
  deferral and credit income, or debit expense and credit deferral), one journal per run and account pair or one per
  entry by policy, and never posts an entry twice.
- **FR-49** The system posts an entry due in a locked period in the earliest open period, marked as catch-up, and does
  the same for the missed periods of a schedule created late.
- **FR-50** The system recognises a foreign-currency schedule at the rate of its source document, so the deferral
  account clears without an exchange difference.
- **FR-51** The system carries the dimension set, party and ledger book of the source line onto every recognition line.
- **FR-52** The system completes a run with a result per entry; failed entries keep their reason, can be retried, and do
  not stop the others.

### 3.8 Recognition that follows delivery

- **FR-53** The system recognises by milestone when a linked project milestone or task is completed, for the share
  assigned to it. `(advanced)`
- **FR-54** The system recognises by delivery from the delivered quantity of the order line linked to the invoiced line,
  and reverses the matching share when goods are returned. `(advanced)`
- **FR-55** The system recognises by usage from units reported for the subscription or entitlement behind the line.
  `(advanced)`
- **FR-56** The system recognises by tracked time from the hours tracked on the linked project, task or contract: as a
  percentage of planned hours, or as hours times a rate drawn down from a prepaid amount. `(advanced)`
- **FR-57** The system computes, for every event-driven schedule, the cumulative recognisable amount from current
  progress, posts the difference to what is already recognised, never exceeds the schedule amount, reverses when
  progress falls, and stores the progress figures and source records with each entry. `(advanced)`
- **FR-58** The system lets other features register progress sources, so a schedule can follow any measured quantity
  they own.

### 3.9 Changes, credits and integrity

- **FR-59** A user with `ACCOUNTING_SCHEDULE_EDIT` can pause and resume a schedule, end it early (recognise the rest
  now, or leave it deferred for a credit), and change its end date; the remaining amount is re-planned over the
  remaining periods and posted entries never change.
- **FR-60** The system adjusts a schedule when a credit note is posted against its source line: the unrecognised part is
  reduced first, then recognised revenue or expense is reversed in the current open period, in proportion to the
  credited amount, with a preview on the credit note. `(advanced)`
- **FR-61** The system cancels a schedule when its source document is cancelled: unposted entries are void and posted
  entries are reversed through the ledger.
- **FR-62** The system verifies that, per deferral account and ledger book, the unrecognised amounts of all schedules
  equal the account's ledger balance, lists differences with the journals that cause them, and offers to create a
  schedule for an unexplained amount.
- **FR-63** The system provides two checks to the period close: every entry due in the period is posted, and every
  deferral account agrees with its schedules.

### 3.10 Report and forecast

- **FR-64** A user with `ACCOUNTING_SCHEDULE_VIEW` can open the deferred revenue and expense report: for revenue or
  expense, over a range of periods or fiscal years in monthly, quarterly or yearly columns, the opening deferred
  balance, additions, recognised amount, adjustments and closing balance, and the amounts planned for each future
  period; grouped by account, party, item, project, dimension value or schedule; with drill-down.
- **FR-65** The system offers that report as a report definition (clone, pivot, schedule, export, print) and its data as
  a dataset.
- **FR-66** The system forecasts future recognition, including event-driven schedules projected from their recent rate
  of progress, and shows it beside the planned amounts. `(advanced)`

### 3.11 API, tools and real time

- **FR-67** The system offers every capability above through the REST API with cursor pagination, idempotency keys on
  creating, approving, posting and run-starting calls, and bulk calls with a result per row.
- **FR-68** The system offers MCP tools for the same capabilities under the same permissions; tools that approve,
  transfer, override, post or change a schedule accept `preview: true` and then change nothing.
- **FR-69** The system pushes changes of availability, monitor figures, schedule progress and run status to open clients
  without polling.
- **FR-70** The system publishes events for budget lifecycle, control decisions, threshold crossings, commitment
  changes, schedule lifecycle and recognition postings.

## 4. Non-Functional Requirements

- **Performance**: a budget check adds under 50 ms P95 to a 50-line document's posting check; availability under 100 ms;
  the monitor of a 5,000-line budget under 500 ms from maintained figures; a recognition run of 100,000 entries
  completes within 10 minutes in the background; the report over 1 million entries answers under 2 s from maintained
  period totals.
- **Data volume**: 200 budgets and 100,000 budget lines per organization, 5 million commitment records and 2 million
  schedules with 50 million entries per tenant.
- **Concurrency**: checks against one budget line are serialised; one recognition run per organization at a time; budget
  drafts are edited concurrently with conflict answers per line.
- **Reliability**: commitments and recognition entries are created exactly once per source event; runs are resumable; a
  failure of budget control never loses a document (the document stays a draft with the reason).
- **Security & privacy**: budgets and schedules are visible only with their view permissions; pending labour shows hours
  and amounts per line, not per person, unless the viewer may see the employees' time; nothing leaves the platform.
- **Auditability**: versions, approvals, transfers, overrides, control decisions, schedule changes and every posting
  record who, when, before, after and why; agent actions are marked.
- **Accessibility and localization**: the budget grid, monitor and schedule views are keyboard operable and labelled;
  all strings in every shipped locale; amounts and dates in the user's format.
- **Compatibility**: PostgreSQL, MySQL and SQLite; both ORMs; multi-tenant cloud and self-hosted single tenant; additive
  OpenAPI changes.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| Budget | A plan of amounts for one or more fiscal years, with axes, scenario, owner and lifecycle |
| Budget version | One approved or draft state of a budget; revisions add versions |
| Budget line, period amount | A target (account, group or category) with axis values, and its amount per period |
| Budget transfer | An approved move of amount between lines or periods of one budget |
| Control rule | The action per control point and basis, with tolerance |
| Commitment record | One addition to or release of reserved budget, tied to a source document line |
| Budget figures | Maintained totals per line and period: budget, actual, committed, pre-committed, pending labour |
| Budget override | A one-time permission for a stated document to exceed a line |
| Recognition template | Method, term and rules by which an amount is deferred and released |
| Recognition schedule | The deferral of one amount with its plan, state and source |
| Recognition entry | One period's or one event's share of a schedule, planned or posted, with evidence |
| Recognition run | One execution that previews or posts due entries |
| Progress source | A registered provider of measured progress (milestones, deliveries, usage, tracked time) |

## 6. Out of Scope

- Budgets of hours or cost on projects and clients, project cost roll-up and cost rates: `project-costing-and-billing`.
- Chart, dimensions, seasonal distributions: `accounting-foundation`; journals, posting rules, locks, close:
  `general-ledger`.
- Requisitions and purchase orders themselves: `procurement`; invoices, bills and credit notes:
  `invoicing-receivables-payables`; subscription cycles and usage metering: `subscription-billing`.
- Printed budget variance statements and budget columns on financial statements: `financial-reports` (this feature
  supplies the data).
- Approval steps and delegation: `approval-workflows`; sales targets: `sales-order-management`.
- Depreciation schedules: `fixed-assets`; accruals for delivered-not-billed and received-not-billed:
  `invoicing-receivables-payables`.

## 7. Acceptance Criteria

- [ ] **AC-1** A budget with two axes is created, filled by copy and distribution, approved through the workflow,
      revised with a visible difference, and cannot be edited directly once approved (FR-9, FR-12).
- [ ] **AC-2** Overlapping lines of two control budgets are refused; the most specific line is the one consumed (FR-8, FR-16).
- [ ] **AC-3** Each action of FR-17 behaves as specified on each control point and basis; two concurrent confirmations
      cannot together pass a limit.
- [ ] **AC-4** `(advanced)` A purchase order reserves budget, bills move it to actual, amendment, closing and
      cancellation release it; open commitments equal open order amounts (FR-25–FR-27).
- [ ] **AC-5** `(advanced)` "Require approval" routes the document to the budget owner and the approval applies
      to that document only (FR-21).
- [ ] **AC-6** `(advanced)` Tracked hours appear as pending labour on the right line and disappear when the cost
      is posted (FR-29).
- [ ] **AC-7** `(advanced)` Availability changes in a second browser within two seconds of a posting; a threshold
      crossing notifies the owner once (FR-32, FR-69).
- [ ] **AC-8** `(advanced)` Forecast, variance explanation and budget proposal return figures traceable to
      documents and change nothing (FR-36, FR-37, FR-66).
- [ ] **AC-9** An invoice line with a template posts to the deferral account and creates a schedule whose entries total
      the line amount; period-end runs post each share once (FR-40, FR-41).
- [ ] **AC-10** Every method of FR-43 produces the stated amounts on fixtures; a locked period leads to a catch-up
      entry.
- [ ] **AC-11** `(advanced)` Milestone, delivery, usage and tracked-time schedules recognise from real progress,
      never beyond the amount, reverse on a return, and show their evidence (FR-53, FR-55, FR-56).
- [ ] **AC-12** `(advanced)` A credit note reduces its schedule automatically with a preview; cancelling the
      invoice reverses what was recognised (FR-60, FR-61).
- [ ] **AC-13** The deferred revenue and expense report shows opening, additions, recognised, closing and upcoming
      amounts per period and agrees with the deferral accounts; a stray manual journal is reported (FR-64).
- [ ] **AC-14** Reports and data produced: budget monitor, commitment list, availability, deferred revenue and expense
      report, recognition forecast (FR-38, FR-64, FR-65).
- [ ] **AC-15** Every MCP tool honours `preview: true` and the caller's permissions (FR-68).
- [ ] **AC-16** Works on PostgreSQL, MySQL and SQLite with both ORMs (§4).
- [ ] **AC-17** Behind `FEATURE_BUDGETS` and `FEATURE_REVENUE_SCHEDULES`; nothing changes while they are off, and
      existing project and client budgets are untouched (FR-1).
- [ ] **AC-18** All functional requirements have a passing test (§3).
- [ ] **AC-19** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-1).

## 8. Open Questions

- Cost rate for pending labour. Applied default: the cost rate provided by `project-costing-and-billing`; without that
  plugin, pending labour shows hours without an amount.
- Where a commitment is released. Applied default: when the bill is posted (by billed amount), not at goods receipt.
- Year-end commitments. Applied default: lapse, with carry-forward available per budget.
- Default control actions of a new budget. Applied default: warn on every control point, year-to-date basis, no
  tolerance.
- Allocation of one price across several lines of a bundle before scheduling. Applied default: not done here; each
  invoiced line is scheduled on its own amount.
- Recognition journals. Applied default: one journal per run and account pair, proposals reviewed before posting until
  an organization switches to automatic posting.
- Balance-sheet targets. Applied default: only in capital budgets, asset class only.

## 9. Constitution Gates

- [x] I Plugin-first — modules of the `accounting` plugin; purchasing, invoicing and time tracking are reached through
      events and ports.
- [x] II Tenant/organization scoping — every budget, commitment and schedule is organization scoped.
- [x] III Both ORMs, additive migrations — new tables only, three dialects.
- [x] IV Default-off flag; nothing removed — two feature codes off by default; existing budgets untouched.
- [x] V Contracts and API first; backwards compatible — contracts in `packages/contracts`, REST before UI.
- [x] VI Permissions, privacy, security — separate keys for edit, approve, override, run and post.
- [x] VII Real-time through the event bus — outbox events in and out; platform push for availability.
- [x] VIII i18n and accessibility — keys in every locale; keyboard-operable grids.
- [x] IX Tests accompany the change — unit, database and e2e tests in `tasks.md`.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Depends on: [`../general-ledger/spec.md`](../general-ledger/spec.md),
  [`../accounting-foundation/spec.md`](../accounting-foundation/spec.md)
- Works with: [`../procurement/spec.md`](../procurement/spec.md),
  [`../invoicing-receivables-payables/spec.md`](../invoicing-receivables-payables/spec.md),
  [`../subscription-billing/spec.md`](../subscription-billing/spec.md),
  [`../project-costing-and-billing/spec.md`](../project-costing-and-billing/spec.md),
  [`../approval-workflows/spec.md`](../approval-workflows/spec.md),
  [`../financial-reports/spec.md`](../financial-reports/spec.md)
- Architecture: [platform architecture](../../architecture/business-suite.md) §3.4 ledger posting, §3.6 approvals,
  §3.8 reports
- Code extended: `packages/plugins/purchasing` (purchase orders as commitment source),
  `packages/core/src/lib/time-tracking` (tracked time), `packages/core/src/lib/organization-project` and
  `organization-contact` (existing budgets, kept and read), `organization-recurring-expense` and
  `employee-recurring-expense` (fill source), `operation` (runs)
