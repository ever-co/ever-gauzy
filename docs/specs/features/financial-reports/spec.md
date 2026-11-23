# Feature Specification: Financial reports

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `financial-reports`
**Branch**: `feat/financial-reports`
**Status**: `Draft`
**Created**: 2026-11-15
**Last updated**: 2026-11-23
**Owner**: platform maintainers
**Feature flag**: `FEATURE_FINANCIAL_REPORTS` (default off)

---

## 1. Overview

Today the only financial view is the accounting dashboard: income, expenses, profit and bonus from income and
expense records. There is no ledger report, statement, ageing or register. This feature adds the reporting side of
accounting: the general ledger and trial balances; balance sheet, profit and loss and cash flow built from
editable statement layouts; ratios and analysis by analytic dimension; consolidated statements of a group of
organizations; receivable and payable ageing and amounts per party; lists of sales and purchase documents, trends and margin;
finance cards for dashboards; printable statements. Every report is a report definition of the report builder, so
it can be cloned, pivoted, saved as a view, scheduled and exported like any other. The reports read the ledger
defined by `general-ledger` and `accounting-foundation`; registers and trends read documents and also work without
a ledger. Its statement layouts are the platform's one statement and return layout model: tax returns are layouts
of the same model. Clients: the Angular app with its dashboard cards, the API and SDKs, the MCP server. The
existing accounting dashboard and its widgets stay as they are.

**Advanced capabilities.** Any figure drills down to its postings, the source document and, for work
billed from tracked time, the time entries. Statements are served from maintained balances and update live.
Consolidation performs real eliminations, reports inter-company mismatches, translates currencies and computes
non-controlling interest. Layouts are designed visually with live figures and a check that no account is missed
or counted twice. Month-end packs are frozen on period close and can later be compared with restated figures. An
agent explains any variance in words with links. Margin and dashboards combine the ledger with tracked time.
Marked `(advanced)` below.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** a posted month, **when** the accountant opens the trial balance, **then** each account shows opening,
  debit, credit and closing, groups roll up along the chart, debits equal credits, and the last posting is stated.
- **Given** the profit and loss by month, **when** the controller clicks "Travel, February", **then** a panel lists
  the postings behind it; one click opens the journal and from there the supplier bill.
- **Given** a balance sheet open on a screen, **when** a colleague posts an invoice, **then** receivables and the
  provisional result change on the page within seconds and the changed cells are highlighted.
- **Given** the shipped profit and loss layout, **when** the controller clones it, drags in a row "Subcontractors"
  and picks three accounts, **then** the preview shows real figures and the completeness check passes.
- **Given** a parent and two subsidiaries (one in another currency, one owned at 80 %), **when** the consolidated
  statements are run, **then** inter-company balances and turnover are eliminated in their own column, a
  translation difference and a non-controlling interest line appear, and one disagreeing pair is listed.
- **Given** open customer invoices, **when** ageing is opened as on last month's end, **then** the items open that
  day are shown in age bands per customer, with totals equal to the receivable control account on that day.
- **Given** a month-end pack, **when** the period is closed, **then** the pack is frozen, approved and delivered; a
  month later "compare with now" lists what changed; "Explain" on a variance returns a linked note.

### 2.2 Edge cases & failures

- **Given** a user without `ACCOUNTING_REPORTS_VIEW`, **when** they open a statement, **then** they get 403; any
  user sees only organizations they belong to, also inside a consolidation.
- **Given** a balance sheet whose assets differ from liabilities plus equity, **when** it is shown, **then** a check
  line shows the difference and links to the unmapped accounts or unbalanced journals causing it.
- **Given** a layout draft with an expense account in no row, **when** it is published, **then** publishing is
  refused listing the accounts, unless each is confirmed as deliberately left out.
- **Given** a report over ten million postings that cannot answer in time, **when** it is run, **then** it runs in
  the background and the user is notified; nothing times out.
- **Given** a consolidation where a member's period is open, **when** the run is finalized, **then** it is refused
  naming the member; a draft run is allowed and marked provisional.
- **Given** a missing exchange rate for a presentation currency, **when** a report needs it, **then** the report
  names the missing rate and shows no partial totals for that currency.
- **Given** a frozen pack, **when** postings are later made in its period, **then** the pack does not change; with
  no AI provider "Explain" is unavailable with a reason; with budgets off the budget report and column are hidden.

## 3. Functional Requirements

### 3.1 Behaviour shared by all reports

- **FR-1** The system registers every report of this spec as a report definition of the report builder, listed in
  the catalogue under Ledger, Statements, Receivables and payables, Registers and Consolidation.
- **FR-2** The system offers on every ledger-based report the filters organization, ledger book, dates or fiscal
  periods with presets, ledger accounts (one, a range, a kind, a category), party and any analytic dimension.
- **FR-3** The system shows any report in a presentation currency: balances at the report date's rate, movements
  at the posting-date or period-average rate (by option), the translation difference on its own line.
- **FR-4** The system compares columns by period (monthly to yearly, custom), per period or accumulated, with the
  previous period, the same period last year and, with budgets enabled, the budget, with difference and percentage.
- **FR-5** The system lets the user count period-closing journals in the opening balance, in the period, or not
  at all (the result before closing).
- **FR-6** The system offers on every report: hide zero rows, show reversed entries, and the time of computation
  with the last posting included.
- **FR-7** The system drills down from any figure to its postings, from a posting to its journal and source
  document, and from an invoice line billed from tracked time to the time entries `(advanced)`.
- **FR-8** The system serves balances from maintained totals and runs a report that cannot answer within 5 seconds
  in the background, notifying the user when it is ready.
- **FR-9** The system updates an open statement, ledger report or card when a posting that affects it arrives,
  highlights what changed, and lets the user freeze the view `(advanced)`.
- **FR-10** A user viewing a statement can add a column "with drafts" showing the effect confirmed drafts would
  have, computed from the effects preview without posting anything `(advanced)`.
- **FR-11** The system refuses every report route to users without the view permission of its group and shows
  only data of organizations the user belongs to.
- **FR-12** The system exports and prints every report through the report builder (PDF, spreadsheet, delimited
  text) and schedules it by email as any report definition.

### 3.2 Ledger reports

- **FR-13** The system provides the general ledger: postings by account, party, document or dimension over a range
  with opening, running and closing balance, grouped by any of these or not at all, with counter-account, settled
  document, party tax number, document-currency amounts and a remarks column of set length.
- **FR-14** The system provides the daily journal: every journal of a range in date order, one line per journal or
  all its lines, filtered by document type.
- **FR-15** The system provides account balances at a date, filtered by account kind (bank, cash and others).
- **FR-16** The system provides the trial balance: opening, debits, credits and closing per account rolled up along
  the chart, a proof that debits equal credits, a line for the unclosed result of earlier years, net or gross view.
- **FR-17** The system provides the current-year trial balance: accounts with a balance in the current fiscal year, flat,
  without any parameter.
- **FR-18** The system provides balances per party: opening, movement and closing per customer, supplier or
  employee, filtered by party and account, hiding parties at zero on request.
- **FR-19** The system provides open items with their settlements: every receivable and payable item with its settlements and
  remaining amount, in account currency, grouped by party on request.
- **FR-20** The system provides journals that do not balance: journals whose debits and credits differ.
- **FR-21** The system provides control accounts against open items: differences between a control account and
  the open items of its parties, per party and document.
- **FR-22** The system provides postings without a valid source: postings whose source document is missing, or cancelled
  without a reversal.
- **FR-23** The system provides mismatched discounts: documents whose stored discount differs from the amount
  recalculated from their lines.

### 3.3 Statements and analysis

- **FR-24** The system provides the balance sheet at a date and over periods from a statement layout, with the
  unclosed period's provisional result as an equity line and a check that assets equal liabilities plus equity.
- **FR-25** The system provides the profit and loss statement per period from a layout, with gross profit,
  operating result and net result lines.
- **FR-26** The system provides the cash flow statement (operating, investing, financing; opening and closing
  cash) by the indirect (default) or direct method, and flags closing cash that differs from cash and bank accounts.
- **FR-27** The system shows a statement as values, as growth against the previous column, or as shares (of
  revenue for profit and loss, of total assets for the balance sheet).
- **FR-28** The system splits a statement into columns by the values of one analytic dimension, with a column for
  unassigned amounts, and expands a layout line into its accounts on request.
- **FR-29** The system provides gross and net profit with margins, per period or accumulated.
- **FR-30** The system provides financial ratios per period (liquidity, solvency, profitability, turnover) as
  formulas over layout lines; a user with `ACCOUNTING_STATEMENT_LAYOUTS_EDIT` can add ratios.
- **FR-31** The system provides profitability by dimension: income, expense and result per value of a cost centre,
  project, party or any analytic dimension, as a tree where the dimension is hierarchical.
- **FR-32** The system provides balances by dimension: every account's balance split by one dimension.
- **FR-33** The system provides budget against actual per account and period with variance and percentage, per
  budget scope and cumulative on request, reading the budgets of `budgets-and-revenue-schedules`.

### 3.4 Statement layouts and designer

- **FR-34** A user with `ACCOUNTING_STATEMENT_LAYOUTS_EDIT` can define a statement layout as ordered rows: account
  rows (selected by kind, category, number range, tag or list, with exclusions), formula rows over other rows,
  headings, blank rows, column breaks for side-by-side presentation, and metric rows fed by another report.
- **FR-35** A user with `ACCOUNTING_STATEMENT_LAYOUTS_EDIT` can set per row which balance it shows (opening,
  closing, movement), its sign, when it is hidden, its presentation, its rounding unit and its use in the chart.
- **FR-36** The system ships read-only layouts (balance sheet and profit and loss, vertical and side by side; cash
  flow; ratios) in an international presentation; country layouts arrive with country packs, and tax return layouts
  of `tax-engine` use the same layouts over the tax register (so a tax return needs this feature on); any can be
  cloned.
- **FR-37** The system runs any layout as a statement with the options of §3.1, and keeps one default layout per
  statement kind and organization.
- **FR-38** The system versions layouts with an effective date and a draft and published state, and uses for a
  past period the version in force then unless the user picks another.
- **FR-39** A user with `ACCOUNTING_STATEMENT_LAYOUTS_EDIT` can export a layout to a file and import one.
- **FR-40** The system offers a visual designer: rows are dragged into place, accounts picked from a searchable
  chart showing balances, formulas built with completion of row codes, with a live preview `(advanced)`.
- **FR-41** The system lists, in the designer, accounts in no row or in several rows, publishes such a layout only
  after each is acknowledged, and notifies layout owners of new ledger accounts `(advanced)`.

### 3.5 Consolidation

- **FR-42** A user with `ACCOUNTING_CONSOLIDATION_MANAGE` can define a consolidation group: organizations of the
  tenant under a parent, each with ownership percentage and dates, a method (full or proportional), the
  presentation currency, and a mapping of member accounts to group lines where charts differ.
- **FR-43** The system provides the consolidated trial balance: one column per organization, an eliminations column
  and the group total, in the presentation currency.
- **FR-44** The system provides consolidated balance sheet, profit and loss and cash flow per period or
  accumulated, with per-organization columns on request.
- **FR-45** The system translates each member by the rule below and shows the cumulative translation difference
  as an equity line.
- **FR-46** The system eliminates, by rules of the group, balances and turnover between members, dividends, the
  parent's investment against the member's equity and a stated margin on stock bought inside the group, as
  elimination entries in their own column, each traceable to its source postings `(advanced)`.
- **FR-47** The system lists inter-company mismatches (members whose mutual balances or turnover differ) with their
  documents, marks a run that has any, and can carry a difference to a consolidation-only line `(advanced)`.
- **FR-48** The system computes non-controlling interest in result and equity from ownership `(advanced)`.
- **FR-49** A user with `ACCOUNTING_CONSOLIDATION_MANAGE` can add consolidation-only adjustments, finalize a run
  (refused while a member's period is open) and rerun it as a new version; a final run is frozen and audited.
- **FR-50** The system provides consolidated receivable and payable ageing and summaries over chosen organizations,
  grouped by organization or by party, with items between members left out on request.

| Item translated | Rate used |
| --- | --- |
| Assets and liabilities | closing rate of the report date |
| Income and expenses | average rate of each period (or posting-date rate, by option) |
| Equity and investments | historical rate of each posting |

### 3.6 Receivables and payables

- **FR-51** The system provides receivable ageing: items open on an "as on" date, aged by due date (default),
  document date or posting date into the bands of a bucket scheme, per document or per instalment, with amounts
  invoiced, paid, credited and outstanding, in party or organization currency.
- **FR-52** The system computes ageing for a past date from what was open on that date, not from today's state.
- **FR-53** A user with `ACCOUNTING_STATEMENT_LAYOUTS_EDIT` can define bucket schemes (number and width of bands;
  default 30, 60, 90, 120 days and older), the platform's only definition of age bands; any viewer picks one per run.
- **FR-54** The system filters and groups ageing by party, group, territory, sales person, payment terms, account,
  dimension and ledger book, shows payments dated after the "as on" date apart, and links delivery documents.
- **FR-55** The system provides outstanding amounts per customer: one row per customer with total outstanding, bands, amounts
  on account, and the ledger balance for cross-checking.
- **FR-56** The system provides payable ageing and outstanding amounts per supplier with the same rules, by
  supplier group, including employee advances and claims on request.
- **FR-57** The system provides balance movements per customer and supplier: opening, invoiced, paid, credited and
  closing per party over a period, with credit and debit notes shown apart on request.
- **FR-58** The system provides days to payment per party: for payments of a period, the days between document
  date (or due date) and payment, in bands and as an average per party.
- **FR-59** The system provides amounts falling due ahead: amounts falling due in coming bands and the cash expected per week
  from each party's average settlement delay `(advanced)`.

### 3.7 Registers, trends and margin

- **FR-60** The system provides the list of sales invoices: every customer invoice and credit note of a period with net, one
  column per tax, total, outstanding and payment methods, with filters on party, owner, dimension and item group.
- **FR-61** The system provides the list of supplier bills with the same rules.
- **FR-62** The system provides sales and purchase lines per item: one row per document line with item,
  quantity, price, amount, taxes and account, grouped by document, item, item group or party.
- **FR-63** The system provides invoiced sales and purchases per period: amounts and quantities per period by party,
  item, item group, territory or project.
- **FR-64** The system provides gross profit per invoice line (selling amount, valuation cost of the stock
  delivered, margin), grouped by invoice, item, item group, brand, stock location, customer, group, territory,
  sales person, project, dimension, month or payment terms, with returns included or left out. The valuation cost
  comes from the stock valuation of `stock-ledger-and-valuation`, which keeps its value layers with accounting on or
  off; where stock valuation is not in use, the report shows the selling amounts and marks cost and margin as
  unavailable with the reason.
- **FR-65** The system takes, for a line billed from tracked time, the cost as tracked hours at each employee's
  cost rate, and offers revenue per tracked hour as a measure `(advanced)`.
- **FR-66** The system provides the commission statement: commission owed per sales partner and sales person for
  the invoices of a period, from the commissions recorded on documents.
- **FR-67** The system provides items without recent sales: items sold before but not in the last N days, by territory and
  item group.
- **FR-68** The system provides three lists of open billing from the document flow: delivered not yet invoiced,
  received not yet billed, and billed not yet received, per line with quantities and amounts.
- **FR-69** The system provides receipts per payment method: amounts received per method, day and user, for register
  sales only on request, with each payment as detail.
- **FR-70** The system serves the reports of this section from documents alone, so they work without accounting.

### 3.8 Dashboards, printable statements and packs

- **FR-71** The system keeps the existing accounting dashboard and its widgets unchanged, and lets a user switch
  its figures from income and expense records (default) to the ledger when accounting is enabled.
- **FR-72** The system registers finance cards in the dashboard widget registry: receivables and payables by age
  band, result by month, revenue against expenses, cash and bank balances, budget variance, bills and invoices
  falling due, payments in and out, largest debtors, days sales and payable outstanding, margin, working capital.
- **FR-73** The system seeds a "Finance" dashboard for organizations with the feature on; every card honours the
  dashboard's filters and opens its report on click.
- **FR-74** The system offers people-margin cards combining the ledger with tracked time: revenue per tracked
  hour, labour cost as a share of revenue, margin per team and project `(advanced)`.
- **FR-75** The system provides print templates for the general ledger, trial balance, ageing, balance sheet,
  profit and loss, cash flow, daily journal, registers, party statement, balance confirmation letter and the list
  of pending documents per party, each editable like any print template.
- **FR-76** The system renders a party statement in two forms, by ledger movements or by open items with an ageing
  footer, for `payments-and-collections` to run, schedule and deliver.
- **FR-77** A user with `ACCOUNTING_REPORT_PACKS_MANAGE` can define a report pack as a report-builder schedule
  (reports with fixed options, recipients, a recurrence or "on period close", approval or not); the system produces
  it as one document and one spreadsheet, frozen with a content fingerprint, and delivers it after approval `(advanced)`.
- **FR-78** The system compares a frozen pack with current figures of the same period and lists the postings made
  since `(advanced)`.

### 3.9 Explanations, notes, agents and compatibility

- **FR-79** A user with `ACCOUNTING_REPORTS_VIEW` can ask to explain any figure or variance; the system returns a
  short text naming and linking the accounts, parties and documents that drove it, kept as an assistant note
  `(advanced)`.
- **FR-80** A user with `ACCOUNTING_ANNOTATIONS_EDIT` can add, edit and remove notes on a statement line for a
  period, mention colleagues, and include notes in a pack `(advanced)`.
- **FR-81** The system flags unusual movements on a statement (a balance far from its trailing average, a sign
  unusual for the account kind, unmapped accounts) as hints, never as changes `(advanced)`.
- **FR-82** The system offers MCP tools to read every report, drill down, explain a variance, find a report from a
  question in words, and produce a pack or add a note with a preview first `(advanced)`.
- **FR-83** The system loads no route, card or job of this feature while `FEATURE_FINANCIAL_REPORTS` is off, and the
  existing report catalogue and report menu list none of its reports; ledger-based reports also need
  `FEATURE_ACCOUNTING`; existing reports, saved reports and dashboards are unchanged.
- **FR-84** The system never writes to the ledger, to a document or to a member organization from a report, a
  consolidation or a pack.

| Group | Reports | Reads | Works without accounting |
| --- | --- | --- | --- |
| Ledger | FR-13 to FR-23 | postings, balances, open items | no (FR-23: yes) |
| Statements | FR-24 to FR-33, FR-37 | balances through layouts, budgets | no |
| Consolidation | FR-43, FR-44, FR-50 | balances of members, elimination entries | no |
| Receivables and payables | FR-51 to FR-59 | open items and settlements | no |
| Registers and trends | FR-60 to FR-69 | invoices, bills, payments, document flow, stock cost, tracked time | yes |
| Cards | FR-71 to FR-74 | the reports above | partly (document-based cards) |

## 4. Non-Functional Requirements

- **Performance**: trial balance, balance sheet and profit and loss for an organization with ten million postings
  under 2 s at the 95th percentile from maintained balances; a general ledger page of 200 lines under 300 ms;
  ageing over one million open items under 3 s; a card under 500 ms; consolidation of 20 organizations under 30 s
  in the background; a live update on screen within 5 s of a posting.
- **Reliability**: a report is computed from one consistent reading (no half-applied journal); maintained totals
  are verified nightly against the ledger; frozen packs and final runs never change.
- **Security & privacy**: figures are visible only with the group's view permission and organization membership;
  party reports follow contact visibility; data leaving the platform: scheduled emails to chosen recipients and,
  for "Explain", aggregated figures and document references (no bank or tax numbers) to the configured AI provider.
- **Observability**: audit of layout publication, consolidation runs, adjustments, pack production, approval and
  delivery; metrics for report duration, background runs, live-update lag, verification drift.
- **Accessibility and localization**: statement grids are keyboard navigable (expand, collapse, drill) with
  screen-reader headers; layout labels, report names and assistant notes in the user's language; numbers per locale.
- **Compatibility**: PostgreSQL, SQLite, MySQL; both ORMs; multi-tenant cloud and self-hosted; additive OpenAPI.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| Report definition | A registered report (data set, filters, columns, groupings, chart) of the report builder |
| Statement layout, version, row | The editable structure of a statement, its dated versions and its rows |
| Bucket scheme | Named age bands used by ageing |
| Consolidation group, member, group mapping | Organizations consolidated under a parent; which group line a member's account belongs to |
| Elimination rule | What is removed between members and how it is found |
| Consolidation run, consolidation entry | A versioned result for a period; an elimination, translation, interest or adjustment entry in it |
| Inter-company mismatch | A pair of members whose mutual figures do not agree |
| Report pack, pack run | A report-builder schedule of several reports; one frozen run of it for a period |
| Statement note | A person's or the assistant's note on a statement line and period, kept as a comment thread |
| Finance card | A dashboard widget backed by a report definition |
| Maintained balance | A total kept per account, period, book and dimension; the source of statements |

## 6. Out of Scope

- The ledger, journals, posting, period close, revaluation, repair of ledger defects and the effects preview of a
  draft: `general-ledger`. Chart, account kinds, fiscal periods, dimensions: `accounting-foundation`.
- The report builder, pivoting, saved views, schedules, background runs, exports and dashboards as such:
  `report-builder-and-dashboards`.
- Bank reconciliation reports and bank balances as data: `banking-and-reconciliation`. Tax reports, return
  preparation and filing: `tax-engine` (its return layouts are layouts of this feature). Open items and their
  settlements as data: `invoicing-receivables-payables`. Budgets as data: `budgets-and-revenue-schedules`.
- Running, scheduling and delivering statements of account, dunning: `payments-and-collections`.
- Commission rules and amounts, sales people and territories: `sales-order-management`. Stock valuation cost:
  `stock-ledger-and-valuation`. Project profitability: `project-costing-and-billing`. Asset and payroll reports:
  `fixed-assets`, `payroll-processing`.
- Country statement layouts and statutory formats: `regional-compliance-packs`. Print template editing:
  `print-and-pdf-designer`.

## 7. Acceptance Criteria

- [ ] **AC-1** On the seeded ledger the trial balance proves, the balance sheet checks, the profit and loss result
      equals the provisional result on the balance sheet, and closing cash equals the cash and bank accounts (FR-25, FR-27).
- [ ] **AC-2** Each ledger report (FR-13 to FR-23) returns the expected rows, including the seeded journal that does not
      balance, the posting without a valid source and the control account difference.
- [ ] **AC-3** Receivable and payable ageing "as on" a past date equal the control accounts on that date; outstanding amounts,
      balance movements and days to payment agree with them (FR-51, FR-52, FR-56).
- [ ] **AC-4** Each document list, trend, margin and open billing report (FR-60 to FR-69) returns the expected rows with
      accounting on and off; gross profit (FR-64) shows cost and margin wherever stock valuation is in use, and marks
      them unavailable where it is not.
- [ ] **AC-5** A cloned layout edited in the designer previews live figures; publishing with an unmapped account is
      refused until acknowledged; a past period uses the version in force (advanced; FR-37, FR-39–FR-41).
- [ ] **AC-6** A three-organization group produces consolidated statements with eliminations, translation
      difference, non-controlling interest and one listed mismatch; no member ledger changes (advanced; FR-43, FR-44, FR-46).
- [ ] **AC-7** Any figure drills to postings, journal and document, a time-billed line to its time entries; gross
      profit shows labour cost from tracked time (advanced; FR-7).
- [ ] **AC-8** An open statement and a card change within 5 s of a posting and can be frozen (advanced; FR-9).
- [ ] **AC-9** A pack is produced on period close, approved, delivered, unchanged after later postings, and
      "compare with now" lists them (advanced; FR-77, FR-78).
- [ ] **AC-10** "Explain" returns a linked note for a seeded variance; notes print in the pack; MCP tools return
      statements, drill-downs and previews (advanced; FR-79, FR-80).
- [ ] **AC-11** The finance cards show correct figures, honour dashboard filters and open their reports; the
      existing accounting dashboard is unchanged with the flag off (FR-72, FR-73).
- [ ] **AC-12** A statement over ten million postings meets the target; a slow grouping runs in the background (FR-8).
- [ ] **AC-13** Works on PostgreSQL, MySQL and SQLite with both ORMs; behind `FEATURE_FINANCIAL_REPORTS`; nothing
      changes while it is off; every functional requirement has a passing test (FR-83; §4).
- [ ] **AC-14** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-83).

## 8. Open Questions

- Who keeps the maintained balances. Applied default: the posting engine of `general-ledger` owns them; this
  feature reads them and adds a daily roll-up of its own only for date ranges inside a period.
- Equity-method consolidation. Applied default: not in the first release; full and proportional methods only.
- Direct-method cash flow. Applied default: indirect method complete; direct method available once cash-flow
  categories are set on accounts.
- The commission statement depends on `sales-order-management` recording commissions on documents. Applied default: the
  report is listed only when that data exists.
- Assistant explanations send aggregated figures to the configured AI provider. Applied default: off until an
  administrator enables it per organization.

## 9. Constitution Gates

- [x] I Plugin-first — a module of the `accounting` plugin with UI in `accounting-ui`; core gains only catalogue rows; packs, background runs and notes use the report builder and core comments.
- [x] II Tenant/organization scoping — all records tenant and organization scoped; consolidation reads only organizations the user belongs to.
- [x] III Both ORMs, additive migrations — new tables and additive columns on the report builder's schedule tables, three dialects, both ORMs.
- [x] IV Default-off flag; nothing removed — flag off; the existing dashboard, widgets, reports and saved reports stay.
- [x] V Contracts and API first — every report runs through documented endpoints; additive OpenAPI.
- [x] VI Permissions, privacy, security — view keys per report group, separate keys for layouts, consolidation, packs and notes; AI use opt-in.
- [x] VII Real-time through the event bus — live figures through posting events and the platform push channel.
- [x] VIII i18n and accessibility — layout labels and strings in every locale; keyboard-navigable grids.
- [x] IX Tests accompany the change — statement identities as tests, data-set specs per report, consolidation fixtures.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Builds on: `packages/core/src/lib/reports`, `packages/core/src/lib/saved-report`, `packages/core/src/lib/dashboard`,
  `packages/core/src/lib/employee-statistics`, `packages/ui-core/shared/src/lib/dashboard/widgets/accounting`,
  `apps/gauzy/src/app/pages/dashboard/accounting`
- Related features: [`general-ledger`](../general-ledger/spec.md), [`accounting-foundation`](../accounting-foundation/spec.md),
  [`report-builder-and-dashboards`](../report-builder-and-dashboards/spec.md), [`payments-and-collections`](../payments-and-collections/spec.md),
  [`invoicing-receivables-payables`](../invoicing-receivables-payables/spec.md), [`budgets-and-revenue-schedules`](../budgets-and-revenue-schedules/spec.md),
  [`banking-and-reconciliation`](../banking-and-reconciliation/spec.md), [`tax-engine`](../tax-engine/spec.md),
  [`regional-compliance-packs`](../regional-compliance-packs/spec.md)
