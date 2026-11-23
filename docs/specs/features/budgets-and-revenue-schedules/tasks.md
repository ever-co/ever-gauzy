# Task Breakdown: Budgets and revenue schedules

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `budgets-and-revenue-schedules`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind the feature flags: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it.
- Paths are relative to `packages/plugins/accounting/src/lib/` unless they start with `packages/` or `apps/`.
  The plugin, the ledger posting service and the pipeline participants come from `accounting-foundation` and
  `general-ledger`. Each entity file has its MikroORM repository beside it in `repository/`
  (`mikro-orm-<entity>.repository.ts`, as in `packages/plugins/purchasing/src/lib/purchase-order/repository/`).
- Gating: budget tasks (T7 to T23, T36, T37, T46 to T51, T57) check `FEATURE_BUDGETS`; recognition tasks (T24 to
  T35, T38, T39, T52 to T54, T58) check `FEATURE_REVENUE_SCHEDULES`; both only for an organization whose accounting
  is live.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts `packages/contracts/src/lib/accounting-budget.model.ts` and `recognition.model.ts`; the
      additive `budget?` on `ILedgerPostingCheck` and the documented fact keys. Test: type-level spec; the ledger
      contract fixtures still compile.
- [ ] **T2**. Feature codes `FEATURE_BUDGETS` and `FEATURE_REVENUE_SCHEDULES` in `accounting.features.ts` (default
      off), settings of plan §3 in `accounting.settings.ts`, the ten permission keys with their `defaultFor` grants
      in `accounting.permissions.ts`. Test: catalogue specs; both codes off by default.
- [ ] **T3**. Entities and MikroORM repositories under `budget/`: `accounting-budget.entity.ts`,
      `accounting-budget-year.entity.ts`, `accounting-budget-version.entity.ts`, `accounting-budget-line.entity.ts`,
      `accounting-budget-line-amount.entity.ts`, `accounting-budget-transfer.entity.ts`,
      `accounting-budget-control-rule.entity.ts`; migration
      `database/migrations/1791000074100-CreateAccountingBudgetTables.ts`. Test: migration spec on SQLite; ORM
      parity spec.
- [ ] **T4**. Entities `budget/accounting-budget-commitment.entity.ts`, `accounting-budget-figure.entity.ts`,
      `accounting-budget-override.entity.ts` and migration
      `database/migrations/1791000074110-CreateAccountingBudgetCommitmentTables.ts` with append-only triggers. Test:
      update and delete of a commitment refused.
- [ ] **T5** (parallel). Entities under `recognition/`: `recognition-template.entity.ts`,
      `recognition-item-default.entity.ts`, `recognition-schedule.entity.ts`, `recognition-schedule-entry.entity.ts`,
      `recognition-period-total.entity.ts`; migration `database/migrations/1791000074120-CreateRecognitionTables.ts`.
      Test: migration spec; one schedule per source line and direction.
- [ ] **T6**. Default grants as `defaultFor` on the permission contributions of T2 (no seed migration). Files:
      `accounting.permissions.ts`, `accounting.permissions.spec.ts`. Test: provisioning spec (new tenant gets the
      grants; the permission reload adds missing ones only).
- [ ] **T56**. Regression guard for the budgets that already exist (spec FR-2): with both codes on and off, the
      project and client budget fields (`packages/core/src/lib/organization-project/organization-project.entity.ts`,
      `budget`, `budgetType`), the `project-budgets` and `client-budgets` reports and the campaign budgets of the
      promotion plugin read and write as before; no migration of T3 to T5 alters an existing table. Files:
      `budget/existing-budgets.regression.spec.ts`. Test: that spec, over fixtures of a project budget, a client
      budget and a promotion campaign, before and after enabling both codes.

## Phase 2 — Services, endpoints, events

- [ ] **T7**. `budget/accounting-budget.service.ts`: budgets, years, axes (at most four), types and allowed
      classes, draft versions; controller `budget/accounting-budget.controller.ts` on `/budgets` with cursor
      pagination, `If-Match` version on drafts and `Idempotency-Key` on creating calls; DTOs
      `budget/dto/create-accounting-budget.dto.ts`, `budget/dto/update-accounting-budget.dto.ts`. Test:
      `accounting-budget.service.spec.ts`: class refusal; overlapping years refused.
- [ ] **T8**. `budget/budget-line.service.ts`: `lineKey`, targets (account, group, category), axis values with
      group coverage, specificity, bulk grid upsert with per-row results and a conflict answer per row on a stale
      version; routes `GET` and `PUT /budgets/:id/lines` in `budget/budget-line.controller.ts`, DTO
      `budget/dto/upsert-budget-lines.dto.ts`. Test: `budget-line.service.spec.ts`: key stability across versions; a
      stale row answers a conflict and the others save.
- [ ] **T9**. `budget/budget-distribution.ts` (pure): even, seasonal (through `SeasonalDistributionService.spread`),
      quarter, half year, manual; quantity times rate. Test: `budget-distribution.spec.ts`: periods always total the
      annual amount; the quantity of a quantity-and-rate line is kept.
- [ ] **T10** (parallel). Fill a draft from another budget, from actuals (`LedgerBalanceService`) with a
      percentage, from a file (import profile `accounting.budget_lines`), from project cost budgets
      (`organization_project.budget` with a cost `budgetType`, onto project-axis lines) and from recurring expenses
      (`organization_recurring_expense`, `employee_recurring_expense`, monthly value times covered periods, category
      to account map remembered in `budget.recurringExpenseAccountMap`). Files: `budget/budget-fill.service.ts`,
      `budget/dto/budget-fill.dto.ts`, route `POST /budgets/:id/fill` in `budget/accounting-budget.controller.ts`;
      read only: `packages/core/src/lib/organization-project/organization-project.entity.ts`,
      `packages/core/src/lib/organization-recurring-expense/organization-recurring-expense.entity.ts`,
      `packages/core/src/lib/employee-recurring-expense/employee-recurring-expense.entity.ts`. Test:
      `budget-fill.service.spec.ts`: copy of actuals equals the trial balance of the year; a recurring expense ending
      in June fills six periods; an hours-type project budget is skipped.
- [ ] **T11**. Lifecycle and approval: submit, approve, reject, close through `BUDGET_APPROVALS` (core approval
      requests when the workflow engine is absent); approved versions immutable. Files:
      `budget/budget-lifecycle.service.ts`, `budget/budget-approvals.port.ts`, routes `/budgets/:id/submit`,
      `/close`, `/approve`, `/reject` in `budget/accounting-budget.controller.ts`; core approval requests through
      `packages/core/src/lib/request-approval/request-approval.service.ts`. Test: `budget-lifecycle.service.spec.ts`:
      direct edit refused; the submitter cannot approve.
- [ ] **T12**. Revisions: new version, difference per line and period, effective period, superseding. Files:
      `budget/budget-revision.service.ts`, `budget/budget-version.controller.ts` (`/budgets/:id/versions`,
      `/versions/:n/diff`, `/revisions`). Test: `budget-revision.service.spec.ts`: difference spec on fixtures.
- [ ] **T13**. Overlap guard among approved control budgets of a book (same target, axis values, period). Files:
      `budget/budget-overlap.service.ts`, called from `budget/budget-lifecycle.service.ts` on approve. Test:
      `budget-overlap.service.spec.ts`: second budget refused naming the first.
- [ ] **T14**. `budget/budget-match.service.ts`: document line to budget line (account, nearest group, category;
      dimension set on axes; most specific wins) with a cached map per budget version. Test: precedence table.
- [ ] **T15**. `budget/budget-figure.service.ts`: maintained figures, availability for period, year to date and
      year (`budget/budget-availability.service.ts`, with the optional `pendingLines` of the query, plan §4), `GET
      /budgets/availability`, monitor query (`GET /budgets/:id/monitor` in `budget/budget-monitor.controller.ts`). Test:
      figures equal recomputation after random postings; availability answers under 100 ms on the 5,000-line fixture; a
      pending line without a commitment record lowers availability, and the same line counts once after its record
      is appended; an order line recorded at 40 and amended to 80 counts 80 before its amendment is projected and 80
      after.
- [ ] **T16**. Consumer `subscriber:accounting-budget-actuals` on `accounting.journal.posted` / `.reversed`
      (exempt kinds of spec FR-23). Files: `budget/consumers/budget-actuals.consumer.ts`. Test:
      `budget-actuals.consumer.spec.ts`: reversal gives budget back; duplicate delivery counts once; a depreciation
      journal is not checked.
- [ ] **T17**. Control rules (matrix, tolerance, unbudgeted policy) and controller. Files:
      `budget/budget-control-rule.service.ts`, `budget/budget-control-rule.controller.ts`
      (`/budgets/:id/control-rules`), `budget/dto/budget-control-rule.dto.ts`. Test:
      `budget-control-rule.service.spec.ts`: one rule per budget, line and control point; consumed counts actuals,
      commitments and pre-commitments as the rule says, within the tolerance.
- [ ] **T18**. `budget/budget-control.participant.ts`: `onCheck` (impact, findings `BUDGET_EXCEEDED`,
      `BUDGET_WARNING`, `BUDGET_APPROVAL_REQUIRED`, a preview) and `onConfirming` (figure lock in key order, then
      availability recalculated from the locked rows and the line's action applied to that result, then
      `RESERVATION`; a bill line with `purchaseOrderLineId` counts only its part above the order line's open
      commitment and appends that commitment's `CONSUME` record in the same transaction).
      Test: `.db.spec.ts` where two concurrent confirmations of 60 against a budget of 100 cannot both pass, for
      "block" and for "require approval"; a 10,000 bill of a fully committed 10,000 order passes and leaves consumed at
      10,000.
- [ ] **T19**. Overrides: grant, consume once, approval-originated overrides; controller. Files:
      `budget/budget-override.service.ts`, `budget/budget-override.controller.ts` (`/budget-overrides`),
      `budget/dto/create-budget-override.dto.ts`. Test: `budget-override.service.spec.ts`: an override is valid for
      its document only.
- [ ] **T20**. Consumer `subscriber:accounting-budget-commitments` for purchase requisition and purchase order
      events: reserve, adjust on amendment, convert pre-commitment, release on close and cancel; account and
      dimension set from `LedgerPostingService.preview`. Files: `budget/consumers/budget-commitments.consumer.ts`,
      `budget/budget-commitment.service.ts`. Test: `budget-commitments.consumer.spec.ts`: amendment from 6,000 to
      4,500 releases 1,500.
- [ ] **T21**. Release of commitments by billed amount on posted bills (`keys.purchaseOrderLineId`), foreign
      currency at the order's rate, skipping the part already consumed at confirmation (T18, idempotency key
      `bill:<billLineId>`); on `document.<type>.cancelled` of a bill (consumer of T20), the reservation's release and,
      in the same transaction, a `CONSUME` record of the opposite sign per billed order line (idempotency key
      `bill-cancel:<billLineId>`); `BUDGET_COMMITMENT_SOURCE` registry. Files:
      `budget/budget-commitment-release.service.ts`, `budget/budget-commitment-source.registry.ts`. Test:
      `budget-commitment-release.service.spec.ts`: release equals what was reserved whatever the bill rate; a
      registered source's records appear on its line; a confirmed 4,000 bill of a 10,000 order cancelled before and
      after posting brings the open commitment back to 10,000, and a repeated cancellation event appends nothing.
- [ ] **T22** (parallel). Commitment list, reconciliation to open orders, close check `budget.commitments_agree`,
      year-end lapse or carry on `accounting.fiscal_year.closed` as the operation `ACCOUNTING_BUDGET_YEAR_END`. Files:
      `budget/budget-commitment.controller.ts` (`/budget-commitments`, `/budget-commitments/reconciliation`),
      `budget/budget-commitment-reconciliation.service.ts`, `budget/budget-year-end.operation.ts`,
      `budget/budget-close-checks.ts`. Test: `budget-year-end.operation.spec.ts`: carry adds the same amount to next
      year; the reconciliation reports a difference to an open order.
- [ ] **T23**. Threshold notices and events of plan §5 for budgets (with activity log entries); realtime hint
      `accounting.budget_figures`. Files: `budget/budget-threshold.service.ts`, `budget/budget.events.ts`. Test:
      `budget-threshold.service.spec.ts`: one notice per threshold and period; events spec.
- [ ] **T24**. `recognition/recognition-template.service.ts`, item defaults
      (`recognition/recognition-item-default.service.ts`), controllers `recognition/recognition-template.controller.ts`
      and `recognition/recognition-item-default.controller.ts`. Test: default per item and direction.
- [ ] **T25**. `recognition/recognition-plan.ts` (pure): methods by days, by periods with part-period conventions,
      manual plan; entries total the amount. Test: fixtures of spec FR-43; property spec on totals.
- [ ] **T26**. `recognition/recognition.participant.ts`: `beforeDetermination` (deferral role for amounts with a
      template and above the minimum) and `afterWrite` (schedule and planned entries in the journal's transaction).
      Test: invoice fixture posts to the deferral account and yields one schedule per line.
- [ ] **T27**. Manual schedules, schedules from opening balances of deferral accounts and from subscription cycles
      (service period in the facts). Files: `recognition/recognition-schedule.service.ts`,
      `recognition/dto/create-recognition-schedule.dto.ts`. Test: `recognition-schedule.service.spec.ts`: manual
      schedule cannot exceed the unexplained deferral balance.
- [ ] **T28**. Recognition run: selection, preview, proposals, posting through `LedgerPostingService.post`
      (kind `RECOGNITION`, key `recognition:<entryId>`), grouping policy, catch-up for locked periods and late
      schedules; the run is a core operation `ACCOUNTING_RECOGNITION_RUN` with steps in slices and per-entry results
      on the entries (`operationId`, state, error). Files: `recognition/recognition-run.service.ts`,
      `recognition/recognition-run.operation.ts`, `recognition/recognition-run.controller.ts`
      (`POST /recognition/runs`, `Idempotency-Key`), `recognition/dto/start-recognition-run.dto.ts`. Test:
      `recognition-run.service.spec.ts`: a rerun posts nothing twice; 40 failing entries do not stop the rest; a
      restart resumes at the next slice.
- [ ] **T29**. Schedule changes: pause, resume, end early, reschedule with prospective re-plan. Files:
      `recognition/recognition-schedule-change.service.ts`, routes `/recognition/schedules/:id/pause`, `/resume`,
      `/end`, `/reschedule` in `recognition/recognition-schedule.controller.ts`. Test:
      `recognition-schedule-change.service.spec.ts`: posted entries unchanged; totals preserved.
- [ ] **T30**. Credit notes and cancellations in `afterWrite` and on document events: reduce unrecognised first,
      then reverse recognised; void and reverse on cancel. Files: `recognition/recognition-credit.service.ts`,
      `recognition/consumers/recognition-document.consumer.ts`. Test: `recognition-credit.service.spec.ts`: three
      credited months of twelve.
- [ ] **T31**. Foreign currency at the source rate; dimension set, party and book on recognition lines; period
      totals maintained. Files: `recognition/recognition-run.service.ts`,
      `recognition/recognition-period-total.service.ts`. Test: `recognition-period-total.service.spec.ts`: the
      deferral account clears without exchange difference; two concurrent upserts of the total of a line without a
      book (`bookKey` `*`) leave one row on PostgreSQL, MySQL and SQLite.
- [ ] **T32**. Integrity service (`/recognition/integrity`), close checks `recognition.due_posted` and
      `recognition.deferral_agrees` through `LEDGER_CLOSE_CHECK`. Files: `recognition/recognition-integrity.service.ts`,
      `recognition/recognition-integrity.controller.ts`, `recognition/recognition-close-checks.ts`. Test:
      `recognition-integrity.service.spec.ts`: a stray manual journal is reported.
- [ ] **T33**. Deferred balance report query (`/recognition/report`) from period totals with grouped fallbacks;
      report definition `accounting.deferred_balance` and datasets. Files: `recognition/recognition-report.service.ts`,
      `recognition/recognition-report.controller.ts`, `recognition/report/deferred-balance.report.ts`. Test:
      `recognition-report.service.spec.ts`: report totals equal the ledger balance of the deferral accounts per
      period.
- [ ] **T34**. Worker schedules and API queue workers of plan §8 (period-end, integrity, figures reconcile).
      Files: `jobs/accounting-planning.schedules.ts`, `jobs/accounting-planning.processor.ts`,
      `apps/worker/src/plugins.ts`, `apps/api/src/plugins.ts`. Test: plugin-list specs
      (`apps/worker/src/plugins.spec.ts`, `apps/api/src/plugins.matrix.spec.ts`); one run per organization and period.
- [ ] **T35**. Events of plan §5 for recognition, realtime hints, activity log. Files:
      `recognition/recognition.events.ts`. Test: `recognition.events.spec.ts`.
- [ ] **T57**. Budget datasets `accounting.budget_figures` and `accounting.budget_commitments` registered with the
      report builder, and export of the monitor as CSV or spreadsheet (`GET /budgets/:id/monitor?format=csv|xlsx`).
      Files: `budget/report/budget-datasets.ts`, `budget/budget-monitor.controller.ts`. Test:
      `budget-datasets.spec.ts`: dataset rows equal the monitor figures; the exported file has one row per line and
      period.
- [ ] **T58**. Schedule list and detail endpoints: `GET /recognition/schedules` with filters by direction, party,
      item, project, account and state, and `GET /recognition/schedules/:id` with entries, source document,
      postings and evidence. Files: `recognition/recognition-schedule.controller.ts`,
      `recognition/dto/recognition-schedule-query.dto.ts`. Test: `recognition-schedule.controller.spec.ts`: each
      filter narrows the list; the detail lists planned against posted.

## Phase 3 — UI surfaces

- [ ] **T36**. Budgets list and budget editor (grid with paste, fill dialog, distribution picker, versions and
      difference, approval panel, control rules). Files: `packages/plugins/accounting-ui/src/lib/budgets/`
      (`budget-list.component.ts`, `budget-editor.component.ts`, `budget-grid.component.ts`,
      `budget-fill-dialog.component.ts`, `budget-versions.component.ts`, `budget-control-rules.component.ts`,
      `budget-api.service.ts`), routes in `packages/plugins/accounting-ui/src/lib/accounting-ui.plugin.ts`. Test:
      component specs; keyboard navigation of the grid; a pasted block fills the grid.
- [ ] **T37**. Budget monitor (with the project's own budget as a reference column on project-axis lines) and
      commitment list with drill-down. Files: `packages/plugins/accounting-ui/src/lib/budgets/budget-monitor.component.ts`,
      `packages/plugins/accounting-ui/src/lib/budgets/budget-commitments.component.ts`. Test: component specs.
- [ ] **T38** (parallel). Recognition templates, schedules list and detail, runs page. Files:
      `packages/plugins/accounting-ui/src/lib/recognition/` (`recognition-templates.component.ts`,
      `recognition-schedules.component.ts`, `recognition-schedule-detail.component.ts`,
      `recognition-runs.component.ts`, `recognition-api.service.ts`). Test: component specs.
- [ ] **T39**. Deferred balance report page with upcoming columns, export and print. Files:
      `packages/plugins/accounting-ui/src/lib/recognition/deferred-balance-report.component.ts`. Test: component spec.
- [ ] **T40**. Shared Angular components `ga-budget-impact-panel`, `ga-budget-availability-chip`,
      `ga-recognition-fields` exported by `accounting-ui`. Files:
      `packages/plugins/accounting-ui/src/lib/shared/budget-impact-panel.component.ts`,
      `packages/plugins/accounting-ui/src/lib/shared/budget-availability-chip.component.ts`,
      `packages/plugins/accounting-ui/src/lib/shared/recognition-fields.component.ts`,
      `packages/plugins/accounting-ui/src/index.ts`. Test: component specs; the impact panel shows budget, consumed,
      this document and remaining.
- [ ] **T41**. i18n keys `ACCOUNTING.BUDGETS.*` and `ACCOUNTING.RECOGNITION.*` in 14 locales. Files:
      `packages/ui-core/i18n/assets/i18n/*.json`. Test: key parity.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T42**. MCP tools `packages/mcp-server/src/lib/tools/accounting-planning.ts` (plan §7), registered in
      `packages/mcp-server/src/lib/tools/register-all-tools.ts`. Test: input-schema spec; `preview: true` writes
      nothing.
- [ ] **T43**. Ports and bindings in `apps/api/src/plugin-composition.ts` (`BUDGET_APPROVALS`,
      `BUDGET_LABOUR_COST`, `RECOGNITION_PROGRESS_SOURCE` sources). Test: boot with every port unbound.
- [ ] **T44**. OpenAPI document regenerated; SDK regeneration noted for release. Files:
      `packages/core/src/lib/bootstrap/swagger.ts`. Test: additive contract diff.
- [ ] **T45**. User docs (budgets, control, commitments, schedules, report) and index row. Files:
      `docs/specs/README.md`. Test: docs build.

## Phase 5 — Advanced capabilities

- [ ] **T46**. Scenarios (one control scenario per line key) and scenario comparison in the monitor. Files:
      `budget/budget-scenario.service.ts`, `budget/budget-monitor.controller.ts`,
      `packages/plugins/accounting-ui/src/lib/budgets/budget-monitor.component.ts`. Test:
      `budget-scenario.service.spec.ts`: non-control scenarios never check documents.
- [ ] **T47**. Transfers with their own approval and resulting version. Files: `budget/budget-transfer.service.ts`,
      `budget/budget-transfer.controller.ts` (`/budgets/:id/transfers`, `/transfers/:id/approve`). Test:
      `budget-transfer.service.spec.ts`: budget total unchanged.
- [ ] **T48**. "Require approval": approval request to the budget owner from the confirm hook, override on
      approval, document left a draft on decline. Files: `budget/budget-control.participant.ts`,
      `budget/budget-override.service.ts`, `budget/budget-approvals.port.ts`. Test: e2e with a purchase order.
- [ ] **T49**. Pending labour: job `accounting.budget.pending-labour`, `BUDGET_LABOUR_COST`, figures and monitor
      column. Files: `budget/budget-pending-labour.job.ts`, `budget/budget-labour-cost.port.ts`,
      `budget/budget-figure.service.ts`; read only:
      `packages/core/src/lib/time-tracking/time-log/time-log.entity.ts`. Test: `budget-pending-labour.job.spec.ts`:
      hours appear and disappear when the cost posts; hours only when the port is unbound.
- [ ] **T50**. Forecast and breach notices; `budget_forecast`. Files: `budget/budget-forecast.service.ts`,
      `budget/budget-forecast.job.ts`, `GET /budgets/:id/forecast` in `budget/budget-monitor.controller.ts`. Test:
      `budget-forecast.service.spec.ts`: run-rate fixture predicts the breach period.
- [ ] **T51** (parallel). Variance explanation and budget proposal services and tools. Files:
      `assist/budget-variance.service.ts`, `assist/budget-proposal.service.ts`, `assist/budget-assist.controller.ts`
      (`/assist/budget-proposal`, `/assist/explain-variance`). Test: `budget-variance.service.spec.ts`: drivers add up
      to the variance; proposal saves nothing.
- [ ] **T52**. Progress registry and sources: tracked time (time logs per project, task or contract), milestones
      (task and project-module completion), delivery (document-flow quantities), usage. Files:
      `recognition/progress/recognition-progress-source.registry.ts`,
      `recognition/progress/tracked-time.progress-source.ts`, `recognition/progress/milestone.progress-source.ts`,
      `recognition/progress/delivery.progress-source.ts`, `recognition/progress/usage.progress-source.ts`. Test:
      source specs.
- [ ] **T53**. Event-driven recognition: consumer `subscriber:accounting-recognition-progress`, cumulative rule,
      cap, reversal on falling progress, evidence. Files: `recognition/consumers/recognition-progress.consumer.ts`,
      `recognition/recognition-progress.service.ts`. Test: `recognition-progress.service.spec.ts`: 100 of 400 hours
      recognises a quarter; a return reverses.
- [ ] **T54**. Recognition forecast and live figures in pages and shared components. Files:
      `recognition/recognition-forecast.service.ts` (`GET /recognition/forecast`),
      `packages/plugins/accounting-ui/src/lib/recognition/recognition-forecast.component.ts`,
      `packages/plugins/accounting-ui/src/lib/shared/accounting-live.service.ts`. Test: two-client e2e; the forecast
      projects an event-driven schedule from its recent rate.
- [ ] **T55**. Provide the ports other features bind to (plan, **Consumer tokens answered**): `PROJECT_ACCOUNTING_BUDGETS`, `PURCHASING_BUDGET_CHECK`. Files: `apps/api/src/plugin-composition.ts`. Test: one contract test per token over the shape its consumer plan states; with this feature off each consumer keeps its stated fallback.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Activation | T2 |
| FR-2 | §3.1 Activation | T56 |
| FR-3 | §3.2 Budgets and lines | T7 |
| FR-4 | §3.2 Budgets and lines | T8 |
| FR-5 | §3.2 Budgets and lines | T7 |
| FR-6 | §3.2 Budgets and lines | T9 |
| FR-7 | §3.2 Budgets and lines | T7 |
| FR-8 | §3.2 Budgets and lines | T13 |
| FR-9 | §3.2 Budgets and lines | T10, T36 |
| FR-10 | §3.2 Budgets and lines | T9 |
| FR-11 | §3.2 Budgets and lines | T46 |
| FR-12 | §3.2 Budgets and lines | T11 |
| FR-13 | §3.2 Budgets and lines | T12 |
| FR-14 | §3.2 Budgets and lines | T47 |
| FR-15 | §3.2 Budgets and lines | T8, T11, T23 |
| FR-16 | §3.3 Budget control | T14 |
| FR-17 | §3.3 Budget control | T17 |
| FR-18 | §3.3 Budget control | T15, T17 |
| FR-19 | §3.3 Budget control | T18, T40 |
| FR-20 | §3.3 Budget control | T18 |
| FR-21 | §3.3 Budget control | T48 |
| FR-22 | §3.3 Budget control | T19 |
| FR-23 | §3.3 Budget control | T16 |
| FR-24 | §3.3 Budget control | T18 |
| FR-25–FR-26 | §3.4 Commitments | T20, T21 |
| FR-27 | §3.4 Commitments | T21 |
| FR-28 | §3.4 Commitments | T21 |
| FR-29 | §3.4 Commitments | T49 |
| FR-30 | §3.4 Commitments | T22 |
| FR-31 | §3.4 Commitments | T4, T22 |
| FR-32 | §3.5 Monitoring and assistance | T15, T23, T49 |
| FR-33 | §3.5 Monitoring and assistance | T37, T46 |
| FR-34 | §3.5 Monitoring and assistance | T23 |
| FR-35 | §3.5 Monitoring and assistance | T50 |
| FR-36–FR-37 | §3.5 Monitoring and assistance | T51 |
| FR-38 | §3.5 Monitoring and assistance | T57 |
| FR-39 | §3.6 Recognition templates and schedules | T24 |
| FR-40 | §3.6 Recognition templates and schedules | T24, T40 |
| FR-41 | §3.6 Recognition templates and schedules | T26 |
| FR-42 | §3.6 Recognition templates and schedules | T27 |
| FR-43 | §3.6 Recognition templates and schedules | T25, T53 |
| FR-44 | §3.6 Recognition templates and schedules | T25, T38 |
| FR-45 | §3.6 Recognition templates and schedules | T38, T58 |
| FR-46 | §3.7 Recognition runs and postings | T28 |
| FR-47 | §3.7 Recognition runs and postings | T28, T34 |
| FR-48 | §3.7 Recognition runs and postings | T28 |
| FR-49 | §3.7 Recognition runs and postings | T28 |
| FR-50–FR-51 | §3.7 Recognition runs and postings | T31 |
| FR-52 | §3.7 Recognition runs and postings | T28 |
| FR-53–FR-54 | §3.8 Recognition that follows delivery | T52, T53 |
| FR-55–FR-56 | §3.8 Recognition that follows delivery | T52 |
| FR-57 | §3.8 Recognition that follows delivery | T53 |
| FR-58 | §3.8 Recognition that follows delivery | T52 |
| FR-59 | §3.9 Changes, credits and integrity | T29 |
| FR-60–FR-61 | §3.9 Changes, credits and integrity | T30 |
| FR-62 | §3.9 Changes, credits and integrity | T27, T32 |
| FR-63 | §3.9 Changes, credits and integrity | T32 |
| FR-64–FR-65 | §3.10 Report and forecast | T33, T39 |
| FR-66 | §3.10 Report and forecast | T54 |
| FR-67 | §3.11 API, tools and real time | T7, T8, T28 |
| FR-68 | §3.11 API, tools and real time | T42 |
| FR-69 | §3.11 API, tools and real time | T23, T35, T54 |
| FR-70 | §3.11 API, tools and real time | T23, T35 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off; enabling it in dev shows the feature end to end.
- Constitution gates in `spec.md` §9 confirmed.
- With both feature codes off no document is checked, no commitment or schedule is created, and existing project
  and client budgets and their reports behave as before.
- Open commitments equal open purchase order amounts, and each deferral account equals its schedules, in the
  test suite and in the nightly checks.
- Performance targets of `spec.md` §4 measured and recorded.
