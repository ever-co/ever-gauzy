# Task Breakdown: CRM engagement

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `crm-engagement`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind `FEATURE_CRM`: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it.
- Paths are relative to the repository root; `crm/` means `packages/plugins/crm/src/lib/` and `crmui/` means
  `packages/plugins/crm-ui/src/lib/` (both created by `crm-leads-and-deals`). Each new service, controller or pure module
  ships with a `.spec.ts` beside it.
- Starts after `crm-leads-and-deals` T1–T9, T26 and T28 (plugin, settings, events, record types) have landed.
- Plan phase 1 (surface what exists) = T1–T12 and T23, with the record tabs, avatars, counts and unread marks of T33,
  T34 and T36 and the read tools of T39 (their status, service level and availability parts stay hidden while T17, T22
  and T24 are absent, as for an absent plugin); phase 2 (depth) = the rest of phases 1–4; phase 3 (advanced) = phase 5.
- Depends on, each behind a port with the fallback of plan §7: the timeline and the note kind of comments of
  `record-views-and-search`, the sending contract of `email-and-communications`, the assignment engine of
  `automation-and-notifications`, `SERVICE_LEVEL_ENGINE` of `helpdesk-sla-routing-and-analytics`, record rules of
  `access-control-and-security`, the reporting line of `hr-core-lifecycle`.
- Builds on, unchanged in shape: core `comment`, `task`, `task_view` and `task-views-ui`, `resource_link` record target
  (`crm-leads-and-deals` T2–T3), `employee_recent_visit`, `activity_log`, `job_execution`, the operation runtime and bulk
  executor, the Inbox hand-off, the settings store and permission contributions.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts `packages/contracts/src/lib/crm-engagement.model.ts` and `crm-service-level.model.ts` (plan §3),
  port tokens `CRM_AVAILABILITY`, `CRM_DOCUMENTS`, `CRM_TERRITORIES`, `CRM_TRANSCRIPTS`, `CRM_CAPTURE_SOURCES`,
  `CRM_ENGAGEMENT_FACTS`, `CRM_SALES_HIERARCHY`; exports in `packages/contracts/src/index.ts`. Test: enum and type
  guard specs.
- [ ] **T2**. Engagement keys in `crm/crm.settings.ts` (plan §3) and the `crm_list_item.category` column
  (`crm/settings/entities/crm-list-item.entity.ts`); migration
  `crm/database/migrations/1791000051300-AddCrmEngagementSettingsColumns.ts`. Test: migration spec on SQLite;
  PostgreSQL and MySQL in the migration suite; settings defaults resolve.
  Migration timestamps: `1791000051300` to `1791000051399` (`packages/plugins/crm`).
- [ ] **T3**. Entities and MikroORM repositories `crm/engagement/entities/crm-engagement-state.entity.ts`,
  `crm/engagement/entities/crm-response-fact.entity.ts`, `crm/email/entities/crm-user-preference.entity.ts` (capture
  choices and identity only), `crm/engagement/entities/crm-task-overdue-mark.entity.ts`; migration
  `crm/database/migrations/1791000051310-CreateCrmEngagementTables.ts`. Test: migration spec, entity metadata spec for
  both ORMs.
- [ ] **T4** (parallel). Entities `crm/hierarchy/entities/crm-hierarchy-node.entity.ts` (exceptions only),
  `crm/capture/entities/crm-capture-entry.entity.ts`, `crm/relationships/entities/crm-relationship.entity.ts`,
  `crm/coaching/entities/crm-coaching-fact.entity.ts`; migration
  `crm/database/migrations/1791000051320-CreateCrmHierarchyCaptureRelationshipTables.ts`. Test: migration spec.
- [ ] **T5**. Permission contributions `CRM_SLA_MANAGE`, `CRM_HIERARCHY_MANAGE`, `CRM_COACHING_VIEW`,
  `CRM_SELLING_COST_VIEW` with `defaultFor` in `crm/crm.permissions.ts`; no seed migration. Test: registry spec (grants
  per role for a new tenant; reload adds missing rows).
- [ ] **T6**. Bootstrap: communication statuses and the "CRM tasks" system task view in
  `crm/settings/crm-bootstrap.service.ts` (`ensureSeeded`); rebuild `crm/engagement/crm-engagement-rebuild.operation.ts`
  as an operation type of the core runtime (states from sources, members copied to open assignments). Test: idempotent
  reruns; existing members become assignments once and the members list is unchanged; one live rebuild per organization.

## Phase 2 — Services, endpoints, events

- [ ] **T7**. Timeline sources `crm/engagement/crm-activity.timeline-source.ts` (stage, owner, assignee, conversion,
  merge, status, service level, task entries) and `crm/engagement/crm-carry-forward.timeline-source.ts` (source lead and
  child records, marked, deduplicated) registered in `RECORD_TIMELINE_SOURCES`; `/crm/:type/:id/timeline` in
  `crm/engagement/crm-engagement.controller.ts`. Test: carry-forward once per entry, unreadable record dropped, private
  entry only for author; existing contact comments listed as comments without a copy.
- [ ] **T8**. Engagement consumer `crm/engagement/crm-engagement.consumer.ts` (counts, last activity, unread hints, the
  modified-time bumps of `bumpOnComment` and `bumpOnCommunication`) and `/crm/:type/:id/engagement` in
  `crm/engagement/crm-engagement.controller.ts`. Test: counts after add, remove and merge events; replayed event
  counted once; last activity moved by a person's entry and not by an automation that sends nothing; bump only with the
  switch on.
- [ ] **T9**. Unread marks from core `employee_recent_visit` (`crm/engagement/crm-unread.ts`) for owners and assignees;
  an opening keeps the row's earlier `visitedAt` in its `data` as `previousVisitedAt` before the upsert.
  Test: mark set by another user's entry, cleared on opening; `previousVisitedAt` holds the opening before.
- [ ] **T10**. Task links `crm/activity/crm-task.service.ts` (create through `TaskCreateCommand`, no project, link as a
  `resource_link` row with `targetEntity = Task`, reassign closes previous to-do), `/crm/:type/:id/tasks` in
  `crm/activity/crm-task.controller.ts`, the link filter of the "CRM tasks" system view in the task list query
  (`packages/core/src/lib/tasks/views/view-filters.ts`, `view-tasks.service.ts`), conversion carry-over (link rows moved
  to the deal). Test: e2e on SQLite; task in assignee's list and in the view; conversion moves open tasks only.
- [ ] **T11**. Overdue job `crm/schedule/crm-task-overdue.{scheduler,worker,service}.ts` with the inline fallback; due
  times taken from the window after the last completed `job_execution` of the job; each event appended with its
  `crm_task_overdue_mark` row in one transaction (entity of T3), and the close path in `subscriber:crm-engagement` raising a task closed after its due
  time that no run has raised, and the reschedule path reading the window's `Task` update entries of the core activity
  log for superseded due times (plan §8). Test: one event per task and due time; catch-up after a missed run; a run that
  failed after emitting is rerun and raises nothing twice; a task open at its due time and closed during worker downtime
  raises exactly one late event, and a task closed before its due time raises none; a task whose due time passes during
  worker downtime and that is rescheduled before the next run raises exactly one late event for the earlier due time
  and later one for the new due time if it passes open; a reschedule whose update also closes the task raises the
  earlier due time from `previousValues.status`, a reschedule of a task closed before it raises nothing, and an entry
  that records no status raises the earlier due time.
- [ ] **T12** (parallel). Notes page `/crm/notes` over core comments of the note kind on CRM records (first line as
  title, pin author and time from the activity log), mention checks for non-readers. Files:
  `crm/activity/crm-notes.service.ts`, `crm/activity/crm-notes.controller.ts`,
  `crmui/components/crm-notes-page/crm-notes-page.component.ts`. Test: filters; warning path; a note is the same row in
  the record's Comments thread filtered by kind.
- [ ] **T13**. Files `crm/activity/crm-files.service.ts` and `crm/activity/crm-files.controller.ts` through
  `CRM_DOCUMENTS` (docs link service), upload limits per type (none beyond the docs plugin's own until the organization
  sets them), email and comment attachments listed with origin. Test: limit refusal names the limit; with no limit set,
  a file the documents panel accepts is accepted; unbound port hides the route.
- [ ] **T14**. Composer prefill `crm/email/crm-compose.service.ts` (recipients order, "do not contact" exclusion with
  reason from the consent records, identity and signature defaults, templates of the type, subject pattern from
  `user.uiPreferences.crm`) and `/crm/:type/:id/compose`, `/crm/me/preferences` in `crm/email/crm-email.controller.ts`
  (one form over `crm_user_preference`, UI preferences and the `crm.nudge` notification preference). Test: unit specs for
  ordering and exclusions; each value saved in its own store.
- [ ] **T15**. CRM template tokens registered with the communications template registry
  (`crm/email/crm-template-tokens.ts`); scheduling presets (`crm/email/schedule-presets.ts`, pure, time zone and
  working hours). Test: token rendering on a deal; presets across a daylight-saving change.
- [ ] **T16**. Communication consumer: sent and received messages linked to CRM records, converted-lead replies linked to
  the deal, `crm.record.replied`, response facts. Files: `crm/email/crm-communications.consumer.ts`. Test: reply matched
  to two leads updates both.
- [ ] **T17**. Communication status `crm/engagement/crm-communication-status.service.ts` (switches, manual set,
  automation action `crm.set_communication_status`), `/crm/:type/:id/communication-status`, system view "Awaiting our
  reply". Test: outbound and inbound flips; switch off keeps status.
- [ ] **T18** (parallel). Create from email `crm/email/crm-create-from-message.service.ts`,
  `/crm/messages/:id/create-record` (name split, company from non-public domain, duplicate check of
  `crm-leads-and-deals`). Test: refused on sent mail.
- [ ] **T19**. Messages: conversation tab data, owner notice on incoming message, number change confirmation, month usage
  per sending account. Files: `crm/email/crm-messages.service.ts`, `crm/email/crm-email.controller.ts`. Test: e2e with a
  fake text adapter.
- [ ] **T20**. Service levels: `crm/service-levels/crm-service-level.declarations.ts` (declare `crm.lead`, `Deal` with
  stage kinds, reply events, temperature as priority), policy and calendar routes on the engine
  (`crm/service-levels/crm-service-level.controller.ts`, `crm/service-levels/crm-service-level.service.ts`), condition
  validation against an empty record, default lock, impact and preview. Depends on: engine record type on policies and
  calendars in `helpdesk-sla-routing-and-analytics` T31. Test: e2e with the engine bound; refusal with it unbound.
- [ ] **T21**. Engine signals and mirror: `crm/service-levels/crm-sla.signals.ts` (first inbound, replies, on-hold
  pause, end on conversion, loss and win), consumer `crm/service-levels/crm-sla.consumer.ts` re-publishing `crm.sla.*`
  and mirroring state into `crm_engagement_state`; warnings and breach notices to owner and hierarchy manager. Test:
  AC-7 golden case on three dialects.
- [ ] **T22**. First response facts without the engine (elapsed time) and with it (working time); the record's service
  level `/crm/:type/:id/service-level` and `/crm/service-levels/due`, palette provider for responses due within 24 h,
  system view "Response due". Files: `crm/service-levels/crm-first-response.service.ts`,
  `crm/service-levels/crm-service-level.controller.ts`, `crm/service-levels/crm-response-due.palette-provider.ts`. Test:
  both modes.
- [ ] **T23**. Assignment: record types `crm.lead` and `Deal` for the engine, owner sync (`crm/assignment/crm-owner-sync.ts`:
  owner is an assignee, owner change closes the old assignment), contact members mirror (mirrored members marked; a
  closed assignment removes only a mirrored member), owner and open assignees carried to the deal at conversion and
  kept on the person, manual and bulk assign routes (bulk through the core bulk executor) in
  `crm/assignment/crm-assignment.controller.ts`, `crm/assignment/crm-assignment.service.ts`. Test: `409` on concurrent
  assignment; bulk 200 with 5 refused; a member picked by hand stays after an owner change; conversion carries owner
  and open assignees.
- [ ] **T24**. Pool filter `crm/assignment/crm-pool-filter.ts` registered with `registerAssignmentPoolFilters`
  (availability order, time off and working hours last, skip reasons), `CRM_AVAILABILITY` bound to the helpdesk agent
  states adapter with the realtime presence fallback (`crm/availability/crm-availability.service.ts`),
  `/crm/availability` and `/crm/availability/me` (`crm/availability/crm-availability.controller.ts`). Test: ordering
  cases; fallback presence mapping; own state with end time.
- [ ] **T25**. Rules for CRM types: `/crm/assignment-rules` (filtered engine rules, duplicate, no-people refusal, last
  assignee) in `crm/assignment/crm-assignment-rules.controller.ts`, run triggers (created without owner, reopened, owner
  deactivated, on demand with preview), channel coverage check `crm/assignment/coverage.ts` (pure: overlaps, invalid
  intervals, catch-all). Test: unit specs for coverage; e2e run.
- [ ] **T26** (parallel). Territory manager display and pool member through `CRM_TERRITORIES`. Files:
  `crm/assignment/crm-territories.ts`. Test: unbound port hides it.
- [ ] **T27**. Visibility: record type registrations for record rules (owner, assignee, territory paths; always-visible
  flag), rule templates with impact preview `/crm/access/rule-templates`, share carry-over at conversion. Depends on:
  registration flag in `access-control-and-security`. Files: `crm/access/crm-record-rules.registration.ts`,
  `crm/access/crm-rule-templates.service.ts`, `crm/access/crm-access.controller.ts`. Test: lists and counts under each
  template; share expiry.
- [ ] **T28**. Sales hierarchy `crm/hierarchy/crm-hierarchy.service.ts` (effective tree from `HR_REPORTING_LINE`,
  fallback team managers, plus exceptions; in-memory subtree with a per-organization cache invalidated by placement, team
  and exception changes; loop and capability checks, moves, removals with destinations, history written to
  `activity_log`), `/crm/hierarchy/**` in `crm/hierarchy/crm-hierarchy.controller.ts`, `ACCESS_REPORTING_LINE_SOURCES`
  entry, `CRM_SALES_HIERARCHY` port, refusal without record rules, deactivation notice. Test: unit specs for tree
  resolution with and without exceptions; e2e visibility on and off; an exception never changes the reporting line.
- [ ] **T29**. Calendar participant source and meetings on the timeline (registry entry for `calendar-and-scheduling`).
  Files: `crm/engagement/crm-participant-source.ts`, `crm/engagement/crm-meetings.timeline-source.ts`. Test:
  participants from a saved view capped at 100.
- [ ] **T30**. `CRM_ENGAGEMENT_FACTS` port for `crm-forecasting-and-analytics` (`crm/engagement/crm-engagement-facts.ts`)
  and report definitions of spec FR-105 (`crm/engagement/reports/*.ts`) listed as core `report` rows of the "Sales"
  category (keyed `FEATURE_CRM` in the shared catalogue feature filter), with the read-only fallback viewer.
  Test: figures on the demo data set.
- [ ] **T31**. Events and declarations: outbox appends for §5, automation triggers and the status action, webhook
  catalogue entries, notification categories. Files: `crm/events/crm-engagement.events.ts`,
  `crm/events/crm-engagement.declarations.ts`. Test: one event per change; deduplicated delivery; a hint reaches an open
  record page within 2 s.
- [ ] **T32** (parallel). GraphQL reads `crmEngagement`, `crmTimeline`, `crmTasks`, `crmHierarchy`. Files:
  `crm/graphql/crm-engagement.resolver.ts`, `crm/graphql/crm-engagement.schema.ts`. Test: resolver specs.
- [ ] **T50**. Feature gate: every engagement controller and GraphQL field carries `@FeatureFlag(FEATURE_CRM)`; the
  scheduled jobs and the `subscriber:crm-engagement` consumer skip organizations with the feature off and append no
  event for them. Files: `crm/engagement/crm-engagement-feature.guard.ts`, `crm/engagement/crm-engagement-routes.e2e-spec.ts`.
  Test: e2e walking every route of plan §4 answers `404` with `FEATURE_CRM` off; a job run and a replayed event write
  nothing for that organization (FR-1).

## Phase 3 — UI surfaces

- [ ] **T33**. Record page tabs and header in `crm-ui` (timeline tabs, status chip, service level badge, assignees
  popover, availability indicators, composer and call shortcuts, scheduled messages with edit, send now and cancel),
  `CRM.ENGAGEMENT.*` keys in every locale. Files: `crmui/components/crm-record-tabs/crm-record-tabs.component.ts`,
  `crmui/components/crm-record-header/crm-record-header.component.ts`,
  `crmui/components/crm-assignees-popover/crm-assignees-popover.component.ts`,
  `packages/ui-core/i18n/assets/i18n/*.json`. Test: component specs; tabs of absent plugins hidden.
- [ ] **T34**. "CRM tasks" view in `task-views-ui` (list, board, record filter, side panel opening the record) linked
  from the CRM menu, and the Notes page. Files: `packages/plugins/task-views-ui/src/lib/task-views-ui.plugin.ts`,
  `crmui/crm-ui.routes.ts`. Test: component specs; no CRM task board route exists.
- [ ] **T35**. Settings → CRM tabs: Service levels (policies, conditions builder, targets, calendars, impact, preview),
  Assignment (rules, coverage grid), Communication (statuses, switches, usage), Visibility, Files. Files:
  `crmui/components/crm-settings-service-levels/crm-settings-service-levels.component.ts`,
  `crmui/components/crm-settings-assignment/crm-settings-assignment.component.ts`,
  `crmui/components/crm-settings-communication/crm-settings-communication.component.ts`,
  `crmui/components/crm-settings-visibility/crm-settings-visibility.component.ts`,
  `crmui/components/crm-settings-files/crm-settings-files.component.ts`. Test: component specs.
- [ ] **T36**. Lists and boards: count badges, unread dot, status and service level columns, system views, palette
  providers (responses due, linked tasks overdue or due within 7 days). Files:
  `crmui/components/crm-engagement-cells/crm-engagement-cells.component.ts`, `crm/engagement/crm-system-views.ts`,
  `crm/activity/crm-tasks-due.palette-provider.ts`. Test: rendering at 2,000 cards without per-card requests.
- [ ] **T37**. Hierarchy editor (reporting line with exceptions marked, drag and drop, keyboard move, back to reporting
  line, removal dialog, history) and My CRM preferences. Files:
  `crmui/components/crm-hierarchy-editor/crm-hierarchy-editor.component.ts`,
  `crmui/components/crm-preferences/crm-preferences.component.ts`. Test: keyboard-only move; loop refused in the UI.
- [ ] **T38** (parallel). Phone use of the installed web app: record tabs, notes, status and assignees at 360 px; a note
  typed offline is kept and sent on reconnect. Files: `crmui/services/crm-offline-notes.service.ts`,
  `crmui/components/crm-record-tabs/crm-record-tabs.component.scss`. Test: offline note spec.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T39**. MCP tools `packages/mcp-server/src/lib/tools/crm-engagement.ts` (plan §7) with `preview` on writers;
  `packages/mcp-server/src/lib/tools/register-all-tools.ts`; `AiChatToolRegistry` registration. Test: preview writes
  nothing; tool-to-route spec.
- [ ] **T40**. OpenAPI regenerated; SDK regeneration noted for release; personal data handlers for preferences and
  capture entries. Files: `crm/privacy/crm-personal-data.handlers.ts`, `packages/core/src/lib/bootstrap/swagger.ts`.
  Test: export contains a user's preferences.
- [ ] **T41**. User docs page and `docs/specs/README.md` row; spec status `Implemented` when phase 5 lands. Test: docs build.

## Phase 5 — Advanced capabilities

- [ ] **T42**. Routing depth: territory, language, skills and open-record cap in the pool filter; "why this person?"
  route and popover. Files: `crm/assignment/crm-pool-filter.ts`, `crm/assignment/crm-assignment-explain.service.ts`,
  `crmui/components/crm-assignment-explain/crm-assignment-explain.component.ts`. Test: each narrowing with its skip
  reason.
- [ ] **T43**. Absence hand-over `crm/schedule/crm-absence-handover.{scheduler,worker,service}.ts` and
  `/crm/assignments/handover`. Test: one proposal per record and absence.
- [ ] **T44**. Capture `crm/capture/crm-capture.service.ts` over `CRM_CAPTURE_SOURCES` bound to the Inbox hand-off
  (`INBOX_EMAIL_HANDOFFS`) for own and team mailboxes and to synced calendars (modes, ceiling, exclusions,
  internal-only rule, private marks, unknown participants proposed), weekly digest job
  (`crm/schedule/crm-capture-digest.scheduler.ts`), `/crm/capture/**` (`crm/capture/crm-capture.controller.ts`),
  capture page (`crmui/components/crm-capture-page/crm-capture-page.component.ts`). Test: excluded domain and private
  thread never linked; ceiling caps a user's choice.
- [ ] **T45**. Relationships `crm/relationships/crm-relationship.job.ts` (strength, bands, going quiet, introductions) and
  their tab (`crmui/components/crm-relationships-tab/crm-relationships-tab.component.ts`). Test: unit specs on fixed
  interaction sets; band change event; a repeated nightly run keeps one overall row (`userKey` `*`) per party.
- [ ] **T46**. Coaching (`crm/coaching/crm-coaching.service.ts`, `crm/coaching/crm-coaching.job.ts`,
  `crm/coaching/crm-reply-nudge.job.ts`: facts, medians, team view scope, nudge job with draft action honouring the
  user's `crm.nudge` notification preference) and page (`crmui/components/crm-coaching-page/crm-coaching-page.component.ts`).
  Test: one nudge per message; none when the user switched nudges off; team ranking hidden unless opted in.
- [ ] **T47**. "What changed?" and summaries (`crm/summaries/crm-what-changed.service.ts`,
  `crm/summaries/crm-summaries.service.ts`, `crm/summaries/crm-summaries.controller.ts`: previous visit
  (`data.previousVisitedAt`) from `employee_recent_visit`, grouping, `CRM_TEXT_GENERATION` over the agent runtime, `CRM_TRANSCRIPTS`, approval writes the
  note as a comment of the note kind with sources). Test: without provider; proposal writes nothing; entries added between
  the previous and the current opening are listed after the opening cleared the unread mark.
- [ ] **T48**. Selling effort `crm/effort/crm-effort.service.ts` (time logs on linked tasks and calls, rates, cost
  permission) and the deal tab (`crmui/components/crm-effort-tab/crm-effort-tab.component.ts`); cost of sale into
  `CRM_ENGAGEMENT_FACTS`. Test: figures on the demo data set; cost hidden without the key.
- [ ] **T49**. Demo data: timelines, tasks, notes, statuses, a hierarchy and policies in the demo seed. Files:
  `crm/seeds/crm-engagement-demo.seed.ts`, called from `onPluginRandomSeed` in `crm/crm.plugin.ts`. Test: demo seed on
  SQLite.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Presence and settings | T39, T50 |
| FR-2 | §3.1 Presence and settings | T20, T24, T33, T35 |
| FR-3 | §3.1 Presence and settings | T2, T35 |
| FR-4 | §3.1 Presence and settings | T6, T23 |
| FR-5 | §3.2 Activity timeline | T7, T33 |
| FR-6 | §3.2 Activity timeline | T33 |
| FR-7–FR-9 | §3.2 Activity timeline | T7 |
| FR-10 | §3.2 Activity timeline | T7, T31 |
| FR-11 | §3.2 Activity timeline | T8, T36 |
| FR-12 | §3.2 Activity timeline | T9, T36 |
| FR-13 | §3.2 Activity timeline | T8 |
| FR-14 | §3.3 Notes and comments | T12, T33 |
| FR-15 | §3.3 Notes and comments | T12 |
| FR-16 | §3.3 Notes and comments | T8, T12 |
| FR-17 | §3.3 Notes and comments | T12, T34 |
| FR-18 | §3.3 Notes and comments | T7 |
| FR-19 | §3.4 Tasks | T10 |
| FR-20 | §3.4 Tasks | T10, T33 |
| FR-21 | §3.4 Tasks | T10 |
| FR-22 | §3.4 Tasks | T11 |
| FR-23 | §3.4 Tasks | T6, T10, T34 |
| FR-24 | §3.4 Tasks | T11, T36 |
| FR-25 | §3.4 Tasks | T10 |
| FR-26 | §3.4 Tasks | T48 |
| FR-27 | §3.5 Email and messages on CRM records | T14, T33 |
| FR-28 | §3.5 Email and messages on CRM records | T14 |
| FR-29 | §3.5 Email and messages on CRM records | T16, T33 |
| FR-30 | §3.5 Email and messages on CRM records | T15, T33 |
| FR-31 | §3.5 Email and messages on CRM records | T16 |
| FR-32 | §3.5 Email and messages on CRM records | T16, T17 |
| FR-33 | §3.5 Email and messages on CRM records | T15 |
| FR-34–FR-35 | §3.5 Email and messages on CRM records | T14 |
| FR-36–FR-38 | §3.5 Email and messages on CRM records | T19 |
| FR-39 | §3.5 Email and messages on CRM records | T18 |
| FR-40 | §3.6 Communication status | T2, T6, T17 |
| FR-41 | §3.6 Communication status | T8, T17 |
| FR-42 | §3.6 Communication status | T17 |
| FR-43 | §3.6 Communication status | T17, T36 |
| FR-44 | §3.7 Calls, meetings and events | T33 |
| FR-45–FR-46 | §3.7 Calls, meetings and events | T29 |
| FR-47–FR-49 | §3.8 Files | T13 |
| FR-50 | §3.9 First response and service levels | T22 |
| FR-51–FR-55 | §3.9 First response and service levels | T20 |
| FR-56–FR-57 | §3.9 First response and service levels | T21 |
| FR-58 | §3.9 First response and service levels | T22, T33 |
| FR-59 | §3.9 First response and service levels | T22, T36 |
| FR-60 | §3.9 First response and service levels | T20, T35 |
| FR-61 | §3.9 First response and service levels | T21 |
| FR-62 | §3.9 First response and service levels | T20, T22 |
| FR-63 | §3.10 Owner, assignees and assignment rules | T23 |
| FR-64 | §3.10 Owner, assignees and assignment rules | T23, T33, T36 |
| FR-65 | §3.10 Owner, assignees and assignment rules | T33 |
| FR-66–FR-67 | §3.10 Owner, assignees and assignment rules | T25 |
| FR-68 | §3.10 Owner, assignees and assignment rules | T24 |
| FR-69 | §3.10 Owner, assignees and assignment rules | T42 |
| FR-70 | §3.10 Owner, assignees and assignment rules | T25 |
| FR-71 | §3.10 Owner, assignees and assignment rules | T23 |
| FR-72 | §3.10 Owner, assignees and assignment rules | T26 |
| FR-73 | §3.10 Owner, assignees and assignment rules | T43 |
| FR-74–FR-75 | §3.11 Availability | T24 |
| FR-76–FR-79 | §3.12 Visibility and sharing | T27 |
| FR-80–FR-81 | §3.13 Sales hierarchy | T28, T37 |
| FR-82–FR-83 | §3.13 Sales hierarchy | T28 |
| FR-84 | §3.13 Sales hierarchy | T28, T30 |
| FR-85 | §3.13 Sales hierarchy | T28 |
| FR-86–FR-90 | §3.14 Activity capture (advanced) | T44 |
| FR-91–FR-93 | §3.15 Relationship signals (advanced) | T45 |
| FR-94–FR-96 | §3.16 Reply-time coaching (advanced) | T46 |
| FR-97–FR-99 | §3.17 Summaries (advanced) | T47 |
| FR-100 | §3.18 API, MCP, events and reports | T32, T40 |
| FR-101–FR-102 | §3.18 API, MCP, events and reports | T39 |
| FR-103 | §3.18 API, MCP, events and reports | T31, T45 |
| FR-104 | §3.18 API, MCP, events and reports | T30, T48 |
| FR-105 | §3.18 API, MCP, events and reports | T30 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off; enabling it in dev shows the feature end to end; with it off the contact page behaves as before.
- Constitution gates in `spec.md` §9 confirmed.
- Each sibling plugin switched off in turn leaves the rest working with the fallback of plan §7.
- Timeline and board budgets of spec §4 measured on a data set with 10,000 entries per record and 2,000 cards.
- Every acceptance criterion of `spec.md` §7 demonstrated on the demo data set.
