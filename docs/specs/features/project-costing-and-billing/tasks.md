# Task Breakdown: Project costing and billing

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `project-costing-and-billing`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind the feature flag: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it.
- `PC/` = `packages/plugins/project-costing/src/lib/`, `PCU/` = `packages/plugins/project-costing-ui/src/lib/`,
  `TT/` = `packages/core/src/lib/time-tracking/`. Every entity file has its `repository/type-orm-<name>.repository.ts`
  and `repository/mikro-orm-<name>.repository.ts` beside it, every controller its `dto/` folder; plugin migrations
  live in `PC/database/migrations/` and are listed in `PC/database/project-costing-migrations.ts`; Angular components
  sit in `PCU/components/<name>/<name>.component.ts` with their `*.component.spec.ts`.
- T60 and T64 are listed first (Phase 0) because the tables of T3 and T4 reference the core `task_template` and T16
  instantiates it; T58 sits before Phase 3 because T37, T40 and T41 use its extension points.

## Phase 0 — Core task templates (before T3 and T4)

- [ ] **T60**. Core task-template module `packages/core/src/lib/task-template/`, entities and migration (entities
  `task_template`, `task_template_task`, `task_template_dependency`, core migration `CreateTaskTemplateTables` in three
  dialects), shared with `hr-core-lifecycle`; no dependency on this plugin or its flag; `instantiate` is T64. Files:
  `packages/contracts/src/lib/task-template.model.ts`, `packages/core/src/lib/task-template/task-template.entity.ts`,
  `task-template-task.entity.ts`, `task-template-dependency.entity.ts`, `task-template.module.ts` (all in
  `packages/core/src/lib/task-template/`), `packages/core/src/lib/database/migrations/1791000094000-CreateTaskTemplateTables.ts`.
  Test: `packages/core/src/lib/task-template/task-template.migration.spec.ts` (up twice on the three dialects; mapping
  under both ORMs; the core module loads with no plugin loaded; on a fresh database with every migration pending, the
  core task-template tables exist before `1791000094100` and `1791000094110` create their foreign keys to them).
- [ ] **T64**. `TaskTemplateService.instantiate` on the module of T60: preview, working-day dating through an optional
  working-calendar port (fallback core official holidays plus weekend), parent and blocking-link remap; no dependency on
  this plugin or its flag. Files: `packages/core/src/lib/task-template/task-template.service.ts`,
  `packages/core/src/lib/task-template/task-template.module.ts`. Test:
  `packages/core/src/lib/task-template/task-template.service.spec.ts` (holiday skip, remap, inactive refused, 500 tasks
  under 3 s; the core service works with no plugin loaded).

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts `packages/contracts/src/lib/project-costing.model.ts` (interfaces incl. `IWorkActivityType`,
      enums, previews, events, port tokens, core guard interfaces) exported from `index.ts`; `ProjectStatusEnum.PAUSED`,
      `ProjectBillingEnum.RETAINER`, `ApprovalPolicyTypesStringEnum.TIMESHEET_PORTION` / `PROJECT_BUDGET`; optional
      schedule members in `invoice-schedule.model.ts`; `PermissionsEnum` keys of plan §9. Files:
      `packages/contracts/src/lib/organization-projects.model.ts` (`ProjectStatusEnum`, `ProjectBillingEnum`),
      `packages/contracts/src/lib/approval-policy.model.ts`, `packages/contracts/src/lib/invoice-schedule.model.ts`,
      `packages/contracts/src/lib/role-permission.model.ts`, `packages/contracts/src/index.ts`. Test:
      `packages/contracts/src/lib/project-costing.model.spec.ts` (snapshot; enum additions do not change existing
      values).
- [ ] **T2**. Plugin scaffold `packages/plugins/project-costing` (package, project, tsconfig, jest, eslint, path alias),
      `project-costing.plugin.ts`, `project-costing.module.ts`, `project-costing.features.ts` (`FEATURE_PROJECT_COSTING`,
      `defaultEnabled: false`), `project-costing.permissions.ts`, `project-costing.settings.ts`, `project-costing-enabled.ts`
      (`GAUZY_PROJECT_COSTING_ENABLED`); listed in `apps/api/src/plugins.ts`. Files: `packages/plugins/project-costing/`
      (`package.json`, `project.json`, `tsconfig.json`, `tsconfig.lib.json`, `jest.config.ts`, `.eslintrc.json`,
      `src/index.ts`), `PC/project-costing.plugin.ts`, `PC/project-costing.module.ts`, `PC/project-costing.features.ts`,
      `PC/project-costing.permissions.ts`, `PC/project-costing.settings.ts`, `PC/project-costing-enabled.ts`,
      `apps/api/src/plugins.ts`. Test: `apps/api/src/plugins.matrix.spec.ts` and `PC/project-costing-enabled.spec.ts`
      (plugin absent or flag off loads nothing).
- [ ] **T3**. `1791000094100-CreateProjectCostingSetupTables` on the shared core migration helpers of `procurement` T4 (`@gauzy/core`)
      (types, profiles, sales-order links, stakeholders on `organization_contact`) with entities; settings are the
      contributions of `project-costing.settings.ts` in the settings store. Files:
      `PC/database/migrations/1791000094100-CreateProjectCostingSetupTables.ts`, `PC/database/project-costing-migrations.ts`,
      `PC/project-types/project-type.entity.ts`, `PC/profiles/project-profile.entity.ts`,
      `PC/profiles/project-sales-order-link.entity.ts`, `PC/stakeholders/project-stakeholder.entity.ts`. Test:
      `PC/database/project-costing-migrations.spec.ts` (up twice on PostgreSQL, MySQL, SQLite);
      `PC/project-costing-orm-parity.spec.ts`. Migration timestamps: `1791000094100` to `1791000094199` (`packages/plugins/project-costing`); `1791000094000` to `1791000094099` (`packages/core`).
- [ ] **T4** (parallel). `1791000094110-CreateProjectTemplateDetailTable` and `1791000094120-CreateTaskPlanningTables` with entities
      (project template detail on core `task_template`, task plan, issue-type default, task dependency, recurrence on the
      core recurrence rule columns, baselines). Files:
      `PC/database/migrations/1791000094110-CreateProjectTemplateDetailTable.ts`,
      `PC/database/migrations/1791000094120-CreateTaskPlanningTables.ts`, `PC/templates/project-template-detail.entity.ts`,
      `PC/tasks/task-plan.entity.ts`, `PC/tasks/issue-type-default.entity.ts`, `PC/dependencies/task-dependency.entity.ts`,
      `PC/tasks/task-recurrence.entity.ts`, `PC/baselines/project-baseline.entity.ts`. Test:
      `PC/database/project-costing-migrations.spec.ts`.
- [ ] **T5** (parallel). `1791000094130-CreateTimeCostingTables` (work activity type, rate card with `payRate`, time-log cost
      without bill-side copies, timesheet portion) and `1791000094140-CreateProjectBudgetTables`. Files:
      `PC/database/migrations/1791000094130-CreateTimeCostingTables.ts`,
      `PC/database/migrations/1791000094140-CreateProjectBudgetTables.ts`, `PC/work-activity-types/work-activity-type.entity.ts`,
      `PC/rate-cards/rate-card.entity.ts`, `PC/costing/time-log-cost.entity.ts`, `PC/timesheets/timesheet-portion.entity.ts`,
      `PC/budgets/project-budget.entity.ts`, `PC/budgets/project-budget-line.entity.ts`. Test:
      `PC/database/project-costing-migrations.spec.ts` (unique live keys refuse duplicates).
- [ ] **T6** (parallel). `1791000094150-CreateProjectFigureTables` (append-only sources with triggers on PostgreSQL and MySQL and
      a repository guard on SQLite, figures, forecasts), `1791000094160-CreateProjectBillingTables` (plan, retainers),
      `1791000094170-CreateCapacityTables`, `1791000094180-CreateProjectUpdateTables`. Files:
      `PC/database/migrations/1791000094150-CreateProjectFigureTables.ts`,
      `PC/database/migrations/1791000094160-CreateProjectBillingTables.ts`,
      `PC/database/migrations/1791000094170-CreateCapacityTables.ts`,
      `PC/database/migrations/1791000094180-CreateProjectUpdateTables.ts`, `PC/figures/project-figure-source.entity.ts`,
      `PC/figures/project-figure.entity.ts`, `PC/forecast/project-forecast.entity.ts`, `PC/billing/billing-plan-entry.entity.ts`,
      `PC/billing/project-retainer.entity.ts`, `PC/capacity/project-allocation.entity.ts`, `PC/updates/project-update.entity.ts`,
      `PC/updates/project-update-round.entity.ts`. Test: `PC/database/project-costing-migrations.spec.ts` (update of a
      source row refused).
- [ ] **T7**. Permission and feature contributions with `defaultFor` (role grants of plan §9) in
      `project-costing.permissions.ts` / `.features.ts`, and registration of the tables with tenant export, import and
      factory reset; no seed migration. Files: `PC/project-costing.permissions.ts`, `PC/project-costing.features.ts`,
      `PC/project-costing.plugin.ts`. Test: `PC/project-costing.permissions.spec.ts` (grants per role from the
      contributions, only while the feature is on; export lists the tables).
- [ ] **T61**. Core outbox events: append `time_tracking.time_log.changed` in
      `packages/core/src/lib/time-tracking/time-log/commands/handlers/*` and the timer stop path, and
      `time_tracking.timesheet.status_changed` in the timesheet submit and status handlers, only when a consumer is
      registered. Files: `TT/time-log/commands/handlers/`, `TT/timer/timer.service.ts`,
      `TT/timesheet/commands/handlers/timesheet-submit.handler.ts`,
      `TT/timesheet/commands/handlers/timesheet-update-status.handler.ts`, `TT/time-tracking-events.ts`. Test:
      `TT/time-tracking-events.dual-orm.spec.ts` (one case per write path; no outbox row without a consumer); existing
      time-log suites green.
- [ ] **T62**. Core optional ports `TIME_LOG_WRITE_GUARD`, `TASK_WRITE_GUARD`, `TIMESHEET_APPROVAL_ROUTER` called from
      `time-log.service.ts`, `timer.service.ts`, `task.service.ts`, `task-linked-issue.service.ts` and the timesheet
      status handler. Files: `TT/time-log/time-log.service.ts`, `TT/timer/timer.service.ts`,
      `packages/core/src/lib/tasks/task.service.ts`, `packages/core/src/lib/tasks/linked-issue/task-linked-issue.service.ts`,
      `TT/timesheet/commands/handlers/timesheet-update-status.handler.ts`, `packages/core/src/lib/time-tracking/time-tracking.ports.ts`.
      Test: `TT/time-tracking.ports.spec.ts` (bound fake guard can refuse); unbound ports change nothing (existing
      suites).

## Phase 2 — Services, endpoints, events

- [ ] **T8**. Core outbox events of time tracking: built by T61 (Phase 1, `packages/core/src/lib/time-tracking/`); its tests are T61's.
- [ ] **T9**. Core optional ports of time tracking and tasks: built by T62 (Phase 1, `packages/core/src/lib/time-tracking/`); its tests are T62's.
- [ ] **T10**. Settings over the settings store (`projectCosting.*` keys, organization level), project types and
      profiles services and controllers (`settings/`, `project-types/`, `profiles/`), project code from the series
      (`BUSINESS_DOCUMENT_ENGINE`, fallback core `SequenceService`), derived actuals (billed seconds from
      `time_log.invoiceItemId`). Files: `PC/settings/project-costing-settings.service.ts`, `PC/settings/project-costing-settings.controller.ts`,
      `PC/project-types/project-type.service.ts`, `PC/project-types/project-type.controller.ts`,
      `PC/profiles/project-profile.service.ts`, `PC/profiles/project-profile.controller.ts`, `PC/profiles/project-code.service.ts`,
      `PC/profiles/project-actuals.service.ts`. Test: `PC/settings/project-costing-settings.service.spec.ts` (defaults
      are today's behaviour); `PC/profiles/project-profile.service.spec.ts` (code from the series, existing codes kept;
      actuals derived); `PC/project-costing.routes.e2e-spec.ts` (routes answer `404` with the flag off).
- [ ] **T11**. Work activity types and their assignment to logs (`work-activity-types/`, issue-type defaults, project
      and employee defaults; a default type created when the feature is first enabled). Files:
      `PC/work-activity-types/work-activity-type.service.ts`, `PC/work-activity-types/work-activity-type.controller.ts`,
      `PC/work-activity-types/activity-derivation.ts`. Test: `PC/work-activity-types/activity-derivation.spec.ts`
      (derivation order table; logs of operation cards and visits get their type).
- [ ] **T12**. Time costing consumer `costing/time-cost.consumer.ts` and cost resolver `costing/rate-resolver.ts`
      (cards, activity defaults, `PROJECT_COST_RATE_SOURCE`, then `time_log.payRateValue`); bill side read from the log's
      stored rates through `time-log-pricing.ts`, a card bill rate written to `billRateOverride` only where that
      precedence finds no positive rate or activity-first is chosen. Files: `PC/costing/time-cost.consumer.ts`,
      `PC/costing/rate-resolver.ts`, `TT/time-log/time-log-pricing.ts`. Test: `PC/costing/rate-resolver.spec.ts`
      (resolution golden table); `PC/costing/time-cost.consumer.spec.ts` (existing bill amounts unchanged for every
      existing precedence case; no bill amount copied; logs written by other features costed).
- [ ] **T13**. Rate cards CRUD, import and recosting with reason (`rate-cards/`; reason in `activity_log`, above 1,000
      logs a core operation `PROJECT_COSTING_RECOST`; bill rates only through the existing rate paths and
      `time-log-repricing.ts`), rate explanation, unpriced hours, `PROJECT_RATE_CARDS` provider (pay, cost and bill rate of
      an employee on a project at a date). Test: dated card picks; approved logs untouched without recosting;
      explanation names the card; provider answers pay rates by date. Files: `PC/rate-cards/rate-card.service.ts`,
      `PC/rate-cards/rate-card.controller.ts`, `PC/rate-cards/recost.service.ts`, `PC/rate-cards/rate-explanation.service.ts`,
      `PC/rate-cards/unpriced-hours.service.ts`, `PC/rate-cards/rate-card.reader.ts`, `TT/time-log/time-log-repricing.ts`.
      Spec files: `PC/rate-cards/rate-card.service.spec.ts`, `PC/rate-cards/recost.service.spec.ts`.
- [ ] **T14**. Figure engine `figures/` (append source, rebuild sum, drill), labour estimated from time, expense figures
      read from `EXPENSE_SPEND` when bound (direct expenses as sources otherwise), reconcile job whose watermark is the
      organization's last succeeded `job_execution` of the job; sources keyed by `sourceLineKey` (`*` without a line)
      and `revision`, a correction appending the difference to the earlier rows as the next revision, and the reconcile
      pass appending the reversing revision for a source log deleted or soft-deleted meanwhile (plan §3, §8). Files:
      `PC/figures/figure-engine.service.ts`,
      `PC/figures/figure.controller.ts`, `PC/figures/figure-reconcile.scheduler.ts`. Test:
      `PC/figures/figure-engine.service.spec.ts` (replays never double count, a log-level source without a line
      included; a cost changed from 10 to 15 sums to 15 with two rows, and a replay of either revision adds nothing;
      roll-up per task, module and parent; no expense source written while `EXPENSE_SPEND` is bound);
      `PC/figures/figure-reconcile.spec.ts` (reconcile corrects a log written without an event; a costed log deleted
      while the feature was off is brought to zero once, and a second pass adds nothing).
- [ ] **T15**. Progress methods and completion cascade (`progress/`; `MANUAL` for existing projects and projects without
      a type; the complete action may leave open tasks; the existing project form untouched), paused status handling,
      duplication of projects. Files: `PC/progress/progress-methods.ts`, `PC/progress/completion-cascade.service.ts`,
      `PC/progress/project-duplicate.service.ts`, `PC/progress/progress.controller.ts`. Test:
      `PC/progress/progress-methods.spec.ts` (golden cases per method); `PC/progress/completion-cascade.service.spec.ts`
      (order follows dependencies; no automatic reopening; an existing project is never completed automatically);
      `PC/progress/project-duplicate.service.spec.ts` (time and invoices never copied).
- [ ] **T16**. Project templates (`templates/`) on the core task-template module of T60: CRUD of `PROJECT` templates
  with their project details, instantiate into a new project, save project as template. Files:
  `PC/templates/project-template.service.ts`, `PC/templates/project-template.controller.ts`. Test:
  `PC/templates/project-template.service.spec.ts` (a project created from a template carries its tasks, dependencies
  and details; inactive template refused; offsets taken from task dates on save).
- [ ] **T17**. Task plans, weights and parent rules (`tasks/`), `TASK_WRITE_GUARD` implementation (parent done: a warning,
      a refusal only with `dependencyEnforcement = BLOCK`; dates warnings; closed-task time rule through
      `TIME_LOG_WRITE_GUARD.beforeStart`, `ALLOW` by default); overdue and delayed days and who completed a task and when.
      Files: `PC/tasks/task-plan.service.ts`, `PC/tasks/task-plan.controller.ts`, `PC/tasks/task-write.guard.ts`,
      `PC/tasks/time-log-write.guard.ts`. Test: `PC/tasks/task-write.guard.spec.ts` and `PC/tasks/time-log-write.guard.spec.ts`
      (per rule and setting; with the defaults no existing task or time write is refused);
      `PC/tasks/task-plan.service.spec.ts` (weights from the issue type; completion recorded).
- [ ] **T18**. Dependencies (`dependencies/`): normalise blocking links, kind and lag, cycle refusal, done-move
      enforcement, rescheduling service with preview and the critical path. Files:
      `PC/dependencies/task-dependency.service.ts`, `PC/dependencies/task-dependency.controller.ts`,
      `PC/dependencies/reschedule.service.ts`, `PC/dependencies/critical-path.ts`. Test:
      `PC/dependencies/reschedule.service.spec.ts` (cycle detection naming the chain, shift with durations, 2,000-task
      chain under 1 s).
- [ ] **T19**. Timesheet portions and routing (`timesheets/`): build portions on submit, `PROJECT_APPROVALS` with default
      definitions (project managers, reporting line, permission holders), fallback without `approval-workflows`: a core
      `request_approval` of type `TIMESHEET_PORTION` with the approvers named, its gate registered in
      `linked-document-decision.gate.ts` and its settler registered with the core settler registry
      (`registerRequestApprovalSettler`, `approval-workflows` T53); no portion routed to its own employee, self-approval
      through the existing status route refused only with `refuseSelfApproval` on, decisions with `409`, router for the
      existing status route (direct approval approves all portions as an override). Files: `PC/timesheets/timesheet-portion.service.ts`,
      `PC/timesheets/timesheet-portion.controller.ts`, `PC/timesheets/timesheet-approval.router.ts`,
      `PC/timesheets/portion-request-approval.settler.ts`, `packages/core/src/lib/request-approval/linked-document-decision.gate.ts`.
      Test: `PC/timesheets/timesheet-portion.service.spec.ts`: two-project sheet;
      denial returns; the portion appears and is decided on the existing Approvals page with workflows off; existing
      status and request-approval suites green with the feature off.
- [ ] **T20**. Locks and reopen: `timesheet.lockedAt` set on approval with locking on and cleared on reopen,
      `TIME_LOG_WRITE_GUARD.beforeUpdate/beforeDelete` reading it, reopen reason in `activity_log`; reminders and missing
      days job through `NOTIFICATION_DISPATCHER` with `dedupeKey`; change-request screen endpoints over the existing
      routes. Files: `PC/timesheets/timesheet-lock.service.ts`, `PC/timesheets/timesheet-reminders.scheduler.ts`,
      `PC/timesheets/change-request.controller.ts`, `TT/timesheet/timesheet.entity.ts` (`lockedAt`). Test:
      `PC/timesheets/timesheet-lock.service.spec.ts`: with locking on, edits refused on approved sheets; with it off (the default), approved sheets stay
      editable; reopen resubmits; desktop upload into a locked period becomes a change request; a second reminder sweep
      sends nothing.
- [ ] **T21**. Billing hours with rounding (existing duration rounding rule) and overtime multiplier through
      `PROJECT_OVERTIME_FACTS`. Files: `PC/costing/billing-hours.service.ts`, `PC/costing/overtime-cost.ts`. Test:
      `PC/costing/billing-hours.service.spec.ts` (billing hours used by invoice readers; reason required);
      `PC/costing/overtime-cost.spec.ts` (multiplier only on approved overtime).
- [ ] **T22**. Project budgets (`budgets/`): versions, lines, spread, submit and approve through `PROJECT_APPROVALS`
      (fallback core request approval `PROJECT_BUDGET`), revisions with diff, fill from template, estimates or project,
      the `budgetSource` rule (project or accounting budget governs, the other read-only), mirroring to the existing
      budget fields on by default. Files: `PC/budgets/project-budget.service.ts`,
      `PC/budgets/project-budget.controller.ts`, `PC/budgets/budget-mirror.service.ts`, `PC/budgets/budget-fill.service.ts`.
      Test: `PC/budgets/project-budget.service.spec.ts` (immutability, diff, mirroring read by the existing project budget
      report; drafting off when the accounting budget governs).
- [ ] **T23**. Budget availability and thresholds: `PROJECT_BUDGET_AVAILABILITY` provider, threshold notices through the
      dispatcher, optional warning on time beyond hours, accounting budget list through `PROJECT_ACCOUNTING_BUDGETS`.
      Files: `PC/budgets/project-budget-availability.service.ts`, `PC/budgets/budget-threshold.service.ts`,
      `PC/budgets/accounting-budget-list.service.ts`. Test: `PC/budgets/budget-threshold.service.spec.ts` (committed
      counted; one notice per threshold and version; time capture never blocked).
- [ ] **T24** (parallel). Figure consumers for supplier bills, purchase commitments, invoices and credit notes, stock
      issues, ledger actuals, payroll allocation with variance, sales orders for contract value. Files:
      `PC/figures/consumers/supplier-bill.consumer.ts`, `PC/figures/consumers/purchase-commitment.consumer.ts`,
      `PC/figures/consumers/invoice.consumer.ts`, `PC/figures/consumers/stock-issue.consumer.ts`,
      `PC/figures/consumers/ledger-actuals.consumer.ts`, `PC/figures/consumers/payroll-allocation.consumer.ts`,
      `PC/figures/consumers/sales-order.consumer.ts`. Test: one `*.consumer.spec.ts` beside each consumer (idempotent
      replay; payroll replaces estimate per employee and period; contract value from linked orders when none is typed).
- [ ] **T25**. Costing view, overview cards, portfolio and ledger agreement read models (`views/`). Files:
      `PC/views/costing-view.service.ts`, `PC/views/overview-cards.service.ts`, `PC/views/portfolio.service.ts`,
      `PC/views/ledger-agreement.service.ts`, `PC/views/views.controller.ts`. Test: `PC/views/overview-cards.service.spec.ts`
      (cards fail independently); `PC/views/costing-view.service.spec.ts` (margin per basis; amounts hidden without
      `PROJECT_COSTS_VIEW`).
- [ ] **T26**. Billing plan and milestones (`billing/`): entries, reach from task and module completion, acceptance,
      withdraw before invoicing, date entries, `BILLABLE_SOURCE_REGISTRY` reader `MILESTONE`, invoiced state from
      invoice events. Files: `PC/billing/billing-plan.service.ts`, `PC/billing/billing-plan.controller.ts`,
      `PC/billing/milestone-billable.reader.ts`. Test: `PC/billing/billing-plan.service.spec.ts` (offered once; reopen
      after invoicing only warns; percentages above 100 refused).
- [ ] **T27**. Time-and-materials and fixed-fee rules for the worklist (approved time only, billing hours, fixed-fee
      time kept out), re-billable expenses in billable figures; the existing invoice pages keep offering tracked time as
      today. Files: `PC/billing/time-materials.reader.ts`, `PC/billing/billable-time.rules.ts`. Test:
      `PC/billing/time-materials.reader.spec.ts` (worklist reader returns the expected entries); existing
      invoice-from-time specs unchanged.
- [ ] **T28**. Stakeholders as `organization_contact` rows (company through `contact_buyer`) with welcome email and
      switches; sales-order links. Files: `PC/stakeholders/project-stakeholder.service.ts`,
      `PC/stakeholders/project-stakeholder.controller.ts`, `PC/profiles/project-sales-order-link.service.ts`. Test:
      `PC/stakeholders/project-stakeholder.service.spec.ts` (welcome once; revoke; the company shown from the buyer
      membership).
- [ ] **T29**. Capacity figures (`capacity/`) from `HR_WORKING_CALENDAR`, `TIME_OFF_AVAILABILITY`, `SHIFTS_SCHEDULE`, the
      weekly limit, and core `employee_availability` and `availability_slots`; utilization and targets (levels through
      `employee.employeeLevelId` of `hr-core-lifecycle`, else by level label), time goals shown beside. Test: holiday,
      time-off and unavailable-day subtraction; agents excluded; level target found by label without hr-core. Files:
      `PC/capacity/capacity.service.ts`, `PC/capacity/utilization.service.ts`, `PC/capacity/capacity.controller.ts`.
      Spec file: `PC/capacity/capacity.service.spec.ts`.
- [ ] **T30**. Update collections and rounds (`updates/`): schedule on the core recurrence rules, prompts through the
      dispatcher and email, answers in app and by email reply when communications are bound, publish with snapshot and
      digest. Files: `PC/updates/project-update.service.ts`, `PC/updates/project-update.controller.ts`,
      `PC/updates/update-prompts.scheduler.ts`, `PC/updates/update-email-reply.handler.ts`. Test:
      `PC/updates/project-update.service.spec.ts` (non-working days suppress; digest recipients follow switches; a prompt
      is sent once per round).
- [ ] **T31**. Plugin events on the outbox and real-time channels (plan §5); `BUDGET_LABOUR_COST` and
      `RECOGNITION_PROGRESS_SOURCE` providers. Files: `PC/events/project-costing-streamed-events.ts`,
      `PC/events/project-costing-realtime-hints.ts`, `PC/providers/labour-cost.provider.ts`,
      `PC/providers/project-progress.source.ts`. Test: `PC/events/project-costing-streamed-events.spec.ts` (payload
      contracts); `PC/providers/project-progress.source.spec.ts` (answers the budgets plan shapes).
- [ ] **T32**. Report dataset providers and definitions FR-84 to FR-94 and FR-97, dashboard template, catalogue links
      for the existing budget reports. Files: `PC/reports/project-costing-report.definitions.ts`,
      `PC/reports/project-costing-datasets.ts`, `PC/reports/project-costing-overview.dashboard.ts`. Test:
      `PC/reports/project-costing-report.definitions.spec.ts` (figures match a seeded quarter; sensitive fields masked).
- [ ] **T33**. Record type registration (types, templates, budgets, billing entries, updates, allocations) and import
      templates (activity types, rate cards, budgets, templates, allocations). Files: `PC/project-costing.record-types.ts`,
      `PC/project-costing.import-templates.ts`. Test: `PC/project-costing.record-types.spec.ts` (registry; import errors
      per row).
- [ ] **T34**. Onboarding checklist contribution `projects.getting-started`. Files: `PC/onboarding/projects-getting-started.checklist.ts`.
      Test: `PC/onboarding/projects-getting-started.checklist.spec.ts` (steps tick from events).
- [ ] **T35**. Audit entries for FR-103 as core `activity_log` rows (no history table of the plugin). Files:
      `PC/audit/project-costing-audit.service.ts`. Test: `PC/audit/project-costing-audit.service.spec.ts` (before and
      after recorded for each change kind).
- [ ] **T63**. Payroll and invoice reads on timesheets and logs: the paid hours and the payslip that paid each log,
      kept from the payroll allocation events of T24 (`payroll-processing` alone decides payment), and the billed hours
      and percentage from invoice links, returned with the timesheet and its portions. Files:
      `PC/timesheets/timesheet-figures.service.ts`, `PC/figures/consumers/payroll-allocation.consumer.ts`,
      `PC/timesheets/timesheet-portion.controller.ts`. Test: `PC/timesheets/timesheet-figures.service.spec.ts` (paid
      hours and payslip shown after an allocation event; billed percentage from invoice links; nothing shown without
      payroll).
- [ ] **T65**. Time-log cost routes `/time-logs/:id/cost`, `/time-logs/:id/activity`, `/time-logs/:id/billing-hours`
      (plan §4): own or `PROJECT_RATES_VIEW` for the row, the cost rate and cost amount only with `PROJECT_COSTS_VIEW` or
      `PROJECT_RATES_VIEW` (spec FR-102 and the security requirement), activity change by the owner before approval,
      billing hours with `PROJECT_BILLING_HOURS_EDIT` and a reason. Files: `PC/costing/time-log-cost.controller.ts`,
      `PC/costing/time-log-cost.service.ts`, `PC/costing/dto/`. Test: `PC/costing/time-log-cost.controller.spec.ts`: an
      employee without either key reads their own log's activity type and billing hours and no cost rate or amount; a
      holder of `PROJECT_COSTS_VIEW` reads both; another employee's log answers `403`.

## Phase 2b — Core UI extension points (before T37, T40 and T41)

- [ ] **T58**. Core UI: move the project view (`project-view-page.component.ts`, constant `TABS`) onto
      `PageTabRegistryService` with tabset `project-view-page` (added to `PageTabsetPageId`), its five tabs registered
      first with their order and URLs; add `PROJECT_OVERVIEW_CARDS`, `PROJECT_FORM_FIELDS`, `TASK_VIEW_SECTIONS` and
      `TIMESHEET_APPROVAL_DETAIL` to `PAGE_EXTENSION_SLOTS` and place them in the Overview tab, the project mutation form,
      the task view page and the timesheet Approvals tab. Files:
      `apps/gauzy/src/app/pages/projects/components/project-view/project-view-page.component.ts`, `packages/ui-core/core/src/lib/services/page/page-tab-registry.types.ts` (`PageTabsetPageId`),
      `packages/plugin-ui/src/lib/plugin-extension/page-extension-slot.types.ts` (`PAGE_EXTENSION_SLOTS`), the project
      mutation form, the task view page and the timesheet Approvals tab components. Test:
      `project-view-page.component.spec.ts` beside the component: project view, form, task view and approvals render as
      today with no extension registered; a test extension appears in each slot.

## Phase 3 — UI surfaces

- [ ] **T36**. Angular `packages/plugins/project-costing-ui` scaffold registered in `apps/gauzy/src/plugin-ui.config.ts`;
      menu entries and guards; i18n `PROJECT_COSTING.*` in every locale. Files: `packages/plugins/project-costing-ui/`
      (`package.json`, `project.json`, `jest.config.ts`), `PCU/project-costing-ui.plugin.ts`, `PCU/project-costing-ui.routes.ts`,
      `apps/gauzy/src/plugin-ui.config.ts`, `packages/ui-core/i18n/assets/i18n/*.json`. Test:
      `PCU/project-costing-ui.plugin.spec.ts` (menu hidden with flag off).
- [ ] **T37** (after T58). Project form fields through `PROJECT_FORM_FIELDS`, overview cards through
      `PROJECT_OVERVIEW_CARDS` and the Costing tab on the `project-view-page` tabset. Files:
      `PCU/components/project-form-fields/`, `PCU/components/project-overview-cards/`, `PCU/components/project-costing-tab/`.
      Test: their component specs (amounts hidden without permission; existing tabs unchanged).
- [ ] **T38** (parallel). Settings, Project types, Work activity types and Rate cards pages with the rate explanation
      drawer and unpriced hours list. Files: `PCU/components/costing-settings/`, `PCU/components/project-types/`,
      `PCU/components/work-activity-types/`, `PCU/components/rate-cards/`, `PCU/components/rate-explanation-drawer/`,
      `PCU/components/unpriced-hours/`. Test: their component specs (rendering and forms).
- [ ] **T39** (parallel). Templates pages with the instantiation preview; duplicate dialog; completion cascade dialog.
      Files: `PCU/components/project-templates/`, `PCU/components/template-instantiate-preview/`,
      `PCU/components/project-duplicate-dialog/`, `PCU/components/completion-cascade-dialog/`. Test:
      `PCU/components/template-instantiate-preview/template-instantiate-preview.component.spec.ts` (preview lists dated
      tasks).
- [ ] **T40** (after T58). Task plan fields, dependency kind and lag and the recurrence editor through
      `TASK_VIEW_SECTIONS` of the existing task view. Files: `PCU/components/task-plan-section/`,
      `PCU/components/task-dependencies-section/`, `PCU/components/task-recurrence-editor/`. Test: their component specs
      (cycle error shown; recurrence rule round trip; overdue days shown).
- [ ] **T41** (after T58). Timesheet portions and the decision dialog with activity evidence in the existing Approvals
      tab through `TIMESHEET_APPROVAL_DETAIL`; reopen; change-request screen as a `timesheet-sections` tab; missing-days
      banner. Files: `PCU/components/timesheet-portions/`, `PCU/components/portion-decision-dialog/`,
      `PCU/components/timesheet-change-requests/`, `PCU/components/missing-days-banner/`. Test:
      `PCU/components/portion-decision-dialog/portion-decision-dialog.component.spec.ts` (concurrent decision shows the
      `409` message).
- [ ] **T42**. Budget tab: versions, grid of lines and months, revision diff, accounting budget list. Files:
      `PCU/components/project-budget-tab/`, `PCU/components/budget-revision-diff/`. Test:
      `PCU/components/project-budget-tab/project-budget-tab.component.spec.ts` (approved version read-only).
- [ ] **T43**. Billing tab: plan entries, acceptance, retainer card, the project's invoice schedule and its runs. Updates
      tab: collection settings, rounds, answers, publish. Stakeholders tab. Files: `PCU/components/project-billing-tab/`,
      `PCU/components/project-updates-tab/`, `PCU/components/project-stakeholders-tab/`. Test: their component specs
      (rendering).
- [ ] **T44**. Portfolio and Utilization pages from report definitions. Files: `PCU/components/portfolio/`,
      `PCU/components/utilization/`. Test: their component specs (filters keep state in the URL).
- [ ] **T45** (parallel). Ever Teams contract: OpenAPI examples and contract tests for the routes its screens use
      (costing and forecast cards, portion decisions, update answers, work activity types for the timer); no React
      package. Files: the DTOs of `PC/views/`, `PC/timesheets/`, `PC/updates/` and `PC/work-activity-types/` (examples),
      `PC/teams-contract.spec.ts`. Test: `PC/teams-contract.spec.ts` (contract specs pass against the API).

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T46**. MCP tools `packages/mcp-server/src/lib/tools/project-costing.ts` (read tools of plan §7) registered in
      `register-all-tools.ts`. Files: `packages/mcp-server/src/lib/tools/project-costing.ts`,
      `packages/mcp-server/src/lib/tools/register-all-tools.ts`. Test:
      `packages/mcp-server/src/lib/tools/project-costing.spec.ts` (input schemas; tools call existing routes only).
- [ ] **T47**. Composition bindings in `apps/api/src/plugin-composition.ts` for every port of plan §7 with fallbacks.
      Files: `apps/api/src/plugin-composition.ts`, `PC/project-costing.ports.ts`. Test: `PC/project-costing.ports.spec.ts`
      (each sibling absent; paid hours read only from `payroll-processing`).
- [ ] **T48**. OpenAPI regenerated; SDK regeneration noted for release; user docs (projects costing, timesheet approval,
      budgets, billing plans) and the `docs/specs/README.md` row. Files: docs site `website/docs/projects/`,
      `docs/specs/README.md`. Test: OpenAPI diff is additive; docs build.

## Phase 5 — Advanced capabilities

- [ ] **T49**. Forecast job (`forecast/`): forecast at completion from remaining estimates at assignee rates, revenue by
      billing method, health with reasons, live updates within 5 s. Files: `PC/forecast/forecast.service.ts`,
      `PC/forecast/forecast.worker.ts`. Test: `PC/forecast/forecast.service.spec.ts` (worked example; debounce per
      project).
- [ ] **T50**. Burn alerts with breach date (dispatcher `dedupeKey` per breach) and the re-plan draft through
      `PROJECT_ASSISTANT` bound to `AGENT_RUNTIME` (preview only). Files: `PC/forecast/burn-alert.service.ts`,
      `PC/forecast/replan-draft.service.ts`. Test: `PC/forecast/burn-alert.service.spec.ts` (alert once per breach;
      nothing changes until accepted).
- [ ] **T51**. Baselines, earned value (planned, earned, actual, indices) and the schedule timeline view with critical
      path and drag rescheduling in `project-costing-ui`. Files: `PC/baselines/project-baseline.service.ts`,
      `PC/baselines/earned-value.service.ts`, `PCU/components/schedule-timeline/`, `PCU/components/earned-value/`. Test:
      `PC/baselines/earned-value.service.spec.ts` (indices match a worked example; variance per task);
      `PCU/components/schedule-timeline/schedule-timeline.component.spec.ts` (keyboard list alternative).
- [ ] **T52**. Project billing schedules on core: `invoice_schedule` gains `organizationProjectId`, `approvedOnly`,
      `scopeKey` (unique key widened) and `invoice_schedule_run.evidenceFileId` (core migration
      `AddProjectScopeToInvoiceSchedule`); `invoice-schedule-run.service.ts` filters by project and approved timesheets and
      calls the optional `INVOICE_SCHEDULE_LINE_SOURCES` hook, bound here to reached and date entries, retainer
      top-ups and approved re-billable expenses of the project and period; with `approvedOnly` on, time of a project
      billed fixed fee or milestones stays out of hourly lines and shows as overrun in the evidence pack (spec FR-70);
      the plugin writes the evidence pack file on the run; screenshot exclusion rules. Files:
      `packages/core/src/lib/database/migrations/1791000094010-AddProjectScopeToInvoiceSchedule.ts`,
      `packages/core/src/lib/invoice-schedule/invoice-schedule.entity.ts`, `packages/core/src/lib/invoice-schedule/invoice-schedule-run.entity.ts`,
      `packages/core/src/lib/invoice-schedule/invoice-schedule-run.service.ts`, `PC/billing/project-schedule-line.source.ts`,
      `PC/billing/evidence-pack.service.ts`. Test: `packages/core/src/lib/invoice-schedule/invoice-schedule-run.service.sqlite.spec.ts`
      and `PC/billing/evidence-pack.service.spec.ts`: existing invoice
      schedule suites green; a client-wide run leaves out a project with its own schedule; a period billed once; draft
      unless the schedule sends; no screenshots unless both switches allow; an approved re-billable expense of the
      period appears in the draft once and is `INVOICED` after it; a milestone project with approved billable time and a
      reached entry gets the milestone line and no hourly time line.
- [ ] **T53**. Retainers: periods, drawdown from approved time, top-up proposal (`RETAINER_TOPUP` reader and the
      schedule line source), overage rule; `project-costing.billing-entries` daily job. Files: `PC/billing/retainer.service.ts`,
      `PC/billing/retainer-topup.reader.ts`, `PC/billing/billing-entries.scheduler.ts`. Test:
      `PC/billing/retainer.service.spec.ts` (drawdown idempotent per log; rollover; an entry billed once across the
      worklist and the schedule).
- [ ] **T54**. Allocations (bulk as core operation `PROJECT_COSTING_ALLOCATE`), workload board in `project-costing-ui`
      and capacity forecast by team and skill with reallocation previews. Files: `PC/capacity/allocation.service.ts`,
      `PC/capacity/allocation.controller.ts`, `PC/capacity/demand-forecast.service.ts`, `PCU/components/workload-board/`.
      Test: `PC/capacity/allocation.service.spec.ts` (over-allocation flag; 500 people × 26 weeks under 1 s; confirmed
      allocations notified).
- [ ] **T55**. Recurring tasks job on the core recurrence rules (occurrence claimed before the task is created). Files:
      `PC/tasks/recurring-tasks.scheduler.ts`, `PC/tasks/recurring-tasks.service.ts`. Test:
      `PC/tasks/recurring-tasks.service.spec.ts` (schedule and on-completion modes; working-day dating; count and until
      limits).
- [ ] **T56**. Assistant drafts of updates (with citations) and templates (from comparable projects) through
      `PROJECT_ASSISTANT` bound to `AGENT_RUNTIME` (runs and usage recorded by `ai-agents-and-assistants`). Files:
      `PC/assistant/update-draft.service.ts`, `PC/assistant/template-draft.service.ts`. Test:
      `PC/assistant/update-draft.service.spec.ts` (citations; drafts never saved without the user; hidden when unbound).
- [ ] **T57**. Reports FR-95 and FR-96 and write MCP tools (`project_from_template`, `task_dependency_set`,
      `project_reschedule`, `project_budget_revise`, `timesheet_submit`, `timesheet_portion_decide`,
      `billing_entry_accept`, `allocation_set`, `project_update_draft`) with `preview: true` default. Files:
      `PC/reports/project-costing-report.definitions.ts`, `packages/mcp-server/src/lib/tools/project-costing.ts`. Test:
      `packages/mcp-server/src/lib/tools/project-costing.spec.ts` (preview writes nothing);
      `PC/reports/project-costing-report.definitions.spec.ts` (earned value and capacity reports).

- [ ] **T59**. Provide the ports other features bind to (plan, **Consumer tokens answered**): `MARKETING_TIME_COST`, `PORTAL_PROJECTS`. Files: `apps/api/src/plugin-composition.ts`. Test:
      `PC/project-costing-consumer-tokens.contract.spec.ts`, one contract test per token over the shape its consumer plan states; with this feature off each consumer keeps its stated fallback.
- [ ] **T66**. Shared claim of billable entries across the worklist and project schedule runs (plan §7,
      `BILLABLE_SOURCE_REGISTRY`): time logs through the core lines transaction, billing-plan entries and retainer
      top-ups by a conditional write of `invoiceId` and `billingClaimRef` after a row lock, expenses by `status`
      `UNINVOICED` → `INVOICED`, all in the transaction that writes the draft's lines; unclaimed entries left out of a
      schedule draft and refused with `409` on the worklist; claims rolled back with a failed draft and cleared when a
      draft is deleted or voided with release. Files: `PC/billing/billing-entry-claim.ts`,
      `PC/billing/milestone-billable.reader.ts`, `PC/billing/retainer-topup.reader.ts`,
      `PC/billing/project-schedule-line.source.ts`. Test: `PC/billing/billing-entry-claim.spec.ts`: a worklist draft and
      a schedule run started together over one reached entry, one approved log and one expense bill each exactly once;
      a draft that fails after claiming leaves every entry billable; deleting the draft releases its entries.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Enabling and settings | T2, T61, T62 |
| FR-2 | §3.1 Enabling and settings | T10 |
| FR-3 | §3.1 Enabling and settings | T1, T12 |
| FR-4 | §3.2 Projects, types and progress | T10 |
| FR-5 | §3.2 Projects, types and progress | T10, T28, T37 |
| FR-6 | §3.2 Projects, types and progress | T10 |
| FR-7 | §3.2 Projects, types and progress | T10 |
| FR-8–FR-11 | §3.2 Projects, types and progress | T15 |
| FR-12 | §3.2 Projects, types and progress | T15 |
| FR-13 | §3.2 Projects, types and progress | T28 |
| FR-14 | §3.2 Projects, types and progress | T24, T28 |
| FR-15 | §3.3 Templates | T16, T60, T64 |
| FR-16 | §3.3 Templates | T16, T60, T64 |
| FR-17 | §3.3 Templates | T16 |
| FR-18 | §3.3 Templates | T56 |
| FR-19 | §3.4 Tasks, dependencies, schedule and recurrence | T17, T40 |
| FR-20 | §3.4 Tasks, dependencies, schedule and recurrence | T4, T17 |
| FR-21 | §3.4 Tasks, dependencies, schedule and recurrence | T17 |
| FR-22–FR-23 | §3.4 Tasks, dependencies, schedule and recurrence | T18, T40 |
| FR-24 | §3.4 Tasks, dependencies, schedule and recurrence | T17, T18 |
| FR-25 | §3.4 Tasks, dependencies, schedule and recurrence | T18 |
| FR-26 | §3.4 Tasks, dependencies, schedule and recurrence | T51 |
| FR-27 | §3.4 Tasks, dependencies, schedule and recurrence | T51 |
| FR-28 | §3.4 Tasks, dependencies, schedule and recurrence | T17, T40 |
| FR-29 | §3.4 Tasks, dependencies, schedule and recurrence | T55 |
| FR-30 | §3.4 Tasks, dependencies, schedule and recurrence | T14, T25 |
| FR-31 | §3.4 Tasks, dependencies, schedule and recurrence | T17 |
| FR-32 | §3.5 Activity types, rates and costing of time | T11, T38 |
| FR-33 | §3.5 Activity types, rates and costing of time | T11 |
| FR-34 | §3.5 Activity types, rates and costing of time | T13 |
| FR-35 | §3.5 Activity types, rates and costing of time | T12 |
| FR-36 | §3.5 Activity types, rates and costing of time | T12 |
| FR-37 | §3.5 Activity types, rates and costing of time | T12, T13 |
| FR-38 | §3.5 Activity types, rates and costing of time | T21 |
| FR-39 | §3.5 Activity types, rates and costing of time | T21 |
| FR-40 | §3.5 Activity types, rates and costing of time | T13 |
| FR-41 | §3.5 Activity types, rates and costing of time | T13, T38 |
| FR-42–FR-43 | §3.6 Timesheet approval | T19 |
| FR-44 | §3.6 Timesheet approval | T19, T41 |
| FR-45 | §3.6 Timesheet approval | T20 |
| FR-46 | §3.6 Timesheet approval | T20, T41 |
| FR-47 | §3.6 Timesheet approval | T20, T41 |
| FR-48 | §3.6 Timesheet approval | T19, T20, T41, T63 |
| FR-49–FR-50 | §3.7 Project budgets | T22, T42 |
| FR-51 | §3.7 Project budgets | T22 |
| FR-52 | §3.7 Project budgets | T22 |
| FR-53 | §3.7 Project budgets | T23 |
| FR-54 | §3.7 Project budgets | T23 |
| FR-55 | §3.7 Project budgets | T22 |
| FR-56 | §3.7 Project budgets | T50 |
| FR-57 | §3.8 Cost and revenue roll-up | T14, T24 |
| FR-58 | §3.8 Cost and revenue roll-up | T14 |
| FR-59 | §3.8 Cost and revenue roll-up | T24 |
| FR-60 | §3.8 Cost and revenue roll-up | T25 |
| FR-61 | §3.8 Cost and revenue roll-up | T25 |
| FR-62 | §3.8 Cost and revenue roll-up | T49 |
| FR-63 | §3.8 Cost and revenue roll-up | T51 |
| FR-64–FR-65 | §3.8 Cost and revenue roll-up | T25 |
| FR-66 | §3.9 Billing | T1, T10 |
| FR-67 | §3.9 Billing | T26 |
| FR-68–FR-69 | §3.9 Billing | T26 |
| FR-70 | §3.9 Billing | T27, T52 |
| FR-71 | §3.9 Billing | T53 |
| FR-72 | §3.9 Billing | T24, T27, T52 |
| FR-73 | §3.9 Billing | T52, T66 |
| FR-74 | §3.9 Billing | T31 |
| FR-75 | §3.10 Capacity, allocation and utilization | T29 |
| FR-76–FR-77 | §3.10 Capacity, allocation and utilization | T54 |
| FR-78 | §3.10 Capacity, allocation and utilization | T29 |
| FR-79 | §3.10 Capacity, allocation and utilization | T54 |
| FR-80–FR-82 | §3.11 Project updates | T30 |
| FR-83 | §3.11 Project updates | T56 |
| FR-84–FR-94 | §3.12 Reports | T32 |
| FR-95–FR-96 | §3.12 Reports | T57 |
| FR-97 | §3.12 Reports | T32 |
| FR-98 | §3.13 API, agents and compatibility | T33 |
| FR-99 | §3.13 API, agents and compatibility | T31 |
| FR-100 | §3.13 API, agents and compatibility | T46, T57 |
| FR-101 | §3.13 API, agents and compatibility | T33 |
| FR-102 | §3.13 API, agents and compatibility | T7, T65 |
| FR-103 | §3.13 API, agents and compatibility | T35 |
| FR-104 | §3.13 API, agents and compatibility | T11, T12 |
| FR-105 | §3.13 API, agents and compatibility | T34 |
| FR-106 | §3.13 API, agents and compatibility | T12, T27, T62 |
| FR-107 | §3.13 API, agents and compatibility | T63 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off; enabling it in dev shows the feature end to end.
- Constitution gates in `spec.md` §9 confirmed.
- With the feature off or the plugin absent, the existing project, task, time-log, timesheet, invoice and report
  suites pass unchanged; bill amounts of existing invoices from time are identical.
- Figures replayed from the outbox twice equal figures built once; the nightly reconciliation reports zero corrections
  on the seeded tenant.
- Cost rates and cost amounts never appear in any response, export or MCP output to a caller without
  `PROJECT_COSTS_VIEW` or `PROJECT_RATES_VIEW`, as spec §4 (security) and T65 state; project cost totals, margins and
  report amounts need `PROJECT_COSTS_VIEW` (FR-61, spec §3.12).
