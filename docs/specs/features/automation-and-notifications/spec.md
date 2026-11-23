# Feature Specification: Automation and notifications

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `automation-and-notifications`
**Branch**: `feat/automation-and-notifications`
**Status**: `Draft`
**Created**: 2026-11-16
**Last updated**: 2026-11-23
**Owner**: platform maintainers
**Feature flag**: `FEATURE_AUTOMATIONS` (tenant feature, default off) · the generalized engine loads only when
`GAUZY_AUTOMATIONS_ENABLED` is exactly `true` · task rules keep `GAUZY_TASK_AUTOMATIONS_ENABLED`; email and push
delivery keep the Inbox switches

---

## 1. Overview

Today the platform has task rules (tasks only, behind a deploy switch), a rule kernel used by commerce, outbound webhook
subscriptions without a screen, in-app notifications of fixed types with per-person email, push, quiet-hours and digest
settings, the Inbox with email and push delivery, and reminders for due tasks, running timers and meetings. This feature
makes the task rule engine the platform's **one automation engine for every registered record type**. A **flow** is a
trigger (record event, schedule, a date on the record, an incoming message, an incoming webhook, a manual start or
another engine) followed by conditions and steps (actions, waits, branches), with trial runs, versions and run history.
Around it: **assignment rules** and **record assignments** on any record, **reminders**, **follow and summary digests**,
**user-defined notifications** with categories, **one preference model** across in-app, email, push, chat, text message
and named destinations, and recognition between colleagues. Clients: the Angular app, the MCP server and the SDKs.

**Advanced capabilities.** A flow described in plain language becomes a reviewable draft; an **agent step**
runs an assistant with chosen tools and a hard budget; a draft is **simulated against past records** before it is
switched on; **storm protection** holds a flood of events and asks the owner, next to per-flow limits and a kill switch;
every run has a **step timeline with replay from the failed step**; notifications are **bundled** and respect
**per-person quiet hours**; assignment reads **time off, working hours, skills and tracked-time load**. Marked
`(advanced)`.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** an administrator with `AUTOMATION_FLOW_EDIT`, **when** they build "Large expense" (trigger: expense created;
  condition: amount over 1,000; steps: request approval, wait up to two days for the decision, notify the submitter, else
  notify finance), trial it on an expense and publish it, **then** the trial writes nothing and the next qualifying
  expense starts a run whose step timeline shows on the flow and on the expense.
- **Given** a flow "every Monday 08:00, for each invoice of the saved view 'Overdue over 30 days', assign the account
  owner", **when** Monday 08:00 passes, **then** one run per invoice starts within a minute, never twice for that Monday.
- **Given** "Remind before a date" on contract end dates with offsets of 30 and 7 days, **when** an end date is 30 days
  away, **then** the owner and HR get one reminder each on their channels; a moved date re-arms the reminders.
- **Given** an assignment rule "new leads in turn among the sales team, skipping people on time off", **when** three leads
  arrive and one member is on approved leave, **then** the two others alternate, each decision says who was skipped and
  why, and each assignee is notified.
- **Given** a person with push only for "Invoice alerts", weekday quiet hours 20:00–08:00 and 15-minute bundling, **when**
  12 alerts arrive at 22:00, **then** the in-app entries appear at once and one push for 12 alerts arrives at 08:00.
- **Given** a manager who types "tell the project manager when a task of project Website is two days overdue", **when**
  the assistant answers, **then** a draft opens in the designer with the defaults it chose, and a simulation over 30 days
  reports 14 runs and 0.4 notices per person per day before anyone publishes it. `(advanced)`
- **Given** a run that failed at "Call webhook" on a timeout, **when** the owner fixes the address and replays from that
  step, **then** earlier steps are not repeated and the replay links to the original. `(advanced)`

### 2.2 Edge cases & failures

- **Given** flows that trigger each other in a circle, **then** the chain stops at its depth limit and the held run is
  recorded "loop guard"; ten failures in a row pause a flow and tell its owner and the automation administrators.
- **Given** an import changing 50,000 contacts, **then** the flow's new events are held, the flow pauses and the owner
  chooses process, sample first or discard. `(advanced)`
- **Given** the kill switch turned on, **then** no run starts, running runs halt at the next step and waits hold; turning it
  off offers to process or discard the events received meanwhile.
- **Given** a flow whose owner lost the permission to edit invoices, **then** its invoice step fails "run-as lacks
  permission"; publishing such a flow is refused naming the step.
- **Given** a waiting run whose record is deleted, **then** it is cancelled "record gone"; publishing a new version leaves
  running and waiting runs on theirs; a redelivered event or a repeated schedule firing runs each flow once.
- **Given** an incoming webhook call with a bad signature, a body over 1 MB or a delivery id already seen, **then** it is
  refused and nothing runs.
- **Given** an agent step reaching its budget or calling a tool outside its set, **then** the step stops ("budget
  exceeded" or "tool refused") and the agent writes nothing more. `(advanced)`
- **Given** an assignment rule with nobody qualifying, **then** the record stays unassigned and the rule owner is told.
- **Given** a digest recipient who may not see a card, **then** the card is left out for them; a failing recipient is
  logged and the others still receive theirs.
- **Given** a mandatory category, **when** a person tries to mute it, **then** in-app and one outside channel stay on.
- **Given** `FEATURE_AUTOMATIONS` off, **then** new routes answer `404` and task rules, reminders and delivery behave as
  today; on SQLite without a queue, timers run in process and resume after a restart.

## 3. Functional Requirements

### 3.1 Scope, flags and compatibility

- **FR-1** The system loads the generalized engine only when `GAUZY_AUTOMATIONS_ENABLED` is exactly `true` and gates every
  new route, GraphQL field, menu entry and MCP tool with `FEATURE_AUTOMATIONS`; off, they answer `404` and nothing runs.
- **FR-2** The system keeps task rules (routes, tables, templates, history, permission, switch) working unchanged, runs
  them on the same engine, lists them under Automations (their page keeps its address and opens as today), and lets a
  user copy a task rule into a flow.
- **FR-3** The system keeps the notification types, per-person settings, team defaults and the task due, timer and
  meeting reminders, and reads them as the defaults of the preference model (§3.10).
- **FR-4** The system only adds routes, fields and values to existing contracts; nothing is renamed or removed.

### 3.2 Flows and versions

- **FR-5** A user with `AUTOMATION_FLOW_EDIT` can create a flow in their organization: name, description, record type (none
  for schedule or webhook flows), one trigger, conditions and a graph of steps; at most 300 flows and 50 steps each.
- **FR-6** The system keeps draft and published versions: edits go to the draft; publishing swaps the active version
  atomically; running and waiting runs finish on their version; earlier versions can be restored as a draft.
- **FR-7** The system validates at save and publish (loaded types only; the organization's fields, records, people and
  templates; every branch ends; no unreachable step; every wait expires) and refuses a publish naming each error.
- **FR-8** A user with `AUTOMATION_FLOW_PUBLISH` can publish, activate, pause and archive flows; who and when are recorded.
- **FR-9** The system runs a flow as a system actor bounded by its owner's permissions (refused at publish, failing later
  if rights shrink) and attributes its changes "by automation `<name>`" with actor System in activity and audit.
- **FR-10** The system offers templates of loaded plugins (remind before a date, assign in turn, escalate an overdue
  invoice, welcome a new employee, weekly digest, follow up a stalled record), created off; outside senders say so.

### 3.3 Triggers

- **FR-11** The system triggers flows on any registered record type: created, updated, deleted, restored, a field changed
  (optionally from and to values), a workflow state entered, and the events a plugin declares for its types.
- **FR-12** The system triggers flows on schedules (every N ≥ 5 minutes, hourly, daily, weekly on weekdays, monthly on a
  day, cron) in a chosen time zone, optionally once per record of a saved view or filter (at most 10,000 per firing).
- **FR-13** The system triggers flows N minutes, hours, days or weeks before or after a date field (separate offsets for
  all-day values) within 5 minutes, once per flow, record, date value and offset; a changed date re-arms it.
- **FR-14** The system triggers flows on an email received in a mailbox, a chat message in a channel or naming a keyword,
  and a text message received, passing the message, its sender and the record matched by address or number.
- **FR-15** The system gives an incoming webhook flow its own address with a secret token and an optional signature
  check, refuses unsigned calls when a secret is set, bodies over 1 MB and repeated delivery ids, and passes the JSON body.
- **FR-16** A user who can view a record can start a manual flow from the record, a selection of up to 500 records, the
  command palette, a form action or MCP, answering the flow's input fields first.
- **FR-17** A workflow transition or escalation, a form action and a plugin can start a named flow with a record and
  inputs; an event name no loaded plugin declares is refused.

### 3.4 Conditions, expressions and tokens

- **FR-18** The system evaluates condition rows grouped by all, any and not over the record, related records (two hops),
  the change, the payload and the actor: equals, one of, comparisons, between, empty, contains, starts with, changed.
- **FR-19** The system evaluates expressions with the platform's formula language within a budget; no tenant code runs
  on the cloud deployment, and on a self-hosted installation only as a script step behind its switch (FR-81 to FR-84).
- **FR-20** The system renders tokens (record and related fields, earlier outputs, actor, dates, links) in titles,
  messages, bodies and values in the recipient's language and formats, and refuses an unknown token at save.
- **FR-21** A step can name a record created or found by an earlier step and act on it, or loop over found records.

### 3.5 Actions and control steps

- **FR-22** The system offers these actions, each only while the plugin it needs is loaded:

  | Action | Behaviour |
  |---|---|
  | Update fields | set, clear, increase, decrease or append standard and custom fields of the record or a named one |
  | Create record | any registered type, values from tokens, linked to the trigger record, named for later steps |
  | Copy record | the record or a template record with dates shifted by a period (repeating non-document records) |
  | Find records | up to 1,000 related or filtered records to use or loop over |
  | Assign | owner or assignees directly, from a field, or through an assignment rule (§3.8) |
  | Tags | add or remove tags |
  | Comment, milestone | a comment (mentions notify) or a milestone entry on the record's timeline |
  | Notify | a user-defined notification (§3.10) |
  | Send email | template or composed body to people, contacts or field addresses; record PDF and files attached |
  | Send text message, post to chat | to numbers from fields or people; to a chat channel or a destination |
  | Call webhook | method, address with tokens, headers, JSON body template, signed |
  | Request approval | start an approval on the record, optionally waiting for the decision |
  | Start flow, set reminder | another flow with record and inputs; a reminder for people at a time or from a field |
  | Award points, run agent | recognition points (§3.11); an assistant step (§3.12) `(advanced)` |
  | Plugin actions | actions plugins declare, such as provisioning an account or converting a lead |

- **FR-23** The system offers waits for a duration (up to 365 days), until a date or field value, or until an event on the
  same record or with the same correlation key (same email thread), each with an expiry branch; waits survive restarts.
- **FR-24** The system offers if/else and multi-way branches (nested up to 5 levels) and a stop step (succeeded or failed).
- **FR-25** Each action states its failure handling (stop, default; continue; retry with back-off up to 5 times) and keeps
  its output (at most 64 KB) for later steps and history.
- **FR-26** The system resolves email, text and webhook recipients at run time; a fixed outside address needs
  `AUTOMATION_FLOW_PUBLISH`, and publishing shows the flow's "data leaving the platform" summary.
- **FR-27** The system sends outbound calls through the platform's outbound endpoint policy, signs bodies with the flow's
  secret, times out after 10 s (at most 30 s), and stores the status and the first 4 KB of the answer on the step.
- **FR-28** The system writes records through each type's own write path (validation, permissions, field rules, workflow
  read-only states, activity, notices, real-time hints); a refused write fails the step with the reason.

### 3.6 Running, limits and protection

- **FR-29** The system runs flows in the background after the triggering change commits; a failing flow never fails or
  slows that change.
- **FR-30** The system runs each flow at most once per triggering event and record, schedule firing and date-relative key.
- **FR-31** The system processes one record's runs in event order and never lets two runs write the same record at once.
- **FR-32** The system lets flow changes trigger flows up to a chain depth of 3 (setting 1 to 5), never runs a flow on a
  change its own chain caused, and records held runs as "loop guard"; task rules keep depth 1.
- **FR-33** The system enforces per-flow limits (1,000 runs per hour, 20 runs per record in 10 minutes, 50 concurrent, each
  editable) and records runs beyond them as skipped "rate limited".
- **FR-34** The system pauses a flow after 10 consecutive failures (setting 3 to 50), notifies its owner and the automation
  administrators, and offers to retry the failed runs on resume.
- **FR-35** A user with `AUTOMATION_ADMIN` can switch an audited kill switch per organization or tenant (no new run, runs
  halt at the next step, waits hold); switching back resumes waits and offers to process or discard held events.
- **FR-36** When a flow's trigger rate passes ten times its 7-day hourly average and its hourly limit, the system holds
  its events, pauses it, names count and source, and offers process, sample 20 first, or discard. `(advanced)`
- **FR-37** The system limits a run to a 256 KB context, 1,000 loop items and 15 minutes of work excluding waits, failing it
  with the limit named.
- **FR-38** The system keeps runs 90 days (setting 7 to 730), failures 180 days, trial runs 7 days, and monthly counts per
  flow and outcome beyond that.
- **FR-39** The system pauses the flows of an owner who leaves or is deactivated and tells the automation administrators,
  who can reassign the owner.

### 3.7 Trial runs, simulation, history and replay

- **FR-40** A user with `AUTOMATION_FLOW_EDIT` can trial-run a flow on a record or sample payload: trigger match, each
  condition, each step's planned effect, waits taken as passed; nothing is written, sent or called.
- **FR-41** A user with `AUTOMATION_FLOW_EDIT` can simulate a draft over up to 90 days of past events or a saved view: runs,
  counts per branch and action, notices per person per day, 20 samples; nothing written. `(advanced)`
- **FR-42** The system shows run history per flow and per record, filtered by outcome, version, record and date, each run
  with its step timeline (times, inputs, outputs, waits, retries, errors), live while it runs.
- **FR-43** A user with `AUTOMATION_FLOW_PUBLISH` can replay a failed or halted run from its failed step, keeping earlier
  outputs, as a linked run; a step that already reached an outside party repeats only if chosen. `(advanced)`
- **FR-44** A user who can view a record can ask which flows a given change would start, and sees the record's runs,
  waits, reminders and milestones in its timeline.

### 3.8 Assignment rules and record assignments

- **FR-45** A user with `ASSIGNMENT_RULE_MANAGE` can define rules per record type: assign, unassign and close conditions,
  order, active weekdays and hours, due date from a field plus offset, description template, pool of people or teams.
- **FR-46** The system distributes in turn, to the fewest open assignments of the type, to the person a field names, by
  weight per person, or by free capacity this week (working hours minus planned and tracked time).
- **FR-47** The system skips people on approved time off, off their working hours or over their cap, narrows the pool to
  required skills, and with nobody left notifies the rule owner. `(advanced)`
- **FR-48** The system applies a rule when a record's conditions become true, lets a user apply it to up to 500 selected
  records, reopens the assignment when a closed record reopens, and records each decision with who was skipped and why.
- **FR-49** The system writes the type's own owner or assignee field when it has one, otherwise record assignments.
- **FR-50** A user who can edit a record of any registered type can give people record assignments (due date, priority,
  note; open, done, cancelled); the assignee is notified and the record shows them.
- **FR-51** A person sees their open assignments across types in the Inbox's "Assigned to me" tab, filtered by type, due
  date and status, and marks them done or cancelled; who and when are recorded.
- **FR-52** The system assigns by role to everyone holding it (at most 50) or one of them through a rule, and closes open
  assignments when a rule's close condition holds or the record is deleted.

### 3.9 Reminders

- **FR-53** A person can set a reminder (for others with edit on the record) at a date-time, optionally on a record; it
  arrives within a minute through preferences, can be snoozed, edited or dismissed, and goes with its record; flows and
  other features schedule their reminders in the same list, shown in the Inbox's "Reminders" tab.
- **FR-54** The system creates reminder defaults per record type as date-relative flows (FR-13), with separate all-day
  offsets and recipients from fields, sent once per record, offset and recipient.
- **FR-55** The system shows the task due, timer and meeting reminders as categories of the preference page, where their
  thresholds are edited.
- **FR-56** A person can receive a daily agenda at their digest hour: assignments, reminders, meetings and tasks due.

### 3.10 Notifications, preferences and digests

- **FR-57** The system gives every notification a category (existing types, plugin categories, user-defined ones), with
  labels per language, a description, default channels per organization and a mandatory flag set by `AUTOMATION_ADMIN`.
- **FR-58** A user-defined notice names category, recipients (people, assignees, owner, field, role, team, followers,
  a person's manager, destination), tokens, priority and a link; one in-app entry per recipient, preferences elsewhere.
- **FR-59** The system notifies mentions, assignments, shares and follower updates on every registered record type with
  comments or followers, not only on tasks and projects.
- **FR-60** The system delivers in-app notifications live through the real-time channel when it is on (else at the next
  refresh) and shows unread counts per category.
- **FR-61** The system keeps one preference model per person and category: in-app, email (immediate, digest, off), push,
  chat direct message and text message (verified number); today's email, push and quiet-hour settings are its values.
- **FR-62** The system applies organization defaults per category and channel (`AUTOMATION_ADMIN`), then team defaults,
  then the person's choice; a mandatory category keeps in-app and one outside channel on.
- **FR-63** A person can set quiet hours per weekday in their time zone, in several windows; push, chat, text and
  immediate email wait for the window's end, except urgent notices of categories allowed to break it. `(advanced)`
- **FR-64** A person can choose bundling (off by default, as today; or 5, 15 or 60 minutes): notices of one category and record within the window
  reach outside channels as one message with the count and latest items, and collapse in-app. `(advanced)`
- **FR-65** A person can follow and unfollow any registered record type with followers, list what they follow, and choose
  hourly, daily or weekly follow digests instead of a notice per change.
- **FR-66** A user with `NOTIFICATION_DESTINATION_MANAGE` can create, test and use named destinations (a chat channel, or
  an outbound address kept as one of the platform's webhook subscriptions, with its secret); the platform's webhook
  delivery retries a failing address, disables it after repeated failures and tells its creator.
- **FR-67** The system shows each notification's delivery state per channel (queued, sent, bundled, skipped with reason,
  failed with error) to its recipient, and to automation administrators in a delivery report.
- **FR-68** A user with `NOTIFICATION_DIGEST_MANAGE` can define summary digests (daily, weekly, monthly; recipients; report
  cards, saved-view counts, open assignments, overdue reminders), rendered per recipient with their permissions.
- **FR-69** The system sends a digest once per recipient and period, skips inactive and opted-out people, logs and skips
  a failing recipient, and lets the editor preview it as a recipient and send a test to themselves.

### 3.11 Recognition

- **FR-70** A person with `RECOGNITION_GIVE` can recognise a colleague, optionally on a record, with points from a monthly
  allowance (default 100); the receiver is notified; it shows on their profile and the record timeline.
- **FR-71** The system lets flows award points within a per-flow monthly cap, keeps a points ledger per person and period,
  shows managers team totals, never gives points to agent employees, and lets an organization switch totals off.
- **FR-72** A person can keep the recognitions they receive private to themselves and their managers.

### 3.12 Assistants and agents

- **FR-73** A user with `AUTOMATION_FLOW_EDIT` can describe a flow in plain language; the assistant saves a draft with
  its explanation and chosen defaults for review and never publishes. `(advanced)`
- **FR-74** An agent step runs one of the organization's agents on the record with a chosen tool set (writes only if
  allowed, each previewed) and step limits (tokens, calls, minutes), maps its answer to variables, stops at the first
  limit. `(advanced)`
- **FR-75** The system runs agent steps under the flow's run-as identity, links each step to the agent's run where its tool
  calls, usage and cost are kept, marks agent writes as Agent, and stops agent steps when the agent's budget is spent;
  without the agent feature the step is not offered. `(advanced)`
- **FR-76** The system offers MCP tools to list flows, draft from text, trial-run, simulate, publish or pause, read runs,
  replay (preview), notify people, set reminders and list one's assignments, under the caller's permissions.

### 3.13 API, events, extension and reports

- **FR-77** The system exposes every capability of this feature through REST, with GraphQL for reads.
- **FR-78** The system publishes events for runs (started, waiting, completed, failed), flows (published, paused,
  auto-paused, storm held), the kill switch, assignments (created, closed), reminders (due) and recognitions (given).
- **FR-79** Plugins declare triggers, actions, categories and record writers, start flows and send notifications through
  declared extension points; what an unloaded plugin declared is not offered.
- **FR-80** The system registers these report definitions:

  | Report | Answers |
  |---|---|
  | Flow runs | runs per flow, version and period by outcome; duration percentiles; skip reasons |
  | Failure hot spots | failing steps and actions by error; auto-pauses; storms held |
  | Notification delivery | notices per category, channel and period: sent, bundled, skipped, failed |
  | Assignment distribution | per person, rule and type; open by age; skips by reason |
  | Reminders and digests | reminders due, sent, snoozed; digests sent and failed per recipient |
  | Recognition | recognitions and points per person, team and period |
  | Agent step usage | agent steps per flow and month with the tokens and cost the agent feature recorded |

### 3.14 Script steps on self-hosted installations

- **FR-81** The system offers script steps only on a self-hosted installation whose operator turned the deployment
  switch on (off by default); the cloud deployment refuses the switch at start-up and answers `403` to every script
  step and script route there.
- **FR-82** A user with `AUTOMATION_SCRIPTS_MANAGE` can, where scripts are on, add a script step to a flow: it reads the
  record and earlier outputs, returns variables for later steps, is trial-run, versioned and published with the flow.
- **FR-83** The system runs each script step in an isolated runtime without network, file or platform access, within a
  time limit (default 2 s) and a memory limit (default 64 MB); a failing or stopped script fails the step with the limit
  named, under the step's failure handling.
- **FR-84** The system audits every script run (flow, version, step, record, duration, memory, outcome) and every script
  change (who, when, before, after), readable by holders of `AUTOMATION_SCRIPTS_MANAGE`.

## 4. Non-Functional Requirements

- **Performance**: a save adds one outbox append (none without listening flows); first step within 5 s P95 of the commit
  (60 s without a queue); 200 steps per second per API instance; schedules within 60 s, date triggers within 5 minutes,
  reminders within 1 minute; flow lists and run history under 300 ms P95 at 10 million runs per tenant.
- **Volume**: 300 flows and 1 million open waits per organization; 100,000 notices per hour per tenant; a simulation over
  1 million past events within 10 minutes.
- **Reliability**: at-least-once through the event outbox, deduplicated per flow; waits, schedules and deliveries resume
  after downtime (24 h catch-up for date triggers); a notice never reaches a channel twice.
- **Security & privacy**: scoping everywhere; bounded run-as; encrypted secrets; endpoint policy. Leaves the platform:
  email, text, push, webhook calls, destination posts, agent prompts to the organization's AI provider (listed per flow).
- **Observability**: run and step history, audit of flow changes and kill-switch use, metrics for lag, failures, skips,
  storms and agent spend.
- **Accessibility and localization**: keyboard list editor equivalent to the canvas; labels per language; user time zone.
- **Compatibility**: PostgreSQL, MySQL, SQLite; both ORMs; cloud and self-hosted, with or without a queue; OpenAPI
  additive; SDKs regenerated.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| Flow, flow version | A named automation of an organization; an immutable published version or the editable draft |
| Trigger, step, wait, branch | What starts a flow; one node of its graph; a pause; a condition fork |
| Run, run step | One execution of a version for one trigger; one executed step with input, output and outcome |
| Simulation | A no-write evaluation of a draft against past events or a saved view |
| Inbound hook | The address and secret through which an outside system starts a flow |
| Automation settings | Kill switch, depth, limits and retention of an organization or tenant, in the platform's settings |
| Assignment rule, record assignment | How records of a type are distributed; one person's open to-do on a record |
| Reminder | A timed reminder for a person, optionally about a record, set by people, flows or other features |
| Notification category, preference | A kind of notice with defaults; a person's channel choices per category |
| Destination | A named chat channel, or an outbound address kept as a webhook subscription, that receives notices |
| Summary digest | A scheduled per-recipient summary of cards |
| Recognition, points ledger | A recognition between colleagues; the points it moves |

## 6. Out of Scope

- Approval definitions, approvers, the approval inbox and approval escalations: `approval-workflows`.
- Email accounts, sending, text message providers, inbound mail parsing: `email-and-communications`.
- The platform's webhook subscriptions, their delivery logs and retries, inbound connectors: `integration-hub`.
- Registry and monitor of the platform's scheduled jobs: `platform-administration`.
- Recurrence of business documents: `business-document-engine`.
- Report definitions, cards and dashboards themselves (digests embed cards): `report-builder-and-dashboards`.
- Agent definitions, knowledge bases, shared agent conventions: `ai-agents-and-assistants`.
- Saved views, tag filters and counts, the record timeline shell: `record-views-and-search`.

## 7. Acceptance Criteria

- [ ] **AC-1** A flow on expenses with request approval, wait and notify runs end to end; a trial run writes nothing (FR-40, FR-42).
- [ ] **AC-2** Record, field-change, schedule, date, incoming email, incoming webhook and manual triggers each start one
      run per occurrence, also after a redelivery or a restart (FR-13, FR-15, FR-16).
- [ ] **AC-3** Each action of FR-22 has a passing test; email, webhook and chat honour recipients and the endpoint policy.
- [ ] **AC-4** Waits resume on time, on a correlated event and on expiry; a new version leaves waiting runs on theirs (FR-6, FR-23).
- [ ] **AC-5** Loop guard, rate limits, auto-pause and the kill switch hold under a seeded chain and a burst (FR-32–FR-35).
- [ ] **AC-6** A 50,000-change import is held with process, sample and discard offered (advanced: storms; FR-36).
- [ ] **AC-7** Simulation over 30 days reports counts and samples without writing; replay repeats no earlier step
      (advanced: simulation, replay; FR-38, FR-41, FR-43).
- [ ] **AC-8** Plain language becomes a draft only a person publishes; an agent step stops at its budget and outside its
      tools (advanced: agents; FR-73–FR-75).
- [ ] **AC-9** Assignment in turn skips a member on approved time off and says why (advanced: availability; FR-47).
- [ ] **AC-10** Quiet hours hold pushes; 12 notices in the window arrive as one push (advanced: bundling; FR-63, FR-64).
- [ ] **AC-11** Record assignments, reminders, follow digests and a weekly summary digest reach the right people once (FR-59, FR-65, FR-68).
- [ ] **AC-12** Recognition moves points within allowance and caps; agents receive none (FR-70–FR-72).
- [ ] **AC-13** The seven reports of FR-80 return correct figures on seeded data.
- [ ] **AC-14** Feature off: `404` on new routes; task rules, reminders and delivery behave as before (FR-1, FR-2).
- [ ] **AC-15** The cloud deployment refuses the script switch and answers `403` to script steps; on a self-hosted
      installation with the switch on, a script step runs, one over its limits is stopped, and every run is audited (FR-81, FR-82).
- [ ] **AC-16** Feature on with default settings: the task rules page opens at its address as before, and notices reach
      outside channels one by one until a person chooses bundling (FR-2).
- [ ] **AC-17** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-1).
- [ ] Works on PostgreSQL, MySQL and SQLite with both ORMs; all functional requirements have a passing test.

## 8. Open Questions

- Chain depth 3 by default (task rules stay at 1). Default applied.
- A flow belongs to one organization; a tenant-wide need is a copy per organization. Default applied.
- The incoming webhook trigger is served here until `integration-hub` offers inbound endpoints, which then become a second
  source of the same trigger. Default applied.
- Recognition points carry no money value and no redemption. Default applied.
- Notices reach employees; users without an employee record get in-app and email only. Default applied.

## 9. Constitution Gates

- [x] I Plugin-first — extends the `task-automations` and `inbox` plugins and their UI plugins; core gains enum values and small shared helpers.
- [x] II Tenant/organization scoping — every flow, run, rule, assignment, reminder, category and digest is scoped.
- [x] III Both ORMs, additive migrations — new tables on three dialects; no existing column changed.
- [x] IV Default-off flag; nothing removed — deploy switch plus `FEATURE_AUTOMATIONS`; task rules and reminders unchanged.
- [x] V Contracts and API first — contracts, REST, GraphQL reads and SDK regeneration before the designer.
- [x] VI Permissions, privacy, security — permission keys, bounded run-as, endpoint policy, sealed secrets, no scripts on the cloud.
- [x] VII Real-time through the event bus — triggers ride the outbox; run progress and notices on the real-time channel.
- [x] VIII i18n and accessibility — labels per language, keyboard designer, announced errors.
- [x] IX Tests accompany the change — per requirement, with dialect and ORM parity specs.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Builds on: [`task-automations`](../task-automations/spec.md), [`inbox`](../inbox/spec.md), [`realtime-channel`](../realtime-channel/spec.md)
- Works with: [`approval-workflows`](../approval-workflows/spec.md), [`custom-fields-and-forms`](../custom-fields-and-forms/spec.md),
  [`record-views-and-search`](../record-views-and-search/spec.md), [`hr-core-lifecycle`](../hr-core-lifecycle/spec.md)
- Code: `packages/plugins/task-automations`, `packages/plugins/inbox`, `packages/core/src/lib/{rule,event-outbox,webhook}`,
  `packages/core/src/lib/employee-notification*`
