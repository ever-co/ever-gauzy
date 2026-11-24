# Feature Specification: Quality management

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `quality-management`
**Branch**: `feat/quality-management`
**Status**: `Draft`
**Created**: 2026-11-16
**Last updated**: 2026-11-23
**Owner**: platform maintainers
**Feature flag**: `FEATURE_QUALITY` (default off)

---

## 1. Overview

Nothing checks quality today: a goods receipt, a transfer and a return can record a damaged quantity, and warehouses
have quarantine and damage zones, but there is no inspection, no readings, no accept or reject decision, no
certificate and no improvement loop. This feature adds **inspections** of items at the points where goods enter, move,
are made and leave (goods receipts, stock movement documents, subcontract receipts, work-order output and operation
cards, deliveries, sales returns), built from **inspection templates** of **parameters** with **acceptance rules**,
and **enforces** them on those documents through the checks of the business document engine and the quality ports
the sibling plugins already reserve: a document is refused, warned, or its stock held until the inspection is decided,
and rejected quantities go to a non-sellable location. Decisions set lot status and feed supplier scorecards. Around
inspections sits the improvement loop, built on the platform's goals, documents and meetings: **retained samples**,
**quality objectives** kept as goals with KPI-backed key results and scheduled **reviews** recorded as key-result
updates, **procedures** kept as versioned documents in a tree, **non-conformances**, **corrective and preventive
actions**, **quality circles** held as meetings and **customer and supplier feedback**, with a quality home page and
reports. Surfaces: the Gauzy app, the inspector module of the installable floor app, the REST API and SDKs, MCP tools
for agents; the shop-floor operator console calls the same endpoints.

**Advanced capabilities.** **Statistical process control** charts every numeric parameter per item, operation, work
centre and supplier and raises an out-of-control alert, with a draft non-conformance, as soon as a run rule breaks.
A **supplier quality score** (acceptance rate, defects per million, open non-conformances, action response time) is
published as measures that procurement scorecards weigh. **Acceptance sampling plans** size samples by lot size and
switch between normal, tightened and reduced inspection from each supplier's history. **Photo inspection** lets the
inspector attach pictures to readings and get defect hints through the platform's AI agents and the tenant's AI
provider, never decided without a person. The **cost of poor quality** adds tracked time spent on rework, sorting and investigation to corrective
operation cost, scrap and returns, with no re-entry. A **quality assistant** finds similar past non-conformances and
probable causes, drafts containment and actions, and agents run inspections through MCP tools with previews.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** the item "Bracket M8" requires incoming inspection with template "Bracket v3" (length 80 ± 0.2 mm, five readings; finish "no burrs"), **when** a goods receipt of 500 units from lot L-12 is confirmed, **then** the units are received into inspection hold, a draft inspection appears linked to the receipt line with the sample size from the plan, and the receipt shows "awaiting inspection".
- **Given** that inspection, **when** the inspector enters five lengths (79.9, 80.1, 80.0, 80.3, 80.0), **then** the fourth reading is marked out of range, the parameter fails, the proposed decision is "reject", and confirming it moves 500 units to the rejected location, sets lot L-12 to quarantined, and drafts a non-conformance against the supplier.
- **Given** a partial decision (480 accepted, 20 rejected), **when** confirmed, **then** 480 units become available, 20 go to the rejected location, the lot stays available for the accepted part, and the supplier's acceptance rate updates within a minute.
- **Given** an item requiring outgoing inspection, **when** a user confirms its delivery without an accepted inspection, **then** shipping is refused naming the line and the missing inspection; after acceptance the delivery ships.
- **Given** an operation of a work order requiring in-process inspection, **when** the operator records readings on the operator console and the inspection is accepted, **then** the operation card can complete; with a rejection the card completion is refused and a corrective card is proposed.
- **Given** an item set to retain samples (2 units, kept 24 months) and a warehouse with a retained-sample location, **when** a lot is received, **then** two units move to the sample location as retained samples of that lot, listed with their keep-until date.
- **Given** the quality objective "Incoming acceptance ≥ 98 % monthly on day 1" (a goal whose key result is backed by the acceptance-rate KPI), **when** the first of the month passes, **then** one review is recorded as the key result's update for the month with the actual value filled from inspections, marked failed (off track) at 96.4 %, and an action is drafted.
- **Given** a non-conformance from a customer complaint about lot L-31, **when** the quality manager adds a corrective improvement action with two corrective steps and both are completed, **then** the action moves to effectiveness check on its date, and closing it closes the non-conformance.
- **Given** 25 subgroups of five bore diameters at work centre "Lathe 2", **when** seven points in a row fall above the centre line, **then** the chart flags the run, the quality manager receives an alert and a draft non-conformance, and the operator console shows a warning on that operation.
- **Given** a supplier with three rejected lots in a row, **when** the next receipt arrives, **then** sampling switches to tightened (larger sample) and the inspection says why; five accepted lots later it returns to normal.
- **Given** an inspector who photographs a casting, **when** they ask for hints, **then** the AI suggests "porosity, probable" on the parameter "surface" with the area marked; the parameter stays undecided until the inspector accepts or overrides the hint.
- **Given** an agent with inspection permissions, **when** it calls `quality_inspection_decide` with readings, **then** it receives the proposed decision and the stock effects as a preview; nothing changes until it repeats the call without preview.

### 2.2 Edge cases & failures

- **Given** a user without `QUALITY_INSPECTIONS_DECIDE`, **when** they decide an inspection, **then** `403`; with the feature off every quality route answers `404`, documents confirm as today and no hold is applied.
- **Given** a sample size of zero or larger than the quantity under inspection, **then** saving is refused naming the limit.
- **Given** a reading entered as `80,1` by a user whose number format uses a comma, **then** it is read as 80.1.
- **Given** a formula rule that divides by a zero mean, **then** the parameter is marked "cannot evaluate" and the inspection cannot be decided until the reading changes or a person overrides with a reason.
- **Given** two inspectors deciding the same inspection, **then** the second is refused with `409` and the decision is recorded once.
- **Given** an accepted inspection used by a confirmed delivery, **when** someone cancels the inspection, **then** it is refused naming the delivery; after the delivery is cancelled it can be cancelled.
- **Given** an enforcement rule set to warn, **when** a receipt line is confirmed with a rejected inspection, **then** it confirms with a warning recorded on the line and in the inspection's history.
- **Given** an inspection created for an item that does not require one at that point, **then** it is refused unless the organization allows ad-hoc inspections.
- **Given** a procedure moved under its own descendant, or a child that already has a parent, **then** the move is refused.
- **Given** a quality objective reviewed on day 31, **when** the month has 30 days, **then** the review is created on the 30th, once.
- **Given** an inspector's device that recorded readings offline, **when** it reconnects after another inspector decided the inspection, **then** the readings are kept as a later set, the decision is unchanged, and the inspector is told.
- **Given** an inspection whose rejected quantity cannot move because the warehouse has no rejected (quarantine) location, **then** the decision is refused naming the warehouse, and nothing moves.
- **Given** a receipt line of 500 with 10 recorded as damaged on arrival, **when** its inspection is created, **then** it covers the 490 received into hold, and the line shows the 10 damaged beside the inspection's rejected quantity.

## 3. Functional Requirements

### 3.1 Parameters, templates and sampling

| ID | Requirement |
| --- | --- |
| **FR-1** | A user with `QUALITY_SETUP_EDIT` can maintain parameter groups and parameters: code, name, group, description, kind (number with unit, text, choice from a list, yes or no, visual check), and archive them; a parameter used by a template cannot be deleted. |
| **FR-2** | A user with `QUALITY_SETUP_EDIT` can maintain inspection templates: name, inspection points it suits, and lines of parameter, number of readings (1–50), acceptance rule, critical or major or minor, and instructions with images. |
| **FR-3** | The system MUST support acceptance rules: a numeric range (minimum, maximum or both), a target with tolerance, equality with a text or one of the allowed choices, a formula over the readings and their mean, minimum, maximum and standard deviation, and a manual judgement. |
| **FR-4** | The system MUST evaluate formulas in a safe expression evaluator (numbers, reading names, arithmetic, comparisons, and, or, not, a fixed set of functions) and refuse a template whose formula does not parse or names an unknown reading. |
| **FR-5** | The system MUST version templates: editing a template used by an inspection creates a new version; inspections keep the version they started with. |
| **FR-6** | A user with `QUALITY_SETUP_EDIT` can maintain sampling plans: a fixed sample, a percentage with minimum and maximum, the whole quantity, or a table of sample size and accept and reject numbers by lot size and inspection level. |
| **FR-7** | The system MUST switch an acceptance-sampling plan between normal, tightened and reduced inspection per item and supplier from the results of recent lots, by rules set on the plan, and show the current level and why on each new inspection. *(advanced)* |

### 3.2 Item quality profiles and enforcement rules

| ID | Requirement |
| --- | --- |
| **FR-8** | A user with `QUALITY_SETUP_EDIT` can give an item (or variant, or item group as default) a quality profile per organization: which inspection points require inspection (incoming receipt, subcontract receipt, stock movement, in-process, before delivery, sales return), the default template and sampling plan per point, and whether samples are retained. |
| **FR-9** | The system MUST let a bill of materials or one of its operations require in-process inspection with a template (as the manufacturing structure declares) and read that requirement when the work order runs. |
| **FR-10** | A user with `QUALITY_SETUP_EDIT` can set enforcement per organization and inspection point, optionally narrowed by item group, supplier or customer: when the inspection is missing or undecided, refuse the document, warn, or confirm with the stock held; when it is rejected, refuse, warn, or move the rejected quantity to the rejected location. |
| **FR-11** | The system MUST apply the defaults: incoming and subcontract receipts hold and move rejected quantities; stock movements and in-process refuse when missing and move rejected quantities; deliveries refuse in both cases; sales returns hold and move. |
| **FR-12** | The system MUST refuse an inspection for an item and point that require none, unless the organization allows ad-hoc inspections (default off). |
| **FR-13** | The system MUST use as a warehouse's inspection-hold, rejected and retained-sample stock locations its non-sellable child locations marked for that purpose in the location tree (inspection hold, quarantine, retained sample), shown read-only on the quality setup; the system MUST refuse a rule that holds or moves stock while the warehouse has no such location. |

### 3.3 Inspections

| ID | Requirement |
| --- | --- |
| **FR-14** | A user with `QUALITY_INSPECTIONS_EDIT` can record an inspection of one item: kind (incoming, in-process, outgoing, return, ad hoc), source document and line, quantity under inspection, lots or serial units, sample size, template version, inspector, optional verifier and remarks. |
| **FR-15** | The system MUST number inspections from the numbering series of their document type and follow the document lifecycle: draft, in progress, decided (accepted, rejected, partially accepted), cancelled. |
| **FR-16** | The system MUST refuse a sample size of zero or above the quantity under inspection, and take the default sample size from the sampling plan of the profile. |
| **FR-17** | The system MUST load the template's parameters into readings when a template is chosen, using the item's default for the point when none is chosen. |
| **FR-18** | The system MUST read numeric readings in the user's number format, evaluate each parameter's rule as readings arrive, and mark each parameter passed, failed or cannot evaluate. |
| **FR-19** | A user with `QUALITY_OVERRIDE` can override a parameter's result with a reason, shown on the inspection and in reports. |
| **FR-20** | The system MUST propose a decision: reject when a critical parameter fails or a rule fails; accept when every parameter passes; with an acceptance-sampling plan, decide by the accept and reject numbers of the sample's defects. |
| **FR-21** | A user with `QUALITY_INSPECTIONS_DECIDE` can decide an inspection (accept, reject, or accept a quantity and reject the rest) only when every parameter has a result; the decision records who, when and the stock effects shown in its preview. |
| **FR-22** | The system MUST, on a decision, release held stock to available and move rejected quantities to the rejected location through stock movements, all or nothing with the decision, and have the lot feature set each inspected lot available or quarantined from the decision within seconds. |
| **FR-23** | A user with `QUALITY_INSPECTIONS_DECIDE` can require verification by a second person for chosen templates; the decision then takes effect only when the verifier confirms it, and the verifier cannot be the inspector. |
| **FR-24** | The system MUST refuse to cancel a decided inspection while a confirmed document relies on it, naming the documents; cancelling a decided inspection reverses its stock and lot effects. |
| **FR-25** | The system MUST attach to an inspection files, photos per reading and a printable inspection certificate through a print template. |
| **FR-26** | The system MUST keep each set of readings entered offline (applied once through the platform's offline sync) or by another inspector as a separate set with its author and time, and never change a decision because a later set arrives. |

### 3.4 Creating inspections and enforcement on documents

| ID | Requirement |
| --- | --- |
| **FR-27** | The system MUST, when a goods receipt, subcontract receipt, stock movement document, delivery or sales return with lines requiring inspection is saved or confirmed (per point setting), create one draft inspection per line and lot, linked to the line, with the sample size and first lots or serial units; the quantity under inspection excludes what the owner records as damaged on arrival, which stays the owner's figure and is shown beside the inspection's rejected quantity, never copied into it. |
| **FR-28** | A user with `QUALITY_INSPECTIONS_EDIT` can create the inspections of a document's flagged lines from the document page in one action. |
| **FR-29** | The system MUST check, when a goods receipt, subcontract receipt, stock movement document or delivery is confirmed, every line requiring inspection against the enforcement rule and refuse or warn with a finding naming the line and the state of its inspection (missing, undecided, rejected). |
| **FR-30** | The system MUST, under a hold rule, let the document confirm with the line's stock in inspection hold (never available, picked or reserved) until the decision releases or rejects it. |
| **FR-31** | The system MUST check, when an operation card or work-order output completes, the in-process inspection of that operation or output and refuse completion saying whether it is missing, unfinished or rejected; a rejection proposes a corrective card. |
| **FR-32** | The system MUST show the inspection state on each document line (not required, awaiting, accepted, rejected, partially accepted) with a link to the inspection. |
| **FR-33** | The system MUST exempt secondary outputs and scrap of production from in-process enforcement unless their profile requires it. |
| **FR-34** | The system MUST create a return inspection when a sales return is received for an item whose profile requires it, and let its decision choose the restock location (sellable, quarantine, scrap) the return's reason allows. |

### 3.5 Retained samples

| ID | Requirement |
| --- | --- |
| **FR-35** | The system MUST, for a lot-tracked item set to retain samples, move the profile's sample quantity of each received or produced lot to the retained-sample location through a stock movement, and register a retained sample with lot, quantity, location and keep-until date. |
| **FR-36** | The system MUST refuse sample retention on an item that is not lot-tracked, and on an item with expiry dates whose shelf life is not set. |
| **FR-37** | A user with `QUALITY_INSPECTIONS_EDIT` can draw from a retained sample for a test (linked to an inspection), and dispose of it at or after its keep-until date; the system MUST remind the quality team 30 days before. |
| **FR-38** | The system MUST list retained samples by item, lot, location and keep-until date, and show them on the lot's trace. |

### 3.6 Quality objectives, reviews and procedures

| ID | Requirement |
| --- | --- |
| **FR-39** | A user with `QUALITY_OBJECTIVES_EDIT` can define a quality objective as a goal of the goals feature marked for quality: name, linked procedure, review rhythm (on demand, every N days, weeks on a weekday, months on a day, or a yearly date; quarterly is every 3 months), and targets as key results backed by KPIs, each with a description, target value, comparison, unit and optional measure. |
| **FR-40** | The system MUST record one review per quality objective and due date in a daily pass, on the last day of the month when the chosen day does not exist, never twice. |
| **FR-41** | The system MUST record a review as one update per key result for the period, fill each target that has a measure from its measured value for the period (also kept as the KPI's current value), and let reviewers mark each passed (on track) or failed (off track) with a note. |
| **FR-42** | The system MUST keep a review open while a target's update is undecided, mark it failed when any target failed and passed otherwise, and offer to draft an improvement action for each failed target. |
| **FR-43** | The system MUST offer measures for targets: acceptance rate, rejected quantity, defects per million, open non-conformances, overdue actions, average days to close, cost of poor quality, by organization, item group, supplier and work centre. |
| **FR-44** | A user with `QUALITY_PROCEDURES_EDIT` can maintain procedures as documents of the documents feature in a "Quality procedures" category, in a tree, with owner, purpose, steps (text, or a link to a child procedure) and linked records; a child has one parent, a move under a descendant is refused, and deleting a procedure removes it from its parent's steps. |
| **FR-45** | The system MUST version procedures with the documents feature's versions and locking, send a new version through an approval when the organization requires it, and keep earlier versions readable. |

### 3.7 Non-conformances, improvement actions, quality circles and feedback

| ID | Requirement |
| --- | --- |
| **FR-46** | A user with `QUALITY_NONCONFORMANCE_EDIT` can record a non-conformance: subject, source (inspection, customer complaint, supplier, internal audit, process), procedure, item, lots or serial units, supplier or customer, quantity affected, severity, description, containment, root cause and disposition (use as is, rework, sort, scrap, return to supplier). |
| **FR-47** | The system MUST number non-conformances and move them through open, investigating, actions pending, closed and cancelled, refusing to close while a linked action is open. |
| **FR-48** | The system MUST draft a non-conformance on a rejected inspection when the organization chooses so (default on for incoming), and let one be raised from a ticket, an order claim or a return in one action. |
| **FR-49** | A user with `QUALITY_ACTIONS_EDIT` can record a corrective or preventive improvement action linked to any of a quality objective, review, procedure, non-conformance, inspection, quality circle or feedback, with corrective steps (cause, step, owner, due date, status). |
| **FR-50** | The system MUST keep an action open until every corrective step is completed or dropped with a reason, then await its effectiveness check on its date, and close it when the check passes or reopen it when it fails. |
| **FR-51** | The system MUST put each corrective step in its owner's inbox, remind them before and after its due date through the platform reminders, and, when the organization chooses, create a task in a chosen project so time can be tracked on it. |
| **FR-52** | A user with `QUALITY_CIRCLES_EDIT` can hold a quality circle as an appointment marked as a quality circle, with attendees and agenda; with meetings on, its agenda items and minutes are the meeting's, and the reviews, improvement actions, non-conformances and feedback it discussed are linked to that meeting; a quality circle is open or closed, and the appointment is on attendees' calendars. |
| **FR-53** | A user with `QUALITY_FEEDBACK_EDIT` can define feedback templates of parameters and record feedback on a customer or supplier, scoring each parameter from 1 to 5 with a comment; feedback on an employee is recorded in performance management. |
| **FR-54** | The system MUST copy a template's parameters into the feedback, refuse a score outside 1–5, and offer an action when any score is at or below the template's threshold. |

### 3.8 Statistical process control *(advanced)*

| ID | Requirement |
| --- | --- |
| **FR-55** | The system MUST chart each numeric parameter per item and point, optionally per operation, work centre or supplier: mean and range charts for subgroups, individual and moving-range charts for single readings, and proportion-defective charts for decided inspections. *(advanced)* |
| **FR-56** | The system MUST compute control limits from a baseline period the user chooses (default the first 25 subgroups) and keep them until recalculated, and show capability indices against the specification limits. *(advanced)* |
| **FR-57** | The system MUST evaluate run rules (a point beyond a limit, runs on one side of the centre line, trends, points near a limit) as readings arrive and raise an out-of-control alert to the item's quality owner with the chart and points. *(advanced)* |
| **FR-58** | The system MUST draft a non-conformance from an out-of-control alert when the chart is set to do so, and show a warning on the operator console for the operation concerned. *(advanced)* |

### 3.9 Supplier quality *(advanced)*

| ID | Requirement |
| --- | --- |
| **FR-59** | The system MUST compute per supplier and period: inspected and accepted lots and quantities, acceptance rate, defects per million, non-conformances by severity, average days to answer and close supplier actions. *(advanced)* |
| **FR-60** | The system MUST publish these measures to supplier scorecards of procurement within 60 seconds of each decision, non-conformance or action change. *(advanced)* |
| **FR-61** | The system MUST let a non-conformance against a supplier be sent to the supplier (email or portal) with a request for an answer by a date, and record the answer on it. *(advanced)* |

### 3.10 Photo inspection, assistant and agents

| ID | Requirement |
| --- | --- |
| **FR-62** | The system MUST let an inspector request defect hints for photos of a visual parameter through the platform's AI agents and the tenant's AI provider, and show each hint with label, confidence and marked area; a hint never sets a result by itself. *(advanced)* |
| **FR-63** | The system MUST record, per hint, the model, the inspector's acceptance or override, and report hint agreement per parameter. *(advanced)* |
| **FR-64** | The system MUST offer a quality assistant that, for a non-conformance, lists similar past non-conformances and their causes and actions, and drafts containment, root cause and corrective steps for a person to edit and confirm. *(advanced)* |
| **FR-65** | The system MUST offer MCP tools to search and read inspections, templates, lots under hold, non-conformances, actions and charts; to create inspections, enter readings and decide with `preview: true` by default; and to draft non-conformances and actions; tools act with the caller's permissions and are marked as agent actions. |

### 3.11 Cost of poor quality

| ID | Requirement |
| --- | --- |
| **FR-66** | The system MUST compute cost of poor quality per period, item, work order, operation, work centre, supplier and lot from: corrective operation cards' cost and time, scrap value, rejected stock value, returns accepted for quality reasons and supplier credits. |
| **FR-67** | The system MUST add the tracked time logged on tasks of improvement actions and non-conformances, valued at the employees' cost rates, as investigation and rework cost. *(advanced)* |

### 3.12 Quality home, events and compatibility

| ID | Requirement |
| --- | --- |
| **FR-68** | The system MUST offer a quality home page with: inspections awaiting decision and stock on hold, open non-conformances by severity, open and overdue actions, reviews due, retained samples ending, out-of-control charts, and links to setup and reports. |
| **FR-69** | The system MUST publish quality events (inspection created, decided, cancelled; non-conformance opened and closed; action overdue and closed; review due and decided; chart out of control) for automation rules, webhooks and real-time updates of open pages. |
| **FR-70** | The system MUST give inspectors an inspector module in the installable floor app (phone or handheld): scan a lot or document label, enter readings, take photos, decide. |
| **FR-71** | The system MUST import parameters, templates, profiles and historical inspections through the mapped import with errors per row. |
| **FR-72** | The system MUST, with the feature off, load no route, menu entry, job, check or panel on another feature's page (receipts, stock documents, deliveries, returns, items, lots, goals, documents, appointments), and leave every document's confirmation as without quality. |
| **FR-73** | The system MUST work on PostgreSQL, MySQL and SQLite with both ORMs, multi-tenant and self-hosted. |

### 3.13 Reports and dashboards

All reports are report definitions: filterable, groupable, exportable, schedulable and clonable.

| Requirement | Report | Answers | Filters and grouping |
| --- | --- | --- | --- |
| **FR-74** | Inspection summary | Which inspections were decided how, for which items, points, sources and inspectors, with sample sizes? Chart of accepted and rejected. | dates, state, decision, item, kind, source type, inspector, supplier; by item or week |
| **FR-75** | Actions from reviews | Which actions came from which reviews and where do their corrective steps stand? | dates, quality objective, review, status, owner |
| **FR-76** | Cost of poor quality | What did corrective work, scrap, rejection and returns cost, and how much time went into it? | dates, item, work order, operation, work centre, lot or serial, supplier |
| **FR-77** | Non-conformance ageing | Which non-conformances are open, how old, by severity and source? | dates, status, severity, source, item, supplier, owner |
| **FR-78** | Supplier quality | How does each supplier's acceptance rate and defects per million develop? | period, supplier, item group |
| **FR-79** | Retained samples | Which samples are kept where until when? | item, lot, location, keep-until |
| **FR-80** | Control charts | Which charts are in or out of control, with capability? | item, parameter, work centre, supplier, period |

| ID | Requirement |
| --- | --- |
| **FR-81** | The system MUST provide a quality dashboard with cards (open non-conformances, open actions, open reviews, inspections this month, acceptance rate, stock on hold) and charts (inspections by decision per week, rejection by item and by supplier, cost of poor quality per month). |

## 4. Non-Functional Requirements

- **Performance**: inspection list under 300 ms at the 95th percentile with 2 million inspections per organization;
  rule evaluation of a 50-parameter inspection under 50 ms; decision with stock effects under 500 ms excluding
  asynchronous events; a document's quality check adds under 30 ms per inspected line; control limits for a parameter
  with 100,000 readings within 2 s; supplier measures updated within 60 s.
- **Data volume and concurrency**: 50 million readings per tenant; optimistic versions on inspections (`409`); one
  decision per inspection; reading sets merged by author and time.
- **Reliability**: decisions and their stock and lot effects in one transaction with the outbox append; consumers
  idempotent per event; offline reading sets survive app restarts for 7 days.
- **Security & privacy**: feedback is visible only to holders of `QUALITY_FEEDBACK_EDIT`; photos stored through the
  platform file service; photos sent to the AI provider only when the tenant configured one and the inspector asks;
  supplier messages are listed before sending.
- **Observability and audit**: who, when, before and after for every reading, override, decision, cancellation and
  setup change; hint records with model and outcome.
- **Accessibility and localization**: keyboard entry of readings in a grid, labelled charts with table alternatives,
  large targets in the floor app's inspector module; all strings in every shipped locale; numbers and units in the
  user's format.
- **Compatibility**: PostgreSQL, MySQL and SQLite; both ORMs; additive OpenAPI and SDK changes.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| `QualityParameterGroup`, `QualityParameter` | A named measurable or checkable property and its grouping |
| `InspectionTemplate` (+ version, line) | A versioned list of parameters with acceptance rules |
| `SamplingPlan` (+ level state) | How many units to check and the accept and reject numbers; the current level per item and supplier |
| `ItemQualityProfile` | Where an item must be inspected, with which template and plan, and whether samples are kept |
| `QualityEnforcementRule` | What happens to a document when its inspection is missing, undecided or rejected |
| Quality locations | A warehouse's non-sellable child locations for inspection hold, rejects (quarantine) and retained samples |
| `Inspection` | A numbered check of one item for one source line, with its decision |
| `InspectionReadingSet`, `InspectionReading` | One person's readings at one time; one parameter's values and result |
| `InspectionHint` | An AI suggestion on a photo and what the inspector did with it |
| `RetainedSample` | Units of a lot kept for later testing, until a date |
| Quality objective, review | A goal marked for quality, its KPI-backed key results (targets) and review rhythm; a review is one period's key-result updates |
| Quality procedure | A document of the "Quality procedures" category, in a tree, with its versions |
| `NonConformance` | A recorded deviation with containment, cause and disposition |
| `ImprovementAction` (+ corrective step) | A corrective or preventive action and its tasks |
| Quality circle | An appointment (and its meeting) of the quality team marked as a quality circle |
| `QualityFeedbackTemplate`, `QualityFeedback` | Scored parameters on a customer or supplier |
| `ControlChart` (+ limits, alert) | Statistical control of one parameter in one context |
| `SupplierQualityMeasure` | A supplier's quality figures per period |

## 6. Out of Scope

- Stock movements, locations and availability themselves: `warehouse-and-stock-movements`; lot and serial masters,
  statuses and traces: `serials-and-batches` (this spec sets status through them).
- Receipts, supplier master and scorecard engine: `procurement`; deliveries and returns: `delivery-and-shipping`;
  operation cards, corrective cards and the operator console: `shop-floor-and-work-orders`; bill-of-materials
  inspection requirement: `manufacturing-bom-and-routing`; subcontract receipts: `subcontracting`.
- Item kinds and the item master: `item-catalogue` (the quality profile is kept here).
- Lifecycle, numbering and checks: `business-document-engine`; approvals of procedures: `approval-workflows`;
  certificate layouts: `print-and-pdf-designer`; calendars: `calendar-and-scheduling`; agendas and minutes: `meetings`;
  procedure documents: `documents-and-wiki`; goals, KPIs and key results: the existing goals feature; feedback on
  employees: `performance-management`; reminders: `automation-and-notifications`; AI agents and their runs:
  `ai-agents-and-assistants`.
- Value of rejected and scrapped stock: `stock-ledger-and-valuation`; credits from suppliers:
  `invoicing-receivables-payables`.
- Measuring tools are the existing equipment records; their calibration: `fixed-assets`; the floor app, offline sync
  and non-sellable locations: `warehouse-and-stock-movements`.

## 7. Acceptance Criteria

- [ ] **AC-1** Each rule kind of FR-3 accepts and rejects its golden readings; a bad formula is refused at save; number formats are honoured.
- [ ] **AC-2** A receipt of an item requiring inspection holds its stock; accept, reject and partial decisions release and move stock in one transaction and set lot status; cancel reverses them and is refused while a confirmed document relies on the inspection (FR-22, FR-29, FR-32).
- [ ] **AC-3** Enforcement refuses, warns and holds as configured on receipts, stock documents, subcontract receipts and deliveries; operation-card completion is refused for missing, unfinished and rejected inspections (FR-29–FR-31).
- [ ] **AC-4** Retained samples move to the sample location on receipt and production, are refused for untracked items, and remind before their date (FR-35–FR-38).
- [ ] **AC-5** Reviews are created on schedule once per quality objective and date (month-end clamp), filled from measures, and decide passed or failed; failed targets draft improvement actions (FR-40–FR-42).
- [ ] **AC-6** A non-conformance from a rejected inspection, a ticket and a return; improvement actions with corrective steps, inbox items and effectiveness check close it; quality circles and feedback record and trigger actions (FR-48–FR-51).
- [ ] **AC-7** A seeded run of readings breaks a run rule, raises an alert, drafts a non-conformance and warns the console (advanced, process control) (FR-56–FR-58).
- [ ] **AC-8** Supplier measures reach the procurement scorecard within 60 s; sampling switches to tightened and back by its rules (advanced, supplier quality) (FR-7, FR-60).
- [ ] **AC-9** Photo hints are shown and never decide; agreement is reported (advanced, photo inspection) (FR-62, FR-63).
- [ ] **AC-10** Cost of poor quality includes corrective card cost, scrap, rejection, returns and tracked time on action tasks (advanced, cost) (FR-66, FR-67, FR-76).
- [ ] **AC-11** The seven reports of §3.13 and the dashboard return figures that agree with seeded inspections, non-conformances and actions.
- [ ] **AC-12** Permission denial `403`, flag off `404` with documents unchanged, concurrent decision `409` (FR-72).
- [ ] **AC-13** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-72).
- [ ] Works on PostgreSQL, MySQL and SQLite with both ORMs.
- [ ] Behind `FEATURE_QUALITY`; nothing changes while the flag is off.
- [ ] All functional requirements have a passing test.

## 8. Open Questions

- Incoming receipts hold stock and accept the inspection afterwards by default (applied); organizations that refuse
  receipts without inspection switch the rule to refuse.
- Rejected inspections draft a non-conformance for incoming goods by default (applied); off for other points.
- The quality profile lives in this feature, not as item columns (applied), so the item master is unchanged.
- One decision appends `quality.inspection.decided`; consumers that subscribe to `quality.inspection.completed`
  receive the same payload under that name (applied).
- Feedback on employees belongs to performance management; quality records customer and supplier feedback (applied).
- A customer non-conformance starts from the return's reason or the order claim it is raised from (applied).

## 9. Constitution Gates

- [x] I Plugin-first — new plugin `quality` with `quality-ui`; enforcement through the document engine's checks and the quality ports sibling plugins reserve.
- [x] II Tenant/organization scoping — every record tenant and organization scoped; parameters and templates shareable in a tenant with an allow-list.
- [x] III Both ORMs, additive migrations — new tables only, three dialects.
- [x] IV Default-off flag; nothing removed — `FEATURE_QUALITY`; damaged quantities and quarantine zones keep working.
- [x] V Contracts and API first; backwards compatible — REST and contracts before UI; additive only.
- [x] VI Permissions, privacy, security — separate keys for setup, recording, deciding and override; feedback privacy; consented AI use.
- [x] VII Real-time through the event bus — decisions and alerts through the outbox and the platform channel.
- [x] VIII i18n and accessibility — strings in every locale; keyboard reading grid; chart tables.
- [x] IX Tests accompany the change — rule evaluation, sampling, enforcement matrix, stock effects, scheduling, charts.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Related features: [`../warehouse-and-stock-movements/spec.md`](../warehouse-and-stock-movements/spec.md),
  [`../procurement/spec.md`](../procurement/spec.md), [`../delivery-and-shipping/spec.md`](../delivery-and-shipping/spec.md),
  [`../shop-floor-and-work-orders/spec.md`](../shop-floor-and-work-orders/spec.md),
  [`../manufacturing-bom-and-routing/spec.md`](../manufacturing-bom-and-routing/spec.md),
  [`../subcontracting/spec.md`](../subcontracting/spec.md), [`../serials-and-batches/spec.md`](../serials-and-batches/spec.md),
  [`../business-document-engine/spec.md`](../business-document-engine/spec.md), [`../item-catalogue/spec.md`](../item-catalogue/spec.md),
  [`../documents-and-wiki/spec.md`](../documents-and-wiki/spec.md), [`../meetings/spec.md`](../meetings/spec.md),
  [`../performance-management/spec.md`](../performance-management/spec.md)
- Existing code: `packages/plugins/purchasing/src/lib/goods-receipt-line` (`damagedQuantity`),
  `packages/plugins/inventory/src/lib/stock-transfer-line`, `packages/plugins/returns/src/lib/order-return-line`,
  `packages/plugins/warehouse/src/lib/warehouse.types.ts` (quarantine and damage zones), `packages/core/src/lib/goal`,
  `goal-kpi`, `keyresult`, `keyresult-update`, `packages/plugins/docs`, `packages/core/src/lib/employee-appointment`
