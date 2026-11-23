# Task Breakdown: Telephony

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `telephony`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold. A spec file named in a `Test:` clause without a full path sits under the `src/lib/` folder of the package the task changes (beside the file it tests).
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind `GAUZY_TELEPHONY_ENABLED` and `FEATURE_TELEPHONY`: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it.
- Paths: `tel/` means `packages/plugins/telephony/src/lib/`, `tui/` means `packages/plugins/telephony-ui/src/lib/`.
  Gate: every route, GraphQL field, menu entry, shell component and MCP tool of these tasks is gated by
  `FEATURE_TELEPHONY` (`@FeatureFlag`); the plugin is listed only when `GAUZY_TELEPHONY_ENABLED` is exactly `true`.
- Plan phase 1 (foundations) = T1–T13, T27, T30, T33; phase 2 (live calling) = the rest of phases 1–4; phase 3
  (advanced) = phase 5.
- Depends on, each behind a port with the fallback of plan §7: record rules (`access-control-and-security`),
  timeline registry (`record-views-and-search`), conversation sources and consent records with "do not contact"
  (`email-and-communications`), lead intake (`lead-capture-and-enrichment`), people channels (`crm-leads-and-deals`),
  service calendars (`helpdesk-sla-routing-and-analytics`), the agent runtime (`ai-agents-and-assistants`).
- Builds on, unchanged in shape: the Inbox provider accounts and secret box, core `employee_phone`, `resource_link`
  record target (`crm-leads-and-deals` T2–T3), `official_holiday`, the settings store and permission contributions.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts `packages/contracts/src/lib/telephony.model.ts` (plan §3, adapter and client contracts, directory
  entry), port tokens; add the phone metadata library; exports in `index.ts`. Files: `packages/contracts/src/lib/telephony.model.ts`,
  `packages/contracts/src/index.ts`, `package.json` (phone metadata library). Test: `packages/contracts/src/lib/telephony.model.spec.ts`, phase
  rank and capability guard specs.
- [ ] **T2**. Plugin scaffold `packages/plugins/telephony` (package, project, tsconfig, jest, eslint), `telephony.plugin.ts`,
  `telephony-schedule.plugin.ts`, `telephony-enabled.ts` (exact `true`), `telephony.features.ts` (`FEATURE_TELEPHONY`,
  default off), `telephony.settings.ts` (plan §2 keys); conditional entries in `apps/api/src/plugins.ts` and
  `apps/worker/src/plugins.ts`. Files: `packages/plugins/telephony/{package.json,project.json,tsconfig.json,jest.config.ts,eslint.config.cjs,src/index.ts}`,
  `tel/{telephony.plugin.ts,telephony.module.ts,telephony-enabled.ts,telephony.features.ts,telephony.settings.ts}`,
  `tel/schedule/telephony-schedule.plugin.ts`, `apps/api/src/plugins.ts`, `apps/worker/src/plugins.ts`. Test:
  `tel/telephony-enabled.spec.ts` plugin lists; `tel/telephony.settings.spec.ts` settings defaults resolve; routes
  answer `404` with the feature off.
- [ ] **T3**. Core `employee_phone.ringsForCalls` (`1791000054900-AddRingsForCallsToEmployeePhone`, `hasColumn` guard);
  voice accounts use the Inbox `inbox_provider_account.channels` column of `email-and-communications` T5; entities and
  repositories for the voice account satellite, numbers, agents, agent numbers, routing plans;
  migration `1791000054100-CreateTelephonyAccountTables` on the shared core migration helpers of `procurement` T4 (`@gauzy/core`). Files:
  `packages/core/src/lib/database/migrations/1791000054900-AddRingsForCallsToEmployeePhone.ts`,
  `packages/core/src/lib/employee-phone/employee-phone.entity.ts`,
  `tel/{accounts/telephony-account.entity.ts,numbers/telephony-number.entity.ts,agents/telephony-agent.entity.ts,agents/telephony-agent-number.entity.ts,routing/telephony-routing-plan.entity.ts}`
  each with its TypeORM and MikroORM repository in `repository/`, `tel/database/migrations/{1791000054100-CreateTelephonyAccountTables.ts,index.ts}`. Test:
  `tel/database/create-telephony-account-tables.migration.spec.ts` and
  `packages/core/src/lib/database/employee-phone-rings-for-calls-migration.spec.ts` on SQLite; PostgreSQL and MySQL in
  the suite; existing provider accounts read back as `EMAIL`. Migration timestamps: `1791000054100` to `1791000054199` (`packages/plugins/telephony`); `1791000054900` to `1791000054999` (`packages/core`).
- [ ] **T4** (parallel). Entities for calls, events, outcomes (links and call tasks are `resource_link` rows);
  `BaseEntityEnum.TelephonyCall`; migration `1791000054110-CreateTelephonyCallTables`. Files:
  `tel/calls/{telephony-call.entity.ts,telephony-call-event.entity.ts}`, `tel/outcomes/telephony-outcome.entity.ts` with
  their repositories, `packages/contracts/src/lib/base-entity.model.ts`,
  `tel/database/migrations/1791000054110-CreateTelephonyCallTables.ts`. Test: `tel/database/create-telephony-call-tables.migration.spec.ts`.
- [ ] **T5** (parallel). Entities for dial sessions and items; migration `1791000054120-CreateTelephonyDiallerTables`.
  Files: `tel/dialler/{telephony-dial-session.entity.ts,telephony-dial-item.entity.ts}` with their repositories,
  `tel/database/migrations/1791000054120-CreateTelephonyDiallerTables.ts`.
  Test: `tel/database/create-telephony-dialler-tables.migration.spec.ts`.
- [ ] **T6**. Permission contributions with `defaultFor` in `telephony.permissions.ts`;
  `TelephonyBootstrapService.ensureSeeded` (default outcomes). Files: `tel/telephony.permissions.ts`,
  `tel/outcomes/telephony-bootstrap.service.ts`. Test: `tel/telephony.permissions.spec.ts` registry spec for grants;
  `tel/outcomes/telephony-bootstrap.service.spec.ts` idempotent bootstrap.

## Phase 2 — Services, endpoints, events

- [ ] **T7**. Adapter registry `adapters/telephony-adapter.registry.ts` (`registerTelephonyAdapters`, entries shaped like
  the Inbox provider registry's, one provider id per vendor across channels), manual medium,
  simulated adapter (`adapters/simulated/`, scripted calls, live audio and voicemail fakes) behind the organization switch,
  shared adapter contract test suite. Files: `tel/adapters/{telephony-adapter.registry.ts,manual-medium.adapter.ts,adapter-contract.suite.ts}`,
  `tel/adapters/simulated/{simulated.adapter.ts,simulated.client.ts,scripts.ts}`, `tel/adapters/adapters.controller.ts`.
  Test: `tel/adapters/simulated/simulated.adapter.spec.ts` runs the contract suite green; the simulated adapter is
  refused unless the organization switch is on.
- [ ] **T8**. Accounts `accounts/telephony-account.service.ts` (an `inbox_provider_account` with the `VOICE` channel, or
  the channel added to the vendor's existing account; secrets sealed by the Inbox secret box and write-only; voice
  satellite; verify, remote numbers and applications, callback token) and controller; `/telephony/status`. Files:
  `tel/accounts/{telephony-account.service.ts,telephony-account.controller.ts,dto/}`, `tel/status/{telephony-status.controller.ts,telephony-status.service.ts}`.
  Test: `tel/accounts/telephony-account.service.spec.ts`: secrets
  never in responses; one account serves email and voice of one vendor; verification on save lists remote numbers;
  `tel/status/telephony-status.service.spec.ts`: status for users with and without profile.
- [ ] **T9**. Numbers, agents and outcomes services and controllers (own profile route; the number that rings from
  `employee_phone`; do not disturb in the notification preferences; muted sounds in UI preferences; outcome
  deactivation). Files: `tel/numbers/{telephony-number.service.ts,telephony-number.controller.ts,dto/}`,
  `tel/agents/{telephony-agent.service.ts,telephony-agent.controller.ts,dto/}`,
  `tel/outcomes/{telephony-outcome.service.ts,telephony-outcome.controller.ts,dto/}`, `tel/settings/telephony-settings.controller.ts`.
  Test: `tel/agents/telephony-agent.controller.spec.ts` e2e on SQLite (own profile only without
  `TELEPHONY_SETTINGS_MANAGE`); no phone list stored by the plugin; `tel/outcomes/telephony-outcome.service.spec.ts`:
  an outcome in use is deactivated, never deleted.
- [ ] **T10**. Number handling `matching/phone-number.ts` (pure: normalisation with region fallbacks, keys, tolerant
  compare) shared with communications. Files: `tel/matching/phone-number.ts`. Test: `tel/matching/phone-number.spec.ts`, a table of national, international and punctuated forms.
- [ ] **T11**. Number directory `matching/number-directory.ts` (multi-port), core entries for contacts (`primaryPhone`),
  employees (`employee_phone`, `user.phoneNumber`) and vendors; crm entries registered by the crm plugin; lookup route
  with read filtering. Files: `tel/matching/{number-directory.ts,core-directory.entries.ts,lookup.controller.ts}`. Test:
  `tel/matching/number-directory.spec.ts`: two matches listed; unreadable record hidden; an employee's second phone matches.
- [ ] **T12**. Manual call logs and call service `calls/telephony-call.service.ts` (log by hand with preview, links by
  match and by hand as `resource_link` rows, phase machine with forward-only ranks and end reasons), call logs list and
  detail with visibility rule. Files: `tel/calls/{telephony-call.service.ts,telephony-call.controller.ts,call-phase.machine.ts,call-links.service.ts,call-visibility.ts,dto/}`.
  Test: `tel/calls/call-visibility.spec.ts` FR-36 visibility cases; `tel/calls/call-phase.machine.spec.ts`: a later
  phase never goes back; a new call links to every matching record and the organisation of a matched person.
- [ ] **T13**. Timeline and conversation sources `calls/telephony-call.timeline-source.ts`,
  `calls/telephony-conversation.source.ts`; `TELEPHONY_CALLS` port. Files: `tel/calls/{telephony-call.timeline-source.ts,telephony-conversation.source.ts,telephony-calls.port.ts}`.
  Test: `tel/calls/telephony-call.timeline-source.spec.ts`: call on every linked record's timeline once;
  `tel/calls/telephony-calls.port.spec.ts`: connected outgoing calls, deal durations and transcripts answered.
- [ ] **T14**. Callback controller `callbacks/telephony-callback.controller.ts` (raw body, token, adapter verification,
  store then process), queue `telephony-callbacks`. Files: `tel/callbacks/{telephony-callback.controller.ts,telephony-callback.processor.ts,raw-body.middleware.ts}`.
  Test: `tel/callbacks/telephony-callback.controller.spec.ts`: bad signature refused without effect; with the feature
  off a callback is rejected and nothing stored; duplicates and out-of-order
  callbacks end in the right state.
- [ ] **T15**. Routing `routing/telephony-router.ts` (slot resolution in the plan's time zone, open hours and holidays
  from the plan's service calendar through `TELEPHONY_OPEN_HOURS` or core `official_holiday`, candidates, availability
  through `TELEPHONY_AVAILABILITY`, do not disturb from the notification preferences, ring modes, fallback, time budget)
  and slot validation (pure). Files: `tel/routing/{telephony-router.ts,slot-validation.ts,candidates.ts}`. Test:
  `tel/routing/slot-validation.spec.ts` and `tel/routing/telephony-router.spec.ts` unit specs for slots and ordering; a holiday closes the line; budget exceeded
  answers the unavailable message.
- [ ] **T16**. Ring signals and acceptance (`calls/telephony-ring.service.ts`: ring, taken, missed cards, missed notice).
  Files: `tel/calls/telephony-ring.service.ts`. Test: `tel/calls/telephony-ring.service.spec.ts`: simultaneous accept
  gives one winner; an unanswered call gives one missed notice to the team and the record's owner.
- [ ] **T17**. Outgoing calls (`POST /telephony/calls`, browser token, call to the agent's phone first, controls by
  capability, number prompt and save). Files: `tel/calls/{telephony-outgoing.service.ts,telephony-call-control.controller.ts}`.
  Test: `tel/calls/telephony-outgoing.service.spec.ts` e2e with the simulated adapter for both devices; an unsupported
  control answers `TELEPHONY_ADAPTER_UNSUPPORTED`; a first call creates the agent profile with defaults.
- [ ] **T18**. During and after the call: note, tasks through core task service linked by `resource_link` rows, links,
  outcome step, follow-up task proposal, call back. Files: `tel/calls/{telephony-call-wrapup.service.ts,call-tasks.service.ts}`.
  Test: `tel/calls/telephony-call-wrapup.service.spec.ts`: inactive outcome refused; an outcome with a follow-up task
  proposes it; a hand link can be removed by its author.
- [ ] **T19**. Unknown caller to lead through `TELEPHONY_LEAD_INTAKE` (fallback contact of type lead). Files: `tel/calls/unknown-caller.service.ts`.
  Test: `tel/calls/unknown-caller.service.spec.ts` bound and unbound; adding the number to an existing record links the call.
- [ ] **T20**. Recordings `recordings/telephony-recording.*` (consent announcement, guarded fetch with retries, storage or
  provider reference, signed stream route, listen audit, retention job). Files:
  `tel/recordings/{telephony-recording.service.ts,telephony-recording.controller.ts,recording-fetch.worker.ts,retention.job.ts}`.
  Test: `tel/recordings/telephony-recording.service.spec.ts`: private-address fixture refused; listen needs
  `TELEPHONY_RECORDINGS_LISTEN` and is audited; `tel/recordings/retention.job.spec.ts`:
  retention deletes media and keeps the log.
- [ ] **T21**. Rematch job for numbers added later and stale-calls job. Files: `tel/jobs/{rematch.job.ts,stale-calls.job.ts}`.
  Test: `tel/jobs/rematch.job.spec.ts`: earlier calls linked within the window only; `tel/jobs/stale-calls.job.spec.ts`.
- [ ] **T22**. Events of plan §5, notification category, automation trigger declarations and webhook catalogue entries.
  Files: `tel/events/{telephony.events.ts,telephony.notification-categories.ts,telephony.automation-triggers.ts,index.ts}`.
  Test: `tel/events/telephony.events.spec.ts`: one event per state change, ids only.
- [ ] **T23** (parallel). GraphQL reads `telephonyCalls`, `telephonyCall`, `telephonyAccounts`. Files:
  `tel/graphql/{schema-extensions.ts,resolvers/telephony-call.resolver.ts,resolvers/telephony-account.resolver.ts}`.
  Test: `tel/graphql/resolvers/telephony-call.resolver.spec.ts` resolver specs.
- [ ] **T42**. Routing plans service and controller `/telephony/routing-plans` (FR-12): ring mode, ring time, greeting,
  busy and unavailable messages, weekly slots naming a team or a service calendar, time zone, fallback, sticky owner;
  numbers point at a plan. Files: `tel/routing/{telephony-routing-plan.service.ts,telephony-routing-plan.controller.ts,dto/}`.
  Test: `tel/routing/telephony-routing-plan.controller.spec.ts`: a slot ending before it starts or overlapping within a
  day refused with `TELEPHONY_SLOT_INVALID`; `TELEPHONY_SETTINGS_MANAGE` required.

## Phase 3 — UI surfaces

- [ ] **T24**. Angular call components in `packages/plugins/telephony-ui`: call card, incoming call stack, dial pad,
  call button, adapter client registry, sounds with visual equivalents, keyboard shortcuts. Files:
  `packages/plugins/telephony-ui/{package.json,project.json,ng-package.json,src/index.ts}`,
  `tui/components/{call-card/call-card.component.ts,incoming-stack/incoming-stack.component.ts,dial-pad/dial-pad.component.ts,call-button/call-button.component.ts}`,
  `tui/services/{telephony-client.registry.ts,telephony-sounds.service.ts}`. Test: `call-card.component.spec.ts` rendering and
  accessibility specs; muted sounds stay silent.
- [ ] **T25**. Hosting of the call card once in the Angular app shell (every page) and the phone-field call directive
  gated by `/telephony/status`. Files: `tui/{telephony-ui.plugin.ts,shell/call-card-host.component.ts,directives/phone-call.directive.ts}`.
  Test: `tui/directives/phone-call.directive.spec.ts`: no button without permission or account.
- [ ] **T26**. `packages/plugins/telephony-ui`: Settings → Telephony (accounts with adapter forms, numbers, routing plans
  with slot grid or service calendar, agents, outcomes, settings), `TELEPHONY.*` keys in every locale, links from CRM and
  helpdesk settings. Files: `tui/settings/{accounts-page.component.ts,numbers-page.component.ts,routing-plans-page.component.ts,slot-grid.component.ts,agents-page.component.ts,outcomes-page.component.ts,telephony-settings-page.component.ts}`,
  `packages/ui-core/i18n/assets/i18n/*.json`. Test: `tui/settings/slot-grid.component.spec.ts`: overlapping slots refused in the UI; component specs per page.
- [ ] **T27**. Call logs page with filters, detail panel, recording player and transcript. Files: `tui/pages/{call-logs-page.component.ts,call-detail-panel.component.ts,recording-player.component.ts}`.
  Test: `tui/pages/call-logs-page.component.spec.ts` component specs (filters, edit note and outcome, create a lead).
- [ ] **T28**. Helpdesk: call button on the ticket's contact with number prompt and save, calls on the ticket timeline
  (registered through the helpdesk UI's extension points). Files: `tui/helpdesk/{ticket-call-button.component.ts,helpdesk-extensions.ts}`.
  Test: `apps/gauzy-e2e` spec on a ticket: call from its contact, number prompt and save, call shown on the ticket timeline.
- [ ] **T29** (parallel). Phone width: call card, dial pad and call logs at 360 px in the installed web app. Files:
  `tui/components/call-card/call-card.component.scss`, `tui/components/dial-pad/dial-pad.component.scss`, `tui/pages/call-logs-page.component.scss`.
  Test: `tui/components/call-card/call-card.viewport.spec.ts`, viewport rendering at 360 px.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T30**. MCP tools `packages/mcp-server/src/lib/tools/telephony.ts` (plan §7) with `preview` and the call intent;
  registration with `AiChatToolRegistry`. Files: `packages/mcp-server/src/lib/tools/telephony.ts`,
  `packages/mcp-server/src/lib/tools/register-all-tools.ts`, `tel/assist/telephony-assistant-tools.ts`. Test:
  `packages/mcp-server/src/lib/tools/telephony.spec.ts`: previews write nothing; an intent rings only after
  confirmation; an agent's change is recorded as made by the agent on behalf of the confirming user.
- [ ] **T31**. Report definitions of spec FR-57, listed as core `report` rows of a "Telephony" category keyed
  `FEATURE_TELEPHONY` in the shared catalogue feature filter, with the read-only fallback viewer. Files:
  `tel/reports/{telephony.report-definitions.ts,telephony.report-datasets.ts}`. Test: `tel/reports/telephony.report-datasets.spec.ts`: figures on the
  demo data set; with the flag off the report list and menu are unchanged.
- [ ] **T32**. Personal data handlers for calls, recordings and transcripts; OpenAPI regenerated; SDK regeneration noted;
  adapter author guide in the plugin's README. Files: `tel/privacy/telephony-personal-data.handlers.ts`, `packages/plugins/telephony/README.md`, `packages/core/src/lib/bootstrap/swagger.ts`.
  Test: `tel/privacy/telephony-personal-data.handlers.spec.ts`: erasure keeps anonymised counts.
- [ ] **T33**. User docs page (accounts, routing, calling, logs, recordings, self-hosted callback address) and
  `docs/specs/README.md` row; spec status `Implemented` when phase 5 lands. Files: `docs/specs/README.md`,
  `docs/specs/features/telephony/spec.md`. Test: docs build.

## Phase 5 — Advanced capabilities

- [ ] **T34**. Sticky routing to the matched record's owner and transfer (direct and after speaking first) where supported.
  Files: `tel/routing/sticky-owner.ts`, `tel/calls/telephony-transfer.service.ts`. Test: `tel/routing/sticky-owner.spec.ts`:
  owner rings first; `tel/calls/telephony-transfer.service.spec.ts`: transfer keeps both legs.
- [ ] **T35**. Voicemail with transcription and owner delivery with a call-back task proposal. Files: `tel/recordings/telephony-voicemail.service.ts`.
  Test: `tel/recordings/telephony-voicemail.service.spec.ts` with a simulated voicemail.
- [ ] **T36**. After-call summaries `assist/telephony-summary.service.ts` (transcribe through `TELEPHONY_SPEECH`, proposals
  with source sentences through `TELEPHONY_TEXT_GENERATION`, both on the agent runtime with usage and budgets recorded
  there, approval writes). Files: `tel/assist/{telephony-summary.service.ts,telephony-summary.controller.ts}`. Test:
  `tel/assist/telephony-summary.service.spec.ts`: without provider; proposal writes nothing; no usage row written by the plugin.
- [ ] **T37**. Live assistance (adapter audio stream, transcript deltas, suggestions from linked records and the knowledge
  base when loaded). Files: `tel/assist/telephony-live-assist.service.ts`, `tui/components/call-card/live-assist-panel.component.ts`.
  Test: `tel/assist/telephony-live-assist.service.spec.ts`: simulated live audio produces deltas and suggestions; nothing sent to the party.
- [ ] **T38**. Power dialler `dialler/*` (sessions over saved views through `RECORD_VIEWS_SELECTION`, party list built
  through the core bulk executor, windows in local time, attempts and intervals, consent and "do not contact" from the
  consent records through `TELEPHONY_CONTACT_POLICY`, local presence), dialler panel and page. Files:
  `tel/dialler/{telephony-dialler.service.ts,telephony-dialler.controller.ts,dialler-tick.job.ts,local-presence.ts}`,
  `tui/pages/dialler-page.component.ts`, `tui/components/dialler-panel/dialler-panel.component.ts`. Test:
  `tel/dialler/telephony-dialler.service.spec.ts`: each skip reason; next call only after the outcome;
  `tel/dialler/local-presence.spec.ts`: local number chosen.
- [ ] **T39**. Call time as tracked time `time/telephony-call-time.service.ts` (offer, always, never; one entry marked from a
  call). Files: `tel/time/telephony-call-time.service.ts`. Test: `tel/time/telephony-call-time.service.spec.ts`: entry appears in the timesheet once.
- [ ] **T40**. Demo data: an account on the simulated adapter, numbers, a routing plan, calls with recordings and outcomes
  in the demo seed. Files: `tel/seeds/telephony-demo.seed.ts`, `packages/core/src/lib/core/seeds/seed-data.service.ts`.
  Test: `tel/seeds/telephony-demo.seed.spec.ts`, demo seed on SQLite.
- [ ] **T41**. Unchanged-behaviour check (spec AC-20): Inbox provider account, employee phone and text message gateway
  suites run with the feature off and on without a voice account. Files: `tel/testing/unchanged-behaviour.spec.ts`.
  Test: suites green unchanged; two accounts of one vendor stay allowed.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Presence | T2, T14 |
| FR-2 | §3.1 Presence | T8, T25 |
| FR-3 | §3.1 Presence | T8, T41 |
| FR-4 | §3.2 Provider accounts and adapters | T8, T26 |
| FR-5 | §3.2 Provider accounts and adapters | T8 |
| FR-6 | §3.2 Provider accounts and adapters | T14 |
| FR-7 | §3.2 Provider accounts and adapters | T7, T17 |
| FR-8 | §3.2 Provider accounts and adapters | T7 |
| FR-9 | §3.3 Agents | T3, T9, T17 |
| FR-10 | §3.3 Agents | T9, T24 |
| FR-11 | §3.3 Agents | T9 |
| FR-12 | §3.4 Incoming calls | T42, T15, T26 |
| FR-13 | §3.4 Incoming calls | T15 |
| FR-14 | §3.4 Incoming calls | T34 |
| FR-15 | §3.4 Incoming calls | T15 |
| FR-16 | §3.4 Incoming calls | T16, T24 |
| FR-17 | §3.4 Incoming calls | T16 |
| FR-18 | §3.4 Incoming calls | T24, T25 |
| FR-19 | §3.5 Number matching | T10 |
| FR-20 | §3.5 Number matching | T11, T12 |
| FR-21 | §3.5 Number matching | T21 |
| FR-22 | §3.5 Number matching | T19 |
| FR-23 | §3.6 Outgoing calls | T17, T25 |
| FR-24 | §3.6 Outgoing calls | T17 |
| FR-25 | §3.6 Outgoing calls | T17, T24 |
| FR-26 | §3.6 Outgoing calls | T17 |
| FR-27–FR-28 | §3.7 During and after a call | T18 |
| FR-29 | §3.7 During and after a call | T9, T18 |
| FR-30 | §3.7 During and after a call | T18 |
| FR-31 | §3.7 During and after a call | T34 |
| FR-32 | §3.8 Call log | T4, T12 |
| FR-33 | §3.8 Call log | T14 |
| FR-34 | §3.8 Call log | T12 |
| FR-35 | §3.8 Call log | T12, T27 |
| FR-36 | §3.8 Call log | T12 |
| FR-37 | §3.8 Call log | T13 |
| FR-38–FR-39 | §3.9 Recordings | T20 |
| FR-40 | §3.9 Recordings | T20, T27 |
| FR-41 | §3.9 Recordings | T20 |
| FR-42 | §3.10 Helpdesk | T28 |
| FR-43 | §3.10 Helpdesk | T26 |
| FR-44 | §3.11 Live assistance and summaries (advanced) | T37 |
| FR-45 | §3.11 Live assistance and summaries (advanced) | T36 |
| FR-46 | §3.11 Live assistance and summaries (advanced) | T35 |
| FR-47–FR-50 | §3.12 Power dialler (advanced) | T38 |
| FR-51 | §3.13 Call time and analytics (advanced) | T39 |
| FR-52 | §3.13 Call time and analytics (advanced) | T13, T22 |
| FR-53 | §3.14 API, MCP, events and reports | T8, T14, T17 |
| FR-54–FR-55 | §3.14 API, MCP, events and reports | T30 |
| FR-56 | §3.14 API, MCP, events and reports | T22 |
| FR-57 | §3.14 API, MCP, events and reports | T31 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flags default off; enabling them in dev with the simulated adapter shows the feature end to end; with them off,
  callbacks store nothing.
- Constitution gates in `spec.md` §9 confirmed.
- The adapter contract suite passes for the simulated adapter and is published for adapter plugins.
- Routing answers within the budget of spec §4 under 500 simultaneous simulated calls.
- Every acceptance criterion of `spec.md` §7 demonstrated on the demo data set.
