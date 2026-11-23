# Task Breakdown: Pricing and promotions

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `pricing-and-promotions`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold. A spec file named in a `Test:` clause without a full path sits under the `src/lib/` folder of the package the task changes (beside the file it tests).
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- New behaviour stays behind `FEATURE_PRICING_RULES`: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it. `[n]` at the end of a task is the rollout phase of the plan (§11) it belongs to.
- Paths: `pr/` = `packages/plugins/pricing/src/lib/`, `pm/` = `packages/plugins/promotion/src/lib/`,
  `prui/` = `packages/plugins/pricing-ui/src/lib/`, `pmui/` = `packages/plugins/promotion-ui/src/lib/`.
- Gates: the existing module codes (`FEATURE_PRICING`, `FEATURE_PROMOTION`, `FEATURE_GIFT_CARDS`,
  `FEATURE_PRICE_TIERS`, `FEATURE_MULTI_CURRENCY`) gate their routes from T8 on; every route, screen, job and MCP tool
  a task adds is also gated by `FEATURE_PRICING_RULES`, except the rollout phase 1 tasks marked [1].

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts `packages/contracts/src/lib/pricing.model.ts` (quote, explanation, guard, override, change
  read model, proposal, impact result, leak, enums) + additive fields on promotion and price interfaces; re-exports
  from the plugins' `*.types.ts`; type tests. Files: `packages/contracts/src/lib/pricing.model.ts`,
  `packages/contracts/src/index.ts`, `pr/pricing.types.ts`, `pm/promotion.types.ts`. Test:
  `packages/contracts/src/lib/pricing.model.spec.ts` type tests. [2]
- [ ] **T2**. Feature and permissions: `FEATURE_PRICING_RULES` in `pricing.features.ts`; `PRICING_GUARD_OVERRIDE`,
  `PRICING_SETTINGS_EDIT`, `PRICING_INSIGHTS_VIEW` as contributions with `defaultFor` in `pricing.permissions.ts`
  (existing tenants through the permission reload; no seed migration); specs. Files: `pr/pricing.features.ts`,
  `pr/pricing.permissions.ts`, `pr/pricing.plugin.ts`. Test: `pr/pricing.features.spec.ts` (default off, depends on
  `FEATURE_PRICING` and `FEATURE_PROMOTION`) and `pr/pricing.permissions.spec.ts`. [1] Migration timestamps: `1791000023100` to `1791000023199` (`packages/plugins/pricing`); `1791000023200` to `1791000023299` (`packages/plugins/promotion`).
- [ ] **T3**. Migration `1791000023120-EnableUsedCommerceSubFeatures` (gift cards, tiers, foreign currency in use →
  toggles on); SQLite and PostgreSQL tests with and without data. Files:
  `pr/database/migrations/{1791000023120-EnableUsedCommerceSubFeatures.ts,index.ts}`. Test:
  `pr/database/enable-used-commerce-sub-features.migration.spec.ts`. [1]
- [ ] **T4**. Pricing migration `1791000023100-ExtendPricingTables` (shared core migration helpers) + entity columns on
  `PriceList` (`direction`, `vendorId`, `isUnitIndependent`), `ProductPrice` (`note`, `reference`);
  `PriceComputeMode.AMOUNT_OFF`; tri-dialect test. Files: `pr/database/migrations/1791000023100-ExtendPricingTables.ts`,
  `pr/price-list/price-list.entity.ts`, `pr/product-price/product-price.entity.ts`, `pr/pricing.types.ts`. Test:
  `pr/database/extend-pricing-tables.migration.spec.ts`. [2]
- [ ] **T5** (parallel). Promotion migration `1791000023200-ExtendPromotionTables` + entity columns on `Promotion`,
  `PromotionAction`; `PromotionActionType.SET_PRICE`, `MARGIN`; tri-dialect test. Files:
  `pm/migrations/1791000023200-ExtendPromotionTables.ts`, `pm/promotion/promotion.entity.ts`,
  `pm/promotion-action/promotion-action.entity.ts`, `pm/promotion.types.ts`. Test:
  `pm/migrations/extend-promotion-tables.migration.spec.ts`; existing promotions read back with the defaults. [2]
- [ ] **T6**. Pricing migration `1791000023110-CreatePricingInsightTables` + entities `PriceGuardOverride`,
  `PriceProposal`, `MarginLeakFinding` with repository pairs (price history is the activity log; impact replays are
  core operations). Files: `pr/database/migrations/1791000023110-CreatePricingInsightTables.ts`,
  `pr/{price-guard-override/price-guard-override.entity.ts,price-proposal/price-proposal.entity.ts,margin-leak/margin-leak-finding.entity.ts}`
  each with `repository/type-orm-<name>.repository.ts` and `repository/mikro-orm-<name>.repository.ts`. Test:
  `pr/database/create-pricing-insight-tables.migration.spec.ts` on SQLite; entity metadata specs for both ORMs. [2]
- [ ] **T7**. Settings `packages/plugins/pricing/src/lib/pricing.settings.ts` (default lists, fallback, guard actions
  per direction, rate lock, document writes, nudges); spec. Files: `pr/pricing.settings.ts`. Test:
  `pr/pricing.settings.spec.ts`: every guard and stickiness `OFF`, document writes off by default. [2]

## Phase 2 — Services, endpoints, events

- [ ] **T8**. Module guards: `@FeatureFlag(FEATURE_PRICING)` on pricing controllers and resolvers,
  `FEATURE_PROMOTION` on promotion, coupon, campaign controllers, `FEATURE_GIFT_CARDS` on gift-card controllers;
  tier and currency checks in `ProductPriceService` and `PriceListService`; `404`/`400` specs. Files:
  `pr/{price-list/price-list.controller.ts,product-price/product-price.controller.ts,price-preference/price-preference.controller.ts,exchange-rate/exchange-rate.controller.ts,graphql/resolvers/index.ts}`,
  `pr/product-price/product-price.service.ts`, `pr/price-list/price-list.service.ts`,
  `pm/{promotion/promotion.controller.ts,coupon/coupon.controller.ts,campaign/campaign.controller.ts,gift-card/gift-card.controller.ts,graphql/resolvers/index.ts}`.
  Test: `pr/pricing.module-gates.spec.ts` and `pm/promotion.module-gates.spec.ts` (`404` with the module off; `400`
  naming `FEATURE_PRICE_TIERS` or `FEATURE_MULTI_CURRENCY`). [1]
- [ ] **T9**. Ports `PRICING_BASKET_CHAIN`, `PRICING_COST_BASIS`, `PRICING_PURCHASE_HISTORY`, `PRICING_SUPPLIER_TERMS`,
  `PRICING_ASSISTANT` in `pricing`; bindings in `apps/api/src/plugin-composition.ts`; unbound-port specs. Files:
  `pr/ports/{pricing.ports.ts,index.ts}`, `apps/api/src/plugin-composition.ts`. Test: `pr/ports/pricing.ports.spec.ts` with every port unbound. [2]
- [ ] **T10**. Price lists: direction, supplier scope through `price_list.vendorId`, unit independence,
  delivery-country eligibility, list chain with customer and group lists and the group discount step, default
  fallback, the legacy variant price as the named last fallback, copy route, each step skipped unless
  `FEATURE_PRICING_RULES` is on. Files: `pr/product-price/product-price.service.ts`,
  `pr/price-list/{price-list.service.ts,price-list.controller.ts,price-list-chain.ts,price-list-copy.service.ts,dto/copy-price-list.dto.ts}`.
  Test: `pr/price-list/price-list-chain.spec.ts` golden fixtures, including an unchanged cart and subscription price
  for a customer with their own list and a discounted group while the flag is off; two eligible overriding lists of
  equal priority refused naming both; another currency converted at the rate of the document date, a list without a
  rate skipped with a notice; `pr/price-list/price-list-copy.service.spec.ts`: a derived list re-derives when its base
  list changes. [2]
- [ ] **T11**. Prices: order-multiple check on selling documents (item order multiple of `item-catalogue`) and
  pack-size check on buying documents (supplier term of `procurement`) with the next-valid-quantity notice, a warning
  unless `pricing.refuseUnitMultiples` is on; buying
  rows derived from the term price; note, reference, `AMOUNT_OFF` and markup arithmetic; bulk upload result per row.
  Files: `pr/product-price/{product-price.service.ts,unit-multiple.check.ts,price-arithmetic.ts}`,
  `pr/product-price/dto/bulk-upsert-product-prices.dto.ts`. Test: `pr/product-price/unit-multiple.check.spec.ts`,
  `pr/product-price/price-arithmetic.spec.ts` and `pr/product-price/product-price.replace-batch.spec.ts` (a failed row
  never blocks the others). [2]
- [ ] **T12**. Rule attributes registered with the rule validator and filled by the evaluation context builder. Files:
  `pm/rules/{pricing-rule-attributes.ts,evaluation-context.builder.ts}`. Test: `pm/rules/pricing-rule-attributes.spec.ts`, one spec per attribute. [2]
- [ ] **T13**. Promotion engine depth: `SET_PRICE`, `MARGIN`, bands (line, mixed, document), recursive free items
  with rounding and free-line rate, `RECURSIVE_MIXED` refusal, discount base, combined cap, lock; golden fixtures. Files:
  `pm/promotion/{promotion.service.ts,promotion-bands.ts,free-items.ts,discount-stacking.ts}`. Test:
  `pm/promotion/promotion.evaluate.spec.ts` extended with golden fixtures (existing cases unchanged); applied and
  excluded rules reported per line. [2]
- [ ] **T14**. Cumulative conditions: purchase-history port query (windowed sums over confirmed order lines,
  memoised per request), use counts from `promotion_usage` and `promotion_order_usage`; no cached sums. Files:
  `pm/promotion/cumulative-conditions.ts`, `pr/ports/purchase-history.port.ts`. Test:
  `pm/promotion/cumulative-conditions.spec.ts` incl. the 150 ms budget. [2]
- [ ] **T15**. Slabs: `kind = SLAB` validation (overlap refusal unless stacking), party conditions. Files:
  `pm/promotion/{slab.validator.ts,promotion.service.ts}`. Test: `pm/promotion/slab.validator.spec.ts`: overlapping bands refused with `BAND_OVERLAP` unless stacking. [2]
- [ ] **T16**. The cart's stateless entry `CommerceCartService.priceBasket(context, lines)` (the steps of
  `recalculate` over an unsaved basket; `recalculate` delegates to it) and `PricingQuoteService` + `/pricing/quote`
  over it through `PRICING_BASKET_CHAIN` (free lines, ignore flag refusing coupons, notices, explanation hooks);
  GraphQL `pricingQuote`. Files: `packages/plugins/cart/src/lib/commerce-cart/commerce-cart.service.ts`,
  `pr/quote/{pricing-quote.service.ts,pricing-quote.controller.ts,dto/}`, `pr/graphql/resolvers/pricing-quote.resolver.ts`.
  Test: the cart's totals specs (`packages/plugins/cart/src/lib/totals/totals-calculator.spec.ts`) unchanged;
  `pr/quote/pricing-quote.service.spec.ts`: one answer for the same context; ignore flag skips rules and refuses
  coupons; latency test (50 lines, 200 rules). [2]
- [ ] **T17**. Coupon use counted on document confirmation and returned on cancellation for every caller of the quote
  (order adapter exists; generic confirm/cancel hooks for documents); concurrency spec. Files:
  `pm/coupon/coupon-usage.service.ts`, `pm/promotion-order-usage/promotion-order-usage.adapter.ts`,
  `pm/coupon/document-coupon.hooks.ts`. Test: `pm/coupon/coupon-usage.service.spec.ts`: only one of two concurrent
  uses of the last allowance succeeds; cancellation gives the use back. [2]
- [ ] **T18**. `PriceGuardService` + `/pricing/check-lines` (max discount, margin, cost floor through the port, rule
  lock, rate stickiness against the source line) + `/pricing/overrides`; every guard and stickiness `OFF` by
  default. Files: `pr/guards/{price-guard.service.ts,price-guard.controller.ts,rate-stickiness.ts,dto/}`,
  `pr/price-guard-override/price-guard-override.service.ts`. Test: `pr/guards/price-guard.service.spec.ts` per guard
  and action, and a spec that a document saves and confirms as before with the defaults; an override records user,
  guard, line and values. [2]
- [ ] **T19**. Document price writes (create missing, update by policy) behind the setting, with the price history
  source `DOCUMENT`. Files: `pr/product-price/document-price-writes.service.ts`. Test:
  `pr/product-price/document-price-writes.service.spec.ts`: off by default; each policy (always, higher, lower) writes and names the document. [2]
- [ ] **T20**. Promotion and coupon batch performance routes; report definitions (coverage, price changes,
  promotion performance, discounts given, guard overrides) declared through `registerReportDefinitions`; no report
  route. Files: `pm/promotion/promotion-performance.controller.ts`, `pm/coupon/coupon-batch-performance.service.ts`,
  `pr/reports/pricing.report-definitions.ts`. Test: `pr/reports/pricing.report-definitions.spec.ts`: report figures
  match the seeded promotions, coupons and overrides; `pm/promotion/promotion-performance.controller.spec.ts`. [2]
- [ ] **T21**. Outbox events of plan §5 (list, price, promotion); `declareStreamedEvents`. Files:
  `pr/events/{pricing.events.ts,index.ts}`, `pm/events/promotion.events.ts`. Test: `pr/events/pricing.events.spec.ts`
  and `pm/events/promotion.events.spec.ts`: one event per write, appended in the write's transaction. [2]

## Phase 3 — UI surfaces

- [ ] **T22**. Scaffold `packages/plugins/pricing-ui` and `packages/plugins/promotion-ui` (package, project, jest,
  i18n), registration in `apps/gauzy/src/plugin-ui.config.ts`, menus gated by features and permissions. Files:
  `packages/plugins/pricing-ui/{package.json,project.json,ng-package.json,src/index.ts}`,
  `packages/plugins/promotion-ui/{package.json,project.json,ng-package.json,src/index.ts}`,
  `prui/{pricing-ui.plugin.ts,pricing-ui.routes.ts}`, `pmui/{promotion-ui.plugin.ts,promotion-ui.routes.ts}`,
  `apps/gauzy/src/plugin-ui.config.ts`. Test: `prui/pricing-ui.plugin.spec.ts` and `pmui/promotion-ui.plugin.spec.ts`: menus are hidden without the features and permissions. [1]
- [ ] **T23**. Pricing pages on the existing API: price lists, price grid with tiers and bulk upload, preferences,
  exchange rates. Files: `prui/pages/{price-lists-page.component.ts,price-grid-page.component.ts,bulk-upload-dialog.component.ts,price-preferences-page.component.ts,exchange-rates-page.component.ts}`.
  Test: component specs per page (`price-grid-page.component.spec.ts` with tiers and windows). [1]
- [ ] **T24** (parallel). Promotion pages on the existing API: promotions with conditions and actions, simulate,
  coupons and batches, campaigns and budgets, gift cards and ledger. Files:
  `pmui/pages/{promotions-page.component.ts,promotion-editor.component.ts,coupons-page.component.ts,campaign-budget-tab.component.ts,gift-cards-page.component.ts}`.
  Test: component specs per page (`promotion-editor.component.spec.ts`, `gift-cards-page.component.spec.ts`). [1]
- [ ] **T25**. Depth screens: list scope and chain preview, copy, pricing rules list and editor (bands, free items,
  stacking, cumulative, lock), slab editor, settings page (guards, stickiness, defaults, document writes). Files:
  `prui/pages/{list-chain-preview.component.ts,pricing-settings-page.component.ts}`,
  `pmui/pages/{pricing-rules-page.component.ts,pricing-rule-editor.component.ts,slab-editor.component.ts}`. Test:
  `prui/pages/list-chain-preview.component.spec.ts` rendering specs; the chain preview shows the price the engine returns. [2]
- [ ] **T26**. Guard results and override dialog component for document screens (plugin location
  `document-line-actions`). Files: `prui/components/{guard-results.component.ts,guard-override-dialog.component.ts}`.
  Test: `prui/components/guard-override-dialog.component.spec.ts`: the dialog posts the override with the values. [2]
- [ ] **T27**. i18n keys of both UI plugins in every locale under `packages/ui-core/i18n/`; accessibility checks. Files:
  `packages/ui-core/i18n/assets/i18n/*.json`. Test: every locale holds the keys; accessibility checks in the component specs. [2]

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T28**. MCP `packages/mcp-server/src/lib/tools/pricing.ts` (`price_basket`, `explain_price`,
  `simulate_price_list`) and `promotions.ts` (`list_promotions`, `validate_coupon`, `get_gift_card_balance`);
  registered. Files: `packages/mcp-server/src/lib/tools/{pricing.ts,promotions.ts,register-all-tools.ts}`. Test:
  `packages/mcp-server/src/lib/tools/pricing.spec.ts` and `promotions.spec.ts` schema tests. [1]
- [ ] **T29**. OpenAPI regenerated; SDK regeneration noted. Files: `packages/core/src/lib/bootstrap/swagger.ts`. Test: OpenAPI diff is additive. [2]
- [ ] **T30**. User docs (price lists, rules, slabs, coupons, guards) and the `docs/specs/README.md` row. Files: `docs/specs/README.md`. Test: docs build. [2]

## Phase 5 — Advanced capabilities (rollout phase 3)

- [ ] **T31**. Explanation trace in `ProductPriceService` and `PromotionService` + `/pricing/explain`; "Why this
  price" drawer in `pricing-ui` contributed to `document-line-actions`. Files: `pr/explain/{price-explanation.builder.ts,explain.controller.ts}`,
  `pr/product-price/product-price.service.ts`, `pm/promotion/promotion.service.ts`,
  `pr/graphql/resolvers/price-explanation.resolver.ts`, `prui/components/why-this-price-drawer.component.ts`. Test:
  `pr/explain/price-explanation.builder.spec.ts` trace golden fixtures.
- [ ] **T32**. Price history as activity-log rows (entity `ProductPrice`, source and reference in `data`) written by
  the price services for every source; history route over them and tab on the price grid and the item. Files:
  `pr/product-price/{price-history.writer.ts,price-history.controller.ts}`, `packages/contracts/src/lib/base-entity.model.ts`,
  `prui/components/price-history-tab.component.ts`. Test: `pr/product-price/price-history.writer.spec.ts`: one row per
  change for each source; no second store.
- [ ] **T33**. `/pricing/compare` and the simulator page (basket, customer, date, draft vs live). Files:
  `pr/quote/pricing-compare.controller.ts`, `prui/pages/pricing-simulator-page.component.ts`. Test:
  `pr/quote/pricing-compare.controller.spec.ts`: a draft rule changes only the lines it matches.
- [ ] **T34**. Impact replay: `/price-lists/:id/impact`, `/promotions/:id/impact`, core operation `PRICING_IMPACT`
  (cursor steps, result on the operation), Inbox notice on its `operation.completed`; simulator tab. Files:
  `pr/impact/{pricing-impact.operation.ts,pricing-impact.controller.ts,impact-completed.consumer.ts}`,
  `prui/pages/impact-tab.component.ts`. Test: `pr/impact/pricing-impact.operation.spec.ts` incl. 100,000-line timing.
- [ ] **T35**. Nudges in the quote (threshold per rule, default 20 %). Files: `pr/quote/nudges.ts`. Test: `pr/quote/nudges.spec.ts`: a basket short of a band by 15 % gets one nudge naming what to add.
- [ ] **T36**. Proposals: `/pricing/proposals`, operation `PRICING_PROPOSAL` through `PRICING_ASSISTANT` (purpose
  `pricing.price-proposal`), draft list + impact, discard; proposals page. Files:
  `pr/price-proposal/{price-proposal.service.ts,price-proposal.controller.ts,price-proposal.operation.ts}`,
  `prui/pages/proposals-page.component.ts`. Test: `pr/price-proposal/price-proposal.operation.spec.ts` proving the
  operation cannot activate a list.
- [ ] **T37**. Margin-leak sweep: scheduled job, `/pricing/margin-leaks` routes, Inbox item per run, margin leaks page
  and report. Files: `pr/margin-leak/{margin-leak.sweep.ts,margin-leak.service.ts,margin-leak.controller.ts}`,
  `pr/schedule/pricing-schedule.plugin.ts`, `prui/pages/margin-leaks-page.component.ts`. Test:
  `pr/margin-leak/margin-leak.sweep.spec.ts` incl. once-per-finding; acknowledge and resolve keep the finding in the report.
- [ ] **T38**. Real-time hints for `pricing.*` and `promotion.promotion.changed` (registers, carts, open documents).
  Files: `pr/events/pricing-realtime.publisher.ts`, `pm/events/promotion-realtime.publisher.ts`. Test:
  `apps/gauzy-e2e` test of the 2-second update.
- [ ] **T39**. MCP writing and insight tools `replay_price_impact`, `propose_price_changes`, `list_margin_leaks`,
  `create_promotion`, `generate_coupon_batch` with `preview`. Files: `packages/mcp-server/src/lib/tools/{pricing.ts,promotions.ts}`.
  Test: `packages/mcp-server/src/lib/tools/pricing.spec.ts`: a preview writes nothing.
- [ ] **T40**. Spec status `Implemented`; checklist rows updated. Files: `docs/specs/features/pricing-and-promotions/spec.md`. Test: every acceptance criterion of `spec.md` §7 demonstrated before the status changes.
- [ ] **T41**. Provide the ports other features bind to (plan, **Consumer tokens answered**): `DOCUMENT_PRICING_STAGE`, `LEDGER_EXCHANGE_RATES`, `MANUFACTURING_PRICE_LISTS`, `PAYROLL_EXCHANGE_RATES`, `PRICING_COUPONS`, `PURCHASING_PRICING`. Files: `apps/api/src/plugin-composition.ts`, `pr/ports/pricing.consumer-tokens.ts`. Test: `pr/ports/pricing.consumer-tokens.spec.ts`, one contract test per token over the shape its consumer plan states; with this feature off each consumer keeps its stated fallback.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Access, gates and screens | T8 |
| FR-2 | §3.1 Access, gates and screens | T3 |
| FR-3 | §3.1 Access, gates and screens | T2, T10 |
| FR-4 | §3.1 Access, gates and screens | T23, T24 |
| FR-5 | §3.2 Price lists | T4, T10 |
| FR-6–FR-9 | §3.2 Price lists | T10 |
| FR-10 | §3.2 Price lists | T7, T10 |
| FR-11 | §3.2 Price lists | T10 |
| FR-12–FR-14 | §3.3 Item prices | T11 |
| FR-15 | §3.3 Item prices | T11, T23 |
| FR-16 | §3.3 Item prices | T19 |
| FR-17 | §3.3 Item prices | T32 |
| FR-18 | §3.4 Price resolution and explanation | T16 |
| FR-19–FR-20 | §3.4 Price resolution and explanation | T10 |
| FR-21 | §3.4 Price resolution and explanation | T31 |
| FR-22 | §3.4 Price resolution and explanation | T33 |
| FR-23 | §3.4 Price resolution and explanation | T34 |
| FR-24 | §3.5 Pricing rules | T5, T13 |
| FR-25 | §3.5 Pricing rules | T12 |
| FR-26 | §3.5 Pricing rules | T13 |
| FR-27 | §3.5 Pricing rules | T13, T14 |
| FR-28–FR-30 | §3.5 Pricing rules | T13 |
| FR-31 | §3.5 Pricing rules | T13, T18 |
| FR-32 | §3.5 Pricing rules | T13, T16 |
| FR-33 | §3.5 Pricing rules | T16 |
| FR-34 | §3.5 Pricing rules | T35 |
| FR-35 | §3.6 Promotions, slabs and coupons | T15 |
| FR-36 | §3.6 Promotions, slabs and coupons | T5, T13 |
| FR-37 | §3.6 Promotions, slabs and coupons | T24 |
| FR-38 | §3.6 Promotions, slabs and coupons | T17 |
| FR-39 | §3.6 Promotions, slabs and coupons | T20, T24 |
| FR-40–FR-43 | §3.7 Guards and rate stickiness | T18 |
| FR-44–FR-45 | §3.8 Exchange rates and preferences | T23 |
| FR-46 | §3.9 Gift cards | T8, T24 |
| FR-47 | §3.10 Agents, insights and real time | T36, T39 |
| FR-48–FR-49 | §3.10 Agents, insights and real time | T37 |
| FR-50 | §3.10 Agents, insights and real time | T38 |
| FR-51 | §3.10 Agents, insights and real time | T21 |
| FR-52 | §3.10 Agents, insights and real time | T28, T39 |
| FR-53 | §3.11 Reports | T20, T37 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off; enabling `FEATURE_PRICING_RULES` in dev shows the feature end to end.
- Constitution gates in `spec.md` §9 confirmed.
- A tenant holding gift cards, tiers or foreign-currency prices keeps them after the guard wiring.
- Quote P95 < 150 ms for 50 lines and 200 rules measured on PostgreSQL and SQLite.
- Resolution and evaluation golden fixtures unchanged for every existing case.
