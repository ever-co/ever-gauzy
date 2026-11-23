# Task Breakdown: Time-off management

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `time-off-management`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold. A spec file named in a `Test:` clause without a full path sits under the `src/lib/` folder of the package the task changes (beside the file it tests).
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind the feature flag: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it.
- Paths: `tp/` = `packages/plugins/time-off-policies/src/lib/`, `tpui/` = `packages/plugins/time-off-policies-ui/src/lib/`,
  `to/` = `packages/core/src/lib/` (the core time-off module: `time-off-request/`, `time-off-policy/`,
  `time-off-balance/`, `official-holiday/`).
- Gate: every plugin route, menu entry, job, consumer and MCP tool is gated by `FEATURE_TIME_OFF_POLICIES`
  (`@FeatureFlag` + `FeatureFlagGuard`); the core hooks (T3) and core UI slots (T48) carry no gate, and each hook
  implementation returns "not handled" for a tenant with the feature off.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts: optional fields and enum values in `packages/contracts/src/lib/time-off.model.ts`; new
      `time-off-policies.model.ts` (interfaces, enums, preview shapes, hook tokens `TIME_OFF_CHARGE_CALCULATOR`,
      `TIME_OFF_LEDGER_WRITER`, `TIME_OFF_REQUEST_RULES`, ports, event payloads); `RuleOwnerType`
      `TIME_OFF_ASSIGNMENT_RULE` / `TIME_OFF_BLOCK_PERIOD`; `ApprovalPolicyTypesStringEnum.TIME_OFF_COMPENSATORY`; export
      from `index.ts`. Files: `packages/contracts/src/lib/{time-off.model.ts,time-off-policies.model.ts,rule.model.ts,approval-policy.model.ts}`,
      `packages/contracts/src/index.ts`. Test: `packages/contracts/src/lib/time-off-policies.model.spec.ts`, a type spec that compiles against sample payloads.
- [ ] **T2**. Core columns on `time-off-policy.entity.ts`, `time-off-request.entity.ts`, `time-off-balance.entity.ts`,
      `official-holiday.entity.ts`; core migration `ExtendTimeOffForPolicies` (three dialects); `remaining` formula
      extended with `expired` and `encashed`. Files: `to/time-off-policy/time-off-policy.entity.ts`,
      `to/time-off-request/time-off-request.entity.ts`, `to/time-off-balance/{time-off-balance.entity.ts,time-off-balance-ledger.ts}`,
      `to/official-holiday/official-holiday.entity.ts`,
      `packages/core/src/lib/database/migrations/1791000097900-ExtendTimeOffForPolicies.ts`. Test:
      `packages/core/src/lib/database/extend-time-off-for-policies-migration.spec.ts` on SQLite (up twice no-op); existing balance,
      ledger and ORM-parity specs green; `to/time-off-request/time-off-request.service.write-whitelist.spec.ts` proves existing routes ignore the new fields. Migration timestamps: `1791000097100` to `1791000097199` (`packages/plugins/time-off-policies`); `1791000097900` to `1791000097999` (`packages/core`).
- [ ] **T3**. Core hooks: optional injection of the three tokens in `time-off-balance-deduction.service.ts`,
      `time-off-balance.service.ts`, `time-off-request.service.ts` and `commands/handlers/time-off.status.handler.ts`,
      inside the existing transaction and lock. Files: `to/time-off-balance/{time-off-balance-deduction.service.ts,time-off-balance.service.ts}`,
      `to/time-off-request/{time-off-request.service.ts,commands/handlers/time-off.status.handler.ts}`. Test:
      `to/time-off-balance/time-off-hooks.spec.ts`: every existing time-off spec passes with hooks unbound and with
      pass-through hooks bound; a hook error rolls the whole decision back.
- [ ] **T4**. Plugin scaffold `packages/plugins/time-off-policies` (package, project, tsconfig, jest, eslint, path
      mapping), `time-off-policies.plugin.ts`, `.features.ts` (`FEATURE_TIME_OFF_POLICIES`, default off),
      `.permissions.ts` (nine keys), `.settings.ts` (`timeOff.*`); registered in `apps/api/src/plugins.ts`. Files:
      `packages/plugins/time-off-policies/{package.json,project.json,tsconfig.json,jest.config.ts,eslint.config.cjs,src/index.ts}`,
      `tp/{time-off-policies.plugin.ts,time-off-policies.module.ts,time-off-policies.features.ts,time-off-policies.permissions.ts,time-off-policies.settings.ts}`,
      `apps/api/src/plugins.ts`, `tsconfig.json`. Test: `tp/time-off-policies.plugin.spec.ts` plugin
      list spec; routes `404` with the feature off; no job or rule runs with it off.
- [ ] **T5**. Migration `CreateTimeOffLedgerAndAccrualTables` on the shared core migration helpers of `procurement` T4 (`@gauzy/core`) (ledger,
      assignments, rules, accrual lines) + entities and MikroORM repositories. Files:
      `tp/database/migrations/{1791000097100-CreateTimeOffLedgerAndAccrualTables.ts,index.ts}`,
      `tp/{ledger/time-off-ledger-entry.entity.ts,assignments/time-off-policy-assignment.entity.ts,assignments/time-off-assignment-rule.entity.ts,accrual/time-off-accrual-line.entity.ts}`
      each with `repository/type-orm-<name>.repository.ts` and `repository/mikro-orm-<name>.repository.ts`. Test:
      `tp/database/create-time-off-ledger-and-accrual-tables.migration.spec.ts`; `tp/time-off-policies.repositories.spec.ts` repository smoke
      specs for both ORMs.
- [ ] **T6** (parallel). Migrations `CreateHolidayCalendarTables`, `CreateTimeOffControlTables`,
      `CreateTimeOffEncashmentAndCompensatoryTables` (claims and claim days), `CreateTimeOffCoverTables` + entities.
      Files: `tp/database/migrations/{1791000097110-CreateHolidayCalendarTables.ts,1791000097120-CreateTimeOffControlTables.ts,1791000097130-CreateTimeOffEncashmentAndCompensatoryTables.ts,1791000097140-CreateTimeOffCoverTables.ts}`,
      `tp/{holiday-calendars/holiday-calendar.entity.ts,holiday-calendars/holiday-calendar-day.entity.ts,holiday-calendars/holiday-calendar-assignment.entity.ts,block-periods/time-off-block-period.entity.ts,coverage/time-off-coverage-rule.entity.ts,encashment/time-off-encashment.entity.ts,compensatory/compensatory-claim.entity.ts,compensatory/compensatory-claim-day.entity.ts,cover/time-off-cover-proposal.entity.ts}`
      with their repositories. Test: `tp/database/time-off-policies-tables.migration.spec.ts`; `liveKey` uniqueness on three dialects.
- [ ] **T7**. Permission, feature and setting contributions with `defaultFor` (plan §9 grants, including the four
      `TIME_OFF_POLICY_*` keys for administrators); no seed migration. Files: `tp/time-off-policies.permissions.ts`,
      `tp/time-off-policies.plugin.ts`. Test: `tp/time-off-policies.permissions.spec.ts`: grants per role from the
      contributions; `TIME_OFF_REQUEST_OWN` for employees; effective only with the feature on.
- [ ] **T8**. Ports in `src/lib/ports/` with no-op defaults and bindings in `apps/api/src/plugin-composition.ts`
      (`HR_APPROVER_RESOLVER`, `HR_ACTIVE_EMPLOYEE_CHECK`, `HR_DIRECTORY`, `HR_EMPLOYEE_RULE_CONTEXT`,
      `TIME_OFF_APPROVALS`, `TIME_OFF_PAY_PERIOD_LOCK`, `TIME_OFF_DAILY_RATE`, `TIME_OFF_ATTENDANCE`, `SHIFTS_COVERAGE`,
      `TIME_OFF_HOLIDAY_SOURCE`, `NOTIFICATION_DISPATCHER`; provided `TIME_OFF_WORKING_CALENDAR`, `TIME_OFF_PAYROLL_FEED`,
      `TIME_OFF_AVAILABILITY`, `TIME_OFF_COMPENSATORY_INTAKE`, the calendar layers). Files:
      `tp/ports/{time-off-policies.ports.ts,no-op-defaults.ts,index.ts}`, `apps/api/src/plugin-composition.ts`. Test:
      `tp/ports/no-op-defaults.spec.ts`: services run with every consumed port unbound.
- [ ] **T48**. Core UI: named slots `TIME_OFF_REQUEST_FORM` and `TIME_OFF_POLICY_FORM` added to
      `PAGE_EXTENSION_SLOTS` and placed in `time-off-request-mutation` and `settings-mutation` of
      `packages/ui-core/shared/src/lib/time-off` (needed by T20). Files:
      `packages/plugin-ui/src/lib/plugin-extension/page-extension-slot.types.ts`,
      `packages/ui-core/shared/src/lib/time-off/time-off-request-mutation/time-off-request-mutation.component.html`,
      `packages/ui-core/shared/src/lib/time-off/settings-mutation/time-off-settings-mutation.component.html`. Test:
      `time-off-request-mutation.component.spec.ts` and `time-off-settings-mutation.component.spec.ts`: dialog and form render as today with no extension; a test
      extension appears in each slot.

## Phase 2 — Services, endpoints, events

- [ ] **T9**. Counting engine `src/lib/engine/` (calendar resolution per day, rest days, half holidays, portions,
      hours within working hours, period split by entitlement period) on core `working-days.ts`. Files:
      `tp/engine/{calendar-resolution.ts,day-count.ts,portions.ts,hours.ts,period-split.ts}`,
      `to/time-off-balance/working-days.ts` (used unchanged). Test: `tp/engine/day-count.spec.ts` golden cases
      across two calendars, a calendar change mid-range, time zones, half days and hours; a half day on a holiday refused.
- [ ] **T10**. Holiday calendars: CRUD, holidays per year with recurrence rules evaluated by the core recurrence module
      (`packages/core/src/lib/recurrence/` gains the nth-weekday and Easter-offset anchors), closures generator,
      validation, assignments, lookup and working-day counts (`/time-off/working-calendar`), `TIME_OFF_WORKING_CALENDAR`
      provider. Files: `tp/holiday-calendars/{holiday-calendar.service.ts,holiday-calendar.controller.ts,closures.generator.ts,holiday-calendar-assignment.service.ts,working-calendar.controller.ts,working-calendar.provider.ts,dto/}`,
      `packages/core/src/lib/recurrence/recurrence.rules.ts` (of `business-document-engine` T62). Test:
      `tp/holiday-calendars/holiday-calendar.service.spec.ts`: a second holiday on one date, a range ending before it
      starts and a half day on a rest day refused; calendar changes recorded in the activity log with before and after;
      `working-calendar.provider.spec.ts`: fallback to today's rule without assignment; existing recurrence and invoice
      schedule specs unchanged.
- [ ] **T11**. Ledger writer hook: entries for every core balance move, opening entries on feature enable, derivations,
      idempotency keys, maintained `pending`, `expired`, `encashed`. Files: `tp/ledger/{time-off-ledger.writer.ts,opening-entries.handler.ts,derivation.ts}`.
      Test: `tp/ledger/time-off-ledger.writer.spec.ts`, an invariant spec (balance equals the sum of
      entries) over random move sequences; both ORM flavours; the existing allocate, deduct, reverse and carry-forward routes write entries.
- [ ] **T12**. Charge calculator hook bound to the engine. Files: `tp/engine/time-off-charge.calculator.ts`. Test:
      `tp/engine/time-off-charge.calculator.spec.ts`: deductions with portions and calendars; existing
      deduction specs unchanged when the feature is off.
- [ ] **T13**. Policy rules route and validation of FR-2, history in `activity_log`, starter set on first enable,
      first assignments mirroring today's `time_off_policy_employee` rows (source `MANUAL`); settings over the settings
      store. Files: `tp/policies/{policy-rules.service.ts,policy-rules.controller.ts,policy-rules.validator.ts,starter-set.ts,dto/}`,
      `tp/assignments/initial-assignments.handler.ts`, `tp/settings/time-off-settings.controller.ts`. Test:
      `tp/policies/policy-rules.validator.spec.ts`: each refused combination; `tp/policies/starter-set.spec.ts`: starter
      set only when no policy exists; `tp/assignments/initial-assignments.handler.spec.ts`: existing pivot rows become open
      manual assignments once and no assignment rule ends them; a rule change is recorded with before and after and
      never touches existing ledger entries.
- [ ] **T14**. Balances read routes (own, manager via reporting line, organization), ledger and schedule reads,
      projection, adjustments and grants with idempotency. Files: `tp/balances/{balances.controller.ts,balances.service.ts,projection.service.ts,adjustments.service.ts,grants.service.ts,dto/}`.
      Test: `tp/balances/balances.service.spec.ts` unit and `tp/balances/balances.controller.spec.ts` e2e; projection includes planned accruals; a zero adjustment refused; a repeated idempotency key applies once.
- [ ] **T15**. Request rules hook and preview: refusals and warnings of FR-32 to FR-35, pending reservation, collision
      snapshot placeholder, approver resolution through `HR_APPROVER_RESOLVER`; overlap, inactive days and backdating
      warn unless their settings are on. Files: `tp/requests/{request-rules.hook.ts,request-preview.service.ts,request-preview.controller.ts}`.
      Test: `tp/requests/request-rules.hook.spec.ts`, one spec per rule; a request for an agent employee or on a day
      that is not an optional holiday under an optional-holiday policy refused; with no setting saved, every request the existing
      suites accept is still accepted.
- [ ] **T16**. Own requests and decisions: `POST/PUT /time-off/requests` via `TimeOffCreateCommand` /
      `TimeOffUpdateCommand`, withdraw, shorten, `/decision` via `TimeOffStatusCommand`, approval routing (workflow
      port or existing request approval), mandatory approver, self-decision and re-approval settings (all off by
      default). Files: `tp/requests/{requests.controller.ts,requests.service.ts,approval-routing.ts,dto/}`. Test:
      `tp/requests/requests.controller.spec.ts` e2e; self-decision allowed by default and refused with `timeOff.forbidSelfDecision`; `409` on
      concurrent decisions with days taken once; a missing approver refused only with `timeOff.approverMandatory`.
- [ ] **T17**. Outbox events of plan §5, consumers of HR, payroll and approval events, approver items with actions
      through `NOTIFICATION_DISPATCHER` (`dedupeKey`), real-time close. Files:
      `tp/events/{time-off.events.ts,hr-events.consumer.ts,payroll-events.consumer.ts,approval-events.consumer.ts,approver-items.service.ts,index.ts}`.
      Test: `tp/events/time-off.events.spec.ts`: replayed deliveries change nothing twice; an approver item closes everywhere on decision.
- [ ] **T18**. Schedules and workers in `src/lib/schedule/` (accrual sweep first); `TimeOffPoliciesSchedulePlugin` in
      `apps/worker/src/plugins.ts`; in-process fallback; passes as `job_execution` rows. Files:
      `tp/schedule/{time-off-policies-schedule.plugin.ts,accrual.job.ts,period-roll.job.ts,expiry.job.ts,assignment-rules.job.ts}`,
      `apps/worker/src/plugins.ts`. Test: `tp/schedule/accrual.job.spec.ts` and one sweep spec per job; plugin list specs.
- [ ] **T50**. Holiday import (FR-53): `/time-off/holiday-calendars/:id/import` with preview over the
      `TIME_OFF_HOLIDAY_SOURCE` providers (country packs of `regional-compliance-packs`, iCalendar file or address,
      spreadsheet file) and `/time-off/holiday-sources`; each imported holiday is a core `official_holiday` row written
      through `packages/core/src/lib/official-holiday/official-holiday.service.ts` (one that exists with the same
      country, date and name is reused) and linked to the calendar by a `holiday_calendar_day` row; duplicates skipped.
      Files:
      `tp/holiday-calendars/{holiday-import.service.ts,holiday-import.controller.ts,sources/ical.source.ts,sources/spreadsheet.source.ts}`.
      Test: `tp/holiday-calendars/holiday-import.service.spec.ts`: preview lists new and duplicate holidays and writes
      nothing; import adds only the new ones for the chosen years, as `official_holiday` rows linked by
      `holiday_calendar_day`, and writes no other holiday row.

## Phase 3 — UI surfaces

- [ ] **T19**. Angular plugin scaffold `packages/plugins/time-off-policies-ui`, registered in
      `apps/gauzy/src/plugin-ui.config.ts`; menu entries under "Time Off"; `TIME_OFF_POLICIES.*` keys in every locale.
      Files: `packages/plugins/time-off-policies-ui/{package.json,project.json,ng-package.json,src/index.ts}`,
      `tpui/{time-off-policies-ui.plugin.ts,time-off-policies-ui.routes.ts,services/time-off-policies-api.service.ts}`,
      `apps/gauzy/src/plugin-ui.config.ts`, `packages/ui-core/i18n/assets/i18n/*.json`.
      Test: `tpui/time-off-policies-ui.plugin.spec.ts` plugin spec; entries hidden without the feature.
- [ ] **T20** (after T48). Policy "Rules" panel through `TIME_OFF_POLICY_FORM` and the extended request dialog
      (portions, hours, live preview) through `TIME_OFF_REQUEST_FORM` of `packages/ui-core/shared/src/lib/time-off`.
      Files: `tpui/extensions/{policy-rules-panel.component.ts,request-dialog-extension.component.ts}`.
      Test: `tpui/extensions/request-dialog-extension.component.spec.ts` rendering specs (duration, balances, projected
      balance and approver shown before submission); dialog and form unchanged with the feature off.
- [ ] **T21** (parallel). Balances page with derivations and projection; holiday calendars page with year view,
      closures, import preview and assignments; the "Add holiday" dialog kept as it is, with a link to the holidays
      page. Files: `tpui/pages/{balances-page.component.ts,holiday-calendars-page.component.ts,holiday-year-view.component.ts,holiday-import-dialog.component.ts}`,
      `packages/ui-core/shared/src/lib/time-off/time-off-holiday-mutation/` (link only). Test:
      `tpui/pages/holiday-calendars-page.component.spec.ts` rendering specs; keyboard date navigation; the dialog still files its holiday entries with the
      feature on.
- [ ] **T22** (parallel). Ever Teams contract: OpenAPI examples and contract tests for the request, preview, balance,
      team calendar and decision routes its screens use; no React package. Files: `packages/core/src/lib/bootstrap/swagger.ts`,
      `tp/testing/teams-contract.spec.ts`. Test: contract specs pass against the API.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T23**. MCP tools `packages/mcp-server/src/lib/tools/time-off-policies.ts` (read tools and preview) registered
      in `register-all-tools.ts`; existing `time-off.ts` untouched. Files: `packages/mcp-server/src/lib/tools/time-off-policies.ts`,
      `packages/mcp-server/src/lib/tools/register-all-tools.ts`. Test: `packages/mcp-server/src/lib/tools/time-off-policies.spec.ts` input-schema spec; preview writes nothing.
- [ ] **T24** (parallel). Import templates (opening balances as ledger openings, requests history, holidays). Files:
      `tp/import/time-off-policies.import-profiles.ts`. Test: `tp/import/time-off-policies.import-profiles.spec.ts`:
      per-row errors; failed rows not imported.
- [ ] **T25**. OpenAPI regenerated; SDK regeneration noted; webhook catalogue entries for `time_off.*` events. Files: `packages/core/src/lib/bootstrap/swagger.ts`, `tp/events/time-off.webhook-catalogue.ts`. Test: OpenAPI diff is additive; the webhook catalogue lists the `time_off.*` events.
- [ ] **T26**. User docs (docs site) and `docs/specs/README.md` index row. Files: `docs/specs/README.md`. Test: docs build.

## Phase 5 — Depth

- [ ] **T27**. Accrual: rules of FR-21, schedule lines, daily pass (`job_execution`) with outcomes on the lines,
      "run now" and retries as core operation `TIME_OFF_ACCRUAL_RUN`, early release, stops and pro-rating of FR-25,
      failure notices. Files: `tp/accrual/{accrual.service.ts,accrual-schedule.ts,accrual-run.operation.ts,accrual-runs.controller.ts,accrual-release.service.ts}`.
      Test: `tp/accrual/accrual-schedule.spec.ts` golden schedules per frequency and accrual day; `accrual.service.spec.ts`: second run grants nothing; release never beyond the entitlement.
- [ ] **T28**. Period roll and expiry: next-period balances, carry with cap and expiry, expiry of the rest, expiry of
      carried parts, consumption order, manual expiry; existing carry-forward route idempotent with the job. Files:
      `tp/accrual/{period-roll.service.ts,expiry.service.ts,consumption-order.ts}`. Test:
      `tp/accrual/period-roll.service.spec.ts` golden year ends; invariant spec.
- [ ] **T29**. Assignment rules and assignments: criteria as core `rule` rows (`TIME_OFF_ASSIGNMENT_RULE`) evaluated
      with `HR_EMPLOYEE_RULE_CONTEXT`, priorities, daily and event-driven re-evaluation, `time_off_policy_employee` kept
      in step (and pivot edits through the existing form turned into assignments), starting grants (pro-rated, elapsed
      accruals, compensatory zero), bulk grants with preview and per-employee results (core operation above 500
      employees), missing list, agent refusal. Files: `tp/assignments/{assignment-rules.service.ts,assignment-rules.controller.ts,assignments.service.ts,assignments.controller.ts,starting-grants.ts,bulk-grants.operation.ts,pivot-sync.subscriber.ts}`.
      Test: `tp/assignments/assignments.service.spec.ts` unit and SQLite end-to-end; core policy reads see open assignments; an agent employee refused.
- [ ] **T30** (parallel). Block periods with scope as `rule` rows (`TIME_OFF_BLOCK_PERIOD`) and their approval rule.
      Files: `tp/block-periods/{block-period.service.ts,block-period.controller.ts}`. Test:
      `tp/block-periods/block-period.service.spec.ts`: non-allowed approver refused; override key works; changes recorded with before and after.
- [ ] **T31** (parallel). Compensatory claims: claim with work days (`compensatory_claim_day`, one live day per
      employee and date), prefill from time logs, `TIME_OFF_COMPENSATORY_INTAKE` for attendance overtime lines,
      approval through `TIME_OFF_APPROVALS` (fallback core request approval `TIME_OFF_COMPENSATORY`), grant with expiry.
      Files: `tp/compensatory/{compensatory-claim.service.ts,compensatory-claim.controller.ts,compensatory-intake.provider.ts}`.
      Test: `tp/compensatory/compensatory-claim.service.spec.ts`: a work day credited from attendance cannot be claimed again.
- [ ] **T32**. Encashment: encashable computation, documents, confirm with preview, payout hand-off, paid status,
      cancel, automatic drafts at period end. Files: `tp/encashment/{encashment.service.ts,encashment.controller.ts,encashable.ts}`.
      Test: `tp/encashment/encashment.service.spec.ts`: cancel returns days only before payment; changes recorded with before and after.
- [ ] **T33** (parallel). Payroll feed (unpaid and partial-pay days per pay period), payslip link, closed-period guard
      through `TIME_OFF_PAY_PERIOD_LOCK` (refuses only where `payroll.lockTimeOffInClosedPeriods` is on), settlement
      source for `hr-core-lifecycle`. Files: `tp/payroll/{payroll-feed.service.ts,payroll-feed.controller.ts,pay-period-guard.ts,settlement-source.provider.ts}`.
      Test: `tp/payroll/payroll-feed.service.spec.ts` feed golden cases; with the setting off an edit inside a closed period is
      accepted, with it on refused.
- [ ] **T34**. Team calendar endpoint and page (scopes, pending hatched, colleague view without policy). Files:
      `tp/calendar/{team-calendar.controller.ts,team-calendar.service.ts,colleague-view.mapper.ts}`,
      `tpui/pages/team-calendar-page.component.ts`. Test: `tp/calendar/colleague-view.mapper.spec.ts`: response mapper strips policy and reason for colleagues.
- [ ] **T35**. Notifications: approver and requester emails and inbox, approval reminders, holiday digest, all through
      `NOTIFICATION_DISPATCHER` with `dedupeKey`. Files: `tp/notifications/{time-off-notices.service.ts,approval-reminders.job.ts,holiday-digest.job.ts}`.
      Test: `tp/notifications/time-off-notices.service.spec.ts`: once per occasion; email switch honoured.
- [ ] **T36**. Report definitions (balances over a period, on a date, ledger, by policy, people off cards). Files: `tp/reports/time-off.report-definitions.ts`.
      Test: `tp/reports/time-off.report-definitions.spec.ts`: figures equal the ledger.
- [ ] **T37**. UI for phase 5: assignments, accrual runs, encashments, compensatory claims, block periods, reports.
      Files: `tpui/pages/{assignments-page.component.ts,accrual-runs-page.component.ts,encashments-page.component.ts,compensatory-claims-page.component.ts,block-periods-page.component.ts,reports-page.component.ts}`.
      Test: rendering specs per page (`assignments-page.component.spec.ts` lists employees missing an assignment).
- [ ] **T51**. Record types (FR-74): requests, encashments and compensatory claims registered for saved views, custom
      fields, approval definitions and automation triggers. Files: `tp/record-types/time-off.record-types.ts`. Test:
      `tp/record-types/time-off.record-types.spec.ts`: each type listed in the record type registry; an automation
      trigger fires on a request submission.

## Phase 6 — Advanced capabilities

- [ ] **T38**. Collisions service (tasks due, sprint ends, project deadlines with recent tracked time, appointments,
      teammates off) wired into preview and approver view. Files: `tp/collisions/collisions.service.ts`. Test:
      `tp/collisions/collisions.service.spec.ts`: seeded collisions found; never a refusal.
- [ ] **T39** (parallel). Coverage rules and minimum-present check with warn, extra approval or refuse; employees with
      shifts in the range checked against the shift coverage targets through `SHIFTS_COVERAGE`. Files:
      `tp/coverage/{coverage-rule.service.ts,coverage-rule.controller.ts,minimum-present.check.ts}`. Test:
      `tp/coverage/minimum-present.check.spec.ts`: rostered employee uses the targets, others the team rule.
- [ ] **T40** (parallel). Capacity estimate from tracked hours per working day and project split (precomputed
      averages). Files: `tp/collisions/capacity-estimate.service.ts`. Test: `tp/collisions/capacity-estimate.service.spec.ts` golden cases; preview within 400 ms on the seeded tenant.
- [ ] **T41**. Cover proposals (membership, skills, absence, planned load), accept per task (period assignee or
      reassignment), revert job, MCP tool `time_off_cover_propose`. Files: `tp/cover/{cover-proposal.service.ts,cover-proposal.controller.ts,cover-revert.job.ts}`,
      `packages/mcp-server/src/lib/tools/time-off-policies.ts`. Test: `tp/cover/cover-proposal.service.spec.ts`: nothing changes before acceptance;
      period assignee removed after the absence.
- [ ] **T42**. Expected hours endpoint and its use by the time-and-activity, weekly-limit and expected-hours reports
      when the feature is on; presence "off" through `TIME_OFF_AVAILABILITY`. Files: `tp/availability/{expected-hours.controller.ts,expected-hours.service.ts,time-off-availability.provider.ts}`.
      Test: `tp/availability/expected-hours.service.spec.ts`: reports unchanged with the feature off; an employee off today shows "off".
- [ ] **T43** (parallel). Calendar layers for `calendar-and-scheduling` (`registerCalendarLayers`: approved time off and
      holidays per employee, team layer with names and dates only; `CALENDAR_TIME_OFF`, `CALENDAR_HOLIDAYS` bindings).
      Files: `tp/calendar/{time-off.calendar-layers.ts,calendar-bindings.ts}`. Test: `tp/calendar/time-off.calendar-layers.spec.ts`: the personal feed shows approved time off; the team layer holds names and dates only.
- [ ] **T44** (parallel). Multi-country policies (country limit on assignment) and proposed compensatory claims job,
      run only for organizations without attendance and skipping work days already credited. Files:
      `tp/assignments/country-limit.ts`, `tp/compensatory/compensatory-proposals.job.ts`. Test:
      `tp/compensatory/compensatory-proposals.job.spec.ts` and `tp/assignments/country-limit.spec.ts` unit specs.
- [ ] **T45**. One-tap decisions: chat record card through `chat-agents-and-record-actions` when loaded and
      `FEATURE_CHAT_RECORD_CARDS` is on, phone actions
      consumed by Ever Teams, write MCP tools (`time_off_request_submit`, `time_off_decide`). Files:
      `tp/requests/decision-channels.ts`, `packages/mcp-server/src/lib/tools/time-off-policies.ts`. Test:
      `tp/requests/decision-channels.spec.ts`: a decision from any channel closes the others.
- [ ] **T46**. Absence analytics report definition. Files: `tp/reports/absence-analytics.report-definition.ts`. Test: `tp/reports/absence-analytics.report-definition.spec.ts`: golden monthly series.
- [ ] **T47**. Trial period on a tenant with the flag on; spec status `Implemented`. Files: `docs/specs/features/time-off-management/spec.md`. Test: every acceptance criterion of `spec.md` §7 demonstrated on the trial tenant.
- [ ] **T49**. Provide the ports other features bind to (plan, **Consumer tokens answered**): `AUTOMATION_AVAILABILITY`, `CALENDAR_HOLIDAYS`, `CALENDAR_TIME_OFF`, `PAYROLL_TIME_OFF_BALANCES`, `PAYROLL_TIME_OFF_FEED`, `PAYROLL_WORKING_CALENDAR`, `RECRUITMENT_TIME_OFF_SUMMARY`, `WORKFLOW_WORKING_CALENDAR`. Files: `apps/api/src/plugin-composition.ts`, `tp/ports/time-off.consumer-tokens.ts`. Test: `tp/ports/time-off.consumer-tokens.spec.ts`, one contract test per token over the shape its consumer plan states; with this feature off each consumer keeps its stated fallback.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Policies and their rules (extends the existing time-off policy) | T13, T20 |
| FR-2–FR-4 | §3.1 Policies and their rules (extends the existing time-off policy) | T13 |
| FR-5 | §3.1 Policies and their rules (extends the existing time-off policy) | T44 |
| FR-6 | §3.2 Assignment | T29 |
| FR-7–FR-8 | §3.2 Assignment | T13, T29 |
| FR-9–FR-10 | §3.2 Assignment | T29 |
| FR-11 | §3.2 Assignment | T29, T37 |
| FR-12 | §3.2 Assignment | T15, T29 |
| FR-13 | §3.3 Balances and ledger | T2, T11, T14 |
| FR-14 | §3.3 Balances and ledger | T11 |
| FR-15 | §3.3 Balances and ledger | T3, T11 |
| FR-16 | §3.3 Balances and ledger | T11, T14 |
| FR-17 | §3.3 Balances and ledger | T14, T20 |
| FR-18–FR-19 | §3.3 Balances and ledger | T14 |
| FR-20 | §3.3 Balances and ledger | T14, T21 |
| FR-21–FR-25 | §3.4 Accrual, carry-forward and expiry | T27 |
| FR-26–FR-28 | §3.4 Accrual, carry-forward and expiry | T28 |
| FR-29 | §3.5 Requests | T16 |
| FR-30 | §3.5 Requests | T15, T20 |
| FR-31 | §3.5 Requests | T9 |
| FR-32–FR-35 | §3.5 Requests | T15 |
| FR-36 | §3.5 Requests | T16 |
| FR-37 | §3.5 Requests | T15, T16 |
| FR-38–FR-40 | §3.6 Approval and block periods | T16 |
| FR-41 | §3.6 Approval and block periods | T30 |
| FR-42 | §3.6 Approval and block periods | T17, T45 |
| FR-43 | §3.6 Approval and block periods | T35 |
| FR-44 | §3.7 Work-aware time off and cover | T38 |
| FR-45 | §3.7 Work-aware time off and cover | T39 |
| FR-46 | §3.7 Work-aware time off and cover | T40 |
| FR-47 | §3.7 Work-aware time off and cover | T41 |
| FR-48–FR-49 | §3.7 Work-aware time off and cover | T42 |
| FR-50–FR-51 | §3.8 Holiday calendars | T10, T21 |
| FR-52 | §3.8 Holiday calendars | T10 |
| FR-53 | §3.8 Holiday calendars | T50, T21 |
| FR-54 | §3.8 Holiday calendars | T10 |
| FR-55 | §3.8 Holiday calendars | T9, T10 |
| FR-56 | §3.8 Holiday calendars | T35 |
| FR-57 | §3.8 Holiday calendars | T13, T15 |
| FR-58 | §3.8 Holiday calendars | T43 |
| FR-59 | §3.9 Compensatory time off | T31 |
| FR-60 | §3.9 Compensatory time off | T31, T44 |
| FR-61–FR-63 | §3.10 Encashment and payroll | T32 |
| FR-64–FR-65 | §3.10 Encashment and payroll | T33 |
| FR-66–FR-67 | §3.11 Calendar and reports | T34 |
| FR-68–FR-72 | §3.11 Calendar and reports | T36 |
| FR-73 | §3.11 Calendar and reports | T46 |
| FR-74 | §3.12 API, agents and compatibility | T14, T16, T51 |
| FR-75 | §3.12 API, agents and compatibility | T17 |
| FR-76 | §3.12 API, agents and compatibility | T23, T45 |
| FR-77 | §3.12 API, agents and compatibility | T24 |
| FR-78 | §3.12 API, agents and compatibility | T7 |
| FR-79 | §3.12 API, agents and compatibility | T3, T4 |
| FR-80 | §3.12 API, agents and compatibility | T10, T13, T30, T32 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off; enabling it in dev shows the feature end to end.
- Constitution gates in `spec.md` §9 confirmed.
- Ledger invariant holds in tests: every balance equals the sum of its entries after every move, job and cancellation.
- Existing time-off suites (requests, approvals, balances, deductions, ORM parity, MCP tools) pass unchanged with the
  feature on and off.
- Every acceptance criterion of `spec.md` §7 has a named test.
