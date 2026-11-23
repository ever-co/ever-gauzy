# Feature Specification: Fixed assets

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `fixed-assets`
**Branch**: `feat/fixed-assets`
**Status**: `Draft`
**Created**: 2026-11-15
**Last updated**: 2026-11-23
**Owner**: platform maintainers
**Feature flag**: `FEATURE_FIXED_ASSETS` (default off)

---

## 1. Overview

An organization keeps a register of what it owns and uses for more than a year: each **asset** has a category, a
cost, a place, a custodian and, per ledger book, a depreciation schedule that the platform posts for it. The asset
is created by hand, from an existing equipment row, or automatically when a purchase of a fixed-asset item is
received or billed; it can be built up through work in progress, enlarged by a capitalization, moved, handed over,
repaired, maintained, revalued, split, sold and scrapped, and every step writes to its timeline and, when accounting
is on, to the ledger through the posting rules of `general-ledger`. The existing equipment register and equipment
lending stay as they are and become the physical and operational side of an asset: every tangible asset is one
equipment row, which keeps its name, serial number, image and tags, and lending that equipment shows as temporary
custody of the asset. Surfaces: the Gauzy app (register, documents, reports, an installable phone page for scans),
the REST API and SDKs, and MCP tools with previews for agents.

**Advanced capabilities.** One schedule per asset and book with versioned revisions instead of a new document for
every change; depreciation by units of usage fed from lending bookings and tracked time; component depreciation,
impairment with capped reversal and leased (right-of-use) assets; a depreciation forecast with what-if simulation
and a comparison of books; scannable labels and audit sessions on a phone that work offline; custody
acknowledgement by the custodian and return lists when a person leaves; an asset assistant that finds anomalies
and proposes documents for a person to confirm.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** an accountant with a category "Laptops" (straight line, 36 monthly periods, work in progress off),
  **when** a goods receipt for three units of an item flagged as fixed-asset item is confirmed, **then** three draft
  assets appear, each with a third of the net line amount and a link to the receipt line; **when** the accountant
  sets the in-service date and confirms one, **then** it gets a number, its schedule shows 36 lines whose total
  equals cost less salvage, and the effects preview shown before confirming matches the journal that was posted.
- **Given** an in-service asset with a line due yesterday, **when** the daily depreciation run passes, **then** the
  line is posted once (expense against accumulated depreciation, with the asset's cost centre), the asset's net book
  value drops by the line amount, and the register and the asset page update without a reload.
- **Given** an asset manager, **when** they confirm a movement that hands a laptop over to an employee, **then** the
  asset shows the employee as custodian, the employee receives an inbox item to acknowledge receipt, and the
  timeline records the hand-over with both names.
- **Given** an asset linked to an equipment row, **when** a lending request for that equipment is approved for next
  week, **then** during that week the asset shows "on loan" with the borrowers, and afterwards returns to its
  previous custody, with the lending rules and approval unchanged.
- **Given** a machine out of order, **when** a repair with consumed parts and a linked supplier bill line is
  completed and confirmed with "add to asset value" and four extra periods, **then** the parts are issued from
  stock, the asset's cost grows by the repair cost, and a new schedule revision spreads the new carrying amount
  over the extended life, leaving posted lines untouched.
- **Given** an asset with a net book value of 4,000, **when** it is sold on a customer invoice line for 4,500,
  **then** depreciation up to the sale date is posted, cost and accumulated depreciation leave the books, a gain of
  500 less the catch-up amount is posted, and the asset is marked sold with a link to the invoice.
- **Given** an auditor with a phone in the warehouse, **when** they start an audit session for that location and
  scan labels (also without signal), **then** each scan is recorded once, progress is visible live in the office,
  and closing the session lists missing, misplaced and unknown items with one-click draft movements.
- **Given** a finance lead, **when** they open the forecast for the next 24 months and simulate "Vehicles: 60
  periods instead of 48", **then** they see the monthly difference per ledger book and nothing is saved.

### 2.2 Edge cases & failures

- **Given** a user without `FIXED_ASSET_DEPRECIATION_POST`, **when** they call the run, **then** `403`; with the
  feature off every route of the feature answers `404` and the equipment pages behave exactly as today.
- **Given** a depreciation line dated in a locked period, **when** the run reaches it, **then** by default it is
  skipped and reported with the lock that stopped it; with the setting "post in first open period" it is posted on
  the first open day and keeps its original period for reports.
- **Given** two accountants confirming the same draft asset, **when** the second request arrives, **then** it is
  refused with `409` and the asset is confirmed once.
- **Given** a run over 5,000 assets where 12 lack an expense account, **when** it finishes, **then** 4,988 lines are
  posted, the 12 are listed with the missing account role, and holders of the posting permission are notified.
- **Given** a capitalization that consumes spare parts, **when** stock is insufficient, **then** confirmation is
  refused naming the item and location, and nothing is posted.
- **Given** a value adjustment dated before the last posted depreciation line, **when** saved, **then** it is refused
  with the earliest allowed date.
- **Given** a supplier bill whose line already funded a confirmed asset, **when** someone cancels the bill, **then**
  the cancellation is refused and names the assets to cancel first.
- **Given** a phone that scanned 40 labels offline, **when** it reconnects after another auditor scanned ten of the
  same, **then** 30 new scans are added, ten are reported as already recorded, none is duplicated.
- **Given** accounting switched off for the tenant, **when** an asset is confirmed, **then** the register, movements,
  maintenance and audits work, schedules are computed for information, and posting actions are hidden.

## 3. Functional Requirements

### 3.1 Asset categories

| ID | Requirement |
| --- | --- |
| **FR-1** | A user with `FIXED_ASSET_CATEGORIES_EDIT` can create, edit and archive asset categories: code, name, kind (tangible, intangible, right-of-use), whether assets depreciate, whether cost first passes through work in progress, and default depreciation rules per ledger book. |
| **FR-2** | The system MUST hold, per category and organization, one mapping of account roles (asset cost, accumulated depreciation, depreciation expense, work in progress, disposal result, revaluation reserve, impairment loss, repair expense) to ledger accounts; each account MUST be of the type its role requires and in the organization currency; a role left empty falls back to the organization's fixed-asset defaults, and a document that needs a role with no account is refused naming the role. |
| **FR-3** | The system MUST refuse: switching a category to non-depreciating while it has assets with unposted lines; changing a mapped account while the organization has in-service assets of the category (the change is made through a reclassification that posts the transfer); a salvage percentage outside 0–100; a negative rate. |
| **FR-4** | The system MUST copy category defaults to an asset at creation, allow overrides until confirmation, and leave existing assets untouched when the category changes later. |

### 3.2 Asset register

| ID | Requirement |
| --- | --- |
| **FR-5** | A user with `FIXED_ASSETS_EDIT` can record an asset with: name, category, item (optional; only an item flagged as fixed-asset item and not stock-tracked), location, custodian (employee or team), department, analytic dimensions (a cost centre is one of them), acquisition date, in-service date, cost with currency and rate, quantity (a grouped asset), ownership (the organization, a supplier or a customer), serial number, image, tags, a "maintenance required" flag and custom fields; for a tangible asset name, serial number, image and tags are those of its equipment row. |
| **FR-6** | The system MUST track two independent states: an accounting state (draft, work in progress, in service, fully depreciated, sold, scrapped, consumed, cancelled) and an operational state (available, in custody, on loan, in maintenance, out of order, in transit), and show both on lists and filters. |
| **FR-7** | The system MUST support standalone assets, composite assets and components of a composite, and roll a composite's cost, accumulated depreciation and net book value up from its components. |
| **FR-8** | The system MUST number an asset on confirmation from the numbering series of its document type (default pattern year plus running number per organization) and never reuse a number. |
| **FR-9** | The system MUST refuse to confirm an asset without category and cost, without complete account mapping while accounting is on (with accounting off no mapping is needed and nothing is posted, FR-96), and without an in-service date unless it starts in work in progress; before confirming it MUST show the effects preview (journals, while accounting is on, and schedule). |
| **FR-10** | The system MUST refuse to cancel a confirmed asset while a repair or maintenance occurrence is open, after a sale or scrap, or while later documents depend on it; cancelling reverses its postings by reversal. |
| **FR-11** | A user with `FIXED_ASSETS_EDIT` can register an asset the organization already owns without a purchase document, stating accumulated depreciation and the number of periods already booked at the opening date; the system MUST post nothing for the opening values and MUST refuse a supplier bill as acquisition source of it. |
| **FR-12** | A user with `FIXED_ASSETS_EDIT` can create an asset from an equipment row (initial cost and currency proposed as its cost; name, serial number, image and tags stay on the equipment row and show on the asset); every tangible asset has exactly one equipment row, created with the asset when none is chosen, and can be relinked to another; equipment without an asset keeps working unchanged. |
| **FR-13** | The system MUST offer "make lendable" on a tangible asset, opening its equipment row to lending requests, and MUST do it automatically for categories set to lendable by default. |
| **FR-14** | A user with `FIXED_ASSETS_EDIT` can record on an asset who insures it, under which policy, for which value and for which period, and the system MUST remind the asset manager 30 days before a policy ends. |
| **FR-15** | The system MUST show on each asset the linked documents: purchase receipt, supplier bill, customer invoice, journals, capitalizations, repairs, movements, adjustments, and the document flow between them. |
| **FR-16** | The system MUST store cost in the document currency and the organization currency with the rate used, and compute depreciation in the organization currency. |

### 3.3 Acquisition from purchases, work in progress, capitalization

| ID | Requirement |
| --- | --- |
| **FR-17** | A user with `FIXED_ASSET_CATEGORIES_EDIT` can give a fixed-asset item an asset rule: category, one asset per unit or one grouped asset per line, and numbering series. |
| **FR-18** | The system MUST create draft assets when a goods receipt or a supplier bill (whichever the organization setting names, default the receipt) with such an item is confirmed, each linked to its source line, with cost equal to the net line amount plus non-recoverable tax, divided per unit. |
| **FR-19** | The system MUST keep the assets of one purchase line equal in total to the line's acquisition cost of FR-18, the net amount plus non-recoverable tax (each asset's cost rounded to the currency, the rounding difference on the last asset), link a later bill to the assets of its receipt instead of creating new ones, and apply a price difference to the cost (directly before the first posted line, otherwise as a cost adjustment). |
| **FR-20** | The system MUST delete draft assets when their source document is cancelled and refuse the cancellation while a confirmed asset depends on it, naming the assets. |
| **FR-21** | The system MUST post the cost of a work-in-progress asset to the work-in-progress account, compute no depreciation for it, and move the cost to the asset cost account when a user capitalizes it or, automatically, when the daily job finds its in-service date reached. |
| **FR-22** | A user with `FIXED_ASSETS_CONFIRM` can confirm a capitalization that builds or enlarges a target asset from stock items (issued through the stock ledger at their value, with lot or serial where tracked), other assets (at net book value on that date) and service or expense lines; the total becomes cost of the target. |
| **FR-23** | The system MUST require a target that is composite, in work in progress or in service (then with a schedule revision), refuse a consumed asset dated before its last posted depreciation line, mark consumed assets as consumed, and flag a capitalization "cost changed" when a source value changes later, offering a recalculation. |
| **FR-24** | The system MUST, on cancelling a capitalization, restore consumed assets and their schedules, return the stock and reverse the journals, and refuse while the target has later posted lines that are not reversed. |

### 3.4 Depreciation books, methods and schedules

| ID | Requirement |
| --- | --- |
| **FR-25** | The system MUST keep at most one depreciation book per asset and ledger book, require the ledger book on each when there are several, and use the organization's default ledger book when there is one. |
| **FR-26** | The system MUST compute schedules by: straight line; declining balance with a factor; written-down value by rate; a manual schedule; and units of usage (FR-35). |
| **FR-27** | The system MUST take per book: method, number of periods, period length in months, start date, salvage as amount or percentage, rate or factor (for written-down value, either rate or salvage, the other derived), opening accumulated depreciation and periods already booked. |
| **FR-28** | The system MUST prorate the first and last period from the in-service date, by month by default or by day when the book says so, counting days against the days of the year or of the period per organization setting. |
| **FR-29** | The system MUST generate lines (period, amount, accumulated, net book value) whose total equals cost less salvage less opening accumulated depreciation exactly, with rounding on the last line and no line before the in-service date. |
| **FR-30** | The system MUST record every change of cost, life, method, salvage or usage after confirmation as a schedule revision with reason, author and source document: posted lines stay as posted, unposted lines are recomputed, earlier revisions remain readable and comparable, and a revision is undone only if it is the latest. |
| **FR-31** | A user with `FIXED_ASSETS_EDIT` can maintain intensity factors (name, multiplier, one default) and set a factor on unposted lines; the system MUST rebalance later lines from the end so the total is unchanged. |
| **FR-32** | A user with `FIXED_ASSETS_CONFIRM` can extend an asset's remaining life by a number of periods; the system MUST recompute the unposted lines as a revision. |
| **FR-33** | The system MUST accept a manual schedule only when its lines are in date order, start on or after the in-service date and total the depreciable amount. |
| **FR-34** | The system MUST refuse any schedule change that would alter a posted line, and MUST mark an asset fully depreciated when its last line is posted. |
| **FR-35** | The system MUST compute units-of-usage depreciation per period as the depreciable amount times usage in the period over total expected usage, from usage readings (FR-79), estimating a missing reading from the average and correcting the next period when the reading arrives. *(advanced)* |
| **FR-36** | The system MUST let each component of a composite asset carry its own method and life, and on replacement of a component remove the old one at its net book value and add the new one. *(advanced)* |
| **FR-37** | A user with `FIXED_ASSET_REPORTS_VIEW` can view projected depreciation per month for up to 60 months by category, ledger book and cost centre (including draft and work-in-progress assets with a planned in-service date) and simulate another method, life or salvage for an asset or category; a simulation saves nothing. *(advanced)* |

### 3.5 Depreciation posting

| ID | Requirement |
| --- | --- |
| **FR-38** | The system MUST post a schedule line through the posting rules as expense against accumulated depreciation in the line's ledger book, with the asset's cost centre and dimensions (else the organization's depreciation cost centre), and refuse an expense account that is not a profit-and-loss account. |
| **FR-39** | A user with `FIXED_ASSET_DEPRECIATION_POST` can preview and run depreciation up to a date for chosen organizations, books and categories, and post a single line from the asset page; each line is posted at most once however often a run is repeated. |
| **FR-40** | The system MUST run depreciation daily for organizations with automatic posting on, posting lines due in the organization's time zone, continuing past failures and notifying holders of the posting permission (inbox and email) with each failure's reason. |
| **FR-41** | The system MUST skip and report lines in a locked period, or post them on the first open day when the organization chose so, keeping the original period on the line. |
| **FR-42** | A user with `FIXED_ASSET_DEPRECIATION_POST` can reverse the latest posted line of a book in an open period; the line becomes unposted again; an earlier line cannot be reversed before the later ones. |
| **FR-43** | The system MUST post either one journal per run, book, category and cost centre with one line per asset (default) or one journal per schedule line, per organization setting, with the organization's series. |

### 3.6 Locations, movement and custody

| ID | Requirement |
| --- | --- |
| **FR-44** | A user with `FIXED_ASSET_MOVEMENTS_EDIT` can maintain a tree of asset locations with area and a "holds only sub-locations" flag, each place being either a stock location or an address of the address book (whose coordinates it shows) or inheriting its parent's; a location with assets or children cannot be deleted. |
| **FR-45** | A user with `FIXED_ASSET_MOVEMENTS_EDIT` can confirm a movement of one or more assets that relocates them, hands them over to an employee or team, returns them to a location, or relocates and hands over at once. |
| **FR-46** | The system MUST refuse a movement dated before the asset's latest movement, with identical source and target, or naming an asset of another organization; confirming updates location and custodian; cancelling is allowed only for the asset's latest movement and restores the previous values. |
| **FR-47** | The system MUST ask the new custodian to acknowledge a hand-over (inbox item, optional condition note and photo), show "awaiting acknowledgement" on the asset, and escalate to the custodian's manager after the configured number of days (default 5). *(advanced)* |
| **FR-48** | The system MUST show an approved lending of the linked equipment as temporary custody: operational state "on loan" with borrowers for the lending period, restored afterwards, with no movement document and no change to lending rules. *(advanced)* |
| **FR-49** | The system MUST, when an employee leaves the organization or a team is removed, list the assets in their custody and open a draft return movement for the asset manager. *(advanced)* |
| **FR-50** | The system MUST keep a read-only timeline per asset of every event (created, confirmed, cancelled, moved, handed over, acknowledged, lent, repaired, maintained, lines posted or reversed, schedule revised with reason, revalued, impaired, split, sold, scrapped, restored, audited) with actor (person, automation or agent) and links to the documents. |

### 3.7 Repair

| ID | Requirement |
| --- | --- |
| **FR-51** | A user with `FIXED_ASSETS_EDIT` can record a repair of an asset: when it failed and when it was fixed (downtime computed, editable), what was wrong and what was done, the parts taken from a stock location, the supplier bill lines that belong to it, and its total cost. |
| **FR-52** | The system MUST set the asset out of order while a repair is open, restore the state when it is completed or cancelled, and allow confirmation only of a completed repair. |
| **FR-53** | The system MUST, on confirmation, issue the parts through the stock ledger and either expense the cost or, when "add to asset value" is chosen, add it to the cost in the chosen books as a schedule revision, with an optional extension of life. |
| **FR-54** | The system MUST refuse a repair cost that exceeds what remains unused of its linked bill lines across all repairs. |
| **FR-55** | The system MUST, on cancelling a repair, return the parts, reverse the journals and undo its schedule revision when it is the latest, and refuse otherwise. |

### 3.8 Revaluation, impairment and leases

| ID | Requirement |
| --- | --- |
| **FR-56** | A user with `FIXED_ASSET_REVALUATIONS_POST` can set a new value of an asset in a ledger book at a date; the system MUST post the difference to the revaluation or loss account and revise the schedule. |
| **FR-57** | The system MUST refuse an adjustment dated before acquisition or before the last posted line, on a disposed asset, or with unposted lines before its date (offering to post them); it MUST refuse to cancel an adjustment once the asset was split or revised afterwards. |
| **FR-58** | A user with `FIXED_ASSET_REVALUATIONS_POST` can record an impairment with recoverable amount, indicators and evidence; the system MUST post the loss, revise the schedule, route it through an approval when above the organization's threshold, and cap a later reversal at the carrying amount the asset would have had without the impairment. *(advanced)* |
| **FR-59** | A user with `FIXED_ASSETS_CONFIRM` can register a lease (term, payments, discount rate, initial costs); the system MUST create a right-of-use asset at the present value of the payments, keep a liability schedule (interest and repayment per period), post both each period, revise both when term or payments change, and expense the payments of a lease marked short-term or low-value. *(advanced)* |

### 3.9 Sale, scrap, restore and split

| ID | Requirement |
| --- | --- |
| **FR-60** | A user with `FIXED_ASSET_DISPOSALS_POST` can sell an asset from its page (which drafts the customer invoice) or by choosing it on a customer invoice line; when the invoice is confirmed the system MUST post depreciation up to the sale date, remove cost and accumulated depreciation, and post the gain or loss. |
| **FR-61** | The system MUST split a grouped asset first when only part of its quantity is sold. |
| **FR-62** | The system MUST refuse a disposal dated before the in-service date or the last posted line, in the future, of an already disposed asset, or while a repair is open. |
| **FR-63** | The system MUST restore the asset (state, remaining schedule, reversed disposal journal) when the sale invoice is cancelled or fully credited. |
| **FR-64** | A user with `FIXED_ASSET_DISPOSALS_POST` can scrap an asset at a date with a reason (worn out, lost, stolen, donated, destroyed); the system MUST post depreciation to that date and write off the net book value. |
| **FR-65** | A user with `FIXED_ASSET_DISPOSALS_POST` can restore a scrapped asset; the system MUST reverse the write-off and spread the remaining depreciable amount over the remaining periods from the restore date. |
| **FR-66** | A user with `FIXED_ASSETS_CONFIRM` can split a grouped asset by quantity; the system MUST apportion cost, accumulated depreciation, salvage and unposted lines proportionally (rounding on the remainder), link the new asset to its source and post nothing. |

### 3.10 Maintenance

| ID | Requirement |
| --- | --- |
| **FR-67** | A user with `FIXED_ASSET_MAINTENANCE_EDIT` can attach a maintenance plan to a confirmed asset flagged "maintenance required": a team, and tasks each with kind (preventive, calibration, inspection), recurrence (every N days, weeks, months or years, or every N usage units), assignee, start and end, whether a certificate is required, and whether the task takes the asset out of service. |
| **FR-68** | The system MUST require the assignee to be a member of the plan's team, a start not after the end, and MUST compute each task's next due date. |
| **FR-69** | The system MUST keep one occurrence per task and due date, held as a task of the platform (or a field-service visit for work done by an outside team) with states planned, overdue, completed and cancelled; closing one requires completed or cancelled, a completion date not in the future, the actions performed, and the certificate file when the task requires it. |
| **FR-70** | The system MUST, daily, mark past-due occurrences overdue and create the next occurrence as a task assigned to the assignee (in the plan's project when one is set), so it appears in their tasks and inbox. |
| **FR-71** | The system MUST show the asset "in maintenance" while an occurrence of an out-of-service task is due, overdue or in progress, and record cost and parts of an occurrence as expense for the cost-of-ownership report. |

### 3.11 Labels, audits and utilization

| ID | Requirement |
| --- | --- |
| **FR-72** | The system MUST give every asset a unique scannable code and print labels (code plus number and name) singly or in sheets through a print template; scanning it on a signed-in phone opens the asset's phone page (identity, custodian, location; actions: report a problem, move, acknowledge custody). *(advanced)* |
| **FR-73** | A user with `FIXED_ASSET_AUDITS_RUN` can open an audit session scoped by location, category or custodian and invite auditors; each scan records asset, time, auditor, condition, optional photo and position. *(advanced)* |
| **FR-74** | The system MUST accept scans made offline when the phone reconnects, record each asset once per session, and show session progress live to everyone watching it. *(advanced)* |
| **FR-75** | The system MUST, on closing a session, list missing, misplaced, unknown and damaged items and create draft movements, repairs or scrap proposals for the selected ones; the session report is kept. *(advanced)* |
| **FR-76** | The system MUST compute utilization per asset and period as used time over available time, where used time comes from approved lending periods, tracked time that names the asset, and usage readings, and available time from the organization's working calendar. *(advanced)* |
| **FR-77** | The system MUST let a task or project be linked to an asset, and add the hours tracked on it to the asset's usage for the period. *(advanced)* |
| **FR-78** | The system MUST list idle assets: no custodian, lending, usage or movement for the configured number of days (default 90). *(advanced)* |
| **FR-79** | A user with `FIXED_ASSETS_EDIT` can enter or import usage readings (date, units); readings derived from lending and tracked time are added automatically at period end and never counted twice. *(advanced)* |

### 3.12 Reports and dashboards

All reports are report definitions: filterable, groupable, exportable, schedulable and clonable.

| Requirement | Report | Answers | Filters and grouping |
| --- | --- | --- | --- |
| **FR-80** | Asset register | Which assets exist, with cost, accumulated depreciation and net book value at a date? | organization, states, category, location, custodian, cost centre, ledger book, date or fiscal year; group by category, location or custodian |
| **FR-81** | Depreciation ledger | Which lines were posted for which asset in a range, with their journals? | organization, dates, asset, category, cost centre, ledger book |
| **FR-82** | Asset roll-forward | How did cost and accumulated depreciation move from opening to closing: additions, capitalizations, adjustments, impairments, sales, scraps, consumption, depreciation? | organization, dates, ledger book; by category or asset |
| **FR-83** | Asset activity | What happened to assets, by whom? | dates, asset, event kind, actor |
| **FR-84** | Maintenance plan | Which occurrences are due, overdue or done, and what did they cost? | dates, asset, team, assignee, state |
| **FR-85** | Asset value analytics | How does asset value develop over time, by category and by location? | organization, ledger book, period |

| ID | Requirement |
| --- | --- |
| **FR-86** | The system MUST provide a dashboard with cards (number of assets, total cost, net book value, additions this fiscal year, lines due, overdue maintenance) and charts (value by category, by location, over time). |
| **FR-87** | The system MUST report, per asset and category, the difference between two ledger books (cost, accumulated, net book value, depreciation of the period). *(advanced)* |
| **FR-88** | The system MUST report utilization, idle assets, audit discrepancies and cost of ownership (cost, repairs, maintenance, insurance, less proceeds) per asset. *(advanced)* |
| **FR-89** | The system MUST compare, per organization, ledger book and category, the register's cost and accumulated depreciation with the mapped ledger accounts and list every difference with its documents. |

### 3.13 API, agents, automation and compatibility

| ID | Requirement |
| --- | --- |
| **FR-90** | The system MUST expose every action above through the REST API with idempotency keys on creating and posting calls, bulk endpoints with per-row results, and a preview of ledger and stock effects for each document. |
| **FR-91** | The system MUST offer MCP tools for reading the register and for each document, where posting tools return the preview first and act with the caller's permissions, marked as agent actions in the timeline. |
| **FR-92** | The system MUST provide an asset assistant that lists findings (in service without custodian, fully depreciated but in use, idle, maintenance overdue, insurance ending, register differing from the ledger, missing account role), each with a proposed draft document that a person confirms. *(advanced)* |
| **FR-93** | The system MUST publish asset events (confirmed, moved, handed over, maintenance due, line posted, revised, disposed) for automation rules, webhooks and real-time updates of open lists and pages. |
| **FR-94** | The system MUST import an existing register through the mapped import with opening values, validating every row and reporting errors per row without importing the failed rows. |
| **FR-95** | The system MUST let a country pack register further depreciation methods and proration conventions, selectable on books of organizations that applied the pack. |
| **FR-96** | The system MUST, with the feature off, load no route, menu entry or job of the feature; with the feature on and accounting off it MUST keep documents working without postings. |

## 4. Non-Functional Requirements

- **Performance**: register list under 300 ms at the 95th percentile with 200,000 assets per organization; asset
  confirmation under 500 ms excluding asynchronous posting; a depreciation run posts 100,000 lines within 10
  minutes in batches; register and roll-forward reports are served from maintained book balances, not from a scan
  of lines; forecast for 200,000 assets over 60 months within 5 s.
- **Data volume and concurrency**: 1 million assets and 100 million schedule lines per tenant; one run per
  organization and ledger book at a time; optimistic versions on assets and documents (`409` on conflict).
- **Reliability**: posting is at-least-once with one journal per line or group; a run resumes after interruption;
  offline scans survive app restarts on the phone for 7 days.
- **Security & privacy**: tenant and organization scoped; custody names personal data (who holds what): visible to
  holders of `FIXED_ASSETS_VIEW` and to the custodian for their own assets; scan positions are stored only with the
  auditor's consent prompt; nothing leaves the platform except emails and labels the user sends or prints.
- **Observability and audit**: timeline per asset; who, when, before and after on every confirmed document and
  setting; run records with counts and failures; integrity findings.
- **Accessibility and localization**: keyboard-operable forms and tables, labelled scan page, all strings in every
  shipped locale, amounts and dates in the user's format.
- **Compatibility**: PostgreSQL, MySQL and SQLite; both ORMs; multi-tenant cloud and self-hosted single tenant;
  additive OpenAPI and SDK changes only.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| `AssetCategory` | A class of assets with default depreciation rules and, per organization, its ledger account roles |
| `Asset` | One owned or leased thing (or a group of identical ones) with cost, states, place and custodian |
| `AssetBook` | The depreciation settings and running balances of an asset in one ledger book |
| `AssetScheduleRevision` | One version of a book's schedule, with the reason it replaced the previous one |
| `AssetDepreciationLine` | One period's planned or posted depreciation of a book |
| `AssetDepreciationRun` | One execution of posting (a platform operation), with its scope, counts and failures |
| `AssetIntensityFactor` | A named multiplier that weights a period's depreciation |
| `AssetUsageReading` | Usage of an asset on a date, entered or derived from lending and tracked time |
| `AssetLocation` | A place in a tree where assets are kept |
| `AssetMovement` | A document that relocates, hands over or returns assets |
| `AssetCapitalization` | A document that turns stock, other assets and expenses into cost of a target asset |
| `AssetRepair` | A repair with parts, linked bill lines and cost, expensed or added to the asset |
| `AssetValueAdjustment` | A revaluation, impairment, impairment reversal or cost adjustment |
| `AssetDisposal` | A sale or scrap, and its restoration |
| `AssetLease` | A lease contract behind a right-of-use asset, with its liability schedule |
| `AssetMaintenancePlan` / task / occurrence | Recurring upkeep of an asset and each due instance (a platform task or field-service visit) |
| `AssetInsurancePolicy` | Insurance cover of an asset |
| `AssetAuditSession` / scan | A physical count of assets and each scanned label |
| `AssetEvent` | One entry of an asset's timeline (an activity-log entry or document history row) |
| `AssetItemRule` | How a purchased fixed-asset item becomes assets |

## 6. Out of Scope

- Chart of accounts, ledger books, period locks, posting engine, reversal and reposting: `accounting-foundation`,
  `general-ledger`.
- Purchase orders, goods receipts and supplier master: `procurement`; supplier bills and customer invoices as
  documents: `invoicing-receivables-payables`.
- Stock quantities and value of consumed parts: `warehouse-and-stock-movements`, `stock-ledger-and-valuation`.
- Equipment lending rules, requests and approval: the existing equipment sharing (kept as is).
- Maintenance and warranty of equipment installed at customers: `maintenance-and-field-service`.
- Approval steps on documents: `approval-workflows`. Label and document layouts: `print-and-pdf-designer`.
- Country-specific depreciation rules and tax-book content: `regional-compliance-packs` (through FR-95).
- Transfers of assets between organizations of a tenant as one document: `general-ledger` (inter-company journals);
  until then a sale in one organization and an acquisition in the other.
- Audits run on an installable phone web page that works offline.

## 7. Acceptance Criteria

- [ ] **AC-1** A receipt of a fixed-asset item creates draft assets; confirming one posts the acquisition and
      generates a schedule that totals the depreciable amount for each method of FR-26.
- [ ] **AC-2** A work-in-progress asset is capitalised by the daily job on its in-service date; a capitalization
      with stock, an asset and an expense line builds the target and its cancellation restores everything (FR-21, FR-24).
- [ ] **AC-3** The daily run posts due lines once, skips a locked period with a report, continues past failures and
      notifies; reversing the latest line makes it unposted again (FR-40, FR-41).
- [ ] **AC-4** Movement, hand-over with acknowledgement, lending as temporary custody and the return list of a
      leaving employee appear on the timeline (advanced, custody) (FR-45, FR-47–FR-49).
- [ ] **AC-5** A repair added to the asset value, a revaluation, an impairment and its capped reversal each create
      a schedule revision that leaves posted lines unchanged; a lease posts interest, repayment and depreciation (FR-56–FR-58).
- [ ] **AC-6** Sale through an invoice, partial sale with split, scrap and restore post the expected journals; the
      invoice's cancellation restores the asset (FR-60–FR-63).
- [ ] **AC-7** Maintenance occurrences become overdue, recur, reach the assignee's inbox and put the asset in
      maintenance (FR-68, FR-70, FR-71).
- [ ] **AC-8** An audit session with offline scans from two phones closes with a correct discrepancy list and draft
      movements (advanced, audits); labels print through a print template (FR-74, FR-75).
- [ ] **AC-9** Units-of-usage depreciation follows readings derived from lending and tracked time; component
      replacement removes the old component (advanced, methods) (FR-35, FR-76, FR-79).
- [ ] **AC-10** The forecast matches the schedules, and a simulation changes nothing; the book comparison shows
      the differences between two ledger books (advanced, planning) (FR-37).
- [ ] **AC-11** The asset assistant lists seeded anomalies and its proposals are drafts until a person confirms (FR-92).
- [ ] **AC-12** The six reports of §3.12 and the dashboard return figures that agree with the ledger; the integrity
      comparison reports a seeded difference.
- [ ] **AC-13** Permission denial answers `403`; concurrent confirmation answers `409`; insufficient stock refuses
      the document without partial postings (FR-22, FR-90).
- [ ] **AC-14** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-96).
- [ ] Works on PostgreSQL, MySQL and SQLite with both ORMs.
- [ ] Behind `FEATURE_FIXED_ASSETS`; nothing changes while the flag is off, and equipment pages are unchanged.
- [ ] All functional requirements have a passing test.

## 8. Open Questions

- Asset locations are their own tree whose places are stock locations or address-book addresses (applied). One
  shared location master with the branches of `hr-core-lifecycle` is possible later.
- Default for assets from purchases is "at goods receipt"; organizations that capitalize at the bill switch the
  setting (applied).
- Default depreciation journals are grouped per run, book, category and cost centre (applied); per-line journals
  are a setting.
- Opening values of existing assets post nothing and are expected in the opening balances (applied); the integrity
  comparison (FR-89) shows a mismatch.
- Leases cover the lessee side only; lessor accounting is not offered (applied).
- Naming an asset for tracked time (FR-77) is done by linking a task or project to the asset, kept by this
  feature, so time tracking itself is unchanged (applied); a direct field on a time entry can follow if wanted.

## 9. Constitution Gates

- [x] I Plugin-first — new plugin `fixed-assets` with its UI plugin; core equipment is linked, not changed.
- [x] II Tenant/organization scoping — every record is tenant and organization scoped; categories are shared in a
      tenant with per-organization accounts.
- [x] III Both ORMs, additive migrations — new tables only, three dialects.
- [x] IV Default-off flag; nothing removed — `FEATURE_FIXED_ASSETS`; equipment and lending untouched.
- [x] V Contracts and API first; backwards compatible — REST and contracts before UI; additive only.
- [x] VI Permissions, privacy, security — separate keys for editing, confirming, posting, disposing; custody data
      limited to permitted readers.
- [x] VII Real-time through the event bus — outbox events drive postings, timeline, lists and audit progress.
- [x] VIII i18n and accessibility — all strings as keys in every locale; keyboard and screen-reader support.
- [x] IX Tests accompany the change — schedule mathematics, posting invariants, document rules, offline scan merge.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Related features: [`../general-ledger/spec.md`](../general-ledger/spec.md),
  [`../accounting-foundation/spec.md`](../accounting-foundation/spec.md),
  [`../business-document-engine/spec.md`](../business-document-engine/spec.md),
  [`../procurement/spec.md`](../procurement/spec.md),
  [`../invoicing-receivables-payables/spec.md`](../invoicing-receivables-payables/spec.md),
  [`../maintenance-and-field-service/spec.md`](../maintenance-and-field-service/spec.md)
- Existing code: `packages/core/src/lib/equipment`, `packages/core/src/lib/equipment-sharing`,
  `packages/core/src/lib/equipment-sharing-policy`, `packages/core/src/lib/product-setting` (fixed-asset item flag)
- Related architecture: [platform architecture](../../architecture/business-suite.md) §3.1 (business documents), §3.4 (ledger posting), §3.5 (stock ledger)
