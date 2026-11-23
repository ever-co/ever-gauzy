# Feature Specification: Attendance and shifts

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `attendance-and-shifts`
**Branch**: `feat/attendance-and-shifts`
**Status**: `Draft`
**Created**: 2026-11-16
**Last updated**: 2026-11-23
**Owner**: platform maintainers
**Feature flag**: `FEATURE_ATTENDANCE` and `FEATURE_SHIFTS` (default off; each enables its own part and each part works without the other)

---

## 1. Overview

Today presence is only derived from the timer: start and stop times of time logs, "who is working now", breaks, and
weekly limit reports. There is no attendance record, check-in, shift, roster, location rule or overtime rule. This
feature adds two plugins. **Attendance** keeps one **attendance day** per employee, date and shift, built from
**check-ins** (web, phone, kiosk, devices), from the platform's own **tracked time** and from the calendar (holidays,
approved time off, work away from the office); it adds work locations with geofencing, a device API, remote-work and
off-site requests, corrections, overtime types, overtime statements for payroll, and attendance reports. **Shifts**
adds shift templates, repeating patterns, assignments, shift requests, open shifts and swaps, working-time rules and a
drag-and-drop roster. The timer, time logs, timesheets, availability and appointments stay as they are and become
sources. Surfaces: the Gauzy app (Attendance and Shifts menus, kiosk page), the REST API and SDKs, MCP tools, the
desktop timer (its start and stop are check-ins) and Ever Teams, whose check-in, attendance and shift screens on
phones and desktops use this API.

**Advanced capabilities.** Nobody has to mark attendance: tracked time, check-ins and the calendar are reconciled on
their own and only exceptions reach a person, each with a proposed fix. An agent proposes a fair roster that respects
availability, skills, time off, working-time rules and labour cost, and explains every assignment. A shift
marketplace lets people offer, swap and pick up shifts under approval rules that approve safe trades on their own.
Labour demand is forecast from orders, tickets, work orders, appointments and tracked-time history. Kiosks and phones
check in offline. Location is captured only at the moment of a check-in, minimized and purged by default. Overtime
can be approved before it is worked. A live board shows who is in, per location.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** an employee on a remote day with the desktop timer, **when** they track 9:02–12:30 and 13:15–17:40,
  **then** without any other action the day becomes present, remote, 7 h 53 min worked, 45 min break, from tracked
  time, and no one is asked anything.
- **Given** an office employee on the "Early" shift 07:00–15:00 with a 10-minute late grace, **when** they check in on
  the phone at 07:14 inside the office radius and check out at 15:05, **then** the day is present, 14 minutes late, and
  appears in the punctuality report.
- **Given** a kiosk at the warehouse entrance, **when** a worker scans the code shown in their phone app, **then** the
  kiosk shows their name, "In" and the time, and nothing else.
- **Given** a kiosk that lost its network for three hours, **when** it reconnects, **then** the queued check-ins are
  accepted with their original times and the affected days are rebuilt.
- **Given** a factory terminal, **when** it posts a batch of 300 check-ins identified by badge numbers, **then** each
  item answers accepted, duplicate or refused with a reason, and an unknown badge is refused alone.
- **Given** a check-in without a check-out by the end of the shift window, **when** the day closes, **then** an
  exception "missing check-out" reaches the employee with the proposal "check-out at 17:02, when your timer stopped";
  one tap accepts it; if nobody acts within a working day, the approver gets it.
- **Given** approved time off on Friday afternoon, **when** Friday is processed, **then** the second half is time off
  linked to the request and the first half is built from check-ins.
- **Given** an employee who asks for remote work Monday to Wednesday, **when** the approver taps "Approve" in the
  inbox, **then** those days are remote and count as present for the requested portions.
- **Given** a planner on the roster for March, **when** they drag a "Late" shift from Anna on 12 March to Ben,
  **then** the move is checked (skills, time off, rest between shifts, weekly hours), shown as a draft, and published
  with "Publish" — Anna and Ben get a notice with their own change.
- **Given** store targets for four weeks, **when** the planner asks for a proposal, **then** within a minute they see
  a draft with coverage 97 %, cost, 6 h overtime, a fairness spread and per row "why Ben: holds Forklift, available,
  22 h left this week, 2 weekend shifts in 8 weeks against a team average of 4"; they accept two weeks.
- **Given** an open Saturday shift, **when** an eligible colleague picks it up and every rule passes with no extra
  overtime, **then** it is approved on its own and the roster updates live for everyone viewing it.
- **Given** a nurse who wants to swap Tuesday night with a colleague's Thursday night, **when** the colleague accepts,
  **then** the swap goes to the manager because it creates 4 hours of overtime, and is applied on approval.
- **Given** an employee who needs to work late on Thursday, **when** the manager approves 2 h of overtime in advance,
  **then** the 1 h 40 min worked beyond the shift is approved on its own and lands on the March overtime statement.
- **Given** the March pay period, **when** a payroll officer builds overtime statements for the pay group, **then**
  each employee with approved overtime gets a statement with lines by date, type and day kind; approved statements
  reach payroll and each line is paid once.
- **Given** a manager, **when** they open the presence board for the Lyon office at 09:30, **then** they see who is
  in, on a break, remote, off, late or not yet in, and it changes live as people check in.

### 2.2 Edge cases & failures

- **Given** the features off, **then** timer, timesheets and availability are unchanged and new routes answer `404`.
- **Given** an employee without `ATTENDANCE_CHECK_IN_OWN`, or a channel the organization disabled, **when** they check
  in, **then** `403` naming the reason.
- **Given** the organization requires location proof and the employee is 800 m outside a 150 m radius, **when** they
  check in, **then** it is refused or accepted and flagged, per setting; on a remote day no location is asked.
- **Given** a check-in linked to a locked day (pay period closed), **when** someone edits it, **then** it is refused;
  a correction request is offered instead and, once approved, reaches payroll as a correction.
- **Given** a device that has not reported since 06:00, **when** the day would close, **then** absences are held until
  the device reports or the maximum wait passes, then an exception names the device.
- **Given** two planners editing the same cell, **when** the second saves, **then** `409` with the current state.
- **Given** a shift template whose start time changes on 10 March, **when** days before 10 March are rebuilt, **then**
  they keep the times they were built with.
- **Given** a pickup that would leave less than the minimum rest between two shifts and the rule blocks, **when** the
  employee tries, **then** the shift is not offered to them; a planner may override with a recorded reason.
- **Given** an employee of kind agent, **when** anyone checks it in, rosters it or marks it, **then** refused.
- **Given** a time log edited after the day was final but not locked, **when** the sweep sees it, **then** the day is
  rebuilt and its change history names the time-log edit.
- **Given** the same offline check-in uploaded twice, **then** it is stored once.

## 3. Functional Requirements

### 3.1 Enabling and settings

| ID | Requirement |
| --- | --- |
| **FR-1** | With `FEATURE_ATTENDANCE` off no attendance route, job, menu, consumer or event exists, and with `FEATURE_SHIFTS` off none of shifts; attendance without shifts uses the organization's expected day (FR-2), shifts without attendance shows no actuals. |
| **FR-2** | A user with `ATTENDANCE_SETTINGS_EDIT` can set per organization, and override per branch: the sources that build attendance (check-ins, tracked time, approved requests, calendar), how manual time counts (counted, counted and flagged, not counted), the day boundary hour, the expected day without a shift (start, end, unpaid break), full-day and half-day thresholds (by default the organization's standard hours per day and half of it, following them while not set), the delay before an absence, the allowed check-in channels (web, phone, kiosk, device, timer), location proof (off, flag outside, refuse outside), the location retention, the maximum wait for silent devices, whether several shifts a day are allowed, the exception kinds raised and auto-accepted, and reminder offsets. |
| **FR-3** | The system MUST, when attendance is first enabled for an organization, create one work location per branch of `hr-core-lifecycle` (else one for the organization, without coordinates) and a default overtime type; when shifts are first enabled, a default shift template from the organization's standard hours per day. |

### 3.2 Check-ins

| ID | Requirement |
| --- | --- |
| **FR-4** | An employee with `ATTENDANCE_CHECK_IN_OWN` can check in and out from the web app, the phone app and the desktop timer; each check-in keeps server time (client time when different), direction, channel, device, location evidence per FR-49 and FR-50; the answer shows the current state (in, on break, out) and the time worked today. |
| **FR-5** | The system MUST refuse a check-in for an agent employee, for a date on which the employee is not active (the active check of `hr-core-lifecycle`, else start and end of work), or from a channel disabled for the organization or the employee's group; an identical check-in (employee, second, direction) returns the existing one. |
| **FR-6** | The system MUST accept direction in, out, break start, break end or unspecified; unspecified alternates from the employee's last state; a shift template that requires a direction refuses unspecified check-ins from that employee, except from the timer. |
| **FR-7** | The system MUST link each check-in to the shift assignment it falls in (FR-60) or mark it off-shift; off-shift time counts when the organization allows and raises an exception otherwise. |
| **FR-8** | The system MUST refuse to edit or delete a check-in linked to a final or locked day; a holder of `ATTENDANCE_EDIT` can exclude a check-in from automatic attendance with a reason; every refusal, exclusion and processing failure is written on the check-in and shown in the log. |
| **FR-9** | A registered device can post one check-in or a batch of up to 500 with its device credential, each naming the employee by the external identifier of system "attendance device" (`hr-core-lifecycle`), the employee number, a badge code (kept with the employee's external identifiers) or the employee id, plus time, direction, optional coordinates, a skip flag and a client event id; the answer gives per item accepted, duplicate or refused with the reason. |
| **FR-10** | A user with `ATTENDANCE_DEVICES_MANAGE` can register devices (name, kind kiosk, terminal or integration, location), see last contact, the time up to which the device has reported everything and its clock offset, and rotate or revoke its credential; a credential is shown once and stored hashed; a revoked device is refused. |
| **FR-11** | A user with `ATTENDANCE_EDIT` can import check-ins from a file through the mapped import with a result per row. |
| **FR-12** | A user with `ATTENDANCE_VIEW` can list check-ins by employee, date, location, device, channel, off-shift, excluded and linked day; an employee lists their own. |

### 3.3 Tracked time and calendar as sources

| ID | Requirement |
| --- | --- |
| **FR-13** | The system MUST treat the platform's timer as a check-in source: a timer start is an in, a stop an out, a break log a break (the timer's existing break rules decide which logs are breaks, and a template's unpaid break is deducted only where no recorded break covers it), each with its time log as evidence, with nothing else for the employee to do. *(advanced)* |
| **FR-14** | The system MUST follow every change of time logs (manual add, edit, delete, offline upload, import) within 5 minutes and rebuild affected days that are not locked; on a locked day it raises a correction proposal instead. *(advanced)* |
| **FR-15** | The system MUST count manual time per FR-2 and never count idle time the employee discarded. |
| **FR-16** | The system MUST take each employee's day kind (working, rest day, holiday, half holiday) from the holiday calendar of `time-off-management` when on, else from the organization's official holidays with Saturday and Sunday off. |
| **FR-17** | The system MUST apply approved time off (whole days, halves, hours) to attendance days with the request linked, and on withdrawal or shortening restore the portion from the other sources. |
| **FR-18** | The system MUST count appointments and calendar events marked as work away from the office, in working hours, as off-site work for the hours they cover when no check-in exists. *(advanced)* |

### 3.4 Attendance days

| ID | Requirement |
| --- | --- |
| **FR-19** | The system MUST keep one attendance day per employee, date and shift assignment (one per date without a shift) with: status of each half (present, absent, time off, holiday, rest day, pending), work mode (on site, remote, off site), first in, last out, worked, break and expected time, minutes late and early, overtime and night minutes, holiday work, shift, location, sources used, linked check-ins and linked requests. |
| **FR-20** | The system MUST refuse a mark before joining, after end of work, for an inactive or agent employee, a second day for the same employee, date and shift, and two days whose shift times overlap. |
| **FR-21** | The system MUST refuse marking time off without approved time off for that portion, and keep a portion covered by approved time off as time off whatever else is marked. |
| **FR-22** | A user with `ATTENDANCE_EDIT` can mark several unmarked or pending days of one employee in one action. |
| **FR-23** | A user with `ATTENDANCE_EDIT` can open bulk marking for a date and a set of employees (a saved employee filter, a team, a department, a group or a shift template): it lists who still has a pending day or half, marks the selected people at once (status, work mode, which half, lateness) and answers per employee marked or refused with the reason, next to those already marked. |
| **FR-24** | The system MUST keep a manual mark as an override that automatic runs never overwrite, and record who, when, before, after and why for every change of a day. |
| **FR-25** | A user with `ATTENDANCE_EDIT` can void a day with a reason; its check-ins are unlinked and processed again. |
| **FR-26** | The system MUST show a month calendar of attendance days per employee (status colours, holidays, time off, shifts) to the employee, their managers and holders of `ATTENDANCE_VIEW`. |
| **FR-27** | The system MUST mark a closed day from worked time against thresholds (template, else organization): at or above the full-day threshold present, at or above the half-day threshold one half present and one absent, below it absent; zero disables a threshold; on a half holiday both thresholds halve. |
| **FR-28** | The system MUST recompute the other half of a day when time off or a request changes one half. |

### 3.5 Automatic attendance and exceptions

| ID | Requirement |
| --- | --- |
| **FR-29** | The system MUST build days from the enabled sources, pairing check-ins alternately or by direction and summing first-in to last-out or each valid pair, per template; an unpaired part counts zero and raises an exception, never a guess. |
| **FR-30** | The system MUST count worked time as the union of check-in intervals and counted tracked time, overlaps once; on-site days need a check-in at the location when the organization requires location proof, otherwise tracked time suffices. |
| **FR-31** | The system MUST keep a day pending until it closes — the shift end plus its check-out window (or the day boundary) has passed and every source expected for the employee has reported past it — or until the maximum wait for a silent device passes, which raises an exception naming the device. |
| **FR-32** | The system MUST process days every 15 minutes per organization (one run at a time), on arrival of late check-ins, and on demand by a holder of `ATTENDANCE_EDIT` for employees and dates; runs above 10,000 check-ins are queued with progress; each run records counts and failures. |
| **FR-33** | The system MUST mark late arrival when the first in is after shift start plus late grace, and early departure when the last out is before shift end minus early grace, with the minutes. |
| **FR-34** | The system MUST mark a closed working day without any signal and without time off absent after the organization's delay (0 = at close), never before joining, after end of work or on a holiday or rest day, and say why on the day. |
| **FR-35** | The system MUST mark work on a holiday or rest day as present with holiday work, unless the template turns holiday processing off, in which case the day is skipped and flagged for review. |
| **FR-36** | The system MUST raise an exception, never guess, for: missing check-in or check-out, unpaired sequence, tracked time without check-in on an on-site day, check-in outside the location, off-shift check-in, sources disagreeing by more than 30 minutes, late arrival, early departure, overtime without approval, work on a rest day or holiday, a silent device; each names its facts and proposes a fix. *(advanced)* |
| **FR-37** | The system MUST send an exception to the employee first (inbox and push) and, unresolved after the organization's delay (default one working day), to their attendance approver; holders of `ATTENDANCE_EDIT` see every open exception in a queue by kind, team, location and age. *(advanced)* |
| **FR-38** | The system MUST offer one-step resolutions — accept the proposal, add the missing time, mark remote or off-site, request time off, accept as is, dismiss with a reason — and close an exception on its own when its facts no longer hold. *(advanced)* |
| **FR-39** | The system MUST auto-accept the exception kinds the organization chooses, for example a missing check-out when the timer stopped within 15 minutes of the shift end, recording the rule on the day. *(advanced)* |

### 3.6 Requests and corrections

| ID | Requirement |
| --- | --- |
| **FR-40** | An employee can request remote work or off-site work for a date range with a reason, an optional half day (date and half), an optional shift and an "include holidays" switch; requests overlapping their own are refused. |
| **FR-41** | The system MUST, on approval, set the requested portions to present with work mode remote or off site, skip holidays unless included and portions under time off, update existing days with a trail entry, and create the chosen shift assignment when shifts are on and none covers the dates. |
| **FR-42** | The system MUST, when an approved request is cancelled, rebuild its days from the other sources. |
| **FR-43** | An employee can request a correction of a past day (missing or wrong times, wrong status) with a reason and an attachment; approval writes correction check-ins and rebuilds the day; for a locked day the approved correction is published to `payroll-processing` as a correction and both versions stay visible. |
| **FR-44** | The system MUST route requests, corrections and overtime requests to `approval-workflows` when on (default definitions: one step to the resolved approver); otherwise as request approvals on the existing Approvals page to the approver resolved by `hr-core-lifecycle` for kind attendance and shifts, else to holders of `ATTENDANCE_REQUESTS_APPROVE`; nobody decides their own; the inbox item decides in one tap. |
| **FR-45** | A manager can file requests and corrections for their reports; the approver still decides. |

### 3.7 Locations, privacy, kiosks and offline

| ID | Requirement |
| --- | --- |
| **FR-46** | A user with `ATTENDANCE_SETTINGS_EDIT` can maintain work locations: name, branch, address, coordinates chosen on a map or captured from the current device, radius in metres, optional office networks, time zone and active flag. |
| **FR-47** | The system MUST take an employee's location for a day from the shift assignment, else their default location, else their branch's location. |
| **FR-48** | The system MUST, when location proof is on, require from web and phone check-ins coordinates within the location's radius or an office network; radius 0 or no location means no check; outside is refused or flagged per FR-2; remote days ask nothing. |
| **FR-49** | The system MUST capture location only at the moment of a check-in, never in the background or from the desktop timer, store by default only the distance and inside or outside, keep raw coordinates only when the organization opts in and purge them after the retention (default 30 days, at most 180), show employees what was stored about them, and log every read of raw coordinates in the platform's access audit, allowed only with `ATTENDANCE_LOCATION_VIEW`; where no access audit is available, raw coordinates are neither kept nor read. *(advanced)* |
| **FR-50** | An organization can turn location capture off; rules that need it are then shown as inactive. |
| **FR-51** | A kiosk device opens a full-screen check-in page where employees identify by badge code, a code shown in their phone app that changes every 30 seconds, or employee number and personal PIN; it shows name, direction and time only; three wrong PINs lock that PIN at the kiosk for 5 minutes. *(advanced)* |
| **FR-52** | Kiosks and the phone app MUST queue check-ins while offline with device time, sequence and client event id; the server accepts them with their original time up to 7 days old (setting), corrects a device clock offset above 2 minutes and flags it, ignores duplicates, and rebuilds the days. *(advanced)* |
| **FR-53** | The system MUST reopen a final day when a late check-in arrives for it, unless locked, where a correction proposal is raised. |
| **FR-54** | The system MUST show a live presence board per location and team — in, on break, out, late, absent, off, remote, expected later — updated within 5 seconds, to the employees' managers and holders of `ATTENDANCE_VIEW`, with the existing timer states (tracking, away, last seen) beside the check-in states; colleagues see only in, out and off when the organization allows. *(advanced)* |
| **FR-55** | The system MUST remind an employee once per shift when the shift started plus grace with no check-in and no timer, and when the shift ended plus its window while still in, honouring notification preferences. |

### 3.8 Shift templates and assignments

| ID | Requirement |
| --- | --- |
| **FR-56** | A user with `SHIFTS_TEMPLATES_EDIT` can maintain shift templates: name, code, colour, start, end (may end the next day), unpaid break, early check-in and late check-out windows, late and early grace, direction required, pairing and summing methods, thresholds, overtime allowed and overtime type, night period, holiday processing, required skills, default location and an optional holiday calendar. |
| **FR-57** | The system MUST refuse a template whose start equals its end, whose length plus windows reaches 24 hours or whose break exceeds its length; time changes take effect from a date not before the first day still pending for an employee using it, and built days keep the version they used. |
| **FR-58** | A user with `SHIFTS_TEMPLATES_EDIT` can set a default template per organization and per employee, used when no assignment covers a date. |
| **FR-59** | A user with `SHIFTS_ROSTER_EDIT` can assign a template to an employee for a date range (open end allowed) with status active or inactive, location and overtime type. |
| **FR-60** | The system MUST resolve, for an employee and an instant, the assignment and its actual start and end with windows, looking at the previous and next day for shifts crossing midnight and choosing the nearest start between back-to-back shifts; and, for a date range, the shifts of each day. |
| **FR-61** | The system MUST refuse active assignments whose times overlap and, unless the organization allows several shifts a day, two on one date; an assignment with linked check-ins or days cannot be deleted, only ended after its last linked date; assignments past their end become inactive nightly. |
| **FR-62** | A user with `SHIFTS_TEMPLATES_EDIT` can define repeating patterns over 1 to 8 weeks (each day a template or rest) and a user with `SHIFTS_ROSTER_EDIT` can give an employee a pattern from a date, with a starting week and optional end; the system generates assignments daily for the horizon (default 8 weeks), never twice, never over a manual assignment. |
| **FR-63** | A user with `SHIFTS_ROSTER_EDIT` can assign a template or a pattern for a date range to a set of employees (a saved employee filter, a team, a department, a group or the reports of an approver), or decide pending shift requests in bulk, after a preview, with a result per employee. |
| **FR-64** | An employee can request another template for a date range (not their default; not overlapping their own requests); approval routes as FR-44 and creates the assignment; cancelling an approved request removes the assignments it created that no day links to. |

### 3.9 Roster and working-time rules

| ID | Requirement |
| --- | --- |
| **FR-65** | A user with `SHIFTS_VIEW` can open the roster: employees in rows, days in columns for a week, two weeks or a month; cells show assignments with colour and times, approved and pending time off, holidays, availability and open shifts; header rows show coverage against targets per location and skill and labour cost per day; search and filters (organization, branch, department, team, position, level, group, location, template) cover only records the user may list. |
| **FR-66** | A user with `SHIFTS_ROSTER_EDIT` can drag a shift to another day or employee, swap two shifts, copy one, drop a template or an open shift into a cell; moving one day of a longer assignment splits it at that date; source equal to target is refused; both employees must be in the user's scope; rule checks run and violations show before the drop is confirmed. |
| **FR-67** | The system MUST offer every drag action through the keyboard and a cell dialog (create, edit, delete an assignment or start a pattern from the cell). |
| **FR-68** | The system MUST keep roster changes to future dates as drafts until a holder of `SHIFTS_ROSTER_PUBLISH` publishes them; publishing notifies each affected employee of their own changes; later edits of published shifts notify again; the last 20 draft actions can be undone. |
| **FR-69** | The system MUST show other planners' changes live and answer `409` with the current state when a cell changed since it was loaded. |
| **FR-70** | A user with `SHIFTS_ROSTER_EDIT` can copy a week or period to following periods after a preview of conflicts. |
| **FR-71** | The system MUST show employees their published shifts and the open shifts they may take in the Gauzy app and in Ever Teams, and add their shifts to their private, revocable personal calendar feed of `calendar-and-scheduling`. |
| **FR-72** | The system MUST show availability slots and weekly availability of employees as availability in the roster, and let planners edit them there. |
| **FR-73** | A user with `SHIFTS_TEMPLATES_EDIT` can define working-time rules per organization, branch or group — maximum hours per day and per week (optionally averaged over weeks), minimum rest between shifts, maximum consecutive working days, maximum night shifts per week, minimum weekly rest, contracted weekly hours from the employee's weekly limit — each warning or blocking. |
| **FR-74** | The system MUST check the rules on every assignment, pattern generation, pickup, swap and publish, list each violation with its numbers, and refuse a blocking one unless a holder of `SHIFTS_ROSTER_PUBLISH` overrides it with a recorded reason. |

### 3.10 Shift marketplace, demand and proposals

| ID | Requirement |
| --- | --- |
| **FR-75** | A user with `SHIFTS_ROSTER_EDIT` can publish an open shift (template, date, location, required skills, headcount, optional eligible group, closing time); eligible employees are notified and can volunteer or pick it up. *(advanced)* |
| **FR-76** | An employee with `SHIFTS_MARKETPLACE_USE` can offer a published shift to the pool or to named colleagues, or propose to swap it for a colleague's; the colleague accepts or declines. *(advanced)* |
| **FR-77** | The system MUST offer a shift only to colleagues who hold its skills, are not on approved or pending time off, are available, have no overlapping shift and break no blocking rule. *(advanced)* |
| **FR-78** | The system MUST approve a pickup, offer or swap on its own when every check passes and it adds no overtime and no cost above the organization's or location's limit, otherwise send it to the manager; open shifts are filled first come or by the manager among volunteers; each decision updates the roster live, notifies both sides and is kept in the shift's history. *(advanced)* |
| **FR-79** | A user with `SHIFTS_DEMAND_EDIT` can enter coverage targets per location, skill and half-hour slot for weekdays or dates; they are also the minimum staffing that `time-off-management` checks requests of rostered employees against, and they are edited only here. |
| **FR-80** | The system MUST forecast labour demand per location, skill and slot for the coming weeks from targets, from signals other features register (deliveries due, open tickets by queue, planned work-order operations, booked appointments) and from tracked-time history, showing confidence and each source's share; a planner can accept the forecast into the targets. *(advanced)* |
| **FR-81** | The system MUST propose, for a period and locations, assignments that cover the targets while respecting availability, approved time off (pending as a soft constraint), skills, working-time rules, contracted hours, preferences, labour cost and fairness of nights, weekends and holidays over the last 8 weeks. *(advanced)* |
| **FR-82** | The system MUST explain each proposed assignment (demand filled, why this person, rules checked, next alternatives) and the proposal as a whole (coverage, cost, overtime, fairness spread, gaps); nothing is written until a planner accepts all, per employee, per day or per row, and accepted rows become drafts. *(advanced)* |
| **FR-83** | The system MUST show labour cost per assignment, day and period from the cost rate of `payroll-setup` when on, else the pay rate over standard hours, with overtime and night multipliers, only to users who may see pay. |

### 3.11 Overtime, compensatory time off and payroll

| ID | Requirement |
| --- | --- |
| **FR-84** | A user with `ATTENDANCE_SETTINGS_EDIT` can maintain overtime types: name, multipliers for working days, rest days, holidays and night, daily and weekly maximum, rate basis (a pay element of `payroll-setup`, the employee's hourly rate, or a fixed hourly amount with currency), pre-approval required, time off instead of pay allowed. |
| **FR-85** | The system MUST record on each day expected time (shift less unpaid break), worked time and, when the template allows overtime, overtime above the day or above the weekly maximum, never counted twice; the type comes from the assignment, else the template, else the organization default. |
| **FR-86** | An employee or manager can request overtime before it is worked (date, hours, reason, project or task); actual overtime up to approved hours is approved on its own; overtime beyond, or without a request when the type requires one, is an exception for the approver. *(advanced)* |
| **FR-87** | A user with `ATTENDANCE_OVERTIME_APPROVE` can build an overtime statement per employee and pay period from approved overtime: lines by date, type, day kind, multiplier and project; one statement per employee and period, one line per date, type, day kind, multiplier and project (two shifts of one date with different types or projects, and day and night overtime of one type at different multipliers, give separate lines, the same overtime never twice), hours above the daily maximum of a type capped across that date's lines with the excess reported. |
| **FR-88** | The system MUST show on each statement an estimated amount (hours × hourly rate of the type's basis × multiplier), the exact amount being computed by payroll. |
| **FR-89** | A user with `ATTENDANCE_OVERTIME_APPROVE` can build statements for a pay group and period, or selected employees, with a result per employee (drafted, nothing to state, failed with reason). |
| **FR-90** | The system MUST hand approved statements to `payroll-processing`, each line once, show the payslip that paid each line, allow cancelling before payment, and after payment accept only a correction statement for the next period. |
| **FR-91** | An employee can choose time off instead of pay for a line whose type allows it, before approval; that line goes to `time-off-management` as compensatory hours for its work day and is not paid; these lines credit compensatory time beside the organization's existing compensatory time-off policies and grants, which keep working as today, and a work day is never credited twice. |
| **FR-92** | The system MUST answer `time-off-management`, for an employee and dates, the presence and hours worked on rest days and holidays, so compensatory claims are prefilled and checked against attendance. |
| **FR-93** | The system MUST give `payroll-processing`, per employee and pay period: present, absent and half days, unmarked working days, remote and off-site days, worked hours, approved overtime per type and day kind, night and holiday hours and hours per shift template, each with a key so it is paid once. |
| **FR-94** | The system MUST lock the days of a period when payroll closes it (unlock when reopened) and let a holder of `ATTENDANCE_EDIT` lock a period earlier; changes to locked days go through FR-43. |

### 3.12 Reports

All reports are report definitions: filterable, groupable, exportable, schedulable and clonable.

| Requirement | Report | Answers | Filters and grouping |
| --- | --- | --- | --- |
| **FR-95** | Monthly attendance grid | Each employee's days as status and work-mode symbols with the shift, and per employee the days per status, lateness count and minutes, worked against expected hours | period, organization tree, team, department, employee; grouped by any organization axis; compact view |
| **FR-96** | Punctuality by shift | Per template and employee: late arrivals and early departures with times and minutes, and how many were within grace | period, team, template, location; only late or only early |
| **FR-97** | Work on holidays and rest days | Who worked on which holiday or rest day, how long, and whether time off or pay was chosen for it | period, calendar, team |
| **FR-98** | Attendance by status (chart) | Days per status | as FR-95 |
| **FR-99** | Assignments by template (chart) | Assignments per shift template | dates, location, department |
| **FR-100** | This month (cards) | Early departures, late arrivals, absences, present days | organization, department |
| **FR-101** | Overtime | Hours and estimated cost by employee, project, type and day kind; pre-approved against actual *(advanced)* | dates, team, project, type |
| **FR-102** | Coverage and labour cost | Targets, forecast, rostered and actual hours and cost per location, skill and day *(advanced)* | dates, location, skill |
| **FR-103** | Presence and tracked time | Time at work against time tracked per employee and project *(advanced)* | dates, team, project |
| **FR-104** | Exceptions | Raised, auto-accepted, resolved and time to resolve by kind | dates, team, location, kind |

### 3.13 API, agents and compatibility

| ID | Requirement |
| --- | --- |
| **FR-105** | The system MUST expose every action through the REST API and register attendance days, check-ins, requests, corrections, overtime statements, shift assignments, shift requests and open shifts as record types for saved views, custom fields, approval definitions and automation triggers. |
| **FR-106** | The system MUST publish events (check-in recorded, day marked, changed and locked, exception raised and resolved, request and correction decided, statement approved and cancelled, assignment published, changed and removed, open shift filled, trade decided) on the event outbox for payroll, time off, automations, webhooks and real-time updates. |
| **FR-107** | The system MUST provide MCP tools for own status and check-in, team presence, days and exceptions with resolution, requests with a preview, roster reading, roster proposals with a preview, open shifts and trades, and overtime statements with a preview, acting with the caller's permissions and marking agent actions. |
| **FR-108** | The system MUST import shift templates, assignments, check-ins and historic attendance days through the mapped import with errors per row. |
| **FR-109** | The system MUST grant `ATTENDANCE_CHECK_IN_OWN` and `SHIFTS_MARKETPLACE_USE` to the employee role, team views to managers and the other keys to administrators, effective only while the features are on. |
| **FR-110** | The system MUST record who, when, before and after for every setting, location, device, template, rule, assignment, override and statement change. |
| **FR-111** | The timer, time logs, timesheets, availability slots, employee availability, appointments, the existing reports and MCP tools MUST behave as today with the features on or off; nothing in the timer depends on attendance. |
| **FR-112** | The system MUST keep both features off for every tenant that has not switched them on, including after any later change of the default for new tenants, so no existing employee is marked, reminded or sent an exception unasked; the existing compensatory time-off policies stay a source of compensatory credit with attendance on. |

## 4. Non-Functional Requirements

- **Performance**: a check-in answers under 200 ms at the 95th percentile; a 500-item device batch under 2 s; the
  15-minute run for 10,000 employees under 5 minutes; the roster for 300 employees and a month renders under 1.5 s and
  a drop persists under 300 ms; the presence board updates within 5 s; a proposal for 200 employees and 4 weeks
  within 60 s; reports read maintained day rows, never raw check-ins.
- **Data volume and concurrency**: 200 million check-ins and 20 million days per tenant; one processing run per
  organization at a time; one writer per employee day (row lock); optimistic versions on assignments and statements.
- **Reliability**: offline queues and device batches are idempotent by client event id; every job keyed so a repeat
  changes nothing; a silent source never produces absences on its own.
- **Security & privacy**: tenant and organization scoped; location data minimized, purged and read-logged (FR-49);
  device credentials hashed; PINs hashed and rate-limited; pay-based cost visible only with pay permission; leaves the
  platform: reminder and roster notices (email, push), calendar feeds (names, dates, times), exports.
- **Observability and audit**: run records, exception metrics (raised, auto-accepted, time to resolve), device
  last-contact alerts, audit entries of FR-110.
- **Accessibility and localization**: roster and kiosk keyboard operable and screen-reader labelled; colours never the
  only signal; every string in every locale; times in the location's time zone and the user's format.
- **Compatibility**: PostgreSQL, MySQL and SQLite; both ORMs; cloud and self-hosted; offline-capable clients; additive
  OpenAPI and SDK changes.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| Attendance settings | Sources, thresholds, channels, location and exception rules of an organization or branch, in the platform settings |
| `WorkLocation` | A place where people check in, with radius and office networks; its address in the address book |
| `AttendanceDevice` | A kiosk, terminal or integration allowed to post check-ins |
| `CheckIn` | One clock-in, clock-out or break event with its channel and evidence |
| `AttendanceDay` | An employee's attendance for one date and shift, per half |
| `AttendanceException` | A fact that needs a person, with a proposed fix |
| `AttendanceRequest` | Remote work, off-site work or a correction asked by an employee |
| `OvertimeType`, `OvertimeRequest` | How overtime is valued; overtime approved before it is worked |
| `OvertimeStatement` | An employee's approved overtime of one pay period, handed to payroll |
| `ShiftTemplate` (versioned) | A named working pattern for one day with its rules |
| `ShiftPattern` | A repeating sequence of templates over weeks |
| `ShiftAssignment` | Who works which template, where, from when to when |
| `ShiftRequest`, `OpenShift`, `ShiftTrade` | A request for another shift; a shift to fill; an offer, swap or pickup |
| `WorkingTimeRule` | A limit on hours, rest or consecutive days |
| `CoverageTarget`, `DemandForecast` | People needed per location, skill and slot; their forecast |
| `RosterProposal` | A proposed roster with explanations, waiting for acceptance |

## 6. Out of Scope

- Time-off requests, balances, holiday calendars and compensatory claims and grants: `time-off-management` (this
  feature reads them and answers FR-92).
- Pay calculation of overtime, absences and shift differentials: `payroll-processing`; pay elements and cost rates:
  `payroll-setup`.
- Branches, external identifiers, approvers and the active-employee check: `hr-core-lifecycle`; approval engine:
  `approval-workflows`; notification channels: `automation-and-notifications`.
- Ever Teams screens and their offline queue: the Ever Teams spec `people-self-service`; calendar events and feeds:
  `calendar-and-scheduling`; time capture (timer, time logs): existing and kept; project labour costing:
  `project-costing-and-billing`.

## 7. Acceptance Criteria

- [ ] **AC-1** A remote day built from tracked time alone and an office day built from phone check-ins inside the
      radius give the expected statuses, worked time and lateness, with no manual action (FR-18, FR-48).
- [ ] **AC-2** A device batch of 500 with duplicates and unknown badges answers per item; replaying it changes nothing (FR-9).
- [ ] **AC-3** A kiosk works offline for three hours and its check-ins land with original times; a skewed clock is
      corrected and flagged (kiosk and offline) (FR-52, FR-53).
- [ ] **AC-4** Missing check-out, outside-location and silent-device exceptions reach the employee, escalate to the
      approver, resolve in one step and auto-close when facts change (exceptions queue) (FR-31, FR-36, FR-39).
- [ ] **AC-5** Approved half-day time off, a remote-work request and a correction on a locked day produce the right
      halves, work modes and a payroll correction; withdrawing time off restores the half (FR-28, FR-40, FR-42, FR-43).
- [ ] **AC-6** Location data: only distance and inside or outside are stored by default; opted-in coordinates purge
      after retention; every raw read is logged (privacy) (FR-49).
- [ ] **AC-7** Templates crossing midnight, back-to-back shifts and a pattern rotating over 4 weeks resolve check-ins
      to the right shift; a time change keeps earlier days on the old version (FR-60, FR-62).
- [ ] **AC-8** Roster drag, swap, copy and split are checked against rules, saved as drafts, published with notices,
      and a concurrent edit answers `409`; the same actions work by keyboard (FR-66, FR-68, FR-70, FR-74).
- [ ] **AC-9** An open shift is picked up and approved on its own; a swap creating overtime goes to the manager
      (marketplace) (FR-64, FR-77, FR-78).
- [ ] **AC-10** A proposal for a seeded store covers its forecast targets with no blocking violation and explains each
      row; nothing is written before acceptance (proposal and forecast) (FR-74, FR-80).
- [ ] **AC-11** Pre-approved overtime is approved on its own; statements built for a pay group reach payroll and each
      line is paid once; a line taken as time off reaches time off and is not paid (FR-84, FR-87, FR-89).
- [ ] **AC-12** Reports FR-95 to FR-104 match the day rows of a seeded month; the presence board updates within 5 s.
- [ ] **AC-13** Agent employees are refused; denial answers `403`; with the features off every route answers `404` (FR-1, FR-23).
- [ ] Works on PostgreSQL, MySQL and SQLite with both ORMs.
- [ ] Behind `FEATURE_ATTENDANCE` and `FEATURE_SHIFTS`; with both off, existing time-tracking suites pass unchanged.
- [ ] **AC-14** A tenant that never switched the features on gets no attendance day, reminder or exception; with
      attendance on, a compensatory policy's existing accrual still credits time beside overtime lines taken as time
      off (FR-91, FR-112).
- [ ] **AC-15** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-1).
- [ ] All functional requirements have a passing test.

## 8. Open Questions

- Tracked time counts as presence on every day kind, manual time counted and flagged (applied); a "tracked time only
  on remote days" setting can follow.
- Unmarked working days are left pending, never assumed present, until the absence delay (applied); payroll decides
  how it pays them (its pay-group setting).
- Raw coordinates are not stored unless the organization opts in (applied); photo capture at kiosks is not offered.
- Kiosk identification by rotating phone code, badge or number and PIN (applied); biometric readers report through
  the device API only.
- Proposals come from a deterministic optimizer that explains the constraints it checked (applied); an assistant may
  rephrase them. Exceptions escalate after one working day (applied).

## 9. Constitution Gates

- [x] I Plugin-first — new plugins `attendance` and `shifts` with UI plugins; core untouched apart from reading the
      timer's existing events.
- [x] II Tenant/organization scoping — every record scoped; locations and settings per organization or branch.
- [x] III Both ORMs, additive migrations — new tables only, three dialects.
- [x] IV Default-off flag; nothing removed — two tenant features; timer, availability and reports unchanged.
- [x] V Contracts and API first; backwards compatible — new routes and contracts only.
- [x] VI Permissions, privacy, security — new keys; location minimized; device and PIN secrets hashed.
- [x] VII Real-time through the event bus — outbox events; presence and roster updates through the push channel.
- [x] VIII i18n and accessibility — keys in every locale; keyboard roster and kiosk.
- [x] IX Tests accompany the change — pairing, resolution, rules, idempotency, ORM parity.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Related features: [`time-off-management`](../time-off-management/spec.md),
  [`payroll-processing`](../payroll-processing/spec.md), [`payroll-setup`](../payroll-setup/spec.md),
  [`hr-core-lifecycle`](../hr-core-lifecycle/spec.md), [`approval-workflows`](../approval-workflows/spec.md),
  [`automation-and-notifications`](../automation-and-notifications/spec.md), [`task-automations`](../task-automations/spec.md)
- Existing code (`packages/core/src/lib/`): `time-tracking/timer` (events `TimerStartedEvent`, `TimerStoppedEvent`),
  `time-tracking/time-log` (`break-rules.ts`, `time-log-history.writer.ts`), `availability-slots`,
  `employee-availability`, `employee-appointment`, `official-holiday`, `organization` (`standardWorkHoursPerDay`),
  `employee` (`reWeeklyLimit`)
- Related architecture: [platform architecture](../../architecture/business-suite.md) §2.5 (attendance and shifts), §3.6, §3.9, §3.11, §3.12
