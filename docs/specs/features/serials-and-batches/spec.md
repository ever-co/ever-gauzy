# Feature Specification: Lots and serial units

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `serials-and-batches`
**Branch**: `feat/serials-and-batches`
**Status**: `Draft`
**Created**: 2026-11-15
**Last updated**: 2026-11-23
**Owner**: `evereq`
**Feature flag**: `FEATURE_LOT_SERIAL_TRACKING` (new tenant feature, default off; requires `FEATURE_INVENTORY`)

---

## 1. Overview

Today a lot number, an expiry date or serial numbers can only be typed as free text on a goods receipt line or a pick
line: there is no lot or serial master, no balance per lot, no picking by expiry and no way to say where a unit came
from or went. This feature adds **tracking policies** per item (none, lot, serial, or both, with numbering series,
and the item's own shelf life and warranty unless overridden), **lots** with dates, status and lineage, **serial
units** with a life history from receipt to customer, and **lot and serial bundles** on every stock document line, so
each movement says exactly which lots and units moved; lot balances are read from those bundles, never stored apart.
Outward bundles are chosen automatically **by expiry or age**, expired and blocked lots are kept off every outward
movement, lots and serial units can be **valued individually**, and forward and backward **traceability** runs across
receipts, transfers, repacks, production, deliveries and returns. The old free-text fields keep working as mirrors of
the bundles, so there is one model. Clients: the Angular app, the floor app of `warehouse-and-stock-movements`, the
MCP server, the SDKs.

**Advanced capabilities.** Expiry is **enforced**, not advisory: a customer's minimum remaining shelf life
drives picking, expired lots are blocked on every outward movement, and a **recall workflow** blocks lots everywhere
at once, computes the full upstream and downstream **traceability graph**, contains stock, and drafts customer notices
with progress to closure. An **expiry-risk agent** compares lots with forecast demand and proposes transfers or
reservations with a preview. Lots and serial units are captured **offline** in the floor app, and status and expiry
changes update open screens **live** and drive automation rules. These requirements are marked `(advanced)`.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** an item with lot tracking, a shelf life of 180 days and a lot series, **when** a receipt of 500 units is
  confirmed with one new lot made on 1 November, **then** the lot is numbered by the series, expires on 30 April, holds
  500 at the receiving location, and the receipt line's lot and expiry text show the same values.
- **Given** two lots of that item (expiring in March and April), **when** a delivery of 300 is picked, **then** the
  bundle takes the March lot first, and the pick line names it.
- **Given** an item with serial tracking and a serial series, **when** 20 units are received, **then** 20 serial units
  are generated in stock at that location; **when** one is delivered to a customer, **then** its history shows the
  receipt, the delivery and the customer, and its warranty runs from the delivery date.
- **Given** a bulk lot repacked into retail packs, **when** the repack splits it into two child lots, **then** the
  lineage report shows both under the parent.
- **Given** a production order consuming lots A and B into output lot C, **when** the quality manager traces C
  backwards, **then** they see A and B, their receipts and vendors; tracing A forwards shows C and every customer who
  received C.
- **Given** a lot approaching expiry, **when** it reaches its warning days, **then** the stock managers receive a notice
  and the lot shows "expiring".
- **Given** an item valued by lot, **when** units of a lot received at 4.00 are issued, **then** they cost 4.00
  whatever other lots cost.
- **Given** a customer requiring 90 days of remaining shelf life, **when** a pick list is built for them, **then** lots
  with less than 90 days left are skipped and a shortfall is reported before picking.
- **Given** a contaminated vendor lot, **when** a recall is opened on it, **then** it and every lot made from it are
  blocked at once, the impact lists stock per location, open picks, work orders and customers with delivered quantities,
  one action moves the stock to quarantine, and customer notices are drafted for review.
- **Given** a counter in the floor app offline, **when** they scan composite codes with lot and expiry, **then** the
  lots are captured on the device and created or matched on sync.

### 2.2 Edge cases & failures

- **Given** a tracked item, **when** a line is confirmed without a complete bundle, **then** that line is refused with
  "lot or serial missing" and the quantity still to assign.
- **Given** a serial unit already in stock, **when** a receipt brings the same number, **then** it is refused; **given**
  a serial not at the source location, **when** it is issued, **then** it is refused.
- **Given** an expired lot, **when** anyone issues, sells or transfers it to a sellable location, **then** it is refused;
  moving it to a non-sellable location, scrapping it or returning it to the vendor is allowed; an override needs
  `LOT_SERIAL_OVERRIDE` and a reason and is audited.
- **Given** a bundle whose quantities do not add up to the line, **then** confirmation is refused with the difference.
- **Given** a return, claim or exchange of a lot or serial the original delivery of that order line did not contain,
  **then** it is refused.
- **Given** an item holding stock, **when** someone switches on tracking directly, **then** it is refused; a tracking
  start document assigns the existing stock instead.
- **Given** two offline devices that generated the same serial for different units, **when** both sync, **then** the
  second becomes a task exception asking for a new number; nothing is lost.
- **Given** an API client that sends only the old free-text lot fields, **then** a bundle is built from them (creating
  the lot if missing) and the response is unchanged.
- **Given** no `LOT_RECALL_MANAGE`, **then** opening a recall answers `403`; with the feature off every route of this
  feature answers `404` and the free-text fields behave as today.

## 3. Functional Requirements

### 3.1 Tracking policies

- **FR-1** A user with `LOT_SERIAL_POLICY_EDIT` can set per item, or per item group as a default, the tracking (none,
  lot, serial, lot and serial), lot and serial numbering series or manual entry, an override of the item's own shelf
  life and warranty period (one default per item, kept on the item), whether expiry is required, expiry warning days,
  picking policy, valuation by lot or serial and serial uniqueness (per item or per organization); tracking requires
  the item to be stock-tracked.
- **FR-2** Starting or stopping tracking for an item that holds stock MUST be refused except through a tracking start
  document that assigns its stock on hand to lots (one adoption lot by default) or generates its serial units.
- **FR-3** A movement of a tracked item without a complete bundle MUST be refused per line with the quantity left.

### 3.2 Lots

- **FR-4** A lot MUST carry a number (from the series or entered, unique per item and organization), item, manufacture
  date, expiry date (manufacture date plus shelf life when not given), vendor, source document, parent lot,
  description, planned and produced quantity, and custom attributes.
- **FR-5** A lot MUST have a status — available, quarantined, blocked, expired or recalled; only available lots can
  be sold, issued or moved to a sellable location; others may move to non-sellable locations, be scrapped or be
  returned to the vendor.
- **FR-6** A user with `LOT_SERIAL_STATUS_EDIT` can change a lot's status with a reason; every change is kept with who,
  when, why and its source (inspection, recall, expiry, person).
- **FR-7** A lot MAY be disabled for new inflows; its remaining stock stays visible and movable.
- **FR-8** Lot balances per location and bin MUST be read from the confirmed bundles of the movements (never stored
  apart), so they change with the movement's transaction, and a lot's reserved quantity from the active reservations
  naming it; a negative lot balance is refused unless the item allows negative lots.
- **FR-9** A production output lot MUST accumulate produced quantity against its planned quantity and link to its work
  order.
- **FR-10** A split (repack or production) MUST create child lots linked to their parent, summing to the parent's
  quantity moved.

### 3.3 Serial units

- **FR-11** A serial unit MUST carry a number (unique per its scope), item, lot, status, current location and bin,
  vendor and receipt, customer and delivery after sale, work order, warranty start and end, linked fixed asset or
  equipment record and its last movement.
- **FR-12** Serial statuses — in stock, reserved, delivered, consumed, in repair, scrapped, returned to vendor — MUST
  change only through documents; issuing a unit not in stock at the source, or receiving one already in stock, is
  refused.
- **FR-13** Serial numbers MAY be generated from the series for a line's quantity, entered, scanned, or given as a range
  that expands; duplicates in the scope are refused.
- **FR-14** Warranty MUST start at delivery (or at receipt for own use) and end after the item's warranty period (or
  the policy's override); one daily job updates warranty status (in warranty, expiring within the warning days,
  expired), and installed-base records of serial-tracked items read these dates and statuses rather than keeping
  their own; service contract status is read from field service's contracts.
- **FR-15** A serial unit MAY be linked to a fixed asset, to an equipment record (an own tool) and to its installed-base
  record.

### 3.4 Bundles

- **FR-16** Every line of a stock document, transfer, goods receipt, delivery (fulfilment line), pick, count, order
  return, claim or exchange, production movement or register sale for a tracked item MUST carry a bundle of lots
  and/or serial units with quantity, location and bin, in the direction of the movement.
- **FR-17** Inward bundles MUST be fillable by entry, scan, series generation, ranges or a file upload; a file template
  matching the line can be downloaded.
- **FR-18** Outward bundles MUST be suggested by the picking policy when the user picks none, and remain editable
  until confirmation.
- **FR-19** Confirmation MUST check that the bundle quantity equals the line, locations match, serials are unique and
  in an allowed status, lots are in an allowed status, lot balances stay non-negative, and returns contain only what
  the original moved (a returned serial unit must have been delivered on the same order line).
- **FR-20** A bundle MUST be confirmed and cancelled with its document; cancellation reverses lot balances and serial
  statuses.
- **FR-21** The free-text lot, expiry and serial fields on goods receipt and pick lines MUST stay: for an item with
  lot or serial tracking they mirror the bundle, and a client sending only the text gets a bundle built from it (the
  lot created if missing); for an item whose tracking is none they keep behaving as today, the text stays as typed, and
  a lot recorded from it is informational and never refuses a movement (expired or not).

### 3.5 Picking by expiry or age

- **FR-22** The picking policy MUST be set per organization and overridable per item: first expiry first out (default
  for items with expiry), first in first out, or last in first out.
- **FR-23** Automatic selection MUST skip lots that are expired or not available, lots and serial units held by other
  demands, and serial units not in stock at the location.
- **FR-24** The same selection MUST serve pick lists, deliveries, transfers, issues and production consumption.
- **FR-25** Expired lots MUST be blocked on every outward movement except to non-sellable locations, scrap or return to
  vendor; an override needs `LOT_SERIAL_OVERRIDE` and a reason, and is audited.

### 3.6 Expiry and valuation hooks

- **FR-26** A daily job MUST mark lots expired on their expiry date and send one notice per lot when it enters its
  warning days, to the item's stock managers in the inbox and by email.
- **FR-27** Items valued by lot or serial MUST get one valuation key per lot or serial unit, so an outflow costs the
  lot's or unit's own cost.
- **FR-28** This feature MUST contribute integrity checks: item quantity equals the sum of its lots; serial units in
  stock equal on hand; no orphan serial units; no negative lots; bundles match their movements; serial-valued costs
  match their receipts.

### 3.7 Traceability

- **FR-29** Every confirmed bundle MUST record trace links between lots or serial units, documents, vendors, locations
  and customers (received from, split into, consumed into, repacked into, transferred, delivered to, returned from).
- **FR-30** A user with `LOT_SERIAL_VIEW` can trace a lot or serial unit backward (to receipts, vendors and input lots)
  and forward (to transfers, consumptions, output lots and customers) through any number of levels.

### 3.8 Reports

- **FR-31** Available lots: lots with stock per location and expiry, optionally including expired ones.
- **FR-32** Serial units on hand per location, with cost for holders of the valuation view permission.
- **FR-33** Lot expiry status: lots expired or expiring within a number of days.
- **FR-34** Lot lineage: parent and child lots as a tree.
- **FR-35** Lot balance history: opening, in, out and closing per lot and location for a period.
- **FR-36** Serial unit history: every movement and status of one unit.
- **FR-37** Serial status, warranty expiry and (with field service) service contract expiry lists.
- **FR-38** Traceability: forward and backward trace of lots and serial units, exportable.
- **FR-39** Bundle summary per document, lot and serial unit.
- **FR-40** Lot and serial balance per location.
- **FR-41** Quantity checks: item quantity versus lots, stock versus serial count with orphan units, negative lots.
- **FR-42** Consistency checks: bundles versus movements, serial-valued cost errors.
- **FR-43** Every report MUST be a report definition with filters, export and drill-down to documents.

### 3.9 Shelf life, recall, graph and agents (advanced)

- **FR-44** (advanced) Minimum remaining shelf life MAY be set per customer, sales channel or item; picks and
  deliveries take only lots with at least that many days left, and a shortfall is reported before picking.
- **FR-45** (advanced) A user with `LOT_RECALL_MANAGE` can open a recall on lots or serial units with a reason;
  they are blocked everywhere at once and the impact is computed from the forward trace: stock per location, open
  reservations and picks, work orders, output lots and customers with delivered quantities.
- **FR-46** (advanced) From a recall, one previewed action MUST transfer affected stock to quarantine, release
  affected holds and picks, and draft customer notices (lot, quantity, delivery date, instructions) for a person to
  send; returns are linked, and contained, notified and returned shares are tracked to closure.
- **FR-47** (advanced) A traceability graph MUST show lots, serial units, documents, vendors and customers in
  both directions, expand node by node, and export for an authority.
- **FR-48** (advanced) A weekly expiry-risk agent MUST list lots that will expire before production planning's
  demand forecast uses them and propose, with a preview, a transfer to a location with demand, a reservation for open
  orders or a move to front bins; a person approves each.
- **FR-49** (advanced) The floor app MUST capture lots and serial units offline (composite codes, series
  generation on the device) through the platform's offline sync; duplicates found at sync become task exceptions.
- **FR-50** (advanced) Lot status, expiry, recall and serial delivery changes MUST update open screens within
  2 s and be automation triggers (lot expiring, lot expired, recall opened, serial delivered, warranty expiring).
- **FR-51** (advanced) MCP tools MUST trace forward and backward, list expiring lots, preview a recall's impact,
  open it with permission, and read a serial unit's history.

### 3.10 Compatibility

- **FR-52** With the feature off nothing changes: no bundle is required and the free-text fields behave as today.
  With it on, an item whose tracking policy is none (the default for every item) moves exactly as today; and a tenant
  that has not switched the feature on keeps it off, also after any later change of the default for new tenants.
- **FR-53** New permissions MUST be granted to the admin role, and view and status change to the manager role.

## 4. Non-Functional Requirements

- **Performance**: bundle validation of 1,000 serial units < 500 ms P95; automatic selection < 200 ms P95 for an item
  with 5,000 lots; a five-level trace over 1 million trace links < 2 s; recall impact for 100 lots < 10 s.
- **Volume and concurrency**: 10 million serial units and 1 million lots per tenant; lot balances are read and
  checked under the movement's level lock, so two pickers cannot draw the same lot quantity twice.
- **Reliability**: expiry and warranty jobs idempotent per lot and day; notices once per lot and threshold; events
  through the outbox at least once.
- **Security & privacy**: tenant and organization scoped; customer names in traces need contact view permission;
  customer notices leave the platform only when a person sends them. **Audit**: every status change, override,
  recall action and tracking start.
- **Accessibility, localisation, deployment**: accessible screens and graph (keyboard navigation, text alternative);
  every locale; dates in the user's locale; PostgreSQL, MySQL, SQLite; both ORMs; multi-tenant and self-hosted.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| Tracking policy | How an item or item group is tracked: lot, serial, series, shelf-life and warranty overrides, picking, valuation |
| Lot | A tracked batch of an item with dates, status, vendor, source and parent lot |
| Lot balance | Quantity of a lot at a location and bin, read from the bundles of its movements |
| Serial unit | One tracked piece with status, location, customer, warranty (the one record of it) and history |
| Lot and serial bundle | The lots and serial units moved by one document line, with quantities |
| Trace link | One step of where a lot or unit came from or went |
| Tracking start | A document assigning existing stock to lots or serial units when tracking begins |
| Recall | A blocked set of lots or units with its impact, containment, notices and progress |
| Shelf-life rule | Minimum remaining days a customer, channel or item accepts |

## 6. Out of Scope

- Quantities, documents, pick lists and the floor app itself → `warehouse-and-stock-movements`.
- Value layers and costing → `stock-ledger-and-valuation` (this feature only defines lot and serial keys).
- Inspections that quarantine or release lots → `quality-management`; installed base, service contracts and warranty
  claims → `maintenance-and-field-service` (warranty dates of serial units stay here); asset register → `fixed-assets`.
- An item's shelf life and warranty period → `item-catalogue`; demand forecast used by the expiry-risk agent →
  `production-planning`.

## 7. Acceptance Criteria

- [ ] **AC-1** A lot-tracked receipt creates a numbered lot with computed expiry and mirrors it on the receipt line (FR-1, FR-21).
- [ ] **AC-2** A delivery picks the earliest-expiring available lot; an expired lot is refused on every outward path
      except quarantine, scrap and return to vendor (FR-23, FR-31, FR-33).
- [ ] **AC-3** Serial units are generated, delivered with a customer and warranty, returned, and their history shows
      each step; a duplicate or misplaced serial is refused (FR-13, FR-29, FR-36).
- [ ] **AC-4** A bundle that does not add up, or a return of an unknown lot, is refused; cancellation restores balances (FR-19, FR-20).
- [ ] **AC-5** A repack split and a production output appear in the lineage and in both trace directions (FR-9, FR-10, FR-29, FR-34).
- [ ] **AC-6** A lot-valued item issues at its lot's cost (FR-27).
- [ ] **AC-7** Each report of FR-31 to FR-42 runs and drills down; the checks report zero issues after the e2e suite.
- [ ] **AC-8** A client sending only free-text lot fields gets a bundle and an unchanged response (FR-21).
- [ ] **AC-9** (advanced) A customer's minimum shelf life skips short-dated lots and reports the shortfall (FR-44).
- [ ] **AC-10** (advanced) A recall blocks lots at once, previews containment, quarantines stock and drafts
      notices; progress reaches closure (FR-45, FR-46).
- [ ] **AC-11** (advanced) The graph expands a five-level trace and exports it (FR-47).
- [ ] **AC-12** (advanced) The expiry-risk agent proposes a previewed transfer that a person approves (FR-48).
- [ ] **AC-13** (advanced) Offline lot capture syncs; a duplicate serial becomes an exception (FR-49).
- [ ] **AC-14** Works on PostgreSQL, MySQL and SQLite with both ORMs; nothing changes while the flag is off (FR-52; §4).
- [ ] **AC-15** All functional requirements have a passing test (§3).
- [ ] **AC-16** With the feature on, a pick line of an untracked item whose free-text lot carries a past expiry date
      is confirmed as today, and its text is kept as typed (FR-21, FR-52).
- [ ] **AC-17** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-52).

## 8. Open Questions

- Serial uniqueness default? Default applied: per item; per organization as a policy option.
- Adoption of existing stock when tracking starts? Default applied: one adoption lot per item and location, without
  expiry, to be split by a count later.
- Should recall notices be sent automatically? Default applied: drafted only; a person sends them.

## 9. Constitution Gates

- [x] I Plugin-first — new `lot-serial-tracking` plugin (+ `-ui`, with a floor-app module); hooks into `inventory` by ports.
- [x] II Tenant/organization scoping — lots, units, bundles, traces and recalls tenant and organization scoped.
- [x] III Both ORMs, additive migrations — new tables only; existing free-text columns untouched.
- [x] IV Default-off flag; nothing removed — `FEATURE_LOT_SERIAL_TRACKING` off; free-text fields keep working.
- [x] V Contracts and API first — bundles, traces and recalls are endpoints first.
- [x] VI Permissions, privacy, security — six keys; customer data in traces permission-checked; notices sent by people.
- [x] VII Real-time through the event bus — status, expiry and recall events through the push channel.
- [x] VIII i18n and accessibility — keys in every locale; graph with keyboard navigation and text alternative.
- [x] IX Tests accompany the change — bundle validation, picking and trace specs; checks as invariant tests.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Depends on: [`warehouse-and-stock-movements`](../warehouse-and-stock-movements/spec.md),
  [`item-catalogue`](../item-catalogue/spec.md); values with
  [`stock-ledger-and-valuation`](../stock-ledger-and-valuation/spec.md)
- Used by: [`quality-management`](../quality-management/spec.md),
  [`maintenance-and-field-service`](../maintenance-and-field-service/spec.md),
  [`shop-floor-and-work-orders`](../shop-floor-and-work-orders/spec.md)
- Code: `packages/plugins/purchasing/src/lib/goods-receipt-line/` (`batchNumber`, `expiresAt`),
  `packages/plugins/warehouse/src/lib/pick-list-line/pick-list-line.entity.ts` (`lotNumber`, `expiryDate`,
  `serialNumbers`), `packages/plugins/returns/src/lib/order-return-line/`,
  `packages/plugins/fulfillment/src/lib/fulfillment-line/`
