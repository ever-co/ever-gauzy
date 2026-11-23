# Feature Specification: Stock ledger and valuation

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `stock-ledger-and-valuation`
**Branch**: `feat/stock-ledger-and-valuation`
**Status**: `Draft`
**Created**: 2026-11-15
**Last updated**: 2026-11-23
**Owner**: platform maintainers
**Feature flag**: `FEATURE_INVENTORY_VALUATION` (new tenant feature, default off; requires `FEATURE_INVENTORY`;
postings also require `FEATURE_ACCOUNTING`)

---

## 1. Overview

Today the stock ledger records quantities only: a movement carries no cost and no value, a count values its variance
at the variant's price, and nothing knows what stock is worth or what was sold cost. This feature adds **value** to
the existing ledger without changing it: every movement gets a **valuation layer** (first-in-first-out, moving
average or standard cost, chosen per organization, item group or item), backdated movements and cancellations are
**recalculated** by appending corrections rather than rewriting history, negative stock is controlled by policy,
**stock counts**, **opening stock** and **value resets** post their differences, **stock closing** snapshots a period
and freezes it, **landed cost** and valuation taxes lift the cost of receipts, the **analytic dimensions** of the
accounting foundation keep stock balances per project or owner, valued documents post **perpetual inventory**
journals through the general ledger posting rules, and integrity tools and reports prove that quantities, values and
the ledger agree. Quantities stay where the stock ledger keeps them: valuation stores value and cost, never a second
quantity. Clients: the Angular app, the MCP server, the SDKs; the floor app of `warehouse-and-stock-movements` hosts
the count tasks.

**Advanced capabilities.** Every cost is **explainable**: from any figure (a balance, a cost of goods sold
line, a journal line) a user opens the layers behind it and sees "why this cost", down to the receipts consumed.
History is never rewritten: corrections are appended and a backdated document **previews the later costs it will
change**. A **continuous integrity monitor** checks quantities, layers and the ledger as a job and an **agent
proposes each correction with a preview** for a person to apply. **Cycle counts are planned by value class** and run
blind from the floor app; **handling labour from tracked time** can be capitalised as landed cost; stock value
cards update live. These requirements are marked `(advanced)`.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** a first-in-first-out item with receipts of 10 at 5.00 and 10 at 6.00, **when** 15 are issued, **then** the
  issue costs 80.00, and "why this cost" shows 10 from the first receipt and 5 from the second.
- **Given** a moving-average item holding 10 at 5.00, **when** 10 arrive at 7.00, **then** its unit cost is 6.00 and
  the next issue is valued at 6.00.
- **Given** a receipt dated last Tuesday entered today, with issues since, **when** it is previewed, **then** the
  preview lists the later issues whose cost changes and the total change; **when** confirmed, **then** a correction
  layer is appended to each of them and their postings are adjusted.
- **Given** freight of 100.00 on two receipt lines (weights 30 kg and 70 kg), **when** a landed cost document is
  confirmed by weight, **then** the lines gain 30.00 and 70.00; for units already sold, the share goes to cost of goods
  sold.
- **Given** a count where 98 are found for 100 recorded, **when** it is closed, **then** −2 is written at the key's
  current cost and, with accounting on, posted to stock adjustment.
- **Given** October is closed for stock, **when** someone confirms a document dated 30 October, **then** it is
  refused with the closing date.
- **Given** perpetual inventory on, **when** a goods receipt is confirmed, **then** within a minute a journal debits
  stock and credits received-not-billed for the received value.
- **Given** the integrity monitor finds a level that disagrees with its ledger, **when** the valuation manager opens
  the finding, **then** the agent's proposal (reconcile that level) shows its movements, layers and postings, and
  applying it resolves the finding.
- **Given** a cycle count plan counting A items monthly, **when** the plan runs, **then** counts are spread over the
  working days and appear as blind tasks in the floor app.
- **Given** a standard-cost item at 10.00, **when** it is received at 10.40, **then** stock rises by 10.00 per unit
  and 0.40 per unit goes to purchase price variance.

### 2.2 Edge cases & failures

- **Given** negative stock refused (the default), **when** an issue exceeds on hand, **then** it is refused with item,
  location, needed and available; **given** an item allowing it, **then** the issue is valued at the last cost and a
  correction settles the difference when stock arrives.
- **Given** a backdated issue that would make a later balance negative, **then** it is accepted as today and valued as
  a negative outflow settled by the later inflow; **given** the organization switched on refusing such movements,
  **then** it is refused, naming the date.
- **Given** a recalculation failing three times, **then** valuation managers get a notice, later postings of that key
  are flagged, and a person can retry it.
- **Given** two recalculations requested for one key, **then** they merge into one from the earlier date.
- **Given** a landed cost on a cancelled receipt, or a charge already used on another landed cost, **then** refused.
- **Given** an item holding stock, **when** its method is changed directly, **then** refused; a dated method change
  revalues it instead.
- **Given** a count that would leave less than the reserved quantity, **then** closing is refused until the holds
  change.
- **Given** accounting off, **then** layers are kept and nothing is posted; **given** a posting failure, the document
  stays confirmed and shows the error for repost.
- **Given** no `STOCK_VALUATION_VIEW`, **then** the values this feature adds are hidden and value routes answer `403`,
  while a count's variance value stays visible to whoever sees it today; with the feature off every route of this
  feature answers `404` and counts value variances as today.

## 3. Functional Requirements

### 3.1 Valuation layers

- **FR-1** With the feature on, every stock movement MUST get a valuation layer in the same transaction: quantity, unit
  cost, value in the organization currency, and the value and unit cost of its valuation key after it; the key's
  quantity is the stock level's, read in that transaction and never stored a second time. A movement of units that
  never entered stock (an event-only movement) gets no layer.
- **FR-2** Incoming cost MUST come from the source: goods receipt (purchase price net of discounts at the receipt-date
  rate, plus valuation taxes and additional costs), receipt document (line cost), transfer in (the matching outflow's
  cost), customer return (the original outflow's cost), production output (cost given by production), increase by
  count or adjustment (current cost or the stated cost), opening (stated cost).
- **FR-3** Layers MUST be append-only: a cancellation appends reversing layers at the original cost; no layer is edited.
- **FR-4** The valuation key MUST be item and location (default) or item and organization (setting), extended by lot
  or serial unit when the item is valued by lot or serial.
- **FR-5** Each layer MUST link to its movement, document and line and carry the movement's stock dimensions.
- **FR-6** Unit cost MUST keep 6 decimals and values the currency's minor unit; rounding differences go to a rounding
  layer so a key's value always equals the sum of its layers.

### 3.2 Costing methods

- **FR-7** Methods MUST be first-in-first-out, moving average and standard cost; last-in-first-out only where the
  organization setting allows it (off by default).
- **FR-8** A user with `STOCK_VALUATION_EDIT` can set the organization's default method and override it per item group
  or item; the effective method is shown on the item.
- **FR-9** First-in-first-out: an outflow consumes the oldest open incoming layers by business time; a partly consumed
  layer keeps its remaining quantity and value.
- **FR-10** Moving average: each inflow recomputes the key's unit cost (value ÷ quantity); outflows use it.
- **FR-11** Standard cost: flows are valued at the standard cost effective at their business time; the difference
  between actual incoming cost and standard is a purchase price variance layer.
- **FR-12** Standard costs MUST be dated; a new standard revalues stock on hand at its effective date and becomes the
  variant's cost price from that date; a date inside a closed period is refused.
- **FR-13** Changing the method of an item holding stock MUST be refused except by a dated method change that revalues
  its stock into one opening layer under the new method.

### 3.3 Backdated movements and recalculation

- **FR-14** A movement earlier than later movements of its key MUST be valued as of its time, and each later outflow
  whose cost changes MUST receive a correction layer dated at that outflow; no existing layer is rewritten.
- **FR-15** Cancelling an inflow that later outflows consumed MUST trigger the same recalculation.
- **FR-16** A backdated outflow or cancelled inflow that makes a later balance of its key negative, while the current
  level stays covered, MUST be accepted as today and valued as a negative outflow settled by the later inflow (FR-22);
  an organization setting (off by default) refuses such movements unless negative stock is allowed for them.
- **FR-17** Recalculations MUST run as background jobs per key from the earliest affected time; requests for one key
  merge; each shows its state (pending, running, finished, failed), attempts, error and the value it changed.
- **FR-18** Recalculation MUST respect a per-tenant concurrency limit and an optional quiet window; after three
  failures it notifies valuation managers and flags the key's later postings until it succeeds.
- **FR-19** A user with `STOCK_VALUATION_EDIT` can repost the ledger postings of a document or date range without
  changing layers, after account settings changed.
- **FR-20** A correction whose outflow lies in a closed stock or accounting period MUST be dated at the first open
  date and marked as carried forward.

### 3.4 Negative stock

- **FR-21** Negative stock MUST be refused by default, as today; it can be allowed per organization, item, location
  and, with lot tracking, per item for its lots; the most specific setting wins; levels marked unlimited and levels that
  allow backorders keep every freedom they have today.
- **FR-22** A negative outflow MUST be valued at the key's last known cost (or standard); the incoming movement that
  covers it settles the difference with a correction layer.
- **FR-23** Every refusal MUST name the item, location, date, needed and available quantity, and say when reserved
  stock or a later balance caused it.

### 3.5 Stock counts and opening stock

- **FR-24** The existing counts (full, cycle, spot, recount; blind; movement freeze; scope) MUST have screens to scope
  by location, zone, bin, item group or item, fetch items with stock, count by scanning, review and close.
- **FR-25** A count line MUST show quantity and value before counting (hidden from counters of a blind count); the
  variance is valued at the key's current cost, the same figure on the lines and on the count's total, and found stock
  may carry a counted unit cost.
- **FR-26** Closing a count MUST write movements and layers for differences only, with a difference account and cost
  centre chosen per count.
- **FR-27** Closing MUST be refused where it would leave less than the reserved quantity on a level that refuses it
  today (levels that allow backorders or are unlimited close as today), or count a standard-cost item without a
  standard cost; customer-owned stock is counted but not valued.
- **FR-28** Variances above the count's tolerance MUST require a recount before closing; within it they are accepted;
  a count without a tolerance (the default) closes as today.
- **FR-29** Count sheets MUST print and export, and lines import from a file.
- **FR-30** An opening stock count or import MUST load balances with unit cost against an opening balance account (a
  balance-sheet account), only for keys without earlier movements unless the user holds `STOCK_VALUATION_EDIT`.

### 3.6 Value reset

- **FR-31** A user with `STOCK_VALUATION_EDIT` can reset a key's value to an expected value at a date, writing a
  count-out and count-in pair per lot or serial at that date, created from the valuation comparison (FR-71).
- **FR-32** After a reset, documents for that key dated before the reset MUST be refused.

### 3.7 Stock closing and freeze

- **FR-33** A user with `STOCK_CLOSING_MANAGE` can close a stock period: a job snapshots per key the quantity, value,
  unit cost, open layers, lot and dimension at period end; closings chain without gap or overlap; future ends refused.
- **FR-34** Documents, cancellations and recalculations dated on or before the last closing MUST be refused (except
  FR-20); a closing is refused while recalculations for earlier dates are pending.
- **FR-35** The last closing MAY be reopened with `STOCK_CLOSING_MANAGE`; it stays marked reopened until closed again.
- **FR-36** An organization MAY freeze stock up to a date and/or a rolling number of days; `STOCK_FREEZE_OVERRIDE`
  allows posting anyway; a locked accounting period freezes stock of that period too (one lock model).
- **FR-37** Balance reports MUST start from the latest closing snapshot instead of replaying the ledger.

### 3.8 Perpetual inventory postings

- **FR-38** With accounting on and perpetual inventory enabled, each valued document MUST post a balanced journal
  through the general ledger posting rules: receipt (stock, received not billed), issue and sale (expense or cost of
  goods sold, stock), transfer between different stock accounts and in transit, count and adjustment (stock
  adjustment), landed cost (expenses included in valuation), price variance, rounding, corrections, revaluations.
- **FR-39** Cancelling a valued document MUST post the reversal of its journals.
- **FR-40** The stock account MUST be determined by the location, else (with item-wise inventory accounts on) the item
  or item group, else the organization default; each side of a transfer uses its own.
- **FR-41** Postings MUST be made from the document event within one minute; the document shows posting state, and a
  failure keeps it confirmed with the error and a repost action.
- **FR-42** Turning perpetual inventory on MUST post one opening journal of stock value per stock account at that date.

### 3.9 Landed cost and valuation taxes

- **FR-43** A user with `LANDED_COST_EDIT` can create a landed cost document over goods receipts, receipt documents,
  subcontract receipts and transfers in, with charges (kind, amount, currency, vendor, bill line) and a basis per
  charge: quantity, value, weight, volume or manual. Additional costs entered on a stock document become a landed cost
  created with that document, and every allocation of charges over lines follows one rule.
- **FR-44** Charges MAY be taken from supplier bill lines marked as landed cost; a bill line is used once.
- **FR-45** Confirming MUST allocate each charge (rounding remainder to the largest share), append landed cost layers
  at the receipts' times, and correct outflows that already consumed those layers.
- **FR-46** A charge MAY be marked as not affecting valuation (expensed only).
- **FR-47** When a bill's price differs from its receipt's, the difference MUST revalue the receipt like a landed
  cost, if the organization bases stock cost on bill price.
- **FR-48** Cancelling a landed cost MUST reverse its allocations and corrections.
- **FR-49** Tax lines of a category included in valuation MUST be spread over a purchase document's stock lines by
  net amount (or quantity for per-quantity taxes), remainder on the last line; with no stock lines, the category is
  treated as a document total only.

### 3.10 Stock dimensions

- **FR-50** Stock dimensions MUST be the analytic dimensions of the accounting foundation (sources such as project,
  team, customer or a custom record type): a user with `STOCK_VALUATION_EDIT` chooses which apply to stock lines, by
  direction and document type, and when they are required (dimension rules); their values flow from document lines to
  movements and layers, and balances exist per value.
- **FR-51** Outward movements with a dimension value MUST draw from that value's balance and be refused when short.
- **FR-52** A dimension in use on stock lines, movements or closings MUST NOT be deleted (only deactivated); closings
  keep its values.

### 3.11 Integrity and lookup

- **FR-53** Integrity checks MUST cover: level versus ledger sum; running quantity chain; open layers versus on hand;
  key value versus layers; first-in-first-out order; live layers of cancelled documents; stock value versus ledger
  stock accounts by account and by document; checks contributed by lot and serial tracking.
- **FR-54** Checks MUST run on demand with `STOCK_INTEGRITY_MANAGE` and record findings with severity, expected,
  actual and difference.
- **FR-55** A stock lookup MUST show, for an item code or scanned barcode, a location and a date, the quantity, value,
  unit cost, reserved and projected figures as of that date.

### 3.12 Reports

- **FR-56** Stock balance: opening, in, out, closing quantity and value, unit cost, reserved and age per item and
  location, by unit, variant attributes and dimension, starting from the latest closing.
- **FR-57** Stock ledger: every movement with running balance, cost, value, document, lot, serial and dimensions.
- **FR-58** Stock ageing: age buckets and average, earliest and latest age per item and location.
- **FR-59** Stock analytics: quantity or value moved per item or group over time.
- **FR-60** Cost of goods sold by item group.
- **FR-61** Consumption by item: consumed versus delivered quantity and value with the item's vendors.
- **FR-62** Landed cost: which charges went to which receipt lines.
- **FR-63** Kit balance: how many kits current component stock can make.
- **FR-64** Item balance: quick quantity per item and location.
- **FR-65** Total stock summary by location or organization; location tree balance roll-up.
- **FR-66** Item balance, age and value per location.
- **FR-67** Stock summary page: live on hand, projected, reserved, ordered, requested and value per item and location
  with links to the ledger and to a new document.
- **FR-68** Capacity summary: capacity, percent occupied, balance and value per location and item with a putaway rule.
- **FR-69** Stock dashboard cards and charts: active items, stock value, locations, value by item group and location,
  oldest items, shortages, receipt and delivery trends.
- **FR-70** Ledger checks: running quantity errors, first-in-first-out queue versus quantity, stock value errors,
  movements of cancelled documents, invariant check per key, variance against a replay.
- **FR-71** Valuation comparison: per movement, value and cost against an independent replay with tolerance, from
  which a value reset (FR-31) can be created.
- **FR-72** Stock and ledger account comparison by date and by document.
- **FR-73** Every report MUST be a report definition with filters, group-by, export and drill-down to layers.

### 3.13 Explainable cost, integrity monitor and counting plans (advanced)

- **FR-74** (advanced) Every layer MUST carry its explanation (method, consumed layers with quantity, cost and
  document, landed cost shares, corrections and their cause), and any value (balance, cost of goods sold, journal
  line, document line) MUST open it as "why this cost".
- **FR-75** (advanced) The preview of a backdated document or cancellation MUST list the later outflows whose
  cost changes, the total change and the postings it adds, before anything is written.
- **FR-76** (advanced) The integrity monitor MUST run every 15 minutes over keys changed since its last pass and
  fully each night, and notify valuation managers in the inbox of new findings.
- **FR-77** (advanced) For each finding an agent MUST propose a correction (reconcile, recalculate, value reset,
  repost) with a preview of movements, layers and postings; a person applies it, and the finding links to it.
- **FR-78** (advanced) A stock closing MUST warn (or refuse, per setting) when stock value and the ledger stock
  accounts differ beyond tolerance, listing the documents responsible.
- **FR-79** (advanced) Cycle count plans MUST class items per location by 12-month consumption value (A, B, C
  with configurable thresholds), give each class a frequency and tolerance, and generate counts spread over working
  days as blind tasks in the floor app.
- **FR-80** (advanced) Above-tolerance variances of planned counts MUST be recounted by another person.
- **FR-81** (advanced) Handling labour of warehouse tasks (from tracked time) MAY be capitalised monthly as a
  landed cost charge on the period's receipts by quantity.
- **FR-82** (advanced) Stock value cards and the stock summary MUST update within 5 s of a valued movement.
- **FR-83** (advanced) MCP tools MUST give balances as of a date, explain a cost, preview backdated effects,
  list findings, propose and preview corrections and draft landed costs; applying needs the matching permission.
- **FR-84** (advanced) Recalculation failed, integrity finding raised, closing completed and negative stock
  settled MUST be automation triggers.

### 3.14 Settings and compatibility

- **FR-85** A user with `STOCK_VALUATION_EDIT` can set per organization: default method, last-in-first-out allowed,
  valuation key scope, negative stock default, refusal of backdated movements that make a later balance negative (off
  by default), perpetual inventory, item-wise inventory accounts, bill-price basis, freeze date and rolling days,
  recalculation quiet window, integrity tolerance and closing agreement rule.
- **FR-86** Turning the feature on for an organization with stock MUST write one opening layer per key at that date,
  valued from the variant's cost price, the pricing cost figure, the last purchase price or zero (listed for
  counting), as the user chooses.
- **FR-87** With the feature off, no layer, posting or value is written or shown, and counts value variances as today;
  inventory then accepts and refuses exactly what it does today (negative stock, backorders, backdating, counts), also
  where the valuation plugin is loaded; turning it off leaves data inert, and on again recalculates from the date it
  was off.
- **FR-88** The values this feature adds MUST be visible only to holders of `STOCK_VALUATION_VIEW`; quantities, and a
  count's existing variance value, keep the permissions that show them today.

## 4. Non-Functional Requirements

- **Performance**: a layer adds < 20 ms P95 to a movement; "why this cost" < 500 ms P95; a recalculation of 10,000
  later outflows < 60 s; stock balance over 10 million movements < 3 s from snapshots; closing of 200,000 keys
  < 15 min.
- **Volume and concurrency**: one layer per movement plus corrections (50 million per tenant); layer writes ride the
  level lock of the movement; one recalculation per key at a time.
- **Reliability**: postings through the outbox at least once, deduplicated per document and version; recalculations
  resumable from their last key and time.
- **Security & privacy**: tenant and organization scoped; cost and value behind `STOCK_VALUATION_VIEW`; nothing leaves
  the platform. **Audit**: who and when on every method, standard cost, closing, reset, landed cost and correction.
- **Accessibility, localization, deployment**: accessible screens, every locale, money in the organization currency
  with locale formatting; multi-tenant and self-hosted; PostgreSQL, MySQL, SQLite; both ORMs.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| Valuation layer | The value attached to a stock movement or a correction of it, with its explanation |
| Layer consumption | Which incoming layers an outflow consumed, with quantity and cost |
| Valuation key | Item and location (or organization), and lot or serial when valued that way; its value and cost (its quantity is the stock level's) |
| Valuation policy | The costing method, key scope and negative rule of an organization, item group or item |
| Standard cost | A dated standard unit cost of an item; the effective one is the variant's cost price |
| Recalculation | A background operation revaluing a key from a date forward |
| Stock count | The existing count, now valued at layer cost, with opening and planned modes |
| Value reset | A dated reset of a key's value to an expected value |
| Stock closing | A period snapshot of balances that freezes the period |
| Landed cost document | Charges allocated over receipts, with its allocations |
| Stock dimension | An analytic dimension of the accounting foundation (project, owner) applied to stock lines, movements and balances |
| Integrity finding | A detected disagreement with its proposed and applied correction |
| Cycle count plan | Value classes, frequencies and tolerances that generate counts |

## 6. Out of Scope

- Quantities, movement documents, transfers, reservations and the floor app → `warehouse-and-stock-movements`.
- Lot and serial masters and bundles → `serials-and-batches` (this feature only values by lot or serial).
- Chart of accounts, analytic dimensions and their rules, account mapping storage, journals, periods →
  `accounting-foundation`, `general-ledger`.
- Supplier bills → `invoicing-receivables-payables`; tax categories and rates → `tax-engine`.
- Production cost roll-up and labour of operations → `shop-floor-and-work-orders`.

## 7. Acceptance Criteria

- [ ] **AC-1** First-in-first-out, moving average and standard cost each value a receipt, issue, transfer and return
      as specified; "why this cost" shows the consumed layers (FR-7, FR-9, FR-10).
- [ ] **AC-2** A backdated receipt appends corrections to later issues and adjusts their postings; nothing is edited (FR-3, FR-14, FR-19).
- [ ] **AC-3** A backdated issue that makes a later balance negative is accepted, valued at last cost and settled on
      the next receipt; with the organization's refusal setting on it is refused unless negative stock is allowed (FR-16, FR-22).
- [ ] **AC-4** A landed cost by weight lifts receipt layers and moves the sold share to cost of goods sold (FR-45, FR-60).
- [ ] **AC-5** A count posts variances at layer cost; above-tolerance lines need a recount (FR-28).
- [ ] **AC-6** An opening count and a value reset write the documented layers and refuse earlier-dated documents (FR-30–FR-32).
- [ ] **AC-7** A closed period refuses documents; the balance report starts from its snapshot with the same totals (FR-33, FR-37).
- [ ] **AC-8** Perpetual journals balance for every document kind and reverse on cancellation (FR-39, FR-41).
- [ ] **AC-9** Stock value equals the ledger stock accounts after the full end-to-end suite (zero findings) (FR-33, FR-72).
- [ ] **AC-10** Each report of FR-56 to FR-72 runs and drills down to layers.
- [ ] **AC-11** (advanced) A backdated preview lists the later cost changes and writes nothing (FR-75, FR-83).
- [ ] **AC-12** (advanced) A seeded disagreement becomes a finding; its previewed correction resolves it (FR-77, FR-83).
- [ ] **AC-13** (advanced) A cycle count plan generates blind count tasks by value class (FR-79).
- [ ] **AC-14** (advanced) Monthly labour capitalization adds a landed cost from tracked time (FR-81).
- [ ] **AC-15** Works on PostgreSQL, MySQL and SQLite with both ORMs; nothing changes while the flag is off (FR-87; §4).
- [ ] **AC-16** All functional requirements have a passing test (§3).
- [ ] **AC-17** With the valuation plugin loaded and the feature off for a tenant, the existing inventory suites pass
      unchanged; with it on, an unlimited or backorder level, a count without tolerance and a count's variance value
      for a user without `STOCK_VALUATION_VIEW` behave as before (FR-21, FR-27, FR-28, FR-87, FR-88).
- [ ] **AC-18** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-87, FR-88).

## 8. Open Questions

- Offer last-in-first-out? Default applied: available, off by default per organization; regional packs decide.
- Valuation key scope? Default applied: item and location; item and organization as a setting.
- Opening value when the feature is turned on? Default applied: the variant's cost price, keys without one listed;
  the pricing cost figure and the last purchase price are the alternatives.
- Closing disagreement with the ledger? Default applied: warn; refusing is a setting.

## 9. Constitution Gates

- [x] I Plugin-first — new `inventory-valuation` plugin (+ `inventory-valuation-ui`); hooks into `inventory` by ports.
- [x] II Tenant/organization scoping — every layer, policy and document tenant and organization scoped.
- [x] III Both ORMs, additive migrations — new tables; one nullable column on the movement table.
- [x] IV Default-off flag; nothing removed — `FEATURE_INVENTORY_VALUATION` off; count variance unchanged when off.
- [x] V Contracts and API first — layers, explanations and previews are endpoints first.
- [x] VI Permissions, privacy, security — values behind their own view permission; posting actions separate keys.
- [x] VII Real-time through the event bus — value cards and findings through the push channel.
- [x] VIII i18n and accessibility — keys in every locale; accessible screens.
- [x] IX Tests accompany the change — method property tests, ledger invariants as tests.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Depends on: [`warehouse-and-stock-movements`](../warehouse-and-stock-movements/spec.md),
  [`general-ledger`](../general-ledger/spec.md), [`business-document-engine`](../business-document-engine/spec.md);
  dimensions from [`accounting-foundation`](../accounting-foundation/spec.md)
- Related: [`serials-and-batches`](../serials-and-batches/spec.md), [`procurement`](../procurement/spec.md),
  [`tax-engine`](../tax-engine/spec.md), [`invoicing-receivables-payables`](../invoicing-receivables-payables/spec.md)
- Code: `packages/plugins/inventory/src/lib/stock-movement/`, `packages/plugins/inventory/src/lib/stock-count/`,
  `packages/plugins/inventory/src/lib/stock-level/stock-level.service.ts`
