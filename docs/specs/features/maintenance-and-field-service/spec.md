# Feature Specification: Maintenance and field service

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `maintenance-and-field-service`
**Branch**: `feat/maintenance-and-field-service`
**Status**: `Draft`
**Created**: 2026-11-16
**Last updated**: 2026-11-23
**Owner**: evereq
**Feature flag**: `FEATURE_FIELD_SERVICE` (default off)

---

## 1. Overview

An organization that sells, installs and services equipment at its customers' sites has nowhere to keep that
equipment or its service today: the equipment register and equipment sharing manage the organization's own tools and
their lending (kept as they are), appointments and public booking pages schedule meetings, and time tracking records
work, but nothing models a customer's machine, a warranty claim, a service contract, a maintenance plan or a visit.
This feature adds the **installed base** (customer units at customer sites, linked to serial units, deliveries and
installations), **service contracts** that cover units with terms and set their contract end, **maintenance plans**
that generate calendar-aligned **visits**, **warranty claims** whose coverage is decided on the complaint date, and
**visits** dispatched to **technicians** on a **dispatch board and technician calendar**, with checklists, readings,
parts from van or warehouse stock, tracked time, signature and a visit report, writing back to plans and claims and
billing what is not covered. Surfaces: the Gauzy app (installed base, contracts, plans, claims, dispatch, reports),
the REST API and SDKs, MCP tools for agents; the technician's mobile job screen is an installable, offline-capable
screen of the Gauzy web app. Own assets keep their maintenance in fixed assets; tickets stay in the helpdesk and start
claims and visits from there.

**Advanced capabilities.** **Predictive maintenance** forecasts from meter readings when a unit will reach its service
threshold and proposes the visit before it is due. **Route-optimised dispatch** proposes a day's plan per technician
that respects skills, time windows, time off, travel and the availability of the parts each visit needs. **Customer
self-booking** offers the customer real slots computed from technician availability to book, move or cancel a visit.
**First-time-fix analytics** measure per technician, item and fault how often a visit solved the problem without a
return visit. **Tracked time** on a visit is its labour cost and billable labour with no timesheet re-entry, and a
**visit assistant** briefs the technician with the unit's history and drafts the visit report from their notes.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** a delivered and installed compressor with serial C-1042 (installation recorded by delivery), **when** the installation is completed, **then** an installed-base unit appears at the customer's site with the serial, installation date and warranty running 24 months from delivery.
- **Given** a service contract "Gold, 1 year, labour and parts included, 4 h response, 4 visits" for the customer's three units, **when** it is activated, **then** each unit shows "under contract until 2027-11-30", the serial units show the contract end, and a maintenance plan with four quarterly visits per unit is proposed for review.
- **Given** a maintenance plan "every 3 months on the first Monday" from 2026-12-01 to 2027-11-30 for technician Ana, **when** visits are generated, **then** four visits are planned on first Mondays, one moved to the next working day because it falls on a public holiday, and each appears on Ana's calendar.
- **Given** a customer complaint about C-1042 on 2027-02-10, **when** a warranty claim is recorded, **then** its coverage reads "in warranty (until 2028-11-15)" and "under contract", and "Create visit" opens a visit prefilled with customer, site, unit and the fault.
- **Given** the dispatcher's board, **when** they drag an unassigned breakdown visit onto Ben's Tuesday 10:00, **then** the board warns that Ben lacks the skill "refrigerant handling" and offers Carla, who has it and the required part in her van stock.
- **Given** Carla on site, **when** she completes the checklist, records two readings, uses one filter from van stock, tracks 1 h 20 min on the visit and the customer signs, **then** the visit is completed, the filter is issued from her van location, the claim becomes resolved with her name and work done, and the visit report PDF is emailed to the customer contact.
- **Given** a visit for an out-of-warranty unit without contract, **when** it is completed, **then** a draft invoice holds the parts at list price and the labour from tracked time at the technician's billing rate; a covered visit drafts nothing.
- **Given** a unit with a meter "running hours" serviced every 2,000 h and readings rising 40 h a week, **when** the forecast reaches the threshold in 3 weeks, **then** a proposed visit appears for the week before, with the forecast and its confidence.
- **Given** 14 visits for tomorrow and four technicians, **when** the dispatcher asks for a proposal, **then** the board shows an assignment and order per technician with travel time, every visit in its window, skills matched and parts available, and applies it only when the dispatcher accepts.
- **Given** a customer with a signed-in portal account or a booking link from the visit, **when** they pick "Thursday 14:00–16:00" from offered slots, **then** the visit is scheduled to the technician who freed that slot and both receive a confirmation; moving it within 24 h of the visit is refused by the organization's rule.
- **Given** an agent with field-service permissions, **when** it calls `field_service_dispatch_propose` for tomorrow, **then** it receives the proposal as a preview and assigns nothing until a person confirms.

### 2.2 Edge cases & failures

- **Given** a user without `FIELD_SERVICE_DISPATCH`, **when** they assign a visit, **then** `403`; with the feature off every route answers `404` and equipment, equipment sharing and appointments behave as today.
- **Given** a plan whose end is before its start, a visit count of zero, or a recurrence that cannot fit the count in the period, **then** saving is refused naming the rule.
- **Given** a plan edited after visits were generated, **then** only future visits that are neither scheduled by a person nor started are regenerated, and the change lists what moved.
- **Given** a technician whose every day in the plan's period is a holiday or time off, **then** generation is refused naming the technician.
- **Given** a serial unit that was never delivered to this customer, **when** it is added to the customer's installed base, **then** it is accepted with a warning stored on the unit.
- **Given** a unit already covered by another active contract on the start date, **when** a second contract names it, **then** activation is refused naming the other contract.
- **Given** a warranty claim with an open visit, **when** someone cancels the claim, **then** it is refused naming the visit.
- **Given** two dispatchers assigning the same visit at once, **then** the second is refused with `409` and the board refreshes.
- **Given** a part that is not in the technician's van stock, **when** they record it as used, **then** they choose another location or the visit records a parts request; stock is never issued below zero unless the location allows it.
- **Given** a technician offline on site, **when** they complete the visit and reconnect, **then** their updates apply in order, a conflicting reassignment by the dispatcher wins for the assignment and the work record is kept.
- **Given** a visit that cannot start because nobody is on site, **then** the technician marks "no access" with a photo and time, the visit is closed as no access, and a follow-up is proposed.
- **Given** a visit cancelled after the customer booked it, **then** the customer is told and offered new slots.

## 3. Functional Requirements

### 3.1 Installed base and sites

| ID | Requirement |
| --- | --- |
| **FR-1** | A user with `FIELD_SERVICE_INSTALLED_BASE_EDIT` can record an installed-base unit: customer (organisation contact), site, item or variant, serial unit (when tracked), name, installation date, contact person, parent unit (for components), notes, files and custom fields. |
| **FR-2** | The system MUST create or update installed-base units when a delivery installation is completed or a serial unit is delivered to a customer, linked to the delivery, installation and serial unit, without duplicates per serial unit. |
| **FR-3** | A user with `FIELD_SERVICE_INSTALLED_BASE_EDIT` can maintain customer sites: address and geographic position (kept once, in the customer's address book), access notes, opening hours, site contacts, and the service area (a team of technicians) used for dispatch. |
| **FR-4** | The system MUST derive each unit's coverage on any date: in warranty (warranty end on or after the date), under contract (an active contract covers it), both, or not covered, and show coverage and its end dates on the unit, claims and visits. |
| **FR-5** | The system MUST read warranty dates and status from the serial unit when there is one, never copying them, and otherwise keep the unit's own warranty from installation, editable with a reason. |
| **FR-6** | The system MUST keep a timeline per unit of installations, moves between sites, contracts, claims, visits, readings, parts replaced and status changes (active, inactive, replaced, scrapped), with links, built from the platform's change history and the linked records. |
| **FR-7** | The system MUST record a part replaced on a unit with the removed and fitted serial units, and replace a component unit by a new one keeping the history of both. |
| **FR-8** | The system MUST warn, but accept, when a serial unit added to a customer's installed base was not delivered to that customer. |
| **FR-9** | A user with `FIELD_SERVICE_INSTALLED_BASE_EDIT` can define meters on a unit (name, unit, reading kind: cumulative or gauge) and record readings (date, value, source: visit, customer, import, device); a cumulative reading lower than the previous is refused unless marked as a reset. |
| **FR-10** | The system MUST accept meter readings from devices through an authenticated endpoint per unit, at most one reading per meter per minute. |

### 3.2 Service contracts

| ID | Requirement |
| --- | --- |
| **FR-11** | A user with `FIELD_SERVICE_CONTRACTS_EDIT` can draft a service contract: customer, number from its series, start and end, covered units (all units of the customer, of chosen sites, or listed), coverage terms (labour, parts, travel each included, discounted by a percentage or charged), response target in hours, included visits per period, price, billing schedule and renewal (none, propose, automatic with notice days). |
| **FR-12** | The system MUST refuse activating a contract that covers a unit already covered by another active contract on any day of the period, and a contract whose end is before its start. |
| **FR-13** | The system MUST answer, for a covered serial unit, its active contract and contract end, which serial unit pages and expiry lists read from the contract (nothing is copied onto the serial unit), so cancellation or expiry shows at once. |
| **FR-14** | The system MUST propose, on activation, a maintenance plan from the contract's included visits, shown as a draft to review. |
| **FR-15** | The system MUST bill a contract on its schedule through recurring invoices or subscriptions, whichever the organization uses, and show billed and unbilled periods on the contract. |
| **FR-16** | The system MUST, before a contract ends, notify its owner the configured days ahead (default 30), draft a renewal for "propose", and renew for "automatic" unless cancelled before the notice date. |
| **FR-17** | The system MUST create a contract from a quotation or sales order line of a service item marked as contract, with its units taken from the order's delivered serial units. |
| **FR-18** | The system MUST track, per contract and period, visits included, used and remaining, and response targets met or missed per visit. |

### 3.3 Maintenance plans and visit generation

| ID | Requirement |
| --- | --- |
| **FR-19** | A user with `FIELD_SERVICE_PLANS_EDIT` can define a maintenance plan for a customer: lines of unit (or item with serial units), start and end, recurrence, number of visits, responsible technician or team, checklist template, estimated duration, required skills and parts kit (proposed from the item's spare parts in the catalogue), optional contract and sales order. |
| **FR-20** | The system MUST support recurrences aligned to the calendar (every N days or weeks on chosen weekdays; every N months on a day of the month or an nth weekday; yearly on a date) with the platform's one recurrence rules, by meter (every N units of a meter), or both with whichever comes first, and evenly spread visits between start and end. |
| **FR-21** | The system MUST, given start, recurrence and two of end date, visit count, compute the third, and refuse a count the period cannot hold. |
| **FR-22** | The system MUST generate planned visits for a plan, moving a date that falls on a holiday or time off of the responsible technician to the next working day (or previous, when the next is after the end), and refuse when no working day exists in the period. |
| **FR-23** | The system MUST, when a plan changes after generation, regenerate only future visits that nobody scheduled by hand and that have not started, and list the moved, added and removed visits. |
| **FR-24** | The system MUST let a user fill plan lines from a confirmed sales order's delivered lines with their serial units, and keep one plan per sales order line. |
| **FR-25** | The system MUST track per plan line each planned visit's planned date, actual date and completion (pending, partly done, done), updated from completed visits, the latest done visit winning. |
| **FR-26** | A user with `FIELD_SERVICE_PLANS_EDIT` can create a visit from a plan line's planned date, prefilled with customer, site, unit, serial unit, technician, checklist and parts kit. |
| **FR-27** | The system MUST check plans daily and create the visits due in the plan's lead time (default 14 days) as unscheduled visits in the dispatch queue. |

### 3.4 Warranty claims

| ID | Requirement |
| --- | --- |
| **FR-28** | A user with `FIELD_SERVICE_CLAIMS_EDIT` can record a warranty claim: complaint date, customer and contact, unit or serial unit, item, fault description and fault code, service site, priority, and the ticket it came from. |
| **FR-29** | The system MUST number claims from their series and move them through open, in progress, resolved, closed and cancelled; closing stamps the resolution date, reopening clears it. |
| **FR-30** | The system MUST fix the claim's coverage on its complaint date (warranty, contract, both, none) with the end dates, and refuse a serial unit that does not belong to the claim's item. |
| **FR-31** | The system MUST refuse cancelling a claim while one of its visits is open. |
| **FR-32** | A user with `FIELD_SERVICE_CLAIMS_EDIT` can create a visit from a claim; when a visit of the claim is completed, the claim becomes resolved (all purposes done) or in progress (partly done) with resolver, date and work done, and reverts when that visit is reopened, unless a later visit decided the claim; a claim resolved by replacing or refunding the unit opens a replacement or refund claim, or an exchange, on the order that delivered it, so stock and money move through returns. |
| **FR-33** | The system MUST record on a claim the parts, labour and travel spent on its visits with their cost, and whether each was covered or charged. |
| **FR-34** | A user with `FIELD_SERVICE_CLAIMS_APPROVE` can approve or refuse a claim above the organization's cost threshold through the approval engine before parts are ordered. |
| **FR-35** | The system MUST let a claim on a supplier-warranted item draft a recovery claim to the supplier with the parts and labour spent. *(advanced)* |

### 3.5 Visits

| ID | Requirement |
| --- | --- |
| **FR-36** | A user with `FIELD_SERVICE_VISITS_EDIT` can create a visit: customer, site, kind (scheduled maintenance, breakdown, installation follow-up, inspection, other), source (plan, claim, ticket, contract, asset maintenance, customer booking, manual), priority, requested window, units with purposes, required skills, estimated duration, checklist and parts kit. |
| **FR-37** | The system MUST number visits and move them through requested, scheduled, dispatched, on the way, on site, paused, completed, partly completed, no access and cancelled, recording who changed the state, when and where the device was when the technician allowed it. |
| **FR-38** | The system MUST refuse a scheduled visit without a technician, a visit outside its plan line's period for planned visits, and a planned visit whose plan belongs to another customer. |
| **FR-39** | The system MUST give each unit purpose of a visit a work record: work done, findings, completion (done, partly done, not done) and the technician, and require at least one purpose before completion. |
| **FR-40** | The system MUST run the visit's checklist: steps with result (done, not applicable, failed), readings recorded as meter readings of the unit and checked against the meter's limits, photos and notes, and refuse completion while a required step is open; checklists carry no acceptance rules of their own (inspections with acceptance rules belong to quality management). |
| **FR-41** | The system MUST record parts used from the technician's van location or a chosen warehouse through stock movements, with serial units for tracked parts, and returned defective parts to a returns location. |
| **FR-42** | The system MUST create, for each assigned technician, a work task and a travel task linked to the visit, and count the time tracked on each as the visit's work and travel labour (a time log counts only for the task it carries), valued at the pay rate stored on each log; state changes never produce minutes. |
| **FR-43** | The system MUST capture the customer's signature, name and rating at completion, produce a visit report through a print template, and send it to the site contact when the organization chooses. |
| **FR-44** | The system MUST, on completion, mark each line chargeable or covered from the unit's coverage and the contract terms, and draft an invoice for the chargeable parts (price list), labour (tracked time at billing rate) and travel. |
| **FR-45** | The system MUST propose a follow-up visit when a purpose is not done or the visit ended with no access, linked to the first. |
| **FR-46** | The system MUST accept visit requests from other features (helpdesk tickets, fixed-asset maintenance occurrences, delivery installations) through one request, keeping the requesting record linked and telling it when the visit is scheduled and completed. |
| **FR-47** | A user with `FIELD_SERVICE_VISITS_EDIT` can reserve shared equipment (tools) for a visit's window through the existing equipment sharing request, shown on the visit with a link to the equipment pages. |

### 3.6 Technicians, dispatch and calendar

| ID | Requirement |
| --- | --- |
| **FR-48** | A user with `FIELD_SERVICE_SETTINGS_EDIT` can make an employee a technician: skills (from the platform skills), teams serving as service areas, home base, van stock location, working hours (from availability or shifts), maximum visits per day. |
| **FR-49** | A user with `FIELD_SERVICE_DISPATCH` can use a dispatch board: technicians by day or week with their visits, time off and travel, filtered by service area, an unassigned queue sorted by priority and response due, and a map of the day's visits. |
| **FR-50** | The system MUST check an assignment and warn on: missing skills, time off or holiday, overlap, outside working hours, outside the technician's service areas, parts kit not available in the van or the nearest warehouse, and response target at risk; overlap with another visit is refused unless overbooking is allowed. |
| **FR-51** | The system MUST put each scheduled visit on the technician's calendar as a private event (through calendars when on, otherwise as an appointment in the existing schedules), update it on change and remove it on cancellation. |
| **FR-52** | The system MUST show a technician's calendar of their visits with day, week and agenda views (the calendar feature's own views with a visits layer when it is on, the board's technician view otherwise), and push changes to it and to the board in real time. |
| **FR-53** | The system MUST tell the customer contact by email or text when a visit is scheduled, moved, the technician is on the way (with estimated arrival when position is shared) and when it is completed, per the organization's settings. |
| **FR-54** | The system MUST provide the installable mobile job screen and its endpoints: my visits for a day, visit detail with unit history, state changes, checklist, readings, parts, photos, signature and notes, with offline changes applied in order and once through the platform's offline sync, conflicts going to the dispatcher. |
| **FR-55** | A user with `FIELD_SERVICE_SETTINGS_EDIT` can set the response targets, booking rules, notification texts and the lead times per organization. |

### 3.7 Predictive maintenance *(advanced)*

| ID | Requirement |
| --- | --- |
| **FR-56** | The system MUST forecast, for each meter with a meter-based plan line, the date the next threshold is reached from the reading trend (at least three readings), with a confidence range. *(advanced)* |
| **FR-57** | The system MUST propose a visit ahead of the forecast date by the plan's lead time and move a proposed visit when new readings move the forecast by more than two days. *(advanced)* |
| **FR-58** | The system MUST flag readings that depart from a unit's own pattern (sudden jump, flat line, gauge outside limits) and offer a breakdown visit. *(advanced)* |

### 3.8 Route-optimised dispatch *(advanced)*

| ID | Requirement |
| --- | --- |
| **FR-59** | A user with `FIELD_SERVICE_DISPATCH` can request a proposal for a day and service area: an assignment and order of visits per technician that respects windows, skills, working hours, time off, parts availability and priorities, and minimises travel time, computed by the platform's one route planner that delivery trips also use. *(advanced)* |
| **FR-60** | The system MUST show a proposal with travel time, idle time and the visits it could not place with the reason, apply it only on acceptance, and keep visits a person fixed by hand where they are. *(advanced)* |
| **FR-61** | The system MUST re-propose the rest of a technician's day when a visit runs over or a breakdown with a response target arrives, for the dispatcher to accept. *(advanced)* |

### 3.9 Customer self-booking *(advanced)*

| ID | Requirement |
| --- | --- |
| **FR-62** | The system MUST offer a customer, through the customer portal or a signed link per visit, the open slots of qualified technicians for a visit kind and site within the next N days (default 21), computed by the calendar's booking engine for the visit kind's appointment type and filtered by skills, service area and parts; self-booking needs the calendar feature. *(advanced)* |
| **FR-63** | The system MUST book, move or cancel a visit from a chosen slot under the appointment type's rules (minimum notice, days ahead, move and cancel cut-off), assign the technician whose slot it was, and confirm to both. *(advanced)* |
| **FR-64** | The system MUST let a customer request a breakdown visit for one of their units from the portal, creating a claim or visit request with coverage shown. *(advanced)* |

### 3.10 Assistant, agents and analytics

| ID | Requirement |
| --- | --- |
| **FR-65** | The system MUST brief a technician before a visit with the unit's history, open claims, last readings, previous findings and probable parts by fault (from the item's spare parts), using the platform's AI agents when configured (runs and usage recorded there) and a plain summary otherwise. *(advanced)* |
| **FR-66** | The system MUST draft the visit report and work records from the technician's notes and photos for the technician to edit and confirm. *(advanced)* |
| **FR-67** | The system MUST compute first-time fix per visit (resolved without another visit for the same unit and fault within N days, default 30) and report it per technician, item, fault code and period. *(advanced)* |
| **FR-68** | The system MUST offer MCP tools to search the installed base, read coverage, create claims and visits, propose and apply dispatch, record readings and complete visits, with `preview: true` by default for dispatch, completion and invoicing; tools act with the caller's permissions and are marked as agent actions. |

### 3.11 Events, integration and compatibility

| ID | Requirement |
| --- | --- |
| **FR-69** | The system MUST publish events (unit created, contract activated, ending and expired, claim opened and resolved, visit scheduled, dispatched, started, completed, no access, reading anomaly, forecast due) for automation rules, webhooks and real-time updates. |
| **FR-70** | The system MUST let a helpdesk ticket create a claim or a visit for a unit of its customer and show their state on the ticket. |
| **FR-71** | The system MUST ship the roles "Field service technician" and "Field service manager" as role bundle templates with this feature's permissions, which a tenant installs on demand. |
| **FR-72** | The system MUST import installed base, contracts and plans through the mapped import with errors per row. |
| **FR-73** | The system MUST, with the feature off, load no route, menu entry, job or consumer, and leave equipment, equipment sharing, appointments, deliveries and serial units as today. |
| **FR-74** | The system MUST work on PostgreSQL, MySQL and SQLite with both ORMs, multi-tenant and self-hosted. |

### 3.12 Reports and dashboard

All reports are report definitions: filterable, groupable, exportable, schedulable and clonable.

| Requirement | Report | Answers | Filters and grouping |
| --- | --- | --- | --- |
| **FR-75** | Maintenance schedules | Which visits are planned when, for which customer, site, unit and sales order, with which technician? | dates, customer, site, item, technician, plan, contract |
| **FR-76** | Visits | Which visits were done, late, partly done or without access, how long, by whom? | dates, state, kind, technician, team, customer, service area |
| **FR-77** | Warranty claims | Which claims by item, fault and coverage, how long to resolve, at what cost? | dates, item, fault code, coverage, status |
| **FR-78** | Contracts and renewals | Which contracts run, end or renew, with visits used and response targets met? | dates, customer, status, renewal |
| **FR-79** | Parts used | Which parts went where, covered or charged? | dates, item, technician, location, customer |
| **FR-80** | Service profitability | What did each contract, customer and unit bring in and cost (parts, tracked labour, travel)? | dates, contract, customer, item |
| **FR-81** | First-time fix | How often was the problem solved at the first visit? *(advanced)* | period, technician, item, fault code |

| ID | Requirement |
| --- | --- |
| **FR-82** | The system MUST provide a field-service dashboard with cards (visits today, unassigned, late, response targets at risk, open claims, contracts ending in 30 days) and charts (visits per week by state, claims by fault, first-time fix trend). |

## 4. Non-Functional Requirements

- **Performance**: dispatch board for 50 technicians and 500 visits a week loads under 800 ms at the 95th percentile;
  assignment checks under 150 ms; plan generation of 1,000 visits under 3 s; a dispatch proposal for 20 technicians and
  150 visits within 20 s; coverage lookup under 50 ms; installed-base list under 300 ms with 1 million units.
- **Data volume and concurrency**: 1 million units, 10 million visits and 100 million meter readings per tenant;
  versions on visits and assignments (`409`); offline batches applied in client order and deduplicated.
- **Reliability**: visit completion, stock issues and the claim update in one transaction with the outbox append;
  calendar, notification and invoice drafting asynchronous and retried; offline changes kept on the device 7 days.
- **Security & privacy**: technician positions stored only during a visit and only with consent, kept 30 days; the
  customer sees only their own units, visits and slots; device endpoints use per-unit keys; data leaving the platform
  (customer emails and texts, visit reports) is listed in settings.
- **Observability and audit**: who, when, before and after on contracts, plans, assignments, state changes,
  completions and coverage edits; timeline per unit.
- **Accessibility and localisation**: keyboard-operable board with a list alternative to drag and drop; labelled map
  with a table alternative; strings in every locale; dates, times and units in the user's format and time zone.
- **Compatibility**: PostgreSQL, MySQL and SQLite; both ORMs; additive OpenAPI and SDK changes.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| `InstalledUnit` | A customer's machine or component at a site, with serial, dates, coverage and history |
| `ServiceSite` | A customer location where units are installed and visits happen |
| `UnitMeter`, `MeterReading` | A counter or gauge on a unit; one reading of it |
| `ServiceContract` (+ covered unit, period) | Terms under which units are serviced, billed and renewed |
| `MaintenancePlan` (+ line, planned visit) | Recurring service of units and the visits it plans |
| `WarrantyClaim` | A customer complaint about a unit, with coverage fixed on its date |
| `ServiceVisit` (+ purpose, checklist result, part used, labour) | A dispatched job at a site and what was done |
| `ChecklistTemplate` | Steps and readings a visit must go through |
| `TechnicianProfile` | An employee's skills, regions, van stock and limits for dispatch |
| `DispatchProposal` | A suggested assignment and order of visits for a day |
| `BookingSlot` | An offered window a customer can book |
| `UnitEvent` | One entry of a unit's timeline |

## 6. Out of Scope

- Maintenance, repair and calibration of the organization's own assets: `fixed-assets` (its occurrences may request a
  visit through FR-46); equipment and equipment lending: existing features, kept.
- Tickets, their channels and service levels: `helpdesk-tickets`, `helpdesk-sla-routing-and-analytics`.
- The installable floor app that hosts the mobile job screen and the platform's offline sync:
  `warehouse-and-stock-movements`.
- Calendars, events, appointment types, open slots and booking pages: `calendar-and-scheduling`; serial units, warranty
  dates, the warranty status job and traces: `serials-and-batches`; installations at delivery and the shared route
  planner: `delivery-and-shipping`.
- Stock movements and van locations: `warehouse-and-stock-movements`; invoices: `invoicing-receivables-payables`;
  contract billing runs: `subscription-billing`; approvals: `approval-workflows`; portal sign-in:
  `customer-and-supplier-portal`; replacement and refund claims on orders: the returns feature; AI agents and their
  usage: `ai-agents-and-assistants`; inspections with acceptance rules: `quality-management`.
- Shift rosters and attendance of technicians: `attendance-and-shifts`. The labour attribution rule:
  `shop-floor-and-work-orders`.

## 7. Acceptance Criteria

- [ ] **AC-1** A completed delivery installation creates one installed unit per serial; coverage on a date reads warranty, contract, both or none correctly (FR-2, FR-4, FR-5, FR-30).
- [ ] **AC-2** Contract activation shows the contract end on the covered serial units, refuses overlapping coverage, proposes a plan, bills on schedule and renews per rule (FR-4, FR-11, FR-14).
- [ ] **AC-3** Plan generation aligns to the calendar, avoids holidays and time off, refuses impossible counts, regenerates only untouched future visits, and fills from a sales order (FR-21, FR-23, FR-24).
- [ ] **AC-4** A claim fixes coverage on its date, cannot be cancelled with an open visit, and is resolved or set in progress by its visit and reverted on reopen (FR-29–FR-31).
- [ ] **AC-5** A visit runs its checklist, issues parts from the van, collects tracked time as labour, captures signature, sends its report and drafts an invoice only for chargeable lines (FR-41, FR-44).
- [ ] **AC-6** The board warns on skills, time off, overlap, parts and response risk; calendar events follow the visit; offline completion applies in order (FR-50, FR-54).
- [ ] **AC-7** Meter forecasts propose and move visits; anomalies offer a breakdown visit (advanced, predictive) (FR-56–FR-58).
- [ ] **AC-8** A dispatch proposal respects windows, skills and parts, keeps fixed visits, and applies only on acceptance (advanced, routing) (FR-59, FR-60).
- [ ] **AC-9** A customer books, moves and cancels from offered slots within the rules (advanced, booking) (FR-62, FR-63).
- [ ] **AC-10** First-time fix and the technician brief and report draft work on seeded data (advanced, analytics and assistant) (FR-65–FR-67, FR-81).
- [ ] **AC-11** The seven reports of §3.12 and the dashboard return figures that agree with seeded visits, claims and contracts.
- [ ] **AC-12** Permission denial `403`, flag off `404` with equipment and appointments unchanged, concurrent assignment `409` (FR-73).
- [ ] **AC-13** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-73).
- [ ] Works on PostgreSQL, MySQL and SQLite with both ORMs.
- [ ] Behind `FEATURE_FIELD_SERVICE`; nothing changes while the flag is off.
- [ ] All functional requirements have a passing test.

## 8. Open Questions

- Installed units are customer-owned (applied); organization-owned equipment placed at a customer stays an asset in
  `fixed-assets` and is visited through FR-46.
- Without calendars, visits appear as appointments in the existing schedules (applied).
- Contract billing goes through subscriptions when that feature is on, otherwise recurring invoices (applied).
- Technician positions are shared only on the way and on site, with consent (applied).
- The route proposal uses road travel times from a travel-time provider of the shared route planner and straight-line
  estimates without one (applied).
- Service areas are teams of technicians (applied); the platform's sales regions are not used for dispatch.

## 9. Constitution Gates

- [x] I Plugin-first — new plugin `field-service` with `field-service-ui`; serial units, deliveries, stock, invoices, calendars, tickets and assets reached through ports.
- [x] II Tenant/organization scoping — every record tenant and organization scoped; customers see only their own data.
- [x] III Both ORMs, additive migrations — new tables only, three dialects.
- [x] IV Default-off flag; nothing removed — `FEATURE_FIELD_SERVICE`; equipment, sharing and appointments untouched.
- [x] V Contracts and API first; backwards compatible — REST and contracts before UI; the mobile job screen uses the same API.
- [x] VI Permissions, privacy, security — separate keys for editing, dispatch, approval; position consent; device keys.
- [x] VII Real-time through the event bus — board, calendars and customer notices driven by outbox events.
- [x] VIII i18n and accessibility — strings in every locale; board and map with list and table alternatives.
- [x] IX Tests accompany the change — recurrence, coverage, generation, assignment checks, proposals, offline merge.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Related features: [`../serials-and-batches/spec.md`](../serials-and-batches/spec.md),
  [`../delivery-and-shipping/spec.md`](../delivery-and-shipping/spec.md), [`../fixed-assets/spec.md`](../fixed-assets/spec.md),
  [`../helpdesk-tickets/spec.md`](../helpdesk-tickets/spec.md), [`../warehouse-and-stock-movements/spec.md`](../warehouse-and-stock-movements/spec.md),
  [`../subscription-billing/spec.md`](../subscription-billing/spec.md),
  [`../calendar-and-scheduling/spec.md`](../calendar-and-scheduling/spec.md),
  [`../shop-floor-and-work-orders/spec.md`](../shop-floor-and-work-orders/spec.md)
- Existing code: `packages/core/src/lib/equipment`, `equipment-sharing`, `employee-appointment`, `availability-slots`,
  `skills`, `official-holiday`, `time-tracking`, `address`, `address-role`, `event-types`, `organization-team`;
  `packages/plugins/returns`; `packages/plugins/public-layout-ui` (public booking pages)
