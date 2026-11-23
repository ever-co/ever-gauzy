# Feature Specification: Project costing and billing

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `project-costing-and-billing`
**Branch**: `feat/project-costing-and-billing`
**Status**: `Draft`
**Created**: 2026-11-16
**Last updated**: 2026-11-23
**Owner**: evereq
**Feature flag**: `FEATURE_PROJECT_COSTING` (new, default off); the existing `FEATURE_ORGANIZATION_PROJECT`, `FEATURE_EMPLOYEE_TIMESHEETS`, `FEATURE_TIME_TRACKING` and `FEATURE_INVOICE` keep governing today's pages

---

## 1. Overview

Projects are strong on work tracking today: projects with clients, members, managers and client rates; modules,
sprints, tasks with statuses, sizes, priorities, issue types, estimates and linked issues; saved views and boards; the
timer, time logs with screenshots and activity, timesheets with one approval step; employee bill and pay rates stored
on every log; one budget number per project in hours or cost with two budget reports; and invoices built from tracked
hours, each log billed once. What is missing is money and planning around that work. This feature adds the
`project-costing` plugin on the **same project, task, time log and timesheet records**: project types and templates,
progress methods, task weights and dependencies that act, activity types and dated rate cards that cost every log,
timesheet approval routed to project managers with a lock on approved time, versioned project budgets, a maintained
cost and revenue roll-up from time, expenses, purchases, materials and payroll, billing plans with milestones and
retainers handed to invoicing, project updates, capacity and utilisation, and the project reports. Clients: the Angular
app, the REST API and SDKs (on which Ever Teams builds its project, task and timesheet screens), and the MCP server.
Time capture stays exactly as it is.

**Advanced capabilities.** Margin is live: every tracked minute moves cost, forecast at completion and margin within
seconds, with the forecast built from remaining estimates priced at each assignee's rate. Budget burn raises an alert
before the budget runs out, with the expected breach date and an assistant-prepared re-plan shown as a preview.
Approved time becomes an invoice draft on the project's billing cycle with a client-ready evidence pack. An earned-value
view with a saved baseline and critical path shows schedule and cost performance together. Capacity comes from the
working calendar, shifts, time off and tracked time, so allocation and utilisation are computed, not typed. Retainers
draw down from approved time. An assistant drafts project updates and new templates from comparable finished
projects. Every rate on every log can be explained.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** a template "Website build" with 24 tasks, dependencies, a milestone "Design approved" at 30 % of the fee and
  a labour budget by activity type, **when** a project manager creates project "Acme site" from it starting Monday,
  **then** tasks are dated on working days (a public holiday skipped), dependencies and parents are linked between the
  new tasks, the budget is a draft and the billing plan holds the milestone.
- **Given** "Implement header" depends on "Design approved", **when** the designer's task slips by three days, **then**
  the open successor and the tasks after it move by three working days, keeping their durations, and the schedule view
  shows the new critical path against the saved baseline.
- **Given** an employee tracking time with the existing timer on a task of type "Bug", **when** the timer stops, **then**
  the log gets the activity type "Development" from the type mapping, its cost at the employee's dated rate card and its
  billable amount at the project member's existing client rate; the project's cost and margin move within 5 s.
- **Given** a weekly timesheet with time on two projects, **when** the employee submits it, **then** each project's
  manager receives their project's portion with hours by day, task and activity type, manual and edited time marked,
  activity level and budget impact; when both approve, the timesheet is approved and, where the organization locks
  approved time, its time is locked.
- **Given** a 400-hour labour budget, 260 hours spent and 190 hours of remaining estimates, **then** the manager is told
  "forecast 450 h, 50 h over; budget exhausted around 12 March" with a re-plan draft that changes nothing until accepted.
- **Given** a milestone task "Design approved" marked done and accepted by the client contact, **when** the billing
  clerk opens the billing worklist, **then** the milestone is there once at 30 % of the contract.
- **Given** a time-and-materials project on a monthly billing cycle, **when** the last timesheet of the month is
  approved, **then** an invoice draft holds the approved billable hours at their rates with an evidence pack of hours by
  day, task and person, and nothing is confirmed.
- **Given** a resource manager planning next quarter, **when** they allocate a developer 60 % to "Acme site" and 50 % to
  another project in the same weeks, **then** the workload board shows 110 % against capacity reduced by her approved
  time off and flags the over-allocation.
- **Given** a Friday collection set up on a project, **when** members answer the in-app prompt, **then** the manager
  receives a drafted update (tasks done, late tasks, hours, budget burn, risks) to edit and publish to stakeholders.

### 2.2 Edge cases & failures

- **Given** the feature off, **when** anyone uses projects, tasks, the timer, timesheets, rates, budgets or invoices from
  time, **then** everything is as today and the new routes answer `404`.
- **Given** a dependency chain A → B → C, **when** someone adds C → A, **then** it is refused naming the chain.
- **Given** a task whose predecessor is open and the organization set dependencies to block, **when** it is moved to a
  done status, **then** the change is refused naming the predecessor; with "warn" it passes with a warning.
- **Given** an approved timesheet and locking of approved time switched on, **when** someone edits, deletes or moves
  one of its logs, **then** the change is refused naming the timesheet; a holder of the reopen permission can reopen it
  with a reason. With locking off (the default) the logs stay editable as today.
- **Given** the project manager is the employee who tracked the time, **when** the portion routes, **then** it goes to
  the next approver; a portion is never routed to its own employee.
- **Given** two approvers deciding one portion at once, **then** one wins and the other gets `409`.
- **Given** a log with no cost rate anywhere, **then** it is costed at zero, listed among unpriced hours and the project
  shows the hours affected.
- **Given** an approved budget, **when** someone edits a line, **then** it is refused and a revision is offered.
- **Given** a project completion through the complete action while tasks are open, **then** a preview lists them and
  the user chooses to complete or cancel them with the project or to leave them open; the existing project form keeps
  setting the status as today.
- **Given** a person without the cost permission, **when** they open a project's costing view, **then** they see hours
  and progress, never rates or amounts.

## 3. Functional Requirements

### 3.1 Enabling and settings

| ID | Requirement |
| --- | --- |
| **FR-1** | With `FEATURE_PROJECT_COSTING` off nothing of the feature loads, and projects, modules, sprints, tasks, linked issues, the timer, time logs, timesheets, rates, budgets, invoices from time, invoice schedules, reports and MCP tools behave as today. |
| **FR-2** | A user with `PROJECT_COSTING_SETTINGS_EDIT` can set per organization: cost-rate source order, bill-rate mode (existing precedence first, or activity first for new logs), locking of approved time, refusal of a holder's approval of their own timesheet, dependency enforcement (off, warn, block), time on completed or cancelled tasks (allow, warn, refuse), automatic rescheduling (automatic or proposed), revenue basis of margin (billed, recognised, billed plus billable), health thresholds, which budget governs projects (the project budget or the accounting budget on the project axis), the project code series and the update defaults. Every setting that could refuse or change an existing action starts at today's behaviour: existing precedence first, no locking, no self-approval refusal, dependencies warn only, time on closed tasks allowed, rescheduling proposed. |
| **FR-3** | The system MUST NOT remove or reinterpret any existing field, status, rate, budget, invoice type or report; every new figure is additive. |

### 3.2 Projects, types and progress

| ID | Requirement |
| --- | --- |
| **FR-4** | A user with `PROJECT_TYPES_EDIT` can maintain project types (name, description, default template, default progress method, default billing method, active) used in filters, templates and reports. |
| **FR-5** | A user with `ORG_PROJECT_EDIT` can give a project a type, a priority, a department, a contract value, a billing method, sales orders of `sales-order-management` linked to it, and default analytic dimension values through `accounting-foundation` when it is on. |
| **FR-6** | The system MUST give a project without a code the next code of the organization's project series and leave existing codes unchanged. |
| **FR-7** | The system MUST derive per project the actual start (first tracked time), actual end (last tracked time once completed), tracked, approved, billable and billed hours. |
| **FR-8** | The system MUST add a paused status to the existing project statuses; paused projects keep their time and tasks and are excluded from forecasts of capacity demand. |
| **FR-9** | A user with `ORG_PROJECT_EDIT` can choose a progress method per project: manual (0 to 100), share of tasks done, average task progress, weighted task progress, or effort (tracked hours against tracked plus remaining estimate); done and cancelled tasks count as complete, missing weights count equally, and a project without tasks can be completed. Existing projects, and new ones without a type, start with the manual method, so none is completed automatically until someone chooses another method. |
| **FR-10** | The system MUST, for a method other than manual, set the project completed when progress reaches 100 unless it is paused or cancelled, and MUST NOT reopen a completed project on its own; a drop below 100 shows a warning to its managers. |
| **FR-11** | A user with `ORG_PROJECT_EDIT` can complete or cancel a project together with its open tasks, after a preview, applied in dependency order, or complete it leaving them open; the existing project form keeps setting any status as today. |
| **FR-12** | A user with `ORG_PROJECT_ADD` can duplicate a project under a different name with its modules, task tree, estimates, weights, dependencies and task settings, and optionally its members, budget lines and billing plan (entries reset to not reached); time and invoices are never copied. |
| **FR-13** | A user with `ORG_PROJECT_EDIT` can add people of the project's client contact as stakeholders with switches for seeing time, seeing files and receiving updates; a welcome email is sent once on adding; removing revokes; the portal of `customer-and-supplier-portal` reads these switches. |
| **FR-14** | The system MUST take the contract value from the linked sales orders when none is typed and show ordered, delivered and invoiced amounts of those orders on the project. |

### 3.3 Templates

| ID | Requirement |
| --- | --- |
| **FR-15** | A user with `PROJECT_TEMPLATES_EDIT` can maintain templates: name, type, description, active flag, modules, member roles, task statuses to copy, budget lines, billing plan entries (percentage or amount), and tasks with title, description, issue type, parent, start offset and duration in working days, estimate, weight, milestone flag, assignee role and dependencies with kind and lag. |
| **FR-16** | A user with `ORG_PROJECT_ADD` can create a project from an active template, after a preview: the start defaults to today, the type comes from the template when blank, tasks are dated on the organization's working calendar (non-working days and holidays skipped), parents and dependencies are linked between the new tasks; an inactive template is refused. |
| **FR-17** | A user with `PROJECT_TEMPLATES_EDIT` can save an existing project as a template, offsets and durations taken from its task dates. |
| **FR-18** | The system can draft a template from a description and from comparable finished projects (their tasks and actual hours as estimates) as a preview that is saved only by the user. *(advanced)* |

### 3.4 Tasks, dependencies, schedule and recurrence

| ID | Requirement |
| --- | --- |
| **FR-19** | A user with `ORG_TASK_EDIT` can set a task's weight (zero or more, defaulting from its issue type), progress (0 to 100, else derived from status and children) and milestone flag. |
| **FR-20** | A user with `ORG_TASK_SETTING` can give each issue type a default weight. |
| **FR-21** | The system MUST warn on an open task under a done parent (refused only where the organization set dependency enforcement to block), warn when a child's dates leave its parent's or a task's dates leave the project's, and offer to close open children when a parent is moved to done. |
| **FR-22** | The system MUST treat the existing "blocks" and "is blocked by" links as the task dependencies, each with a kind (finish to start by default, start to start, finish to finish) and a lag in working days, within the organization and across its projects. |
| **FR-23** | The system MUST refuse a dependency that closes a cycle, naming the chain. |
| **FR-24** | The system MUST, per the organization's enforcement, warn or refuse moving a task to a done status while a predecessor is neither done nor cancelled. |
| **FR-25** | The system MUST, when a predecessor's dates move, move not-started successors that now break their link to the first allowed working day keeping their working-day duration, flag started ones, and apply or propose the change per setting (proposed by default, so no task moves without confirmation) with a list of what moves. |
| **FR-26** | A user with `ORG_PROJECT_VIEW` can open a project schedule on a timeline with tasks, milestones, dependencies and the critical path, and change dates by dragging with the rescheduling preview. *(advanced)* |
| **FR-27** | A user with `ORG_PROJECT_EDIT` can save a baseline of task dates, estimates and budget, compare the schedule with it and see variance per task. *(advanced)* |
| **FR-28** | The system MUST show overdue and delayed days on tasks past their due date and not done (the existing overdue view kept) and record who completed a task and when. |
| **FR-29** | A user with `ORG_TASK_ADD` can make a task recurring (every n days, weekly on chosen days, monthly on a day, until a date or a count, on schedule or after completion); each occurrence is a new task copying the fields, dated on working days. *(advanced)* |
| **FR-30** | The system MUST roll up per task, module and parent: tracked, approved and billable hours, cost, billable amount and billed amount. |
| **FR-31** | The system MUST apply the organization's rule for time on done or cancelled tasks to new timer starts and manual entries only: allow (the default, as today), warn, or refuse naming the task. |

### 3.5 Activity types, rates and costing of time

| ID | Requirement |
| --- | --- |
| **FR-32** | A user with `PROJECT_ACTIVITY_TYPES_EDIT` can maintain activity types: name, billable by default, productive for utilisation, default cost rate and bill rate per hour with currency, active; one default type is created when the feature is first enabled. |
| **FR-33** | The system MUST give every time log an activity type: the one chosen in a client that offers it, else from the task's issue type mapping, the project default, the employee default, then the organization default; it can be changed until its timesheet is approved. |
| **FR-34** | A user with `PROJECT_RATES_EDIT` can maintain dated rate cards (cost, bill and pay rate per hour with currency and effective date) for an employee, an employee level, an activity type, a project, a client, or combinations; the existing employee, project and project-member rates stay, and `payroll-setup` reads a card's pay rate for time on that project. |
| **FR-35** | The system MUST resolve a log's cost rate in the organization's order (default: employee and activity card, employee card, level and activity card, activity default, payroll cost per hour when `payroll-setup` offers it, the pay rate stored on the log when it was tracked) and convert it at the rate of the log's date. |
| **FR-36** | The system MUST keep the existing bill-rate precedence and stored rates for invoicing; activity and client cards price a log only where that precedence finds no positive rate, unless the organization chose activity first for new logs. |
| **FR-37** | The system MUST store each log's hours, cost rate, cost, rate source and card, recompute them when the log or an earlier-dated card changes while its timesheet is not approved, and recompute an approved log only on a recorded repricing by a holder of `PROJECT_RATES_EDIT` with a reason. |
| **FR-38** | A user with `PROJECT_BILLING_HOURS_EDIT` (or the project's manager) can set billing hours different from worked hours on a log or a timesheet portion with a reason, rounded by the existing duration rounding rule; invoices use billing hours. |
| **FR-39** | The system MUST cost hours above standard on a day with approved overtime from `attendance-and-shifts` at that overtime's multiplier. |
| **FR-40** | A user with `PROJECT_RATES_VIEW` can ask why a log costs and bills what it does and get the card, rule and conversion used. *(advanced)* |
| **FR-41** | The system MUST list unpriced hours (zero cost or bill rate) per project and person, with the rate that would apply once a card is added. |

### 3.6 Timesheet approval

| ID | Requirement |
| --- | --- |
| **FR-42** | The system MUST keep the existing timesheet submit, approve, deny, review and bulk status actions under `CAN_APPROVE_TIMESHEET`, and with the feature on route each submitted timesheet by project portion; the existing approve action still approves the whole timesheet as today, deciding all its portions. |
| **FR-43** | The system MUST route portions to `approval-workflows` when on (record type timesheet; default definition: the project's managers, else the reporting-line manager from `hr-core-lifecycle`, else holders of `CAN_APPROVE_TIMESHEET`), otherwise as request approvals to the same approvers on the existing Approvals page, never to the person whose time it is; the timesheet is approved when every portion is, and a denied portion returns the timesheet with the reason. A holder of `CAN_APPROVE_TIMESHEET` approving their own timesheet through the existing action is refused only where the organization switched that refusal on (FR-2). |
| **FR-44** | The system MUST show the approver hours per day, task and activity type, billable split, manual and edited time, activity level, idle time, screenshot count (subject to screenshot permissions), time off and overtime days, and budget impact; approve all, per portion or per log with comments; one concurrent decision wins and the other gets `409`. |
| **FR-45** | The system MUST, with locking on (organization setting, off by default), refuse editing, deleting, splitting or moving logs of an approved timesheet, naming it, and set its lock date; a holder of `PROJECT_TIMESHEETS_REOPEN` can reopen it with a reason, which sends it back to its approvers. With locking off, logs of approved timesheets stay editable as today. |
| **FR-46** | The system MUST remind employees before a period ends to submit, list working days without time and without time off, and remind approvers of portions waiting. |
| **FR-47** | An employee can ask to move logs or a timesheet to another project through the existing change requests, now with a screen, decided by the target project's manager. |
| **FR-48** | The system MUST show per timesheet its approval state per portion, billed hours and percentage (from invoice links), paid hours (from `payroll-processing`) and lock. |

### 3.7 Project budgets

| ID | Requirement |
| --- | --- |
| **FR-49** | A user with `PROJECT_BUDGETS_EDIT` can draft a project budget with lines by kind (labour by activity type, level or module; expenses by category; purchases; materials; other; revenue), each with hours, amount or both and an optional monthly spread across the fiscal years the project spans (even or typed), in project and organization currency. |
| **FR-50** | The system MUST take budgets through draft, submitted and approved, through `approval-workflows` when on (record type project budget) else as a request approval to holders of `PROJECT_BUDGETS_APPROVE` on the existing Approvals page; an approved budget is immutable, and a revision is a new version with a reason, a difference per line and its own approval; earlier versions stay readable. |
| **FR-51** | The system MUST keep the existing single budget: shown as one line while no structured budget exists, and, while mirroring is on, updated to the approved structured total of the existing budget type so existing reports and limits read it. |
| **FR-52** | A user with `PROJECT_BUDGETS_EDIT` can fill a draft from a template, from task estimates priced at resolved cost rates, or from a comparable project's actuals. |
| **FR-53** | The system MUST notify the project's managers once per line and version when actual plus committed passes each threshold (default 80 % and 100 %), never block time capture, and offer an optional warning on new time beyond the line's hours. |
| **FR-54** | The system MUST answer remaining project budget per kind (actual, committed, remaining) to purchasing and expense claims when no accounting budget line governs the document. |
| **FR-55** | The system MUST, with `budgets-and-revenue-schedules` on, list on the project the accounting budget lines whose project axis is this project with actual, committed, remaining, control action and monthly spread, and let a holder of the accounting budget permission start such a budget prefilled with the project axis and the fiscal years spanned; the budget the organization chose to govern projects (FR-2) is the one checked and mirrored, the other is shown read-only. |
| **FR-56** | The system MUST raise a burn alert when the forecast at completion passes a line or the run rate predicts exhaustion before the planned end, naming the expected breach date, with a re-plan draft (scope moved, dates changed or a budget revision) shown as a preview and applied only on acceptance. *(advanced)* |

### 3.8 Cost and revenue roll-up

| ID | Requirement |
| --- | --- |
| **FR-57** | The system MUST maintain per project, module, task and month: estimated and actual labour cost, expenses (approved claim lines and direct expenses), purchases (billed supplier lines and open committed order lines), materials (stock issued to the project, valued), other ledger costs, billed revenue (confirmed invoice lines less credit notes), billable not yet billed (approved billable time, re-billable expenses, reached milestones) and, with the ledger live, recognised revenue. |
| **FR-58** | The system MUST update figures within 5 s of the source change, reconcile them nightly, recompute a project on demand, and drill from every figure to its logs and documents. |
| **FR-59** | The system MUST replace estimated labour by the actual allocation of `payroll-processing` for each employee and period and show the difference as payroll variance. |
| **FR-60** | The system MUST compute gross margin as revenue (per the organization's basis) less all costs, and margin percentage of revenue, per project, client, type, manager and month. |
| **FR-61** | A user with `PROJECT_COSTS_VIEW` can open a project's costing view answering where the money went and where it is heading: spend against each budget line, the forecast and its health, the margin planned from the contract and the margin earned so far, cost and billing month by month, the documents that billed the project, what drives cost (by activity type, person, supplier or item) and unpriced hours; others see hours and progress only. |
| **FR-62** | The system MUST forecast at completion live: actual cost plus each open task's remaining effort (estimate less tracked, or by progress when there is no estimate) at its assignees' cost rates (the project's average when unassigned), and revenue by billing method, with health and its reasons. *(advanced)* |
| **FR-63** | A user with `PROJECT_COSTS_VIEW` can open an earned-value view: planned value from the baseline and budget, earned value from progress, actual cost, cost and schedule performance indices and their curves. *(advanced)* |
| **FR-64** | A user with `ORG_PROJECT_VIEW` can open a project overview made of cards: progress against the plan over time, milestones ahead, open and late work per person, hours not yet billed and what is due this week; each card loads and fails on its own. |
| **FR-65** | The system MUST, with the ledger live, show the project's ledger costs and revenue on its analytic dimension beside the operational figures, with the difference explained (unposted documents, estimated against actual labour). |

### 3.9 Billing

| ID | Requirement |
| --- | --- |
| **FR-66** | The system MUST offer the billing methods time and materials, fixed fee, milestones (the existing values) and retainer (added). |
| **FR-67** | A user with `PROJECT_BILLING_PLAN_EDIT` can maintain a project's billing plan: entries with description, a milestone task, a module or a date, an amount or a percentage of the contract value, expected date and whether client acceptance is needed; percentages above 100 are refused and a fixed-fee plan not at 100 warns. |
| **FR-68** | The system MUST mark an entry reached when its milestone task is done (or module completed) and, where acceptance is needed, accepted by a stakeholder or marked accepted by the project manager; reached entries are offered once to the billing worklist of `invoicing-receivables-payables`; reopening before invoicing withdraws them, after invoicing it only warns. |
| **FR-69** | The system MUST make date entries due on their date and offer them the same way. |
| **FR-70** | The system MUST offer to the billing worklist and to project billing schedules with "approved time only" on, for time-and-materials billing, only approved billable time, at billing hours, release time from void or credited-with-release invoices (existing rule), and keep fixed-fee and milestone time out of that hourly billing while showing its overrun; the existing invoice pages keep offering tracked time as today (FR-106). |
| **FR-71** | A user with `PROJECT_BILLING_PLAN_EDIT` can set a retainer of hours or amount per period: approved time draws it down, the balance is shown, a top-up invoice is proposed before it runs out, and overage is billed at rate or held per setting. *(advanced)* |
| **FR-72** | The system MUST include approved re-billable expense claim lines of `expenses-and-travel` and direct billable expenses in the project's billable figures, billed through the existing invoicing of expenses. |
| **FR-73** | The system MUST let a project have its own billing schedule (the existing client billing schedules, every week, two weeks or month, gaining a project scope and an "approved time only" switch) and, on each run, prepare an invoice draft from newly approved billable time, reached and due billing-plan entries and re-billable expenses, kept as a draft unless the schedule is set to send, with an evidence pack of hours by day, task and person with descriptions and, when the organization allows, activity level; screenshots are never included unless both the organization and the employee allow it. *(advanced)* |
| **FR-74** | The system MUST offer project progress and milestone completion to `budgets-and-revenue-schedules` as recognition progress. |

### 3.10 Capacity, allocation and utilisation

| ID | Requirement |
| --- | --- |
| **FR-75** | The system MUST compute each person's capacity per day and week from the working calendar of `time-off-management`, assigned shifts of `attendance-and-shifts`, the existing weekly limit as a cap, less approved time off and less days marked unavailable (partial days in part) in the existing employee availability and availability slots; agent employees have no capacity. |
| **FR-76** | A user with `PROJECT_ALLOCATIONS_EDIT` can allocate a person or an unfilled role to a project by week as hours or a percentage of capacity, tentative or confirmed; the person is notified of confirmed allocations. *(advanced)* |
| **FR-77** | A user with `PROJECT_ALLOCATIONS_VIEW` can open a workload board of people and weeks with capacity, allocated, planned (daily plans, estimates of tasks due) and tracked hours, over-allocation highlighted, and change allocations by dragging. *(advanced)* |
| **FR-78** | The system MUST compute utilisation per person, team, department and period: billable hours and productive hours (activity types marked productive) over capacity, against targets set per person or level as a share of capacity, with the person's existing time goals (hours per period) shown beside them; neither is derived from the other. |
| **FR-79** | The system MUST forecast demand from remaining estimates of open tasks by due date and allocations against capacity per team and skill of `hr-core-lifecycle`, flag short weeks and propose reallocations as a preview. *(advanced)* |

### 3.11 Project updates

| ID | Requirement |
| --- | --- |
| **FR-80** | A user with `PROJECT_UPDATES_MANAGE` can set a project's update collection: frequency (daily, weekly on a day, every two weeks), time window, who is asked, the question, who receives the digest; non-working days of the working calendar suppress prompts. |
| **FR-81** | The system MUST ask each person through an inbox item and email, take the answer in the app or as an email reply when `email-and-communications` receives mail, and store each answer on the round's update. |
| **FR-82** | A user with `PROJECT_UPDATES_MANAGE` can publish an update with health (on track, at risk, off track), summary, the answers and a snapshot of progress, budget used, forecast and next milestone; the digest goes to members and to stakeholders with updates switched on; updates stay in the project's history. |
| **FR-83** | The system can draft an update from the period's facts (tasks done and late, hours, budget burn, blocked dependencies, risks raised in comments) citing them, as a read-only preview the manager edits before publishing. *(advanced)* |

### 3.12 Reports

All reports are report definitions: filterable, groupable, exportable, schedulable and clonable; amounts need
`PROJECT_COSTS_VIEW`.

| Requirement | Report | Answers | Filters and grouping |
| --- | --- | --- | --- |
| **FR-84** | Project status | Where each project stands: progress, open and late work, actual dates against planned ones | organization, status, type, priority, manager, client |
| **FR-85** | Worked and billable time | How much tracked time can be billed and for how much, against what was worked | dates, project, employee, client; by day, project or employee; unapproved time in or out |
| **FR-86** | Time by day | Who logged what, on which task and activity type, in which approval state (the existing time reports kept) | dates, team, project, state |
| **FR-87** | Late tasks | Which tasks are past due, by how many days, and which predecessor holds them | project, dates, priority, status, assignee |
| **FR-88** | Project materials and purchases | Purchased, issued and delivered items per project with value | project, dates, item group, supplier |
| **FR-89** | Projects dashboard | How the portfolio is doing: projects by state, open work, hours this period, margin and forecast overruns | organization, manager |
| **FR-90** | Utilisation | How much of each person's capacity went to billable and to productive work, and how much stayed untracked | dates, department, team, project, level |
| **FR-91** | Project margin | Revenue against cost of time, expenses, purchases and materials, and the margin left | dates, client, project, employee, type, manager |
| **FR-92** | Hours by department (chart) | Tracked hours per department | dates, organization |
| **FR-93** | Hours by activity type (chart) | Tracked hours per activity type | dates, project, team |
| **FR-94** | Budget against actual | Budget, actual, committed, forecast and variance per line and version, with the existing project and client budget reports kept | project, version, kind, period |
| **FR-95** | Earned value | Planned, earned and actual cost with indices over time *(advanced)* | project, dates |
| **FR-96** | Capacity and allocation | Capacity, allocated, tracked and free hours per person and week *(advanced)* | dates, team, skill, project |
| **FR-97** | Unpriced and repriced time | Hours at zero rates; repricings with reasons | dates, project, employee |

### 3.13 API, agents and compatibility

| ID | Requirement |
| --- | --- |
| **FR-98** | The system MUST expose every action through the REST API and register project types, templates, budgets, billing plan entries, updates and allocations as record types for saved views, custom fields, approval definitions and automation triggers. |
| **FR-99** | The system MUST publish events (time costed; timesheet portion submitted and decided; timesheet approved and reopened; budget approved, revised and threshold crossed; burn alert; milestone reached and withdrawn; figures changed; update published; allocation changed; over-allocation) on the event outbox for invoicing, budgets, automations, webhooks and real-time updates. |
| **FR-100** | The system MUST keep the existing project, task, timer and report MCP tools and add tools for costs and forecast, rate explanation, budgets and revisions, templates and creation from a template, dependencies and rescheduling, timesheet submission and decision, billing plans, allocations and utilisation, and update drafting; writing tools return a preview first and act with the caller's permissions. |
| **FR-101** | The system MUST import activity types, rate cards, budgets, templates and allocations through the mapped import with errors per row. |
| **FR-102** | The system MUST grant the project's flagged managers the budget, billing plan, update and approval rights for their projects, cost and rate keys to administrators, and nothing new to employees beyond their own time and allocations, effective only while the feature is on. |
| **FR-103** | The system MUST record who, when, before and after for every rate card, activity type, budget version, billing plan entry, repricing, lock and reopen, allocation and setting change. |
| **FR-104** | The system MUST cost time logs written by other features (operation cards of `shop-floor-and-work-orders`, service visits) by their activity type and count them to a project when they carry one. |
| **FR-105** | The system MUST contribute a projects onboarding checklist (create a project, create a template, plan tasks, track time, submit a timesheet, view the overview) to `platform-administration`. |
| **FR-106** | The existing timer, manual time with its permissions, overlap and conflict checks, daily, weekly and calendar timesheet pages, screenshots, activity, stored rates and repricing, invoices by employee, project or task hours, invoice schedules, budget reports and starting time from a task MUST keep working unchanged. |
| **FR-107** | The system MUST show on timesheets and logs which payslip paid them, read from `payroll-processing`, which alone decides payment. |

## 4. Non-Functional Requirements

- **Performance**: costing of a stopped log under 200 ms after it is saved (asynchronous to the timer); figures visible
  within 5 s at the 95th percentile; project and portfolio views under 300 ms from maintained figures at 50,000 projects
  and 100 million time logs per tenant, never from raw scans; template creation of 500 tasks under 3 s; rescheduling of
  a 2,000-task chain under 1 s; workload board for 500 people and 26 weeks under 1 s.
- **Data volume and concurrency**: one decision per portion (row lock and version); figure upserts keyed per source so
  replays never double count; rescheduling serialised per project.
- **Reliability**: every consumer is idempotent by source key; a nightly reconciliation corrects figures from any
  capture path that published nothing (desktop offline uploads, integrations, bulk imports) and reports corrections.
- **Security & privacy**: tenant and organization scoped; cost rates, costs and margins visible only with
  `PROJECT_COSTS_VIEW` or `PROJECT_RATES_VIEW`; approvers see activity data under the existing screenshot and activity
  permissions; evidence packs exclude screenshots by default; leaves the platform: notification and update emails,
  invoice drafts (through invoicing), exports, and text sent to the organization's AI provider only for the assistant
  features when enabled.
- **Observability and audit**: history per budget, plan and timesheet; metrics for costing lag, unpriced hours,
  reconciliation corrections and alerts; audit of FR-103.
- **Accessibility and localisation**: timeline and board keyboard operable with list alternatives; charts with data
  tables; every string in every locale; amounts in the user's number format and currency.
- **Compatibility**: PostgreSQL, MySQL and SQLite; both ORMs; cloud and self-hosted; existing routes, contracts and MCP
  tools unchanged; additive OpenAPI and SDK changes only.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| `OrganizationProject` (extended) | The existing project; gains a paused status and a costing profile |
| `ProjectProfile` | Type, priority, department, contract value, progress method and settings of one project |
| `ProjectType` | A classification of projects with defaults |
| `TaskTemplate` (shared), `ProjectTemplateDetail` | A reusable plan of tasks with offsets, durations and links, shared with HR onboarding and separation; the project facts of a project template |
| `TaskPlan` | Weight, progress, milestone flag, completion stamp and baseline of a task |
| `TaskDependency` | Kind and lag of an existing blocking link between two tasks |
| `TaskRecurrence` | The rule that creates the next occurrence of a task |
| `WorkActivityType` | A kind of work with default rates and billable and productive flags |
| `RateCard` | A dated cost, bill and pay rate for an employee, level, activity, project or client |
| `TimeLogCost` | The activity type, cost and billing hours of one time log (its bill rates stay on the log) |
| `InvoiceSchedule` (extended) | The existing billing schedule, now also per project |
| `TimesheetPortion` | One project's part of a timesheet with its own approval |
| `ProjectBudget`, `ProjectBudgetVersion`, `ProjectBudgetLine` | A project's budget, its versions and lines by kind and month |
| `ProjectFigure` | Maintained cost and revenue per project, task, module, month and source |
| `ProjectBaseline` | A saved copy of dates, estimates and budget for comparison |
| `BillingPlanEntry`, `Retainer` | A milestone or dated billing event; a prepaid allowance drawn by approved time |
| `ResourceAllocation`, `CapacityTarget` | Planned hours of a person or role on a project per week; utilisation targets |
| `ProjectUpdate`, `UpdateCollection` | A published status round with answers; the schedule that collects it |

## 6. Out of Scope

- Invoices, credit notes, the billing worklist and its billed-once rules: `invoicing-receivables-payables`; journals:
  `general-ledger`; analytic dimensions: `accounting-foundation`; accounting budgets, control on documents and revenue
  recognition: `budgets-and-revenue-schedules`.
- Paying time and payroll cost allocation: `payroll-processing`; cost to company: `payroll-setup`; expense claims:
  `expenses-and-travel`; purchase orders and bills: `procurement`; stock issues and their value:
  `warehouse-and-stock-movements`, `stock-ledger-and-valuation`; sales orders: `sales-order-management`.
- Portal pages for projects, tasks, time and task entry by clients: `customer-and-supplier-portal`; links between
  tasks and tickets: `helpdesk-tickets`; operation-card time: `shop-floor-and-work-orders`.
- Approval engine: `approval-workflows`; working calendars and holidays: `time-off-management`; shifts and overtime:
  `attendance-and-shifts`; saved views engine: `record-views-and-search`; report engine:
  `report-builder-and-dashboards`; checklists engine: `platform-administration`; email intake:
  `email-and-communications`.
- Time capture itself (timer, time logs, screenshots, activity): existing and kept.

## 7. Acceptance Criteria

- [ ] **AC-1** A project created from a template has dated tasks on working days, remapped parents and dependencies, a
      draft budget and a billing plan; an inactive template is refused (FR-16).
- [ ] **AC-2** A dependency cycle is refused; a slipped predecessor moves its not-started successors keeping durations;
      a done move with an open predecessor warns or is refused per setting; a weekly recurring task creates its next
      occurrence on a working day (advanced: recurring tasks; FR-23–FR-25).
- [ ] **AC-3** Each progress method gives the expected percentage on a seeded project; completion at 100 never reopens
      automatically; complete-with-tasks cascades after a preview (FR-9, FR-10).
- [ ] **AC-4** A stopped timer log gets an activity type, a cost from the right card and the unchanged existing bill
      rate; the rate explanation names the card; unpriced hours are listed (FR-35, FR-37, FR-40, FR-41).
- [ ] **AC-5** A two-project timesheet routes portions to each manager, never routes a portion to its own employee,
      answers `409` on a concurrent decision, locks approved logs with locking on and reopens with a reason (FR-43).
- [ ] **AC-6** A budget is drafted, approved, revised with differences; thresholds notify once; the existing project
      budget report reads the mirrored total (FR-50, FR-53).
- [ ] **AC-7** Figures from time, a claim, a supplier bill, a stock issue and an invoice appear within 5 s with
      drill-down; payroll allocation replaces estimated labour with the variance shown (FR-57, FR-72).
- [ ] **AC-8** Live margin: forecast at completion follows remaining estimates and rates; a burn alert names the breach
      date and its re-plan preview changes nothing until accepted (advanced: live margin and burn alerts; FR-56, FR-62).
- [ ] **AC-9** A milestone reached and accepted appears once in the worklist; reopening before invoicing withdraws it (FR-68, FR-70).
- [ ] **AC-10** A monthly project billing schedule prepares an unconfirmed invoice draft with an evidence pack without
      screenshots; a retainer draws down from approved time (advanced: billing automation; FR-73).
- [ ] **AC-11** Baseline, critical path and earned-value indices match a worked example (advanced: schedule control; FR-27, FR-63).
- [ ] **AC-12** Capacity subtracts holidays and approved time off; an over-allocation is flagged; utilisation matches a
      seeded month (advanced: capacity planning; FR-76–FR-79).
- [ ] **AC-13** An update collection prompts members, stores answers and publishes a digest; the drafted update cites
      its facts (advanced: assistant updates and templates; FR-80–FR-83).
- [ ] **AC-14** Reports FR-84 to FR-97 match a seeded quarter; amounts are hidden without the cost permission.
- [ ] Works on PostgreSQL, MySQL and SQLite with both ORMs.
- [ ] Behind `FEATURE_PROJECT_COSTING`; with it off, existing project, time and invoice suites pass unchanged.
- [ ] All functional requirements have a passing test.
- [ ] **AC-15** With the feature on and every setting at its default, an approved timesheet stays editable, a holder of
      `CAN_APPROVE_TIMESHEET` approves a whole timesheet (their own included) through the existing action, the existing
      project form completes a project with open tasks, an open task can sit under a done parent with a warning, no task
      moves without confirmation, time can be tracked on a done task, and no existing project is completed
      automatically (FR-45).
- [ ] **AC-16** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-1, FR-3).

## 8. Open Questions

- The approved structured budget total is mirrored into the existing single budget field (applied, setting on by
  default) so the existing reports keep working; turning it off leaves the field to manual edits.
- Bill rates keep today's precedence; activity and client cards only fill gaps (applied); activity-first is opt-in.
- Approved time stays editable by default, as today (applied); organizations can turn locking on.
- Dependencies warn by default rather than block (applied).
- Clients that do not yet send an activity type get a derived one (applied); the timer clients add a picker later.
- Margin uses billed revenue by default, recognised revenue once the ledger is live and chosen (applied).
- Client acceptance of milestones is given in the portal when `customer-and-supplier-portal` is installed; without
  it the project manager marks it (applied). A paused status and a retainer billing method are added to the enums (additive).

## 9. Constitution Gates

- [x] I Plugin-first — new `project-costing` plugin with its UI plugin; core gains a paused status, a retainer billing
      value, time-log and timesheet change events, a project scope on billing schedules and the shared task templates,
      nothing parallel.
- [x] II Tenant/organization scoping — every record scoped; managers act on their projects only.
- [x] III Both ORMs, additive migrations — new tables and enum values, three dialects.
- [x] IV Default-off flag; nothing removed — `FEATURE_PROJECT_COSTING`; existing budgets, rates and invoices unchanged.
- [x] V Contracts and API first; backwards compatible — new routes; existing contracts gain optional members only.
- [x] VI Permissions, privacy, security — new keys; cost data behind its own permission; screenshots never shared by
      default.
- [x] VII Real-time through the event bus — outbox events; live figures and boards.
- [x] VIII i18n and accessibility — keys in every locale; keyboard and list alternatives for timeline and board.
- [x] IX Tests accompany the change — rate resolution, progress methods, rescheduling, roll-up idempotency, ORM parity.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Related features: [`invoicing-receivables-payables`](../invoicing-receivables-payables/spec.md),
  [`budgets-and-revenue-schedules`](../budgets-and-revenue-schedules/spec.md), [`accounting-foundation`](../accounting-foundation/spec.md),
  [`general-ledger`](../general-ledger/spec.md), [`expenses-and-travel`](../expenses-and-travel/spec.md),
  [`payroll-processing`](../payroll-processing/spec.md), [`payroll-setup`](../payroll-setup/spec.md),
  [`procurement`](../procurement/spec.md), [`sales-order-management`](../sales-order-management/spec.md),
  [`approval-workflows`](../approval-workflows/spec.md), [`time-off-management`](../time-off-management/spec.md),
  [`attendance-and-shifts`](../attendance-and-shifts/spec.md), [`report-builder-and-dashboards`](../report-builder-and-dashboards/spec.md)
- Existing code (`packages/core/src/lib/`): `organization-project` (entity, rate service), `tasks` (`task.entity.ts`,
  `linked-issue`, `estimation`, `built-in-views.ts`, `due-reminder`), `time-tracking/time-log` (`time-log.entity.ts`,
  `time-log-pricing.ts`, `time-log-rates.ts`, `time-log-repricing.ts`), `time-tracking/timesheet`, `invoice-item`,
  `invoice-schedule`, `reports`
- Related architecture: [platform architecture](../../architecture/business-suite.md) §2.5, §3.4, §3.6, §3.8, §3.11, §3.12