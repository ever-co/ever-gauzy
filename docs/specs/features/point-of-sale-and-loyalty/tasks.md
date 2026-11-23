# Task Breakdown: Point of sale and loyalty

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `point-of-sale-and-loyalty`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind `GAUZY_POINT_OF_SALE_ENABLED` / `GAUZY_LOYALTY_ENABLED` and the tenant features: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it.
  `[n]` at the end of a task is the rollout phase of the plan (§11) it belongs to.
- Gating: register tasks check `FEATURE_POINT_OF_SALE`, loyalty tasks (T17 to T20, T24, T25, T31, T47, T48, T51,
  T53) `FEATURE_LOYALTY`.
- Path prefixes: `pos/` = `packages/plugins/point-of-sale/src/lib/`, `loy/` = `packages/plugins/loyalty/src/lib/`,
  `posui/` = `packages/plugins/point-of-sale-ui/src/lib/`, `loyui/` = `packages/plugins/loyalty-ui/src/lib/`. Each
  entity has its MikroORM and TypeORM repositories beside it in `repository/` (as in
  `packages/plugins/purchasing/src/lib/purchase-order/repository/`).

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts `packages/contracts/src/lib/point-of-sale.model.ts` and `loyalty.model.ts`; additive
  `RuleOwnerType.LOYALTY_PROGRAMME`, `LOYALTY_EARN_RULE`; order source `POINT_OF_SALE`; exports; type tests. [1]
- [ ] **T2**. Scaffold `packages/plugins/point-of-sale` (package, project, jest, eslint, tsconfig, path mapping),
  `isPointOfSaleEnabled` (exactly `true`, warns once), `.env.sample`; plugin lists of `apps/api` and `apps/worker`
  with specs. Files: `pos/point-of-sale.plugin.ts`, `pos/point-of-sale-enabled.ts`, `apps/api/src/plugins.ts`,
  `apps/worker/src/plugins.ts`. [1]
- [ ] **T3** (parallel). Scaffold `packages/plugins/loyalty` the same way with `isLoyaltyEnabled`. Files: `loy/loyalty.plugin.ts`, `loy/loyalty-enabled.ts`. Test: plugin list spec; `isLoyaltyEnabled` is true only for exactly `true`. [1]
- [ ] **T4**. Features and permissions as contributions: `FEATURE_POINT_OF_SALE`, `FEATURE_LOYALTY` (default off);
  `point-of-sale.permissions.ts`, `loyalty.permissions.ts` with `defaultFor` (plan §9); no seed migration; test of the
  default grants per role; routes answer `404` with the features off. Files: `pos/point-of-sale.features.ts`,
  `pos/point-of-sale.permissions.ts`, `loy/loyalty.features.ts`, `loy/loyalty.permissions.ts`. [1]
- [ ] **T5**. POS entities (register, register user, payment method, filter, shift, cash movement with `expenseId`,
  shift count, sale, cashier code) + repository pairs; migration `1791000024100-CreatePointOfSaleTables` part 1 with
  the shared core migration helpers (`@gauzy/core`, `procurement` T4);
  additive `BaseEntityEnum.PosSale`; SQLite test. Files: `pos/database/migrations/1791000024100-CreatePointOfSaleTables.ts`,
  `pos/register/pos-register.entity.ts`, `pos/register/pos-register-user.entity.ts`,
  `pos/register/pos-register-payment-method.entity.ts`, `pos/register/pos-register-filter.entity.ts`,
  `pos/shift/pos-shift.entity.ts`, `pos/shift/pos-cash-movement.entity.ts`, `pos/shift/pos-shift-count.entity.ts`,
  `pos/sale/pos-sale.entity.ts`, `pos/cashier/pos-cashier-code.entity.ts`. [1]
- [ ] **T6**. POS entities for devices, number blocks (allocated ranges of the register's `sequence` series), sync
  batches, anomaly findings; migration part 2. Files: `pos/database/migrations/1791000024110-CreatePointOfSaleDeviceTables.ts`,
  `pos/device/pos-device.entity.ts`, `pos/device/pos-number-block.entity.ts`, `pos/sync/pos-sync-batch.entity.ts`,
  `pos/anomaly/pos-anomaly-finding.entity.ts`. Test: SQLite migration test of part 2; entity metadata specs for both
  ORMs. [3]
- [ ] **T7**. Loyalty entities (programme, tier, earn rule, member, points entry, allocation, reservation, tier
  change) + repositories; migration `1791000024200-CreateLoyaltyTables` with the append-only trigger on entries and
  allocations for PostgreSQL, MySQL and SQLite; trigger tests. Files: `loy/database/migrations/1791000024200-CreateLoyaltyTables.ts`,
  `loy/programme/loyalty-programme.entity.ts`, `loy/programme/loyalty-tier.entity.ts`,
  `loy/programme/loyalty-earn-rule.entity.ts`, `loy/member/loyalty-member.entity.ts`,
  `loy/ledger/loyalty-points-entry.entity.ts`, `loy/ledger/loyalty-points-allocation.entity.ts`,
  `loy/ledger/loyalty-reservation.entity.ts`, `loy/member/loyalty-tier-change.entity.ts`. [1]

## Phase 2 — Services, endpoints, events

- [ ] **T8**. Ports `POS_ORDER_GATEWAY`, `POS_PAYMENT_GATEWAY`, `POS_PRICING`, `POS_PROMOTION`, `POS_STOCK_LEDGER`,
  `POS_RETURNS`, `POS_LOYALTY`, `POS_ATTENDANCE`; bindings in `apps/api/src/plugin-composition.ts`. Files: `pos/ports/pos.ports.ts`. Test: services run with every port unbound. [1]
- [ ] **T9**. One-step register order adapter in `packages/plugins/order/src/lib/order-platform-adapters.module.ts`
  (create with price snapshots, place, complete, invoice on request), with specs; no change to existing order
  behaviour. Files also: `packages/plugins/order/src/lib/pos/register-order.adapter.ts`. [1]
- [ ] **T10**. Register service and controller (`/pos/registers` with users, methods, filters, behaviours,
  offline policy); store = core `merchant`; offered items = the channel's publication (`product_channel`,
  `collection_channel`) narrowed by filters, with the customer-group item restrictions of `sales-order-management`
  (`SALES_ITEM_RESTRICTIONS`) applied when a customer is attached; card terminals from `payment_terminal.registerId`; validation (one default
  method, open-shift guard on disable); specs. Files: `pos/register/pos-register.service.ts`,
  `pos/register/pos-register.controller.ts`, `pos/register/register-catalogue.service.ts`,
  `pos/register/dto/create-pos-register.dto.ts`. [1]
- [ ] **T11**. Shift service: open (one per register and cashier), cash movements (an `EXPENSE` movement creates a
  core `expense` through its service), close with counts, expected computation, difference limit, approval;
  `/pos/shifts` routes; cashier codes (`PUT /pos/cashier-codes/me`, salted slow hash) and cashier switch on an open
  shift; specs per rule. Files: `pos/shift/pos-shift.service.ts`, `pos/shift/pos-shift.controller.ts`,
  `pos/shift/cash-movement.service.ts`, `pos/shift/shift-close.service.ts`, `pos/cashier/cashier-code.service.ts`,
  `pos/cashier/cashier-code.controller.ts`. [1]
- [ ] **T12**. Register sale service: envelope validation, order through the gateway, payments (cash, card terminal,
  provider), coupons and gift cards through the promotion port, stock movements through the ledger port, `pos_sale`
  with idempotent `clientSaleId`; `POST /pos/sales`; `GET /pos/sales` search by receipt number, customer, date, amount
  and status; crash-and-retry spec. Files: `pos/sale/pos-sale.service.ts`, `pos/sale/pos-sale.controller.ts`,
  `pos/sale/sale-envelope.validator.ts`, `pos/sale/sale-payments.service.ts`. [1]
- [ ] **T13**. Stock check and negative-stock policy on add and completion (bundle components, unsent quantities);
  specs. Files: `pos/sale/stock-check.service.ts`. [1]
- [ ] **T14**. Receipt numbering per register from a core `sequence` series (gap-free in use), receipts: print request,
  reprint copy, email, link as a `shared_entity` row (hashed token, expiry, revocation) and the public receipt route
  resolving it through the `shared_entity` service; specs. Files: `pos/receipt/receipt-number.service.ts`,
  `pos/receipt/receipt.service.ts`, `pos/receipt/receipt.controller.ts`, `pos/receipt/public-receipt.controller.ts`. [1]
- [ ] **T15**. Returns: `/pos/sales/:id/returns` and `/pos/returns` through the returns port (one step), refund
  method rules, promotion reversal, loyalty reversal; specs. Files: `pos/return/pos-return.service.ts`,
  `pos/return/pos-return.controller.ts`, `pos/return/refund-method.rules.ts`. [1]
- [ ] **T16**. Closing document: summary computation, number, `document.pos_shift_closing.confirmed` on the outbox,
  covered sales, correction closing job for late sales; specs proving no sale is covered twice. Files:
  `pos/closing/shift-closing.service.ts`, `pos/closing/closing-summary.ts`, `pos/closing/correction-closing.processor.ts`. [1]
- [ ] **T17**. Loyalty programme, tier and earning rule services and controllers with rule-row conditions; tier at
  zero check; specs. Files: `loy/programme/loyalty-programme.service.ts`, `loy/programme/loyalty-programme.controller.ts`,
  `loy/programme/loyalty-tier.service.ts`, `loy/programme/loyalty-earn-rule.service.ts`. [1]
- [ ] **T18**. Points ledger service: earn (idempotent per document), redeem with allocations to earliest-expiring
  entries, adjust, reverse with shortfall, balances and contact cache; opening `ADJUST` entry for a contact whose
  cached `loyaltyPoints` is not zero at first enrolment; members, ledger and adjustment routes; specs, including a
  contact enrolled with a cached balance of 120 keeping 120 and no write to the cache while `FEATURE_LOYALTY` is off.
  Files: `loy/ledger/points-ledger.service.ts`, `loy/member/loyalty-member.service.ts`,
  `loy/member/loyalty-member.controller.ts`, `loy/member/contact-points-cache.ts`. [1]
- [ ] **T19**. Loyalty outbox consumer `subscriber:loyalty` for `pos.sale.recorded`, `order.completed`,
  `order.canceled`, `return.refunded`; channel filters and exclusions; specs. Files: `loy/events/loyalty.consumer.ts`,
  `loy/ledger/earn-calculator.ts`. [1]
- [ ] **T20**. `/loyalty/quote`, `/loyalty/redemptions` (LOYALTY adjustment on the document), limits; register and
  checkout use; specs. Files: `loy/redemption/loyalty-quote.service.ts`, `loy/redemption/loyalty-redemption.service.ts`,
  `loy/redemption/loyalty-redemption.controller.ts`. [1]
- [ ] **T21**. POS and loyalty report datasets and definitions (register sales, payments by method, shift closings,
  loyalty activity, points liability) as `reports` contributions of the report builder; no report routes. Files:
  `pos/reports/pos-report-datasets.ts`, `loy/reports/loyalty-report-datasets.ts`. Test: report figures match the seeded sales, shifts and points. [1]
- [ ] **T22**. Partial payment with outstanding balance, invoice policies incl. consolidation per customer at
  closing, payment links through the payment port; specs. Files: `pos/sale/partial-payment.rules.ts`,
  `pos/sale/invoice-policy.service.ts`, `pos/sale/payment-link.service.ts`. [2]
- [ ] **T23**. Custom checkout fields and search fields per register; specs. Files: `pos/register/register-fields.service.ts`,
  `posui/register/checkout-fields.component.ts`. [2]
- [ ] **T24**. Expiry policies, daily expiry and reminder jobs, `loyalty.points.expiring` event; specs. Files:
  `loy/ledger/points-expiry.job.ts`, `loy/ledger/expiry-reminder.job.ts`, `loy/ledger/expiry-policy.ts`. [2]
- [ ] **T25**. Reservations for carts with expiry and cart-event release; earning on fully paid invoices (`document.payment.confirmed`); bonus rules
  with campaign windows; reports item sales by register and members by tier; specs. Files:
  `loy/ledger/loyalty-reservation.service.ts`, `loy/events/invoice-paid.consumer.ts`, `loy/programme/bonus-rules.ts`,
  `pos/reports/item-sales-by-register.dataset.ts`, `loy/reports/members-by-tier.dataset.ts`. [2]
- [ ] **T26**. Outbox events of plan §5 with `declareStreamedEvents`; Inbox items for overdue unsent sales; specs. Files:
  `pos/events/pos.events.ts`, `loy/events/loyalty.events.ts`. [1]
- [ ] **T53**. Redemption on invoice and order payments: `/loyalty/redemptions` for a document of the payments channel
  (`ORG_PAYMENT_ADD_EDIT`), `LOYALTY` adjustment allocated to the invoice, points field in the payment dialog; specs
  for the FR-65 limits and earning on the net amount. Files: `loy/redemption/document-redemption.service.ts`,
  `loyui/payment/payment-points-field.component.ts`, mounted in
  `apps/gauzy/src/app/pages/invoices/invoice-payments/payment-mutation/payment-mutation.component.ts`. [2]

## Phase 3 — UI surfaces

- [ ] **T27**. Scaffold `packages/plugins/point-of-sale-ui` (Angular, lazy) with the register page
  `/pages/pos/register/:id` in a full-screen layout; registration in `apps/gauzy/src/plugin-ui.config.ts`. Files:
  `posui/point-of-sale-ui.plugin.ts`, `posui/register/register-page.component.ts`. Test: rendering spec of the full-screen register page. [1]
- [ ] **T28**. Register screens: shift open, grid and search, scan, cart and keypad, customer, discounts with guard
  results, coupons, gift cards, points, payment and change, park, recent sales; every change priced through
  `POS_PRICING` with the applied rules and nudges shown; keyboard-only and touch; component tests. Files:
  `posui/register/shift-open.component.ts`, `posui/register/item-grid.component.ts`, `posui/register/cart.component.ts`,
  `posui/register/keypad.component.ts`, `posui/register/customer-picker.component.ts`,
  `posui/register/payment.component.ts`, `posui/register/parked-sales.component.ts`,
  `posui/services/pos-api.service.ts`. [1]
- [ ] **T29**. Register screens: returns, cash movements, closing count (blind option), cashier switch; tests. Files:
  `posui/register/returns.component.ts`, `posui/register/cash-movements.component.ts`,
  `posui/register/closing-count.component.ts`, `posui/register/cashier-switch.component.ts`,
  `posui/register/sale-search.component.ts`. [1]
- [ ] **T30**. Administration pages of `point-of-sale-ui`: registers (store picker over the existing merchants),
  users, methods, filters, behaviours; shifts with closing review and approval; report links to the report builder;
  menu Sales → Point of sale. Files: `posui/admin/registers.component.ts`, `posui/admin/register-edit.component.ts`,
  `posui/admin/shifts.component.ts`. Test: rendering specs; the menu entry is hidden without the permission. [1]
- [ ] **T31** (parallel). Scaffold `packages/plugins/loyalty-ui` (Angular): programmes, tiers, rules, members with
  ledger and adjustments, report links to the report builder; loyalty panel on the contact page, shown only with
  `FEATURE_LOYALTY` on (contact page unchanged with it off). Files: `loyui/loyalty-ui.plugin.ts`,
  `loyui/programmes/programmes.component.ts`, `loyui/members/members.component.ts`,
  `loyui/contact/contact-loyalty-panel.component.ts`. Test: rendering specs; the contact page is unchanged with `FEATURE_LOYALTY` off. [1]
- [ ] **T32**. Receipt print templates (58 mm, 80 mm, A4) seeded in the print engine; drawer pulse in the template. Files:
  `pos/receipt/receipt.print-templates.ts`. Test: PDF snapshot of each receipt size. [1]
- [ ] **T33**. i18n keys of the two UI plugins in every locale; accessibility checks. Files: `packages/ui-core/i18n/assets/i18n/*.json`. Test: every locale holds the keys; accessibility checks in the component specs. [1]

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T34**. MCP `packages/mcp-server/src/lib/tools/pos.ts` (`get_register_status`, `get_shift_summary`,
  `find_register_sale`) and `loyalty.ts` (`get_loyalty_member`); registered; schema tests. [1]
- [ ] **T35**. OpenAPI regenerated; SDK regeneration noted. Files: `packages/core/src/lib/bootstrap/swagger.ts`. Test: OpenAPI diff is additive. [1]
- [ ] **T36**. User docs (registers, shifts, selling, returns, closing, loyalty) and the `docs/specs/README.md` row. Test: docs build. [2]

## Phase 5 — Advanced capabilities (rollout phase 3)

- [ ] **T37**. Device enrolment and revocation routes with public-key signature verification middleware; devices
  page; specs incl. revoked device refusal. Files: `pos/device/pos-device.service.ts`, `pos/device/pos-device.controller.ts`,
  `pos/device/device-signature.middleware.ts`, `posui/admin/devices.component.ts`.
- [ ] **T38**. Pack service (items, barcodes, prices for the register context, offline-capable rules, methods,
  cashier code hashes, optional recent members) with change-only refresh by version; size and timing tests. Files:
  `pos/device/pack.service.ts`, `pos/device/pack.controller.ts`.
- [ ] **T39**. Browser-safe pricing evaluator entry `@gauzy/plugin-pricing/engine` (pure functions shared with the
  server) and its parity test against `/pricing/quote` on golden fixtures. Files: `packages/plugins/pricing/src/engine/index.ts`,
  `packages/plugins/pricing/src/engine/evaluate-price.ts`, `packages/plugins/pricing/package.json`.
- [ ] **T40**. Number blocks: one `SequenceService.allocate` per block advancing the register's series by the block
  size, use, voided-number report at closing; specs. Files: `pos/device/number-block.service.ts`.
- [ ] **T41**. `/pos/sync`: per-device sequence ordering, exactly-once by device ids, result codes, notices (price
  difference, stock shortfall, clock skew), never reprice; replay, out-of-order and crash tests. Files:
  `pos/sync/pos-sync.service.ts`, `pos/sync/pos-sync.controller.ts`.
- [ ] **T42**. Register offline store and queue (IndexedDB, encrypted unsent sales); the register page's chunk and
  assets in an asset group of `apps/gauzy/ngsw-config*.json`, installed with the Gauzy web app's manifest; offline
  limits; e2e test of an hour offline and a resync. Files: `posui/offline/offline-store.ts`,
  `posui/offline/sync-queue.service.ts`, `apps/gauzy/ngsw-config.json`, `apps/gauzy/ngsw-config.prod.json`.
- [ ] **T43**. Unsent indicator in the register; `pos.unsent.watch` job and closing rules with missing counts; specs.
  Files: `pos/device/unsent-watch.job.ts`, `pos/closing/missing-sales.rules.ts`, `posui/register/unsent-indicator.component.ts`.
- [ ] **T44**. Pack-change hints from `catalog.*`, `pricing.*`, `promotion.promotion.changed` and the existing CQRS
  `InventoryLevelChangedEvent` / `InventoryLevelLowEvent` / `InventoryLevelOutOfStockEvent` (moved to the outbox
  `inventory.level.changed` consumer once bridged); subscription in the register; no stock polling; e2e of the
  2-second update. Files: `pos/device/pack-change.handlers.ts`, `posui/register/pack-change.subscription.ts`.
- [ ] **T45**. Live dashboard `/pos/dashboard` and page (open shifts, sales per register and hour, offline devices,
  unsent sales) on real-time hints. Files: `pos/dashboard/pos-dashboard.controller.ts`,
  `posui/dashboard/pos-dashboard.component.ts`. Test: the dashboard figures follow a new sale and a closed shift without a reload.
- [ ] **T46**. Timer start and stop on shift open and close, attendance check-in and check-out through the port when
  present; sales per worked hour report; specs. Files: `pos/shift/shift-timer.handler.ts`,
  `pos/reports/sales-per-worked-hour.dataset.ts`.
- [ ] **T47**. Tier evaluation job and contact group membership sync limited to the memberships it created
  (`loyalty_member.tierGroupMembershipId`); tier change history; specs, including a customer added to the tier's group
  by hand staying there when they leave the tier. Files: `loy/member/tier-evaluation.job.ts`,
  `loy/member/tier-group-sync.service.ts`.
- [ ] **T48**. Campaign simulation `/loyalty/programmes/:id/simulate-campaign` over past documents; specs. Files:
  `loy/programme/campaign-simulation.service.ts`.
- [ ] **T49**. Weekly anomaly job, `/pos/anomalies`, Inbox item, anomalies page; specs. Files: `pos/anomaly/anomaly.job.ts`,
  `pos/anomaly/anomaly.controller.ts`, `posui/dashboard/anomalies.component.ts`.
- [ ] **T50**. MCP tools `list_cashier_anomalies`, `adjust_loyalty_points`, `simulate_loyalty_campaign` with
  `preview`; tests that a preview writes nothing. Files: `packages/mcp-server/src/lib/tools/pos.ts`,
  `packages/mcp-server/src/lib/tools/loyalty.ts`.
- [ ] **T51**. Nightly loyalty reconciliation job and difference report; reservation expiry job; specs. Files:
  `loy/ledger/reconcile.job.ts`, `loy/ledger/reservation-expiry.job.ts`.
- [ ] **T52**. Spec status `Implemented`; checklist rows updated. Test: every acceptance criterion of `spec.md` §7 demonstrated before the status changes.
- [ ] **T54**. Provide the ports other features bind to (plan, **Consumer tokens answered**): `PORTAL_LOYALTY`. Files: `apps/api/src/plugin-composition.ts`. Test: one contract test per token over the shape its consumer plan states; with this feature off each consumer keeps its stated fallback.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Access and gates | T2, T3, T4 |
| FR-2–FR-3 | §3.1 Access and gates | T4 |
| FR-4–FR-5 | §3.2 Registers | T10 |
| FR-6 | §3.2 Registers | T10, T13 |
| FR-7 | §3.2 Registers | T10, T12 |
| FR-8 | §3.2 Registers | T10, T13 |
| FR-9 | §3.2 Registers | T23 |
| FR-10 | §3.2 Registers | T10 |
| FR-11 | §3.3 Shifts and cash | T11, T28 |
| FR-12 | §3.3 Shifts and cash | T46 |
| FR-13 | §3.3 Shifts and cash | T11, T29 |
| FR-14 | §3.3 Shifts and cash | T11, T29 |
| FR-15–FR-16 | §3.3 Shifts and cash | T11 |
| FR-17 | §3.3 Shifts and cash | T16, T43 |
| FR-18 | §3.3 Shifts and cash | T16, T29 |
| FR-19 | §3.4 Selling | T23, T28 |
| FR-20 | §3.4 Selling | T13, T28 |
| FR-21 | §3.4 Selling | T28 |
| FR-22 | §3.4 Selling | T28 |
| FR-23 | §3.4 Selling | T10, T28 |
| FR-24 | §3.4 Selling | T13 |
| FR-25 | §3.4 Selling | T28 |
| FR-26 | §3.4 Selling | T9, T12 |
| FR-27 | §3.5 Payment | T12, T28 |
| FR-28 | §3.5 Payment | T12, T22 |
| FR-29 | §3.5 Payment | T12, T28 |
| FR-30 | §3.5 Payment | T12 |
| FR-31 | §3.5 Payment | T22 |
| FR-32 | §3.5 Payment | T22 |
| FR-33 | §3.6 Receipts | T14, T32 |
| FR-34 | §3.6 Receipts | T12, T29 |
| FR-35 | §3.6 Receipts | T14, T40 |
| FR-36–FR-39 | §3.7 Returns | T15 |
| FR-40 | §3.8 Offline selling and sync (advanced) | T42 |
| FR-41 | §3.8 Offline selling and sync (advanced) | T37, T41 |
| FR-42 | §3.8 Offline selling and sync (advanced) | T38, T40 |
| FR-43 | §3.8 Offline selling and sync (advanced) | T39, T42 |
| FR-44–FR-45 | §3.8 Offline selling and sync (advanced) | T41 |
| FR-46 | §3.8 Offline selling and sync (advanced) | T43 |
| FR-47 | §3.9 Real time and accounting | T38, T44 |
| FR-48 | §3.9 Real time and accounting | T45 |
| FR-49 | §3.9 Real time and accounting | T16, T26 |
| FR-50 | §3.9 Real time and accounting | T16 |
| FR-51 | §3.10 Loyalty programmes | T17, T31 |
| FR-52 | §3.10 Loyalty programmes | T17 |
| FR-53 | §3.10 Loyalty programmes | T47 |
| FR-54 | §3.10 Loyalty programmes | T19, T25 |
| FR-55 | §3.10 Loyalty programmes | T24 |
| FR-56 | §3.10 Loyalty programmes | T25 |
| FR-57 | §3.11 Points ledger | T18 |
| FR-58 | §3.11 Points ledger | T18, T19, T25 |
| FR-59 | §3.11 Points ledger | T18 |
| FR-60 | §3.11 Points ledger | T24 |
| FR-61 | §3.11 Points ledger | T18 |
| FR-62 | §3.11 Points ledger | T18 |
| FR-63 | §3.11 Points ledger | T18, T51 |
| FR-64 | §3.12 Redemption | T20 |
| FR-65 | §3.12 Redemption | T20, T53 |
| FR-66 | §3.12 Redemption | T25 |
| FR-67 | §3.13 Reports and agents | T21, T25, T46 |
| FR-68 | §3.13 Reports and agents | T34, T50 |
| FR-69 | §3.13 Reports and agents | T49 |
| FR-70 | §3.13 Reports and agents | T26 |
| FR-71 | §3.12 Redemption | T53 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs; the points-ledger trigger refuses updates on each.
- Flags default off; enabling them in dev shows a register selling online and offline end to end.
- Constitution gates in `spec.md` §9 confirmed.
- A replayed sync batch records nothing twice; a crash between order and payment recovers on retry.
- No register sale appears in two closings; a late sale produces a correction closing.
- Online sale completion P95 < 800 ms and sync of 500 sales < 30 s measured on PostgreSQL.
