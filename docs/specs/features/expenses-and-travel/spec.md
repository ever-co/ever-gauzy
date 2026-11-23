# Feature Specification: Expenses and travel

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `expenses-and-travel`
**Branch**: `feat/expenses-and-travel`
**Status**: `Draft`
**Created**: 2026-11-16
**Last updated**: 2026-11-23
**Owner**: platform maintainers
**Feature flag**: `FEATURE_EXPENSE_CLAIMS` (new, default off); the existing `FEATURE_EXPENSE` keeps governing today's expense pages

---

## 1. Overview

Expenses exist today as company expenses entered directly: amount, currency, category, vendor, employee, project,
client, tax, one receipt file, billable to a client, split across employees, recurring expenses, an expense report,
statistics and MCP tools. There is no employee claim, approval, reimbursement, advance, travel request, per diem,
mileage or vehicle log. This feature adds the `expense-claims` plugin on the **same expense record**: every claim line
is an expense of the organization, so the expense list, report, statistics, project figures and invoicing see approved
claim lines with no second model. It adds **claims** with lines, receipts, taxes and approval; **reimbursement**
through `payments-and-collections` or through payroll; **advances** applied to claims, returned or recovered from pay;
project and client costing with re-billing; **travel requests** with itineraries, estimates and advances; **per-diem
and mileage rates**; a **vehicle log**; and expense reports. Postings go through `general-ledger` document events and
approvals through `approval-workflows`. Surfaces: the Gauzy web app (installable on phones for receipt photos and
claims on the go), the REST API and SDKs, and MCP tools.

**Advanced capabilities.** Receipts are read by an assistant into claim lines, with duplicate and policy checks before
anyone submits. Policies explain themselves while the line is typed ("12 EUR over the daily meals limit for
Germany"). Per diem and mileage are computed from the itinerary with country rates and shown with their working.
Company card transactions and bank lines are matched to receipts and claims. Travel is pre-approved against the
project budget and recorded as a commitment. Tracked time is evidence: a line on a project the person did not work on
near that date is flagged. Spend per project and client is live on a dashboard. Agents draft claims through MCP tools
with a preview.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** an employee back from a client visit, **when** they photograph three receipts with the app on their phone, **then**
  within 20 seconds three draft lines show vendor, date, amount, currency, tax and a suggested category and project
  (the project they tracked time on that day), each field marked with its confidence; they fix one category and submit.
- **Given** a meals policy of 40 EUR a day in Germany, **when** the employee types a 52 EUR dinner in Berlin, **then**
  the form says "12 EUR over the daily meals limit for Germany (40 EUR): add a justification or it will be approved at
  40 EUR" before anything is submitted.
- **Given** a receipt already in a colleague's claim, **when** it is attached, **then** the line is flagged as a
  possible duplicate naming that claim.
- **Given** a submitted claim of 640 EUR, **when** the resolved approver taps the inbox item and approves 600 EUR,
  lowering one line with a comment, **then** the claim is approved, the lines carry approved amounts, the employee is
  notified, and with accounting on one journal posts each line's expense by category and project, recoverable tax and
  the amount payable to the employee; the lines now appear in the existing expense report.
- **Given** approved claims to reimburse by payment, **when** finance builds a payment order of employee items and
  exports the bank file, **then** each claim shows reimbursed when its payment is confirmed.
- **Given** a claim with reimbursement through payroll, **when** it is approved, **then** it waits for the next regular
  pay run as a reimbursement outside gross pay and shows reimbursed when that payslip is paid.
- **Given** a travel request Paris–Berlin for three days with flights, hotel and an advance of 300 EUR, **when** it is
  submitted, **then** the approver sees the estimate with per diem computed, the project's cost budget left and the
  budget line's availability; on approval the estimate is committed against the budget and the advance goes to
  finance for payment.
- **Given** the trip is over, **when** the employee builds the claim from it, **then** per-diem lines appear for each
  day (a partial day for travel days, less the hotel breakfast), the mileage to the airport is computed at the
  country's rate band, the trip's receipts are attached, the 300 EUR advance is applied and 182 EUR remains payable.
- **Given** 120 EUR of an advance unspent when the trip closes, **when** the manager chooses "recover from pay",
  **then** the next payslip deducts 120 EUR and the advance shows recovered and closed.
- **Given** a company card account in banking, **when** an 89 EUR hotel charge arrives, **then** the card holder sees
  it under "to explain" with the matching receipt proposed; one tap makes it a claim line paid by company card that is
  never reimbursed, and the card statement line is reconciled against it.
- **Given** a delivery van, **when** the driver logs 42 litres and an odometer of 81,240 km paid with their own money,
  **then** "create claim" makes a claim of the fuel, and the vehicle expenses report shows cost per kilometer.
- **Given** a billable approved line for client Acme on project Website, **when** the next invoice for Acme is
  prepared, **then** the line is offered once, at cost or with the project's markup, and the project spend dashboard
  updates within seconds of the approval.
- **Given** an assistant acting for an employee through MCP, **when** it drafts a claim from a trip and receipts,
  **then** it returns a preview with lines, policy findings and duplicates and saves nothing until the employee
  confirms.

### 2.2 Edge cases & failures

- **Given** the feature off, **when** anyone uses expenses, **then** everything is as today and new routes answer `404`.
- **Given** the resolved approver is the claimant, **when** the claim is submitted, **then** it goes to the next
  approver in the chain; nobody approves their own claim.
- **Given** two approvers deciding at once, **when** both submit, **then** one wins and the other gets `409`.
- **Given** accounting on and a category without a determinable account, **when** the claim is approved, **then**
  refused naming the category; a posting date in a locked period is refused naming the period.
- **Given** advances of 500 EUR applied to a claim approved at 400 EUR, **then** refused: applications never exceed
  the approved total or an advance's unsettled amount.
- **Given** a reimbursed claim, **when** someone cancels it, **then** refused until the payment is cancelled.
- **Given** an odometer reading below the last one of that vehicle, **then** refused naming the last reading.
- **Given** receipt reading failing or turned off, **then** the receipt stays attached and the line is typed by hand.
- **Given** a travel estimate above the budget line with a blocking control, **then** the request needs the budget
  approval step before it can be approved.
- **Given** an employee whose work ended, or an agent employee, **when** a claim or advance is filed for them,
  **then** refused naming the employee.

## 3. Functional Requirements

### 3.1 Enabling, settings and categories

| ID | Requirement |
| --- | --- |
| **FR-1** | With `FEATURE_EXPENSE_CLAIMS` off nothing of the feature loads, and direct expenses, categories, split, recurring expenses, the expense report, statistics, invoicing of expenses and the existing MCP tools behave as today. |
| **FR-2** | A user with `EXPENSE_POLICIES_EDIT` can set per organization: claim currency (organization currency only, or any), reimbursement channels and default, approver mandatory, submission deadline, receipt threshold, receipt reading on or off (content then goes to the organization's configured AI provider), travel requests, vehicle log and card programme on or off, and default re-billing markup. |
| **FR-3** | A user with `EXPENSE_POLICIES_EDIT` can give each existing expense category: kind (general, travel, meals, lodging, per diem, mileage, vehicle, or benefit linked to a benefit pay element of `payroll-setup`, whose yearly eligibility a line is checked against and whose approved lines are always paid through payroll), reimbursable and re-billable defaults, a receipt threshold, a tax category, an option to spread the cost over a number of months, and an active flag; the system adds missing standard categories (travel, meals, lodging, per diem, mileage, phone and internet, other) when first enabled, as ordinary editable categories. |
| **FR-4** | The system MUST, with `general-ledger` on, refuse to approve a claim whose category has no determinable expense account, naming the category. |

### 3.2 Claims and lines

| ID | Requirement |
| --- | --- |
| **FR-5** | An employee with `EXPENSE_CLAIMS_OWN` can create a claim (purpose, period, currency, project, client, optional travel request, reimbursement channel), add, edit and remove lines while it is a draft, submit it and withdraw it before a decision. |
| **FR-6** | The system MUST store each line as an expense of the organization (the existing expense record, its vendor set when the merchant matches an existing vendor and its receipt showing the line's first receipt) with date, category, description, vendor (existing vendor or a free name), amount and currency, rate to the claim currency, tax, project, task, client, billable flag, several receipts, payment source (personal, company card, company account) and the working of computed lines (per diem, mileage). |
| **FR-7** | The system MUST keep claim lines out of the existing expense lists, report, statistics, split and invoicing until approved, and keep rejected or cancelled lines out for good; the existing expense edit and delete routes refuse a claim line, which only the claim workflow changes, and keep working as today for every other expense. |
| **FR-8** | A user with `EXPENSE_CLAIMS_EDIT` can file claims for other employees; others are refused; claims for an employee not active on the line dates (active check of `hr-core-lifecycle`, else start and end of work), of another organization or of kind agent are refused. |
| **FR-9** | The system MUST show claimed, approved, tax, advances applied and payable totals, in the claim currency and the organization currency. |
| **FR-10** | The system MUST, when any currency is allowed, convert each line at the rate of its date from the platform's exchange rates, accept a rate from the receipt or card statement with a reason, and force the organization currency otherwise. |
| **FR-11** | The system MUST number claims, advances and travel requests through numbering series and keep each record's history of states, decisions and changes. |
| **FR-12** | The system MUST refuse submitting a claim without lines, with a line blocked by policy, or with a missing receipt above the threshold unless the policy accepts a declaration with a reason; lines older than the submission deadline warn or are refused per policy. |

### 3.3 Policies, receipts and duplicates

| ID | Requirement |
| --- | --- |
| **FR-13** | A user with `EXPENSE_POLICIES_EDIT` can define policies scoped to organization, branch, department, group or level: limits per item, day, trip and month by category, country and city class; receipt threshold; allowed categories; required fields (project for billable lines, attendees for meals); submission deadline; weekend and holiday spending; each limit warning, requiring a justification, capping at the limit or blocking. |
| **FR-14** | The system MUST check policies while a line is typed and return each finding with its rule, scope, limit, amount and consequence in words, store the findings on the line and show them to approvers. *(advanced)* |
| **FR-15** | The system MUST suggest the approved amount at the limit for capping rules, require text for justification rules and block submission for blocking rules. |
| **FR-16** | The system MUST flag for the approver a line on a project where the claimant tracked no time within two days of the expense date. *(advanced)* |
| **FR-17** | An employee can add receipts by upload, phone camera, sharing from the phone (the installable Gauzy web app) or forwarding an email to their personal receipt address (an inbound address of the documents feature, revocable and with allowed senders); receipts not yet on a line wait under "my receipts". |
| **FR-18** | The system MUST, when receipt reading is on, read a receipt into a proposed line (vendor, date, total, currency, taxes, card digits, items, category from vendor history, project from the travel request or tracked time) with a confidence per field, and never submit it on its own. *(advanced)* |
| **FR-19** | The system MUST check every receipt and line for duplicates — same file fingerprint, or same vendor, date and amount within tolerance — across the organization's claims and card transactions, naming the other record; only an identical file already in an approved claim blocks. *(advanced)* |

### 3.4 Taxes, approval and postings

| ID | Requirement |
| --- | --- |
| **FR-20** | The system MUST compute line taxes through the tax engine when `tax-engine` is on (from the category's tax category and the vendor's country, with the recoverable share) or take them from the receipt, else use the existing tax fields; amounts include tax by default, tax-exclusive entry is allowed per line; each tax line may carry its own project and cost centre. |
| **FR-21** | The system MUST route claims to `approval-workflows` when on (record type expense claim; default definition: resolved approver, then holders of `EXPENSE_CLAIMS_APPROVE` above an amount set by the organization), otherwise as request approvals on the existing Approvals page to the approver resolved by `hr-core-lifecycle` for kind expenses, else to holders of `EXPENSE_CLAIMS_APPROVE`; a mandatory approver missing refuses submission naming what to set up; nobody approves their own claim. |
| **FR-22** | The system MUST let the approvers of a claim read it, its lines, receipts, findings and duplicates for their decision without other expense permissions. |
| **FR-23** | An approver can approve all, approve with per-line amounts no higher than claimed (zero rejects the line) and a comment per changed line, reject with a reason, or return for changes; one concurrent decision wins and the other gets `409`; the inbox item shows totals, findings, duplicates and budget and decides in one tap. |
| **FR-24** | The system MUST, with `general-ledger` on, publish the approved claim for posting: each line's expense by category, project, task, cost centre and dimensions; recoverable tax per tax line; the payable to the employee as party; company-card lines against the card liability; applied advances against the employee's advance; on the posting date chosen at approval (default that day), checked against period locks. |
| **FR-25** | A user with `EXPENSE_CLAIMS_APPROVE` can change category, project, task, cost centre and dimensions of approved lines through a recorded change that reposts; amounts never change after approval. |
| **FR-26** | The system MUST allow cancelling an approved claim only while nothing is reimbursed or applied, posting the reversal and taking its lines out of reports. |
| **FR-27** | The system MUST hand lines of categories spread over months to `budgets-and-revenue-schedules` as deferred cost with their months, and work without journals when `general-ledger` is off. |

### 3.5 Reimbursement and advances

| ID | Requirement |
| --- | --- |
| **FR-28** | The system MUST, for the payment channel, open the payable of an approved claim as an open item of the employee, payable through `payments-and-collections` (single payment or payment order with bank file), and derive the claim's state (not due, open, partly reimbursed, reimbursed) from it, following cancelled payments. |
| **FR-29** | The system MUST, for the payroll channel, propose the payable to `payroll-processing` as a reimbursement outside gross pay in the next regular run, show reimbursed when that payslip is paid, and withdraw it if the claim is cancelled before. |
| **FR-30** | A user with `EXPENSE_CLAIMS_REIMBURSE` can mark a claim reimbursed with date, method and reference when payments are not loaded. |
| **FR-31** | An employee can request an advance (purpose, amount above zero, currency, date needed, optional travel request, preferred payment method); a holder of `EXPENSE_CLAIMS_EDIT` can request one for others. |
| **FR-32** | The system MUST route advances like claims (record type advance) and, on approval, hand the payout to `payments-and-collections`; the paid amount never exceeds the approved amount, and a paid advance is money the employee holds until settled. |
| **FR-33** | The claimant or approver can apply paid, unsettled advances of the claimant to a claim, each up to the advance's unsettled amount (converted at the claim's rate when currencies differ) and in total up to the approved claim; applications reduce the payable. |
| **FR-34** | A holder of `EXPENSE_CLAIMS_REIMBURSE` can settle an unsettled amount by a repayment from the employee or by recovery from pay through `payroll-processing`, never above the unsettled amount, or both. |
| **FR-35** | The system MUST derive an advance's state (requested, approved, paid, partly settled, settled by claims, returned, recovered, closed, cancelled), allow cancelling an unpaid advance, and refuse cancelling a paid one unless the organization lets cancellation release its payment allocations. |
| **FR-36** | The system MUST remind the employee of an advance unsettled a set number of days after the trip end or date needed, and give `hr-core-lifecycle` unpaid claims and unsettled advances as sources of a final settlement. |

### 3.6 Company cards and bank feeds

| ID | Requirement |
| --- | --- |
| **FR-37** | A user with `EXPENSE_CARDS_MANAGE` can link company card accounts of `banking-and-reconciliation` to card holders (employee and last digits). *(advanced)* |
| **FR-38** | The system MUST list each holder's card transactions to explain with a proposed category, project and matching receipt; explaining one makes a claim line paid by company card, never reimbursed. *(advanced)* |
| **FR-39** | The system MUST propose matches of receipts to card transactions (amount, date within three days, vendor name, card digits) and of reimbursements to outgoing bank lines, and offer explained card lines to bank reconciliation as counterparts of the card statement lines. *(advanced)* |
| **FR-40** | The system MUST remind holders of unexplained card transactions after a set number of days, escalate to their manager later, and turn a transaction marked personal into an amount the employee owes, settled as in FR-34. *(advanced)* |

### 3.7 Projects, clients and spend

| ID | Requirement |
| --- | --- |
| **FR-41** | The system MUST add approved lines to the expense totals of their project and task, count them in project cost budgets and offer its maintained spend figures to `project-costing-and-billing`, which keeps no expense figures of its own; those figures include direct expenses, those recorded before the feature was switched on and every later change to them. |
| **FR-42** | The system MUST offer approved billable lines to invoices of their client once, at cost or with the markup of the project or organization, through the existing invoicing of expenses, and mark them invoiced. |
| **FR-43** | The system MUST show a spend dashboard per project and per client — approved, pending, re-billable not invoiced, invoiced, cost budget used, top categories and people — updated within 5 seconds of a decision. *(advanced)* |
| **FR-44** | The system MUST notify the project manager when approved plus pending spend crosses 80 % and 100 % of the project's cost budget. *(advanced)* |

### 3.8 Travel

| ID | Requirement |
| --- | --- |
| **FR-45** | An employee can request travel for a purpose, a project and a client: the journey as legs (origin and destination with their countries, means of transport, departure and arrival times), stays (city, nights, accommodation needs), the traveler's dietary and accessibility notes, who pays (the organization, a named third party, or shared with that party's percentage), the host contact at the destination, and an estimate per expense category with the part a third party pays; the trip is domestic or international from the countries of its legs. |
| **FR-46** | The system MUST NOT copy identity documents into the request; when `hr-core-lifecycle` holds a passport or identity document of the traveler, the request shows whether it is valid through the return date and warns otherwise. |
| **FR-47** | The system MUST route travel requests to `approval-workflows` when on (record type travel request), otherwise through the existing request approval of type business trip linked to the request, whose decision moves it; existing business-trip requests keep working and can be turned into travel requests. Only a business-trip request linked to a travel request asks its decider for the travel approval right or to be named on it; every other business-trip request is decided by the same people as today. |
| **FR-48** | The system MUST show, before submission and to the approver, the estimate against the project's cost budget left and, with budgets on, the availability of the budget line; on approval record the estimate as a commitment, released by approved claims of the trip and when the trip closes. *(advanced)* |
| **FR-49** | The system MUST add the per diem computed from the legs and rates (FR-52) to the estimate. *(advanced)* |
| **FR-50** | A traveler can, from an approved request, request an advance prefilled from it and later build a claim prefilled with per-diem lines, mileage legs and the trip's receipts; the request shows estimate against actual and closes when its claims are decided. |
| **FR-51** | A traveler can attach booking documents to legs; booking itself is not done by the platform. |

### 3.9 Per diem, mileage and vehicle log

| ID | Requirement |
| --- | --- |
| **FR-52** | A user with `EXPENSE_POLICIES_EDIT` can maintain dated per-diem rates per country and optional region or city: daily amount, lodging cap, deductions for provided meals, partial-day rules by hours away, first and last day rules; country content can be loaded from regional packs when present. *(advanced)* |
| **FR-53** | The system MUST compute per-diem lines per travel day from leg times, destination and declared provided meals, show the working, and let the traveler lower but not raise them. *(advanced)* |
| **FR-54** | A user with `EXPENSE_POLICIES_EDIT` can maintain dated mileage rates per country and vehicle kind (car, electric car, motorcycle, bicycle) with yearly distance bands and a passenger supplement; a mileage line (date, from, to, purpose, vehicle, distance entered or proposed by a configured distance provider, return trip) is priced at the band reached by the employee's distance this year, with its working. *(advanced)* |
| **FR-55** | A user with `EXPENSE_VEHICLES_MANAGE` can use as company vehicles the equipment items marked as vehicles (shared with delivery trips), and an employee can register private vehicles (registration, kind) for mileage. |
| **FR-56** | A driver or holder of `EXPENSE_VEHICLES_MANAGE` can log a vehicle's refuelling (odometer, litres or kilowatt-hours, price, station, receipt, who paid: company card, employee or company account) and its service work (work items from a seeded, editable list, cost); for a company vehicle held as an asset of `fixed-assets`, the odometer reading is recorded on the asset and the next due service and its reminder come from the asset's maintenance plan. |
| **FR-57** | The system MUST refuse an odometer reading not above the vehicle's last reading from the log and delivery trips. |
| **FR-58** | A driver can create one claim from a log entry paid by the employee (fuel and service lines); cancelling the entry cancels its draft claim and is refused once the claim is approved. |
| **FR-59** | A driver can create a claim from a delivery trip of `delivery-and-shipping` (fuel, tolls, parking) prefilled with date, vehicle and distance. |

### 3.10 Reports

All reports are report definitions: filterable, groupable, exportable, schedulable and clonable.

| Requirement | Report | Answers | Filters and grouping |
| --- | --- | --- | --- |
| **FR-60** | Claims to reimburse | What the organization still owes each employee and since when, by channel | period, team, department; grouped by any organization axis |
| **FR-61** | Advances | Money out with employees: paid, used on claims, paid back and still open, with age | period, team, department, state |
| **FR-62** | Vehicle costs | Energy and service cost per vehicle, distance driven and cost per kilometer | period, vehicle |
| **FR-63** | Claims by category (chart) | Approved spend per category | dates, organization, department |
| **FR-64** | Claims by department (chart) | Approved spend per department | dates, organization |
| **FR-65** | Advances by state (chart) | Advance count and amount per state | dates, organization |
| **FR-66** | Claims over time (chart) | Claimed and approved totals per month | dates, organization, department |
| **FR-67** | This month (cards) | Approved, rejected and submitted claims | organization, department |
| **FR-68** | Policy findings and duplicates | Findings per rule, justified, capped and blocked amounts, duplicates *(advanced)* | dates, policy, department |
| **FR-69** | Travel estimate and actual | Estimated against claimed per trip, project and category *(advanced)* | dates, project, traveler |
| **FR-70** | Existing expense report | Gains a source filter (direct, claim, card, vehicle log); approved claim lines included | as today plus source |

### 3.11 API, agents and compatibility

| ID | Requirement |
| --- | --- |
| **FR-71** | The system MUST expose every action through the REST API and register claims, advances, travel requests and vehicle log entries as record types for saved views, custom fields, approval definitions and automation triggers. |
| **FR-72** | The system MUST publish events (claim submitted, decided, cancelled, reimbursed; advance decided, paid, settled; travel request decided and closed; receipt read; card transaction to explain) on the event outbox for postings, payroll, budgets, automations, webhooks and real-time updates. |
| **FR-73** | The system MUST keep the existing expense MCP tools and add tools to draft a claim from receipts or a trip, check policy, submit, decide, request and apply advances, request travel with an estimate, list card transactions to explain and read the spend dashboard; writing tools return a preview first and act with the caller's permissions. |
| **FR-74** | The system MUST import claims history, advances, per-diem and mileage rates through the mapped import with errors per row. |
| **FR-75** | The system MUST grant `EXPENSE_CLAIMS_OWN` to the employee role, approval keys to managers for their reports and the other keys to administrators, effective only while the feature is on. |
| **FR-76** | The system MUST record who, when, before and after for every claim, line, decision, policy, rate, card link and log entry change. |
| **FR-77** | Existing expense rows, direct entry, split, recurring expenses, statistics and invoicing of expenses MUST keep working unchanged; direct expenses never need approval. |
| **FR-78** | The employee's own expense screens (take a receipt photo, submit a claim, follow its approval and reimbursement, request and settle an advance, request travel, keep the vehicle log) MUST be pages of the Gauzy web app laid out for phone width and installable on the phone, with the camera and the phone's share sheet; no other app is needed. |

## 4. Non-Functional Requirements

- **Performance**: policy check answers under 300 ms at the 95th percentile while typing; receipt reading under 20 s
  at the 95th percentile; claim and expense lists under 300 ms at one million expenses per tenant; approval under
  500 ms excluding asynchronous postings; spend dashboards read maintained figures, never raw scans.
- **Data volume and concurrency**: 10 million claim lines per tenant; one decision per claim (row lock and version);
  advance applications serialized per claim and per advance so they never exceed the advance's unsettled amount or the
  claim's approved total.
- **Reliability**: receipt reading, payroll hand-off, open items and postings are idempotent by source key; a failed
  posting leaves the claim approved with the posting state shown and retried.
- **Security & privacy**: tenant and organization scoped; receipts visible to the claimant, approvers and finance;
  card numbers never stored beyond last digits; identity documents read, not copied; leaves the platform: receipt
  content to the organization's configured AI provider only when reading is on, notification emails, bank files
  through payments, exports.
- **Observability and audit**: history per record, extraction accuracy (fields accepted unchanged), policy findings
  by rule, time to approve and to reimburse, audit of FR-76.
- **Accessibility and localization**: forms and dashboards keyboard operable and labelled; amounts in the user's
  number format and currency; every string in every locale.
- **Compatibility**: PostgreSQL, MySQL and SQLite; both ORMs; cloud and self-hosted; existing expense routes and MCP
  tools unchanged; additive OpenAPI and SDK changes only.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| `Expense` (extended) | The existing expense record; a claim line is an expense with an approval state and a source |
| `ExpenseClaim` | An employee's request to be paid back for one or more expenses |
| `ExpenseClaimLine` | Claim-specific facts of one expense: claimed and approved amounts, receipts, findings, working |
| `ExpenseCategory` (extended) | The existing category, with kind, defaults, tax category, spreading and, for benefits, the benefit pay element |
| `ExpensePolicy`, `ExpensePolicyRule` | Limits and requirements scoped to groups of employees |
| `ReceiptCapture` | A receipt file and what was read from it |
| `ExpenseAdvance`, `AdvanceApplication` | Money paid to an employee before spending; its use against a claim |
| `CardHolder`, `CardTransactionExplanation` | A company card linked to an employee; a card charge to explain |
| `TravelRequest`, `TravelLeg`, `TravelStay`, `TravelCostEstimate` | A trip to approve, its journeys, its nights away and its estimated costs |
| `PerDiemRate`, `MileageRate` | Dated country rates for daily allowances and distance |
| `EmployeeVehicle`, `VehicleLogEntry` | A private vehicle for mileage; fuel, odometer and service of a vehicle |
| `SpendFigure` | Maintained spend per project, client and month for dashboards |

## 6. Out of Scope

- Payments, payment orders, bank files and allocation mechanics: `payments-and-collections`; bank statement import
  and reconciliation: `banking-and-reconciliation`; journals and accounts: `general-ledger`.
- Pay calculation of reimbursements and recoveries: `payroll-processing`; approval engine: `approval-workflows`;
  budget lines and control: `budgets-and-revenue-schedules`; project profitability: `project-costing-and-billing`.
- Supplier bills for travel booked by the company: `invoicing-receivables-payables`; delivery trips and fleet:
  `delivery-and-shipping`; tax rules: `tax-engine`; country rate content: `regional-compliance-packs`.
- Booking travel with outside providers; supplier invoice capture: `invoicing-receivables-payables`; service plans and
  meter readings of company vehicles: `fixed-assets`; benefit elements and their yearly limits: `payroll-setup`.

## 7. Acceptance Criteria

- [ ] **AC-1** A claim with three lines in two currencies is drafted, checked, submitted, partly approved and appears
      in the existing expense report only after approval, with approved amounts (FR-5, FR-9, FR-12).
- [ ] **AC-2** Receipts read into proposed lines with confidences; a duplicate across employees is flagged; nothing is
      submitted without the employee (receipt assistant) (FR-18).
- [ ] **AC-3** A meals limit warns, caps and blocks per rule with an explanation while typing; a line on a project
      without tracked time is flagged (policy engine) (FR-13, FR-15).
- [ ] **AC-4** Approval with accounting on posts expense, recoverable tax and employee payable; a category change
      reposts; cancelling a reimbursed claim is refused (FR-20, FR-24, FR-25).
- [ ] **AC-5** Reimbursement by payment order and by payroll each mark the claim reimbursed exactly once (FR-28–FR-30).
- [ ] **AC-6** An advance is paid, applied to a claim, its rest recovered from pay; applications never exceed limits (FR-33–FR-35).
- [ ] **AC-7** A card charge is explained into a non-reimbursable line and reconciled in banking (card matching) (FR-37–FR-39).
- [ ] **AC-8** A travel request computes per diem, shows budget left, records a commitment on approval and builds the
      claim with per diem, mileage and receipts; the commitment is released (pre-approval) (FR-48, FR-49).
- [ ] **AC-9** Mileage uses the yearly band; per diem shows its working; vehicle log refuses a lower odometer (FR-53, FR-54, FR-57, FR-58).
- [ ] **AC-10** A billable line is invoiced once to its client with markup; the project dashboard updates within 5 s (FR-41–FR-43).
- [ ] **AC-11** Reports FR-60 to FR-70 match a seeded month.
- [ ] **AC-12** Self-approval, inactive and agent employees are refused; concurrent decisions answer `409` (FR-22, FR-23).
- [ ] **AC-13** With the feature off, and on for requests not linked to a travel request, a business-trip request
      approval is decided by the same users as today; the expenses list shows the same columns and rows (FR-47).
- [ ] **AC-14** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-1).
- [ ] Works on PostgreSQL, MySQL and SQLite with both ORMs.
- [ ] Behind `FEATURE_EXPENSE_CLAIMS`; with it off, existing expense suites pass unchanged.
- [ ] All functional requirements have a passing test.

## 8. Open Questions

- Claim lines are expense rows from the first draft and existing reads count them only once approved (applied); the
  alternative of creating expense rows at approval was rejected as a second model.
- Reimbursement through payroll uses a new additional-pay kind "expense reimbursement" paid outside gross (applied);
  `payroll-processing` adds the value additively.
- The tracked-time flag looks two days around the expense date (applied); a setting can widen it.
- Amounts include tax by default (applied).
- Personal charges on company cards are recovered like advances (applied).

## 9. Constitution Gates

- [x] I Plugin-first — new plugin `expense-claims` with UI plugins; core expense gains three nullable columns and one
      read filter, nothing parallel.
- [x] II Tenant/organization scoping — every record scoped; approvers read only the claims they decide.
- [x] III Both ORMs, additive migrations — nullable columns and new tables, three dialects.
- [x] IV Default-off flag; nothing removed — `FEATURE_EXPENSE_CLAIMS`; direct expenses unchanged.
- [x] V Contracts and API first; backwards compatible — existing expense contract gains optional fields only.
- [x] VI Permissions, privacy, security — new keys; card digits only; receipts to the AI provider only when enabled.
- [x] VII Real-time through the event bus — outbox events; live dashboards and inbox items.
- [x] VIII i18n and accessibility — keys in every locale; accessible forms.
- [x] IX Tests accompany the change — policies, totals, limits, idempotent hand-offs, ORM parity.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Related features: [`payments-and-collections`](../payments-and-collections/spec.md),
  [`invoicing-receivables-payables`](../invoicing-receivables-payables/spec.md), [`general-ledger`](../general-ledger/spec.md),
  [`approval-workflows`](../approval-workflows/spec.md), [`payroll-processing`](../payroll-processing/spec.md),
  [`budgets-and-revenue-schedules`](../budgets-and-revenue-schedules/spec.md),
  [`banking-and-reconciliation`](../banking-and-reconciliation/spec.md), [`hr-core-lifecycle`](../hr-core-lifecycle/spec.md),
  [`delivery-and-shipping`](../delivery-and-shipping/spec.md), [`tax-engine`](../tax-engine/spec.md)
- Existing code (`packages/core/src/lib/`): `expense` (`expense.entity.ts`, `expense.service.ts`,
  `expense.controller.ts`), `expense-categories`, `employee-statistics`, `organization-recurring-expense`,
  `employee-recurring-expense`, `request-approval` (business-trip type), `packages/mcp-server/src/lib/tools/expenses.ts`
- Related architecture: [platform architecture](../../architecture/business-suite.md) §2.5 (expenses and travel), §3.4, §3.6, §3.8, §3.12
