# Task Breakdown: Tax engine

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `tax-engine`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind the feature flags: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it. Paths are relative to the repository root;
  `tax/` means `packages/plugins/tax/src/lib/` and `tax-ui/` means `packages/plugins/tax-ui/src/lib/`. Each entity
  `<name>.entity.ts` has `repository/type-orm-<name>.repository.ts` and `repository/mikro-orm-<name>.repository.ts`
  beside it, as the existing `tax/tax-rate/` does.
- Plan phase 1 ("surface what exists") is T5, T30, T31 and T40: they need no schema change and can ship first.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts: `packages/contracts/src/lib/tax-engine.model.ts` (enums, document state, breakdown, trace,
  override, account mapping, registration, register entry, period, simulation, port shapes incl. `ITaxReturnLayouts`);
  additive values in `tax-line.model.ts` (`TaxLineOwnerType`) and `rule.model.ts` (`RuleOwnerType.TAX_REGIME`,
  `RuleOwnerType.TAX_ITEM_OVERRIDE`); export from `index.ts`.
  Test: contract compile spec and enum-parity spec.
- [ ] **T2**. Withholding contracts: `packages/contracts/src/lib/withholding.model.ts`. Test: compile spec.
- [ ] **T3**. Optional invoice fields (`taxMode`, `priceIncludesTax`, `taxRegimeId`, `taxSummary`) in
  `packages/contracts/src/lib/invoice.model.ts` and the invoice DTOs in `packages/core/src/lib/invoice/dto/`. Test:
  DTO validation spec (legacy payloads still valid).
- [ ] **T4**. Feature codes in `tax/tax.features.ts`: `FEATURE_TAX_DOCUMENTS`, `FEATURE_WITHHOLDING` (default off,
  depend on `FEATURE_TAX`); settings in `tax/tax.settings.ts` (mode, address basis, rounding, tolerances, checks,
  review schedule). Test: feature and settings contribution spec.
- [ ] **T5** (parallel). `FeatureFlagGuard` and `@FeatureFlag(FEATURE_TAX)` on the three existing controllers and the
  resolvers in `tax/tax-category`, `tax/tax-rate`, `tax/tax-regime`, `tax/graphql`, preceded by a migration that
  switches `FEATURE_TAX` on for every tenant holding tax categories, rates or regimes. Files:
  `tax/tax-category/tax-category.controller.ts`, `tax/tax-rate/tax-rate.controller.ts`,
  `tax/tax-regime/tax-regime.controller.ts`, `tax/graphql/resolvers/{tax-category,tax-rate,tax-regime}.resolver.ts`,
  `tax/database/migrations/1791000078100-EnableTaxFeatureForTenantsWithTaxData.ts`, `tax/database/migrations/index.ts`.
  Test: controller spec (flag off → refused; flag on → unchanged answers); a tenant with tax data and the flag off before the migration keeps its routes. Migration timestamps: `1791000078100` to `1791000078199` (`packages/plugins/tax`).
- [ ] **T6**. Permission contributions in `tax/tax.permissions.ts` (19 new values, groups, `defaultFor`). Test:
  permission catalogue spec.
- [ ] **T7**. Entity changes: columns on `tax/tax-rate/tax-rate.entity.ts`, `tax/tax-rate-part/tax-rate-part.entity.ts`,
  `tax/tax-regime/tax-regime.entity.ts`, `packages/core/src/lib/tax-line/tax-line.entity.ts`. Test: dual-ORM mapping
  parity spec.
- [ ] **T8**. Migration `AddTaxEngineColumns` in `tax/database/migrations/` (three dialects, backfill of
  `calculationBasis`). Files: `tax/database/migrations/1791000078110-AddTaxEngineColumns.ts`. Test: migration spec on
  SQLite; PostgreSQL and MySQL in the migration smoke suite.
- [ ] **T9**. Entities and repositories `tax/tax-document` (tax state only; totals stay in `business_document_totals`),
  `tax/tax-item-override` (target, action, dates; conditions as `rule` rows), `tax/tax-charge-rule`; migration
  `CreateTaxDocumentTables`. Files: `tax/tax-document/tax-document.entity.ts`,
  `tax/tax-item-override/tax-item-override.entity.ts`, `tax/tax-charge-rule/tax-charge-rule.entity.ts`, with their
  repositories, `tax/database/migrations/1791000078120-CreateTaxDocumentTables.ts`. Test: migration spec and repository
  spec.
- [ ] **T10** (parallel). Entities `tax/tax-account-mapping` (with `dimensionSetId`), `tax/tax-registration` (+ check;
  owner types incl. `SELLER`); migration `CreateTaxAccountAndRegistrationTables` with the backfill of primary
  registrations from organizations, contacts and sellers; sync service keeping `organization.taxId`, the contact's tax
  registration columns and `seller.taxId` in step with the primary registration. Files:
  `tax/tax-account-mapping/tax-account-mapping.entity.ts`, `tax/tax-registration/tax-registration.entity.ts`,
  `tax/tax-registration/tax-registration-check.entity.ts`, with their repositories,
  `tax/tax-registration/tax-registration-sync.service.ts`,
  `tax/database/migrations/1791000078130-CreateTaxAccountAndRegistrationTables.ts`. Test: backfill spec; a write on
  either side keeps both equal.
- [ ] **T11** (parallel). Entities `tax/tax-register` (entry, period total), `tax/tax-period` (calendar with
  `returnLayoutId` and `packScheduleId`, period with `packRunId` and `ledgerLockId`); migration
  `CreateTaxRegisterTables`. Files: `tax/tax-register/tax-register-entry.entity.ts`,
  `tax/tax-register/tax-period-total.entity.ts`, `tax/tax-period/tax-calendar.entity.ts`,
  `tax/tax-period/tax-period.entity.ts`, with their repositories,
  `tax/database/migrations/1791000078140-CreateTaxRegisterTables.ts`. Test: unique-key spec.
- [ ] **T12** (parallel). Entities `tax/tax-simulation` (with `operationId`) and its results; migration
  `CreateTaxSimulationTables`. Files: `tax/tax-simulation/tax-simulation.entity.ts`,
  `tax/tax-simulation/tax-simulation-result.entity.ts`, with their repositories,
  `tax/database/migrations/1791000078150-CreateTaxSimulationTables.ts`. Test: migration spec.
- [ ] **T13**. Default role grants as `defaultFor` on the permission contributions of `tax.permissions.ts` (no
  seed migration). Test: role-grant resolution spec.

## Phase 2 — Services, endpoints, events

- [ ] **T14**. Calculator (pure): `tax/calculator/` — bases (net, running total, prior tax, per unit, lump sum),
  ordering and cycle check, distribution with remainder. Files: `tax/calculator/calculation-bases.ts`,
  `tax/calculator/rate-ordering.ts`, `tax/calculator/distribution.ts`. Test: unit specs and property tests (parts sum
  to the whole).
- [ ] **T15**. Calculator: prices including tax, rounding modes, drift correction, rounded total, organization-currency
  twins. Files: `tax/calculator/prices-including-tax.ts`, `tax/calculator/rounding.ts`,
  `tax/calculator/currency-twins.ts`. Test: property tests (gross equals entered prices; line taxes sum to document tax) in three currencies' scales.
- [ ] **T16**. Manual-mode adapter `tax/tax-document/manual-tax.adapter.ts` (typed percentages → tax lines). Test:
  golden-invoice spec replaying stored invoices against today's totals.
- [ ] **T17**. Determination `tax/determination/`: regime order (document, party, rules, destination, general),
  address basis fallback, category ladder, item overrides, zero kinds; trace builder. Files:
  `tax/determination/regime-determination.ts`, `tax/determination/address-basis.ts`,
  `tax/determination/category-ladder.ts`, `tax/determination/trace-builder.ts`. Test: table-driven specs.
- [ ] **T18**. Determination rules on regimes: rule context catalogue for `TAX_REGIME` and `TAX_ITEM_OVERRIDE` in
  `packages/core/src/lib/rule/rule.validator.ts`, conflict check, `GET`/`PUT /tax-regimes/:id/rules`. Test: conflict spec.
- [ ] **T19**. `TaxDocumentService` (`tax/tax-document/`): calculate, atomic replace of tax lines, `tax_document`
  state, stage amounts handed to the document engine's totals row, validation for confirmation, create-from copy,
  partial lines, credit and return reversal. Files: `tax/tax-document/tax-document.service.ts`. Test: service specs on
  SQLite with both ORMs; no total stored twice.
- [ ] **T20**. Port `DOCUMENT_TAX_STAGE`: export from `tax/index`, bind in `apps/api/src/plugin-composition.ts`; invoice
  service calls it when `FEATURE_TAX_DOCUMENTS` is on. Test: composition spec; invoice e2e (flag off unchanged).
- [ ] **T21**. Controllers `tax/tax-document/tax-document.controller.ts` (breakdown, recalculate, regime, line
  override, stated tax, explanation, comparison) and `/tax/test-bench`. Test: e2e for permissions and tolerance.
- [ ] **T22**. Rate lifecycle: supersede, deactivate, in-use guard behind `rates.protectInUse` (default off), pack
  markers (`tax/tax-rate/tax-rate.service.ts`). Test: service spec; with the setting off a rate in use is edited as
  today and stored tax lines stay unchanged.
- [ ] **T23** (parallel). Item overrides and charge rules: services and controllers `tax/tax-item-override` (regime
  and place conditions written as `rule` rows), `tax/tax-charge-rule`; overlap guard through the rule conflict check.
  Files: `tax/tax-item-override/tax-item-override.service.ts`, `tax/tax-item-override/tax-item-override.controller.ts`,
  `tax/tax-charge-rule/tax-charge-rule.service.ts`, `tax/tax-charge-rule/tax-charge-rule.controller.ts`. Test: overlap
  and resolution specs.
- [ ] **T24**. Tax accounts, the one tax-to-account map: `tax/tax-account-mapping` service and controller (dimension
  sets resolved through `AnalyticDimensionSetService.resolve`; pack rows written through `REGIONAL_TAX_CONTENT`), port
  `TAX_LEDGER_ACCOUNTS`, missing mapping check, `TaxPostingService` answering `LEDGER_TAX_AMOUNTS` and
  `VALUATION_COST_COMPONENTS`. Files: `tax/tax-account-mapping/tax-account-mapping.service.ts`,
  `tax/tax-account-mapping/tax-account-mapping.controller.ts`, `tax/posting/tax-posting.service.ts`. Test: port
  contract specs with a fake account service.
- [ ] **T25**. Register: outbox consumer `subscriber:tax-register` (`tax/tax-register/`), reversals, late entries,
  `tax_period_total` maintenance, manual-journal entries. Files: `tax/tax-register/tax-register.consumer.ts`,
  `tax/tax-register/tax-register.service.ts`. Test: idempotency spec (double delivery), late-entry spec.
- [ ] **T26**. Periods and returns: `tax/tax-period` service and controller; `TaxRegisterDatasetProvider` answering
  `REPORT_LAYOUT_DATASETS` (`tax.register`); return boxes computed through `TAX_RETURN_LAYOUTS` (the layout evaluator of
  `financial-reports`) with drill-down keys; ledger reconciliation; filing lock through `TAX_PERIOD_LOCKS`. Files:
  `tax/tax-period/tax-period.service.ts`, `tax/tax-period/tax-period.controller.ts`,
  `tax/tax-register/tax-register-dataset.provider.ts`, `tax/tax-period/tax-reconciliation.service.ts`. Test:
  return evaluation spec on a seeded register; filing sets and reopening lifts the lock.
- [ ] **T27**. Report definitions: `tax/reports/tax-report.definitions.ts` registering the twelve reports of spec
  §3.9 with the report builder. Test: one dataset spec per report on a seeded register.
- [ ] **T28**. Out-of-date marking and bulk re-tax: consumer of `tax.configuration.changed`, core operation
  `TAX_RETAX` through the bulk executor, `POST /tax-documents/retax` with preview. Files:
  `tax/tax-document/configuration-changed.consumer.ts`, `tax/tax-document/retax.operation.ts`,
  `tax/tax-document/tax-document.controller.ts`. Test: partial-failure spec (497 of 500).
- [ ] **T29** (parallel). Events: outbox appends for `tax.register_entry.recorded`, `tax.period.*`,
  `tax.configuration.changed`; realtime hint `tax.document.calculated`; inbox items. Files: `tax/events/tax-outbox.ts`,
  `tax/events/tax-realtime.ts`, `tax/events/tax-inbox-items.ts`. Test: event payload specs.
- [ ] **T62**. Advance deduction (spec FR-50): when a final invoice deducts an advance invoice, the tax charged on the
  advance is deducted per rate from the final document's tax lines, linked to the advance's lines. Files:
  `tax/tax-document/advance-deduction.ts`, `tax/tax-document/tax-document.service.ts`. Test: an advance at two rates
  deducted from a final invoice leaves per-rate tax equal to the final minus the advance; a partial advance deducts in
  proportion.

## Phase 3 — UI surfaces

- [ ] **T30** (parallel). Scaffold `packages/plugins/tax-ui`; pages for categories, rates with parts, regimes;
  menu entries gated by `FEATURE_TAX`; i18n keys in every locale. Files: `tax-ui/tax-ui.plugin.ts`,
  `tax-ui/pages/categories/tax-categories-page.component.ts`, `tax-ui/pages/rates/tax-rates-page.component.ts`,
  `tax-ui/pages/regimes/tax-regimes-page.component.ts`, `packages/ui-core/i18n/assets/i18n/en.json` (and every other
  locale file there). Test: rendering specs.
- [ ] **T31**. Test bench page and settings page (`general`); the test bench works on the existing
  `POST /tax-rates/resolve`, `/tax-regimes/resolve` and `/tax-rates/calculate` routes and shows the traces of
  `/tax/test-bench` once T21 lands. Files: `tax-ui/pages/test-bench/tax-test-bench-page.component.ts`,
  `tax-ui/pages/general/tax-settings-page.component.ts`. Test: rendering and form specs; the bench answers from the
  existing routes with no tax-engine table present.
- [ ] **T32**. Shared components `gauzy-tax-breakdown`, `gauzy-tax-regime-picker`; embed in the invoice form
  (`apps/gauzy/src/app/pages/invoices`) behind `FEATURE_TAX_DOCUMENTS`; live refresh. Files:
  `tax-ui/components/tax-breakdown/tax-breakdown.component.ts`,
  `tax-ui/components/tax-regime-picker/tax-regime-picker.component.ts`. Test: component specs; form unchanged with the
  flag off.
- [ ] **T33**. Pages: regime rules editor with conflict display, item overrides, charge rules, rate basis editor
  and supersede dialog. Files: `tax-ui/pages/regimes/tax-regime-rules-editor.component.ts`,
  `tax-ui/pages/item-overrides/tax-item-overrides-page.component.ts`, `tax-ui/pages/charges/tax-charge-rules-page.component.ts`,
  `tax-ui/pages/rates/tax-rate-basis-editor.component.ts`, `tax-ui/pages/rates/supersede-rate-dialog.component.ts`.
  Test: rendering specs.
- [ ] **T34**. Pages: tax accounts (both directions of the mapping), missing-mapping banner. Files:
  `tax-ui/pages/accounts/tax-accounts-page.component.ts`,
  `tax-ui/components/missing-mapping-banner/missing-mapping-banner.component.ts`. Test: rendering spec.
- [ ] **T35**. Pages: calendars, periods and pack viewer, register, reports entry points; return layouts open in the
  statement layout designer of `financial-reports`. Files: `tax-ui/pages/calendars/tax-calendars-page.component.ts`,
  `tax-ui/pages/periods/tax-periods-page.component.ts`, `tax-ui/pages/periods/tax-pack-viewer.component.ts`,
  `tax-ui/pages/register/tax-register-page.component.ts`. Test: rendering specs.
- [ ] **T36** (parallel). `packages/plugins/tax-react-ui`: `TaxBreakdown`, `TaxExplanation`. Files:
  `packages/plugins/tax-react-ui/src/lib/components/{TaxBreakdown,TaxExplanation}.tsx`. Test: rendering tests.
- [ ] **T37** (parallel). Breakdown fields exposed to print templates and to the portal document pages. Files:
  `tax/print/tax-breakdown.print-fields.ts`, `tax/portal/tax-breakdown.portal-panel.ts`. Test: template field spec.
- [ ] **T38**. Remaining document types on the tax stage, one PR per type with its owning plugin: estimates here;
  supplier bills, sales orders, purchase orders, point-of-sale sales and expense claims are T63 to T67. Files:
  `tax/tax-document/sources/estimate.tax-source.ts`, `packages/core/src/lib/invoice/invoice.service.ts`. Test: e2e for
  estimates (breakdown by rate; flag off unchanged).
- [ ] **T39**. Accessibility pass (keyboard, labels) on all pages. Files: `tax-ui/pages/` and `tax-ui/components/`
  (every component of T30 to T37). Test: axe checks in component specs.
- [ ] **T63**. Supplier bills on the tax stage: stated tax and tolerance on the bill form, determined
  tax through `TAX_CALCULATOR`, after `invoicing-receivables-payables` T9 and T18. Files: `tax/tax-document/sources/supplier-bill.tax-source.ts`,
  `packages/plugins/receivables-payables/src/lib/totals/invoice-totals.pipeline.ts`. Test: e2e per bill: breakdown by
  rate; stated tax within tolerance lands on the largest line.
- [ ] **T64**. Sales orders on the tax stage. Files: `tax/tax-document/sources/sales-order.tax-source.ts`,
  `packages/plugins/order/src/lib/order-totals/order-totals.service.ts`. Test: e2e order with a lump-sum rate; flag off
  unchanged.
- [ ] **T65**. Purchase orders on the tax stage. Files:
  `tax/tax-document/sources/purchase-order.tax-source.ts`,
  `packages/plugins/purchasing/src/lib/purchase-order/purchase-order.service.ts`. Test: e2e purchase order with a
  cost-only rate going to item cost, not to the total.
- [ ] **T66**. Point-of-sale sales on the tax stage, wired in the register sale service of
  `point-of-sale-and-loyalty` T12. Files: `tax/tax-document/sources/pos-sale.tax-source.ts`,
  `packages/plugins/point-of-sale/src/lib/sale/pos-sale.service.ts`. Test: e2e register sale with prices including tax
  totals the entered prices.
- [ ] **T67**. Expense claims on the tax stage, answering the tax service of `expenses-and-travel` T13.
  Files: `tax/tax-document/sources/expense-claim.tax-source.ts`,
  `packages/plugins/expense-claims/src/lib/tax/expense-claim-tax.service.ts`. Test: e2e claim line with a
  non-recoverable share.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T40** (parallel). MCP read tools in `packages/mcp-server/src/lib/tools/tax.ts`: `tax_determine` over the existing
  `/tax-rates/resolve`, `/tax-regimes/resolve` and `/tax-rates/calculate` routes (the traces of `/tax/test-bench` join
  once T21 lands). The read tools on the tax stage are T68. Test: tool schema specs; `tax_determine` answers with no
  tax-engine table present.
- [ ] **T41**. MCP write tools with preview: `tax_retax_drafts`. Files: `packages/mcp-server/src/lib/tools/tax.ts`.
  Test: preview writes nothing.
- [ ] **T42**. Import and export mappings for rates, regimes and overrides with `data-import-export` (return layouts
  travel with the layout export of `financial-reports`); pack file format and update-keeps-local-edits rule. Files:
  `tax/import-export/tax-import-export.mappings.ts`, `tax/import-export/tax-pack.format.ts`. Test: round-trip spec.
- [ ] **T43**. Worker registration (`apps/worker/src/plugins.ts`) of `tax.periods.sweep`; in-process fallback. Files:
  `tax/tax-period/tax-periods-sweep.scheduler.ts`, `tax/tax-schedule.plugin.ts`. Test: schedule plugin spec.
- [ ] **T44**. OpenAPI regenerated; SDK regeneration noted; user docs (docs site: tax settings, modes, breakdown);
  index row in `docs/specs/README.md`. Test: OpenAPI diff is additive; docs build.
- [ ] **T68**. MCP read tools on the tax stage: `tax_get_document_breakdown`, `tax_get_report`,
  `tax_get_return_layout`, `tax_period_status`, after T19, T26 and T27. Files: `packages/mcp-server/src/lib/tools/tax.ts`.
  Test: tool schema specs; answers equal the REST routes for the same user.

## Phase 5 — Withholding (`FEATURE_WITHHOLDING`)

- [ ] **T45**. Entities `tax/withholding/` (category, rate, assignment, certificate, entry, remittance, statement);
  migration `CreateWithholdingTables`. Files:
  `tax/withholding/entities/{withholding-category,withholding-rate,withholding-assignment,withholding-certificate,withholding-entry,withholding-remittance,withholding-statement}.entity.ts`,
  `tax/database/migrations/1791000078160-CreateWithholdingTables.ts`. Test: migration spec.
- [ ] **T46**. Withholding calculation (pure): thresholds (per document, cumulative, excess or whole base), bases,
  certificates with limit split, advance deduction, rounding. Files: `tax/withholding/calculation/withholding-calculator.ts`,
  `tax/withholding/calculation/thresholds.ts`. Test: table-driven and property specs.
- [ ] **T47**. `WithholdingService`: preview, consumers for bills, payments (`payments.allocation.created`),
  journals and document tax lines of negative rate parts (one entry each), entry states, reversal, force or waive,
  adjusting entries. Files: `tax/withholding/withholding.service.ts`, `tax/withholding/withholding.consumer.ts`. Test:
  consumer idempotency and state specs; a negative-part withholding has exactly one entry.
- [ ] **T48**. Controllers for masters, preview, entries, decisions. Files:
  `tax/withholding/withholding-masters.controller.ts`, `tax/withholding/withholding-entries.controller.ts`. Test: e2e
  permissions.
- [ ] **T49**. Customer-side withholding on receipts (amount, certificate received). Files:
  `tax/withholding/customer-withholding.service.ts`. Test: service spec.
- [ ] **T50**. UI pages (categories, certificates, entries) and `gauzy-withholding-preview` on bill and payment
  forms; reports "withholding details" and "withholding summary". Files:
  `tax-ui/pages/withholding/{categories,certificates,entries}/` (one page component each),
  `tax-ui/components/withholding-preview/withholding-preview.component.ts`, `tax/reports/tax-report.definitions.ts`.
  Test: rendering and dataset specs.
- [ ] **T51** (parallel). MCP tools `withholding_preview`, `withholding_list_entries`. Files:
  `packages/mcp-server/src/lib/tools/tax.ts`. Test: schema specs.

## Phase 6 — Advanced capabilities

- [ ] **T52**. Explanation: plain-language renderer per locale, `gauzy-tax-explanation` drawer, comparison view, MCP
  `tax_explain_document`. Files: `tax/explanation/tax-explanation.renderer.ts`,
  `tax-ui/components/tax-explanation/tax-explanation.component.ts`, `packages/mcp-server/src/lib/tools/tax.ts`. Test:
  renderer snapshot specs in two locales.
- [ ] **T53**. Registrations: offline structure checks per scheme (`tax/tax-registration/structure/`), verifier port,
  evidence history, re-check job, drafts flagged, inbox item, MCP `tax_check_registration`. Files:
  `tax/tax-registration/tax-registration-verify.service.ts`, `tax/tax-registration/registration-recheck.scheduler.ts`.
  Test: check-digit tables; fake verifier (valid, invalid, unavailable).
- [ ] **T54**. Cross-border threshold monitor and the "cross-border sales by destination" report. Files:
  `tax/monitors/cross-border-threshold.monitor.ts`, `tax/reports/tax-report.definitions.ts`. Test: dataset spec.
- [ ] **T55**. Simulation: core operation `TAX_SIMULATION`, `/tax-simulations`, UI, MCP `tax_simulate_change`,
  activation at a date. Files: `tax/tax-simulation/tax-simulation.service.ts`, `tax/tax-simulation/tax-simulation.controller.ts`,
  `tax/tax-simulation/tax-simulation.operation.ts`, `tax-ui/pages/simulations/tax-simulations-page.component.ts`,
  `packages/mcp-server/src/lib/tools/tax.ts`. Test: simulation leaves documents untouched.
- [ ] **T56**. Scheduled packs: preparation in `tax.periods.sweep` runs the calendar's report-builder schedule
  frozen (`TAX_PACK_SCHEDULES`, figures and hash on the schedule run), due reminders as `reminder` rows, pack
  viewer. Files: `tax/tax-period/tax-periods-sweep.scheduler.ts`, `tax/tax-period/tax-pack.service.ts`,
  `tax-ui/pages/periods/tax-pack-viewer.component.ts`. Test: late-entry and snapshot-immutability specs.
- [ ] **T57**. Tax review job writing findings to the finding store of `general-ledger` through `TAX_FINDINGS`, inbox
  item with proposed fixes, MCP `tax_list_anomalies`. Files: `tax/review/tax-review.service.ts`,
  `tax/review/tax-review.controller.ts`, `tax/review/tax-review.scheduler.ts`, `packages/mcp-server/src/lib/tools/tax.ts`.
  Test: seeded anomalies found.
- [ ] **T58**. Remittance and statements: `TAX_PAYMENT_GATEWAY` port, remittance with credits, statement numbering
  and PDF through a print template, MCP `withholding_create_remittance`. Files:
  `tax/withholding/withholding-remittance.service.ts`, `tax/withholding/withholding-statement.service.ts`,
  `tax/withholding/withholding-remittance.controller.ts`, `packages/mcp-server/src/lib/tools/tax.ts`. Test: preview and
  paid-state specs.
- [ ] **T59**. Provider port `TAX_PROVIDER` behind `FEATURE_TAX_PROVIDER` with timeout fallback. Files:
  `tax/provider/tax-provider.port.ts`, `tax/provider/tax-provider.adapter.ts`, `tax/tax-document/tax-document.service.ts`.
  Test: fallback spec.
- [ ] **T60**. Non-recoverable share on purchase rate parts end to end. Files: `tax/calculator/recoverable-share.ts`,
  `tax/posting/tax-posting.service.ts`. Test: posting amounts spec.
- [ ] **T61**. Defaults for existing tenants (spec FR-6, AC-15), `FEATURE_TAX_DOCUMENTS` and `FEATURE_WITHHOLDING`:
  the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it. Files: `tax/tax.features.ts`. Test: a
  tenant created before the change keeps both off and its invoices computed as today.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Scope, modes and compatibility | T19, T20, T38 |
| FR-2 | §3.1 Scope, modes and compatibility | T4, T16, T19 |
| FR-3 | §3.1 Scope, modes and compatibility | T16 |
| FR-4 | §3.1 Scope, modes and compatibility | T3, T16 |
| FR-5 | §3.1 Scope, modes and compatibility | T28 |
| FR-6 | §3.1 Scope, modes and compatibility | T5, T61 |
| FR-7 | §3.1 Scope, modes and compatibility | T5, T6 |
| FR-8 | §3.1 Scope, modes and compatibility | T17, T19 |
| FR-9–FR-11 | §3.2 Rates and calculation bases | T14 |
| FR-12 | §3.2 Rates and calculation bases | T14, T24 |
| FR-13 | §3.2 Rates and calculation bases | T60 |
| FR-14–FR-15 | §3.2 Rates and calculation bases | T22 |
| FR-16 | §3.2 Rates and calculation bases | T14, T17 |
| FR-17 | §3.2 Rates and calculation bases | T22, T42 |
| FR-18 | §3.3 Regimes, determination rules and item-level tax | T17, T18 |
| FR-19 | §3.3 Regimes, determination rules and item-level tax | T18, T33 |
| FR-20 | §3.3 Regimes, determination rules and item-level tax | T18, T23 |
| FR-21 | §3.3 Regimes, determination rules and item-level tax | T4, T17 |
| FR-22 | §3.3 Regimes, determination rules and item-level tax | T21 |
| FR-23 | §3.3 Regimes, determination rules and item-level tax | T7, T37 |
| FR-24 | §3.3 Regimes, determination rules and item-level tax | T17, T19 |
| FR-25–FR-26 | §3.3 Regimes, determination rules and item-level tax | T17, T18 |
| FR-27 | §3.3 Regimes, determination rules and item-level tax | T23, T33 |
| FR-28 | §3.3 Regimes, determination rules and item-level tax | T23 |
| FR-29 | §3.3 Regimes, determination rules and item-level tax | T17, T19 |
| FR-30 | §3.3 Regimes, determination rules and item-level tax | T28 |
| FR-31–FR-32 | §3.4 Prices including tax, distribution and rounding | T15 |
| FR-33 | §3.4 Prices including tax, distribution and rounding | T14, T15 |
| FR-34–FR-38 | §3.4 Prices including tax, distribution and rounding | T15 |
| FR-39–FR-40 | §3.5 Charges and tax on a document | T23 |
| FR-41 | §3.5 Charges and tax on a document | T23, T24 |
| FR-42 | §3.5 Charges and tax on a document | T9, T19 |
| FR-43 | §3.5 Charges and tax on a document | T21, T32, T37 |
| FR-44 | §3.5 Charges and tax on a document | T21 |
| FR-45 | §3.5 Charges and tax on a document | T21, T63 |
| FR-46–FR-47 | §3.5 Charges and tax on a document | T19 |
| FR-48 | §3.5 Charges and tax on a document | T15, T19 |
| FR-49 | §3.5 Charges and tax on a document | T7, T25 |
| FR-50 | §3.5 Charges and tax on a document | T62 |
| FR-51 | §3.5 Charges and tax on a document | T29, T32 |
| FR-52 | §3.6 Tax accounts | T24 |
| FR-53 | §3.6 Tax accounts | T24, T34 |
| FR-54 | §3.6 Tax accounts | T24 |
| FR-55 | §3.6 Tax accounts | T24, T34 |
| FR-56 | §3.6 Tax accounts | T25 |
| FR-57 | §3.7 Registrations, number checks and explanation | T10 |
| FR-58–FR-60 | §3.7 Registrations, number checks and explanation | T53 |
| FR-61 | §3.7 Registrations, number checks and explanation | T37, T54 |
| FR-62 | §3.7 Registrations, number checks and explanation | T17, T19 |
| FR-63 | §3.7 Registrations, number checks and explanation | T52 |
| FR-64 | §3.7 Registrations, number checks and explanation | T21, T31 |
| FR-65 | §3.7 Registrations, number checks and explanation | T21, T52 |
| FR-66 | §3.8 Withholding (`FEATURE_WITHHOLDING`) | T45, T48, T50 |
| FR-67 | §3.8 Withholding (`FEATURE_WITHHOLDING`) | T46 |
| FR-68 | §3.8 Withholding (`FEATURE_WITHHOLDING`) | T45, T47 |
| FR-69 | §3.8 Withholding (`FEATURE_WITHHOLDING`) | T47, T50, T51 |
| FR-70 | §3.8 Withholding (`FEATURE_WITHHOLDING`) | T45, T46, T50 |
| FR-71 | §3.8 Withholding (`FEATURE_WITHHOLDING`) | T45, T47 |
| FR-72 | §3.8 Withholding (`FEATURE_WITHHOLDING`) | T47 |
| FR-73 | §3.8 Withholding (`FEATURE_WITHHOLDING`) | T46 |
| FR-74 | §3.8 Withholding (`FEATURE_WITHHOLDING`) | T49 |
| FR-75 | §3.8 Withholding (`FEATURE_WITHHOLDING`) | T47, T58 |
| FR-76–FR-77 | §3.8 Withholding (`FEATURE_WITHHOLDING`) | T58 |
| FR-78 | §3.9 Tax register, periods and reports | T25 |
| FR-79 | §3.9 Tax register, periods and reports | T26, T35 |
| FR-80 | §3.9 Tax register, periods and reports | T25 |
| FR-81 | §3.9 Tax register, periods and reports | T27 |
| FR-82 | §3.9 Tax register, periods and reports | T26, T35 |
| FR-83 | §3.9 Tax register, periods and reports | T26 |
| FR-84 | §3.9 Tax register, periods and reports | T56 |
| FR-85 | §3.9 Tax register, periods and reports | T26 |
| FR-86 | §3.10 Simulation, agents and providers | T55 |
| FR-87 | §3.10 Simulation, agents and providers | T40, T41, T51, T68 |
| FR-88 | §3.10 Simulation, agents and providers | T57 |
| FR-89 | §3.10 Simulation, agents and providers | T29 |
| FR-90 | §3.10 Simulation, agents and providers | T59 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off; enabling it in dev shows the feature end to end.
- Constitution gates in `spec.md` §9 confirmed.
- Golden manual-mode invoices produce today's totals to the smallest currency unit.
- Calculator property tests pass (exact sums, deterministic results) and the register recount equals `tax_period_total`.
- Every report of spec §3.9 has a dataset spec; every MCP write tool has a "preview writes nothing" spec.
