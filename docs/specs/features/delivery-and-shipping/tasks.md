# Task Breakdown: Delivery and shipping

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `delivery-and-shipping`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind the feature flag: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it.
- `F/` = `packages/plugins/fulfillment/src/lib/`, `R/` = `packages/plugins/returns/src/lib/`,
  `W/` = `packages/plugins/warehouse/src/lib/`, `FU/` = `packages/plugins/fulfillment-ui/src/lib/`,
  `RU/` = `packages/plugins/returns-ui/src/lib/`, `PL/` = `packages/plugins/public-layout-ui/src/lib/`. Every entity file
  has its `repository/type-orm-<name>.repository.ts` and `repository/mikro-orm-<name>.repository.ts` beside it, every
  controller its `dto/` folder, and each migration is listed in its plugin's migration list
  (`F/database/fulfillment-migrations.ts`, `W/database/migrations/index.ts`, the returns plugin's list).

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts: `packages/contracts/src/lib/delivery.model.ts`, `carrier-adapter.model.ts` (with the inbound
  verification types); the trip planning input and output are the types of the route planner package of
  `maintenance-and-field-service` T46; additive fields on
  fulfilment, shipping option and return interfaces; `ShippingPriceType.BANDED`; exports. Files:
  `packages/contracts/src/lib/fulfillment.model.ts` (`IFulfillment`, `IShippingOption`, `ShippingPriceType`),
  `R/returns.types.ts` (`IOrderReturn`, its lines and reasons), `packages/contracts/src/index.ts`. Test:
  `packages/contracts/src/lib/delivery.model.spec.ts` (shape and enum snapshot).
- [ ] **T2**. Feature and setting contributions: `FEATURE_DELIVERY_TRIPS` (default off) and `fulfillment.*` settings in
  `F/fulfillment.features.ts` (among them `fulfillment.shipmentNotices` and `fulfillment.requirePacking`, both default
  off); `returns.selfServiceEnabled`, `returns.windowDays`, `returns.autoApproveMaxValue` and
  `returns.invoicedSettlement` (`REFUND` by default, or `CREDIT_NOTE`) in `R/returns.features.ts`. Test:
  `F/fulfillment.features.spec.ts` and `R/returns.features.spec.ts` (defaults); with the defaults, the existing
  `F/fulfillment/fulfillment.service.spec.ts` and `R/order-return/order-return.service.spec.ts` pass unchanged.
- [ ] **T3**. Permission contributions with `defaultFor` in `F/fulfillment.permissions.ts`, `R/returns.permissions.ts`
  (existing tenants through the permission reload; no seed migration). Test: `F/fulfillment.permissions.spec.ts` and
  `R/returns.permissions.spec.ts` (keys and `defaultFor` per role). Migration timestamps: `1791000021100` to `1791000021199` (`packages/plugins/fulfillment`); `1791000021200` to `1791000021299` (`packages/plugins/warehouse`); `1791000021300` to `1791000021399` (`packages/plugins/returns`).
- [ ] **T4**. Columns on `F/fulfillment/fulfillment.entity.ts` (no promise or token column),
  `F/fulfillment-line/fulfillment-line.entity.ts`, `F/shipping-option/shipping-option.entity.ts`; migration
  `1791000021100-AddDeliveryColumns` (incl. the `BANDED` value) with the shared core migration helpers of `procurement` T4. Files:
  `F/database/migrations/1791000021100-AddDeliveryColumns.ts`, `F/database/fulfillment-migrations.ts`. Test:
  `F/database/fulfillment-migrations.spec.ts` (up and down on SQLite); existing fulfilment specs green.
- [ ] **T5**. Entities `F/carrier/` (preset, carrier account with `providerKey` and `inboundEndpointId`, consignment,
  tracking event) with MikroORM repositories; migration `1791000021110-CreateCarrierTables`. Files:
  `F/carrier/shipping-package-preset.entity.ts`, `F/carrier/carrier-account.entity.ts`,
  `F/carrier/delivery-consignment.entity.ts`, `F/carrier/fulfillment-tracking-event.entity.ts`,
  `F/database/migrations/1791000021110-CreateCarrierTables.ts`. Test: `F/database/fulfillment-migrations.spec.ts`
  (tables; unique event key).
- [ ] **T6** (parallel). Entities `F/trip/` (driver, vehicle, trip, stop, position); migration `1791000021120-CreateTripTables`.
  Files: `F/trip/delivery-driver.entity.ts`, `F/trip/delivery-vehicle.entity.ts`, `F/trip/delivery-trip.entity.ts`,
  `F/trip/delivery-trip-stop.entity.ts`, `F/trip/delivery-trip-position.entity.ts`,
  `F/database/migrations/1791000021120-CreateTripTables.ts`. Test: `F/database/fulfillment-migrations.spec.ts`.
- [ ] **T7** (parallel). Entities `F/proof/`, `F/installation/` (with `visitId`),
  `F/notification/delivery-contact-preference.entity.ts`; migration `1791000021130-CreateProofAndInstallationTables`.
  Files: `F/proof/delivery-proof.entity.ts`, `F/installation/delivery-installation.entity.ts`,
  `F/installation/delivery-installation-line.entity.ts`,
  `F/database/migrations/1791000021130-CreateProofAndInstallationTables.ts`. Test: `F/database/fulfillment-migrations.spec.ts`.
- [ ] **T8** (parallel). `W/pack-slip/pack-slip-package.entity.ts`; migration `1791000021200-CreatePackSlipPackageTable`.
  Files: `W/database/migrations/1791000021200-CreatePackSlipPackageTable.ts`, `W/database/migrations/index.ts`. Test:
  `W/database/pack-slip-package-migration.spec.ts` (table on SQLite; existing pack slips unchanged).
- [ ] **T9** (parallel). Return columns (`order_return`, `order_return_line`, `order_return_reason`; no token column);
  migration `1791000021300-AddReturnDeliveryColumns`. Files: `R/order-return/order-return.entity.ts`,
  `R/order-return-line/order-return-line.entity.ts`, `R/order-return-reason/order-return-reason.entity.ts`,
  `R/database/migrations/1791000021300-AddReturnDeliveryColumns.ts`. Test: `R/database/order-return-migration.spec.ts`;
  existing return specs green.
- [ ] **T10**. Ports `FULFILLMENT_PACKING`, `FULFILLMENT_PROJECTS`, `FULFILLMENT_VISITS`, `FULFILLMENT_ITEM_LOOKUP`,
  `FULFILLMENT_PARTY_GUARD`, `FULFILLMENT_INVOICING` in `F/fulfillment.types.ts`, `RETURNS_CREDIT_NOTE` in
  `R/returns.types.ts`, use of `GEOCODING_ADAPTERS`; bindings and documented fallbacks in
  `apps/api/src/plugin-composition.ts`. Test: `apps/api/src/plugin-composition.spec.ts` (each port bound when its
  plugin is loaded, its fallback otherwise).

## Phase 2 — Services, endpoints, events

- [ ] **T11**. `@FeatureFlag(FEATURE_FULFILLMENT)` on the five fulfilment controllers and the fulfilment GraphQL
  resolvers; data migration `1791000021150-EnableFulfillmentForActiveTenants`. Files:
  `F/fulfillment/fulfillment.controller.ts`, `F/fulfillment-line/fulfillment-line.controller.ts`,
  `F/shipping-option/shipping-option.controller.ts`, `F/shipping-profile/shipping-profile.controller.ts`,
  `F/shipping-profile-variant/shipping-profile-variant.controller.ts`, `F/graphql/fulfillment.resolver.ts`,
  `F/graphql/shipping-option.resolver.ts`, `F/graphql/shipping-profile-variant.resolver.ts`,
  `F/database/migrations/1791000021150-EnableFulfillmentForActiveTenants.ts`. Test: `F/graphql/feature-gates.spec.ts`
  and `F/database/fulfillment-migrations.spec.ts` (tenant with fulfilment rows keeps access, tenant without gets `404`);
  `packages/plugins/cart/src/lib/commerce-cart/commerce-cart.service.spec.ts` (checkout still prices shipping).
- [ ] **T12**. Deliveries from an order (`POST /fulfillments/from-order/:orderId`): due lines, chosen lines, due-by date,
  reserved only; one per dispatch warehouse; `preview`. Files: `F/fulfillment/fulfillment-from-order.service.ts`,
  `F/fulfillment/fulfillment.controller.ts`, `F/fulfillment/dto/create-fulfillment-from-order.dto.ts`. Test:
  `F/fulfillment/fulfillment-from-order.service.spec.ts` (each mode; a created delivery ships through the existing ship
  step, writing issue movements and `fulfillment.shipped`).
- [ ] **T13**. Direct delivery (`POST /fulfillments/direct`) creating its confirmed order through the order plugin;
  refusal when the customer requires an order. Files: `F/fulfillment/direct-delivery.service.ts`,
  `F/fulfillment/dto/create-direct-delivery.dto.ts`, `F/fulfillment/fulfillment.controller.ts`. Test:
  `F/fulfillment/direct-delivery.service.spec.ts` (order of source "direct delivery" created; refused when the customer
  requires an order).
- [ ] **T14**. Delivery rules: warehouse for stocked lines on the Delivery app's create routes (the existing create
  route keeps its checks), project of the customer, over-delivery tolerance with
  `FULFILLMENTS_OVER_DELIVER`, party guard (block refusal, credit-awaiting draft released on `order.credit.released`).
  Files: `F/fulfillment/fulfillment-rules.ts`, `F/fulfillment/fulfillment-party-guard.ts`,
  `F/fulfillment/fulfillment-credit-release.consumer.ts`. Test: `F/fulfillment/fulfillment-rules.spec.ts` (rule
  matrix).
- [ ] **T15** (parallel). Lots and serials on lines (bundle reference when `serials-and-batches` is present, text
  otherwise), inspection gate (unbound → no gate), `POST /fulfillments/:id/scan` resolving codes through
  `FULFILLMENT_ITEM_LOOKUP` (unbound → `product_variant.barcode`). Files: `F/fulfillment-line/fulfillment-line-lots.ts`,
  `F/fulfillment/fulfillment-inspection-gate.ts`, `F/fulfillment/fulfillment-scan.service.ts`,
  `F/fulfillment/dto/scan-fulfillment.dto.ts`. Test: `F/fulfillment/fulfillment-scan.service.spec.ts` (case barcode adds
  its quantity; beyond the line quantity warns) and `F/fulfillment/fulfillment-inspection-gate.spec.ts`.
- [ ] **T16**. Cancellation cascade: pack slips made by the delivery's packing voided through `FULFILLMENT_PACKING`
  (other pack slips untouched), the delivery's `tripStopId` cleared and the stop removed only when no other delivery
  remains on it, consignment cancelled with the carrier; a consignment that also
  carries other deliveries keeps them unbooked with their packages, labels voided and marked "needs rebooking" (spec
  FR-18), rebooked at once where the organization's automatic rate choice is on. Files:
  `F/fulfillment/fulfillment-cancel-cascade.ts`, `F/fulfillment/fulfillment.service.ts`, `W/pack-slip/pack-slip.service.ts`,
  `F/carrier/delivery-consignment.service.ts`. Test: `F/fulfillment/fulfillment-cancel-cascade.spec.ts` (stubbed
  adapter; packages voided; a pack slip made through `/pack-slips` stays open; cancelling delivery A of a consignment
  with A and B leaves B in the consignment with its packages and reservations, unbooked and marked for rebooking, and
  rebooks B at once with the automatic choice on; cancelling delivery A of a stop shared with B keeps the stop with B
  and removes the stop of a delivery alone on it; a stop after the carrier accepted the cancellation and before the
  local commit leaves A and B unchanged, and the repeat, with the adapter answering "already cancelled", cancels A and
  leaves B unbooked, marked for rebooking and without `externalId`).
- [ ] **T17**. Progress derivation (`F/fulfillment/fulfillment-progress.ts`, pure), the document flow
  (`GET /fulfillments/:id/flow`) and `POST /fulfillments/bulk/invoice` starting a document-engine bulk run through
  `FULFILLMENT_INVOICING` (per-order items). Files: `F/fulfillment/fulfillment-flow.service.ts`,
  `F/fulfillment/fulfillment-bulk-invoice.service.ts`, `F/fulfillment/fulfillment.controller.ts`. Test:
  `F/fulfillment/fulfillment-progress.spec.ts`; `F/fulfillment/fulfillment-bulk-invoice.service.spec.ts` (failing rows
  reported per order; one invoice per order).
- [ ] **T18** (parallel). Internal-customer receipt draft in the represented organization (system actor), price basis
  setting. Files: `F/fulfillment/internal-receipt.service.ts`. Test: `F/fulfillment/internal-receipt.service.spec.ts`
  (draft receipt with the same lines, lots and serials at order price or cost).
- [ ] **T19**. Packing: `GET|PUT /fulfillments/:id/packing`, presets CRUD, pure weight computation, maximum weight,
  pack-slip totals derived from its packages, require-packing gate on ship when `fulfillment.requirePacking` is on.
  Files: `F/packing/fulfillment-packing.service.ts`, `F/packing/fulfillment-packing.controller.ts`,
  `F/packing/package-weight.ts`, `F/carrier/shipping-package-preset.service.ts`,
  `F/carrier/shipping-package-preset.controller.ts`, `W/pack-slip/pack-slip.service.ts`. Test:
  `F/packing/package-weight.spec.ts`; `F/packing/fulfillment-packing.service.spec.ts` (packed over the line refused; over
  the maximum refused; with the setting off an unpacked delivery ships as today).
- [ ] **T20** (parallel). Banded shipping options in `F/shipping-option/shipping-option.service.ts` (subtotal or weight
  bands, above-last-band rule), the charge's tax category and analytic hint, and removal of ineligible charges on
  address or line change. Files: `F/shipping-option/shipping-option-bands.ts`,
  `F/shipping-option/shipping-charge-eligibility.ts`. Test: `F/shipping-option/shipping-option-bands.spec.ts` (band
  matrix); `F/shipping-option/shipping-charge-eligibility.spec.ts` (removed with a message).
- [ ] **T21**. Carrier registry and adapter interface (`F/carrier/carrier-adapter.registry.ts`) keyed by provider key
  (`region.fulfillmentProviderKeys`, `fulfillment.providerId`, `shipping_option.providerKey`), dispatcher bound to
  `FULFILLMENT_LABEL_PROVIDER`; plugin `packages/plugins/carrier-manual` (typed tracking, uploaded label); the existing
  return shipment issues return labels through the same registry. Files: `F/carrier/carrier-label.dispatcher.ts`,
  `F/return-shipment/return-shipment.service.ts`, `packages/plugins/carrier-manual/src/lib/carrier-manual.plugin.ts`,
  `packages/plugins/carrier-manual/src/lib/manual-carrier.adapter.ts`. Test: `F/fulfillment/fulfillment.controller.spec.ts`
  (label route contract unchanged with and without an adapter); `F/return-shipment/return-shipment.service.spec.ts`
  (return label for an approved return through the manual carrier).
- [ ] **T22**. Carrier accounts (`/carrier-accounts`, `/:id/test`) with credentials in the integration settings and,
  for adapters that push, an `integration-hub` inbound endpoint per account (`integration-hub` T21); `/carrier-adapters`
  listing. Files: `F/carrier/carrier-account.service.ts`, `F/carrier/carrier-account.controller.ts`,
  `F/carrier/carrier-adapters.controller.ts`. Test: `F/carrier/carrier-account.service.spec.ts` (credentials never in
  responses).
- [ ] **T23**. Consignments (`/delivery-consignments`): grouping rules, validations, booking with the manual carrier
  writing the fulfilment and pack-slip carrier columns from the consignment, manifest of the day (`W/carrier-manifest`),
  pickup request, cancel. Files: `F/carrier/delivery-consignment.service.ts`,
  `F/carrier/delivery-consignment.controller.ts`, `W/carrier-manifest/carrier-manifest.service.ts`. Test:
  `F/carrier/delivery-consignment.service.spec.ts` (refusals of FR-35; existing carrier columns filled as before).
- [ ] **T24**. Tracking events: store, normalise, deduplicate, manual events, status advance, `GET /fulfillments/:id/timeline`.
  Files: `F/carrier/tracking-event.service.ts`, `F/carrier/tracking-codes.ts`, `F/fulfillment/fulfillment.controller.ts`
  (`timeline`, `tracking-events`). Test: `F/carrier/tracking-event.service.spec.ts` (normalisation and dedupe).
- [ ] **T25** (parallel). Drivers and vehicles (`/delivery-drivers`, `/delivery-vehicles`) on employees, vendors and
  equipment (the vehicle row extends an equipment item; `EXPENSE_VEHICLES` adapter for `expenses-and-travel`), with
  validity rules. Files: `F/trip/delivery-driver.service.ts`, `F/trip/delivery-driver.controller.ts`,
  `F/trip/delivery-vehicle.service.ts`, `F/trip/delivery-vehicle.controller.ts`, `F/trip/expense-vehicles.adapter.ts`.
  Test: `F/trip/delivery-driver.service.spec.ts`, `F/trip/delivery-vehicle.service.spec.ts` (validity rules).
- [ ] **T26**. Trips (`/delivery-trips`): lifecycle, stops grouped by address, one active trip per delivery, capacity
  warning, refusals when made ready, manual order, lock, visited, trip sheet data, `/mine`. Files:
  `F/trip/delivery-trip.service.ts`, `F/trip/delivery-trip.controller.ts`, `F/trip/delivery-trip-stop.service.ts`,
  `F/trip/trip-sheet.ts`. Test: `F/trip/delivery-trip.service.spec.ts` (states; one active trip per delivery under
  concurrency; an invalid licence or insurance refuses ready).
- [ ] **T27**. Notices: email templates seed (every locale), contact preferences, notice sender consumer (shipment
  and dispatch notices only while `fulfillment.shipmentNotices` is on, never to a contact who opted out), tracking link as
  a `shared_entity` row of the delivery (expiry 90 days after delivery) and `GET /public/tracking/:token`. Files:
  `F/notification/delivery-notice.consumer.ts`, `F/notification/delivery-contact-preference.service.ts`,
  `F/notification/delivery-contact-preference.controller.ts`, `F/notification/tracking-link.service.ts`,
  `F/public/public-tracking.controller.ts`, `F/notification/email-templates/` (`delivery-shipped`,
  `delivery-dispatched`, `delivery-arriving`, `delivery-delivered`, `delivery-exception`, `return-authorised`; every
  locale). Test: `F/notification/delivery-notice.consumer.spec.ts` (notices per preference; with the setting on, start refused
  while the template is missing; with it off, a trip start and a shipped consignment send nothing; an opted-out
  contact gets no dispatch notice); `F/notification/tracking-link.service.spec.ts` (link revocation and expiry).
- [ ] **T28**. Returns depth (`R/order-return/`): optional delivery-bound lines (lines naming only an order line keep
  working), lot and serial ownership check, restock rule proposing the location (the caller's `warehouseId` and per-line
  restock choice still win), `POST /order-returns/:id/credit-note` via `RETURNS_CREDIT_NOTE` beside the existing refund,
  returned counters on fulfilment lines, refused-at-door return creation. Files: `R/order-return/order-return.service.ts`,
  `R/order-return/order-return-credit-note.service.ts`, `R/order-return/order-return.controller.ts`,
  `R/order-return-line/order-return-line.service.ts`, `R/order-return-reason/order-return-reason.service.ts`,
  `F/fulfillment-line/fulfillment-line.service.ts`. Test: `R/order-return/order-return-credit-note.service.spec.ts`;
  existing `R/order-return/order-return.service.spec.ts` receive and refund cases unchanged.
- [ ] **T29** (parallel). Installations (`/delivery-installations`): quantity bound, status on the delivery, uninstall on
  return, pending view; scheduling through `FULFILLMENT_VISITS` when field service is loaded. Files:
  `F/installation/delivery-installation.service.ts`, `F/installation/delivery-installation.controller.ts`. Test:
  `F/installation/delivery-installation.service.spec.ts` (with and without the visit port; installed above delivered
  minus returned refused; returned units marked uninstalled).
- [ ] **T30**. Events of plan §5: outbox appends, consumers, real-time hints, Inbox notices, `delivery.late-detector` job
  reading the order lines' `promisedAt` (and `order.promise.changed`). Files: `F/fulfillment-streamed-events.ts`,
  `R/returns-streamed-events.ts`, `F/notification/delivery-inbox.notices.ts`,
  `F/schedule/delivery-late-detector.scheduler.ts`, `F/schedule/delivery-late-detector.service.ts`. Test:
  `F/fulfillment-streamed-events.spec.ts` (appends and hints); `F/schedule/delivery-late-detector.service.spec.ts` (once
  per promise).
- [ ] **T31**. Report definitions of spec §3.12 and dashboard cards declared through `registerReportDefinitions`
  (`F/delivery-report/`). Files: `F/delivery-report/delivery-report.definitions.ts`,
  `F/delivery-report/delivery-dashboard.cards.ts`. Test: `F/delivery-report/delivery-report.definitions.spec.ts` (each
  definition on fixtures).
- [ ] **T32** (parallel). GraphQL additions to the fulfilment and returns schemas for the new fields and types. Files:
  `F/graphql/schema-extensions.ts`, `F/graphql/types.ts`, `R/graphql/schema-extensions.ts`. Test:
  `F/graphql/schema-extensions.spec.ts`, `R/graphql/schema-extensions.spec.ts`.
- [ ] **T58**. Line availability on deliveries: available stock at the line's warehouse and the lot's stock where
  tracked (inventory ports), and the customer's own item code through `FULFILLMENT_ITEM_LOOKUP` (absent without it),
  returned with the delivery's lines. Files: `F/fulfillment-line/fulfillment-line-availability.service.ts`,
  `F/fulfillment-line/fulfillment-line.controller.ts`. Test:
  `F/fulfillment-line/fulfillment-line-availability.service.spec.ts` (stock per warehouse and lot; customer code shown
  only when the lookup has one).

## Phase 3 — UI surfaces

- [ ] **T33**. Scaffold `packages/plugins/fulfillment-ui` and `packages/plugins/returns-ui` (package, project, jest,
  eslint), menu under `sales-sections` with feature and permission, hide on `404`, i18n keys in every locale;
  `apps/gauzy` plugin config; feature links of `commerce-feature-catalogue.ts` pointed at the new pages. Files:
  `FU/fulfillment-ui.plugin.ts`, `FU/fulfillment-ui.routes.ts`, `RU/returns-ui.plugin.ts`, `RU/returns-ui.routes.ts`,
  `packages/ui-core/i18n/assets/i18n/*.json` (`DELIVERY.*`, `RETURNS.*`), `apps/gauzy/src/plugin-ui.config.ts`,
  `packages/core/src/lib/feature/commerce-feature-catalogue.ts`. Test: `FU/fulfillment-ui.plugin.spec.ts` and
  `RU/returns-ui.plugin.spec.ts` (menu only with feature and permission; hidden on `404`).
- [ ] **T34**. Deliveries: saved-view lists, board, detail (lines, packages, timeline, proof, installations, flow),
  create from order and direct. Files: `FU/components/deliveries-list/deliveries-list.component.ts`,
  `FU/components/deliveries-board/deliveries-board.component.ts`,
  `FU/components/delivery-detail/delivery-detail.component.ts`,
  `FU/components/create-delivery-dialog/create-delivery-dialog.component.ts`. Test: a `*.component.spec.ts` beside
  each component (live update on a hint).
- [ ] **T35**. Packing station: scan-to-pack, weight entry, print label and packing list; keyboard only operation. Files:
  `FU/components/packing-station/packing-station.component.ts`. Test:
  `FU/components/packing-station/packing-station.component.spec.ts` (scan adds one unit; keyboard only operation).
- [ ] **T36** (parallel). Shipping setup: profiles, options with bands, presets, carrier accounts, notification
  templates. Files: `FU/components/shipping-setup/shipping-setup.component.ts`,
  `FU/components/shipping-option-bands/shipping-option-bands.component.ts`,
  `FU/components/package-presets/package-presets.component.ts`,
  `FU/components/carrier-accounts/carrier-accounts.component.ts`,
  `FU/components/notice-templates/notice-templates.component.ts`. Test: a `*.component.spec.ts` beside each component.
- [ ] **T37** (parallel). Consignments and manifests pages, booking dialog. Files:
  `FU/components/consignments/consignments.component.ts`, `FU/components/manifests/manifests.component.ts`,
  `FU/components/booking-dialog/booking-dialog.component.ts`. Test: a `*.component.spec.ts` beside each component.
- [ ] **T38** (parallel). Trips board and editor (stop list, the existing map component, manual order and lock, trip
  sheet), drivers page, Vehicle section on the existing Equipment page while `FEATURE_DELIVERY_TRIPS` is on. Files:
  `FU/components/trips-board/trips-board.component.ts`, `FU/components/trip-editor/trip-editor.component.ts`,
  `FU/components/drivers/drivers.component.ts`, `FU/components/vehicle-section/vehicle-section.component.ts`,
  `apps/gauzy/src/app/pages/equipment/equipment.component.ts`. Test: a `*.component.spec.ts` beside each component;
  `apps/gauzy/src/app/pages/equipment/equipment.component.spec.ts` (unchanged with the flag off).
- [ ] **T39** (parallel). `returns-ui`: returns, claims, exchanges, reasons with restock rule, receive dialog, credit note
  action. Files: `RU/components/returns-list/returns-list.component.ts`,
  `RU/components/return-detail/return-detail.component.ts`, `RU/components/claims/claims.component.ts`,
  `RU/components/exchanges/exchanges.component.ts`, `RU/components/return-reasons/return-reasons.component.ts`,
  `RU/components/receive-dialog/receive-dialog.component.ts`. Test: a `*.component.spec.ts` beside each component
  (claims and exchanges opened from a delivery).
- [ ] **T40** (parallel). Installations pages. Files: `FU/components/installations/installations.component.ts`,
  `FU/components/installation-detail/installation-detail.component.ts`. Test: a `*.component.spec.ts` beside each
  component (the pending view lists deliveries awaiting installation).
- [ ] **T41**. Public tracking page in `packages/plugins/public-layout-ui` (`track/:token`, opened by the `shared_entity`
  link). Files: `PL/public-layout.routes.ts`, `PL/components/delivery-tracking/delivery-tracking.component.ts`. Test:
  `PL/components/delivery-tracking/delivery-tracking.component.spec.ts` (rendering and accessibility);
  `PL/public-layout.routes.registration-switch.spec.ts` (existing routes unchanged).
- [ ] **T42**. Default print templates: delivery document, packing list, package label, trip sheet, installation record,
  return authorisation, registered through `registerPrintTemplates` (`print-and-pdf-designer` T36). Files:
  `F/print/delivery-document.template.ts`, `F/print/packing-list.template.ts`, `F/print/package-label.template.ts`,
  `F/print/trip-sheet.template.ts`, `F/print/installation-record.template.ts`, `R/print/return-authorisation.template.ts`,
  `F/fulfillment.plugin.ts`, `R/returns.plugin.ts`. Test: `F/print/delivery-print-templates.spec.ts` and
  `R/print/return-authorisation.template.spec.ts` (render snapshots in the customer's language).

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T43**. MCP tools `packages/mcp-server/src/lib/tools/deliveries.ts`, `shipping.ts`, `delivery-trips.ts`,
  `returns.ts` (core tools of plan §7), registered. Test: `packages/mcp-server/src/lib/tools/deliveries.spec.ts`,
  `shipping.spec.ts`, `delivery-trips.spec.ts`, `returns.spec.ts` beside them (schemas; previews write nothing).
- [ ] **T44**. OpenAPI regenerated; SDK note; READMEs of `fulfillment`, `returns`, `warehouse` updated; docs site pages;
  `docs/specs/README.md` row; spec status `Implemented` for phases 1–2. Files: `packages/plugins/fulfillment/README.md`,
  `packages/plugins/returns/README.md`, `packages/plugins/warehouse/README.md`, `docs/specs/README.md`,
  `docs/specs/features/delivery-and-shipping/spec.md`. Test: OpenAPI diff is additive; docs build.

## Phase 5 — Advanced capabilities

- [ ] **T45**. Plugin `packages/plugins/carrier-sandbox` and the conformance kit (`F/carrier/testing/`); rate shopping in
  parallel with per-carrier timeout, auto-select rule; the carrier registry registered as the `CALCULATED` strategy of
  `ShippingOptionService.calculate`, with estimated packages for quotations on the existing
  `POST /shipping-options/calculate` and live rates on the cart's `CART_SHIPPING_RATE` path. Files:
  `packages/plugins/carrier-sandbox/src/lib/carrier-sandbox.plugin.ts`,
  `packages/plugins/carrier-sandbox/src/lib/sandbox-carrier.adapter.ts`, `F/carrier/testing/carrier-adapter.conformance.ts`,
  `F/carrier/rate-shopping.service.ts`, `F/shipping-option/shipping-option.service.ts`,
  `apps/api/src/plugin-composition.ts`. Test: `packages/plugins/carrier-sandbox/src/lib/sandbox-carrier.adapter.spec.ts`
  (conformance kit green); `F/carrier/rate-shopping.service.spec.ts` (8 s timeout per carrier; cheapest and fastest
  marked); `packages/plugins/cart/src/lib/commerce-cart/commerce-cart.service.spec.ts` (live rate).
- [ ] **T46**. Booking depth: labels per package, shipping cost on deliveries, ship at booking or hand-over, bulk booking
  with per-row results. Files: `F/carrier/delivery-consignment.service.ts`, `F/carrier/bulk-booking.service.ts`.
  Test: `F/carrier/bulk-booking.service.spec.ts` (with the sandbox carrier: labels per package, cost on deliveries, 28 of
  30 booked and 2 reported).
- [ ] **T47**. Push tracking through `integration-hub` inbound endpoints: one inbound handler per adapter
  (`inboundHandlers` contribution) with the adapter's verification, `delivery.tracking-poll` with back-off (the only
  path without the hub), exception and late Inbox notices and automation triggers, real-time updates. Files:
  `F/carrier/tracking-inbound.handlers.ts`, `F/schedule/delivery-tracking-poll.scheduler.ts`,
  `F/schedule/delivery-tracking-poll.service.ts`, `F/notification/delivery-inbox.notices.ts`. Test:
  `F/carrier/tracking-inbound.handlers.spec.ts` (verification refusal; dedupe);
  `F/schedule/delivery-tracking-poll.service.spec.ts` (back-off).
- [ ] **T48**. Route planning on the shared route planner `@gauzy/route-planner` (`packages/route-planner` of
  `maintenance-and-field-service` T46, its built-in planner of T40): delivery constraints (depot, locked stops, time windows,
  payload and volume, service minutes) mapped in `F/trip/trip-planning.ts`, `POST /delivery-trips/:id/plan` with
  preview, positions through `GEOCODING_ADAPTERS`. Files: `F/trip/delivery-trip.controller.ts` (`plan`). Test:
  `F/trip/trip-planning.spec.ts` (fixture routes, locked stops kept, windows respected); the route planner package's own
  fixtures include delivery trips.
- [ ] **T49**. Positions and live arrival times: `POST /delivery-trips/:id/positions`, `delivery.eta-refresh`,
  "on the way" and "arriving soon" notices, `delivery.position-purge`. Files: `F/trip/trip-position.service.ts`,
  `F/schedule/delivery-eta-refresh.worker.ts`, `F/schedule/delivery-position-purge.scheduler.ts`. Test:
  `F/trip/trip-position.service.spec.ts` (ETA; once-per-stop notice; positions refused off route);
  `F/schedule/delivery-position-purge.spec.ts`.
- [ ] **T50**. Proof of delivery: `POST /delivery-proofs` (assets, line outcomes, client key, driver check), delivery
  status and refused-quantity return, offline replay order, proof on tracking page and delivery document. Files:
  `F/proof/delivery-proof.service.ts`, `F/proof/delivery-proof.controller.ts`, `F/print/delivery-document.template.ts`,
  `PL/components/delivery-tracking/delivery-tracking.component.ts`. Test: `F/proof/delivery-proof.service.spec.ts`
  (replay and duplicate; a partial proof marks delivered and creates the return awaiting receipt).
- [ ] **T51**. Self-service returns: `public-layout-ui` route `return/:token` opened by a `shared_entity` link,
  `/public/returns/:token/requests`, pure policy evaluation, auto-approval, return label through the adapter, portal
  embedding entry. Files: `PL/public-layout.routes.ts`, `PL/components/self-service-return/self-service-return.component.ts`,
  `R/self-service/public-returns.controller.ts`, `R/self-service/self-service-return.service.ts`,
  `R/self-service/return-policy.ts`. Test: `R/self-service/return-policy.spec.ts` (policy matrix);
  `R/self-service/self-service-return.service.spec.ts` (approved at once with a label; outside the window kept for
  staff).
- [ ] **T52** (parallel). Installation labour: a field-service visit through `FULFILLMENT_VISITS` when that plugin is
  loaded (its labour read back), else task creation through `FULFILLMENT_PROJECTS` with a time log consumer setting
  labour minutes and cost; shown on the installation and order margin. Files:
  `F/installation/installation-labour.service.ts`, `F/installation/installation-time-log.consumer.ts`. Test:
  `F/installation/installation-labour.service.spec.ts` (tracked time on both paths).
- [ ] **T53**. Agent tools: `explain_delivery_delay`, `propose_carrier`, `plan_delivery_trip`, `draft_delivery_update`,
  `book_consignment` with previews. Files: `F/agent/delivery-agent.service.ts`,
  `packages/mcp-server/src/lib/tools/deliveries.ts`, `packages/mcp-server/src/lib/tools/shipping.ts`,
  `packages/mcp-server/src/lib/tools/delivery-trips.ts`. Test: `F/agent/delivery-agent.service.spec.ts` (fixtures;
  preview writes nothing).
- [ ] **T54** (parallel). Delivery, tracking, trip, proof, return and installation events registered as automation
  triggers and webhook event types. Files: `F/fulfillment.automation-triggers.ts`, `R/returns.automation-triggers.ts`.
  Test: `F/fulfillment.automation-triggers.spec.ts` (every event registered as a trigger and a webhook type).
- [ ] **T55**. Driver pages in `fulfillment-ui` for the installable Gauzy web app: my trips, stop list, proof capture
  (camera photos, signature pad with typed alternative, line outcomes, failed-stop reasons), positions sent only while
  on route, an offline queue with client keys and capture times through the app's existing offline worker
  (`apps/gauzy/ngsw-config.json`). Files: `FU/components/driver-trips/driver-trips.component.ts`,
  `FU/components/driver-stop/driver-stop.component.ts`, `FU/components/proof-capture/proof-capture.component.ts`,
  `FU/services/driver-offline-queue.service.ts`, `apps/gauzy/ngsw-config.json`. Test: a `*.component.spec.ts` beside
  each component at phone width; `FU/services/driver-offline-queue.service.spec.ts` (offline replay).
- [ ] **T56**. Existing document types (`business-document-engine` FR-113): the delivery and return types register with
  `preexisting: true` (`business-document-engine` T59). Files: `F/fulfillment.document-types.ts`,
  `R/returns.document-types.ts`. Test: `F/fulfillment.document-types.spec.ts` (with the engine on and no type policy, an
  existing fulfilment ships and cancels and a return is received and refunded exactly as today).
- [ ] **T57**. Provide the ports other features bind to (plan, **Consumer tokens answered**): `PURCHASING_RETURN_REASONS`. Files: `apps/api/src/plugin-composition.ts`,
  `R/order-return-reason/order-return-reason.service.ts`. Test: `R/order-return-reason/purchasing-return-reasons.contract.spec.ts`, one contract test per token over the shape its consumer plan states; with this feature off each consumer keeps its stated fallback.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Presence and the Delivery app | T11, T33 |
| FR-2 | §3.1 Presence and the Delivery app | T11 |
| FR-3 | §3.1 Presence and the Delivery app | T11 |
| FR-4 | §3.1 Presence and the Delivery app | T30, T34 |
| FR-5 | §3.1 Presence and the Delivery app | T34 |
| FR-6 | §3.1 Presence and the Delivery app | T36 |
| FR-7 | §3.1 Presence and the Delivery app | T42 |
| FR-8 | §3.2 Deliveries | T12 |
| FR-9 | §3.2 Deliveries | T13 |
| FR-10–FR-12 | §3.2 Deliveries | T14 |
| FR-13 | §3.2 Deliveries | T15 |
| FR-14 | §3.2 Deliveries | T15, T35 |
| FR-15 | §3.2 Deliveries | T15 |
| FR-16 | §3.2 Deliveries | T58 |
| FR-17 | §3.2 Deliveries | T12, T30 |
| FR-18 | §3.2 Deliveries | T16 |
| FR-19 | §3.2 Deliveries | T17 |
| FR-20 | §3.2 Deliveries | T17, T34 |
| FR-21 | §3.2 Deliveries | T18 |
| FR-22 | §3.2 Deliveries | T27 |
| FR-23 | §3.3 Packing | T19 |
| FR-24 | §3.3 Packing | T19 |
| FR-25 | §3.3 Packing | T19 |
| FR-26 | §3.3 Packing | T16, T19 |
| FR-27 | §3.3 Packing | T35 |
| FR-28–FR-31 | §3.4 Shipping options and rules | T20 |
| FR-32 | §3.5 Carriers, consignments, rates, labels and tracking | T21, T45 |
| FR-33 | §3.5 Carriers, consignments, rates, labels and tracking | T22 |
| FR-34–FR-35 | §3.5 Carriers, consignments, rates, labels and tracking | T23 |
| FR-36 | §3.5 Carriers, consignments, rates, labels and tracking | T45 |
| FR-37 | §3.5 Carriers, consignments, rates, labels and tracking | T46 |
| FR-38 | §3.5 Carriers, consignments, rates, labels and tracking | T21 |
| FR-39 | §3.5 Carriers, consignments, rates, labels and tracking | T24, T47 |
| FR-40 | §3.5 Carriers, consignments, rates, labels and tracking | T30, T47 |
| FR-41 | §3.5 Carriers, consignments, rates, labels and tracking | T23 |
| FR-42 | §3.5 Carriers, consignments, rates, labels and tracking | T21 |
| FR-43–FR-44 | §3.6 Delivery trips, drivers and vehicles | T26 |
| FR-45–FR-46 | §3.6 Delivery trips, drivers and vehicles | T25, T26 |
| FR-47 | §3.6 Delivery trips, drivers and vehicles | T26 |
| FR-48 | §3.6 Delivery trips, drivers and vehicles | T48 |
| FR-49 | §3.6 Delivery trips, drivers and vehicles | T26 |
| FR-50 | §3.6 Delivery trips, drivers and vehicles | T49 |
| FR-51 | §3.7 Dispatch notices and the tracking page | T27 |
| FR-52 | §3.7 Dispatch notices and the tracking page | T27, T41 |
| FR-53 | §3.7 Dispatch notices and the tracking page | T27 |
| FR-54 | §3.8 Proof of delivery | T50, T55 |
| FR-55 | §3.8 Proof of delivery | T50, T55 |
| FR-56–FR-57 | §3.8 Proof of delivery | T50 |
| FR-58 | §3.9 Sales returns | T28 |
| FR-59 | §3.9 Sales returns | T28, T39 |
| FR-60 | §3.9 Sales returns | T2, T28, T39 |
| FR-61 | §3.9 Sales returns | T9, T28 |
| FR-62 | §3.9 Sales returns | T9, T28, T39 |
| FR-63 | §3.9 Sales returns | T51 |
| FR-64 | §3.9 Sales returns | T39, T51 |
| FR-65–FR-66 | §3.10 Installations | T29 |
| FR-67 | §3.10 Installations | T52 |
| FR-68 | §3.10 Installations | T29, T40 |
| FR-69 | §3.11 Agents, automation and real time | T43, T53 |
| FR-70 | §3.11 Agents, automation and real time | T53 |
| FR-71 | §3.11 Agents, automation and real time | T54 |
| FR-72 | §3.11 Agents, automation and real time | T30, T34 |
| FR-73–FR-74 | §3.12 Reports | T31 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off; enabling it in dev shows the feature end to end.
- Constitution gates in `spec.md` §9 confirmed.
- Contract tests prove the existing fulfilment, label, return, pack-slip and manifest routes unchanged.
- The end-to-end demo runs on a fresh tenant: order → delivery → packing → sandbox carrier booking → tracking to
  delivered → invoice → return with credit note; and a trip with proof of delivery from the driver pages of the
  installable Gauzy web app.
- The sandbox carrier passes the adapter conformance kit.
- Every report and card of spec §3.12 returns correct figures on the demo data set.
