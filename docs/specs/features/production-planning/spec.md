# Feature Specification: Production planning

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `production-planning`
**Branch**: `feat/production-planning`
**Status**: `Draft`
**Created**: 2026-11-16
**Last updated**: 2026-11-23
**Owner**: evereq
**Feature flag**: `FEATURE_PRODUCTION_PLANNING` (new, default off; needs `FEATURE_MANUFACTURING`; buying proposals need
`FEATURE_PURCHASING`, sales demand `FEATURE_ORDER`)

---

## 1. Overview

Nothing plans production today: there is no production plan, no material requirement and no capacity view. This
feature adds the planning part of the `manufacturing` plugin: **production plans** that gather open sales orders and
make requisitions, plan finished items, sub-assemblies and raw materials and create work orders, subcontract orders,
requisitions and purchase orders from them; a **master production schedule** over time buckets fed by orders and
**demand forecasts**; **material requirements** per item, location and date with planned orders, pegging and
exceptions; **scheduling** of plans and of every operation on work centres; a plan visualiser and planning reports.
Clients: the Angular app, the planning board, the MCP server and agents, the API and SDKs.

**Advanced capabilities.** Material requirements are kept current continuously from sales, stock, purchase and
production events instead of a report someone runs, with every planned order pegged to the demand it serves. An agent
explains each proposal from its facts and drafts purchase orders, requisitions, work orders, transfers and subcontract
orders with a preview; nothing is confirmed without a person. Planned orders are firmed straight from the schedule.
Finite-capacity scheduling places every operation on work centres and available operators, on a drag-and-drop board that
updates live, and what-if scenarios (a machine down, an extra shift, a rush order) are compared side by side before they
are applied. Statistical forecasts choose their method per item by measured accuracy and feed the schedule, and sales
promise dates come from the real schedule. These requirements are marked `(advanced)`.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** open sales orders delivering in the next four weeks, **when** a planner with `PRODUCTION_PLANS_EDIT` pulls them
  into a plan and fetches items, **then** desks and chairs appear with their pending quantities (less what other plans and
  work orders already cover), the same item from several orders is combined with references kept, sub-assemblies and raw
  materials are listed with projected stock, and one action creates the work orders and the purchase requisitions.
- **Given** a weekly schedule fed by a monthly forecast of 400 desks and 120 ordered in week 2, **when** demand is refreshed,
  **then** week 2 shows 120 orders consuming 100 forecast with the larger figure planned, release dates come from the
  cumulative lead time, and the planner firms week 2 into work orders.
- **Given** continuous requirements, **when** a sales order for 50 desks is confirmed, **then** within 60 s the requirements
  board shows a planned make order for 50 desks and a planned buy of 800 screws pegged to it, and an expedite exception on
  a purchase order arriving after the need date.
- **Given** that planned buy, **when** the planner asks the agent "why 800 screws?", **then** it answers from the facts
  (pegged demand, projected stock path, the late purchase order, lead time, pack multiple), and "draft the purchase orders"
  returns a preview grouped by supplier; on confirmation draft purchase orders exist in purchasing, linked to the proposal.
- **Given** two years of sales, **when** a planner generates a forecast, **then** each item gets the method with the lowest
  back-tested error, shown with that error; the planner raises month 3 by 10 %, the adjustment is kept apart, and the
  forecast feeds the schedule.
- **Given** the planning board, **when** the planner drags an operation from saw 1 to saw 2 of the same group, **then** the
  move is checked (capacity, sequence, materials, due date), applied in one change, and the operators' queues on the
  console update within 2 s.
- **Given** a scenario "saw 1 down Tuesday and Wednesday", **when** it is computed, **then** three orders show one day late
  and the cost of a Saturday shift that recovers them; applying the scenario adds the shift and the moves.
- **Given** a sales line asking for 30 chairs, **when** sales requests a promise date, **then** the answer comes from the
  schedule and material availability with its reason.

### 2.2 Edge cases & failures

- **Given** filters that match no open order, **when** orders are pulled, **then** it is refused with "nothing to plan".
- **Given** a plan row above the pending quantity of its order line, **when** it is saved, **then** it is refused naming
  the line and the pending quantity.
- **Given** a closed plan, **when** documents are created from it, **then** it is refused; a cancelled plan cancels its draft
  work orders and lists released ones it left untouched.
- **Given** an item without a released structure, **when** requirements are computed, **then** it gets a "no structure"
  exception and, if purchasable, a buy proposal instead.
- **Given** no supplier or lead time for a bought item, **when** a buy is proposed, **then** an exception names what is
  missing and the organization's default lead time is used.
- **Given** a forecast for a non-stock item, or one already feeding an active schedule, **when** it is saved or linked,
  **then** it is refused.
- **Given** a scheduled plan changed afterwards, **when** it is saved, **then** its schedule is cleared with a notice.
- **Given** a scenario computed before a work order it moves was changed, **when** it is applied, **then** it is refused
  and a recompute is offered.
- **Given** two planners moving the same operation, **when** the second move arrives, **then** it is refused with the
  operation's current position.
- **Given** operations that fit nowhere in the horizon, **when** scheduling runs, **then** they are listed unscheduled with
  the binding constraint.
- **Given** a recomputation that fails for one item, **when** the run continues, **then** other items are computed and an
  exception records the failure.
- **Given** a user without `PRODUCTION_PLANS_VIEW`, **when** they open planning, **then** they are refused (403); with
  `FEATURE_PRODUCTION_PLANNING` off, planning routes answer 404 and shop floor keeps working.

## 3. Functional Requirements

### 3.1 Scope and compatibility

- **FR-1** The system gates every planning route, menu entry, board and MCP tool with `FEATURE_PRODUCTION_PLANNING`,
  which needs `FEATURE_MANUFACTURING`.
- **FR-2** Planning writes no stock, ledger or purchase record itself: work orders, requisitions, purchase orders,
  transfers and subcontract orders are created by their own areas at planning's request and linked back.
- **FR-3** Planning reads projected stock (on hand, reserved, ordered, requested, planned, in transit, safety stock) from
  the warehouse area and never recomputes it; the quantities it plans are published so projected stock counts them; an
  item and location planning replenishes gets no proposal from stock reorder, so each has one replenishment source.
- **FR-4** The system registers production plans, schedules and forecasts with the business document engine (numbering,
  lifecycle, links) and publishes an event on every lifecycle change.

### 3.2 Production plans

- **FR-5** A user with `PRODUCTION_PLANS_EDIT` can create a plan with a date and filters (item, customer, project, order
  dates, delivery dates, order status); it is draft, confirmed, in progress, completed, closed or cancelled, and can be
  closed and reopened once confirmed.
- **FR-6** A user with `PRODUCTION_PLANS_EDIT` can pull open sales orders matching the filters and fetch their items:
  finished items with pending quantity (ordered less delivered, less what other plans and work orders cover), bundle and
  kit components expanded; an empty pull is refused.
- **FR-7** A user with `PRODUCTION_PLANS_EDIT` can pull pending requisition lines routed to "make" with the same pending
  rule, and planned orders of a schedule or of the requirements (FR-26).
- **FR-8** The system can combine rows of the same item and structure across sources into one row, keeping per-source
  references so produced quantity is allocated back to each.
- **FR-9** Each row states item, structure (required; the one effective at the planned start), planned quantity,
  location, planned start, pending, ordered and produced quantities, whether exploded materials are included and the
  structure's process loss; a row may not plan more than its sources' pending quantity.
- **FR-10** The system explodes rows into sub-assembly rows: level, item, structure, source (make, subcontract, request),
  supplier, date back-scheduled from the parent, required, available and planned quantity; the planner can let available
  stock reduce what is made, merge equal sub-assemblies of different rows, plan the expected loss and choose where
  sub-assemblies are made to.
- **FR-11** The system lists raw materials per item and location: required, projected quantity, safety stock, minimum
  order and multiple, proposed quantity, route (buy, transfer, issue, make, subcontract, from the customer), source
  location, supplier and need date; the planner chooses which items count (non-stock, subcontracted), which supply counts
  (existing orders or not), which quantities apply (safety stock, minimum and multiple) and whether locations are pooled
  by location group or item group.
- **FR-12** A user with `PRODUCTION_PLANS_VIEW` can download the required materials as a spreadsheet.
- **FR-13** A user with `PRODUCTION_PLANS_EXECUTE` can create from a confirmed plan: work orders for make rows,
  subcontract orders for subcontract rows, and requisitions split by route and supplier, or draft purchase orders per
  supplier after a preview; a closed plan refuses it; each document links to its row.
- **FR-14** Cancelling a plan cancels its draft work orders and lists the released ones it leaves.
- **FR-15** A user with `PRODUCTION_PLANS_EXECUTE` can reserve a plan's raw materials; reservations pass to its work orders
  when they are created.
- **FR-16** A plan becomes in progress when a document exists and completed when produced reaches planned; ordered and
  produced quantities come back from the documents.

### 3.3 Master production schedule

- **FR-17** A user with `PRODUCTION_PLANS_EDIT` can create a schedule over a horizon in day, week or month buckets for a
  location and a set of items or item groups.
- **FR-18** The system gathers demand per item and bucket: sales lines by delivery date, make requisitions and forecast,
  refreshed on request and on schedule.
- **FR-19** Orders consume forecast within the organization's consumption window; the planned demand of a bucket is the
  larger of forecast and orders, or forecast plus orders above it, per setting.
- **FR-20** A forecast feeds at most one active schedule.
- **FR-21** The system computes per item and bucket the quantity to make after projected stock and safety stock, and its
  release date from the cumulative lead time through every structure level (operation times and purchase lead times).
- **FR-22** A user with `PRODUCTION_PLANS_EDIT` can firm bucket quantities into a plan, or straight into work orders or
  requisitions. `(advanced)`

### 3.4 Material requirements

- **FR-23** The system keeps per planned item and location a time-phased net requirement: gross demand (sales lines, work
  order materials, plan rows, schedule and forecast remainder, safety stock), scheduled receipts (purchase orders, work
  orders, transfers in transit, subcontract orders) and projected stock by date.
- **FR-24** An event changing demand, supply, stock, structure or lead time marks the item and its components for
  recomputation, done within 60 s; a full regeneration runs nightly. `(advanced)`
- **FR-25** Lot sizing per item: one for one, fixed quantity, minimum and multiple, or days of supply; a planning time fence
  stops new planned orders inside it and raises exceptions instead.
- **FR-26** The system proposes planned orders (make, buy, transfer, subcontract) with due date, release date by lead time,
  quantity by lot sizing, and source location, supplier or structure.
- **FR-27** Each planned order lists the demands it serves, with quantities and dates, through every level.
- **FR-28** The system raises exceptions per item with a suggested action: expedite, delay, cancel supply without demand,
  release overdue, no structure, no supplier, no lead time (only when neither the item's supplier terms, its supplier
  nor the item states one).
- **FR-29** A user with `PRODUCTION_PLANS_VIEW` sees per item a grid in day, week or month buckets, the list of planned
  orders by kind, supplier, work centre and date, and a capacity view per work centre and bucket (load against available).
- **FR-30** For any planned order or exception the system explains in plain language, from stored facts, the demand it
  serves, the projected stock path, the receipts considered and why they do not suffice, lead time and lot sizing.
  `(advanced)`
- **FR-31** A user with `PRODUCTION_PLANS_EXECUTE` (or an agent under their permissions) can draft documents from selected
  planned orders: a preview of draft purchase orders grouped by supplier with prices and terms, requisitions, work
  orders, transfers and subcontract orders; confirming creates drafts in their areas and links them; nothing is confirmed
  or sent. `(advanced)`
- **FR-32** A user with `PRODUCTION_PLANS_EDIT` can firm or dismiss a planned order; firmed ones survive regeneration and
  dismissed ones stay dismissed until their demand changes.
- **FR-33** A user with `PRODUCTION_PLANS_EDIT` sets per item: planning on or off, lot sizing, time fence and lead time
  override; safety stock comes from the warehouse area, and minimum order quantity, order multiple and lead time from the
  item's supplier terms, its supplier and the item itself, shown with their source; planning keeps only the overrides.

### 3.5 Demand forecasts

- **FR-34** A user with `DEMAND_FORECASTS_EDIT` can create a forecast for items or an item group and a location (a group
  allowed), weekly or monthly, for a number of periods above zero from a start date, with quantities per period; stock
  items only; it is draft, active or cancelled and shows the schedule it feeds.
- **FR-35** A user with `DEMAND_FORECASTS_EDIT` can generate a forecast from history (sales orders, deliveries, invoices or
  consumption): per item the system tries moving average, trend and seasonal smoothing and seasonal repeat, keeps the
  method with the lowest back-tested error over the last periods, and shows method and error; generation is previewed.
  The same engine keeps, nightly, a rolling daily forecast for 90 days per item and location with at least 8 weeks of
  history, which stock reorder in forecast mode reads; there is one forecast for planning and stock. `(advanced)`
- **FR-36** Planner adjustments are kept apart from statistical values and survive regeneration.
- **FR-37** After each period the system records actual demand and the error per item and method. `(advanced)`
- **FR-38** A user with `PRODUCTION_PLANS_EDIT` can create a schedule from a forecast.

### 3.6 Plan scheduling

- **FR-39** A user with `PRODUCTION_PLANS_EDIT` can schedule a plan forward from a start date (or a start date per item)
  with a number of shifts per day: rows per finished item and sub-assembly on work centres and per raw material by
  supplier lead time, each with start, end and duration; previewed, then applied to plan rows and their work orders.
- **FR-40** Changing a scheduled plan clears its schedule with a notice.

### 3.7 Finite-capacity scheduling `(advanced)`

- **FR-41** The system places operations of released work orders and planned make orders on work centres, respecting
  calendars, parallel capacity, set-up, sequence, material availability dates and operator availability (attendance
  rosters when attendance is on, otherwise the platform's approved time off, availability and holidays), in the order of
  the organization's priority rule (due date, priority, set-up grouping).
- **FR-42** A user with `PRODUCTION_SCHEDULE_EDIT` can use the planning board: a timeline per work centre with operations
  as bars (order, state and lateness by text and colour), due dates and daily load; drag to move in time or to another
  centre of the same group, resequence and pin; soft conflicts (capacity, material, due date) warn, hard ones (before a
  predecessor, on a closed day without overtime) are refused.
- **FR-43** Applying board changes writes the planned times and places of cards and orders in one change with undo of the
  last change (a card's planned time is kept once, on the card); other planners and consoles see it within 2 s; a move
  on a changed operation is refused with its position.
- **FR-44** With the setting on, downtime over a threshold or a late completion proposes a rescheduling for review.

### 3.8 What-if scenarios `(advanced)`

- **FR-45** A user with `PRODUCTION_SCHEDULE_EDIT` can create a scenario from the current requirements and schedule and
  change it: add or change demand, take a centre down for a period, add a shift or overtime, change a lead time or
  supplier, change priorities, move operations.
- **FR-46** Computing a scenario shows, side by side with the current plan, order completion dates (early or late by how
  much), load per centre, material shortages and planned purchases, and added cost (overtime, expediting).
- **FR-47** Applying a scenario turns its changes into calendar exceptions, priorities, operation moves and firmed planned
  orders in one change; it is refused when an object it touched changed after computing; scenarios expire after 14 days
  (setting) and never affect real planning before they are applied.

### 3.9 Visualiser and other areas

- **FR-48** A user with `PRODUCTION_PLANS_VIEW` can open a plan's visual overview: finished items, sub-assemblies,
  requisitions, material readiness, work orders, schedule and materials with stock per location, updated live.
- **FR-49** A production request from a sales line adds a row to an open draft plan (or a new one) and the line shows
  planned and produced quantities.
- **FR-50** The system answers sales the earliest date a quantity can be made, from the finite schedule and material
  availability, with the reason. `(advanced)`
- **FR-51** Requisitions raised by planning carry the source "plan", are raised as a system actor and notify buyers;
  purchase orders keep the plan's ordered quantity in step on create and cancel.

### 3.10 Reports, settings, agents and events

- **FR-52** The system ships these report definitions, filterable by organization, dates, item, location and plan,
  exportable, with drill-down:

  | Report | Answers |
  |---|---|
  | Needs and shortages | per selected demand: what must be made and bought, what stock covers, the date each shortage is covered |
  | Plan progress by level | per plan row and level, how much is ordered, made (in house or by subcontractors) and outstanding |
  | Make and buy requirements | per item and period: net requirement and planned orders, with work-centre load per bucket |
  | Statistical forecast | expected demand per item and period with the method used and its measured error |
  | Capacity load | load against available minutes per work centre and bucket, scheduled and planned |
  | Forecast accuracy | error per item, method and period |
  | Orders at risk | sales lines whose pegged supply arrives after their date |
  | Planning exceptions | open exceptions by kind, item and planner |

- **FR-53** A user with `PRODUCTION_PLANNING_SETTINGS_EDIT` sets per organization: horizon, default bucket, default make
  and buy lead times, default lot sizing, safety stock inclusion, forecast consumption rule and window, time fence,
  recomputation delay, nightly regeneration time, priority rule, automatic rescheduling, scenario retention, default
  sub-assembly source and location grouping.
- **FR-54** The system offers MCP tools under the caller's permissions: build a plan from orders, read an item's
  requirement, explain a planned order, draft documents, schedule a plan, create, compute and compare a scenario, and
  generate a forecast, each writing tool with `preview` true by default. `(advanced)`
- **FR-55** The system publishes plan, schedule, planned order, exception and scenario events, pushes board and
  requirement changes live, and writes inbox items for new expedite and overdue-release exceptions to the item's planner.
- **FR-56** The system ships print templates for a plan and its materials list.

## 4. Non-Functional Requirements

- **Performance**: incremental recomputation of one item and its components under 5 s and within 60 s of the event;
  nightly regeneration of 50,000 item-locations with 5 levels under 15 minutes; requirement grid under 500 ms; plan
  creation from 500 order lines under 10 s; board of 50 centres × 2 weeks loads under 2 s, a move applies under 500 ms;
  scenario compute under 30 s for 2,000 operations.
- **Concurrency and reliability**: `If-Match` on plans, schedules and board moves; recomputation per item serialised by a
  lock; events consumed at least once and applied once; a failed item never blocks others.
- **Security & privacy**: costs only with `MANUFACTURING_COSTS_VIEW`; operator availability shows names and free time,
  never the reason of absence; nothing leaves the platform except documents a user sends from their own areas.
- **Auditability**: who, when, before and after for firming, dismissing, board moves, scenario applications and drafts.
- **Accessibility and localisation**: the board is keyboard operable (move by arrows, pin, open) with a list alternative;
  states by text and colour; strings in every locale.
- **Compatibility**: PostgreSQL, MySQL, SQLite; both ORMs; additive migrations; cloud and self-hosted.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| --- | --- |
| Production plan | A set of demands and the finished items, sub-assemblies and materials planned for them |
| Plan row, sub-assembly row, material row | What a plan makes, makes below it, and needs to buy or move |
| Production schedule | Demand and planned quantity per item and time bucket |
| Demand forecast | Expected demand per item and period, statistical and adjusted |
| Net requirement | Demand, receipts and projected stock per item, location and date |
| Planned order | A proposed make, buy, transfer or subcontract order with dates, quantity and pegging |
| Planning exception | A detected problem with a suggested action |
| Capacity slot | An operation's planned place and time on a work centre |
| Scenario | A copy of planning with changes, computed and compared before it is applied |

## 6. Out of Scope

- Work orders, operation cards, work centres and calendars: `shop-floor-and-work-orders`. Structures and lead times from
  routings: `manufacturing-bom-and-routing`.
- Requisitions, purchase orders, supplier choice and the buying plan: `procurement`. Subcontract orders: `subcontracting`.
- Projected stock, reorder levels and the stock demand history: `warehouse-and-stock-movements` (its reorder reads this
  feature's forecast and leaves planned items to it). Staffing forecasts: `attendance-and-shifts`.
- Sales orders and promise display: `sales-order-management`. Rosters and time off: `attendance-and-shifts`,
  `time-off-management`.

## 7. Acceptance Criteria

- [ ] **AC-1** A plan from open sales orders lists pending quantities net of other plans, combines rows with references,
      explodes sub-assemblies and materials, and creates work orders and requisitions linked to its rows (FR-6–FR-8).
- [ ] **AC-2** A schedule consumes forecast by orders per the rule and firms a bucket into work orders (FR-19, FR-22).
- [ ] **AC-3** A confirmed sales order produces pegged planned orders and an expedite exception within 60 s; the nightly
      regeneration gives the same result. (advanced) (FR-26, FR-28)
- [ ] **AC-4** The agent explains a planned buy from its facts and drafts purchase orders per supplier with a preview that
      writes nothing; confirmation creates drafts only. (advanced) (FR-30, FR-31)
- [ ] **AC-5** A generated forecast picks the method with the lowest back-test error per item and keeps adjustments on
      regeneration; accuracy is recorded after the period. (advanced) (FR-35, FR-37)
- [ ] **AC-6** The board refuses a move before a predecessor, warns on overload, applies a move to the card and the
      console within 2 s, and refuses a stale concurrent move. (advanced) (FR-42, FR-43)
- [ ] **AC-7** A "centre down" scenario shows late orders and overtime cost, applies in one change, and is refused after a
      conflicting change. (advanced) (FR-45, FR-46)
- [ ] **AC-8** Every refusal of §2.2 holds; a cancelled plan cancels only its draft work orders (FR-14).
- [ ] **AC-9** Every report of FR-52 returns data on the demo tenant.
- [ ] **AC-10** Works on PostgreSQL, MySQL and SQLite with both ORMs; behind `FEATURE_PRODUCTION_PLANNING`; nothing changes
      while it is off; every requirement has a passing test (FR-1; §4).
- [ ] **AC-11** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-1).

## 8. Open Questions

- Forecast consumption (FR-19): default "larger of forecast and orders" within the bucket.
- Draft purchase orders directly (FR-13, FR-31): default requisitions, so the procurement buying plan consolidates;
  direct drafts only when the user picks them.
- Operator availability (FR-41): attendance rosters when `attendance-and-shifts` is on; otherwise approved time off,
  employee availability and holidays of the platform.
- Statistical history (FR-35): default sales order lines by requested date; deliveries for make-to-stock items.

## 9. Constitution Gates

- [x] I Plugin-first — the `planning/` module of the `manufacturing` plugin; other areas through ports.
- [x] II Tenant/organization scoping — every plan, schedule, forecast, requirement and scenario scoped.
- [x] III Both ORMs, additive migrations — new tables only, three dialects.
- [x] IV Default-off flag; nothing removed — `FEATURE_PRODUCTION_PLANNING` off; shop floor unchanged without it.
- [x] V Contracts and API first — contracts and REST before screens; OpenAPI additive.
- [x] VI Permissions, privacy, security — separate view, edit, execute, schedule, forecast and settings keys; absence
      reasons never shown; agents act under the caller's permissions with previews.
- [x] VII Real-time through the event bus — recomputation from outbox events; board and requirements pushed live.
- [x] VIII i18n and accessibility — strings in every locale; board keyboard operable with a list alternative.
- [x] IX Tests accompany the change — each requirement has a test in the tasks.
- [x] X Behaviour-first — this document.
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Code: `packages/plugins/inventory/src/lib/stock-availability/`, `packages/plugins/purchasing/src/lib/purchasing.types.ts`
- Related specs: `../shop-floor-and-work-orders/spec.md`, `../manufacturing-bom-and-routing/spec.md`,
  `../procurement/spec.md`, `../warehouse-and-stock-movements/spec.md`, `../sales-order-management/spec.md`,
  `../subcontracting/spec.md`
