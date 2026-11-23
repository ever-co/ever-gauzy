# Task Breakdown: Payroll processing

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `payroll-processing`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind the feature flag: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it.
- Prerequisites: `payroll-setup` T1–T20 (scaffold, engine, setup services) and T21 (Angular scaffold).
- Rollout phase 1 of the plan (surface the existing register) is T20, T21 and T26; they need only the scaffold and
  may land before everything else.
- Gating: every route, page, job and tool checks `FEATURE_PAYROLL`; earned pay (T47) also
  `FEATURE_PAYROLL_EARNED_PAY`.
- Path prefixes: `pp/` = `packages/plugins/payroll/src/lib/processing/`, `ui/` = `packages/plugins/payroll-ui/src/lib/`.
  Each entity has its MikroORM repository in `pp/entities/repository/`.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts `packages/contracts/src/lib/payroll-processing.model.ts` (enums, DTO and preview shapes, event
      payloads, `IPayrollRunExtension` and `PAYROLL_RUN_EXTENSION`, port interfaces, `IAmountsOwedPaidSource`); optional
      fields on `IPayrollRun` and `IPayrollItem` in `payroll.model.ts`; `ApprovalPolicyTypesStringEnum.PAY_RUN` in
      `packages/contracts/src/lib/approval-policy.model.ts`; export from `index.ts`. Test: type spec over sample payloads.
- [ ] **T2**. Core migration `ExtendPayrollRegisterForCalculation` (three dialects) and the new properties on
      `payroll-run.entity.ts` and `payroll-item.entity.ts`; core DTOs untouched. Files:
      `packages/core/src/lib/database/migrations/1791000099900-ExtendPayrollRegisterForCalculation.ts`,
      `packages/core/src/lib/payroll-run/payroll-run.entity.ts`, `packages/core/src/lib/payroll-item/payroll-item.entity.ts`.
      Test: migration spec on SQLite (up twice no-op); `payroll-run.service.add-item.spec.ts`,
      `payroll-run.service.process.spec.ts`, `payroll-run.resolver.spec.ts` and `repositories.service.payroll.spec.ts`
      green; DTO whitelist spec proves the existing routes ignore the new fields.
- [ ] **T3**. Optional `PAYROLL_RUN_EXTENSION` injection in `payroll-run.service.ts` (`process`, `cancel`, `addItem`,
      `updateItem`, `removeItem`) for `mode = 'CALCULATED'` only. Files:
      `packages/core/src/lib/payroll-run/payroll-run.service.ts`, `pp/run/payroll-run-extension.ts`. Test: every
      existing spec passes unbound; with a stub hook calculating runs delegate and typed-in runs are unchanged; a typed
      line on a calculating run stays a manual adjustment.
- [ ] **T4**. Plugin migration `CreatePayslipTables` and entities under `src/lib/processing/entities/` with MikroORM
      repositories. Files: `packages/plugins/payroll/src/lib/database/migrations/1791000099100-CreatePayslipTables.ts`,
      `pp/entities/payslip.entity.ts`, `pp/entities/payslip-line.entity.ts`, `pp/entities/payslip-trace.entity.ts`,
      `pp/entities/payslip-time-source.entity.ts`, `pp/entities/payroll-ytd-total.entity.ts`,
      `pp/entities/payslip-cost-allocation.entity.ts`. Test: migration spec; repository smoke specs for both ORMs;
      `liveKey` and `paidKey` uniqueness on the three dialects.
- [ ] **T5** (parallel). Migrations `CreatePayAdjustmentTables`, `CreatePayRunReviewTables` and their entities. Files:
      `packages/plugins/payroll/src/lib/database/migrations/1791000099110-CreatePayAdjustmentTables.ts`,
      `packages/plugins/payroll/src/lib/database/migrations/1791000099120-CreatePayRunReviewTables.ts`,
      `pp/entities/additional-pay.entity.ts`, `additional-pay-use.entity.ts`, `pay-withholding.entity.ts`,
      `pay-withholding-period.entity.ts`, `pay-arrear.entity.ts`, `pay-arrear-line.entity.ts`,
      `end-of-service-payout.entity.ts`, `earned-pay-request.entity.ts`, `pay-run-finding.entity.ts`,
      `pay-run-review.entity.ts`, `payroll-what-if.entity.ts`, `payroll-what-if-result.entity.ts`,
      `agent-usage-cost.entity.ts`, `pay-run-payment.entity.ts` (all in `pp/entities/`). Test: migration specs.
- [ ] **T6**. `FEATURE_PAYROLL_EARNED_PAY` in `payroll.features.ts`; five keys in `payroll.permissions.ts` with
      `defaultFor` (plan §9); `payroll.processing.*` and `payroll.runApprovers` keys in `payroll.settings.ts`; tables
      registered with export, import and factory reset. Files: `packages/plugins/payroll/src/lib/payroll.features.ts`,
      `packages/plugins/payroll/src/lib/payroll.permissions.ts`, `packages/plugins/payroll/src/lib/payroll.settings.ts`,
      `packages/core/src/lib/export-import/repositories/`. Test: a newly provisioned tenant's roles hold the defaults;
      a pay group override wins over the organization key; earned-pay routes `404` with the sub-feature off; with the
      feature off no route, menu entry or job loads and the register answers as today.
- [ ] **T7**. Processing ports in `src/lib/ports/` with fallbacks (plan §7) and bindings in
      `apps/api/src/plugin-composition.ts`; provided ports (`LEDGER_POSTING_SOURCE`, `LEDGER_ACCOUNT_RESOLVER`,
      `LEDGER_CLOSE_CHECK`, `TIME_OFF_PAY_PERIOD_LOCK`, `HR_SETTLEMENT_SOURCE`, `PAYROLL_ADDITIONAL_PAY`,
      `PAYROLL_PREVIEW`, `AMOUNTS_OWED_PAID_SOURCE`). Files: `packages/plugins/payroll/src/lib/ports/payroll-processing.ports.ts`,
      `packages/plugins/payroll/src/lib/ports/payroll-processing-fallbacks.ts`. Test: a run's whole lifecycle with
      every consumed port unbound.

## Phase 2 — Services, endpoints, events

- [ ] **T8**. Run service and controller (`/payroll/runs`): create from pay group and period, employee selection and
      filters, add and remove, overlap exclusion, agents refused. Files: `pp/run/pay-run.service.ts`,
      `pp/run/pay-run.controller.ts`, `pp/run/employee-selection.ts`, `pp/run/dto/create-pay-run.dto.ts`. Test: unit and
      e2e; an agent employee is never selected.
- [ ] **T9**. Day facts: working calendar through `PAYROLL_WORKING_CALENDAR`, payable-day bases, joining and end of
      work, unpaid and partly paid days through `PAYROLL_TIME_OFF_FEED`, override with reason, days explanation. Files:
      `pp/facts/day-facts.gatherer.ts`, `pp/facts/days-explanation.ts`, `pp/payslip/payable-days.controller.ts`. Test:
      golden periods across two calendars, a half holiday and a mid-period joiner.
- [ ] **T10**. Time facts: approved timesheets and time logs at stored and project rates, per project, client, billable
      and manual, `paidKey` reservation, hours above standard fallback. Files: `pp/facts/time-facts.gatherer.ts`,
      `pp/facts/time-source.service.ts`. Test: golden hourly payslip; a log is never paid twice; a cancelled payslip
      frees its logs.
- [ ] **T11**. Calculation as core operation `PAYROLL_CALCULATE`: steps of 200 employees, batched fact reads, engine,
      payslip with lines, trace and register lines in one transaction per employee, outcomes, progress events and run
      hints, recalculation replacing calculated lines while keeping typed manual adjustments, net rounding by the pay
      group's rule with a rounding line, facts fingerprint, `calculationState` mirrored from the operation. Files:
      `pp/calculation/calculate.operation.ts`, `pp/calculation/payslip-builder.ts`, `pp/calculation/register-writer.ts`,
      `pp/calculation/net-rounding.ts`, `pp/calculation/facts-fingerprint.ts`. Test: register totals equal payslip
      totals; resume after a stopped step; a second calculate request answers `409` while one is live.
- [ ] **T12**. Tax projection and year to date: remaining periods, opening balances, verified or declared exemptions,
      other income, one-off pay taxed in full, tax working, `payroll_ytd_total` maintenance on confirm and cancel.
      Files: `pp/calculation/tax-projection.ts`, `pp/calculation/tax-working.ts`, `pp/payslip/ytd-total.service.ts`.
      Test: golden yearly projections across 12 periods with a mid-year raise and a bonus.
- [ ] **T13**. Additional pay: kinds, validation of spec FR-34, recurring uses, overrides, incentives and retention
      bonuses (reminder scheduled through `REMINDERS`, cancelled with the bonus), `PAYROLL_ADDITIONAL_PAY` port,
      consumers of encashment events and of approved benefit claim lines (benefit ledger entry written). Files:
      `pp/additional-pay/additional-pay.service.ts`, `pp/additional-pay/additional-pay.controller.ts`,
      `pp/additional-pay/incentive.service.ts`, `pp/additional-pay/retention-bonus.service.ts`,
      `pp/additional-pay/additional-pay-sources.consumer.ts`. Test: each source reaches one payslip once; cancelling a
      source cancels unpaid pay; a cancelled bonus leaves no reminder.
- [ ] **T14** (parallel). Withholding and release. Files: `pp/withholding/pay-withholding.service.ts`,
      `pp/withholding/pay-withholding.controller.ts`. Test: overlap refused; withheld payslips posted, not paid; release
      creates separate payment lines.
- [ ] **T15**. Lifecycle: submit checks (failed, negative net, stale facts, blocking findings), approve with
      separation of duties, `PAYROLL_APPROVALS` (the workflow gateway; the core `PAY_RUN` request fallback follows in
      T53) and the ledger pre-check, operations `PAYROLL_APPROVE_EFFECTS` (numbers through `PAYROLL_DOCUMENTS`,
      confirmed states, year to date, benefit ledger, time sources) and `PAYROLL_CANCEL`. Files:
      `pp/run/pay-run-lifecycle.service.ts`, `pp/run/approve-effects.operation.ts`, `pp/run/cancel.operation.ts`,
      `pp/run/submit-checks.ts`. Test: e2e lifecycle with the workflows plugin and with direct approval on the run;
      preparer approval refused; cancel after export refused.
- [ ] **T16**. Posting: `pay_run` registration, facts with components and keys, contributions in the same or a
      separate journal, per-employee or summarised, fixed allocation as distributions, `LEDGER_POSTING_SOURCE`,
      `LEDGER_ACCOUNT_RESOLVER`, `LEDGER_CLOSE_CHECK`. Files: `pp/posting/pay-run-posting.facts.ts`,
      `packages/plugins/payroll/src/lib/ports/ledger-posting.source.ts`,
      `packages/plugins/payroll/src/lib/ports/ledger-account.resolver.ts`,
      `packages/plugins/payroll/src/lib/ports/ledger-close.check.ts`. Test: facts balance for golden runs; a missing
      account refuses approval naming the element.
- [ ] **T17**. Payments: hand-off through `PAYROLL_PAYMENTS`, bank accounts through `PAYROLL_PAY_ACCOUNTS` (banking
      store, masked; full number only for bank files with purpose `PAYROLL_FILE`), holds, consumers of payment events
      (paid, failed), mark-paid and payment list without payments, `process` through the hook. Files:
      `pp/payments/pay-run-payment.service.ts`, `pp/payments/payment-events.consumer.ts`,
      `pp/payments/payment-list.controller.ts`, `packages/plugins/payment/src/lib/payroll-payments.adapter.ts`. Test:
      executed and rejected lines move payslip states; run paid when all are; no account number stored by payroll.
- [ ] **T18**. Events of plan §5, inbox items, notices through `NOTIFICATION_DISPATCHER` with de-duplication keys,
      real-time hints; period close and reopen with `TIME_OFF_PAY_PERIOD_LOCK`, which answers "locked" only where
      `payroll.lockTimeOffInClosedPeriods` is on. Files: `pp/events/payroll-processing.events.ts`,
      `pp/events/payroll.consumer.ts`, `pp/period/pay-period-close.service.ts`, `pp/period/pay-period.controller.ts`.
      Test: each event once per change; a repeated notice key sends once; with the setting off a time-off edit inside
      a closed period is accepted and reaches arrears detection; with it on the edit is refused.
- [ ] **T19** (parallel). Multi-currency: rates through `PAYROLL_EXCHANGE_RATES`, organization-currency amounts,
      conversion of assignments paid in another currency, refusal of three-decimal currencies. Files:
      `pp/calculation/currency-conversion.ts`. Test: golden two-currency run.
- [ ] **T53**. Core request approval for pay runs: decision gate for `PAY_RUN` in
      `request-approval/linked-document-decision.gate.ts` (`ORG_PAYROLL_APPROVE`) and the payroll settler that
      approves or returns the run through the lifecycle service of T15, registered with `registerRequestApprovalSettler`
      of the core settler registry (`approval-workflows` T53); without the workflows plugin, submitting a run opens the
      `PAY_RUN` request to the approvers of `payroll.runApprovers`. Files:
      `packages/core/src/lib/request-approval/linked-document-decision.gate.ts`,
      `pp/run/pay-run-request-approval.settler.ts`. Test:
      existing request-approval suites green; a `PAY_RUN` request decided on the Approvals page approves the run on
      the same transaction; a caller without `ORG_PAYROLL_APPROVE` is refused; the submitter cannot decide it.
- [ ] **T54**. Payslip preview without saving: `POST /payroll/preview/payslip` (employee, period, optional proposed
      assignment) and the `PAYROLL_PREVIEW` provider used by the sandbox and cost to company of `payroll-setup` and the
      offer preview of `recruitment`. Files: `pp/preview/payslip-preview.service.ts`,
      `pp/preview/payslip-preview.controller.ts`. Test: `payslip-preview.service.spec.ts`: the preview equals the
      payslip a run would calculate and writes no row.
- [ ] **T55**. Record types (`registerRecordTypes`) for pay runs, payslips, additional pay, withholdings, arrears and
      earned-pay requests, for saved views, custom fields, approval definitions and automation triggers. Files:
      `pp/payroll-processing.record-types.ts`. Test: `payroll-processing.record-types.spec.ts`: each type is listed with
      its list source and an automation trigger fires on payslip confirmation.
- [ ] **T56**. Payslip privacy: `@VisibleWith` on payslip and line amounts (payroll permission holders and the employee
      only; managers none by default), an `AUDIT_EVENT_SINK` event for every read of another person's payslip. Files:
      `pp/entities/payslip.entity.ts`, `pp/entities/payslip-line.entity.ts`, `pp/payslip/payslip-access.logger.ts`.
      Test: `payslip-access.spec.ts`: a manager reads no amounts; an officer's read of a colleague's payslip logs one
      event; the employee's own read logs none.
- [ ] **T57**. Change history: who, when, before and after for every change to runs, payslip states, additional pay,
      withholdings, arrears, corrections, payouts and earned-pay requests, written to the core activity log from the
      services of T8, T13, T14 and T15. Files: `pp/history/payroll-history.subscriber.ts`. Test:
      `payroll-history.subscriber.spec.ts`: stopping a recurring additional pay and releasing a withholding each record
      the before and after values with the actor.

## Phase 3 — UI surfaces

- [ ] **T20**. Runs list and typed-in run pages in `payroll-ui` over the existing `/payroll-run` routes (lines,
      summary, submit, approve, process, cancel). Files: `ui/runs/runs-list.component.ts`,
      `ui/runs/typed-run.component.ts`, `ui/services/payroll-run-api.service.ts`. Test: rendering specs; actions call the
      existing routes only.
- [ ] **T21** (parallel). Register statistics card and the register-summary report definition. Files:
      `ui/runs/register-statistics-card.component.ts`, `packages/plugins/payroll/src/lib/reports/register-summary.report.ts`.
      Test: figures equal `GET /payroll-run/statistics`.
- [ ] **T22**. Calculating run pages: employees (withheld employees marked), payslips, live progress from the operation,
      lifecycle actions with previews; the approve dialog shows totals, differences from the previous run per element
      and pay group, and open findings with acknowledgements. Files: `ui/runs/run-page.component.ts`,
      `ui/runs/run-employees.component.ts`, `ui/runs/run-payslips.component.ts`, `ui/runs/approve-dialog.component.ts`.
      Test: rendering specs; keyboard operation.
- [ ] **T23**. Payslip page: lines, days explanation, tax working, trace viewer. Files: `ui/payslips/payslip-page.component.ts`,
      `ui/payslips/tax-working.component.ts`, `ui/payslips/trace-viewer.component.ts`. Test: rendering; screen-reader
      labels.
- [ ] **T24** (parallel). Additional pay, incentives, retention bonuses and withholdings pages. Files:
      `ui/additional-pay/additional-pay.component.ts`, `ui/additional-pay/incentives.component.ts`,
      `ui/additional-pay/retention-bonuses.component.ts`, `ui/withholdings/withholdings.component.ts`. Test: rendering.
- [ ] **T25** (parallel). Own payslips (FR-74, FR-105): Angular `/pages/payroll/me/payslips` laid out for phone width, with the last
      opened payslips kept readable offline in the installed web app and cleared on sign-out; API `/payroll/payslips/me`
      (+ `/:id`, `/pdf`). Files: `ui/me/my-payslips.component.ts`, `ui/me/my-payslips-offline.cache.ts`,
      `pp/payslip/my-payslips.controller.ts`. Test: component specs at phone width; only own payslips reachable; offline
      cache emptied on sign-out.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T26**. MCP register tools (`payroll_register_*`) in `packages/mcp-server/src/lib/tools/payroll-processing.ts`.
      Test: input-schema spec; tools call existing routes.
- [ ] **T27**. MCP processing tools of plan §7 with previews. Files: `packages/mcp-server/src/lib/tools/payroll-processing.ts`.
      Test: preview writes nothing; actions marked as agent actions.
- [ ] **T28**. OpenAPI regenerated; SDK regeneration noted; webhook catalogue entries for `payroll.*` events. Files: `packages/core/src/lib/bootstrap/swagger.ts`. Test: OpenAPI diff is additive; the webhook catalogue lists the `payroll.*` events.
- [ ] **T29**. User docs (docs site) and `docs/specs/README.md` index row. Test: docs build.

## Phase 5 — Depth

- [ ] **T30**. Unpaid-day corrections and manual arrears requests with previews; arrears and corrections taxed as
      one-off pay of the period they are paid in unless a pack hook says otherwise. Files: `pp/arrears/correction.service.ts`,
      `pp/arrears/arrears-request.service.ts`, `pp/arrears/arrears.controller.ts`. Test: reversal above the payslip's
      unpaid days refused; golden extra pay.
- [ ] **T31**. End-of-service payouts through the setup engine on the last payslip, paid in the final payslip or
      directly (`document.end_of_service_payout.confirmed`). Files: `pp/end-of-service/end-of-service-payout.service.ts`,
      `pp/end-of-service/end-of-service.controller.ts`. Test: golden amounts; minimum service gives zero; a direct payout
      is a separate payment line.
- [ ] **T32**. Final settlement: consumer of `document.final_settlement.*`, settlement runs, `HR_SETTLEMENT_SOURCE`,
      `payroll.settlement.paid`. Files: `pp/settlement/final-settlement.consumer.ts`,
      `pp/settlement/hr-settlement.source.ts`. Test: settlement net paid once; cancellation before payment reverses.
- [ ] **T33** (parallel). Encashment paid event, loan repayments as additional pay of kind `LOAN_REPAYMENT` on an
      element written as the register's `LOAN_DEDUCTION` line, advance recoveries. Files:
      `pp/additional-pay/loan-repayment.service.ts`, `pp/additional-pay/advance-recovery.service.ts`. Test: repayment
      deferred with a warning when net would be negative; recovery never above the open advance.
- [ ] **T34**. Payslip and pay-run documents, three print templates through `PAYROLL_PRINT`, amounts in words in every
      locale, PDF route. Files: `pp/documents/payroll-documents.ts`, `pp/documents/payslip.print-templates.ts`,
      `pp/payslip/payslip-pdf.controller.ts`. Test: render specs per layout; number series per organization.
- [ ] **T35**. Delivery as core operation `PAYROLL_DELIVER`: in app through `NOTIFICATION_DISPATCHER`, email with
      attachment or link through `MESSAGE_SENDER`, password pattern at render time, `deliveryState` / `deliveredAt` /
      `deliveryRef` on the payslip, resend with a new send number, list without email. Files:
      `pp/delivery/deliver.operation.ts`, `pp/delivery/payslip-delivery.controller.ts`. Test: once per payslip, channel
      and send; password never stored; no delivery table exists.
- [ ] **T36**. Report definitions of spec FR-84 to FR-93. Files: `packages/plugins/payroll/src/lib/reports/payroll-processing.reports.ts`,
      `packages/plugins/payroll/src/lib/reports/payroll-processing.datasets.ts`. Test: figures equal seeded payslips;
      bank details masked without `BANK_ACCOUNT_NUMBERS_VIEW`.
- [ ] **T37** (parallel). Time-off balances block, complete-attendance requirement, payable-days override page. Files:
      `ui/payslips/time-off-balances.component.ts`, `ui/payslips/payable-days-override.component.ts`,
      `pp/run/attendance-completeness.check.ts`. Test: submission refused listing unmarked days.
- [ ] **T38** (parallel). Historical payslip import. Files: `pp/import/payslip-import.service.ts`,
      `pp/import/payslip-import.controller.ts`. Test: per-row errors; year to date includes imported payslips.
- [ ] **T39**. UI for depth: arrears and corrections, end-of-service, deliveries tab, reports, period close. Files:
      `ui/arrears/arrears.component.ts`, `ui/end-of-service/end-of-service.component.ts`,
      `ui/runs/run-deliveries.component.ts`, `ui/reports/payroll-reports.component.ts`,
      `ui/periods/period-close.component.ts`. Test: rendering specs.

## Phase 6 — Advanced capabilities

- [ ] **T40**. Retroactive detection (consumer and daily sweep), shadow recalculation, explained arrear lines,
      recovery cap and carry. Files: `pp/arrears/retro-detection.consumer.ts`, `pp/arrears/retro-sweep.job.ts`,
      `pp/arrears/shadow-recalculation.ts`, `pp/arrears/arrear-explanation.ts`. Test: golden explanations; recoveries
      never applied without acceptance.
- [ ] **T41**. Review checks of spec FR-50 as the final step of `PAYROLL_CALCULATE`, blocking kinds, acknowledgements.
      Files: `pp/review/review-checks.ts`, `pp/review/pay-run-finding.service.ts`, `pp/review/findings.controller.ts`.
      Test: planted anomalies found on a seeded run; blocking finding stops submission.
- [ ] **T42**. Assistant review through `PAYROLL_ASSISTANT` (agent runtime; `pay_run_review.aiRunId`): grouping, causes,
      proposals as previews. Files: `pp/review/assistant-review.service.ts`. Test: no write path reachable from a
      proposal without a person; payload holds no bank details.
- [ ] **T43**. What-if runs: change model, calculation as core operation `PAYROLL_WHAT_IF`, side-by-side comparison,
      promotion to drafts, expiry job. Files: `pp/what-if/what-if.service.ts`, `pp/what-if/what-if.operation.ts`,
      `pp/what-if/what-if.controller.ts`, `pp/what-if/what-if-expiry.job.ts`. Test: register, journals, year to date and
      statistics unchanged after what-ifs.
- [ ] **T44**. Payslip explanation assistant: own trace only, employee's language, cited lines, hand-off to payroll.
      Files: `pp/explain/payslip-explanation.service.ts`. Test: another employee's payslip unreachable; answer locale
      follows the user.
- [ ] **T45**. Allocation by tracked time, `payroll.cost_allocated`, labour cost by project and client report, run
      variance report. Files: `pp/allocation/cost-allocation.service.ts`, `pp/allocation/labour-cost.report.ts`,
      `pp/review/run-variance.service.ts`. Test: golden split; project cost receives each period once.
- [ ] **T46**. Attendance facts through `PAYROLL_ATTENDANCE` (absent-day basis, overtime, night, holiday and shift
      hours) and off-cycle overtime runs. Files: `pp/facts/attendance-facts.gatherer.ts`, `pp/run/overtime-run.service.ts`.
      Test: stub port; overtime paid once.
- [ ] **T47**. Earned pay on demand: availability, limits, automatic or manual approval, payout, advance posting,
      recovery on the regular payslip. Files: `pp/earned-pay/earned-pay.service.ts`,
      `pp/earned-pay/earned-pay.controller.ts`. Test: draws above the cap refused; recovery equals draws.
- [ ] **T48** (parallel). Consolidated overview across organizations and currencies. Files:
      `pp/overview/payroll-overview.service.ts`. Test: only the reader's organizations; conversion at the period rate.
- [ ] **T49** (parallel). Agent usage cost and agent employees section. Files: `pp/agents/agent-usage-cost.service.ts`,
      `ui/runs/agent-employees.component.ts`. Test: agents never in payslips, register lines or bank files.
- [ ] **T50** (parallel). Amounts-owed report paid column: core report service reads the optional
      `AMOUNTS_OWED_PAID_SOURCE` and the core report page (`apps/gauzy/src/app/pages/reports/amounts-owed-report`)
      shows the column when the response carries it; payroll provides the source. Files also:
      `pp/reports/amounts-owed-paid.source.ts`. Test: report unchanged with the feature off and the source unbound; paid
      amounts equal confirmed payslips.
- [ ] **T51**. UI for phase 6: review panel, what-if page, explain panel, earned-pay card, overview. Files:
      `ui/runs/review-panel.component.ts`, `ui/what-if/what-if.component.ts`, `ui/payslips/explain-panel.component.ts`,
      `ui/me/earned-pay-card.component.ts`, `ui/overview/payroll-overview.component.ts`. Test: rendering specs.
- [ ] **T52**. Trial period on a tenant with the flag on; spec status `Implemented`. Test: every acceptance criterion of `spec.md` §7 demonstrated on the trial tenant.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1–FR-2 | §3.1 Pay runs (extends the existing pay-run register) | T8 |
| FR-3 | §3.1 Pay runs (extends the existing pay-run register) | T11 |
| FR-4 | §3.1 Pay runs (extends the existing pay-run register) | T11 |
| FR-5 | §3.1 Pay runs (extends the existing pay-run register) | T3, T11 |
| FR-6 | §3.1 Pay runs (extends the existing pay-run register) | T2, T3 |
| FR-7–FR-8 | §3.1 Pay runs (extends the existing pay-run register) | T15 |
| FR-9 | §3.1 Pay runs (extends the existing pay-run register) | T15, T53 |
| FR-10 | §3.1 Pay runs (extends the existing pay-run register) | T15 |
| FR-11 | §3.1 Pay runs (extends the existing pay-run register) | T2, T15, T18 |
| FR-12 | §3.2 Facts gathered from the platform | T9 |
| FR-13–FR-14 | §3.2 Facts gathered from the platform | T9, T46 |
| FR-15 | §3.2 Facts gathered from the platform | T37 |
| FR-16 | §3.2 Facts gathered from the platform | T10 |
| FR-17–FR-18 | §3.2 Facts gathered from the platform | T46 |
| FR-19–FR-20 | §3.2 Facts gathered from the platform | T9 |
| FR-21 | §3.3 Calculation | T11 |
| FR-22 | §3.3 Calculation | T9, T11 |
| FR-23 | §3.3 Calculation | T13 |
| FR-24 | §3.3 Calculation | T11 |
| FR-25 | §3.3 Calculation | T4, T11, T23 |
| FR-26 | §3.3 Calculation | T4, T15, T17 |
| FR-27–FR-28 | §3.3 Calculation | T11 |
| FR-29–FR-32 | §3.4 Tax projection and year to date | T12 |
| FR-33 | §3.4 Tax projection and year to date | T37 |
| FR-34 | §3.5 Additional pay, incentives and bonuses | T13 |
| FR-35 | §3.5 Additional pay, incentives and bonuses | T13, T33 |
| FR-36 | §3.5 Additional pay, incentives and bonuses | T13, T24 |
| FR-37 | §3.5 Additional pay, incentives and bonuses | T13, T24 |
| FR-38 | §3.5 Additional pay, incentives and bonuses | T33 |
| FR-39 | §3.6 Withholding pay | T14 |
| FR-40 | §3.6 Withholding pay | T14, T22 |
| FR-41 | §3.6 Withholding pay | T14, T32 |
| FR-42 | §3.7 Arrears and corrections | T40 |
| FR-43–FR-44 | §3.7 Arrears and corrections | T40 |
| FR-45–FR-46 | §3.7 Arrears and corrections | T30 |
| FR-47 | §3.7 Arrears and corrections | T12, T30 |
| FR-48 | §3.8 End-of-service payouts and final settlement | T31 |
| FR-49 | §3.8 End-of-service payouts and final settlement | T32 |
| FR-50 | §3.9 Review, anomaly detection and approval | T41 |
| FR-51 | §3.9 Review, anomaly detection and approval | T42 |
| FR-52 | §3.9 Review, anomaly detection and approval | T41 |
| FR-53 | §3.9 Review, anomaly detection and approval | T22, T41, T45 |
| FR-54 | §3.9 Review, anomaly detection and approval | T15, T16 |
| FR-55 | §3.9 Review, anomaly detection and approval | T41 |
| FR-56–FR-57 | §3.10 What-if runs and previews | T43 |
| FR-58 | §3.10 What-if runs and previews | T54 |
| FR-59 | §3.11 Journals and cost allocation | T16 |
| FR-60–FR-61 | §3.11 Journals and cost allocation | T16 |
| FR-62–FR-63 | §3.11 Journals and cost allocation | T45 |
| FR-64 | §3.11 Journals and cost allocation | T15, T16 |
| FR-65 | §3.11 Journals and cost allocation | T14, T16 |
| FR-66 | §3.12 Paying employees | T17 |
| FR-67 | §3.12 Paying employees | T17 |
| FR-68–FR-70 | §3.12 Paying employees | T17 |
| FR-71 | §3.12 Paying employees | T14, T31 |
| FR-72 | §3.13 Payslip documents and delivery | T34 |
| FR-73 | §3.13 Payslip documents and delivery | T35 |
| FR-74 | §3.13 Payslip documents and delivery | T25 |
| FR-75 | §3.13 Payslip documents and delivery | T44 |
| FR-76–FR-78 | §3.14 Multi-currency and multi-country | T19 |
| FR-79 | §3.14 Multi-currency and multi-country | T48 |
| FR-80–FR-81 | §3.15 Earned pay on demand | T47 |
| FR-82 | §3.16 Agents and period close | T8, T49 |
| FR-83 | §3.16 Agents and period close | T18 |
| FR-84–FR-93 | §3.17 Reports | T36 |
| FR-94–FR-95 | §3.17 Reports | T45 |
| FR-96 | §3.17 Reports | T50 |
| FR-97 | §3.18 API, agents and compatibility | T8, T55 |
| FR-98 | §3.18 API, agents and compatibility | T18 |
| FR-99 | §3.18 API, agents and compatibility | T26, T27 |
| FR-100 | §3.18 API, agents and compatibility | T6 |
| FR-101 | §3.18 API, agents and compatibility | T56 |
| FR-102 | §3.18 API, agents and compatibility | T38 |
| FR-103 | §3.18 API, agents and compatibility | T3, T6 |
| FR-104 | §3.18 API, agents and compatibility | T57 |
| FR-105 | §3.13 Payslip documents and delivery | T25 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off; enabling it in dev shows the feature end to end.
- Constitution gates in `spec.md` §9 confirmed.
- Register equality holds after every operation: per run and employee, register earnings and deductions equal the
  payslip.
- Posting balance holds: every `pay_run` fact set balances in run and organization currency.
- No double effect: replayed calculate, approve, deliver, hand-off and retro operations and jobs change nothing the
  second time.
- Existing register suites (service, resolver, export and import, factory reset) and request-approval suites pass
  unchanged with the feature on and off; typed-in runs behave exactly as before.
- Every acceptance criterion of `spec.md` §7 has a named test.
