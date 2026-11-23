# Task Breakdown: Stock ledger and valuation

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `stock-ledger-and-valuation`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind the feature flag: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it.
- Paths are relative to the repository root; `iv/` means `packages/plugins/inventory-valuation/src/lib/`, `ivui/`
  means `packages/plugins/inventory-valuation-ui/src/lib/` and `inv/` means `packages/plugins/inventory/src/lib/`.
  Entity folders follow the inventory plugin's layout (`<name>.entity.ts`, `<name>.service.ts`, `<name>.controller.ts`,
  `dto/`, `repository/type-orm-<name>.repository.ts`, `repository/mikro-orm-<name>.repository.ts`), each service with a
  `.spec.ts` beside it.
- Starts after `warehouse-and-stock-movements` T9 (the inventory ports `STOCK_MOVEMENT_HOOKS`, `STOCK_NEGATIVE_POLICY`,
  `STOCK_PERIOD_GUARD`, `STOCK_VALUE_PREVIEW`) has landed; T18 also needs its T16 (`allocateCharges` in
  `inv/stock-document/cost-allocation.ts`).

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts `packages/contracts/src/lib/stock-valuation.model.ts`, `landed-cost.model.ts`,
  `stock-closing.model.ts`, `stock-integrity.model.ts`, `cycle-count.model.ts`; operation type names; exports in
  `packages/contracts/src/index.ts`. Test: contracts build.
- [ ] **T2**. Plugin scaffold `packages/plugins/inventory-valuation` (`package.json`, `project.json`, `tsconfig.json`,
  `jest.config.ts`, `eslint.config.cjs`), `iv/inventory-valuation.plugin.ts` (`dependsOn` inventory),
  `iv/inventory-valuation.module.ts`, `iv/inventory-valuation.features.ts` (`FEATURE_INVENTORY_VALUATION`, default off,
  depends on `FEATURE_INVENTORY`), path mapping in `tsconfig.base.json`, registration in `apps/api/src/plugins.ts` and
  the worker's plugin list `apps/worker/src/plugins.ts`. Test: plugin metadata spec.
- [ ] **T3**. Entities and MikroORM repositories for layers, consumption, key (value, unit cost and `recalculateFrom`;
  no quantity), policy, standard cost: `iv/stock-valuation-layer/stock-valuation-layer.entity.ts`,
  `iv/stock-layer-consumption/stock-layer-consumption.entity.ts`, `iv/stock-valuation-key/stock-valuation-key.entity.ts`,
  `iv/stock-valuation-policy/stock-valuation-policy.entity.ts`, `iv/stock-standard-cost/stock-standard-cost.entity.ts`
  with their `repository/` files; migration `iv/database/migrations/1791000086100-CreateValuationLayerTables.ts` with
  append-only triggers per dialect, registered in `iv/database/migrations/index.ts`. Test: SQLite migration spec;
  trigger spec (update refused). Migration timestamps: `1791000086100` to `1791000086199` (`packages/plugins/inventory-valuation`).
- [ ] **T4** (parallel). Migrations and entities `iv/database/migrations/1791000086110-CreateLandedCostTables.ts`
  (`iv/landed-cost/landed-cost-document.entity.ts`, `landed-cost-target.entity.ts`, `landed-cost-charge.entity.ts`,
  `landed-cost-allocation.entity.ts`), `iv/database/migrations/1791000086120-CreateStockClosingTables.ts`
  (`iv/stock-closing/stock-closing.entity.ts`, `stock-closing-balance.entity.ts`,
  `iv/stock-value-reset/stock-value-reset.entity.ts`),
  `iv/database/migrations/1791000086130-CreateStockIntegrityAndCountPlanTables.ts`
  (`iv/stock-integrity/stock-integrity-finding.entity.ts`, `iv/cycle-count/cycle-count-plan.entity.ts`,
  `cycle-count-class.entity.ts`). Test: SQLite migration specs.
- [ ] **T5** (parallel). Inventory migrations `inv/database/migrations/1791000086200-AddStockMovementDimensionSet.ts`
  (`stock_movement.dimensionSetId` on `inv/stock-movement/stock-movement.entity.ts`),
  `inv/database/migrations/1791000086210-ExtendStockCountForValuation.ts` (`inv/stock-count/stock-count.entity.ts`,
  `inv/stock-count-line/stock-count-line.entity.ts`), both listed in `inv/database/migrations/index.ts`; optional
  `valuation` and `dimensionSetId` on `IStockMovementInput` in `inv/stock-level/stock-level.types.ts`; purchasing passes
  the receipt line cost (`packages/plugins/purchasing/src/lib/goods-receipt/goods-receipt.service.ts`). Test: SQLite
  migration specs; purchasing spec. Migration timestamps: `1791000086200` to `1791000086299`
  (`packages/plugins/inventory`).
- [ ] **T6**. Permissions as contributions with `defaultFor` in `iv/inventory-valuation.permissions.ts` (no seed
  migration), settings `iv/inventory-valuation.settings.ts`. Test: catalogue spec with default roles.

## Phase 2 — Services, endpoints, events

- [ ] **T7**. Pure costing engine `iv/engine/` (`fifo.ts`, `moving-average.ts`, `standard-cost.ts`, `lifo.ts`,
  `rounding.ts`, `cost-source.ts`). Test: property-based specs (sum of consumed = outflow; key value = sum of layers).
- [ ] **T8**. `ValuationMovementHook` bound to `STOCK_MOVEMENT_HOOKS`: layer, consumption and key value update in the
  movement transaction, the key quantity read from the movement's `quantityAfter` (item and location keys), the
  organization's level rows (organization keys) or the lot and serial bundle entries; `eventOnly` movements skipped;
  cost sources per movement kind; backdated detection sets `recalculateFrom`; answers as unbound for tenants with the
  feature off. Files: `iv/hooks/valuation-movement.hook.ts`, `iv/stock-valuation-key/stock-valuation-key.service.ts`,
  binding in `apps/api/src/plugin-composition.ts`. Test: SQLite spec through `applyMovement` for receipt, issue,
  transfer, return, sale, count, event-only damage; a flag-off tenant gets no layer.
- [ ] **T9**. Policies and settings service: effective method and key scope (item → group → organization), negative
  rule resolution, `STOCK_NEGATIVE_POLICY` binding (answering as unbound for tenants with the feature off; unlimited
  and backorder levels exempt as today), backdated negative accepted unless `refuseBackdatedNegative` is on, negative
  valuation and settlement, refusals naming item, location, date, needed and available quantity and their cause.
  Files: `iv/stock-valuation-policy/stock-valuation-policy.service.ts`,
  `iv/stock-valuation-policy/stock-valuation-policy.controller.ts`, `iv/settings/valuation-settings.service.ts`,
  `iv/settings/valuation-settings.controller.ts`, `iv/hooks/valuation-negative.policy.ts`. Test: resolution spec;
  negative settle spec; flag-off tenant refuses and accepts exactly what the unbound inventory does.
- [ ] **T10**. Standard costs and dated method changes with revaluation layers; daily apply job writing the effective
  standard to `product_variant_price.unitCost`. Files: `iv/stock-standard-cost/stock-standard-cost.service.ts`,
  `iv/stock-standard-cost/stock-standard-cost.controller.ts`, `iv/method-change/method-change.service.ts`,
  `iv/schedule/standard-cost-apply.scheduler.ts`. Test: service spec (cost price equals the effective standard).
- [ ] **T11**. Recalculation as the core operation type `STOCK_VALUATION_RECALCULATE` (aggregate = key hash): per-key
  replay from `recalculateFrom`, correction layers, merge by lowering `recalculateFrom`, concurrency limit, quiet
  window, retry and failure notice, carried-forward corrections; `/stock-valuation/recalculations` as views over the
  operations. Files: `iv/recalculation/stock-valuation-recalculate.operation.ts`,
  `iv/recalculation/recalculation.controller.ts`. Test: SQLite spec (backdated receipt, cancelled inflow, merge,
  failure after three attempts).
- [ ] **T12**. Period guard bound to `STOCK_PERIOD_GUARD`: closings, freeze date and rolling days, override
  permission, accounting period lock read through the accounting port. Files: `iv/period/valuation-period.guard.ts`.
  Test: guard spec.
- [ ] **T13**. Stock closing as the core operation `STOCK_CLOSING`: snapshot, chaining, pending-recalculation refusal,
  reopen, ledger agreement check. Files: `iv/stock-closing/stock-closing.operation.ts`,
  `iv/stock-closing/stock-closing.service.ts`, `iv/stock-closing/stock-closing.controller.ts`. Test: SQLite spec
  (balance report equal from snapshot and from replay).
- [ ] **T14**. Counts depth in `inv/stock-count/` (`stock-count.service.ts`, `stock-count.controller.ts`): purposes
  count and opening; the existing `StockCountLineService.unitCostsOf` (`inv/stock-count-line/stock-count-line.service.ts`)
  asks `STOCK_VALUE_PREVIEW` for the key cost when bound, so `stock_count.varianceValue` and the line values agree;
  reserved check (backorder and unlimited levels exempt, as today), tolerance (none by default) and recount, import,
  sheet. Test: count service specs (header equals the sum of lines, bound and unbound; a count without tolerance
  closes as today).
- [ ] **T15**. Value resets from the valuation comparison; later-dated refusal. Files:
  `iv/stock-value-reset/stock-value-reset.service.ts`, `iv/stock-value-reset/stock-value-reset.controller.ts`. Test:
  service spec.
- [ ] **T16**. Posting facts: outbox events `valuation.document.valued` / `.reversed` / `valuation.key.corrected`
  per document version; contributed posting rules and account roles registered with `accounting`; repost route.
  Files: `iv/postings/valuation-posting.events.ts`, `iv/postings/valuation-posting-rules.ts`,
  `iv/postings/repost.controller.ts`. Test: event spec; journals balance spec with the accounting test harness.
- [ ] **T17**. Perpetual switch-on journal and feature switch-on opening layers (`/stock-valuation/enable`) with
  preview and the cost sources `VARIANT_COST_PRICE`, `PRICING_COST`, `LAST_RECEIPT`, `ZERO`. Files:
  `iv/enable/valuation-enable.service.ts`, `iv/enable/valuation-enable.controller.ts`. Test: SQLite spec per source.
- [ ] **T18**. Landed cost documents: targets, charges from bill lines (once), bases through `allocateCharges` of
  `@gauzy/plugin-inventory`, layers at receipt time, consumed-share corrections, cancel; the consumer turning a
  confirmed stock document's additional costs into a landed cost linked to it. Files:
  `iv/landed-cost/landed-cost.service.ts`, `iv/landed-cost/landed-cost.controller.ts`,
  `iv/landed-cost/landed-cost-additional-costs.consumer.ts`. Test: allocation spec; SQLite end-to-end (document with
  freight).
- [ ] **T19** (parallel). Bill price difference consumer and valuation taxes spread on purchase documents through the
  tax engine's category flags. Files: `iv/landed-cost/bill-price-difference.consumer.ts`,
  `iv/landed-cost/valuation-tax-spread.ts`. Test: spread spec (remainder on last line; no stock lines).
- [ ] **T20**. Stock dimensions on accounting's analytic dimension sets: `STOCK_DIMENSION_SETS` binding, stock line
  context registered for `analytic_dimension_rule` scopes, line-to-movement flow, per-value balances and refusal when
  short, deletion refused while used. Files: `iv/dimensions/stock-dimension-sets.binding.ts`,
  `iv/dimensions/stock-line-context.ts`, `iv/dimensions/stock-dimension-balance.service.ts`. Test: service spec with the
  accounting test harness.
- [ ] **T21**. Explain service (`/stock-valuation/explain` by layer, document, line, journal line) and preview service
  bound to `STOCK_VALUE_PREVIEW`. Files: `iv/explain/valuation-explain.service.ts`,
  `iv/explain/valuation-preview.service.ts`, `iv/explain/valuation-explain.controller.ts`. Test: explanation spec on a
  FIFO chain.
- [ ] **T22**. Balances, lookup and layers routes (quantities from levels and movements); values this plugin adds
  stripped without the view key; the existing count `varianceValue` left as it is. Files:
  `iv/balances/stock-balance.service.ts`, `iv/balances/stock-balance.controller.ts`, `iv/balances/stock-lookup.service.ts`,
  `iv/stock-valuation-layer/stock-valuation-layer.controller.ts`. Test: controller specs; a user without
  `STOCK_VALUATION_VIEW` still reads a count's variance value.
- [ ] **T23**. Integrity checks (FR-53) with findings; on-demand run as the core operation `STOCK_INTEGRITY_RUN`;
  checks include open layers against on hand and key value against layers. Files:
  `iv/stock-integrity/integrity-checks.ts`, `iv/stock-integrity/stock-integrity.service.ts`,
  `iv/stock-integrity/stock-integrity-run.operation.ts`, `iv/stock-integrity/stock-integrity.controller.ts`. Test: one
  spec per check with a seeded disagreement.
- [ ] **T24**. Report definitions FR-56 to FR-72 over key values, level rows and snapshots. Files:
  `iv/reports/stock-report-datasets.ts`, `iv/reports/stock-report-definitions.ts`. Test: dataset spec per report.

## Phase 3 — UI surfaces

- [ ] **T25**. `packages/plugins/inventory-valuation-ui` scaffold (`ivui/inventory-valuation-ui.plugin.ts`,
  `ivui/inventory-valuation-ui.routes.ts`, `ivui/services/inventory-valuation-api.service.ts`), menu, availability on
  404, `INVENTORY_VALUATION.*` keys in every locale of `packages/ui-core/i18n/assets/i18n/*.json`. Test: plugin spec.
- [ ] **T26**. Count screens (scope, scan, review, recount, close, print) — phase 1 deliverable on existing counts.
  Files: `ivui/components/stock-count-list/stock-count-list.component.ts`,
  `ivui/components/stock-count-scope/stock-count-scope.component.ts`,
  `ivui/components/stock-count-scan/stock-count-scan.component.ts`,
  `ivui/components/stock-count-review/stock-count-review.component.ts`. Test: rendering specs.
- [ ] **T27**. Settings, policies, standard costs, closings, value resets pages; a link to the accounting dimension
  pages for stock dimensions. Files: `ivui/components/valuation-settings-page/valuation-settings-page.component.ts`,
  `ivui/components/valuation-policies-page/valuation-policies-page.component.ts`,
  `ivui/components/standard-costs-page/standard-costs-page.component.ts`,
  `ivui/components/stock-closings-page/stock-closings-page.component.ts`,
  `ivui/components/value-resets-page/value-resets-page.component.ts`. Test: rendering specs.
- [ ] **T28**. Layer explorer and the "why this cost" panel, registered on inventory pages, the document editor and
  the journal line view (extension points in `ivui/inventory-valuation-ui.plugin.ts`). Files:
  `ivui/components/layer-explorer/layer-explorer.component.ts`,
  `ivui/components/why-this-cost-panel/why-this-cost-panel.component.ts`. Test: component spec.
- [ ] **T29** (parallel). Landed cost editor with allocation preview. Files:
  `ivui/components/landed-cost-editor/landed-cost-editor.component.ts`. Test: component spec.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T30**. MCP tools `packages/mcp-server/src/lib/tools/stock-valuation.ts` with `preview` on applying tools,
  registered in `packages/mcp-server/src/lib/tools/register-all-tools.ts`. Test: tool specs.
- [ ] **T31**. OpenAPI regenerated; SDK regeneration noted. Files: `packages/core/src/lib/bootstrap/swagger.ts`. Test: OpenAPI diff is additive.
- [ ] **T32**. User docs (methods, recalculation, counts, closing, landed cost, postings) and the specs index row. Files: `docs/specs/README.md`. Test: docs build.

## Phase 5 — Advanced capabilities

- [ ] **T33**. Backdated preview in the document preview (later outflows changed, total, postings). Files:
  `iv/explain/backdated-preview.ts`, `iv/explain/valuation-preview.service.ts`. Test: spec writes nothing.
- [ ] **T34**. Integrity monitor jobs (incremental every 15 min with the cursor in the last `job_execution` result,
  nightly full) and inbox notices. Files: `iv/schedule/integrity-incremental.scheduler.ts`,
  `iv/schedule/integrity-full.scheduler.ts`, `iv/schedule/integrity-monitor.worker.ts`. Test: scheduler spec;
  incremental cursor spec.
- [ ] **T35**. Correction proposals per check with previews and apply/accept routes; the correction agent registered
  with `ai-agents-and-assistants` (run linked on the finding). Files: `iv/stock-integrity/correction-proposals.service.ts`,
  `iv/stock-integrity/correction-agent.registration.ts`, `iv/stock-integrity/stock-integrity.controller.ts`. Test:
  proposal spec per check; apply resolves the finding.
- [ ] **T36**. Closing agreement rule (warn or refuse) with responsible documents. Files:
  `iv/stock-closing/closing-agreement.ts`. Test: SQLite spec.
- [ ] **T37**. ABC classification and cycle count plans generating blind counts and floor-app tasks through the
  warehouse task port; recount by another person. Files: `iv/cycle-count/abc-classifier.ts`,
  `iv/cycle-count/cycle-count-plan.service.ts`, `iv/cycle-count/cycle-count-plan.controller.ts`,
  `iv/schedule/cycle-count-plan.scheduler.ts`. Test: plan spec (spread over working days).
- [ ] **T38**. Labour capitalisation job from completed warehouse task labour into a monthly landed cost. Files:
  `iv/landed-cost/labour-capitalise.job.ts`. Test: job spec (idempotent per month).
- [ ] **T39**. Live value cards (coalesced push) and automation triggers of FR-84. Files:
  `iv/events/valuation-value-changed.publisher.ts`, `iv/events/valuation-automation-triggers.ts`. Test: push spec;
  trigger catalogue.
- [ ] **T40**. Provide the ports other features bind to (plan, **Consumer tokens answered**): `LEDGER_STOCK_VALUE`, `MANUFACTURING_VALUATION`, `SUBCONTRACTING_VALUATION`. Files: `apps/api/src/plugin-composition.ts`. Test: one contract test per token over the shape its consumer plan states; with this feature off each consumer keeps its stated fallback.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Valuation layers | T8 |
| FR-2 | §3.1 Valuation layers | T5, T8 |
| FR-3 | §3.1 Valuation layers | T3, T8 |
| FR-4 | §3.1 Valuation layers | T8, T9 |
| FR-5 | §3.1 Valuation layers | T5, T8, T20 |
| FR-6 | §3.1 Valuation layers | T7 |
| FR-7 | §3.2 Costing methods | T7, T10 |
| FR-8 | §3.2 Costing methods | T9, T27 |
| FR-9–FR-10 | §3.2 Costing methods | T7 |
| FR-11 | §3.2 Costing methods | T7, T10 |
| FR-12–FR-13 | §3.2 Costing methods | T10 |
| FR-14 | §3.3 Backdated movements and recalculation | T8, T11 |
| FR-15 | §3.3 Backdated movements and recalculation | T11 |
| FR-16 | §3.3 Backdated movements and recalculation | T9 |
| FR-17–FR-18 | §3.3 Backdated movements and recalculation | T11 |
| FR-19 | §3.3 Backdated movements and recalculation | T16 |
| FR-20 | §3.3 Backdated movements and recalculation | T11 |
| FR-21–FR-23 | §3.4 Negative stock | T9 |
| FR-24 | §3.5 Stock counts and opening stock | T26 |
| FR-25 | §3.5 Stock counts and opening stock | T14, T22 |
| FR-26–FR-30 | §3.5 Stock counts and opening stock | T14 |
| FR-31–FR-32 | §3.6 Value reset | T15 |
| FR-33–FR-34 | §3.7 Stock closing and freeze | T12, T13 |
| FR-35 | §3.7 Stock closing and freeze | T13 |
| FR-36 | §3.7 Stock closing and freeze | T12 |
| FR-37 | §3.7 Stock closing and freeze | T13 |
| FR-38 | §3.8 Perpetual inventory postings | T16, T17 |
| FR-39–FR-41 | §3.8 Perpetual inventory postings | T16 |
| FR-42 | §3.8 Perpetual inventory postings | T16, T17 |
| FR-43 | §3.9 Landed cost and valuation taxes | T18, T29 |
| FR-44–FR-46 | §3.9 Landed cost and valuation taxes | T18 |
| FR-47 | §3.9 Landed cost and valuation taxes | T19 |
| FR-48 | §3.9 Landed cost and valuation taxes | T18 |
| FR-49 | §3.9 Landed cost and valuation taxes | T19 |
| FR-50–FR-52 | §3.10 Stock dimensions | T20 |
| FR-53–FR-54 | §3.11 Integrity and lookup | T23 |
| FR-55 | §3.11 Integrity and lookup | T22 |
| FR-56–FR-73 | §3.12 Reports | T24 |
| FR-74 | §3.13 Explainable cost, integrity monitor and counting plans (advanced) | T21, T28 |
| FR-75 | §3.13 Explainable cost, integrity monitor and counting plans (advanced) | T33 |
| FR-76 | §3.13 Explainable cost, integrity monitor and counting plans (advanced) | T34 |
| FR-77 | §3.13 Explainable cost, integrity monitor and counting plans (advanced) | T35 |
| FR-78 | §3.13 Explainable cost, integrity monitor and counting plans (advanced) | T36 |
| FR-79–FR-80 | §3.13 Explainable cost, integrity monitor and counting plans (advanced) | T37 |
| FR-81 | §3.13 Explainable cost, integrity monitor and counting plans (advanced) | T38 |
| FR-82 | §3.13 Explainable cost, integrity monitor and counting plans (advanced) | T39 |
| FR-83 | §3.13 Explainable cost, integrity monitor and counting plans (advanced) | T30 |
| FR-84 | §3.13 Explainable cost, integrity monitor and counting plans (advanced) | T39 |
| FR-85 | §3.14 Settings and compatibility | T6, T9 |
| FR-86 | §3.14 Settings and compatibility | T17 |
| FR-87 | §3.14 Settings and compatibility | T8, T9 |
| FR-88 | §3.14 Settings and compatibility | T6, T22 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off; enabling it in dev shows the feature end to end.
- Constitution gates in `spec.md` §9 confirmed.
- Ledger invariants hold after the full end-to-end suite: stock value equals the sum of layers and equals the ledger
  stock accounts; open layers equal on hand; the integrity run reports zero findings.
- With the flag off, inventory tests pass unchanged, both with the ports unbound and with the plugin loaded and the
  ports bound (AC-17).
