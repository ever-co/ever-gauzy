# Feature Specification: Regional compliance packs

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `regional-compliance-packs`
**Branch**: `feat/regional-compliance-packs`
**Status**: `Draft`
**Created**: 2026-11-15
**Last updated**: 2026-11-23
**Owner**: platform maintainers
**Feature flag**: `FEATURE_REGIONAL_PACKS` (default off) for country packs; `FEATURE_E_INVOICING` (default off) for structured electronic invoices and code lists

---

## 1. Overview

An organization states its country and gets what that country requires without building it by hand: a chart of
accounts, tax rates and treatments, statutory fields, an address format, document rules, legal print layouts,
statutory reports, public holidays and, where payroll is used, the country's payroll rules. All of this arrives as
a **country pack**: a versioned bundle of content that configures the engines the platform already has (accounting,
tax, documents, print, reports, payroll) and never replaces them. Today the platform holds only reference data
(countries, currencies) and a tax engine with no shipped content. This feature specifies the pack framework, the
contract every pack follows, the packs that ship first, and a separate **electronic invoicing** capability that
turns invoices into structured files, validates them, sends and receives them over pluggable networks, and keeps a
register; plus the code lists those formats need. Clients: Gauzy app (Settings → Regional, e-invoice register),
REST API and SDKs, MCP tools; payroll and accounting screens consume the content through their own specs.

**Advanced capabilities.** Packs are versioned with effective dates, upgradable with a diff that keeps the user's
own changes, and testable: each pack carries test cases that run against the organization's real configuration.
Data-only packs install at run time, also from the app marketplace, without a deployment. Electronic invoicing is
a framework (formats, validation before sending, delivery networks with status tracking, inbound receipt), not one
country's export. Every pack gets a tax audit trail and return layouts with drill-down, prepared and filed on the tax
periods of `tax-engine`. A compliance checker tells a person or an agent, before a document is confirmed, which
country rule it breaks and how to fix it.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** an admin creating an organization in the United Kingdom with the feature on, **when** the setup
  reaches "Regional", **then** the matching pack is proposed with a preview (chart, VAT rates and treatments,
  fields, address format, print layouts, return, holidays, payroll rules); **when** they apply it with the print
  layouts picked for invoices, **then** a new invoice form shows the VAT registration number and the postcode in the
  country's format, and the VAT invoice layout prints.
- **Given** that organization at quarter end, **when** the accountant opens the VAT return for the period, **then**
  every box shows its amount in pounds sterling, clicking a box lists the documents behind it, and the return exports
  as the digital summary file the tax authority accepts.
- **Given** an organization in Germany with electronic invoicing on, **when** an invoice to a business customer is
  confirmed, **then** the file in the European e-invoice standard is generated, validated, attached, numbered
  progressively and sent through the configured channel, and the register shows it moving from queued to delivered
  or rejected with reasons.
- **Given** an archive of forty supplier e-invoices, **when** a user uploads it, **then** it is processed in the
  background and ends with a log: a bill draft per readable file and a reason for each refused one.
- **Given** an organization in India running payroll, **when** an employee declares rent with proof, **then** the
  next payslip's projected tax uses the pack's rent-allowance exemption and explains its three compared amounts.
- **Given** a new pack version with a tax-rate change effective next month, **when** the notified admin applies it
  after reading the diff, **then** invoices dated before the effective date still use the old rate.
- **Given** a draft invoice to a foreign business customer without the customer's tax number, **when** the user or
  an agent runs the compliance check, **then** a blocking finding names the rule, the field and the fix.
- **Given** a partner who built a pack for another country, **when** a tenant installs it from the app
  marketplace, **then** it appears in the pack catalogue, passes its self-test and can be applied without a restart.

### 2.2 Edge cases & failures

- **Given** a user without `REGIONAL_PACKS_MANAGE`, **when** they apply or upgrade a pack, **then** `403`; with the
  feature off every route answers `404` and organizations behave as today.
- **Given** an organization whose country has no pack, **when** it is created, **then** nothing is proposed, the
  generic engines work, and Settings → Regional says so with a link to the catalogue.
- **Given** an accountant who changed a pack tax rate by hand, **when** the pack is upgraded, **then** that rate is
  kept, flagged "changed by you" with both values side by side, and the rest is upgraded.
- **Given** applying a pack stops halfway (server restart), **when** it is started again, **then** it resumes and
  creates nothing twice; **when** two admins apply the same pack at once, **then** one run proceeds and the other
  is told a run is in progress.
- **Given** an e-invoice rejected by the recipient's network, **when** the response arrives, **then** the register
  shows the reasons, the owner gets an inbox item, and the corrected document goes out as a new version.
- **Given** the delivery network is unreachable, **when** an e-invoice is queued, **then** sending is retried with
  backoff for 72 hours and then marked failed with a manual "send again".
- **Given** an inbound file with a supplier invoice number already recorded for that supplier, **when** it is
  imported, **then** that file is refused as a duplicate and the others continue.
- **Given** a mapped tax account was deleted, **when** the pack's self-test runs, **then** the failing cases are
  listed with the missing configuration and returns are marked "not reliable" until fixed.
- **Given** a pack rule that forbids deleting confirmed fiscal documents, switched to blocking for the organization
  (FR-107), **when** a user tries to delete one, **then** the deletion is refused naming the rule and the pack; with
  the rule left as a warning (the default), the deletion proceeds and the warning is recorded.

## 3. Functional Requirements

### 3.1 Pack contract and catalogue

| ID | Requirement |
| --- | --- |
| **FR-1** | The system MUST treat a country pack as a versioned bundle identified by country (ISO 3166-1 alpha-2), optional subdivision, code, version, "content as of" date, publisher and supported platform versions. |
| **FR-2** | The system MUST accept in a pack any subset of the content sections in the table below, each handed to the engine that owns the subject. |
| **FR-3** | The system MUST support data-only packs (content without code, installable at run time) and extended packs (content plus calculation hooks, delivered with the deployment as a plugin). *(advanced)* |
| **FR-4** | The system MUST show a pack catalogue: packs available to the tenant (shipped, installed from the marketplace, private to the tenant) with version, content date, sections covered and status. |
| **FR-5** | The system MUST refuse to register a pack whose content is malformed, refers to something it does not contain, or fails its own test cases, with a report naming each problem. *(advanced)* |
| **FR-6** | The system MUST keep every engine fully usable for an organization without a pack. |
| **FR-7** | The system MUST show each pack's name and content in the country's languages and in English, and state on every pack page the content date and what the pack does not cover. |

Content sections of a pack (FR-2):

| Section | Configures | Owning spec of the engine |
| --- | --- | --- |
| Chart templates | chart of accounts variants and account roles | `accounting-foundation` |
| Tax content | categories, rates with parts, regimes, treatments, exemption reasons, account roles | `tax-engine` |
| Withholding content | categories, thresholds, rates per fiscal year | `tax-engine` |
| Statutory fields | fields on organization, parties, items, addresses, documents, lines, employees | `custom-fields-and-forms` |
| Address format | order, labels, required parts, postal-code pattern, subdivisions | this spec |
| Document rules | checks at confirm, cancel and delete; numbering and date rules | this spec, enforced through `business-document-engine` |
| Rounding and conventions | tax rounding level, cash rounding, round-off account role, depreciation conventions | `tax-engine`, `general-ledger`, `fixed-assets` |
| Print layouts | legally required document layouts | `print-and-pdf-designer` |
| Statutory reports | return layouts, registers, information returns | `tax-engine` periods on the layout model of `financial-reports`; this spec ships the content |
| Role bundles | roles such as tax auditor | `access-control-and-security` |
| Payroll content | employee fields, pay elements, tax tables, exemption and end-of-service rules, reports | `payroll-setup`, `payroll-processing` |
| Holiday calendar | public holidays and weekly rest days | existing official holidays, `time-off-management` |
| Electronic invoice profiles and code-list mappings | formats and codes required in the country | this spec (§3.7, §3.8) |
| Test cases | documents with expected taxes, boxes, files and payslip figures | this spec |

### 3.2 Applying a pack

| ID | Requirement |
| --- | --- |
| **FR-8** | The system MUST propose the pack of an organization's country when the organization is created or its country is set, and apply it when a user with `REGIONAL_PACKS_MANAGE` confirms, or automatically when the tenant chose so. |
| **FR-9** | The system MUST show, before applying, a preview of every record each section would create or change, and let the user leave out optional sections (payroll, electronic invoicing, role bundles, holidays, print layouts) and choose which blocking checks start enforced (FR-107). |
| **FR-10** | The system MUST apply a pack so that repeating or resuming the run creates nothing twice, and record for every created record which pack, version and content key it came from. |
| **FR-11** | The system MUST never overwrite a record a user created or changed; a clash is reported and skipped. |
| **FR-12** | The system MUST allow one primary pack per organization (its country) and further secondary packs limited to tax content, statutory fields, reports and electronic invoice profiles (for registrations abroad). |
| **FR-13** | The system MUST allow detaching a pack: content not used by any document is archived, content in use stays, and no document is changed or deleted. |
| **FR-14** | The system MUST allow only one apply, upgrade or detach run per organization at a time and keep a history of runs with who, when, version and outcome per section. |
| **FR-15** | The system MUST fill, from the applied chart template, the tax-to-account map of `tax-engine` (the only such map) for the pack's tax kinds and return boxes per organization, let a user with `TAX_ACCOUNTS_EDIT` adjust it there, and keep it attached to the organization when the organization is renamed. |

### 3.3 Versions, upgrades and self-tests *(advanced)*

| ID | Requirement |
| --- | --- |
| **FR-16** | The system MUST date pack content: rates, tables, thresholds and rules carry the day they start and end, an upgrade adds new dated content instead of changing past content, and a document uses the content valid on its own date. |
| **FR-17** | The system MUST notify holders of `REGIONAL_PACKS_MANAGE` when a newer version of an applied pack is available, with a summary of what changes and from which date. |
| **FR-18** | The system MUST show an upgrade preview: content added, changed and retired, records the user changed, and open drafts and recurring documents affected. |
| **FR-19** | The system MUST upgrade untouched records, keep user-changed records with both values shown, and let the user accept the pack's value per record. |
| **FR-20** | The system MUST let an upgrade be rolled back while no confirmed document uses its new content, and refuse afterwards. |
| **FR-21** | The system MUST run a pack's test cases against the organization's configuration after apply and upgrade, on demand and nightly, report each case as passed or failed with the difference, and mark statutory reports "not reliable" while a case they depend on fails. |
| **FR-22** | The system MUST let a tenant apply rate-only upgrades automatically on their effective date. |

### 3.4 Accounting-side content

| ID | Requirement |
| --- | --- |
| **FR-23** | The system MUST offer each applied pack's chart templates when the organization's chart is set up. |
| **FR-24** | The system MUST create the pack's tax categories, rates, regimes and treatments (standard, reduced, zero-rated, exempt, reverse charge, outside scope) with exemption reasons and default classifications for items and parties. |
| **FR-25** | The system MUST add the pack's statutory fields only for organizations that applied it, validate them (formats and check digits of tax numbers, required-when conditions; warnings until switched to blocking, FR-107), and prevent users from deleting them. |
| **FR-26** | The system MUST, for organizations that applied a pack, format, label and check addresses by the format of the address's country, in forms, print and structured files, and fall back to a default format for a country without one; missing required parts and postal codes outside the pattern are warnings until switched to blocking (FR-107); stored addresses are never rewritten, and organizations without a pack keep today's address fields. |
| **FR-27** | The system MUST evaluate a pack's document rules when a document is saved as draft (as warnings), confirmed, cancelled or deleted, each rule either blocking or warning (a blocking rule on a document type that exists today starts as a warning, FR-107), with a translated message naming the rule. |
| **FR-28** | The system MUST support these rule kinds: required field; required when a condition holds; forbidden value; deletion lock on confirmed fiscal documents and payments; gap-free and chronological numbering; date within an open fiscal period; reference to the original document on credit notes and returns. |
| **FR-29** | The system MUST recompute a purchase document under reverse charge so that the tax is reported but not owed to the supplier, and check a return or credit note against the tax treatment of its original. |
| **FR-30** | The system MUST apply a pack's rounding level (per line or per document), cash rounding and round-off account role, and offer a pack's depreciation conventions to the fixed-asset books of the organization. |
| **FR-31** | The system MUST install the pack's print layouts for the document types the country regulates (such as full, simplified and detailed tax invoices) and choose among them by the pack's rule for the types the user picked in the preview; a type that prints today (invoices, estimates, receipts) keeps its current layout until a user picks the pack's layout for it. |
| **FR-32** | The system MUST install the pack's role bundles (such as a read-only tax auditor with the audit reports) without changing existing roles. |
| **FR-33** | The system MUST create withholding categories with thresholds per transaction and per fiscal year, rates by party kind, a higher rate for a party without tax number, and the certificate kinds that lower a rate. |
| **FR-34** | The system MUST mark suppliers whose payments are reportable and customers and documents that are exempt from sales tax, using the existing tax-exempt and tax-registration fields of parties where they exist. |
| **FR-35** | The system MUST ship each pack's return layouts as layouts of the statement and return layout model of `financial-reports`, registered through `tax-engine`: boxes, each a formula over the tax register by treatment, direction, rate, subdivision and account, in the country's currency, for a period, with drill-down from a box to documents. |
| **FR-36** | The system MUST let a prepared return, the tax period of `tax-engine`, be frozen with its box values (prepared, filed), and show later changes of the period against a filed return as adjustments. *(advanced)* |
| **FR-37** | The system MUST export a return as a printable document and, where the pack defines one, as the authority's structured file produced from the pack's export mapping. |
| **FR-107** | The system MUST start as a warning every pack check that would refuse an action possible today: a blocking document rule on an existing document type (deletion lock, numbering, dates, references, required fields), a required or required-when statutory field or a format or check-digit check on an existing record type, and a required address part or postal-code pattern. A user with `REGIONAL_PACKS_MANAGE` can switch each document rule, and the field checks and the address checks as a whole, to blocking for the organization, in the apply preview or later on the rules page, and back at any time; each switch is recorded with who and why. |

### 3.5 Packs that ship first

The first set is four complete packs: the United States, the United Kingdom, Germany with the European e-invoice
standard, and India. Each row is a requirement: "The system MUST ship this pack with at least this content", every
complete pack covering chart, tax content, statutory fields, address format, document rules, print layouts, returns,
holidays and payroll rules with test cases. Every other country is available later as a marketplace pack on the same
framework (FR-92).

| Requirement | Pack | Kind | Content |
| --- | --- | --- | --- |
| **FR-38** | — | — | Reserved for further country packs, delivered through the marketplace on the same framework. |
| **FR-39** | India | complete | chart; goods and services tax with central, state and integrated parts, its return summaries by box and the tax audit trail (FR-86); withholding at source with thresholds, lower-rate certificates and reports (FR-89); statutory fields and address format with states; print layouts of tax invoices; holidays; payroll content (FR-51 to FR-56, FR-90) |
| **FR-40** | — | — | Reserved for further country packs, delivered through the marketplace on the same framework. |
| **FR-41** | United States | complete | chart; sales-tax exemption from the customer's existing tax-exempt field, carried to quotations, orders and invoices with a per-document override; suppliers marked for reportable payments with their taxpayer number; yearly information return (FR-88) with printable form; address format with states; holidays; payroll content (FR-102) with its reports (FR-106) |
| **FR-42** | — | — | Reserved for further country packs, delivered through the marketplace on the same framework. |
| **FR-43** | — | — | Reserved for further country packs, delivered through the marketplace on the same framework. |
| **FR-44** | Germany | complete | two charts; VAT rates and treatments (domestic, reduced, intra-community supplies and acquisitions, reverse charge) with the advance VAT return by box and the summary of intra-community supplies (FR-105); statutory fields (tax number, VAT identification number, company register entry); address format; holidays per federal state; document rules (gap-free numbering, original reference on credit notes); the European e-invoice standard in both syntaxes and as hybrid PDF, sent and received (§3.7); payroll content (FR-103) with its reports (FR-106) |
| **FR-45** | — | — | Reserved for further country packs, delivered through the marketplace on the same framework. |
| **FR-46** | — | — | Reserved for further country packs, delivered through the marketplace on the same framework. |
| **FR-47** | Base address formats | data | Bosnia and Herzegovina, Croatia, Denmark, Germany, Luxembourg, Sweden, Switzerland, Taiwan, United States, and the default |
| **FR-100** | United Kingdom | complete | chart; VAT (standard, reduced, zero-rated, exempt, reverse charge for specified goods and services, imports through postponed accounting) with the nine-box return and its digital summary file (FR-104); statutory fields (VAT registration number, company registration number); address format with the postcode pattern; holidays per nation; full and simplified VAT invoice layouts; document rules (gap-free numbering, original reference on credit notes); payroll content (FR-101) with its reports (FR-106) |

### 3.6 Payroll-side content

| ID | Requirement |
| --- | --- |
| **FR-48** | The system MUST let a pack carry payroll content: statutory employee fields, pay element templates with statutory tags, income tax tables with reliefs, exemption rules, end-of-service rules, employer contributions, salary bank-file layouts and statutory payroll reports. |
| **FR-49** | The system MUST offer named extension points that the payroll engine calls and a pack may implement: exemption amount of a declaration, exemption for part of a year, tax relief or cap on computed tax, regional deductions, employer contributions, and cost-to-company components on payslip, pay-structure assignment and offer. |
| **FR-50** | The system MUST run payroll with the generic engine for an organization whose country has no payroll content, and ship payroll content with each complete pack of §3.5 (India, the United Kingdom, the United States and Germany). |
| **FR-51** | The India pack MUST add to employees the bank branch routing code, the cheque clearing code, the permanent tax account number and the provident fund account number, validated by format. |
| **FR-52** | The India pack MUST give deduction elements a statutory classification (retirement fund contribution, voluntary additional contribution, retirement fund loan repayment, state professional tax) and use it in its reports. |
| **FR-53** | The India pack MUST compute the yearly rent-allowance exemption as the least of: the allowance received; rent paid above one tenth of basic pay; and half of basic pay for a metro residence, otherwise two fifths; from the organization's named basic, rent-allowance and arrear elements, the declared monthly rent, metro marker and rent periods, using actual payslips per pay-structure assignment in the period, and MUST refuse overlapping rent proofs. |
| **FR-54** | The India pack MUST cap income tax within the marginal-relief band of a tax table at the income above the relief limit, and compute surcharge and cess tiers on top. *(advanced for surcharge and cess)* |
| **FR-55** | The India pack MUST add pay element templates for professional tax, provident fund and rent allowance beside the generic ones, with amounts left to the organization. |
| **FR-56** | The India pack MUST add an end-of-service rule of fifteen days' pay per completed year on a 26-day month, from five years of service, on the latest pay, with service rounded to the nearest year. |
| **FR-57** | Reserved for further country packs, delivered through the marketplace on the same framework. |
| **FR-58** | The system MUST add a pack's public holidays per year and weekly rest days to the organization's holiday list when the pack is applied, and add the following years' holidays with pack upgrades. |
| **FR-59** | The system MUST let a pack ship salary bank-file layouts that the payroll run can produce. *(advanced)* |
| **FR-101** | The United Kingdom pack MUST add income tax by tax code on the cumulative and the non-cumulative basis, employee and employer national insurance by category letter with its thresholds, workplace pension contributions for enrolled employees, student loan deductions by plan, statutory sick, maternity and paternity pay elements, and the data each pay period's submission to the tax authority needs. |
| **FR-102** | The United States pack MUST add federal income tax withholding from the employee's withholding certificate (filing status, adjustments) with the yearly tables, employee and employer social security and Medicare with the wage base and the additional Medicare rate, federal unemployment tax, state income and unemployment tax tables per state as pack content on the extension points of FR-49, and pre-tax deductions for retirement and health plans. |
| **FR-103** | The Germany pack MUST add wage tax by tax class with solidarity surcharge and church tax, the employee and employer shares of pension, unemployment, health (with the fund's additional rate) and long-term care insurance with their contribution ceilings, the rules for marginal employment, and the data of the monthly wage tax return and the social insurance contribution statements. |

### 3.7 Electronic invoicing

| ID | Requirement |
| --- | --- |
| **FR-60** | The system MUST model each format as a profile (mapping from invoice and credit note to a structured file, validation rules, reader for inbound files) and ship: the European standard semantic model in both of its syntaxes and its hybrid PDF with the embedded file; national formats of other countries are available later as marketplace packs on the same framework. |
| **FR-61** | The system MUST generate the file of a customer invoice or credit note when it is confirmed (when the organization chose so) or on demand, attach it to the document and add it to the register. |
| **FR-62** | The system MUST validate before sending: structure, the profile's business rules, the pack's document rules and code-list mappings; findings are shown on the draft; blocking findings prevent transmission and, when the organization chose so, confirmation. *(advanced)* |
| **FR-63** | The system MUST number transmissions progressively per organization and never reuse a number or file name. |
| **FR-64** | Reserved for further country packs, delivered through the marketplace on the same framework. |
| **FR-65** | The system MUST replace the file with a new version when the document is amended, keep the superseded version, and follow the profile on cancellation (credit note, cancellation message, or withdrawal before sending). |
| **FR-66** | A user with `E_INVOICES_SEND` can export the files of a period or customer as one archive. |
| **FR-67** | The system MUST deliver files through a transport chosen per organization and profile: download, email, an open four-corner delivery network through an access point, or a national exchange platform; each transport reports queued, sent, delivered, accepted, rejected with reasons, or failed. *(advanced)* |
| **FR-68** | The system MUST retry a failed transmission with backoff for 72 hours, then mark it failed, offer "send again", and put rejected and failed files in the document owner's inbox. |
| **FR-69** | The system MUST store each party's routing identifiers as tax registrations of the network's scheme in `tax-engine` and look a recipient up in the network's directory before the first transmission. *(advanced)* |
| **FR-70** | A user with `E_INVOICES_IMPORT` can upload one file or an archive of supplier e-invoices; the system MUST process them in the background and hand each readable file to the intake register of incoming documents of `invoicing-receivables-payables`, which drafts a supplier bill, matching the supplier by tax number and lines by supplier item code or mapped codes, and using the organization's defaults (item for unmatched lines, supplier group for new suppliers, tax account, numbering series, price list). |
| **FR-71** | The system MUST refuse an inbound file, with a reason and without stopping the batch, when it is unreadable, lacks an invoice number, repeats a supplier invoice number, names another recipient or country, or uses an unsupported profile; a file in a standard signature envelope is opened, any other signed file refused. |
| **FR-72** | The system MUST receive inbound files from a connected network the same way as uploads, and acknowledge them where the network expects it. *(advanced)* |
| **FR-73** | The system MUST keep a result log per inbound batch (file, outcome, captured document and bill, or reason). |
| **FR-74** | The system MUST print the marks a profile requires (scannable code, transmission reference) on the document's layout. |
| **FR-75** | The system MUST keep files and network responses unchangeable for the retention period the pack states (default ten years) and export them for an audit. |

### 3.8 Code lists

| ID | Requirement |
| --- | --- |
| **FR-76** | A user with `CODE_LISTS_MANAGE` can keep code lists (publisher, name, version, canonical identifier) with their entries, import a list from the standard code-list XML format, and import a newer version beside the old one. |
| **FR-77** | The system MUST map internal records (units, countries, currencies, tax categories and rates, payment methods, items) to entries of a list, at most one entry per record and list, singly or by bulk import, and hold one default entry per list that belongs to the list. |
| **FR-78** | The system MUST remove a deleted list's entries and mappings, and refuse to delete a list a profile in use requires. |
| **FR-79** | The system MUST report a record without the mapping a profile requires as a validation finding. |

### 3.9 Compliance checker and agents *(advanced)*

| ID | Requirement |
| --- | --- |
| **FR-80** | The system MUST check any draft document against the rules of the organization's packs and profiles on request and automatically when it is saved, returning findings with rule, severity, field, explanation and suggested fix, in the user's language. |
| **FR-81** | The system MUST offer the check as an MCP tool, let an agent propose fixes as a change preview that a person confirms, and never let the check or the agent confirm or transmit a document. |
| **FR-82** | The system MUST explain, for any document line, which regime, rate and pack rule produced its tax and which return boxes it will feed. |
| **FR-83** | The system MUST prepare a return draft (the `tax-engine` period) on request and list anomalies (missing tax numbers, treatments unusual for the party, documents changed after a filed return) with drill-down. |
| **FR-84** | The system MUST show the open findings of all drafts and transmissions of an organization in one worklist with live updates. |

### 3.10 Statutory reports

| Requirement | Report | Answers | Filters |
| --- | --- | --- | --- |
| **FR-85** | Reserved for further country packs, delivered through the marketplace on the same framework. | — | — |
| **FR-86** | Tax audit trail (every pack) | Each sales and purchase transaction with its tax, by tax account and treatment | organization, period, direction, account |
| **FR-87** | Electronic invoice register | Which e-invoices were generated, sent and received, with status and file | organization, period, party, direction, status |
| **FR-88** | Information return for supplier payments (United States) | Payments per reportable supplier in a year, by supplier group, with printable form | organization, year, supplier group |
| **FR-89** | Withholding summary and details | Tax withheld per party, category and period; computation per document; certificate use | organization, fiscal year, party, category |
| **FR-90** | India payroll reports | Salary remittance per bank and payment mode with the branch routing or clearing code; income tax computation per employee; tax deducted per employee and tax account number | organization, pay period, bank, payment mode |
| **FR-91** | Pack status | Applied packs, versions, user-changed content, failed test cases | tenant, organization |
| **FR-104** | VAT return of the United Kingdom | The nine boxes for a period, with drill-down, exported as the digital summary file the tax authority accepts | organization, period |
| **FR-105** | Advance VAT return of Germany and summary of intra-community supplies | Box by box for a month or quarter; intra-community supplies per customer VAT identification number | organization, period |
| **FR-106** | Payroll statutory reports of the United Kingdom, the United States and Germany | Per pay period and year: employee and employer amounts due to each authority, the data of each period's submission, the yearly statement per employee | organization, pay period, year, authority |

All are report definitions (filter, group, export, schedule); statutory ones are locked against edits and can be
cloned.

### 3.11 Marketplace, API and compatibility

| ID | Requirement |
| --- | --- |
| **FR-92** | The system MUST let a tenant install a pack published on the app marketplace (apps.ever.co, the one marketplace of all products, in its Gauzy view); a data-only pack is usable at once in cloud and self-hosted deployments, within the licence the installation grants. |
| **FR-93** | The system MUST publish the pack format, a validator and the test-case format so that others can build packs, and run the same validator on shipped packs. *(advanced)* |
| **FR-94** | The system MUST expose catalogue, preview, apply, upgrade, self-test, returns, e-invoice actions and code lists through the REST API with idempotency keys on runs and transmissions, and through MCP tools that preview by default. |
| **FR-95** | The system MUST publish events for pack runs, available upgrades, failed self-tests, e-invoice status changes and inbound batches, for inbox items, automation rules, webhooks and live updates. |
| **FR-96** | The system MUST record who applied, upgraded, detached or overrode what, with before and after. |
| **FR-97** | The system MUST keep shipped packs readable by every tenant and tenant-private packs invisible to other tenants. |
| **FR-98** | The system MUST, with `FEATURE_REGIONAL_PACKS` off, propose and enforce nothing, and with `FEATURE_E_INVOICING` off, generate, send and import nothing; content already applied stays in place and inert rules are not evaluated. |
| **FR-99** | The system MUST warn on the pack page and on affected returns when an applied pack's content date is older than twelve months or a newer version exists. |

## 4. Non-Functional Requirements

- **Performance**: applying a full pack completes within 60 s; preview within 5 s; a compliance check of a
  document with 200 lines within 300 ms; generating and validating an e-invoice within 1 s; a return over one
  million tax lines within 5 s from maintained tax balances; an inbound batch of 1,000 files within 10 minutes.
- **Data volume and concurrency**: 5 million e-invoices per tenant with files in object storage; one pack run per
  organization at a time; transmissions in parallel per organization with ordered numbering.
- **Reliability**: pack runs resumable; transmissions at-least-once with network-side deduplication by
  transmission number; no file is sent that failed validation.
- **Security & privacy**: tenant and organization scoped; network credentials and certificates stored encrypted
  and never returned; inbound callbacks verified by signature; uploaded files scanned and size-limited; data
  leaving the platform is the structured invoice (party names, addresses, tax numbers, lines) to the chosen
  network or recipient, listed per transport.
- **Observability and audit**: run history, content ledger, transmission events, inbound logs, self-test results.
- **Accessibility and localization**: all screens keyboard-operable; rule messages, box labels and pack names in
  the user's language with the legal term of the country beside it.
- **Compatibility**: PostgreSQL, MySQL and SQLite; both ORMs; cloud and self-hosted; additive API and SDK changes.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| Country pack | A versioned bundle of country content (shipped, marketplace or tenant-private) |
| `RegionalPackVersion` | A pack version installed into a tenant at run time, with its content |
| `RegionalPackInstallation` | A pack applied to an organization: version, sections, primary or secondary |
| `RegionalPackContentRecord` | The link between a created record and the pack content it came from |
| `RegionalPackRun` | One apply, upgrade, rollback, detach or self-test with its outcome (a platform operation) |
| `RegionalDocumentRule` | A check a pack contributes on a document type and event, its conditions held by the platform's rule engine |
| `RegionalAddressFormat` | How addresses of a country are laid out, labelled and validated |
| Tax account map (of `tax-engine`) | Which ledger account stands for which tax kind or return box in an organization; packs fill it |
| Return layout (content) | A country's statutory return as a layout of tax-register boxes; prepared and filed as a `tax-engine` period |
| `EInvoiceProfile` | A structured invoice format with its rules |
| `EInvoiceDocument` | One generated or received structured invoice in the register, with versions and status |
| `EInvoiceEvent` | A status change or network response of an e-invoice |
| `EInvoiceTransport` | An organization's connection to a delivery channel |
| Inbound batch / file | An upload or receipt of supplier e-invoices and each file's outcome, as captures of the intake register |
| `CodeList` / entry / mapping | An external standard code list, its codes and their links to internal records |
| Compliance finding | One rule result on a document: severity, field, explanation, fix |

## 6. Out of Scope

- Chart of accounts structure and importer: `accounting-foundation`. Posting, rounding postings: `general-ledger`.
- Tax calculation, withholding computation, certificates, the tax-to-account map, tax registrations, return
  preparation, freezing and filing: `tax-engine`; the statement and return layout model: `financial-reports`.
- The intake register of incoming supplier documents and bill drafting: `invoicing-receivables-payables`.
- Pay elements, tax-table engine, declarations and proofs: `payroll-setup`; pay runs, payslips, bank files as
  output: `payroll-processing`.
- Invoices and supplier bills as documents: `invoicing-receivables-payables`.
- Custom field engine: `custom-fields-and-forms`; print designer: `print-and-pdf-designer`; roles:
  `access-control-and-security`; holiday calendars and time-off rules: `time-off-management`.
- The setup assistant that hosts the "Regional" step and the first holiday list of a new organization:
  `organization-setup`.
- Usage telemetry and its opt-in controls: `platform-administration`.
- Marketplace listing, licensing and install flow: the Ever Platform spec `app-installs-and-licensing`.
- Calculating sales tax rates per local jurisdiction in the United States: `tax-engine` (external tax provider port).
- Returns are exported, not filed with the authority.

## 7. Acceptance Criteria

- [ ] **AC-1** Applying each shipped pack to a fresh organization creates its content once, a second run creates
      nothing, and the preview equals what was created (FR-10, FR-11).
- [ ] **AC-2** A user-changed record survives an upgrade and is flagged; dated content gives an invoice before the
      effective date the old rate; rollback works until a document uses the new content (advanced, versions) (FR-16, FR-18, FR-19).
- [ ] **AC-3** Every shipped full pack passes its test cases; deleting a mapped tax account makes the self-test
      fail and marks returns "not reliable" (advanced, self-tests) (FR-21).
- [ ] **AC-4** Statutory fields, address formats and document rules (including the deletion lock) act only for
      organizations with the pack (FR-25, FR-26, FR-28).
- [ ] **AC-5** The reports of §3.10 return the expected figures for the packs' test documents, with drill-down
      from each box.
- [ ] **AC-6** The payroll rules of the India, United Kingdom, United States and Germany packs return the expected
      tax, contribution, exemption, relief and end-of-service amounts for the packs' test cases; an organization
      without payroll content runs generic payroll (FR-50).
- [ ] **AC-7** A confirmed invoice produces a valid file for each shipped profile; an invalid draft is blocked
      before sending; amendment creates a new version; numbering has no gaps (advanced, validation) (FR-60, FR-62).
- [ ] **AC-8** A transmission moves through its states against a simulated network, is retried on failure and a
      rejection reaches the owner's inbox (advanced, networks) (FR-68, FR-69).
- [ ] **AC-9** An inbound archive with valid, duplicate, foreign and unreadable files drafts bills for the valid
      ones and logs a reason for each other (FR-71–FR-73).
- [ ] **AC-10** A code list imports from the standard XML format; a record cannot map to two codes of one list;
      a missing required mapping is a finding (FR-76, FR-77, FR-79).
- [ ] **AC-11** The compliance check returns the expected findings for seeded drafts through the screen and the
      MCP tool, and nothing is confirmed or sent by it (advanced, checker) (FR-80, FR-84).
- [ ] **AC-12** A data-only pack installed at run time appears in the catalogue, passes validation and applies
      without a restart; another tenant cannot see it (advanced, marketplace) (FR-3, FR-4).
- [ ] **AC-13** `403` without permission; `404` with the feature off; a second concurrent run is refused; a
      resumed run completes (FR-14, FR-98).
- [ ] Works on PostgreSQL, MySQL and SQLite with both ORMs.
- [ ] Behind `FEATURE_REGIONAL_PACKS` and `FEATURE_E_INVOICING`; nothing changes while they are off.
- [ ] **AC-14** A pack applied with the preview's defaults leaves every action possible today possible: its blocking
      rules on existing document types, field checks and address checks warn until switched to blocking; an
      organization without a pack keeps today's address form; invoices keep their layout unless the pack's layout is
      picked for them (FR-107).
- [ ] **AC-15** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-98).
- [ ] All functional requirements have a passing test.

## 8. Open Questions

- The framework lives in a plugin `regional-packs`, with one plugin per extended pack and a separate `e-invoicing`
  plugin (applied). The framework can move to core later, because several engines call it.
- First packs: the United States, the United Kingdom, Germany with the European e-invoice standard, and India, each
  complete, plus the base address formats (FR-39, FR-41, FR-44, FR-47, FR-100); every other country arrives later as
  a data-only or extended pack from the marketplace.
- Legal content needs review by a local accountant before a pack is marked "shipped"; default: packs ship as
  "preview" until reviewed, with the content date and coverage shown (applied in FR-7 and FR-99).
- Network delivery needs an access point contract per network; default: ship the transports with a simulator and
  download or email as working channels, and connect real networks per deployment.
- Returns are exported, not filed with the authority (applied); direct filing can follow per country.
- Usage telemetry and its opt-in controls are not part of regional compliance; they are specified in
  `platform-administration` (applied in §6).
- The India pack includes goods and services tax content beside withholding and payroll (applied), because a pack
  without the country's main tax would not be usable.

## 9. Constitution Gates

- [x] I Plugin-first — framework plugin `regional-packs`, one `regional-<country>` plugin per extended pack,
      `e-invoicing` plugin; engines stay in their plugins.
- [x] II Tenant/organization scoping — installations, content records, rules, e-invoices and code lists are
      tenant and organization scoped; shipped packs are read-only catalogue content.
- [x] III Both ORMs, additive migrations — new tables only, three dialects.
- [x] IV Default-off flag; nothing removed — two new flags; existing reference data and tax engine untouched.
- [x] V Contracts and API first; backwards compatible — the pack contract and REST come first; additive only.
- [x] VI Permissions, privacy, security — separate keys for managing packs, sending, importing and code lists;
      encrypted credentials; verified callbacks; data leaving the platform listed.
- [x] VII Real-time through the event bus — outbox events for runs and e-invoice states; live worklist.
- [x] VIII i18n and accessibility — rule messages and labels as translation keys carried by the packs.
- [x] IX Tests accompany the change — pack test cases are part of the content and run in CI and at run time.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Related features: [`../accounting-foundation/spec.md`](../accounting-foundation/spec.md),
  [`../tax-engine/spec.md`](../tax-engine/spec.md), [`../financial-reports/spec.md`](../financial-reports/spec.md),
  [`../general-ledger/spec.md`](../general-ledger/spec.md),
  [`../invoicing-receivables-payables/spec.md`](../invoicing-receivables-payables/spec.md),
  [`../payroll-setup/spec.md`](../payroll-setup/spec.md),
  [`../payroll-processing/spec.md`](../payroll-processing/spec.md),
  [`../custom-fields-and-forms/spec.md`](../custom-fields-and-forms/spec.md),
  [`../print-and-pdf-designer/spec.md`](../print-and-pdf-designer/spec.md),
  [`../organization-setup/spec.md`](../organization-setup/spec.md), [`../fixed-assets/spec.md`](../fixed-assets/spec.md)
- Existing code: `packages/core/src/lib/country`, `packages/core/src/lib/currency`,
  `packages/core/src/lib/address`, `packages/core/src/lib/official-holiday`, `packages/plugins/tax` (categories,
  rates, rate parts, regimes), `packages/core/src/lib/organization-contact` (tax-exempt and tax registration
  fields), `packages/plugins/registry` (plugin registry)
- Related architecture: [platform architecture](../../architecture/business-suite.md) §2.2 (Regional packs), §3.3, §3.4, §3.7, §3.8
