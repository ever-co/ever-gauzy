# Feature Specification: Business document engine

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `business-document-engine`
**Branch**: `feat/business-document-engine`
**Status**: `Draft`
**Created**: 2026-11-16
**Last updated**: 2026-11-23
**Owner**: platform maintainers
**Feature flag**: `FEATURE_BUSINESS_DOCUMENTS` (default off; with it off every document-owning feature keeps its own
numbering and status as today)

---

## 1. Overview

Quotations, orders, deliveries, receipts, invoices, bills, payments, stock movement documents, journals, work orders,
payslips and expense claims are all **business documents**: numbered records that move from draft to confirmed and
point at each other. Today each feature numbers and links its documents on its own (orders, purchase orders and
returns through the core numbering service, invoices through their own number field), only orders keep changes after
placement, and only recurring invoices for billable time repeat. This feature is the one engine every
document-owning feature uses instead: a feature **registers a document type** and gets numbering series with tokens
and an optional gap-free mode, one lifecycle (draft, confirmed, cancelled, amended, closed) under its own statuses,
**change sets** and **amendments** for confirmed documents, typed **links** between documents and lines with ordered,
delivered, received, billed and returned quantities rolled up to the source, over- and under-fulfilment
**tolerances**, **line close**, the stages of the **totals pipeline**, **recurrence**, **bulk creation** with a result
log, a **dependent-draft lookup**, return rules, and an **effects preview** gathered from the ledger, stock, tax and
commitment engines. Each confirmation, cancellation, amendment and close publishes `document.<type>.<verb>` through
the event outbox, which the posting engines consume. Clients: the Angular app (shared document panels and the
numbering, tolerance, recurrence and bulk pages), the MCP server, the API and SDKs.

**Advanced capabilities.** Every document shows its **document flow as a live graph**: each linked document
with number, state and progress, updated as soon as a delivery ships or a bill is confirmed. A series can be
**gap-free**, with numbers allocated inside the confirming transaction and an audit that accounts for every number,
including voided ones with their reason. Before anything is confirmed, cancelled or changed, a person or an **AI agent
through MCP tools** sees the **effects preview** (journals, stock movements, tax entries, commitments) and an agent
can only confirm what it previewed. Change sets carry a **reason, an approval step and a readable diff** of fields,
lines, totals and effects. Recurrence knows **skip, pause and catch-up** rules. Bulk operations are **resumable jobs**
with live progress, automatic retries and a downloadable result log. These requirements are marked
`(advanced)`.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** an administrator with `SEQUENCES_EDIT`, **when** they give customer invoices the pattern `INV-{ORG}-{FISCAL_YEAR}-{#####}` in gap-free mode and preview it, **then** they see the next three numbers for today and for the first day of the next fiscal year; **when** the first invoice of the new fiscal year is confirmed, **then** it gets `INV-ACME-2027-00001`.
- **Given** a draft invoice, **when** the user opens **Preview effects**, **then** they see the journal it would post, the stock it would move, its tax entries and the commitment it releases, each with warnings; nothing is written and the number is not taken.
- **Given** a confirmed sales order of 100 units with a 5 % over-delivery tolerance, **when** deliveries of 60 and 45 units are confirmed, **then** the order line shows 105 delivered (105 %), the order is fully delivered, and a third delivery of 1 unit is refused with "1 unit exceeds the tolerance of 5 units"; a user with `BUSINESS_DOCUMENTS_TOLERANCE_OVERRIDE` may confirm it with a reason, which is recorded.
- **Given** an order line with 30 units left that the customer no longer wants, **when** a user closes the line with a reason, **then** it stops counting as pending, and when every other line is complete the order becomes closed and `document.sales_order.closed` is published; the line can be reopened while the order is not archived.
- **Given** a confirmed purchase order, **when** a buyer proposes a change set "line 2: 40 → 50 units, price 9.80 → 9.50, reason: supplier offer", **then** the change set shows a readable diff with the totals and effects difference, waits for approval above the organization's threshold, and once approved is applied as version 2 with `document.purchase_order.amended`.
- **Given** a confirmed order that must be replaced, **when** the user amends it, **then** a new draft `SO-00042-1` holds the same lines (closed lines reopened); confirming it marks `SO-00042` amended, moves its links to the new version and publishes one `amended` event naming both.
- **Given** a confirmed maintenance invoice, **when** a user sets it to recur monthly on the last day for 12 months, skipping December and creating drafts, **then** the next five dates with their service periods are listed before saving, and each month a draft linked to its origin appears with the service period shifted by one month.
- **Given** 400 confirmed orders selected in the orders list, **when** a user runs "Create invoices" in bulk, **then** a run starts in the background with live progress; orders on hold, closed or with nothing to bill are skipped with the reason; the result log lists each order and the invoice created, and can be downloaded.
- **Given** any confirmed document, **when** a user opens its **Flow** tab, **then** the graph shows every linked document they may read (quotation, order, deliveries, invoices, payments, returns) with number, state, amount and progress, and a count of the ones they may not read.
- **Given** an AI agent with the order permissions, **when** it calls the confirm tool without a preview, **then** it receives the effects and a preview token instead; **when** it calls again with that token and the document has not changed, **then** the order is confirmed and the history marks the agent.

### 2.2 Edge cases & failures

- **Given** two users confirming the same draft, **then** one succeeds and the other receives `409` naming the version it read.
- **Given** two deliveries confirmed at the same time against the last 10 units of an order line, **then** they are checked one after the other and the second is refused naming the quantity left.
- **Given** a gap-free series and a confirmation that fails after the number was allocated (a closed period, a tax error), **then** the number returns to the series and the next confirmation takes it; the audit shows no gap.
- **Given** a numbered draft (a quotation numbered at creation) in a gap-free series, **when** it is deleted, **then** its number is recorded as voided with the user and reason, and the audit lists it.
- **Given** a confirmed order with a confirmed delivery, **when** a user cancels the order, **then** the cancel is refused and the delivery is listed; draft invoices pointing at it are listed with "unlink" and "delete" actions.
- **Given** a change set that lowers a line below what was already delivered or billed, **then** it is refused naming the documents; **given** a second change set while one is open, **then** it is refused.
- **Given** a source document on hold, closed or cancelled, **when** a user creates a document from it, **then** it is refused with the reason.
- **Given** a recurrence whose author lost the right to create invoices, **when** its date comes, **then** nothing is created, the recurrence pauses with that reason and its owner and the organization's administrators get an inbox item.
- **Given** the platform was down for three days and a daily recurrence uses "latest only" catch-up, **then** one document is created for the last date and the two other dates are recorded as caught up without a document.
- **Given** a bulk run interrupted by a restart after 230 of 400 items, **then** it resumes at item 231 and no source is processed twice; three failed items are retried automatically up to three times, then left for a manual retry.
- **Given** a requester who may not read 5 of the selected sources, **then** those 5 are skipped as "not permitted".
- **Given** a document type whose owning feature has been switched off, **then** its documents still appear in other documents' flow with number and state, marked "not available", and nothing can be created from them.
- **Given** the feature off, **then** no engine route answers (`404`), no event is published, and every owner numbers and changes its documents as before.

## 3. Functional Requirements

### 3.1 Registration, scope and compatibility

- **FR-1** The system lets a feature register a document type with: its key, owning feature, label, the permissions that read, create, confirm, cancel, amend and close it, its numbering defaults, the states it adds on top of the shared lifecycle, the source types it can be created from (with link kind and roll-up), the fields a change set may touch, whether it recurs, its bulk conversions, its totals stages and its effect areas.
- **FR-2** The system refuses at start-up a registration that is incomplete, reuses a key, or names an unknown link kind or roll-up, so a wrong declaration fails the deployment and never a user's request.
- **FR-3** The system keeps one index entry per document of a registered type (number, state, owner status, version, party, dates, currency, totals, lines with quantities) so that links, roll-ups, flow, lookups and reports never read another feature's records.
- **FR-4** The system, on first enablement for a tenant, indexes the existing documents of every registered type with their links and already delivered, received, billed and returned quantities taken from their owners, and reports the count per type; existing numbers are kept unchanged.
- **FR-5** The system changes nothing for a tenant while `FEATURE_BUSINESS_DOCUMENTS` is off: owners keep numbering through the core numbering service or their own fields and keep their statuses, and the engine's routes answer `404`.
- **FR-6** The system checks every action on a document against the permission the registration declares for it and against the document's organization; an action on another organization's or tenant's document answers `404`.
- **FR-7** The system keeps every existing number, status, route and contract of the owners (order changes, order to invoice links, invoice numbers, recurring invoices for billable time) working unchanged when the feature is on.
- **FR-8** The system exposes the registered types with their states, links, change-set fields and effect areas through the API, so clients build forms and flows without knowing the owners.

### 3.2 Lifecycle

- **FR-9** The system gives every registered document the shared lifecycle draft → confirmed → cancelled, with amended (replaced by a newer version) and closed (remaining work stopped) as further terminal states of a confirmed document, and shows the owner's status next to it.
- **FR-10** The system confirms a document all or nothing in the owner's transaction: version check, owner checks, registered checks, numbering, link and tolerance checks, roll-ups, frozen totals, history entry and the outbox event; any blocking finding leaves the draft unchanged and lists every finding.
- **FR-11** The system refuses any change to a confirmed document outside a change set, an amendment, a line close or the owner's declared free fields, and answers `409` with code `DOCUMENT_CONFIRMED`; for types whose owner already enforces this (orders, purchase orders) the owner's rule decides and the engine reports it under that code; for the other document types that exist today (invoices, estimates) the owner's current rule decides until the organization turns this lock on (FR-113).
- **FR-12** The system requires every write through the engine's routes to state the version it read and refuses a stale write with `409`; the owners' existing routes keep their contracts and check a version only when the client sends one (FR-113).
- **FR-13** A user with the type's cancel permission can cancel a confirmed document with a reason, unless confirmed documents created from it exist; the refusal lists them, draft dependents are offered for unlinking or deletion, and a user holding the cancel permission of every dependent can instead cancel the whole chain (up to 100 documents) in dependency order, all or nothing, after a preview of the chain; for document types that exist today the dependents refusal applies only when the organization turns it on (FR-113).
- **FR-14** The system releases the roll-ups a cancelled document gave to its sources and reopens the source lines it had completed, in the same transaction.
- **FR-15** The system lets a registered check (regional rules, ledger lock, budget, approval) block a confirmation, cancellation, change set or deletion with a coded reason, and lets it add warnings that do not block.
- **FR-16** The system records each lifecycle action with actor (person, agent or system), time, version, reason and the change set or amendment it came from in the record's activity history, and shows it as the document's history together with the owner's own history where the owner keeps one.
- **FR-17** The system refuses to delete a confirmed, cancelled or amended document; drafts may be deleted by users with the type's create permission; documents of types that exist today stay deletable as today until the organization turns this refusal on (FR-113).
- **FR-18** The system lets a registration hold a confirmed document "on hold" with a reason; a document on hold can be neither the source of new documents nor recurred until released.

### 3.3 Numbering series

- **FR-19** A user with the platform's numbering permission `SEQUENCES_EDIT` can define on the one numbering screen (which also lists every other numbering series of the organization), per organization and document type, one or more numbering series with a pattern, a default series, an optional selector (channel, register, branch, or conditions on the document's field values), a priority order, an on/off switch and validity dates; the highest-priority active series whose selector matches numbers the document, and a type can instead require the user to pick the series on each document.
- **FR-20** The system supports these pattern tokens: fixed text, `{#…}` counter with its padding, `{YYYY}`, `{YY}`, `{MM}`, `{DD}`, `{DAY_OF_YEAR}`, `{WEEK}` (week of year), `{FISCAL_YEAR}` (fiscal year label), `{FISCAL_START}` (year the fiscal year starts in) and `{ORG}` (organization short code).
- **FR-21** The system keeps one counter per resolved prefix, so a pattern with a year or month token restarts with each year or month without a reset setting; the existing reset policies of the core numbering service keep working.
- **FR-22** The system resolves date tokens from the document date by default, or from the confirmation time when the series says so, and the fiscal year from the organization's fiscal calendar (else its fiscal start date).
- **FR-23** The system refuses to save a pattern with `{ORG}` for an organization without a short code, and a pattern without a counter.
- **FR-24** The system numbers at confirmation by default; a type may number at creation (quotations), in which case a deleted numbered draft voids its number; a document type that exists today keeps the numbering moment it has today.
- **FR-25** The system lets a series be gap-free: numbers are taken inside the confirming transaction, a failed confirmation gives its number back, and explicit numbers are refused. `(advanced)`
- **FR-26** The system lets a gap-free series be chronological: a document dated earlier than the last numbered document of the series is refused, naming that document. `(advanced)`
- **FR-27** The system records every number a series hands out (document, date, user) and every voided number with reason and user, and offers a number audit per series and period: first, last, used, voided, gaps and date-order breaks; a gap in a gap-free series raises an inbox item to the series' administrators. `(advanced)`
- **FR-28** A user with `BUSINESS_DOCUMENTS_NUMBER_VOID` can void a reserved, unused number with a reason; a used number can never be voided or reused.
- **FR-29** The system lets a type be named by series, by a field of the record (a code the user types, unique per organization) or by prompt at creation, so master records (items, lots, serial units, parties) can use the same series and rules.
- **FR-30** A user with `BUSINESS_DOCUMENTS_NUMBER_OVERRIDE` can give an explicit number on create or import in a series that is not gap-free; the system refuses a duplicate and moves the counter past it when it falls ahead. Where an owner lets users type a number today (invoice and estimate numbers), anyone who may create the document keeps doing so without this permission unless the organization turns the requirement on (FR-113).
- **FR-31** The system previews the next numbers of a series for a given date without consuming them and shows the current counter of each prefix the series has used; a user with `SEQUENCES_EDIT` can move the counter of a series that is not gap-free forward to a value above the highest number used with that prefix, the same action the numbering screen offers for every other series.
- **FR-32** The system names an amendment after its original with a suffix (`-1`, `-2`, …) unless the series asks for a fresh number.

### 3.4 Links, roll-ups and returns

- **FR-33** The system records every "create from" as a typed link from source document and line to target document and line, with quantity, unit and amount, and keeps it pending while the target is a draft.
- **FR-34** The system supports the link kinds quotes, fulfils, receives, bills, returns, requests, calls off, pays, copies, recurs, amends and counterpart, each declaring which quantity of the source it rolls up.
- **FR-35** The system rolls up, when a target is confirmed, the ordered, requested, delivered, received, billed, returned, picked, packed, installed and paid quantities and amounts onto the source lines, and reverses them when the target is cancelled.
- **FR-36** The system computes per source document a percentage for each rolled-up quantity (by quantity, or by amount where the line has no quantity), sets it to exactly 100 % when the remainder is below the smallest unit, and hands the result to the owner to set its own status.
- **FR-37** The system refuses a link from a source line that is closed, on hold or cancelled, from a draft source, and across organizations except through a counterpart link; between document types that exist today, links the owners allow today stay allowed until the organization turns these refusals on (FR-113).
- **FR-38** The system carries roll-ups through chains (a credit note's return rolls back to the invoice and to the order line the invoice billed), so every level shows the same returned quantity.
- **FR-39** The system validates a return against its original: same party, organization and currency, the original's rate, each returned item present on the original line, quantity at most what was delivered or received less what was already returned, unit price at most the original's, return date not before the original's.
- **FR-40** The system refuses a return of more than is returnable with "cannot return more than N of item X", lets a type allow returns without an original, and asks the lot and serial feature to confirm returned lots and serial units come from the original; returns of document types that exist today keep their owner's current rules, and the checks of FR-39 and this requirement are added to them only when the organization turns them on (FR-113).
- **FR-41** The system creates nothing it was not asked to: a target created from several sources records one link per source line and refuses sources whose party, currency or organization differ unless the type allows merging them; merges the owners of existing types allow today stay allowed (FR-113).
- **FR-42** The system creates, when a document of a type with a declared counterpart is confirmed for a party that represents another organization of the tenant, the counterpart draft (or confirmed document, per the relationship's policy) in that organization through its owner, once, linked both ways. `(advanced)`
- **FR-43** The system keeps counterpart documents in step: cancelling one cancels the other's draft and asks for the cancellation of a confirmed one through an inbox item to its organization. `(advanced)`
- **FR-44** The system answers for any line or document the open quantity per roll-up (for example "delivered, not billed") for to-be-billed lists and reports.

### 3.5 Tolerances and line close

- **FR-45** A user with `BUSINESS_DOCUMENTS_TOLERANCE_EDIT` can set over- and under-fulfilment tolerances per roll-up (delivery, receipt, billing, request to order, call-off, picking), as a percentage, a quantity or both, for the organization, an item group, an item or a party.
- **FR-46** The system applies the most specific tolerance (the allowance stated for one delivery, the party's terms for the item, item, item group, party, organization, the document's own allowance, platform default) and treats a difference below 0.01 % of the line as zero. The platform default is zero for document types new features introduce and no limit for the roll-ups of document types that exist today (sales order delivery and billing among them), so a flow allowed today is never refused until an organization saves a tolerance.
- **FR-47** The system refuses a confirmation that would exceed the over-tolerance of a source line, naming line, quantity allowed and excess; a user with `BUSINESS_DOCUMENTS_TOLERANCE_OVERRIDE` can confirm with a reason, which the history and the flow show.
- **FR-48** The system lets a roll-up be declared exempt from tolerance (picking against reservations).
- **FR-49** The system completes a source line automatically when its remaining quantity falls within its under-tolerance, and records it as completed within tolerance.
- **FR-50** The system reads the receipt allowances purchasing already keeps as levels of the receipt tolerance: the allowance stated for a delivery, the supplier's term for the item, the purchase order's own allowance, and the over-receipt setting as the organization's receipt tolerance until one is saved; a receipt has one tolerance answer whether or not the feature is on.
- **FR-51** A user with `BUSINESS_DOCUMENTS_LINE_CLOSE` can close one or several lines of a confirmed document with a reason; a fully completed line cannot be closed, and the owner may refuse (for example a line with reserved stock).
- **FR-52** The system closes the document when every line is closed or complete and publishes `document.<type>.closed`; reopening a line reopens the document and publishes `document.<type>.reopened`.
- **FR-53** The system allows reopening a line only while the document is closed or confirmed, not cancelled, amended or archived by its owner.
- **FR-54** The system reopens closed lines on an amendment's copy, so an amended document starts with every line open.

### 3.6 Totals pipeline

- **FR-55** The system computes totals on the server in fixed stages: lines (quantity, unit, unit price), pricing (prices, line discounts and promotions), document discount, taxes, charges, rounding and totals; clients never supply a total.
- **FR-56** The system lets each stage be answered by the feature that owns it (pricing, tax, shipping charges, and the owning feature's existing totals calculation for the lines and document discount of orders, carts and invoices) and lets a type switch stages off (a journal has no pricing); an unavailable stage leaves the owner's values unchanged.
- **FR-57** The system distributes a document discount, on the net or on the grand total, to the lines in proportion to their net, the last line taking the remainder so the parts add up exactly.
- **FR-58** The system rounds every amount with the currency's precision, applies the organization's cash rounding as a separate rounding adjustment (unless the organization disables rounded totals) and never loses a smallest unit.
- **FR-59** The system freezes on confirmation the totals of each stage in the document and organization currency with the rate used, the amount in words, total net weight, tax breakdown and advances deducted, and recalculates a draft whenever a line, party, date or configuration it depends on changes.
- **FR-60** The system answers a totals preview for an unsaved draft within 500 ms (P95) for 200 lines, used by every form while the user types.
- **FR-61** The system marks drafts whose totals are out of date after a configuration change (a rate, a price list) and recalculates them in the background, never a confirmed document; drafts of document types that exist today are only marked, and recalculated when the user opens and saves them or the organization turns background recalculation on (FR-113).

### 3.7 Change sets and amendments

- **FR-62** A user with the type's amend permission or `BUSINESS_DOCUMENTS_CHANGE_REQUEST` can propose a change set on a confirmed document: the changed fields and lines, and a required reason.
- **FR-63** The system allows only the fields the type declares for change sets, and only one open change set per document.
- **FR-64** The system re-validates a change set as a confirmation would (owner checks, totals, tax, tolerances, registered checks) and refuses one that lowers a line below its rolled-up quantities.
- **FR-65** The system shows a readable diff of every change set: fields with old and new values, lines added, removed and changed, totals difference and effects difference (journal correction, stock and tax change). `(advanced)`
- **FR-66** The system sends a change set for approval when the organization's policy for the type, set by a user with `BUSINESS_DOCUMENTS_POLICY_EDIT`, asks for it (always, above an amount or percentage change, or never); without the approval feature, a user with `BUSINESS_DOCUMENTS_CHANGE_APPROVE` approves it; with the approval feature on, its approval rules alone decide for the type and this policy is not applied. `(advanced)`
- **FR-67** The system applies an approved change set atomically as the document's next version, publishes `document.<type>.amended` with the previous version and the changed fields, and keeps the change set as history.
- **FR-68** The system lets a change set be withdrawn by its author or rejected with a reason, and expires one left open longer than the organization's limit (default 7 days; for orders, the order's own change expiry).
- **FR-69** The system applies notes, tags and other fields a type declares free at once, recorded in the history, with no new version.
- **FR-70** A user with the type's amend permission can amend a confirmed or cancelled document of an amendable type: a linked draft copy is created; a confirmed original stays confirmed until the copy is confirmed, a cancelled one stays cancelled.
- **FR-71** The system, when an amendment is confirmed, marks the original amended, moves its links and roll-ups to the matching lines of the new version, refuses the amendment when confirmed dependents exceed the new quantities, and publishes one `document.<type>.amended` naming both.
- **FR-72** The system uses, for an owner that keeps its own change mechanism (order changes), that mechanism as the type's change sets: proposing, approving, rejecting and applying a change set on an order creates and drives an order change, so an order never has two open change records, and each order change shows in the history with the same diff view.

### 3.8 Dependent drafts and document checks

- **FR-73** The system lists, for any document, the drafts that link to it or name it in a declared reference field, with their owner, date and a link to open them.
- **FR-74** The system shows the dependent drafts before a cancellation, change set or amendment of the source and offers to unlink or delete them in one action, with a result per draft.
- **FR-75** The system provides the ledger's period close with the check "no draft document of a posting type dated in the period", listing them.
- **FR-76** The system checks a document created from another: party, organization and currency equal to the source's unless the type allows otherwise, unit price within the price tolerance of the source (warn or refuse, per organization and type policy), document date not before the source's, quantities in whole numbers for whole-number units; between document types that exist today these checks only warn until the organization makes them refuse (FR-113).
- **FR-77** The system copies, when a document is created from another, the terms, notes, references and attachments the type declares, and records which were copied.

### 3.9 Effects preview

- **FR-78** The system returns, for any draft or confirmed document and any proposed action (confirm, cancel, amend, change set), the effects each registered area would write: ledger journals, stock movements and value, tax entries, open items and commitments, each with its warnings and blocking findings. `(advanced)`
- **FR-79** The system writes nothing during a preview: no number, no roll-up, no event, no history entry.
- **FR-80** The system answers a preview within 300 ms (P95) for 200 lines and shows an area that did not answer in time as "not available" without blocking.
- **FR-81** The system offers the preview as a panel on every document form, through the API and through MCP tools, to anyone who may read the document. `(advanced)`
- **FR-82** The system confirms an agent's request only with a preview token for the document's current content taken within the last 10 minutes; any change in between invalidates the token. `(advanced)`

### 3.10 Recurrence

- **FR-83** A user with `BUSINESS_DOCUMENTS_RECURRENCE_MANAGE` and the type's create permission can set a confirmed document (or a draft kept as template) of a recurring type to repeat daily, weekly, monthly, quarterly, half-yearly or yearly, with an interval, a day (including last day of month), a start, and an end date or count.
- **FR-84** The system creates each occurrence as a draft, a confirmed document, or a confirmed document sent to the party, per the recurrence, linked to its origin, with the dates and the service period fields the type declares shifted by the elapsed periods.
- **FR-85** The system creates each occurrence once per recurrence and date, however often the schedule runs, and previews the next occurrences with their dates and periods.
- **FR-86** The system lets a recurrence skip given dates, skip dates that fall on the organization's holidays or weekends (or move them to the next working day), and skip an occurrence when a condition holds (party on hold, a field value). `(advanced)`
- **FR-87** A user can pause a recurrence until a date or indefinitely with a reason and resume it; paused dates are recorded as skipped. `(advanced)`
- **FR-88** The system applies a catch-up policy for dates missed while the platform was down or the recurrence was paused and then resumed: create all, create only the latest, or none, each missed date recorded. `(advanced)`
- **FR-89** The system runs a recurrence with the permissions of its owner; when the owner can no longer create the type, the recurrence pauses with that reason and the owner and administrators get an inbox item.
- **FR-90** The system keeps the run history of each recurrence (date, outcome, document, reason) and notifies the people the recurrence names when an occurrence is created or fails.
- **FR-91** The system ends a recurrence after its end date or count, and when its origin is cancelled.
- **FR-92** The system keeps the existing recurring invoices for billable time on their own schedules and runs, computes their periods and document recurrences with one shared set of recurrence rules, and lists them next to document recurrences.

### 3.11 Bulk creation

- **FR-93** A user with `BUSINESS_DOCUMENTS_BULK_RUN` and the target type's create permission can select confirmed source documents in a list (by selection or by a saved filter) and start a bulk run that creates the next documents of a registered conversion (for example quotation to order, order to delivery, order to invoice, invoice to payment), as drafts or confirmed, one per source or grouped by party and currency.
- **FR-94** The system runs a bulk run in the background, checks the requester's permission on each source, and skips drafts, cancelled, closed and on-hold sources and those with nothing remaining, each with its reason.
- **FR-95** The system records per item the outcome (created with the new document, skipped with reason, failed with error and attempt count) and the run's counts, and lets the result log be filtered and downloaded as CSV.
- **FR-96** The system resumes an interrupted run where it stopped and never processes a source twice. `(advanced)`
- **FR-97** The system retries failed items automatically up to three times with growing delay, then lets the requester retry the failed items on demand. `(advanced)`
- **FR-98** The system pushes the progress of a run (done, skipped, failed, remaining) to open clients and posts an inbox item to the requester when it ends. `(advanced)`
- **FR-99** The requester or an administrator can cancel a running bulk run; items already created stay, the rest are marked not processed.
- **FR-100** The system limits a run to 10,000 sources and one running run per requester and conversion, and refuses a duplicate start with the same idempotency key.

### 3.12 Document flow, lookups and trends

- **FR-101** The system shows on every registered document its document flow: a graph of linked documents in both directions with type, number, state, date, amount and progress, the quantities on each link, and a count of linked documents the user may not read. `(advanced)`
- **FR-102** The system updates an open flow within two seconds of a linked document changing state. `(advanced)`
- **FR-103** The system offers the flow as a keyboard-navigable list with the same content, and opens a document from either view.
- **FR-104** The system offers record lookups for document fields that apply the document's context: organization allow-lists, party restrictions, enabled and active records, and the source document's open lines.
- **FR-105** The system provides trend reports for every registered type: quantity and amount per period (month, quarter, half-year, year) based on item, item group, party, party group, territory or project, with an optional second grouping, a totals row and a chart, by document date or by the date of the first billing.
- **FR-106** The system provides the trend reports, the number audit, the tolerance overrides, the closed lines, the change sets and the bulk run results as report definitions listed in the platform's Reports menu of tenants with the feature on (with it off the Reports page and menu show exactly today's reports).

### 3.13 Events, agents and real time

- **FR-107** The system publishes through the event outbox, in the transaction of the action, `document.<type>.confirmed`, `.cancelled`, `.amended`, `.closed` and `.reopened`, each carrying the document's reference, number, version, organization, dates, party, currency, totals, links and the facts its owner adds for the posting engines, in document order per document chain.
- **FR-108** The system ships MCP tools to list types and series, read a document with its flow, preview effects, confirm and cancel with a preview, propose and apply change sets, list dependent drafts, manage recurrences and start and follow bulk runs, all with the caller's permissions. `(advanced)`
- **FR-109** The system marks every action taken by an agent in the history and the activity log.
- **FR-110** The system pushes document state, flow and progress changes to open clients through the platform's real-time channel and never asks a client to poll.

### 3.14 Background actions

- **FR-111** The system lets a registration run confirmation or cancellation in the background for heavy documents (always, or above a declared number of lines): the request returns at once with a queued action, the document refuses other changes until the action ends, and the requester is notified of the outcome.
- **FR-112** The system keeps each background action as a platform background operation with its state (queued, running, done, failed with the error), shows it on the document and in the organization's list of background operations, retries nothing on its own after a functional refusal, and allows one background action per document at a time.

### 3.15 Document types that exist today

- **FR-113** The system adds, for the document types that exist before this feature (orders, purchase orders, returns, invoices, estimates, payments, expenses and every other type whose owner already ships), only the index, links, roll-ups, flow, history, preview, events, recurrence and bulk runs when the feature is turned on: their documents stay editable, deletable, cancellable, numbered at the same moment (typed numbers included), linkable, returnable, billable and deliverable exactly as today. Each rule the engine adds beyond the owner's own (the lock of FR-11, the dependents refusal of FR-13, the deletion refusal of FR-17, the explicit-number permission of FR-30, the refusals of FR-37 and FR-39 to FR-41, the tolerance default of FR-46, background recalculation of FR-61, the refusing checks of FR-76) is a per-type organization policy, off by default, that a user with `BUSINESS_DOCUMENTS_POLICY_EDIT` turns on; the owners' existing routes keep their request and response contracts.

## 4. Non-Functional Requirements

- **Performance**: confirmation overhead of the engine (numbering, links, tolerances, roll-ups, index, event) under 150 ms P95 for 200 lines, excluding owner and registered checks; total confirmation within the platform budget of 500 ms; number allocation under 20 ms P95; gap-free series serialise per series and sustain 50 confirmations per second; flow of 200 documents under 400 ms P95; preview under 300 ms P95; lists under 300 ms P95 at one million documents per tenant.
- **Volume**: 5 million documents and 50 million lines per tenant; 10,000 sources per bulk run; 10,000 active recurrences per tenant.
- **Concurrency**: version check on every write; roll-ups serialised per source line; one open change set per document; one running bulk run per requester and conversion; one recurrence occurrence per date.
- **Reliability**: at-least-once event delivery with one event per action; bulk runs and recurrences resume after a restart; first-enable indexing resumable.
- **Auditability**: who, when, before and after for every change to a confirmed document; every number accounted for; tolerance overrides and agent actions marked.
- **Security & privacy**: permissions of the owner type on every read and action; flow hides documents the user may not read; nothing leaves the platform except what owners already send (recurrence "confirm and send" uses the owner's existing email).
- **Accessibility and localization**: graph with a list alternative, keyboard-operable panels, every string in every shipped locale, amounts in words per organization language.
- **Compatibility**: PostgreSQL, MySQL, SQLite; both ORMs; additive migrations; cloud and self-hosted; queue or in-process scheduling; OpenAPI additive.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| --- | --- |
| Document type | A registered kind of business document with its lifecycle, numbering, links and stages |
| Document index entry | The engine's record of one document: number, state, version, party, dates, totals, lines |
| Numbering series | Pattern, selector and options that give a document type its numbers in an organization |
| Number record | One number a series handed out, used or voided with its reason |
| Document link | A typed "created from" between two documents and their lines, with quantity and amount |
| Roll-up | A quantity or amount of a source line accumulated from its confirmed targets |
| Tolerance | The allowed over- or under-fulfilment of a roll-up for an organization, item group, item or party |
| Change set | A recorded, approved change to a confirmed document producing its next version |
| Amendment | A linked new version of a confirmed document that replaces it |
| Totals snapshot | The frozen result of each totals stage of a document version |
| Recurrence, recurrence run | A schedule repeating a document; one dated occurrence and its outcome |
| Bulk run, bulk item | A background conversion of many sources; the outcome per source |
| Effects preview, preview token | The entries a document action would write; proof an agent saw them |
| Document flow | The graph of documents linked to a document |

## 6. Out of Scope

- Ledger postings, posting rules and the ledger effects themselves: `general-ledger`. Stock movements, levels and their effects: `warehouse-and-stock-movements`; stock value: `stock-ledger-and-valuation`.
- Tax calculation, tax lines and tax breakdown content: `tax-engine`. Prices, line discounts and promotions: `pricing-and-promotions`. Shipping charges: `delivery-and-shipping`.
- Approval definitions, steps and the approval inbox: `approval-workflows`. Print templates and PDF: `print-and-pdf-designer`. Email transport: `email-and-communications`.
- Each document type's own fields, statuses, screens and rules: the owning spec (`sales-order-management`, `procurement`, `invoicing-receivables-payables`, `payments-and-collections`, `warehouse-and-stock-movements`, `general-ledger`, `fixed-assets`, `subcontracting`, `point-of-sale-and-loyalty`, …).
- Subscription billing runs and proration: `subscription-billing`. Renaming and merging master records: `data-import-export`. Portal list pages: `customer-and-supplier-portal`. The report builder itself: `report-builder-and-dashboards`. Organization short codes and inter-organization relationships: `organization-setup`.

## 7. Acceptance Criteria

- [ ] **AC-1** A type registered by a test plugin gets numbering, lifecycle, links, roll-ups, tolerances, change sets, recurrence, bulk creation and preview with no code beyond its registration and adapter (FR-1, FR-9).
- [ ] **AC-2** Every token of FR-20 renders correctly across a year, fiscal-year and month boundary; a year token restarts the counter.
- [ ] **AC-3** A gap-free series under 50 parallel confirmations, 10 of which fail, has no gap and no duplicate; the audit shows used and voided numbers (advanced: gap-free numbering; FR-25–FR-27).
- [ ] **AC-4** Deliveries and invoices roll up to the order line in both directions of confirm and cancel; percentages reach exactly 100 %; a chain of order, invoice and credit note shows the same returned quantity at each level (FR-36, FR-38).
- [ ] **AC-5** Over-tolerance is refused with the allowed and excess quantities; the override with a reason passes and is reported; under-tolerance completes the line (FR-47, FR-49).
- [ ] **AC-6** Closing all remaining lines closes the document and publishes `closed`; reopening publishes `reopened` (FR-52, FR-54).
- [ ] **AC-7** The totals pipeline reproduces the golden set of existing invoices and orders to the smallest unit, and a document discount is distributed exactly (FR-55, FR-57, FR-58).
- [ ] **AC-8** A change set shows the diff, waits for approval above the threshold, and once applied publishes `amended` with the previous version (advanced: change sets; FR-66, FR-67, FR-69).
- [ ] **AC-9** An amendment moves links and roll-ups to the new version and publishes one `amended` event (FR-71).
- [ ] **AC-10** A preview of confirm, cancel and change set returns ledger, stock and tax effects when those features are on, writes nothing, and an agent cannot confirm without a valid token (advanced: effects preview; FR-78, FR-79).
- [ ] **AC-11** A monthly recurrence with a skipped month, a pause and a three-day downtime under each catch-up policy produces exactly the expected documents and run records (advanced: recurrence; FR-83, FR-87, FR-88).
- [ ] **AC-12** A bulk run of 400 orders killed half-way resumes without duplicates; skipped and failed items carry reasons; the log downloads as CSV (advanced: resumable bulk runs; FR-95, FR-96).
- [ ] **AC-13** The flow of an order with 200 linked documents renders under 400 ms and updates within 2 s when a delivery is confirmed (advanced: document flow; FR-101, FR-102).
- [ ] **AC-14** With the type's return policy on, a return above the returnable quantity is refused with the item and quantity, and a return at a higher price than the original is refused; with it off, the default for the document types that exist today, such returns are saved as today (FR-39, FR-40, FR-113).
- [ ] **AC-15** The trend report, number audit, tolerance overrides, closed lines, change sets and bulk results return rows on the demo tenant (FR-106).
- [ ] **AC-16** With the feature off, owners' existing numbering and status tests pass unchanged and no event is published; works on PostgreSQL, MySQL and SQLite with both ORMs; every requirement has a passing test (FR-7).
- [ ] **AC-17** Cancelling an order with its delivery and invoice as one chain succeeds or changes nothing; a cancelled order can be amended into a linked copy; a 2,000-line confirmation of a background type returns at once and its outcome reaches the requester (FR-111).
- [ ] **AC-18** With the feature on and no type policy changed, a sent invoice can still be edited and deleted, an invoice number can still be typed, an order line can still be delivered and billed above its quantity, a return can still exceed the returnable quantity and the original's price, and the owners' existing route and numbering tests pass unchanged; turning a policy on applies that rule to the type from then on (FR-7, FR-113).
- [ ] **AC-19** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-7).

## 8. Open Questions

- Amendment numbering: default applied, the original number with a suffix; organizations may choose a fresh number per series (FR-32).
- Change-set approval policy: default applied, "never" for every type until an organization sets a threshold; with the approval feature on, its definitions decide.
- Agent preview token lifetime: default applied, 10 minutes (FR-82).
- Default catch-up policy: default applied, "latest only" (FR-88).
- Whether the existing recurring invoices for billable time should later move onto document recurrence: default applied, they keep their own schedules and runs, share the recurrence rules, and are listed together (FR-92).

## 9. Constitution Gates

- [x] I Plugin-first — new plugin pair `business-documents`; core gains additive methods on the existing numbering service and the shared recurrence rules taken from invoice schedules.
- [x] II Tenant/organization scoping — every record tenant and organization scoped; counterparts written in the other organization's scope by a system actor.
- [x] III Both ORMs, additive migrations — new tables only, three dialects, both ORMs.
- [x] IV Default-off flag; nothing removed — `FEATURE_BUSINESS_DOCUMENTS` off; owners' numbering, order changes and invoice schedules stay.
- [x] V Contracts and API first — registration, events and endpoints in contracts before any screen; OpenAPI additive.
- [x] VI Permissions, privacy, security — owner permissions per action, engine keys for series, tolerances, change approval, bulk and recurrence; agents confirm only what they previewed.
- [x] VII Real-time through the event bus — outbox events and realtime hints for flow, progress and state.
- [x] VIII i18n and accessibility — strings in every locale; graph with list alternative.
- [x] IX Tests accompany the change — every requirement has a test in the tasks; contract tests shared with owners.
- [x] X Behaviour-first — this document.
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Code: `packages/core/src/lib/sequence/sequence.service.ts`, `packages/core/src/lib/rule/rule.evaluator.ts`, `packages/core/src/lib/event-outbox/event-outbox.service.ts`, `packages/plugins/order/src/lib/order-change/`, `packages/plugins/order/src/lib/order-line-invoice/`, `packages/core/src/lib/invoice-schedule/`, `packages/core/src/lib/operation/`, `packages/core/src/lib/activity-log/`, `packages/core/src/lib/reports/`
- Related specs: [`general-ledger`](../general-ledger/spec.md), [`tax-engine`](../tax-engine/spec.md), [`invoicing-receivables-payables`](../invoicing-receivables-payables/spec.md), [`sales-order-management`](../sales-order-management/spec.md), [`procurement`](../procurement/spec.md), [`warehouse-and-stock-movements`](../warehouse-and-stock-movements/spec.md), [`payments-and-collections`](../payments-and-collections/spec.md), [`financial-reports`](../financial-reports/spec.md), [`regional-compliance-packs`](../regional-compliance-packs/spec.md), [`organization-setup`](../organization-setup/spec.md), `../approval-workflows/spec.md`, `../print-and-pdf-designer/spec.md`
