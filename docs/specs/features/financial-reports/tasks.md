# Task Breakdown: Financial reports

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `financial-reports`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind `FEATURE_FINANCIAL_REPORTS`: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it.
  Paths are relative to the repository root; `fr/` means `packages/plugins/accounting/src/lib/financial-reports/`
  and `ui/` means `packages/plugins/accounting-ui/src/lib/financial-reports/`. Each entity file has its MikroORM
  repository beside it in `repository/` (as in `packages/plugins/purchasing/src/lib/purchase-order/repository/`);
  migrations go to `packages/plugins/accounting/src/lib/database/migrations/`.
- A seeded test ledger (`fr/testing/seed-ledger.ts`: three organizations, two currencies, one fiscal year, known
  totals) is built in T6 and used by every data-set spec.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts `packages/contracts/src/lib/financial-reports.model.ts` (report keys, options, result,
  drill-down, layouts with data sets, bucket schemes, consolidation, pack items, note anchors, card data, port shapes);
  export from `index.ts`. Test: compile spec; one key per report of the spec.
- [ ] **T2**. Feature code `FEATURE_FINANCIAL_REPORTS` (default off, depends on nothing; ledger reports check
  `FEATURE_ACCOUNTING` at run time), nine permission contributions with `defaultFor` and the organization settings
  (`accounting.settings.ts`) in the accounting plugin. Files: `packages/plugins/accounting/src/lib/accounting.features.ts`,
  `packages/plugins/accounting/src/lib/accounting.permissions.ts`, `packages/plugins/accounting/src/lib/accounting.settings.ts`.
  Test: contribution specs.
- [ ] **T3**. Entities and repositories (both ORMs) for layouts (with `datasetKey`, kind `TAX_RETURN`), versions,
  rows and bucket schemes: `fr/layouts/statement-layout.entity.ts`, `fr/layouts/statement-layout-version.entity.ts`,
  `fr/layouts/statement-layout-row.entity.ts`, `fr/ageing/ageing-bucket-scheme.entity.ts`; migration
  `1791000079100-CreateStatementLayoutTables.ts`. Test: migration spec on SQLite; uniqueness specs.
- [ ] **T4** (parallel). Entities for the six consolidation tables: `fr/consolidation/consolidation-group.entity.ts`,
  `consolidation-member.entity.ts`, `consolidation-account-map.entity.ts`, `elimination-rule.entity.ts`,
  `consolidation-run.entity.ts`, `consolidation-entry.entity.ts`, `intercompany-mismatch.entity.ts`; migration
  `1791000079110-CreateConsolidationTables.ts`. Test: migration spec.
- [ ] **T5** (parallel). Entity for note anchors `fr/notes/statement-note.entity.ts` and daily movement
  `fr/runtime/report-daily-movement.entity.ts`; migrations `1791000079120-CreateStatementNoteTable.ts`,
  `1791000079130-ExtendReportScheduleForPacks.ts` (event trigger and frozen figures on the report builder's
  `report_schedule` and `report_schedule_run`), `1791000079140-CreateReportDailyMovementTable.ts`. Test: migration spec.
- [ ] **T6**. Seeds: migration `1791000079150-SeedFinancialReportCatalogue.ts` (core `report_category` and `report`
  rows) and the category "Accounting" keyed `FEATURE_FINANCIAL_REPORTS` in the shared catalogue feature filter of
  `report-builder-and-dashboards` (listed only with the flag on; the filter guarded so that it is safe from any feature); role grants come from the `defaultFor` contributions of T2; the test ledger
  `fr/testing/seed-ledger.ts`. Files also: `fr/runtime/financial-reports-seed.service.ts` (shipped layouts and the
  default bucket scheme per organization on first enable). Test: seed spec and role-grant resolution spec; with the
  flag off the catalogue and the report menu answer exactly as before the seed; with it on the "Accounting" rows appear.

## Phase 2 — Services, endpoints, events

- [ ] **T7**. Run service and controller `fr/runtime/report-run.service.ts`, `fr/runtime/financial-reports.controller.ts`:
  catalogue, `POST /financial-reports/:key/run` (result with computed-at and the last posting included), time budget
  handing over to a report-builder background run (`report_run` mode `BACKGROUND`) with its inbox notice, permission
  per group, availability when a port is unbound; the service only reads. Test: e2e for permissions, 202 path,
  unavailable report; no write reaches a ledger, document or member table during a run.
- [ ] **T8**. Registration with the report builder `fr/definitions/financial-report-definitions.ts` (computed data-set
  providers, filters, default columns, groupings; export, print and email schedule as any definition). Test: registry
  spec (every key registered once).
- [ ] **T9**. Document ports and adapters for today's core invoices, bills and payments
  (`fr/adapters/core-invoice.adapter.ts`), bound in `apps/api/src/plugin-composition.ts`. Test: composition spec.
- [ ] **T10**. Document lists: sales invoices and supplier bills with dynamic tax columns, lines per item. Files:
  `fr/registers/invoice-register.dataset.ts`, `fr/registers/bill-register.dataset.ts`,
  `fr/registers/document-lines.dataset.ts`. Test: data-set specs with accounting on and off.
- [ ] **T11** (parallel). Invoiced amounts per period, items without recent sales, receipts per payment method, mismatched discounts. Files:
  `fr/registers/invoiced-per-period.dataset.ts`, `fr/registers/items-without-sales.dataset.ts`,
  `fr/registers/receipts-by-method.dataset.ts`, `fr/registers/mismatched-discounts.dataset.ts`. Test: data-set specs.
- [ ] **T12** (parallel). Open billing lists through `REPORT_DOCUMENT_FLOW`; commission statement through
  `REPORT_COMMISSIONS`. Files: `fr/registers/open-billing.dataset.ts`, `fr/registers/commission-statement.dataset.ts`,
  `fr/ports/report-ports.ts`. Test: data-set specs with fake ports.
- [ ] **T13**. Shared ledger options `fr/ledger/options.ts`: filters, books, comparison columns, closing-journal
  handling, presentation currency with missing-rate error, hide zero rows and show reversed entries. Test: option
  and translation specs.
- [ ] **T14**. General ledger, daily journal, account balances. Files: `fr/ledger/general-ledger.dataset.ts`,
  `fr/ledger/daily-journal.dataset.ts`, `fr/ledger/account-balances.dataset.ts`. Test: data-set specs (running balance,
  groupings).
- [ ] **T15**. Trial balance, current-year trial balance, balances per party, open items with settlements (read from the
  open-item register through `REPORT_OPEN_ITEMS`). Files: `fr/ledger/trial-balance.dataset.ts`,
  `fr/ledger/current-year-trial-balance.dataset.ts`, `fr/ledger/party-balances.dataset.ts`,
  `fr/ledger/open-items.dataset.ts`. Test: proof property (debits equal credits) on random ledgers.
- [ ] **T16** (parallel). Integrity lists: journals that do not balance, control accounts against open items, postings without a valid source. Files:
  `fr/integrity/unbalanced-journals.dataset.ts`, `fr/integrity/control-accounts.dataset.ts`,
  `fr/integrity/postings-without-source.dataset.ts`. Test: seeded defects found.
- [ ] **T17**. Layout evaluator (pure) `fr/layouts/evaluator/`: data-set registry (`ledger.balances` here,
  `REPORT_LAYOUT_DATASETS` for others), selectors read by the data set, balance bases and measures, formula parser,
  order and cycle check, sign and hide rules, shares; the layout service answering `TAX_RETURN_LAYOUTS`. Files:
  `fr/layouts/evaluator/layout-evaluator.ts`, `fr/layouts/evaluator/formula-parser.ts`,
  `fr/layouts/evaluator/layout-dataset.registry.ts`, `fr/layouts/statement-layout.service.ts`. Test: unit
  and property specs; a fake register data set evaluates a return layout.
- [ ] **T18**. Shipped layouts (balance sheet and profit and loss, vertical and side by side; cash flow; ratios)
  and their per-organization seed on first enable. Files: `fr/layouts/shipped/balance-sheet.layout.json`,
  `fr/layouts/shipped/profit-and-loss.layout.json`, `fr/layouts/shipped/cash-flow.layout.json`,
  `fr/layouts/shipped/ratios.layout.json`, `fr/runtime/financial-reports-seed.service.ts`. Test: completeness of each
  shipped layout on the shipped chart.
- [ ] **T19**. Balance sheet and profit and loss providers (provisional result line, check line, views, dimension
  split, account detail). Files: `fr/statements/balance-sheet.dataset.ts`, `fr/statements/profit-and-loss.dataset.ts`,
  `fr/statements/statement-views.ts`. Test: identity specs (assets equal liabilities plus equity; result equals
  provisional); a layout runs with every option of §3.1.
- [ ] **T20**. Cash flow, indirect and direct, with reconciliation to cash and bank accounts. Files:
  `fr/statements/cash-flow.dataset.ts`. Test: identity spec.
- [ ] **T21** (parallel). Profit per period, ratios, profitability by dimension, balances by dimension, budget against actual
  (`REPORT_BUDGET_FIGURES`). Files: `fr/analysis/profit-per-period.dataset.ts`, `fr/analysis/ratios.dataset.ts`,
  `fr/analysis/profitability-by-dimension.dataset.ts`, `fr/analysis/balances-by-dimension.dataset.ts`,
  `fr/analysis/budget-vs-actual.dataset.ts`. Test: data-set specs.
- [ ] **T22**. Ageing engine `fr/ageing/` over the open-item register: as-on reconstruction, bucket schemes applied at
  read time, bases, per instalment, later payments column, filters; receivable and payable ageing and summaries;
  bucket scheme routes `/ageing-bucket-schemes`. Files: `fr/ageing/ageing-engine.ts`, `fr/ageing/ageing.dataset.ts`,
  `fr/ageing/ageing-bucket-scheme.service.ts`, `fr/ageing/ageing-bucket-scheme.controller.ts`. Test: totals equal
  control accounts on the as-on date and the register's band totals for the default scheme.
- [ ] **T23** (parallel). Balance movements per party, days to payment. Files: `fr/ageing/party-movements.dataset.ts`,
  `fr/ageing/days-to-payment.dataset.ts`. Test: data-set specs.
- [ ] **T24**. Layout management API: CRUD, clone, versions, publish with completeness check, preview, export and
  import, defaults. Files: `fr/layouts/statement-layout.controller.ts`, `fr/layouts/statement-layout.service.ts`,
  `fr/layouts/layout-completeness.service.ts`, `fr/layouts/layout-file.schema.ts`, `fr/layouts/dto/`. Test: e2e;
  incomplete layout refused; an exported layout imports unchanged.
- [ ] **T25**. Consolidation setup API and engine (pure) `fr/consolidation/engine/`: member trial balances,
  group mapping, translation by the rate rule, proportional method. Files:
  `fr/consolidation/consolidation-group.controller.ts`, `fr/consolidation/consolidation-group.service.ts`,
  `fr/consolidation/engine/consolidation-engine.ts`, `fr/consolidation/engine/translation.ts`. Test: fixture group of
  three organizations; the cumulative translation difference lands on its equity line.
- [ ] **T26**. Consolidated trial balance and statements, consolidated ageing, runs with versions, adjustments,
  finalise guard. Files: `fr/consolidation/consolidation-run.controller.ts`,
  `fr/consolidation/consolidation-run.service.ts`, `fr/consolidation/consolidation.operation.ts`,
  `fr/consolidation/consolidated-statements.dataset.ts`, `fr/consolidation/consolidated-ageing.dataset.ts`. Test: e2e;
  member ledgers unchanged.
- [ ] **T27**. Gross profit with stock cost through `REPORT_STOCK_COST`. Files: `fr/registers/gross-profit.dataset.ts`.
  Test: data-set spec with a fake port.
- [ ] **T28**. Daily roll-up consumer `subscriber:financial-report-rollup`, nightly verification and rebuild, purge
  job. Files: `fr/runtime/daily-rollup.consumer.ts`, `fr/runtime/rollup-verify.job.ts`. Test: double-delivery spec;
  drift detection spec.
- [ ] **T29**. Print templates for the reports of spec FR-75 and the two party statement forms (FR-76). Files:
  `fr/print/financial-report.print-templates.ts`, `fr/print/party-statement.print-templates.ts`. Test:
  rendering snapshot per template.

## Phase 3 — UI surfaces

- [ ] **T30**. `packages/plugins/accounting-ui` module `financial-reports`: catalogue page registered through the
  `accounting-sections` page location, menu gating, redirect guard on the stub route `/pages/reports/accounting`
  (pattern of `feature-documents-redirect.guard.ts`); i18n keys in every locale. Files: `ui/financial-reports.routes.ts`,
  `ui/report-catalogue.component.ts`, `apps/gauzy/src/app/pages/financial-reports-redirect.guard.ts`,
  `apps/gauzy/src/app/pages/pages.routes.ts`, `packages/ui-core/i18n/assets/i18n/*.json`. Test: rendering specs; the
  stub behaves as today with the flag off and redirects with it on.
- [ ] **T31**. Report viewer: grid with expand and collapse, period and comparison columns, views, dimension
  split, options panel, background-run state, export through the builder. Files: `ui/report-viewer/report-viewer.component.ts`,
  `ui/report-viewer/report-grid.component.ts`, `ui/report-viewer/report-options.component.ts`,
  `ui/financial-reports-api.service.ts`. Test: component specs.
- [ ] **T32**. Ledger and line-level viewers (general ledger, registers) with cursor paging and saved views.
  Files: `ui/report-viewer/line-report-viewer.component.ts`. Test: component specs.
- [ ] **T33**. Ageing pages with bucket scheme picker and scheme settings. Files: `ui/ageing/ageing-report.component.ts`,
  `ui/ageing/ageing-schemes.component.ts`. Test: rendering specs.
- [ ] **T34**. Layout list and form-based row editor (before the visual designer). Files:
  `ui/layouts/layout-list.component.ts`, `ui/layouts/layout-row-editor.component.ts`. Test: rendering specs.
- [ ] **T35**. Consolidation pages: groups, members, mapping, runs. Files: `ui/consolidation/consolidation-groups.component.ts`,
  `ui/consolidation/consolidation-group-detail.component.ts`, `ui/consolidation/consolidation-runs.component.ts`. Test:
  rendering specs.
- [ ] **T36**. Finance cards `provideFinanceDashboardWidgets()` in `packages/ui-core/shared/src/lib/dashboard/widgets/finance`,
  seeded "Finance" dashboard, source switch on `apps/gauzy/src/app/pages/dashboard/accounting`. Files:
  `packages/ui-core/shared/src/lib/dashboard/widgets/finance/finance.widgets.ts`,
  `packages/ui-core/shared/src/lib/dashboard/widgets/index.ts`,
  `apps/gauzy/src/app/pages/dashboard/accounting/accounting.component.ts`, `fr/cards/finance-card.controller.ts`.
  Test: card specs; existing `accounting.*` widgets unchanged.
- [ ] **T37** (parallel). Card behaviour of the `finance.*` Angular widgets of T36: dashboard filters honoured, a click
  opens the report with the same options, document-based cards available without accounting; no separate React
  package. Files: `packages/ui-core/shared/src/lib/dashboard/widgets/finance/finance-card.component.ts`. Test:
  rendering tests.
- [ ] **T38**. Accessibility pass: grid keyboard model, row and column headers, announcements. Files:
  `ui/report-viewer/report-grid.component.ts`, `ui/report-viewer/report-grid.component.html`. Test: axe checks.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T39**. MCP read tools `packages/mcp-server/src/lib/tools/financial-reports.ts`: `finance_list_reports`,
  `finance_run_report`, `finance_get_statement`, `finance_get_trial_balance`, `finance_get_ledger`,
  `finance_get_ageing`, `finance_get_consolidated_statement`. Test: schema specs.
- [ ] **T40**. Worker registration of the sweeps in the accounting schedule plugin (`apps/worker/src/plugins.ts`);
  in-process fallback. Test: worker plugin spec.
- [ ] **T41**. OpenAPI regenerated; SDK regeneration noted; user docs (docs site: statements, layouts, ageing,
  registers); index row in `docs/specs/README.md`. Test: OpenAPI diff is additive; docs build.

## Phase 5 — Advanced capabilities

- [ ] **T42**. Drill-down: drill keys on every cell, `POST /financial-reports/:key/drill`, side panel, documents and
  time entries through `REPORT_TRACKED_TIME_COST`; MCP `finance_drill_down`. Files: `fr/runtime/drill.service.ts`,
  `fr/runtime/financial-reports.controller.ts`, `ui/report-viewer/drill-panel.component.ts`,
  `packages/mcp-server/src/lib/tools/financial-reports.ts`. Test: drill totals equal the cell.
- [ ] **T43**. Labour cost from tracked time in gross profit; revenue per tracked hour measure; people-margin
  cards. Files: `fr/registers/gross-profit.dataset.ts`, `fr/analysis/people-margin.dataset.ts`,
  `packages/ui-core/shared/src/lib/dashboard/widgets/finance/finance.widgets.ts`. Test: data-set spec on seeded time
  entries.
- [ ] **T44**. Live figures: hint publisher (coalesced), viewer and card refetch of affected cells, highlight,
  freeze, reconnect reload. Files: `fr/live/figures-changed.publisher.ts`, `ui/report-viewer/live-figures.service.ts`,
  `ui/report-viewer/report-viewer.component.ts`. Test: two-session e2e; lag metric spec.
- [ ] **T45**. "With drafts" column through `REPORT_EFFECTS_PREVIEW`. Files: `fr/statements/with-drafts.column.ts`,
  `fr/ports/report-ports.ts`. Test: nothing posted; column equals preview sum.
- [ ] **T46**. Visual designer: drag and drop rows, account picker with balances, formula completion, live
  preview, completeness panel, notice on new ledger accounts. Files: `ui/layouts/layout-designer.component.ts`,
  `ui/layouts/formula-editor.component.ts`, `ui/layouts/completeness-panel.component.ts`,
  `fr/layouts/new-account-notice.consumer.ts`. Test: component specs; notice consumer spec.
- [ ] **T47**. Eliminations: rules, detection of inter-company postings, elimination entries with sources, stock
  margin rule. Files: `fr/consolidation/engine/eliminations.ts`, `fr/consolidation/elimination-rule.service.ts`. Test:
  fixture group; each elimination traces to postings.
- [ ] **T48**. Mismatches and non-controlling interest; difference carried to a consolidation-only line. Files:
  `fr/consolidation/engine/mismatches.ts`, `fr/consolidation/engine/non-controlling-interest.ts`. Test:
  fixture with one seeded mismatch and an 80 % member.
- [ ] **T49**. Report packs as report-builder schedules with several items: period-close consumer starting schedules
  with that trigger, frozen run with figures and fingerprint on `report_schedule_run`, approval through the builder's
  review state, delivery by the builder, compare with current (`/financial-reports/pack-runs/:runId/compare`); MCP
  `finance_run_report_pack`. Files: `fr/packs/report-packs.consumer.ts`, `fr/packs/pack-freeze.service.ts`,
  `fr/packs/pack-compare.controller.ts`, `ui/packs/pack-compare.component.ts`,
  `packages/mcp-server/src/lib/tools/financial-reports.ts`. Test: frozen run unchanged after later postings; preview
  writes nothing.
- [ ] **T50**. Notes on statement lines: anchors with core `comment` threads (replies, mentions, resolve), inclusion
  in packs; MCP `finance_add_note`. Files: `fr/notes/statement-note.service.ts`, `fr/notes/statement-note.controller.ts`,
  `ui/report-viewer/statement-notes.component.ts`, `packages/mcp-server/src/lib/tools/financial-reports.ts`; core
  comments through `packages/core/src/lib/comment/comment.entity.ts`. Test: e2e.
- [ ] **T51**. Explanations: driver analysis (accounts, parties, documents, dimensions, price and volume), worker,
  wording through the AI provider port, opt-in setting, MCP `finance_explain_variance`. Files:
  `fr/explain/driver-analysis.ts`, `fr/explain/explain.worker.ts`, `fr/explain/explain.controller.ts`,
  `packages/mcp-server/src/lib/tools/financial-reports.ts`. Test: driver analysis on the seeded variance; unavailable
  without a provider.
- [ ] **T52**. Hints for unusual movements. Files: `fr/explain/unusual-movement.hints.ts`. Test: seeded outlier flagged.
- [ ] **T53**. Amounts falling due ahead with expected cash per week. Files: `fr/ageing/falling-due.dataset.ts`. Test:
  data-set spec.
- [ ] **T54**. `finance_find_report` (question to report key and options) and command palette entry. Files:
  `fr/runtime/report-finder.service.ts`, `packages/mcp-server/src/lib/tools/financial-reports.ts`,
  `ui/report-finder.command.ts`. Test: mapping spec on a fixed set of questions.
- [ ] **T55**. Provide the ports other features bind to (plan, **Consumer tokens answered**): `AGEING_BUCKET_SCHEME`. Files: `apps/api/src/plugin-composition.ts`. Test: one contract test per token over the shape its consumer plan states; with this feature off each consumer keeps its stated fallback.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Behaviour shared by all reports | T6, T8 |
| FR-2 | §3.1 Behaviour shared by all reports | T13 |
| FR-3 | §3.1 Behaviour shared by all reports | T13 |
| FR-4 | §3.1 Behaviour shared by all reports | T13, T21 |
| FR-5 | §3.1 Behaviour shared by all reports | T13 |
| FR-6 | §3.1 Behaviour shared by all reports | T7, T13 |
| FR-7 | §3.1 Behaviour shared by all reports | T42 |
| FR-8 | §3.1 Behaviour shared by all reports | T7, T28 |
| FR-9 | §3.1 Behaviour shared by all reports | T44 |
| FR-10 | §3.1 Behaviour shared by all reports | T45 |
| FR-11 | §3.1 Behaviour shared by all reports | T7 |
| FR-12 | §3.1 Behaviour shared by all reports | T8, T29, T31 |
| FR-13–FR-14 | §3.2 Ledger reports | T14 |
| FR-15 | §3.2 Ledger reports | T14 |
| FR-16–FR-17 | §3.2 Ledger reports | T15 |
| FR-18 | §3.2 Ledger reports | T15 |
| FR-19 | §3.2 Ledger reports | T15 |
| FR-20 | §3.2 Ledger reports | T16 |
| FR-21 | §3.2 Ledger reports | T16 |
| FR-22 | §3.2 Ledger reports | T16 |
| FR-23 | §3.2 Ledger reports | T11 |
| FR-24–FR-25 | §3.3 Statements and analysis | T19 |
| FR-26 | §3.3 Statements and analysis | T20 |
| FR-27 | §3.3 Statements and analysis | T19 |
| FR-28 | §3.3 Statements and analysis | T19, T31 |
| FR-29 | §3.3 Statements and analysis | T21 |
| FR-30–FR-31 | §3.3 Statements and analysis | T21 |
| FR-32 | §3.3 Statements and analysis | T21 |
| FR-33 | §3.3 Statements and analysis | T21 |
| FR-34 | §3.4 Statement layouts and designer | T3, T24, T34 |
| FR-35 | §3.4 Statement layouts and designer | T17, T34 |
| FR-36 | §3.4 Statement layouts and designer | T17, T18 |
| FR-37 | §3.4 Statement layouts and designer | T19, T24 |
| FR-38 | §3.4 Statement layouts and designer | T3, T24, T34 |
| FR-39 | §3.4 Statement layouts and designer | T24, T34 |
| FR-40 | §3.4 Statement layouts and designer | T46 |
| FR-41 | §3.4 Statement layouts and designer | T24, T46 |
| FR-42 | §3.5 Consolidation | T25, T35 |
| FR-43 | §3.5 Consolidation | T26, T35 |
| FR-44 | §3.5 Consolidation | T26 |
| FR-45 | §3.5 Consolidation | T25, T26 |
| FR-46 | §3.5 Consolidation | T47 |
| FR-47–FR-48 | §3.5 Consolidation | T48 |
| FR-49 | §3.5 Consolidation | T26 |
| FR-50 | §3.5 Consolidation | T22, T26 |
| FR-51–FR-52 | §3.6 Receivables and payables | T22 |
| FR-53 | §3.6 Receivables and payables | T22, T33 |
| FR-54–FR-56 | §3.6 Receivables and payables | T22 |
| FR-57 | §3.6 Receivables and payables | T23 |
| FR-58 | §3.6 Receivables and payables | T23 |
| FR-59 | §3.6 Receivables and payables | T53 |
| FR-60 | §3.7 Registers, trends and margin | T10 |
| FR-61–FR-62 | §3.7 Registers, trends and margin | T10 |
| FR-63 | §3.7 Registers, trends and margin | T11 |
| FR-64 | §3.7 Registers, trends and margin | T27 |
| FR-65 | §3.7 Registers, trends and margin | T43 |
| FR-66 | §3.7 Registers, trends and margin | T12 |
| FR-67 | §3.7 Registers, trends and margin | T11 |
| FR-68 | §3.7 Registers, trends and margin | T12 |
| FR-69 | §3.7 Registers, trends and margin | T11 |
| FR-70 | §3.7 Registers, trends and margin | T9, T10, T11 |
| FR-71–FR-72 | §3.8 Dashboards, printable statements and packs | T36 |
| FR-73 | §3.8 Dashboards, printable statements and packs | T36, T37 |
| FR-74 | §3.8 Dashboards, printable statements and packs | T43 |
| FR-75–FR-76 | §3.8 Dashboards, printable statements and packs | T29 |
| FR-77–FR-78 | §3.8 Dashboards, printable statements and packs | T49 |
| FR-79 | §3.9 Explanations, notes, agents and compatibility | T51 |
| FR-80 | §3.9 Explanations, notes, agents and compatibility | T50 |
| FR-81 | §3.9 Explanations, notes, agents and compatibility | T52 |
| FR-82 | §3.9 Explanations, notes, agents and compatibility | T39, T42, T49, T50, T51, T54 |
| FR-83 | §3.9 Explanations, notes, agents and compatibility | T2, T6, T30 |
| FR-84 | §3.9 Explanations, notes, agents and compatibility | T7, T26 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off; enabling it in dev shows the feature end to end.
- Constitution gates in `spec.md` §9 confirmed.
- Statement identities hold on the seeded ledger and on random ledgers: trial balance proof, balance sheet check,
  result equality, cash flow reconciliation, ageing equal to control accounts.
- Every report key has a data-set spec; registers pass with accounting on and off.
- A statement on a ten-million-posting data set meets the 2 s target in the performance job.
- The existing accounting dashboard, widgets, reports and saved reports behave as before with the flag off.
