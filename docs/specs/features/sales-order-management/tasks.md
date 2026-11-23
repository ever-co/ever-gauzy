# Task Breakdown: Sales order management

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `sales-order-management`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind the feature flag: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it.
- Each task that adds a controller, resolver, route, scheduler, consumer or event append carries its gate in the same PR (`@FeatureFlag(FEATURE_SALES)` and the sub-feature of T2 where one applies, or the flag check of the job or consumer) with a test that the addition answers `404` or does nothing while the flag is off; T62 then checks the whole spec end to end.
- Paths below are relative to `packages/plugins/order/src/lib/` unless they start with `packages/`, `apps/` or `docs/`.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts: `packages/contracts/src/lib/order-quotation.model.ts`, `sales-master.model.ts` (contact and
  group sales values with sources), `sales-commission.model.ts`, `sales-blanket-order.model.ts`, `sales-credit.model.ts`;
  additive fields and enums (`OrderLineOfferRole`, `OrderLineServiceMode`, `OrderCreditState`, `PromiseReason`) in
  `order.model.ts`, additive fields on `IOrganizationContact` and `IContactGroup`; exports in `index.ts`. Test: enum
  and shape snapshot spec.
- [ ] **T2**. Feature and setting contributions in `order.features.ts`: `FEATURE_SALES`, `FEATURE_BLANKET_ORDERS`,
  `FEATURE_SALES_COMMISSIONS` (default off, depend on `FEATURE_ORDER`), the `sales.*` setting keys of spec FR-91 with
  defaults, including the organization-level customer defaults (no settings table). Test: `order.features.spec.ts`
  (defaults off, keys unique).
- [ ] **T3**. Permission contributions with `defaultFor` in `order.permissions.ts` (existing tenants through the
  permission reload; no seed migration). Test: permission catalogue spec. Migration timestamps: `1791000020100` to `1791000020199` (`packages/plugins/order`); `1791000020900` to `1791000020999` (`packages/core`).
- [ ] **T4**. Entities `quotation/order-quotation.entity.ts` (`shareId` for the `shared_entity` link),
  `order-quotation-revision.entity.ts` (`acceptanceId` for the `terms_acceptance` evidence),
  `order-quotation-outcome-item.entity.ts` (CRM list items) with MikroORM repositories; migration
  `1791000020100-CreateOrderQuotationTables` (shared core migration helpers) incl. the data step that wraps existing
  quoted orders. Test: migration up and down on SQLite; data step on a fixture with a `quoteInvoiceId`.
- [ ] **T5**. Order extension: columns on `order/order.entity.ts` (`holdReasonCode`, `holdUntil`, …),
  `order-line/order-line.entity.ts` (`promiseReason`, `promiseSourceId` beside the existing `promisedAt`); entities
  `order-line-schedule`, `proforma/order-proforma` (no lines column), `order-sales-share`; migration
  `1791000020110-AddOrderSalesColumns`. Test: migration spec; existing order specs stay green.
- [ ] **T6** (parallel). Kernel migration `1791000020900-ExtendContactAndGroupSalesColumns` with the entity columns on
  `OrganizationContact` and `ContactGroup` (core); entities in `sales-customer/` (item restrictions), `sales-team/`
  (territory with `teamId`, sales person, partner), `credit-control/sales-credit-decision.entity.ts` (orders and
  invoice reviews), `sales-delivery-terms/`; migrations `1791000020120-CreateSalesMasterTables` and
  `1791000020170-SeedSalesDeliveryTerms`. Test: migration specs, seed count.
- [ ] **T7** (parallel). Target (`goalKpiId`) and commission entities in `sales-team/` and `commission/`; migration
  `1791000020130-CreateSalesTargetCommissionTables`. Test: migration spec, unique entry key enforced.
- [ ] **T8** (parallel). Blanket order entities in `blanket-order/`; migration `1791000020140-CreateSalesBlanketOrderTables`.
  Test: migration spec.
- [ ] **T9** (parallel). `sales-report/sales-fact.entity.ts`; migration `1791000020150-CreateSalesFactTable`. Test:
  migration spec.
- [ ] **T10**. Ports in `order.types.ts` (`SALES_PRICING`, `SALES_DOCUMENTS`, `SALES_STOCK`, `SALES_PURCHASING`,
  `SALES_PRODUCTION`, `SALES_PROJECTS`, `SALES_GOALS`, `SALES_PAYOUTS`; provided `SALES_PARTY_GUARD`,
  `SALES_ITEM_RESTRICTIONS`) with fallback adapters; core optional token `ESTIMATE_ANSWER_ROUTER` in
  `packages/core/src/lib/invoice/estimate-answer/`; bindings in `apps/api/src/plugin-composition.ts`. Test: composition
  spec (every port bound or documented unbound).

## Phase 2 — Services, endpoints, events

- [ ] **T11**. `@FeatureFlag(FEATURE_ORDER)` on the 11 order controllers and GraphQL resolvers (`request-approval` and
  `approve` included, under `FEATURE_ORDER` only); `FEATURE_ORDER_APPROVALS` read by the threshold routing in the place
  path; migration `1791000020180-EnableOrderFeatureForTenantsWithOrders` (enabled toggle for every tenant with an
  order). Test: e2e — `404` with the feature off, unchanged answers with it on; `approve` confirms a placed order with
  `FEATURE_ORDER_APPROVALS` off; a tenant with orders and the toggle off is enabled by the migration.
- [ ] **T12**. Estimate answer routing: `quotation/estimate-answer.router.ts` implementing `ESTIMATE_ANSWER_ROUTER`;
  consulted by `packages/core/src/lib/public-share/invoice/commands/handlers/public-invoice-update.handler.ts` and the
  estimate status route before conversion. Test: handler spec — a quotation-owned estimate places the order and is never
  converted, and with `convertAcceptedEstimates` on the order is invoiced once; a standalone estimate behaves as before.
- [ ] **T13**. Order confirmation: email template `order-confirmation` (one template for every order source with a
  variant per channel; seed migration, all locales), sender on `order.confirmed` for Sales-app orders and, where
  `sales.confirmationEmailForExistingSources` is on (default off), for checkout and other existing sources,
  `POST /orders/:id/confirmation/send`, opt-out flags. Files: `order-confirmation/order-confirmation.service.ts`,
  `order-confirmation/order-confirmation.controller.ts`, `order-confirmation/order-confirmation.listener.ts`,
  `database/migrations/1791000020190-SeedOrderConfirmationEmailTemplate.ts`,
  `packages/core/src/lib/core/seeds/data/default-email-templates/order-confirmation/en/html.mjml` (and `subject.hbs`,
  every locale). Test: service spec, e2e resend; a checkout order sends no email with the setting off.
- [ ] **T14**. Quotation service (`quotation/order-quotation.service.ts`): create (blank, deal, copy, template), number
  from `SALES_DOCUMENTS` (fallback core sequence key `QUOTATION`), pure `quotation-snapshot.ts` (snapshot and
  fingerprint), send (revision via `ORDER_INVOICING`, supersede, the `shared_entity` link created or renewed), revise,
  compare; controller routes. Test: unit specs per function; e2e send and revise.
- [ ] **T15**. Route `/orders/:id/quote/send|accept|decline` through the quotation service (`order-invoicing.service.ts`).
  Test: contract tests — request and response shapes unchanged.
- [ ] **T16**. Options and alternatives: `PUT /order-quotations/:id/lines/:lineId/offer`, pure `offer-totals.ts` (base and
  full totals, one per group), selection application. Test: unit specs incl. empty group and two preferred lines refused.
- [ ] **T17**. Validity and expiry job (`quotation/quotation-expiry.scheduler.ts`, worker, in-process fallback; the
  link expires with the quotation; quotations without `validUntil`, such as those wrapping older quotes, never expire),
  lost with reasons and chosen alternatives from the CRM lists (`crm_list_item`, note only without that plugin), decline,
  approval before send (`SALES_QUOTATION` type). Test: job idempotency spec; e2e lost refused after acceptance; a
  wrapped older quote's link still answers after 30 days.
- [ ] **T18**. Staff acceptance: fingerprint check, selections applied, order placed, lead turned customer, missing-data
  list, accept-and-invoice for quotations without stocked lines, single winner; an expired quotation converted only
  where the organization allows ordering from expired quotations, recorded on the order. Files:
  `quotation/quotation-acceptance.service.ts`, `quotation/order-quotation.controller.ts` (`/accept`),
  `quotation/lead-to-customer.ts`. Test: unit and e2e incl. concurrent accept and decline; an expired quotation is
  refused with the setting off.
- [ ] **T19** (parallel). Convert a standalone estimate (`POST /order-quotations/from-estimate/:estimateId`). Files:
  `quotation/estimate-conversion.service.ts`, `quotation/order-quotation.controller.ts`. Test: spec with product and
  text items.
- [ ] **T20**. Order header and line rules: requested dates (defaulted from the order; required only by setting),
  buyer reference uniqueness per setting (default accepted), delivery terms, project and dimensions, pure
  `team-share.ts` (sum 100, no groups, no disabled or repeated people; team defaulted from the customer, frozen at
  confirmation), lines that need no shipping and are not tracked service lines counted delivered at confirmation.
  Test: unit specs; with default settings a checkout order without requested dates and with a repeated buyer reference
  is placed as today; a non-shipping line is delivered on confirmation.
- [ ] **T21**. Line entry: prices, discounts, free items and tax on entry through `SALES_PRICING` (the pricing quote over
  the cart's chain), pure `entry-guards.ts`, sales units, customer item code, bundle explosion
  (`order-line/bundle-expansion.ts`), stock per line (on hand, reserved, available, incoming, projected) through
  `SALES_STOCK` at `GET /orders/:id/availability`, unit cost and margin for `SALES_MARGIN_VIEW` holders. Test: guard
  matrix spec; bundle spec; unit cost and margin are hidden without `SALES_MARGIN_VIEW`, while stock availability is
  shown to every reader of the order (FR-48, FR-49).
- [ ] **T22**. Hold and resume as the document engine's `hold` / `release` through `SALES_DOCUMENTS` (the order keeps
  `holdReasonCode` and `holdUntil`; the reason code alone while the engine is off), `order.hold-release` job, close,
  line close and reopen (`order/order-hold.service.ts`), releasing reservations through `SALES_STOCK`. Test: state
  specs; e2e hold blocks invoice creation.
- [ ] **T23** (parallel). Order change validation extension (`order-change/order-change-guards.ts`): below delivered,
  invoiced, picked or purchased; locked lines; held or closed orders; `SALES_PRICE_OVERRIDE` for price changes only
  where the organization restricts price edits. Test: unit matrix; an `ORDERS_EDIT` holder changes a price with the
  setting off.
- [ ] **T24** (parallel). Delivery schedule portions (`order-line/order-line-schedule.service.ts`, pure generator).
  Test: generator spec; sum above quantity refused.
- [ ] **T25**. Reservation requests (`POST /orders/:id/reservations`, release, auto on confirm, re-reserve on return).
  Files: `order-reservation/order-reservation.service.ts`, `order-reservation/order-reservation.controller.ts`,
  `order-reservation/order-return-rereserve.listener.ts`. Test: spec with a stubbed `SALES_STOCK` (partial on and off).
- [ ] **T26**. Purchase orders from an order (back-to-back, drop-ship), requisition, production request (answers
  `PRODUCTION_UNAVAILABLE` while unbound), pick list, with `preview`. Files:
  `order-sourcing/order-purchase-orders.service.ts`, `order-sourcing/order-requisition.service.ts`,
  `order-sourcing/order-production-request.service.ts`, `order-sourcing/order-pick-list.service.ts`,
  `order-sourcing/order-sourcing.controller.ts`. Test: grouping per supplier spec; e2e links.
- [ ] **T27**. Create-from-order: `POST /orders/bulk/invoice` starting a document-engine bulk run (order → invoice,
  per-order items; quantities already invoiced, returned or credited left out, beyond the order's tolerance refused),
  advance request, project for service lines (link only), maintenance hand-off event. Files:
  `order-invoicing/order-bulk-invoice.service.ts`, `order-invoicing/order-invoicing.service.ts`,
  `order-advance/order-advance-request.service.ts`, `order/order.controller.ts`. Test: bulk spec with 3 failing rows;
  a second invoice leaves out invoiced and returned quantities.
- [ ] **T28** (parallel). Proformas (`proforma/`) as engine document type `proforma`: issue with lines as engine
  document lines, `proforma` series, PDF through the print designer, email, `shared_entity` link, cancel; routes answer
  `404` while the engine is off. Test: service spec; no invoice row written.
- [ ] **T29** (parallel). Inter-company purchase order draft in the represented organization (system actor of that
  organization). Files: `inter-company/inter-company-order.service.ts`, `inter-company/inter-company-order.listener.ts`.
  Test: spec — link both ways, cancellation flags.
- [ ] **T30**. Credit control: pure `credit-limit.ts` (`organization_contact.creditLimit` → `contact_group` tree from the
  contact's `defaultGroupId` → `sales.*` setting), `credit-exposure.ts` (the contact's `creditUsed` reconciliation plus
  open receivables when invoicing reports them), overdue check, hold on placement or at delivery (`SALES_PARTY_GUARD`
  port for the delivery plugin), decisions as `sales_credit_decision` rows shared with the invoice credit reviews of
  `invoicing-receivables-payables` (written through `SALES_PARTY_GUARD`), buyer spending limits under
  `FEATURE_B2B_CREDIT`; checks run only where the organization's credit check stage is set (default `NONE`). Test: unit
  matrix; e2e hold and resume re-check; an order decision and an invoice review share the record; with the stage at its
  default a contact with a stored limit is never held.
- [ ] **T31**. Blocking as core `party_hold` rows (`CONTACT`, scopes ordering, receiving, billing, paying) through
  `PartyHoldService`, release by the core sweep; party guard used by quotation, order, delivery and order-to-invoice
  paths; held orders re-checked on `party_hold.*`. Files: `sales-customer/sales-customer-block.service.ts`,
  `sales-customer/sales-party.guard.ts`, `sales-customer/sales-customer-block.controller.ts`,
  `credit-control/party-hold.listener.ts`. Test: e2e refusal with reason; scope matrix spec.
- [ ] **T32**. Customer sales values (`sales-customer/`): resolution service over contact columns → group tree →
  `sales.*` settings with the source of each value, `/sales-customers/:contactId/defaults` and
  `/sales-customer-groups/:groupId/defaults` routes, group parent, item restrictions (`SALES_ITEM_RESTRICTIONS`),
  customer numbering, document chain checks, industry and market segment as tag types on contacts. Files:
  `sales-customer/sales-customer-defaults.service.ts`, `sales-customer/sales-customer.controller.ts`,
  `sales-customer/sales-item-restriction.service.ts`, `sales-customer/document-chain.guard.ts`. Test: inheritance spec;
  restriction enforcement spec; a delivery without a required order is refused.
- [ ] **T33** (parallel). Customer overview read model (`GET /sales-customers/:contactId/overview`), finance parts only
  with `INVOICES_VIEW`. Files: `sales-customer/sales-customer-overview.service.ts`,
  `sales-customer/sales-customer.controller.ts`. Test: permission-shaped response spec.
- [ ] **T34** (parallel). Territories (serving team), sales people (employee, plan, enabled; reassign; groups are
  organization teams), partners (referral code, public partner feed), targets, monthly weights, attainment published to
  the target's goal KPI through `SALES_GOALS`. Files: `sales-team/sales-territory.service.ts`,
  `sales-team/sales-person.service.ts`, `sales-team/sales-partner.service.ts`, `sales-team/public-partners.controller.ts`,
  `sales-team/sales-target.service.ts`, `sales-team/sales-team.controller.ts`. Test: tree and uniqueness specs;
  attainment spec net of returns; KPI value updated.
- [ ] **T35** (parallel). Blanket orders (`blanket-order/`): lifecycle, call-off with versioned line (single winner),
  allowance, give-back, expiry job. Test: concurrency spec; e2e allowance refusal.
- [ ] **T36** (parallel). Delivery terms and sales settings routes with audit entries. Files:
  `sales-delivery-terms/sales-delivery-terms.controller.ts`, `sales-delivery-terms/sales-delivery-terms.service.ts`,
  `sales-settings/sales-settings.controller.ts`, `sales-settings/sales-settings.service.ts`. Test: e2e; a settings
  change without `SALES_SETTINGS_EDIT` is refused and a change is audited.
- [ ] **T37**. Events: outbox appends of plan §5, consumer registrations, real-time hints, Inbox notices
  (`events/`). Test: append specs; consumer idempotency specs.
- [ ] **T38**. Sales facts consumer and report definitions (`sales-report/`) declared through
  `registerReportDefinitions`, Sales dashboard cards and charts. Test: one spec per definition on a fixture data set.
- [ ] **T39** (parallel). GraphQL reads for quotations, profiles and masters (`graphql/`), field binding check entry.
  Test: resolver specs.
- [ ] **T62**. `FEATURE_SALES` gate check: `@FeatureFlag(FEATURE_SALES)` (and `FEATURE_BLANKET_ORDERS`,
  `FEATURE_SALES_COMMISSIONS` where they apply) present on every controller and resolver this spec adds, each set by the
  task that added it; the schedulers,
  consumers and event appends of this spec do nothing for a tenant with the flag off. Files:
  `quotation/order-quotation.controller.ts`, `sales-customer/sales-customer.controller.ts`,
  `sales-team/sales-team.controller.ts`, `sales-settings/sales-settings.controller.ts`,
  `specs/sales-feature-gate.e2e.spec.ts`. Test: e2e, with `FEATURE_SALES` off every new route answers `404`, no job or
  event runs, and the order, cart, estimate and invoice routes answer exactly as before (contract snapshots).
- [ ] **T63** (parallel). Recurring quotations and orders through the document engine's recurrence (`SALES_DOCUMENTS`):
  a schedule on a quotation or order, each occurrence a new draft linked to its origin. Files:
  `recurrence/sales-recurrence.service.ts`, `recurrence/sales-recurrence.listener.ts`, `order/order.controller.ts`.
  Test: an occurrence is a new draft linked to its origin; with the engine off the schedule cannot be set.

## Phase 3 — UI surfaces

- [ ] **T40**. Scaffold `packages/plugins/order-ui` (package, project, jest, eslint), `order-ui.plugin.ts` registering
  `sales-sections` routes and menu entries under `FEATURE_SALES` and permissions, tab contributions for the existing
  contact page (shown only with `FEATURE_SALES` on; contact and group screens unchanged with it off), availability service hiding pages that answer `404`, i18n keys `SALES.*` in every locale of
  `packages/ui-core/i18n/`; `apps/gauzy` plugin config entry. Test: plugin spec, rendering test.
- [ ] **T41**. Orders: saved-view list, board and calendar; detail with tabs (lines, deliveries, invoices, payments,
  changes, timeline), hold, close, schedules, reservations, create-from actions; live updates. Files:
  `packages/plugins/order-ui/src/lib/components/orders/orders-list.component.ts`,
  `components/orders/orders-board.component.ts`, `components/orders/orders-calendar.component.ts`,
  `components/order-detail/order-detail.component.ts`, `services/orders.service.ts`. Test: component specs.
- [ ] **T42**. Quotation editor: line grid with options and alternatives, availability and margin columns, send dialog,
  revisions and diff, lost dialog, conversion from estimate. Files:
  `packages/plugins/order-ui/src/lib/components/quotations/quotation-editor.component.ts`,
  `components/quotations/quotation-line-grid.component.ts`, `components/quotations/quotation-send-dialog.component.ts`,
  `components/quotations/quotation-revisions.component.ts`, `components/quotations/quotation-lost-dialog.component.ts`,
  `services/quotations.service.ts`. Test: component specs; keyboard navigation test.
- [ ] **T43** (parallel). Customers: the existing contacts list filtered to customers and the existing contact page with
  tabs for overview, sales defaults with sources, buyers, restrictions and block dialog; group parent and defaults on
  the existing group screens. Files:
  `packages/plugins/order-ui/src/lib/components/customers/customer-overview-tab.component.ts`,
  `components/customers/customer-sales-defaults-tab.component.ts`,
  `components/customers/customer-restrictions-tab.component.ts`, `components/customers/customer-block-dialog.component.ts`,
  `components/customers/customer-group-defaults.component.ts`. Test: component specs.
- [ ] **T44** (parallel). Team pages: territories, sales people, partners, targets and attainment (groups of sales
  people on the existing Teams page); sales team shares on quotations and orders. Files:
  `packages/plugins/order-ui/src/lib/components/team/territories.component.ts`,
  `components/team/sales-people.component.ts`, `components/team/sales-partners.component.ts`,
  `components/team/sales-targets.component.ts`, `components/team/sales-team-shares.component.ts`. Test: component
  specs.
- [ ] **T45** (parallel). Blanket orders, proformas, delivery terms and settings pages (lost reasons are the CRM lists).
  Files: `packages/plugins/order-ui/src/lib/components/blanket-orders/blanket-orders.component.ts`,
  `components/proformas/order-proformas.component.ts`, `components/delivery-terms/delivery-terms.component.ts`,
  `settings/sales-settings-page.component.ts`. Test: component specs.
- [ ] **T46** (parallel). Banner on `apps/gauzy/src/app/pages/invoices/invoice-estimates` for issued copies, linking to the
  quotation. Files: `apps/gauzy/src/app/pages/invoices/invoice-estimates/invoice-estimates.component.ts`,
  `apps/gauzy/src/app/pages/invoices/invoice-estimates/estimate-view/estimate-view.component.ts`. Test: rendering test;
  a standalone estimate shows no banner.
- [ ] **T47**. Default print templates (quotation, order confirmation, proforma, open-order statement) through the print
  designer registry, with the existing PDF maker as fallback. Files: `print-templates/quotation.template.ts`,
  `print-templates/order-confirmation.template.ts`, `print-templates/proforma.template.ts`,
  `print-templates/open-order-statement.template.ts`, `print-templates/sales-print-templates.ts`. Test: render snapshot
  per template and locale sample.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T48**. MCP tools `packages/mcp-server/src/lib/tools/sales-quotations.ts`, `sales-orders.ts`, `sales-customers.ts`
  (`update_customer_sales_defaults`, `block_customer` through the party hold), `sales-blanket-orders.ts` (core tools of
  plan §7), registered in `register-all-tools.ts`. Test: input schema specs; preview writes nothing.
- [ ] **T49**. OpenAPI regenerated; SDK regeneration noted for release; docs site pages (Sales app, quotations, credit,
  commissions); `docs/specs/README.md` row; spec status `Implemented` for phases 1–2. Test: OpenAPI diff is additive; docs build.

## Phase 5 — Advanced capabilities

- [ ] **T50**. Credit holds as approval requests: `SALES_ORDER_CREDIT` payload (exposure breakdown, overdue items,
  payment history), `POST /orders/:id/credit/decision` (release once, raise limit, advance with automatic release on
  payment, reject) written as `sales_credit_decision` rows, one credit history with invoice reviews, Inbox notices;
  `ga-credit-panel`. Files: `credit-control/credit-hold-approval.service.ts`, `credit-control/credit-decision.controller.ts`,
  `credit-control/sales-credit-decision.entity.ts`,
  `packages/plugins/order-ui/src/lib/components/credit-panel/credit-panel.component.ts`. Test: e2e each decision.
- [ ] **T51**. Online quotation: `quotation/public-quotation.controller.ts` (token looked up through `shared_entity`,
  views counted there, totals, one-time code through `ACCESS_ONE_TIME_CODES`, accept with signature asset and a
  `terms_acceptance` evidence row, decline, question to Inbox, revoke, rate limits) and a quotation view of the
  existing public estimate page (`public-layout-ui`, `:type/:id/:token`, `InvoiceEstimateViewComponent`) with signature
  pad and typed alternative. Test: e2e token flows; accessibility test of the page; standalone estimates unchanged.
- [ ] **T52** (parallel). Acceptance certificate page appended to the revision PDF; live view tracking hints. Files:
  `quotation/acceptance-certificate.ts`, `quotation/quotation-view.hints.ts`,
  `packages/plugins/order-ui/src/lib/components/quotations/quotation-views-badge.component.ts`. Test: fingerprint
  verification spec; a view reaches the open quotation page live.
- [ ] **T53**. Promise service (`promise/promise-date.ts` pure: stock, incoming, lead time, production), the only writer
  of `order_line.promisedAt` (directly on drafts, through an `UPDATE_ORDER_PROPERTIES` order change once confirmed),
  refresh worker, `order.promise.changed`, at-risk view and Inbox notice, `ga-promise-badge`. Test: unit matrix;
  event-driven refresh spec; a move on a confirmed order appears in its history.
- [ ] **T54**. Commission plans and accrual consumer (`commission/`): rate, basis and tiers through the shared
  `packages/core/src/lib/money/commission.ts` (lifted from the marketplace's `seller-commission.service.ts`, which then
  uses it), category rates, earning event, clawback, reversal, unique keys. Test: unit matrix; idempotent replay spec;
  marketplace commission specs unchanged.
- [ ] **T55**. Commission statements: generate (core operation `SALES_COMMISSION_STATEMENTS`, preview), approve, pay (a
  party payout through `SALES_PAYOUTS`, or a pay element hand-off), PDF, `/mine`, accounting events; UI pages and my
  statements. Files: `commission/commission-statement.service.ts`, `commission/commission-statement.controller.ts`,
  `commission/commission-statements.operation.ts`,
  `packages/plugins/order-ui/src/lib/components/commissions/commission-statements.component.ts`,
  `components/commissions/my-commission-statements.component.ts`. Test: e2e 60/40 split from order to paid statement.
- [ ] **T56**. Service lines: `serviceMode`, project and task creation through `SALES_PROJECTS`, time log and task
  completion consumers updating delivered quantity. Files: `service-lines/service-line.service.ts`,
  `service-lines/service-line-progress.listener.ts`. Test: e2e tracked hours invoiced.
- [ ] **T57**. Document flow: `GET /orders/:id/flow` (engine links, plugin fallback), `ga-document-flow` exported and
  shown on quotation and order pages, offered to invoice and delivery pages, live on real-time hints. Files:
  `document-flow/order-document-flow.service.ts`, `order/order.controller.ts`,
  `packages/plugins/order-ui/src/lib/components/document-flow/document-flow.component.ts`. Test: flow spec with
  permission-hidden documents counted.
- [ ] **T58**. Agent tools: `draft_quotation_from_message`, `propose_line_substitutions`, `explain_order_margin`,
  `release_credit_hold`, `generate_commission_statements` with previews. Files:
  `packages/mcp-server/src/lib/tools/sales-quotations.ts`, `packages/mcp-server/src/lib/tools/sales-orders.ts`,
  `packages/mcp-server/src/lib/tools/sales-customers.ts`, `packages/mcp-server/src/lib/tools/sales-commissions.ts`,
  `assist/quotation-draft-from-message.service.ts`, `assist/order-margin-explainer.ts`. Test: fixture-based specs;
  preview writes nothing.
- [ ] **T59** (parallel). Sales events registered as automation triggers and webhook event types. Files:
  `events/sales-automation-triggers.ts`, `events/sales-webhook-events.ts`. Test: registry spec.
- [ ] **T60**. Existing document types (`business-document-engine` FR-113): `sales_order` and `quotation` register
  through `SALES_DOCUMENTS` with `preexisting: true`. Files: `order-platform-adapters.module.ts`,
  `documents/sales-document-types.ts`. Test: with the engine on and no type policy, an order placed at checkout is
  changed, cancelled and billed above a line's quantity exactly as today.
- [ ] **T61**. Provide the ports other features bind to (plan, **Consumer tokens answered**): `CRM_TERRITORIES`, `ITEM_PARTY_RESTRICTIONS`, `MANUFACTURING_SALES`, `PORTAL_ORDER_REQUESTS`, `PORTAL_QUOTATIONS`, `PROJECT_SALES_ORDERS`, `PURCHASING_SALES`, `SUBCONTRACTING_SALES`. Files: `apps/api/src/plugin-composition.ts`. Test: one contract test per token over the shape its consumer plan states; with this feature off each consumer keeps its stated fallback.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Presence and the Sales app | T2, T11, T40, T62 |
| FR-2 | §3.1 Presence and the Sales app | T40, T62 |
| FR-3 | §3.1 Presence and the Sales app | T41 |
| FR-4 | §3.1 Presence and the Sales app | T41 |
| FR-5 | §3.1 Presence and the Sales app | T21, T41 |
| FR-6 | §3.1 Presence and the Sales app | T13 |
| FR-7 | §3.1 Presence and the Sales app | T47 |
| FR-8 | §3.2 Quotations: one owner | T4, T14 |
| FR-9–FR-10 | §3.2 Quotations: one owner | T14, T19 |
| FR-11 | §3.2 Quotations: one owner | T21 |
| FR-12 | §3.2 Quotations: one owner | T16 |
| FR-13 | §3.2 Quotations: one owner | T17 |
| FR-14–FR-16 | §3.2 Quotations: one owner | T14 |
| FR-17 | §3.2 Quotations: one owner | T17 |
| FR-18–FR-19 | §3.2 Quotations: one owner | T17, T45 |
| FR-20 | §3.2 Quotations: one owner | T63 |
| FR-21–FR-22 | §3.3 Online acceptance | T51, T52 |
| FR-23–FR-24 | §3.3 Online acceptance | T51 |
| FR-25 | §3.3 Online acceptance | T18 |
| FR-26 | §3.3 Online acceptance | T18, T51 |
| FR-27–FR-28 | §3.3 Online acceptance | T18 |
| FR-29 | §3.4 Routing the core estimate | T12, T46 |
| FR-30 | §3.4 Routing the core estimate | T12 |
| FR-31 | §3.4 Routing the core estimate | T19 |
| FR-32 | §3.4 Routing the core estimate | T15 |
| FR-33–FR-35 | §3.5 Sales orders | T20 |
| FR-36 | §3.5 Sales orders | T41 |
| FR-37–FR-38 | §3.5 Sales orders | T22 |
| FR-39 | §3.5 Sales orders | T20 |
| FR-40 | §3.5 Sales orders | T23 |
| FR-41 | §3.5 Sales orders | T24 |
| FR-42 | §3.5 Sales orders | T27 |
| FR-43 | §3.5 Sales orders | T26, T27 |
| FR-44 | §3.5 Sales orders | T27 |
| FR-45 | §3.5 Sales orders | T28 |
| FR-46 | §3.5 Sales orders | T47 |
| FR-47 | §3.5 Sales orders | T11 |
| FR-48–FR-49 | §3.6 Line entry, guards, bundles and units | T21 |
| FR-50 | §3.6 Line entry, guards, bundles and units | T21, T23 |
| FR-51–FR-53 | §3.6 Line entry, guards, bundles and units | T21 |
| FR-54 | §3.7 Reservation, purchasing and production | T25 |
| FR-55–FR-56 | §3.7 Reservation, purchasing and production | T25 |
| FR-57–FR-61 | §3.7 Reservation, purchasing and production | T26 |
| FR-62 | §3.7 Reservation, purchasing and production | T29 |
| FR-63–FR-65 | §3.8 Credit control and blocking | T30 |
| FR-66–FR-67 | §3.8 Credit control and blocking | T50 |
| FR-68 | §3.8 Credit control and blocking | T30 |
| FR-69 | §3.8 Credit control and blocking | T31 |
| FR-70 | §3.8 Credit control and blocking | T30 |
| FR-71 | §3.9 Customers and groups | T32, T43 |
| FR-72 | §3.9 Customers and groups | T6, T32 |
| FR-73 | §3.9 Customers and groups | T30, T32 |
| FR-74–FR-75 | §3.9 Customers and groups | T32 |
| FR-76 | §3.9 Customers and groups | T33 |
| FR-77 | §3.9 Customers and groups | T32 |
| FR-78–FR-80 | §3.10 Territories, sales people, partners and targets | T34, T44 |
| FR-81 | §3.10 Territories, sales people, partners and targets | T20, T44 |
| FR-82 | §3.10 Territories, sales people, partners and targets | T34, T44 |
| FR-83–FR-84 | §3.11 Commissions | T54 |
| FR-85–FR-86 | §3.11 Commissions | T55 |
| FR-87 | §3.11 Commissions | T7, T54, T55 |
| FR-88 | §3.12 Blanket orders | T8, T35 |
| FR-89 | §3.12 Blanket orders | T35 |
| FR-90 | §3.13 Delivery terms and settings | T36, T45 |
| FR-91 | §3.13 Delivery terms and settings | T2, T36 |
| FR-92 | §3.14 Document flow, promise dates, service lines | T57 |
| FR-93 | §3.14 Document flow, promise dates, service lines | T53 |
| FR-94 | §3.14 Document flow, promise dates, service lines | T53 |
| FR-95 | §3.14 Document flow, promise dates, service lines | T56 |
| FR-96 | §3.15 Agents, automation and real time | T48, T58 |
| FR-97–FR-98 | §3.15 Agents, automation and real time | T58 |
| FR-99 | §3.15 Agents, automation and real time | T37, T59 |
| FR-100 | §3.15 Agents, automation and real time | T37, T41 |
| FR-101–FR-102 | §3.16 Reports | T38 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off for existing tenants; enabling it in dev shows the feature end to end; spec AC-20 holds with
  the sales settings at their defaults.
- Constitution gates in `spec.md` §9 confirmed.
- Contract tests prove the existing order, order-quote and estimate routes unchanged (shapes and status codes).
- The end-to-end demo runs on a fresh tenant: quotation → online acceptance → order → delivery → invoice → payment, with
  a price list and a promotion, and the document flow showing every step.
- Every report and card of spec §3.16 returns correct figures on the demo data set.
- Each MCP tool that writes has a preview test.
