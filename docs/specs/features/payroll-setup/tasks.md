# Task Breakdown: Payroll setup

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `payroll-setup`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind the feature flag: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it.
- Paths are relative to the repository root; `pr/` means `packages/plugins/payroll/src/lib/` and `prui/` means
  `packages/plugins/payroll-ui/src/lib/`. Each new service, controller, pure module or component ships with a `.spec.ts`
  beside it.
- `payroll-processing` builds on T1–T20 of this list (same plugin); its tasks reference them. T59 and T60 (the tax,
  declaration, benefit and end-of-service tables, Phase 1) land with T1–T7 and count as part of that base.
- Prerequisite: the formula language of `custom-fields-and-forms` (`packages/utils/src/lib/formula/`, its T3) lands
  before T8.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts: `packages/contracts/src/lib/payroll-setup.model.ts` (interfaces, enums, DTO, sandbox and impact
      shapes, event payloads), `payroll-formula.model.ts` (the payroll extension of `formula.model.ts`: element-reference
      node, fact names, payroll functions, findings), `payroll-ports.model.ts` (tokens and interfaces of plan §7,
      `EMPLOYEE_PAY_COST_SOURCE`); `PayrollFrequencyEnum.DAILY` in `packages/contracts/src/lib/payroll.model.ts`;
      `RuleOwnerType.END_OF_SERVICE_RULE` in `packages/contracts/src/lib/rule.model.ts`; export from
      `packages/contracts/src/index.ts`. Test: type spec over sample payloads; `payroll-frequency.util.spec.ts` proves
      `DAILY` maps to no pay period (`packages/contracts/src/lib/payroll-frequency.util.ts`).
- [ ] **T2**. Plugin scaffold `packages/plugins/payroll` (`package.json`, `project.json`, `tsconfig.json`,
      `jest.config.ts`, `eslint.config.cjs`, path mapping in `tsconfig.base.json`), `pr/payroll.plugin.ts`,
      `pr/payroll.module.ts`, `pr/payroll.features.ts` (`FEATURE_PAYROLL`, default off), `pr/payroll.permissions.ts`
      (six keys with `defaultFor` of plan §9); registered in `apps/api/src/plugins.ts`. Test: plugin list spec; every
      route answers `404` with the feature off; a newly provisioned tenant's roles hold the default grants.
- [ ] **T3**. Migration on the shared core migration helpers of `procurement` T4 (`@gauzy/core`):
      `pr/database/migrations/1791000098100-CreatePayrollElementAndStructureTables.ts`, entities and MikroORM
      repositories under `pr/setup/entities/` (`pay-element.entity.ts`, `pay-element-version.entity.ts`,
      `pay-element-reference.entity.ts`, `pay-element-test-case.entity.ts`, `pay-table.entity.ts`,
      `pay-table-row.entity.ts`, `pay-structure.entity.ts`, `pay-structure-version.entity.ts`,
      `pay-structure-line.entity.ts`; repositories in `pr/setup/repositories/`). Test: migration spec on SQLite (up twice
      is a no-op); repository smoke specs for both ORMs. Migration timestamps: `1791000098100` to `1791000098199` (`packages/plugins/payroll`).
- [ ] **T4** (parallel). Migration `pr/database/migrations/1791000098110-CreatePayrollCalendarAndAssignmentTables.ts`
      with its entities in `pr/setup/entities/` (`pay-group.entity.ts`, `payroll-year.entity.ts`, `pay-period.entity.ts`,
      `pay-assignment.entity.ts`, `pay-assignment-share.entity.ts`, `pay-assignment-bulk-result.entity.ts`,
      `level-pay-default.entity.ts`). Test: migration spec; `activeKey` and `(operationId, employeeId)` uniqueness on the
      three dialects.
- [ ] **T5**. Settings contributions `pr/payroll.settings.ts` (keys of plan §3.1, organization scope) read through the
      platform settings store; `/payroll/settings` reads and writes them (`pr/setup/settings/payroll-settings.controller.ts`).
      Test: declared defaults resolve; an organization value wins over the tenant value; no settings table exists.
- [ ] **T6**. Ports in `pr/ports/` (`payroll-ports.fallbacks.ts`: the fallbacks of the plan §7 table) and bindings in
      `apps/api/src/plugin-composition.ts`. Test: setup services run with every consumed port unbound.
- [ ] **T7** (parallel). New tables registered with the tenant export and import
      (`packages/core/src/lib/export-import/repositories/repositories.service.ts`) and factory reset
      (`packages/core/src/lib/user/factory-reset/factory-reset.service.ts`). Test: extend
      `repositories.service.payroll.spec.ts` and `factory-reset.service.payroll.spec.ts`.
- [ ] **T59**. Migration `pr/database/migrations/1791000098120-CreatePayrollTaxAndDeclarationTables.ts` with its
      entities in `pr/setup/entities/` (`tax-table.entity.ts`, `tax-table-band.entity.ts`, `tax-table-surcharge.entity.ts`,
      `pay-group-tax-table.entity.ts`, `employee-tax-choice.entity.ts`, `exemption-category.entity.ts`,
      `tax-declaration.entity.ts`, `tax-declaration-line.entity.ts`, `tax-proof.entity.ts`, `tax-proof-line.entity.ts`,
      `other-income.entity.ts`). Test: migration spec on SQLite (up twice); uniqueness of `(employeeId, payrollYearId)`
      declarations on the three dialects.
- [ ] **T60** (parallel). Migration `pr/database/migrations/1791000098130-CreatePayrollBenefitAndEndOfServiceTables.ts`
      with its entities in `pr/setup/entities/` (`benefit-choice.entity.ts`, `benefit-choice-line.entity.ts`,
      `benefit-ledger-entry.entity.ts`, `end-of-service-rule.entity.ts`, `end-of-service-band.entity.ts`,
      `payroll-opening-balance.entity.ts`). Test: migration spec on SQLite (up twice); `entryKey` uniqueness on the
      three dialects.

## Phase 2 — Services, endpoints, events

- [ ] **T8**. Engine `pr/engine/formula-payroll/` (`element-references.ts`, `formula-printer.ts`): element references
      resolved to ids on the shared `@gauzy/utils` `formula/` parser (no own lexer or parser), printer that renders
      current codes. Test: golden parse and print round trips; error positions; 2,000-character cap.
- [ ] **T9**. Engine: payroll functions and fact names registered in the shared function catalogue and type checker;
      evaluation by the shared exact-decimal evaluator with the per-payslip step budget; errors returned as values with
      the operands. Files: `pr/engine/formula-payroll/payroll-functions.ts`, `pr/engine/formula-payroll/payroll-facts.ts`,
      `pr/engine/formula-payroll/payroll-evaluator.ts`. Test: golden arithmetic with percentages, rounding steps,
      `lookup`, division by zero, step limit; the shared language's conformance suite passes with the extension loaded.
- [ ] **T10**. Engine reference graph: cycle detection naming the chain, ordering inside the processing phases.
      Files: `pr/engine/reference-graph.ts`. Test: property tests on random graphs; cycles across two structures found.
- [ ] **T11**. Engine calculator over supplied facts: phases, assignment segments, pro-rating by days or hours,
      rounding rules, outside-gross and informational modes, drop-when-zero, trace. Files:
      `pr/engine/calculator/payslip-calculator.ts`, `pr/engine/calculator/pro-rating.ts`, `pr/engine/calculator/rounding.ts`,
      `pr/engine/calculator/trace.ts`. Test: ten hand-computed golden payslips.
- [ ] **T12**. Elements: service and controller (`/payroll/elements`), versions with activation checks, reference rows,
      display rename, kind lock and deletion refusal after use, deactivation, accounts. Files:
      `pr/setup/elements/pay-element.service.ts`, `pr/setup/elements/pay-element.controller.ts`,
      `pr/setup/elements/pay-element-version.service.ts`, `pr/setup/elements/dto/pay-element.dto.ts`,
      `pr/setup/elements/dto/pay-element-version.dto.ts`. Test: unit and e2e.
- [ ] **T13**. Test cases: CRUD, runner, activation gate with recorded override. Files:
      `pr/setup/elements/pay-element-test-case.service.ts`, `pr/setup/elements/pay-element-test-case.controller.ts`. Test:
      failing case blocks activation; override reason audited.
- [ ] **T14** (parallel). Pay tables and rows with `lookup`. Files: `pr/setup/pay-tables/pay-table.service.ts`,
      `pr/setup/pay-tables/pay-table.controller.ts`. Test: missing key error; default value.
- [ ] **T15**. Structures: versions, lines, overrides, activation checks (cycles, two tax elements, negative sample net
      warning, posted element without accounts), element-version propagation and override difference list. Files:
      `pr/setup/structures/pay-structure.service.ts`, `pr/setup/structures/pay-structure.controller.ts`,
      `pr/setup/structures/pay-structure-activation.ts`. Test: unit.
- [ ] **T16**. Pay groups, payroll years, period generation for every frequency including daily and twice a month,
      pay-date rules, remaining-periods function, period status guard. Files: `pr/setup/calendar/pay-group.service.ts`,
      `pr/setup/calendar/pay-group.controller.ts`, `pr/setup/calendar/payroll-year.service.ts`,
      `pr/setup/calendar/pay-period-generator.ts`. Test: golden calendars; overlap refused.
- [ ] **T17**. Assignments: validation of spec FR-34/FR-35, `effectiveTo` maintenance, history, level defaults (level
      matched through `employee.employeeLevelId`, else the level label), cost to company, solver (bracket then
      bisection). Files: `pr/setup/assignments/pay-assignment.service.ts`, `pr/setup/assignments/pay-assignment.controller.ts`,
      `pr/setup/assignments/level-pay-default.service.ts`, `pr/engine/cost-to-company-solver.ts`. Test: solver within
      0.01; every refusal named; a level default matches by label without the HR column.
- [ ] **T18**. Starter elements on first enable, setup checklist, employees without assignment. Files:
      `pr/setup/starter/starter-elements.service.ts`, `pr/setup/checklist/setup-checklist.service.ts`,
      `pr/setup/checklist/setup-checklist.controller.ts`. Test: starter set only for organizations without elements.
- [ ] **T19**. Sandbox route: hand-entered facts or the employee's assignment, employee facts and working calendar
      through ports; full trace response. Files: `pr/setup/sandbox/payroll-sandbox.service.ts`,
      `pr/setup/sandbox/payroll-sandbox.controller.ts`. Test: equals the engine golden payslips; writes nothing.
- [ ] **T20**. Field visibility: `@VisibleWith` on the person-level fields of plan §9, default field-rule contributions,
      `sensitive-read` events through `AUDIT_EVENT_SINK`; outbox events of plan §5; real-time hints. Files:
      `pr/setup/privacy/payroll-field-rules.ts`, `pr/setup/entities/pay-assignment.entity.ts`,
      `pr/events/payroll-setup.events.ts`. Test: gated fields absent on REST, null on GraphQL, absent in export and MCP
      outputs without the permission; one audit event per read of another person's pay; each event once per change;
      the employee's pay and bill rates read as before for every role (AC-15).
- [ ] **T53**. Default payroll payable and employee advance accounts: `/payroll/settings/accounts` writing designations
      through `PAYROLL_LEDGER_ACCOUNTS`, organization and currency checks, fallback after assignment and element
      accounts, setup checklist finding. Files: `pr/setup/settings/payroll-accounts.service.ts`,
      `pr/setup/settings/payroll-settings.controller.ts`. Test: account of another organization refused; fallback order;
      finding cleared once set.
- [ ] **T57**. Record types: elements, structures, assignments, declarations and proofs registered with the core record
      type registry of `custom-fields-and-forms` T2 (saved views, custom fields, approval definitions, automation
      triggers), each read guarded by the permissions and field visibility of plan §9. Files:
      `pr/setup/payroll-record-types.ts`, `pr/payroll.plugin.ts`. Test: `pr/setup/payroll-record-types.spec.ts`: each
      type is listed with the feature on and absent with it off; a saved view of assignments hides base pay without
      `PAYROLL_ASSIGNMENTS_VIEW` (FR-77).
- [ ] **T58**. Change history: who, when, before and after for every change to elements, versions, pay tables,
      structures, pay groups, years, assignments, tax tables, rules, declarations, proofs and opening balances, as
      activity-log entries (actor type `Agent` for MCP actions). Files: `pr/setup/audit/payroll-change-history.subscriber.ts`.
      Test: `pr/setup/audit/payroll-change-history.subscriber.spec.ts`: one entry with before and after per change of
      each record kind; an MCP change is marked as an agent action (FR-83).

## Phase 3 — UI surfaces

- [ ] **T21**. Angular scaffold `packages/plugins/payroll-ui` (`prui/payroll-ui.plugin.ts`, `prui/payroll-ui.routes.ts`,
      `prui/services/payroll-api.service.ts`), registered in `apps/gauzy/src/plugin-ui.config.ts`; menu group "Payroll";
      `PAYROLL.*` keys in every locale (`packages/ui-core/i18n/assets/i18n/*.json`). Test: plugin spec; entries hidden
      without feature or permission.
- [ ] **T22**. Elements page with the platform formula editor of `custom-fields-and-forms` fed by `/formula/names`
      (token highlighting, completion, inline findings), test-case grid, versions timeline. Files:
      `prui/components/elements-page/elements-page.component.ts`, `prui/components/element-editor/element-editor.component.ts`,
      `prui/components/test-case-grid/test-case-grid.component.ts`. Test: rendering specs; keyboard-only editing;
      screen-reader error text.
- [ ] **T23** (parallel). Structures, pay tables, pay groups, years and periods pages. Files:
      `prui/components/structures-page/structures-page.component.ts`, `prui/components/pay-tables-page/pay-tables-page.component.ts`,
      `prui/components/pay-groups-page/pay-groups-page.component.ts`. Test: rendering specs.
- [ ] **T24** (parallel). Assignments list and form with cost-to-company panel, solver and level defaults. Files:
      `prui/components/assignments-page/assignments-page.component.ts`,
      `prui/components/assignment-form/assignment-form.component.ts`. Test: rendering specs; amounts hidden without
      `PAYROLL_ASSIGNMENTS_VIEW`.
- [ ] **T25**. Sandbox page with step trace and saved-versus-draft comparison. Files:
      `prui/components/sandbox-page/sandbox-page.component.ts`. Test: rendering spec.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T26**. MCP read tools and `payroll_sandbox_run` in `packages/mcp-server/src/lib/tools/payroll-setup.ts`,
      registered in `packages/mcp-server/src/lib/tools/register-all-tools.ts`. Test: input-schema spec; sandbox tool
      writes nothing.
- [ ] **T27**. OpenAPI regenerated; SDK regeneration noted for release; webhook catalogue entries for `payroll.*`. Files: `packages/core/src/lib/bootstrap/swagger.ts`. Test: OpenAPI diff is additive; the webhook catalogue lists the `payroll.*` events.
- [ ] **T28**. User docs (docs site) and `docs/specs/README.md` index row. Test: docs build.

## Phase 5 — Depth

- [ ] **T29**. Tax tables (bands, surcharges, threshold, activation, read-only after use, compute preview), pay-group
      tables and employee choice; engine tax computation. Files: `pr/setup/tax/tax-table.service.ts`,
      `pr/setup/tax/tax-table.controller.ts`, `pr/setup/tax/employee-tax-choice.service.ts`,
      `pr/engine/tax/tax-computation.ts`. Test: golden yearly tax; invalid bands refused.
- [ ] **T30**. Exemption categories, declarations with caps or pack amounts, windows, other income. Files:
      `pr/setup/declarations/exemption-category.service.ts`, `pr/setup/declarations/tax-declaration.service.ts`,
      `pr/setup/declarations/tax-declaration.controller.ts`, `pr/setup/declarations/other-income.service.ts`. Test: caps
      per sub-category and category; closed window refused.
- [ ] **T31**. Proofs and review; projection uses verified amounts; unproven exemptions dropped after the last period.
      Files: `pr/setup/declarations/tax-proof.service.ts`, `pr/setup/declarations/tax-proof.controller.ts`. Test: unit
      and e2e.
- [ ] **T32**. Flexible benefits (element settings, structure defaults, choices); `PAYROLL_BENEFIT_ELIGIBILITY`
      provider for expense claim lines on a category linked to a benefit element (remaining amount, same-month warning,
      refusal above the eligible amount); benefit ledger writer for `payroll-processing` with claim entries keyed by the
      expense line. Files: `pr/setup/benefits/benefit-choice.service.ts`, `pr/setup/benefits/benefit.controller.ts`,
      `pr/setup/benefits/benefit-eligibility.provider.ts`, `pr/setup/benefits/benefit-ledger.writer.ts`. Test:
      eligibility golden cases; ledger keys unique; an over-limit claim line refused through the port.
- [ ] **T33** (parallel). End-of-service rules with applicability as core `rule` rows (`END_OF_SERVICE_RULE`, context of
      employee, pay group and separation kind), band validation, engine computation (service methods, band modes,
      minimum), preview. Files: `pr/setup/end-of-service/end-of-service-rule.service.ts`,
      `pr/setup/end-of-service/end-of-service-rule.controller.ts`, `pr/engine/end-of-service.ts`. Test: golden amounts;
      the rule matching a pay group and separation kind is chosen.
- [ ] **T34** (parallel). Opening balances and the missing-balance warning. Files:
      `pr/setup/opening-balances/opening-balance.service.ts`, `pr/setup/opening-balances/opening-balance.controller.ts`.
      Test: unit.
- [ ] **T35**. Fixed cost allocation shares on dimension sets through `PAYROLL_DIMENSION_SETS` (department and project
      without accounting). Files: `pr/setup/assignments/assignment-shares.service.ts`. Test: shares not 100 refused;
      inactive cost centre refused.
- [ ] **T36**. Bulk assignment as core operation `PAYROLL_BULK_ASSIGN` (a step per batch, results keyed by
      `operationId`, progress through the operation view). Files: `pr/setup/assignments/bulk-assign.operation.ts`,
      `pr/setup/structures/pay-structure.controller.ts`. Test: resumable after a stopped step; one result per employee;
      agents skipped; a second request for the same structure version and date joins the live operation.
- [ ] **T37**. Consumer of `hr.event.applied` and `hr.employee.hired` creating proposed assignments. Files:
      `pr/events/payroll-hr-events.consumer.ts`. Test: replay creates one proposal.
- [ ] **T38**. Pack content receiver `REGIONAL_PAYROLL_CONTENT` and hook calls through `PAYROLL_REGIONAL_HOOKS` with trace
      entries. Files: `pr/setup/regional/regional-payroll-content.receiver.ts`, `pr/engine/regional-hooks.ts`. Test: a
      fake pack changes exemption, relief and contributions; no hooks gives generic results.
- [ ] **T39**. Pay from tracked time: facts from approved timesheets and time logs at stored rates
      (`time-log-rates.ts` columns of `packages/core/src/lib/time-tracking/time-log/time-log-rates.ts`), project pay
      rates through `PAYROLL_PROJECT_RATES`, contractor structures, weekly cap, overrun warning. Files:
      `pr/setup/facts/tracked-time-facts.service.ts`, `pr/setup/structures/pay-structure-activation.ts`. Test: golden
      cases; a later rate change leaves stored-rate pay unchanged; unbound port pays every hour at its stored rate.
- [ ] **T40** (parallel). Import templates of plan §7. Files: `pr/setup/import/payroll-import-templates.ts`. Test:
      per-row errors; failed rows not imported.
- [ ] **T41**. Self-service: Angular `/pages/payroll/me/*` laid out for phone width
      (`prui/components/self-service/my-declaration-page.component.ts`, `my-proofs-page.component.ts`,
      `my-benefits-page.component.ts`), proof review queue (`prui/components/proof-review-queue/proof-review-queue.component.ts`),
      `payroll.setup-reminders` job through `NOTIFICATION_DISPATCHER` with de-duplication keys
      (`pr/schedule/payroll-setup-reminders.scheduler.ts`), email templates `payroll-declaration-window` and
      `payroll-proof-window` (`packages/core/src/lib/core/seeds/data/default-email-templates/<name>/<lang>/`). Test:
      rendering specs at phone width; the same reminder key sent twice reaches the employee once.
- [ ] **T42** (parallel). UI for tax, exemptions, end-of-service (applicability through the platform condition
      builder), opening balances and proof review. Files: `prui/components/tax-page/tax-page.component.ts`,
      `prui/components/exemptions-page/exemptions-page.component.ts`,
      `prui/components/end-of-service-page/end-of-service-page.component.ts`,
      `prui/components/opening-balances-page/opening-balances-page.component.ts`. Test: rendering.
- [ ] **T43**. Providers `TIME_OFF_DAILY_RATE` and `HR_PAY_SUMMARY`. Files:
      `pr/setup/providers/time-off-daily-rate.provider.ts`, `pr/setup/providers/hr-pay-summary.provider.ts`. Test: daily
      amount fallbacks in order.

## Phase 6 — Advanced capabilities

- [ ] **T44**. Impact preview as core operation `PAYROLL_IMPACT` and its dialog. Files:
      `pr/setup/impact/payroll-impact.operation.ts`, `prui/dialogs/impact-dialog.component.ts`. Test: 500 seeded
      employees within 30 s; nothing saved; one live operation per draft version.
- [ ] **T45**. Allocation by tracked time in the cost panel and engine split by approved hours. Files:
      `pr/engine/allocation-by-tracked-time.ts`, `prui/components/assignment-form/assignment-form.component.ts`. Test:
      golden split.
- [ ] **T46**. Assistant drafting through `PAYROLL_ASSISTANT` (agent runtime, purpose `payroll.element_draft`) and MCP
      `payroll_element_draft`. Files: `pr/setup/assistant/payroll-assistant.service.ts`,
      `packages/mcp-server/src/lib/tools/payroll-setup.ts`. Test: draft never saved; request payload holds no data of
      other employees.
- [ ] **T47** (parallel). Proof reading through `PAYROLL_DOCUMENT_READER` (`payroll.proof-reader`). Files:
      `pr/setup/declarations/proof-reader.worker.ts`. Test: pre-fill only; reviewer confirms.
- [ ] **T48**. Starter proposals as core operation `PAYROLL_STARTER_PROPOSALS` writing `PROPOSED` assignments
      (`source = STARTER`) and the proposals page over them. Files: `pr/setup/starter/starter-proposals.operation.ts`,
      `prui/components/proposals-page/proposals-page.component.ts`. Test: recurring costs unchanged; accept activates,
      skip rejects; a second run proposes nothing new.
- [ ] **T49** (parallel). Agent employees list with usage cost; agent refusals on every setup record. Files:
      `pr/setup/agent-employees/agent-employees.service.ts`, `pr/setup/agents/agent-refusal.ts`. Test: unit.
- [ ] **T50**. Write MCP tools with previews (assignment, declaration, proof). Files:
      `packages/mcp-server/src/lib/tools/payroll-setup.ts`. Test: preview writes nothing; actions marked as agent
      actions.
- [ ] **T51** (parallel). Nightly test-case job `payroll.test-cases-nightly`. Files:
      `pr/schedule/payroll-test-cases-nightly.scheduler.ts`. Test: failures notify administrators.
- [ ] **T52**. Trial period on a tenant with the flag on; spec status `Implemented`. Test: every acceptance criterion of `spec.md` §7 demonstrated on the trial tenant.
- [ ] **T54**. Core hook `EMPLOYEE_PAY_COST_SOURCE` in `packages/core/src/lib/employee-statistics/` (unbound = today) and
      the payroll provider of plan §3.2 (`pr/setup/providers/employee-pay-cost.provider.ts`), active only with
      `FEATURE_PAYROLL` on and `payroll.statisticsFromPayslips` on (default off). Test: statistics unchanged with the
      hook unbound, with the feature off and with the setting off; with the setting on and confirmed payslips a month
      counts payslip cost once and recurring salary rows only for other months.
- [ ] **T55**. Pay-rate sync of hourly assignments (plan §3.2): immediate write for a reached date and the
      `payroll.assignments.apply-rates` sweep. Files: `pr/setup/assignments/pay-rate-sync.service.ts`,
      `pr/schedule/payroll-apply-rates.scheduler.ts`. Test: time logs tracked after the effective date store the new
      rate; earlier logs keep theirs; a salaried assignment changes nothing.
- [ ] **T56**. Provide the ports other features bind to (plan, **Consumer tokens answered**): `PROJECT_COST_RATE_SOURCE`, `SHIFTS_LABOUR_COST`. Files: `apps/api/src/plugin-composition.ts`. Test: one contract test per token over the shape its consumer plan states; with this feature off each consumer keeps its stated fallback.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Pay elements | T12 |
| FR-2 | §3.1 Pay elements | T8, T12 |
| FR-3 | §3.1 Pay elements | T12 |
| FR-4 | §3.1 Pay elements | T11, T12 |
| FR-5 | §3.1 Pay elements | T8, T11 |
| FR-6 | §3.1 Pay elements | T11, T12 |
| FR-7 | §3.1 Pay elements | T12, T15, T29 |
| FR-8–FR-9 | §3.1 Pay elements | T11 |
| FR-10 | §3.1 Pay elements | T12 |
| FR-11 | §3.1 Pay elements | T12, T15 |
| FR-12 | §3.1 Pay elements | T12 |
| FR-13 | §3.1 Pay elements | T44 |
| FR-14 | §3.1 Pay elements | T18 |
| FR-15–FR-16 | §3.2 Formula language, tests and sandbox | T8, T9 |
| FR-17 | §3.2 Formula language, tests and sandbox | T8, T9, T10 |
| FR-18 | §3.2 Formula language, tests and sandbox | T9, T14 |
| FR-19 | §3.2 Formula language, tests and sandbox | T10 |
| FR-20 | §3.2 Formula language, tests and sandbox | T13, T51 |
| FR-21 | §3.2 Formula language, tests and sandbox | T19, T25 |
| FR-22 | §3.2 Formula language, tests and sandbox | T14 |
| FR-23 | §3.2 Formula language, tests and sandbox | T46 |
| FR-24–FR-26 | §3.3 Pay structures | T15 |
| FR-27 | §3.3 Pay structures | T19, T23 |
| FR-28 | §3.3 Pay structures | T36 |
| FR-29 | §3.4 Pay groups, payroll years and pay periods | T16 |
| FR-30–FR-32 | §3.4 Pay groups, payroll years and pay periods | T16, T23 |
| FR-33 | §3.4 Pay groups, payroll years and pay periods | T18 |
| FR-34 | §3.5 Structure assignments and cost to company | T17, T55 |
| FR-35 | §3.5 Structure assignments and cost to company | T17 |
| FR-36 | §3.5 Structure assignments and cost to company | T17, T24 |
| FR-37 | §3.5 Structure assignments and cost to company | T37 |
| FR-38–FR-39 | §3.5 Structure assignments and cost to company | T17, T24 |
| FR-40 | §3.5 Structure assignments and cost to company | T43 |
| FR-41 | §3.5 Structure assignments and cost to company | T17, T24 |
| FR-42–FR-46 | §3.6 Pay from tracked time | T39 |
| FR-47 | §3.7 Cost allocation | T35 |
| FR-48 | §3.7 Cost allocation | T45 |
| FR-49 | §3.7 Cost allocation | T35 |
| FR-50–FR-53 | §3.8 Tax tables | T29 |
| FR-54–FR-55 | §3.9 Exemptions, declarations, proofs and other income | T30 |
| FR-56 | §3.9 Exemptions, declarations, proofs and other income | T31 |
| FR-57 | §3.9 Exemptions, declarations, proofs and other income | T31, T41 |
| FR-58 | §3.9 Exemptions, declarations, proofs and other income | T30 |
| FR-59 | §3.9 Exemptions, declarations, proofs and other income | T47 |
| FR-60–FR-65 | §3.10 Flexible benefits, claims and the benefit ledger | T32 |
| FR-66–FR-68 | §3.11 End-of-service rules | T33 |
| FR-69 | §3.12 Opening balances and starting from existing data | T34, T42 |
| FR-70 | §3.12 Opening balances and starting from existing data | T34 |
| FR-71 | §3.12 Opening balances and starting from existing data | T48 |
| FR-72 | §3.12 Opening balances and starting from existing data | T40 |
| FR-73–FR-74 | §3.13 Country rules | T38 |
| FR-75 | §3.14 Agents, privacy, API and compatibility | T17, T49 |
| FR-76 | §3.14 Agents, privacy, API and compatibility | T20 |
| FR-77 | §3.14 Agents, privacy, API and compatibility | T27, T57 |
| FR-78 | §3.14 Agents, privacy, API and compatibility | T20 |
| FR-79 | §3.14 Agents, privacy, API and compatibility | T26, T46, T50 |
| FR-80 | §3.14 Agents, privacy, API and compatibility | T2 |
| FR-81 | §3.14 Agents, privacy, API and compatibility | T41 |
| FR-82 | §3.14 Agents, privacy, API and compatibility | T2, T21, T54 |
| FR-83 | §3.14 Agents, privacy, API and compatibility | T58 |
| FR-84 | §3.1 Pay elements | T53 |
| FR-85 | §3.14 Agents, privacy, API and compatibility | T54 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off; enabling it in dev shows the feature end to end.
- Constitution gates in `spec.md` §9 confirmed.
- Engine golden suite: sandbox, cost to company and `payroll-processing` payslips agree to the cent on the same facts.
- No formula path executes code: a security spec feeds hostile input (prototype names, huge numbers, deep nesting)
  and gets findings, never execution.
- Existing employee, recurring-expense, pay-run register and amounts-owed suites pass unchanged with the feature on
  and off.
- Every acceptance criterion of `spec.md` §7 has a named test.
