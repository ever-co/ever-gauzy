# Feature Specification: Warehouse and stock movements

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `warehouse-and-stock-movements`
**Branch**: `feat/warehouse-and-stock-movements`
**Status**: `Draft`
**Created**: 2026-11-15
**Last updated**: 2026-11-23
**Owner**: platform maintainers
**Feature flag**: `FEATURE_WAREHOUSE` (existing, default off) for every new screen and behaviour, with the existing
`FEATURE_MULTI_WAREHOUSE` for the location tree and two-step transfers; `FEATURE_INVENTORY` (existing, default on)
also guards the existing stock routes, which answer as today, and is switched on for every tenant that holds
inventory data

---

## 1. Overview
The platform already keeps an append-only stock ledger (each quantity change is one movement recording the quantity
before and after), holds, transfers, adjustments, counts, low-stock rules, zones, bins, pick waves and pick lists, but
only through the API, and the old Inventory screen still types a quantity into a location without a movement. This
feature turns that back end into a working warehouse in the Angular app, the MCP server and an installable floor app: a
tree of **stock locations** with in-transit and non-sellable locations, never offered for sale; **stock movement
documents** (receipt, issue, repack, conversion, return and the purposes production and subcontracting register);
one-step and two-step **transfers**; **reservations** for every kind of demand; a **projected quantity** per item and
location; **reorder levels** that raise requisitions; **putaway rules** with capacity; **pick lists** for deliveries,
transfers and production; **barcode scanning** on every stock and trade document; **inter-organization** flows;
availability reports. The old quantity edits are routed through adjustments, so every figure is explained by the ledger.
Stock value belongs to `stock-ledger-and-valuation`, lots and serial units to `serials-and-batches`.

**Advanced capabilities.** Floor work runs from the **installable floor app** (shared with the shop floor and
inspectors), which works **offline** and applies each scan exactly once; levels and reservations update **live**; pick
lists follow a **walk order** and slotting proposes bin moves from real pick frequency; production planning's **demand
forecast** sets reorder levels; **labour time** comes from tracked time, never typed; an agent prepares replenishment
with a preview. These requirements are marked `(advanced)`.
## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** a stock manager on Inventory → Warehouses, **when** they create the group "North" with "North DC" and
  "North Store" under it and an in-transit location, **then** North shows the sum of its children for every figure.
- **Given** a receipt of 120 units at 4.20 into "North DC", **when** the manager previews it, **then** they see the
  movements (and, with valuation on, the value) and nothing is written; **when** they confirm, **then** on hand rises
  by 120 and the numbered document is immutable, its lines linked to their movements.
- **Given** putaway rules (bin A-01 capacity 50 priority 1, A-02 capacity 100 priority 2), **when** 120 units are
  received, **then** 50 are proposed to A-01 and 70 to A-02, and a putaway task appears in the floor app.
- **Given** a two-step transfer of 40 units from the DC to the store, **when** it is dispatched, **then** the DC loses
  40 and in-transit holds 40, which no cart or order can reserve; **when** the store receives 38 and 2 damaged,
  **then** in-transit is empty, the store holds 38 and the 2 sit on its non-sellable damage location.
- **Given** the feature on, **when** someone types 75 on the old Inventory screen or the variant form for a variant
  showing 80, **then** a "set" adjustment of −5 with the reason "manual correction" is written and the screen shows 75,
  as before.
- **Given** automatic reservation on, **when** a sales order for 30 units is confirmed, **then** 30 are reserved for it
  and no other order can draw them.
- **Given** a reorder level of 100, quantity 200 and projected 60, **when** the daily reorder job runs, **then** one
  purchase requisition per organization carries 200 for that item and location, and the proposal shows its basis.
- **Given** a delivery due for three orders, **when** a pick list is created, **then** each line names bin and
  quantity from free stock in walk order, and picked quantities roll back to the orders.
- **Given** a picker who loses network in the aisle, **when** they keep scanning and come back online, **then** every
  scan is applied once, in order, and the supervisor's board shows the list done.
- **Given** a composite barcode with item, lot, expiry and quantity, **when** it is scanned on a receipt, **then** a
  line is added with lot and expiry filled, or the matching line is incremented.
- **Given** two group organizations, **when** B confirms a purchase order to A, **then** A has the matching sales
  order; **when** A delivers, **then** B has a pending receipt capped by A's dispatch.
- **Given** a worker who starts a pick list in the floor app (starting the platform timer on its work item), **when**
  the list is completed, **then** it shows minutes and cost taken from their tracked time and pay rate.

### 2.2 Edge cases & failures

- **Given** a line that needs more than the free stock, **when** the document is confirmed, **then** nothing is
  written and each failing line is listed with "insufficient stock" and the available figure.
- **Given** two confirmations on one item and location at once, **then** both apply in order, or the second is refused
  with a conflict to retry; never a lost update.
- **Given** a backdated document inside a frozen or closed stock period, **then** it is refused with the period end;
  outside it, it needs `STOCK_BACKDATE`.
- **Given** a cancellation that would make a later balance negative, **then** it is refused, naming that movement.
- **Given** a group location, **when** someone posts, reserves or picks on it, **then** they are refused.
- **Given** a transfer receipt above the dispatched quantity or for an item not dispatched, **then** it is refused.
- **Given** an unknown code, **then** the scan says "not found"; a code matching two items asks the user to choose.
- **Given** an offline pick whose bin was emptied before sync, **then** that operation becomes a task exception with
  choices (pick elsewhere, short pick) and no other scan of the batch is lost; a batch sent twice applies once.
- **Given** a task held by one device, **when** a second device opens it, **then** it is refused until released.
- **Given** a reorder run failing for one organization, **then** other organizations keep their requisitions; with
  procurement off, the proposal is recorded without a requisition and says why.
- **Given** no `STOCK_DOCUMENTS_CONFIRM`, **then** confirming answers `403`; with the feature off the new routes answer
  `404` and the pages are hidden; another organization's document answers `404`.

## 3. Functional Requirements

### 3.1 Stock locations

- **FR-1** A user with `STOCK_LOCATIONS_EDIT` can arrange an organization's locations in a tree; a parent must be a
  group location of the same organization, and a cycle is refused.
- **FR-2** Group locations hold no stock and roll up their children; moving, reserving or picking on one is refused.
- **FR-3** When the organization setting "protect locations in use" is on (default off), the system MUST refuse
  deactivating a location with stock or active reservations, deleting one with movements or children (deactivation
  only), and changing its organization once a movement names it. With it off these actions work as today after a
  confirmation that names the stock, reservations, movements and children concerned.
- **FR-4** A location MAY switch between group and stock-holding only without movements, children or item defaults.
- **FR-5** A location MUST carry a kind (the existing kinds plus in-transit) and MAY be non-sellable with a purpose
  (inspection hold, quarantine, damage, retained sample, returns): its stock is never available, picked only when a
  list allows it, and reported apart. Quarantine and damage zones can be moved under a non-sellable location in one
  action; only where the organization setting "quarantine zones in non-sellable locations" is on (default off) are new
  ones refused elsewhere, and existing zones always stay where they are until moved.
- **FR-6** A location MAY name a default in-transit location and transit days, and MAY be owned by a customer (not own
  or valued stock) or held by a supplier (own, valued stock); carts, reservations and sales channels MUST see only
  active, sellable, own stock-holding locations: never group, in-transit, non-sellable, customer or supplier stock.
- **FR-7** Location tags MUST act as user-defined categories that reports, putaway, reorder and transfers can target.
- **FR-8** A stock document MUST refuse an item or party whose organization allow-list excludes its organization.

### 3.2 Balances and projection

- **FR-9** The system MUST keep per item variant and stock-holding location: on hand, reserved (by demand kind),
  incoming (approved purchase orders and inbound transfers not yet received; in transit is its part), requested,
  planned, safety stock, available (as today) and projected (on hand + incoming + requested + planned − reserved).
- **FR-10** On hand, reserved and in transit MUST change in the transaction of the movement or reservation; incoming,
  requested and planned within 5 s of the purchase, requisition, transfer or production event.
- **FR-11** A group location MUST show the sum of its descendants for every figure, in views, reports and reorder.
- **FR-12** A user with `STOCK_RECONCILE` can recalculate every figure for one item, one location or all, and sees each
  corrected figure before and after.
- **FR-104** Every write that changes a stock level (movement, adjustment, count, reservation, transfer, recalculation,
  quantity edit, import) MUST publish the existing level events (changed, low, out of stock) after commit; nobody polls.

### 3.3 Stock movement documents

- **FR-13** A user with `STOCK_DOCUMENTS_CREATE` can create a document of a purpose with default locations, a business
  time and lines of item, quantity in any unit of its family, source and/or target location and bin, unit cost
  (incoming), analytic dimensions and a note; quantities are converted to the stock unit.
- **FR-14** A document MUST be numbered by its series and follow the draft, confirmed, cancelled lifecycle of the
  business document engine, linked to the documents it came from; a draft moves nothing.
- **FR-15** Confirming MUST write one movement per line and direction, linked to its line, in one transaction with the
  balances; if any line fails, nothing is written and each failing line is returned with its reason.
- **FR-16** Cancelling MUST write reversing movements, never edit originals, and be refused if a later balance goes negative.
- **FR-17** The system MUST refuse non-stocked items, zero quantities and zero-cost incoming lines not marked "no cost".
- **FR-18** A past business date MUST require `STOCK_BACKDATE`, fall within the organization's backdating window and
  outside any frozen or closed stock period.
- **FR-19** A receipt MAY be marked as an opening balance; opening documents are reported apart.
- **FR-20** A document MUST show incoming and outgoing quantity and, with valuation on, values and their difference.
- **FR-21** A user can preview the movements (and, with valuation and accounting on, the value layers and postings) a
  document would write; the preview writes nothing.
- **FR-22** A document MAY carry additional cost lines (freight, handling, duty) with amount, currency and distribution
  basis; valuation adds them to incoming cost, otherwise they are stored and shown.
- **FR-23** An issue MUST name a reason from a configurable list (seeded from the stock reason codes), mapped to a
  stock reason code and an expense role; an issue consumes stock, while correcting a wrong figure stays an adjustment.
- **FR-24** A repack MUST consume inputs and produce one or more outputs in one confirmation; secondary outputs carry
  a share of the input cost.
- **FR-25** A conversion between units of one family MUST be refused unless inputs and outputs agree in the reference
  unit within its rounding.
- **FR-26** With lot tracking on, a repack MAY split an input lot into child lots summing to the input, each linked to
  its parent.
- **FR-27** A return MUST name the original stock document, may not exceed per line what it moved minus earlier
  returns, and restores or releases the reservations the original consumed; goods sold come back only through the
  order's return, claim or exchange.
- **FR-28** With quality management on, a line under an inspection rule MUST NOT be confirmed without an accepted
  inspection; a rejected quantity can go to a non-sellable location in the same confirmation.
- **FR-29** Each stock document MUST have a default print template (document, transfer, pick, putaway, bin label).

### 3.4 Purposes and source documents

- **FR-30** Purposes MUST form a registry: this feature registers receipt, issue, transfer, repack, conversion and
  return; production, subcontracting and customer-provided stock register theirs with directions and source rules.
- **FR-31** A user with `STOCK_SETTINGS_EDIT` can define document types on a purpose (name, series, default
  locations, two-step transfer, lot split, putaway) and switch them off; a type in use cannot be deleted.
- **FR-32** Production purposes MUST move material to work in progress, consume it, and record output with secondary
  outputs (co-product, by-product, scrap) and their cost basis, and process loss as quantity or percent.
- **FR-33** A disassembly MUST name the output it reverses and stay within that output minus earlier disassemblies;
  components return with the source's lots and serial units where known.
- **FR-34** Subcontracting and customer-provided purposes MUST move stock to and from subcontractor and customer-owned
  locations; a closed subcontract order refuses new documents.
- **FR-35** A document can be created, with line links, from a requisition, pick list, work order, operation card,
  subcontract order, delivery or goods receipt (returns) or customer invoice; moved quantities roll back. A purchase
  order is received only through its goods receipt, which a document may link but never repeat.

### 3.5 Transfers and in-transit

- **FR-36** The existing transfer keeps its lifecycle and routes; lines also name bins and, with lot tracking, bundles.
- **FR-37** A one-step transfer MUST write out and in movements in one confirmation; same location and bin is refused.
- **FR-38** A two-step transfer MUST dispatch into the in-transit location and receive from it; received plus damaged
  may not exceed dispatched per line, and only dispatched items are received.
- **FR-39** A transfer in transit beyond its expected days MUST be shown overdue and raise an event.
- **FR-40** A transfer MAY fulfil a requisition or pick list; transferred quantity and percent are written back.

### 3.6 Old quantity edits through the ledger

- **FR-41** With the feature on, a quantity set on the old Inventory screen or the `/warehouses/inventory-quantity`
  routes MUST write a "set" adjustment with the reason "manual correction"; request and response shapes are unchanged.
  The variant's own quantity stays editable on the variant form and is written the same way (a "set" adjustment), so it
  always shows its on hand as the ledger keeps it.
- **FR-42** A level holding stock without any movement, or a variant quantity without a level, MUST be adopted once
  with an opening-balance movement.
- **FR-43** With the feature off, the old routes MUST behave as today.

### 3.7 Reservations

- **FR-44** Reservations MUST also be possible for production orders, subcontract orders, production plans and pick
  lists, besides today's carts, orders, returns, claims, exchanges, transfers and subscriptions.
- **FR-45** A reservation MAY hold a quantity or named lots or serial units, and then holds only those.
- **FR-46** A demand MAY be partly reserved when the organization allows it; otherwise a short reservation is refused.
- **FR-47** A reservation MUST record held, consumed and released quantity and stay active until nothing is left or it expires.
- **FR-48** Reservations MAY be taken automatically on sales order confirmation, on a receipt for a purchase linked to
  a sales order, or on pick list creation, per organization setting; the defaults keep today's reservation behaviour.
- **FR-49** Reserved stock MUST NOT be drawn by any document other than the one consuming that reservation.
- **FR-50** A reservation in a unit that cannot be split MUST be rounded to whole units.
- **FR-51** A reservation MAY be handed to another document (receipt to order, pick list to delivery) with its history.

### 3.8 Reorder and low stock

- **FR-52** A user with `STOCK_REORDER_MANAGE` can set per item and location or location group one reorder rule:
  kind (buy, transfer from a location, issue, make) and reorder quantity on the item's reorder level, which is the
  restock threshold its low-stock notices also use (one level per item and location); a second rule is refused.
- **FR-53** With the reorder setting on, a job MUST run daily and on demand and, where projected ≤ level, propose the
  larger of the reorder quantity and the quantity lifting projected above the level, rounded up to the supplier's
  pack size and minimum quantity (else the purchase unit).
- **FR-54** Proposals MUST become requisitions through procurement, one per organization and kind per run, skipping
  inactive locations, discontinued items, templates, shortfalls already requested and items production planning
  replenishes (said on the proposal); recipients get a notice.
- **FR-55** The existing low-stock rules MUST be evaluated on a schedule, each against its own threshold or, when it has
  none, against the item's reorder level, honour their cool-down and notify their recipients in the inbox and by email.
  A rule keeps the threshold it has today; saving a reorder rule never changes it.
- **FR-103** A user with `STOCK_REORDER_MANAGE` can set a reorder rule on an item for all its variants; the job MUST
  apply it to each variant that has no rule of its own for that location, using the variant's own projection.

### 3.9 Bins, putaway and capacity

- **FR-56** Zones and bins MUST be managed from screens (tree, ranges, block, re-parent) with printable bin labels.
- **FR-57** A user with `PUTAWAY_RULES_EDIT` can set per item or item group and location or bin a capacity and a
  priority (1 first); one rule per item and target; capacity below current stock or above the bin's declared capacity
  is refused.
- **FR-58** On receipt and transfer-in, the system MUST split quantities across targets by priority until full, list
  the rest as unassigned, and split lot and serial bundles with them.
- **FR-59** Overfilling a target MUST be refused when the document type uses putaway, and warned otherwise.
- **FR-60** A capacity view MUST show capacity, on hand and percent occupied per location, bin and item.

### 3.10 Pick lists

- **FR-61** Pick lists MUST serve deliveries (from due shipments, as today), transfers and production; each line
  suggests location, bin, lot, serial and quantity from free stock by the picking policy.
- **FR-62** Free stock MUST exclude other open pick lists, reservations, in-transit, customer-owned and supplier-held
  locations, non-sellable locations (unless allowed), blocked bins, expired or blocked lots and serial units not in
  stock.
- **FR-63** A picker MAY take another bin or lot where allowed, within an over-pick percent; kits expand into parts.
- **FR-64** Picked quantities MUST roll back to the orders; a fully picked order cannot join another list; with
  reservations on, picks create or consume them.
- **FR-65** A delivery MAY be created from several pick lists per customer and order.
- **FR-66** A location without bins MUST stay pickable: lines name no bin and are confirmed by scanning the item.

### 3.11 Barcode scanning

- **FR-67** A scanned code MUST resolve, in order, to a document, bin, location, serial unit, lot or item variant (item
  barcode, unit-bound barcode with its quantity, vendor or customer item code).
- **FR-68** A scan field on stock, purchase and sales documents and counts MUST add or increment a line, apply a
  unit-bound barcode's unit, attach the scanned lot or serial and remember the last scanned location.
- **FR-69** Composite barcodes carrying item, lot, expiry, serial and quantity as standard application identifiers
  MUST be parsed into their parts.

### 3.12 Inter-organization stock flows

- **FR-70** Between group organizations, a purchase order to an internal vendor MAY create the counterpart sales
  order, and the reverse; a delivery the counterpart goods receipt; a receipt return the counterpart delivery return.
- **FR-71** An internal receipt MUST be capped by the counterpart dispatch; pending internal receipts are listed; kits
  are received by component.
- **FR-72** A price policy per pair of organizations MUST decide internal incoming cost: sender's valuation or price.

### 3.13 Stock policy settings

- **FR-73** A user with `STOCK_SETTINGS_EDIT` can set per organization the default location, reservation rules,
  over-receipt, over-transfer and over-pick percent, putaway, reorder job, backdating window and picking policy.
- **FR-74** Settings MUST include dispatch notice defaults (template, attached delivery print, delay) applied by
  delivery and shipping.
- **FR-75** Each setting MUST show its effective value and its source (organization or platform default).

### 3.14 Reports

- **FR-76** Shortage: item-locations with negative projected quantity and each of its components.
- **FR-77** Items to request: projected below demand and not covered by an open requisition.
- **FR-78** Suggested reorder level: average daily outgoing over a period, lead time and safety stock, applicable.
- **FR-79** Requisitions awaiting a supplier quotation.
- **FR-80** Requested transfers not yet made.
- **FR-81** Reserved stock: holds by document, quantity or lot and serial, and state.
- **FR-82** Projected quantity: every figure of FR-9 per item and location with its reorder level.
- **FR-83** Availability: available and projected per item across locations by date, with incoming documents.
- **FR-84** Every report MUST be a report definition (filters, group-by, export); groups roll up; figures drill down.

### 3.15 Floor app (advanced)

- **FR-85** (advanced) A user with `WAREHOUSE_TASKS_WORK` can install the floor app from the browser on a phone
  or handheld and work their tasks: receive, put away, pick, dispatch and receive transfers, count, relocate; each
  step also needs the permission of the work it records (a pick needs the pick permission).
- **FR-86** (advanced) Each step MUST be scan-driven (bin, item or lot or serial, quantity); a wrong bin or item
  is refused with the reason and the next bin in walk order is suggested.
- **FR-87** (advanced) The app MUST work offline: task data stays on the device, scans queue with a unique
  operation id, and the platform's one offline sync (also used by other floor work) applies each once and in order.
- **FR-88** (advanced) An operation that can no longer apply (stock gone, bin blocked, task reassigned) MUST
  become a task exception with the choices left, shown on the device and to the supervisor.
- **FR-89** (advanced) A supervisor MUST see each task's live progress and exceptions and can reassign it; a
  task held by one device is refused to another until released or its lease ends.

### 3.16 Live stock, slotting, forecast, labour and agents (advanced)

- **FR-90** (advanced) Balance views, documents, pick lists and the floor app MUST update within 2 s of a
  movement or reservation, through the platform push channel.
- **FR-91** (advanced) A sales order line MUST show live availability (reserved, partly, short until a date).
- **FR-92** (advanced) Pick and putaway lines MUST follow the pick path order of the bin tree (zone priority,
  aisle, rack, level, position, alternating by aisle), with a walk order set on a bin taking precedence.
- **FR-93** (advanced) A weekly slotting job MUST propose moving the items with the most pick lines in 30 days
  to the earliest pickable bins that fit them, with walking saved; accepted moves become relocation tasks.
- **FR-94** (advanced) For item-locations with 8 weeks of history, production planning's one demand forecast
  (90 days, with its error) MUST give a suggested level (demand over the supplier's lead time plus safety stock for a
  service level) and quantity.
- **FR-95** (advanced) A reorder level in "forecast" mode MUST use the latest suggestion, and each proposal
  states the forecast, lead time and safety stock used.
- **FR-96** (advanced) Each warehouse task MUST record who worked it and when; its labour time is the time
  tracked on its own work item (timer started and stopped with the task) at their pay rate, never counted twice.
- **FR-97** (advanced) Labour reports MUST show lines per hour and minutes and cost per receipt, putaway, pick
  line and count by person, location and day; receipt labour can go to valuation as a landed cost charge.
- **FR-98** (advanced) MCP tools MUST read balances and availability, locate items, create drafts, and preview
  or confirm documents with the caller's permissions; confirming tools take a preview flag that writes nothing.
- **FR-99** (advanced) A replenishment agent MUST group the day's proposals per vendor and location, explain
  each, and create draft requisitions for a person to approve.
- **FR-100** (advanced) Document confirmed, level low, out of stock, transfer overdue, reservation expiring and
  task exception MUST be automation triggers.

### 3.17 Compatibility

- **FR-101** With `FEATURE_WAREHOUSE` off nothing new is visible and every existing route answers as today;
  `FEATURE_INVENTORY` guards the existing inventory routes and menu and stays on by default.
- **FR-102** Existing permissions keep their meaning; new permissions are granted to the admin and manager roles.
- **FR-105** For a tenant that had `FEATURE_WAREHOUSE` on before the release, the behaviours that change an existing
  flow (old quantity edits written as adjustments with opening-balance adoption, the scheduled low-stock notices, the
  protection of locations in use and the placement of quarantine and damage zones) start at today's behaviour through
  organization settings the release stores for its organizations; the tenant switches each on when it chooses.

## 4. Non-Functional Requirements

- **Performance**: 200-line confirmation < 1 s P95; balance lists < 300 ms P95 at one million level rows per tenant;
  scan resolution < 150 ms P95; 500-operation batch < 10 s; reorder of 100,000 item-locations < 10 min; push < 2 s.
- **Volume and concurrency**: 50 million movements per tenant; 200,000 bins per organization; 5,000 queued operations
  and 8 hours offline per device; the level lock and version check stay the only write path (no lost update).
- **Reliability**: outbox events at least once, deduplicated per consumer; jobs in the worker, in-process without queue.
- **Security & privacy**: tenant and organization scoped; labour cost behind its own permission; only reorder and
  dispatch notices leave the platform (email). **Audit**: who and when on every document state, adjustment and scan.
- **Accessibility, localization, deployment**: keyboard and screen-reader operable, large touch targets; every locale;
  multi-tenant and self-hosted; PostgreSQL, MySQL, SQLite; both ORMs; OpenAPI and SDKs additive.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| Stock location | The existing warehouse in a tree: group or stock-holding, kind, non-sellable purpose, in-transit default, customer or supplier owner |
| Stock level | The existing item-and-location balance (the only stored quantity), now with in-transit, requested and planned figures and its reorder level |
| Stock movement | The existing append-only ledger row, now linked to its document line |
| Stock movement document | A numbered receipt, issue, repack, conversion, return or registered purpose, with lines |
| Movement purpose, document type | A registered kind of movement; a user-defined type on it (series, defaults) |
| Stock transfer | The existing transfer, one-step or two-step through an in-transit location |
| Stock reservation | The existing hold, for more demand kinds, by lot or serial, with consumed and released parts |
| Reorder rule, proposal | Kind and quantity on the item's one reorder level; what a run proposed and requested |
| Putaway rule | Capacity and priority of an item or item group at a location or bin |
| Pick list | The existing picking work, for deliveries, transfers and production |
| Warehouse task, offline operation | Floor work queued and leased over its source document, with its labour; one queued scan applied once by the platform's offline sync |
| Slotting proposal | Suggested bin moves from pick frequency |
| Internal price policy | How internal flows between two organizations are costed |

## 6. Out of Scope

- Stock value, value layers, counts, closing, landed cost, postings → `stock-ledger-and-valuation`.
- Lot and serial masters, bundles, expiry, expiry-based picking, traceability → `serials-and-batches`.
- Packing, shipments, carriers, delivery documents, dispatch sending → `delivery-and-shipping`.
- Requisitions, purchase orders, goods receipts → `procurement`; sales orders → `sales-order-management`.
- Work orders and operation cards → `shop-floor-and-work-orders`; subcontract orders → `subcontracting`;
  inspections → `quality-management`.
- Allow-lists and group companies → `organization-setup`; items, units, barcodes → `item-catalogue`.
- Demand forecasts and items planning replenishes → `production-planning`; sales returns → the returns feature.

## 7. Acceptance Criteria

- [ ] **AC-1** A group with two stock-holding locations and an in-transit location rolls up every figure (FR-2, FR-12).
- [ ] **AC-2** Receipt, issue, repack and return each preview, confirm and cancel, leaving ledger and levels agreed (FR-15, FR-16, FR-30).
- [ ] **AC-3** A failing line leaves the document unwritten; a cancellation that would go negative is refused (FR-15, FR-16).
- [ ] **AC-4** A two-step transfer with damage ends with in-transit empty and the damage non-sellable; neither is sold (FR-37, FR-38).
- [ ] **AC-5** With the flag on an old-screen or variant-form edit writes a "set" adjustment and both stay editable;
      with it off the screen behaves as today (FR-41).
- [ ] **AC-6** Reserved stock cannot be drawn by another order; a partial consumption keeps the rest active (FR-49, FR-51, FR-64).
- [ ] **AC-7** The reorder job makes one requisition per organization and kind and skips covered shortfalls (FR-54, FR-77).
- [ ] **AC-8** Putaway splits a receipt by priority and refuses overfill where the type uses putaway (FR-31, FR-58, FR-59).
- [ ] **AC-9** A pick list suggests bins in walk order, rolls quantities back and refuses re-picking a picked order (FR-61, FR-64).
- [ ] **AC-10** A composite code fills item, lot, expiry and quantity on a receipt line (FR-67, FR-69).
- [ ] **AC-11** An internal purchase order creates the counterpart sales order; the internal receipt is capped (FR-48, FR-70, FR-71).
- [ ] **AC-12** The reports of FR-76 to FR-83 run, roll up groups and drill down to documents.
- [ ] **AC-13** (advanced) An offline pick syncs once; a replayed batch applies once; a conflict is an exception (FR-87, FR-88).
- [ ] **AC-14** (advanced) A second browser sees a balance change within 2 s (FR-90).
- [ ] **AC-15** (advanced) Slotting lists moves with walking saved; a forecast level drives a stated proposal (FR-93, FR-95).
- [ ] **AC-16** (advanced) A completed pick list shows minutes and cost from tracked time (FR-96, FR-97).
- [ ] **AC-17** (advanced) An MCP confirm with `preview` writes nothing; agent requisitions await approval (FR-98, FR-99).
- [ ] **AC-18** Works on PostgreSQL, MySQL and SQLite with both ORMs; nothing changes while `FEATURE_WAREHOUSE` is off (FR-101; §4).
- [ ] **AC-19** All functional requirements have a passing test (§3).
- [ ] **AC-20** A tenant that had `FEATURE_WAREHOUSE` on before the release sees its zones, bins, pick lists, quantity
      edits and low-stock rules behave as before until it switches the settings of FR-105 on; a low-stock rule keeps its
      own threshold after a reorder rule is saved; a tenant holding inventory data keeps its inventory routes.
- [ ] **AC-21** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today, apart from the feature codes that guard their routes, which are switched on for every tenant that holds their data (FR-101).

## 8. Open Questions

- One switch for bins and documents? Default applied: `FEATURE_WAREHOUSE` covers both; binless locations unchanged.
- Where the floor app installs from? Default applied: the Gauzy web app; one app for all floor work.
- Employees granted `WAREHOUSE_TASKS_WORK` by default? Default applied: no; admins grant it to floor roles.
- Forecast method? Default applied: the methods of production planning's one forecast; without it, fixed levels only.

## 9. Constitution Gates

- [x] I Plugin-first — extends `inventory` and `warehouse`; three UI plugins; core gains columns, a port, offline sync.
- [x] II Tenant/organization scoping — every new record tenant and organization scoped; reads by id scoped.
- [x] III Both ORMs, additive migrations — new tables and nullable columns on all three dialects.
- [x] IV Default-off flag; nothing removed — `FEATURE_WAREHOUSE` off; old routes and screens stay.
- [x] V Contracts and API first — every behaviour is an endpoint before a screen.
- [x] VI Permissions, privacy, security — a key per action; labour cost guarded.
- [x] VII Real-time through the event bus — levels, holds and tasks through the push channel.
- [x] VIII i18n and accessibility — keys in every locale; accessible floor app.
- [x] IX Tests accompany the change — unit, database and end-to-end tests per task.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md) · Depends on:
  [`business-document-engine`](../business-document-engine/spec.md), [`item-catalogue`](../item-catalogue/spec.md);
  reads [`production-planning`](../production-planning/spec.md) for forecasts and planned items
- Used by: [`stock-ledger-and-valuation`](../stock-ledger-and-valuation/spec.md),
  [`serials-and-batches`](../serials-and-batches/spec.md), [`delivery-and-shipping`](../delivery-and-shipping/spec.md),
  [`procurement`](../procurement/spec.md), [`shop-floor-and-work-orders`](../shop-floor-and-work-orders/spec.md)
- Platform: [`realtime-channel`](../realtime-channel/spec.md), [`inbox`](../inbox/spec.md),
  [`task-automations`](../task-automations/spec.md)
- Code: `packages/plugins/inventory/README.md`, `packages/plugins/warehouse/README.md`, `packages/core/src/lib/warehouse/`
