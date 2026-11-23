# Feature Specification: Commerce connectors

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `commerce-connectors`
**Branch**: `feat/commerce-connectors`
**Status**: `Draft`
**Created**: 2026-11-16
**Last updated**: 2026-11-23
**Owner**: evereq
**Feature flag**: `FEATURE_COMMERCE_CONNECTORS` (tenant feature, default off) · the plugin loads only when `GAUZY_COMMERCE_CONNECTORS_ENABLED` is exactly `true` and `integration-hub` is loaded

---

## 1. Overview

Today the platform has a generic integration framework (integrations, their tenant connections, encrypted settings and an id map between platform and outside records) used by issue trackers and time trackers, and `integration-hub` adds connected accounts, inbound endpoints, sync jobs with runs and issues, a call log and a connector kit; but nothing exchanges items, prices, stock, orders, deliveries, payments or returns with an outside sales channel, and no commerce connector ships. This feature adds the **commerce connector framework**: **channel connections** that bind an outside web shop, marketplace, point of sale or fulfilment service to a platform sales channel; a **common commerce model** connectors translate to; **flows** per object and direction with schedules, outside notifications and back-fills; **listing links** and **value mappings** (locations, taxes, payment and shipping methods, statuses, units, attributes, categories); items, prices and stock **out**; items **in**; orders, payments, fees, fulfilments, cancellations, returns, refunds and customers **both ways** where the channel supports them; sales and stock of **outside registers**; a **message log** with retries, dead letters and replay; and **conflict rules** per object and field. It ships three connectors described by what they talk to: a **sandbox** that simulates an outside shop, marketplace and register, an **open channel** connector any outside system can implement against our documented commerce exchange API, and a **file feed** connector. Further adapters are separate plugins on the same contract. Clients: the Angular app, the MCP server and the SDKs.

**Advanced capabilities.** Each connection carries a **health score** with causes, failed messages are **replayed in bulk** after a fix, and any flow runs in **dry-run mode** that shows every create, update and push it would make without writing; **oversell protection** pushes stock with **safety stock and allocation shares per channel** and accelerates updates when stock runs low; a **channel profitability** report nets fees, commissions, payment fees, shipping and returns per channel and item; and an assistant proposes item matches for unmatched outside products for a person to confirm. Marked `(advanced)`.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** an administrator with `COMMERCE_CONNECTIONS_MANAGE`, **when** they connect an outside web shop through a connector, sign in at the shop, bind it to the sales channel "Online B", map the shop's two locations to the stock locations "Main" and "Store", and switch on orders in, stock out and fulfilments out, **then** the connection shows "verified", its outside notifications are registered, and its flows show their schedules.
- **Given** that connection, **when** the outside shop sends "order created" for order `#1042` with a signed-in buyer, two lines and a shipping charge, **then** within a minute one order of "Online B" exists with the buyer as customer, both addresses, lines matched through their listing links, the shop's prices and taxes, the shipping charge and the outside number `#1042`, and its stock is reserved; the same notification delivered again creates nothing.
- **Given** order `#1042` paid at the shop, **when** "order paid" arrives, **then** a payment is recorded on the order with the mapped method, and, with "invoice when paid" on, an invoice is created and confirmed.
- **Given** a delivery of that order shipped in the platform with a tracking number, **then** the fulfilment with its lines, carrier and tracking number is pushed to the shop.
- **Given** stock of an item falling from 12 to 3 at "Main" after a register sale, **then** the shop receives the new available quantity (3 minus the safety stock of 1) within a minute, before the next scheduled push. `(advanced)`
- **Given** an outside marketplace connection with "orders fulfilled by the channel", **when** such an order arrives, **then** it is recorded as delivered from the mapped channel location, and the channel's fees for it are recorded on the order.
- **Given** a manager with `COMMERCE_SYNC_RUN`, **when** they import the outside shop's 3,000 products, **then** a paged list shows which are already linked, the import runs in the background with live progress, variants get their attributes, existing items are matched by code or barcode, and unmatched ones wait for mapping or are created as draft items as set.
- **Given** a manager who wants orders of last quarter, **when** they start a back-fill for 1 July to 30 September, **then** it runs page by page under a run lock, each order once, and can be run again without duplicates.
- **Given** a cancelled outside order with nothing delivered or invoiced, **then** the order is cancelled and its stock released; with a delivery already made, an issue asks a person to decide.
- **Given** a return created at the marketplace for one line, **then** a return of the platform receives the line into the connection's return location, and the refund is recorded; with the order invoiced, a credit note follows.
- **Given** an outside register system connected as "outside point of sale", **when** its daily sales are pulled, **then** each sale becomes a completed order of its store's channel with payments, tips as a charge line and gift card sales as issued gift cards, and staff are linked to the mapped employees.
- **Given** 40 failed messages after the outside shop rejected a mapping, **when** the manager fixes the tax mapping and chooses **Replay failed** with a preview of the count, **then** the messages are processed again in their original order and the health score recovers. `(advanced)`
- **Given** a new connection, **when** the manager runs "orders in" in dry-run mode, **then** they see the orders, customers and items that would be created and the stock that would be reserved, and nothing is written. `(advanced)`
- **Given** a manager with `COMMERCE_REPORTS_VIEW`, **when** they open channel profitability for October, **then** they see per channel and item the revenue, channel fees, commissions, payment fees, shipping cost, refunds, item cost and the net margin. `(advanced)`

### 2.2 Edge cases & failures

- **Given** a user without the needed permission, **then** the routes answer `403`; with the feature off every route answers `404`, connections stop exchanging, and nothing else in the platform changes.
- **Given** an outside notification with a bad signature, **then** it is refused and logged by the inbound endpoint and nothing is processed.
- **Given** an order line whose outside product has no link, code, barcode or mapped field match, **then** the message is held as "unmatched item", the order is not created, and once a person links the item the message is processed.
- **Given** the outside channel answering "too many requests", **then** the flow waits for the time it gives and continues; after 10 failed runs in a row the flow pauses and its owner is told; a connection never switches itself off silently.
- **Given** a product with more option groups than the channel allows, **then** its push is refused with that reason on the listing link, and other products continue.
- **Given** an imported order edited at the channel after its stock was reserved, **then** header changes are applied and line changes become a conflict for a person unless the flow says the channel wins.
- **Given** a goods receipt already announced to an outside fulfilment service, **when** it is cancelled, **then** the announcement is withdrawn when the connector can; otherwise the receipt is cancelled as today and an issue asks a person to withdraw it at the service, unless the connection is set to refuse such cancellations (FR-80).
- **Given** an expired outside sign-in, **then** the connection turns "needs sign-in", its flows wait, and its owner is told; messages already received are kept.
- **Given** the integration hub not loaded, **then** the plugin does not start its routes and says why at boot.

## 3. Functional Requirements

### 3.1 Scope, flags and compatibility

- **FR-1** The system loads this feature only when `GAUZY_COMMERCE_CONNECTORS_ENABLED` is exactly `true` and `integration-hub` is loaded, and gates every route, GraphQL field, menu entry, MCP tool, inbound handler and schedule with `FEATURE_COMMERCE_CONNECTORS`; off, they answer `404` and no exchange runs.
- **FR-2** The system writes platform records only through their owners' services (items, publication, prices, stock movements and reservations, orders and order changes, payments, invoices, deliveries, returns, gift cards, contacts); a connector never writes a table of another plugin.
- **FR-3** The system only adds routes, fields and values to existing contracts; the existing integrations and their id map behave as today.

### 3.2 Channel connections

- **FR-4** A user with `COMMERCE_CONNECTIONS_MANAGE` can create a channel connection from the connector catalogue: the connector, the channel kind (outside web shop, outside marketplace, outside point of sale, outside fulfilment service), the outside account and, for marketplaces, the selling region; one connection per outside account and region.
- **FR-5** The system signs a connection in through a connected account of `integration-hub` or with credentials kept encrypted in the integration settings, verifies them at save, refreshes tokens before expiry, and shows "verified", "needs sign-in" or "failing".
- **FR-6** A user with `COMMERCE_CONNECTIONS_MANAGE` binds a connection to one platform sales channel and organization, so imported orders carry that channel, prices come from the channel's price list and stock from the channel's locations.
- **FR-7** A connection's settings hold: the default customer for orders without a buyer or "a new customer per buyer", the customer group of new customers, whether the outside order number is kept as the order's display number, which outside order states are imported (for example paid or completed only), whether imported orders are confirmed at once, invoice creation (never, when paid, when completed, when shipped) and confirmation, whether shipping is handled by the channel, the return location, and the fee charge item.
- **FR-8** A user with `COMMERCE_CONNECTIONS_MANAGE` can pause, resume and disconnect a connection; disconnecting keeps its links, messages and the records it created; reconnecting the same outside account restores them.
- **FR-9** A connection can be in test mode: orders it creates are marked as test orders and excluded from reports, and nothing it pushes affects live listings when the channel offers a test environment.
- **FR-10** A user with `COMMERCE_CONNECTIONS_VIEW` can see each connection's flows, last runs, counts, open issues, unmatched items and the next scheduled runs on one page that updates live.

### 3.3 Connector framework

- **FR-11** The system lets a connector plugin declare its channel kind, the objects and directions it supports, its sign-in, whether it receives outside notifications or polls, its limits (options per item, attributes, title and description lengths, images per item, batch sizes, requests per minute), the outside value lists it can fetch (locations, tax codes, payment and shipping methods, categories), and its sample data; flows it does not support are not offered.
- **FR-12** The system translates between platform records and one common commerce model (outside product and variant, price, stock level, order with lines, adjustments, taxes and charges, payment, fee, fulfilment, cancellation, return, refund, customer, register sale) so connectors implement translation and transport only.
- **FR-13** The system runs the hub's contract suite and the commerce checks (order import idempotency, stock push arithmetic, mapping round trips) for each connector in its build and, against the sandbox or a test account, from the connection page.
- **FR-14** The system lists connectors in the hub's catalogue under "Commerce" with their channel kind and capabilities, only to tenants with the feature on; with it off the Integrations page lists exactly what it lists today.

### 3.4 Flows, schedules and triggers

- **FR-15** Each connection has flows per object and direction (items out, items in, prices out, stock out, stock in, orders in, payments in, fees in, fulfilments out, fulfilments in, cancellations both ways, returns and refunds both ways, customers both ways, receipts out, register sales in), each switchable, with its trigger: platform events, outside notifications, a schedule (every 5, 10, 15, 30 or 60 minutes, or every 3, 6, 12 or 24 hours) or manual.
- **FR-16** The system runs at most one run of a flow at a time, resumes an interrupted run from its cursor, and records every run with trigger, counts per outcome and errors as sync runs of `integration-hub`.
- **FR-17** The system registers the connector's outside notifications through inbound endpoints of `integration-hub` when a flow needs them, removes stale ones pointing at this deployment, verifies each notification's signature, answers at once and processes it in the background.
- **FR-18** A user with `COMMERCE_SYNC_RUN` can run a flow now, back-fill orders or sales for a date range of up to 366 days (paged, under a run lock, progress shown live, each object once, re-runnable), and resync one item, listing or order from its record page.
- **FR-19** The system refreshes, for channels without notifications, the status of orders changed in a recent window (default 7 days, at most 30) on the flow's schedule.

### 3.5 Links and mappings

- **FR-20** The system keeps one listing link per item variant and connection: the outside product, variant and code, the listing state at the channel (draft, active, refused, ended), the last item, price and stock sync times and the last pushed price and quantity, and the last error.
- **FR-21** The system matches an outside product to an item in this order: listing link, item code, barcode, then the mapped identity field; it never matches across organizations.
- **FR-22** A user with `COMMERCE_CONNECTIONS_MANAGE` maps outside locations to stock locations (with a return location and addresses per location; a group of locations summed for pushes), outside tax codes to tax categories, payment methods to payment methods, shipping methods to shipping options and carriers, order statuses to order states, units to units, attributes to option groups and categories to item groups or collections, after fetching the outside value lists.
- **FR-23** A user with `COMMERCE_CONNECTIONS_MANAGE` can map outside product fields to item fields and custom fields and choose which field identifies an item; the system validates the mapping against the item's fields.
- **FR-24** The system lists unmatched outside products with their orders waiting; a user with `COMMERCE_CONNECTIONS_MANAGE` links one to an item or creates it, after which the waiting messages are processed.
- **FR-25** With "create unknown items" on, the system creates a draft item (and its variants, brand and item group when missing) from an outside product with the connection's defaults for group, unit, tax category and price list.

### 3.6 Items and prices out

- **FR-26** The system pushes items published to the bound channel as listings (draft or active per setting) with names and descriptions per language, images, attributes and variants within the connector's limits, and refuses an item beyond a limit with the reason on its link.
- **FR-27** The system pushes item changes (names, descriptions, images, attributes, variants, status) within 60 seconds of the change, merged per item, and ends the listing when the item is withdrawn from the channel.
- **FR-28** The system pushes prices from the channel's price list (price, the higher list price, a sale window from running promotions when the channel supports it) on every change.

### 3.7 Items in

- **FR-29** A user with `COMMERCE_SYNC_RUN` can open the outside catalogue as a paged list with its count and whether each product is linked, and import one, a selection or all in the background with live progress.
- **FR-30** The system imports variants with their attributes, maps weight and units, brings the first images (or all, by setting), matches existing items as FR-21, and creates or holds the rest as FR-24 and FR-25.

### 3.8 Stock

- **FR-31** The system pushes, per linked variant and mapped location, the quantity available to sell: the inventory area's available quantity (on hand minus reserved minus the location's safety stock), minus the channel's safety stock for that location, times the channel's allocation share, never below zero, converted to the channel's unit.
- **FR-32** The system pushes stock changes within 60 seconds of a stock movement or reservation, in batches within the connector's limits, and on the flow's schedule as a full refresh; each variant keeps its last success time and quantity.
- **FR-33** For a location the connection marks as kept by the outside system (an outside fulfilment service or register), the system pulls stock counts and records them as stock counts of that location with their differences, through the stock owner's count documents; the platform pushes no stock for that location.
- **FR-34** The system compares the channel's quantities with the platform's on a schedule (daily by default) and lists differences per variant and location.

### 3.9 Orders in

- **FR-35** The system creates one order per outside order through the order service: the customer (matched by outside customer id, then verified email, else the default or a new customer per setting), billing and shipping addresses, lines matched by FR-21, the channel's prices (tax-included prices handled), line discounts as adjustments, the shipping charge, the channel's taxes, the outside number, the source "connector `<key>`" and the channel.
- **FR-36** The system compares the channel's taxes with what the tax engine would compute and records a difference above the rounding tolerance as a warning on the order, keeping the channel's amounts.
- **FR-37** The system creates an order once per connection and outside order id, however often it is delivered; a later version of the same outside order updates it as FR-41.
- **FR-38** The system imports only orders in the outside states the connection lists; an order that reaches a listed state later is imported then.
- **FR-39** The system reserves stock for an imported order's lines at the mapped location, and places and confirms the order when the connection says so, passing approval and credit control like any order.
- **FR-40** The system records an order fulfilled by the channel as delivered from the mapped channel location, moving stock out through the stock ledger.
- **FR-41** The system applies outside changes to an imported order: header changes (addresses, contact, notes) at once; line changes through an order change while nothing is delivered and as a conflict (FR-61) once anything is reserved, picked or delivered, unless the flow says the channel wins.

### 3.10 Payments, invoices and fees

- **FR-42** The system records a payment on the order when the channel reports it paid, with the mapped payment method and the channel's payment reference, through `payments-and-collections`; a repeated report records nothing.
- **FR-43** The system creates and, when set, confirms an invoice for the order per the connection's invoice setting, dated per setting (order or payment date), unless one exists or the order is invoiced already.
- **FR-44** The system records the channel's fees, commissions and promotions per order as channel fees with their kind and amount, when the connector reports them; accounting posts them from the order's events when `accounting` is loaded.
- **FR-45** The system imports the channel's payouts and settlements when the connector offers them as payouts of the payments area, with the same settlement lines payment providers report, and matches each line to orders, fees and refunds, listing unmatched lines.

### 3.11 Fulfilments and shipping

- **FR-46** The system pushes a fulfilment to the channel when a delivery of an imported order ships: its lines and quantities, carrier, tracking numbers and links, and partial fulfilments as they ship.
- **FR-47** The system creates a delivery from an outside fulfilment (lines, quantities, tracking) for orders the channel or an outside fulfilment service ships, from the mapped location.
- **FR-48** When the channel books the shipment, the system fetches its labels and documents (the channel's invoice included), attaches them to the delivery, and registers the connector as a carrier of `delivery-and-shipping` so manifests close through it.
- **FR-49** The system announces goods receipts of purchase orders to an outside fulfilment service when its location receives them; when an announced receipt is cancelled it withdraws the announcement where the connector can, and otherwise lets the cancellation proceed and opens an issue to withdraw it at the service, unless the connection's setting of FR-80 refuses the cancellation.

### 3.12 Cancellations, returns and refunds

- **FR-50** The system cancels an imported order when the channel cancels it and nothing is delivered or invoiced, releasing its stock; otherwise it opens an issue naming the delivered or invoiced documents and records the channel's state on the order.
- **FR-51** The system removes cancelled lines of a partly cancelled order through an order change while they are not delivered.
- **FR-52** The system creates a return for an outside return or customer refund of an imported order (lines, quantities, mapped reason, the connection's return location), records the refund, and requests a credit note when the order was invoiced, once per outside return id.
- **FR-53** The system pushes platform returns, refunds and cancellations of imported orders to the channel when the connector supports them.

### 3.13 Customers

- **FR-54** The system imports outside customers as contacts (matched by outside id, then verified email), with addresses and the marketing consent the channel reports, and keeps the outside id on the link.
- **FR-55** The system pushes contacts of the channel's customer group to the channel when the connector supports it, never contacts who refused sharing.

### 3.14 Outside points of sale

- **FR-56** The system imports sales of an outside register system per outside store mapped to a stock location and sales channel: each sale a completed order with its lines, discounts, taxes, payments, tips as a charge line and the register's staff linked to mapped employees (mapped, never created).
- **FR-57** The system records gift card and prepaid card sales of an outside register as issued gift cards and their redemptions as gift card use, through the gift card owner.
- **FR-58** The system imports, when set, outside purchases and receipts of a register system as purchase orders and receipts of `procurement`, creating missing suppliers as draft vendors.

### 3.15 Messages, retries and conflicts

- **FR-59** The system records every exchanged object as a message: connection, flow, object and outside id, direction, status (queued, processed, skipped as duplicate, invalid, failed, dead), the payload and the answer (secrets removed), the platform record, attempts and the last error, linked to the hub's call log entries.
- **FR-60** The system retries a failed message with growing waits (from 1 minute to 6 hours), marks it dead after 8 attempts, keeps processing other messages, and pauses a flow and tells its owner after 10 failed runs in a row.
- **FR-61** The system applies conflict rules per flow and field: stock and prices belong to the platform; an order's header belongs to the channel; an order's lines follow FR-41; items and customers follow the rule chosen per field (platform wins, channel wins, newest wins, ask); an "ask" conflict becomes an issue with both values that a user with `COMMERCE_CONFLICTS_RESOLVE` resolves by choosing a side.
- **FR-62** A user with `COMMERCE_MESSAGES_RETRY` can retry, skip or mark as handled one message or all messages matching a filter after a preview of the count, in their original order.
- **FR-63** A user with `COMMERCE_CONNECTIONS_VIEW` can search messages by connection, flow, status, object, outside id, platform record and time, see payload, answer and error, and export a filtered set.
- **FR-64** The system keeps processed messages 90 days and failed or dead ones until handled plus 30 days, keeping counts beyond.

### 3.16 Shipped connectors

- **FR-65** The system ships a sandbox connector that simulates an outside web shop, an outside marketplace and an outside register system with scripted scenarios (orders, payments, partial fulfilments, cancellations, returns, fees, rate limits, bad signatures, expired sign-in) for tests, demos and dry runs.
- **FR-66** The system ships an open channel connector: a documented commerce exchange API through which any outside system reads the channel's listings, prices and available stock as changes since a cursor and sends orders, payments, fulfilments, cancellations, returns and stock counts, authenticated with a channel key (an API key of the connection's own account) scoped to one connection, with outside notifications delivered by the platform's webhooks; the existing automation-platform integrations can drive it without code.
- **FR-67** The system ships a file feed connector: it writes item, price and stock feeds (delimited text or structured files, chosen fields and languages, item page links from an address pattern set on the feed) as scheduled exports of `data-import-export` to a storage target or a protected pull address, and reads order, sale and stock files as scheduled imports (from a link or a folder) with a saved column mapping of `data-import-export`.

### 3.17 Health, replay and dry runs `(advanced)`

- **FR-68** The system scores each connection daily from message success rate, processing lag, unmatched items, stock differences, failing pushes and sign-in expiry, shows the score with its causes, and warns the owner when it falls below 70 or a sign-in expires within 3 days.
- **FR-69** A user with `COMMERCE_MESSAGES_RETRY` can replay all failed or dead messages of a connection after a fix, previewed by count and processed in original order, each marked as a replay.
- **FR-70** A user with `COMMERCE_SYNC_RUN` can run any flow, back-fill or import in dry-run mode: the system computes every record it would create or change and every outside call it would make, shows them as a difference report, and writes and sends nothing.

### 3.18 Oversell protection `(advanced)`

- **FR-71** A user with `COMMERCE_CONNECTIONS_MANAGE` can set, per channel and stock location, a channel safety stock and an allocation share (a percentage of available stock), applied in FR-31 after the safety stock each item keeps per location in the inventory area.
- **FR-72** The system pushes at once, outside the batch rhythm, when a variant's available quantity crosses the low-stock threshold of the inventory area's stock alert or reaches zero, to every connected channel that lists it.
- **FR-73** The system lists oversell incidents (orders imported for more than was available) with the channels, quantities and suggested actions (transfer, backorder, cancel line), and counts them per channel.

### 3.19 Channel profitability `(advanced)`

- **FR-74** The system computes per channel, item and order the revenue, channel fees and commissions, payment fees, shipping cost from deliveries, refunds and returns, item cost (valued cost when stock valuation is loaded, else the item's standard cost) and the net margin, for any period.

### 3.20 Assistant `(advanced)`

- **FR-75** A user with `COMMERCE_CONNECTIONS_MANAGE` can ask for match proposals for unmatched outside products (by name, attributes, barcode and code similarity) with a confidence per proposal; nothing is linked until a person confirms.
- **FR-76** The system explains a failing message or flow from its log and the connector's limits and proposes a fix, without changing anything.

### 3.21 MCP, events and reports

- **FR-77** The system offers MCP tools to list connections and flows, read health, run a flow (dry run by default), list and retry messages (preview), list unmatched items and confirm links (preview), and read channel profitability, under the caller's permissions.
- **FR-78** The system publishes, with ids only, connection verified, needs sign-in and paused, run completed and failed, message dead, unmatched item, conflict opened, oversell incident and order imported, to automations, webhooks and the real-time channel.
- **FR-79** The system registers these report definitions:

  | Report | Answers |
  |---|---|
  | Connector messages | messages per connection, flow and status with payload and error, bulk retry from the list |
  | Sync activity | runs and records per flow and outcome, lag and open issues per connection |
  | Unmatched items | outside products without a link, their waiting orders and age |
  | Stock differences | channel against platform quantities per variant and location |
  | Channel orders | orders, revenue and lines per channel and day, by outside state |
  | Channel profitability | revenue, fees, payment fees, shipping, refunds, cost and net margin per channel and item `(advanced)` |
  | Oversell incidents | incidents per channel, item and resolution `(advanced)` |
  | Connection health | scores and causes per connection over time `(advanced)` |

### 3.22 Receipt cancellation rule

- **FR-80** A user with `COMMERCE_CONNECTIONS_MANAGE` can set, per connection with an outside fulfilment service, "refuse to cancel announced receipts" (default off); with it on, cancelling a receipt announced to that service is refused while the connector cannot withdraw the announcement, naming the connection; with it off, receipts cancel as they do today.

## 4. Non-Functional Requirements

- **Performance**: an outside order is created within 60 s P95 of its notification (5 minutes on polled channels); a stock change reaches every channel within 60 s P95; 50,000 listings and 20,000 orders a day per connection; message search under 300 ms P95 at 50 million messages per tenant.
- **Reliability**: at-least-once processing deduplicated per connection, object and outside id with version; runs resume from cursors; nothing is lost while a channel is unreachable (outside notifications kept by the hub, pushes queued).
- **Security & privacy**: credentials and tokens encrypted and never returned; signatures verified on every notification; payloads stored with secrets and card data removed; channel keys scoped to one connection. Leaves the platform: items, prices, stock, fulfilments, returns, refunds and the customers allowed to be shared, to the connected channels.
- **Auditability**: who changed mappings, conflict rules, safety stock and settings, who retried, skipped or resolved, with before and after values.
- **Accessibility and localisation**: screens keyboard operable; strings in every shipped locale; item texts pushed per language.
- **Compatibility**: PostgreSQL, MySQL, SQLite; both ORMs; cloud and self-hosted (outside notifications need a public address); with or without a queue; OpenAPI additive; SDKs regenerated.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| Channel connection | One outside shop, marketplace, register system or fulfilment service account bound to a sales channel |
| Channel kind | Outside web shop, outside marketplace, outside point of sale, outside fulfilment service |
| Flow | One object and direction of a connection with its trigger, mapping and conflict rule |
| Common commerce model | The connector-neutral shapes of products, orders, stock, payments, fees, fulfilments, returns, customers |
| Listing link | A variant's identity and state at one connection |
| Value mapping, field mapping | An outside value tied to a platform value; an outside field tied to an item field |
| Message | One exchanged object with its status, payload, answer and attempts |
| Conflict | A disagreement between platform and channel values waiting for a decision |
| Channel fee, settlement line | A fee or commission on an order; a line of a channel payout |
| Channel stock share | Channel safety stock and allocation share per channel and stock location |
| Oversell incident, stock difference | An order beyond available stock; a quantity mismatch between channel and platform |
| Health score | A daily score with causes per connection |

## 6. Out of Scope

- Connected accounts, inbound endpoints, webhooks, the call log, sync jobs, runs and issues as generic machinery: `integration-hub`.
- Payment provider adapters and payouts: `payment-gateways`. Carrier adapters and shipping rules: `delivery-and-shipping`. Stock levels, safety stock and stock alerts: the inventory area and `warehouse-and-stock-movements`.
- The platform's own sellers, offerings and seller settlements (the goods marketplace plugin): an outside marketplace's orders and settlements never write them.
- Generic mapped and scheduled imports and exports: `data-import-export` (the file feed connector uses its schedules and mappings).
- Ledger postings of fees, invoices and payments: `general-ledger` (from document events).
- Adapters for named outside platforms: separate `commerce-connector-<key>` plugins on this contract.

## 7. Acceptance Criteria

- [ ] **AC-1** A sandbox web shop connection is verified, registers notifications, imports an order once with customer, addresses, matched lines, prices, taxes and shipping, reserves stock, and ignores a redelivery (FR-35, FR-54, FR-65).
- [ ] **AC-2** Paid, fulfilled, partly cancelled, cancelled and returned sandbox orders produce payment, invoice, delivery, order change, cancellation or issue, return and refund as specified (FR-50–FR-53).
- [ ] **AC-3** Items, prices and stock pushed to the sandbox respect the connector's limits, refuse an item beyond them with the reason, and show last success times on the links (FR-26, FR-28, FR-32).
- [ ] **AC-4** An outside catalogue import of 3,000 sandbox products matches by code and barcode, holds unmatched ones and processes their waiting orders once linked (FR-21, FR-24).
- [ ] **AC-5** A back-fill of a quarter runs under a lock and can be repeated without duplicates (FR-18).
- [ ] **AC-6** Sandbox register sales become completed orders with tips and gift cards; staff link to mapped employees (FR-56, FR-57).
- [ ] **AC-7** Failed messages retry with growing waits, die after 8 attempts, and a flow pauses after 10 failed runs with a notice; the connector messages report lists them with payloads (FR-60).
- [ ] **AC-8** Conflict rules hold: platform stock wins, channel header wins, line changes after reservation become an issue resolved by choosing a side (FR-61).
- [ ] **AC-9** The open channel connector accepts an order and serves stock changes since a cursor with a scoped channel key; the file feed connector writes a feed and reads an order file with a saved mapping (FR-66).
- [ ] **AC-10** Bulk replay after a mapping fix processes failed messages in order; a dry run writes and sends nothing; the health score shows its causes (advanced: health, replay, dry run; FR-69, FR-70).
- [ ] **AC-11** Safety stock and allocation shares change the pushed quantity; a low-stock crossing pushes at once; an oversell incident is listed (advanced: oversell protection; FR-71–FR-73).
- [ ] **AC-12** Channel profitability nets fees, payment fees, shipping, refunds and cost on seeded data (advanced: profitability; FR-74).
- [ ] **AC-13** Match proposals link nothing until confirmed (advanced: assistant; FR-75).
- [ ] **AC-14** The eight reports of FR-79 return correct figures on seeded data.
- [ ] **AC-15** Feature off: `404` on every route, no exchange, and nothing else in the platform changes (the Integrations page lists what it lists today, receipts cancel as today); works on PostgreSQL, MySQL and SQLite with both ORMs; every functional requirement has a passing test (FR-1).
- [ ] **AC-16** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-1, FR-14).

## 8. Open Questions

- The framework requires `integration-hub` (connected accounts, inbound endpoints, runs, issues); without it the plugin refuses to start its routes. Default applied.
- Adapters for outside platforms are separate plugins; this spec ships the sandbox, open channel and file feed connectors only. Default applied.
- Imported orders keep the channel's prices and taxes and record tax differences as warnings rather than recomputing. Default applied.
- Customers are pushed to channels only from the channel's customer group and never without their sharing consent. Default applied.

## 9. Constitution Gates

- [x] I Plugin-first — new `commerce-connectors` plugin and UI, connectors as `commerce-connector-<key>` plugins on the hub's connector kit; no core change beyond additive entity values.
- [x] II Tenant/organization scoping — connections, links, mappings and messages are scoped; matching never crosses organizations.
- [x] III Both ORMs, additive migrations — new tables on three dialects for both ORMs.
- [x] IV Default-off flag; nothing removed — deploy switch and `FEATURE_COMMERCE_CONNECTORS`; existing integrations unchanged.
- [x] V Contracts and API first — contracts, connector contract and the open channel API before screens.
- [x] VI Permissions, privacy, security — permission keys, encrypted credentials, signature checks, redacted payloads, sharing consent; data leaving listed in §4.
- [x] VII Real-time through the event bus — platform events trigger pushes; connection pages update through the platform channel.
- [x] VIII i18n and accessibility — strings in every locale; keyboard operable screens.
- [x] IX Tests accompany the change — sandbox scenarios, contract suite, idempotency, both ORMs.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Builds on: [`integration-hub`](../integration-hub/spec.md), [`sales-order-management`](../sales-order-management/spec.md), [`warehouse-and-stock-movements`](../warehouse-and-stock-movements/spec.md), [`item-catalogue`](../item-catalogue/spec.md), [`pricing-and-promotions`](../pricing-and-promotions/spec.md), [`delivery-and-shipping`](../delivery-and-shipping/spec.md), [`payments-and-collections`](../payments-and-collections/spec.md), [`invoicing-receivables-payables`](../invoicing-receivables-payables/spec.md)
- Works with: [`data-import-export`](../data-import-export/spec.md), [`procurement`](../procurement/spec.md), [`point-of-sale-and-loyalty`](../point-of-sale-and-loyalty/spec.md), [`stock-ledger-and-valuation`](../stock-ledger-and-valuation/spec.md), [`payment-gateways`](../payment-gateways/spec.md), [`access-control-and-security`](../access-control-and-security/spec.md), [`report-builder-and-dashboards`](../report-builder-and-dashboards/spec.md)
- Code: `packages/core/src/lib/{integration,integration-tenant,integration-setting,integration-map,integration-entity-setting,channel}`, `packages/plugins/{order,cart,catalog,inventory,fulfillment,returns,promotion,payment}`, `apps/api/src/plugin-composition.ts`
