# Task Breakdown: Helpdesk service levels, routing and analytics

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `helpdesk-sla-routing-and-analytics`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind the feature flag: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it.
- Starts after `helpdesk-tickets` T1 to T12 (plugin, task columns, ticket extension, lifecycle and visibility hooks).
  Paths: `hd/` = `packages/plugins/helpdesk/src/lib/`, `ui/` = `packages/plugins/helpdesk-ui/src/lib/`.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts `packages/contracts/src/lib/helpdesk-service.model.ts` (enums, interfaces, events,
      `SERVICE_LEVEL_ENGINE`, `HELPDESK_CUSTOMER_STATS`, consumed ports) exported from `packages/contracts/src/index.ts`;
      `RuleOwnerType` gains `HELPDESK_ROUTING` and `HELPDESK_SLA_POLICY` in `packages/contracts/src/lib/rule.model.ts`.
      Test: shape spec.
- [ ] **T2**. Entities `hd/agents/helpdesk-agent.entity.ts`, `hd/agents/helpdesk-availability-state.entity.ts`,
      `hd/agents/helpdesk-team-profile.entity.ts`, `hd/routing/helpdesk-follow-the-sun-group.entity.ts`,
      `hd/routing/helpdesk-routing-rule.entity.ts`, `hd/routing/helpdesk-routing-decision.entity.ts` and migration
      `hd/database/migrations/1791000052100-CreateHelpdeskAgentAndTeamTables.ts`. Test: SQLite
      migration; dialect snapshots; ORM parity. Migration timestamps: `1791000052100` to `1791000052199` (`packages/plugins/helpdesk`).
- [ ] **T3** (parallel). Entities `hd/service-levels/helpdesk-service-calendar.entity.ts`,
      `helpdesk-sla-policy.entity.ts`, `helpdesk-sla-target.entity.ts`, `helpdesk-ticket-sla.entity.ts`,
      `helpdesk-sla-event.entity.ts`, `helpdesk-escalation-policy.entity.ts` and migration
      `hd/database/migrations/1791000052110-CreateHelpdeskServiceLevelTables.ts` (clock rows and events keyed by
      `recordType` and `recordId`, `taskId` for tickets only, `transitionSeq`). Test: as T2.
- [ ] **T4** (parallel). Entities `hd/analytics/helpdesk-ticket-fact.entity.ts`, `helpdesk-daily-fact.entity.ts`,
      `helpdesk-support-health.entity.ts`, `helpdesk-contract-usage.entity.ts`,
      `hd/routing/helpdesk-rebalance-proposal.entity.ts` and migration
      `hd/database/migrations/1791000052120-CreateHelpdeskAnalyticsTables.ts` (`helpdesk_daily_fact.employeeKey`). Test: as T2.
- [ ] **T5**. Permission contributions with `defaultFor` (plan §9) in `hd/helpdesk.plugin.ts` and the service setting
      contributions in `hd/helpdesk.settings.ts`; per-organization defaults on first use
      (`hd/service-levels/service-defaults.service.ts`: default calendar from the
      organization's working hours, week start and time zone, 24×7 when empty; states; inactive default policy). Test:
      grants after the contribution reload; idempotent defaults; calendar matches the organization's hours.
- [ ] **T6**. Assignment engine of `automation-and-notifications` (after its T36): `registerAssignmentPoolFilters(recordType, filter)` called
      before distribution, skip reasons in its decision rows. Files:
      `packages/plugins/task-automations/src/lib/assignment/assignment-pool-filters.ts`,
      `packages/plugins/task-automations/src/lib/assignment/assignment-rule.service.ts`. Test: no change without a
      filter; reasons recorded.

## Phase 2 — Services, endpoints, events

- [ ] **T7**. `hd/agents/`: agent profiles (time zone and language read from the employee's user), availability states
      with expiry, not-routable reasons (time off and working hours through `HELPDESK_AVAILABILITY`, appointment
      availability, presence), agent board. Files: `hd/agents/helpdesk-agent.service.ts`,
      `hd/agents/availability-state.service.ts`, `hd/agents/agent-routability.service.ts`,
      `hd/agents/agent-board.service.ts`, `hd/schedule/helpdesk-agent-states.scheduler.ts`. Test: approved time off and
      off-hours make an agent not routable; a timed state returns to the default; a changed user time zone moves the
      agent's hours.
- [ ] **T8**. Team profiles and the visibility predicate implementing the tickets' visibility hook (team membership through
      `task_team`, assignee through `task_employee`, follower through `entity_subscription`, teamless setting, all-access
      teams, `HELPDESK_TICKET_VIEW_ALL`). Files: `hd/agents/helpdesk-team-profile.service.ts`,
      `hd/agents/ticket-visibility.predicate.ts`. Test: e2e with a restricted agent on lists, search, counts, direct read,
      realtime audience and MCP.
- [ ] **T9**. `hd/routing/`: routing rules whose conditions are core `rule` rows (owner `HELPDESK_ROUTING`) evaluated by
      the core evaluator with the ticket rule scope, order, decisions, route on create, reopen and demand (`preview`; a
      selection as a core operation), "why here?". Files: `hd/routing/routing-rule.service.ts`,
      `hd/routing/ticket-rule-scope.ts`, `hd/routing/routing.engine.ts`, `hd/routing/routing-decision.service.ts`. Test:
      first match, continue flag, default team; no condition column outside `rule`.
- [ ] **T10**. Assignment through `HELPDESK_ASSIGNMENT` with the helpdesk pool filter (channel, language, skills, routable
      state tiers, maximum open, assign within team, "never unassigned"); manual and bulk assignment; take next. Files:
      `hd/routing/helpdesk-pool-filter.ts`, `hd/routing/ticket-assignment.service.ts`, `hd/routing/take-next.service.ts`.
      Test: skip reasons; nobody eligible leaves the ticket queued and tells the lead; take-next order; with "assign
      within team" on, a team change unassigns members of the old team.
- [ ] **T11**. Controllers and DTOs for agents, states, teams, follow-the-sun groups, service settings, routing and
      assignment; GraphQL reads. Files: `hd/agents/helpdesk-agent.controller.ts`,
      `hd/agents/availability-state.controller.ts`, `hd/agents/helpdesk-team.controller.ts`,
      `hd/routing/follow-the-sun-group.controller.ts`, `hd/service-levels/service-settings.controller.ts`,
      `hd/routing/routing-rule.controller.ts`, `hd/routing/ticket-routing.controller.ts`, `hd/agents/dto/`,
      `hd/routing/dto/`, `hd/graphql/helpdesk-service.resolver.ts`. Test: e2e per route with permissions; `404` with the
      feature off.
- [ ] **T12**. Events `helpdesk.agent.*`, `helpdesk.routing.*`, notification categories, automation triggers, streamed
      declarations with the visibility audience check. Files: `hd/events/helpdesk-service.events.ts`,
      `hd/events/helpdesk-notification-categories.ts`, `hd/events/helpdesk-automation-triggers.ts`. Test: one event per
      change; audience excludes non-readers.
- [ ] **T45**. Deactivation of agents and teams (FR-6, FR-10): deactivating an agent sends their open tickets through the
      team's assignment rule or to the team queue and tells the team lead; deactivating a team moves its open tickets to
      its fallback team. Files: `hd/agents/agent-deactivation.service.ts`, `hd/agents/helpdesk-team-profile.service.ts`.
      Test: an agent's open tickets are reassigned or queued and the lead gets one notice; a deactivated team's tickets
      land in the fallback team; a team without a fallback keeps its tickets and reports it.

## Phase 3 — UI surfaces

- [ ] **T13**. `ui/settings/`: agents and invitations, availability states, teams, routing rules (drag order, conditions
      builder over rule rows, preview). Files: `ui/settings/agents-settings/agents-settings.component.ts`,
      `ui/settings/availability-states-settings/availability-states-settings.component.ts`,
      `ui/settings/teams-settings/teams-settings.component.ts`,
      `ui/settings/routing-rules-settings/routing-rules-settings.component.ts`. Test: rendering; order persists.
- [ ] **T14**. Agent board `/pages/helpdesk/agents`, header state switcher, "why here?" popover on the ticket page. Files:
      `ui/components/agent-board/agent-board.component.ts`, `ui/components/agent-state-switcher/agent-state-switcher.component.ts`,
      `ui/components/routing-explain-popover/routing-explain-popover.component.ts`. Test:
      rendering; state change visible to colleagues.
- [ ] **T15** (parallel). Helpdesk dashboard widgets registered in the core widget registry
      (`packages/ui-core/shared/src/lib/dashboard/widgets/`), placeable on any core dashboard. Files:
      `ui/widgets/helpdesk-widgets.ts`. Test: a widget on a core
      dashboard shows the viewer's own scope only.
- [ ] **T16**. i18n keys `HELPDESK.ROUTING.*`, `HELPDESK.SLA.*`, `HELPDESK.ANALYTICS.*` in every locale. Files: `packages/ui-core/i18n/assets/i18n/`. Test: key check.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T17**. MCP `packages/mcp-server/src/lib/tools/helpdesk-service.ts`: `helpdesk_agents_list`,
      `helpdesk_agent_set_state`, `helpdesk_routing_explain`. Test: tool specs with permissions.
- [ ] **T18**. `apps/api/src/plugin-composition.ts`: `HELPDESK_ASSIGNMENT`, `HELPDESK_AVAILABILITY` bindings with fallbacks.
      Test: unbound ports fall back as plan §7 says.
- [ ] **T19**. OpenAPI regenerated (`packages/core/src/lib/bootstrap/swagger.ts`); SDK regeneration noted; docs pages;
      `docs/specs/README.md` row. Test: additive diff.

## Phase 5 — Service levels and analytics (plan phase 2)

- [ ] **T20**. `hd/service-levels/engine/working-time.ts` (pure): spans from weekly intervals, holidays and exceptions;
      add and measure working seconds in a time zone. Test: golden cases (breaks, holidays, exceptions, daylight-saving
      changes, 24×7); property test that measuring an added target returns it.
- [ ] **T21**. Calendars: validation, `HELPDESK_HOLIDAYS` binding to `TIME_OFF_WORKING_CALENDAR` with the organization's
      `official_holiday` rows as fallback, exceptions, year view. Files: `hd/service-levels/service-calendar.service.ts`,
      `hd/service-levels/service-calendar.controller.ts`, `hd/service-levels/holiday-source.ts`,
      `apps/api/src/plugin-composition.ts`. Test: invalid calendars refused naming the problem; used
      calendar not deletable; official holidays applied without the time-off plugin.
- [ ] **T22**. Policies and targets: conditions as core `rule` rows (owner `HELPDESK_SLA_POLICY`), validation, order,
      selection (contract, order, default), override with reason, impact count with recompute as a core operation,
      preview, nightly expiry. Files: `hd/service-levels/sla-policy.service.ts`, `hd/service-levels/sla-policy.controller.ts`,
      `hd/service-levels/sla-policy.selector.ts`, `hd/service-levels/sla-policy-impact.operation.ts`,
      `hd/schedule/helpdesk-policy-expiry.scheduler.ts`. Test: each selection path; keep versus recompute.
- [ ] **T23**. Clock state machine on the lifecycle hooks (also when a task screen changes the ticket's status or
      priority): attach, pause and resume on the waiting category, met on done, reopen, priority and policy change, merge,
      split, reset (setting and permission), outside-hours mark, working-time measures. Files:
      `hd/service-levels/clock-state-machine.ts`, `hd/service-levels/ticket-sla.service.ts`,
      `hd/service-levels/ticket-sla.lifecycle.ts`, `hd/service-levels/ticket-sla.controller.ts`. Test: every transition of spec
      §3.7, including a status change through the task API; a 24-hour calendar clock started 09:00, paused 10:00 to
      12:00 and moved at 12:00 to a three-hour target gets a 14:00 due time and no breach, while a change to a
      one-hour target at 12:00 breaches at the change; pause, resume and a second pause in one cycle record three
      events; a retried transition records one.
- [ ] **T24**. Minute check job (`helpdesk.sla-check`): breaches at due time with internal comment and notices, catch-up,
      `nextCheckAt`. Files: `hd/schedule/helpdesk-sla-check.scheduler.ts`, `hd/service-levels/sla-check.worker.ts`,
      `hd/service-levels/sla-breach.service.ts`. Test: SQLite end to end with an hour of simulated downtime; each breach
      recorded once.
- [ ] **T25**. Badges and countdown in ticket lists and on the ticket, "due soon" ticket view, expected first response for
      acknowledgements and the portal. Files: `ui/components/sla-badge/sla-badge.component.ts`,
      `ui/components/due-soon-view/due-soon-view.component.ts`, `hd/service-levels/expected-first-response.ts`. Test:
      badge text and colour per state; no extra query per row.
- [ ] **T26**. Facts: `subscriber:helpdesk-analytics`, `helpdesk.time-facts` (time logs of ticket tasks),
      `helpdesk.daily-facts`. Files: `hd/analytics/helpdesk-analytics.consumer.ts`, `hd/analytics/time-facts.job.ts`,
      `hd/analytics/daily-facts.job.ts`, `hd/schedule/helpdesk-facts.scheduler.ts`. Test: facts equal a recomputation from
      raw rows on seeded data; a repeated daily run writes one team total (`employeeKey` `*`) per team and day.
- [ ] **T27**. Analytics sources: agent home, manager dashboard with period deltas, agent comparison, stats per customer,
      contact and agent, per-ticket analytics, drill-down, access scoping. Files: `hd/analytics/analytics.service.ts`,
      `hd/analytics/analytics.controller.ts`, `hd/analytics/analytics-scope.ts`. Test: figures on seeded data; an agent
      sees only their own figures.
- [ ] **T28**. Angular agent home (helpdesk widgets, draggable, layout in UI preferences), manager dashboard (`chart.js`),
      analytics tab, calendar and policy pages. Files: `ui/pages/agent-home/agent-home.component.ts`,
      `ui/pages/manager-dashboard/manager-dashboard.component.ts`,
      `ui/components/ticket-analytics-tab/ticket-analytics-tab.component.ts`,
      `ui/settings/calendars-settings/calendars-settings.component.ts`,
      `ui/settings/sla-policies-settings/sla-policies-settings.component.ts`. Test: rendering; layout reset.
- [ ] **T29**. The fourteen reports of FR-57 as core `report` rows in the "Support" `report_category` (added at boot by
      slug, the category keyed `FEATURE_HELPDESK` in the shared catalogue feature filter, shown per organization through
      `report_organization`), each opening its helpdesk report view from the existing reports page; report builder
      definitions when that plugin is loaded. Files: `hd/analytics/helpdesk-report.contributions.ts`,
      `hd/analytics/helpdesk-reports.controller.ts`, `ui/reports/helpdesk-report-view.component.ts`,
      `apps/gauzy/src/app/pages/reports/`. Test: each report's figures on seeded data; the category hidden for
      organizations without the helpdesk; with the feature off the Reports page, menu and a new organization's report
      switches equal today's.
- [ ] **T30** (parallel). Agent invitations through core invites; acceptance creates the agent in its teams. Files:
      `hd/agents/agent-invitation.service.ts`, `hd/agents/helpdesk-agent.controller.ts` (`POST /agents/invite`). Test: resend
      and cancel; acceptance once.
- [ ] **T31**. `SERVICE_LEVEL_ENGINE` for other record types with a test record type. Files:
      `hd/service-levels/service-level-engine.ts`, `hd/service-levels/testing/test-record-type.ts`. Test: clocks and
      breach on the test type, stored and announced with its `recordType` and `recordId` and no task (warning and
      escalation on the test type are tested with the warning service and the runner in T35).
- [ ] **T32** (parallel). `HELPDESK_CUSTOMER_STATS` for the portal and the CRM organisation view; ratings through
      `HELPDESK_SATISFACTION` with "not available" fallback. Files: `hd/analytics/customer-stats.provider.ts`,
      `hd/analytics/satisfaction.reader.ts`. Test: another customer's tickets never counted.
- [ ] **T33**. MCP `helpdesk_ticket_sla`, `helpdesk_at_risk_tickets`, `helpdesk_dashboard`, `helpdesk_report_run`,
      `helpdesk_sla_policies_list`, `helpdesk_sla_preview`. Files: `packages/mcp-server/src/lib/tools/helpdesk-service.ts`.
      Test: tool specs.

## Phase 6 — Advanced capabilities (plan phase 3)

- [ ] **T34**. Next reply metric per customer message. Files: `hd/service-levels/next-reply.metric.ts`,
      `hd/service-levels/clock-state-machine.ts`. Test: starts and is met per spec FR-35; pauses with resolution.
- [ ] **T35**. Warnings and escalation policies: levels from warning or breach with notify (assignee, lead, manager through
      `HELPDESK_REPORTING_LINE` else the agent employee's `reportsToEmployeeId`, people, roles, destination), reassign,
      raise priority, tags, start a flow. Files: `hd/service-levels/sla-warning.service.ts`,
      `hd/service-levels/escalation-policy.service.ts`, `hd/service-levels/escalation-policy.controller.ts`,
      `hd/service-levels/escalation.runner.ts`. Test: each level once; stops when met; manager falls back to the lead
      without HR; a warning and an escalation level on the test record type of T31 are stored and announced with its
      `recordType` and `recordId` and no task.
- [ ] **T36**. Customer time zone calendars; `HELPDESK_CONTRACTS` with policy, calendar and support hours drawn down by
      tracked time, warnings at 80 % and 100 %. Files: `hd/service-levels/customer-time-zone.ts`,
      `hd/analytics/contract-usage.service.ts`, `hd/analytics/contract-usage.controller.ts`. Test: due times in the
      customer's zone; one warning per threshold and period.
- [ ] **T37**. Follow-the-sun groups and hand-over job with an assistant summary; time-off hand-over offers. Files:
      `hd/routing/follow-the-sun.service.ts`, `hd/routing/time-off-handover.service.ts`,
      `hd/schedule/helpdesk-follow-the-sun.scheduler.ts`. Test: the right
      tickets move once; return to the home team when set; tickets due during approved time off are offered once.
- [ ] **T38** (parallel). Capacity from tracked time in agent load; take-next and capacity assignment use it. Files:
      `hd/agents/agent-load.service.ts`, `hd/routing/take-next.service.ts`. Test: load
      matches tracked time and open tickets.
- [ ] **T39**. Breach forecast job and at-risk marks; rebalancing proposals applied only when a lead accepts. Files:
      `hd/analytics/breach-forecast.service.ts`, `hd/routing/rebalance-proposal.service.ts`,
      `hd/routing/rebalance-proposal.controller.ts`, `hd/schedule/helpdesk-forecast.scheduler.ts`. Test: seeded
      queue flags the expected tickets; dismissed proposals change nothing.
- [ ] **T40**. Support health job with bands, reasons and weights; band-change event; chip on panels and the support
      health signal on the CRM organisation view. Files: `hd/analytics/support-health.service.ts`,
      `hd/schedule/helpdesk-support-health.scheduler.ts`,
      `ui/components/support-health-chip/support-health-chip.component.ts`. Test: seeded trends give each band; event
      starts a flow.
- [ ] **T41** (parallel). Cost-to-serve report and cost scoping. Files: `hd/analytics/cost-to-serve.report.ts`,
      `hd/analytics/analytics-scope.ts`. Test: cost fields absent without `HELPDESK_COST_VIEW`.
- [ ] **T42**. Live dashboards, widgets and badges from streamed events, debounced to 5 s. Files:
      `ui/services/helpdesk-live.service.ts`, `ui/components/sla-badge/sla-badge.component.ts`. Test: a breach shows on an
      open dashboard within 5 s.
- [ ] **T43**. Benchmarks: 100,000 running clocks per minute check, dashboards and reports at five million tickets. Files:
      `hd/benchmarks/helpdesk-service-levels.bench.ts`. Test:
      spec §4 budgets on PostgreSQL and MySQL.
- [ ] **T44**. Provide the ports other features bind to (plan, **Consumer tokens answered**): `CRM_AVAILABILITY`, `HELPDESK_CUSTOMER_STATS`, `SERVICE_LEVEL_ENGINE`, `TELEPHONY_AVAILABILITY`, `TELEPHONY_OPEN_HOURS`. Files: `apps/api/src/plugin-composition.ts`. Test: one contract test per token over the shape its consumer plan states; with this feature off each consumer keeps its stated fallback.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Scope and compatibility | T5, T11 |
| FR-2 | §3.1 Scope and compatibility | T2, T7, T9, T10 |
| FR-3 | §3.1 Scope and compatibility | T1, T19 |
| FR-4 | §3.2 Agents and availability | T7, T11 |
| FR-5 | §3.2 Agents and availability | T30 |
| FR-6 | §3.2 Agents and availability | T7, T45 |
| FR-7–FR-8 | §3.2 Agents and availability | T7 |
| FR-9 | §3.2 Agents and availability | T7, T14 |
| FR-10 | §3.3 Teams and visibility | T8, T45 |
| FR-11 | §3.3 Teams and visibility | T8 |
| FR-12 | §3.3 Teams and visibility | T10 |
| FR-13 | §3.4 Routing and assignment | T9, T13 |
| FR-14 | §3.4 Routing and assignment | T9 |
| FR-15 | §3.4 Routing and assignment | T6, T10 |
| FR-16 | §3.4 Routing and assignment | T6, T10 |
| FR-17 | §3.4 Routing and assignment | T10, T11 |
| FR-18 | §3.4 Routing and assignment | T37 |
| FR-19 | §3.4 Routing and assignment | T37 |
| FR-20 | §3.4 Routing and assignment | T38 |
| FR-21 | §3.4 Routing and assignment | T39 |
| FR-22 | §3.5 Service calendars | T5, T20, T21 |
| FR-23 | §3.5 Service calendars | T20, T21 |
| FR-24 | §3.5 Service calendars | T21, T28 |
| FR-25 | §3.5 Service calendars | T36 |
| FR-26 | §3.6 Policies | T22, T28 |
| FR-27 | §3.6 Policies | T22 |
| FR-28 | §3.6 Policies | T22, T23 |
| FR-29 | §3.6 Policies | T22, T23 |
| FR-30 | §3.6 Policies | T22 |
| FR-31 | §3.6 Policies | T22 |
| FR-32 | §3.6 Policies | T22 |
| FR-33 | §3.7 Clocks | T20, T21, T23 |
| FR-34 | §3.7 Clocks | T23 |
| FR-35 | §3.7 Clocks | T34 |
| FR-36 | §3.7 Clocks | T23 |
| FR-37 | §3.7 Clocks | T23 |
| FR-38 | §3.7 Clocks | T23 |
| FR-39–FR-41 | §3.7 Clocks | T23 |
| FR-42 | §3.8 States, warnings, breaches and escalation | T23, T25 |
| FR-43 | §3.8 States, warnings, breaches and escalation | T35 |
| FR-44 | §3.8 States, warnings, breaches and escalation | T24 |
| FR-45 | §3.8 States, warnings, breaches and escalation | T35 |
| FR-46 | §3.8 States, warnings, breaches and escalation | T24 |
| FR-47 | §3.8 States, warnings, breaches and escalation | T25 |
| FR-48 | §3.9 Other record types | T31, T35 |
| FR-49 | §3.10 Dashboards | T15, T28 |
| FR-50 | §3.10 Dashboards | T27, T28 |
| FR-51 | §3.10 Dashboards | T15, T27 |
| FR-52–FR-53 | §3.10 Dashboards | T27 |
| FR-54 | §3.10 Dashboards | T27, T28 |
| FR-55 | §3.10 Dashboards | T32 |
| FR-56 | §3.10 Dashboards | T42 |
| FR-57 | §3.11 Reports | T29 |
| FR-58 | §3.11 Reports | T32 |
| FR-59 | §3.12 Forecast, contracts, health and cost | T39 |
| FR-60 | §3.12 Forecast, contracts, health and cost | T36 |
| FR-61 | §3.12 Forecast, contracts, health and cost | T40 |
| FR-62 | §3.12 Forecast, contracts, health and cost | T40 |
| FR-63 | §3.12 Forecast, contracts, health and cost | T41 |
| FR-64 | §3.13 API, MCP and events | T11, T27 |
| FR-65 | §3.13 API, MCP and events | T12, T24, T35, T40 |
| FR-66 | §3.13 API, MCP and events | T17, T33 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off; enabling it in dev shows the feature end to end.
- Constitution gates in `spec.md` §9 confirmed.
- Golden working-time cases pass on every dialect; no breach is recorded twice or at check time instead of due time.
- The automation assignment engine behaves as before when no pool filter is registered; the core rule evaluator and
  report catalogue behave as before for their other owners and categories.
- Every `(advanced)` requirement has its acceptance criterion passing.
