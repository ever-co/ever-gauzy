# Feature Specification: HR core and employee lifecycle

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `hr-core-lifecycle`
**Branch**: `feat/hr-core-lifecycle`
**Status**: `Draft`
**Created**: 2026-11-16
**Last updated**: 2026-11-23
**Owner**: evereq
**Feature flag**: `FEATURE_HR_LIFECYCLE` (default off)

---

## 1. Overview

The employee record becomes a full HR record and the organisation gets a shape. Every employee keeps what they have
today (account, rates, departments, position, level, skills, documents, "End work") and gains an employee number, an
employment status, a reporting line, a primary department, a branch, HR dates, personal data held as sensitive
groups, pay accounts, emergency contacts and external identifiers. Departments become a tree with heads, positions
carry planned headcount and required skills, levels get a rank, branches are new. The feature runs the life of a
person: onboarding from a hired candidate, dated HR events (transfer, promotion, level or manager change, suspension,
confirmation), separation with exit interview and final settlement, grievances, typed documents with expiry and
signature, reminders, an organisation chart and HR reports — in the Gauzy web app (installable on phones for
self-service, resignation, document photos and signing), the REST API and SDKs, and MCP tools.

**Advanced capabilities.** Onboarding and separation are automation flows, not checklists: activities create the
account, add the person to teams and projects, hand over equipment, enrol training and, at the end, revoke access
and reassign work, each with a recorded result. A newcomer assistant answers questions from the organization's own
documents and routes what it cannot answer to HR. The organisation chart shows spans, vacancies and AI agents, has no
size ceiling and lets HR rehearse a reorganisation as a scenario before applying it as dated transfers. Probation
reviews bring tracked time and onboarding progress to the manager. Documents are signed in the app with recorded
evidence and remind before they expire. Sensitive fields are protected by design: permission per field group, masked
by default, encrypted where they identify a person or an account, and every read by someone else is logged. HR
analytics (headcount, attrition, absence, tenure, spans, digital workforce) are report definitions.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** a candidate marked hired, **when** an HR user starts onboarding, **then** the best-matching template is
  proposed (position "Developer", branch "Berlin"), tasks appear in the organization's onboarding project with due
  dates that skip the branch's rest days and holidays, owners are notified, and the process shows 0 % progress.
- **Given** an onboarding whose activities "Contract signed" and "ID document verified" are required before the
  person becomes an employee, **when** both are done, **then** "Create employee" is enabled and creates the employee
  with the candidate's name, email, rates, position and start date, marks the candidate hired and links the process.
- **Given** the automated activity "Create account and add to team Web", **when** its due date arrives, **then** the
  invite is sent, the person is added to the team once the account exists, and the activity records "done by
  automation" with what was changed.
- **Given** a newcomer in their first week, **when** they ask the assistant "how do I book holidays?", **then** it
  answers from the organization's onboarding documents with links to the sources; **when** it cannot answer, **then**
  the question reaches the process's HR owner as an inbox item.
- **Given** an HR user, **when** they record a transfer of an employee to department "Sales" and manager "Ana" dated
  next Monday, **then** the event is scheduled, nothing changes until Monday, and on Monday the employee's record and
  history show the old and new values.
- **Given** an employee, **when** they resign from their profile, **then** a separation starts with their requested
  last day, the status becomes "on notice", manager and HR are notified, and the template's activities (return
  laptop, handover, exit interview, revoke access) are scheduled before the last day.
- **Given** a separation with an end-of-work date, **when** HR opens the final settlement, **then** it lists unpaid
  pay, encashable time off, unreimbursed claims, open advances and the laptop in custody; **when** all is settled and
  the laptop returned, **then** confirming hands the net amount to payroll and the statement prints.
- **Given** a manager, **when** they open the organisation chart and choose "My team", **then** they see their direct
  and indirect reports with spans, vacancies of their positions and who is off today.
- **Given** an agent with HR read rights, **when** it calls `hr_employee_get`, **then** groups it may not read come back
  masked and each group it read is in the access log; `hr_event_record` returns a preview until confirmed.
- **Given** an HR lead, **when** they create a scenario moving two teams under a new head, **then** they see spans,
  headcount per department and monthly cost before and after; **when** they apply it for the 1st of next month,
  **then** one dated transfer per moved person is created and nothing changes before that date.
- **Given** a passport expiring in 30 days, **when** reminders run, **then** the employee and HR get one notice each;
  **when** HR sends a new contract for signature, **then** the employee signs in the app and the file gets an
  evidence page (signer, time, document fingerprint) and becomes read-only.
- **Given** an employee, **when** they raise a confidential grievance, **then** only the assigned investigator and
  HR managers see it, the person it concerns never does, and the employee follows its status.

### 2.2 Edge cases & failures

- **Given** a user without `HR_RECORDS_EDIT`, **when** they change a reporting line, **then** `403`; with the feature
  off every route answers `404`, menus are hidden and employee pages behave as today; a concurrent edit gets `409`.
- **Given** Ana reports to Bo, **when** someone sets Bo to report to Ana, **then** the change is refused as a cycle.
- **Given** a manager with three active reports, **when** HR completes their separation without naming a new manager
  for each, **then** it is refused listing the three; the same dialog lets HR pick new managers in one step.
- **Given** a promotion applied on the 1st and a transfer applied on the 10th that both changed the department,
  **when** HR cancels the promotion, **then** it is refused naming the transfer; cancelling the transfer first works.
- **Given** an automated activity whose action fails (the team was deleted), **when** it runs, **then** the activity
  stays open with the reason, the process continues, and the owner is notified; a retry runs it once.
- **Given** a bulk event over 200 employees where 3 have ended work, **when** it is applied, **then** 197 change and
  the 3 are reported with the reason; nothing is half-applied for one employee.
- **Given** a settlement while expenses are not loaded, **when** HR opens it, **then** claim lines are absent and the
  statement lists the sources consulted; **given** a reader without bank permission, **when** they export employees,
  **then** account numbers are masked and the export is logged only for the groups it contained.
- **Given** an employee of kind agent, **when** HR starts onboarding or a grievance for it, **then** it is refused.

## 3. Functional Requirements

### 3.1 Employee record

| ID | Requirement |
| --- | --- |
| **FR-1** | A user with `HR_RECORDS_EDIT` can maintain on an employee: employee number, reports-to employee, primary department (one of the employee's departments), position, level, branch, employment types, joining date (the existing start of work), probation end, confirmation date, contract end, notice period in days and retirement date; a direct change of placement is recorded in the history as a correction dated today. |
| **FR-2** | The system MUST give a new employee a number by the organization's chosen mode: numbering series (default, pattern `EMP-` and five digits per organization), manual (required) or none; numbers are unique per organization, never reused, and a mode change never renumbers existing employees. |
| **FR-3** | The system MUST refuse: a birth date in the future; probation end, confirmation, contract end or retirement before the joining date; a department, position, level or branch that is inactive or of another organization; each with the field named. |
| **FR-4** | The system MUST suggest the retirement date from birth date plus the retirement age (organization setting, default 60, overridable per branch country and per level); the date stays editable. |
| **FR-5** | The system MUST keep an employment status of active, on notice, suspended or ended, changed by HR events and separations and, as today, by the existing "End work" and "Back to work" actions, and show it on lists and filters. |
| **FR-6** | The system MUST refuse a reporting line to the employee themself, one that closes a cycle, to an employee whose work ended, from a person to an agent, or to another organization unless the tenant setting allows organizations of the same tenant. |
| **FR-7** | The system MUST refuse to complete a separation while active employees report to the person unless the same action names a new manager for each; with the feature on, the existing "End work" warns and lists the reports. |
| **FR-8** | The system MUST provide an active-employee check (started, not ended, not suspended on a date); the HR-dependent features (time off, attendance, expense claims, payroll) MUST warn on new records for dates on which the employee is not active, naming the employee, and refuse them only when the organization turned on "Refuse records on inactive dates" (off by default), so time-off requests and expenses are accepted as today until then. |
| **FR-9** | The system MUST, when a separation completes, end work through the existing end-work path on the end-of-work date (at once or by the daily job) and deactivate the person's sign-in unless they keep another active membership; "Back to work" re-enables sign-in only when the actor may edit users. |
| **FR-10** | A user with `HR_RECORDS_EDIT` can create the account of an employee created through onboarding from the work or personal email with an invite; one active employee per user and organization stays enforced, with the conflicting employee named. |

### 3.2 Personal data

| ID | Requirement |
| --- | --- |
| **FR-11** | A user with `HR_PERSONAL_DATA_EDIT` can record personal details: legal name parts and preferred name, birth date, gender (organization list including "not disclosed"), marital status, nationalities, personal email and phone, current and permanent address, and which email (work or personal) HR mail uses; the legal name is what HR documents print, the account's display name stays as it is, phones join the employee's existing phone numbers and addresses the platform's address book. |
| **FR-12** | The system MUST hold several ordered emergency contacts per employee (name, relation, phones, email), the first being primary. |
| **FR-13** | The system MUST hold education entries and previous employment entries (employer, role, from, to, reason for leaving), copied once from the candidate's education and experience when a candidate is hired. |
| **FR-14** | A user with `HR_BANK_DETAILS_EDIT` can record pay accounts (payment method bank transfer, cash or cheque; holder; bank; account or international number; routing code; currency; primary), kept in the platform's one encrypted store of bank details of `banking-and-reconciliation` (masked, left out of exports unless permitted, every full read logged); a change by the employee stays pending until HR confirms, and the employee is notified of every change to their accounts. *(advanced)* |
| **FR-15** | The system MUST record blood group and health insurance (provider, policy number, validity, as an insurance document of FR-69) in the health group. |
| **FR-16** | The system MUST hold external identifiers per employee and system (attendance device, badge, payroll provider, government, other), unique per tenant and system, show beside them the identifiers connected integrations already keep, and resolve an employee from a system and value across both. |
| **FR-17** | The system MUST let employees carry interests as tags of the organization's "Interest" tag type. |
| **FR-18** | An employee can read their own HR record and edit the fields the organization marks self-editable (default: personal phone and email, addresses, emergency contacts, education, previous employment, pay accounts pending confirmation); everything else is read-only to them. |

### 3.3 Organisation structure and approvers

| ID | Requirement |
| --- | --- |
| **FR-19** | A user with `HR_SETTINGS_EDIT` can give a department a parent in the same organization (no cycle), a code unique per organization, a head employee, a cost centre (when accounting is on) and an active flag; this feature's pages offer no inactive department for new members; deleting a department works as today (its members lose it) and its sub-departments move to its parent, or become roots; departments without a parent remain roots. |
| **FR-20** | A user with `HR_SETTINGS_EDIT` can give a position a description, code, optional department, planned headcount and required skills with a minimum proficiency. |
| **FR-21** | The system MUST give levels a rank and description and store the employee's level as a reference, keeping the existing level label in sync both ways. |
| **FR-22** | A user with `HR_SETTINGS_EDIT` can maintain branches (name, code, address, time zone, country and subdivision, coordinates, active) to which employees, holiday calendars, attendance locations and assets refer. |
| **FR-23** | A user with `HR_SETTINGS_EDIT` can define employee groups with fixed members or a rule (department, branch, position, level, employment type, tenure range, kind) recomputed on every relevant change; groups are audiences for reminders, approver lists and time-off assignment and never carry tasks or time, which stay with teams. |
| **FR-24** | A user with `HR_RECORDS_EDIT` can name per employee an approver for each kind (time off, expenses, attendance and shifts, general), and per department an ordered approver list for each kind. |
| **FR-25** | The system MUST resolve the approver of an employee for a kind as: their named approver, else the first active entry of their primary department's list (then of its parents), else their reporting-line manager; never the employee themself or someone whose work ended; `approval-workflows` and `time-off-management` use this resolution. |
| **FR-26** | The system MUST answer an employee's manager chain up to a given depth, direct reports and all reports, for approvals, "my team" views and record-level rules; the existing manager scope of employee lists and time screens (teams and projects managed) adds these reports only when the organization turns on "Managers see their reporting line" (off by default), so with it off those screens show exactly the people they show today. |

### 3.4 Organisation chart

| ID | Requirement |
| --- | --- |
| **FR-27** | A user with `HR_ORG_CHART_VIEW` (or everyone, by organization setting) can browse the organisation chart: expand and collapse, top-down or left-right, search and jump, "my team", filters by department, branch and position, a directory view, badges (joined in the last 30 days, off today, birthday or work anniversary when shared) and export as image or PDF; details follow the viewer's permissions. |
| **FR-28** | The system MUST serve the chart lazily by branch of the tree with no size ceiling, opening any person among 50,000 employees within 2 s. *(advanced)* |
| **FR-29** | The system MUST show each manager's direct and total reports and flag spans outside the organization's range (default 3 to 10). *(advanced)* |
| **FR-30** | The system MUST show vacancies as placeholder nodes where a position's planned headcount exceeds its holders, linked to the recruitment opening when `recruitment` is on. *(advanced)* |
| **FR-31** | A user with `HR_REORG_PLAN` can build a scenario by moving people and departments, compare spans, headcount per department and monthly cost from pay rates against today, share it, and apply it as dated transfers on a chosen date; a scenario changes nothing until applied and is refused if a moved person ended work meanwhile. *(advanced)* |
| **FR-32** | The system MUST place employees of kind agent under the person they report to, mark them as agents and leave them out of spans and headcount unless the viewer includes them. *(advanced)* |
| **FR-33** | The system MUST update open charts, employee pages and lists in real time when an employee, reporting line or structure changes. |

### 3.5 Dated HR events

| ID | Requirement |
| --- | --- |
| **FR-34** | A user with `HR_EVENTS_EDIT` can record an HR event of kind transfer, promotion, level change, manager change, suspension, reinstatement, confirmation, contract renewal or rehire, holding one or more property changes (department, position, level, branch, manager, employment type, organization, employee number) with an effective date and a reason. |
| **FR-35** | The system MUST apply an event dated today or earlier on confirmation and an event dated later on its date by the daily job; it MUST refuse an event for an employee whose work ended, except rehire. |
| **FR-36** | The system MUST, when applying, write each property's old and new value to the employee's history and update the record; cancelling an applied event MUST restore the old values and is refused when a later applied event changed the same property, naming it. |
| **FR-37** | The system MUST let a promotion carry a revised pay rate with its own effective date, applied through the employee's existing rate path (or handed to `payroll-setup` when payroll is on); an employee's existing rate-change request is recorded as a pay-change HR event awaiting approval, applied the same way. |
| **FR-38** | The system MUST carry out a transfer to another organization of the tenant by creating or reusing the employee in the target organization with a new number, ending work in the source the day before, keeping the one user account, and linking both histories. |
| **FR-39** | The system MUST leave a transfer, promotion, suspension or pay change unapplied while its approval is pending — through an approval definition of `approval-workflows` for that event kind, or, without it, a request approval to the approver resolved by FR-25 on the existing Approvals page for the kinds the organization marks as needing approval — and apply it on approval. |
| **FR-40** | The system MUST show the employee's in-company history (hire, events, separation) newest first, with who recorded and who approved each. |
| **FR-41** | A user with `HR_EVENTS_EDIT` can apply the same event to many employees at once with a result per employee; each employee's change is all or nothing. |

### 3.6 Onboarding and separation

| ID | Requirement |
| --- | --- |
| **FR-42** | A user with `HR_LIFECYCLE_MANAGE` can maintain onboarding and separation templates: applicability (organization, department, position, level, branch, employment type, country) and ordered activities with title, description, owner (named employee, role, the person's manager, the person, the process owner), due offset in days from the start or before the last day, duration, weight, "required before employee creation" (onboarding) and kind (task, document collection, signature, automated action, training, equipment, approval, questionnaire). |
| **FR-43** | A user with `HR_LIFECYCLE_MANAGE` can start onboarding for a hired candidate, a placeholder employee or an existing employee; the most specific matching template is proposed; one live onboarding per person. |
| **FR-44** | The system MUST create one task per task activity in the organization's onboarding project, assign it (a role assigns every active holder except super administrators), date it start plus offset with the end after its duration, both moved past rest days and holidays of the person's holiday calendar (from `time-off-management`, else Saturday and Sunday), and notify owners when the template says so. |
| **FR-45** | The system MUST keep a process planned, in progress, done or cancelled, with progress from activity weights; completing every required activity completes it; "Mark done" closes open tasks; cancelling closes them without deleting history. |
| **FR-46** | The system MUST leave running processes unchanged when a template changes and let a process owner add activities to a running process. |
| **FR-47** | The system MUST refuse to create the employee of an onboarding started for a candidate until every activity marked required before employee creation is done or cancelled, on every path that would create that employee. |
| **FR-48** | The system MUST create the employee from an onboarding with the candidate's name, email, rates, position, level, department, branch and start date, mark the candidate hired through the existing hire path and link the process. |
| **FR-49** | The system MUST run automated activities through the automation engine on their due date (invite and account, teams, projects and departments, role, equipment hand-over, course enrolment, chat channels, shared folders), record each result and leave a failed activity open with its reason; only actions of loaded plugins are offered. *(advanced)* |
| **FR-50** | An employee can submit their resignation with a requested last day, and a user with `HR_LIFECYCLE_MANAGE` can start a separation of kind resignation, termination, end of contract, retirement or other, with reason, notice date, notice period (default from FR-1), last working day and end-of-work date; the status becomes on notice. |
| **FR-51** | The system MUST offer separation activities that revoke access on the end-of-work date (sign-in, roles, memberships, personal tokens and sessions), list equipment and assets in custody (from `fixed-assets`, else the existing equipment sharing) as return activities, and reassign open tasks and owned records to a successor chosen by the manager from an assistant's proposal. *(advanced)* |
| **FR-52** | The system MUST refuse to complete a separation without an end-of-work date or while FR-7 applies. |
| **FR-53** | The system MUST record on the separation: notice date, end-of-work date, reason, whether time off was encashed, exit interview date, next employer and feedback. |
| **FR-54** | The system MUST give a person in onboarding an assistant that answers from documents the organization marks as onboarding knowledge and from the person's own process, cites its sources, never reveals other people's personal data, and sends unanswered questions to the process owner as inbox items. *(advanced)* |
| **FR-55** | The system MUST, a configurable number of days before probation ends (default 14), give the manager a review with onboarding completion, goals and tracked hours against expected hours, and one-step confirm, extend or end, each recorded as an HR event or separation. *(advanced)* |
| **FR-56** | The system MUST exclude employees of kind agent from personal data, documents, reminders, onboarding, separation, grievances and settlements, and list them in HR views only under "agent employees" with their owner and usage cost from `ai-agents-and-assistants`. *(advanced)* |

### 3.7 Exit interviews

| ID | Requirement |
| --- | --- |
| **FR-57** | A user with `HR_LIFECYCLE_MANAGE` can schedule one active exit interview per separation with an end-of-work date: interviewers, date and time (an invitation when the calendar is on), questionnaire, summary and outcome (stays, leaves); states to schedule, scheduled, held, cancelled; holding it writes the interview date on the separation and cancelling clears it. |
| **FR-58** | A user with `HR_LIFECYCLE_MANAGE` can send the exit questionnaire link to selected leavers by email template; each is sent once unless resent; the result lists leavers without email; answers attach to the interview. |
| **FR-59** | The system MUST remind interviewers and the leaver a configurable number of days (default 1) before a scheduled interview. |

### 3.8 Grievances

| ID | Requirement |
| --- | --- |
| **FR-60** | A user with `HR_SETTINGS_EDIT` can maintain grievance types with a description and a target resolution time. |
| **FR-61** | An employee with `HR_SELF_SERVICE` can raise a grievance concerning an employee, a department, a position or any record, with description, attachments and confidentiality (normal or confidential). |
| **FR-62** | A user with `HR_GRIEVANCES_INVESTIGATE` can assign an investigator and move a grievance through open, investigating, resolved, dismissed or withdrawn; resolving or dismissing needs a note, date, responsible person and resolver; an overdue grievance escalates to HR managers. *(advanced)* |
| **FR-63** | The system MUST never show a grievance to the person it concerns, show a confidential one only to its raiser, investigator and HR managers, and log every read by anyone else. |

### 3.9 Final settlement

| ID | Requirement |
| --- | --- |
| **FR-64** | A user with `HR_SETTLEMENTS_EDIT` can open the final settlement of a separation with an end-of-work date; the system MUST collect payable lines (unpaid pay to that date, encashable time off, approved unpaid claims, bonuses and end-of-service amounts, withheld payslips) and receivable lines (outstanding advances as paid less claimed less returned, loans when installed) from the loaded plugins, and assets or equipment still in custody. |
| **FR-65** | The system MUST let HR mark each line settled or not and change its amount with a reason, treat each asset as returned or recovered at a cost added to receivables, and show payable, receivable and net totals in the employee's pay currency. |
| **FR-66** | A user with `HR_SETTLEMENTS_CONFIRM` can confirm a settlement whose lines are all settled and assets returned or recovered; confirmation hands the net amount to `payroll-processing` for a settlement run when payroll is on, otherwise to `payments-and-collections`, never both, and the journal to `general-ledger` with the department's cost centre, and the settlement shows paid or unpaid from their events. |
| **FR-67** | The system MUST print the settlement statement through a print template, link each line to its source document and show the employee their own confirmed statement. |

### 3.10 Documents, contracts, letters and skills

| ID | Requirement |
| --- | --- |
| **FR-68** | A user with `HR_DOCUMENTS_MANAGE` can maintain document types: category (identity, contract, certificate, insurance, tax, other), required fields (number, issuer, issue and expiry dates), reminder days before expiry (default 30), self-upload allowed, and which employees need it within how many days of joining. |
| **FR-69** | The system MUST hold employee documents (file, type, number, issuer, issue and expiry dates, uploaded, verified or rejected) and list them on the employee's Documents tab beside the existing document links. |
| **FR-70** | The system MUST list missing required documents per employee and organization, and complete a "collect document" activity when a verified document of its type exists. |
| **FR-71** | The system MUST remind the employee and HR at the type's offset before expiry and on expiry, and flag expired documents. *(advanced)* |
| **FR-72** | A user with `HR_DOCUMENTS_MANAGE` can send a document to one or many employees for signature in a set order; signers sign in the app with a consent statement; the system keeps document fingerprint, signer, time and client, stamps an evidence page, makes the file read-only and reminds until signed; other features use the same signing for their records, including one outside signer on a signed link (a candidate accepting an offer). *(advanced)* |
| **FR-73** | A user with `ORG_CONTRACT_EDIT` can record employment contracts (type from the organization's employment types, start, end, renewal terms, signed file through FR-72); the contract end date feeds the employee record and its reminders, and a renewal is a contract renewal event. |
| **FR-74** | The system MUST generate HR letters (appointment, confirmation, employment certificate, end of employment) from print templates with the employee's fields and a company signatory. |
| **FR-75** | The system MUST keep per employee and skill a proficiency from 1 to 5 (the one skill scale of the platform: review ratings on other scales are converted to it proportionally, course targets use it), evaluation date, evaluator and source (self, manager, review, training), show gaps against the position's required skills, and list completed trainings from `learning-management`. |

### 3.11 Reminders and summaries

| ID | Requirement |
| --- | --- |
| **FR-76** | The system MUST send a daily birthday notice per organization (or per department, by setting) of colleagues whose birthday is today, showing day and month only and skipping people who opted out. |
| **FR-77** | The system MUST send a daily work anniversary notice with the number of years, by the same rules. |
| **FR-78** | The system MUST remind HR and the manager before probation end, contract end and retirement, at days set per organization. |
| **FR-79** | A manager can opt in to a daily team summary: joiners, people off today, birthdays and anniversaries of their reports, and overdue HR activities. |
| **FR-80** | The system MUST deliver reminders through the platform's notification preferences (inbox, email, chat) with email templates, once per person and occasion. |

### 3.12 Employee overview

| ID | Requirement |
| --- | --- |
| **FR-81** | The system MUST show an employee overview with independent blocks: HR summary, pending HR items, time-off balances, a year of attendance (from `attendance-and-shifts`, else days with tracked time), pay totals for a period (only with payroll permission), claims and advances, recent transactions by type; each block loads and fails on its own, for a period defaulting to the fiscal year. |
| **FR-82** | The system MUST show a connections block counting the employee's linked records per type, each opening the filtered list. |

### 3.13 Privacy

| ID | Requirement |
| --- | --- |
| **FR-83** | The system MUST group sensitive fields (personal, identity, health, bank, grievances, exit, settlement), require the group's permission to read or change it (personal-data keys for the first three, bank keys, then the keys of the grievance, separation and settlement pages), mask values for other readers in every surface (pages, lists, exports, API, MCP) and never list them without permission. Values that exist today (the employee's existing phone numbers, addresses, names and emails) keep their current visibility; only values recorded through this feature are grouped and masked. *(advanced)* |
| **FR-84** | The system MUST log every read of a sensitive group of an employee by anyone other than that employee (who, when, which group, which surface) in the platform's access audit of `access-control-and-security`, and let employees see who read their data when the organization enables it. *(advanced)* |
| **FR-85** | The system MUST encrypt identity and account numbers at rest and search them only by their last four characters. *(advanced)* |
| **FR-86** | The system MUST register its personal fields for the personal-data export and erasure of `access-control-and-security`, and, after a retention period per group that the organization sets (none by default, so nothing is anonymised until one is set; 7 years after end of work is the suggested value), anonymise the personal groups this feature recorded while keeping HR events under a pseudonym. |

### 3.14 Reports and dashboards

All reports are report definitions: filterable, groupable, exportable, schedulable and clonable. Sensitive columns
follow FR-83; groups under five people are shown as "fewer than 5".

| Requirement | Report | Answers | Filters and grouping |
| --- | --- | --- | --- |
| **FR-87** | Workforce | How is headcount split? | organization, date; group by branch, level, department, position or employment type |
| **FR-88** | Birthdays and anniversaries | Whose birthday or work anniversary falls in a month? | month, organization, department |
| **FR-89** | Employee list | The employee record as columns of the user's choice | any employee field the reader may see |
| **FR-90** | Exits | Who is leaving and what is pending (interview, questionnaire, settlement)? | dates, organization, department, position, employee, manager, interview state, outcome, pending only; counts |

| ID | Requirement |
| --- | --- |
| **FR-91** | The system MUST provide an HR dashboard with charts: headcount by department, position, age band, branch, level and employment type; gender ratio; grievances by type; joiners against leavers per month; promotions and transfers per year. |
| **FR-92** | The system MUST provide cards: active employees, exits this year, joining this quarter, leaving this quarter, hires this year, onboardings this month, promotions, separations and transfers this month, and holidays this month (from `time-off-management`). |
| **FR-93** | The system MUST report attrition (voluntary and not), average tenure, absence rate (time off over working days), span distribution, days to complete onboarding, internal moves and the digital workforce (agents and their usage cost), per month with drill-down. *(advanced)* |
| **FR-94** | The existing human resources dashboard (income, expenses and bonus per employee) MUST stay unchanged. |

### 3.15 API, agents, setup and compatibility

| ID | Requirement |
| --- | --- |
| **FR-95** | The system MUST expose every action through the REST API, and register employees, HR events, processes, grievances, documents and settlements as record types for saved views, global search, custom fields, approval definitions, print templates and automation triggers. |
| **FR-96** | The system MUST publish events (employee hired, onboarding started and done, HR event applied, separation started and completed, document expiring, grievance raised and resolved, settlement confirmed) on the event outbox for automations, webhooks and real-time updates. |
| **FR-97** | The system MUST offer MCP tools to read employees, the chart and processes and to record events, start onboarding or separation and confirm settlements; mutating tools return a preview first and act with the caller's permissions, marked as agent actions. |
| **FR-98** | The system MUST, when first enabled for an organization, add what is missing: employment types, document types, grievance types, one onboarding and one separation template (the onboarding template marks no activity as required before employee creation, so the existing hire path works as today until an administrator marks one), HR email templates, an "HR manager" role template the admin creates in one step, the HR menu group and a setup checklist. |
| **FR-99** | The system MUST grant `HR_SELF_SERVICE` to the employee role (own record, own documents, own activities, resignation, grievances), effective only while the feature is on. |
| **FR-100** | The system MUST import employees with HR fields, reporting lines (resolved by number or email in a second pass), documents' metadata and history through the mapped import, reporting errors per row. |
| **FR-101** | The system MUST ship email templates for onboarding, separation, exit questionnaire, reminders, signature requests and settlement, editable in the email template pages. |
| **FR-102** | The system MUST, with the feature off, load no route, menu entry or job of the feature and keep its data; switching it on again shows the data as left. |
| **FR-103** | The system MUST record who, when, before and after for every change of an HR record, event, process, document, grievance and settlement. |

## 4. Non-Functional Requirements

- **Performance**: employee list under 300 ms at the 95th percentile with 100,000 employees per tenant; organisation
  chart first view under 1 s and any person within 2 s at 50,000 employees; manager chain under 20 ms (cached);
  daily jobs (scheduled events, reminders, expiry, retention) finish within 10 minutes for 100,000 employees.
- **Data volume and concurrency**: 1 million HR events and 10 million document and activity rows per tenant;
  optimistic versions on employees, events, processes and settlements (`409` on conflict); one daily job run per
  organization at a time.
- **Reliability**: scheduled events and automated activities apply once (idempotent keys); failures block nothing else.
- **Security & privacy**: tenant and organization scoped; sensitive groups as FR-83 to FR-86; leaves the platform:
  emails of reminders, questionnaires and signature requests, calendar invitations, exports a user runs; the newcomer
  assistant sends document passages to the AI provider the tenant configured, never personal groups.
- **Observability and audit**: HR history, sensitive access log, process and job runs with failures, setting audits.
- **Accessibility and localisation**: keyboard-operable chart and forms, screen-reader labels on chart nodes, every
  string in every shipped locale, dates and amounts in the user's format, right-to-left layouts.
- **Compatibility**: PostgreSQL, MySQL and SQLite; both ORMs; multi-tenant cloud and self-hosted single tenant;
  additive OpenAPI and SDK changes only; existing employee, department, position and level routes unchanged.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| `Employee` (extended) | The existing employee record with number, status, reporting line, primary department and level reference |
| `OrganizationDepartment` (extended) | A department, now with a parent, head, code and cost centre |
| `OrganizationPosition` (extended) | A position with planned headcount and required skills |
| `EmployeeLevel` (extended) | A level (grade) with a rank |
| `OrganizationBranch` | A place where people work: address, time zone, country |
| `EmployeeHrProfile` | Branch, HR dates and settings of one employee (probation, confirmation, contract end, notice, retirement) |
| `EmployeePersonalDetail`, `EmployeeEmergencyContact`, `EmployeeEducation`, `EmployeePreviousEmployment` | Sensitive personal data of one employee (addresses in the address book, phones with the employee's phones) |
| Pay account | Where and how an employee is paid: the payment method here, bank details in the platform's one bank-details store |
| `EmployeeExternalId` | The employee's identifier in a system no integration maps |
| `EmployeeGroup` | A named audience of employees, fixed or rule-based |
| `HrApprover` | An approver for an employee or a department list, per kind |
| `HrEvent` / change | A dated change of an employee's placement, status or organization, and each property it changes |
| Lifecycle template / activity | A reusable onboarding or separation plan: a task template shared with project templates, plus HR facts per activity |
| `LifecycleProcess` / activity | One running onboarding or separation of a person |
| `Separation` | The record of a person leaving, with dates, reason and exit details |
| `ExitInterview` | An interview with a leaver and its questionnaire answers |
| `GrievanceType`, `Grievance` | A category of complaint; one complaint and its investigation |
| `FinalSettlement` / line | What is owed each way when a person leaves |
| `HrDocumentType`, `EmployeeDocument`, `SignatureRequest` | Kinds of HR documents, an employee's document (its file a document linked to the employee), a request to sign any record |
| `EmploymentContract` | The contract terms of an employee |
| `EmployeeSkillRating` | Proficiency of an employee in a skill |
| `ReorgScenario` | A draft reorganisation that changes nothing until applied |
| Sensitive read | One read of an employee's sensitive data by someone else, kept in the platform's access audit |

## 6. Out of Scope

- Time-off policies, balances, holiday calendars and half-day holidays: `time-off-management`. Check-ins, device API
  and attendance marks: `attendance-and-shifts` (it resolves devices through FR-16).
- Pay structures, cost to company, pay elements and the organization's payroll accounts: `payroll-setup`; payslips and
  paying a settlement: `payroll-processing`; payments to employees: `payments-and-collections`; matching claims to
  bank lines: `banking-and-reconciliation`; statutory employee fields and country setup: `regional-compliance-packs`.
- Offers and offer letters: `recruitment`; review templates and feedback criteria: `performance-management`; courses:
  `learning-management`; claims and advances: `expenses-and-travel`; asset custody: `fixed-assets`.
- Approval engine: `approval-workflows`; automation and notification channels: `automation-and-notifications`; role
  bundles, user types, personal-data export and erasure: `access-control-and-security`; deleting an organization:
  `organization-setup`; report builder: `report-builder-and-dashboards`; bank details store:
  `banking-and-reconciliation`.

## 7. Acceptance Criteria

- [ ] **AC-1** A hired candidate is onboarded from a template: tasks are dated past holidays, the employee can only be
      created once required activities are done, and the created employee carries the candidate's data (FR-43, FR-44, FR-48).
- [ ] **AC-2** Automated onboarding activities create the account and memberships; a failing one stays open with its
      reason; separation activities revoke access on the end date and list items to return (advanced, flows) (FR-10, FR-49).
- [ ] **AC-3** A future transfer applies on its date with old and new values in history; its cancel is refused after a later event (FR-35, FR-36).
- [ ] **AC-4** Cycles are refused; a manager with reports cannot leave until new managers are named; FR-25 resolution holds.
- [ ] **AC-5** The organisation chart at 50,000 seeded employees opens any person within 2 s, shows spans,
      vacancies and agents; a scenario applied for a date creates one transfer per moved person (advanced, chart) (FR-28, FR-29, FR-32, FR-33).
- [ ] **AC-6** The newcomer assistant answers from a seeded onboarding document with a link and routes an unknown
      question to HR; the probation review shows tracked hours (advanced, assistant) (FR-54).
- [ ] **AC-7** A separation with exit interview, questionnaire and settlement completes; the settlement collects
      lines from the loaded plugins, refuses confirmation with an unsettled line and prints (FR-57–FR-59).
- [ ] **AC-8** A confidential grievance is invisible to the person it concerns and its reads are logged (FR-61, FR-63).
- [ ] **AC-9** Expiry reminds once at the offset; a signed file carries its evidence page (advanced, documents) (FR-71, FR-72).
- [ ] **AC-10** Sensitive groups are masked in page, list, export, API and MCP for a reader without permission, and a
      permitted read appears in the access log (advanced, privacy) (FR-83, FR-84).
- [ ] **AC-11** The four reports of §3.14, the dashboard charts and cards, and the HR analytics return figures that
      agree with seeded data; groups under five people are suppressed.
- [ ] **AC-12** Denial answers `403`; concurrent edits `409`; a bulk event reports failed rows without partial changes (FR-34, FR-41).
- [ ] Works on PostgreSQL, MySQL and SQLite with both ORMs.
- [ ] Behind `FEATURE_HR_LIFECYCLE`; nothing changes while the flag is off, and existing employee pages are unchanged.
- [ ] **AC-13** With the flag on and no setting changed: employee lists and time screens show a manager the same people
      as before; time-off requests and expenses for inactive dates are accepted with a warning; a department with
      members deletes as before; a candidate hires through the existing path; existing phone numbers and addresses keep
      their visibility; "End work" and "Back to work" change the status; no personal data is anonymised; a hired
      candidate keeps their documents (FR-102).
- [ ] **AC-14** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-102).
- [ ] All functional requirements have a passing test.

## 8. Open Questions

- Reporting lines stay inside one organization unless the tenant allows others (applied); dotted-line managers are
  not modelled (a second line kind can follow). Suspended employees keep their sign-in (applied).
- Birthdays are shared as day and month unless the employee opts out (applied); some organizations may want opt-in.
- Branches are kept by this feature and offered to other plugins through its directory, so fixed-asset and
  attendance locations may point to one (applied); moving them to core is possible later without a data change.
- Signatures are simple electronic signatures with recorded evidence (applied); qualified signatures through an
  integration connector are left for `integration-hub`.
- No retention of personal groups applies until an organization sets one; 7 years after end of work is the suggested
  value (applied); country packs may suggest their own.
  Cancelled onboarding closes its tasks instead of deleting them (applied).

## 9. Constitution Gates

- [x] I Plugin-first — new plugin `hr-lifecycle` with UI plugins; core gets nullable shared structure columns only.
- [x] II Tenant/organization scoping — every record scoped; cross-organization transfers stay inside one tenant.
- [x] III Both ORMs, additive migrations — new tables and nullable columns only, three dialects.
- [x] IV Default-off flag; nothing removed — `FEATURE_HR_LIFECYCLE`; "End work", invites and hire path kept.
- [x] V Contracts and API first; backwards compatible — contracts and REST before UI; level label kept in sync.
- [x] VI Permissions, privacy, security — eighteen keys plus the contract key; sensitive groups masked and logged.
- [x] VII Real-time through the event bus — outbox events; chart and pages update live.
- [x] VIII i18n and accessibility — every string a key in all locales; accessible chart.
- [x] IX Tests accompany the change — reporting-line guards, event apply and cancel, gates, masking, jobs.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Related features: [`time-off-management`](../time-off-management/spec.md), [`approval-workflows`](../approval-workflows/spec.md),
  [`attendance-and-shifts`](../attendance-and-shifts/spec.md), [`payroll-processing`](../payroll-processing/spec.md),
  [`recruitment`](../recruitment/spec.md), [`fixed-assets`](../fixed-assets/spec.md),
  [`automation-and-notifications`](../automation-and-notifications/spec.md), [`access-control-and-security`](../access-control-and-security/spec.md)
- Existing code (`packages/core/src/lib/`): `employee`, `organization-department`, `organization-position`, `employee-level`,
  `employee-agent-profile`, `organization-document`, `candidate/commands/handlers/candidate.hired.handler.ts`, `skills`, `tag-type`
- Related architecture: [platform architecture](../../architecture/business-suite.md) §2.5 (HR core), §3.6 (approvals), §3.9 (automation), §3.12 (AI and MCP)
