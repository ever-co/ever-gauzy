# Feature Specification: Approval workflows

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `approval-workflows`
**Branch**: `feat/approval-workflows`
**Status**: `Draft`
**Created**: 2026-11-16
**Last updated**: 2026-11-23
**Owner**: evereq
**Feature flag**: `FEATURE_WORKFLOWS` (tenant feature, default off) · the plugin loads only when `GAUZY_WORKFLOWS_ENABLED`
is exactly `true` · the existing `FEATURE_EMPLOYEE_APPROVAL` and `FEATURE_EMPLOYEE_APPROVAL_POLICY` keep gating their pages

---

## 1. Overview

Today an approval is a one-step request of one of five fixed types (time off, equipment sharing, business trip,
purchase order, sales order) or a free-form "ask N people" request: named approvers and teams, a minimum count, nobody
approving their own request, administrators deciding finally. A policy is only a label and a type; purchase and sales
orders keep their approval inside their plugins; tasks, deals and orders keep their own status models and most other
modules hard-code their statuses. This feature adds **one
engine** for every record type. A **workflow definition** gives a record type **states**, **transitions** and
**conditions**; **approval steps** run in sequence or in parallel (all, any, N of M) with approvers resolved from roles,
the reporting line, HR approver lists, named people, teams, record fields, amount bands, value-based **approval rules**
or an agent. Open approvals land in the Inbox's Decisions tab and an approvals queue, with **delegation**, **reminders**,
**service-level timers** and **escalation**; every decision is audited. Today's fixed approvals ship as **default
definitions** that behave exactly as now, and every plugin asks for approvals through one gateway. Clients: the Angular
app (installable on phones and desktops), email and chat, the API and SDKs, the MCP server.

**Advanced capabilities.** A visual designer **simulates** what will happen to a real record, with "what if"
values. Definitions are **versioned** and publishing moves in-flight records safely by a state mapping the administrator
previews. Approvers decide in **one tap** from the inbox, email, chat, push or the phone, offline included. An **agent
can be an approver within explicit limits**, or an **adviser** that summarises the record and its risk for the person
who decides. Step timers count **working hours**, remind, escalate and can act; approvers on approved time off are
**delegated automatically**. Segregation of duties goes beyond "not the requester", and an approval that a later change
outgrows is **invalidated and re-routed**. Marked `(advanced)`.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** an administrator with `WORKFLOWS_MANAGE`, **when** they draw for purchase orders "Draft → Manager approval
  (reporting line, any) → Finance (finance role, 2 of 3) in parallel with Budget owner (record field) when the total
  exceeds 10,000 → Approved → Confirmed" and simulate it on order PO-123, **then** they see the path, each approver and
  the rule that chose them, and the due dates; on publication new orders follow it.
- **Given** the default time-off definition, **when** an employee requests leave, **then** it behaves as today; **when**
  the administrator adds an "HR" step after the team managers, **then** the next request needs both, the Approvals page
  shows it "Requested" until the last step, and the time-off request moves only then.
- **Given** an approver with an open task, **when** they tap "Approve" in the Inbox Decisions tab, on their phone in the
  installed web app, from the signed link in the email or on the chat card, **then** the decision is recorded with its channel, the
  next step starts within seconds, and the requester is told.
- **Given** an approver with approved time off next week, **when** a task reaches them during it, **then** it goes to
  their delegate, decided "on behalf of" them, and returns after the leave.
- **Given** a step due in 8 working hours, **when** half the time passes, **then** the approver is reminded; **when** it
  is due, **then** it escalates to their manager, and after two escalations to the fallback approvers.
- **Given** an agent approver limited to expense claims under 200 with a receipt and within policy, **when** a claim of
  120 arrives, **then** the agent approves with its reasoning; **when** one of 900 arrives, **then** it hands the task to
  the human approvers with a summary, risk flags and similar past claims.
- **Given** an approval rule "sales orders with an average discount above 15 % by a salesperson need a sales manager",
  **when** a salesperson confirms such an order, **then** the confirmation is refused naming who may approve, and
  "Request approval" starts it.
- **Given** 40 orders in flight on version 1, **when** version 2 is published, **then** the administrator sees them by
  state, maps old states to new ones, and keeps them on version 1 or moves them; each move is in the record's history.
- **Given** a plugin (budgets, ledger, procurement, HR) asking for an approval through the gateway, **when** it is
  decided, **then** the plugin receives the outcome event and acts; the request is listed on the Approvals page.
- **Given** a custom record type "Vehicle" with the lifecycle Available → In service → Retired, **when** a fleet manager
  performs "Retire", **then** the state field shows Retired in lists, filters and boards, and only fleet managers may edit
  a retired vehicle.

### 2.2 Edge cases & failures

- **Given** a user who is not an assignee, or the requester listed in an approver team, **when** they decide, **then**
  they are refused (`403`); an administrator override needs a reason and is shown as an override.
- **Given** two approvers of an "any one" step deciding at once, **then** the first decision counts, the second is told
  "already decided", and both inbox items close.
- **Given** an approved order whose total then grows 12 % beyond the approved band, **then** the approval is invalidated
  and re-routed from the first step whose band applies; an approval not used within its validity lapses.
- **Given** no approver resolvable (the manager left, an empty role), **then** the step goes to the fallback approvers or
  the organization's administrators and is flagged; nothing is approved automatically.
- **Given** a published version, **when** someone edits it, **then** it is refused and a new draft version is offered;
  two active definitions of equal priority that can match the same record are refused on activation, naming both.
- **Given** a signed email link used after the task was decided, reassigned or the record changed, **then** the page says
  it is no longer valid and nothing is decided; an expired link asks the approver to sign in.
- **Given** a decision taken offline on a phone, **when** it syncs after the record changed, **then** it is refused with
  the changes shown and the approver decides again.
- **Given** a governed record deleted or cancelled, **then** its instance is cancelled and open tasks are resolved.
- **Given** a bulk approval of 30 tasks of which 3 need a comment, **then** 27 are decided and 3 listed with the reason.
- **Given** a document confirmation that fails its checks after the last approval, **then** the record stays in the
  previous state with the findings, and the approvers are not asked again.
- **Given** `FEATURE_WORKFLOWS` off, **then** every workflow route answers `404` and approvals work exactly as today; with
  the Inbox off, tasks still reach the approvals queue, email and push.

## 3. Functional Requirements

### 3.1 Scope, flags and compatibility

- **FR-1** The system loads only when `GAUZY_WORKFLOWS_ENABLED` is exactly `true`, gates every route, GraphQL field, menu
  entry and MCP tool with `FEATURE_WORKFLOWS`, and with the feature off answers `404`, approvals unchanged.
- **FR-2** The system keeps every request approval and approval policy route, GraphQL field, status, permission and page
  with unchanged contracts; one person counts once, nobody approves their own request, and administrators may decide
  finally remain the defaults.
- **FR-3** The system only adds: a request type for engine-created requests, new routes, events and fields.

### 3.2 Definitions, states, transitions, conditions

- **FR-4** A user with `WORKFLOWS_MANAGE` can create a definition for a registered record type (custom ones included), a
  request type (any, including those other features add) or an approval policy: name, kind (approval or lifecycle;
  lifecycle is not offered for tasks, deals and orders, which keep their own status models), organizations (all or
  listed), priority and start conditions.
- **FR-5** A user with `WORKFLOWS_MANAGE` can give a state a key, labels per language, a colour, a category (open, in
  progress, approved, rejected, done, cancelled), a document lifecycle (draft, confirmed, cancelled), editors and
  editable fields, an entry message, field updates and notifications on entry, and a final flag.
- **FR-6** A user with `WORKFLOWS_MANAGE` can give a transition source states, a target, a label, who may perform it
  (roles, permissions, owner, requester, step approvers), conditions, required inputs (a transition form, a comment) and
  a confirmation; several transitions may join the same states.
- **FR-7** The system evaluates conditions with the platform's condition builder and formula language over the record's
  fields, referenced records (two hops), the requester and actor (roles, department, position, organization, person or
  agent), amounts in organization currency and dates, with the same verdict in preview and on the server.
- **FR-8** The system lets a transition set fields and create a related record inside its transaction (all or nothing),
  and after commit start an automation flow, call a webhook, notify or post to chat; an after-commit failure is shown
  on the instance and retried, never undoing the transition.
- **FR-9** The system refuses publishing a definition with an unreachable state, a state without a path to a final
  state, a transition out of a final state other than an explicit reopen, a lifecycle move the document engine forbids
  (confirmed back to draft, anything after cancelled), or an invalid condition, naming each problem.
- **FR-10** The system lets several active definitions share a record type: the highest-priority one whose start
  conditions match governs; activation is refused when two of equal priority can match the same record or when a second
  condition-free one exists for the type and organization, naming them; a record matching none is ungoverned.

### 3.3 Governing records

- **FR-11** The system starts a lifecycle definition when a record is created, first meets its start conditions or is
  submitted, and an approval definition on "Request approval", a transition into an approval state, the gateway, the
  document engine's confirmation check, or a new request approval of its type or policy.
- **FR-12** The system keeps at most one running instance per record and definition and shows its state as a read-only
  "Workflow state" field in API reads, lists, filters, saved views, boards and reports.
- **FR-13** The system changes the state of custom records under a lifecycle definition only through transitions
  (direct changes `409`); a standard record changed through its own existing route moves its instance to the mapped
  state or completes it, recorded as "decided outside the workflow" by that user.
- **FR-14** The system lets only a state's editors edit the record, and only its editable fields, refusing others with
  `403` naming the state; the engine, system actors and transition field updates are exempt.
- **FR-15** The system confirms a document through the document engine (checks and effects included) when it enters a
  state mapped to confirmed and cancels it on cancelled; a refused confirmation keeps the previous state and findings.
- **FR-16** The system cancels the instance and resolves open tasks of a governed record cancelled, deleted or archived.

### 3.4 Approval steps and approvers

- **FR-17** A user with `WORKFLOWS_MANAGE` can put steps in sequence or parallel groups in an approval state, each with
  approvers, a rule (all, any one, N of M, a share), a skip condition, a due time, reminders, escalation, the allowed
  decisions (approve, reject, return for changes, custom labels) and when a comment is required (reject by default).
- **FR-18** The system resolves approvers from: named users or employees; a role; a team (members or managers); the
  reporting line (direct manager, N levels, or up until an approval limit covers the amount); the requester's HR approver
  for a kind; a person or team field of the record; amount bands (up to an amount → a source); approval rules; an agent.
- **FR-19** The system resolves approvers when the step starts and keeps each with the source that chose it; never the
  requester, the people the record is for, or someone whose work ended; one person counts once across sources.
- **FR-20** The system sends a step with no resolvable approver to the definition's fallback approvers, else to the
  organization's administrators, and flags the instance; it never approves automatically for lack of approvers.
- **FR-21** The system approves a step when its rule is met, rejects it on a rejection or when the rule can no longer be
  met, and returns it on "return for changes" (record back to its editable state, requester told; resubmission
  restarts the step or the instance as defined).
- **FR-22** The system completes a parallel group when every branch approves; a rejection cancels the other branches.
- **FR-23** The system keeps an approval valid only within the definition's limits (amount growth or band, listed
  fields unchanged, N days without completion); beyond them it invalidates the approval and re-routes it from the first
  step whose band applies, telling the approvers. `(advanced)`

### 3.5 Decisions and segregation of duties

- **FR-24** The system lets only a task's assignee or their delegate decide it, and, where the definition allows override
  (on in default definitions), a tenant administrator with a reason, shown as an override.
- **FR-25** The system never lets the requester, the record's creator or the people it is for decide its steps, unless
  a step explicitly allows the requester and is not resolved from amount bands or approval rules.
- **FR-26** A user with `WORKFLOWS_MANAGE` can require that one person decides at most one step of an instance, that
  nobody who changed the amount approves it, and that approvers sit outside the requester's team. `(advanced)`
- **FR-27** The system records with every decision who, when, decision, comment, channel, the record version and the
  facts shown; decisions are immutable; a decision on a record changed since the approver opened it is refused with the
  changes shown.
- **FR-28** The system serialises decisions on one step; a later decision answers "already decided" and its inbox items
  close.
- **FR-29** The system lets the requester withdraw a running approval before its final decision, resolving its tasks.
- **FR-30** The system lets participants comment on an instance; comments reach the timeline and the other participants.

### 3.6 Value-based approval rules

- **FR-31** A user with `APPROVAL_RULES_MANAGE` can define approval rules per record type, for one organization or all:
  basis (total, average discount, highest line discount, discount on an item or item group, total per customer or
  supplier, any numeric field or formula), applies to (everyone, role, user, employee, position, department), threshold
  and currency, action (require approval or refuse) and approver (role, user, reporting line, HR approver); for sales
  orders the buyer's approval threshold and the organization's order approval amount count as rules only once a user
  with `APPROVAL_RULES_MANAGE` switches "Use buyer and order approval thresholds" on for the organization (off by
  default, so enabling the feature refuses no confirmation that is accepted today); the buyer's spending limits keep
  refusing as they do today.
- **FR-32** The system refuses a duplicate rule, an approver equal to the user or role the rule applies to, a discount
  outside 0 to 100, and an item, group or party that does not exist; organization rules win over tenant-wide ones.
- **FR-33** The system checks the rules when a record is confirmed or submitted by the acting user: when approval is
  required and none valid exists, it refuses with `WORKFLOW_APPROVAL_REQUIRED` naming who may approve and offering
  "Request approval"; a refusing rule refuses with its reason.
- **FR-34** A user with `APPROVAL_RULES_MANAGE` can give a role or person an approval limit per record type; the system
  shows rules and limits as one authority matrix per record type.

### 3.7 Inbox, queue and channels

- **FR-35** The system puts every open task in the assignee's Inbox Decisions tab (when the Inbox is on) with title,
  record link, the definition's facts, the adviser summary, due time, priority and one button per allowed decision;
  replying decides the task.
- **FR-36** The system lists on the existing Approvals page my tasks, delegated tasks and requests, and for a user with
  `WORKFLOW_INSTANCES_ADMIN` every running instance, with filters (record type, definition, age, due, overdue, amount),
  search, counts and bulk decisions, with or without the Inbox.
- **FR-37** The system can email a new task with its facts and one signed link per decision, opening a confirmation
  page without sign-in that asks for an optional comment; links are single-use, expire (default 72 hours) and are void
  once the task is decided or reassigned or the record changes.
- **FR-38** The system shows tasks on phones in the installable web app with the same facts and one-tap decisions,
  announces tasks and reminders by web and mobile push through the Inbox channels, and verifies offline decisions on
  sync. `(advanced)`
- **FR-39** The system can post a task to the assignee's direct chat conversation as a card with decision buttons,
  recorded with the channel chat, where `FEATURE_CHAT_RECORD_CARDS` of `chat-agents-and-record-actions` is on. `(advanced)`
- **FR-40** The system lets REST, GraphQL and MCP clients list their tasks, decide (with `preview`), comment, delegate,
  request an approval and read an instance's history.
- **FR-41** The system lets a user decide up to 500 tasks of one definition at once, skipping with the reason tasks
  needing a comment or not theirs, with results per task, in the background above 50.
- **FR-42** The system tells the requester each step's and the final outcome through their Inbox preferences.

### 3.8 Delegation, reminders, service levels, escalation

- **FR-43** The system lets a user delegate their approvals to another person for a period, for all or some
  definitions, with a reason; the delegate decides "on behalf of" them under the same segregation rules; a user with
  `WORKFLOW_DELEGATIONS_MANAGE` sets delegations for others.
- **FR-44** The system sends an approver's open and new tasks to their delegate (named, else HR approver, else manager)
  while they have approved time off, and returns them after. `(advanced)`
- **FR-45** A user with `WORKFLOW_INSTANCES_ADMIN` can reassign open tasks, one or in bulk (all of a person who left),
  with a reason.
- **FR-46** The system counts a step's due time in the organization's working hours and holidays (its working calendar,
  else its own start and end times and the official holidays of its country; default two working days), reminds at set points (default 50 % and 100 %), and at the due time escalates (tell the next manager, add an
  approver, reassign, or decide where the definition allows: reject, or approve below an amount) up to a set number of
  levels. `(advanced)`
- **FR-47** The system shows overdue tasks with their delay and records service-level results per step.

### 3.9 Existing approvals and the approval gateway

- **FR-48** The system ships default definitions that reproduce today's approvals: time off, equipment sharing, business
  trip, purchase order, sales order and free-form request, each one step with the request's named employees and teams,
  its minimum count, administrator override on and self-approval off; enabling the feature changes nothing observable.
- **FR-49** The system governs request approvals created by existing flows by the active definition of their type or
  policy; their approve and refuse routes record the caller's decision on their task; the request's status changes only
  when the instance completes, and the linked time-off request or equipment sharing then moves as today.
- **FR-50** The system completes the instance as "decided outside the workflow" when a record's own route decides it
  (time-off approve or deny, order approve, purchase order approve), naming that user.
- **FR-51** A user with `APPROVAL_POLICY_EDIT` (existing) can bind a policy to a definition; a free-form request without a
  policy gets the policy whose existing routing conditions match it.
- **FR-52** The system finishes request approvals created before the feature was on, or before their definition was
  active, under the rules they started with.
- **FR-53** The system lets any plugin ask for an approval through the gateway (record type and id, title, amount and
  currency, facts, requester, idempotency key), read its status, withdraw or invalidate it, and receive the outcome as
  an event; the request shows on the Approvals page.
- **FR-54** The system applies the record type's active definition to a gateway request, else one step decided by any
  holder of the type's approve permission; it never approves automatically.
- **FR-68** The system lets any plugin register, per request type, what happens to its own record when a core request
  approval of that type is approved or refused (the "settler"), applied on the decision's transaction and the same
  whether the decision comes from the Approvals page, an approver's route or a completed workflow; it works with the
  workflows feature off, time off and equipment sharing keep their existing settlement, and a type has at most one
  settler.

### 3.10 Designer, simulation, versions

- **FR-55** A user with `WORKFLOWS_MANAGE` can edit a definition on a canvas (states as boxes, transitions as arrows,
  steps inside approval states, a properties panel, auto layout), in a keyboard list editor, or as a definition file.
- **FR-56** A user with `WORKFLOWS_VIEW` can simulate a definition on a record or sample values: governing definition,
  path, conditions with their results, approvers with their source, due dates, and "what if" changes; nothing is written
  or sent. `(advanced)`
- **FR-57** A user with `WORKFLOWS_PUBLISH` can publish a new version (published ones are immutable), seeing in-flight
  instances by state with an old-to-new mapping, and keep them on their version (default) or move them at the mapped
  state, recorded per instance; returning to an earlier version is a new publication. `(advanced)`
- **FR-58** The system offers templates to start from: two-level purchase approval by amount, expense claim with manager
  and finance, leave with manager and HR, document change approval, contract review.

### 3.11 Agents

- **FR-59** A user with `WORKFLOWS_MANAGE` can make an agent an approver with explicit limits (record types, maximum
  amount, conditions, decisions per day, allowed decisions); outside them or when unsure it hands the task to the step's
  human fallback; each agent decision keeps its reasoning and facts for review. `(advanced)`
- **FR-60** A user with `WORKFLOWS_MANAGE` can ask an agent to advise a step's human approvers (record summary, similar
  past approvals, policy checks, risk flags) in the inbox, queue and email; it never decides. `(advanced)`
- **FR-61** The system can require approval for records an agent created ("actor is an agent"), never lets an agent
  approve its own request or record, and runs agents through MCP with their own permissions.
- **FR-62** The system sends agent steps to their human fallback, without summaries, when no agent runtime exists.

### 3.12 Record UI, audit and real time

- **FR-63** The system shows on a governed record its state badge, the transitions the user may perform now, the
  approval progress (steps, approvers, decisions, due dates) and the history; each move is a timeline entry.
- **FR-64** The system shows and filters lists and boards of a record type by workflow state, counts per state, and
  offers "awaiting my approval".
- **FR-65** The system keeps an append-only history per instance (start, transitions, tasks, decisions, delegations,
  reminders, escalations, migrations, comments) with actor type (person, system, agent) and channel, exportable, and
  audits definition and rule changes.
- **FR-66** The system pushes tasks, decisions and state changes to open records, queues and inbox counts through the
  real-time channel within two seconds.

### 3.13 Reports

- **FR-67** The system registers these report definitions in the Reports menu of tenants with `FEATURE_WORKFLOWS` on
  (with it off the Reports page and menu show exactly today's reports):

  | Report | Answers |
  |---|---|
  | Approval cycle time | per definition, step and approver: median and 90th percentile time to decide |
  | Pending approvals | open tasks by approver, age, due date and amount |
  | Service levels | on time, reminded, escalated, auto-decided, per step and period |
  | Decision log | every decision with channel, comment, override and delegation |
  | Approver load | open tasks and delegations per approver and team |
  | Rejections and returns | reasons by definition, step and requester |
  | Authority matrix | approval rules and limits per record type and organization |

## 4. Non-Functional Requirements

- **Performance**: a decision answers under 300 ms P95; the next step's tasks and inbox items exist within 2 s of the
  commit; the queue lists under 200 ms P95 at 100,000 open tasks per tenant; a simulation of a 30-state definition under
  1 s; the service-level sweep handles 100,000 open tasks in under 60 s; reminders fire within 5 minutes of their point.
- **Volume and concurrency**: 1,000 instances started per minute per tenant; decisions on one step serialised; one
  running instance per record and definition guaranteed by the database on every dialect.
- **Reliability**: outcomes and after-commit actions delivered at least once through the event outbox and deduplicated;
  timers survive restarts; a single-container deployment runs timers in process.
- **Security & privacy**: signed links carry no personal data, are single-use and hashed at rest; approvers see only the
  facts the definition exposes unless they may view the record; emails, push and chat cards carry title, amount and
  link; agent decisions are marked.
- **Auditability**: who, when, before and after for every definition, rule, delegation and decision.
- **Accessibility and localisation**: the designer has a keyboard list editor; decision controls are labelled; states,
  transitions and emails per language; due times in the approver's time zone.
- **Compatibility**: PostgreSQL, MySQL, SQLite; both ORMs; cloud and self-hosted alike; OpenAPI additive; SDKs regenerated.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| Workflow definition, version | States and transitions for a record type, request type or policy; an immutable publication |
| State, transition | Where a record is in its workflow; a permitted move between states with conditions and actions |
| Approval step | A unit of approval inside a state, with approvers, a rule, a due time and escalation |
| Workflow instance | One record's run through one definition version |
| Approval task | One approver's part in one step, with its decision |
| Delegation | A period in which one person's approvals go to another |
| Approval rule, approval limit | Value-based authority to confirm or approve per record type |
| Action link | A signed, single-use link to decide a task from an email |
| Approval gateway | The single way a plugin asks for and follows an approval |
| Instance history | The append-only account of everything that happened to an instance |

## 6. Out of Scope

- Draft, confirm, cancel and amend of documents, background confirmation queues: `business-document-engine` (this
  engine drives them through FR-15 and checks them through FR-33).
- Automation flows run by transitions and escalations, notification preferences: `automation-and-notifications`.
- Fields, transition forms and the state field's storage: `custom-fields-and-forms`.
- Reporting lines and HR approver lists: `hr-core-lifecycle`; working calendars and holidays: `time-off-management`.
- Each domain's own approval content (budget control, credit holds, change requests, expense claims, timesheets):
  their specs, through the gateway.
- Agent runtime, models and costs: `ai-agents-and-assistants`; chat cards' transport: `chat-agents-and-record-actions`.

## 7. Acceptance Criteria

- [ ] **AC-1** A two-step purchase order definition with a parallel finance group runs end to end; confirmation follows
      the final approval through the document engine (FR-22, FR-50).
- [ ] **AC-2** With the feature on and default definitions untouched, every existing approval route and page answers
      exactly as before (contract test suite); an added HR step on time off holds the leave until it approves (FR-2, FR-48).
- [ ] **AC-3** Self-approval, administrator override, one person counting once and concurrent decisions behave as stated (FR-24, FR-25).
- [ ] **AC-4** An approval rule refuses a confirmation naming who may approve; "Request approval" starts the instance (FR-31, FR-33).
- [ ] **AC-5** A lifecycle definition on a custom record type shows its state in lists and boards and locks edits by state (FR-12–FR-14, FR-64).
- [ ] **AC-6** A gateway request from another plugin is decided and its outcome event delivered once (FR-53).
- [ ] **AC-7** Inbox Decisions, the queue, a signed email link, push and bulk decisions each decide a task; a used or
      stale link decides nothing (advanced: one-tap channels; FR-35–FR-38).
- [ ] **AC-8** Delegation, automatic delegation during approved time off, reminders and working-hour escalation fire as
      stated (advanced: timers and delegation; FR-43, FR-44, FR-46, FR-47).
- [ ] **AC-9** Simulation writes and sends nothing; publishing a version moves in-flight instances by the chosen mapping
      (advanced: designer and versions; FR-56, FR-57).
- [ ] **AC-10** An agent approves within its limits and hands over outside them; adviser summaries appear for people
      (advanced: agents; FR-59, FR-60, FR-62).
- [ ] **AC-11** Segregation rules and re-approval on a grown amount hold (advanced: controls; FR-25, FR-26).
- [ ] **AC-12** The seven reports of FR-67 return correct figures on seeded data.
- [ ] **AC-13** With `FEATURE_WORKFLOWS` off every workflow route answers `404`; with `GAUZY_WORKFLOWS_ENABLED` not `true`
      nothing loads; the §4 budgets hold.
- [ ] Works on PostgreSQL, MySQL and SQLite with both ORMs; all functional requirements have a passing test.
- [ ] **AC-14** With the feature on and "Use buyer and order approval thresholds" off (the default), a B2B order above
      its buyer's approval threshold or the organization's order approval amount confirms exactly as before (FR-31,
      FR-48).
- [ ] **AC-15** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-1, FR-2).

## 8. Open Questions

- Purchase and sales order default definitions settle the request only; moving the order on approval is added by
  `procurement` and `sales-order-management` through the outcome event. Default applied.
- Automatic decisions at escalation are off in every default definition and allowed only for reject or below an amount.
  Default applied.
- Signed email links decide without sign-in for 72 hours; tenants can require sign-in. Default applied.
- An agent approver is off until the tenant enables agents and sets limits. Default applied.

## 9. Constitution Gates

- [x] I Plugin-first — new plugin pair `workflows`; core gets an optional router port in request approvals and small shared helpers.
- [x] II Tenant/organization scoping — definitions, instances, tasks, rules and delegations carry tenant and organization.
- [x] III Both ORMs, additive migrations — new tables on every dialect; one enum value added.
- [x] IV Default-off flag; nothing removed — tenant feature plus deploy switch; default definitions keep today's behaviour.
- [x] V Contracts and API first — REST, GraphQL, gateway contract, events, SDKs.
- [x] VI Permissions, privacy, security — seven permissions, signed single-use links, segregation of duties, audit.
- [x] VII Real-time through the event bus — outbox events, real-time channel, Inbox items.
- [x] VIII i18n and accessibility — labels per language, keyboard designer, labelled decisions.
- [x] IX Tests accompany the change — engine units, contract suite for existing approvals, dialect and e2e specs.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Works with: [`business-document-engine`](../business-document-engine/spec.md),
  [`custom-fields-and-forms`](../custom-fields-and-forms/spec.md), [`hr-core-lifecycle`](../hr-core-lifecycle/spec.md),
  [`procurement`](../procurement/spec.md), [`budgets-and-revenue-schedules`](../budgets-and-revenue-schedules/spec.md)
- Code: `docs/specs/features/inbox/`, `packages/core/src/lib/request-approval/`, `packages/core/src/lib/approval-policy/`
