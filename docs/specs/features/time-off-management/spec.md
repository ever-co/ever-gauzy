# Feature Specification: Time-off management

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `time-off-management`
**Branch**: `feat/time-off-management`
**Status**: `Draft`
**Created**: 2026-11-16
**Last updated**: 2026-11-23
**Owner**: platform maintainers
**Feature flag**: `FEATURE_TIME_OFF_POLICIES` (default off); the existing `FEATURE_EMPLOYEE_TIMEOFF` keeps governing today's pages

---

## 1. Overview

Time off already exists: policies (paid or unpaid, approval, assigned employees), requests in whole days with a
one-step approval, balances per employee, policy and year that approvals deduct, and official holidays. This feature
deepens that same model — the existing policies, requests, balances and official holidays are extended, never
duplicated — into a complete time-off system: every policy rule editable on a screen and enforced; assignment rules
by branch, department, level, country or tenure; an append-only ledger behind every balance; accrual, carry-forward,
expiry and encashment that run on their own; half days and hours; compensatory time off; block periods; approvers
from the reporting line; holiday calendars per country and branch with weekly rest days; a team calendar; and
reports. Employees file their own requests; managers decide in one tap. Surfaces: the Gauzy app (time-off pages,
balances, holidays, calendar, settings), the REST API and SDKs, MCP tools, and Ever Teams, whose time-off screens use
this API.

**Advanced capabilities.** Time off understands work: a request shows the deadlines, sprint ends and meetings it
collides with, the share of the team still present against the team's minimum, and the capacity it removes estimated
from the person's tracked time per project; an assistant proposes who covers each open task and a manager accepts
per task. Every balance line explains itself (rule, period, pro-rating, rounding) and balances can be projected to a
future date. Requests and approvals work in one tap from the inbox, chat and the phone. One organization can run
policies and holiday calendars for several countries. Employees of kind AI agent are never given time off. Approved
time off flows into expected hours, presence and private calendar feeds.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** a policy "Annual leave" with 21 days a year accrued monthly at the end of the month, rounded to quarter
  days, **when** the accrual job runs on 31 March, **then** each assigned employee gets one accrual line of 1.75 days,
  and the balance screen explains it as "21 days ÷ 12 months = 1.75".
- **Given** a hire on 15 July matched by the rule "Spain, full-time: Annual leave 23 days, Sick leave", **when** the
  hire is saved, **then** both policies are assigned from 15 July, and the non-accruing one is granted its entitlement
  pro-rated to the remaining part of the year with the derivation on the ledger line.
- **Given** an employee with own-request permission, **when** they request Friday afternoon off, **then** the form
  shows 0.5 day, their balance before and after and their approver, the request is pending, and the half day is
  reserved as pending on the balance.
- **Given** that request, **when** the manager taps "Approve" on the inbox item (or in chat, or on the phone),
  **then** the decision is recorded, the reservation becomes taken, the employee is notified, and the item closes
  everywhere.
- **Given** an employee requesting 12–16 May, **when** they open the form, **then** they see "2 tasks due 14 May",
  "Sprint 23 ends 15 May", "Team Web below its minimum of 3 present on 15 May" and "about 30 h of tracked work, 60 %
  on project Website"; the approver sees the same plus proposed cover per task and accepts two proposals.
- **Given** a request for two hours on Tuesday under an hours-based policy, **when** it is approved, **then** 2 hours
  are taken from the balance, the day stays a working day in attendance and timesheets, and expected hours drop by 2.
- **Given** year end with 8 unused days and "carry forward up to 5, expiring after 90 days", **when** the new year
  starts, **then** 5 days are carried in with an expiry date, 3 days expire, and on day 91 the unused carried days
  expire with a ledger line each.
- **Given** branches in Berlin and New York with their country calendars, **when** a Berlin employee requests a week
  containing a German public holiday, **then** it counts 4 days; the same week for a New York employee counts 5.
- **Given** an encashable policy and the option "encash at period end", **when** the period ends, **then** a draft
  encashment appears for each employee with encashable days; confirming it takes the days from the balance and hands
  the amount to payroll.
- **Given** an employee who tracked 6 hours on a Saturday, **when** the day ends, **then** a draft compensatory claim
  is proposed; once approved, 0.75 day is granted to the compensatory policy with its expiry.
- **Given** a manager, **when** they open the team calendar for June, **then** they see approved and pending time off,
  holidays and block periods of their team, and colleagues see "off" without the policy.
- **Given** an assistant acting for an employee through MCP, **when** it submits a request, **then** it first gets the
  preview (duration, balance after, warnings, collisions) and nothing is saved until it confirms with the employee's
  own permissions; the ledger marks the entry as made by an agent.

### 2.2 Edge cases & failures

- **Given** the feature off, **when** anyone uses time off, **then** behaviour, routes, pages and balances are exactly
  as today; the new routes answer `404`.
- **Given** an employee without own-request permission and without `TIME_OFF_ADD`, **when** they file a request,
  **then** `403`.
- **Given** an existing request for 3–5 June, **when** the same employee requests 5–6 June, **then** it is flagged as
  overlapping, and refused when the organization turned that refusal on; two hour-based requests on one day that do
  not overlap in time are accepted.
- **Given** a policy that requires a sufficient balance, **when** a request exceeds the available days (remaining less
  pending), **then** it is refused with the shortfall; with negative balances allowed it is accepted down to the limit.
- **Given** a request touching a block period, **when** a manager who is not an allowed approver approves it,
  **then** it is refused naming the block period.
- **Given** two approvers deciding the same request at once, **when** both submit, **then** one decision wins, the
  other gets `409`, and days are taken once.
- **Given** the accrual job interrupted halfway, **when** it runs again, **then** each accrual line is granted once.
- **Given** a pay period closed by payroll in an organization that locks time off in closed pay periods, **when**
  someone edits unpaid days inside it, **then** it is refused with the period named; without that setting the edit is
  accepted and payroll sees it as arrears.
- **Given** an employee of kind agent, **when** someone assigns a policy or files a request for it, **then** refused.
- **Given** a policy with accrued lines, **when** someone changes its unit from days to hours, **then** refused with a
  hint to create a new policy.
- **Given** a request for 30 Dec–3 Jan where next year's balance does not exist and the policy requires sufficient
  balance, **when** submitted, **then** refused naming the missing period.

## 3. Functional Requirements

### 3.1 Policies and their rules (extends the existing time-off policy)

| ID | Requirement |
| --- | --- |
| **FR-1** | A user with `TIME_OFF_POLICY_EDIT` can edit every rule of a policy on a screen: name, category, colour, unit (days or hours), pay (paid, unpaid, or partial with a fraction), approval required, annual entitlement, entitlement period (calendar year, fiscal year, or the employee's work anniversary year), eligibility wait after joining, maximum consecutive duration, minimum notice (warn or refuse), half days allowed, hours allowed with a minimum, whether rest days and holidays inside a request count, negative balance with a limit, over-allocation, sufficient balance required, document required above a duration, optional-holiday policy, compensatory with expiry, accrual, carry-forward and encashment rules. |
| **FR-2** | The system MUST refuse: entitlement, accrual, carry-forward or encashment on an unpaid policy; a partial-pay fraction outside (0, 1); accrual on a compensatory or optional-holiday policy; a unit or entitlement-period change once ledger entries exist. |
| **FR-3** | The system MUST, when first enabled for an organization without policies, create a starter set (annual, sick, unpaid, compensatory, optional holiday) that the organization edits; organizations with policies get none. |
| **FR-4** | The system MUST apply a rule change to accruals and requests from then on, never to existing ledger entries, and keep each policy's change history. |
| **FR-5** | The system MUST let a policy be limited to one country and assign it only to employees whose branch (or else organization) is in that country, so one organization runs policies of several countries. *(advanced)* |

### 3.2 Assignment

| ID | Requirement |
| --- | --- |
| **FR-6** | A user with `TIME_OFF_ALLOCATE` can define named assignment rules in priority order: criteria (branch, department, position, level, employment type, country, employee group, tenure range) and one or more policies, each with an optional entitlement override; the highest-priority matching rule decides an employee's entitlement for a policy. |
| **FR-7** | The system MUST re-evaluate rules daily and on hire, transfer, level and branch changes: matching employees get an assignment from the effective date, employees no longer matching have it ended the day before (balance kept, no further accrual); manual assignments are never ended by rules, and every policy membership that exists when the feature is turned on counts as manual. |
| **FR-8** | The system MUST keep each assignment's start (default the joining date) and optional end, and refuse two overlapping assignments of one policy to one employee; the policy's existing list of employees stays in step with the open assignments, and adding or removing an employee there starts or ends an assignment. |
| **FR-9** | The system MUST, when an assignment starts, grant for the current period: a non-accruing policy its entitlement pro-rated to the remaining period and rounded by the policy; an accruing policy its accruals for elapsed accrual periods plus a planned schedule capped at the entitlement; a compensatory policy nothing. |
| **FR-10** | A user with `TIME_OFF_ALLOCATE` can grant a policy or a rule to employees filtered by branch, department, position, level, employment type and group, for the current period, from joining or for custom dates, with or without carry-forward, after a preview, and get a result per employee (granted, skipped with reason, failed). |
| **FR-11** | The system MUST list employees without an assignment or a balance for a chosen policy and period. |
| **FR-12** | The system MUST refuse to assign policies, grant balances, accrue or file requests for employees of kind agent, and show agents as always available in calendars. *(advanced)* |

### 3.3 Balances and ledger

| ID | Requirement |
| --- | --- |
| **FR-13** | The system MUST keep a balance per employee, policy and entitlement period with granted, carried forward, taken, pending, expired, encashed, carried out and remaining, and an available figure of remaining less pending. |
| **FR-14** | The system MUST write every balance change as an append-only ledger entry (opening, grant, accrual, adjustment, taken, returned, carried in, carried out, expiry, encashment, compensatory earned) with amount, effective date, source document and actor; a balance equals the sum of its entries; corrections are new entries. |
| **FR-15** | The system MUST, when the feature is enabled, write one opening entry per existing balance component, and the existing allocate, deduct, reverse and carry-forward routes MUST keep working and write entries. |
| **FR-16** | The system MUST give each grant, accrual, carry and expiry entry a readable derivation (rule, period, base amount, pro-rating fraction, rounding, cap) shown line by line on the balance screen, in the API and in MCP. *(advanced)* |
| **FR-17** | The system MUST answer a balance as of any date, including planned accruals and expiries up to that date, and show the projected balance on the request form for its start date. *(advanced)* |
| **FR-18** | A user with `TIME_OFF_ALLOCATE` can add or reduce days on a balance with reason and effective date; zero is refused; a reduction below zero only where negative balances are allowed; an addition above the entitlement only where over-allocation is allowed; a repeated idempotency key applies once. |
| **FR-19** | A user with `TIME_OFF_ALLOCATE` can grant days for a date range to an employee and policy; overlapping grants of one policy, grants on unpaid policies and grants into a period already carried forward are refused. |
| **FR-20** | The system MUST show balances per policy (components, ledger with derivations, planned accruals and expiries) to the employee for themselves, to managers for their reports, and to holders of `TIME_OFF_VIEW` for the organization. |

### 3.4 Accrual, carry-forward and expiry

| ID | Requirement |
| --- | --- |
| **FR-21** | The system MUST accrue by policy: frequency (daily, weekly, every two weeks, monthly, quarterly, half-yearly, annually), amount per period or entitlement divided by periods, accrual day (start of period, end of period, anniversary of joining), pro-rating of partial periods, rounding (none, quarter, half, whole day), cap at the entitlement and optional maximum balance. |
| **FR-22** | The system MUST run accrual daily per organization in its time zone, grant each due line once per employee, policy and accrual period, record each run with outcomes, retry failed lines on the next run or on demand, and notify holders of `TIME_OFF_ALLOCATE` of failures with reasons. |
| **FR-23** | The system MUST keep per balance its accrual schedule: date, amount, planned, granted, failed, skipped or released, source (schedule, rule, manual) and failure reason. |
| **FR-24** | A user with `TIME_OFF_ALLOCATE` can release planned accrual lines early with a comment, never beyond the entitlement. |
| **FR-25** | The system MUST stop accrual while the employee is suspended and after their end of work, and pro-rate it for unpaid time off when the policy says so. |
| **FR-26** | The system MUST, on the first day of a new period, carry unused remaining days up to the policy cap into the new balance as a separate carried part with its expiry date, and expire the rest (or offer it for encashment when the policy says so); the existing carry-forward route stays and does nothing twice. |
| **FR-27** | The system MUST expire, daily, carried parts past their expiry and grants of ended periods that were not carried, each as a ledger entry; a user with `TIME_OFF_ALLOCATE` can expire carried days early. |
| **FR-28** | The system MUST take days from the part that expires first, then from current grants. |

### 3.5 Requests

| ID | Requirement |
| --- | --- |
| **FR-29** | An employee with `TIME_OFF_REQUEST_OWN` can file, edit while undecided and withdraw their own requests; filing for others still needs `TIME_OFF_ADD`. |
| **FR-30** | The system MUST take on a request: policy, dates, the portion of the first and last day (whole, first half, second half) or start and end times for hours, reason, attachments and an email-notification switch (default on); and show duration, balance before and after, pending, projected balance and approver before submission. |
| **FR-31** | The system MUST count duration on the employee's holiday calendar: working days in the range, leaving out rest days and holidays unless the policy counts them; a half day counts 0.5 and a half holiday leaves 0.5 working day; hours count within each day's working hours (organization standard hours, or the shift when `attendance-and-shifts` is on); a half day on a holiday is refused. |
| **FR-32** | The system MUST refuse: an end before the start; days before the eligibility wait; more than the maximum consecutive duration counting adjacent requests of the same policy; insufficient available balance where required; optional-holiday requests on other days; and it MUST warn (or refuse, per policy) on short notice and on days already marked present by `attendance-and-shifts`. Overlap with another undecided or approved request of the employee (time-disjoint hour requests excepted), days on which the employee is not active, and backdating beyond a limit without `TIME_OFF_BACKDATE` are warnings, and become refusals only through organization settings that are off by default (no backdating limit unless one is set), so requests that are accepted today stay accepted. |
| **FR-33** | The system MUST charge a request spanning two entitlement periods to each period's balance for its own days, and refuse it naming the period when one has no balance and the policy requires sufficient balance. |
| **FR-34** | The system MUST reserve a submitted request's duration as pending and turn it into taken on approval or release it on denial or withdrawal. |
| **FR-35** | The system MUST require an attachment before approval when the duration exceeds the policy's threshold, or accept it later with reminders when the policy allows late proof. |
| **FR-36** | The system MUST let the requester withdraw before the start and, after the start, let an approver shorten the request to the days taken, returning the rest as ledger entries; the existing withdraw and recover routes keep their behaviour. |
| **FR-37** | The system MUST re-validate and re-charge an approved request when it is edited (as today), and send it back for approval when its duration grows only when the organization setting asks for it (off by default: an edited approved request stays approved, as today). |

### 3.6 Approval and block periods

| ID | Requirement |
| --- | --- |
| **FR-38** | The system MUST route a request: with `approval-workflows` on, to the organization's time-off workflow (default: one step to the approver resolved by `hr-core-lifecycle`, else holders of `TIME_OFF_APPROVE`); otherwise through the existing request approval with that approver named; a policy without approval approves on submission. |
| **FR-39** | The resolved approver or a holder of `TIME_OFF_APPROVE` can approve or deny with a comment; an organization setting (off by default) stops people from deciding their own requests; the existing administrator approval routes keep working as today. |
| **FR-40** | The system MUST refuse a request without a resolvable approver when the organization makes approvers mandatory (a setting, off by default), naming what to set up. |
| **FR-41** | A user with `TIME_OFF_POLICY_EDIT` can define block periods (dates or a weekday in a range, reason, scope of organization, branch, department or team, optional policies, allowed approvers); a request touching one warns requester and approver, and only an allowed approver or a holder of `TIME_OFF_BLOCK_OVERRIDE` can approve it. |
| **FR-42** | The system MUST give approvers an inbox item with the request's summary (duration, balance after, collisions, cover) and approve and deny actions, the same actions on the phone and as a chat record card when those are loaded and `FEATURE_CHAT_RECORD_CARDS` is on, and close the item everywhere in real time once decided. *(advanced)* |
| **FR-43** | The system MUST notify the approver of a new or withdrawn request and the requester of a decision, honouring the request's email switch and notification preferences, and remind an undecided approver after a configurable number of hours (default 24). |

### 3.7 Work-aware time off and cover

| ID | Requirement |
| --- | --- |
| **FR-44** | The system MUST list, on the form and for the approver, collisions: tasks assigned to the employee due in or two working days after the range, sprints of their teams ending in the range, deadlines of projects they tracked time on in the last 8 weeks, appointments with them, and teammates already off; collisions warn and never refuse. *(advanced)* |
| **FR-45** | A user with `TIME_OFF_POLICY_EDIT` can set a team's or department's minimum present (count or share of members on working days); a request that goes below it shows the days and, per setting, warns, needs the team manager's approval in addition, or is refused; for an employee with shifts in the range, the coverage targets of `attendance-and-shifts` are checked instead of the team minimum. *(advanced)* |
| **FR-46** | The system MUST estimate the capacity a request removes from the employee's tracked hours per working day over the last 8 weeks and its split by project, and show it to the approver. *(advanced)* |
| **FR-47** | The system MUST propose, for each open task of the requester due in the range, a teammate who is a member of the task's project or team, holds its skills, is not off and has the lowest planned load (daily plans and tracked time), with a handover note; the manager accepts per task (added as assignee for the period or reassigned), edits or rejects; nothing changes before acceptance. *(advanced)* |
| **FR-48** | The system MUST provide expected working hours per employee and day net of rest days, holidays and approved time off, and the time-and-activity, weekly-limit and expected-hours reports MUST use them when the feature is on. *(advanced)* |
| **FR-49** | The system MUST show "off" for employees on approved time off today in team member lists, chat presence and the organisation chart. *(advanced)* |

### 3.8 Holiday calendars

| ID | Requirement |
| --- | --- |
| **FR-50** | A user with `TIME_OFF_HOLIDAYS_EDIT` can maintain holiday calendars (name, country and subdivision, weekly rest days, colour, organization default) and their holidays per year (date or range, name, kind public, company or optional, half day with its half, recurring yearly or by rule such as "first Monday of May" or "Easter plus one day"); existing official holidays are shown and edited here. The time-off page's existing "Add holiday" dialog stays and keeps filing its holiday entries as today; it gains a link to this page. |
| **FR-51** | The system MUST show rest days in the calendar view and add "every <weekday> between two dates" as company holidays in one step. |
| **FR-52** | The system MUST refuse a second holiday on the same date in one calendar, a range ending before it starts, and a half day on a rest day. |
| **FR-53** | A user with `TIME_OFF_HOLIDAYS_EDIT` can import holidays for chosen years from a holiday source (country packs of `regional-compliance-packs`, an iCalendar file or address, a spreadsheet file), after a preview that skips duplicates; imported holidays are the platform's existing official holidays, linked to the chosen calendar. |
| **FR-54** | A user with `TIME_OFF_HOLIDAYS_EDIT` can assign a calendar to the organization, a branch or an employee from a start date; the calendar of an employee on a date is the most specific assignment in force (employee, branch, organization), ranges crossing a change use each calendar for its days, and without assignment today's rule applies (every official holiday of the organization, Saturday and Sunday off). |
| **FR-55** | The system MUST answer whether a date is a working day, rest day, holiday or half holiday for an employee, branch or organization and count working days between dates, for attendance, payroll, projects and automations. |
| **FR-56** | The system MUST send employees a weekly or monthly digest of upcoming holidays of their calendar, per organization setting. |
| **FR-57** | The system MUST let employees take optional holidays of their calendar through an optional-holiday policy, up to its entitlement. |
| **FR-58** | The system MUST put each employee's approved time off and holidays in their private, revocable calendar feed of `calendar-and-scheduling`, and give managers a team feed there showing names and dates only. *(advanced)* |

### 3.9 Compensatory time off

| ID | Requirement |
| --- | --- |
| **FR-59** | An employee can claim compensatory time off for work on rest days or holidays (dates and hours, prefilled from their tracked time on those dates); the claim is approved like a request; approval grants hours divided by standard hours, rounded by the policy, to the compensatory policy with its expiry; a work day is credited at most once, whatever the source. |
| **FR-60** | The system MUST propose a draft claim to an employee whose tracked time on a rest day or holiday exceeds the organization threshold (default 2 hours) when `attendance-and-shifts` is off for the organization; with it on, approved overtime the employee takes as time off is the source of compensatory credit instead. *(advanced)* |

### 3.10 Encashment and payroll

| ID | Requirement |
| --- | --- |
| **FR-61** | The system MUST compute encashable days as remaining less the policy's reserve, capped by its maximum per period. |
| **FR-62** | A user with `TIME_OFF_ENCASH` can create an encashment (employee, policy, period, days up to encashable) whose daily amount comes from `payroll-setup` when on, else from the employee's pay rate times standard hours; confirming takes the days through the ledger and hands the amount to `payroll-processing` (or `payments-and-collections` for a direct payout); it shows paid when they report it; cancelling before payment returns the days. |
| **FR-63** | The system MUST draft encashments the day after a period ends for policies set to encash at period end. |
| **FR-64** | The system MUST publish approved unpaid and partial-pay days per employee and pay period (with the pay fraction) for `payroll-processing`, show on a request the payslip that consumed it, and, where the organization switched on the payroll setting "lock time off in closed pay periods" (`payroll.lockTimeOffInClosedPeriods`, off by default), refuse changes to such days in a pay period that payroll has closed; with the setting off such a change is accepted and reaches payroll as arrears or a correction of the next run. |
| **FR-65** | The system MUST offer the encashable balance at the end-of-work date as a source of the final settlement of `hr-core-lifecycle`. |

### 3.11 Calendar and reports

| ID | Requirement |
| --- | --- |
| **FR-66** | The system MUST show a team calendar (month and week) of approved and pending time off, holidays and block periods for my team, department, project or, with `TIME_OFF_CALENDAR_VIEW`, the organization, filterable by policy. |
| **FR-67** | The system MUST show colleagues only "off" without the policy or reason, and let the organization show department absences to all members. |

All reports are report definitions: filterable, groupable, exportable, schedulable and clonable.

| Requirement | Report | Answers | Filters and grouping |
| --- | --- | --- | --- |
| **FR-68** | Balances over a period | Opening, granted, taken, expired, encashed and closing per employee and policy | dates, organization, branch, department, employee, status; policies combined or apart |
| **FR-69** | Balances on a date | Remaining per employee across policies | date, organization, department, employee, status |
| **FR-70** | Ledger | Every grant, use, carry, expiry and encashment | dates, policy, employee, kind, source, organization, department |
| **FR-71** | Time off by policy (chart) | Which policies are used | dates, organization, department |
| **FR-72** | People off (cards) | How many are off today and this month | organization, department |
| **FR-73** | Absence analytics | Absence rate (time off over working days), short-absence frequency, planned versus unplanned share, by department and month | dates, organization, department, branch *(advanced)* |

### 3.12 API, agents and compatibility

| ID | Requirement |
| --- | --- |
| **FR-74** | The system MUST expose every action through the REST API (existing routes unchanged) and register requests, encashments and compensatory claims as record types for saved views, custom fields, approval definitions and automation triggers. |
| **FR-75** | The system MUST publish events (request submitted, approved, denied, withdrawn with dates and day portions; balance changed; accrual run; encashment confirmed; holiday calendar changed) on the event outbox for attendance, payroll, automations, webhooks and real-time updates. |
| **FR-76** | The system MUST keep the existing time-off MCP tools working and add tools for balances with derivations, requests with a preview of duration and collisions, decisions, cover proposals, the team calendar and holiday lookups, acting with the caller's permissions. |
| **FR-77** | The system MUST import opening balances, requests history and holidays through the mapped import, reporting errors per row. |
| **FR-78** | The system MUST grant `TIME_OFF_REQUEST_OWN` to the employee role, the policy keys to administrators and the new keys per plan, effective only while the feature is on. |
| **FR-79** | The system MUST, with the feature off, load no route, job or rule of the feature, enforce nothing new and leave balances, requests and holidays as they are. |
| **FR-80** | The system MUST record who, when, before and after for every policy, rule, calendar, block period, adjustment and encashment change. |

## 4. Non-Functional Requirements

- **Performance**: request form answers duration, balances and collisions under 400 ms at the 95th percentile; team
  calendar for 500 people and a month under 1 s; daily accrual for 100,000 employees within 10 minutes in batches;
  balance reads from maintained components, never by summing the ledger at read time.
- **Data volume and concurrency**: 50 million ledger entries per tenant; the existing row lock on a request and its
  balances stays the serialisation point; one accrual, carry-forward or expiry run per organization at a time.
- **Reliability**: every scheduled grant, carry, expiry and draft keyed so a repeated run changes nothing.
- **Security & privacy**: tenant and organization scoped; reasons and attachments visible to requester, approvers and
  HR only; colleagues see "off"; leaves the platform: notification emails, calendar feeds (names and dates), files a
  user exports; cover proposals use skills and workload already visible to the manager.
- **Observability and audit**: ledger per balance, run records with outcomes and failures, audit entries of FR-80.
- **Accessibility and localization**: keyboard-operable calendar and forms, labelled day cells, every string in every
  shipped locale, dates in the user's format and week start.
- **Compatibility**: PostgreSQL, MySQL and SQLite; both ORMs; cloud and self-hosted; existing time-off routes, pages,
  MCP tools and balances unchanged; additive OpenAPI and SDK changes only.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| `TimeOffPolicy` (extended) | A kind of time off and all its rules: unit, pay, entitlement, accrual, carry-forward, encashment, limits |
| `TimeOffRequest` (extended) | A request with day portions or hours, computed duration, collisions and payroll link |
| `TimeOffBalance` (extended) | Totals of one employee, policy and entitlement period, now with pending, expired and encashed |
| `TimeOffBalanceDeduction` (existing) | The days one approved request took from one balance (unchanged) |
| `OfficialHoliday` (extended) | A holiday date or range, now with a recurrence rule |
| `TimeOffLedgerEntry` | One append-only movement of a balance with its derivation |
| `TimeOffPolicyAssignment`, `TimeOffAssignmentRule` | A dated assignment of a policy to an employee; a rule that creates them |
| `TimeOffAccrualLine` | A planned or granted accrual with the run that granted it |
| `HolidayCalendar`, `HolidayCalendarDay`, `HolidayCalendarAssignment` | A named holiday calendar with rest days; a holiday in it; who uses it from when |
| `TimeOffBlockPeriod` | Dates on which time off needs an allowed approver |
| `TimeOffCoverageRule` | A team's or department's minimum present |
| `TimeOffEncashment` | Days of a balance turned into pay |
| `CompensatoryClaim` | Work on rest days or holidays turned into time off, one credited work day at a time |
| `TimeOffCoverProposal` | A proposed teammate to cover a task during an absence |

## 6. Out of Scope

- Attendance marks for days off and shift hours: `attendance-and-shifts` (consumes FR-75 events).
- Payment days and payslips: `payroll-processing`; daily rates: `payroll-setup`; direct payouts:
  `payments-and-collections`; country holiday content: `regional-compliance-packs` (through FR-53).
- Reporting line, approver lists, branches, employee groups, final settlement: `hr-core-lifecycle`; approval engine,
  delegation and escalation: `approval-workflows`; notification channels: `automation-and-notifications`.
- Ever Teams screens: the Ever Teams spec `people-self-service`; chat record cards: `chat-agents-and-record-actions`; calendar feeds:
  `calendar-and-scheduling`; shift coverage targets: `attendance-and-shifts`.

## 7. Acceptance Criteria

- [ ] **AC-1** A policy with every rule of FR-1 is edited on screen; invalid combinations of FR-2 are refused.
- [ ] **AC-2** An assignment rule assigns a mid-year hire with a pro-rated grant; leaving the criteria ends the
      assignment the day before; manual assignments survive; a country-limited policy reaches only that country
      (advanced, multi-country) (FR-7–FR-9, FR-11).
- [ ] **AC-3** Monthly accrual, year-end carry-forward with expiry and later expiry each write one ledger entry per
      line with a derivation, also when the jobs run twice; balances equal their ledger; a projected balance for a
      future date includes planned accruals (advanced, explained balances) (FR-15, FR-27, FR-28).
- [ ] **AC-4** Half-day and hour requests count correctly on two calendars with different rest days and a half
      holiday; eligibility, consecutive limit and insufficient balance are refused; overlap and backdating warn, and
      are refused once their organization settings are on (FR-31, FR-55).
- [ ] **AC-5** A request is approved from the inbox in one tap through the resolved approver; with `approval-workflows`
      on it follows the workflow; block periods need an allowed approver (advanced, decisions) (FR-38, FR-39, FR-42).
- [ ] **AC-6** Collisions, team minimum, capacity estimate and cover proposals appear for a seeded team; accepting a
      proposal adds the assignee for the period only (advanced, work-aware) (FR-44–FR-46).
- [ ] **AC-7** Holiday calendars import from a file and a pack source, assign per branch, and the lookup answers
      per employee; the private feed shows approved time off (advanced, feeds) (FR-53, FR-54).
- [ ] **AC-8** A compensatory claim prefilled from tracked time grants days with expiry; an encashment hands its
      amount to payroll and returns days when cancelled; unpaid days reach the payroll feed (FR-59, FR-60, FR-62).
- [ ] **AC-9** The team calendar shows team absences and hides policies from colleagues; reports of §3.11 match
      the ledger; expected hours exclude approved time off.
- [ ] **AC-10** Denial answers `403`; concurrent decisions answer `409` with days taken once; an agent employee is
      refused (FR-34).
- [ ] Works on PostgreSQL, MySQL and SQLite with both ORMs.
- [ ] Behind `FEATURE_TIME_OFF_POLICIES`; with it off, existing time-off suites pass unchanged.
- [ ] **AC-11** With the feature on and no setting saved, the existing request dialog, "Add holiday" dialog, policy
      members, overlapping and backdated requests, self-approval by an administrator and edits of approved requests
      behave as today; existing policy members are never removed by an assignment rule (FR-50).
- [ ] **AC-12** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-79).
- [ ] All functional requirements have a passing test.

## 8. Open Questions

- Spanning two periods charges each period instead of refusing (applied); a refusal setting can follow if wanted.
- Calendar precedence is employee, branch, organization (applied); departments do not hold calendars.
- Team minimum default enforcement is "warn" (applied).
- Collisions look two working days past the range and 8 weeks back for tracked time (applied); both are settings.
- Approved time off is not written into timesheets as time entries (applied); it reduces expected hours instead.
- Without `hr-core-lifecycle`, approvers come from `TIME_OFF_APPROVE` holders and calendars assign to organizations
  and employees only (applied).

## 9. Constitution Gates

- [x] I Plugin-first — new plugin `time-off-policies` with UI plugins; core time-off entities gain columns and three
      optional hooks, nothing parallel.
- [x] II Tenant/organization scoping — every record scoped; holiday calendars per organization.
- [x] III Both ORMs, additive migrations — nullable columns and new tables, three dialects.
- [x] IV Default-off flag; nothing removed — `FEATURE_TIME_OFF_POLICIES`; today's routes, pages and tools unchanged.
- [x] V Contracts and API first; backwards compatible — new fields optional; balance formula unchanged at zero.
- [x] VI Permissions, privacy, security — nine new keys; reasons and attachments limited; feeds revocable.
- [x] VII Real-time through the event bus — outbox events; inbox items close live.
- [x] VIII i18n and accessibility — every string a key in all locales; accessible calendar.
- [x] IX Tests accompany the change — counting, ledger invariants, jobs idempotency, guards.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Related features: [`hr-core-lifecycle`](../hr-core-lifecycle/spec.md), [`approval-workflows`](../approval-workflows/spec.md),
  [`attendance-and-shifts`](../attendance-and-shifts/spec.md), [`payroll-processing`](../payroll-processing/spec.md),
  [`payroll-setup`](../payroll-setup/spec.md), [`regional-compliance-packs`](../regional-compliance-packs/spec.md)
- Existing code (`packages/core/src/lib/`): `time-off-policy`, `time-off-request`, `time-off-balance` (`working-days.ts`,
  `time-off-balance-deduction.service.ts`, `time-off-balance-ledger.ts`), `official-holiday`, `request-approval`
- Related architecture: [platform architecture](../../architecture/business-suite.md) §2.5 (time off), §3.6 (approvals), §3.9 (automation), §3.12 (AI and MCP)
