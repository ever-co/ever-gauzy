# Feature Specification: Recruitment

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `recruitment`
**Branch**: `feat/recruitment`
**Status**: `Draft`
**Created**: 2026-11-16
**Last updated**: 2026-11-23
**Owner**: platform maintainers
**Feature flag**: `FEATURE_RECRUITMENT` (default off); the existing candidate features `FEATURE_EMPLOYEE_CANDIDATE` and
`FEATURE_MANAGE_INTERVIEW` keep working unchanged

---

## 1. Overview

Candidates, their sources, skills, documents, education, experience, interviews with interviewers, criteria ratings and
feedback already exist. This feature connects them into a hiring process: **headcount plans** say how many people the
organization intends to hire per position and at what cost; **hiring requests** ask for positions and are approved;
**job openings** are created from approved requests, published through the organization's public **careers feed**
(rendered as a careers site by Ever Works) and fed by applications from the apply endpoint, from a mailbox, from
referrals and from recruiters; each **application** (one candidate for one opening) moves through the organization's
**pipeline stages** on an **applicant board**; **interview templates** define the rounds and their scorecards; **offers**
carry the proposed pay with a compensation preview, terms and letters; an accepted offer starts onboarding of
`hr-core-lifecycle`, which creates the employee; **referrals** pay their bonus through `payroll-processing`.
Recruitment reports and a hiring dashboard close the loop. Clients: the Gauzy web app (referrals, interviews and
scorecards also at phone width), a careers site reading the public feed and posting to the apply endpoint, the
candidate's own sign-in, MCP tools and SDKs.

**Advanced capabilities.** A screening assistant writes a summary of each application against the opening's
requirements with the evidence it used, shows what it left out to avoid bias, and never rejects anyone: only a person
decides. Candidates book their own interview slot against the interviewers' real availability (working hours,
calendar, time off and booked meetings) and reschedule themselves. Interview templates carry structured scorecards, and a
calibration report shows how each interviewer rates against the panel and against hiring outcomes. Candidates follow
their applications, interviews and offers in an applicant portal. Consent and retention are built in: rejected
applicants are anonymised when their retention ends unless they joined the talent pool. Cost per hire includes the
recruiting team's tracked time. Every action is available to agents through MCP tools with a preview.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** an HR user, **when** they create next year's headcount plan for "Engineering" with 3 "Backend developer"
  positions at an estimated cost each, **then** each line shows current holders, open positions on openings and
  remaining vacancies, and the plan shows its total estimated cost.
- **Given** a manager, **when** they raise a hiring request for 2 "Backend developer" positions with a pay range and a
  needed-by date, **then** it goes to approval; **when** approved, **then** the recruiter creates the opening from it in
  one action with title, description, position, department and pay range prefilled.
- **Given** an open opening marked public, **when** a visitor opens the organization's careers site, **then** the
  opening is listed from the careers feed with its location, employment type and (if chosen) pay range; **when** they
  apply with name,
  email, CV and the opening's questions, **then** without signing in they see a confirmation, receive an
  acknowledgement email, and an application appears in the first stage with source "Careers page".
- **Given** an application mailbox, **when** a person emails a CV to the opening's address, **then** a candidate and an
  application are created with the email body as cover letter and the attachment as CV.
- **Given** an employee on their phone in the Gauzy web app, **when** they refer a friend for an opening, **then** a referral is recorded, the
  recruiter gets an inbox item, and the application carries source "Referral" and the referrer.
- **Given** the applicant board of an opening, **when** the recruiter drags a card from "Screening" to "Interviewing",
  **then** the stage changes for everyone watching the board, the stage's email (if set) goes to the candidate, and
  the move is in the application's history.
- **Given** an application, **when** the recruiter schedules the round "Technical interview" from its template, **then** the
  interviewers are invited, the candidate gets a link to pick a slot from the interviewers' common free time, and the
  chosen slot becomes a calendar event with a meeting link.
- **Given** a held interview, **when** each listed interviewer submits a scorecard, **then** the round shows averages
  per criterion; **when** the last one is in, **then** the recruiter is asked to advance, hold or decline.
- **Given** an application, **when** the recruiter asks for a screening summary, **then** they see requirements met and
  missing with quotes from the CV, suggested questions and the attributes left out; the stage does not change.
- **Given** a candidate chosen for hire, **when** the recruiter drafts an offer, **then** the compensation preview shows
  pay per period and per year and time-off entitlements; **when** approved and sent, **then** the candidate accepts in
  the applicant portal, onboarding starts, and once `hr-core-lifecycle` creates the employee the application is hired,
  the opening closes when all its positions are filled and the hiring request is filled with its time to fill.
- **Given** a referral whose candidate was hired 90 days ago (the programme's eligibility period), **when** the daily
  check runs, **then** the bonus is proposed to payroll as additional pay and the referral shows "bonus proposed".

### 2.2 Edge cases & failures

- **Given** a user without the permission, **when** they call a recruitment route, **then** `403`; with the feature off
  every route answers `404`, menus are hidden and the candidate pages behave as today; a concurrent edit gets `409`.
- **Given** a headcount plan in "block" mode with no vacancy left for a position, **when** someone opens a new opening
  for it, **then** it is refused naming planned, held and open counts; in "warn" mode it is saved with a warning.
- **Given** a closed opening, **when** someone applies, **then** the page says it is closed and nothing is stored;
  **given** the same email applying twice to one opening, **then** the second is merged into the first application.
- **Given** a person who was referred four months ago, **when** another employee refers the same email, **then** the
  referral is refused naming the earlier referral (window 180 days by setting).
- **Given** an employee who is not a listed interviewer, **when** they submit a scorecard, **then** `403`; before the
  interview starts, scorecards are refused.
- **Given** two candidates picking the same slot at once, **when** both confirm, **then** one is booked and the other is
  offered fresh slots; slots inside an interviewer's approved time off are never offered.
- **Given** an offer past its valid-until date, **when** the candidate tries to accept, **then** acceptance is refused and
  the recruiter is told; a second live offer for the same application is refused.
- **Given** payroll not loaded, **when** an offer is previewed, **then** the preview shows base and variable pay per
  period and year without deductions, and says so; referral bonuses become "due" with a task for HR.
- **Given** a careers form flooded by a script, **when** one address sends more than 5 applications in 10 minutes,
  **then** further ones are refused; files other than the allowed types or above 10 MB are refused.
- **Given** an organization that switched retention on and a rejected applicant whose retention period ended without
  talent-pool consent, **when** the retention job runs, **then** personal data and files are removed and only anonymous
  counts remain in reports; with retention off (the default) nothing is removed.

## 3. Functional Requirements

### 3.1 Headcount plans

| ID | Requirement |
| --- | --- |
| **FR-1** | A user with `RECRUITMENT_PLAN_EDIT` can maintain headcount plans per organization and period (from, to) with lines of position, optional department and branch, planned positions and estimated cost per position in a currency; the plan shows per line current holders, positions on open openings and vacancies, and in total the estimated cost. |
| **FR-2** | The system MUST refuse a second active plan line for the same organization, position, department and branch whose period overlaps, naming the existing plan. |
| **FR-3** | The system MUST let a plan of an organization with children in the organization tree be marked as a group plan, and warn or refuse (organization setting) a child organization's plan whose positions or cost exceed what the group plan leaves for it. |
| **FR-4** | A user with `RECRUITMENT_PLAN_EDIT` can pull approved hiring requests of the period into a plan as lines in one action. |
| **FR-5** | The system MUST check a new or reopened opening against the active plan line for its organization, position, department, branch and period (an opening without department or branch against the line without them; holders and open positions counted for that line only; where no line matches, "block" and "warn" save it with a notice that no plan covers it): with enforcement "block" refuse it when holders plus the open positions of other openings plus the positions this opening requests would exceed the plan, with "warn" save it with a warning in that case, with "off" (default) skip the check; closing an opening with unfilled positions warns. |

### 3.2 Hiring requests

| ID | Requirement |
| --- | --- |
| **FR-6** | A user with `RECRUITMENT_REQUEST_CREATE` can raise a hiring request: position, department, branch, number of positions, employment type, expected pay range, reason (new position or replacement of a named employee), needed-by date and description (proposed from the position's description). |
| **FR-7** | The system MUST warn when an open request exists for the same position, department and branch, naming it. |
| **FR-8** | The system MUST send a submitted request through `approval-workflows` or, when it is off, as a request on the existing Approvals page to the recruitment approvers the organization names (nobody approving their own request), and keep it draft, awaiting approval, approved, rejected, paused, filled or cancelled; only an approved request can produce openings. |
| **FR-9** | A user with `RECRUITMENT_OPENING_EDIT` can create an opening from an approved request in one action, prefilled from the request and the chosen opening template. |
| **FR-10** | The system MUST mark a request filled with its completion date when hires through its openings reach its number of positions, and compute its time to fill in days from approval to completion. |

### 3.3 Job openings and templates

| ID | Requirement |
| --- | --- |
| **FR-11** | A user with `RECRUITMENT_OPENING_EDIT` can maintain openings: number (numbering series, default `JOB-` and four digits per organization), title, position, department, branch, employment type, workplace (on site, hybrid, remote), location, rich description, requirements (skills with minimum proficiency, from the position's required skills of `hr-core-lifecycle` when present), positions to fill, pay range (currency, minimum, maximum, period), hiring manager, recruiters, interview plan (ordered interview templates), application questions, open-from and closes-on dates. |
| **FR-12** | The system MUST keep an opening draft, open, paused or closed; opening it stamps the posting date, closing stamps the closed date and clears the closes-on date, reopening clears the closed date; closes-on before open-from is refused. |
| **FR-13** | A user with `RECRUITMENT_SETTINGS_EDIT` can maintain opening templates (description, requirements, pay range, interview plan, questions) and apply one to a new opening. |
| **FR-14** | The system MUST close, once a day, openings whose closes-on date has passed, notifying their recruiters. |
| **FR-15** | The system MUST close an opening automatically when hires reach its positions to fill, unless the recruiter keeps it open for a talent pipeline. |

### 3.4 Careers pages and applying

| ID | Requirement |
| --- | --- |
| **FR-16** | The system MUST publish public openings through a public careers feed per organization at a stable address built from the organization's public name, with each opening's details, job-posting structured-data fields and application questions, for an Ever Works careers site (or any site) to render as indexable pages; with the Ever Works integration on, opening changes are pushed to the linked site; the system also serves a plain apply page per opening for links from job boards; showing the pay range and the number of applications are options per opening. |
| **FR-17** | The system MUST accept applications without sign-in: name, email, phone, country, source (preselected from a tracking parameter), cover letter, CV (file or link), expected pay and the opening's questions, with the organization's consent statement accepted; then show a thank-you message and send an acknowledgement email. |
| **FR-18** | The system MUST refuse applications to a draft, paused or closed opening, merge a repeated application of the same email to the same opening into the existing one (or refuse it, by opening setting), and accept CVs only as PDF, office documents or plain text up to 10 MB, each scanned before storage when a scanner is configured. |
| **FR-19** | The system MUST limit applications per address and per email (default 5 in 10 minutes) and apply the platform's bot protection to the apply page. |
| **FR-20** | A user with `RECRUITMENT_SETTINGS_EDIT` can bind an inbox mailbox to recruitment: each incoming mail creates or updates a candidate by sender address and an application on the opening named by the address alias or subject (else in an "Unsorted" opening), with the body as cover letter and attachments as documents; replies stay in the application's thread. |
| **FR-21** | A user with `RECRUITMENT_SETTINGS_EDIT` can choose the sender name and address of recruitment emails and edit their email templates (acknowledgement, stage change, interview, offer, rejection). |
| **FR-22** | The system MUST let an organization show its openings list on any website through an embed script or the public JSON feed of public openings. |

### 3.5 Candidates, applications and sources

| ID | Requirement |
| --- | --- |
| **FR-23** | The system MUST keep one candidate per person and organization (matched by email) and one application per candidate and opening; a candidate can hold applications to several openings, and existing candidates without applications stay valid. |
| **FR-24** | A user with `RECRUITMENT_APPLICATION_EDIT` can create an application for a new or existing candidate with source, referral, cover letter, CV, expected pay, rating and answers; recruiters adding a candidate this way do not create a sign-in for them until invited (the existing candidate invite). |
| **FR-25** | The system MUST keep the application's stage, applied date, last activity, rating (average of scorecards or set by hand), tags, owner (recruiter) and history of stage moves with who and when; when one of a candidate's applications changes status, the candidate's existing status follows (hired when any application is hired, rejected when all are closed without hire, applied otherwise); between such changes, and for candidates without applications, the status stays as people set it on the existing candidate pages, and the candidate's own rating is never overwritten. |
| **FR-26** | A user with `RECRUITMENT_SETTINGS_EDIT` can maintain applicant sources per organization (seeded: careers page, referral, direct, recruiter sourced, agency, job board, event, email), mark one as the referral source (requires a referrer) and set a cost per period for cost-per-hire reports; renaming a source renames the existing candidate source entries that still carry its former name, and leaves entries people renamed on the candidate pages as they are. |
| **FR-27** | The system MUST show the CV and documents of an application in a preview without download, and the candidate's other applications, interviews and offers on the same page. |
| **FR-28** | A user with `RECRUITMENT_APPLICATION_EDIT` can move applications in bulk (stage, owner, tags, reject with reason and optional email), with a result per application. |

### 3.6 Pipeline and applicant board

| ID | Requirement |
| --- | --- |
| **FR-29** | A user with `RECRUITMENT_SETTINGS_EDIT` can define the organization's pipeline stages (ordered, each of category open, hired, rejected or withdrawn, optional email template and optional required feedback before leaving), and override them per opening; the default pipeline is seeded on first enable; hiring pipelines never appear among sales pipelines. |
| **FR-30** | The system MUST show applications as a board per opening (or across openings) grouped by stage, as a saved view of `record-views-and-search`, with cards showing rating, days in stage, next interview and source; dragging a card moves the stage under the same rules as FR-31. |
| **FR-31** | The system MUST refuse a move into a hired-category stage except through an accepted offer or the hire action, require a reason for a rejected-category stage, and refuse leaving a stage that requires feedback while listed interviewers' scorecards are missing (an override with a reason is allowed to `RECRUITMENT_APPLICATION_EDIT`). |
| **FR-32** | The system MUST update open boards and lists in real time when an application changes and show who else is viewing the opening. |

### 3.7 Interview templates, scheduling and calendar

| ID | Requirement |
| --- | --- |
| **FR-33** | A user with `RECRUITMENT_SETTINGS_EDIT` can maintain interview templates: name, optional positions it is restricted to, duration, default interviewers, scorecard criteria (skills, qualities or questions with optional weights and guidance), expected average rating and interviewer guidance. |
| **FR-34** | A user with `RECRUITMENT_INTERVIEW_SCHEDULE` can schedule a round for an application from an interview template (or ad hoc) with date, start and end, interviewers, location or meeting link; the round is an existing candidate interview with its interviewers and criteria copied from the template, and the existing schedule emails go out. |
| **FR-35** | The system MUST refuse an interview template restricted to other positions, a second live round of the same template for one application, and interviewers who are not active employees. |
| **FR-36** | The system MUST keep a round scheduled, held, cancelled or no-show; rescheduling notifies candidate and interviewers with old and new times; cancelling notifies them. |
| **FR-37** | The system MUST show rounds on the existing interview calendar and as calendar events of `calendar-and-scheduling` when it is loaded, with a meeting room of `meetings` when chosen. |
| **FR-38** | A user with `RECRUITMENT_INTERVIEW_SCHEDULE` can send the candidate a self-scheduling link instead of a time (a booking link of `calendar-and-scheduling` when it is loaded, else a signed appointment link): the candidate sees slots where all required interviewers are free (working hours, availability slots, calendar busy times, approved time off, booked meetings), in their own time zone, books one, and can reschedule or cancel up to a set lead time (default 24 h); a booked slot is checked again at confirmation. *(advanced)* |
| **FR-39** | The system MUST remind interviewers and the candidate a set time before the round (default 24 h and 1 h), and remind interviewers each day while their scorecard is missing after a held round, through the platform's notification preferences. |

### 3.8 Scorecards and decisions

| ID | Requirement |
| --- | --- |
| **FR-40** | A listed interviewer can submit one scorecard per round after its start: a rating for each criterion, overall rating, recommendation (strong hire, hire, no hire, strong no hire) and notes; it can be edited until the round is closed; each scorecard is the existing candidate feedback with its criterion ratings. |
| **FR-41** | The system MUST compute per round the average per criterion and overall, show reviewers with their positions, and push the round average to the application's rating. |
| **FR-42** | The system MUST hide other interviewers' scorecards from an interviewer until they submitted their own (setting, default on). *(advanced)* |
| **FR-43** | The system MUST, when the last scorecard of a round is in, give the application owner an inbox item offering advance to the next stage, hold or decline, and ask the same in the page after a scorecard is submitted by the owner. |
| **FR-44** | The system MUST offer a calibration report per interviewer: number of scorecards, average rating against the panel average on the same rounds, share of their "hire" recommendations later hired, and outliers flagged. *(advanced)* |

### 3.9 Offers, letters and acceptance

| ID | Requirement |
| --- | --- |
| **FR-45** | A user with `RECRUITMENT_OFFER_EDIT` can draft an offer for an application: position, department, branch, level, employment type, reports-to, start date, valid-until date, base pay (amount, currency, period), variable pay, optional pay structure (`payroll-setup`) or target cost to the company, time-off policies and holiday calendar (`time-off-management`), probation and notice in days, working hours, terms and letter template. |
| **FR-46** | The system MUST allow one live offer per application, refuse a valid-until date before today or a start date before acceptance, and check the opening's headcount plan as FR-5. |
| **FR-47** | The system MUST show a compensation preview: fixed and variable components per pay period and per year, cost to the company and estimated take-home pay through the payroll preview when `payroll-processing` is loaded; given a target cost, it solves the base pay; without payroll it shows base and variable only and says so. |
| **FR-48** | The system MUST show the time off of the offer: yearly entitlement per chosen policy and the holiday calendar's counts of public holidays and rest days for the first year. |
| **FR-49** | A user with `RECRUITMENT_SETTINGS_EDIT` can maintain an offer term library (name, text with placeholders) and term sets loaded into an offer in one step; offer terms stay editable per offer. |
| **FR-50** | The system MUST keep an offer draft, awaiting approval, approved, sent, accepted, declined, withdrawn or expired; it is ready to send only when its required fields are complete; an offer above the opening's pay range or the request's range goes through `approval-workflows` or, when it is off, waits on the existing Approvals page for the organization's recruitment approvers. |
| **FR-51** | A user with `RECRUITMENT_OFFER_SEND` can render the offer letter from a print template (shipped: standard, short, with pay breakdown) with letterhead and signatory signature, preview it, and send it by email with a link to the applicant portal; sending makes the offer "sent". |
| **FR-52** | The candidate can accept or decline a sent offer in the applicant portal (or through the link) before it expires, accepting with typed name and consent (as a one-signer signature request of `hr-core-lifecycle` when it is loaded); the system keeps the letter's fingerprint, time and client as evidence and stamps the employee's offer and accept dates when the employee exists. |
| **FR-53** | The system MUST expire sent offers after their valid-until date and notify the owner; a changed sent offer becomes a new version that must be sent again. |
| **FR-54** | The system MUST, on acceptance, start onboarding of the candidate through `hr-core-lifecycle` with the offer's placement, pay, start date and manager, and mark the application hired when the employee is created; without `hr-core-lifecycle` it offers the existing hire action, which creates the employee with the offer's data. |
| **FR-55** | The system MUST generate an appointment letter from an accepted offer through a print template with placeholders (name, address, dates, working hours, probation, notice, pay; amounts and periods also in words), one default template per organization editable. |
| **FR-56** | The system MUST report the offer acceptance rate (accepted over decided offers) per period, opening and recruiter. |

### 3.10 Referrals

| ID | Requirement |
| --- | --- |
| **FR-57** | An employee with `RECRUITMENT_REFERRAL_CREATE` can refer a person for an opening (or in general) with name, email, phone, CV, relationship and why they fit, confirming the person agreed to be contacted. |
| **FR-58** | The system MUST refuse a referral of an email already referred within the window (default 180 days), name the earlier referral, create the candidate and application with the referral source, and let the referrer follow its status, which follows the application (submitted, in process, hired, not selected, withdrawn). |
| **FR-59** | A user with `RECRUITMENT_SETTINGS_EDIT` can define the referral programme: eligible openings, bonus amount per position or level, currency, eligibility after the hire's days of employment, and excluded referrers (the hiring manager, recruiters). |
| **FR-60** | The system MUST, when a hire becomes eligible, propose the bonus to `payroll-processing` as additional pay of the referrer and show the bonus as proposed, then paid or cancelled from payroll's events; an ineligible referral never gets a bonus; without payroll the bonus becomes due with an HR task. |

### 3.11 Screening assistant and fairness

| ID | Requirement |
| --- | --- |
| **FR-61** | A user with `RECRUITMENT_APPLICATION_VIEW` can request a screening summary: requirements met, partly met and missing, each with the quoted evidence from the CV, answers or cover letter, suggested interview questions and a confidence note. *(advanced)* |
| **FR-62** | The system MUST send the assistant only the opening's requirements and the application's text with name, photo, contact data, age, gender, nationality, marital status and address removed, list what was removed on the summary, and flag requirements that themselves may discriminate. *(advanced)* |
| **FR-63** | The system MUST NOT change a stage, reject, rate or message a candidate from an assistant output; every decision is a person's action, and summaries are kept with the model and inputs used. *(advanced)* |
| **FR-64** | A user with `RECRUITMENT_SETTINGS_EDIT` can switch on blind review per opening: names, photos and contact data are hidden on the board and in scorecards until the first interview is scheduled. *(advanced)* |

### 3.12 Applicant portal, consent and retention

| ID | Requirement |
| --- | --- |
| **FR-65** | A candidate signed in with the existing candidate role and `RECRUITMENT_CANDIDATE_SELF` sees their applications with stage names the organization marks as public, upcoming interviews with self-scheduling, offers to accept or decline, documents to upload, and can withdraw an application. *(advanced)* |
| **FR-66** | The system MUST record the consent statement and version accepted at application, offer talent-pool consent, and let a candidate withdraw consent from the portal or a link in every email. |
| **FR-67** | The system MUST, once the organization switches retention on (off by default, so no candidate data is removed until it does), anonymise candidates who have at least one application and whose applications are all closed without hire once the retention period (default 12 months after the last closure) ends, unless they consented to the talent pool (default 24 months); candidates without applications and hired candidates are never anonymised by it (hired ones follow `hr-core-lifecycle`); anonymization covers every personal text linked to the applicant, screening summaries and their assistant runs, interview feedback, offers and referrals included, and keeps counts and dates for reports. *(advanced)* |
| **FR-68** | A user with `RECRUITMENT_APPLICATION_VIEW` can search the talent pool by skills, past openings, ratings and tags and invite a candidate to apply to an opening. |

### 3.13 Reports and dashboards

All reports are report definitions: filterable, groupable, exportable, schedulable and clonable. Pay columns need
`RECRUITMENT_COMPENSATION_VIEW`; anonymised candidates count but are not listed.

| Requirement | Report | Answers | Filters and grouping |
| --- | --- | --- | --- |
| **FR-69** | Recruitment overview | Per headcount plan line and opening: planned, held, open, applications by stage, offers by status, hires | organization, as-on date, plan, department, position |
| **FR-70** | Pipeline funnel | How many applications reach each stage, conversion and days per stage | opening, period, source, recruiter |
| **FR-71** | Source effectiveness | Applications, interviews, offers, hires and cost per hire per source (source costs plus recruiters' tracked time on the opening's project) *(advanced)* | period, source, opening |
| **FR-72** | Time to fill and time to hire | Days from request approval to fill and from application to acceptance | period, department, position, recruiter |
| **FR-73** | Interviews | Rounds by status, interview template and interviewer; scorecards missing and late | period, interview template, interviewer |
| **FR-74** | Offers | Offers by status, acceptance rate, decline reasons, pay against range | period, opening, recruiter |
| **FR-75** | Referrals | Referrals by referrer and status, hires, bonuses proposed and paid | period, department |

| ID | Requirement |
| --- | --- |
| **FR-76** | The system MUST provide a hiring dashboard with charts: open openings by department and by position, interviews by status, application funnel by stage, applications by source, by country, by stage and over time (per day, week or month), offers by status. |
| **FR-77** | The system MUST provide cards: hires this period, applications this month, open openings, rejected applications this period, offers this month, offer acceptance rate, application-to-hire percentage, average time to fill. |
| **FR-78** | The existing candidate statistics charts and interview calendar MUST stay unchanged. |

### 3.14 API, agents, setup and compatibility

| ID | Requirement |
| --- | --- |
| **FR-79** | The system MUST expose every action through the REST API and register headcount plans, hiring requests, openings, applications, rounds, offers and referrals as record types for saved views, global search, custom fields, approval definitions, print templates and automation triggers. |
| **FR-80** | The system MUST publish events (request approved, opening opened and closed, application received, stage changed, round scheduled and held, scorecard submitted, offer sent, accepted and declined, hire completed, referral bonus due) on the event outbox for automations, webhooks and real-time updates. |
| **FR-81** | The system MUST offer MCP tools to search openings and applications, read an application with scorecards, draft an opening from a request, move stages, schedule a round, request a screening summary and draft an offer; mutating tools return a preview first, act with the caller's permissions and are marked as agent actions. *(advanced)* |
| **FR-82** | The system MUST, when first enabled for an organization, add the default pipeline, sources, one opening template, two interview templates, an offer term set, letter templates, email templates, the careers feed settings and the recruitment menu group. |
| **FR-83** | The system MUST grant `RECRUITMENT_REFERRAL_CREATE` to the employee role, `RECRUITMENT_CANDIDATE_SELF` to the candidate role and scorecard submission to every listed interviewer, effective only while the feature is on. |
| **FR-84** | The system MUST import openings, candidates with applications and stages, and historical offers through the mapped import, reporting errors per row. |
| **FR-85** | The system MUST, with the feature off, load no route, menu entry, public page or job of the feature and keep its data; existing candidate, interview and feedback routes, the hire action and the outbound job-search plugins are unchanged in every case. |
| **FR-86** | The system MUST record who, when, before and after for every change of a plan, request, opening, application stage, offer and referral. |

## 4. Non-Functional Requirements

- **Performance**: board of an opening with 2,000 applications first paint under 1 s (cards paged per stage); application
  list under 300 ms at the 95th percentile with 1 million applications per tenant; careers feed served under 200 ms
  from cache and the apply endpoint able to take 50 applications per second per tenant; free-slot search for 3 interviewers over 14 days
  under 500 ms.
- **Data volume and concurrency**: 100,000 openings and 5 million applications per tenant; optimistic versions on
  openings, applications and offers (`409`); a slot is booked at most once (unique per interviewer and time).
- **Reliability**: inbound mail, public applications and payroll proposals are idempotent (message id, submission key,
  referral id); failures of the assistant, calendar or meeting providers never block the recruiter's action.
- **Security & privacy**: tenant and organization scoped; pay data behind `RECRUITMENT_COMPENSATION_VIEW`; public
  routes expose only public openings and accept only the apply payload; leaves the platform: acknowledgement, stage,
  interview, offer and rejection emails, calendar invitations, the careers feed, application text sent to the tenant's
  configured AI provider (with the attributes of FR-62 removed).
- **Observability and audit**: application history, offer versions and acceptance evidence, assistant runs with inputs
  and model, job runs (expiry, reminders, retention, referral eligibility).
- **Accessibility and localization**: keyboard moves between board columns, screen-reader labels on cards and slots,
  the apply page accessible, openings translatable per opening, every string in every shipped locale, right-to-left
  layouts.
- **Compatibility**: PostgreSQL, MySQL and SQLite; both ORMs; multi-tenant cloud and self-hosted single tenant;
  additive OpenAPI and SDK changes only.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| `Candidate` (existing) | A person who applies or is sourced; holds documents, education, experience, skills |
| `HeadcountPlan` / line | Positions an organization intends to fill in a period, with estimated cost |
| `HiringRequest` | A manager's approved request for positions |
| `JobOpening`, `JobOpeningTemplate` | A position open to applicants, internally or on the careers page; a reusable starting point |
| `JobApplication` | One candidate applying to one opening, with stage and history |
| `PipelineStage` | A step of the organization's hiring pipeline with its category |
| `ApplicantSource` | Where applications come from, with a cost |
| `InterviewTemplate` | A round definition with scorecard criteria and default interviewers |
| `InterviewRound` | A scheduled interview (the existing candidate interview) of an application from an interview template |
| Scorecard | An interviewer's ratings and recommendation (the existing candidate feedback) |
| `SchedulingLink` | A candidate's link to book or move a round in free slots |
| `Offer`, offer term, term set | A proposal of employment with pay and terms; reusable terms |
| `Referral`, `ReferralProgramme` | An employee's recommendation of a person; the bonus rules |
| `ScreeningSummary` | An assistant's summary of an application with evidence and removed attributes |
| `RecruitmentSettings` | Plan enforcement, retention, mailbox, careers branding, blind review |

## 6. Out of Scope

- Creating the employee record, onboarding activities and employee letters after hire: `hr-core-lifecycle`.
- Pay structures and elements: `payroll-setup`; paying referral bonuses: `payroll-processing`; time-off policies and
  holiday calendars: `time-off-management`.
- The approval engine: `approval-workflows`; notification channels and reminders engine: `automation-and-notifications`;
  board and calendar layouts: `record-views-and-search`; report engine: `report-builder-and-dashboards`; print
  templates: `print-and-pdf-designer`; calendar events: `calendar-and-scheduling`; meeting rooms: `meetings`; agent
  definitions and cost limits: `ai-agents-and-assistants`; portal user types: `access-control-and-security`.
- Careers site pages, their design and visitor analytics: an Ever Works site renders them from the careers feed.
- Job boards and paid job advertising: openings are published as structured data any board can read; outbound posting
  connectors belong to `integration-hub`. The existing outbound job-search and proposal plugins are a different
  direction (the organization looking for work) and are not changed.

## 7. Acceptance Criteria

- [ ] **AC-1** A headcount plan in block mode refuses an opening with no vacancy and shows holders, open and vacancies (FR-1, FR-5).
- [ ] **AC-2** A hiring request is approved through a workflow, produces an opening in one action and becomes filled
      with its time to fill when the last hire completes (FR-4, FR-8, FR-9).
- [ ] **AC-3** A visitor applies without sign-in through the apply endpoint (from a careers site or the plain apply
      page); the application appears in the first stage; a repeat application merges; a closed opening refuses and
      leaves the feed; the rate limit holds (FR-16, FR-18, FR-19).
- [ ] **AC-4** An email to the application mailbox creates candidate and application once, however often it is delivered (FR-20).
- [ ] **AC-5** The board moves a card live for a second viewer; hired and rejected stages enforce their rules (FR-30, FR-32).
- [ ] **AC-6** A round scheduled from an interview template invites interviewers; the candidate books a free slot that excludes time off;
      two concurrent bookings of one slot produce one booking (advanced, self-scheduling) (FR-34, FR-38, FR-39).
- [ ] **AC-7** Only listed interviewers submit scorecards, after the start; averages appear; the decision inbox item
      arrives; the calibration report flags a seeded lenient interviewer (advanced, interview templates) (FR-40, FR-42, FR-43).
- [ ] **AC-8** An offer previews pay with payroll loaded and without; above-range offers need approval; acceptance in
      the portal starts onboarding, and the application is hired when the employee is created (FR-47, FR-50).
- [ ] **AC-9** A referral is refused within the window; the eligible bonus becomes additional pay of the referrer (FR-58–FR-60).
- [ ] **AC-10** A screening summary quotes evidence, lists removed attributes and changes nothing (advanced, assistant) (FR-61–FR-63).
- [ ] **AC-11** With retention switched on, retention anonymises a seeded rejected applicant and keeps report counts;
      with it off nothing is removed (advanced, privacy) (FR-65–FR-68).
- [ ] **AC-12** The seven reports, dashboard charts and cards return figures that agree with seeded data (FR-76–FR-78).
- [ ] **AC-13** Denial answers `403`; concurrent edits `409`; MCP mutating tools return a preview first (FR-81).
- [ ] Works on PostgreSQL, MySQL and SQLite with both ORMs.
- [ ] Behind `FEATURE_RECRUITMENT`; nothing changes while the flag is off; existing candidate pages unchanged.
- [ ] All functional requirements have a passing test.
- [ ] **AC-14** With the feature on, a candidate's status set by hand, its rating and a candidate source renamed on the
      candidate page stay as people set them; a candidate without applications is never anonymised (FR-25, FR-26,
      FR-67).
- [ ] **AC-15** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-85).

## 8. Open Questions

- Headcount plan enforcement defaults to "off" (applied); organizations that budget strictly switch to "block".
- Public application stores the candidate without a sign-in until a recruiter invites them (applied); a self-service
  account at apply time is possible later.
- Retention is off until an organization switches it on; then it defaults to 12 months for rejected applicants and
  24 months for the talent pool (applied); country packs of `regional-compliance-packs` may set their own.
- The screening assistant is off until an organization switches it on and names an AI provider (applied).
- Referral bonuses become payable after 90 days of the hire's employment by default (applied).

## 9. Constitution Gates

- [x] I Plugin-first — new plugin `recruitment` with its UI plugin; core candidate modules unchanged; core pipelines gain a kind.
- [x] II Tenant/organization scoping — every record scoped; public routes resolve the organization from its careers address.
- [x] III Both ORMs, additive migrations — new tables and nullable columns, three dialects.
- [x] IV Default-off flag; nothing removed — `FEATURE_RECRUITMENT`; candidate status, routes, hire path kept.
- [x] V Contracts and API first; backwards compatible — contracts and REST before UI; additive OpenAPI.
- [x] VI Permissions, privacy, security — fourteen keys; pay data gated; consent, retention, bias guard; public input validated.
- [x] VII Real-time through the event bus — outbox events; boards update live.
- [x] VIII i18n and accessibility — every string a key in all locales; keyboard board; accessible apply page.
- [x] IX Tests accompany the change — plan checks, intake idempotency, slot booking, scorecard rules, offers, retention.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Related features: [`hr-core-lifecycle`](../hr-core-lifecycle/spec.md), [`approval-workflows`](../approval-workflows/spec.md),
  [`payroll-processing`](../payroll-processing/spec.md), [`payroll-setup`](../payroll-setup/spec.md),
  [`time-off-management`](../time-off-management/spec.md), [`record-views-and-search`](../record-views-and-search/spec.md),
  [`report-builder-and-dashboards`](../report-builder-and-dashboards/spec.md), [`custom-fields-and-forms`](../custom-fields-and-forms/spec.md),
  [`automation-and-notifications`](../automation-and-notifications/spec.md), [`print-and-pdf-designer`](../print-and-pdf-designer/spec.md),
  [`calendar-and-scheduling`](../calendar-and-scheduling/spec.md), [`lead-capture-and-enrichment`](../lead-capture-and-enrichment/spec.md),
  [`crm-leads-and-deals`](../crm-leads-and-deals/spec.md)
- Existing code (`packages/core/src/lib/`): `candidate*` (12 modules), `candidate/commands/handlers/candidate.hired.handler.ts`,
  `employee-appointment`, `availability-slots`, `event-types`; UI `apps/gauzy/src/app/pages/candidates`; public pages
  `packages/plugins/public-layout-ui`; MCP `packages/mcp-server/src/lib/tools/candidates.ts`
- Related architecture: [platform architecture](../../architecture/business-suite.md) §2.5 (recruitment), §3.6 (approvals), §3.8 (reports), §3.12 (AI and MCP)
