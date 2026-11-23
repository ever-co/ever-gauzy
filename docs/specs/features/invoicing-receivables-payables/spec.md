# Feature Specification: Invoicing, receivables and payables

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `invoicing-receivables-payables`
**Branch**: `feat/invoicing-receivables-payables`
**Status**: `Draft`
**Created**: 2026-11-15
**Last updated**: 2026-11-23
**Owner**: evereq
**Feature flag**: `FEATURE_RECEIVABLES_PAYABLES` (new tenant feature, default off) on top of the existing `FEATURE_INVOICE`; deployment switch `GAUZY_RECEIVABLES_PAYABLES_ENABLED` (only the exact value `true` loads the plugin)

---

## 1. Overview

Today an invoice is a document a person fills in and emails: totals are computed in the browser, nothing follows from
it, a wrong invoice is corrected by a new one, and a supplier's bill is a row only the API can write. This feature turns
the same invoice record into the commercial document of both sides of the business. A **customer invoice**, a **supplier
bill**, a **credit note** and a **debit note** are one record with a direction and a kind; each is drafted,
**confirmed** (numbered from its own series, split into instalments that become **open items**, and frozen where the
organization chooses) and, when
needed, cancelled or corrected by a linked note. Documents are built from orders, deliveries, receipts, time, expenses,
milestones and subscription cycles, and publish one event per confirmation from which the ledger posts. Its open items
are the platform's one record of what is owed, with or without the ledger. One API serves the Angular app, the MCP
server and the SDKs.

**Advanced capabilities.** (1) A **billing worklist** shows everything billable per customer, approved tracked time
included, and builds invoices in one step, each source billed once. (2) Bills are **matched with tolerances**;
mismatches wait in an **exception queue** that clears itself when the missing receipt arrives. (3) A supplier's document
dropped into the app becomes a **draft bill with confidence marks**, never confirmed without a person. (4) A credit
limit never blocks silently: it opens a **credit review** with the facts attached. (5) Open balances and **ageing are
live**. (6) Every action is an MCP tool with a **preview** of its effects.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** a draft customer invoice with the term "30% now, 70% in 30 days", **when** a billing clerk confirms it,
  **then** it takes the next number of the invoice series, its amounts are stored, two open items exist, the customer's
  open balance rises on every open screen, and the ledger receives one event to post from.
- **Given** a confirmed invoice with a wrong price, **when** the clerk credits that line, **then** the credit note is
  capped at the line's uncredited amount, takes the invoice's currency and rate, and lowers its outstanding amount.
- **Given** 120 approved billable hours, two expenses and a reached milestone for a customer, **when** a project manager
  chooses "Build invoice" in the worklist, **then** one draft lists every source and none of them is offered again.
- **Given** a purchase order for 100 units at 10.00 of which 60 were received, **when** a payables clerk records the
  bill for 100 units at 10.40, **then** the line is an exception ("40 not received; price 4% above order, tolerance 2%")
  and waits in the exception queue; once the other 40 arrive and the buyer accepts the price it leaves by itself.
- **Given** a supplier's bill as a file, **when** the clerk drops it on the Bills page, **then** a draft appears with
  vendor, number, dates, lines and totals filled, uncertain fields highlighted, and nothing is confirmed.
- **Given** a customer over the credit limit, **when** a clerk confirms an invoice, **then** the system offers "Request
  credit review"; the approver sees exposure and overdue items, approves once, and the waiting draft confirms.
- **Given** an AI agent with billing permissions, **when** it calls the confirm tool with `preview: true`, **then** it
  receives the number, totals, instalments, stock and ledger effects, and nothing has changed.

### 2.2 Edge cases & failures

- **Given** a user without the confirm permission, **when** they confirm, **then** `403`; with the feature off the new
  routes answer `404`, the menu entries are hidden and existing invoices behave as before.
- **Given** two clerks confirming the same draft at once, **then** one succeeds and the other gets a conflict; no number
  is used twice and no open item is duplicated.
- **Given** a document dated in a locked period, **then** confirming is refused naming the period and the first open
  date; **given** a bulk build for 40 customers where 3 fail, **then** 37 drafts exist and the log lists the 3 failures.
- **Given** a client that went offline while editing a draft, **when** it reconnects, **then** its save is
  accepted if the draft is unchanged, otherwise it is shown the newer version to merge.
- **Given** accounting switched off, **then** everything here works without postings; **given** it is on and a posting
  is refused, **then** the document stays confirmed, marked "posting failed" with the reason, until fixed.

## 3. Functional Requirements

### 3.1 Documents and lifecycle

- **FR-1** The system keeps customer invoices, supplier bills, credit notes and debit notes as one invoice record with a
  direction (receivable, payable) and a kind (invoice, credit note, debit note); estimates are unchanged.
- **FR-2** The system gives each document the document engine's lifecycle (draft, confirmed, cancelled); a draft has no
  series number, no open item and no effect on balances, stock or the ledger.
- **FR-3** A user with `INVOICE_DOCUMENTS_CONFIRM` (receivable) or `BILLS_CONFIRM` (payable) can confirm a draft, all or
  nothing: number allocated, totals stored, instalments stored, source quantities rolled up, one event appended.
- **FR-4** The system numbers each direction and kind from its own numbering series per organization; the existing
  numeric invoice number stays filled and unique per tenant.
- **FR-5** An organization can lock confirmed documents (setting, default off). With the lock on, a confirmed
  document's party, currency, dates, lines, taxes and amounts are immutable: tags, notes and references change through
  a recorded change set, anything else through a note or an amendment. With it off, a confirmed document stays
  editable as today: each change is recorded as a change set, re-derives its unpaid open items and publishes an
  amendment event for the ledger.
- **FR-6** A user with `INVOICE_DOCUMENTS_CANCEL` or `BILLS_CANCEL` can cancel a confirmed document; one with active
  settlements is refused with them listed, or has them released first when the organization allows it.
- **FR-7** The system maintains per document three independent facts (lifecycle; sent or viewed; unpaid, partially paid,
  fully paid or overpaid) and the flags overdue, on hold, credited, disputed, financed and posting failed, keeps the
  existing status value in step, and records every change in the document's history.
- **FR-8** A user with `OPENING_INVOICES_CREATE` can confirm a document marked as opening balance: it creates open items
  for what was owed at cut-over, stays out of sales and purchase figures, and its event says so.

### 3.2 Lines, totals, parties, currency, dates

- **FR-9** The system computes every amount on the server with exact decimals through the document totals pipeline
  (lines, prices, discounts, taxes, rounding, totals); client totals are ignored and a difference is a warning.
- **FR-10** The system lets a line state an item or description, quantity, unit, unit price, line discount (percent or
  amount), tax category, project, task, employee or expense, dimension values, service period and stock location.
- **FR-11** The system takes taxes per line from the tax engine and stores them as tax lines; the two typed tax
  percentages of today's form keep working where no tax category applies.
- **FR-12** The system applies a document discount (percent or amount, before or after tax by organization setting),
  spreads it over the lines in proportion, classes it as a trade or a settlement discount, and carries an order's
  discount onto its invoices in proportion to what is billed, so that partial invoices together carry it exactly.
- **FR-13** The system accepts a coupon code on a draft, validated and applied by the pricing engine, counted as used on
  confirmation and returned on cancellation.
- **FR-14** The system rounds the total to the currency's precision or the organization's cash rounding step and shows
  the difference as a rounding adjustment; an organization can switch total rounding off.
- **FR-15** An organization can refuse to confirm a negative total, and a negative quantity or price outside a credit
  note (setting, default off: accepted as today, a negative total opening a credit open item).
- **FR-16** The system copies sales shares and commissionable amounts per line from the source order onto the draft.
- **FR-17** The system refuses a document whose party is blocked through `sales-order-management` or whose line names
  an item restricted to other parties; where the organization switches the party check on (setting, default off, as
  today), it also refuses a party that is inactive or not allowed for the organization, and an address or contact
  person that is not the party's.
- **FR-18** The system stores the customer's order reference, the supplier's invoice number and date, the addresses,
  delivery terms and billing period, and snapshots on confirmation both sides' legal name, address and tax identifier.
- **FR-19** The system defaults the currency from the party's contracted currency, else the organization's, and refuses
  another currency for a party restricted to its contracted one.
- **FR-20** The system takes for a foreign-currency document the rate valid on its date (on a bill optionally the
  supplier's invoice date), stores it, refreshes it while draft and accepts a recorded positive override; such documents
  need the multi-currency feature, which stays on for every tenant that already holds them.
- **FR-21** The system refuses to confirm a document dated in a period locked or closed in `general-ledger` or, where
  the ledger keeps fiscal years, outside every one of them (offering the first open date); it warns on a due date
  before the document date (refused where the organization chooses) and on credit days above the party's.
- **FR-22** The system defaults the payment term from the source order, then the party, then the organization's default;
  an organization can choose to skip the source order's term.

### 3.3 Instalments and open items

- **FR-23** The system derives the instalments from the payment term on confirmation and stores each as an open item
  (sequence, due date, amount, outstanding); they sum to the amount payable (the total less tax withheld at source).
- **FR-24** A user with `INVOICES_EDIT` or `BILLS_EDIT` can change a draft's instalment plan (count, dates, amounts) and
  give an instalment an early-settlement discount (percent or amount, until a date or for some days) and a payment
  method; the plan must equal the amount payable, no due date precedes the document date, equal dates warn.
- **FR-25** The system answers for any open item and date the discount still available and the net amount to pay, and
  holds the organization's choice of whether such a discount reduces tax in proportion.
- **FR-26** The system marks an open item overdue when its due date has passed in the organization's time zone with an
  amount outstanding; a document is overdue when any open item is, and shows its earliest unpaid due date.
- **FR-27** The system changes an open item's outstanding amount only through recorded entries (settled, released,
  credited, written off, rescheduled) naming their cause, never below zero; a concurrent second writer gets a conflict.
- **FR-28** A user with `OPEN_ITEMS_RESCHEDULE` can move the dates or re-split the unpaid instalments of a confirmed
  document with a reason; the total is unchanged and reminders count from the new dates.

### 3.4 Invoices from orders, deliveries and estimates

- **FR-29** A user with `INVOICES_EDIT` can create an invoice from one or several sales orders, deliveries or an
  accepted estimate of one party and currency, choosing lines and partial quantities; each line links to its source.
- **FR-30** The system rolls billed quantity and amount up onto the source lines (not, partially, fully billed) and
  takes them back on cancellation and credit notes.
- **FR-31** The system refuses billing beyond the source plus the engine's tolerance (without
  `INVOICE_DOCUMENTS_OVERBILL`) and billing a closed source line; organization or item may require an order or delivery.
- **FR-32** A user with `INVOICES_EDIT` can invoice a deposit for an order (percent or amount); the final invoice
  deducts the deposits.
- **FR-33** The system offers from a confirmed document the follow-on actions record payment, request payment, credit
  note, debit note, delivery, dunning notice, financing and service plan, each done by its owning feature.
- **FR-34** The system records the recurrence or subscription a document came from and its billing period; today's
  recurring invoices for billable time keep running and can produce drafts or confirmed documents.

### 3.5 Credit notes and debit notes

- **FR-35** A user with `CREDIT_NOTES_CREATE` can credit all or some lines of a confirmed invoice or bill with a
  governed reason, capped at what remains uncredited per line; with no original: `CREDIT_NOTES_CREATE_STANDALONE`.
- **FR-36** The system gives a credit note the original's party, currency, exchange rate and tax treatment, and reverses
  the original line's tax instead of taxing anew.
- **FR-37** The system applies a confirmed credit note first to the original's unpaid open items (latest due first, or
  as picked) and turns the remainder into a credit open item; a fully offset original is flagged credited.
- **FR-38** The system returns stock for a credit note line when the original moved stock itself, or links the line to a
  goods return; a line that returns stock must state a quantity other than zero.
- **FR-39** A user with `CREDIT_NOTES_CREATE` can issue a debit note against an earlier document (price correction,
  fee): own series, linked to the original, its own open item, never moving stock.
- **FR-40** The system refuses a credit note on an invoice consolidated from register sales, and asks for lines billed
  from tracked time whether the time is released for billing again or stays billed.

### 3.6 Supplier bills and holds

- **FR-41** A user with `BILLS_EDIT` can record, list, view, duplicate, tag and archive supplier bills with vendor, the
  supplier's number and date, lines by item, expense category or description, taxes and terms.
- **FR-42** The system warns on (or refuses, by setting) a second bill with the same vendor and supplier number in a
  fiscal year, and warns on a likely duplicate (same vendor and total, dates within seven days).
- **FR-43** A user with `BILLS_EDIT` can create a bill from several purchase orders and receipts, partly or fully, by
  each item's billing policy (on ordered, on received); organization, vendor or item may require an order or receipt.
- **FR-44** The system can require approval before a bill is confirmed, by amount bands, through the approval workflows;
  without them the confirm permission decides.
- **FR-45** The system passes a bill line's tax category and "withholding applies" mark to the tax engine and stores
  what it returns, including reverse-charged and withheld tax.
- **FR-46** A user with `DOCUMENT_HOLDS_MANAGE` can hold a confirmed bill or invoice that has an amount outstanding
  (never a credit note), with a reason and an optional future release date, change the date and release it.
- **FR-47** The system keeps a held document's open items out of settlement, payment requests, payment batches and
  dunning, lifts the hold on its date, and treats a block on the party itself the same way.

### 3.7 Bill matching, exception queue and capture (advanced)

- **FR-48** The system compares each bill line linked to a purchase line with what was ordered and received (or ordered
  only, for items billed on order) within quantity, price and amount tolerances set per organization or per vendor.
- **FR-49** The system gives each line an outcome (matched, within tolerance, exception) and each exception a cause:
  over received, over ordered, price above order, line not on the order, another vendor's order, currency, no receipt.
- **FR-50** The system lists every open exception in the exception queue with variance amount, age, vendor and buyer,
  and refuses to confirm a bill with an open exception where the organization's matching policy blocks (setting,
  default off: the bill confirms with a warning and its exceptions stay listed); a quantity beyond what remains
  billable on the purchase line stays refused, as today.
- **FR-51** A user with `BILL_MATCH_OVERRIDE` can accept an exception with a reason, send it for approval, ask the buyer
  to correct the order, or reject the line; every resolution is recorded.
- **FR-52** The system re-matches by itself when a receipt, an order change or a bill edit arrives, clears exceptions
  that no longer hold, tells the bill's watchers, and answers for any exception the facts behind it.
- **FR-53** A user with `BILL_CAPTURES_MANAGE` can upload a supplier's document or have it arrive by email at the
  organization's capture address (the same file twice is recognised); the system proposes a draft bill from it: vendor,
  supplier number, dates, currency, lines, totals and order reference, each with a confidence and its place in the file.
  Structured electronic invoices received through a country pack join the same list of captured documents.
- **FR-54** The system never confirms a captured bill by itself, highlights low-confidence fields, remembers corrections
  per vendor, and opens an empty draft beside the file when no AI provider is set or reading fails.

### 3.8 Credit control and credit reviews

- **FR-55** The system computes a customer's exposure per organization in the organization currency: outstanding
  receivable open items, less unallocated credits, plus confirmed orders not yet billed, with the breakdown.
- **FR-56** The system checks, when a customer invoice is confirmed, exposure against the credit limit and the oldest
  overdue item against the overdue threshold (per-customer override or exemption), then warns or requires a review.
- **FR-57** A user with `CREDIT_REVIEWS_REQUEST` can ask for a credit review in one action; the system attaches
  exposure, limit, overdue items and average days late and sends it to the approvers **(advanced)**.
- **FR-58** A user with `CREDIT_REVIEWS_DECIDE` can approve once, approve on condition of a deposit invoice, raise the
  limit or decline, with a note; the requester is told at once and an approved draft confirms **(advanced)**.
- **FR-59** The system lets an approval lapse after seven days (configurable) or when exposure has grown beyond the
  approved figure, and keeps a document awaiting review as a draft whose amounts cannot be edited.

### 3.9 Stock, assets, advances, inter-company documents, accruals

- **FR-60** The system lets an organization allow documents that move stock themselves: confirming such an invoice
  issues, and such a bill receives (rejected quantity apart), the lines' stock through the stock ledger or fails whole;
  refused on debit notes, supplier-delivered lines and lines a delivery or receipt covers, required for pick-list lines.
- **FR-61** The system lists a bundle line's components under it and moves the components' stock.
- **FR-62** The system lets a line carry marks other features act on: an asset bought (category, location) or sold, an
  amount to recognise over a service period, a cost to spread over received goods (with the amount claimed).
- **FR-63** The system lets other features register further sources a line can be created from (subcontract receipts,
  service visits, fees) with the same link, roll-up and tolerance rules.
- **FR-64** The system lists on a draft the party's available advances and credits, proposes them oldest first, lets the
  user pick amounts, and applies them on confirmation dated by the document or by the advance, by setting.
- **FR-65** A user with `INVOICE_DOCUMENTS_CONFIRM` or `BILLS_CONFIRM` can confirm a document as "settled now" with
  method, cash or bank account (required), amount and reference; the payment and its allocation are recorded with it.
- **FR-66** The system proposes a write-off when a document's outstanding rest is within the small-balance threshold.
- **FR-67** The system creates, when a customer invoice to a party representing another organization of the tenant is
  confirmed, the matching supplier bill there (draft, or confirmed by setting) with the same lines, quantities, prices
  and currency, linked both ways, created once and listed on that organization's received invoices page beside the
  received invoice, which stays listed there as today; every invoice received there can be recorded as a bill; the
  user needs `INTERCOMPANY_INVOICES_CREATE`.
- **FR-68** The system requires equal prices on both sides (refuse or warn by setting), switches promotions and
  tax-inclusive pricing off there, marks both for elimination, and keeps their cancellations and credit notes in step.
- **FR-69** The system records, where an organization enables "received, not billed" or "delivered, not billed", an
  accrual entry per confirmed unbilled receipt or delivery line (quantity at order price by item kind), published.
- **FR-70** The system clears an accrual entry by the quantity billed at the accrued price (publishing the clearing and
  the price difference), restores it on cancellation, closes a closed line's rest, and shows accruals as of any date.

### 3.10 Billing worklist and live ageing (advanced)

- **FR-71** The system shows per customer everything billable and unbilled, with amount and age: approved tracked time
  (by project, task and person at its rate), expenses, reached milestones, delivered order lines, due cycles, deposits.
- **FR-72** A user with `BILLING_WORKLIST_BUILD` can build one draft from chosen entries, grouped by project, order or
  source type, with a preview, or build drafts for many customers at once with a result per customer.
- **FR-73** The system bills each source once (it returns when its draft is deleted or its document is cancelled or
  credited with release), offers only approved time where timesheet approval is in force, and shows the rest as waiting.
- **FR-74** The system updates the worklist live as time is approved, deliveries are confirmed and cycles fall due, and
  tells a customer's account owner when unbilled work passes an amount or age the organization set.
- **FR-75** The system maintains per organization, party, direction and currency the outstanding, overdue and not yet
  due amounts, unallocated credits and oldest due date, changed with every open item, and computes the amounts per
  ageing bucket from the due dates when asked, with the organization's one ageing scheme (default 1–30, 31–60, 61–90,
  over 90 days; configurable).
- **FR-76** The system pushes balance changes to open clients (lists, party pages, ageing card), answers open items and
  ageing as they stood on any past date, and offers them as datasets to the report builder.

### 3.11 Events, lists, agents, settings, compatibility

- **FR-77** The system publishes, in the transaction that confirms, cancels or amends a document, one event carrying
  what a posting needs: amounts per line and tax in both currencies, discounts with their class, rounding, withheld tax,
  total and amount payable, parties, account hints, dimension values, open items and links.
- **FR-78** The system never writes ledger entries: with accounting off documents behave the same; with it on a draft's
  preview shows the journal to come, and a refused posting marks the document "posting failed" with the reason. It
  neither creates nor replaces income records, which stay for revenue recorded without an invoice.
- **FR-79** The system presents Invoices, Credit and debit notes, Bills, Open items, Exceptions and Holds as saved-view
  lists with filters on every state, coloured state badges, bulk confirm, send and export, and custom fields; the
  existing invoice and estimate lists keep their columns, filters and actions.
- **FR-80** The system ships default print templates per document kind in every shipped language and sends documents by
  email with PDF and public link as today; today's invoice PDF stays available and stays an organization's template
  until it picks another; the public page keeps working and also shows instalments, notes applied and amount due.
- **FR-81** The system exposes every action of this spec as an MCP tool under the caller's permissions; tools that
  confirm, cancel, credit, build or resolve accept `preview: true` and return the effects without changing anything; an
  agent's actions are marked, and it never decides a review or exception it raised **(advanced)**.
- **FR-82** A user with `RECEIVABLES_PAYABLES_SETTINGS_EDIT` can set per organization the policies this spec names:
  duplicate numbers, required sources, tolerances, credit policy and thresholds, rounding, rate source, discount tax
  treatment, small balances, term precedence, accruals, direct stock, inter-company, buckets, release on cancel, the
  lock of confirmed documents, negative amounts, the party check, due dates before the document date and blocking
  match exceptions (each of the last five off by default).
- **FR-83** The system changes nothing while the feature is off (new routes answer `404`); with it on, every existing
  invoice route keeps working for every document, a document never confirmed through this feature keeps today's
  behaviour in full (editing, sending, payments updating its paid and due amounts), and amount changes through those
  routes are refused only on documents this feature confirmed in an organization that locks confirmed documents (FR-5);
  a tenant that has not switched the feature on keeps it off, also after any later change of the default for new
  tenants.
- **FR-84** The system gives existing invoices their open items when the feature is turned on (sent and unpaid: total
  less recorded payments; drafts stay drafts; void reads as cancelled while its status stays void) in a resumable,
  repeatable run; the invoices stay editable while it runs and after it.

## 4. Non-Functional Requirements

- **Performance**: confirm a 50-line document under 500 ms P95 (postings are asynchronous), 500 lines under 2 s; lists
  under 300 ms P95 at one million documents per tenant; a party's open balance under 100 ms; ageing over 50,000 parties
  under 1 s from maintained balances and due-date indexes; a worklist with 10,000 time entries under 1 s; a capture proposal within 30 s P95.
- **Volume and concurrency**: 10 million lines and 5 million open items per tenant; bulk builds and the first-enable run
  (2,000 invoices per minute or better) run in the background; optimistic versions; re-delivered events change nothing.
- **Auditability**: who, when, before and after for every change to a confirmed document, open item, hold, exception
  resolution, credit decision and setting; agent actions marked.
- **Security & privacy**: tenant and organization scoped; counterpart documents are written only by a system actor of
  the other organization; captured files go only to the AI provider the organization configured, when capture is on.
- **Accessibility, localisation, compatibility**: keyboard operable, labelled screens; every shipped locale; PDFs in the
  recipient's language; PostgreSQL, MySQL and SQLite, both ORMs; cloud and self-hosted; in-process jobs without a queue.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| Invoice document | The existing invoice record with a direction and a kind: customer invoice, supplier bill, credit or debit note |
| Document detail, line detail | The commercial facts this feature adds to a document and to each line |
| Open item | One instalment of a confirmed document, or a credit, with its outstanding amount |
| Open item entry | One recorded change to an open item with its cause |
| Party open balance | Maintained totals and ageing buckets per party, direction and currency |
| Document hold | A stop on settling a document, with reason and release date |
| Match result, match exception | The comparison of a bill line with order and receipt; a mismatch awaiting resolution |
| Bill capture | A received supplier document and the draft proposed from it |
| Unbilled accrual | Value received or delivered and not yet billed |
| Credit review | A request to exceed a credit limit or overdue threshold, with its decision |
| Billing worklist entry, billing claim | Something billable and unbilled; the mark that a draft or document took it |
| Inter-company pair | An invoice and the bill it created in another organization of the tenant |

## 6. Out of Scope

- Payments, allocation, refunds, write-offs, payment requests, statements, dunning, financing, dispute flags:
  `payments-and-collections`; provider checkout: `payment-gateways`.
- Journals, posting rules, party accounts, period locks, rate feeds: `general-ledger`; opening balance accounts:
  `accounting-foundation`; tax calculation and withholding: `tax-engine`; e-invoice formats:
  `regional-compliance-packs`.
- Numbering, lifecycle, links, tolerances, recurrence, bulk creation: `business-document-engine`; orders, credit limits,
  customer master, commissions: `sales-order-management`; purchase orders, receipts, supplier master: `procurement`.
- Stock movements, valuation, landed cost allocation: `warehouse-and-stock-movements`, `stock-ledger-and-valuation`;
  bundles and item restrictions as masters: `item-catalogue`; coupons: `pricing-and-promotions`; asset creation and
  disposal: `fixed-assets`; deferral schedules: `budgets-and-revenue-schedules`; plans and cycles:
  `subscription-billing`; supplied materials on subcontract bills: `subcontracting`.
- Loyalty points redeemed or earned on an invoice, register sales and their returns: `point-of-sale-and-loyalty`; rates,
  timesheet approval and milestones: `project-costing-and-billing`; printable ageing statements and registers:
  `financial-reports`; template design: `print-and-pdf-designer`; portal lists: `customer-and-supplier-portal`.

## 7. Acceptance Criteria

- [ ] **AC-1** Confirming a draft with a two-instalment term yields a series number, two open items that sum to the
      amount payable, a document that is immutable where confirmed documents are locked (and editable with recorded
      change sets otherwise) and exactly one event; a second confirm answers a conflict (FR-4, FR-23).
- [ ] **AC-2** Server totals equal a hand calculation for line discounts, a document discount before and after tax,
      compound taxes and cash rounding, in currencies with zero and with three decimals (FR-9, FR-12).
- [ ] **AC-3** A partial credit note is capped at the uncredited remainder, reverses the original's tax, lowers its
      outstanding amount and leaves a credit open item for any surplus; a debit note adds an open item (FR-35–FR-37).
- [ ] **AC-4** An invoice built from two orders and a delivery rolls quantities up, refuses over-billing beyond
      tolerance and returns them on cancel; a held bill is excluded from settlement until release or its date (FR-29–FR-31).
- [ ] **AC-5** A bill over received quantity or price tolerance waits in the exception queue, cannot be confirmed
      where the matching policy blocks (and confirms with a warning by default), clears itself when the receipt
      arrives, and an override is recorded with its reason (FR-48 to FR-52).
- [ ] **AC-6** A dropped supplier file yields a draft with confidence marks, never confirmed automatically; the same
      file twice is recognised; without an AI provider an empty draft opens (FR-53, FR-54).
- [ ] **AC-7** An invoice over the credit limit opens a credit review; "approve once" confirms the waiting draft; the
      approval lapses when exposure grows (FR-55 to FR-59).
- [ ] **AC-8** The worklist builds one invoice from approved time, an expense, a milestone and a delivered line; each
      source leaves the list and returns after cancel with release; a bulk build reports per customer (FR-71 to FR-74).
- [ ] **AC-9** A party's balance and ageing card change in a second open browser within 2 s of a confirmation, and "as
      of" a past date returns that day's figures (FR-75, FR-76).
- [ ] **AC-10** An inter-company invoice creates one linked bill in the other organization and unequal prices are
      refused; with accruals on, a receipt without bill shows in the accrual register and its bill clears it (FR-63, FR-67, FR-68).
- [ ] **AC-11** A document dated in a locked period or with a blocked party is refused with the rule named, and so is
      one with a foreign address or a negative total once the party check and the negative-amount refusal are on; with direct stock allowed, confirm moves stock and cancel moves it back (FR-17, FR-21).
- [ ] **AC-12** Each MCP tool with `preview: true` returns the effects and changes nothing; agent actions are marked in
      the history (FR-81); each document kind's event carries the fields listed in the plan.
- [ ] **AC-13** The reports below exist as report definitions and return correct figures on seeded data (FR-79).
- [ ] **AC-14** Turning the feature on gives existing unpaid invoices open items once; off restores today's behaviour;
      works on PostgreSQL, MySQL and SQLite with both ORMs; every functional requirement has a passing test (FR-37, FR-83, FR-84).
- [ ] **AC-15** With the feature on and no setting changed, an invoice created, edited, sent and paid through the
      existing pages behaves as today, a confirmed document stays editable (each change recorded, its open items
      re-derived), negative lines and a due date before the invoice date are accepted, a bill with a price variance
      confirms with a warning, every invoice received through `sentTo` stays listed on the received invoices page,
      today's PDF is produced, and existing invoices stay editable during the open-item run (FR-5, FR-15, FR-17,
      FR-21, FR-50, FR-67, FR-80, FR-83, FR-84).
- [ ] **AC-16** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today, apart from the existing feature codes that now guard their routes, which the release switches on for every tenant holding their data (FR-83).

| Report | Shows |
| ------ | ----- |
| Unbilled work | Billable and not billed per customer, by source type, amount and age |
| Open items | Receivable and payable open items with due date, outstanding, days overdue, hold and dispute marks |
| Instalments due | Amounts falling due per week and per party, both directions |
| Live ageing summary | Buckets per party, direction and currency, today or as of a date |
| Bill match exceptions | Open and resolved exceptions by cause, vendor, buyer, age and variance |
| Unbilled receipts and deliveries | Open accruals as of a date by party, item kind and source |
| Credit and debit notes | Notes by reason, party, period and originating document |
| Credit exposure and holds | Exposure against limit per customer with reviews; documents on hold with reason and age |

## 8. Open Questions

- Stored instalments beside the rule that a schedule is derived on request. Default applied: stored at confirmation;
  the derivation stays available and answers as today; a confirmed document's amount due is the sum of its open items.
- Printed series number beside the numeric invoice number. Default applied: both kept; an organization's current
  sequence becomes the starting value of its invoice series.
- Documents that move stock themselves overlap with deliveries and receipts. Default applied: available, off per
  organization, recommended only for counter sales and cash purchases.
- Defaults applied on first enablement: credit policy "warn"; inter-company counterpart created as a draft; bill capture
  off until an administrator enables it (it sends file content to the organization's own AI provider).

## 9. Constitution Gates

- [x] I Plugin-first: new plugin `receivables-payables` with UI packages; core gets additive invoice columns only.
- [x] II Tenant/organization scoping: every record scoped; inter-company writes run as the other organization's actor.
- [x] III Both ORMs, additive migrations: new tables and nullable columns only, three dialects.
- [x] IV Default-off flag; nothing removed: tenant feature plus deployment switch; legacy fields and routes stay.
- [x] V Contracts and API first: contracts in `@gauzy/contracts`, REST first, additive OpenAPI.
- [x] VI Permissions, privacy, security: separate keys for confirm, cancel, override, hold, review; capture flow in §4.
- [x] VII Real-time through the event bus: events through the outbox; balances and worklist over the push channel.
- [x] VIII i18n and accessibility: keys in every locale; keyboard operable lists and forms.
- [x] IX Tests accompany the change: unit, property tests on totals and open items, e2e.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Specs: [`business-document-engine`](../business-document-engine/spec.md),
  [`general-ledger`](../general-ledger/spec.md), [`tax-engine`](../tax-engine/spec.md),
  [`payments-and-collections`](../payments-and-collections/spec.md), [`realtime-channel`](../realtime-channel/spec.md)
- Code extended: `packages/core/src/lib/invoice`, `invoice-item`, `payment-term`, `invoice-schedule`,
  `organization-vendor`, `sequence`, `money`, `tax-line`; `packages/plugins/order/src/lib/order-invoicing`;
  `packages/plugins/purchasing/src/lib/purchase-order-line`
