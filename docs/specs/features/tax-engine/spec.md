# Feature Specification: Tax engine

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `tax-engine`
**Branch**: `feat/tax-engine`
**Status**: `Draft`
**Created**: 2026-11-15
**Last updated**: 2026-11-23
**Owner**: platform maintainers
**Feature flag**: `FEATURE_TAX` (existing; wired to the tax routes and menu by this spec) · new behaviour behind
`FEATURE_TAX_DOCUMENTS` and `FEATURE_WITHHOLDING` (both default off)

---

## 1. Overview

Today the platform taxes documents in two unconnected ways. Carts, orders and returns are taxed by the tax plugin
(categories, rates, rate parts, regimes) with a breakdown in the tax-line ledger; invoices, estimates and supplier
bills carry two percentages typed by hand, computed in the browser, with no breakdown, account or report. This
feature makes the tax plugin the **single tax path of every commercial document** (quotations, orders, invoices,
credit and debit notes, supplier bills, purchase orders, point-of-sale sales, expense claims, carts, returns): one
server-side calculation resolves the regime, each line's category and the rates, handles prices that include tax,
distributes and rounds exactly, stores one tax line per rate part, names the ledger account of each amount,
withholds tax where the payer must, and feeds a tax register that every tax report reads. The typed percentages
keep working as manual rates of the same calculation. Clients: the Angular app, the customer and supplier portal,
the API and SDKs, the MCP server. Country content comes from `regional-compliance-packs`; return layouts use the
statement and return layout model of `financial-reports`.

**Advanced capabilities.** Every tax line answers "why this rate" from a stored trace; tax numbers are
checked offline and verified against official registers through pluggable verifiers, with evidence kept; a rate,
regime or rule can be simulated against open and upcoming documents before it takes effect; tax periods prepare
their own frozen report pack, reconciled to the ledger; withholding ends in a remittance and in statements to the
parties; an agent reviews tax anomalies and proposes fixes a person approves. Marked `(advanced)` below.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** an organization in determined mode, **when** an accountant adds a reduced-category item to a customer
  invoice, **then** the line shows the reduced rate and the invoice a breakdown by rate; nobody typed a percentage.
- **Given** a foreign customer with a verified tax number and a regime "buyer accounts for the tax", **when** a
  quotation is created, **then** tax is zero, the legal mention is printed, and "Why this tax?" names rule and rate.
- **Given** a price list whose prices include tax, **when** an order line is entered at 119.00 under a 19 % rate,
  **then** net is 100.00, tax 19.00, and the order total equals the sum of entered prices to the cent.
- **Given** an organization in manual mode, **when** a user creates an invoice with "Tax 10 %" and a compound
  "Tax 2 5 %", **then** the totals are today's totals, and the invoice has two tax lines and appears in tax reports.
- **Given** a supplier under a 10 % withholding category with a yearly threshold of 30,000, **when** a bill takes
  the year from 28,000 to 33,000, **then** the preview shows the amount withheld and the payable reduced by it.
- **Given** a rate rising on 1 January, **when** an administrator creates the successor and runs the simulation,
  **then** they see which open drafts, uninvoiced orders and upcoming recurring invoices change and by how much.

### 2.2 Edge cases & failures

- **Given** a determined-mode draft with a line that resolves to no rate, **when** it is confirmed, **then**
  confirmation is refused naming the line, unless the organization allows untaxed lines.
- **Given** two users editing one draft, **when** both save, **then** each save recomputes on the latest version,
  the second is told the document changed, and no tax line of a removed line survives.
- **Given** a confirmed invoice, **when** a rate, category, override or regime is edited later, **then** the
  invoice, its breakdown and its register entries do not change.
- **Given** a filed period, **when** an invoice dated inside it is confirmed late or cancelled, **then** the entry
  lands in the open period as a late entry naming the original period; the filed pack is unchanged.
- **Given** a user without `TAX_DOCUMENT_OVERRIDE`, **when** they change a line's rate, **then** they get 403.
- **Given** a bill whose withholding was remitted, **when** it is cancelled, **then** a reversing entry is carried
  as a credit to the next remittance; the remitted statement is not altered.
- **Given** a bulk re-tax of 500 drafts where 3 fail, **when** it ends, **then** 497 are re-taxed and 3 listed;
  an agent asking for the same through MCP first receives a preview and changes nothing until a person confirms.

## 3. Functional Requirements

### 3.1 Scope, modes and compatibility

- **FR-1** The system computes the tax of every commercial document type registered with the business document
  engine on the server, as the tax stage of the totals pipeline; clients never supply a tax amount.
- **FR-2** The system keeps a tax mode per organization, `manual` (default) or `determined`; a document takes its
  mode at creation, shows it and keeps it for life.
- **FR-3** The system, in manual mode, turns the two typed taxes of an invoice (percent or flat, simple or
  compound, per-line switch, discount settings) into tax lines equal to today's amounts to the smallest unit.
- **FR-4** The system treats a request with typed tax values and no mode as a manual document whatever the
  organization's mode, and refuses (400) `determined` together with a non-zero typed tax.
- **FR-5** The system never re-taxes an existing document because a flag, mode or setting changed.
- **FR-6** The system changes nothing in invoices, estimates, carts, orders and returns while
  `FEATURE_TAX_DOCUMENTS` is off, and refuses every tax route and hides the tax menu while `FEATURE_TAX` is off;
  `FEATURE_TAX` is switched on, before its guard applies, for every tenant that already holds tax categories, rates or
  regimes, and a tenant that has not switched `FEATURE_TAX_DOCUMENTS` or `FEATURE_WITHHOLDING` on keeps them off, also
  after any later change of the default for new tenants.
- **FR-7** The system keeps every existing tax category, rate, rate part and regime, their routes, GraphQL fields
  and permissions, with unchanged results for carts, orders and returns.
- **FR-8** The system refuses to confirm a determined-mode document with a taxable line without a rate, unless
  "allow untaxed lines" is on; then the line is taxed at zero with a notice in its explanation.

### 3.2 Rates and calculation bases

- **FR-9** A user with `TAX_RATES_EDIT` can give a rate one basis: line net (default), running total with earlier
  taxes, named earlier taxes only, a fixed amount per unit of quantity, weight or volume, or a lump sum per document.
- **FR-10** The system distributes a lump sum over the taxable lines by net (or quantity or weight, as the rate
  says), the last line taking the remainder so the parts add up exactly.
- **FR-11** The system applies a line's rates in a fixed order (priority, then code) and refuses to save a rate
  that depends on itself, on a later rate or on a rate that cannot apply with it.
- **FR-12** A user with `TAX_RATES_EDIT` can state for a purchase-side rate whether its amount is payable, added
  to item cost or both, and whether it adds or deducts; cost-only amounts go to stock valuation, never to the total.
- **FR-13** A user with `TAX_RATES_EDIT` can state a purchase-side part's recoverable share; the system splits the
  tax into deductible and non-recoverable amounts with separate accounts `(advanced)`.
- **FR-14** The system offers "supersede" on a rate used by a confirmed document: close its window and open a
  successor on a given date, in one step; editing the percentage, basis or parts of such a rate stays allowed as today
  (stored tax lines and register entries never change) unless the organization protects rates in use (setting,
  default off), in which case the edit is refused and supersede offered.
- **FR-15** A user with `TAX_RATES_EDIT` can deactivate a rate or a regime; it stops being a candidate and stays
  readable on past documents.
- **FR-16** The system records for every zero result its kind (zero-rated, exempt, outside the scope, accounted for
  by the buyer) and a reason, prints the reason and reports each kind separately.
- **FR-17** The system marks rates, regimes and layouts installed by a country pack with pack and version, and
  keeps an organization's own edits when the pack is updated.

### 3.3 Regimes, determination rules and item-level tax

- **FR-18** The system selects one regime per document, in order: chosen on the document; assigned to the party;
  the highest-priority matching determination rule; a regime's destination trigger; else the general rate set.
- **FR-19** A user with `TAX_REGIMES_EDIT` can attach prioritized rules to a regime, conditioned on party, group,
  party tax category, registration, item, item category, addresses, channel, document type, amount and dates.
- **FR-20** The system refuses to save a rule that can match the same document as another active rule of equal
  priority, and shows the overlapping conditions.
- **FR-21** A user with `TAX_SETTINGS_EDIT` can choose taxing by delivery address (default) or billing address; the
  system falls back to the other, then the party's main address, then the organization's, and records which.
- **FR-22** A user with `TAX_DOCUMENT_OVERRIDE` can choose a regime on a draft; the choice is kept and explained.
- **FR-23** A user with `TAX_REGIMES_EDIT` can give a regime a legal mention per language; the system prints it on
  every document taxed under the regime.
- **FR-24** The system, where the buyer accounts for the tax, shows zero tax with the mention on sales documents
  and computes a payable and a deductible leg on purchase documents (net zero), reporting both.
- **FR-25** A user with `TAX_REGIMES_EDIT` can set a default regime per organization and direction and limit a
  rule to sales channels; an anonymous buyer's cart is determined from the destination alone.
- **FR-26** The system resolves a line's tax category from the first that exists: line override; item tax override
  matching regime, destination and date; variant; item; item category; party category; organization default.
- **FR-27** A user with `TAX_ITEM_OVERRIDES_EDIT` can override the tax of an item, variant or item category,
  optionally per regime, place and dates, with another category, a specific rate, or "not taxable" with a reason.
- **FR-28** The system refuses two overrides for the same target and scope whose windows intersect.
- **FR-29** The system applies overrides when a line's item is set, and re-resolves a draft when its party,
  addresses, date, regime or lines change, showing which lines changed tax.
- **FR-30** The system marks open drafts "tax out of date" when configuration they used changes; a user with
  `TAX_DOCUMENT_OVERRIDE` can re-tax selected drafts in bulk after a preview, with a result per document.

### 3.4 Prices including tax, distribution and rounding

- **FR-31** The system takes a document's price basis (prices include tax or not) from its price list, else the
  region, else the organization default; switching it on a draft recomputes the document.
- **FR-32** The system, for prices that include tax, derives the net through the whole chain (compound and
  tax-on-tax included) so that net plus taxes equals the entered price.
- **FR-33** The system refuses a line whose chain mixes included and added rates, and refuses to save a lump-sum,
  per-unit or cost-only rate as "included in the price".
- **FR-34** A user with `TAX_SETTINGS_EDIT` can choose rounding per line (default) or per document and rate: line
  taxes are summed unrounded, rounded once, and the difference allocated to lines by largest remainder.
- **FR-35** The system keeps the entered prices under prices that include tax, so no drift arises: a line's net is
  its entered price less its rounded tax. With rounding per line, each line's tax is rounded on its own; with rounding
  per document, the tax of each rate is computed once from the sum of the entered prices of its lines, rounded, and
  distributed to those lines by largest remainder of their unrounded taxes. Nets plus taxes then equal the entered
  prices on every line and in total, and no line's tax is negative or larger than its price (50 lines of 0.01 at
  19 % per document: tax 0.08 on eight lines of 0.01, nets 0.42, total 0.50).
- **FR-36** A user editing a draft can switch "round the total" (default from the organization) to round the
  payable total to the currency's cash increment; the difference is one rounding row, never tax.
- **FR-37** The system computes with exact decimals, rounds at the currency's scale, stores amounts in document and
  organization currency at the document's rate, and puts conversion remainders on the last tax line.
- **FR-38** The system taxes a line on its net after line discounts and its share of document discounts; under the
  organization's "discount after tax" setting document discounts do not reduce the base.

### 3.5 Charges and tax on a document

- **FR-39** The system taxes document charges (shipping, freight, handling, packaging, insurance, fees) as charge
  rows with a tax category of their own or, by option, at the weighted rates of the document's lines.
- **FR-40** The system accepts a charge's amount from the feature that computes it (shipping charges from
  `delivery-and-shipping`, others typed or defaulted) and gives each charge row an account and analytic dimensions.
- **FR-41** A user editing a purchase document can mark a charge as added to item cost, distributed by value,
  quantity or weight; the distributed amounts are handed to stock valuation.
- **FR-42** The system stores, per document line and charge, one tax line per rate part (base, rate, amount,
  currency, basis, regime, kind, account) and a summary per document grouped by rate.
- **FR-43** The system exposes the line-by-line breakdown and the summary by rate in the API, the document forms,
  the customer and supplier portal and as fields for print templates.
- **FR-44** A user with `TAX_DOCUMENT_OVERRIDE` can, on a draft line, pick another category or rate, mark it not
  taxable, or adjust the tax within the tolerance; author and reason are recorded and re-resolution stops.
- **FR-45** A user entering a supplier bill can type the supplier's stated tax total; within the tolerance the
  difference goes on the largest tax line, beyond it confirmation needs `TAX_DOCUMENT_OVERRIDE`.
- **FR-46** The system recomputes a draft whenever a tax-relevant value changes and changes a confirmed document's
  tax only through a change set, an amendment or a credit or debit note.
- **FR-47** The system copies each line's determination when a document is created from another, re-resolves only
  if the tax point date falls in another rate window, and taxes credit notes and returns at the original's rates.
- **FR-48** The system taxes a partly invoiced, delivered or returned line in proportion, the last part taking the
  remainder so the parts equal the original tax.
- **FR-49** A user with `TAX_REGIMES_EDIT` can set a regime's tax point to document date (default), delivery date
  or payment date; with payment date, tax becomes reportable in proportion as payments are allocated.
- **FR-50** The system deducts, per rate, the tax charged on an advance invoice when the final invoice deducts it.
- **FR-51** The system updates the totals and breakdown of an open draft live for every viewer.

### 3.6 Tax accounts

- **FR-52** A user with `TAX_ACCOUNTS_EDIT` can map ledger accounts and dimensions for tax collected, deductible,
  non-recoverable, buyer-accounted, awaiting payment, withheld and rounding, per organization, category, rate or part;
  this is the platform's only tax-to-account map, and country packs fill it.
- **FR-53** The system accepts only active ledger accounts of the same organization whose kind allows tax
  amounts, and shows for an account the rates mapped to it.
- **FR-54** The system hands `general-ledger`, for each confirmed, cancelled or credited document, the tax amounts
  per account and dimension for its posting rules, and never writes a ledger line itself.
- **FR-55** The system refuses, while accounting is enabled, to confirm a document whose tax lacks an account,
  listing the gaps; with accounting off the mapping is hidden and a rate part's posting key keeps its meaning.
- **FR-56** A user entering a manual journal line on a tax account is offered the account's default rate; the
  system then records a tax register entry for that journal line.

### 3.7 Registrations, number checks and explanation

- **FR-57** A user with `TAX_REGISTRATIONS_EDIT` can keep several tax registrations (country, scheme, validity) for
  the organization and each customer, supplier and marketplace seller, including electronic addresses of delivery
  networks; today's tax number fields become the primary registration and stay in step with it.
- **FR-58** The system checks a number's structure and check digits for its country and scheme on entry, inside the
  platform, and warns or blocks by organization setting (default warn) `(advanced)`.
- **FR-59** The system verifies a number with its country's official register through an installed verifier and
  keeps the answer as evidence; an unreachable register never blocks a save and is retried `(advanced)`.
- **FR-60** The system re-verifies numbers every 90 days (configurable) and before a regime requiring registration
  is first applied to a party; on failure it flags the party's drafts and notifies its owner `(advanced)`.
- **FR-61** The system prints the organization's registration for the regime's country, and warns when sales to
  private buyers in a country without registration pass a threshold set per country and year `(advanced)`.
- **FR-62** The system stores with every tax line a trace: how the regime was chosen, the category's source, the
  rate's match level, rules evaluated with outcomes, overrides, exemptions and corrections `(advanced)`.
- **FR-63** A user who can read a document can open "Why this tax?" on a line or the document and read the trace
  in plain language in their own language `(advanced)`.
- **FR-64** A user with `TAX_RATES_VIEW` can use a test bench: enter party, item, addresses, date, direction and
  amount and see the determination and its explanation without creating a document `(advanced)`.
- **FR-65** A user with `TAX_RATES_VIEW` can compare a confirmed document with what today's configuration would
  determine, line by line, without changing it `(advanced)`.

### 3.8 Withholding (`FEATURE_WITHHOLDING`)

- **FR-66** A user with `WITHHOLDING_CATEGORIES_EDIT` can define withholding categories: side (ours on suppliers,
  customers' on us), basis (with or without tax), moment (bill or payment), dated rates per party group, rounding.
- **FR-67** A user with `WITHHOLDING_CATEGORIES_EDIT` can set a per-document threshold and a cumulative threshold
  per party and tax year, and choose withholding on the excess only or on the whole year's base once crossed.
- **FR-68** The system assigns categories from the party, else the party group, else the item or expense category
  of a line, so several categories can apply to one document.
- **FR-69** The system withholds on supplier bills, payments (advances included) and manual journals, reduces the
  amount payable to the party, records the liability to the authority, and shows the result in the effects preview.
- **FR-70** A user with `WITHHOLDING_CERTIFICATES_EDIT` can record a reduced-rate certificate per party and category
  (number, rate, validity, limit, file); the system applies it within validity and limit, splitting at the limit.
- **FR-71** The system keeps one withholding entry per document and category (base, rate, amount, threshold basis,
  year-to-date, certificate) with a state: in balance, short, excess, duplicate, reversed, remitted.
- **FR-72** A user with `WITHHOLDING_ENTRIES_ADJUST` can force or waive withholding on a draft with a reason, and
  correct a recorded entry by an adjusting entry; originals are never edited.
- **FR-73** The system reduces a bill's withholding by what was withheld on its advance payments.
- **FR-74** A user recording a receipt can enter the amount a customer withheld and the certificate received
  (number, date, file); the system records it as tax receivable from the authority.
- **FR-75** The system reverses the entries of a cancelled document and carries a reversal of a remitted entry as
  a credit to the next remittance.
- **FR-76** A user with `WITHHOLDING_REMIT` can build a remittance per authority and period from open entries,
  preview it and pay it through `payments-and-collections`; the entries become remitted `(advanced)`.
- **FR-77** A user with `WITHHOLDING_REMIT` can issue numbered withholding statements to parties per period and
  per year, as PDF through a print template, sent by email and shown in the portal `(advanced)`.

### 3.9 Tax register, periods and reports

- **FR-78** The system writes, on confirmation, immutable tax register entries from the tax lines (party, regime,
  rate part, kind, amounts in both currencies, tax point date, account); cancellations and credits append reversals.
- **FR-79** A user with `TAX_PERIODS_MANAGE` can define a tax calendar per registration (monthly, quarterly, yearly,
  start month); an entry belongs to the period of its tax point date; a period is open, prepared or filed.
- **FR-80** The system places an entry arriving for a filed period in the current open period as a late entry
  naming the original period.
- **FR-81** The system registers the reports below as report definitions of the report builder, each with
  drill-down from a figure to register entries and from an entry to its document.
- **FR-82** A user with `TAX_REPORTS_EDIT` can define a return layout, in the statement and return layout model of
  `financial-reports`, of named boxes, each a register filter (direction, kind, category, regime, rate, account) with
  a measure, or a formula over boxes; packs ship layouts. Return layouts and the return report need
  `FEATURE_FINANCIAL_REPORTS` (the layout model and its evaluator are that feature's); without it the register,
  summaries, periods, reconciliation and filing work and a period's pack holds no return.
- **FR-83** The system reconciles, per period, register totals per tax account with the ledger movement of that
  account and lists the differences.
- **FR-84** The system prepares, at each tax period's end, a frozen report pack (return layout, summaries,
  exceptions, ledger reconciliation), marks the period prepared and notifies its owners `(advanced)`.
- **FR-85** A user with `TAX_PERIODS_MANAGE` can mark a prepared period filed with a reference and date, and
  reopen it only with a reason; both are audited; with accounting enabled, filing locks the period for tax postings.

| Report | Answers | Filters and grouping |
| --- | --- | --- |
| Tax summary by rate | base and tax per rate, category and regime | period, direction, registration; by rate, category, regime, month |
| Tax register | every entry with its document and party | dates, direction, party, rate, kind, document type, late entries |
| Tax by document line | tax of each line of each document | dates, item, item category, party, rate; by document, item, party |
| Return layout | the boxes of a layout for a period | period, layout, registration; drill-down per box |
| Tax account reconciliation | register against ledger per account | period, account |
| Zero, exempt and buyer-accounted | transactions without tax, by kind and reason | period, kind, party, country |
| Cross-border sales by destination | sales per destination country against thresholds | year, country, buyer type |
| Manual and overridden tax | manual-mode rates and overrides with author and reason | dates, user, document type |
| Withholding details | each withholding with base, threshold basis and certificate | party type, party, category, dates, state |
| Withholding summary | totals per party and category | party, category, period, tax year |
| Withholding remittance status | withheld, remitted and open per authority and period | authority, period |
| Registration checks | status and age of each party's verification | status, country, last checked |

### 3.10 Simulation, agents and providers

- **FR-86** A user with `TAX_RATES_EDIT` can simulate a new or superseding rate, regime, override or rule: the
  system lists open drafts, uninvoiced orders and recurring documents due in a chosen horizon whose tax would
  change, with the difference per document and in total `(advanced)`.
- **FR-87** The system offers MCP tools for determination, explanation, breakdown, reports, registration checks
  and withholding; tools that change data take a preview flag and return effects first `(advanced)`.
- **FR-88** The system runs a scheduled tax review listing anomalies (overrides, zero tax where a rate exists,
  registration missing or failed, country contradicting the regime, withholding short or in excess, register and
  ledger differences) as one inbox item with proposed fixes, applied only on approval `(advanced)`.
- **FR-89** The system publishes events for register entries, period status changes, failed registration checks
  and withholding entries, so automation rules and webhooks can react.
- **FR-90** The system, with `FEATURE_TAX_PROVIDER` on and a provider connected for a destination, delegates the
  calculation to it, falls back to built-in rates after the configured timeout, and stores the result as tax lines.

## 4. Non-Functional Requirements

- **Performance**: a 200-line document is calculated under 150 ms at the 95th percentile, a 5,000-line document
  under 2 s; an explanation is read under 100 ms; tax reports over 5 million register entries per organization
  answer under 3 s from maintained period totals; bulk re-tax handles 10,000 drafts in the background.
- **Reliability**: calculation is deterministic; a recomputation replaces a document's tax lines atomically;
  register entries are written exactly once per confirmation or cancellation, also on a repeated event.
- **Security & privacy**: tax numbers and certificates are readable only with the registration or withholding view
  permissions; a verifier receives number and country only; provider and verifier credentials are encrypted.
- **Observability**: audit (who, when, before, after) of every change to rates, regimes, rules, overrides,
  accounts, settings, periods and manual overrides; metrics for calculation time, refusals, provider fallbacks.
- **Accessibility and localization**: keyboard-operable forms and breakdown tables with screen-reader labels;
  explanations, legal mentions, kinds and reasons in every shipped locale; amounts formatted per locale.
- **Compatibility**: PostgreSQL, SQLite, MySQL; both ORMs; multi-tenant cloud and self-hosted; additive OpenAPI.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| Tax category, tax rate, rate part, tax regime | Existing: class of an item or party, a rate with window and scope, its parts, a named rate set |
| Calculation basis | What a rate is applied to: net, running total, earlier taxes, per unit, lump sum |
| Determination rule | Prioritized conditions that select a regime for a document |
| Item tax override | Another category, a specific rate or "not taxable" for an item, variant or item category |
| Tax line, determination trace | Existing ledger row: one rate part's amount on a line or charge; the stored reasons behind it |
| Tax account mapping | Which ledger account each kind of tax amount of a rate part goes to (the only such map) |
| Tax registration | A tax number of the organization or a party, with scheme, validity and verification evidence |
| Tax register entry | Immutable record of the tax of a confirmed document line; the source of every tax report |
| Tax calendar, tax period | The reporting rhythm of a registration and its open, prepared or filed periods |
| Return layout, report pack | A statement layout whose boxes are computed from the register; the frozen set of reports of a period |
| Withholding category, reduced-rate certificate | Rule for tax withheld at payment; a party's right to a lower rate |
| Withholding entry, remittance, statement | One withholding on a document; payment of entries to the authority; proof issued to a party |
| Tax simulation | A what-if run of a configuration change against open and upcoming documents |

## 6. Out of Scope

- Rates, regimes, return layouts, statutory returns, audit files and structured electronic invoices of any
  country: `regional-compliance-packs` (this spec gives it the framework).
- Shipping charge calculation (amount bands, weight bands, country limits): `delivery-and-shipping`.
- Ledger postings, period locks and the effects preview itself: `general-ledger`.
- Invoice, bill, credit and debit note documents and advances on them: `invoicing-receivables-payables`.
- Payments, allocation and the outgoing payment of a remittance: `payments-and-collections`.
- The totals pipeline and document lifecycle: `business-document-engine`; prices and discounts:
  `pricing-and-promotions`; cost components in stock value: `stock-ledger-and-valuation`.
- Payroll tax brackets and declarations: `payroll-setup`. Print layout editing: `print-and-pdf-designer`. The report
  builder and its schedules: `report-builder-and-dashboards`. The statement and return layout model, its designer
  and evaluator: `financial-reports`. Document totals: `business-document-engine`.

## 7. Acceptance Criteria

- [ ] **AC-1** A determined-mode customer invoice, supplier bill, quotation, sales order, purchase order and
      point-of-sale sale each show a server-computed breakdown by rate; no percentage is typed (FR-1, FR-18).
- [ ] **AC-2** A manual-mode invoice created through today's API has the same totals as before and two tax lines (FR-2–FR-4).
- [ ] **AC-3** A 50-line document with prices including tax totals exactly the sum of the entered prices under
      both rounding modes; a lump-sum rate distributes to the cent (FR-32, FR-33, FR-35, FR-37).
- [ ] **AC-4** A rule selects the buyer-accounted regime for a verified foreign business; the mention is printed;
      "Why this tax?" names the rule, the registration check and the rate (advanced; FR-18, FR-23, FR-24).
- [ ] **AC-5** A malformed tax number is flagged offline; a verification stores evidence; an unreachable register
      does not block the save (advanced; FR-58, FR-59).
- [ ] **AC-6** Confirming a document writes register entries; cancelling writes reversals; a later rate edit
      changes neither (FR-75, FR-78).
- [ ] **AC-7** With accounting on, confirmation without a tax account is refused with the missing mappings; the
      posting hand-off carries amounts per account; the reconciliation report shows zero difference (FR-53–FR-55).
- [ ] **AC-8** Withholding with a cumulative threshold, a certificate crossing its limit and an advance payment
      produces the expected entries, states and payable amounts (FR-67, FR-70, FR-73).
- [ ] **AC-9** A remittance pays open entries and marks them remitted; a statement PDF is issued (advanced; FR-76, FR-77).
- [ ] **AC-10** A period prepares its pack on schedule; a late entry for a filed period appears in the open
      period; the filed snapshot is unchanged (advanced; FR-79, FR-80, FR-84, FR-85).
- [ ] **AC-11** Simulating a superseding rate lists affected drafts, orders and recurring documents with
      differences; activating it changes no confirmed document (advanced; FR-86).
- [ ] **AC-12** Through MCP an agent gets an explanation, runs the test bench and receives a re-tax preview; the
      tax review inbox item lists seeded anomalies (advanced; FR-64, FR-87).
- [ ] **AC-13** Every report of §3.9 returns correct figures on the seeded data and drills down to documents.
- [ ] **AC-14** Works on PostgreSQL, MySQL and SQLite with both ORMs; behind `FEATURE_TAX_DOCUMENTS` and
      `FEATURE_WITHHOLDING`; nothing changes while they are off; every functional requirement has a passing test (FR-6; §4).
- [ ] **AC-15** A tenant that holds tax rates and had `FEATURE_TAX` off keeps its tax routes and menu after the
      guard lands; editing the percentage of a rate used by an order is accepted by default and leaves the order's tax
      lines unchanged, and is refused only where the organization protects rates in use (FR-6, FR-14).
- [ ] **AC-16** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today, apart from the feature codes that guard their routes, which are switched on for every tenant that holds their data (FR-6, FR-7).

## 8. Open Questions

- Feature codes: `FEATURE_TAX` (existing, default on) and `FEATURE_WITHHOLDING`. Applied default: one more
  sub-feature code, `FEATURE_TAX_DOCUMENTS` (default off), so nothing new is on by default.
- Tolerance for a typed tax adjustment. Applied default: 0.05 per line and 1.00 per document, per organization.
- Cumulative withholding year. Applied default: the fiscal year when accounting is enabled, else the calendar year.
- Which official registers ship first. Applied default: none here; verifiers arrive with country packs.
- A rate part's posting key was written for deployments without a ledger. Applied default: it stays; the account
  mapping is separate, and the tax plugin references ledger accounts through it.

## 9. Constitution Gates

- [x] I Plugin-first — extends `packages/plugins/tax`; UI in new `tax-ui` and `tax-react-ui`; core gains only additive values on the tax-line ledger.
- [x] II Tenant/organization scoping — every new record is tenant and organization scoped; pack content is copied per organization.
- [x] III Both ORMs, additive migrations — new tables and nullable columns only, three dialects, both ORMs.
- [x] IV Default-off flag; nothing removed — new codes off; typed taxes, posting keys and current routes stay.
- [x] V Contracts and API first — every capability is an endpoint with contracts before UI; changes are additive.
- [x] VI Permissions, privacy, security — one key per sensitive action; numbers and certificates protected; credentials encrypted.
- [x] VII Real-time through the event bus — draft totals and period status through the push channel; events through the outbox.
- [x] VIII i18n and accessibility — strings, mentions and explanations translated; accessible tables and forms.
- [x] IX Tests accompany the change — calculation properties, golden documents, migration and e2e tests.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Builds on: `packages/plugins/tax` (README, `tax.types.ts`), `packages/core/src/lib/tax-line`,
  `packages/core/src/lib/invoice`, `packages/core/src/lib/money`, `packages/core/src/lib/rule`
- Related features: [`business-document-engine`](../business-document-engine/spec.md),
  [`general-ledger`](../general-ledger/spec.md), [`invoicing-receivables-payables`](../invoicing-receivables-payables/spec.md),
  [`payments-and-collections`](../payments-and-collections/spec.md), [`regional-compliance-packs`](../regional-compliance-packs/spec.md),
  [`financial-reports`](../financial-reports/spec.md),
  [`report-builder-and-dashboards`](../report-builder-and-dashboards/spec.md), [`delivery-and-shipping`](../delivery-and-shipping/spec.md)
