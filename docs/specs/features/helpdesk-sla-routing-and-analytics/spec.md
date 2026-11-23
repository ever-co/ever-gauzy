# Feature Specification: Helpdesk service levels, routing and analytics

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `helpdesk-sla-routing-and-analytics`
**Branch**: `feat/helpdesk-sla-routing-and-analytics`
**Status**: `Draft`
**Created**: 2026-11-16
**Last updated**: 2026-11-23
**Owner**: platform maintainers
**Feature flag**: `FEATURE_HELPDESK` (tenant feature, default off; the helpdesk plugin loads only when
`GAUZY_HELPDESK_ENABLED` is exactly `true`) · service level tracking is an organization setting, default off

---

## 1. Overview

Tickets (`helpdesk-tickets`), which are tasks with a customer side, need people, rules and measures around them. Today
teams serve projects, employees carry skills and availability, time off, holidays and organization working hours exist,
and the platform offers assignment rules, conditions, a report catalogue and dashboards, but nothing knows a support
agent, a service level or a helpdesk figure. This feature makes employees **agents** (channels,
languages, skills, capacity, an availability state) and the platform's teams **support teams** with visibility rules;
routes tickets to teams with ordered **routing rules** and assigns them within a team through the platform's assignment
rules made aware of agents; measures **service levels** with calendars (hours, breaks, holidays, exceptions) and
policies (first response, next reply and resolution targets per priority, conditions, order, pause and fulfil statuses)
with breaches and **escalation**; and gives the **agent home**, the **manager dashboard** (whose cards are dashboard
widgets anyone may place on their own dashboards), per-ticket analytics and the helpdesk **reports** in the platform's
report catalogue. The same engine serves other record types such as leads and deals. Clients: the Gauzy web app, the
MCP server and the SDKs.

**Advanced capabilities.** **Warnings before breach** and **escalation chains** that reach the assignee's
manager through the reporting line; calendars and policies **per customer contract** in the **customer's time zone**,
with contract support hours drawn down by tracked time; **follow-the-sun** routing by working hours and time off; a
**breach forecast** from queue and capacity with assistant-proposed rebalancing; **support health** of each customer from
ticket trends, shown beside the CRM's own signals; capacity from **tracked time**; **cost-to-serve** analytics; dashboards that update **live**. Marked
`(advanced)`.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** a "Gold" policy (urgent: first response 1 h, resolution 8 h) on a calendar Monday to Friday 08:00–18:00 with a
  12:00–13:00 break in the customer's time zone, **when** an urgent ticket arrives on Friday at 17:30, **then** its first
  response is due Monday 08:30 and lists show the time left in working time.
- **Given** a ticket awaiting the customer for two days, **when** the customer replies, **then** resolution moves later by
  the paused working time and the next reply clock starts. `(advanced)`
- **Given** a warning at 75 % and an escalation policy, **when** first response reaches 75 %, **then** the assignee is
  warned; at breach the team lead and the assignee's manager are told; 30 minutes later the ticket moves to the escalation
  team at higher priority. `(advanced)`
- **Given** team Billing assigning in turn, **when** a ticket arrives while one agent is on approved time off and one is
  "Away", **then** it goes to the next routable agent and the decision says who was skipped and why.
- **Given** a follow-the-sun group Europe then Americas, **when** Europe's service day ends, **then** its unassigned
  tickets with a reply due move to Americas with a handover summary. `(advanced)`
- **Given** a manager on the dashboard for the last 30 days and team Billing, **then** cards show created, met share, first
  response and resolution with the change against the previous 30 days, every figure opens its tickets, and an agent
  opening the same page sees only their own figures.
- **Given** Acme's tickets tripling with breaches, **when** support health is computed, **then** Acme is "at risk" with
  reasons, also on its CRM organisation page, and a flow creates a task for its account owner; its contract's 20
  monthly hours warn at 16 tracked. `(advanced)`

### 2.2 Edge cases & failures

- **Given** two matching policies, **then** the first in order applies; a manager may choose the other; with none, the
  ticket shows "no service level".
- **Given** a priority raised after a due time passed, **then** the metric breaches at the change with that reason.
- **Given** a policy edit affecting 37 open tickets, **then** the count is shown and their due times are kept unless the
  user chooses to recompute.
- **Given** overlapping intervals, a calendar without working time or a resolution target shorter than first response,
  **then** saving is refused naming the problem.
- **Given** the service down for an hour, **then** breaches are recorded at their due times and each escalation level fires
  once.
- **Given** an agent deactivated with 12 open tickets, **then** they return to the team's rule or queue and the lead is told;
  with nobody eligible a ticket waits in the queue and the lead is told.
- **Given** a reset without the permission, **then** `403`; with resets switched off, it is refused.
- **Given** time-off or HR plugins absent, **then** calendars use the organization's official holidays and their own
  exceptions, and escalations to "manager" go to the team lead.
- **Given** `FEATURE_HELPDESK` off or service levels off, **then** no clock runs and nothing of it is shown.

## 3. Functional Requirements

### 3.1 Scope and compatibility

- **FR-1** The system ships in the helpdesk plugin under `GAUZY_HELPDESK_ENABLED` and `FEATURE_HELPDESK`; service level
  tracking is an organization setting (default off); routing, agents and analytics work without it.
- **FR-2** Agents are employees (human or agent kind), teams the platform's teams, skills the employees' skills,
  availability time off and working calendars, assignment the platform's assignment rules, conditions the platform's
  rules, ticket statuses and priorities the task statuses and priorities of the support project, reports the
  platform's report catalogue and cards its dashboard widgets; nothing is copied.
- **FR-3** The system only adds routes, fields and enum values; nothing existing is renamed, repurposed or removed.

### 3.2 Agents and availability

- **FR-4** A user with `HELPDESK_AGENT_MANAGE` makes employees agents: active flag, teams, channels and languages served,
  skills, maximum open tickets and working hours source (roster, working calendar, appointment availability or own
  hours); an agent's time zone and language are those of their user profile.
- **FR-5** A user with `HELPDESK_AGENT_MANAGE` invites people by email as agents with a role and teams through the
  platform's invitations; acceptance creates the agent; pending invitations can be resent or cancelled.
- **FR-6** Only active agents (and holders of `HELPDESK_TICKET_VIEW_ALL`) work tickets; deactivating an agent sends their
  open tickets to the team's rule or queue and tells the team lead.
- **FR-7** An organization defines availability states (name, colour, routing all, urgent only or none, optional expiry);
  shipped "Available", "Busy" (urgent only), "Away", "Offline"; agents set their own, optionally for a duration after
  which the default returns within 5 minutes; team leads and `HELPDESK_AGENT_MANAGE` holders set others'.
- **FR-8** An agent is not routable on approved time off, outside working hours, or (setting) disconnected for 15 minutes,
  whatever their state, and the reason shows beside them.
- **FR-9** Managers see each agent's state, open load, time tracked today and next working time; agents see their teams'.

### 3.3 Teams and visibility

- **FR-10** Support teams are platform teams with a helpdesk profile: active, lead (the team's managers), assignment rule,
  calendar, escalation policy, access (own or all tickets), fallback team; deactivating moves open tickets to the fallback.
- **FR-11** With "restrict by team" on, an agent reads tickets of their teams, assigned to or followed by them and, by
  setting (default on), tickets without a team; all-access teams and `HELPDESK_TICKET_VIEW_ALL` see all — in helpdesk
  lists, search, counts, direct reads, real time and MCP; task screens show a ticket's task part by the support
  project's own access.
- **FR-12** With "assign within team" on, an assignee must belong to the ticket's team; changing the team unassigns others.

### 3.4 Routing and assignment

- **FR-13** A user with `HELPDESK_ROUTING_MANAGE` orders routing rules with conditions, kept as the platform's rules, on
  channel, template, priority, customer, contract, tags, language, sender domain, subject and body text and custom
  fields, setting team, priority, template, tags and assignment rule; the first match applies unless it continues; no
  match goes to the default team.
- **FR-14** Routing runs on creation, on reopening an unassigned ticket and on demand for selected tickets; each decision
  shows on the timeline, and "why here?" explains the rule and changes.
- **FR-15** Within a team, assignment uses the platform's assignment rules for tickets (in turn, fewest open, weighted,
  capacity, from a field) with their active weekdays and hours, showing each rule's last assignee.
- **FR-16** The helpdesk narrows each pool to active team agents serving the channel and language, with the required
  skills, routable and under their maximum, trying states that route all tickets first, then urgent-only states for
  urgent tickets; with nobody, the ticket waits in the team queue and the lead is told, or ("never unassigned") goes to the
  least-loaded member with the reason.
- **FR-17** Agents assign, reassign and unassign one or many tickets, assign themselves and "take next" (their teams'
  highest priority, earliest due ticket they may take); the assignee is notified; tickets show assignee and followers
  with avatars; the customer's open page shows that someone is on it.
- **FR-18** Before an agent's approved time off, the system lists their open tickets due during it and offers reassignment
  through the team's rule. `(advanced)`
- **FR-19** Teams of a follow-the-sun group hand over at the end of each one's service day: unassigned tickets, and by choice
  tickets whose next reply falls before the assignee's next working start, move to the team on duty with a handover
  summary as internal comment, returning at the home team's start when set. `(advanced)`
- **FR-20** Agent load counts open tickets weighted by priority plus time tracked on tickets today against working hours;
  capacity assignment and "take next" use it. `(advanced)`
- **FR-21** The assistant proposes reassignments that avoid forecast breaches (FR-59), applied only when a team lead
  accepts them. `(advanced)`

### 3.5 Service calendars

- **FR-22** A user with `HELPDESK_SLA_MANAGE` defines calendars: time zone (fixed or the customer's), working intervals per
  weekday (several a day; gaps are breaks), holidays from a holiday calendar of `time-off-management` or else the
  organization's official holidays of a country, and dated exceptions (closed or other hours); a default calendar from
  the organization's working hours, week start and time zone (24×7 when they are not set) always exists.
- **FR-23** Saving refuses overlapping or out-of-day intervals and a calendar without working time; a used calendar cannot
  be deleted.
- **FR-24** The calendar page shows a year with holidays, recurring holidays and exceptions as a calendar or a table.
- **FR-25** With "customer's time zone", working time is read in the ticket customer's time zone (the contact's, else the
  organization's). `(advanced)`

### 3.6 Policies

- **FR-26** A user with `HELPDESK_SLA_MANAGE` defines policies: name, description, active, valid from and to, calendar,
  conditions on ticket and custom fields (kept as the platform's rules), position, one default policy without
  conditions, resolution measured or not.
- **FR-27** Targets per priority give first response, next reply and resolution in working minutes, hours or days; a
  priority appears once; resolution is not shorter than first response; one row may serve unlisted priorities; a policy
  without a row for the ticket's priority does not apply.
- **FR-28** Pause statuses (default the waiting category) stop next reply and resolution, and first response only when the
  policy says; fulfil statuses (default done and closed) meet resolution; a policy may name the status of new and
  reopened tickets.
- **FR-29** The policy is the one named by the customer's active contract, else the first active, valid policy in order
  whose conditions match and that covers the priority, else the default, else none; it is chosen again when fields its
  conditions read change, keeping elapsed working time.
- **FR-30** A user with `HELPDESK_SLA_MANAGE` can apply another matching policy to a ticket with a reason.
- **FR-31** An edit that drops a priority, changes conditions or deactivates a policy shows how many open tickets it touches
  and keeps their due times unless the user recomputes them.
- **FR-32** Policies past their end deactivate nightly while their tickets keep their snapshot; a preview gives the due
  times a sample ticket would get (priority, arrival time, customer).

### 3.7 Clocks

- **FR-33** A due time is the start plus the target in the calendar's working time (intervals minus holidays and
  exceptions), stored once and recomputed only on resume, priority, policy or calendar change and reset, never by ticking.
- **FR-34** First response starts at creation and is met by the first public reply of a person, an AI responder's only when
  the policy counts it (default off); a recorded reply counts; acknowledgements and comments do not.
- **FR-35** Next reply starts at each customer message after an agent reply and is met by the next public agent reply.
  `(advanced)`
- **FR-36** Resolution starts at creation, pauses per FR-28, is met on entering a fulfil status, and on reopening resumes
  from its elapsed working time with a new due time; the earlier fulfilment counts as reopened.
- **FR-37** A priority change recomputes due times from each metric's start; a due time already passed breaches at the
  change with that reason.
- **FR-38** A ticket records whether it arrived outside working hours or in a break, for routing, acknowledgements, reports.
- **FR-39** A user with `HELPDESK_SLA_RESET` restarts a ticket's clocks with a reason when the organization allows resets
  (default off); history is kept.
- **FR-40** Merging cancels the sources' clocks; a split ticket starts new clocks (setting: from the original's creation).
- **FR-41** The system stores per ticket in working time: first response, reply gaps per side, waiting, resolution and
  resolution without customer waiting.

### 3.8 States, warnings, breaches and escalation

- **FR-42** Each metric is running, paused, met, met late, breached or not applicable; a ticket shows the worst of on track,
  at risk, breached, paused or met.
- **FR-43** Warnings before breach (default at 75 % of the target, or minutes before) notify the assignee or, unassigned,
  the team; a second warning reaches the team lead. `(advanced)`
- **FR-44** A breach is recorded at its due time even when found later, with the overdue working time; an internal comment
  names the assignee; assignee and lead are notified.
- **FR-45** Escalation policies hold ordered levels, each at a time from a metric's warning or breach, acting by notifying
  the assignee, team lead, the assignee's manager (reporting line), named people, roles or a destination, reassigning to a
  team or person, raising priority, adding tags or starting a flow; each level fires once per metric and ticket and
  stops when met, paused or closed. `(advanced)`
- **FR-46** Checks run every minute and catch up after downtime.
- **FR-47** Lists and tickets show a badge with the working time left or overdue, coloured by state; the "due soon" view and
  the agent home show what is next; acknowledgements and the portal get the expected first response time.

### 3.9 Other record types

- **FR-48** The engine serves any registered record type that declares its statuses and reply events (`crm-engagement` for
  leads and deals) with the same calendars, policies, clocks, warnings, breaches and escalation.

### 3.10 Dashboards

- **FR-49** The agent home shows my open tickets by status, my assigned tickets per day against the previous period, my
  average first response and resolution, a "needs me" list ordered by due time with quick filters (due soon, new,
  awaiting my reply), recent ratings and activity on my tickets, for today, this week or the last 7, 30 or 90 days or a
  chosen range; each user moves, hides and resets cards, and each card is also a dashboard widget a user may place on
  their own dashboards.
- **FR-50** The manager dashboard shows cards with the change against the previous equal period (created, open, overdue,
  done, met share, average first response and resolution, average rating, tickets per day) and charts of volume,
  outcomes, service levels and ratings over time with breakdowns by any ticket dimension (team, template, priority,
  channel, tag, customer), filtered by period, team, agent, customer and channel; every figure opens its tickets; its
  cards are dashboard widgets too.
- **FR-51** Holders of `HELPDESK_REPORTS_VIEW` see every team and agent, team leads their teams, agents their own figures.
- **FR-52** Managers compare agents of a team or all active agents, credited to the assignee at resolution.
- **FR-53** Stats for one customer, contact or agent give ratings, breaches, average first response and resolution over a
  period; an agent's are visible to that agent and managers.
- **FR-54** The ticket's analytics tab shows messages per side, reply gaps of agents and customer, waiting and resolution in
  working time, a milestone timeline (created, first response, waits, done, reopened, warnings, breaches, escalations),
  status and assignee changes, agents involved, and time and cost (cost permission).
- **FR-55** A customer statistics source (open, overdue, done, average first response and resolution, that customer only)
  serves the portal pages of `helpdesk-portal-and-knowledge-base`.
- **FR-56** Dashboards and badges update within 5 s as tickets change. `(advanced)`

### 3.11 Reports

- **FR-57** The system adds these reports to the platform's report catalogue in a "Support" category shown per
  organization, and only for tenants with `FEATURE_HELPDESK` on, so other tenants' Reports page and menu stay exactly
  as today (filters period, organization, team, agent, customer, template, priority, channel and status where they
  apply; chart and table; export; schedules through the report builder):

  | Report | Answers |
  |---|---|
  | First response | average first response per day in working time, and per ticket |
  | Ticket volume | tickets per week, month, quarter or year by customer, contact, template, priority, team, assignee or channel |
  | Ticket breakdown | per customer, template, priority, team or assignee: totals by status category, met and breached counts, average first response, reply gap, waiting, resolution and resolution without customer waiting |
  | Arrival pattern | tickets by hour of day and weekday |
  | Service level compliance | met, met late and breached by policy, metric, priority and team; breaches by reason; escalations by level |
  | Backlog and ageing | open tickets by age band, status category and team, day by day |
  | Agent performance | per agent: assigned, done, reopened, first response, resolution, ratings, tracked time, utilization |
  | Satisfaction | ratings over time by agent, team, template and customer |
  | Tags | top tags and tag trend |
  | Channels and deflection | tickets per channel; tickets whose subject strongly matches a help article, with the article and score |
  | Routing | decisions by rule, skips by reason, take-next pulls, handovers, reassignments |
  | Saved replies and assistants | saved reply use and unused replies; drafts proposed, accepted, edited, rejected; responder answers and hand-overs by reason; assistant cost |
  | Cost to serve | tracked time and cost per ticket, template, customer, contract and channel (cost permission) `(advanced)` |
  | Support health | customers by band with reasons and trend `(advanced)` |

- **FR-58** Ratings come from `helpdesk-portal-and-knowledge-base`; without it, rating cards and reports say "not available".

### 3.12 Forecast, contracts, health and cost

- **FR-59** A breach forecast estimates for each running metric the time to the next agent action from queue position, the
  team's recent median handling time and agents routable in the coming hours, marks tickets "at risk" when it exceeds the
  time left, and shows breaches expected in the next 4 hours per team. `(advanced)`

- **FR-60** A customer contract (`crm-leads-and-deals`, `maintenance-and-field-service`) can name a policy, a calendar and
  support hours per period; time tracked on its tickets draws the hours down, warning the account owner and team lead
  at 80 % and 100 %. `(advanced)`
- **FR-61** Each night the system scores every customer's support health from 90 days of tickets against the 90 before
  (volume, urgent share, breach rate, reopen rate, resolution time, negative sentiment, ratings, oldest open age) into
  healthy, watch or at risk with the reasons; weights are editable by `HELPDESK_SLA_MANAGE`. `(advanced)`
- **FR-62** Support health shows on the customer and ticket panels and, named "support health", as a signal on the CRM
  organisation page beside its own deal and relationship signals; a change of band raises an event that flows can use
  (a task for the account owner). `(advanced)`
- **FR-63** Cost to serve sums time tracked on tickets at stored pay rates per ticket, template, customer, contract and
  channel, shown only to holders of `HELPDESK_COST_VIEW`. `(advanced)`

### 3.13 API, MCP and events

- **FR-64** REST covers every capability (report sources included) with GraphQL reads and idempotency keys on creating
  routes.
- **FR-65** Events for warnings, breaches, met, pause, resume, reset, escalations, agent state changes, routing decisions
  and support health changes carry ids only and are declared as automation triggers and webhook events.
- **FR-66** MCP tools list agents and states, set one's own state, explain a routing, read a ticket's service level state,
  list at-risk tickets, read dashboard figures, run a report, list policies and preview due times, under the caller's
  permissions.

## 4. Non-Functional Requirements

- **Performance**: a due time computed under 5 ms for spans up to 90 days with 200 holidays; the minute check handles
  100,000 running clocks per tenant under 20 s; badges add no query per row (stored due times); dashboards under 1 s
  P95 at five million tickets per tenant (maintained daily facts); reports over a year under 3 s; routing and
  assignment decided within 2 s of creation.
- **Volume and reliability**: 500 policies and calendars, 2,000 agents per organization; breaches recorded once at their
  due time; escalation levels once each; checks resume after downtime with catch-up.
- **Security & privacy**: figures respect ticket visibility; agent figures only to the agent, their leads and managers;
  costs only to cost viewers; support health reasons never expose another customer. Leaving the platform: notices by email,
  push or chat destinations, subscribed webhooks.
- **Observability**: activity entries for policy, calendar, rule and agent changes, resets and policy overrides; clock
  events per ticket; metrics for check lag, breaches per hour, skipped assignments, forecast accuracy.
- **Accessibility and localization**: charts with tables and text alternatives; badges with text, not colour alone;
  durations and dates in the viewer's language and time zone.
- **Compatibility**: PostgreSQL, MySQL, SQLite; both ORMs; cloud and self-hosted; without the time-off, HR, report builder,
  automation or portal plugins only their part is missing; OpenAPI additive; SDKs regenerated.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| Agent, availability state | An employee's helpdesk profile; a named state with its routing effect |
| Support team profile | Helpdesk settings of a platform team: lead, rule, calendar, access, fallback |
| Routing rule | Ordered conditions that set a ticket's team, priority, template, tags and assignment rule |
| Follow-the-sun group | Teams that hand tickets over at the end of their service days |
| Service calendar | Working intervals per weekday, holidays and exceptions in a time zone |
| Service level policy, target | Conditions, order, calendar and statuses; per-priority first response, next reply, resolution |
| Ticket service level, clock event | A ticket's metrics with due times and states; each start, pause, warning, breach, met, reset |
| Escalation policy | Ordered levels of actions timed from warnings and breaches |
| Ticket facts | Per-ticket measures kept for dashboards and reports |
| Support health | A customer's band and reasons from ticket trends |

## 6. Out of Scope

- Tickets, statuses, channels, replies, saved replies, assistants and the ticket page: `helpdesk-tickets`.
- Satisfaction ratings, portal pages and customer organisations: `helpdesk-portal-and-knowledge-base`.
- Holiday calendars themselves: `time-off-management`; rosters: `attendance-and-shifts`; reporting line: `hr-core-lifecycle`.
- The assignment engine, flows and notification preferences: `automation-and-notifications`; the report builder:
  `report-builder-and-dashboards`; contracts: `crm-leads-and-deals`, `maintenance-and-field-service`; service level
  screens on leads and deals and the CRM organisation page: `crm-engagement`, `crm-leads-and-deals`.

## 7. Acceptance Criteria

- [ ] **AC-1** Golden due-time cases (breaks, holidays, exceptions, time zones, daylight-saving changes) match on three
      dialects; the preview gives the same values (FR-22, FR-24, FR-25, FR-33).
- [ ] **AC-2** Pause and resume, reopen, priority change, policy change and reset follow FR-33 to FR-41; after a simulated
      hour of downtime breaches carry their due times.
- [ ] **AC-3** Policy choice follows contract, order, default; an edit shows the affected count and keeps due times (FR-29, FR-31).
- [ ] **AC-4** Routing sets team and fields; assignment skips agents on time off, off hours or away with reasons; nobody →
      queue and lead told; "take next" picks the right ticket (FR-15, FR-16, FR-18, FR-20).
- [ ] **AC-5** Team visibility holds in lists, search, counts, direct reads, real time and MCP; states expire on time (FR-11).
- [ ] **AC-6** Warnings and each escalation level fire once, reach the reporting-line manager and stop when met; next reply
      runs per customer message (advanced: warnings, escalation, next reply; FR-43, FR-45).
- [ ] **AC-7** A follow-the-sun handover moves the right tickets with a summary; time-off reassignment is offered (advanced:
      follow-the-sun) (FR-18, FR-19).
- [ ] **AC-8** A contract's calendar in the customer's time zone sets due times and its hours warn at 80 % (advanced:
      contracts) (FR-25, FR-60).
- [ ] **AC-9** On a seeded queue the forecast flags at-risk tickets; capacity counts tracked time; a rebalancing proposal
      applies only when accepted (advanced: forecast, capacity; FR-20, FR-59, FR-63).
- [ ] **AC-10** Seeded trends give each support health band with reasons, shown on the CRM organisation page, and the
      change starts a flow (advanced: support health; FR-61, FR-62).
- [ ] **AC-11** Agent home, manager dashboard, comparisons, customer stats and the analytics tab show correct figures under
      the access rules and update live (advanced: live dashboards; FR-51–FR-54).
- [ ] **AC-12** The fourteen reports of FR-57 appear in the Support category of the report catalogue and return correct
      figures on seeded data; cost to serve only for cost viewers (advanced: cost to serve).
- [ ] **AC-13** A test record type with declared statuses gets clocks, breaches and escalation from the engine (FR-48).
- [ ] **AC-14** Feature off or service levels off: no clock runs and nothing is shown; tickets behave as before (FR-1).
- [ ] **AC-15** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-1).
- [ ] Works on PostgreSQL, MySQL and SQLite with both ORMs; all functional requirements have a passing test.

## 8. Open Questions

- First response never pauses unless a policy says so; replies of AI responders do not count by default. Default applied.
- Tickets without a team stay visible to every agent when visibility is restricted (setting). Default applied.
- A customer message on a closed ticket starts a follow-up ticket with fresh clocks (as `helpdesk-tickets`). Default applied.
- Support health weights ship equal and are editable; no automatic action without a flow. Default applied.

## 9. Constitution Gates

- [x] I Plugin-first — modules of the `helpdesk` plugin; extends platform teams, assignment rules and calendars by ports.
- [x] II Tenant/organization scoping — agents, rules, calendars, policies, clocks, facts and health are scoped.
- [x] III Both ORMs, additive migrations — new tables on three dialects; no existing column changed.
- [x] IV Default-off flag; nothing removed — `FEATURE_HELPDESK` plus an organization setting for service levels.
- [x] V Contracts and API first — contracts, REST, GraphQL reads and report sources before screens.
- [x] VI Permissions, privacy, security — permission keys, team visibility, agent figures and costs restricted.
- [x] VII Real-time through the event bus — clock events on the outbox; live badges and dashboards over the channel.
- [x] VIII i18n and accessibility — keys in every locale; charts with text alternatives.
- [x] IX Tests accompany the change — golden calendar cases, ORM parity, dialect specs, rendering tests.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md) · Tickets: [`helpdesk-tickets`](../helpdesk-tickets/spec.md)
- Works with: [`automation-and-notifications`](../automation-and-notifications/spec.md),
  [`time-off-management`](../time-off-management/spec.md), [`hr-core-lifecycle`](../hr-core-lifecycle/spec.md),
  [`record-views-and-search`](../record-views-and-search/spec.md), [`approval-workflows`](../approval-workflows/spec.md)
- Code: `packages/core/src/lib/{organization-team,organization-team-employee,skills,employee-availability,official-holiday,invite,time-tracking,rule,reports,dashboard,tasks}/`,
  `packages/plugins/realtime/src/lib/`, `packages/plugins/task-automations/src/lib/`
