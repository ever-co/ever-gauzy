# Task Breakdown: Approval workflows

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `approval-workflows`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind `GAUZY_WORKFLOWS_ENABLED` and `FEATURE_WORKFLOWS`: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it. Paths are relative
  to the repository root; `wf/` means `packages/plugins/workflows/src/lib/`, `wfui/` means
  `packages/plugins/workflows-ui/src/lib/`, `ra/` means `packages/core/src/lib/request-approval/`.
- Each entity folder follows the plugin layout of `packages/plugins/inventory`: `<name>.entity.ts`, `<name>.service.ts`,
  `<name>.controller.ts`, `dto/`, `repository/type-orm-<name>.repository.ts` and `repository/mikro-orm-<name>.repository.ts`,
  with a `<name>.service.spec.ts` beside the service.
- Phases 1 to 4 deliver plan phases 1 and 2; Phase 5 delivers plan phase 3 (advanced). The formula language and
  the record type registry come from `custom-fields-and-forms` (its T2, T3).

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts `packages/contracts/src/lib/workflow.model.ts` (enums, definition document schema, gateway,
  gate, state reader, events, errors) and `ApprovalPolicyTypesStringEnum.WORKFLOW` in
  `packages/contracts/src/lib/approval-policy.model.ts`; export from `packages/contracts/src/index.ts`. Test:
  contract compile spec; definition schema spec `packages/contracts/src/lib/workflow.model.spec.ts`.
- [ ] **T2**. Router contract in `packages/contracts/src/lib/request-approval.model.ts` (`IRequestApprovalRouter`,
  `REQUEST_APPROVAL_ROUTER`) and its calls in `ra/request-approval.service.ts` (`answer`, admin and employee status
  updates), the time-off and equipment-sharing status handlers
  (`packages/core/src/lib/time-off-request/commands/handlers/time-off.status.handler.ts`,
  `packages/core/src/lib/equipment-sharing/commands/handlers/equipment-sharing.status.handler.ts`), plus
  `settleByWorkflow`. Test: every existing request-approval spec green unbound; router specs (handled, not handled,
  settled outside) in `ra/request-approval.router.spec.ts`.
- [ ] **T3**. Plugin scaffold `packages/plugins/workflows` (`package.json`, `project.json`, `tsconfig.json`,
  `jest.config.ts`, `eslint.config.cjs`, `src/index.ts`), `wf/workflows-enabled.ts` (exact `true`), path mapping in
  `tsconfig.base.json`, `.env.sample`; `wf/workflows.features.ts` (`FEATURE_WORKFLOWS`, default off);
  `wf/workflows.permissions.ts` (seven values with `defaultFor`). Test: flag and contribution specs
  `wf/workflows-enabled.spec.ts`, `wf/workflows.permissions.spec.ts`.
- [ ] **T4**. Plugin migration set `wf/database/migrations/index.ts` on the shared core migration helpers of `procurement` T4 (`@gauzy/core`), no copy in the plugin. Test: an empty migration run on SQLite. Migration timestamps: `1791000031100` to `1791000031199` (`packages/plugins/workflows`).
- [ ] **T5**. Entities for definitions and versions + MikroORM repositories:
  `wf/workflow-definition/workflow-definition.entity.ts`,
  `wf/workflow-definition-version/workflow-definition-version.entity.ts` and their `repository/` files; conditions as
  core `rule` rows with the new `RuleOwnerType` values `WORKFLOW_START`, `WORKFLOW_TRANSITION`, `WORKFLOW_STEP`,
  `WORKFLOW_SKIP` in `packages/contracts/src/lib/rule.model.ts`; migration
  `wf/database/migrations/1791000031100-CreateWorkflowDefinitionTables.ts`. Test: migration spec on SQLite (up twice);
  mapping spec both ORMs; a definition file round-trips its conditions.
- [ ] **T6**. Entities for instances, step runs, tasks, events (`wf/workflow-instance/workflow-instance.entity.ts`,
  `wf/workflow-step-run/workflow-step-run.entity.ts`, `wf/workflow-task/workflow-task.entity.ts`,
  `wf/workflow-event/workflow-event.entity.ts` and their `repository/` files); migration
  `wf/database/migrations/1791000031110-CreateWorkflowInstanceTables.ts` with `runningKey` and `sourceKey` uniqueness.
  Test: migration spec; uniqueness spec per dialect.
- [ ] **T7** (parallel). Entities for delegations and action tokens
  (`wf/workflow-delegation/workflow-delegation.entity.ts`, `wf/workflow-action-token/workflow-action-token.entity.ts`
  and their `repository/` files); migration `wf/database/migrations/1791000031120-CreateWorkflowDelegationTables.ts`.
  Test: migration spec.
- [ ] **T8** (parallel). Entities for approval rules and limits (`wf/approval-rule/approval-rule.entity.ts`,
  `wf/approval-limit/approval-limit.entity.ts` and their `repository/` files); migration
  `wf/database/migrations/1791000031130-CreateApprovalRuleTables.ts` with `ruleKey`. Test: migration spec; duplicate
  spec.
- [ ] **T9**. Default role grants through the permission contributions' `defaultFor` (no migration);
  `wf/workflows.plugin.ts`, `wf/workflows.module.ts`; `apps/api/src/plugins.ts` entry behind the flag;
  `WorkflowsSchedulePlugin` (`wf/schedule/workflows-schedule.plugin.ts`) in `apps/worker/src/plugins.ts`. Test: plugin
  list specs of API and worker (absent when off).
- [ ] **T53**. Core settler registry `ra/request-approval-settler.registry.ts` (`registerRequestApprovalSettler(type,
  settle)`, one settler per type), called by `RequestApprovalStatusHandler.settleLinkedDocument`
  (`ra/commands/handlers/request-approval.status.handler.ts`) on the answer's transaction for types other than time off
  and equipment sharing, and by `settleByWorkflow` (`ra/request-approval.service.ts`). Lands in core ahead of the first
  plugin that files its own request type, with no dependency on this plugin or its flag (FR-68). Test: existing
  request-approval suites green; `ra/request-approval-settler.registry.spec.ts`: a registered test type is settled once
  whether decided on the Approvals page, by a classic route or by a completed instance; a refused decision rolls back
  with its settler; a duplicate registration fails at boot.

## Phase 2 — Services, endpoints, events

- [ ] **T10**. Pure engine `wf/engine/`: definition validation (`wf/engine/definition-validation.ts`: reachability,
  finals, lifecycle legality, conditions), state machine (`wf/engine/state-machine.ts`), step rules
  (`wf/engine/step-rules.ts`: all, any, N of M, share), parallel groups, return and resubmit. Test: unit specs per rule
  and refusal beside each file (FR-5 to FR-10, FR-17, FR-21, FR-22).
- [ ] **T11**. `wf/engine/decision-policy.ts`: assignee and delegate checks, administrator override, self-approval,
  one person counts once. Test: matrix spec `wf/engine/decision-policy.spec.ts` on plain objects (FR-19, FR-24, FR-25):
  the requester is never an approver by default, and is kept when a step allows the requester and is not resolved from
  amount bands or approval rules.
- [ ] **T12**. Definition service and controller (drafts, versions immutable, validate, publish, activate with overlap
  check, retire, templates). Files: `wf/workflow-definition/workflow-definition.service.ts`,
  `wf/workflow-definition/workflow-definition.controller.ts`,
  `wf/workflow-definition/dto/create-workflow-definition.dto.ts`,
  `wf/workflow-definition/dto/update-workflow-definition.dto.ts`,
  `wf/workflow-definition-version/workflow-definition-version.service.ts`,
  `wf/workflow-definition-version/dto/save-workflow-definition-version.dto.ts`. Test: service spec (overlap refused
  naming both definitions, FR-10); e2e `404` with the feature off.
- [ ] **T13**. Instance service: start with idempotency, transitions with conditions and inputs, edit locks by state
  (entity subscriber), record version checks, withdraw, cancel on record delete; lifecycle definitions refused for
  tasks, deals and orders; lifecycle starts on record creation and on first meeting the start conditions through the
  record-event consumer. Files: `wf/workflow-instance/workflow-instance.service.ts`,
  `wf/workflow-instance/workflow-instance.controller.ts`, `wf/workflow-instance/dto/perform-transition.dto.ts`,
  `wf/workflow-instance/dto/start-workflow-instance.dto.ts`, `wf/workflow-instance/workflow-edit-lock.subscriber.ts`,
  `wf/events/workflow-records.consumer.ts`. Test: `wf/workflow-instance/workflow-instance.service.spec.ts`
  (FR-11 to FR-16, FR-29).
- [ ] **T14**. Approver resolution `wf/approvers/approver-resolver.service.ts` with one source per file in
  `wf/approvers/sources/` for named, role, team, reporting line (`WORKFLOW_REPORTING_LINE`, team-manager fallback), HR
  approver (`WORKFLOW_HR_APPROVERS`), record field, amount bands, fallback approvers. Test:
  `wf/approvers/approver-resolver.service.spec.ts`: resolution per source with the source recorded; unresolved goes to
  fallback (FR-18 to FR-20).
- [ ] **T15**. Task service and controller: queue with filters and counts, decide with record version and comment rules,
  serialized decisions (each assignee's decision counts while the step is open; "already decided" only once the step is
  resolved or the task decided), reassign, comments; the `request_approval_employee` / `request_approval_team` projection of the
  current step's tasks and `min_count` written in the task's transaction. Files:
  `wf/workflow-task/workflow-task.service.ts`, `wf/workflow-task/workflow-task.controller.ts`,
  `wf/workflow-task/dto/decide-workflow-task.dto.ts`, `wf/workflow-task/dto/reassign-workflow-task.dto.ts`,
  `wf/workflow-task/dto/workflow-task-query.dto.ts`, `wf/workflow-task/request-approval-projection.ts`. Test:
  concurrency spec (two deciders) in `wf/workflow-task/workflow-task.service.spec.ts`: on an "any one" step the second
  is told "already decided"; on an "all" step with two approvers the second approval is accepted and completes the
  step; e2e decide (FR-27, FR-28, FR-30,
  FR-36, FR-45).
- [ ] **T16**. Router implementation: governs requests by type, policy and activation time; records decisions of the
  classic routes on tasks; completes via `settleByWorkflow`; "decided outside" path; a free-form request without a
  policy takes the policy whose routing conditions match. Files: `wf/router/workflow-request-approval.router.ts`. Test:
  contract suite `wf/router/workflow-request-approval.router.spec.ts` over every `/request-approval` route and the
  time-off and equipment routes with default definitions, and the MCP `approve_time_off_request` /
  `deny_time_off_request` tools (`packages/mcp-server/src/lib/tools/time-off.ts`), with the Approvals page's record view
  (`apps/gauzy/src/app/pages/approvals/approval-record-view.ts`) reading the same approvers as the engine (FR-48 to
  FR-52).
- [ ] **T17**. Default definitions and the per-tenant seeder (on first enable and tenant creation). Files:
  `wf/defaults/default-definitions.ts`, `wf/defaults/workflow-default-definitions.seeder.ts`. Test: seeding is
  idempotent (`wf/defaults/workflow-default-definitions.seeder.spec.ts`); behaviour identical to the unbound router on
  the contract suite.
- [ ] **T18**. Gateway `WorkflowApprovalGateway` (request, status, withdraw, invalidate; default one-step definition by
  approve permission) and `workflows.approval.decided`. Files: `wf/gateway/workflow-approval.gateway.ts`,
  `wf/events/workflow-approval-decided.event.ts`. Test: gateway spec `wf/gateway/workflow-approval.gateway.spec.ts`;
  outcome delivered once (FR-53, FR-54).
- [ ] **T19**. Bindings in `apps/api/src/plugin-composition.ts` for the ports of budgets, ledger, fixed assets,
  procurement, document change sets and HR events (adapters where shapes differ, in
  `wf/gateway/approval-port.adapters.ts`); plugin request types with a settler (T53) are governed through the router.
  Test: composition spec (bound when both plugins load, absent otherwise).
- [ ] **T20**. Transition actions: in-transaction field updates and related record; after-commit flows, webhooks,
  notices through `workflows.async-actions` with retries. Files: `wf/actions/transition-actions.service.ts`,
  `wf/actions/workflow-async-actions.worker.ts`. Test: `wf/actions/transition-actions.service.spec.ts`: failure shown
  and retried, transition kept (FR-8).
- [ ] **T21**. Document coupling: `WORKFLOW_DOCUMENTS` confirm and cancel on state entry; `DOCUMENT_CHECKS` entry
  `workflows.approval`. Files: `wf/documents/workflow-documents.service.ts`,
  `wf/documents/workflow-approval.document-check.ts`. Test: e2e with a registered test document type; refused
  confirmation keeps state (FR-15).
- [ ] **T22**. Approval rules and limits: services, validation, gate check, authority matrix, check route; for
  `sales_order` the buyer threshold, spending limits and `order.requireApprovalAboveAmount` read as rules when the
  organization setting `workflows.approvalRules.useOrderThresholds` (default `false`) is on. Files:
  `wf/approval-rule/approval-rule.service.ts`, `wf/approval-rule/approval-rule.controller.ts`,
  `wf/approval-rule/dto/create-approval-rule.dto.ts`, `wf/approval-rule/dto/check-approval-rules.dto.ts`,
  `wf/approval-rule/approval-rule.gate.ts`, `wf/approval-rule/order-threshold-rules.ts`,
  `wf/approval-limit/approval-limit.service.ts`, `wf/approval-limit/approval-limit.controller.ts`,
  `wf/approval-limit/dto/create-approval-limit.dto.ts`, `wf/workflows.settings.ts`. Test: specs (FR-31 to
  FR-34); with the setting on, a B2B order above its buyer's threshold needs approval with no saved rule; with it off,
  the same order confirms as today.
- [ ] **T23**. State field through `CUSTOM_FIELD_VALUE_WRITER` and `IWorkflowStateReader`; list filters by state. Files:
  `wf/state-field/workflow-state-field.service.ts`, `wf/state-field/workflow-state.reader.ts`. Test:
  `wf/state-field/workflow-state-field.service.spec.ts` with and without custom fields loaded (FR-12, FR-64).
- [ ] **T24**. Inbox integration: items through `INBOX_ITEM_WRITER`, source handler `WORKFLOWS` deciding on reply,
  closing other recipients' items. Files: `wf/inbox/workflow-inbox.service.ts`,
  `wf/inbox/workflows-inbox-source.handler.ts`. Test: spec with the Inbox plugin on SQLite (FR-35).
- [ ] **T25**. Signed email links: tokens through the core `hashed-token.ts` helper of `automation-and-notifications`
  T58 (`packages/core/src/lib/core/util/hashed-token.ts`), email templates (`workflow-task`, `workflow-reminder`,
  `workflow-outcome`: `html.mjml` and `subject.hbs` per language in
  `packages/core/src/lib/core/seeds/data/default-email-templates/<name>/<lang>/`) in every language, public controller
  with the rate limit and expiry handling of estimate answers, marked `@Public()` without `TenantPermissionGuard` (tenant,
  task and assignee taken from the validated token, `FEATURE_WORKFLOWS` checked for that tenant). Files:
  `wf/workflow-action-token/workflow-action-token.service.ts`, `wf/public/workflow-public-action.controller.ts`. Test:
  `wf/workflow-action-token/workflow-action-token.service.spec.ts`: used, expired, stale and reassigned links decide
  nothing (FR-37); `wf/public/workflow-public-action.controller.spec.ts`: a valid link decides without a session, an
  invalid token or a tenant with the feature off answers `404`.
- [ ] **T26**. Bulk decisions as core operation `WORKFLOW_BULK_DECIDE` above 50 (`BulkExecutor`, `@AcceptedOperation`).
  Files: `wf/bulk/workflow-bulk-decide.operation.ts`, route `POST /api/workflows/tasks/decide-bulk` in
  `wf/workflow-task/workflow-task.controller.ts`, `wf/workflow-task/dto/decide-workflow-tasks-bulk.dto.ts`. Test:
  per-task results (FR-41); a restart resumes the operation.
- [ ] **T27**. Delegations service and routes; decisions "on behalf of". Files:
  `wf/workflow-delegation/workflow-delegation.service.ts`, `wf/workflow-delegation/workflow-delegation.controller.ts`,
  `wf/workflow-delegation/dto/create-workflow-delegation.dto.ts`. Test: segregation applies to delegates (FR-43).
- [ ] **T28**. Service levels: working calendar port with the organization's own hours and official holidays as
  fallback, reminder points through `WORKFLOW_REMINDERS` (generic reminder table) or the sweep when unbound,
  `workflows.service-levels.sweep` (escalations, lapses), overdue figures. Files:
  `wf/service-levels/working-calendar.service.ts`, `wf/service-levels/service-level-sweep.service.ts`,
  `wf/schedule/workflows-service-levels.scheduler.ts`, `wf/schedule/workflows-service-levels.worker.ts`. Test: sweep
  spec `wf/service-levels/service-level-sweep.service.spec.ts` with a fake clock; catch-up after downtime (FR-46,
  FR-47).
- [ ] **T29**. Events and realtime: instance and task events on the outbox, `record:<type>:<id>` and
  `workflows:<userId>` hints, requester notices (FR-42, FR-66). Files: `wf/events/workflow-instance.events.ts`,
  `wf/events/workflow-task.events.ts`, `wf/events/workflow-realtime.publisher.ts`,
  `wf/events/workflow-requester-notices.ts`. Test: outbox spec `wf/events/workflow-events.spec.ts`.
- [ ] **T30**. Report datasets (FR-67) registered in the core reports catalogue (category keyed `FEATURE_WORKFLOWS` in the
  shared catalogue feature filter) and with the report builder when present. Files:
  `wf/reports/workflow-report-datasets.ts`, `wf/reports/workflow-reports.controller.ts`. Test: dataset specs on seeded
  data; the reports appear in the Reports menu with the feature on and not with it off.
- [ ] **T54**. GraphQL: `workflowDefinitions`, `workflowInstance` (record), `myWorkflowTasks`, mutations
  `decideWorkflowTask` (with `preview`) and `performWorkflowTransition`, every field behind `FEATURE_WORKFLOWS`. Files:
  `wf/graphql/workflow.schema.ts`, `wf/graphql/workflow.resolver.ts`. Test: `wf/graphql/workflow.resolver.spec.ts`:
  a task is listed and decided over GraphQL with the same refusals as REST; with the feature off the fields answer not
  found (FR-1, FR-40).
- [ ] **T55**. Instance history and audit: `GET /api/workflows/instances[/:id[/history]]` (view of the record /
  `WORKFLOW_INSTANCES_ADMIN`), append-only `workflow_event` writer with actor type and channel, history export as CSV,
  and `activity_log` rows for definition, rule, limit and delegation changes. Files:
  `wf/workflow-event/workflow-event.service.ts`, `wf/workflow-instance/workflow-instance.controller.ts`,
  `wf/workflow-event/workflow-history-export.ts`, `wf/audit/workflow-audit.subscriber.ts`. Test:
  `wf/workflow-event/workflow-event.service.spec.ts`: events are never updated or deleted, the export lists every event
  with actor type and channel, and a definition change writes one `activity_log` row with before and after (FR-65).

## Phase 3 — UI surfaces

- [ ] **T31**. Embeddables `packages/ui-core/shared/src/lib/workflows/` (`ngx-workflow-panel` in
  `workflow-panel/workflow-panel.component.ts`, `ngx-approval-card` in `approval-card/approval-card.component.ts`,
  `workflows.module.ts`, `index.ts`). Test: component specs beside each component; hidden on 404.
- [ ] **T32**. Progress of governed requests on the existing Approvals page and the bound definition on the approval
  policy page (`apps/gauzy/src/app/pages/approvals/approvals.component.ts`, `approvals.component.html`,
  `apps/gauzy/src/app/pages/approval-policy/approval-policy.component.ts`, `approval-policy.component.html`). Test:
  page specs unchanged when off.
- [ ] **T33**. `packages/plugins/workflows-ui`: plugin `wfui/workflows-ui.plugin.ts`, API service
  `wfui/services/workflows-api.service.ts`, definitions list and templates
  `wfui/components/workflow-definitions-page/workflow-definitions-page.component.ts`, keyboard list editor
  `wfui/components/workflow-list-editor/workflow-list-editor.component.ts`, properties panel
  `wfui/components/workflow-properties-panel/workflow-properties-panel.component.ts`, versions
  `wfui/components/workflow-versions/workflow-versions.component.ts`; `WORKFLOWS.*` keys in
  `packages/ui-core/i18n/assets/i18n/*.json`. Test: component specs; i18n keys in every locale.
- [ ] **T34**. Canvas designer with auto layout and the definition file import and export. Files:
  `wfui/components/workflow-canvas/workflow-canvas.component.ts`, `wfui/services/workflow-definition-file.service.ts`.
  Test: component and accessibility specs.
- [ ] **T35**. Tabs "My tasks", "Delegated", "My requests" and "All" with bulk decide on the existing Approvals page
  (`apps/gauzy/src/app/pages/approvals/approvals.component.ts`, `approvals.component.html`), delegations page
  `wfui/components/workflow-delegations-page/workflow-delegations-page.component.ts`, approval rules and authority
  matrix `wfui/components/approval-rules-page/approval-rules-page.component.ts`,
  `wfui/components/authority-matrix/authority-matrix.component.ts`. Test: component specs; the page is unchanged with
  the feature off.
- [ ] **T36**. Public action page `/workflow-action/:token` through `public-layout-ui`, built like the estimate answer
  page. Files: `wfui/components/workflow-action-page/workflow-action-page.component.ts`, route in
  `packages/plugins/public-layout-ui/src/lib/public-layout.routes.ts`. Test: page spec.
- [ ] **T37** (parallel). Phone rendering of the Approvals page tabs, `ngx-approval-card` and `ngx-workflow-panel` in
  the installable Gauzy web app; no separate React package. Files: `apps/gauzy/src/app/pages/approvals/approvals.component.scss`,
  `packages/ui-core/shared/src/lib/workflows/approval-card/approval-card.component.scss`,
  `packages/ui-core/shared/src/lib/workflows/workflow-panel/workflow-panel.component.scss`. Test: rendering specs at
  phone width.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T38**. MCP tools `packages/mcp-server/src/lib/tools/workflows.ts` (plan §7) in
  `packages/mcp-server/src/lib/tools/register-all-tools.ts`, each behind `FEATURE_WORKFLOWS`. Test:
  `packages/mcp-server/src/lib/tools/workflows.spec.ts`: `preview` decides nothing; an agent cannot decide its own
  record.
- [ ] **T39** (parallel). OpenAPI regenerated; SDK regeneration noted for the release. Files: `packages/core/src/lib/bootstrap/swagger.ts`. Test: OpenAPI diff is additive.
- [ ] **T40**. User docs (designing workflows, approval rules, delegation) and `docs/specs/README.md` index row. Test: docs build.

## Phase 5 — Advanced capabilities (plan phase 3)

- [ ] **T41**. Simulation with what-if values over definitions, approvers and timers; writes and sends nothing. Files:
  `wf/simulation/workflow-simulation.service.ts`, `wf/simulation/workflow-simulation.controller.ts`,
  `wf/simulation/dto/simulate-workflow.dto.ts`. Test: `wf/simulation/workflow-simulation.service.spec.ts` asserting no
  rows, no outbox, no mail (FR-56).
- [ ] **T42**. Version publication with migration preview and core operation `WORKFLOW_MIGRATE` (keep or move by
  mapping). Files: `wf/versions/workflow-migration.service.ts`, `wf/versions/workflow-migrate.operation.ts`. Test:
  in-flight instances moved per mapping and recorded (FR-57).
- [ ] **T43**. Re-approval and lapse: approved snapshot, band and field guards, invalidation from record events through
  `subscriber:workflows-records`. Files: `wf/reapproval/approval-validity.service.ts`,
  `wf/events/workflow-records.consumer.ts`. Test: grown amount re-routes; lapse after N days (FR-23).
- [ ] **T44**. Segregation of duties options (one step per person, not the amount editor, outside the requester's team).
  Files: `wf/engine/segregation-of-duties.ts`. Test: matrix spec `wf/engine/segregation-of-duties.spec.ts` (FR-26).
- [ ] **T45**. Automatic delegation during approved time off (`workflows.delegations.sweep`, time-off events). Files:
  `wf/workflow-delegation/time-off-delegation.service.ts`, `wf/schedule/workflows-delegations.scheduler.ts`,
  `wf/schedule/workflows-delegations.worker.ts`. Test: tasks move and return (FR-44).
- [ ] **T46**. Escalation actions (add approver, reassign, decide within allowed bounds) in working hours. Files:
  `wf/service-levels/escalation-actions.ts`. Test: spec with holidays (FR-46).
- [ ] **T47**. Agent approver and adviser through `WORKFLOW_AGENTS` and `subscriber:workflows-agents`; limits enforced
  by the engine; hand-over to humans. Files: `wf/agents/workflow-agents.service.ts`,
  `wf/events/workflow-agents.consumer.ts`. Test: within and beyond limits; adviser never decides (FR-59 to FR-62).
- [ ] **T48**. Chat cards through `WORKFLOW_CHAT`, offered only where `FEATURE_CHAT_RECORD_CARDS` is on. Files:
  `wf/chat/workflow-chat-cards.service.ts`. Test: decision from the card recorded with channel chat (FR-39).
- [ ] **T49**. Template library (FR-58) and `workflows_draft_definition`. Files: `wf/defaults/workflow-template-library.ts`,
  `packages/mcp-server/src/lib/tools/workflows.ts`. Test: each template validates and publishes.
- [ ] **T50** (parallel). One-tap decisions and an offline decision queue in the installable Gauzy web app, verified on
  sync (FR-38). Files: `wfui/services/workflow-offline-decisions.service.ts`,
  `packages/ui-core/shared/src/lib/workflows/approval-card/approval-card.component.ts`, record-version check on sync in
  `wf/workflow-task/workflow-task.service.ts`. Test: an offline decision on a changed record is refused with the changes
  shown.
- [ ] **T51**. Core settler registry: built by T53 (Phase 1, `ra/request-approval-settler.registry.ts`); its tests are T53's.
- [ ] **T52**. Provide the ports other features bind to (plan, **Consumer tokens answered**): `ACCESS_APPROVALS`, `APPROVAL_REQUESTS`, `ATTENDANCE_APPROVALS`, `AUTOMATION_APPROVALS`, `EXPENSE_APPROVALS`, `HELPDESK_APPROVALS`, `HR_APPROVALS`, `MARKETING_APPROVALS`, `PAYROLL_APPROVALS`, `PERFORMANCE_APPROVALS`, `PORTAL_APPROVALS`, `PROJECT_APPROVALS`, `RECRUITMENT_APPROVALS`, `SHIFTS_APPROVALS`, `CUSTOM_FIELDS_WORKFLOW`, `RECORD_VIEWS_WORKFLOW_STATE`. Files: `apps/api/src/plugin-composition.ts`. Test: one contract test per token over the shape its consumer plan states; with this feature off each consumer keeps its stated fallback.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Scope, flags and compatibility | T3, T9, T12, T38, T54 |
| FR-2 | §3.1 Scope, flags and compatibility | T2, T11, T16, T17, T32 |
| FR-3 | §3.1 Scope, flags and compatibility | T1, T39 |
| FR-4 | §3.2 Definitions, states, transitions, conditions | T12, T13 |
| FR-5 | §3.2 Definitions, states, transitions, conditions | T1, T10 |
| FR-6 | §3.2 Definitions, states, transitions, conditions | T10, T13 |
| FR-7 | §3.2 Definitions, states, transitions, conditions | T5, T10 |
| FR-8 | §3.2 Definitions, states, transitions, conditions | T10, T20 |
| FR-9 | §3.2 Definitions, states, transitions, conditions | T10 |
| FR-10 | §3.2 Definitions, states, transitions, conditions | T12, T13 |
| FR-11 | §3.3 Governing records | T13, T16, T18, T21 |
| FR-12 | §3.3 Governing records | T6, T13, T23 |
| FR-13–FR-14 | §3.3 Governing records | T13 |
| FR-15 | §3.3 Governing records | T13, T21 |
| FR-16 | §3.3 Governing records | T13 |
| FR-17 | §3.4 Approval steps and approvers | T10 |
| FR-18 | §3.4 Approval steps and approvers | T14 |
| FR-19 | §3.4 Approval steps and approvers | T11, T14 |
| FR-20 | §3.4 Approval steps and approvers | T14 |
| FR-21–FR-22 | §3.4 Approval steps and approvers | T10 |
| FR-23 | §3.4 Approval steps and approvers | T43 |
| FR-24–FR-25 | §3.5 Decisions and segregation of duties | T11 |
| FR-26 | §3.5 Decisions and segregation of duties | T44 |
| FR-27–FR-28 | §3.5 Decisions and segregation of duties | T15 |
| FR-29 | §3.5 Decisions and segregation of duties | T13 |
| FR-30 | §3.5 Decisions and segregation of duties | T15 |
| FR-31–FR-34 | §3.6 Value-based approval rules | T22 |
| FR-35 | §3.7 Inbox, queue and channels | T24 |
| FR-36 | §3.7 Inbox, queue and channels | T15, T35 |
| FR-37 | §3.7 Inbox, queue and channels | T25 |
| FR-38 | §3.7 Inbox, queue and channels | T50 |
| FR-39 | §3.7 Inbox, queue and channels | T48 |
| FR-40 | §3.7 Inbox, queue and channels | T15, T38, T54 |
| FR-41 | §3.7 Inbox, queue and channels | T26 |
| FR-42 | §3.7 Inbox, queue and channels | T29 |
| FR-43 | §3.8 Delegation, reminders, service levels, escalation | T27 |
| FR-44 | §3.8 Delegation, reminders, service levels, escalation | T45 |
| FR-45 | §3.8 Delegation, reminders, service levels, escalation | T15 |
| FR-46 | §3.8 Delegation, reminders, service levels, escalation | T28, T46 |
| FR-47 | §3.8 Delegation, reminders, service levels, escalation | T28 |
| FR-48 | §3.9 Existing approvals and the approval gateway | T16, T17 |
| FR-49–FR-50 | §3.9 Existing approvals and the approval gateway | T16 |
| FR-51 | §3.9 Existing approvals and the approval gateway | T12, T16, T32 |
| FR-52 | §3.9 Existing approvals and the approval gateway | T16 |
| FR-53–FR-54 | §3.9 Existing approvals and the approval gateway | T18 |
| FR-55 | §3.10 Designer, simulation, versions | T33, T34 |
| FR-56 | §3.10 Designer, simulation, versions | T41 |
| FR-57 | §3.10 Designer, simulation, versions | T42 |
| FR-58 | §3.10 Designer, simulation, versions | T49 |
| FR-59–FR-62 | §3.11 Agents | T47 |
| FR-63 | §3.12 Record UI, audit and real time | T13, T31 |
| FR-64 | §3.12 Record UI, audit and real time | T23 |
| FR-65 | §3.12 Record UI, audit and real time | T29, T55 |
| FR-66 | §3.12 Record UI, audit and real time | T29 |
| FR-67 | §3.13 Reports | T30 |
| FR-68 | §3.9 Existing approvals and the approval gateway | T53 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off; enabling it in dev shows the feature end to end.
- Constitution gates in `spec.md` §9 confirmed.
- Feature checks: the request-approval contract suite passes with the router unbound and with default definitions
  (AC-2); a two-step purchase order definition confirms through the document engine (AC-1); a gateway outcome is
  delivered once (AC-6); used or stale links decide nothing (AC-7); simulation writes nothing (AC-9); with
  `FEATURE_WORKFLOWS` off every workflow route answers `404` (AC-13).
