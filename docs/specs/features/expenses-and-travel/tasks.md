# Task Breakdown: Expenses and travel

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `expenses-and-travel`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind `FEATURE_EXPENSE_CLAIMS`: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts: optional `approvalState`, `source`, `expenseClaimId` and enums `ExpenseApprovalStateEnum`,
      `ExpenseSourceEnum` in `packages/contracts/src/lib/expense.model.ts`; new `expense-claims.model.ts` (interfaces,
      enums, DTO and preview shapes, event payloads, port tokens of plan §7); `AdditionalPayKindEnum.EXPENSE_REIMBURSEMENT`
      in `payroll-processing.model.ts`; `ApprovalPolicyTypesStringEnum.EXPENSE_CLAIM` / `EXPENSE_ADVANCE`;
      `RuleOwnerType.EXPENSE_POLICY`; exports. Test: type spec over sample payloads.
- [ ] **T2**. Core columns on `packages/core/src/lib/expense/expense.entity.ts` and migration
      `packages/core/src/lib/database/migrations/1791000025900-AddExpenseClaimColumns.ts` (three dialects). Test: migration up twice on SQLite is a no-op; existing expense DTO specs prove the routes
      ignore the new fields. Migration timestamps: `1791000025100` to `1791000025199` (`packages/plugins/expense-claims`); `1791000025900` to `1791000025999` (`packages/core`).
- [ ] **T3**. Read filter `expense/expense-actual.filter.ts` (TypeORM and MikroORM forms) applied in
      `expense.service.ts`, `expense.resolver.ts`, `queries/handlers/expense.find-split-expense.handler.ts`,
      `employee-statistics/employee-statistics.service.ts`, `aggregate-employee-statistic.handler.ts` and the invoice
      expense picker. Test: a guard spec seeds draft, rejected and approved claim rows and runs the existing expense,
      split, statistics and ORM-parity specs: only approved and direct rows counted.
- [ ] **T4**. Plugin scaffold `packages/plugins/expense-claims` (package, project, tsconfig, jest, eslint, path
      mapping), `expense-claims.plugin.ts`, `.features.ts` (`FEATURE_EXPENSE_CLAIMS`, default off), `.permissions.ts`
      (ten keys), `.settings.ts` (`expenses.*`); registered in `apps/api/src/plugins.ts`. Test: plugin list spec; routes
      `404` with the feature off.
- [ ] **T5**. Migration `packages/plugins/expense-claims/src/lib/database/migrations/1791000025100-CreateExpenseClaimTables.ts`
      on the shared core migration helpers of `procurement` T4 (`@gauzy/core`) (category detail, claim, line, tax
      line, advance, application) and entities with MikroORM repositories (`category-detail/expense-category-detail.entity.ts`,
      `claim/expense-claim.entity.ts`, `claim/expense-claim-line.entity.ts`, `claim/expense-claim-tax-line.entity.ts`,
      `advance/expense-advance.entity.ts`, `advance/advance-application.entity.ts`, each with `repository/`). Test:
      migration spec; repository smoke for both ORMs; `liveKey` uniqueness of applications.
- [ ] **T6** (parallel). Migrations and entities for policies and receipts (no receipt address table), travel, vehicle
      log (seeded service items, service work without due dates) and spend figures; core migration for the Docs inbound
      address owner and target. Files:
      `packages/plugins/expense-claims/src/lib/database/migrations/1791000025110-CreateExpensePolicyAndReceiptTables.ts`,
      `database/migrations/1791000025120-CreateTravelTables.ts`, `database/migrations/1791000025130-CreateVehicleLogTables.ts`,
      `database/migrations/1791000025140-CreateExpenseSpendFigureTable.ts`,
      `packages/core/src/lib/database/migrations/1791000025910-AddInboundAddressOwnerAndTarget.ts`, entities in
      `policy/`, `receipts/`, `cards/`, `travel/`, `rates/`, `vehicle-log/`, `spend/`. Test: migration spec on three
      dialects; existing Docs inbound suites green.
- [ ] **T7**. Permission, feature and setting contributions with `defaultFor`; tables registered with tenant export,
      import and factory reset; no seed migration. Files:
      `packages/plugins/expense-claims/src/lib/expense-claims.permissions.ts`, `expense-claims.features.ts`,
      `expense-claims.settings.ts`, `expense-claims.plugin.ts` (export, import and reset registrations). Test: grants per
      role from the contributions; export lists the tables; a tenant export with a draft claim contains its `expense`
      rows with `approvalState`, `source` and `expenseClaimId`, and after import the claim is whole while the expense
      list and report still leave the draft lines out.
- [ ] **T46**. Core write guard on claim-owned rows (spec FR-7): `ExpenseUpdateHandler` and `ExpenseDeleteHandler`
      (and the inherited soft-delete route `DELETE /expense/:id/soft` of `expense.controller.ts`) refuse with
      `409 EXPENSE_CLAIM_OWNED` a row whose
      `expenseClaimId` or `approvalState` is set; rows without them (every row that exists today) are updated and deleted
      as today; the claim services of the plugin are the only writers of claim-owned rows. Files:
      `packages/core/src/lib/expense/commands/handlers/expense.update.handler.ts`,
      `packages/core/src/lib/expense/commands/handlers/expense.delete.handler.ts`,
      `packages/core/src/lib/expense/expense-claim-owned.guard.ts`, `packages/core/src/lib/expense/expense.controller.ts`.
      Test: `packages/core/src/lib/expense/commands/handlers/expense.update.handler.spec.ts` and
      `expense.delete.handler.spec.ts`: `PUT /expense/:id` and `DELETE /expense/:id` on an approved claim line answer
      `409` and leave the amount, the claim and its posting unchanged; a direct expense is updated and deleted as today.

## Phase 2 — Services, endpoints, events

- [ ] **T8**. Settings over the settings store and category detail services and routes (kind `BENEFIT` with its
      benefit element); first-enable handler adding standard categories. Files:
      `packages/plugins/expense-claims/src/lib/settings/expense-claims-settings.controller.ts`,
      `settings/expense-claims-settings.service.ts`, `category-detail/expense-category-detail.service.ts`,
      `category-detail/expense-category-detail.controller.ts`, `category-detail/standard-categories.handler.ts`. Test:
      categories added only when missing; existing categories untouched.
- [ ] **T9**. Claim service and routes: drafts, lines written as core expense rows plus `expense_claim_line` in one
      transaction (merchant resolved to `organization_vendor` into `expense.vendorId` when it matches, first receipt URL
      in `expense.receipt`), totals, currency conversion with rate source, active and agent checks, filing for others.
      Files: `packages/plugins/expense-claims/src/lib/claim/expense-claim.service.ts`, `claim/expense-claim.controller.ts`,
      `claim/expense-claim-line.service.ts`, `claim/claim-currency.ts`, `claim/dto/expense-claim.dto.ts`,
      `claim/dto/claim-line.dto.ts`. Test: line create, edit, delete keep core row and detail in step on both ORMs;
      refusals of FR-8; the existing list shows vendor and receipt of an approved line; no vendor created.
- [ ] **T10**. Numbering and lifecycle through `BUSINESS_DOCUMENT_ENGINE` (types `expense_claim`, `expense_advance`,
      `travel_request`), fallback core `SequenceService`; histories. Files:
      `packages/plugins/expense-claims/src/lib/documents/expense-document-types.ts`,
      `documents/expense-numbering.service.ts`, `documents/expense-history.service.ts`. Test: numbers with the engine
      bound and unbound.
- [ ] **T11**. Submission rules (no lines, receipt threshold with declaration, deadline warn or refuse). Files:
      `packages/plugins/expense-claims/src/lib/claim/claim-submission.rules.ts`, `claim/expense-claim.controller.ts`
      (`/submit`, `/withdraw`). Test: each rule.
- [ ] **T12**. Approval: `EXPENSE_APPROVALS` gateway binding with default definitions; fallback without
      `approval-workflows`: core `request_approval` of type `EXPENSE_CLAIM` / `EXPENSE_ADVANCE` naming the approver
      resolved through `HR_APPROVER_RESOLVER` (kind expenses), gates registered in `linked-document-decision.gate.ts`,
      outcome through its settler (`registerRequestApprovalSettler`); self-approval chain skip, per-line amounts, return for changes, approver
      read access, notices through the dispatcher, `409` on concurrent decisions. Test: each path; the claim is decided
      on the existing Approvals page with workflows off; approver reads without other keys; approved amounts written to
      `expense.amount`, claimed kept on the line.
- [ ] **T13**. Taxes: tax lines through the totals pipeline's tax stage when bound, else legacy fields; inclusive and
      exclusive entry; recoverable share. Files: `packages/plugins/expense-claims/src/lib/tax/expense-claim-tax.service.ts`,
      `tax/expense-claim-tax.service.spec.ts`. Test: golden cases with and without the tax engine.
- [ ] **T14**. Ledger registration (`expense_claim` in `PURCHASES`, `expense_advance` in `MONEY`), posting facts on
      confirm, cancel and reclassify (`amended`, `/claims/:id/reclassify`, `/cancel` with `preview`), account check
      before approval, period lock check, spread months key. Files:
      `packages/plugins/expense-claims/src/lib/posting/expense-ledger-registration.ts`,
      `posting/expense-posting-facts.ts`, `posting/expense-account-check.ts`, `claim/expense-claim-cancel.service.ts`,
      `claim/expense-claim-reclassify.service.ts`. Test: facts balance in the registration samples; missing category
      account refused; reversal on cancel; a reclassification reposts without changing amounts.
- [ ] **T15**. Reimbursement by payment: open items through `OPEN_ITEM_REGISTER` (source type `EXPENSE_CLAIM`),
      reimbursement state from `receivables_payables.open_item.changed`; manual mark fallback. Files:
      `packages/plugins/expense-claims/src/lib/reimbursement/claim-reimbursement.service.ts`,
      `reimbursement/reimbursement-sync.consumer.ts`, `reimbursement/claim-reimbursement.controller.ts`. Test: partial and
      full payment; cancelled payment reopens; mark refused when items exist.
- [ ] **T16**. Reimbursement by payroll through `PAYROLL_ADDITIONAL_PAY` (kind `EXPENSE_REIMBURSEMENT`), paid state from
      `payroll.payslip.paid`, withdrawal on cancel. Files:
      `packages/plugins/expense-claims/src/lib/reimbursement/payroll-reimbursement.service.ts`,
      `reimbursement/reimbursement-sync.consumer.ts`. Test: one channel per claim; paid once.
- [ ] **T17**. Advances: requests, approval, outward payout through `EXPENSE_PAYMENTS`, paid state, applications through
      `OPEN_ITEM_ALLOCATOR` with limits, repayment receipts, recovery through `PAYROLL_ADDITIONAL_PAY` (kind
      `ADVANCE_RECOVERY`), cancellation rules, derived state. Files:
      `packages/plugins/expense-claims/src/lib/advance/expense-advance.service.ts`, `advance/expense-advance.controller.ts`,
      `advance/advance-application.service.ts`, `advance/advance-settlement.service.ts`, `advance/advance-state.ts`. Test:
      application above unsettled or approved total refused; concurrent applications serialized per claim (claim row
      lock first, then advances in id order) and per advance: two requests applying different 100 advances to one
      100 claim at once leave one applied and one refused; recovery never above unsettled.
- [ ] **T18**. Travel requests: legs, stays, estimates, identity validity through `HR_DIRECTORY`, approval through the gateway
      or core request approval `BUSINESS_TRIP` with a decision gate in `request-approval/linked-document-decision.gate.ts`
      applied only to requests linked to a travel request, conversion of existing business-trip requests, advance and
      claim prefill, close job (`travel/travel-request.service.ts`, `travel/travel-request.controller.ts`,
      `travel/travel-close.scheduler.ts`, `packages/core/src/lib/request-approval/linked-document-decision.gate.ts`).
      Test: core approval moves the request; existing business-trip requests keep working and
      are decided by the same users as before, with the feature on and off.
- [ ] **T19**. Vehicle log: private vehicles, refuelling entries on equipment vehicles, odometer check against log and
      `EXPENSE_VEHICLES`, odometer written to the asset through `EXPENSE_ASSET_READINGS` when the vehicle is an asset of
      `fixed-assets`, service work (items and cost), claim from entry and cancellation rules. Files:
      `packages/plugins/expense-claims/src/lib/vehicle-log/vehicle-log.service.ts`, `vehicle-log/vehicle-log.controller.ts`,
      `vehicle-log/employee-vehicle.service.ts`, `vehicle-log/odometer.guard.ts`. Test: backwards odometer refused; one
      claim per entry; approved claim blocks cancel; one asset reading per entry.
- [ ] **T20**. Re-billing: billable approved lines set `BILLABLE_TO_CONTACT` / `UNINVOICED`, markup from project or
      settings, invoiced once through the existing invoice expense flow. Files:
      `packages/plugins/expense-claims/src/lib/rebilling/expense-rebilling.service.ts`. Test: offered once; markup applied.
- [ ] **T21**. Outbox events of plan §5 and consumers (`subscriber:expense-claims`); `HR_SETTLEMENT_SOURCE` provider;
      daily `expenses.reminders` job for unsettled advances and submission deadlines (dispatcher `dedupeKey`). Files:
      `packages/plugins/expense-claims/src/lib/events/expense-claims.events.ts`, `events/expense-claims.consumers.ts`,
      `events/expense-settlement.source.ts`, `schedule/expenses-reminders.scheduler.ts`. Test: each consumed event applied
      once; settlement lists unpaid claims and unsettled advances; an advance unsettled past the set days is reminded once.
- [ ] **T22** (parallel). Report definitions FR-60 to FR-67 and the source filter on the existing report (FR-70).
      Files: `packages/plugins/expense-claims/src/lib/reports/expense-report-datasets.ts`,
      `reports/definitions/*.definition.ts` (one per report), `packages/core/src/lib/expense/expense.service.ts` (source
      filter). Test: seeded month totals match lines and advances.
- [ ] **T40** (before T24). Core UI: the expenses list of `apps/gauzy/src/app/pages/expenses` on
      `PageDataTableRegistryService` with page id `expenses-page` (added to `PageDataTablePageId`), existing columns
      registered first. Files: `apps/gauzy/src/app/pages/expenses/expenses.component.ts`,
      `packages/ui-core/core/src/lib/services/page/page-data-table-registry.types.ts`. Test: the list renders as today
      with no extension; a test column appears.
- [ ] **T42**. Record types: claims, advances, travel requests and vehicle log entries registered for saved views,
      custom fields, approval definitions and automation triggers. Files:
      `packages/plugins/expense-claims/src/lib/record-types/expense-claims-record-types.ts`,
      `expense-claims.plugin.ts`. Test: each record type is listed by the saved-view, custom-field, approval-definition and
      automation registries; none is listed with the feature off.
- [ ] **T43**. Audit trail: who, when, before and after for every claim, line, decision, policy, rate, card link and log
      entry change, through the platform activity log. Files:
      `packages/plugins/expense-claims/src/lib/audit/expense-claims-audit.subscriber.ts`. Test: one entry per change with
      before and after values; a decision records the approver.

## Phase 3 — UI surfaces

- [ ] **T23**. `packages/plugins/expense-claims-ui` scaffold (registered in `apps/gauzy/src/plugin-ui.config.ts`): My
      claims (form with lines, receipts, totals) and Approvals; menu entries under Expenses hidden without feature or
      permission; keys `EXPENSE_CLAIMS.*` in every locale (Advances, Travel and Vehicle log pages are T44; Reports,
      Settings and category detail T45). Files: `packages/plugins/expense-claims-ui/src/lib/expense-claims-ui.plugin.ts`,
      `components/my-claims/my-claims.component.ts`, `components/claim-form/claim-form.component.ts`,
      `components/approvals/claim-approvals.component.ts`, `services/expense-claims.service.ts`. Test: rendering specs;
      keyboard flow.
- [ ] **T24** (after T40). Source column and claim link registered on the `expenses-page` data table of
      `apps/gauzy/src/app/pages/expenses`. Files:
      `packages/plugins/expense-claims-ui/src/lib/components/expenses-page/expense-source-column.ts`,
      `packages/plugins/expense-claims-ui/src/lib/expense-claims-ui.plugin.ts`. Test: page unchanged with the feature off.
- [ ] **T25** (parallel). Phone use of the installable Gauzy web app in `expense-claims-ui`: receipt camera and share
      target, receipt list, claim form, advance and travel forms, vehicle log, approval card at phone width; no React
      package (FR-78). Files: `packages/plugins/expense-claims-ui/src/lib/components/my-receipts/my-receipts.component.ts`,
      `components/my-receipts/receipt-camera.component.ts`, `services/receipt-share-target.service.ts`. Test: rendering
      specs at phone width; the installed app captures a receipt photo and submits a claim.
- [ ] **T44** (parallel). Advances, Travel and Vehicle log pages in `expense-claims-ui` (request and settle an advance,
      travel request with legs, stays and estimate, vehicle log entries and private vehicles). Files:
      `packages/plugins/expense-claims-ui/src/lib/components/advances/advances.component.ts`,
      `components/travel/travel-request-form.component.ts`, `components/vehicle-log/vehicle-log.component.ts`. Test:
      rendering specs; keyboard flow.
- [ ] **T45** (parallel). Reports, Settings and category detail pages in `expense-claims-ui`. Files:
      `packages/plugins/expense-claims-ui/src/lib/components/reports/expense-claim-reports.component.ts`,
      `settings/expense-claims-settings-page.component.ts`, `settings/expense-category-detail.component.ts`. Test:
      rendering specs; the settings page saves each `expenses.*` key.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T26**. MCP tools `packages/mcp-server/src/lib/tools/expense-claims.ts` (list, get, submit, decide, advances,
      travel submit) with preview; existing `expenses.ts` tools unchanged. Test: tool schema spec; preview writes
      nothing; permissions honoured.
- [ ] **T27** (parallel). Import templates (claims history, advances, rates); OpenAPI regenerated; SDK regeneration
      noted. Files: `packages/plugins/expense-claims/src/lib/import/claims-history.import-template.ts`,
      `import/advances.import-template.ts`, `import/expense-rates.import-template.ts`,
      `packages/core/src/lib/bootstrap/swagger.ts`. Test: per-row errors.
- [ ] **T28**. User docs (claims, advances, travel, vehicle log), `docs/specs/README.md` row; spec status updated. Test: docs build.

## Phase 5 — Advanced capabilities

- [ ] **T29**. Policy engine (pure `policy/`): scopes as core `rule` rows (`EXPENSE_POLICY`) evaluated with
      `HR_EMPLOYEE_RULE_CONTEXT`, limit kinds per item, day, trip and month, actions, explanations;
      `/claims/lines/check`; policy routes `/policies` (+ `/:id/rules`); capped amounts suggested, justification
      required, blocking findings stop submission; re-check on policy change (core operation over many lines). Files:
      `packages/plugins/expense-claims/src/lib/policy/policy-engine.ts`, `policy/expense-policy.service.ts`,
      `policy/expense-policy.controller.ts`, `policy/policy-recheck.operation.ts`. Test: golden cases per rule and
      action; under 300 ms on a seeded month.
- [ ] **T30**. Tracked-time evidence flag (time logs of the claimant on the line's project within two days). Files:
      `packages/plugins/expense-claims/src/lib/policy/tracked-time-evidence.ts`. Test: flagged and not flagged cases; no
      time-log write.
- [ ] **T31**. Receipt capture: uploads, personal receipt address as the employee's Docs inbound address of target
      `EXPENSE_RECEIPTS` (`EXPENSE_RECEIPT_MAILBOX`, messages through `DOCS_INBOUND_TARGETS`), queue
      `expense-receipt-extract` with `EXPENSE_RECEIPT_READER` bound to `AGENT_RUNTIME`, proposals with confidences, "my
      receipts". Files: `packages/plugins/expense-claims/src/lib/receipts/receipt-capture.service.ts`,
      `receipts/receipt-capture.controller.ts`, `receipts/receipt-extract.worker.ts`, `receipts/receipt-mailbox.adapter.ts`.
      Test: reading off sends nothing out; failure leaves the receipt attached; a rotated address stops receiving.
- [ ] **T32**. Duplicate check across claims and card explanations (fingerprint, vendor-date-amount tolerance); block
      only identical files in approved claims. Files: `packages/plugins/expense-claims/src/lib/duplicates/expense-duplicate-check.ts`.
      Test: cross-employee duplicate flagged; tolerance bounds.
- [ ] **T33**. Per-diem and mileage: rates CRUD, pack content through `EXPENSE_RATE_CONTENT`, quotes with working,
      yearly bands from `employee_mileage_year`, distance provider port, prefill from trips, per diem added to a trip's
      estimate. Files: `packages/plugins/expense-claims/src/lib/rates/per-diem-rate.service.ts`,
      `rates/mileage-rate.service.ts`, `rates/expense-rates.controller.ts`, `rates/per-diem-quote.ts`,
      `rates/mileage-quote.ts`. Test: partial days, provided meals, band crossing inside one line.
- [ ] **T34**. Budget pre-approval: availability through `EXPENSE_BUDGET_AVAILABILITY` and project cost budget,
      commitments through `BUDGET_COMMITMENT_SOURCE`, release on claims and close. Files:
      `packages/plugins/expense-claims/src/lib/budget/travel-budget-check.service.ts`,
      `budget/expense-commitment.source.ts`. Test: commitment recorded once and released; blocking control routes to the
      budget step.
- [ ] **T35**. Card programme: holders, intake consumer from banking card lines, proposals, explain, personal and
      dismiss, reminders and escalation, `BANKING_COUNTERPART_SOURCE` provider. Files:
      `packages/plugins/expense-claims/src/lib/cards/card-holder.service.ts`, `cards/card-intake.consumer.ts`,
      `cards/card-explanation.service.ts`, `cards/cards.controller.ts`, `cards/card-counterpart.source.ts`. Test:
      explained line never reimbursed; personal charge settled as an advance; counterpart offered to reconciliation once.
- [ ] **T36**. Spend figures consumer (the one maintained expense figure, offered as `EXPENSE_SPEND`), dashboards
      (`/spend/projects/:id`, `/spend/clients/:id`), realtime channels, budget threshold notices through the dispatcher.
      Direct expenses: the subscriber on core `expense` appending `expenses.direct_expense.changed` in the writing
      transaction, the recompute per figure key, and the backfill operation `EXPENSE_SPEND_BACKFILL` at each switch-on.
      Files: `packages/plugins/expense-claims/src/lib/spend/spend-figures.consumer.ts`, `spend/spend.controller.ts`,
      `spend/expense-spend.reader.ts`, `spend/budget-threshold.notifier.ts`, `spend/direct-expense.subscriber.ts`,
      `spend/spend-backfill.operation.ts`. Test: figures equal line sums; hint within
      5 s; 80 % and 100 % notices once; the `EXPENSE_SPEND` reader answers the same totals; direct expenses recorded
      before switch-on appear after the backfill; a direct expense created, moved to another project and deleted through
      the existing routes moves both projects' figures; a backfill running beside live changes ends with the row sums;
      a project and month whose last expense is deleted while the feature is off shows zero after the next switch-on.
- [ ] **T37**. Claims from delivery trips through `EXPENSE_CLAIM_SOURCES` (adapter bound in
      `apps/api/src/plugin-composition.ts`). Test: prefill with trip date, vehicle and distance; hidden without trips.
- [ ] **T38**. UI for policies and rates, receipts, cards to explain, spend dashboards in `expense-claims-ui` (phone
      width included). Files: `packages/plugins/expense-claims-ui/src/lib/components/policies/expense-policies.component.ts`,
      `components/rates/expense-rates.component.ts`, `components/cards/cards-to-explain.component.ts`,
      `components/spend/spend-dashboard.component.ts`. Test: rendering; live findings announced.
- [ ] **T39**. Write MCP tools (`expense_claim_draft`, `expense_policy_check`, `expense_card_explain`,
      `expense_spend`) with preview; reports FR-68 and FR-69. Files: `packages/mcp-server/src/lib/tools/expense-claims.ts`,
      `packages/plugins/expense-claims/src/lib/reports/definitions/policy-findings.definition.ts`,
      `reports/definitions/travel-estimate-actual.definition.ts`. Test: preview writes nothing; agent actions carry
      `actorType`; report totals.
- [ ] **T41**. Benefit lines: a line on a `BENEFIT` category checked against `PAYROLL_BENEFIT_ELIGIBILITY` (remaining
      eligible amount of the element and payroll year) while typed and at approval; approved benefit lines always handed
      to `PAYROLL_ADDITIONAL_PAY` as kind `BENEFIT_CLAIM` (payroll writes the benefit ledger), withdrawn on cancellation.
      Files: `packages/plugins/expense-claims/src/lib/benefit/benefit-line.guard.ts`,
      `benefit/benefit-claim.handoff.ts`. Test: a line above the eligible amount is refused with
      `PAYROLL_CLAIM_ABOVE_ELIGIBLE`; the payment channel is not offered for benefit lines; categories hidden without the
      port.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Enabling, settings and categories | T3, T4 |
| FR-2 | §3.1 Enabling, settings and categories | T8, T45 |
| FR-3 | §3.1 Enabling, settings and categories | T8, T41 |
| FR-4 | §3.1 Enabling, settings and categories | T14 |
| FR-5–FR-6 | §3.2 Claims and lines | T9 |
| FR-7 | §3.2 Claims and lines | T3, T46 |
| FR-8 | §3.2 Claims and lines | T9 |
| FR-9 | §3.2 Claims and lines | T9, T13 |
| FR-10 | §3.2 Claims and lines | T9 |
| FR-11 | §3.2 Claims and lines | T10 |
| FR-12 | §3.2 Claims and lines | T11 |
| FR-13 | §3.3 Policies, receipts and duplicates | T29, T38 |
| FR-14 | §3.3 Policies, receipts and duplicates | T29, T38 |
| FR-15 | §3.3 Policies, receipts and duplicates | T29 |
| FR-16 | §3.3 Policies, receipts and duplicates | T30 |
| FR-17 | §3.3 Policies, receipts and duplicates | T25, T31 |
| FR-18 | §3.3 Policies, receipts and duplicates | T31 |
| FR-19 | §3.3 Policies, receipts and duplicates | T32 |
| FR-20 | §3.4 Taxes, approval and postings | T13 |
| FR-21 | §3.4 Taxes, approval and postings | T12 |
| FR-22 | §3.4 Taxes, approval and postings | T12, T23 |
| FR-23 | §3.4 Taxes, approval and postings | T12 |
| FR-24 | §3.4 Taxes, approval and postings | T14 |
| FR-25 | §3.4 Taxes, approval and postings | T14 |
| FR-26 | §3.4 Taxes, approval and postings | T14 |
| FR-27 | §3.4 Taxes, approval and postings | T14 |
| FR-28 | §3.5 Reimbursement and advances | T15 |
| FR-29 | §3.5 Reimbursement and advances | T16 |
| FR-30 | §3.5 Reimbursement and advances | T15 |
| FR-31 | §3.5 Reimbursement and advances | T17 |
| FR-32 | §3.5 Reimbursement and advances | T17 |
| FR-33–FR-34 | §3.5 Reimbursement and advances | T17 |
| FR-35 | §3.5 Reimbursement and advances | T17 |
| FR-36 | §3.5 Reimbursement and advances | T21 |
| FR-37–FR-40 | §3.6 Company cards and bank feeds | T35 |
| FR-41 | §3.7 Projects, clients and spend | T36 |
| FR-42 | §3.7 Projects, clients and spend | T20 |
| FR-43–FR-44 | §3.7 Projects, clients and spend | T36 |
| FR-45 | §3.8 Travel | T18 |
| FR-46 | §3.8 Travel | T18 |
| FR-47 | §3.8 Travel | T18 |
| FR-48 | §3.8 Travel | T34 |
| FR-49 | §3.8 Travel | T33 |
| FR-50–FR-51 | §3.8 Travel | T18 |
| FR-52–FR-54 | §3.9 Per diem, mileage and vehicle log | T33 |
| FR-55–FR-58 | §3.9 Per diem, mileage and vehicle log | T19 |
| FR-59 | §3.9 Per diem, mileage and vehicle log | T37 |
| FR-60–FR-67 | §3.10 Reports | T22 |
| FR-68–FR-69 | §3.10 Reports | T39 |
| FR-70 | §3.10 Reports | T22 |
| FR-71 | §3.11 API, agents and compatibility | T9, T42 |
| FR-72 | §3.11 API, agents and compatibility | T21 |
| FR-73 | §3.11 API, agents and compatibility | T26, T39 |
| FR-74 | §3.11 API, agents and compatibility | T27 |
| FR-75 | §3.11 API, agents and compatibility | T4, T7 |
| FR-76 | §3.11 API, agents and compatibility | T43 |
| FR-77 | §3.11 API, agents and compatibility | T3, T24 |
| FR-78 | §3.11 API, agents and compatibility | T25 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off for existing tenants; enabling it in dev shows claims, advances, travel and vehicle log end
  to end; spec AC-13 holds.
- Constitution gates in `spec.md` §9 confirmed.
- Existing expense, category, split, recurring-expense, statistics, invoice-expense and MCP expense suites pass
  unchanged with the feature on and off; seeded draft claim rows never reach existing reads.
- A seeded month: receipts read into a claim, policy findings explained, approval posted, reimbursement by payment and
  by payroll each once, an advance applied and recovered, a trip pre-approved and closed with its commitment released,
  reports matching the lines.
