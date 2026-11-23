# Feature Specification: Procurement

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `procurement`
**Branch**: `feat/procurement`
**Status**: `Draft`
**Created**: 2026-11-15
**Last updated**: 2026-11-23
**Owner**: evereq
**Feature flag**: `FEATURE_PURCHASING` (existing, default off; wired to every route and menu entry by this spec) · new
behaviour also behind `FEATURE_PURCHASE_REQUISITIONS`, `FEATURE_PURCHASE_SOURCING`, `FEATURE_SUPPLIER_PERFORMANCE`
(all default off)

---

## 1. Overview

Today the platform raises purchase orders with a permission per lifecycle step, prices them from negotiated supplier
terms, receives goods against them with tolerances, and keeps ordered, received and billed quantities per line, all
through the API only, with nothing before or after the order. This feature makes it the full buying process of an
organization: anyone asks for something through a **requisition**; buyers source it through **requests for
quotation** and **supplier quotations** compared side by side, or call it off a **purchase agreement**; the **purchase
order** gains schedules, holds, revisions, printing, sending and supplier confirmation; receipts gain accepted and
rejected quantities, shipping notices, standalone receipts and **returns to the supplier**; the supplier master gains
groups, holds, documents and performance. Clients: the Angular app (procurement screens; requisitions and approvals
also on phones), the MCP server and agents, the API and SDKs, and the supplier portal.

**Advanced capabilities.** Anyone, a person in chat or an AI agent, raises a requisition in a sentence and
sees the budget and commitment check before submitting. Sourcing runs as events with rounds, sealed answers, weighted
scoring and split awards. Supplier scorecards update within a minute of each receipt, inspection, delivery date and
bill match, and suppliers see their own. A buying plan turns reorder, production and people's requests into
supplier-grouped orders with order-by dates, and an agent explains every line. Mismatches between order, shipping
notice, receipt and bill reach one buyer queue with tolerances and clear themselves. Suppliers confirm orders, propose
dates, send shipping notices and upload invoices in the portal. Supplier documents expire on a calendar with reminders
and holds, and a risk view says why a supplier is risky. These requirements are marked `(advanced)`.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** an employee with `PURCHASE_REQUISITIONS_CREATE`, **when** they write in chat "two 27-inch monitors for the
  design team by Friday", **then** the assistant drafts a requisition with item, quantity, date and the team's cost
  centre, shows "within budget: 1,240 of 3,000 left after open commitments", and submits it on confirmation.
- **Given** a submitted requisition above the threshold, **when** the approver approves it, **then** it reaches the
  buyers' queue with a route per line (buy from the preferred supplier, call off an agreement, transfer from a location
  with free stock) and the requester is told.
- **Given** approved lines from three departments, **when** a buyer chooses "Order", **then** one draft order per
  supplier is created, priced from the agreement or the supplier's terms, each line linked to its requisition line.
- **Given** a sourcing event for 12 items sent to five suppliers with sealed answers until Monday 12:00, **when** the
  deadline passes, **then** the answers open together, the comparison shows price, lead time and score per line with
  a weighted total, and the buyer awards 70 % of item A to one supplier and 30 % to another as two draft orders.
- **Given** an order published in the portal, **when** the supplier confirms it with a later date on one line,
  **then** the buyer accepts the proposal and the order records it as a change set with the supplier's reference.
- **Given** a supplier's shipping notice with lots, **when** the goods arrive, **then** the clerk posts a receipt
  prefilled from it with 98 accepted and 2 rejected; a return of the 2 moves them out at receipt value and invoicing
  expects a supplier credit.
- **Given** approved buy lines raised by people, the reorder job and a production plan, **when** the buying plan runs,
  **then** the buyer sees supplier-grouped proposals with order-by dates, and each line answers "why this supplier,
  this quantity, this date".
- **Given** a supplier whose insurance expires in 30 days and whose on-time rate is falling, **when** the dates and
  receipts come in, **then** supplier and buyer are reminded, the score band changes within a minute, new orders warn,
  and on expiry an ordering hold starts until a new certificate is filed.

### 2.2 Edge cases & failures

- **Given** a user without `PURCHASE_REQUISITIONS_APPROVE`, or an agent with view permissions only, **when** they
  approve a requisition or send an order, **then** they are refused (403); an agent with the permission gets a preview
  and acts only on confirmation.
- **Given** two buyers saving the same draft order, **when** the second save arrives, **then** it is refused as stale
  and nothing of it is written.
- **Given** a line over a budget whose control is "stop", **when** it is submitted, **then** it is refused naming the
  budget and the shortfall; with "warn" it passes with the warning recorded.
- **Given** a supplier on an ordering hold, **when** a buyer sends it an order or invites it to sourcing, **then** it
  is refused naming the hold, reason and release date; receipts of earlier orders still work.
- **Given** a receipt dated in a closed stock period, **when** it is posted, **then** it is refused and nothing moves.
- **Given** a portal answer one minute after the deadline, **when** it arrives, **then** it is refused unless the
  buyer reopened the round.
- **Given** a return of more than was received and not yet returned, **when** it is confirmed, **then** it is refused
  with the quantity still returnable.
- **Given** a warehouse tablet that reconnects and posts the same receipt twice, **when** the second post arrives,
  **then** it is answered with the first receipt and stock moves once.
- **Given** 40 proposal lines converted at once of which 2 name a supplier on hold, **when** it finishes, **then** 38
  lines are on draft orders and 2 are listed with the reason; nothing is half-created.
- **Given** `FEATURE_PURCHASING` off for a tenant, **when** a procurement route is called, **then** it is refused, the
  menu hides the area and the data stays untouched.

## 3. Functional Requirements

### 3.1 Scope, flags and compatibility

- **FR-1** The system gates every procurement route, GraphQL field, menu entry and MCP tool with `FEATURE_PURCHASING`;
  requisitions and the buying plan also with `FEATURE_PURCHASE_REQUISITIONS`, sourcing with
  `FEATURE_PURCHASE_SOURCING`, scorecards, supplier documents and risk with `FEATURE_SUPPLIER_PERFORMANCE`; supplier
  self-service also needs `FEATURE_CUSTOMER_PORTAL`.
- **FR-2** The system keeps every existing purchase order, receipt and vendor term route, field, permission, status and
  refusal code with unchanged behaviour; everything added is additive.
- **FR-3** The system registers requisitions, requests for quotation, supplier quotations, purchase agreements,
  purchase orders, receipts, purchase returns and shipping notices with the business document engine for numbering,
  lifecycle, links, roll-ups, tolerances, change sets and document flow; existing numbers are kept.
- **FR-4** The system publishes an event for every lifecycle change of these documents and never writes stock levels,
  ledger lines, bills or payments itself.

### 3.2 Supplier master, holds, documents and risk

- **FR-5** A user with `SUPPLIERS_MANAGE` can record how the organization deals with a supplier: company or person,
  its group, where it is and which language and currency it works in, its tax and withholding identity (resolved by
  the tax engine), its default settlement term, our customer number at that supplier, whether it also carries goods
  for us, and whether it is disabled; the form also shows the existing purchasing fields (code, lead time, minimum
  order amount), the buying price lists that name it and the bank accounts kept by banking.
- **FR-6** A user with `SUPPLIERS_MANAGE` can keep several contacts and addresses per supplier with roles (ordering,
  billing, dispatch, returns), one primary of each, a primary contact always belonging to that supplier.
- **FR-7** A user with `SUPPLIERS_MANAGE` can maintain a tree of supplier groups with default settlement term,
  currency and payable account; a new supplier takes its group's defaults and its own values win.
- **FR-8** A user with `SUPPLIERS_MANAGE` can mark a supplier internal, naming the organization of the tenant it
  represents (one per represented organization); orders to it follow the inter-organization flow.
- **FR-9** The system refuses, on any procurement document, a shared supplier whose allow-list excludes the document's
  organization.
- **FR-10** A user with `SUPPLIER_HOLDS_MANAGE` can hold a supplier for any of ordering, receiving, billing and paying,
  with a reason and an optional release date on which the system lifts it (the party hold customers also use); each
  refusal names the hold:

  | Hold covers | Refused while it stands |
  |---|---|
  | ordering | sourcing invitations, awards, order approval and sending, agreement call-offs |
  | receiving | receipts and shipping notices |
  | billing | bill confirmation (enforced by invoicing) |
  | paying | payments to the supplier (enforced by payments) |

- **FR-11** A user with `SUPPLIERS_MANAGE` can file supplier documents (certificate, insurance, registration,
  declaration) with number, issue and expiry dates and the file; a supplier group can require document types.
  `(advanced)`
- **FR-12** The system reminds supplier and buyer before a document expires (default 30 and 7 days), marks it expired
  on the day, and places an ordering hold for a missing or expired required document until a valid one is filed.
  `(advanced)`
- **FR-13** The system computes a supplier risk level (low, medium, high) from missing or expired documents, score
  band, share of category spend, items it alone supplies, overdue confirmations and a manual note, and lists each
  reason on the supplier. `(advanced)`

### 3.3 Requisitions

- **FR-14** A user with `PURCHASE_REQUISITIONS_CREATE` can raise a requisition with lines of item (or description,
  unit and estimated price), quantity, needed-by date, destination location, project, cost centre or expense category
  and note, with header values applied to every line.
- **FR-15** The system lets a requisition be drafted from a chat message, by the AI assistant or by an agent through
  an MCP tool, with items, prices and budget check resolved, and submits it only on the requester's confirmation or
  the agent's explicit submit under its own permission. `(advanced)`
- **FR-16** The system checks, as a line is added and on submit, the remaining budget of its cost centre, account or
  project after actuals and open commitments (approved requisition lines not ordered, order lines not billed) and
  shows within, warning or over with the figures. `(advanced)`
- **FR-17** The system applies the budget's control on submit (stop refuses, warn records, ignore passes), falls back
  to the project's cost budget when no budget engine is present, and passes when there is no budget.
- **FR-18** The budget area records a commitment per approved line from this feature's events, moves it to the order
  line and releases it when the line closes, is cancelled or billed; without it, open lines count in the project check.
- **FR-19** The system routes a submitted requisition through the approval workflows (amount, cost centre, category);
  without a workflow `PURCHASE_REQUISITIONS_APPROVE` decides, and a rejection returns it to the requester with reason.
- **FR-20** The system accepts requisitions raised by the reorder job and production planning as a system actor, with
  their source and kind per line, and notifies the buyers.
- **FR-21** The system proposes a route per approved line (buy, transfer from a location with free stock, issue from
  stock, make, subcontract, expect from a customer), which a user with `PURCHASE_REQUISITIONS_PROCESS` can change.
- **FR-22** A user with `PURCHASE_REQUISITIONS_PROCESS` can turn selected buy lines into one order, into one draft order
  per supplier (preferred supplier per item, overridable per line; refused for an item without a supplier or twice in
  one run), into a request for quotation, or into a supplier quotation.
- **FR-23** A user with `PURCHASE_REQUISITIONS_PROCESS` can turn transfer, issue, make, subcontract and customer lines
  into a stock transfer (with in-transit when locations are apart) or pick list, a stock issue, a work order, a
  subcontract order, or an expected receipt of customer-owned stock, each linked to its line.
- **FR-24** The system fills a requisition from a bill of materials (one or all levels), a sales order, items below
  their reorder level or a production plan, keeping the source link on each line.
- **FR-25** The system tracks per line the quantity requested, sourced and fulfilled, derives the line's and the
  requisition's progress, and publishes requested quantities so projected stock counts them.
- **FR-26** A user with `PURCHASE_REQUISITIONS_PROCESS` can hold a requisition (nothing more is sourced), release it,
  close remaining lines, or cancel it while nothing is sourced; a cancelled requisition is final.
- **FR-27** The system tells the requester when a line is sourced, each time its fulfilled share changes, and when it
  is closed short.

### 3.4 Buying plan `(advanced)`

- **FR-28** The system builds a buying plan nightly and on demand from open buy lines (people, reorder job, production
  plans) and from the stock figures of the warehouse area; it never recomputes projected stock itself.
- **FR-29** The system groups plan lines by supplier, chosen by agreement, preferred mark, price, lead time and score;
  it consolidates lines of one item, rounds to pack size and supplier minimums, and computes the latest order date.
- **FR-30** The system stores for each plan line the facts behind it (needs and their sources, shortage date, lead
  time, rounding, agreement balance, alternatives and why they lost); an MCP tool explains a line in plain language
  and answers "what if" questions without writing anything.
- **FR-31** A user with `PURCHASE_PROPOSALS_MANAGE` can accept, edit or dismiss plan lines; accepted lines become draft
  orders per supplier, with a result per line.
- **FR-32** The system converts and sends plan lines of items marked "buy automatically" (the item's existing
  setting) without a person when the organization allows it, within its amount limit per order.

### 3.5 Requests for quotation and supplier quotations

- **FR-33** A user with `SOURCING_EVENTS_EDIT` can create a request for quotation with lines (item or description,
  quantity, unit, date), delivery address and terms, answer deadline, terms text and files, built by hand, from
  requisitions (grouped by preferred supplier) or from a deal's products, keeping source links.
- **FR-34** A user with `SOURCING_EVENTS_EDIT` can invite suppliers one by one or by tag or group; duplicates, suppliers
  on an ordering hold and suppliers without a contact email or portal access are refused.
- **FR-35** A user with `SOURCING_EVENTS_EDIT` can write the invitation from an email template with merge fields
  (supplier, contact, portal link, deadline), attach the printed request and files, and preview it per supplier.
- **FR-36** The system sends each invitation with a portal link, provisions portal access for a supplier without it,
  and records per supplier invited, viewed, answered or declined.
- **FR-37** A supplier can answer in the portal per line (price, lead time, minimum quantity, validity, own reference,
  note), decline lines or upload a file; the answer becomes a supplier quotation.
- **FR-38** A user with `SOURCING_EVENTS_EDIT` can record a quotation by hand; a second live quotation of one supplier
  for one request is refused unless the first is withdrawn.
- **FR-39** The system writes supplier item codes and lead times from an accepted answer to that supplier's terms.
- **FR-40** The system accepts zero-quantity lines on requests, quotations and orders to record a unit price only, and
  never receives or bills them.
- **FR-41** The system expires a quotation after its validity and leaves it out of comparison unless asked to include
  expired ones.
- **FR-42** A user with `SOURCING_EVENTS_EDIT` can run an event in rounds, inviting chosen answers to a next round with
  a new deadline; every round's answers are kept. `(advanced)`
- **FR-43** The system keeps answers sealed until the deadline when the event says so: nobody sees a price before it,
  and the opening is recorded with who and when. `(advanced)`
- **FR-44** The system compares quotations per line and supplier in the event currency (price, estimated landed cost,
  lead time, minimum, validity, last price paid) with a weighted score on criteria the buyer sets (price, lead time,
  scorecard, risk, terms) and marks the best per line. `(advanced)`
- **FR-45** A user with `SOURCING_EVENTS_AWARD` can award a line to one or several suppliers by quantity or share with
  a reason and turn awards into draft orders, a purchase agreement, a bill for a one-off service, or a customer
  quotation for resale; the quotation tracks ordered quantity per line. `(advanced)`
- **FR-46** The system tells each answering supplier its outcome without showing other suppliers' prices.

### 3.6 Purchase agreements

- **FR-47** A user with `PURCHASE_AGREEMENTS_EDIT` can agree with a supplier a validity, lines of item, price (kept
  as the supplier's term for the agreement's validity), committed quantity or value, minimum call-off and allowance.
- **FR-48** The system prices an order line from the term of a valid agreement, else the supplier's other live terms,
  with the rules of its buying price lists on top, else the item's cost, and records which one priced it.
- **FR-49** The system accumulates ordered, received and billed quantity and value per agreement line, refuses a
  call-off beyond commitment plus allowance, and re-checks when a closed order is reopened.
- **FR-50** The system warns the buyer when an agreement nears its end or 80 % of its commitment, and lists agreements
  that will miss their commitment at the current call-off rate. `(advanced)`

### 3.7 Purchase orders

- **FR-51** A user with `PURCHASE_ORDERS_CREATE` can raise an order with schedule lines (several dates per line),
  ordering contact, ship-to, bill-to and dispatch addresses, delivery terms, settlement term, terms text, and
  service or expense lines without an item beside item lines; a stocked item needs a receiving location and a service
  line takes none; an expected date before the order date is accepted with a warning, and refused only with the
  strict purchase checks of FR-99 on.
- **FR-52** The system fills an item line with the supplier's price, purchase unit, supplier item code, lead time,
  expected date, location, expense account and cost centre, and shows the last price paid in the order's currency
  and unit (switchable off).
- **FR-53** The system accepts per line a free item mark, discount and margin as percent or amount, pricing rules, tax
  category, account, cost centre, project, asset mark, manufacturer and part number.
- **FR-54** The system computes totals through the document totals pipeline (pricing, discounts, tax engine,
  rounding) with a document discount on net or grand total and an instalment schedule from the settlement term.
- **FR-55** The system refuses an order below the supplier's minimum order quantity of an item, in stock units over
  all lines, and warns below the supplier's minimum order amount.
- **FR-56** The system applies the organization's "same price along the chain" rule (off by default, warn, stop) when
  a line's price departs from its quotation or agreement; a user with `PURCHASE_PRICE_OVERRIDE` can pass a stop.
- **FR-57** The system routes order approval through the approval workflows by amount, supplier, category and cost
  centre; without one the existing approval step applies.
- **FR-58** A user with `PURCHASE_ORDERS_SEND` can send an approved order by email with its printed form and publish it
  in the portal; recipients and time are recorded.
- **FR-59** A user with `PURCHASE_ORDERS_EDIT` can hold an order with a reason (no sending, receiving or billing while
  held) and release it; the hold is a fact beside the status.
- **FR-60** The system shows per order and line the received and billed shares, advances requested and paid, open
  quantity, and the downstream documents in the document flow.
- **FR-61** A user with `PURCHASE_ORDERS_EDIT` can change quantities, prices and dates of a sent order through a change
  set, re-approved when it crosses the approval band and resent as a revision; no quantity goes below what arrived.
- **FR-62** A user with `PURCHASE_ORDERS_EDIT` can close and reopen single lines; a closed line stops counting as open
  and incoming.
- **FR-63** The system can require an advance before sending, by supplier or amount, and can repeat an order on a
  schedule through the document engine's recurrence.
- **FR-64** The system publishes the incoming quantities of open order lines so the receiving location's projected
  stock counts them until received, closed or cancelled.
- **FR-65** The system blocks or warns about new orders and invitations to a supplier whose score band says so.
- **FR-66** The system lets an organization require an order, and a receipt, before a bill, with exceptions per
  supplier that invoicing applies.
- **FR-67** The system lets a line be delivered by the supplier to a customer: no receipt, the customer and address on
  the order, the delivered quantity confirmed by the supplier in the portal or by a user with `PURCHASE_ORDERS_EDIT`
  (within the line quantity, not on closed lines, recorded), rolled up to the sales order.
- **FR-68** The system lets a line be a subcontract service for a finished item, handled by subcontracting.
- **FR-69** The system accepts orders from production planning and keeps the plan's ordered quantity in step on
  create and cancel.

### 3.8 Supplier self-service `(advanced)`

- **FR-70** A supplier's portal user sees their requests, quotations, orders, notices, receipts, returns, bills,
  payments, documents and scorecard, and nothing of another supplier.
- **FR-71** A supplier can confirm an order or propose other quantities, dates or prices per line with their
  reference; the buyer accepts or rejects each proposal and an accepted one becomes a change set.
- **FR-72** The system reminds a supplier once when an order is unconfirmed after the organization's window (default
  2 working days).
- **FR-73** A supplier can send a shipping notice against one or several orders with lines, lots or serials, packages,
  carrier, tracking reference and arrival date; the order shows it in transit.
- **FR-74** A supplier can upload an invoice against an order; it reaches invoicing's bill capture linked to the order
  and the supplier sees its match and payment state.

### 3.9 Receipts and returns

- **FR-75** A user with `GOODS_RECEIPTS_CREATE` can post a receipt against one or several orders, from a shipping
  notice, or without an order when the organization allows it, with delivery note, carrier and transport reference; a
  future date is accepted with a warning, as today, and refused only with the strict purchase checks of FR-99 on.
- **FR-76** The system splits each received quantity into accepted (to the line's location or bin) and rejected (to
  the rejected location), counts the existing damaged quantity as rejected, and refuses a line with neither.
- **FR-77** The system keeps the existing over-receipt tolerance and lets a user with `PURCHASE_EXCEPTIONS_RESOLVE`
  accept a larger over-receipt as an exception instead of refusing it.
- **FR-78** The system keeps accepted units of an item requiring incoming inspection out of available stock until it
  passes, and moves failed units to rejected.
- **FR-79** The system places received units by the warehouse's putaway rules or into the bin on the line, and records
  lots, serials and expiry through bundles.
- **FR-80** The system publishes received lines of asset items so the asset register can create the assets.
- **FR-81** The system receives goods from another organization of the tenant against its dispatch, at its cost.
- **FR-82** A user with `PURCHASE_RETURNS_CREATE` can return goods against a receipt (whole or part, with lots and
  serials, from accepted or rejected stock) or standalone at a stated price, with a governed return reason; stock
  leaves at the receipt's value and receipt and order lines track returned quantities.
- **FR-83** The system refuses a return beyond what was received and not returned, and asks invoicing for a supplier
  credit or expects a replacement, as the return states.
- **FR-84** The system keeps the existing reversal of a whole receipt, and lets a user bill one or several receipts by
  quantity through invoicing, showing each receipt's billed share.

### 3.10 Buyer exception queue `(advanced)`

- **FR-85** The system raises an exception for the order's buyer when an order is unconfirmed in time, a confirmed
  date is late for the need, a line is overdue, a notice differs from its order, a receipt differs from its notice, an
  over-receipt was accepted, rejections pass the limit, or invoicing routes a bill mismatch to the buyer.
- **FR-86** The system applies the document engine's tolerances before raising one, shows variance, value at stake and
  age, and clears it when the facts no longer hold.
- **FR-87** A user with `PURCHASE_EXCEPTIONS_RESOLVE` can resolve it by a change set, closing the line short, asking
  for credit or replacement, a return, or acceptance with reason; each resolution is recorded.

### 3.11 Supplier scorecards `(advanced)`

- **FR-88** A user with `SUPPLIER_SCORECARDS_EDIT` can define scorecards per organization or supplier group with
  weighted criteria; weights are normalised and need not add up to 100.
- **FR-89** The system measures from real facts: on-time delivery, days late, quantity accuracy, acceptance rate,
  returns, price variance against agreements, quotation response rate and time, confirmation time, bill match accuracy
  and document compliance; an admin can add a criterion as a formula over these measures, refused if invalid.
- **FR-90** The system updates measures and score within 60 seconds of each receipt, inspection, return,
  confirmation, quotation and bill match, over a rolling window (default 12 months).
- **FR-91** A user with `SUPPLIER_SCORECARDS_EDIT` can define bands covering 0 to 100 without gaps or overlaps, each
  with actions: warn or block orders and invitations, notify the supplier, notify named users.
- **FR-92** The system keeps a monthly score snapshot per supplier with each criterion's value and inputs, never
  rewritten, for the history chart.

### 3.12 Settings, printing, reports and agents

- **FR-93** A user with `PURCHASING_SETTINGS_EDIT` can set per organization: supplier numbering, document chain
  rules, standalone receipts, rejected location, tolerances, zero-quantity lines, price rule, advance rules,
  confirmation window, plan schedule, automatic ordering limit, last-price display and strict purchase checks (FR-99).
- **FR-94** The system ships print templates for request for quotation, purchase order (with and without prices),
  drop-ship order, return, shipping notice and open orders list, rendered in the supplier's language.
- **FR-95** The system ships these report definitions, filterable by organization, dates, supplier, group, item, item
  group, project and buyer, with drill-down to documents:

  | Report | Answers |
  |---|---|
  | Item buying history | what was bought, from whom, at which price and quantity |
  | Requisition follow-up | per line: sourced on what, from whom, estimated against actual cost, done or not |
  | Purchases by dimension | quantity or value per item, group, supplier, project or order over periods |
  | Open purchase orders | lines still to receive or bill, with quantities and amounts |
  | Ordering over time | order totals per period by item, supplier or project |
  | Unfilled requisition lines | requested lines not yet ordered or received |
  | Quotation comparison | prices, lead times and scores per item across suppliers and events |
  | Receipts over time | received value per period by item, supplier or location |
  | Supplier performance and risk | scores, bands, criteria and risk reasons |
  | Spend and savings | spend by category and supplier, agreement coverage, savings against first quotes |

- **FR-96** The system ships a procurement dashboard: cards for active suppliers, spend this year, average order value,
  orders to receive, orders to bill, open requisitions and open exceptions; charts for requisition progress, order
  trends and top suppliers.
- **FR-97** The system offers MCP tools under the caller's permissions for requisitions, budget check, the buying plan
  and its explanations, comparison, order status and changes, receipts, returns, scores and risk; tools that send,
  award, approve or post take `preview: true` first.
- **FR-98** The system pushes changes of requisitions, orders, answers, exceptions and scores to open screens through
  the real-time channel and writes inbox items for approvals, awards, exceptions and expiring documents.
- **FR-99** A user with `PURCHASING_SETTINGS_EDIT` can switch on, per organization, strict purchase checks (default
  off): an order line with an expected date before the order date (FR-51) and a receipt dated in the future (FR-75)
  are then refused. With them off, the existing order and receipt routes accept both as they do today, and the
  document records a warning.

## 4. Non-Functional Requirements

- **Performance**: list pages P95 under 300 ms at one million order lines per tenant; budget check P95 under 400 ms;
  order confirmation under 500 ms excluding asynchronous postings; comparison of 20 suppliers × 500 lines under 2 s;
  buying plan over 50,000 item-locations under 10 minutes; score update within 60 s.
- **Volume and concurrency**: 1,000,000 order lines and 10,000 suppliers per organization; optimistic versions on
  every document (`If-Match`); retry keys on receipts, returns, conversions and portal submissions; batch conversions
  answer per line.
- **Reliability**: events through the outbox, at least once, with idempotent consumers that catch up after downtime.
- **Security & privacy**: suppliers see only their own documents; sealed answers unreadable before opening; supplier
  documents readable with `SUPPLIERS_MANAGE` only; leaving the platform: invitations, orders, reminders and outcomes
  emailed to supplier contacts.
- **Auditability**: who, when, before and after for every change to a confirmed document, hold, award, band and
  price override; agent actions are marked as such.
- **Accessibility and localisation**: keyboard-operable, labelled screens; strings in every locale; documents in the
  supplier's language and currency.
- **Compatibility**: PostgreSQL, MySQL, SQLite; both ORMs; additive migrations; cloud and self-hosted; OpenAPI additive.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| --- | --- |
| Supplier (vendor) | The existing supplier master, extended with procurement facts, contacts, addresses and group |
| Supplier group | A tree node giving defaults to its suppliers |
| Supplier hold | A party hold: a stop on ordering, receiving, billing or paying a supplier, with reason and release date |
| Supplier document, supplier risk | A supplier's certificate with expiry; its computed risk level with reasons |
| Requisition | An internal request with lines, route and budget check; its commitments are budget records |
| Buying plan line | A supplier-grouped purchase proposal with order-by date and its explanation |
| Request for quotation | An invitation to suppliers to quote, in one or more rounds |
| Supplier quotation, award | A supplier's priced answer; the share of a line given to a supplier |
| Purchase agreement | Agreed prices and committed quantities with a supplier, called off by orders |
| Purchase order | The existing order, extended with schedules, holds, revisions and confirmation |
| Supplier confirmation | The supplier's acceptance or proposed change of an order |
| Shipping notice | The supplier's announcement of a shipment against orders |
| Goods receipt | The existing receipt, extended with rejected quantities, notices and standalone receipts |
| Purchase return | Goods sent back to a supplier against a receipt |
| Purchase exception | A mismatch between order, notice, receipt or bill waiting for the buyer |
| Scorecard, criterion, band, snapshot | How supplier performance is weighted, measured, acted upon and frozen monthly |

## 6. Out of Scope

- Supplier bills, bill matching and its queue, bill holds, received-not-billed accruals:
  `invoicing-receivables-payables`. Payments and advances: `payments-and-collections`. Party bank accounts:
  `banking-and-reconciliation`.
- Numbering, lifecycle, links, tolerances, change sets, recurrence: `business-document-engine`. Approval engine:
  `approval-workflows`.
- Valuation of receipts and returns, landed cost: `stock-ledger-and-valuation`. Movement documents, projected stock,
  reorder levels and the reorder job, putaway rules, pick lists, inter-organization stock flows:
  `warehouse-and-stock-movements`. Inspections: `quality-management`. Lots and serials: `serials-and-batches`. Asset
  creation: `fixed-assets`.
- Subcontract orders, supplied materials, subcontract receipts: `subcontracting`. Forecasts and production plans:
  `production-planning`; work orders: `shop-floor-and-work-orders`; bills of materials:
  `manufacturing-bom-and-routing`.
- Drop-ship and back-to-back creation from sales orders, sales blanket orders: `sales-order-management`.
- Portal sign-in, menu and page shells: `customer-and-supplier-portal`. Template design: `print-and-pdf-designer`.
  Email transport: `email-and-communications`. Chat record actions: `chat-agents-and-record-actions`.
- Tax calculation, withholding categories: `tax-engine`. Price lists and rules: `pricing-and-promotions`. Budgets,
  commitments and control actions: `budgets-and-revenue-schedules`; project budgets: `project-costing-and-billing`.
  Party accounts: `general-ledger`. Shared-master allow-lists and group companies: `organization-setup`.

## 7. Acceptance Criteria

- [ ] **AC-1** A requisition raised in chat shows the budget check, passes a two-step approval, becomes one draft order
      per supplier, and its requester is told when goods arrive (FR-15, FR-17, FR-57).
- [ ] **AC-2** A "stop" budget refuses the submit naming the shortfall; a "warn" budget passes with the warning (FR-16, FR-17).
- [ ] **AC-3** A sealed three-supplier event opens at the deadline, compares with weighted scores, refuses a late
      answer, and turns a 70/30 award into two draft orders (FR-43, FR-44).
- [ ] **AC-4** Orders priced from an agreement accumulate call-offs, warn the buyer at 80 % of the commitment, and are
      refused past commitment plus allowance (FR-48–FR-50).
- [ ] **AC-5** A supplier confirms with a later date in the portal; the accepted proposal is a change set; an order
      left unconfirmed past the window raises an exception and one reminder (FR-71).
- [ ] **AC-6** A shipping notice prefills a receipt; accepted and rejected units land in their locations; a partial
      return leaves at receipt value and invoicing expects a credit (FR-75, FR-76, FR-78).
- [ ] **AC-7** A supplier on an ordering hold cannot be invited or sent an order; the hold lifts on its date; an
      expired required document starts a hold that a new document lifts, and the risk view names it as a reason (FR-10, FR-65).
- [ ] **AC-8** A late receipt changes the supplier's score within 60 s and crossing a band warns on the next order (FR-65, FR-88).
- [ ] **AC-9** The buying plan groups lines by supplier with order-by dates; the MCP explain tool answers for a line;
      converting 40 lines with 2 failures yields 38 converted and 2 reasons (FR-29, FR-30, FR-97).
- [ ] **AC-10** The exception queue shows a notice-versus-receipt difference and clears it when corrected (FR-85–FR-87).
- [ ] **AC-11** Every report of FR-95 and the dashboard of FR-96 return data on the demo tenant.
- [ ] **AC-12** Existing purchase order, receipt and vendor term tests pass unchanged; with the flags off nothing
      changes (FR-1, FR-2).
- [ ] **AC-13** Works on PostgreSQL, MySQL and SQLite with both ORMs; every functional requirement has a passing test (§4).
- [ ] **AC-14** With strict purchase checks off (the default) an order with an expected date before its order date and
      a receipt dated tomorrow are accepted through the existing routes with a warning; with them on both are refused (FR-51, FR-75, FR-99).
- [ ] **AC-15** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-1).

## 8. Open Questions

- Supplier item codes live on vendor terms today while `item-catalogue` owns supplier codes; default applied: the
  vendor term stays the single store and the item catalogue reads it.
- Automatic ordering (FR-32): default applied, off per organization, limit 1,000 in the organization currency per order.
- Receipts without an order (FR-75): default applied, off per organization.
- Whether suppliers see their numeric score or only their band (FR-70): default applied, score with its criteria.

## 9. Constitution Gates

- [x] I Plugin-first — server code extends `packages/plugins/purchasing`; UI in new `purchasing-ui`; core gains only
      the shared party hold (the vendor page gains tabs through the UI plugin slots).
- [x] II Tenant/organization scoping — every new record is tenant and organization scoped; portal reads are scoped to
      the supplier.
- [x] III Both ORMs, additive migrations — new tables and nullable columns only, three dialects.
- [x] IV Default-off flag; nothing removed — `FEATURE_PURCHASING` stays off, three sub-features off, routes kept.
- [x] V Contracts and API first — contracts and REST before screens; OpenAPI additive.
- [x] VI Permissions, privacy, security — a key per decision (approve, send, award, hold, override, resolve); sealed
      answers; supplier isolation; email data flow listed in §4.
- [x] VII Real-time through the event bus — outbox events, realtime hints and inbox items.
- [x] VIII i18n and accessibility — strings in every locale; documents in the supplier's language.
- [x] IX Tests accompany the change — each requirement has a test in the tasks.
- [x] X Behaviour-first — this document.
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Code: `packages/plugins/purchasing/README.md`, `packages/plugins/purchasing/src/lib/purchasing.types.ts`,
  `packages/core/src/lib/organization-vendor/organization-vendor.entity.ts`
- Related specs: `../business-document-engine/spec.md`, `../approval-workflows/spec.md`,
  `../invoicing-receivables-payables/spec.md`, `../warehouse-and-stock-movements/spec.md`,
  `../stock-ledger-and-valuation/spec.md`, `../customer-and-supplier-portal/spec.md`, `../subcontracting/spec.md`,
  `../budgets-and-revenue-schedules/spec.md`, `../production-planning/spec.md`, `../pricing-and-promotions/spec.md`
