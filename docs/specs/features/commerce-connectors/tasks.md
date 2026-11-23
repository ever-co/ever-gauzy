# Task Breakdown: Commerce connectors

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `commerce-connectors`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind the feature flag: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it.
- Every controller, inbound handler, schedule, page and tool checks `FEATURE_COMMERCE_CONNECTORS`.
- Paths are relative to `packages/plugins/commerce-connectors/src/lib/` unless they start with `packages/` or
  `apps/`; `ui/` means `packages/plugins/commerce-connectors-ui/src/lib/`. Each entity has its MikroORM repository
  beside it in `repository/`; migrations go to `database/migrations/`.

## Phase 1 — Contracts, entities, migrations, kit

- [ ] **T1**. Contracts `packages/contracts/src/lib/commerce-connector.model.ts` (enums, connection, flow view of a hub sync
      job, link, message, channel stock share, incident, profitability row, ports); additive `IntegrationEntity`
      (`Product`, `ProductVariant`, `Order`, `Delivery`, `Return`, `Payment`; customers keep `CLIENT`),
      `IntegrationEnum`, `IntegrationTypeEnum.COMMERCE` and `BaseEntityEnum` values; export from `index.ts`. Test: type
      spec; existing integration contract fixtures still compile.
- [ ] **T2**. Library `packages/commerce-connector-kit`: common commerce model, `ICommerceConnectorManifest` extending the
      hub's `IConnectorManifest` (`provider` key), `CommerceConnector` contract, `runCommerceChecks`. Files:
      `packages/commerce-connector-kit/src/lib/commerce-model.ts`, `packages/commerce-connector-kit/src/lib/manifest.ts`,
      `packages/commerce-connector-kit/src/lib/commerce-connector.ts`,
      `packages/commerce-connector-kit/src/lib/run-commerce-checks.ts`. Test: manifest validation fixtures.
- [ ] **T3**. Plugin scaffold `packages/plugins/commerce-connectors`, `commerce-connectors-enabled.ts` (exact `true` and the
      hub loaded), `commerce-connectors.features.ts` (`FEATURE_COMMERCE_CONNECTORS`, default off) and
      `commerce-connectors.permissions.ts` as contributions with `defaultFor`, `.env.sample`. Test: boot refusal without
      the hub; default grants per role.
- [ ] **T4**. Entities and migration `1791000063100` (connection, listing link, value list, order link, unmatched item)
      with the shared core migration helpers (`@gauzy/core`, `procurement` T4). Files:
      `database/migrations/1791000063100-CreateCommerceConnectionTables.ts`, `connection/commerce-connection.entity.ts`,
      `mapping/commerce-listing-link.entity.ts`, `mapping/commerce-value-list.entity.ts`,
      `mapping/commerce-order-link.entity.ts`, `mapping/commerce-unmatched-item.entity.ts`. Test: migration on SQLite.
- [ ] **T5** (parallel). Entities and migrations `1791000063110` (message, channel fee) and `1791000063120` (stock
      difference, oversell incident); inventory plugin migration `1791000063200` (`channel_warehouse` +
      `allocationPercent`, `safetyStock`). Files: `database/migrations/1791000063110-CreateCommerceMessageTables.ts`,
      `database/migrations/1791000063120-CreateCommerceStockTables.ts`, `message/commerce-message.entity.ts`,
      `money-in/commerce-channel-fee.entity.ts`, `stock/commerce-stock-difference.entity.ts`,
      `oversell/commerce-oversell-incident.entity.ts`,
      `packages/plugins/inventory/src/lib/database/migrations/1791000063200-AddChannelWarehouseAllocation.ts`,
      `packages/plugins/inventory/src/lib/channel-warehouse/channel-warehouse.entity.ts`. Test: message unique key on
      SQLite; inventory entity mapping for both ORMs.
- [ ] **T6**. Seed migration `1791000063130` (integration rows of the three connectors only), each connector manifest
      naming `FEATURE_COMMERCE_CONNECTORS` so the hub's catalogue lists them only to tenants with it on; registration in
      `apps/api/src/plugins.ts` and `apps/worker/src/plugins.ts` (`CommerceConnectorsSchedulePlugin`). Files also:
      `database/migrations/1791000063130-SeedCommerceConnectorIntegrations.ts`. Test: plugin list specs; with the flag
      off the Integrations page and the integration list routes answer exactly as before the seed.

## Phase 2 — Services, endpoints, events

- [ ] **T7**. `COMMERCE_*` ports in contracts and bindings in `apps/api/src/plugin-composition.ts` (orders, catalogue,
      pricing, stock bound to the inventory plugin's `StockAvailabilityService`, `StockReservationService` and
      `StockCountService`, payments, `PAYMENT_PAYOUTS`, fulfilment, returns, gift cards, procurement);
      `COMMERCE_CONNECTOR_IMPLEMENTATIONS` multi-provider. Files: `ports/commerce.ports.ts`; bound services in
      `packages/plugins/inventory/src/lib/stock-availability/stock-availability.service.ts`,
      `packages/plugins/inventory/src/lib/stock-reservation/stock-reservation.service.ts`,
      `packages/plugins/inventory/src/lib/stock-count/stock-count.service.ts`. Test: composition spec.
- [ ] **T8**. Connection service and controller: create with `integration_tenant` and a core `region`, sign-in through hub
      connected accounts or encrypted settings, verify, statuses, pause, resume, disconnect, reconnect, test mode, the
      connection's agent employee (`EmployeeService.createAgentEmployee`, source `commerce-connectors`) as actor with the
      flows' permissions (`connection/`). Files: `connection/commerce-connection.service.ts`,
      `connection/commerce-connection.controller.ts`, `connection/commerce-connection-settings.ts`,
      `connection/dto/create-commerce-connection.dto.ts`. Test: reconnect restores links; foreign organization refused;
      a second connection for the same outside account and region refused, also without a region (`regionKey` `*`)
      and when two creates race.
- [ ] **T9**. Flows on hub sync jobs: one `integration_entity_setting` per flow (entity `commerce.<flowKey>`, hub columns,
      per-field rules in `fieldMap`), flow catalogue per manifest, triggers and intervals (kept in the connection
      settings), `INTEGRATION_SYNC` operations with cursors, one run at a time, pause after 10 failed runs with notice
      (`flow/`). Files: `flow/commerce-flow.service.ts`, `flow/commerce-flow.controller.ts`,
      `flow/commerce-sync.runner.ts`. Test: interrupted run resumes; a flow pauses after 10 failed runs.
- [ ] **T10**. Notifications: `inboundHandlers` contribution `commerce.<provider>`, one hub inbound endpoint per connection,
      registration and stale cleanup through the connector, signature check, message enqueue with a reference to the
      inbound delivery (`inbound/`). Files: `inbound/commerce-inbound.handler.ts`,
      `inbound/commerce-notification-registration.service.ts`. Test: bad signature refused; redelivery deduplicated;
      body stored once.
- [ ] **T11**. Message store and processor: statuses, redaction, payload only without an inbound delivery, retries with
      growing waits, dead after 8 as a core `job_dead_letter` row (queue `commerce-messages`), hold reasons, retry, skip,
      handled, bulk with preview, replay in order through `JobDeadLetterService`, export, retention job (`message/`).
      Files: `message/commerce-message.service.ts`, `message/commerce-message.processor.ts`,
      `message/commerce-message.controller.ts`, `message/message-redaction.ts`, `message/message-retention.job.ts`.
      Test: retry schedule; replay order; dead letter recorded once.
- [ ] **T12**. Links and mappings: listing and order links over `integration_map` (no outside ids in link tables;
      `order.externalId` per connection), customers as `CLIENT` map rows, matching order, value lists fetch, value maps
      as hub `integration_sync_value_map` rows, field map validation, unmatched queue with waiting messages, draft item
      creation (`mapping/`). Files: `mapping/listing-link.service.ts`, `mapping/item-matcher.ts`,
      `mapping/value-map.service.ts`, `mapping/field-map.validator.ts`, `mapping/unmatched-item.service.ts`,
      `mapping/mapping.controller.ts`. Test: matching never crosses organizations; linking releases waiting messages.
- [ ] **T13**. Orders in: customer matching, addresses, lines, channel prices with tax-included handling, adjustments,
      shipping charge, taxes with the tax-engine difference warning, outside states filter, reservations, place and
      confirm, channel-fulfilled orders as delivered, later versions as header updates or order changes (`orders-in/`).
      Files: `orders-in/order-import.service.ts`, `orders-in/customer-matcher.ts`, `orders-in/order-change.handler.ts`,
      `orders-in/tax-difference.check.ts`. Test: one order per outside id; line change after reservation becomes a
      conflict.
- [ ] **T14**. Payments, invoices and fees in: payment recording through `COMMERCE_PAYMENTS`, invoice per setting through
      `COMMERCE_ORDERS`, channel fees, settlements as `payment_payout` + `payment_payout_line` rows through
      `PAYMENT_PAYOUTS.recordSettlement` (the connection's payment provider row; `payment-gateways` FR-83), matching to
      orders, fees and refunds (`money-in/`). Files: `money-in/payment-import.service.ts`,
      `money-in/invoice-policy.service.ts`, `money-in/channel-fee.service.ts`, `money-in/settlement-import.service.ts`.
      Test: repeated paid report records once; settlement lines readable through `SETTLEMENT_LINE_SOURCES`.
- [ ] **T15**. Pushes from the owners' events: handlers of the existing CQRS events (`InventoryLevelChangedEvent`, `Low`,
      `OutOfStock`, `StockReservationChangedEvent`, `ProductPublishedEvent`, `ProductUnpublishedEvent`,
      `PromotionChangedEvent`) and consumers of the owners' outbox events feed `subscriber:commerce-connectors` with
      coalescing; no capture of its own; items and prices out within limits with refusal reasons; listing end on
      withdrawal (`push/`). Files: `push/commerce-change.handlers.ts`, `push/commerce-change.consumer.ts`,
      `push/push-coalescer.ts`, `push/listing-push.service.ts`, `push/price-push.service.ts`. Test: limit refusal on the
      link; coalesced item pushes.
- [ ] **T16**. Stock out: `StockAvailabilityService` availability per mapped location and group, minus
      `channel_warehouse.safetyStock`, times `allocationPercent`, unit conversion, batches, schedule refresh, last success
      per variant; outside-kept locations skipped (`stock/`). Files: `stock/stock-push.service.ts`,
      `stock/channel-quantity.ts`. Test: arithmetic fixtures.
- [ ] **T17**. Fulfilments out and in, channel-booked shipping documents attached to deliveries, connector registration
      in the carrier registry of `delivery-and-shipping`, receipts announced to outside fulfilment services with
      withdrawal on cancel and the connection setting of spec FR-80 (`fulfilment/`). Files:
      `fulfilment/fulfilment-push.service.ts`, `fulfilment/fulfilment-import.service.ts`,
      `fulfilment/commerce-carrier.adapter.ts`, `fulfilment/receipt-announcement.service.ts`. Test: partial fulfilments
      pushed as they ship; with the setting off an announced receipt cancels as today and an issue is opened when the
      connector cannot withdraw; with it on the cancellation is refused naming the connection.
- [ ] **T18**. Cancellations, returns and refunds both ways: full and partial cancellation, issue when delivered or
      invoiced, returns to the return location with reason mapping, refunds, credit note requests, pushes back
      (`returns/`). Files: `returns/cancellation.service.ts`, `returns/return-import.service.ts`,
      `returns/return-push.service.ts`. Test: once per outside return id.
- [ ] **T19**. Items in: outside catalogue paged with linked state, import as an `INTEGRATION_SYNC` operation with live
      progress, variants, units, images (`items-in/`). Files: `items-in/outside-catalogue.service.ts`,
      `items-in/catalogue-import.service.ts`, `items-in/catalogue.controller.ts`. Test: 3,000-product sandbox import.
- [ ] **T20**. Back-fills as `INTEGRATION_SYNC` operations (one live per connection), status sweeps for channels without
      notifications (ticks in `job_execution`), record resync route (`backfill/`). Files: `backfill/backfill.service.ts`,
      `backfill/status-sweep.job.ts`, `backfill/resync.controller.ts`. Test: repeated back-fill creates nothing new; a
      back-fill over more than 366 days is refused.
- [ ] **T21**. Customers both ways with consent and outside ids (`customers/`). Files:
      `customers/customer-import.service.ts`, `customers/customer-push.service.ts`. Test: no push without sharing consent.
- [ ] **T22**. Outside registers: sales as completed orders per mapped store, tips as charge lines, staff to mapped
      employees, gift and prepaid cards through `COMMERCE_GIFT_CARDS`, purchases and receipts through
      `COMMERCE_PROCUREMENT`, stock counts in through the inventory plugin's stock counts (`StockCountService`)
      (`register/`). Files: `register/register-sale-import.service.ts`, `register/gift-card-import.service.ts`,
      `register/register-purchase-import.service.ts`, `register/stock-count-import.service.ts`. Test: staff never created.
- [ ] **T23**. Events of plan §5 and notices; conflicts as hub `integration_sync_issue` rows with resolution by side
      (`events/`, `conflicts/`). Files: `events/commerce.events.ts`, `conflicts/commerce-conflict.service.ts`,
      `conflicts/commerce-conflict.controller.ts`. Test: resolution writes the chosen value once; each event carries ids
      only.
- [ ] **T39**. Stock comparison: a daily job compares the channel's quantities with the platform's per linked variant
      and mapped location, upserts `commerce_stock_difference` rows and serves them on
      `/api/commerce-connections/:id/stock-differences`; the run is recorded in `job_execution`. Files:
      `stock/stock-comparison.job.ts`, `stock/stock-difference.service.ts`. Test: `stock-comparison.job.spec.ts`: a
      sandbox quantity off by three is listed once with both quantities; a rerun updates the row instead of adding one.

## Phase 3 — UI surfaces

- [ ] **T24**. `packages/plugins/commerce-connectors-ui` scaffold, "Commerce" tab on the Integrations page through the
      hub's `PLUGIN_LAYOUT_TABS` seam (the Sales menu links to the same route), connections list with health, hidden on
      `404`; i18n keys `COMMERCE_CONNECTORS.*` in every locale. Files: `ui/commerce-connectors-ui.plugin.ts`,
      `ui/connections/connection-list.component.ts`, `ui/services/commerce-connectors-api.service.ts`,
      `packages/ui-core/i18n/assets/i18n/*.json`. Test: render specs.
- [ ] **T25**. Connection wizard and connection page (live dashboard, flows, mappings with fetched lists, field map,
      listing and order links). Files: `ui/connections/connection-wizard.component.ts`,
      `ui/connections/connection-page.component.ts`, `ui/connections/flows.component.ts`,
      `ui/mappings/value-maps.component.ts`, `ui/mappings/field-map.component.ts`, `ui/connections/links.component.ts`.
      Test: render and keyboard specs.
- [ ] **T26** (parallel). Messages screen (filters, payload view, retry, skip, replay with preview, export) and conflicts
      screen (side-by-side). Files: `ui/messages/messages.component.ts`, `ui/messages/message-detail.component.ts`,
      `ui/conflicts/conflicts.component.ts`. Test: render specs.
- [ ] **T27** (parallel). Unmatched items, outside catalogue import with live progress, channel stock shares and
      differences, feeds and file imports (over `data-import-export` schedules) and channel keys screens; record panels on
      items and orders through the hub's record integrations panel. Files: `ui/mappings/unmatched-items.component.ts`,
      `ui/catalogue/catalogue-import.component.ts`, `ui/stock/stock-shares.component.ts`,
      `ui/stock/stock-differences.component.ts`, `ui/feeds/feeds.component.ts`, `ui/keys/channel-keys.component.ts`,
      `ui/panels/record-commerce-panel.component.ts`. Test: render specs.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T28**. Sandbox connector `packages/plugins/commerce-connector-sandbox`: simulated web shop, marketplace and register
      with scripted scenarios; passes `runCommerceChecks` and the hub contract suite in CI. Files:
      `packages/plugins/commerce-connector-sandbox/src/lib/sandbox.connector.ts`,
      `packages/plugins/commerce-connector-sandbox/src/lib/scenarios/`. Test: every scenario of spec §2 end to end on
      SQLite.
- [ ] **T29**. Open channel connector `packages/plugins/commerce-connector-open-channel`: `/api/commerce-exchange/v1`
      reads with cursors and writes as messages; channel keys are `user_api_token` rows of the connection's agent user
      with an `access_credential_policy` (scopes, organization, rate); notifications through platform webhooks; versioned
      OpenAPI group; docs of the no-code path through the existing automation-platform integrations. Files:
      `packages/plugins/commerce-connector-open-channel/src/lib/commerce-exchange.controller.ts`,
      `packages/plugins/commerce-connector-open-channel/src/lib/channel-key.guard.ts`, `keys/channel-key.service.ts`.
      Test: foreign or revoked key refused; out-of-scope write refused; cursor reads stable.
- [ ] **T30**. File feed connector `packages/plugins/commerce-connector-file-feed`: listing, price and stock export targets
      registered with `data-import-export`; feeds as export templates with `data_schedule` rows, each finished export
      delivered to the storage target or kept for the `shared_entity` pull link; order, sale and stock files as scheduled
      imports with mapping templates whose rows become messages. Files:
      `packages/plugins/commerce-connector-file-feed/src/lib/feed-export.targets.ts`,
      `packages/plugins/commerce-connector-file-feed/src/lib/feed-delivery.consumer.ts`,
      `packages/plugins/commerce-connector-file-feed/src/lib/file-import.target.ts`, `feeds/commerce-feed.controller.ts`.
      Test: feed snapshot; mapped order file imported once.
- [ ] **T31**. MCP tools `packages/mcp-server/src/lib/tools/commerce-connectors.ts` (plan §7), registered in
      `packages/mcp-server/src/lib/tools/register-all-tools.ts`. Test: dry run and preview write nothing.
- [ ] **T32**. Report datasets and definitions of spec FR-79 as `reports` contributions of the report builder. Files:
      `reports/commerce-report-datasets.ts`, `reports/commerce-report-definitions.ts`. Test: figures on seeded
      messages, orders and fees.
- [ ] **T33**. OpenAPI regenerated; SDK regeneration noted; user docs (connecting a channel, mappings, messages, the open
      channel API for outside developers, feeds) and the `docs/specs/README.md` row. Test: OpenAPI diff is additive; docs build.

## Phase 5 — Advanced capabilities

- [ ] **T34**. Health score job with causes into hub health snapshots, expiry and low-score warnings, bulk replay of dead
      messages after a fix through `JobDeadLetterService` (`health/`). Files: `health/connection-health.job.ts`,
      `health/connection-health.service.ts`, `message/dead-message-replay.service.ts`. Test: causes listed; replay marked.
- [ ] **T35**. Dry-run mode for flows, back-fills and imports: difference report of records and outside calls, nothing
      written or sent (`dry-run/`). Files: `dry-run/dry-run.context.ts`, `dry-run/difference-report.ts`,
      `ui/dry-run/difference-report.component.ts`. Test: database and outside call counters unchanged.
- [ ] **T36**. Oversell protection: channel safety stock and allocation shares on `channel_warehouse` (the level's safety
      stock stays the inventory's), immediate push on the stock alert's low-stock crossing or zero
      (`InventoryLevelLowEvent`, `InventoryLevelOutOfStockEvent`), incidents with suggested actions, daily stock
      comparison recorded in `job_execution` (`oversell/`). Files: `oversell/stock-shares.controller.ts`,
      `oversell/immediate-stock-push.handler.ts`, `oversell/oversell-incident.service.ts`. Test: pushed quantity with
      shares; incident on an over-available import.
- [ ] **T37**. Channel profitability dataset: revenue, channel fees, payment fees, shipping cost from deliveries, refunds,
      item cost from the valuation reader or standard cost, net margin (`profitability/`). Files:
      `profitability/channel-profitability.dataset.ts`. Test: seeded figures.
- [ ] **T38**. Assistant: match proposals with confidence for unmatched products (confirm to link) and message
      explanations through `COMMERCE_ASSISTANT` (`assistant/`). Files: `assistant/match-proposal.service.ts`,
      `assistant/message-explanation.service.ts`. Test: nothing linked before confirmation.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Scope, flags and compatibility | T3, T6, T31 |
| FR-2 | §3.1 Scope, flags and compatibility | T7 |
| FR-3 | §3.1 Scope, flags and compatibility | T1, T6 |
| FR-4–FR-6 | §3.2 Channel connections | T8 |
| FR-7 | §3.2 Channel connections | T8, T13 |
| FR-8–FR-9 | §3.2 Channel connections | T8 |
| FR-10 | §3.2 Channel connections | T25 |
| FR-11–FR-12 | §3.3 Connector framework | T2 |
| FR-13 | §3.3 Connector framework | T2, T28 |
| FR-14 | §3.3 Connector framework | T6 |
| FR-15–FR-16 | §3.4 Flows, schedules and triggers | T9 |
| FR-17 | §3.4 Flows, schedules and triggers | T10 |
| FR-18 | §3.4 Flows, schedules and triggers | T9, T20 |
| FR-19 | §3.4 Flows, schedules and triggers | T20 |
| FR-20 | §3.5 Links and mappings | T12, T15 |
| FR-21 | §3.5 Links and mappings | T12 |
| FR-22 | §3.5 Links and mappings | T12 |
| FR-23 | §3.5 Links and mappings | T12, T25 |
| FR-24 | §3.5 Links and mappings | T12 |
| FR-25 | §3.5 Links and mappings | T12 |
| FR-26–FR-28 | §3.6 Items and prices out | T15 |
| FR-29–FR-30 | §3.7 Items in | T19 |
| FR-31–FR-32 | §3.8 Stock | T16 |
| FR-33 | §3.8 Stock | T16, T22 |
| FR-34 | §3.8 Stock | T39 |
| FR-35–FR-37 | §3.9 Orders in | T13 |
| FR-38 | §3.9 Orders in | T13 |
| FR-39–FR-41 | §3.9 Orders in | T13 |
| FR-42–FR-45 | §3.10 Payments, invoices and fees | T14 |
| FR-46–FR-49 | §3.11 Fulfilments and shipping | T17 |
| FR-50–FR-53 | §3.12 Cancellations, returns and refunds | T18 |
| FR-54–FR-55 | §3.13 Customers | T21 |
| FR-56–FR-58 | §3.14 Outside points of sale | T22 |
| FR-59 | §3.15 Messages, retries and conflicts | T11, T26 |
| FR-60 | §3.15 Messages, retries and conflicts | T9, T11 |
| FR-61 | §3.15 Messages, retries and conflicts | T13, T23, T26 |
| FR-62 | §3.15 Messages, retries and conflicts | T11, T26 |
| FR-63 | §3.15 Messages, retries and conflicts | T11, T26 |
| FR-64 | §3.15 Messages, retries and conflicts | T11 |
| FR-65 | §3.16 Shipped connectors | T28 |
| FR-66 | §3.16 Shipped connectors | T29 |
| FR-67 | §3.16 Shipped connectors | T30 |
| FR-68 | §3.17 Health, replay and dry runs (advanced) | T34 |
| FR-69 | §3.17 Health, replay and dry runs (advanced) | T11, T34 |
| FR-70 | §3.17 Health, replay and dry runs (advanced) | T35 |
| FR-71 | §3.18 Oversell protection (advanced) | T5, T36 |
| FR-72–FR-73 | §3.18 Oversell protection (advanced) | T36 |
| FR-74 | §3.19 Channel profitability (advanced) | T37 |
| FR-75–FR-76 | §3.20 Assistant (advanced) | T38 |
| FR-77 | §3.21 MCP, events and reports | T31 |
| FR-78 | §3.21 MCP, events and reports | T23 |
| FR-79 | §3.21 MCP, events and reports | T32 |
| FR-80 | §3.22 Receipt cancellation rule | T17 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off; enabling it in dev shows the feature end to end.
- Constitution gates in `spec.md` §9 confirmed.
- The sandbox scenarios (order in, paid, shipped, cancelled, returned, register sales, rate limit, bad signature,
  expired sign-in) pass end to end; each shipped connector passes the hub contract suite and `runCommerceChecks`.
- No connector writes another plugin's table; every platform record it creates names the connector as its source.
