# Feature Specification: Payments and collections

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `payments-and-collections`
**Branch**: `feat/payments-and-collections`
**Status**: `Draft`
**Created**: 2026-11-15
**Last updated**: 2026-11-23
**Owner**: platform maintainers
**Feature flag**: `FEATURE_COLLECTIONS` (new tenant feature, default off) on top of the existing `FEATURE_PAYMENT`; deployment switch `GAUZY_COLLECTIONS_ENABLED` (only the exact value `true` loads the new modules)

---

## 1. Overview

Today a payment is one receipt against one invoice, the invoice's paid state is worked out in the browser, money paid to
suppliers and employees cannot be recorded, and collecting is four fixed reminder emails. This feature makes the same
payment record the document for **money in, money out and transfers** between the organization's own accounts. A payment
is confirmed, **allocated across any number of open items**, may carry deductions, become an **advance**, or be released
again; small rests are **written off** with a reason. Around it come **payment requests** with pay links, **payment
orders** that produce bank files, the **reconciliation of open items**, **statements of account**, **dunning** with
levels, fees and interest, invoice financing and cheque printing. Every step publishes an event from which the ledger
posts. One API serves the Angular app, the MCP server and the SDKs.

**Advanced capabilities.** (1) A **collections worklist** ranks who to chase, tracks **promises to pay** and **disputes**,
and an assistant drafts each reminder in the customer's language for a person to approve. (2) **Dunning runs on a
schedule**, automatic up to a chosen level. (3) Every invoice, statement, dunning notice and request carries a **pay
link**. (4) **Bank-file formats are pluggable generators**. (5) Allocation comes with **explained suggestions**, and
allocation and write-off are MCP tools with **preview**. (6) Payment orders need a **second person**, and a changed
payee bank detail is held until verified.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** a customer with three open invoices who transfers one amount covering two of them and part of the third,
  **when** a clerk records the receipt and accepts the proposed allocation, **then** two invoices are fully paid, the
  third partially, the customer's balance drops on every open screen, and one event per payment and allocation is out.
- **Given** a receipt that is 40.00 short because the bank kept a fee, **when** the clerk adds a deduction "bank charge"
  of 40.00, **then** the invoice is fully paid and the fee is reported for posting with its reason.
- **Given** approved supplier bills due this week, **when** a payables clerk builds a payment order for the main bank
  account and a second person approves it, **then** a bank file is produced by the account's generator, and marking the
  order executed confirms the outgoing payments and settles the bills.
- **Given** a dunning policy with three levels and a weekly run, **when** the run executes, **then** customers with
  overdue items receive the notice of their level with fee and interest, level-3 notices wait for review, and disputed
  items, held documents and customers with a pending promise are left out.
- **Given** a collector's worklist, **when** they open the top customer and choose "Draft reminder", **then** a message
  in the customer's language lists the overdue items and the pay link; they edit, send, and record a promise for Friday;
  on Friday evening the promise is marked kept or broken by itself.
- **Given** a customer who opens the pay link of a statement, **when** they select two invoices and pay online, **then**
  the payment is recorded once, allocated to those two, and a receipt is sent.
- **Given** an AI agent, **when** it calls the allocate tool with `preview: true`, **then** it receives the resulting
  outstanding amounts, discounts, differences and ledger effects, and nothing has changed.

### 2.2 Edge cases & failures

- **Given** a user without the allocation permission, **then** allocation answers `403`; with the feature off the new
  routes answer `404` and payments work exactly as before.
- **Given** two clerks allocating to the same open item at once, **then** the second receives a conflict with the fresh
  amounts; no item is ever settled beyond its outstanding amount.
- **Given** a payment dated in a locked period, **then** confirming, cancelling and releasing are refused with the
  period named; a release may be dated in the first open period instead.
- **Given** a payment order of 60 lines of which the bank rejects 4, **then** 56 payments are confirmed and the 4 items
  return to open with the bank's reason.
- **Given** a provider that reports the same online payment twice, **then** one payment exists.
- **Given** a statement run for 500 customers where 6 have no email address, **then** 494 are sent and the log lists the
  6.

## 3. Functional Requirements

### 3.1 Payments as documents

- **FR-1** The system keeps money received, money paid and transfers between the organization's own accounts as one
  payment record with a direction (in, out, transfer); every existing payment reads as money in.
- **FR-2** The system gives a payment the document engine's lifecycle (draft, confirmed, cancelled) and a number from a
  series per direction; cancelling a confirmed payment releases its allocations and publishes a reversal. A confirmed
  payment stays editable and deletable as payments are today (a change publishes a reversal of the old values and a
  confirmation of the new ones and re-applies its allocations within the new amount; a delete releases them), unless
  the organization locks confirmed payments (setting, default off), in which case amount, party, date and account are
  changed only by cancelling and recording again.
- **FR-3** The system accepts as the party of a payment a contact, a vendor, an employee or a party type another feature
  registered; a transfer has no party.
- **FR-4** The system stores on a payment its date, amount, currency, method, the organization's cash or bank account,
  reference number and date (optional, as today, unless the payment method requires a reference, a per-method choice
  that is off for the six existing methods), note, project, tags and dimension values; the cleared date is set by bank
  reconciliation.
- **FR-5** A user with `PAYMENT_METHODS_EDIT` can maintain payment methods (name, kind, default cash or bank account per
  organization, whether a reference is required); today's six methods are kept, and a method in use by a register
  profile or a recurring payment cannot be deactivated.
- **FR-6** The system requires a transfer's two accounts to differ and, for accounts in different currencies, records
  both amounts and the rate between them.
- **FR-7** The system lets a payment settle items in another currency: it converts at the payment's rate (positive,
  editable while draft), and reports the difference from each item's own rate as an exchange difference.
- **FR-8** A user with `PAYMENTS_CONFIRM` can confirm a payment whose gross amount equals its allocations plus its
  unallocated rest, the gross amount being its amount (the money that moved) plus its deductions and the tax withheld at
  payment (a 60 receipt with a 40 bank-charge deduction settles a 100 invoice in full: 60 + 40 = 100 + 0); confirming is refused in a locked period, and `PAYMENTS_OUT_EDIT` is needed for money out.
  Money in recorded through today's payment routes and dialog by a holder of `ORG_PAYMENT_ADD_EDIT` is confirmed at once,
  as today, and every role that holds `ORG_PAYMENT_ADD_EDIT` also receives `PAYMENTS_CONFIRM` and `PAYMENTS_CANCEL` by
  default, so nobody who records payments today needs another person to complete one.
- **FR-9** A user with `ORG_PAYMENT_ADD_EDIT` can start a payment from an invoice, a bill, an order (as an advance), a
  payment request, a dunning notice, a statement or an expense claim, pre-filled with party, items and amounts.
- **FR-10** The system repeats a payment on a schedule (draft or confirmed, by choice) and skips an occurrence with a
  notice when its period is locked or its account is closed.
- **FR-11** The system pays and receives against employees: advances, expense reimbursements and net pay appear as open
  items of the employee and are settled like any other.
- **FR-12** The system works out every document's settlement state on the server from allocations; an existing
  one-invoice payment is a payment with one allocation.

### 3.2 Allocation and reconciliation of open items

- **FR-13** A user with `PAYMENT_ALLOCATIONS_MANAGE` can allocate a payment, an advance or a credit note across any
  number of the party's open items, each in full or in part, instalment by instalment.
- **FR-14** The system lists a party's open items for allocation with filters (document and due dates, amounts, project,
  dimension, numbers), offers its unbilled orders for advances, and proposes an allocation oldest due first.
- **FR-15** The system never allocates more than an item's outstanding amount or a payment's unallocated amount, never
  to a held or cancelled item, and only in the right sense: money in settles receivable charges and supplier refunds,
  money out settles payable charges and customer refunds.
- **FR-16** The system applies an instalment's early-settlement discount by itself when the item is settled in full
  within its window, as a deduction (reducing tax in proportion if the organization chose so), undone on release.
- **FR-17** The system dates an allocation by the later of payment and document date, or by the advance's date when the
  organization chose so.
- **FR-18** A user with `PAYMENT_ALLOCATIONS_MANAGE` can reconcile a party's open items in one workspace: unallocated
  payments, advances and credit notes against open charges, in full or in part, with the difference left open, deducted
  or written off; `PAYMENT_NETTING_CREATE` allows netting a party's receivables against its payables.
- **FR-19** The system applies a set of allocations all or nothing and refuses it when any item changed since it was
  shown, returning the fresh state.
- **FR-20** A user with `PAYMENT_ALLOCATIONS_RELEASE` can release one or all allocations of a payment or credit with a
  reason: outstanding amounts are restored, discounts and exchange differences reversed, dated in an open period.
- **FR-21** The system releases a document's allocations by itself when the document is cancelled or deleted, leaving
  the money as an advance, as deleting an invoice with payments works today; an organization may instead choose to
  refuse the cancellation while allocations exist (setting, default off).
- **FR-22** The system runs automatic allocation on a schedule or on request, per party: exact reference first, then
  exact amount, then oldest first; with a size limit, a log of every allocation and its rule, and pause, resume and
  cancel; a party being processed cannot be allocated by hand until the run leaves it.
- **FR-23** The system suggests allocations for an unallocated payment with a reason each (the reference names a
  document, the amount equals one item or a combination, an attached remittance lists numbers, the party's usual
  pattern) and a confidence; below the organization's threshold nothing is allocated without a person **(advanced
  )**.

### 3.3 Advances, deductions, taxes, write-offs, refunds

- **FR-24** The system turns the unallocated rest of a confirmed payment into an advance of the party (a credit open
  item), optionally tied to an order whose invoices it settles first, and marks it for a separate advance account when
  the organization chose so.
- **FR-25** The system lets a payment carry deduction lines by governed reason (bank charge, settlement discount,
  exchange difference, rounding, short payment accepted, other) with project and dimension values, kept in the
  platform's one ledger of money adjustments; lines the system generates are marked and cannot be edited.
- **FR-26** The system adds to or deducts from a payment the taxes the tax engine computes on charges and on advances,
  included in the amount or on top, and reduces money paid by tax withheld at payment time where the regime says so,
  the withholding being recorded once, by the tax engine.
- **FR-27** A user with `OPEN_ITEM_WRITE_OFFS_CREATE` can write off the outstanding rest of one or many open items
  (charges or small credits) with a reason; a write-off is a numbered document, cancellable, and above the
  organization's limit per item or per document needs `OPEN_ITEM_WRITE_OFFS_APPROVE` or an approval workflow.
- **FR-28** The system lists open items within the small-balance threshold for bulk write-off with a result per row, and
  writes off a difference within the payment tolerance at allocation time when the organization chose so.
- **FR-29** A user with the existing `REFUNDS_CREATE` can refund a customer's credit or overpayment as money out
  allocated to that credit; a payment captured by a provider is refunded through the provider, never above what was
  captured.

### 3.4 Payment requests and pay links

- **FR-30** A user with `PAYMENT_REQUESTS_MANAGE` can request payment of one or several open items of a party, of an
  order in advance or of a subscription's cycles, in full or per instalment, inward (the customer pays) or outward
  (finance is asked to pay a supplier or an employee).
- **FR-31** The system keeps a request draft, sent, viewed, partly paid, paid, failed, expired or cancelled; its amount
  equals the sum of its lines, its currency must be one the chosen provider accepts, and it can be saved without
  sending.
- **FR-32** The system sends a request by email, or text message where enabled, from a template per language the
  organization can edit, and reminds once before expiry.
- **FR-33** The system puts a pay link on every sent invoice, statement, dunning notice and payment request; its page
  shows the party's open items to choose from, discounts still available, the methods of the organization's providers
  and bank transfer details with a unique reference; links expire and can be revoked; an invoice keeps the public link
  it already has **(advanced)**.
- **FR-34** The system records a successful online payment once however often it is reported, allocates it to the chosen
  items and sends a receipt; failed, cancelled and test-mode payments change nothing; no card data reaches the platform.
- **FR-35** The system lets an outward request sit in at most one payment order, and hands a request for subscription
  cycles to the provider of the subscription's saved instrument.

### 3.5 Payment orders, bank files, cheques

- **FR-36** A user with `PAYMENT_ORDERS_MANAGE` can build a payment order for one bank account from proposed items:
  payable open items due by a date (discounts about to expire first; holds left out), employee items and outward
  requests; an item is in at most one active order and must be confirmed, unpaid and of the same organization.
- **FR-37** The system pays a party only to bank details (holder, account and bank identifiers, country, currency) kept
  in the one bank-detail store of `banking-and-reconciliation`; a new or changed detail is unverified until a second
  person confirms it there, and items paying to an unverified detail are held back **(advanced)**.
- **FR-38** The system requires an order to be approved by a user with `PAYMENT_ORDERS_APPROVE` who did not create it,
  by amount bands where approval workflows are on **(advanced)**.
- **FR-39** A user with `PAYMENT_ORDERS_EXPORT` can produce the bank file of an approved order through the generator set
  on the bank account; generators are pluggable, three ship (credit transfer and direct debit in the standard XML
  formats, a delimited file with configurable columns), and a second export is marked as a duplicate **(advanced
  )**.
- **FR-40** The system confirms an order's payments and allocations when it is marked executed (by hand, from a bank
  status file or from bank reconciliation), dated at execution; rejected lines return to open with the bank's reason.
- **FR-41** The system builds collection orders for money in the same way over receivable items of customers with a
  signed direct debit mandate (reference, signature date, first or recurring use) **(advanced)**.
- **FR-42** A user with `CHEQUES_PRINT` can print a cheque for an outgoing payment on the layout of its bank account
  (positions of date, payee, amount in figures and words, signatory; test print for alignment), numbered from a cheque
  book; void and reprint are recorded in the cheque register.
- **FR-43** The system sends the payee a remittance advice listing the items paid when a payment out is confirmed.

### 3.6 Statements of account

- **FR-44** A user with `STATEMENTS_GENERATE` can produce a statement for a party and period, as full activity (opening
  balance, documents, payments, allocations, closing balance) or open items only, with ageing, per currency, in the
  party's language, as PDF and as a public page with pay link.
- **FR-45** The system sends statements on a schedule (weekly to quarterly) to customers selected by group, territory,
  sales person, tag or minimum balance, to the billing contacts with a copy list, and logs the result per customer;
  statement schedules are report schedules like any other.

### 3.7 Dunning

- **FR-46** A user with `DUNNING_MANAGE` can define dunning policies (one default; assignable to a customer group or
  customer) with levels: days overdue, minimum amount, fee (fixed or percent), yearly interest rate, text per language,
  channel (email, letter, text message) and whether the level asks credit control to stop new orders, or suspends
  or cancels the customer's subscriptions.
- **FR-47** A user with `DUNNING_ISSUE` can issue a dunning notice for a customer: its overdue open items per instalment
  with days overdue, the level reached, fee and interest; a notice is a numbered document that is draft, issued,
  settled, cancelled or superseded by a later notice for the same items.
- **FR-48** The system charges a notice's fee and interest (outstanding × rate × days overdue / 365, from the due date
  or the previous notice) as open items of the customer when the policy says so, settles them like any item, and lets a
  user with `DUNNING_CHARGES_WAIVE` waive them.
- **FR-49** The system runs dunning on a schedule: it issues notices by itself up to the level the organization chose
  and proposes the rest for review, one notice per customer per run, after grace days, leaving out disputed items, held
  documents, items under a pending promise or payment plan, and customers excluded or paused; each run has a preview and
  a log **(advanced)**.
- **FR-50** The system marks a notice settled when all its items and charges are settled. Today's reminder emails keep
  being sent by today's reminder schedule, with their settings unchanged; an organization may choose (setting, default
  off) to have them sent as the first level of its default policy instead: the days and text are copied into that
  level, today's reminder settings are kept, switching back restores today's sending, and while the choice is on one
  engine reminds and dunns and no customer receives both.

### 3.8 Collections worklist (advanced)

- **FR-51** The system shows each collector a live worklist of customers with overdue amounts, ranked by amount, age,
  broken promises and credit use, with dunning level, last contact, next action, promises and disputes.
- **FR-52** A user with `COLLECTIONS_WORK` can record a promise to pay (amount, date, items, who promised); on that date
  the system marks it kept or broken from what was settled, tells the collector, and lets dunning resume when broken.
- **FR-53** A user with `COLLECTIONS_WORK` can agree a payment plan that re-splits overdue items into instalments, each
  carrying a promise.
- **FR-54** A user with `COLLECTIONS_WORK` can flag open items as disputed with a governed reason, amount and owner;
  disputed items are left out of dunning and interest and shown apart in ageing, and are resolved as upheld, credited or
  written off, with the time in dispute measured.
- **FR-55** The system drafts, on request, a reminder for a customer in the customer's language and at the tone of the
  level, using only the facts on record (open items, promises, last payments, contact name) with the pay link; a person
  approves and sends, or the organization lets first-level reminders go out by themselves; without an AI provider the
  level's fixed text is used.
- **FR-56** The system keeps a collection profile per customer: collector, language, channel, contact person, policy
  override, exclusion or pause date; every reminder, promise and dispute appears on the customer's timeline.
- **FR-57** The system estimates each open item's expected payment date (promise date, else due date plus the customer's
  average days late over twelve months) and shows expected receipts per week.

### 3.9 Invoice financing

- **FR-58** A user with `INVOICE_FINANCING_MANAGE` can place confirmed customer invoices under a financing agreement
  with a funder (advance rate, fee, interest, term) that is proposed, approved, funded, settled or closed; an invoice is
  in one active agreement at most, and the financed amount never exceeds its outstanding amount.
- **FR-59** The system records funds received from the funder and repayments to it as payments of the agreement, marks
  the invoices financed, flags a customer payment on a financed invoice for passing on, and publishes each step.

### 3.10 Events, lists, agents, settings, compatibility

- **FR-60** The system publishes, in the transaction that changes them, events for payment confirmed and cancelled,
  allocation created and released, write-off, dunning charge and financing steps, carrying what a posting needs: amounts
  in both currencies, accounts involved, parties, deductions by reason, exchange differences, dimension values.
- **FR-61** The system never writes ledger entries; with accounting off payments behave the same, with it on a preview
  shows the journal to come.
- **FR-62** The system presents Payments, Unallocated, Requests, Orders, Write-offs, Statements, Dunning, Collections
  and Financing as saved-view lists, and ships print templates for receipt, payment voucher, remittance advice,
  statement, dunning notice and cheque in every shipped language.
- **FR-63** The system exposes every action as an MCP tool under the caller's permissions; record payment, allocate,
  release, write off, approve or export an order and run dunning accept `preview: true`; an agent never approves an
  order or write-off it created **(advanced)**.
- **FR-64** The system answers payment search, statistics, overdue lists and status changes, which today's payment tools
  of the MCP server call and the API does not yet serve.
- **FR-65** A user with `COLLECTIONS_SETTINGS_EDIT` can set per organization the policies this spec names: allocation
  dating, tolerance and small balances, auto-allocation rules and threshold, release on cancel, advance marking,
  write-off limits, link expiry, verification days, generators, statement and dunning schedules, locking confirmed
  payments (FR-2) and sending invoice reminders through dunning (FR-50), each defaulting to today's behaviour.
- **FR-66** The system changes nothing while the feature is off; with it on, a payment saved through today's routes with
  an invoice becomes a payment with one allocation, and existing payments get their allocations in a resumable run that
  copies the invoice link and keeps it. Today's routes accept, edit and delete exactly what they accept today: whatever
  part of such a payment cannot be allocated (beyond the invoice's outstanding amount, or to an item on hold) stays as
  its unallocated rest instead of being refused.

## 4. Non-Functional Requirements

- **Performance**: confirm a payment with 200 allocations under 1 s P95; a party's open items for allocation under 300
  ms at 100,000 items per party group; suggestions under 2 s; statement PDF under 3 s; a dunning run over 50,000
  customers within 15 minutes in the background; pay page first paint under 1.5 s.
- **Volume and concurrency**: 5 million payments and 20 million allocations per tenant; optimistic versions on open
  items; one automatic run per party at a time; re-delivered provider and outbox events change nothing.
- **Auditability**: who, when, before and after for every confirm, allocation, release, write-off, approval, export,
  bank detail change, waiver, promise and dispute; exported files kept with their hash; agent actions marked.
- **Security & privacy**: customer, supplier and employee bank details are kept encrypted in one store owned by
  `banking-and-reconciliation`, masked on screen, left out of exports unless a permission allows it and logged on every
  read, the single exception to the rule that no bank account number is stored; this feature stores none. Pay
  links are unguessable, expire and expose only the party's own items; data leaving the platform: emails and text
  messages to the party, bank files downloaded by the user, reminder facts to the organization's AI provider when on.
- **Accessibility, localization, compatibility**: keyboard operable workspace and lists; every shipped locale; letters
  and statements in the party's language; PostgreSQL, MySQL and SQLite, both ORMs; cloud and self-hosted.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| Payment | The existing payment record with a direction: money in, money out or transfer |
| Payment method | A way of paying with its kind and default cash or bank account |
| Allocation | The part of a payment, advance or credit applied to one open item |
| Deduction | A line of a payment that explains a difference by reason |
| Advance | Money received or paid before a document, held as a credit open item |
| Write-off | A numbered document that closes the rest of open items with a reason |
| Payment request | A request to pay named open items, with its pay link |
| Payment order, bank file | A batch of payments for one bank account; the file a generator produced from it |
| Payee bank detail, mandate | Where a party is paid; a customer's permission to collect by direct debit |
| Allocation run | One execution of automatic allocation with its log |
| Statement, statement schedule | A party's account for a period; the rule that sends statements |
| Dunning policy, level, notice, charge, run | The rules, a letter issued under them, its fee and interest, a scheduled execution |
| Collection profile, promise, dispute, payment plan | How a customer is chased; what they promised; what they contest |
| Financing agreement | Invoices funded by a third party, with funding and repayment |
| Cheque | A printed, numbered instrument for one outgoing payment |

## 6. Out of Scope

- Invoices, bills, credit and debit notes, instalments, open-item register, holds, credit reviews, ageing balances:
  `invoicing-receivables-payables`.
- Provider adapters, hosted checkout, saved instruments, provider accounts and their currencies, payouts:
  `payment-gateways`. Bank accounts, the store of parties' bank details, statement import, matching bank lines to
  payments: `banking-and-reconciliation`.
- Journals, posting rules, exchange gain and loss accounts, merging ledger accounts: `general-ledger`. Tax and
  withholding calculation and certificates: `tax-engine`.
- Expense claims and their approval: `expenses-and-travel`; net pay: `payroll-processing`; subscription cycles:
  `subscription-billing`; register tenders: `point-of-sale-and-loyalty`; credit limits and order blocks:
  `sales-order-management`; template design: `print-and-pdf-designer`; email and text transport:
  `email-and-communications`; printable ageing statements: `financial-reports`.

## 7. Acceptance Criteria

- [ ] **AC-1** One receipt allocated over three invoices leaves two fully paid and one partially paid, with server-side
      states, balances pushed to a second browser within 2 s, and events for payment and allocations (FR-7, FR-12, FR-19).
- [ ] **AC-2** A short payment with a bank-charge deduction settles the invoice in full; an overpayment leaves an
      advance that a later invoice consumes; a payment in another currency reports the exchange difference (FR-16, FR-25).
- [ ] **AC-3** Releasing an allocation restores outstanding amounts and reverses discount and difference; two concurrent
      allocations to one item never exceed its outstanding amount (FR-20).
- [ ] **AC-4** A write-off above the limit waits for approval; a bulk small-balance write-off reports per row (FR-27, FR-28).
- [ ] **AC-5** A payment order needs a second person, exports a file through the account's generator, a second export is
      marked duplicate, and execution with rejected lines settles the rest (FR-36 to FR-41).
- [ ] **AC-6** A changed payee bank detail holds its items back until verified by another user (FR-37).
- [ ] **AC-7** The pay link of an invoice, a statement, a dunning notice and a request lets the party choose items and
      pay; the payment is recorded once and allocated to the chosen items (FR-33, FR-34).
- [ ] **AC-8** A scheduled dunning run issues level 1 and 2 notices, proposes level 3, charges fee and interest as open
      items, and leaves out disputed, held, promised and paused cases (FR-46 to FR-50).
- [ ] **AC-9** The worklist ranks customers, a drafted reminder is in the customer's language and contains only recorded
      facts, a promise turns kept or broken on its date, and a dispute suspends dunning (FR-51 to FR-57).
- [ ] **AC-10** Suggestions explain themselves and nothing below the threshold is allocated automatically; the automatic
      run logs each allocation with its rule (FR-22, FR-23).
- [ ] **AC-11** Each MCP tool with `preview: true` returns the effects and changes nothing (FR-63); statements, cheques
      and financing behave as specified; a scheduled statement run logs per customer.
- [ ] **AC-12** The reports below exist as report definitions and return correct figures on seeded data (FR-62, FR-64).
- [ ] **AC-13** With the feature off payments behave as today; on, existing payments gain allocations once; works on
      PostgreSQL, MySQL and SQLite with both ORMs; every functional requirement has a passing test (FR-12, FR-61; §4).
- [ ] **AC-14** With the feature off nothing changes: payments, invoice reminders, the public invoice page and the
      Payments page behave as today. With it on and its settings at their defaults: a data-entry user records, edits and
      deletes a payment through today's routes as before (an overpayment is kept as unallocated rest, not refused); a
      payment without reference is accepted; deleting an invoice with payments releases them as advances; invoice
      reminders are still sent by today's schedule with today's settings (FR-66).
- [ ] **AC-15** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-66).

| Report | Shows |
| ------ | ----- |
| Payment register | Money in, out and transfers by date, method, account, party and state |
| Unallocated payments and credits | Advances, unapplied receipts and credit notes per party with age |
| Allocation history | Allocations and releases by document, payment, user and rule |
| Write-offs and deductions | Amounts by reason, party, period and approver |
| Payment requests and orders | Requests by state and age; orders with approval, export and execution |
| Dunning | Notices by level, outcome, fees and interest charged, waived and collected |
| Collections performance | Days to collect, promises kept and broken, disputes and their age, collector workload |
| Collections forecast | Expected receipts per week from promises and payment behaviour |
| Discounts | Early-settlement discounts taken and missed, both directions |
| Financing and cheques | Agreements with funded and repaid amounts; cheque register |

## 8. Open Questions

- Fees and interest of a notice are open items of the customer rather than lines of the notice only. Default applied:
  open items, so that they are allocated, aged and waived like any other.
- Direct debit collection orders and mandates go beyond money-out orders. Default applied: in scope, last phase.
- Automatic sending of first-level reminders drafted by the assistant. Default applied: off; a person approves.
- Netting a party's receivables against its payables. Default applied: allowed only with the netting permission and only
  where contact and vendor are linked.
- Disputed items in allocation. Default applied: can be settled (the customer may pay anyway), never dunned.

## 9. Constitution Gates

- [x] I Plugin-first: new modules in the existing `payment` plugin with a new UI package; core gets additive columns
      only.
- [x] II Tenant/organization scoping: every record scoped; public pay pages resolve one party through a signed link.
- [x] III Both ORMs, additive migrations: new tables and nullable columns only, three dialects.
- [x] IV Default-off flag; nothing removed: tenant feature plus deployment switch; today's routes and reminders stay.
- [x] V Contracts and API first: contracts in `@gauzy/contracts`, REST first, additive OpenAPI.
- [x] VI Permissions, privacy, security: separate keys for confirm, release, approve, export, verify, waive; data
      leaving the platform listed in §4.
- [x] VII Real-time through the event bus: events through the outbox; workspace and worklist over the push channel.
- [x] VIII i18n and accessibility: keys in every locale; letters per language; keyboard operable workspace.
- [x] IX Tests accompany the change: unit, property tests on allocation conservation, e2e.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Specs: [`invoicing-receivables-payables`](../invoicing-receivables-payables/spec.md),
  [`general-ledger`](../general-ledger/spec.md), [`payment-gateways`](../payment-gateways/spec.md),
  [`banking-and-reconciliation`](../banking-and-reconciliation/spec.md), [`inbox`](../inbox/spec.md)
- Code extended: `packages/core/src/lib/payment`, `invoice/invoice-reminder`, `adjustment`;
  `packages/plugins/payment/src/lib` (`invoice-payment`, `refund`, `payment-provider`);
  `packages/mcp-server/src/lib/tools/payments.ts`
