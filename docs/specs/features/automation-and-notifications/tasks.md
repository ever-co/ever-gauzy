# Task Breakdown: Automation and notifications

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `automation-and-notifications`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind `GAUZY_AUTOMATIONS_ENABLED` and `FEATURE_AUTOMATIONS`: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it. `ta/` means
  `packages/plugins/task-automations/src/lib/`, `ib/` means `packages/plugins/inbox/src/lib/`, `taui/` means
  `packages/plugins/task-automations-ui/src/lib/`, `ibui/` means `packages/plugins/inbox-ui/src/lib/`, `mcp/` means
  `packages/mcp-server/src/lib/`. Plugin migrations live in `ta/database/migrations/` and `ib/database/migrations/`,
  listed in `ta/database/task-automation-migrations.ts` and `ib/database/inbox-migrations.ts`.
- Phases 1 to 4 deliver plan phase 1; Phase 5 delivers plan phase 2 (depth); Phases 6 and 7 plan phase 3 (advanced;
  Phase 7 only for self-hosted installations with the script switch on).
- Depends on: the core record type registry (`custom-fields-and-forms` T2), the formula module (its T3) and the
  record writer contract (`record-views-and-search` T2).

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts `packages/contracts/src/lib/automation.model.ts` (flow document schema, trigger kinds, step and
  action descriptors, run and step outcomes, settings, ports, errors), `notification-category.model.ts`,
  `record-assignment.model.ts`, `reminder.model.ts`, `recognition.model.ts`; export from `packages/contracts/src/index.ts`.
  Test: contract compile spec and flow document schema validation spec.
- [ ] **T2**. Switches and contributions: `ta/automations-enabled.ts` (`isAutomationsEnabled`, exact `true`),
  `ta/task-automations.features.ts` (`FEATURE_AUTOMATIONS`, default off), `ta/task-automations.permissions.ts` (nine
  values with `defaultFor`), `ta/task-automations.settings.ts` (the `automations.*` and `recognition.*` setting
  contributions); `apps/api/src/plugins.ts` and `apps/worker/src/plugins.ts` list the plugin under either switch;
  `.env.sample`. Test: flag spec; plugin list specs of API and worker for each switch combination.
- [ ] **T3**. Flow entities `ta/flows/entities/` (`automation-flow.entity.ts`, `automation-flow-version.entity.ts` with
  conditions as core `rule` rows, `automation-trigger-index.entity.ts`, `automation-usage.entity.ts` for monthly usage
  counts) + MikroORM repositories in `ta/flows/repositories/`;
  migration `ta/database/migrations/1791000032100-CreateAutomationFlowTables.ts`. Test: migration spec on SQLite (up twice); mapping spec under
  both ORMs. Migration timestamps: `1791000032100` to `1791000032199` (`packages/plugins/task-automations`); `1791000032200` to `1791000032299` (`packages/plugins/inbox`); `1791000032300` to `1791000032399` (`packages/core`).
- [ ] **T4** (parallel). Run entities (run, run step with `agentRunId` and `scriptRunId`, wait, held event, rate counter,
  inbound hook: `ta/flows/entities/{automation-run,automation-run-step,automation-wait,automation-held-event,automation-rate-counter,automation-inbound-hook}.entity.ts`);
  migration `ta/database/migrations/1791000032110-CreateAutomationRunTables.ts`. Test: as T3; unique `(flowId, eventKey)` refuses a
  duplicate.
- [ ] **T5** (parallel). Assignment entities (conditions as core `rule` rows;
  `ta/assignments/entities/{assignment-rule,assignment-decision,record-assignment}.entity.ts`), the generic `reminder`
  table (`ta/reminders/reminder.entity.ts`) and recognition entities (`ta/recognition/recognition-entry.entity.ts`);
  migrations `ta/database/migrations/1791000032120-CreateAssignmentTables.ts`,
  `ta/database/migrations/1791000032130-CreateReminderAndRecognitionTables.ts`. Test: as T3; unique `openKey` refuses a second open assignment;
  unique `sourceKey` makes a feature's reminder idempotent.
- [ ] **T6**. Default role grants through the permission contributions' `defaultFor` (no migration); core
  `packages/core/src/lib/database/migrations/1791000032300-AddCategoryToEmployeeNotification.ts`; `EmployeeNotificationTypeEnum` values 13 to 15
  (`packages/contracts/src/lib/employee-notification.model.ts`) and their transform
  (`packages/core/src/lib/employee-notification/employee-notification-type-transform.ts`);
  additive `IEmployeeNotificationPreferences` and `ITeamNotificationDefaults` keys (`inAppByType`, `chatByType`,
  `smsByType`, quiet hours, bundling, follow digests) in `packages/contracts/src/lib/employee-notification-setting.model.ts`
  and the organization layer in `withTeamNotificationDefaults`
  (`packages/core/src/lib/employee-notification-setting/team-notification-defaults.ts`).
  Test: grants per role; transform round-trip; old rows read unchanged; member → team → organization → platform
  resolution table.
- [ ] **T7**. Inbox tables `ib/notifications/entities/` (`notification-category.entity.ts` for category labels and flags,
  `notification-destination.entity.ts` for the chat-channel destination, `notification-digest.entity.ts`,
  `notification-digest-send.entity.ts`) and `inbox_delivery` columns (`ib/delivery/inbox-delivery.entity.ts`); migrations
  `ib/database/migrations/1791000032200-CreateNotificationCategoryAndDestinationTables.ts`,
  `ib/database/migrations/1791000032210-CreateNotificationDigestTables.ts`,
  `ib/database/migrations/1791000032220-AddBundlingColumnsToInboxDelivery.ts`. Test: migration specs on SQLite; existing
  delivery specs green.
- [ ] **T58**. Core token and secret helpers, one for the platform: `hashed-token.ts` (random token, SHA-256 at rest,
  equal-time compare) and `secret-box.ts` (sealed secrets) in `packages/core/src/lib/core/util/`, lifted from the chat
  plugin (`packages/plugins/chat/src/lib/webhooks/chat-webhook-token.ts`, `chat-webhook-secret-box.ts`, which re-export them), with
  `saved-report/saved-report-token.ts` and the Inbox `ib/email/secrets/inbox-secret-box.ts` re-exporting them too, and
  `verifyWebhookSignature` (`webhook/webhook-signature.ts`) exported beside them; no dependency on this plugin or its
  flag. Test: helper specs; the chat webhook, saved-report and Inbox suites pass unchanged on the re-exports.
- [ ] **T59**. Core notification contract: `NOTIFICATION_DISPATCHER` token and `registerNotificationCategories` in
  `packages/core/src/lib/employee-notification/` (`notification-dispatcher.ts`, `notification-category.registry.ts`)
  with the core fallback to `EmployeeNotificationService`, and the
  category column written on employee notifications; no dependency on this plugin or its flag. Test: unbound, a
  dispatch writes one employee notification as today; a declared category is listed without this plugin.
- [ ] **T60**. Generic reminders core: reminder service and routes `/api/reminders` (`ta/reminders/reminder.service.ts`,
  `ta/reminders/reminder.controller.ts`), the `REMINDERS` port (`schedule`,
  `cancel` by source key prefix) bound in `apps/api/src/plugin-composition.ts` (also as `WORKFLOW_REMINDERS`) and the
  `automations.reminders` job (`ta/reminders/reminders.scheduler.ts`) over the `reminder` table of T5, usable by other features whatever this feature's flag
  (FR-53, FR-56). Test: delivered within a minute; cancelled with the record; a feature's reminder scheduled twice
  with one source key exists once.

## Phase 2 — Services, endpoints, events

- [ ] **T8**. Flow runtime `ta/flows/runtime/` (`run-claim.ts`, `loop-guard.ts`, `rate-limit.ts`, `record-lock.ts`,
  `system-actor-context.ts`): lift claim, loop guard, rate limit, per-record lock
  (`automation:<recordType>:<recordId>`) and system-actor context out of `ta/services/task-automation-runner.service.ts`,
  `ta/services/task-automation-task-lock.ts`, `ta/services/task-automation-context.ts` into record-agnostic services. Test: unit specs per guard;
  the whole existing `task-automations` spec suite passes unchanged.
- [ ] **T9**. `TaskRuleFlowAdapter`: task rules compiled to in-memory one-step flows and run on the runtime with their own
  run store; a task rule copied into a flow draft (version `source = TASK_RULE`). Files:
  `ta/flows/task-rule-flow.adapter.ts`, `ta/services/task-automation-engine.service.ts`. Test: parity spec replaying
  every task rule template and outcome (FR-2); a copied task rule validates as a flow draft.
- [ ] **T10**. Record access in `ta/flows/runtime/record-access.ts`: writes through the registry's record writers
  (`core-record-writers.ts`, `record-views-and-search` T2: tasks, projects, contacts, deals, employees, expenses,
  incomes, draft invoices, candidates, equipment, goals),
  custom values through `CUSTOM_FIELD_VALUE_WRITER`, reads through the registry and `CUSTOM_FIELD_VALUE_READER`. Test:
  run-as permission refused; version conflict retried once; custom value written with source `AUTOMATION`.
- [ ] **T11**. Condition and token engine `ta/flows/engine/` (`condition-evaluator.ts`: rule-evaluator rows with all/any/not, related paths two hops,
  change before and after, formula expressions; `token-renderer.ts` with escaping; `flow-validation.ts` for save-time validation). Test: unit specs per
  operator and token; unknown token refused.
- [ ] **T12**. Step executors phase 1: update fields, assign (direct, from field), tags, comment, milestone, notify, stop;
  action registry with `registerAutomationActions`. Files: `ta/flows/steps/` (`update-fields.step.ts`, `assign.step.ts`,
  `tags.step.ts`, `comment.step.ts`, `milestone.step.ts`, `notify.step.ts`, `stop.step.ts`),
  `ta/flows/automation-action.registry.ts`. Test: unit spec per executor; failure handling (stop, continue,
  retry).
- [ ] **T13**. Trigger catalogue (`registerAutomationTriggers`, registry events, field-change, workflow state) and the
  outbox consumer `subscriber:automations` with trigger index lookup, depth stamp in `EventOutboxService.append`. Files:
  `ta/flows/automation-trigger.registry.ts`, `ta/flows/automation-events.consumer.ts`,
  `packages/core/src/lib/event-outbox/event-outbox.service.ts`. Test:
  SQLite end to end (record change → one run); redelivery runs nothing; depth chain stops at 3; an event name no loaded
  plugin declares is refused.
- [ ] **T14**. Flow service and controllers: CRUD, draft with `If-Match`, validation, publish, activate, pause, archive,
  versions, restore, catalogue, templates; GraphQL reads. Files: `ta/flows/automation-flow.service.ts`,
  `ta/flows/automation-flow.controller.ts`, `ta/flows/automation-catalogue.controller.ts`, `ta/flows/dto/`,
  `ta/graphql/automation-flow.resolver.ts`, `ta/graphql/automation-flow.schema.ts`. Test: controller e2e (permissions, `404` with the feature off,
  validation errors named).
- [ ] **T15**. Trial run, run history and record runs routes (runs read in the `OperationView` shape), manual start of
  several records as core operation `AUTOMATION_BULK_START`; `what-would-run`. Files: `ta/flows/automation-trial.service.ts`,
  `ta/flows/automation-run.controller.ts`, `ta/flows/automation-bulk-start.operation.ts`. Test: trial writes, sends and calls nothing
  (spies on writers, dispatcher, transport); history filters.
- [ ] **T16**. `NOTIFICATION_DISPATCHER` of T59 answered by the Inbox (categories keyed by `EmployeeNotificationTypeEnum`
  and declared keys, preferences through the existing per-type maps and team defaults with the
  organization `notifications.defaults` setting, mandatory); `notification.<category>` events for webhook subscriptions. Files:
  `ib/notifications/inbox-notification-dispatcher.ts`, `ib/notifications/notification-category.service.ts`,
  `ib/notifications/notification-category.controller.ts`, `ib/notifications/notification-preferences.ts`. Test: resolution matrix spec; mandatory
  category cannot be muted; an existing `emailByType` choice still applies.
- [ ] **T17**. Limits, auto-pause, owner-leaves pause, kill switch and settings routes over the settings store;
  `activity_log` rows. Files: `ta/flows/automation-limits.service.ts`, `ta/flows/automation-kill-switch.service.ts`,
  `ta/flows/automation-settings.controller.ts`, `ta/flows/owner-left.consumer.ts`. Test: burst spec (rate limited), ten failures pause, kill switch halts at the next step and holds
  waits; settings resolve per organization with the tenant fallback.
- [ ] **T18**. Run events (`automation.run.*`, `automation.flow.*`, kill switch) declared with `SubscriptionCatalogue`;
  realtime hints for run progress. Files: `ta/events/automation-flow.events.ts`, `ta/events/automation-realtime.ts`. Test: event payloads carry ids only; audience spec.
- [ ] **T61**. Run retention (spec FR-38): `automations.retention` job keeps runs 90 days (setting 7 to 730), failures
  180 days and trial runs 7 days, folds pruned runs into `automation_usage` monthly counts per flow and outcome, and
  prunes rate counters after 8 days. Files: `ta/flows/automation-retention.service.ts`, `ta/schedule/automation-retention.scheduler.ts`.
  Test: `automation-retention.service.spec.ts`: a 91-day run is pruned and counted once; a 100-day failure is kept;
  rerunning the job changes nothing.
- [ ] **T62**. Delivery states (spec FR-67): `/api/inbox/deliveries?notificationId=` for the recipient and holders of
  `AUTOMATION_ADMIN` with the state per channel (queued, sent, bundled, skipped with reason, failed with error) and a
  delivery report for automation administrators. Files: `ib/delivery/inbox-delivery-status.controller.ts`,
  `ib/delivery/inbox-delivery-status.service.ts`, `ib/delivery/inbox-delivery-report.ts`. Test:
  `inbox-delivery-status.service.spec.ts`: a recipient sees only their own entry's states; a skipped channel names its
  reason; the report counts failures per channel.

## Phase 3 — UI surfaces

- [ ] **T19**. `task-automations-ui` hub: Task rules tab (the existing page `taui/components/automations-page.component.ts`,
  still opened by the `automations` path), Flows list under `automations/flows` (`taui/components/flows/flows-page.component.ts`),
  templates, Runs list and run timeline (`taui/components/runs/runs-page.component.ts`, `taui/components/runs/run-timeline.component.ts`),
  Settings (`taui/components/settings/automation-settings.component.ts`); hub routes in `taui/task-automations-ui.plugin.ts`;
  hidden on `404`; i18n keys in every locale (`packages/plugins/task-automations-ui/src/i18n/en.json` and
  `packages/ui-core/i18n/assets/i18n/`). Test: rendering specs; hidden when routes answer `404`; the `automations` address opens the task rules
  page with the feature on and off.
- [ ] **T20**. Flow designer: canvas on `@angular/cdk`, keyboard list editor, step inspector, condition builder, token
  picker, trial pane, versions, data-leaving summary. Files: `taui/components/designer/flow-designer.component.ts`,
  `taui/components/designer/step-inspector.component.ts`, `taui/components/designer/condition-builder.component.ts`,
  `taui/components/designer/token-picker.component.ts`, `taui/components/designer/trial-pane.component.ts`. Test:
  component specs; keyboard-only build of a flow.
- [ ] **T21** (parallel). `inbox-ui` Settings → Notifications: category × channel matrix, existing reminder thresholds,
  followed records list (`ibui/settings/inbox-notification-matrix.component.ts`,
  `ibui/services/inbox-notification-settings.service.ts`). Test: rendering spec; saves additive preference keys only.
- [ ] **T22** (parallel). Embeddables `ui-core/shared/src/lib/automations/` (record automation panel
  `packages/ui-core/shared/src/lib/automations/record-automation-panel.component.ts`, manual start
  `packages/ui-core/shared/src/lib/automations/manual-start-dialog.component.ts`) on
  task, project, contact and expense pages. Test: rendering specs.
- [ ] **T23** (parallel). Compatibility of existing clients: the task-rule routes and `/api/employee-notification-setting`
  answer unchanged with the new preference keys absent or present. Files: `ta/task-automation.controller.ts`,
  `packages/core/src/lib/employee-notification-setting/`. Test: contract snapshot of both routes before and
  after.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T24**. MCP `mcp/tools/automations.ts`, `mcp/tools/notifications.ts` (list, get, trial, runs, notify with preview);
  `mcp/tools/register-all-tools.ts`. Test: tool specs against a mocked API.
- [ ] **T25**. Port bindings in `apps/api/src/plugin-composition.ts`: `AUTOMATION_FLOWS` → `WORKFLOW_FLOWS`,
  `CUSTOM_FIELDS_FLOWS`; `AUTOMATION_ACTIONS` → `HR_AUTOMATION_ACTIONS`; `NOTIFICATION_DISPATCHER`. Test: composition spec
  with each plugin absent.
- [ ] **T26**. OpenAPI regenerated; SDK regeneration noted; docs site pages; `docs/specs/README.md` row. Test: OpenAPI diff
  is additive only.

## Phase 5 — Depth (plan phase 2)

- [ ] **T27**. Schedule triggers and `automations.schedule-tick` (cron, time zones, iterate a saved view through
  `AUTOMATION_VIEWS`); worker schedule and in-process fallback. Files: `ta/flows/triggers/schedule-trigger.ts`,
  `ta/schedule/automation-schedule-tick.scheduler.ts`, `ta/schedule/automation-schedule-tick.worker.ts`. Test: firing once per slot across two workers; DST spec.
- [ ] **T28**. Date-relative triggers and `automations.date-sweep` (standard and custom date fields, all-day offsets,
  re-arm on change, 24 h catch-up). Files: `ta/flows/triggers/date-relative-trigger.ts`,
  `ta/schedule/automation-date-sweep.scheduler.ts`. Test: once per key; moved date re-arms; SQLite end to end.
- [ ] **T29**. Waits (duration, until, event with correlation, expiry branch), `automations.wait-sweep`, version pinning.
  Files: `ta/flows/steps/wait.step.ts`, `ta/schedule/automation-wait-sweep.scheduler.ts`. Test: resume on time, on event and on expiry; restart mid-wait.
- [ ] **T30**. Branches (if/else, multi-way, nesting 5), find records and loops (≤ 1,000), create record, copy record with
  date shift, start flow. Files: `ta/flows/steps/branch.step.ts`, `ta/flows/steps/find-records.step.ts`,
  `ta/flows/steps/loop.step.ts`, `ta/flows/steps/create-record.step.ts`, `ta/flows/steps/copy-record.step.ts`,
  `ta/flows/steps/start-flow.step.ts`. Test: executor specs; loop limit named.
- [ ] **T31**. Email action (templates, composed body, record PDF via `AUTOMATION_PRINT`, files) through
  `AUTOMATION_COMMUNICATIONS` or `EmailSendService`; text message and chat actions through their ports. Files:
  `ta/flows/steps/email.step.ts`, `ta/flows/steps/text-message.step.ts`, `ta/flows/steps/chat-message.step.ts`. Test: recipients
  resolved at run time; unbound port hides the action.
- [ ] **T32**. Call-webhook action: endpoint policy, signing, timeout, answer excerpt; `AUTOMATION_WEBHOOKS` binding when
  present. Files: `ta/flows/steps/call-webhook.step.ts`. Test: private address refused; signature verifiable with `verifyWebhookSignature`.
- [ ] **T33**. Request-approval action and wait for decision through `AUTOMATION_APPROVALS` (`workflows.approval.decided`
  resumes the wait). Files: `ta/flows/steps/request-approval.step.ts`. Test: approved and rejected branches; expiry branch.
- [ ] **T34**. Incoming message triggers (inbox email items, chat messages, text messages) with sender matching. Files:
  `ta/flows/triggers/incoming-message-trigger.ts`, `ib/email/inbound/inbox-email.processor.ts`. Test:
  email reply in the same thread resumes a correlated wait.
- [ ] **T35**. Inbound webhook trigger: hook create and rotate, public route, token hash and sealed secret through the
  core `hashed-token.ts` and `secret-box.ts` of T58, signature with `verifyWebhookSignature`, size cap, throttling,
  delivery-id dedupe. Files: `ta/flows/inbound-hook.controller.ts`, `ta/flows/inbound-hook.service.ts`. Test: e2e for good, unsigned, oversized and repeated calls.
- [ ] **T36**. Assignment rules service and routes (conditions as `rule` rows, distribution modes in turn, fewest open,
  from field, weighted; weekdays and hours; bulk apply as core operation `ASSIGNMENT_RULE_APPLY`; decisions). Files:
  `ta/assignments/assignment-rule.service.ts`, `ta/assignments/assignment-rule.controller.ts`,
  `ta/assignments/distribution.ts`, `ta/assignments/assignment-rule-apply.operation.ts`. Test: distribution specs with a seeded pool; reopen spec.
- [ ] **T37**. Record assignments service and routes, Inbox "Assigned to me" tab with type, due and status filters,
  notifications.
  Files: `ta/assignments/record-assignment.service.ts`, `ta/assignments/record-assignment.controller.ts`,
  `ibui/components/inbox-page/inbox-page.component.ts`. Test: one open per person and record; close on rule condition and record deletion.
- [ ] **T38**. Reminders in the app over the reminder core of T60: Inbox "Reminders" tab, snooze, daily agenda,
  "Remind before a date" template (`ib/reminders/inbox-reminders.service.ts`, `ib/reminders/daily-agenda.ts`,
  `ibui/components/inbox-page/inbox-page.component.ts`). Test: snooze; the agenda lists the day's reminders once.
- [ ] **T39**. Followers on registered record types (fan-out through the dispatcher), follow digests hourly, daily and
  weekly in the delivery sweep. Files: `ta/followers/record-followers.service.ts`,
  `ib/delivery/inbox-delivery.scheduler.ts`. Test: weekly digest holds per-change emails; one digest per period.
- [ ] **T40**. Summary digests: service, routes, card rendering through `AUTOMATION_REPORT_CARDS` (else core
  `saved_report` definitions) and view counts, `inbox.digests` job, preview and test send, template `summary-digest`. Files:
  `ib/notifications/notification-digest.service.ts`, `ib/notifications/notification-digest.controller.ts`,
  `ib/notifications/notification-digest.scheduler.ts`. Test: per-recipient permissions; failing
  recipient skipped.
- [ ] **T41** (parallel). Destinations: chat-channel destinations with routes and test send; outbound addresses created
  as core webhook subscriptions on `notification.<category>` events, delivered, retried and disabled by the core webhook
  module. Files: `ib/notifications/notification-destination.service.ts`, `ib/notifications/notification-destination.controller.ts`.
  Test: endpoint policy; a failing address is disabled by the core module and its creator told.
- [ ] **T42** (parallel). Recognition: routes, allowance from the `recognition.*` settings, flow awards with caps, ledger,
  team totals, privacy, entries beside the awards on the employee profile and on the timeline, `/pages/recognition`. Files:
  `ta/recognition/recognition.service.ts`, `ta/recognition/recognition.controller.ts`,
  `taui/components/recognition/recognition-page.component.ts`. Test: allowance spec; agents receive no points.
- [ ] **T43**. Templates of loaded plugins (FR-10) created switched off. Files: `ta/flows/templates/automation-flow-templates.ts`.
  Test: each template validates and trial-runs.
- [ ] **T44**. Report definitions (FR-80) registered in the core reports catalogue (category keyed `FEATURE_AUTOMATIONS` in
  the shared catalogue feature filter) and with `report-builder-and-dashboards` when loaded. Files:
  `ta/reports/automation-report-definitions.ts`. Test: figures on seeded
  data; the reports appear in the Reports menu with the feature on and not with it off.
- [ ] **T45**. UI for phase 5: schedule and date trigger editors, wait and branch nodes, assignment rules tab,
  destinations and digests settings, reminder and assign buttons. Files: `taui/components/designer/trigger-editors.component.ts`,
  `taui/components/assignment-rules/assignment-rules-page.component.ts`, `ibui/settings/inbox-destinations-page.component.ts`,
  `ibui/settings/inbox-digests-page.component.ts`, `packages/ui-core/shared/src/lib/automations/reminder-button.component.ts`,
  `packages/ui-core/shared/src/lib/automations/assign-button.component.ts`. Test: rendering specs; i18n keys in every locale.

## Phase 6 — Advanced capabilities (plan phase 3)

- [ ] **T46**. Plain-language drafting `POST /automations/drafts/from-text` and MCP `automations_draft_flow` (catalogue-only
  prompt, defaults listed, saved as draft). Files: `ta/flows/automation-draft-from-text.service.ts`, `mcp/tools/automations.ts`.
  Test: nothing published; unknown fields refused by validation.
- [ ] **T47**. Agent step through `AUTOMATION_AGENTS` bound to `ai-agents-and-assistants` (agent employee profile; the
  run, usage and budget kept there, `agentRunId` on the step), step limits, previews of write tools; unbound → not
  offered. Files: `ta/flows/steps/agent.step.ts`. Test: stops at each limit and when the agent's budget is spent; tool outside the set refused.
- [ ] **T48**. Simulation as core operation `AUTOMATION_SIMULATION` and its pane (window or view, counts, notices per
  person per day, samples in the operation result). Files: `ta/flows/automation-simulation.operation.ts`,
  `taui/components/designer/simulation-pane.component.ts`. Test: no write; 100,000-event run reports progress.
- [ ] **T49**. Storm detector, held events and decisions (process, sample, discard). Files: `ta/flows/storm-detector.ts`,
  `ta/flows/held-events.controller.ts`, `ta/flows/held-events.service.ts`. Test: 50,000-change import held; sample
  of 20 processed first.
- [ ] **T50**. Replay from a failed step with external-effect guard; replay dialog. Files: `ta/flows/automation-replay.service.ts`,
  `taui/components/runs/replay-dialog.component.ts`. Test: earlier steps not repeated; linked
  run.
- [ ] **T51**. Quiet-hour windows per weekday and bundling in the delivery sweep (outside channels and in-app collapse),
  bundling off until a person chooses it. Files: `ib/delivery/inbox-delivery-rules.ts`, `ib/delivery/inbox-delivery.service.ts`.
  Test: 12 notices in the window become one push after quiet hours; a person
  who never chose bundling gets one push per notice as today.
- [ ] **T52**. Capacity and availability-aware assignment (time off, working hours, caps, skills, tracked and planned time
  through `AUTOMATION_AVAILABILITY`). Files: `ta/assignments/distribution.ts`, `ta/assignments/availability-filter.ts`.
  Test: member on approved time off skipped with reason.
- [ ] **T53**. Load test: 200 steps per second per instance, 1 million open waits, schedule and date sweeps on PostgreSQL
  and MySQL, measured on the flow run tables and on core `operation` / `operation_step`; the figures go into plan §3.1.
  Files: `tools/perf/automation-flows-bench.mjs`. Test: report attached to the PR.

## Phase 7 — Script steps on self-hosted installations

- [ ] **T54**. Script step executor `ta/flows/steps/script.step.ts` on the core tenant script runtime
  (`custom-fields-and-forms` T56): inputs from the record and earlier outputs, variables out, `scriptRunId` on the step,
  failure handling of FR-25, trial run without writes; `AUTOMATION_SCRIPTS_MANAGE` contribution (`defaultFor` super
  admin); script changes as `activity_log` rows; test and run-audit routes (FR-81 to FR-84). Test: a script step runs
  within limits; one over its time or memory limit fails the step naming the limit; every run has a `tenant_script_run`
  row.
- [ ] **T55**. Cloud refusal suite: with `GAUZY_DEPLOYMENT=cloud` and the switch on, boot logs the refusal, the designer
  does not offer the step, publishing a version with a script step and the script routes answer `403` (AC-15). Files:
  `ta/flows/script-deployment.guard.ts`, `ta/flows/steps/script.step.ts`. Test:
  e2e on SQLite with the marker set and unset.
- [ ] **T56**. Digest section registry in the Inbox digest mailer (`registerDigestSections`), the notification
  preferences' `digestFrequency` and `digestDay` beside `digestHour`, follow digests as a section. Files:
  `ib/delivery/inbox-delivery-mailer.ts`, `ib/delivery/digest-section.registry.ts`. Test: two registered
  sections arrive in one email at the person's hour; an empty section is left out; a person with daily digests off
  gets none.
- [ ] **T57**. Provide the ports other features bind to (plan, **Consumer tokens answered**): `AUTOMATION_RULES`, `COMMUNICATIONS_PREFERENCES`, `INBOX_DIGEST_SECTIONS`, `LEARNING_RECOGNITIONS`, `PERFORMANCE_RECOGNITIONS`, `RECORD_REMINDERS`. Files: `apps/api/src/plugin-composition.ts`. Test: one contract test per token over the shape its consumer plan states; with this feature off each consumer keeps its stated fallback.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Scope, flags and compatibility | T2, T14, T24 |
| FR-2 | §3.1 Scope, flags and compatibility | T8, T9, T19 |
| FR-3 | §3.1 Scope, flags and compatibility | T6, T16, T21 |
| FR-4 | §3.1 Scope, flags and compatibility | T23 |
| FR-5 | §3.2 Flows and versions | T3, T14 |
| FR-6 | §3.2 Flows and versions | T14, T29 |
| FR-7 | §3.2 Flows and versions | T11, T14 |
| FR-8 | §3.2 Flows and versions | T14 |
| FR-9 | §3.2 Flows and versions | T8, T10 |
| FR-10 | §3.2 Flows and versions | T43 |
| FR-11 | §3.3 Triggers | T13 |
| FR-12 | §3.3 Triggers | T27 |
| FR-13 | §3.3 Triggers | T28 |
| FR-14 | §3.3 Triggers | T34 |
| FR-15 | §3.3 Triggers | T35 |
| FR-16 | §3.3 Triggers | T15, T22 |
| FR-17 | §3.3 Triggers | T13, T25 |
| FR-18–FR-20 | §3.4 Conditions, expressions and tokens | T11 |
| FR-21 | §3.4 Conditions, expressions and tokens | T30 |
| FR-22 | §3.5 Actions and control steps | T12, T30, T31, T32, T33 |
| FR-23 | §3.5 Actions and control steps | T29 |
| FR-24 | §3.5 Actions and control steps | T12, T30 |
| FR-25 | §3.5 Actions and control steps | T12 |
| FR-26 | §3.5 Actions and control steps | T20, T31, T32 |
| FR-27 | §3.5 Actions and control steps | T32 |
| FR-28 | §3.5 Actions and control steps | T10 |
| FR-29 | §3.6 Running, limits and protection | T8, T13 |
| FR-30 | §3.6 Running, limits and protection | T13, T27, T28 |
| FR-31 | §3.6 Running, limits and protection | T8 |
| FR-32 | §3.6 Running, limits and protection | T13 |
| FR-33–FR-35 | §3.6 Running, limits and protection | T17 |
| FR-36 | §3.6 Running, limits and protection | T49 |
| FR-37 | §3.6 Running, limits and protection | T8, T30 |
| FR-38 | §3.6 Running, limits and protection | T61 |
| FR-39 | §3.6 Running, limits and protection | T17 |
| FR-40 | §3.7 Trial runs, simulation, history and replay | T15, T20 |
| FR-41 | §3.7 Trial runs, simulation, history and replay | T48 |
| FR-42 | §3.7 Trial runs, simulation, history and replay | T15, T18, T19 |
| FR-43 | §3.7 Trial runs, simulation, history and replay | T50 |
| FR-44 | §3.7 Trial runs, simulation, history and replay | T15, T22 |
| FR-45 | §3.8 Assignment rules and record assignments | T36 |
| FR-46 | §3.8 Assignment rules and record assignments | T36, T52 |
| FR-47 | §3.8 Assignment rules and record assignments | T52 |
| FR-48 | §3.8 Assignment rules and record assignments | T36 |
| FR-49 | §3.8 Assignment rules and record assignments | T36, T37 |
| FR-50–FR-52 | §3.8 Assignment rules and record assignments | T37 |
| FR-53 | §3.9 Reminders | T38, T60 |
| FR-54 | §3.9 Reminders | T28, T38 |
| FR-55 | §3.9 Reminders | T21 |
| FR-56 | §3.9 Reminders | T38, T60 |
| FR-57 | §3.10 Notifications, preferences and digests | T7, T16 |
| FR-58 | §3.10 Notifications, preferences and digests | T12, T16 |
| FR-59 | §3.10 Notifications, preferences and digests | T39 |
| FR-60 | §3.10 Notifications, preferences and digests | T16, T59 |
| FR-61 | §3.10 Notifications, preferences and digests | T6, T16, T21 |
| FR-62 | §3.10 Notifications, preferences and digests | T16 |
| FR-63–FR-64 | §3.10 Notifications, preferences and digests | T51 |
| FR-65 | §3.10 Notifications, preferences and digests | T39 |
| FR-66 | §3.10 Notifications, preferences and digests | T41 |
| FR-67 | §3.10 Notifications, preferences and digests | T7, T62 |
| FR-68–FR-69 | §3.10 Notifications, preferences and digests | T40 |
| FR-70–FR-72 | §3.11 Recognition | T42 |
| FR-73 | §3.12 Assistants and agents | T46 |
| FR-74–FR-75 | §3.12 Assistants and agents | T47 |
| FR-76 | §3.12 Assistants and agents | T24, T46 |
| FR-77 | §3.13 API, events, extension and reports | T14, T15 |
| FR-78 | §3.13 API, events, extension and reports | T18 |
| FR-79 | §3.13 API, events, extension and reports | T12, T13, T25, T59 |
| FR-80 | §3.13 API, events, extension and reports | T44 |
| FR-81–FR-84 | §3.14 Script steps on self-hosted installations | T54, T55 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off; enabling it in dev shows the feature end to end.
- Constitution gates in `spec.md` §9 confirmed.
- Feature checks: the existing task automation suite passes unchanged on the shared runtime; each trigger starts one
  run per occurrence after a redelivery or restart (AC-2); trial and simulation write, send and call nothing; the kill
  switch halts and holds; quiet hours and bundling hold on outside channels; with `FEATURE_AUTOMATIONS` off every new
  route answers `404` and task rules, reminders and delivery behave as before (AC-14); on the cloud deployment script
  steps are refused (AC-15).
