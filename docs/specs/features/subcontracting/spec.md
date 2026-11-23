# Feature Specification: Subcontracting

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `subcontracting`
**Branch**: `feat/subcontracting`
**Status**: `Draft`
**Created**: 2026-11-15
**Last updated**: 2026-11-23
**Owner**: platform maintainers
**Feature flag**: `FEATURE_SUBCONTRACTING` (new, default off; outward work also needs `FEATURE_PURCHASING`, inward
work `FEATURE_ORDER`, bills of materials and work orders `FEATURE_MANUFACTURING`)

---

## 1. Overview

Today a purchase order can buy an item, but nothing models work done by a supplier on our materials or by us on a
customer's materials. This feature adds **subcontracting** in both directions with one order model. **Outward**: we
buy a processing service from a supplier; the subcontract order derives the materials from the finished item's bill
of materials, we reserve and send them to a stock location held at the supplier, the supplier returns finished goods,
and the receipt consumes the materials there and values the finished goods at material plus service plus additional
cost. **Inward**: a customer sends us their materials under a sales order; we hold them as customer-owned stock at no
cost, make the finished goods through work orders, deliver them, return what is left, and bill the service and any
material of our own. Clients: the Angular app, the supplier portal, the MCP server and agents, the API and SDKs.

**Advanced capabilities.** One order model and one set of screens serve both directions. The consumption basis (per bill of
materials or as sent) is chosen per service and per order. Work in progress at the subcontractor is visible live: material sent and held, progress the supplier reports
in the portal, tracked time, expected completion against the need date. Material held at each subcontractor is counted
by the supplier through the portal, aged and valued, with differences turned into proposed adjustments.
Where the subcontractor's people are contractors on the platform, their tracked time on the order's operations feeds
progress and actual cost and can propose the supplier bill. An agent answers "where is my material" and explains cost
variances. These requirements are marked `(advanced)`.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** a subcontract service "plating of bracket B" (finished item B, its bill of materials, service item
  "plating", one service unit per bracket, supplier P), **when** a buyer orders 500 brackets from P as a subcontract
  line, **then** a subcontract order is proposed with 500 B as output, the raw brackets and fixings from the bill of
  materials as materials, and P's location as the place they go.
- **Given** that order confirmed with reservation on, **when** the storekeeper sends 300 raw brackets now and 200
  tomorrow, **then** two send documents move stock from our warehouse to P's location, the reservation shrinks, and
  the order shows 60 % then 100 % of materials sent.
- **Given** materials at P, **when** 480 plated brackets arrive with 20 rejected, **then** the receipt books 480 into
  stock and 20 into the rejected location, consumes 500 sets of material at P (basis "per bill of materials"), values
  each bracket at material plus plating plus freight share, and the purchase order's service line shows 500 received
  for billing.
- **Given** a customer order for "assembly service, 100 units of kit K, customer supplies the parts", **when** the
  customer's parts arrive, **then** they enter a customer-owned location at no cost, are reserved for the inward
  order, a work order makes 100 K from them, the delivery ships 100 K, and the leftovers go back to the customer.
- **Given** an outward order with material at the supplier for 40 days, **when** the monthly reconciliation runs,
  **then** P receives a request in the portal, counts 3 fewer fixings than our book, and the buyer sees a proposed
  adjustment of 3 fixings with its value to charge back or write off.
- **Given** a supplier whose two technicians are contractors on the platform, **when** they track time on the order's
  plating task, **then** the order's progress and actual labour cost update live, and at completion a supplier bill
  draft is proposed from the approved hours at the agreed rate.
- **Given** an agent with view permissions, **when** asked "where are the fixings for the plating order of last week?", **then** it
  answers with quantities in our warehouse, in transit, at the supplier, consumed and returned, with dates.

### 2.2 Edge cases & failures

- **Given** a purchase order that is closed, on hold or fully received, **when** a subcontract order is created from
  it, **then** creation is refused naming the reason.
- **Given** a send that would exceed the required quantity plus the over-send allowance, **when** it is confirmed,
  **then** it is refused with the quantity still sendable.
- **Given** a receipt whose consumption exceeds what is held at the supplier, **when** it is posted, **then** it is
  refused naming the material and the shortfall; nothing moves.
- **Given** consumption edited below the bill of materials beyond the tolerance, **when** the receipt is posted,
  **then** it is refused unless a user with the override permission states a reason.
- **Given** a receipt with zero accepted and zero rejected on a line, or the same location for both, **when** it is
  posted, **then** it is refused.
- **Given** a closed subcontract order, **when** someone sends material or posts a receipt, **then** it is refused.
- **Given** a customer location not owned by the order's customer, **when** customer material is received into it,
  **then** it is refused.
- **Given** a delivery to the customer above the produced quantity, **when** it is confirmed, **then** it is refused.
- **Given** a receipt dated in a closed stock period, **when** it is posted, **then** it is refused.
- **Given** two clerks posting receipts on the same order at once, **when** both arrive, **then** each is checked
  against the latest quantities and the later one is refused if it would over-receive.
- **Given** a user without the goods receipt permission, **when** they post a receipt, **then** they are refused (403).
- **Given** `FEATURE_SUBCONTRACTING` off, **when** a subcontract route is called, **then** it is refused and the menu
  and the subcontract line kind on purchase orders are hidden.

## 3. Functional Requirements

### 3.1 Scope and compatibility

- **FR-1** The system gates every subcontracting route, field, menu entry and MCP tool with `FEATURE_SUBCONTRACTING`;
  outward work also needs purchasing, inward work sales orders; without manufacturing, materials are entered per order.
- **FR-2** The system registers subcontract orders and material send and return documents with the business document
  engine (numbering, lifecycle, links, roll-ups, tolerances), receives finished goods on the purchase order's goods
  receipts, and publishes an event on every lifecycle change.
- **FR-3** The system moves stock only through stock movement documents of the purposes it registers (send to
  subcontractor, return from subcontractor, consume at subcontractor with secondary outputs, receive from customer,
  return to customer) and the goods receipts and purchase returns of purchasing, and values only through the stock
  ledger and valuation.
- **FR-4** The system keeps one order model for both directions: the direction, the party (supplier or customer) and
  the source order (purchase or sales) say which flow applies. `(advanced)`

### 3.2 Subcontract services and locations

- **FR-5** A user with `SUBCONTRACT_SERVICES_EDIT` can define a subcontract service: finished item, bill of materials
  (defaulting to the item's default, or its template's), service item, service quantity per finished unit,
  consumption basis, over-send allowance and an optional routing operation; its suppliers, their order of preference,
  price and lead time are the service item's supplier terms; it can be deactivated.
- **FR-6** The system refuses a service whose service item is stocked, whose bill of materials belongs to another
  item, or a second active service for the same finished item and service item.
- **FR-7** The system finds the service for a finished item (and supplier) or for a service item, and fills a
  subcontract purchase line from it.
- **FR-8** A stock location held at a supplier for our material, or owned by a customer for theirs, is a location of
  the warehouse area marked with that supplier or customer as its owner on the locations page; a party's default
  location is its owned location of highest priority; a supplier location never doubles as a reserve location.

### 3.3 Outward orders

- **FR-9** The system creates a subcontract order from the subcontract lines of a purchase order, by hand or
  automatically when the order is approved (organization setting), refusing an order that is cancelled, closed, held
  or fully received, or whose supplier or organization differs.
- **FR-10** The system gives each output line the finished item, bill of materials, quantity, receiving location,
  service cost per finished unit (the supplier term's price per service unit times the service quantity per finished
  unit), additional cost per unit and material cost per unit, and computes the unit cost as their sum.
- **FR-11** The system computes the service quantity as finished quantity times the service's conversion and keeps it
  equal to the purchase order's service line quantity.
- **FR-12** The system derives material lines from the bill of materials for each output, one level or exploded to
  purchased items, each with required quantity, reserve location and alternatives.
- **FR-13** A user with `SUBCONTRACT_ORDERS_EDIT` can switch an order's consumption basis between "per bill of
  materials" and "as sent", and its required quantity between "per bill of materials" and "follow what was sent",
  overriding the service default. `(advanced)`
- **FR-14** A user with `SUBCONTRACT_MATERIALS_MOVE` can reserve required materials in their reserve locations, change
  or release the reservation; sending consumes it, and the remainder is released when the order completes.
- **FR-15** A user with `SUBCONTRACT_MATERIALS_MOVE` can send materials (chosen items and quantities, lots and serials)
  from our locations to the supplier's location; the system shows the quantity still to send per material and refuses
  more than required plus the over-send allowance.
- **FR-16** A user with `SUBCONTRACT_MATERIALS_MOVE` can return materials from the supplier's location to ours, within
  what is held there for the order.
- **FR-17** The system tracks per material the quantity required, reserved, sent, consumed, returned and scrapped, and
  per output the quantity ordered, received, rejected, returned and lost in process.
- **FR-18** The system derives the order's progress from received quantities first, otherwise from sent against
  required materials, with percentages shown on lists.
- **FR-19** A user with `SUBCONTRACT_ORDERS_EDIT` can close an order (no more sends or receipts; reservations released)
  and reopen it; both are refused while the purchase order is closed or held.

### 3.4 Outward receipts and returns

- **FR-20** A user with the goods receipt permission can receive finished goods on a goods receipt against one or
  several orders of one supplier with matching terms: accepted quantity to a location, rejected to a different
  location, lots and serials, the supplier's delivery note and carrier; a future date is refused.
- **FR-21** The system refuses a receipt line with neither accepted nor rejected quantity, and refuses rejected
  quantity on secondary outputs.
- **FR-22** The system consumes materials at the supplier's location on receipt, per bill of materials for the
  received quantity or in proportion to what was sent, as the order says; consumption can be edited within the
  tolerance and what is held there, with lots and serials named.
- **FR-23** A user with `SUBCONTRACT_CONSUMPTION_OVERRIDE` can post consumption outside the tolerance with a reason.
- **FR-24** The system values each received unit at consumed material cost plus service cost plus additional costs,
  spread over lines by the platform's one cost allocation (quantity, amount, weight, volume or manual shares), and hands
  the value to the stock ledger; standard-cost items record the variance.
- **FR-25** The system receives co-products, by-products, scrap and extra outputs with the receipt, each valued by its
  item's rate, a share of the component cost or a stated amount, and records process loss per line.
- **FR-26** The receipt is the purchase order's own goods receipt, so the service line's received quantity has one
  source and the supplier bill is matched against it without a second receipt.
- **FR-27** The system holds received units of items requiring inspection until the inspection passes and moves
  failed units to rejected.
- **FR-28** A user with the purchase return permission can return finished goods to the supplier as a purchase return
  of the goods receipt (whole or part, also from the rejected location), reversing cost in proportion to the received
  quantity, and checking lots and serials against what was received.
- **FR-29** The system lets landed cost documents target the goods receipt lines of a subcontract.

### 3.5 Sources of outward work

- **FR-30** The system creates subcontract orders from requisition lines routed to subcontracting, from production
  plan sub-assembly lines marked for subcontracting, and from purchase orders, keeping the links.
- **FR-31** The system proposes a subcontract order when a work order reaches an operation that a subcontract service
  names, sends the work in progress as material, and reports the operation done to the work order on receipt.
- **FR-32** The system writes subcontracted quantities back to the work order and production plan that asked for them.

### 3.6 Inward orders

- **FR-33** The system creates an inward subcontract order from a confirmed sales order line for a processing service,
  refusing a sales order that is closed or held, with output lines (finished item, bill of materials, quantity,
  delivery location) and material lines marked customer-provided or our own.
- **FR-34** A user with `SUBCONTRACT_MATERIALS_MOVE` can receive customer material into the customer's own location
  at no cost: only items the order requires (or allowed extras), within the required quantity plus allowance.
- **FR-35** The system reserves received customer material for the inward order, hands the reservation to its work
  orders, and adjusts it on returns and consumption; a work order reservation is checked before it is cancelled.
- **FR-36** A user with `SUBCONTRACT_ORDERS_EDIT` can create work orders for the outputs; consumption by them is limited
  to the order's requirements and the material held, with over-consumption refused unless allowed.
- **FR-37** A user with `SUBCONTRACT_ORDERS_EDIT` can, without work orders, record a production report on the inward
  order (output, consumption, secondary outputs, process loss).
- **FR-38** The system lets deliveries against the sales order ship only produced quantities, and returns of delivered
  goods update the order's returned quantity.
- **FR-39** A user with `SUBCONTRACT_MATERIALS_MOVE` can return unused customer material, within what is held, with
  lots and serials matching what was received.
- **FR-40** The system records customer-provided material at zero stock value, shows its consumed quantity on the
  finished item's cost sheet as customer-provided, and tracks billed quantities of our own materials.
- **FR-41** The system delivers secondary outputs to the customer when the organization or order says so.
- **FR-42** The system tracks per inward order the material received, consumed and returned, and the output produced,
  delivered, returned and lost in process, and derives its progress from them.

### 3.7 Work in progress and reconciliation `(advanced)`

- **FR-43** The system shows a live board of open outward orders per supplier: material sent and still held, last
  progress report, receipts, expected completion against the need date, and a lateness flag.
- **FR-44** A supplier's portal user can see their subcontract orders, the material we sent, and report progress
  (started, quantity done, expected completion, note, photos); each report updates the board at once.
- **FR-45** The system predicts completion from progress reports, tracked time, the supplier's past lead times and the
  lead time of its supplier terms, and raises a buyer exception when the prediction passes the need date.
- **FR-46** The system keeps per supplier the book balance of our material at its location with value and age, and
  warns when material is held longer than the organization's limit (default 60 days).
- **FR-47** A user with `SUBCONTRACT_RECONCILIATIONS_MANAGE` can start a reconciliation (on demand or monthly): a stock
  count of the supplier's location that asks the supplier in the portal for counted quantities per material and lot.
- **FR-48** The system compares counts with the book, proposes an adjustment per difference with its value (charge to
  supplier or write off), applies it when the count is approved and closed (the count's own corrections), and keeps the
  count with its decisions as the record of the reconciliation.

### 3.8 Contractors and tracked time `(advanced)`

- **FR-49** A user with `SUBCONTRACT_ORDERS_EDIT` can link a supplier to platform members who work for it (contractors)
  and give an outward order a task per output or operation in a project.
- **FR-50** The system rolls time tracked by those members on the order's tasks into the order: hours, labour cost at
  the pay rate stored on each time log, and progress against planned hours, live; a log counts only for the task it
  carries.
- **FR-51** The system proposes a supplier bill draft for time-priced services from approved time on the order, at the
  hourly price of the service in the supplier's terms, linked to the purchase order's service line.

### 3.9 Settings, reports and agents

- **FR-52** A user with `SUBCONTRACT_SETTINGS_EDIT` can set per organization: default consumption basis, consumption
  tolerance, over-send allowance, automatic order creation, rejected-material valuation, delivery of secondary
  outputs, material holding limit and reconciliation frequency.
- **FR-53** The system ships print templates for the subcontract order (with materials), the material send document
  and the subcontract receipt.
- **FR-54** The system ships these report definitions, filterable by organization, dates, supplier or customer and
  order, with drill-down:

  | Report | Answers |
  |---|---|
  | Outward order status | status, outputs and materials of each outward order |
  | Outputs to receive | finished goods still owed by subcontractors |
  | Materials to send | materials still to send to subcontractors |
  | Inward order status | status and quantities per inward order |
  | Outputs to deliver | finished goods still to deliver to customers |
  | Customer materials awaited | customer materials not yet received |
  | Material at subcontractors | quantity, value and age of our material per supplier |
  | Subcontract cost variance | planned against actual material, service, labour and additional cost per order |

- **FR-55** The system ships a subcontracting dashboard: cards for active subcontracted items, open outward orders,
  open inward orders and value at subcontractors; a chart of subcontract order amounts per period.
- **FR-56** The system offers MCP tools under the caller's permissions: order status, where material is, materials to
  send, resupply proposal, receipt with preview, reconciliation preview and cost variance explanation.
  `(advanced)`
- **FR-57** The system pushes order, send, receipt, progress and reconciliation changes to open screens through the
  real-time channel, and writes inbox items for late predictions, held material and reconciliation differences.

## 4. Non-Functional Requirements

- **Performance**: order lists P95 under 300 ms at 100,000 orders per organization; a receipt with 50 outputs and 500
  material lines posts in under 2 s; the live board for 500 open orders loads under 1 s; progress and time roll-ups
  within 10 s of the fact.
- **Concurrency**: optimistic versions on orders; receipts and sends lock the order's counters in one transaction;
  material movements and count closures at one supplier location run one at a time; retry keys on sends, receipts
  and returns.
- **Reliability**: one transaction per document across stock movements and counters; events through the outbox with
  idempotent consumers.
- **Security & privacy**: suppliers and customers see only their own orders and material; costs hidden from portal
  users; leaving the platform: reconciliation requests and progress notices by email to the party's contacts.
- **Auditability**: who, when, before and after for every confirmed document, consumption override and adjustment.
- **Accessibility and localization**: keyboard-operable, labelled screens; strings in every locale.
- **Compatibility**: PostgreSQL, MySQL, SQLite; both ORMs; additive migrations; cloud and self-hosted.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| --- | --- |
| Subcontract service | How a finished item is made by a supplier: bill of materials, service item, conversion, basis; suppliers from the service item's terms |
| Party location | A stock location whose owner is a supplier (our material held there) or a customer (their material) |
| Subcontract order | Work given to a supplier (outward) or taken from a customer (inward), with outputs and materials |
| Output line | A finished item to receive or produce, with its quantities and cost parts |
| Material line | A material required for an output, with reserved, sent or received, consumed and returned quantities |
| Material send / return | A stock movement document moving material to or from the party's location |
| Subcontract receipt | A goods receipt of finished goods from a supplier, with consumption, secondary outputs and costs |
| Production report | Output and consumption of an inward order recorded without work orders |
| Progress report | The supplier's statement of work done and expected completion |
| Material reconciliation | A stock count of the supplier's location answered by the supplier, with a decision per difference |
| Contractor link | Platform members who work for a supplier and track time on its orders |

## 6. Out of Scope

- Purchase orders, supplier master and terms, holds, portal confirmations, shipping notices, goods receipts and
  purchase returns: `procurement`.
- Bills of materials, routings, operations: `manufacturing-bom-and-routing`. Work orders and operation cards:
  `shop-floor-and-work-orders`. Production plans: `production-planning`.
- Stock locations and their owners, movement documents, purposes registry, reservations, stock counts:
  `warehouse-and-stock-movements`. Valuation, landed cost and the cost allocation, standard-cost variances,
  adjustments' value: `stock-ledger-and-valuation`. Lots and serials: `serials-and-batches`. Inspections:
  `quality-management`.
- Sales orders: `sales-order-management`. Deliveries and sales returns: `delivery-and-shipping`. Supplier bills and
  customer invoices: `invoicing-receivables-payables`. Postings: `general-ledger`.
- Portal sign-in and page shells: `customer-and-supplier-portal`. Time tracking itself: the platform's timer and time
  logs; the labour attribution rule: `shop-floor-and-work-orders`.

## 7. Acceptance Criteria

- [ ] **AC-1** A subcontract purchase line for 500 brackets produces an order with materials from the bill of
      materials; sends of 300 and 200 move stock to the supplier's location and consume the reservation (FR-9, FR-12).
- [ ] **AC-2** A receipt of 480 accepted and 20 rejected consumes material per the order's basis, values each unit at
      material plus service plus additional cost, and sets the purchase service line's received quantity to 500 (FR-20–FR-22).
- [ ] **AC-3** Over-send, over-consumption, consumption beyond tolerance without override, and receipts on a closed
      order are refused (FR-21, FR-23).
- [ ] **AC-4** A return of 10 finished units to the supplier reverses their cost proportionally; a return of unused
      material brings it back to our location (FR-10, FR-28, FR-39).
- [ ] **AC-5** An inward order receives customer parts at zero value into the customer-owned location, reserves them,
      makes 100 kits through a work order, delivers only produced quantity and returns leftovers (FR-8, FR-35, FR-39, FR-40).
- [ ] **AC-6** A work order operation named by a subcontract service proposes an order and is reported done on
      receipt (FR-31).
- [ ] **AC-7** A supplier's portal progress report updates the live board at once; a late prediction raises an
      exception (FR-44, FR-45).
- [ ] **AC-8** A reconciliation with a supplier count of 3 fewer proposes an adjustment with value, applied on approval (FR-47, FR-48).
- [ ] **AC-9** Contractor time on an order's task updates progress and labour cost and proposes a supplier bill draft (FR-50, FR-51).
- [ ] **AC-10** The MCP "where is material" tool answers with quantities per place and dates (FR-56).
- [ ] **AC-11** Every report of FR-54 and the dashboard of FR-55 return data on the demo tenant.
- [ ] **AC-12** Works on PostgreSQL, MySQL and SQLite with both ORMs; behind `FEATURE_SUBCONTRACTING`; nothing changes
      while it is off; every functional requirement has a passing test (FR-1; §4).
- [ ] **AC-13** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-1).

## 8. Open Questions

- Operation-level subcontracting (FR-31) needs `shop-floor-and-work-orders` to raise an event when a work order
  reaches an operation; default applied: the subcontract service names the routing operation, and the work order
  event is consumed when `shop-floor-and-work-orders` publishes it.
- Rejected material at the supplier is valued (FR-52); default applied: rejected goods keep their full receipt value
  until returned or scrapped.
- Charging a reconciliation shortfall to the supplier (FR-48) needs a supplier debit note; default applied: a debit
  note request is sent to invoicing when the count closes.

## 9. Constitution Gates

- [x] I Plugin-first — new plugin `packages/plugins/subcontracting` with `subcontracting-ui` and
      `subcontracting-react-ui`; it reaches purchasing, sales orders, stock and manufacturing through ports only.
- [x] II Tenant/organization scoping — every record tenant and organization scoped; portal reads scoped to the party.
- [x] III Both ORMs, additive migrations — new tables only, three dialects.
- [x] IV Default-off flag; nothing removed — `FEATURE_SUBCONTRACTING` off; purchase orders unchanged while off.
- [x] V Contracts and API first — contracts and REST before screens; OpenAPI additive.
- [x] VI Permissions, privacy, security — separate keys for services, orders, material moves, overrides and
      reconciliations; receipts and returns under purchasing's keys; costs hidden from portal users; email data flow in §4.
- [x] VII Real-time through the event bus — outbox events and realtime hints.
- [x] VIII i18n and accessibility — strings in every locale; accessible board and forms.
- [x] IX Tests accompany the change — each requirement has a test in the tasks.
- [x] X Behaviour-first — this document.
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Code: `packages/plugins/purchasing/src/lib/purchasing.types.ts`, `packages/plugins/inventory/src/lib/inventory.enums.ts`,
  `packages/core/src/lib/core/enums/kernel-extension.enums.ts` (`WarehouseType.THIRD_PARTY`)
- Related specs: `../procurement/spec.md`, `../manufacturing-bom-and-routing/spec.md`,
  `../shop-floor-and-work-orders/spec.md`, `../warehouse-and-stock-movements/spec.md`,
  `../stock-ledger-and-valuation/spec.md`, `../sales-order-management/spec.md`, `../delivery-and-shipping/spec.md`,
  `../customer-and-supplier-portal/spec.md`
