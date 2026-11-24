# Feature Specification: Performance management

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `performance-management`
**Branch**: `feat/performance-management`
**Status**: `Draft`
**Created**: 2026-11-16
**Last updated**: 2026-11-23
**Owner**: platform maintainers
**Feature flag**: `FEATURE_PERFORMANCE_REVIEWS` (default off); the existing goal features `FEATURE_GOAL`,
`FEATURE_GOAL_SETTING` and `FEATURE_GOAL_REPORT` keep working unchanged

---

## 1. Overview

Goals at organization, team and employee level, weighted key results with progress updates, KPIs, goal templates, time
frames and goal settings already exist. This feature turns them into performance management. Goals and key results
gain **focus areas**, a **review cycle** and a **roll-up** through alignment, so an organization goal moves when the
team and employee goals aligned to it move. **Review templates** weight focus areas and **rating criteria** on a
**rating scale**. A **review cycle** selects employees, creates one **review** per person in the background and runs
it through self review, peer and upward feedback, manager review, calibration and release; scores follow a formula
the organization can change. Cycle progress shows who is late; performance reports and the existing goal reports
page are report definitions. Clients: the Gauzy web app (self review, feedback requests, one-to-ones and
goal check-ins also at phone width), MCP tools and SDKs.

**Advanced capabilities.** Key results move by themselves from tracked work: hours tracked on a project, tasks done,
deals won, amounts invoiced or any report measure, so progress is computed rather than typed. Between cycles,
colleagues give continuous feedback and managers keep one-to-one agendas that carry over; both become evidence in the
next review. Calibration sessions show the rating distribution against guidance and a performance and potential grid,
and record every change with its reason. A review assistant drafts the manager's summary from the evidence with
citations and flags biased wording, but never sets a rating. Development areas assign learning paths of
`learning-management`, competencies update the employee's skill proficiencies, and released ratings can propose
bonuses to payroll behind an approval.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** an HR user, **when** they create the template "Engineering 2027" with focus areas Delivery 50 %, Quality
  30 %, Collaboration 20 % and five rating criteria, **then** it saves only because each set of weights totals 100,
  and positions "Backend developer" and "QA engineer" take it as their default.
- **Given** a cycle "H1 2027" for the departments Engineering and Product, **when** HR launches it, **then** a review is
  created for each of the 84 matching employees in the background with a progress bar, 3 employees whose position has
  no template are listed for a choice, and each employee and manager is notified with the due dates.
- **Given** an employee with three goals in focus area Delivery for the cycle, **when** a key result update moves one
  goal to 80 %, **then** the goal, the goal it is aligned to and the employee's Delivery score update in real time.
- **Given** a key result "Ship 400 billable hours on project Apollo" bound to tracked time, **when** a teammate's time
  log is approved, **then** the key result's progress moves without anyone typing an update.
- **Given** an employee in the self-review step, **when** they rate themselves on each criterion and write reflections,
  **then** submitting it moves the review to feedback; they nominate four peers, the manager approves three.
- **Given** a peer asked for feedback, **when** they submit ratings and comments, **then** the review's feedback score
  updates; the employee later sees peer comments without names because the cycle is anonymous and three answered.
- **Given** the manager review, **when** the manager opens it, **then** they see goals with completion, self review,
  feedback, continuous feedback notes, recognitions received and one-to-one notes; the assistant offers a draft
  summary that quotes its sources; the manager proposes a rating and submits.
- **Given** a calibration session for Engineering, **when** the facilitator opens it, **then** reviews appear on the
  distribution chart against the guidance (10 % / 20 % / 50 % / 15 % / 5 %) and on the performance and potential grid;
  **when** they move one person from 4 to 3 with a reason, **then** the change is logged and the score is kept.
- **Given** a released cycle, **when** the employee opens their review, **then** they see final rating, manager summary
  and development areas, acknowledge it with a comment, and see the learning path the manager assigned.
- **Given** HR, **when** they open cycle progress, **then** they see counts per step, employees without goals in the
  cycle, without feedback and with overdue steps, and can remind all of them in one action.
- **Given** a manager and a report, **when** they run a fortnightly one-to-one, **then** the shared agenda holds items
  from both, unfinished items carry over, and action items become tasks of the report.

### 2.2 Edge cases & failures

- **Given** a user without the permission, **when** they call a performance route, **then** `403`; with the feature off
  every route answers `404`, menus are hidden and the goal pages behave as today; a concurrent edit gets `409`.
- **Given** a template whose criteria weights total 90, **when** saved, **then** it is refused naming the total.
- **Given** a cycle with reviews already created, **when** HR changes its goal scoring from progress to manual ratings,
  **then** it is refused; the score formula can change only until the first review is released.
- **Given** a formula naming an unknown field or dividing by a field that is zero for one review, **when** saved or
  evaluated, **then** saving names the unknown field and that review shows "score not computable" with the reason.
- **Given** a closed cycle, **when** someone adds a goal, a response or a feedback note to it, **then** it is refused.
- **Given** HR completing a cycle with 2 reviews not released, **when** they confirm, **then** it is refused listing
  them; removing a participant needs a reason (for example the person left).
- **Given** an employee, **when** they try to write peer feedback on their own review, **then** it is refused and they
  are pointed to their self review; a reviewer can submit one response per review and kind.
- **Given** an anonymous cycle with only two peer answers, **when** the employee reads the review, **then** peer comments
  are hidden and only the count shows; the manager sees them unattributed.
- **Given** a parent goal aligned to itself through a child, **when** saved, **then** the alignment is saved as today,
  marked as a cycle on both goals and left out of roll-up; with the organization's strict alignment setting on it is
  refused as a cycle.
- **Given** a key result bound to deal amounts while the CRM plugin is off, **when** the metric refreshes, **then** the
  key result keeps its last value and shows "source unavailable"; nothing else fails.
- **Given** an employee whose work ends during the cycle, **when** the end date passes, **then** their review is closed
  as incomplete and excluded from distribution and averages.

## 3. Functional Requirements

### 3.1 Focus areas, rating criteria and scales

| ID | Requirement |
| --- | --- |
| **FR-1** | A user with `PERFORMANCE_SETTINGS_EDIT` can maintain focus areas (name, description, active) used by templates, goals and reviews. |
| **FR-2** | A user with `PERFORMANCE_SETTINGS_EDIT` can maintain rating criteria (name, description, optional behaviour examples per scale point, kind: general, competency linked to a skill, value of the organization, active) used by self, manager and peer responses. |
| **FR-3** | A user with `PERFORMANCE_SETTINGS_EDIT` can maintain rating scales (3 to 10 points, each with a label and description; one default per organization, five points seeded) and score bands that turn a score into a scale point. |
| **FR-4** | The system MUST refuse to delete a focus area, criterion or scale used by a template, goal or review, offering deactivation instead. |

### 3.2 Review templates

| ID | Requirement |
| --- | --- |
| **FR-5** | A user with `PERFORMANCE_SETTINGS_EDIT` can maintain review templates: focus areas with weights, self-review criteria with weights, reviewer criteria with weights, open questions per response kind, which response kinds it uses (self, manager, peer, upward) and the scale. |
| **FR-6** | The system MUST refuse a template whose focus area weights, self-review criteria weights or reviewer criteria weights do not each total 100, naming the total. |
| **FR-7** | A user with `PERFORMANCE_SETTINGS_EDIT` can set a default template per position (and per level within it), which cycles pick for each employee; `hr-core-lifecycle` shows it on the position. |
| **FR-8** | The system MUST copy the template into each review at creation, so later template changes never change running reviews. |

### 3.3 Goals and key results with roll-up

| ID | Requirement |
| --- | --- |
| **FR-9** | A user with `GOALS_EDIT` (or the goal's owner, as today) can give a goal a focus area, a review cycle (its dates proposed from the cycle) and a description, beside its existing level, owner, lead, deadline, key results and alignment. |
| **FR-10** | The system MUST leave out of roll-ups an alignment that makes a goal its own ancestor and mark it on the goals concerned; when the organization requires strict alignment (setting, default off) it refuses such an alignment, and an employee goal aligned under a goal of another cycle or another focus area. |
| **FR-11** | A user with `GOALS_EDIT` can set a key result to roll up from the goals aligned to it: its progress is the average (or weight-of-goal average) of their progress, recomputed whenever one of them changes. |
| **FR-12** | The system MUST cap progress used in roll-ups and scores at 100 % while showing a key result's own value above target as such, and derive a goal's state from progress: not started at 0, in progress, done at 100, with archived and closed set by hand. |
| **FR-13** | The system MUST keep the existing progress rules (weighted average of key results; update types numerical, true or false, currency, task, KPI) and the existing rule that only the owner, the lead or a holder of `GOALS_EDIT` updates a goal. |
| **FR-14** | The system MUST move a task key result to done when its task reaches a done status and back when the task reopens. |
| **FR-15** | A user with `GOALS_EDIT` can bind a numerical or currency key result, or a KPI, to a metric of tracked work: hours tracked (employee, team, project or task; billable only optional), tasks done (project, sprint, label), deals won (count or amount, pipeline), amounts invoiced or paid, or a measure of a report definition, over the goal's time frame; the system MUST refresh it on the source's events and at least hourly, and record each refresh as an automatic update. *(advanced)* |
| **FR-16** | The system MUST show goals as a tree from the organization down through teams to employees along alignments, with progress, state and owner on each node, filters by time frame, cycle, focus area and team, and quick progress and state updates on each node. |
| **FR-17** | The system MUST remind goal owners to check in on key results without an update for a set period (organization setting, default 14 days) through notification preferences. |
| **FR-18** | The system MUST update open goal pages, trees and reviews in real time when progress changes. |

### 3.4 Review cycles

| ID | Requirement |
| --- | --- |
| **FR-19** | A user with `PERFORMANCE_CYCLE_MANAGE` can create a review cycle: name, review period, organization, filters (departments, branches, positions, levels, employment types, employee groups, minimum tenure), step dates (self review, nominations, feedback, manager review, calibration, release), goal scoring method, score formula, peer rules (who nominates, minimum and maximum peers, manager approval), anonymity and a minimum number of answers before peer comments show (default 3). |
| **FR-20** | The system MUST list the employees a cycle's filters select before launch, refuse launch when none match, exclude agents and people whose work ends before the period ends, and let HR add or remove people with a reason. |
| **FR-21** | The system MUST create one review per selected employee in the background at launch, with progress and a result per employee, taking the template from the employee's position (FR-7) or HR's choice for those without one, and the manager from the reporting line of `hr-core-lifecycle` (else the employee's team managers). |
| **FR-22** | The system MUST refuse a second review for the same employee and cycle. |
| **FR-23** | The system MUST keep a cycle draft, active, calibrating, released or closed, and refuse new goals, responses and feedback notes against a closed cycle. |
| **FR-24** | The system MUST refuse changing the goal scoring method once reviews exist, and changing the score formula once a review is released. |
| **FR-25** | The system MUST show cycle progress: counts of reviews per step, overdue steps, employees without goals in the cycle, without any feedback and without a manager; HR can remind any selection in one action. |
| **FR-26** | The system MUST refuse to close a cycle while reviews are not released or closed as incomplete, listing them; closing freezes all scores. |
| **FR-27** | The system MUST close a review as incomplete when the employee's work ends during the cycle, and leave it out of distributions and averages. |

### 3.5 Reviews and responses

| ID | Requirement |
| --- | --- |
| **FR-28** | An employee with `PERFORMANCE_SELF_SERVICE` can complete their self review: rating per self-review criterion, comments, answers to the template's questions and reflections per goal; submitting it locks it. |
| **FR-29** | The system MUST let the employee nominate peers within the cycle's limits, the manager approve, replace or add, and ask each approved peer for feedback; a peer may decline with a reason. |
| **FR-30** | A requested reviewer can submit one response per review and kind (manager, peer, upward) with a rating per reviewer criterion, comments and answers; the system MUST refuse a response by the employee about themselves (self review is the way) and a response to a review of another organization. |
| **FR-31** | A user with `PERFORMANCE_REVIEW_MANAGE` acting on a report (by reporting line) completes the manager review: focus area ratings when scoring is manual, criterion ratings, proposed scale point, potential (low, medium, high), strengths, development areas and a summary. |
| **FR-32** | The system MUST show on a review its self review, responses received with each reviewer's position (unattributed in anonymous cycles), the focus areas with weights, goal completion and goal score, the manual focus area ratings when used, and the scores of FR-34 to FR-38. |
| **FR-33** | The system MUST let a reviewer add a response from the review page, show the review's response history newest first, and recompute scores when a response is submitted, edited before lock or withdrawn. |

### 3.6 Scoring

| ID | Requirement |
| --- | --- |
| **FR-34** | The system MUST compute each focus area's goal completion as the capped average progress of the employee's goals in that focus area and cycle, converted to the scale; with manual scoring the manager's focus area rating is used instead and may not exceed the scale's top point. |
| **FR-35** | The system MUST compute the goal score as the weighted sum of focus area scores, the self score as the weighted sum of self ratings, and each response's score as the weighted sum of its ratings. |
| **FR-36** | The system MUST compute the feedback score as the average of submitted manager, peer and upward response scores, weighted per kind by the cycle (default: manager 50 %, peers 30 %, upward 20 %, renormalized over the kinds present). |
| **FR-37** | The system MUST compute the final score from the cycle's formula in the platform's formula language over the goal, self, feedback, manager, peer, upward and competency scores and the employee's and cycle's fields (custom fields included); the default formula is the average of goal, self and feedback scores; the formula runs without tenant code and is validated on save. |
| **FR-38** | The system MUST turn the final score into a proposed scale point through the scale's bands, keep the manager's proposed point beside it, and keep recomputing scores live from goals and responses until the manager review is submitted, then freeze the goal score. |

### 3.7 Competencies and development

| ID | Requirement |
| --- | --- |
| **FR-39** | The system MUST add competency criteria to reviews from the skills the employee's position requires (`hr-core-lifecycle`), rated on its proficiency scale of 1 to 5 (converted to the review's scale only for scores), and on release record each manager rating unchanged as the employee's skill proficiency with source "review". |
| **FR-40** | A manager can record development areas with actions and dates and assign a learning path or course of `learning-management` from a development area; the review shows its progress. *(advanced)* |
| **FR-41** | The system MUST show recognitions the employee received in the review period (from `automation-and-notifications`) as evidence on the review, read-only. |

### 3.8 Calibration and release

| ID | Requirement |
| --- | --- |
| **FR-42** | A user with `PERFORMANCE_CALIBRATE` can run calibration sessions on a cycle for a scope (department, manager, position or a list), showing the distribution of proposed points against the cycle's guidance, a performance and potential grid, and each review's scores and evidence. *(advanced)* |
| **FR-43** | The system MUST let calibrators change a review's final point with a mandatory reason, keep every change with who, when, old and new point, and never change the computed scores. *(advanced)* |
| **FR-44** | The system MUST warn when a session's distribution differs from guidance by more than the cycle's tolerance (default 10 points per band) and show the same for each manager's reviews. *(advanced)* |
| **FR-45** | A user with `PERFORMANCE_CYCLE_MANAGE` can release reviews (all, by scope, or one) on or after the release date; the employee is notified and sees what the cycle makes visible (final point, manager summary, development areas, responses as configured). |
| **FR-46** | The employee can acknowledge a released review with an optional comment and may ask HR for a conversation; acknowledgement does not mean agreement and the review says so. |
| **FR-47** | A cycle can define a bonus matrix (final point → percentage of base pay or amount); on release the system lists proposals per employee for approval through `approval-workflows` or, when it is off, as requests on the existing Approvals page to the bonus approvers the organization names (nobody approving their own request), and approved proposals become incentives of `payroll-processing`. *(advanced)* |

### 3.9 Continuous feedback, one-to-ones and recognition

| ID | Requirement |
| --- | --- |
| **FR-48** | An employee with `PERFORMANCE_SELF_SERVICE` can give a colleague feedback at any time — praise (recorded as a recognition of `automation-and-notifications`, so the colleague has one recognition feed), a suggestion or a note — optionally on a goal, task or project, visible to the receiver and their manager or only to the manager, and can ask colleagues for feedback on a topic. *(advanced)* |
| **FR-49** | The system MUST list feedback notes and praise of the review period on the review as evidence, with their visibility kept. *(advanced)* |
| **FR-50** | A manager and a report can hold one-to-ones when `calendar-and-scheduling` and `meetings` are loaded: a series is a recurring calendar event with its cadence, the shared agenda both can add to and the shared notes are those of the meeting, unfinished items carry to the next meeting, action items become tasks, and each side keeps private notes. *(advanced)* |
| **FR-51** | The system MUST suggest agenda items from goals off track, key results without check-in, overdue tasks and feedback received since the last meeting. *(advanced)* |
| **FR-52** | Recognition points stay with `automation-and-notifications`; this feature writes praise there (FR-48) and reads recognitions as evidence (FR-41). |

### 3.10 Review assistant

| ID | Requirement |
| --- | --- |
| **FR-53** | A manager can ask the assistant for a draft summary of a review from its evidence (goals and key result updates, responses, feedback notes, one-to-one shared notes, recognitions, tasks done and tracked time totals in the period), each statement linked to its source. *(advanced)* |
| **FR-54** | The system MUST flag in a draft or a written summary wording that may carry bias (personality rather than behaviour, gendered or age-related words, vague praise without example) with a suggestion, and MUST NOT set or change a rating from an assistant output. *(advanced)* |
| **FR-55** | The system MUST send the assistant only the review's evidence, never other employees' reviews or personal data groups, and keep each draft with the provider and model used. |

### 3.11 Reports and dashboards

All reports are report definitions: filterable, groupable, exportable, schedulable and clonable. Groups under five
reviews are shown as "fewer than 5" outside HR.

| Requirement | Report | Answers | Filters and grouping |
| --- | --- | --- | --- |
| **FR-56** | Review overview | Per review: responses count, average feedback, goal, self and final scores, proposed and final point | organization, cycle, employee, department, position, manager |
| **FR-57** | Score distribution | How final points spread against guidance, per manager and department *(advanced)* | cycle, department, manager |
| **FR-58** | Cycle completion | Steps done and overdue per manager and department | cycle |
| **FR-59** | Goal progress | Goals by level, owner, team, focus area and time frame with progress, state and roll-up | time frame, cycle, level, team |
| **FR-60** | Calibration changes | Points changed, by whom and why | cycle, session |
| **FR-61** | Feedback activity | Feedback notes given and received, one-to-ones held, check-ins done per team and period *(advanced)* | period, team |

| ID | Requirement |
| --- | --- |
| **FR-62** | The system MUST provide charts: score distribution of a cycle (from FR-56), goal progress by team and the performance and potential grid counts. |
| **FR-63** | The system MUST provide cards: reviews created this year, goals in progress, active cycles, reviews overdue. |
| **FR-64** | The existing goal reports page MUST show the goal progress report and the cards when `FEATURE_PERFORMANCE_REVIEWS`, the existing goal report feature and the report builder are on, and stay as it is today otherwise. |

### 3.12 API, agents, setup and compatibility

| ID | Requirement |
| --- | --- |
| **FR-65** | The system MUST expose every action through the REST API and register cycles, reviews, responses, calibration sessions and feedback notes as record types for saved views, global search, custom fields, approval definitions, print templates and automation triggers (one-to-ones are calendar events and meetings of their own features). |
| **FR-66** | The system MUST publish events (cycle launched and released, review step changed, response requested and submitted, calibration change, review acknowledged, goal progress changed by roll-up or metric) on the event outbox for automations, webhooks and real-time updates. |
| **FR-67** | The system MUST offer MCP tools to read cycles, reviews with evidence and goal trees, launch a cycle, nominate and request feedback, submit a response, give feedback, draft a summary and bind a key result to a metric; mutating tools return a preview first and act with the caller's permissions, marked as agent actions. *(advanced)* |
| **FR-68** | The system MUST, when first enabled for an organization, add a five-point scale with bands, three focus areas, six rating criteria, one template, reminder and release email templates and the performance menu group, leaving existing goals unchanged. |
| **FR-69** | The system MUST grant `PERFORMANCE_SELF_SERVICE` to the employee role and `PERFORMANCE_REVIEW_MANAGE` to the manager role, effective only while the feature is on. |
| **FR-70** | The system MUST print a review (summary, scores, development areas) through a print template and export a cycle's results. |
| **FR-71** | The system MUST, with the feature off, load no route, menu entry, goal dialog field or job of the feature and keep its data; existing goal, key result, KPI, template, time frame and setting routes, pages, dialogs and MCP tools stay unchanged in every case. |
| **FR-72** | The system MUST record who, when, before and after for every change of a template, cycle, review score or point, response and calibration decision. |

## 4. Non-Functional Requirements

- **Performance**: cycle launch for 10,000 employees completes in the background within 5 minutes; review page under
  500 ms with 30 responses; goal tree of 5,000 goals first level under 300 ms, lazy below; metric refresh of 10,000 key
  results within 10 minutes; roll-up of one change to its ancestors within 2 s.
- **Data volume and concurrency**: 1 million reviews and 10 million responses per tenant; optimistic versions on
  reviews, responses and cycles (`409`); one launch and one release run per cycle at a time.
- **Reliability**: launch, release and metric refresh are resumable and idempotent per employee and key result;
  failing metric sources never block goal updates.
- **Security & privacy**: reviews visible to the employee (released parts), their manager chain, assigned reviewers
  (their own response), calibrators of the session and holders of `PERFORMANCE_REVIEWS_VIEW`; anonymous responses
  never expose the reviewer to the employee; leaves the platform: reminder and release emails, calendar invitations,
  evidence sent to the tenant's configured AI provider when the assistant is used.
- **Observability and audit**: score history per review, calibration log, launch and release runs, metric refresh log.
- **Accessibility and localization**: rating controls keyboard operable with labelled scale points, grid and charts with
  table alternatives, every string in every shipped locale, right-to-left layouts.
- **Compatibility**: PostgreSQL, MySQL and SQLite; both ORMs; multi-tenant cloud and self-hosted single tenant;
  additive OpenAPI and SDK changes only.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| `Goal`, `KeyResult`, `KeyResultUpdate`, `KPI` (existing) | Goals with weighted key results, progress updates and indicators |
| `GoalPerformance` | A goal's focus area and review cycle |
| `KeyResultRollUp`, `KeyResultMetric` | How a key result takes its progress from aligned goals or from tracked work |
| `FocusArea` | An area of work a template weights and goals belong to |
| `RatingCriterion`, `RatingScale` | What is rated and on which points |
| `ReviewTemplate` | Weighted focus areas, criteria and questions, default per position |
| `ReviewCycle`, `ReviewParticipant` | A review period with its selection, steps and scoring rules; one selected employee |
| `Review` | One employee's review in a cycle with scores and points |
| `ReviewResponse` / rating | A self, manager, peer or upward response and its ratings |
| `CalibrationSession` / change | A meeting that aligns points, and each point change |
| `FeedbackNote`, `FeedbackRequest` | Continuous feedback between colleagues; a request for it |
| One-to-one | A recurring calendar event of a manager and a report; its meetings hold the shared agenda, notes and actions; each side's private notes |
| `DevelopmentArea` | What the employee develops next, with actions and assigned learning |
| `BonusProposal` | A rating-based bonus proposed to payroll after approval |

## 6. Out of Scope

- Recognition points and their ledger: `automation-and-notifications` (read here as evidence).
- Skill proficiencies on the employee and position required skills: `hr-core-lifecycle` (written to through its port);
  courses and learning paths: `learning-management`; incentives and paying them: `payroll-processing`.
- The approval engine: `approval-workflows`; report engine: `report-builder-and-dashboards`; saved views and boards:
  `record-views-and-search`; calendar events: `calendar-and-scheduling`; meeting agendas and shared notes: `meetings`;
  the formula language: `custom-fields-and-forms`; agent definitions and cost limits: `ai-agents-and-assistants`;
  print templates: `print-and-pdf-designer`.
- Probation reviews of newcomers: `hr-core-lifecycle` (it may use a review template of this feature).

## 7. Acceptance Criteria

- [ ] **AC-1** Templates refuse weights not totalling 100; positions default a template; reviews keep a copy (FR-5–FR-8).
- [ ] **AC-2** A cycle launch for a seeded organization creates one review per selected employee in the background,
      lists people without a template, excludes agents and leavers, and refuses a duplicate review (FR-20–FR-22).
- [ ] **AC-3** A key result update moves its goal, the aligned parent goal through roll-up and the review's focus area
      score in real time; an alignment cycle is saved as today and left out of roll-up, and refused only with strict
      alignment on (FR-10, FR-14, FR-18).
- [ ] **AC-4** A key result bound to tracked hours and one bound to deals won move on approved time and won deals
      without manual updates; a missing source keeps the last value (advanced, metrics) (FR-15).
- [ ] **AC-5** Self review, nominations, peer and manager responses run with their guards; anonymous peer comments stay
      hidden below the minimum answers (FR-29, FR-30).
- [ ] **AC-6** Scores agree with golden figures for automatic and manual goal scoring, kind weights and a custom
      formula; an invalid formula is refused on save (FR-35, FR-36).
- [ ] **AC-7** A calibration session shows distribution and grid, logs a changed point with reason and warns on
      deviation (advanced, calibration) (FR-42, FR-44).
- [ ] **AC-8** Feedback notes and one-to-one shared notes appear as evidence; carried-over items and action tasks work
      (advanced, continuous feedback) (FR-49, FR-50).
- [ ] **AC-9** The assistant draft links each statement to a source, flags seeded biased wording and changes no point
      (advanced, assistant) (FR-53, FR-54).
- [ ] **AC-10** Release notifies, acknowledgement records, competency ratings reach the skill proficiencies, an
      assigned learning path shows progress, and an approved bonus proposal becomes a payroll incentive (FR-39, FR-45, FR-46).
- [ ] **AC-11** The six reports, charts and cards return figures that agree with seeded data; the goal reports page
      shows the report with the feature on and stays the existing goal reports page with it off (FR-62–FR-64).
- [ ] **AC-12** Denial answers `403`; concurrent edits `409`; closed cycles refuse new data (FR-22, FR-23, FR-26).
- [ ] **AC-13** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-71).
- [ ] Works on PostgreSQL, MySQL and SQLite with both ORMs.
- [ ] Behind `FEATURE_PERFORMANCE_REVIEWS`; nothing changes while the flag is off; existing goal pages unchanged.
- [ ] All functional requirements have a passing test.

## 8. Open Questions

- Peer feedback is anonymous by default with a minimum of 3 answers (applied); some organizations prefer named feedback.
- Calibration keeps computed scores and changes only the final point (applied).
- Bonus proposals are off unless a cycle defines a matrix (applied); merit pay changes to base pay are left to
  `payroll-setup` assignments.
- Goal alignment across cycles or focus areas is allowed by default (applied); strict matching is an organization setting.
- The review assistant is off until an organization switches it on and names an AI provider (applied).

## 9. Constitution Gates

- [x] I Plugin-first — new plugin `performance-reviews` with its UI plugin; core goal modules extended through plugin
      tables and two goal dialog slots.
- [x] II Tenant/organization scoping — every record scoped; reviewer access by assignment and reporting line.
- [x] III Both ORMs, additive migrations — new tables only, three dialects.
- [x] IV Default-off flag; nothing removed — `FEATURE_PERFORMANCE_REVIEWS`; goal routes, pages, tools and the existing goal reports page kept.
- [x] V Contracts and API first; backwards compatible — contracts and REST before UI; additive OpenAPI.
- [x] VI Permissions, privacy, security — seven keys; anonymity thresholds; formula without tenant code.
- [x] VII Real-time through the event bus — outbox events; goals and reviews update live.
- [x] VIII i18n and accessibility — every string a key in all locales; accessible rating controls and charts.
- [x] IX Tests accompany the change — weights, roll-up, metrics, scoring goldens, guards, calibration, release.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Related features: [`hr-core-lifecycle`](../hr-core-lifecycle/spec.md), [`automation-and-notifications`](../automation-and-notifications/spec.md),
  [`approval-workflows`](../approval-workflows/spec.md), [`payroll-processing`](../payroll-processing/spec.md),
  [`report-builder-and-dashboards`](../report-builder-and-dashboards/spec.md), [`custom-fields-and-forms`](../custom-fields-and-forms/spec.md),
  [`record-views-and-search`](../record-views-and-search/spec.md), [`learning-management`](../learning-management/spec.md),
  [`calendar-and-scheduling`](../calendar-and-scheduling/spec.md), [`meetings`](../meetings/spec.md)
- Existing code (`packages/core/src/lib/`): `goal`, `keyresult`, `keyresult-update` (`keyresult-progress.ts`), `goal-kpi`,
  `goal-template`, `keyresult-template`, `goal-time-frame`, `goal-general-setting`, `organization-strategic-initiative`;
  UI `apps/gauzy/src/app/pages/goals`, `goal-settings`; MCP `packages/mcp-server/src/lib/tools/goals.ts`, `key-results.ts`
- Related architecture: [platform architecture](../../architecture/business-suite.md) §2.5 (performance), §3.8 (reports), §3.9 (automation), §3.12 (AI and MCP)
