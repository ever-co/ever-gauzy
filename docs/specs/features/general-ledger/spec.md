# Feature Specification: General ledger

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `general-ledger`
**Branch**: `feat/general-ledger`
**Status**: `Draft`
**Created**: 2026-11-15
**Last updated**: 2026-11-23
**Owner**: evereq
**Feature flag**: `FEATURE_ACCOUNTING` (default off)

---

## 1. Overview

Every business document the platform confirms (an invoice, a bill, a payment, an income or expense record, a stock
movement, a payslip, an asset document) becomes a balanced journal in the organization's ledger, without the plugin that owns the document writing a
ledger line: it publishes what happened, and posting rules owned by the ledger decide accounts, dimensions, currencies
and period. This feature is that ledger: the posting engine and its rules, manual journals with templates, reversal and
correction, receivable and payable control accounts kept equal to the platform's open-item register, party accounts,
period locks and the period and year-end close, multi-currency accounting with rate feeds and revaluation,
inter-organization journals, and the tools that keep the books provably consistent. It is the second part of the
`accounting` plugin, built on `accounting-foundation`. Clients: the Angular app (whose effects panel the document forms
of other features show), the REST and GraphQL API, the SDKs and the MCP server. With the feature off, or for an
organization that is not live, every document confirms exactly as today and nothing is posted; in a live organization
the documents that exist today are never refused because of the ledger unless the organization chooses so (FR-98).

**Advanced capabilities.** The ledger is immutable by default: corrections are reversal
and re-posting and journals are chained by a hash; a tenant that needs to can allow editing posted manual journals,
each edit kept as a chained revision with its full history. There is one lock model: an area, a
date and a level. A refusal says which lock, who set it and how to ask for it to
be lifted. Every document and tool shows its accounting effects before it is confirmed. Closing is continuous: a
checklist of automated checks that is always current, prepared and explained by an agent, signed by a person. Balances
are maintained with each posting and pushed to open clients; an assistant can explain a balance or draft a journal with
a preview; unusual postings are flagged as they happen.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** a live organization and a salesperson without accounting permissions, **when** they open the "Accounting
  effects" panel of a draft invoice, **then** they see the journal it would create, and after confirming, the invoice
  shows "posted" with its journal number within seconds.
- **Given** an accountant, **when** they draft a manual journal from a template, mark it auto-reversing and confirm it,
  **then** it is posted at once with a gap-free number and its reversal is posted on the first day of the next period.
- **Given** a confirmed bill with the wrong cost centre, **when** an accountant changes it in the accounting fields,
  **then** the system posts the reversal of the first journal and a corrected one, linked, originals still readable.
- **Given** a euro payment allocated to a euro invoice of a dollar organization at another rate, **when** the allocation
  is recorded, **then** the open items are settled and a journal books the realised exchange difference.
- **Given** a controller on the close page of October, **when** every blocking check passes or is waived with a reason,
  **then** they close the period and any posting dated in October is refused for everyone.
- **Given** a restricted lock on purchases up to 31 October and the organization's setting "Refuse documents the ledger
  cannot post" on, **when** a buyer confirms a bill dated 30 October, **then** it is refused naming the lock, its author
  and reason, with a way to request an unlock; a user who may post into restricted dates can confirm it. With the
  setting off (the default) the bill confirms and its journal is posted on the earliest open date (FR-98).
- **Given** an inter-organization journal confirmed in a subsidiary, **then** the mirrored journal exists in the parent,
  both are linked and carry the counterpart for elimination.
- **Given** an AI agent with the close preparation permission, **when** the nightly check finds a clearing account that
  is not zero, **then** it attaches the lines that cause it and proposes a correcting draft; a person decides.

### 2.2 Edge cases & failures

- **Given** the same document event delivered twice, **then** no second journal exists and the first is returned.
- **Given** a rule that cannot determine an account and the setting of FR-98 on, **when** the user confirms, **then**
  confirmation is refused with the missing role and line; **when** the setting is off or the gap appears only after
  confirmation, **then** the document stays confirmed, shows "posting failed", sits in the exception worklist, and posts
  by itself once the rule is fixed.
- **Given** two users reversing one journal at once, **then** one reversal exists and the second user receives it.
- **Given** a reversal whose original date is locked, **then** it is dated on the earliest open date, and the preview
  says so before the user confirms.
- **Given** a reposting run of 20,000 documents in which 12 fail, **then** it ends "partly done" with a result per
  document, the 12 can be retried, and no document is half-corrected.
- **Given** a user without `ACCOUNTING_LEDGER_VIEW`, **when** they request ledger lines or balances, **then** they
  receive `403`; the effects preview of their own document stays available.
- **Given** a period being closed while a posting for it is in flight, **then** the posting is either inside the closed
  totals or refused; never a line outside a recorded close.
- **Given** an attempt to update or delete a ledger line by any route, job or direct statement, **then** the database
  refuses it on every supported engine.

## 3. Functional Requirements

### 3.1 Posting engine

- **FR-1** The system lets only the posting engine create journals and ledger lines; no other plugin, route or tool can
  insert, change or remove them, and with the feature off or the organization not live nothing is posted.
- **FR-2** The system accepts a journal only when debits equal credits in the organization currency and in each
  transaction currency, and every line has exactly one side with a non-zero amount.
- **FR-3** The system stores on every line: account, side, amount in transaction, organization and reporting currency
  with the rates used, party (on control accounts), dimension set, ledger book, fiscal year and period, due date, source
  document and line, tax reference, description and the opening marker.
- **FR-4** The system creates journals from document events (confirmed: post; cancelled: reverse; amended: correct);
  processing the same event or document version again creates nothing.
- **FR-5** The system posts only document types that registered the facts they publish (amounts by component, parties,
  references, dimensions) and a default rule set; facts of an unregistered type are refused.
- **FR-6** The system turns facts into lines through posting rules per document type, optionally overridden per
  organization, versioned and dated; a rule line names a fact component, a side (debit, credit, by sign), an account
  role or fixed account, how party, dimensions and open items are taken, whether lines merge, a condition.
- **FR-7** A user with `ACCOUNTING_POSTING_RULE_EDIT` can copy a shipped rule set into an organization override, edit
  it, simulate it against sample and past documents, and activate it from a date; a rule set that yields an unbalanced
  journal for any sample is refused.
- **FR-8** The system determines the account of a rule line in this order: the account stated on the document line
  (where the type allows it); the owning plugin's own mapping for the role; the most specific matching account rule
  (party, party group, item, item group, warehouse, payment method, expense category, project, currency, counterpart
  organization; ties by priority); the party's account; the organization's designation; else refusal. Tax amounts take
  the account the tax engine maps for them.
- **FR-9** The system derives fiscal year and period from the posting date and refuses a date that no open fiscal year
  covers or that lies further in the future than the organization allows.
- **FR-10** The system stores with each line which rule and determination step chose its account, and shows it on
  request. `(advanced)`
- **FR-11** The system normalises lines before writing: lines equal in account, party, dimension set, currency, due
  date, tax reference and open item merge where the rule says so; a negative amount moves to the other side; zero lines
  are dropped.
- **FR-12** The system turns a conversion difference in organization currency within the rounding tolerance (default
  five minor units for documents; manual journals must balance exactly in their own currency) into a line on the
  designated rounding account (opening rounding account for opening journals), and refuses a larger one.
- **FR-13** The system applies the dimension rules of `accounting-foundation` at posting: defaults and derivation,
  requirement and value restrictions, fixed split rules and line distributions (one line per share, remainder to the
  largest), and offsetting lines that keep each value of a balanced dimension in balance.
- **FR-14** The system refuses a posting with a stable reason when any of these holds:

  | Reason | Condition |
  |---|---|
  | period locked / no fiscal period | see §3.7 and FR-9 |
  | account undetermined | no step of FR-8 yields an account |
  | account not postable | group, archived, or system-posted for another origin |
  | account restricted | actor lacks the permission for restricted accounts |
  | party required / wrong party role | control account without a party of its role |
  | dimension required / not allowed | a foundation rule refuses the dimension set |
  | currency not accepted / rate missing | account fixed to another currency; no rate resolvable |
  | balance side | a blocking expected side would be broken (a warning when set to warn) |
  | unbalanced | beyond the rounding tolerance |

- **FR-15** The system checks a document before it is confirmed, without writing: any reason of FR-14 (and any blocking
  budget control) stops the confirmation with the reasons per line; warnings are shown. For documents of FR-98 the
  reasons of FR-14 stop the confirmation only with the organization's setting of FR-98 on; otherwise they are shown as
  warnings and the document confirms as today.
- **FR-16** The system posts a confirmed document within five seconds (P95) and shows on the document its accounting
  state (pending, posted, failed, reversed) with journal numbers, updated live.
- **FR-17** The system records a posting that fails after confirmation as an exception (document, reason, attempts),
  retries it when its cause changes and nightly, and lets a user with `ACCOUNTING_POSTING_EXCEPTION_RESOLVE` retry it or
  post it with a stated remedy; no failure is dropped silently.
- **FR-18** The system posts only documents dated on or after the go-live date; a user with `ACCOUNTING_REPOST_RUN` can
  run a catch-up that posts documents confirmed before accounting was switched on.
- **FR-19** The system numbers journals from a gap-free numbering series per organization and fiscal year, assigned at
  posting and never reused.
- **FR-20** The system writes a journal, the open items it opens in the register, the affected balances and its event
  as one unit.

### 3.2 Effects preview

- **FR-21** The system returns, for any draft or confirmed document of a registered type and for any posting request,
  the journals it would create (accounts, sides, amounts per currency, parties, dimension sets, period, lock result,
  rule explanations, open-item effects, warnings) and writes nothing. `(advanced)`
- **FR-22** The system offers the preview on every document form, through the API and MCP tools, to any user who may
  read the document, within 300 ms (P95) for 200 lines. `(advanced)`
- **FR-23** The system previews a cancellation, an amendment, a reversal, a reposting run, a revaluation and a close in
  the same form. `(advanced)`

### 3.3 Immutability, reversal and correction

- **FR-24** The system never updates or deletes a posted journal or line, for any role, route or job, and enforces this
  in the database on every supported engine; the only relaxation is the tenant setting of FR-96, which deletes nothing
  and keeps every earlier state. `(advanced)`
- **FR-25** A user with `ACCOUNTING_JOURNAL_REVERSE` can reverse a posted journal once, at once or as a draft to adjust
  first: a new journal with the sides swapped, linked to the original; both remain visible.
- **FR-26** The system dates a reversal on the original posting date when that date is open to the actor, otherwise on
  the earliest open date or a later date the user chooses; never on a locked date.
- **FR-27** The system reverses every unreversed journal of a cancelled document; the allocations on its open items are
  released first by `payments-and-collections` (the counterpart items reopen), and the exchange difference journals
  they created are reversed as each release arrives.
- **FR-28** The system posts an amended document as a correction pair: the reversal of the previous version's journal
  and the journal of the new version, linked to the same document flow.
- **FR-29** A user with `ACCOUNTING_DOCUMENT_RECLASSIFY` can change the accounting fields of a confirmed document
  (account on a line, dimension set, description) through a recorded change set, without cancelling it; the system posts
  the correction pair.
- **FR-30** A user with `ACCOUNTING_REPOST_RUN` can select documents (type, dates, party, rule version, list) to have
  their journals derived again from current rules; the run previews the difference per document, posts correction pairs
  only where it differs, runs in the background, can be paused and cancelled, and keeps a state (queued, running, partly
  done, done, failed, cancelled) with a result per document.
- **FR-31** The system never corrects into a locked date: per run, such documents are skipped or corrected on the
  earliest open date.
- **FR-32** The system chains every journal to the previous one of its organization with a hash over its content and
  records the head of the chain at each close, so a later alteration is detectable. `(advanced)`

### 3.4 Manual journals

- **FR-33** A user with `ACCOUNTING_JOURNAL_CREATE` can draft a manual journal as a business document: kind, date,
  ledger book, currency, description, reference number and date, attachments, and lines with account, debit or credit,
  currency and rate, party, dimension set, due date and description.
- **FR-34** The system offers these kinds; system kinds are created only by their procedure:

  | Kind | Created by | Particular rule |
  |---|---|---|
  | general, adjustment, reclassification | user | — |
  | accrual | user | reverses itself (FR-38) |
  | write-off | user | settles chosen open items against an expense or income account |
  | money transfer | user | between money accounts; reference number and date required |
  | inter-organization | user | names a counterpart organization (FR-44) |
  | periodic stock adjustment | user | only without perpetual stock postings (FR-43) |
  | opening, closing, revaluation, exchange difference, allocation, recognition, document | system | not editable |

- **FR-35** The system refuses a manual journal that does not balance exactly, has a zero or two-sided line, lacks a
  party on a control account, or addresses a system-posted account or (without the permission) a restricted one.
- **FR-36** A user with `ACCOUNTING_JOURNAL_POST` can confirm a manual journal, which posts it in the same request; an
  approval workflow can be required by amount, kind or account before confirmation.
- **FR-37** The system helps while drafting: add a line for the difference; pull a party's open items into lines to
  write off, transfer or net them; build a transfer between two money accounts.
- **FR-38** The system posts the reversal of an auto-reversing journal on the first day of the next period, or on a
  given date, as soon as that date is open.
- **FR-39** A user with `ACCOUNTING_JOURNAL_TEMPLATE_EDIT` can save templates per organization and kind (lines with
  accounts, fixed amounts, percentage shares or prompted values, dimension sets) and start a draft from one.
- **FR-40** A user with `ACCOUNTING_JOURNAL_CREATE` can put a manual journal on a recurrence schedule; each occurrence
  is drafted or confirmed as scheduled, and skipped and reported when its date is locked.
- **FR-41** A user with `ACCOUNTING_JOURNAL_CREATE` can import manual journals from a file with a result per journal; an
  invalid journal is rejected as a whole and the others proceed.
- **FR-42** The system can compute tax and withholding for manual journal lines through the tax engine, adds the
  computed lines, and lets a user override them or disregard a threshold with a recorded reason.
- **FR-43** The system offers the periodic stock adjustment (difference between opening and closing stock value to a
  chosen account) only to organizations without perpetual stock postings.
- **FR-44** The system creates, when an inter-organization journal is confirmed, the mirrored journal in the counterpart
  organization (draft or confirmed, per pair policy) with the mapped balance accounts and equal totals, links both, and
  reverses one with the other or refuses when the counterpart date is locked.
- **FR-45** The system marks inter-organization lines with their counterpart so consolidated statements can eliminate
  them, and lists pairs of organizations whose mutual balances disagree. `(advanced)`

### 3.5 Open items (receivable and payable control accounts)

- **FR-46** The system ties every line on a control account to one open item of the platform's open-item register
  (`invoicing-receivables-payables`): the item the document opened (one per instalment), or one the ledger opens there
  for a manual or opening line, with party, account side, document, due date and amounts in both currencies.
- **FR-47** The system takes settlements from the allocations of `payments-and-collections` (a debit item against a
  credit item of the same party or linked parties, fully or partly, only ever added, undone by a release) and posts
  what each causes.
- **FR-48** Settling and releasing items, with its preview and the rule that the date is not earlier than either item,
  is the allocation of `payments-and-collections`; the ledger shows each allocation's journals beside it.
- **FR-49** The system answers every outstanding amount (per document, party, account, as of any date) from the
  register, and keeps each control account's balance equal to the sum of its open items on any date.
- **FR-50** The system books money received or paid before a document exists against the advance item the register
  holds for it, optionally earmarked for an order, and answers "advance paid" for an order from these items.
- **FR-51** The system can book advances on separate advance accounts per organization and party role, and then
  reclassifies them to the receivable or payable account by an automatic journal when they are allocated.
- **FR-52** A user with `ACCOUNTING_HEALTH_REPAIR` can have control-account lines of chosen parties, documents or dates
  checked against the register in the background, with a list of what differed; lines and items are untouched.
- **FR-53** The system offers its view of open items (register items with their ledger account and posting state)
  beside the register's own datasets for statements of account, ageing and collection work in other features.

### 3.6 Party accounts

- **FR-54** A user with `ACCOUNTING_PARTY_ACCOUNT_EDIT` can set, per organization, the receivable, payable and advance
  accounts of a party or party group; determination falls back from party to group to designation.
- **FR-55** The system treats a supplier and the customer its supplier record names as the same counterparty (the
  link is kept on the supplier record): their open items are shown together and can be netted, which posts the
  transfer between the payable and receivable accounts automatically.
- **FR-56** The system lets one party account hold open items in several currencies unless the account is fixed to one
  currency.
- **FR-57** The system applies a changed party account to new postings only; earlier open balances move only through a
  reposting run.
- **FR-58** The system resolves purchase lines of stocked items to the received-not-billed clearing account when the
  organization uses perpetual stock postings, and to the purchase or expense account when it does not.
- **FR-95** The system keeps a registry of party roles, each naming the record type that can be a party (customer and
  supplier contacts, vendors, employees, shareholders, and roles other features register) and whether its control
  accounts are receivable or payable; lines, open items and payments accept as party only a record of a registered role.

### 3.7 Period locks

- **FR-59** The system has one lock model: a lock is an organization, a posting area (or all), a through date and a
  level.

  | Level | Who may post, reverse or cancel on a covered date |
  |---|---|
  | open | anyone with the document's own permissions |
  | restricted | only users with `ACCOUNTING_PERIOD_POST_LOCKED` |
  | closed | nobody; set and lifted only by the close and reopen procedures |

- **FR-60** A user with `ACCOUNTING_PERIOD_LOCK` can set or lift a restricted lock for an area through any date not
  later than today, with a reason.
- **FR-61** The system checks every posting, reversal, cancellation, correction and settlement journal against the
  highest level among the locks covering its date and area.
- **FR-62** The system answers a date outside any open fiscal year with the same kind of refusal as a lock.
- **FR-63** The system names in every such refusal the lock (area, through date, level), who set it, when and why, and
  who can lift it, and lets the user request an unlock as an approval request. `(advanced)`
- **FR-64** The system assigns each document type to one posting area (sales, purchases, money, stock, assets, payroll,
  journals), declared when the type registers; a tax lock, set when the tax engine files a tax period, covers every
  journal that carries tax amounts whatever its area.
- **FR-65** The system shows locks as a timeline per area, audits and pushes every change, and at go-live closes
  everything before the cut-over date (the opening balance procedure alone posts there); documents dated before the
  cut-over date are still saved, amended and cancelled as today, without journals (FR-18, FR-98).

### 3.8 Period close and year-end

- **FR-66** The system keeps a close checklist per period from a template per organization: automated checks, and
  manual tasks created as platform tasks with assignee, due date, comments as evidence and completion, which one check
  waits for. `(advanced)`
- **FR-67** The system runs these automated checks and lets other features register more:

  | Check | Provided by |
  |---|---|
  | journals balance; balances equal lines; hash chain intact; control accounts equal open items | this feature |
  | no posting exception or pending posting in the period; clearing accounts zero; revaluation done | this feature |
  | no draft document dated in the period | `business-document-engine` |
  | allocations posted | `accounting-foundation` |
  | bank accounts reconciled through the period end | `banking-and-reconciliation` |
  | stock value equals the stock accounts | `stock-ledger-and-valuation` |
  | depreciation posted | `fixed-assets` |
  | recognition entries posted; deferral accounts agree | `budgets-and-revenue-schedules` |
  | tax period prepared | `tax-engine` |

- **FR-68** The system re-evaluates checks when relevant records change and nightly, so every open period's checklist is
  current and shows days since period end and blocking items. `(advanced)`
- **FR-69** A user with `ACCOUNTING_PERIOD_CLOSE` can close the earliest open period when every blocking check passes or
  is waived with a reason (only checks marked waivable); closing sets a closed lock for all areas and records the
  period's totals and chain head.
- **FR-70** A user with `ACCOUNTING_PERIOD_CLOSE` can run the year-end close after the last period: a closing journal
  per ledger book moves every income and expense balance to the designated retained earnings account, per dimension set
  or collapsed to chosen dimensions, and the fiscal year becomes closed.
- **FR-71** The system runs large closes in the background in slices with progress, pause, resume and cancel, and leaves
  nothing posted when a run does not complete.
- **FR-72** A user with `ACCOUNTING_PERIOD_REOPEN` can reopen the latest closed period with a reason, in reverse order
  only; reopening a closed year reverses its closing journal; the action is audited and announced.
- **FR-73** The system refuses any posting, reversal or cancellation dated on or before the latest closed date; for a
  document of FR-98 with the organization's setting off, the document is not refused and its journal or reversal is
  dated on the earliest open date instead.
- **FR-74** The system stores closing balances per account, ledger book, dimension set and currency for each closed
  period, serves later opening balances from them, and verifies them against recomputation.
- **FR-75** An agent with `ACCOUNTING_CLOSE_PREPARE` can run the checks, explain each failing check with the records
  behind it, and propose correcting journals as drafts with their effects; it cannot close, waive or confirm.
  `(advanced)`

### 3.9 Multi-currency accounting

- **FR-76** The system resolves a rate in this order: the rate on the document; the stored rate of the pair on the date;
  its inverse; a peg; a cross rate through the organization currency; else refusal. A rate older than the organization
  allows (default three days) warns or blocks, as set.
- **FR-77** A user with `ACCOUNTING_RATE_FEED_EDIT` can configure rate sources (a built-in public reference feed, or a
  custom endpoint with address, parameters, response mapping and a secret), pairs and schedule; fetched rates go to the
  existing exchange-rate table marked with their source; failures are reported; feeds can be switched off.
- **FR-78** A user with `ACCOUNTING_RATE_FEED_EDIT` can peg a currency to another at a fixed ratio from a date; no
  stored rate is then needed for the pair.
- **FR-79** The system keeps, for an organization that names a reporting currency, a reporting amount on every line and
  balance at the rate of the posting date.
- **FR-80** The system posts the realised exchange difference of an allocation whose items carry different rates, to
  the designated gain and loss accounts, dated on the allocation date (the earliest open date when that is locked), and
  reverses it when the allocation is released.
- **FR-81** A user with `ACCOUNTING_REVALUATION_RUN` can compute, as of a date, the unrealised difference of
  foreign-currency open items (per party and item), money accounts and other accounts marked for revaluation, per
  account, party and currency; a user with `ACCOUNTING_REVALUATION_POST` can post it.
- **FR-82** The system posts a revaluation as one journal that reverses itself the next day (or accumulates, per
  organization policy), clears organization-currency residue on accounts whose foreign balance is zero in the same run,
  and replaces an earlier run for the same date by a correction pair. `(advanced)`
- **FR-83** The system can run revaluation on a schedule per organization (period end, monthly, weekly, daily) and
  either posts it or leaves it as a proposal for approval.

### 3.10 Ledger integrity

- **FR-84** The system checks daily, for all open periods and the last sixty days of closed ones, that journals balance,
  balances equal lines, control accounts equal open items, closing balances equal recomputation and the hash chain is
  intact; findings carry a severity, appear on the close checklist and are announced in the inbox, in one finding list
  that the banking, tax, receivables, payments and asset features also report to.
- **FR-85** A user with `ACCOUNTING_HEALTH_VIEW` can run the divergence finder: for a chosen identity (assets equal
  liabilities plus equity plus result; control account equals open items; balance equals lines) and a date range it
  narrows down, by halving, to the first day the identity breaks and lists that day's journals.
- **FR-86** A user with `ACCOUNTING_HEALTH_REPAIR` can rebuild derived data only (balances, closing balances); no tool
  changes a journal.
- **FR-87** The system flags unusual postings as they happen and nightly (a document posted twice, an amount far outside
  the account's history, a first-time account and party pair, large round amounts, unusual hour or actor, repeated
  reversal and re-posting), each with a reason and score; a user with `ACCOUNTING_HEALTH_VIEW` can review and dismiss
  them with a reason. `(advanced)`

### 3.11 Balances, inquiry and assistance

- **FR-88** The system maintains balances per account, period, ledger book, dimension set and currency with each
  posting, answers every balance and trial balance query from them, and pushes a changed balance to open clients within
  two seconds. `(advanced)`
- **FR-89** A user with `ACCOUNTING_LEDGER_VIEW` can list journals and lines by account, party, dimension value,
  document, date and book with a running balance, drill from a line to its journal, document and rule explanation, and
  use the same data as datasets for reports.
- **FR-90** The system offers MCP tools for every capability above under the same permissions; tools that post, reverse,
  settle, lock, close or revalue accept `preview: true` and then change nothing.
- **FR-91** The system can explain a balance: opening amount, movements by kind of source document, largest
  counterparties, breakdown by dimension, and the change against the previous period and year with its largest drivers,
  each figure traceable to journals the caller may read. `(advanced)`
- **FR-92** The system can propose a manual journal from an instruction in words or an attached file: a draft with its
  effects and reasoning, marked as drafted by an agent; only a user with `ACCOUNTING_JOURNAL_POST` (or the approval
  workflow) confirms it. `(advanced)`
- **FR-93** The system offers every capability through the REST API with cursor pagination, idempotency keys on posting,
  reversing, settling and run-starting calls, and bulk calls with a result per row.
- **FR-94** The system publishes events for posted, failed, reversed and edited journals, lock and close changes,
  revaluations, reposting runs and health findings.

### 3.12 Editing posted journals

- **FR-96** The system offers a tenant setting, off by default, that allows posted journals to be edited; while it is
  off every edit is refused as FR-24 states, and changing the setting is recorded with who and when.
- **FR-97** With the setting on, a user with `ACCOUNTING_JOURNAL_EDIT_POSTED` can edit a posted manual journal (date,
  accounts, amounts, parties, dimension sets, descriptions) with a reason when its old and new dates are open to them:
  the edit passes every check of FR-14, keeps the journal's number, becomes a new revision chained by hash while the
  previous one stays readable, moves balances by the difference and records the full before and after in the change
  history. Journals of documents and of system procedures, lines that opened or settled an open item and journals on
  closed dates change only by reversal or correction.

### 3.13 Documents that exist without the ledger

- **FR-98** The system refuses, because of the ledger, no document of a kind users could already save, confirm, amend or
  cancel without this feature (invoices, estimates, payments, expenses, incomes and the documents other features build
  on them) unless the organization turned on the setting "Refuse documents the ledger cannot post" (off by default).
  With the setting off, such a document is saved, confirmed, amended and cancelled exactly as today: the check of FR-15
  shows its findings as warnings; a posting refused for a reason of FR-14 becomes a posting exception (FR-17) that posts
  by itself once its cause is fixed or its date is allowed; a journal or reversal whose date is locked or closed is
  posted on the earliest open date, as corrections are (FR-31); a document dated before the go-live date gets no
  journal (FR-18). Manual journals and the other records this feature adds follow FR-14, FR-59 and FR-73 in every case.

## 4. Non-Functional Requirements

- **Performance**: posting check and preview under 300 ms P95 for 200 lines; a 50-line journal written under 150 ms;
  posting within 5 s P95 of confirmation; an account balance under 100 ms and a trial balance of 5,000 accounts under
  500 ms from maintained balances at 50 million lines; inquiry pages under 300 ms P95; year-end close of 5 million lines
  under 15 minutes in the background.
- **Data volume and concurrency**: 50 million lines and 10 million open items per tenant; 200 postings per second per
  tenant; one close, reposting or revaluation run per organization at a time.
- **Reliability**: at-least-once event delivery, exactly one journal per document version; no line outside a recorded
  close; every background run is resumable.
- **Security & privacy**: lines and balances are visible only with the ledger permissions; party figures respect the
  caller's access to the party; rate-feed secrets are stored encrypted; rate requests send only currency codes and
  dates; nothing else leaves the platform.
- **Auditability**: journals carry actor, origin, source, rule explanation and hash; locks, closes, reopenings, waivers,
  rule changes, settlements and remedies record who, when, before, after and why; agent actions are marked.
- **Accessibility and localisation**: journal grid, close checklist and lock timeline are keyboard operable and
  labelled; all strings in every shipped locale; amounts and dates in the user's format.
- **Compatibility**: PostgreSQL, MySQL and SQLite; both ORMs; multi-tenant cloud and self-hosted single tenant; additive
  OpenAPI changes.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| Journal, ledger line | A balanced, immutable accounting entry; one debit or credit of it, in up to three currencies |
| Posting facts | The neutral description of a document's amounts that its owner publishes |
| Posting rule, account rule | How facts of a document type become lines; a dated condition mapping an account role to an account |
| Posting exception | A confirmed document whose posting failed and awaits a retry or a remedy |
| Manual journal, template | A user-entered journal as a business document; a reusable set of lines |
| Open item, allocation | A receivable, payable or advance of the register that a control-account line belongs to; its settlement by an allocation |
| Party account, counterparty | Account override for a party; a supplier and the customer its record names, treated as one |
| Journal revision | An earlier or current state of an edited manual journal, chained and kept |
| Lock | An area, a through date and a level that restrict posting |
| Close checklist, check, run | The state of a period's close, its automated checks, and a long-running execution |
| Ledger balance, closing balance | Maintained total per account, period, book, dimension set and currency; its value at a close |
| Reposting run | A selection of documents whose journals are derived again and corrected |
| Rate source, currency peg, revaluation run | Where rates come from; a fixed currency relation; unrealised difference as of a date |
| Health finding, anomaly | A broken invariant; an unusual posting awaiting review |

## 6. Out of Scope

- Chart, account types, fiscal calendar, ledger books, dimensions and rules, opening worksheets:
  `accounting-foundation`.
- Invoices, bills, credit and debit notes, the facts they publish and the open-item register:
  `invoicing-receivables-payables`; payments, allocations and their screens, statements of account, reminders:
  `payments-and-collections`; bank accounts, statements and reconciliation: `banking-and-reconciliation`.
- Tax calculation, tax account mapping, withholding rules and certificates: `tax-engine`.
- Trial balance and ledger reports, statements, consolidation and eliminations, ageing, dashboards: `financial-reports`
  (this feature supplies the data).
- Perpetual stock postings and stock value: `stock-ledger-and-valuation`; depreciation: `fixed-assets`; payroll
  journals: `payroll-processing`; register shift postings: `point-of-sale-and-loyalty`.
- Document numbering, lifecycle, change sets, recurrence and the preview panel shell: `business-document-engine`;
  approval steps: `approval-workflows`; budget control and recognition schedules: `budgets-and-revenue-schedules`.

## 7. Acceptance Criteria

- [ ] **AC-1** Confirming a registered document posts exactly one balanced journal with the lines its rule defines; a
      duplicate event adds nothing; with the feature off the same confirmation posts nothing (FR-2, FR-5).
- [ ] **AC-2** Each refusal reason of FR-14 is reproducible at confirmation (for documents of FR-98, with its setting on)
      and names line and cause; a posting that fails after confirmation becomes an exception, retries by itself when
      fixed, and blocks the close.
- [ ] **AC-3** `(advanced)` The effects preview of a draft equals, line for line, the journal posted after
      confirmation, and writes nothing (FR-21–FR-23).
- [ ] **AC-4** `(advanced)` An update or delete of a ledger line fails on PostgreSQL, MySQL and SQLite; altering
      a stored journal breaks the hash chain check (FR-24, FR-32).
- [ ] **AC-5** Reversal, cancellation, amendment, reclassification and a reposting run each leave the originals readable
      and net to the corrected result; none posts on a locked date (FR-23, FR-26, FR-30).
- [ ] **AC-6** A manual journal honours FR-35; templates, recurrence, auto-reversal and import work; an
      inter-organization journal creates its mirror with equal totals.
- [ ] **AC-7** Control accounts: partial allocation, release, cross-currency allocation with exchange difference,
      advances and netting of linked parties each post their journals; each control account equals the register's open
      items after every step (FR-27, FR-47, FR-48, FR-80).
- [ ] **AC-8** `(advanced)` A restricted lock stops users without the permission and admits those with it; the
      refusal names the lock and an unlock request reaches the approver (FR-60, FR-63).
- [ ] **AC-9** `(advanced)` The close checklist updates without a manual refresh when a check's data changes; an
      agent can explain and propose but cannot close (FR-66, FR-68).
- [ ] **AC-10** Period close, year-end close and reopening work in order, in the background, and a closed date refuses
      every posting (FR-67, FR-71–FR-73).
- [ ] **AC-11** Revaluation posts one self-reversing journal, clears residue and can run on schedule; rate feed, peg,
      cross rate and stale-rate handling work (FR-77, FR-78, FR-82, FR-83).
- [ ] **AC-12** The health monitor reports a deliberately corrupted balance; the divergence finder returns its day (FR-85).
- [ ] **AC-13** `(advanced)` A balance changed by a posting appears in a second browser within two seconds; a
      trial balance at 50 million lines meets the target (FR-88).
- [ ] **AC-14** `(advanced)` "Explain a balance" figures add up to the balance; "propose a journal" returns a
      draft with effects and posts nothing; an anomaly is flagged for a duplicated document (FR-91, FR-92).
- [ ] **AC-15** Data produced: journal list, account ledger with running balance, trial balance figures, open items as
      of a date, exception worklist, lock timeline, close checklist, health findings (FR-88, FR-89).
- [ ] **AC-16** Works on PostgreSQL, MySQL and SQLite with both ORMs; behind `FEATURE_ACCOUNTING`, nothing changes while
      it is off (FR-1; §4).
- [ ] **AC-17** All functional requirements have a passing test, including property-based tests that every shipped rule
      set yields balanced journals (§3).
- [ ] **AC-18** With the edit setting off every edit is refused; with it on, an edited manual journal keeps its number,
      shows both revisions with who, when, why and the differences, balances still equal lines and the hash chain
      verifies; editing a document journal or a journal on a closed date is refused (FR-96, FR-97).
- [ ] **AC-19** With the setting of FR-98 off (the default), an invoice, payment, expense or income that cannot be
      posted, is dated beyond the allowed future, falls on a locked or closed date or precedes go-live is saved,
      confirmed, amended and cancelled as today; its posting waits as an exception, lands on the earliest open date or
      is skipped, and no document is refused because of the ledger.
- [ ] **AC-20** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today, apart from the existing feature codes that now guard their routes, which the release switches on for every tenant holding their data (FR-1, FR-98).

## 8. Open Questions

- Posting follows confirmation at once through the event outbox, after a synchronous check: a document confirms once
  the check passes; "confirmed but posting failed" is a visible, close-blocking exception.
- Date of realised exchange differences. Applied default: the settlement date, with no setting.
- Revaluation and rate feeds behind the existing `FEATURE_MULTI_CURRENCY` code. Applied default: their pages and routes
  need it, and the code is switched on for every tenant that already holds exchange rates or foreign-currency
  documents, so no one loses access; postings in foreign currency always work.
- Rounding tolerance. Applied default: five minor units per document journal, zero for manual journals.
- Waivable checks. Applied default: all except "journals balance", "control equals open items", "chain intact".

## 9. Constitution Gates

- [x] I Plugin-first — modules of the `accounting` plugin; other plugins reach it only through ports and events.
- [x] II Tenant/organization scoping — organization-scoped tables; mirrors written in the counterpart's scope.
- [x] III Both ORMs, additive migrations — new tables only; append-only triggers on three engines.
- [x] IV Default-off flag; nothing removed — `FEATURE_ACCOUNTING`; documents behave as today while off.
- [x] V Contracts and API first; backwards compatible — posting contract in `packages/contracts`.
- [x] VI Permissions, privacy, security — separate keys for post, reverse, edit, lock, close, reopen, repair.
- [x] VII Real-time through the event bus — outbox in and out; platform push for balances and states.
- [x] VIII i18n and accessibility — keys in every locale; keyboard-operable grids.
- [x] IX Tests accompany the change — unit, database, property-based and e2e tests in `tasks.md`.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) (posting contract in §4, events in §5) · Tasks: [`tasks.md`](./tasks.md)
- Depends on: [`../accounting-foundation/spec.md`](../accounting-foundation/spec.md),
  [`../business-document-engine/spec.md`](../business-document-engine/spec.md)
- Posts for: [`../invoicing-receivables-payables/spec.md`](../invoicing-receivables-payables/spec.md),
  [`../payments-and-collections/spec.md`](../payments-and-collections/spec.md),
  [`../banking-and-reconciliation/spec.md`](../banking-and-reconciliation/spec.md),
  [`../tax-engine/spec.md`](../tax-engine/spec.md), [`../fixed-assets/spec.md`](../fixed-assets/spec.md),
  [`../budgets-and-revenue-schedules/spec.md`](../budgets-and-revenue-schedules/spec.md)
- Architecture: [platform architecture](../../architecture/business-suite.md) §3.1, §3.4, §3.11, §3.12, §6
- Code extended: `packages/core/src/lib/event-outbox`, `money`, `rule`, `operation`, `tasks`, `activity-log`, `income`,
  `expense`, `organization-vendor`, `packages/plugins/pricing/src/lib/exchange-rate`, `packages/core/src/lib/payment`
  (rate snapshot on a payment)
