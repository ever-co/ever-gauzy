# Feature Specification: Organization setup

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `organization-setup`
**Branch**: `feat/organization-setup`
**Status**: `Draft`
**Created**: 2026-11-16
**Last updated**: 2026-11-23
**Owner**: platform maintainers
**Feature flag**: `FEATURE_ORGANIZATION_STRUCTURE` (default off; with it off every organization behaves as today)

---

## 1. Overview

A tenant already holds several organizations, and users switch between them, but each organization stands alone: no
parent, no group, no defaults handed down, no records shared with an allow-list, nothing that knows two organizations
trade with each other, and no guided way to set one up. This feature makes the organization a **company in a group**:
a fuller company profile (short code, country, legal and registration facts, addresses, branding), an **organization
tree** of groups and subsidiaries with ownership, **per-organization defaults** that every other feature reads (with
group defaults that members inherit or must keep), **shared masters** with allow-lists (customers, suppliers, items,
units and the other record types their owners declare), exchange rates kept once for a group, a **setup assistant**,
**demo data**, **safe deletion of an organization's transactions** with a record and an archive of what was removed,
the rules for deleting an organization, a **shareholder register** with share transactions and its reports, and an
organization overview of sales against target. Clients: the Angular app (organization pages, assistant, register), the
MCP server, the API and SDKs.

**Advanced capabilities.** The **setup assistant proposes a whole configuration from the country and the
industry** and shows it as a preview before anything is written; an **AI agent can drive it conversationally** through
MCP tools, asking only what it cannot infer. Trees are **consolidation-ready**: each link carries ownership, dates and
method, ownership follows the shareholder register when one organization holds shares in another, and joining a group
creates the **internal customer and supplier records both ways** so inter-organization documents are paired
automatically. Deleting transactions starts with a **dry run** and ends with a **downloadable archive** of every
removed record. A **sandbox copy** of an organization, with personal data replaced and every outside channel closed,
lets people train on their own data. These requirements are marked `(advanced)`.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** an administrator with `ORGANIZATION_STRUCTURE_EDIT` and three organizations, **when** they mark "Acme Group" as a group and drag "Acme UK" (80 % owned since 2025-01-01, full consolidation) and "Acme DE" under it, **then** the tree shows both under the group, their reporting currency defaults to the group's, and `organization_structure.tree.changed` is pushed to every open client.
- **Given** the group default "settlement term: 30 days, enforced", **when** a user of Acme DE opens the defaults page, **then** the term shows "30 days, from Acme Group, enforced" and cannot be changed there; a non-enforced group default can be overridden and shows its source.
- **Given** a customer record of Acme UK, **when** a user shares it with the whole group, **then** Acme DE's customer lists and order lookups offer it; **when** Acme DE is removed from the share while it has an open order for that customer, **then** the change is refused and the order is listed.
- **Given** a new organization with country "DE" and industry "wholesale", **when** the administrator opens the setup assistant, **then** it proposes currency, time zone, formats, fiscal year, the country pack, the chart template, departments, numbering patterns with the short code, modules to switch on and default terms, each step as a preview; applying all writes them and the readiness check turns green.
- **Given** a user chatting with the assistant agent, **when** they write "we are a 12-person software consultancy in Lyon billing by the hour", **then** the agent asks only for the legal name and short code, shows the proposal, and applies it after the user says yes; every applied step names the agent.
- **Given** an administrator with `ORGANIZATION_TRANSACTIONS_DELETE` before go-live, **when** they request deletion of the organization's transactions, **then** a dry run lists counts and samples per record type and what would block; after typing the organization's name they start it, watch per-type progress, and download the archive of what was removed for 30 days.
- **Given** a share class "Ordinary, 1.00, 1 vote", **when** a user issues shares 1–10,000 to a founder and later transfers 2,001–2,500 to an investor at 4.00, **then** the share movements report shows both movements, the holdings report at today shows 95 % and 5 %, and with accounting on the transfer posts nothing (holder to holder) while the issue posts share capital.
- **Given** Acme UK holds 100 % of Acme DE's shares in the register, **when** the issue is confirmed, **then** the tree proposes 100 % ownership on the Acme DE link and the user accepts it.
- **Given** Acme UK and Acme DE in one group, **when** Acme UK confirms an invoice to the customer record representing Acme DE, **then** a draft bill appears in Acme DE linked to it, per the pair's policy.
- **Given** a trainer with `ORGANIZATION_SANDBOX_MANAGE`, **when** they create a sandbox of Acme UK with the last three months of transactions, **then** a new organization marked "Sandbox" holds the copy with contact and employee personal data replaced, no email reaches a real party, and it expires in 30 days.

### 2.2 Edge cases & failures

- **Given** a move that would put a group under its own descendant, or under an organization that is not a group, **then** it is refused naming the reason; a group with children cannot stop being a group.
- **Given** two administrators editing the same default at once, **then** the second save is refused with `409` naming the version it read.
- **Given** an organization with posted ledger journals, **when** its currency is changed, **then** the change is refused with the counts of documents and journals; with confirmed documents and no journals the change is allowed after a warning with their counts, unless the organization locked its currency.
- **Given** a deletion of transactions running, **when** a user confirms an invoice of that organization, **then** it is refused with "the organization's transactions are being deleted"; the banner shows progress.
- **Given** a deletion that fails on one record type, **then** earlier types stay deleted, the run is marked partly done with the error, and it can be resumed after the cause is fixed.
- **Given** posted ledger journals of a live organization, **then** the dry run marks them protected and the deletion is refused unless the user excludes the ledger types, which the dry run says leaves the ledger as it is.
- **Given** a demo organization, **when** a user tries to delete it through the organization list, **then** they are sent to "remove demo data", which removes it with its sample records.
- **Given** a share transfer of numbers the seller does not hold, a count that does not match the ranges, or an amount that is not count × price, **then** confirmation is refused naming the rule.
- **Given** a user without `ORGANIZATION_SHARING_EDIT`, **when** they share a record, **then** they receive `403`; a record of another tenant answers `404`.
- **Given** an agent asked to delete transactions, **then** it can only run the dry run; the deletion itself needs a person in the app.
- **Given** a sandbox, **when** someone tries to send a document by email, connect a payment provider or add a webhook there, **then** it is refused with "not available in a sandbox".
- **Given** the feature off, **then** the organization pages are unchanged and every new route answers `404`.

## 3. Functional Requirements

### 3.1 Scope and compatibility

- **FR-1** The system changes nothing while `FEATURE_ORGANIZATION_STRUCTURE` is off: organization creation, editing, switching, soft delete and restore work as today and the new routes answer `404`.
- **FR-2** The system treats every existing organization as a root with no parent, no group defaults and no shared records, so enabling the feature changes nothing a user sees until someone configures it.
- **FR-3** The system checks every action against the caller's permission and membership: a user acts on organizations they belong to, or on all organizations of the tenant with `ALL_ORG_EDIT`; another tenant's organization answers `404`.
- **FR-4** The system keeps the existing organization fields as the single store of what they hold (name, official name, currency, tax identifier, registration date, time zone, formats, fiscal dates, logo, brand colour, contact) and adds only what is missing.

### 3.2 Company profile

- **FR-5** A user with `ORGANIZATION_STRUCTURE_EDIT` can record per organization a short code (2 to 10 letters or digits, unique in the tenant), country (the country of the organization's existing contact address), legal form, registration number and authority, commencement date, industry, brand name and favicon, next to the existing fields.
- **FR-6** The system refuses a commencement date before the incorporation (registration) date.
- **FR-7** The system lets the short code change with a warning: numbers and names already issued keep the old code, new ones use the new code, and the change is recorded.
- **FR-8** The system refuses to change an organization's currency once it has ledger journals, giving their counts; with confirmed business documents and no journals it warns with their counts and allows the change as today, unless the organization locks its currency once documents exist (setting, default off).
- **FR-9** A user with `ORGANIZATION_STRUCTURE_EDIT` can keep several addresses per organization in the platform's address book, each with one or more purposes (registered office, billing, shipping, return, remit-to, other) and one default per purpose; documents and print layouts ask the address book for the organization's default address of a purpose, and the organization's existing contact address answers when no default of that purpose is set.
- **FR-10** The system shows the organization's brand name, logo and favicon in the app's existing sidebar logo and browser tab for users working in it when the organization switches its in-app branding on (setting, default off; until then the sidebar and tab show what they show today), and offers the brand colour to print layouts as the default letterhead colour.
- **FR-11** The system publishes `organization_structure.country.changed` when an organization's country is set or changed, wherever it is edited, so country packs propose their content and the assistant offers its regional step.

### 3.3 Organization tree and group companies

- **FR-12** A user with `ORGANIZATION_STRUCTURE_EDIT` can mark an organization as a group and place organizations under a group, building a tree up to eight levels deep.
- **FR-13** The system refuses a parent that is not a group, a move that creates a cycle, unmarking a group that has children, and a second parent.
- **FR-14** The system keeps on each link to a parent an ownership percentage (above 0, at most 100), the dates it applies from and until, and a consolidation method (full, proportional, equity, not consolidated); consolidation groups take them as defaults. `(advanced)`
- **FR-15** The system shows, before a move is saved, which inherited defaults and shares change for the moved organization and its descendants, and applies the move with them in one step.
- **FR-16** The system shows the organizations as a tree with search, member and document counts, keyboard and drag-and-drop moves with confirmation, and a count of organizations the user may not see.
- **FR-17** The system derives an organization's default reporting currency from the root of its group, shown read-only unless the organization overrides it.
- **FR-18** The system answers other features, as of a date, the ancestors, descendants and members of a group with ownership, method and dates, for consolidation, shared charts and defaults.
- **FR-19** The system refuses to soft delete or archive a group with live children.
- **FR-20** The system records every tree change (who, when, before, after) and pushes it to open clients.

### 3.4 Per-organization and group defaults

- **FR-21** The system lists, on one page per organization, every default declared by the features in use (finance, selling, buying, stock, production, people, documents), grouped by area, with its value and where the value comes from.
- **FR-22** A user with `ORGANIZATION_DEFAULTS_EDIT` can set a default for an organization, stored in the platform's settings at the organization level (or in the field or setting the owning feature already keeps); the owning feature validates the value (an account must be a posting account of the organization, a location must belong to it, a term must exist).
- **FR-23** A user with `ORGANIZATION_DEFAULTS_EDIT` on a group can set a value for its descendants either as a default they may override or as enforced, which they cannot change.
- **FR-24** The system resolves a default in this order: an enforced value of the highest ancestor that enforces it, the organization's own value, the nearest ancestor's default for descendants, the tenant-wide value, the declared default; every read can say which one applied. Below an ancestor that enforces a default, a group or organization cannot set or enforce its own value for it (refused naming that ancestor); values set there before the ancestor enforced stay stored and show as overridden by the enforcement.
- **FR-25** A user with `ORGANIZATION_DEFAULTS_EDIT` and `ALL_ORG_EDIT` can set tenant-wide defaults that apply wherever an organization sets none: the organization new users start in, the country, currency, currency symbol position and measurement units new organizations take, and the presentation choices the business document engine reads (rounded totals, amounts in words, numbering by document date or by confirmation time); the page also names the tenant's demo organization.
- **FR-26** The system refuses to change a default the owning feature declares fixed once used (stock valuation method, perpetual stock postings) after that feature reports use, saying why.
- **FR-27** The system lists the required defaults that are missing per organization as readiness findings, with a link to fix each, and feeds them to the setup assistant.
- **FR-28** The system declares the defaults this feature owns (default holiday country, reporting currency), shows the monthly sales target and the default addresses from where they are kept (the organization's goal and its address book), and reads and writes the ones already stored on the organization from their existing fields (time zone, week start, date and number formats, fiscal year start, currency symbol position, days until due, default estimate and invoice terms, converting accepted estimates, discount after tax, separate item tax and discount, invoice reminders) and from the organization settings other features already keep (task, goal and mailbox settings), never copying them.
- **FR-29** The system records every default change with before and after values, pushes it to open clients and publishes `organization_structure.default.changed`.

### 3.5 Shared masters

- **FR-30** The system lets each feature declare which of its master record types can be shared across organizations (customers, suppliers, items, item groups, units, price lists, settlement terms, tax categories, asset categories, holiday lists and others they own).
- **FR-31** A user with `ORGANIZATION_SHARING_EDIT` and edit rights on a record can share it with every organization of the tenant, with a group and its descendants, or with a list of organizations; a record not shared stays visible only in its own organization.
- **FR-32** A user with `ORGANIZATION_SHARING_EDIT` can set per organization and record type how new records are shared (own organization, its group, all).
- **FR-33** The system includes, in lists, lookups and reads of a shared type in an organization, the records shared with it on top of every record the organization reads today (its own and those kept for the whole tenant), and never returns another organization's record that is not shared with it; sharing never hides a record that is visible today.
- **FR-34** The system refuses on a business document a party or item of another organization that is not shared with the document's organization, naming the record; the organization's own records and those kept for the whole tenant are always accepted.
- **FR-35** The system refuses to remove an organization from a share while it has open documents using the record, listing them; closed documents keep their reference.
- **FR-36** The system keeps group shares current: an organization joining a group gains its group's shared records, one leaving loses them unless shared otherwise, both in the same step as the move (FR-15); a departure or move that would remove access to a record used by an open document of a departing organization is refused, listing the documents, as FR-35 states for a share edit.
- **FR-37** The system shows a shared-masters page: per record type, own and shared counts, the sharing default and a link to the owner's page.
- **FR-38** A user can share or unshare many records from a list in one action, with a result per record.

### 3.6 Currencies and exchange rates

- **FR-39** A user with `ORGANIZATION_DEFAULTS_EDIT` can let an organization use the exchange rates kept by another organization of the tenant (by default its group's root); rate lookups read its own rates first and then that organization's.
- **FR-40** A user can mark a rate as for buying, selling or both; a lookup for a purchase prefers a buying rate, a sale a selling rate, and otherwise a rate for both.
- **FR-41** The system shows the rate book of an organization or group: rates per currency pair with date, purpose, source (manual, feed) and author, the inverse, and the organizations reading it.
- **FR-42** The system offers, when accounting is on, the fixed currency pegs known for the organization's currencies from a shipped list with its as-of date, applied only after the user confirms.
- **FR-43** The system refuses a rate whose two currencies are equal and a duplicate rate for the same pair, date and purpose.

### 3.7 Setup assistant

- **FR-44** A user with `ORGANIZATION_SETUP_RUN` can open the setup assistant for a new or existing organization; its steps come from this feature (profile, structure, currencies and rates, addresses, defaults, departments, demo data, with the profile, currency and format steps using the same form as organization creation) and from others (numbering series, country pack, chart of accounts, tax, locations, modules switched on through the platform's feature toggles, invitations), each shown as done, missing or not applicable.
- **FR-45** The system proposes a configuration from the country and the industry: currency, time zone, date and number formats, week start, fiscal year start, the country pack, chart template, tax content, departments, numbering patterns with the short code, modules to switch on, units and default terms. `(advanced)`
- **FR-46** The system shows each step's proposal as a preview of what will be created and changed, writes nothing until the user applies one step or all, and applies a step only once however often it is applied.
- **FR-47** The system creates the departments of the chosen industry template (editable before applying) as departments of the organization.
- **FR-48** An agent can run the assistant conversationally through MCP tools: read the status, get the next question, answer it, receive the proposal with its preview and apply steps; it applies only after the person confirms in the conversation, and every applied step records the agent. `(advanced)`
- **FR-49** The system ships at least eight industry templates and lets a tenant save its own template from an organization's setup.
- **FR-50** A user can copy the setup of another organization of the tenant (defaults, numbering series, departments, sharing defaults, enabled modules, chart template choice) without its transactions.
- **FR-51** The system saves the assistant's progress, resumes it later and shows a readiness percentage on the organization list.
- **FR-52** The system reports a failing step with its reason and keeps the steps already applied.

### 3.8 Demo data

- **FR-53** A user with `ORGANIZATION_DEMO_DATA_MANAGE` can create a demo organization with sample data (small or medium) or add sample data to an empty organization; each feature in use contributes its samples (contacts, items, projects, tasks, tracked time, documents) through the platform's existing sample-data generators.
- **FR-54** The system records every sample record it creates, so "remove demo data" deletes exactly those and leaves records people created.
- **FR-55** The system marks a demo organization in the switcher and on every page, and keeps it out of consolidation, inter-organization pairs and sharing with live organizations.
- **FR-56** The system generates and removes demo data in the background with progress; generation is repeatable from the same seed.
- **FR-57** The system removes a demo organization only through "remove demo data", which removes the organization with its records.

### 3.9 Deleting an organization's transactions

- **FR-58** A user with `ORGANIZATION_TRANSACTIONS_DELETE` can request deletion of every transaction of an organization (documents, movements, journals, time and expense records the features declare as transactions), keeping its masters and settings.
- **FR-59** The system first runs a dry run listing per record type the count, a sample, dependents that must go with it, protected records and blocking reasons; the dry run deletes nothing. `(advanced)`
- **FR-60** A user can exclude record types or keep only some; the system adds the dependents a choice requires and says so.
- **FR-61** The system starts the deletion only after the user types the organization's name, and, when the user has two-factor sign-in, a fresh code; it deletes exactly what the dry run listed and refuses the start, asking for a new dry run, when the data changed since. A record created in the organization after the start is confirmed is kept and listed in the deletion record as created after confirmation.
- **FR-62** The system writes, before deleting, an archive of every record it deletes (one file per type) that the requester and administrators can download for 30 days. `(advanced)`
- **FR-63** The system deletes in the background, record type by record type with dependents first, showing status, counts and errors per type; the run can be paused, resumed and cancelled, and one runs per organization at a time.
- **FR-64** The system refuses, while a deletion runs, the creation and confirmation of business documents in that organization and shows a banner with progress.
- **FR-65** The system deletes with the transactions their comments, activity entries, attachment links and notifications, and asks the owning features to recalculate what they derive (stock levels, balances, roll-ups, counters).
- **FR-66** The system lets a feature protect record types (posted journals of a live organization); protected types are refused or must be excluded, as the dry run says.
- **FR-67** The system keeps a deletion record per run: requester, confirmation time, dry-run report, counts per type, archive link and outcome, shown in the organization's history.
- **FR-68** The system resets the organization's numbering counters only when the user asks, and never those of gap-free series.

### 3.10 Deleting an organization

- **FR-69** The system refuses to delete an organization for good while it has employees, transactions, ledger journals, children in the tree or shareholder records, listing what remains and offering soft delete or deletion of transactions; once nothing of that remains, deleting it for good first removes, through each feature, the organization's own setup records (structures, periods, policies, templates, account mappings, defaults, shares) and clears it from tenant-wide settings that name it.
- **FR-70** The system removes a soft-deleted organization from shares, group defaults and inter-organization pairs (kept inactive), and brings them back on restore.

### 3.11 Shareholder register

- **FR-71** A user with `SHAREHOLDER_REGISTER_EDIT` can keep share classes per organization: code, name, nominal value and currency, votes per share, authorised count and an on/off switch.
- **FR-72** A user with `SHAREHOLDER_REGISTER_EDIT` can keep shareholders: a person, an outside company or another organization of the tenant, with a holder number unique in the organization, address, contact details and tax identifier; holdings are shown read-only.
- **FR-73** A user with `SHAREHOLDER_REGISTER_EDIT` can draft share transactions (issue to a holder, transfer between holders, buy-back from a holder) with date, class, count, one or more number ranges, price per share, amount and currency; transactions are business documents with a number, a lifecycle and history.
- **FR-74** The system refuses to confirm a share transaction whose ranges are not held by the seller (or are already issued, for an issue), whose count differs from the ranges, whose amount differs from count × price, whose seller and buyer are the same, whose holders belong to another organization, or whose issue exceeds the authorised count.
- **FR-75** A user with `SHARE_TRANSACTIONS_CONFIRM` can confirm a share transaction; holdings change only through confirmed transactions.
- **FR-76** The system cancels a confirmed share transaction only while its shares have not moved again, otherwise it lists the later transactions.
- **FR-77** The system refuses to delete a share class or shareholder with holdings or transactions.
- **FR-78** The system publishes the share transaction's document event with share capital at nominal value, premium above it, consideration and treasury amounts, so the ledger posts issues and buy-backs; with accounting off the register works without postings.
- **FR-79** The system provides the share movements report: movements per shareholder and class between two dates with a running balance.
- **FR-80** The system provides the holdings report: holdings per holder and class at a date with the share of issued shares and of votes.
- **FR-81** The system proposes, when a holder is another organization of the tenant, its share of the issuer's issued shares as the ownership percentage of the tree link, applied once the user accepts. `(advanced)`
- **FR-82** The system prints a share certificate per holding through the print templates.

### 3.12 Organization overview

- **FR-83** A user with `ORGANIZATION_DEFAULTS_EDIT` can set a monthly sales target per organization in its currency.
- **FR-84** The system shows an organization overview on the organization's accounting dashboard: the current month's sales against target, the last 12 months as a chart, this year's confirmed documents counted and summed by type, members and employees; a group shows its descendants combined in the group's currency.
- **FR-85** The system computes achieved sales with the platform's organization income statistics (the figures the accounting dashboard shows), counting confirmed sales documents (invoices, or orders where the organization chooses) in the organization currency, keeps the monthly target as a goal of the organization, and pushes updates when a sales document is confirmed or cancelled.

### 3.13 Inter-organization relationships

- **FR-86** The system creates, when an organization joins a group (or on request), for each pair of group organizations the customer and supplier records representing each other in both organizations, marked internal and linked to the organization they represent. `(advanced)`
- **FR-87** A user with `ORGANIZATION_STRUCTURE_EDIT` can set per pair whether counterpart documents are created as drafts or confirmed, the price policy (same price, sender's cost, a transfer price list) and whether consolidation eliminates their balances; owning features read it. `(advanced)`
- **FR-88** The system answers the business document engine which organization an internal party represents, so it pairs the counterpart document automatically. `(advanced)`
- **FR-89** The system shows the relationships as a matrix of pairs with their policies, internal parties, open counterpart drafts and mismatches (one side confirmed, the other still a draft after seven days).
- **FR-90** The system deactivates a pair when an organization leaves the group, keeping its parties as ordinary records no longer marked internal.

### 3.14 Sandbox copies

- **FR-91** A user with `ORGANIZATION_SANDBOX_MANAGE` can create a sandbox copy of an organization with its settings, defaults, series and masters and, optionally, its transactions of the last N months. `(advanced)`
- **FR-92** The system replaces personal data of contacts, employees and users' details in the copy with generated values by default, and email addresses with addresses that cannot receive mail. `(advanced)`
- **FR-93** The system marks a sandbox on every page and in the switcher and refuses in it sending to outside parties, payment providers, webhooks and integrations; it keeps sandboxes out of consolidation, pairs and sharing with live organizations. `(advanced)`
- **FR-94** The system gives access to a sandbox only to the users invited to it.
- **FR-95** A user with `ORGANIZATION_SANDBOX_MANAGE` can reset a sandbox to a fresh copy, and the system deletes it at its expiry date (default 30 days) after a reminder three days before. `(advanced)`
- **FR-96** The system copies in the background with progress, reports types that failed, and never changes the source, which stays usable during the copy.

### 3.15 Agents, events and real time

- **FR-97** The system ships MCP tools to read and change the tree, read, explain and set defaults, share records, run the setup assistant, create and remove demo data, run a deletion dry run, read the register and its reports, draft share transactions, read the overview and relationships, and create a sandbox, each change with a preview and the caller's permissions. `(advanced)`
- **FR-98** The system refuses to start a deletion of transactions, a sandbox reset or a demo removal from an agent; it allows the dry runs.
- **FR-99** The system marks every action taken by an agent in the organization's history.
- **FR-100** The system publishes through the event outbox the tree, profile, country, default, share, relationship, setup, data-run and register changes, and pushes them to open clients through the platform's real-time channel.

## 4. Non-Functional Requirements

- **Performance**: default resolution under 5 ms P95 from cache and 30 ms uncached; shared-record filtering adds under 20 ms P95 to a list of one million records; tree of 500 organizations under 300 ms; assistant proposal under 2 s; overview under 300 ms; holdings at a date under 1 s for 10,000 holders.
- **Volume**: 500 organizations per tenant, 2,000 declared defaults, 5 million shared-record grants, 50 million records in a deletion run (deleted in slices of 1,000).
- **Concurrency**: version checks on profile, defaults, shares and register writes; one data run (deletion, demo, sandbox) per organization; a deletion locks document creation and confirmation.
- **Reliability**: data runs resume after a restart from their last completed slice; archives are complete before the first deletion; sandbox copies never write to the source.
- **Auditability**: before and after for every tree, default, share and register change; deletion records kept with their dry run; agent actions marked.
- **Security & privacy**: deletion needs typed confirmation and a fresh second factor when enabled; archives readable only by the requester and administrators and removed after 30 days; sandboxes replace personal data and send nothing outside; nothing leaves the platform except the existing invitations and emails.
- **Accessibility and localization**: keyboard-operable tree with list alternative, labelled forms, strings in every shipped locale, industry templates and department names translated.
- **Compatibility**: PostgreSQL, MySQL, SQLite; both ORMs; additive migrations; cloud and self-hosted; queue or in-process jobs; OpenAPI additive.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| --- | --- |
| Organization profile | The company facts the organization record lacks: short code, country, legal and registration facts, branding, tree position |
| Organization address | An address-book entry owned by the organization, with its purposes and a default per purpose |
| Organization tree, group | Organizations under parent groups, each link with ownership, dates and consolidation method |
| Default value | A setting a feature reads for an organization, set on it, on a group for descendants, or tenant-wide |
| Share of a record | Which organizations besides its owner may use a master record |
| Sharing default | How new records of a type are shared in an organization |
| Rate book source | The organization whose exchange rates another organization also reads |
| Setup run, industry template | One run of the assistant with answers, proposal and applied steps; a reusable starting configuration |
| Data run | A demo creation or removal, transaction deletion or sandbox copy, run in the background per record type, with its dry run, report and archive |
| Demo record | A record created as sample data |
| Inter-organization pair | Two organizations of a group with their internal parties and counterpart policy |
| Sandbox | A marked copy of an organization for training, closed to the outside, with an expiry |
| Share class, shareholder, share transaction, holding | The register's kinds of shares, holders, movements and current number ranges |
| Monthly sales target | The organization's goal for sales per month, compared with its income statistics |

## 6. Out of Scope

- Chart of accounts, chart templates, account designations and their content: `accounting-foundation`; country content and packs: `regional-compliance-packs`; ledger locks, rate feeds, pegs and revaluation: `general-ledger`; consolidation groups and consolidated statements: `financial-reports`.
- Users, roles, invitations and sign-in policies: `access-control-and-security`; setup wizard of a new tenant, tours and backups: `platform-administration`.
- Item, party, unit and price-list masters themselves: `item-catalogue`, `sales-order-management`, `procurement`, `pricing-and-promotions`; their own allow-list checks call this feature.
- Counterpart document field mapping (invoice to bill, order to order, delivery to receipt): `invoicing-receivables-payables`, `warehouse-and-stock-movements`, `procurement`; the pairing mechanism: `business-document-engine`.
- Letterheads and print layouts: `print-and-pdf-designer`; holiday calendars: `time-off-management`; generic import and export, recycle bin: `data-import-export`.

## 7. Acceptance Criteria

- [ ] **AC-1** A three-level tree is built, refused moves give their reason, ownership and method are kept per link, and a consolidation group created in financial reports is prefilled from the tree (advanced: consolidation-ready trees; FR-13, FR-14).
- [ ] **AC-2** An enforced group default cannot be overridden in a member; a non-enforced one can; every read states its source; moving an organization previews and applies inherited changes (FR-23, FR-24, FR-26).
- [ ] **AC-3** A customer shared with a group appears in members' lists and lookups, is refused on a document of an organization outside the share, and cannot be unshared while an open order uses it (FR-23, FR-35).
- [ ] **AC-4** The assistant proposes a full configuration for two countries and two industries, previews it, applies it once, and the readiness check passes; an agent completes the same through MCP tools with a confirmation (advanced: assisted setup; FR-45, FR-46, FR-48).
- [ ] **AC-5** Demo data created in an organization is removed exactly; a demo organization is removed only through demo removal (FR-54, FR-56, FR-57).
- [ ] **AC-6** A deletion of transactions shows a dry run, requires the typed name, blocks confirmations while running, survives a restart, leaves masters intact and offers the archive for 30 days (advanced: dry run and archive; FR-59, FR-61, FR-62).
- [ ] **AC-7** Deleting an organization for good is refused with what remains; currency change is refused after the first ledger journal, and after the first confirmed document only where the organization locks its currency (FR-8, FR-69).
- [ ] **AC-8** Issue, transfer and buy-back validate ranges, counts and amounts; the share movements and holdings reports return the expected rows; with accounting on, the issue posts share capital and premium (FR-73, FR-74).
- [ ] **AC-9** Joining a group creates the internal parties both ways and an invoice to an internal customer produces the counterpart bill per the pair's policy (advanced: inter-organization pairs; FR-86, FR-88, FR-89).
- [ ] **AC-10** A sandbox copy replaces personal data, refuses outside sending and expires on time (advanced: sandbox; FR-91–FR-93, FR-95).
- [ ] **AC-11** The overview shows target against achieved and 12 months; branding shows in the sidebar and tab (FR-10, FR-83–FR-85).
- [ ] **AC-12** With the feature off, existing organization tests pass unchanged; works on PostgreSQL, MySQL and SQLite with both ORMs; every functional requirement has a passing test (FR-1; §4).
- [ ] **AC-13** With the feature on and nothing configured, every organization looks and behaves as before: the sidebar logo, browser tab and organization switcher are unchanged, every list returns the same records (tenant-wide records included), and the currency of an organization with invoices but no ledger journals can still be changed after a warning (FR-2, FR-10).
- [ ] **AC-14** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-1).

## 8. Open Questions

- Rates of different purpose on the same date: the existing exchange-rate table keeps one rate per pair and date. Default applied: a purpose flag on that rate; two rates of different purpose on the same date would need that rule widened (FR-40).
- Deletion of transactions in a live accounting organization: default applied, posted journals are protected and must be excluded (FR-66).
- Who may hold `ORGANIZATION_TRANSACTIONS_DELETE`: default applied, super administrators only.
- Sandbox lifetime: default applied, 30 days, renewable (FR-95).
- Achieved sales basis for the overview: default applied, confirmed customer invoices (FR-85).

## 9. Constitution Gates

- [x] I Plugin-first — new plugin pair `organization-structure`; core gains an optional guard slot on organization update and delete and the organization level of its settings store.
- [x] II Tenant/organization scoping — every record tenant scoped and organization scoped; tenant-wide defaults carry no organization explicitly; sharing never crosses tenants.
- [x] III Both ORMs, additive migrations — new tables only, three dialects, both ORMs.
- [x] IV Default-off flag; nothing removed — `FEATURE_ORGANIZATION_STRUCTURE` off; existing organization fields, soft delete and restore unchanged.
- [x] V Contracts and API first — contracts and REST before screens; OpenAPI additive.
- [x] VI Permissions, privacy, security — eleven keys; typed confirmation and second factor for deletion; archives time-limited; sandboxes anonymised and closed.
- [x] VII Real-time through the event bus — outbox events and realtime hints for tree, defaults, overview and runs.
- [x] VIII i18n and accessibility — strings in every locale; tree with list alternative.
- [x] IX Tests accompany the change — each requirement has a test in the tasks.
- [x] X Behaviour-first — this document.
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Code: `packages/core/src/lib/organization/` (`organization.entity.ts`, `organization-deletion.ts`), `packages/core/src/lib/address/`, `packages/core/src/lib/address-role/`, `packages/core/src/lib/tenant/tenant-setting/`, `packages/core/src/lib/account-deletion/`, `packages/core/src/lib/export-import/`, `packages/core/src/lib/employee-statistics/`, `packages/core/src/lib/feature/`, `packages/core/src/lib/organization-department/`, `packages/core/src/lib/plugin-contributions/plugin-contribution.registry.ts`, `packages/plugins/pricing/src/lib/exchange-rate/`, `packages/plugins/onboarding-ui/`
- Related specs: [`business-document-engine`](../business-document-engine/spec.md), [`accounting-foundation`](../accounting-foundation/spec.md), [`general-ledger`](../general-ledger/spec.md), [`financial-reports`](../financial-reports/spec.md), [`regional-compliance-packs`](../regional-compliance-packs/spec.md), [`invoicing-receivables-payables`](../invoicing-receivables-payables/spec.md), [`warehouse-and-stock-movements`](../warehouse-and-stock-movements/spec.md), [`procurement`](../procurement/spec.md), [`item-catalogue`](../item-catalogue/spec.md), `../access-control-and-security/spec.md`, `../platform-administration/spec.md`
