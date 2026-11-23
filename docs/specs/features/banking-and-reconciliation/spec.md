# Feature Specification: Banking and reconciliation

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `banking-and-reconciliation`
**Branch**: `feat/banking-and-reconciliation`
**Status**: `Draft`
**Created**: 2026-11-15
**Last updated**: 2026-11-23
**Owner**: evereq
**Feature flag**: `FEATURE_BANKING` (default off)

---

## 1. Overview

The platform records payments but knows nothing about the bank: no bank account record, no statement, no way to
say "this money really arrived". This feature adds banking as a new plugin. An organization keeps its banks and
bank accounts (and, in the one encrypted store the platform keeps for them, those of its customers, suppliers and
employees), brings in what the bank reports — by
statement file in the common formats or by a live feed through an installed bank provider — and reconciles every
bank line in **one workspace**: match it to payments and journals that exist, or create the payment, journal or
transfer from the line, with suggestions ranked by amount, reference, party and date, and rules for lines that
repeat. Checkpoints prove that the books agree with a statement at a date. Guarantees, daily balances and bank
reports complete the area. Clients: the Angular app (with balance cards on dashboards), the API and SDKs, the MCP
server.
With accounting switched off the workspace still reconciles bank lines against payments.

**Advanced capabilities.** Matching learns from every confirmed or rejected suggestion, and repeated
confirmations become a proposed rule with a preview on past lines. An agent reviews what is left after each import
and delivers one batch of proposed matches and rules for approval. Feeds and payment initiation are pluggable
providers. There is one reconciliation model: stamping a cleared date without a statement is the same workspace,
not a second tool. The workspace is live for several people; a cash forecast is computed from open items and
learned payment behaviour; changed supplier bank details and unusual payments raise alerts. Marked
`(advanced)` below.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** a bank never imported before, **when** the accountant uploads a delimited statement file, **then** the
  system proposes header row, date format, amount layout and column mapping with a preview, imports after one
  correction, remembers the mapping for the account, and records lines read, imported, skipped and totals.
- **Given** 120 imported lines, **when** the accountant opens the workspace, **then** lines with one exact
  candidate show it first with the reasons, and one keystroke accepts it.
- **Given** a line "incoming 2,380.00 from Brightwater" with no payment recorded, **when** the accountant chooses
  "create payment", **then** the party and its three open invoices totalling 2,380.00 are pre-selected, the effects
  preview shows the entries, and on confirmation the invoices are settled and the line is matched.
- **Given** a monthly line "ACCOUNT FEE 12.50" coded to bank charges three times, **when** the system proposes a
  rule and it is accepted in automatic mode, **then** next month's fee is coded untouched and marked "by rule".
- **Given** a bank connected through a provider, **when** the hourly sync runs, **then** new lines appear,
  announced lines become booked without duplicating, and the bank-reported balance is updated.
- **Given** the month-end statement, **when** the accountant closes a checkpoint with its closing balance, **then**
  the system shows book and cleared balances, open lines and uncleared entries, closes at zero difference and
  locks the matches up to that date.
- **Given** an agent with the reconcile permission, **when** a sync ends, **then** it matches what the account's
  automation level allows and sends one inbox item "14 matches and 2 rules proposed"; nothing proposed is posted
  until a person accepts it.

### 2.2 Edge cases & failures

- **Given** a file already imported, **when** it is uploaded again, **then** it is refused as a duplicate; a file
  overlapping an earlier one imports only the lines not yet present.
- **Given** a line in another currency than its bank account, **when** it is imported, **then** the row is rejected
  into the downloadable error file and the other rows are imported.
- **Given** a match that would allocate more than the line's or the payment's open amount, **when** it is
  confirmed, **then** it is refused with both figures.
- **Given** two accountants on one account, **when** both act on one line, **then** the second sees it claimed, and
  a commit on a line changed meanwhile is refused with "line changed, reload".
- **Given** a line dated in a locked accounting period, **when** a user creates a journal from it, **then** it is
  refused naming the lock; matching to an existing payment is still allowed.
- **Given** a closed checkpoint, **when** a user unmatches a line before its date, **then** it is refused until a
  permitted user reopens the checkpoint with a reason.
- **Given** an expired provider consent, **when** the sync runs, **then** the connection shows "needs attention",
  the responsible user is notified, and after re-consent the same accounts continue even with new identifiers.
- **Given** a bulk accept of 200 suggestions of which 4 fail, **when** it ends, **then** 196 are matched and 4 are
  listed with reasons; a user without `BANK_ACCOUNT_NUMBERS_VIEW` sees only the last four characters of a number.

## 3. Functional Requirements

### 3.1 Banks, bank accounts and party bank accounts

- **FR-1** A user with `BANK_ACCOUNTS_EDIT` can keep banks (name, bank identifier code, country, address, a default
  import profile, a facility limit) usable by every organization of the tenant.
- **FR-2** A user with `BANK_ACCOUNTS_EDIT` can create a bank account of the organization (name, bank, branch,
  number or IBAN, currency, kind: current, savings, card, loan, cash, wallet; opening balance and date).
- **FR-3** The system checks the structure and check digits of an IBAN and the format of a bank identifier code
  on entry and refuses a second account with the same number in the organization.
- **FR-4** The system, while accounting is enabled, requires a bank account to be linked to exactly one ledger
  account of a matching kind, organization and currency, and refuses a ledger account already linked.
- **FR-5** The system keeps one default bank account per organization and currency and offers it first on payments
  and on documents that print payment details.
- **FR-6** The system refuses to delete a bank account that has transactions or payments; a deactivated account
  accepts no new ones and stays readable.
- **FR-7** The system shows account numbers masked except to users with `BANK_ACCOUNT_NUMBERS_VIEW`, and writes
  each reveal to the access log.
- **FR-8** A user with `PARTY_BANK_ACCOUNTS_EDIT` can keep bank accounts of customers, suppliers and employees
  (holder, number or IBAN, bank identifier code, bank, country, currency, default per party and currency).
- **FR-9** The system offers party bank accounts as the destination of outgoing payments and payment orders of
  `payments-and-collections`, as the salary accounts of `payroll-processing` and `hr-core-lifecycle`, and uses them
  to recognise the party of a bank line.
- **FR-10** The system proposes adding a party bank account when a line from an unknown account is matched to a
  party, and adds it only when the user accepts.
- **FR-11** The system marks a party bank account changed in the last 14 days (configurable), notifies the party's
  owner of every change, and requires a second person's verification before a payment order uses it `(advanced)`.

### 3.2 Statement import

- **FR-12** A user with `BANK_STATEMENTS_IMPORT` can import a statement for a bank account from a file in delimited
  text, spreadsheet, MT940, ISO 20022 account report and statement messages, OFX or PDF.
- **FR-13** The system detects, for delimited and spreadsheet files, header row, delimiter, encoding, date and
  decimal formats and amount layout (signed; in and out columns; direction marker; type column), and previews a mapping.
- **FR-14** The system saves the confirmed mapping as the platform's import mapping template of the bank account,
  falls back to the bank's default template, and asks nothing when a later file has the same layout.
- **FR-15** The system reads structured formats without a mapping, including statement number and balances.
- **FR-16** The system extracts lines from text PDFs and shows them for review before import; a password for a
  protected file is asked at upload, used once, and kept (encrypted, with the account) only if the user opts in.
- **FR-17** The system extracts lines from scanned PDFs and images through the configured AI provider, marking
  low-confidence fields for review `(advanced)`.
- **FR-18** A user with `BANK_STATEMENTS_IMPORT` can import from a link to a published sheet or file, once or on a
  schedule; the system fetches it server-side from allowed hosts only.
- **FR-19** The system validates every row (date, amount, currency equal to the account's) and rejects failing rows
  with a reason without stopping the import.
- **FR-20** The system recognises a line already present and skips it, or updates it while unmatched when the user
  chose "update"; a line arriving by file and by feed is one transaction.
- **FR-21** The system runs imports in the background with progress and keeps an import record: file, format,
  profile, period, balances, counts (read, imported, skipped, rejected), totals, status, user, rejected-rows file.
- **FR-22** The system checks continuity (opening equals previous closing; opening plus lines equals closing) and
  flags a "balance gap" with the difference without blocking.
- **FR-23** A user with `BANK_STATEMENTS_IMPORT` can undo an import whose lines are all unmatched; otherwise the
  matched lines are listed and the undo is refused.
- **FR-24** A user with `BANK_TRANSACTIONS_EDIT` can enter a bank line by hand for an account without statements.

### 3.3 Bank transactions

- **FR-25** The system keeps per bank transaction booking and value date, signed amount, currency, description,
  references, counterparty name, account and bank code, transaction code, stated fee, running balance and source.
- **FR-26** The system gives a transaction one state: announced (reported, not yet booked), open, partly matched,
  matched, excluded or voided; announced lines cannot be matched.
- **FR-27** The system never lets a user change imported facts; users with `BANK_TRANSACTIONS_EDIT` can add a note,
  tags, files and a party, and edit or void a hand-entered unmatched line.
- **FR-28** A user with `BANK_RECONCILE` can exclude a line that is not a real movement (duplicate, balance row)
  with a reason, and include it again; excluded lines count in no balance.
- **FR-29** The system refuses a match that allocates more than the line's remaining amount, more than the
  counterpart's unmatched amount, or the same counterpart amount twice.
- **FR-30** A user with `BANK_RECONCILE` can split a line into parts and match each part separately.
- **FR-31** The system handles a receipt that arrives net of a fee: the match adds a fee part coded to a fee
  account so the document is settled in full; a fee stated on the line is split off automatically.
- **FR-32** The system records the rate when a line is matched to a counterpart in another currency and hands the
  exchange difference to `general-ledger`.

### 3.4 Bank feeds and payment initiation

- **FR-33** A user with `BANK_FEEDS_MANAGE` can connect a bank from the Integrations page through an installed
  provider (test or live), complete its hosted consent, and link each discovered account to an existing bank account
  or create one.
- **FR-34** The system synchronises a connection hourly (configurable), on demand and on a provider notice: only
  new data, announced lines updated when booked or voided when withdrawn, and the bank-reported balance recorded.
- **FR-35** The system tracks a connection's state (active, needs attention, expired, revoked), reminds its owner
  7 days before consent expires, and after re-consent keeps links and history even under new provider identifiers.
- **FR-36** The system logs every synchronisation (time, lines added, updated, voided, error), retries a failed one
  with back-off and raises an inbox item after three failures in a row.
- **FR-37** A user with `BANK_FEEDS_MANAGE` can disconnect a bank; the system stops synchronising, deletes the
  provider credentials and keeps the transactions.
- **FR-38** The system treats bank providers as installable plugins that declare their countries and capabilities
  (transactions, balances, payment initiation); several can be installed at once `(advanced)`.
- **FR-39** A user with `BANK_PAYMENTS_INITIATE` can send a confirmed payment order through a connection offering
  initiation and follow its status; executed payments match by end-to-end reference `(advanced)`.

### 3.5 Suggestions, party recognition and rules

- **FR-40** The system suggests for each open line: unmatched payments on the account; journal lines on its ledger
  account; open items of the likely party; an opposite line on another own account; shift deposits; provider payouts.
- **FR-41** The system ranks suggestions by a score with visible reasons: exact amount, amount within a tolerance,
  open items adding up to the amount, a document or payment reference found in the line, party, dates, currency.
- **FR-42** The system recognises a line's party by counterparty account number, then by exact normalised name,
  then by name similarity when the organization enabled it (default on), and shows how it was recognised.
- **FR-43** The system suggests a transfer when two own accounts show opposite lines of equal amount within a set
  number of days (default 4), and across currencies when a shared reference or a plausible rate links them.
- **FR-44** A user in the workspace can compare dates on booking date or value date and limit candidates to a
  date window.
- **FR-45** A user with `BANK_ACCOUNTS_EDIT` can set an account's automation level: suggest only (default), match
  exact suggestions automatically, or also apply automatic rules.
- **FR-46** The system runs matching in the background after every import and synchronisation, marks every
  automatic match with its origin, and lets any automatic match be undone.
- **FR-47** A user with `BANK_RULES_EDIT` can define ordered bank rules scoped by account and direction, with
  conditions on description, counterparty and reference text, amount range, transaction code and currency.
- **FR-48** A user with `BANK_RULES_EDIT` can give a rule one outcome: a balanced journal of one or more lines
  (amount, percentage or remainder; account, tax category, dimensions); a payment for a party, allocated to the
  oldest open items or left on account; a transfer to a named own account; party and tags; or exclusion.
- **FR-49** The system applies a rule in propose mode (default) or automatic mode, on demand, after each import
  and synchronisation, and in an hourly sweep.
- **FR-50** The system previews a rule before it is saved or made automatic: the lines of the last 12 months it
  would have caught, what it would have created, and the lines a higher rule would take first.
- **FR-51** The system refuses a pattern that cannot be evaluated within a safe time bound.
- **FR-52** The system logs each application of a rule, counts hits and accepted proposals per rule, and lets a
  user undo an application, which cancels what it created.

### 3.6 Reconciliation workspace

- **FR-53** The system offers one workspace per bank account: the bank lines with filters (state, dates, amount,
  text, direction), the candidates of the selected line, and bank balance, book balance, difference and open count.
- **FR-54** A user with `BANK_RECONCILE` can match a line to one or several counterparts, fully or partly, unmatch
  it, split it, exclude it, comment on it and attach files.
- **FR-55** A user with `BANK_RECONCILE` and the target's create permission can create from a line a payment (party,
  date, amount, open items pre-filled), a journal or a transfer, after an effects preview of what it will post.
- **FR-56** A user with `BANK_RECONCILE` can act on many lines at once (accept top suggestions, apply a rule, create
  payments for all lines of a party); the system answers a result per line.
- **FR-57** The system makes every workspace action reachable by keyboard with listed shortcuts.
- **FR-58** The system shows who else is in the workspace, marks a line as claimed while someone works on it,
  pushes every change to the others, and refuses a commit on a line changed meanwhile `(advanced)`.
- **FR-59** The system asks, on unmatch of a line whose counterpart was created from it, whether to cancel that
  counterpart too, and cancels it through its owner's cancellation.
- **FR-60** The system refuses to create a payment or journal dated in a locked period, naming the lock.

### 3.7 Checkpoints, clearing and balances

- **FR-61** A user with `BANK_RECONCILE_CLOSE` can close a checkpoint at a statement date with its closing balance;
  the system lists unmatched lines and uncleared entries and closes when cleared and statement balances are equal.
- **FR-62** A user with `BANK_RECONCILE_CLOSE` can close a checkpoint with a difference only by stating a reason;
  difference and reason are printed on the reconciliation statement.
- **FR-63** The system locks matches dated up to a closed checkpoint; reopening needs `BANK_RECONCILE_CLOSE` and a
  reason, latest checkpoint first, and is audited.
- **FR-64** The system stamps each matched entry with a cleared date equal to the bank line's booking date.
- **FR-65** A user with `BANK_RECONCILE` can mark entries cleared with a date for an account without statements; the
  system creates and matches a hand-entered line for each and refuses a date before the posting or instrument date.
- **FR-66** The system includes point-of-sale shift deposits among the entries to clear, with a filter to hide them.
- **FR-67** The system keeps a daily balance per bank account, as reported by the bank and from the books, shows
  the history and flags days where a balance is missing.
- **FR-68** The system shows current balances of all accounts by currency with a total in the organization
  currency, updated live as lines and matches arrive.
- **FR-69** The system projects each account's balance 30, 60 and 90 days ahead from open items (shifted by learned
  payment delays), payment orders and recurring lines, and alerts below the account's threshold `(advanced)`.

### 3.8 Bank guarantees

- **FR-70** A user with `BANK_GUARANTEES_EDIT` can record a guarantee received or given: party, linked order,
  project or contract, bank, number, beneficiary, amount, validity dates, margin, charges, terms and files.
- **FR-71** The system refuses to activate a guarantee without number, beneficiary and bank, moves it through
  draft, active, released, claimed, expired or cancelled, and records changes to an active one as change sets.
- **FR-72** The system posts margin and charges through `general-ledger` on activation and releases the margin on
  release, when accounting is enabled.
- **FR-73** The system reminds the owner a set number of days before expiry, marks the guarantee expired on its
  end date, and shows guarantees given per bank against the bank's facility limit.

### 3.9 Reports

- **FR-74** The system registers the reports below as report definitions of the report builder, each with
  drill-down to bank lines and documents and export through the builder.
- **FR-75** The system prints a checkpoint's reconciliation statement through a print template, with who closed
  it and when.

| Report | Answers | Filters and grouping |
| --- | --- | --- |
| Reconciliation statement | bank against book balance at a date, with uncleared entries and unmatched lines | account, date, shift deposits |
| Cleared entries | entries cleared in a period with their cleared dates | account, dates, party, origin of match |
| Clearing date exceptions | entries cleared before their posting or instrument date | account, date |
| Open bank lines by age | unmatched lines by age band and amount | account, age, direction |
| Balance history | daily bank and book balances and their difference | account, dates |
| Automation and rules | share of lines matched by person, exact match, rule and agent; hits per rule | account, period, rule |
| Imports and synchronisations | every import and sync with counts, gaps and errors | account, dates, status |
| Bank charges | fees and charges by account and month | account, period |
| Guarantees | guarantees by state, bank, party and expiry | direction, state, bank, expiry window |
| Cash position and forecast | balances today and projected | account, currency, horizon |

### 3.10 Learning, agents, alerts and compatibility

- **FR-76** The system remembers, per organization, each confirmed and rejected suggestion as a link between a
  line's traits and the party, account and counterpart chosen, and ranks later suggestions by it `(advanced)`.
- **FR-77** The system proposes a bank rule after at least three consistent confirmations of one pattern, with
  the preview of FR-50; a dismissed proposal is not made again for 90 days `(advanced)`.
- **FR-78** The system shows a confidence from 0 to 100 on every suggestion and lets a user with
  `BANK_ACCOUNTS_EDIT` set the confidence above which an account matches automatically `(advanced)`.
- **FR-79** The system lets an agent review the lines still open after an import or synchronisation and deliver one
  batch of proposed matches (splits included) and rules as an inbox item; a user accepts all, some or none; the
  agent commits only what the account's automation level and its permissions allow `(advanced)`.
- **FR-80** The system offers MCP tools for accounts, balances, lines, suggestions, matching, rules, imports,
  reports and the forecast; tools that change data take a preview flag and return effects first `(advanced)`.
- **FR-81** The system raises an alert for two equal outgoing payments to one party within 7 days, an outgoing line
  to an account unknown for its party, an unusual amount for the party, and an unusual bank fee `(advanced)`.
- **FR-82** The system keeps what it learned private to the tenant and lets a user with `BANK_RULES_EDIT` reset it.
- **FR-83** The system publishes events when a statement is imported, a line arrives, a line is matched or
  unmatched, a checkpoint is closed or reopened, a connection needs attention and a guarantee is about to expire.
- **FR-84** The system loads no route, menu entry or job of this feature while `FEATURE_BANKING` is off, and changes
  nothing in payments, invoices or the saved payment instruments; a tenant that has not switched it on keeps it off,
  also after any later change of the default for new tenants.
- **FR-85** The system works without accounting: lines are matched to payments, the book balance is the sum of
  payments on the account, and journal actions are hidden.
- **FR-86** A user with `BANK_ACCOUNTS_EDIT` can import and export banks, bank accounts, party bank accounts and
  rules through `data-import-export`.
- **FR-87** The system keeps the bank details of customers, suppliers and employees in one store only, encrypted at
  rest, masked everywhere except for holders of `BANK_ACCOUNT_NUMBERS_VIEW`, left out of tenant exports unless the
  exporting user holds `BANK_ACCOUNT_NUMBERS_EXPORT`, and writes every read of a full number to the access log;
  payments, payroll and HR read and change these details only through this store.

## 4. Non-Functional Requirements

- **Performance**: import of 50,000 lines within 60 s in the background; suggestions for one line under 300 ms at
  the 95th percentile with one million bank lines and one million open items per tenant; workspace list under
  300 ms; a background matching run over 10,000 lines within 2 minutes; forecast under 2 s.
- **Reliability**: an import is all-or-nothing per row and resumable; a match and what it creates commit together
  or not at all; a repeated synchronisation adds nothing twice; after a reconnect the workspace reloads what changed.
- **Security & privacy**: account numbers are encrypted at rest, kept in one store, masked by default and read only
  with an access-log entry; provider credentials are
  encrypted and never reach the client; provider notices are signature-checked; data leaving the platform: consent
  and payment-order data to the chosen provider, page images to the AI provider for scanned statements only.
- **Observability**: audit of every match, unmatch, exclusion, rule change, checkpoint and reveal (who, when,
  before, after, origin: person, rule, agent); metrics for import duration, automatic match rate, sync failures.
- **Accessibility and localisation**: a fully keyboard-operable workspace with screen-reader labels and live
  announcements; all strings in every shipped locale; dates and amounts per locale.
- **Compatibility**: PostgreSQL, SQLite, MySQL; both ORMs; cloud and self-hosted (feeds need outbound network
  access; file import does not); additive OpenAPI.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| Bank, bank account | A financial institution; an account of the organization there, linked to a ledger account |
| Party bank account | A bank account of a customer, supplier or employee; the platform's only store of such numbers |
| Mapping template, bank statement | A remembered file layout; one import or sync batch with period, balances, counts, status |
| Bank transaction | One line reported by the bank (or entered by hand), with its state |
| Match, counterpart | The link between a line (or a part) and a payment, journal line, transfer leg, deposit or payout |
| Bank rule | Ordered conditions and one outcome that classify a line |
| Suggestion, proposal | A ranked candidate computed for a line; a stored candidate awaiting a person's decision |
| Match memory | What the organization's past decisions taught the ranking |
| Reconciliation checkpoint | The proof that cleared book balance equals a statement balance at a date |
| Daily balance | Bank-reported and book balance of an account on a day |
| Bank connection | A consented link to a bank through a provider, with its accounts and state |
| Payment initiation | The submission of a payment order to a bank and its status |
| Bank guarantee | A guarantee received from or given to a party through a bank |

## 6. Out of Scope

- Payments in and out, allocation to open items, deductions and write-offs, payment orders and bank file formats,
  cheque printing, statements of account, dunning: `payments-and-collections`.
- Card and online payment providers, hosted checkout, provider payouts as such: `payment-gateways`.
- Journals, posting rules, period locks, revaluation: `general-ledger`; ledger account kinds: `accounting-foundation`.
- Tax on bank charges: `tax-engine`. Shift closing and deposits as documents: `point-of-sale-and-loyalty`. Payroll
  bank files: `payroll-processing`. Generic connected accounts and webhooks: `integration-hub`.
- Adapters for specific banks or aggregators: separate provider plugins; this spec ships the provider port and a
  sandbox provider for tests and demos.
- Financial statements and the accounting dashboard: `financial-reports` (it reads the balances kept here).

## 7. Acceptance Criteria

- [ ] **AC-1** A delimited file, a spreadsheet, an MT940 file, an ISO 20022 statement, an OFX file and a text PDF
      are each imported with a correct import record; re-uploading is refused as a duplicate (FR-12, FR-13, FR-16).
- [ ] **AC-2** Rows in a foreign currency go to the error file while the rest imports; a balance gap is flagged (FR-19, FR-22).
- [ ] **AC-3** A line is matched to an existing payment, to three open invoices through a new payment, to a
      journal with a fee split and to a transfer; over-allocation is refused (FR-29, FR-30, FR-40).
- [ ] **AC-4** A rule with a two-line journal previews on history, runs automatically on the next import and can
      be undone; its log and counters are correct (FR-45, FR-47, FR-48).
- [ ] **AC-5** A checkpoint closes at zero difference, locks earlier matches, prints the reconciliation statement
      and reopens only with permission and reason; clearing without a statement creates a matched hand-entered
      line and refuses a cleared date before the posting date (FR-62, FR-63, FR-75).
- [ ] **AC-6** With the sandbox provider: connect, link accounts, scheduled and manual sync, announced to booked
      without duplicates, consent expiry and re-consent with new identifiers (FR-26, FR-33, FR-34).
- [ ] **AC-7** After three confirmations a rule is proposed; rejected suggestions rank lower; only suggestions
      above the confidence threshold are matched automatically (advanced; FR-41, FR-76, FR-77).
- [ ] **AC-8** An agent batch arrives as one inbox item and posts nothing until accepted; MCP tools return
      previews (advanced; FR-79, FR-80).
- [ ] **AC-9** A payment order is submitted through the sandbox provider, executed and matched to its bank lines
      by reference (advanced; FR-39).
- [ ] **AC-10** Two sessions see each other's claims and changes live; a stale commit is refused (advanced; FR-58).
- [ ] **AC-11** A changed supplier bank account triggers second-person approval on a payment order; a duplicate
      outgoing payment raises an alert; the forecast shows the lowest projected day (advanced; FR-11, FR-81).
- [ ] **AC-12** A guarantee is activated with postings, reminded before expiry and expired on its end date (FR-71, FR-73).
- [ ] **AC-13** Every report of §3.9 returns correct figures on the seeded data and drills down.
- [ ] **AC-14** Works on PostgreSQL, MySQL and SQLite with both ORMs, with accounting on and off; behind
      `FEATURE_BANKING`; nothing changes while it is off; every functional requirement has a passing test; a revealed
      number has an access-log entry and a tenant export without `BANK_ACCOUNT_NUMBERS_EXPORT` holds no number (FR-85; §4).
- [ ] **AC-15** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-84).

## 8. Open Questions

- Which real bank providers ship first. Applied default: none here beyond the sandbox provider; each real
  provider is a separate plugin.
- Default automation level. Applied default: "suggest only" for new accounts; automatic levels are opt-in.
- Name similarity for party recognition. Applied default: on, with a high bar, shown as "similar name".
- Keeping statement passwords. Applied default: not kept unless the user opts in per account.

## 9. Constitution Gates

- [x] I Plugin-first — new plugin `packages/plugins/banking` with `banking-ui`; providers are plugins of their own; imports, connections, rules, comments and run records use the platform's existing modules.
- [x] II Tenant/organization scoping — every record is tenant and organization scoped; banks are shared within a tenant only.
- [x] III Both ORMs, additive migrations — new tables and enum values only, three dialects, both ORMs.
- [x] IV Default-off flag; nothing removed — `FEATURE_BANKING` off; payments and instruments untouched.
- [x] V Contracts and API first — every action is an endpoint with contracts; additive OpenAPI.
- [x] VI Permissions, privacy, security — separate keys for numbers, number export, reconcile, close, feeds, initiation; one encrypted store of bank details with access log; encrypted credentials; signed notices.
- [x] VII Real-time through the event bus — workspace presence and changes through the platform push channel; events through the outbox.
- [x] VIII i18n and accessibility — strings in every locale; keyboard-first workspace.
- [x] IX Tests accompany the change — parser fixtures, matching properties, consumers, e2e with the sandbox provider.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Builds on: `packages/core/src/lib/payment`, `packages/plugins/payment`, `packages/core/src/lib/rule`,
  `packages/core/src/lib/organization-vendor`, `packages/core/src/lib/organization-contact`,
  `packages/core/src/lib/integration-tenant`, `packages/core/src/lib/job-execution`,
  `packages/core/src/lib/common/encryption`, `packages/plugins/marketplace` (seller settlements), `apps/api/src/plugin-composition.ts`
- Related features: [`payments-and-collections`](../payments-and-collections/spec.md),
  [`invoicing-receivables-payables`](../invoicing-receivables-payables/spec.md), [`data-import-export`](../data-import-export/spec.md),
  [`access-control-and-security`](../access-control-and-security/spec.md), [`payroll-processing`](../payroll-processing/spec.md),
  [`hr-core-lifecycle`](../hr-core-lifecycle/spec.md),
  [`general-ledger`](../general-ledger/spec.md), [`accounting-foundation`](../accounting-foundation/spec.md),
  [`financial-reports`](../financial-reports/spec.md), [`report-builder-and-dashboards`](../report-builder-and-dashboards/spec.md),
  [`integration-hub`](../integration-hub/spec.md), [`approval-workflows`](../approval-workflows/spec.md)
