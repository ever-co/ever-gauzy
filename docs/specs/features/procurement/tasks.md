# Task Breakdown: Procurement

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `procurement`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind the feature flags: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it. Paths are relative to the repository root; `pur/` means `packages/plugins/purchasing/src/lib/` and `ui/` means `packages/plugins/purchasing-ui/src/lib/`.
- Plan phase 1 ("surface what exists") is T5, T30 to T33, T36, T37, T45 and T50: no schema change, can ship first
  (they need only T1 to T4 and the ports of T14).
- Gating: every route checks `FEATURE_PURCHASING`; requisitions and the buying plan also
  `FEATURE_PURCHASE_REQUISITIONS`; sourcing and agreements `FEATURE_PURCHASE_SOURCING`; scorecards, supplier documents
  and risk `FEATURE_SUPPLIER_PERFORMANCE`; portal routes also `FEATURE_CUSTOMER_PORTAL`.
- Each new entity has its MikroORM and TypeORM repositories beside it in `repository/` and its DTOs in `dto/`, as
  `pur/purchase-order/` does today.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts `packages/contracts/src/lib/procurement.model.ts` (enums, supplier profile, group, document,
  risk, requisition, budget check, plan line, request for quotation, quotation, comparison, award, agreement,
  confirmation, shipping notice, return, exception, scorecard, score) and `party-hold.model.ts` (`IPartyHold`, scopes);
  export from `index.ts`; optional fields on the interfaces in `pur/purchasing.types.ts`. Test: contract compile spec.
- [ ] **T2**. Feature codes in `pur/purchasing.features.ts` (`FEATURE_PURCHASE_REQUISITIONS`,
  `FEATURE_PURCHASE_SOURCING`, `FEATURE_SUPPLIER_PERFORMANCE`, default off, depending on `FEATURE_PURCHASING`) and
  settings in new `pur/purchasing.settings.ts` (keeps `purchasing.overReceiptTolerancePercent`). Test: contribution spec.
- [ ] **T3**. Permissions in `pur/purchasing.permissions.ts` (18 new values with labels and groups) declared as
  permission contributions with `defaultFor` (plan §9). Test: catalogue spec and default grants per role.
- [ ] **T4**. Shared migration helpers in core `packages/core/src/lib/database/migration-helpers.ts` beside
  `check-constraint.helper.ts` (dialect, quoting, `hasColumn`, `hasIndex`, Postgres advisory lock, lifted from the task
  automations copy `packages/plugins/task-automations/src/lib/database/migration-helpers.ts`), exported from
  `@gauzy/core`; no copy in the plugin. Test: helper spec on SQLite.
- [ ] **T5** (parallel). Menu entry and route guard for `FEATURE_PURCHASING` in the Angular shell registration; the
  existing controllers already carry `@FeatureFlag`. Files: `apps/gauzy/src/app/pages/pages.routes.ts`,
  `apps/gauzy/src/app/pages/purchasing-feature.guard.ts`. Test: guard spec (flag off → hidden and refused).
- [ ] **T6**. Entity columns on `purchase-order.entity.ts`, `purchase-order-line.entity.ts`, `goods-receipt.entity.ts`,
  `goods-receipt-line.entity.ts`, `vendor-product-term.entity.ts`; migration `AddProcurementColumns` with SQLite
  rebuilds; `returns` plugin migration `AddReturnReasonAppliesTo`. Files:
  `pur/database/migrations/1791000084100-AddProcurementColumns.ts`,
  `packages/plugins/returns/src/lib/database/migrations/1791000084200-AddReturnReasonAppliesTo.ts`,
  `packages/plugins/returns/src/lib/order-return-reason/order-return-reason.entity.ts`. Test: migration spec on SQLite
  (up twice, existing rows intact; `CHK_goods_receipt_line_positive` replaced by `CHK_goods_receipt_line_received`, so a
  line with `quantity = 0`, `damagedQuantity = 0` and `rejectedQuantity = 2` is stored and a line with no units is
  refused, on each dialect) and entity mapping spec for both ORMs; existing order and receipt specs green.
  Migration timestamps: `1791000084100` to `1791000084199` (`packages/plugins/purchasing`); `1791000084200` to `1791000084299` (`packages/plugins/returns`); `1791000084900` to `1791000084999` (`packages/core`).
- [ ] **T7**. Entities `pur/supplier/` (profile, group, contact role, document) + MikroORM and TypeORM repositories;
  migration `CreateSupplierTables`; core `party-hold/` entity, repositories and migration `CreatePartyHoldTable`. Files:
  `pur/supplier/supplier-profile.entity.ts`, `pur/supplier/supplier-group.entity.ts`,
  `pur/supplier/supplier-contact-role.entity.ts`, `pur/supplier/supplier-document.entity.ts`,
  `pur/database/migrations/1791000084110-CreateSupplierTables.ts`, `packages/core/src/lib/party-hold/party-hold.entity.ts`,
  `packages/core/src/lib/database/migrations/1791000084900-CreatePartyHoldTable.ts`. Test: migration and repository
  specs.
- [ ] **T8**. Entities `pur/requisition/` (requisition, line) and `pur/plan/` (plan line keyed by `operationId`);
  migration `CreateRequisitionTables`. Files: `pur/requisition/purchase-requisition.entity.ts`,
  `pur/requisition/purchase-requisition-line.entity.ts`, `pur/plan/purchase-plan-line.entity.ts`,
  `pur/database/migrations/1791000084120-CreateRequisitionTables.ts`. Test: migration spec.
- [ ] **T9**. Entities `pur/sourcing/` (request, line, supplier, quotation, quotation line, award); migration
  `CreateSourcingTables`. Files: `pur/sourcing/request-for-quotation.entity.ts`,
  `pur/sourcing/request-for-quotation-line.entity.ts`, `pur/sourcing/request-for-quotation-supplier.entity.ts`,
  `pur/sourcing/supplier-quotation.entity.ts`, `pur/sourcing/supplier-quotation-line.entity.ts`,
  `pur/sourcing/sourcing-award.entity.ts`, `pur/database/migrations/1791000084130-CreateSourcingTables.ts`. Test:
  migration spec.
- [ ] **T10** (parallel). Entities `pur/agreement/`; migration `CreateAgreementTables`. Files:
  `pur/agreement/purchase-agreement.entity.ts`, `pur/agreement/purchase-agreement-line.entity.ts`,
  `pur/database/migrations/1791000084140-CreateAgreementTables.ts`. Test: migration spec.
- [ ] **T11** (parallel). Entities `pur/collaboration/` (confirmation, shipping notice, return, exception); migration
  `CreateSupplierCollaborationTables`. Files: `pur/collaboration/purchase-order-confirmation.entity.ts`,
  `pur/collaboration/shipping-notice.entity.ts`, `pur/collaboration/shipping-notice-line.entity.ts`,
  `pur/collaboration/purchase-return.entity.ts`, `pur/collaboration/purchase-return-line.entity.ts`,
  `pur/collaboration/purchase-exception.entity.ts`,
  `pur/database/migrations/1791000084150-CreateSupplierCollaborationTables.ts`. Test: migration spec.
- [ ] **T12** (parallel). Entities `pur/scorecard/` (card, criterion, band, fact, snapshot); migration
  `CreateScorecardTables`. Files: `pur/scorecard/supplier-scorecard.entity.ts`,
  `pur/scorecard/supplier-scorecard-criterion.entity.ts`, `pur/scorecard/supplier-scorecard-band.entity.ts`,
  `pur/scorecard/supplier-performance-fact.entity.ts`, `pur/scorecard/supplier-score-snapshot.entity.ts`,
  `pur/database/migrations/1791000084160-CreateScorecardTables.ts`. Test: migration spec.
- [ ] **T13**. Register all new entities and migrations in `pur/purchasing.module.ts`, `pur/purchasing.plugin.ts`,
  `migrations/index.ts`; no seed migration (the default grants are the `defaultFor` of T3). Test: plugin contributions
  report lists the permissions and grants; existing tenants receive them on permission reload.
- [ ] **T14**. Ports in `pur/purchasing.types.ts` (`PURCHASING_DOCUMENTS`, `_WORKFLOW`, `_BUDGET_CHECK`,
  `_STOCK_FIGURES`, `_STOCK_DOCUMENTS`, `_MAKE`, `_SUBCONTRACT`, `_BOM`, `_BILLS`, `_QUALITY`, `_PORTAL`,
  `_DOCUMENT_OUTPUT`, `_SALES`, `_PRICING`, `_RETURN_REASONS`) and the bindings available today in
  `apps/api/src/plugin-composition.ts`. Test: composition spec (unbound ports leave features hidden).

## Phase 2 — Services, endpoints, events

- [ ] **T15**. Supplier profile (country, address, active flag and terms read from the vendor and its contact), group
  tree with default cascade, contact roles, supplier addresses as core address-book rows (owner `VENDOR`, roles),
  allow-list check (`pur/supplier/supplier-profile.service.ts`, `supplier-group.service.ts`) + controllers
  (`pur/supplier/supplier-profile.controller.ts`, `pur/supplier/supplier-group.controller.ts`,
  `pur/supplier/supplier-contact-role.controller.ts`). Test: unit and e2e specs; no vendor fact stored twice.
- [ ] **T16**. Core `PartyHoldService` (`place`, `release`, `assertNotHeld(party, scope)`, release sweep,
  `party_hold.placed` / `.released`) and the supplier view `/purchasing/supplier-holds`; order, receipt, sourcing and
  agreement services call `assertNotHeld` for `VENDOR` parties. Files: `packages/core/src/lib/party-hold/party-hold.service.ts`,
  `packages/core/src/lib/party-hold/party-hold.module.ts`, `packages/core/src/lib/party-hold/party-hold-release.job.ts`,
  `pur/supplier/supplier-hold.controller.ts`, `pur/purchase-order/purchase-order.service.ts`,
  `pur/goods-receipt/goods-receipt.service.ts`. Test: hold matrix spec (FR-10); release on date.
- [ ] **T17**. Document registration with the document engine for the eight types; existing order and receipt numbers
  unchanged; the purchase order and goods receipt types register with `preexisting: true` (`business-document-engine`
  FR-113); order totals through the document totals pipeline (document discount on net or grand total, instalment
  schedule from the settlement term). Files: `pur/documents/purchasing-document-types.ts`,
  `pur/documents/purchasing-documents.adapter.ts`. Test: registration spec, numbering spec; with no type policy a
  purchase order and a receipt behave as today; a document discount on the grand total spreads over the lines.
- [ ] **T18**. Requisition service: create, lines, header defaults, submit, approve or reject through
  `PURCHASING_WORKFLOW` (permission fallback), hold, release, cancel, close lines; controller. Files:
  `pur/requisition/purchase-requisition.service.ts`, `pur/requisition/purchase-requisition.controller.ts`,
  `pur/requisition/dto/create-purchase-requisition.dto.ts`. Test: lifecycle spec.
- [ ] **T19**. Budget check (`pur/requisition/budget-check.service.ts`): `PURCHASING_BUDGET_CHECK` bound to
  `BudgetAvailabilityService.availability` (commitments are the budget records fed by the document events of T33)
  with the scope's approved requisition lines not ordered and open order lines passed as `pendingLines` (plan §2
  Commitments), project-budget fallback summing open requisition and order lines on read, controls. Test: unit spec per
  control action; no commitment row written by this plugin; with a stop budget of 100 and an 80 requisition approved
  whose event has not reached the commitment records, a 30 submit is refused with 20 remaining, and after the
  projection the 80 is counted once; an order line projected at 80 and amended to 90 makes a 15 submit refused with
  10 remaining before the amendment reaches the commitment records; an 80 approval that commits while a 30 submit's
  check runs leaves that submit passed (100 remaining at its check), the next check counts the 80, and once both are
  approved the remaining budget shows 10 over.
- [ ] **T20**. Route proposal and conversion (`requisition-conversion.service.ts`): to orders per supplier, transfer,
  issue, pick list, work order, subcontract order, customer receipt; per-line results (the request-for-quotation and
  quotation targets are added with sourcing in T27). Files: `pur/requisition/requisition-conversion.service.ts`,
  `pur/requisition/route-proposal.service.ts`. Test: conversion spec with partial failure.
- [ ] **T21**. Fill from bill of materials, sales order, reorder list and production plan; system-actor intake for the
  reorder job and planning. Files: `pur/requisition/requisition-fill.service.ts`,
  `pur/requisition/system-intake.service.ts`. Test: fill spec with unbound ports.
- [ ] **T22**. Fulfilment consumer `subscriber:purchasing-fulfilment` (orders, receipts, transfers, work orders,
  subcontract orders → sourced and fulfilled quantities, requester notices). Files:
  `pur/requisition/purchasing-fulfilment.consumer.ts`. Test: consumer spec, idempotency.
- [ ] **T23**. Order extensions in `purchase-order.service.ts` and `purchase-order-line.service.ts`: line kinds,
  schedule lines, line fields, minimums, price-chain rule with override, order approval through `PURCHASING_WORKFLOW`
  (the existing approval step without it), hold (document engine `hold` / `release`
  through `PURCHASING_DOCUMENTS`; the order's hold columns only while that port is unbound), line close and reopen,
  advance rule, drop-ship delivered quantity, sources, the expected-date check of spec FR-51 as a warning unless
  `purchasing.strictChecks` is on; `pur/subcontract/purchasing-subcontract.facade.ts` for subcontracting. Files:
  `pur/purchase-order/purchase-order.service.ts`, `pur/purchase-order-line/purchase-order-line.service.ts`,
  `pur/purchase-order/purchase-order.controller.ts`. Test:
  existing specs green + new unit specs; hold through the engine and through the fallback; an expected date before
  the order date accepted with a warning by default and refused with strict checks on.
- [ ] **T24**. Change sets on sent orders through `PURCHASING_DOCUMENTS` (revision, re-approval band, not below
  received). Files: `pur/purchase-order/purchase-order-change-set.service.ts`. Test: change-set spec.
- [ ] **T25**. Pricing order in `vendor-product-term.service.ts` resolution: the term of a valid agreement line → other
  live terms by priority → buying-list rules and discounts on top through `PURCHASING_PRICING` → item cost; preferred
  term as the default supplier; last price paid. Files: `pur/vendor-product-term/vendor-product-term.service.ts`. Test:
  resolution spec with and without the pricing port.
- [ ] **T26**. Agreements service: each line points at the supplier term that prices it (created with the agreement's
  validity when none fits), activation, call-off accumulation, allowance refusal, reopen re-check, expiry warnings.
  Files: `pur/agreement/purchase-agreement.service.ts`, `pur/agreement/purchase-agreement.controller.ts`,
  `pur/agreement/agreement-consumption.service.ts`. Test: unit spec; no second price store.
- [ ] **T27**. Sourcing services: request, invitations (tag and group, hold and contact checks), template preview,
  quotations (manual, duplicate refusal, expiry), code and lead time write-back, zero-quantity lines; requisition lines
  converted into a request for quotation or a supplier quotation. Files: `pur/sourcing/request-for-quotation.service.ts`,
  `pur/sourcing/request-for-quotation.controller.ts`, `pur/sourcing/rfq-invitation.service.ts`,
  `pur/sourcing/supplier-quotation.service.ts`, `pur/sourcing/supplier-quotation.controller.ts`,
  `pur/requisition/requisition-conversion.service.ts`. Test: unit specs.
- [ ] **T28**. Rounds, sealed answers and opening, comparison with weighted scores, awards and conversion (orders,
  agreement, bill, customer quotation), outcomes to suppliers. Files: `pur/sourcing/rfq-rounds.service.ts`,
  `pur/sourcing/sealed-answers.guard.ts`, `pur/sourcing/quotation-comparison.service.ts`,
  `pur/sourcing/sourcing-award.service.ts`. Test: sealed-read spec across REST, GraphQL, MCP.
- [ ] **T29**. Receipts: rejected quantities and location, standalone receipts, receipts linked to a shipping notice
  when one is given (notice entry and prefill in T54), inspection hold through `PURCHASING_QUALITY`, putaway rules, lot
  bundles, asset event, inter-organization receipt, the future-date check of spec FR-75 as a warning unless
  `purchasing.strictChecks` is on. Files: `pur/goods-receipt/goods-receipt.service.ts`,
  `pur/goods-receipt-line/goods-receipt-line.service.ts`, `pur/goods-receipt/dto/create-goods-receipt.dto.ts`. Test: existing
  `goods-receipt.service.spec.ts` green + new cases; a receipt dated tomorrow posts with a warning by default and is
  refused with strict checks on.
- [ ] **T30**. Print and send: `GET /purchase-orders/:id/print`, send with email and portal publish through
  `PURCHASING_DOCUMENT_OUTPUT`; default templates (request, order, drop-ship, return, notice, open orders). Files:
  `pur/output/purchasing-output.service.ts`, `pur/output/purchasing.print-templates.ts`,
  `pur/purchase-order/purchase-order.controller.ts`. Test: rendering spec per template.
- [ ] **T31** (parallel). Document flow endpoint `GET /purchase-orders/:id/flow`. Files: `pur/purchase-order/purchase-order-flow.service.ts`,
  `pur/purchase-order/purchase-order.controller.ts`. Test: e2e.
- [ ] **T32** (parallel). Bills from receipts and chain rules through `PURCHASING_BILLS`; billed share per receipt.
  Files: `pur/billing/receipt-billing.service.ts`. Test: port contract spec.
- [ ] **T33** (parallel). Domain events of §5 appended through the outbox from every service. Files:
  `pur/events/purchasing.events.ts`. Test: event spec per lifecycle step; open order lines publish their incoming
  quantities.
- [ ] **T34**. Purchase returns service: against receipt or standalone, from accepted or rejected, valuation at
  receipt, returned quantities, credit or replacement request, governed reason through `PURCHASING_RETURN_REASONS`
  (free text only when the returns plugin is absent). Files: `pur/collaboration/purchase-return.service.ts`,
  `pur/collaboration/purchase-return.controller.ts`. Test: unit and DB spec.
- [ ] **T35**. Settings controller `/purchasing/settings`. Files: `pur/settings/purchasing-settings.controller.ts`. Test: e2e.
- [ ] **T44**. Portal procurement controller `/portal/procurement/*` over `PURCHASING_PORTAL` (party resolution,
  requests and answers, orders, invoice upload). Files: `pur/portal/portal-procurement.controller.ts`,
  `pur/portal/portal-party.resolver.ts`. Test: cross-party isolation e2e.

## Phase 3 — UI surfaces

- [ ] **T36**. `packages/plugins/purchasing-ui` scaffold (lazy module, menu, routes, i18n keys in every locale; the
  catalogue link `pages/purchasing/purchase-orders` kept). Files: `ui/purchasing-ui.plugin.ts`, `ui/purchasing.routes.ts`,
  `packages/ui-core/i18n/assets/i18n/*.json`. Test: rendering spec.
- [ ] **T37**. Pages: purchase orders (list, form, lifecycle actions, flow), receipts, vendor terms. Files:
  `ui/purchase-orders/purchase-order-list.component.ts`, `ui/purchase-orders/purchase-order-form.component.ts`,
  `ui/receipts/goods-receipt-list.component.ts`, `ui/vendor-terms/vendor-terms.component.ts`,
  `ui/services/purchasing-api.service.ts`. Test: component specs.
- [ ] **T38**. Vendor page tabs through the slot registry (procurement fields, contacts, holds). Files:
  `ui/vendor-tabs/vendor-procurement-tab.component.ts`, `ui/vendor-tabs/vendor-contacts-tab.component.ts`,
  `ui/vendor-tabs/vendor-holds-tab.component.ts`, on `apps/gauzy/src/app/pages/vendors/vendors.component.ts`. Test:
  slot spec (flag off → page unchanged).
- [ ] **T39**. Pages: requisitions with live budget check, approvals, conversion dialog. Files:
  `ui/requisitions/requisition-list.component.ts`, `ui/requisitions/requisition-form.component.ts`,
  `ui/requisitions/conversion-dialog.component.ts`. Test: component specs.
- [ ] **T40** (parallel). Pages: requests for quotation, comparison grid with awards, quotations, agreements. Files:
  `ui/sourcing/rfq-list.component.ts`, `ui/sourcing/rfq-form.component.ts`, `ui/sourcing/comparison-grid.component.ts`,
  `ui/sourcing/quotations.component.ts`, `ui/agreements/agreements.component.ts`. Test: component specs.
- [ ] **T41** (parallel). Pages: returns, settings. Files: `ui/returns/purchase-returns.component.ts`,
  `ui/settings/purchasing-settings.component.ts`. Test: component specs.
- [ ] **T42**. Supplier portal blocks in `purchasing-ui` (requests and answers, orders, invoice upload) as Angular
  components mounted through the portal's `portal-sections` child routes. Files: `ui/portal/portal-rfq-answer.component.ts`,
  `ui/portal/portal-orders.component.ts`, `ui/portal/portal-invoice-upload.component.ts`. Test: rendering specs with
  a portal session.
- [ ] **T43** (parallel). Phone layouts of the requisition form, requisition status and approval pages of
  `purchasing-ui` in the installable Gauzy web app. Files: `ui/requisitions/requisition-form.component.scss`,
  `ui/requisitions/requisition-status.component.ts`. Test: rendering specs at phone width.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T45**. MCP tools file `packages/mcp-server/src/lib/tools/purchasing.ts` over the existing routes
  (`purchasing_order_status`, `purchasing_send_order`, `purchasing_record_receipt` and vendor term reads), registered
  in `register-all-tools.ts`. Test: input-schema spec and preview specs.
- [ ] **T46**. Chat entry: requisition drafting from text (`/purchase-requisitions/draft-from-text`) and the chat
  record action registration. Files: `pur/requisition/requisition-draft.service.ts`,
  `pur/requisition/purchasing-chat-actions.ts`. Test: draft spec (no write before confirmation).
- [ ] **T47**. Report datasets and definitions of FR-95 as `reports` contributions of the report builder (no report
  route). Files: `pur/reports/purchasing-report-datasets.ts`, `pur/reports/purchasing-report-definitions.ts`. Test:
  one dataset spec per report.
- [ ] **T48** (parallel). Dashboard template of FR-96 (`reports.dashboardTemplates`) shown on the purchasing dashboard
  page. Files: `pur/reports/purchasing-dashboard.template.ts`, `ui/dashboard/purchasing-dashboard.component.ts`. Test:
  dataset spec.
- [ ] **T49**. OpenAPI regenerated; SDK regeneration noted for release; import and export templates for suppliers,
  groups, terms, agreements, requisitions through `data-import-export`. Files: `pur/import/purchasing-import-templates.ts`, `packages/core/src/lib/bootstrap/swagger.ts`. Test: OpenAPI diff check (additive only).
- [ ] **T50** (parallel). Phase 1 report definitions on existing orders and receipts (open orders, history, trends,
  receipt trends). Files: `pur/reports/purchasing-phase1-reports.ts`. Test: dataset spec.
- [ ] **T64**. MCP tools of plan §7 for requisitions, budget check, comparison, award and returns
  (`purchasing_draft_requisition`, `purchasing_submit_requisition`, `purchasing_check_budget`,
  `purchasing_requisition_status`, `purchasing_compare_quotations`, `purchasing_award`, `purchasing_create_return`)
  with `preview: true` on submit, award and return. Files: `packages/mcp-server/src/lib/tools/purchasing.ts`. Test:
  `purchasing-tools.spec.ts`: input schemas; a preview writes nothing; sealed prices absent before opening.

## Phase 5 — Advanced capabilities

- [ ] **T51**. Buying plan as operation type `PURCHASING_PLAN_RUN` of the core operation runtime, started by the
  nightly tick `purchasing.plan.tick` (worker schedule in `PurchasingSchedulePlugin`, recorded in `job_execution`) or on
  demand: needs from buy lines and planning, stock figures through `PURCHASING_STOCK_FIGURES`, supplier choice,
  consolidation, rounding, order-by date, stored facts; lines keyed by `operationId`; variants with
  `isPurchaseAutomatically` follow FR-32. Files: `pur/plan/purchase-plan.operation.ts`, `pur/plan/purchase-plan.service.ts`,
  `pur/plan/purchase-plan.controller.ts`, `pur/plan/purchasing-plan.tick.ts`, `apps/worker/src/plugins.ts`. Test: golden
  scenarios spec; interrupted run resumes.
- [ ] **T52**. Plan explanation and "what if" (`plan-explanation.service.ts`) + MCP tool; plan conversion with
  per-line results; automatic ordering within the limit. Files: `pur/plan/plan-explanation.service.ts`,
  `pur/plan/plan-conversion.service.ts`, `packages/mcp-server/src/lib/tools/purchasing.ts`. Test: explanation spec,
  limit spec.
- [ ] **T53**. Supplier confirmations: portal confirm and propose, buyer decisions to change sets, confirmation sweep
  and reminder. Files: `pur/collaboration/order-confirmation.service.ts`,
  `pur/collaboration/order-confirmation.controller.ts`, `pur/collaboration/confirmations-sweep.job.ts`. Test: unit and e2e.
- [ ] **T54**. Shipping notices from portal and staff; receipt prefill. Files: `pur/collaboration/shipping-notice.service.ts`,
  `pur/collaboration/shipping-notice.controller.ts`. Test: unit spec.
- [ ] **T55**. Exception service and consumer `subscriber:purchasing-exceptions` (kinds of FR-85, tolerances,
  auto-clear, resolution actions). Files: `pur/collaboration/purchase-exception.service.ts`,
  `pur/collaboration/purchase-exception.controller.ts`, `pur/collaboration/purchasing-exceptions.consumer.ts`. Test:
  one spec per kind, clear spec; an over-receipt beyond tolerance accepted as an exception.
- [ ] **T56**. Scorecards: measures from facts, consumer `subscriber:purchasing-scores`, formula criteria with a
  restricted evaluator, bands and actions, monthly snapshot job. Files: `pur/scorecard/supplier-scorecard.service.ts`,
  `pur/scorecard/supplier-scorecard.controller.ts`, `pur/scorecard/purchasing-scores.consumer.ts`,
  `pur/scorecard/score-formula.ts`, `pur/scorecard/score-snapshot.job.ts`. Test: score spec, band contiguity spec,
  formula spec.
- [ ] **T57**. Supplier documents sweep (supplier reminder emails, buyer reminders through `REMINDERS`, expiry,
  document holds through `PartyHoldService`; files as core `image_asset`) and risk recompute. Files:
  `pur/supplier/supplier-documents.sweep.ts`, `pur/supplier/supplier-risk.service.ts`, `pur/supplier/risk-recompute.job.ts`.
  Test: sweep spec with a frozen clock.
- [ ] **T58**. Sourcing deadline job (`purchasing.rfq.deadlines`) and quotation and agreement expiry jobs. Files:
  `pur/sourcing/rfq-deadlines.job.ts`, `pur/sourcing/quotation-expiry.job.ts`, `pur/agreement/agreement-expiry.job.ts`.
  Test: job specs with a frozen clock.
- [ ] **T59**. Realtime hints and inbox items for approvals, awards, exceptions, documents, score changes. Files:
  `pur/events/purchasing-realtime.handler.ts`, `pur/events/purchasing-inbox.handler.ts`. Test: consumer spec.
- [ ] **T60**. User docs (docs site) and `docs/specs/README.md` index row (the spec status changes in T72). Test: docs build.
- [ ] **T61**. Subcontract receipts: hook `GOODS_RECEIPT_SUBCONTRACT` declared in `purchasing.types.ts` and called by
  `GoodsReceiptService` in the receipt transaction for `SUBCONTRACT` lines; the answered service quantity rolled into
  `purchase_order_line.receivedQuantity` and the unit cost carried on the receipt line. Files:
  `pur/purchasing.types.ts`, `pur/goods-receipt/goods-receipt.service.ts`. Test: a receipt of finished
  goods raises the service line's received quantity once; a refusal from the hook rolls the receipt back; reversing
  that receipt calls the hook's `reverse` step in the reversal's transaction, and its failure leaves the receipt posted; unbound, a
  `SUBCONTRACT` line is refused with the reason.
- [ ] **T62**. Provide the ports other features bind to (plan, **Consumer tokens answered**): `MANUFACTURING_PURCHASE_PRICES`, `MANUFACTURING_PURCHASING`, `PORTAL_SUPPLIER_ONBOARDING`, `PROJECT_PURCHASES`. Files: `apps/api/src/plugin-composition.ts`. Test: one contract test per token over the shape its consumer plan states; with this feature off each consumer keeps its stated fallback.
- [ ] **T63**. Supplier documents service and controller `/purchasing/supplier-documents`: file a document (type,
  number, issue and expiry dates, file as a core `image_asset`), replace, required document types per supplier group.
  Files: `pur/supplier/supplier-document.service.ts`, `pur/supplier/supplier-document.controller.ts`. Test:
  `supplier-document.service.spec.ts`: a filed document is valid until its expiry; replacing marks the old one
  replaced; a group's required type shows as missing on its suppliers.
- [ ] **T65**. MCP tools for the buying plan, scores, risk and exceptions (`purchasing_plan_lines`,
  `purchasing_convert_plan_lines`, `purchasing_supplier_score`, `purchasing_supplier_risk`,
  `purchasing_list_exceptions`) with `preview: true` on conversion. Files: `packages/mcp-server/src/lib/tools/purchasing.ts`.
  Test: `purchasing-tools.spec.ts`: input schemas; a conversion preview writes nothing.
- [ ] **T66**. Vendor page tabs Documents and Performance through the slot registry. Files:
  `ui/vendor-tabs/vendor-documents-tab.component.ts`, `ui/vendor-tabs/vendor-performance-tab.component.ts`. Test:
  slot spec (flag off → page unchanged); the performance tab shows score, band and history.
- [ ] **T67**. Pages: shipping notices and the exceptions queue with resolution actions. Files:
  `ui/shipping-notices/shipping-notices.component.ts`, `ui/exceptions/exceptions-queue.component.ts`. Test: component
  specs; resolving an exception by closing the line short records the reason.
- [ ] **T68**. Supplier portal route and block for order confirmation (`/portal/procurement/confirmations`): confirm
  an order or propose other quantities, dates or prices per line. Files: `pur/portal/portal-procurement.controller.ts`,
  `ui/portal/portal-confirmation.component.ts`. Test: `ui/portal/portal-confirmation.component.spec.ts` with a portal
  session; cross-party isolation e2e (another supplier's order answers `404`).
- [ ] **T69**. Supplier portal route and block for shipping notices (`/portal/procurement/notices`): a notice against one
  or several orders with lines, lots or serials, packages, carrier, tracking reference and arrival date. Files:
  `pur/portal/portal-procurement.controller.ts`, `ui/portal/portal-shipping-notice.component.ts`. Test:
  `ui/portal/portal-shipping-notice.component.spec.ts` with a portal session; a sent notice shows the order in transit.
- [ ] **T70**. Supplier portal route and block for supplier documents (`/portal/procurement/documents`): the supplier's
  filed documents with their expiry and the upload of a requested one. Files: `pur/portal/portal-procurement.controller.ts`,
  `ui/portal/portal-documents.component.ts`. Test: `ui/portal/portal-documents.component.spec.ts` with a portal session;
  another supplier's documents are never listed.
- [ ] **T71**. Supplier portal route and block for the scorecard (`/portal/procurement/score`): the supplier's own score
  and band with their criteria. Files: `pur/portal/portal-procurement.controller.ts`, `ui/portal/portal-score.component.ts`.
  Test: `ui/portal/portal-score.component.spec.ts` with a portal session; another supplier's score answers `404`.
- [ ] **T72**. Spec status `Implemented` and its `docs/specs/README.md` row, once T1–T71 have landed. Files:
  `docs/specs/features/procurement/spec.md`, `docs/specs/README.md`. Test: every acceptance criterion of `spec.md` §7
  demonstrated before the status changes.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Scope, flags and compatibility | T2, T5 |
| FR-2 | §3.1 Scope, flags and compatibility | T6, T23, T29, T38 |
| FR-3 | §3.1 Scope, flags and compatibility | T17 |
| FR-4 | §3.1 Scope, flags and compatibility | T33 |
| FR-5 | §3.2 Supplier master, holds, documents and risk | T15 |
| FR-6 | §3.2 Supplier master, holds, documents and risk | T7, T15 |
| FR-7–FR-8 | §3.2 Supplier master, holds, documents and risk | T15 |
| FR-9 | §3.2 Supplier master, holds, documents and risk | T15, T23 |
| FR-10 | §3.2 Supplier master, holds, documents and risk | T16 |
| FR-11 | §3.2 Supplier master, holds, documents and risk | T63, T66 |
| FR-12 | §3.2 Supplier master, holds, documents and risk | T57 |
| FR-13 | §3.2 Supplier master, holds, documents and risk | T57 |
| FR-14 | §3.3 Requisitions | T18 |
| FR-15 | §3.3 Requisitions | T46, T64 |
| FR-16–FR-18 | §3.3 Requisitions | T19 |
| FR-19 | §3.3 Requisitions | T18 |
| FR-20 | §3.3 Requisitions | T21 |
| FR-21 | §3.3 Requisitions | T20 |
| FR-22 | §3.3 Requisitions | T20, T27 |
| FR-23 | §3.3 Requisitions | T20 |
| FR-24 | §3.3 Requisitions | T21 |
| FR-25 | §3.3 Requisitions | T22 |
| FR-26 | §3.3 Requisitions | T18 |
| FR-27 | §3.3 Requisitions | T22 |
| FR-28 | §3.4 Buying plan (advanced) | T51 |
| FR-29 | §3.4 Buying plan (advanced) | T51 |
| FR-30 | §3.4 Buying plan (advanced) | T51, T52 |
| FR-31 | §3.4 Buying plan (advanced) | T52 |
| FR-32 | §3.4 Buying plan (advanced) | T51, T52 |
| FR-33 | §3.5 Requests for quotation and supplier quotations | T27 |
| FR-34 | §3.5 Requests for quotation and supplier quotations | T27 |
| FR-35 | §3.5 Requests for quotation and supplier quotations | T27 |
| FR-36 | §3.5 Requests for quotation and supplier quotations | T27 |
| FR-37 | §3.5 Requests for quotation and supplier quotations | T42, T44 |
| FR-38 | §3.5 Requests for quotation and supplier quotations | T27 |
| FR-39–FR-40 | §3.5 Requests for quotation and supplier quotations | T27 |
| FR-41 | §3.5 Requests for quotation and supplier quotations | T27, T58 |
| FR-42 | §3.5 Requests for quotation and supplier quotations | T28 |
| FR-43 | §3.5 Requests for quotation and supplier quotations | T28, T58 |
| FR-44 | §3.5 Requests for quotation and supplier quotations | T28 |
| FR-45–FR-46 | §3.5 Requests for quotation and supplier quotations | T28 |
| FR-47 | §3.6 Purchase agreements | T26 |
| FR-48 | §3.6 Purchase agreements | T25 |
| FR-49 | §3.6 Purchase agreements | T26 |
| FR-50 | §3.6 Purchase agreements | T26, T58 |
| FR-51 | §3.7 Purchase orders | T23 |
| FR-52 | §3.7 Purchase orders | T23, T25 |
| FR-53 | §3.7 Purchase orders | T23 |
| FR-54 | §3.7 Purchase orders | T17 |
| FR-55 | §3.7 Purchase orders | T23 |
| FR-56 | §3.7 Purchase orders | T23 |
| FR-57 | §3.7 Purchase orders | T23, T24 |
| FR-58 | §3.7 Purchase orders | T30 |
| FR-59 | §3.7 Purchase orders | T23 |
| FR-60 | §3.7 Purchase orders | T31, T32 |
| FR-61 | §3.7 Purchase orders | T24 |
| FR-62 | §3.7 Purchase orders | T23 |
| FR-63 | §3.7 Purchase orders | T23 |
| FR-64 | §3.7 Purchase orders | T33 |
| FR-65 | §3.7 Purchase orders | T56 |
| FR-66 | §3.7 Purchase orders | T32 |
| FR-67 | §3.7 Purchase orders | T23 |
| FR-68 | §3.7 Purchase orders | T23, T61 |
| FR-69 | §3.7 Purchase orders | T21, T62 |
| FR-70 | §3.8 Supplier self-service (advanced) | T42, T44, T68, T69, T70, T71 |
| FR-71 | §3.8 Supplier self-service (advanced) | T53, T68 |
| FR-72 | §3.8 Supplier self-service (advanced) | T53 |
| FR-73 | §3.8 Supplier self-service (advanced) | T54, T69 |
| FR-74 | §3.8 Supplier self-service (advanced) | T42, T44 |
| FR-75 | §3.9 Receipts and returns | T29 |
| FR-76 | §3.9 Receipts and returns | T29 |
| FR-77 | §3.9 Receipts and returns | T29, T55 |
| FR-78 | §3.9 Receipts and returns | T29 |
| FR-79–FR-80 | §3.9 Receipts and returns | T29 |
| FR-81 | §3.9 Receipts and returns | T29 |
| FR-82–FR-83 | §3.9 Receipts and returns | T34 |
| FR-84 | §3.9 Receipts and returns | T32 |
| FR-85 | §3.10 Buyer exception queue (advanced) | T55 |
| FR-86 | §3.10 Buyer exception queue (advanced) | T55 |
| FR-87 | §3.10 Buyer exception queue (advanced) | T55, T67 |
| FR-88 | §3.11 Supplier scorecards (advanced) | T56 |
| FR-89–FR-90 | §3.11 Supplier scorecards (advanced) | T56 |
| FR-91–FR-92 | §3.11 Supplier scorecards (advanced) | T56 |
| FR-93 | §3.12 Settings, printing, reports and agents | T2, T35 |
| FR-94 | §3.12 Settings, printing, reports and agents | T30 |
| FR-95 | §3.12 Settings, printing, reports and agents | T47, T50 |
| FR-96 | §3.12 Settings, printing, reports and agents | T48 |
| FR-97 | §3.12 Settings, printing, reports and agents | T45, T52, T64, T65 |
| FR-98 | §3.12 Settings, printing, reports and agents | T59 |
| FR-99 | §3.12 Settings, printing, reports and agents | T23, T29, T35 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag defaults stay off; enabling them in dev shows the feature end to end.
- Constitution gates in `spec.md` §9 confirmed.
- Existing purchasing specs (`purchase-order.service.spec.ts`, `goods-receipt.service.spec.ts`,
  `vendor-product-term.service.spec.ts` and the plugin's e2e suite) pass unchanged.
- Sealed answers proven unreadable before opening on every surface; portal routes proven party-isolated.
- Every acceptance criterion AC-1 to AC-13 demonstrated on a fresh tenant with the flags on.
