# Feature Specification: Shop floor and work orders

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `shop-floor-and-work-orders`
**Branch**: `feat/shop-floor-and-work-orders`
**Status**: `Draft`
**Created**: 2026-11-16
**Last updated**: 2026-11-23
**Owner**: platform maintainers
**Feature flag**: `FEATURE_MANUFACTURING` (shared with structures, default off); machine signals also need the
deployment flag `GAUZY_MANUFACTURING_SIGNALS_ENABLED` (only `true` enables); stock moves need `FEATURE_INVENTORY` and
`FEATURE_WAREHOUSE`

---

## 1. Overview

Nothing today turns a structure into production: the stock ledger has a generic issue movement linked to nothing. This
feature adds the shop floor of the `manufacturing` plugin: **work centres** with calendars, hourly cost and live status,
grouped on shop floors; **work orders** that make a quantity of an item from its effective structure, reserve and issue
materials, record output, secondary outputs and loss, and carry planned and actual cost; **operation cards** on which
operators start, pause and complete work; corrective work, disassembly, downtime, capacity checks, settings, reports and
dashboards. Clients: the Angular app, the operator console, MCP agents, the API and SDKs.

**Advanced capabilities.** Operator time is the platform's own timer: starting an operation starts the
operator's timer on the card, pauses carry reasons, breaks and idle time are kept apart, and labour cost comes from the
pay rate stored on each time log, so labour cost, efficiency and overall equipment effectiveness are measured, never
typed. The operator console is a module of the platform's installable, offline-capable floor app with scanning, also
on shared stations where operators use the badge and PIN of the attendance kiosks. A live
shop-floor board runs over the real-time channel. Machine signals arrive through signed webhooks and open and close
downtime by themselves, as pauses with a downtime reason do. Status keeps execution apart from material readiness,
genealogy runs from a finished serial unit back to component lots, and agents explain delays and variances and draft
orders with a preview. These requirements are marked `(advanced)`.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** a sales line for 100 desks, **when** a planner creates a work order from it and releases it, **then**
  materials come from the explosion, stock is reserved, cards (cut in two batches of 50, assemble, finish) are placed in
  the work centres' calendars, and the sales line shows 100 planned.
- **Given** the released order, **when** the storekeeper scans the pick list and confirms the issue, **then** a production
  issue document moves the materials to work in progress and the order's material state is "issued".
- **Given** operator Ana at the cutting station, **when** she scans her badge and the card and taps Start, **then** her
  platform timer runs on the card's task, the saw's tile turns "running" on the board within 2 s, and her timesheet shows
  the time.
- **Given** nothing else runs on the saw, **when** Ana pauses for "tool change" or the saw signals "stopped" with code 17
  ("blade jam"), **then** a set-up or an unplanned downtime opens (the signalled one "to confirm", which Ana confirms on
  the console), and Resume or the "running" signal closes it.
- **Given** the last card completes 98 desks with 2 lost, **when** output is recorded, **then** 98 desks are received at
  consumed materials plus labour at the operators' stored pay rates plus machine and overhead time, scrap is received, 98
  serial units are generated, and the sales line shows 98 produced.
- **Given** the Wi-Fi drops, **when** Ben completes his card and scans 12 labels offline, **then** the console shows 13
  unsynced actions and applies them once on reconnect.
- **Given** a returned desk serial unit, **when** quality traces it back, **then** they see its work order, the lots of
  tops and screws consumed, and their receipts and suppliers.
- **Given** a manager asking the agent "why is WO-0042 late?", **when** it answers, **then** it names the operation behind
  plan, its downtime and reasons, missing materials and the effect on the promised date.

### 2.2 Edge cases & failures

- **Given** a template item, an unreleased structure, or short materials with "release only when available", **when** the
  order is released, **then** it is refused (shortages listed); without the setting the planner gets a shortage notice.
- **Given** an issue or output above its allowance, or a later card completing 45 after an earlier operation made 40,
  **when** it is recorded, **then** it is refused naming the quantity allowed and, for sequence, the earlier operation.
- **Given** a held order, a card whose output a later operation consumed, or a date in a closed stock period, **when**
  someone starts the card, moves material, cancels the card or records output, **then** it is refused.
- **Given** an operation requiring inspection, **when** its card completes without an accepted one, **then** it is refused
  saying whether the inspection is missing, unfinished or rejected.
- **Given** Ana running a card, **when** she starts another, **then** the console asks to pause the first; she never has
  two running timers and the centre never exceeds its parallel capacity; a timesheet edit recomputes her card minutes.
- **Given** a signal with a wrong signature, an unknown address or a repeated id, **when** it arrives, **then** it is
  refused (401, 404) or ignored; an offline console action that conflicts on sync becomes a supervisor exception.
- **Given** a user without `MANUFACTURING_OPERATIONS_WORK` or off the centre's roster, **when** they start a card, **then**
  they are refused (403); with `FEATURE_MANUFACTURING` off every route answers 404.

## 3. Functional Requirements

### 3.1 Scope and compatibility

- **FR-1** The system gates every shop floor route, menu entry, console and MCP tool with `FEATURE_MANUFACTURING`.
- **FR-2** The system moves stock only through movement documents of the purposes it registers (issue to production,
  return from production, output, output conversion, disassembly), valued by stock valuation and posted from events.
- **FR-3** The system registers work orders with the business document engine (numbering, lifecycle, links, roll-ups) and
  publishes an event on every lifecycle change.
- **FR-4** The system takes operator time only from the platform's timer and time logs; labour is never typed as an amount,
  and a time log counts as labour of the one card whose task it carries, never of another record it overlaps in time.

### 3.2 Work centres

- **FR-5** A user with `MANUFACTURING_WORK_CENTRES_EDIT` can define work centres: name, code, kind (machine, line, cell,
  manual station), group, shop floor, parallel capacity, work-in-progress and output locations, linked equipment or
  asset and operator roster; a centre with open cards cannot be deactivated.
- **FR-6** A user with `MANUFACTURING_WORK_CENTRES_EDIT` can define work-centre groups with default cost components a
  centre copies on demand; an operation naming a group runs on any active member.
- **FR-7** A centre's hourly rate is the sum of its cost components (from an organization list, classed labour, machine or
  overhead, optionally mapped to an expense ledger role); duplicates are refused; a rate change marks structures stale.
- **FR-8** With tracked operator time, actual labour comes from time logs and a centre charges only its machine and
  overhead parts by rate; the organization can keep the full rate instead. `(advanced)`
- **FR-9** A centre has weekly working slots with an on switch; overlaps and an end before a start are refused; an
  operation longer than any slot is refused at scheduling unless overtime is allowed.
- **FR-10** A centre's calendar applies the official holidays of the organization's (or a stated) country and its own
  closed days and extra hours; scheduling on a holiday is refused, listing the dates, unless allowed.
- **FR-11** Planned maintenance windows of the centre's linked asset reduce its available time when fixed assets is on.

### 3.3 Shop floors and live status

- **FR-12** A user with `MANUFACTURING_WORK_CENTRES_EDIT` can define shop floors (name, a stock location of the same
  organization, centres); the floor page shows its centres and a stock summary of its location.
- **FR-13** From the floor page a user with `STOCK_DOCUMENTS_CREATE` raises a draft receipt, issue or transfer of an item.
- **FR-14** The system derives each centre's status: running (a card runs or the machine signals running), idle (only
  ready or paused cards), down, set-up or maintenance (an open downtime of that category), off (outside its calendar);
  each change is kept with its time and pushed live.
- **FR-15** A user with `MANUFACTURING_WORK_ORDERS_VIEW` can watch a shop-floor board: per centre its status, running card
  and operators, progress against plan, today's effectiveness and downtime timer, filtered by floor, group and status,
  updated within 2 s through the real-time channel. `(advanced)`

### 3.4 Work orders

- **FR-16** A user with `MANUFACTURING_WORK_ORDERS_EDIT` can create a work order: item variant, structure (default: the
  one effective at the planned start), quantity and unit, planned dates, work-in-progress, output and scrap locations,
  source link, project, description and priority.
- **FR-17** The system refuses a quantity at or below zero or with decimals in a whole unit, a template item, a structure
  of another item or not released, and another organization's locations; release needs the locations it will move to.
- **FR-18** A work order is draft, released, in progress, completed, closed or cancelled; holding is a separate flag and
  material readiness (not reserved, partly reserved, reserved, partly issued, issued) a separate state. `(advanced)`
- **FR-19** The system sets in progress when material is issued, a card starts or output is recorded, and completed when
  produced plus process loss reaches the quantity.
- **FR-20** A user with `MANUFACTURING_WORK_ORDERS_EDIT` can hold and resume an order; while held, card actions and stock
  documents for it are refused, and it cannot be cancelled.
- **FR-21** A user with `MANUFACTURING_WORK_ORDERS_RELEASE` can close an order; running cards are offered to be stopped
  with their time recorded; closing releases reservations and lists material to return. `(advanced)`
- **FR-22** A user with `MANUFACTURING_WORK_ORDERS_RELEASE` can cancel an order without output once issued material is
  returned (a return draft is offered); open cards are cancelled and reservations released.
- **FR-23** The system fills required materials from the explosion (one level or all, per order) with required, reserved,
  requested, picked, issued, consumed and returned quantities, source location and availability at source and in progress.
- **FR-24** After release, materials and quantities change only with the organization setting and
  `MANUFACTURING_WORK_ORDERS_EDIT`; extra items issued are appended and flagged.
- **FR-25** The system lists the order's operations: place, planned and actual times, rate, planned and actual cost,
  completed and lost quantity and state; completed quantity never exceeds the order quantity.
- **FR-26** The system previews the structure's secondary outputs and non-stock items on the order with planned quantities.
- **FR-27** For sub-assemblies, a user chooses one order exploding them into its materials, or child work orders linked
  to the parent and finishing before it; a structure with step outputs is made by one order covering every step.
- **FR-28** Work orders show as saved-view lists (open, in progress, completed, late), a calendar and a board by state.
- **FR-29** A work order from a sales line is checked against the ordered quantity and writes planned and produced
  quantities back; from a plan line or requisition line it is limited to that line and writes produced quantity back.

### 3.5 Materials

- **FR-30** A user with `MANUFACTURING_MATERIALS_MOVE` can reserve the order's materials, and output where the location
  allows, or have it done on release per setting; reservations follow issues and are released on close and cancel.
- **FR-31** A user with `MANUFACTURING_MATERIALS_MOVE` can issue materials to work in progress for the whole order or per
  card; issues above required plus the over-issue allowance are refused; extra issued quantity is tracked.
- **FR-32** A user with `MANUFACTURING_MATERIALS_MOVE` can return components from work in progress (issued less consumed).
- **FR-33** When the structure says so, materials are not issued but consumed from their source at completion, or
  backflushed from work in progress; operation settings override the order's.
- **FR-34** A user with `MANUFACTURING_MATERIALS_MOVE` can raise requisitions (buy or transfer) and pick lists for pending
  materials, also for a fraction of the quantity; refused when everything is issued, requested or picked.
- **FR-35** Where a line allows substitutes, an issue or completion may use one at its ratio; the original item is kept.
- **FR-36** For an inward subcontract order, consumption is limited to the customer material held, and the order warns
  when its quantity exceeds what that material allows.

### 3.6 Output

- **FR-37** A user with `MANUFACTURING_OUTPUT_RECORD` can record output: one document consumes components (by structure
  for the produced quantity or as issued), receives output, secondary outputs and scrap, and records process loss.
- **FR-38** Output beyond the order quantity plus its allowance, or beyond the sales line plus the sales allowance
  (counting quantity already produced for the line by any order and the quantity still open on its other orders; the
  quantity of this order counts only as it is produced, so this order's own allocation is never counted twice), is
  refused naming the allowed quantity.
- **FR-39** Output lots and serial units are generated per setting or entered, in batches of the stated size; an amended
  order keeps its serial units.
- **FR-40** With the setting on, a user with `MANUFACTURING_OUTPUT_RECORD` can convert part of the output (above zero)
  into an alternative finished item through a conversion document.
- **FR-41** A user with `MANUFACTURING_OUTPUT_RECORD` can disassemble up to produced less already disassembled quantity,
  returning components with their lots and serial units where known.
- **FR-42** A user with `MANUFACTURING_STRUCTURES_EDIT` can make a draft structure from an order's consumed materials and
  performed operations.
- **FR-43** Output of an item or operation requiring inspection is held until accepted; rejected quantity goes non-sellable.

### 3.7 Costing

- **FR-44** The system computes actual cost: consumed material value, labour (FR-64), machine and overhead (run time × the
  centre's non-labour rate), additional and corrective cost; planned cost is fixed at release.
- **FR-45** Each output is valued at its share of the order's cost not yet absorbed: the actual cost to date less what
  earlier outputs of the order took, times the output's quantity divided by the quantity still to make (never less than
  the output's quantity, so an output that completes the order takes all of it), less its secondary outputs' value, and
  is handed to valuation on the output document; cost arriving later, and cost no output absorbed when the order
  closes, becomes variance at close.
- **FR-46** Corrective cost is added to output value or charged as variance, per organization setting.
- **FR-47** On close the system computes material usage and price, labour efficiency and rate, machine and process-loss
  variances and publishes them as document facts for the ledger.
- **FR-48** A user with `MANUFACTURING_COSTS_VIEW` sees planned against actual cost per material, operation and cost kind.

### 3.8 Operation cards

- **FR-49** The system creates cards at release (or on demand, per setting), one per operation and batch of the card batch
  size: order, place, operation, quantity, planned dates, required minutes, work-in-progress location, number, barcode.
- **FR-50** A card is waiting, ready, running, paused, done or cancelled, derived from time, output, materials and pause;
  lists mark state by colour and text and a calendar shows cards by planned dates.
- **FR-51** A card cannot complete more than the earlier sequence produced less loss (the refusal names the operation and
  quantity); same-sequence cards run in parallel; step outputs count produced quantity per step.
- **FR-52** Completing needs completed plus lost equal to the card's input: its quantity less the loss recorded on the
  earlier sequences for it (a 100-unit card after an operation that completed 98 and lost 2 completes with 98, and
  records no loss of its own for those 2); output and loss are entered per operator, and loss reduces the input of
  later operations and the order.
- **FR-53** Sub-operations show as a checklist with minutes and who did them.
- **FR-54** With issue per card, each card lists its materials; issues above its need are refused unless the card
  over-issue setting allows; requisitions against a card are checked against its need.
- **FR-55** A step-output card has its own output item, structure and locations; completing it records the step's output
  (automatically when set), its secondary outputs and its lots and serial units.
- **FR-56** A user with `MANUFACTURING_OPERATIONS_SUPERVISE` can raise a corrective card from a card, with its own
  operation, place, rate and dates; its cost goes to the order and it is outside sequence checks.
- **FR-57** When the operation or structure requires inspection, completion is refused if the inspection is missing,
  unfinished or rejected, each with its own message; the checklist is filled from the console.
- **FR-58** A card whose output a later operation consumed cannot be cancelled; cards of a closed or held order cannot change.

### 3.9 Time on cards `(advanced)`

- **FR-59** A user with `MANUFACTURING_OPERATIONS_WORK` on the centre's roster starts work on a card, which starts their
  platform timer on the card's task; several operators can work one card, each with their own timer.
- **FR-60** An operator works one card at a time: starting another asks to pause the current one; time never overlaps
  across cards, and a centre never runs more cards than its parallel capacity.
- **FR-61** Pausing stops the timer with a reason from a configurable list; resuming starts it again; completing stops all.
- **FR-62** A break taken during a card is a platform break (where the organization allows breaks), counted apart.
- **FR-63** After 15 minutes (setting) without action, output, scan or running signal the console asks the operator;
  unanswered after 5 minutes, the timer stops at the last activity and the gap is recorded as idle time.
- **FR-64** Per card and operator the system keeps productive, idle and break minutes from time logs, recomputed on edits;
  labour cost is productive minutes × the pay rate stored on each log; idle labour goes to the order or the centre per
  setting; breaks are never charged; nobody's pay rate is shown.
- **FR-65** The system computes efficiency per card, operator and centre: standard minutes earned over productive minutes.
- **FR-66** With "enforce time" on, a card cannot complete without tracked time; an operator whose time is not tracked
  can still record output, and that card's labour is estimated from the centre's labour rate and marked as estimated.

### 3.10 Downtime and machine signals

- **FR-67** A user with `MANUFACTURING_DOWNTIME_EDIT` can record downtime: centre, from, to, operator, reason (from a list
  with categories planned, unplanned, set-up, maintenance, quality, material, operator) and remarks; the duration is
  derived; an end before the start and overlaps on one centre are refused; entries are numbered; a maintenance downtime
  of a centre with a linked asset names the asset's repair, whose downtime hours are taken from it.
- **FR-68** A pause whose reason has a downtime category opens a downtime on the centre when no other card runs there,
  and resuming closes it. `(advanced)`
- **FR-69** A user with `MANUFACTURING_SIGNALS_MANAGE` registers a signal source per centre (secret address, a
  signature secret that is set by default and can be removed only for a device that cannot sign, stop codes mapped to
  reasons) accepting running, stopped (with code), count (good and reject) and
  alarm signals with machine time and id. `(advanced)`
- **FR-70** The system refuses an unknown address (404) or, for a source with a signature secret, a missing, wrong or
  stale signature (401); a source whose secret was removed is identified by its secret address alone. It ignores a repeated id,
  orders signals by machine time and limits the rate per source. `(advanced)`
- **FR-71** A stopped signal opens a downtime with the mapped reason marked "to confirm"; running closes it; the operator
  confirms or changes the reason; counts feed effectiveness and propose card output to confirm. `(advanced)`
- **FR-72** The system computes per centre and hour, shift and day availability (run over planned production time),
  performance (ideal time of counted output over run time), quality (good over total) and their product, from signals or
  else card time, output and inspections; nothing is typed. `(advanced)`

### 3.11 Capacity checks

- **FR-73** On release and rescheduling, cards are placed in free slots of their centres' calendars within a look-ahead
  window (default 30 days), respecting holidays, parallel capacity, minutes between operations and same-sequence
  parallelism; failure names the operation and the earliest free date; the check can be switched off.

### 3.12 Operator console `(advanced)`

- **FR-74** Operators use the console module of the platform's installable floor app (one install with the scanning and
  inspection screens) on desktop, tablet or phone: queue per centre, instructions, materials with
  on-hand, today's sessions, inspection checklist with readings, and start, pause, resume, complete, output, loss,
  corrective and downtime actions, with keyboard shortcuts, large targets and two themes.
- **FR-75** The console scans with camera or scanner: cards (open), material lots or serial units (confirm an issue),
  badges (identify the operator) and output labels (count output).
- **FR-76** A shared station is a device registered like an attendance kiosk and given its centres by a user with
  `MANUFACTURING_STATION_OPERATE`; roster operators identify with the same badge and PIN they use at the attendance
  kiosks, act as themselves (their own timer), are audited "via station" and are signed out after inactivity; stations
  need the attendance feature, without it the console runs under the operator's own sign-in.
- **FR-77** Offline, actions are kept on the device with device time and id, synced in order when online and applied once;
  conflicts become exceptions for a supervisor; the device stores no cost or pay; unsynced actions are counted on screen.

### 3.13 Genealogy `(advanced)`

- **FR-78** A user with lot view rights traces a finished lot or serial unit back through its work order to the component
  lots and serial units consumed with their receipts and suppliers, and a component lot forward to finished units and
  customers, from the work order, the console and the lot page.

### 3.14 Settings

- **FR-79** A user with `MANUFACTURING_SETTINGS_EDIT` sets per organization: editing materials after release, production
  and sales overproduction, over-issue and card over-issue, reserve on release, release only with materials, output lots
  and serials, alternative finished items, corrective cost in output, cards at release, look-ahead days, minutes between
  operations, overtime, holidays, capacity check, enforce time, idle minutes, stations, labour source, idle labour target.

### 3.15 Reports and dashboards

- **FR-80** The system ships these report definitions, filtered by organization, dates, status, item, sales order, centre
  and operation, exportable, with drill-down to the order or card:

  | Report | Answers |
  |---|---|
  | Work order overview | orders by status, age and lead time; planned against actual dates and quantities, with a chart |
  | Orders not started | released orders with nothing issued or made yet, and their quantity |
  | Orders in progress | started orders still short of their quantity, loss included |
  | Completed orders | finished orders with planned and made quantities |
  | Materials consumed | per order and material: required, issued, consumed, extra, returned |
  | Buildable from stock | for open orders, how many units stock on hand allows and which material limits it |
  | Material moved to orders | material moved to each order net of returns, with lots and value |
  | Operation card log | per card: place, operation, completed quantity, times and minutes, with a chart |
  | Production trend | orders per status per week or month |
  | Process loss | lost quantity and value per order against output and material value |
  | Downtime by centre | downtime per centre, duration, operator and reason, with a chart |
  | Effectiveness | availability, performance, quality per centre and period |
  | Labour efficiency | standard against productive minutes, idle and break per operator and centre |
  | Cost variance | planned against actual per order and cost kind |

- **FR-81** The system ships a manufacturing dashboard: cards for open orders, orders in progress, cards running now,
  orders completed and value produced this month, inspections this month and effectiveness today; charts of output per
  day, operations completed, downtime by reason over 30 days, orders by status, late orders and inspection pass rate.
- **FR-82** The system ships print templates: work order, operation card with barcode, output label.

### 3.16 Other areas, agents and events

- **FR-83** When an order reaches an operation marked subcontracted, the system publishes an event that proposes a
  subcontract order carrying the work in progress, and reports the operation done when it is received.
- **FR-84** Work orders for inward subcontract orders take over their reservations and keep FR-36's limits.
- **FR-85** A production request from a sales line creates work orders when planning is off (quantities shown on the line).
- **FR-86** The system offers MCP tools under the caller's permissions: order status and why it is late, create an order,
  release, issue and record output with `preview` true by default, explain a cost variance, list downtime; agents never
  start or complete cards for operators. `(advanced)`
- **FR-87** The system pushes order, card, centre, downtime and console changes live and writes inbox items for shortages
  at release, downtime over a threshold, late orders, failed inspections and console exceptions.

## 4. Non-Functional Requirements

- **Performance**: order lists P95 under 300 ms at 500,000 orders per organization; releasing an order with 300 materials
  and 20 operations under 2 s; console actions acknowledged under 300 ms; a 300-centre board loads under 1 s and updates
  under 2 s; 50 signals per second per organization; labour recomputed within 10 s of a timer stop.
- **Concurrency and reliability**: `If-Match` on order writes; stock document, order counters and card state commit in one
  transaction; retry keys on stock actions, signals and console operations, applied once; events through the outbox.
- **Security & privacy**: pay rates never leave the server; costs only with `MANUFACTURING_COSTS_VIEW`; signal secrets and
  badge PINs stored hashed or encrypted; nothing leaves the platform except notices a user chose to receive by email.
- **Auditability**: who, when, before and after for releases, holds, closes, cancels, station actions, downtime
  confirmations and console exceptions. **Accessibility and localization**: console and board keyboard and screen-reader
  operable, status by text and colour; strings in every locale.
- **Compatibility**: PostgreSQL, MySQL, SQLite; both ORMs; additive migrations; cloud and self-hosted; current browsers.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| --- | --- |
| Work centre | A machine, line, cell or manual station with capacity, calendar, hourly cost and live status |
| Work-centre group | Centres that can do the same operations, with default cost components |
| Shop floor | A named area with its centres and stock location |
| Work order | An order to make a quantity of an item from a structure, with materials, operations, outputs and cost |
| Operation card | One operation (and batch) of a work order, on which operators record time and output |
| Card session | An operator's productive, idle and break minutes and labour cost on a card |
| Downtime | A period a centre could not produce, with reason, source and confirmation |
| Signal source | A machine or sensor that sends running, stopped, count and alarm signals to a centre |
| Effectiveness bucket | Planned, run, ideal and counted figures of a centre for one hour |
| Station | A shared console device, registered like an attendance kiosk, serving chosen centres |

## 6. Out of Scope

- Production plans, material requirements, finite-capacity board and scenarios: `production-planning`.
- Inspections and non-conformance: `quality-management`. Lots, serial units and traces: `serials-and-batches`.
- Structures, operations and routings: `manufacturing-bom-and-routing`. Subcontract orders: `subcontracting`.
- Movement documents, purposes, reservations, pick lists, the installable floor app and its offline sync:
  `warehouse-and-stock-movements`. Valuation: `stock-ledger-and-valuation`. Postings: `general-ledger`. Rosters, badges,
  PINs and kiosk devices: `attendance-and-shifts`. Project cost figures: `project-costing-and-billing`. Asset repairs:
  `fixed-assets`. Work-centre calendars stay here; bookable rooms, vehicles and lent equipment are
  `calendar-and-scheduling`'s.
- Blanket orders: `sales-order-management` (selling) and `procurement` (buying agreements).

## 7. Acceptance Criteria

- [ ] **AC-1** A work order from a sales line releases with reserved materials and batch cards placed in calendars, and
      writes planned and produced quantities back to the line (FR-29, FR-30).
- [ ] **AC-2** Issue, return, output with secondary outputs and loss, conversion and disassembly each write one stock
      document and keep ledger, levels and counters agreed; over-issue and overproduction are refused (FR-2, FR-37, FR-40).
- [ ] **AC-3** Sequence, inspection, held-order and cancel rules refuse each case of FR-51, FR-57, FR-20 and FR-58.
- [ ] **AC-4** Console start, pause, break and complete create platform time logs; card labour equals productive minutes ×
      stored pay rates; a timesheet edit recomputes it; idle is kept apart. (advanced) (FR-62, FR-64)
- [ ] **AC-5** A signed "stopped" signal opens a downtime to confirm, "running" closes it, a bad signature gets 401, a
      repeated id changes nothing; the hour's effectiveness matches a worked example. (advanced) (FR-68, FR-71)
- [ ] **AC-6** The console applies 13 offline actions once on reconnect, a conflict becomes an exception, and a station
      badge sign-in runs the operator's own timer; the board shows a card start within 2 s. (advanced) (FR-77)
- [ ] **AC-7** A finished serial unit traces back to component lots and suppliers; the agent explains a late order and
      previews an output without writing. (advanced) (FR-78)
- [ ] **AC-8** Closing with a running card offers to stop it and closes with time recorded; variances are published (FR-21).
- [ ] **AC-9** Every report of FR-80 and the dashboard of FR-81 return data on the demo tenant.
- [ ] **AC-10** Works on PostgreSQL, MySQL and SQLite with both ORMs; behind `FEATURE_MANUFACTURING` (signals also behind
      `GAUZY_MANUFACTURING_SIGNALS_ENABLED`); nothing changes while off; every requirement has a passing test (FR-1; §4).
- [ ] **AC-11** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-1).

## 8. Open Questions

- Untracked operators (FR-66): default labour = centre labour rate × card elapsed time, marked estimated. Idle labour
  (FR-64): default charged to the work centre. Station PINs (FR-76): the attendance kiosks' PIN rules and lockout apply.

## 9. Constitution Gates

- [x] I Plugin-first — the `manufacturing` plugin triple; stock, valuation, lots, quality, subcontracting reached by ports.
- [x] II Tenant/organization scoping — every record scoped; signals resolve tenant and organization from the source.
- [x] III Both ORMs, additive migrations — new tables only, three dialects.
- [x] IV Default-off flag; nothing removed — `FEATURE_MANUFACTURING` and the signals deployment flag off; timer unchanged.
- [x] V Contracts and API first — contracts and REST before screens; OpenAPI additive.
- [x] VI Permissions, privacy, security — split keys; signed signals; pay rates never exposed; PINs hashed.
- [x] VII Real-time through the event bus — outbox events and realtime hints feed the board and console.
- [x] VIII i18n and accessibility — strings in every locale; console and board keyboard and screen-reader operable.
- [x] IX Tests accompany the change — each requirement has a test in the tasks.
- [x] X Behaviour-first — this document.
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Code: `packages/core/src/lib/time-tracking/timer/timer.service.ts`, `packages/core/src/lib/time-tracking/time-log/`,
  `packages/core/src/lib/official-holiday/`, `packages/core/src/lib/webhook/webhook-signature.ts`
- Related specs: `../manufacturing-bom-and-routing/spec.md`, `../production-planning/spec.md`,
  `../warehouse-and-stock-movements/spec.md`, `../serials-and-batches/spec.md`, `../subcontracting/spec.md`
