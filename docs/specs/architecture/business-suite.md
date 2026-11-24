# Business suite architecture

How the business features fit into Ever Gauzy, Ever Teams and Ever Platform. Feature specs under
`docs/specs/features/` build on this document (see [the specs index](../README.md)). It says which plugin owns what,
which shared engines a feature must use instead of building its own, and which words we use.

## 1. Principles

1. **One platform.** Customers, suppliers, employees, items, documents, money and time live in
   one data model with one permission system, one search, one automation engine, one API and one MCP server. A
   feature never needs a "bridge" to another part of the suite.
2. **Plugin-first.** Each domain is a plugin pair (`packages/plugins/<id>`, `<id>-ui`), with a React package only where
   one editor serves several hosts; each can be switched off without breaking the rest. Core gets only the kernel
   pieces listed in §3.
3. **Build on what exists.** A large commerce back end already exists (orders, purchasing, stock, pricing, tax,
   promotions, subscriptions, returns, fulfilment). This architecture gives it screens, depth and accounting; it does
   not replace it.
4. **Every business fact is a document, every document posts through an engine.** With the accounting plugin on,
   money posts through the ledger posting engine; stock moves through the stock ledger; new approvals use the
   approval engine. No new plugin writes balances by hand. With an engine's flag off, today's paths work as they do
   now.
5. **Time is a first-class cost and capacity source.** Tracked time and activity feed project cost, job cost,
   production labour, service visits, attendance, payroll and billing without re-entry.
6. **Agents are users.** Everything a person can do through the UI, an AI agent can do through MCP tools with the
   same permissions, with a preview (dry run) before any posting action and an approval step where a person would
   need one.
7. **Default off, additive, both deployment modes.** Nothing existing is removed or narrowed; every feature is an
   addition behind a default-off switch. New plugins ship behind a tenant feature and, where the code path is risky,
   a deploy-level flag. With a switch off, every existing page, route, field, permission, report, public page and
   setting behaves exactly as today; a stricter rule (a lock, a refusal, a required field) is an organization
   setting that starts at today's behaviour. Every spec builds on the existing modules named in its plan.
   Everything works in multi-tenant cloud and in a self-hosted single tenant, on PostgreSQL, MySQL and SQLite, with
   both ORMs.

## 2. Domain map

`★` existing package that the platform extends · `＋` new plugin. Slugs in the last column are spec folders.

### 2.1 Platform services (used by every other domain)

| Domain | Packages | Owns | Specs |
|---|---|---|---|
| Business documents | ＋ `business-documents`; ★ core `sequence`, `rule` | document types registry, numbering series, lifecycle, links and flow, tolerances, change sets, recurrence, bulk creation | `business-document-engine` |
| Organization structure | ★ core tenant, organization; ＋ `organization-structure` | company tree, group defaults, shared masters, shareholder register, setup assistant | `organization-setup` |
| Custom fields and forms | ＋ `custom-fields` (+ existing custom-field support where present) | field definitions on any record type, form layouts, field rules, custom record types | `custom-fields-and-forms` |
| Approvals | ★ core approval policies and requests; ＋ `workflows` | states and transitions on any record type, value-based approval rules, approval inbox | `approval-workflows` |
| Automation and notifications | ★ `task-automations`, ★ `inbox`, ★ core email templates | rules and flows on any record type, schedules, notification channels and preferences, reminders | `automation-and-notifications` |
| Views and search | ★ `task-views-ui`, ★ `search`; ＋ `record-views` | saved views (list, board, calendar, timeline, tree, map), filters, bulk actions, command palette, global search | `record-views-and-search` |
| Reports and dashboards | ★ core `reports`, `saved-report`, `dashboard`; ＋ `report-builder` | report definitions, pivot and group-by, charts, cards, dashboards, schedules, exports | `report-builder-and-dashboards` |
| Data exchange | ★ core import and export; ＋ `data-exchange` | mapped imports with validation and update mode, exports, bulk update, rename and merge, restore | `data-import-export` |
| Print and PDF | ★ core `accounting-template`; ＋ `print-templates` | print templates for every document type, visual designer, letterheads, PDF rendering | `print-and-pdf-designer` |
| Access and security | ★ core roles, permissions, auth | role bundles, field-level and record-level rules, sharing, sign-in policies, audit | `access-control-and-security` |
| Communications | ★ core email templates and history, ★ `inbox` (provider accounts for email, text, push and voice); ＋ `communications` | sending identities, send and receive on any record, text messages, push, consent and suppression, communication timeline | `email-and-communications` |
| Integrations | ★ the Integrations page, the integration plugins and their sync jobs, core webhooks; ＋ `integration-hub` | generalizes what exists: connected accounts, shared sync records (mappings, value maps, issues) for every integration, webhooks with logs and replay, connector catalogue as a tab of the Integrations page, storage targets | `integration-hub` |
| Administration | ★ core (incl. the `stats` module with the one usage meter) | setup, users, backups, logs, job monitor, system health, usage meter | `platform-administration` |

### 2.2 Finance

| Domain | Packages | Owns | Specs |
|---|---|---|---|
| Accounting | ＋ `accounting` (optional plugin) | chart of accounts, fiscal years and periods, analytic dimensions, journals, posting engine, closing, budgets, revenue schedules, statements | `accounting-foundation`, `general-ledger`, `budgets-and-revenue-schedules`, `financial-reports` |
| Invoicing | ★ core `invoice*`, `payment-term`, `organization-vendor`; ＋ `receivables-payables` | customer invoices, supplier bills, credit and debit notes, instalments, ageing, and the one open-item register of receivables and payables (works without the ledger; the ledger and payments read and settle against it) | `invoicing-receivables-payables` |
| Payments | ★ core `payment`, ★ `payment` plugin; ＋ provider adapters | money in and out, allocation against the open-item register, requests, dunning, statements; provider adapters, checkout, payouts and the one settlement-line model | `payments-and-collections`, `payment-gateways` |
| Banking | ＋ `banking` | bank accounts, statements, feeds, matching rules, reconciliation, and the one encrypted store of the bank details of customers, suppliers and employees | `banking-and-reconciliation` |
| Tax | ★ `tax`, ★ core `tax-line` | tax categories, rates, regimes, inclusive pricing, withholding, tax reports | `tax-engine` |
| Subscriptions | ★ `subscription` | plans, subscriptions, billing runs, proration, usage | `subscription-billing` |
| Fixed assets | ★ core `equipment*`; ＋ `fixed-assets` | asset register, depreciation, movement, repair, disposal | `fixed-assets` |
| Regional packs | ＋ `regional-<country>`, ＋ `e-invoicing` | charts, tax content, statutory reports, structured invoices per country; first packs: United States, United Kingdom, Germany with the European e-invoice standard, India | `regional-compliance-packs` |

### 2.3 Trade, inventory, production

| Domain | Packages | Owns | Specs |
|---|---|---|---|
| Items | ★ core `product*`, `measurement`, ★ `catalog` | item master, variants, units, barcodes, bundles, alternatives | `item-catalogue` |
| Pricing | ★ `pricing`, ★ `promotion`, ★ core `rule`, `adjustment` | price lists, pricing rules, promotions, coupons, discount guards | `pricing-and-promotions` |
| Sales | ★ `order`, ★ `cart`, ★ core `invoice` (estimates), `contact*`, `channel`, `region`, `address` | quotations, sales orders, customer master, sales teams, commissions, blanket orders | `sales-order-management` |
| Delivery | ★ `fulfillment`, ★ `returns`, ★ `warehouse` | deliveries, packing, trips, shipments, carriers, sales returns | `delivery-and-shipping` |
| Procurement | ★ `purchasing`, ★ core `organization-vendor` | requisitions, requests for quotation, supplier quotations, purchase orders, receipts, supplier scorecards | `procurement` |
| Point of sale | ＋ `point-of-sale`, ＋ `loyalty`; ★ `promotion` (coupons, gift cards) | registers, shifts, offline selling, closing, loyalty programmes | `point-of-sale-and-loyalty` |
| Stock | ★ `inventory`, ★ `warehouse`, ★ core `warehouse` | locations, bins, movements, transfers, reservations, reorder, pick and putaway | `warehouse-and-stock-movements` |
| Valuation | ★ `inventory`; ＋ `inventory-valuation` | value layers, costing methods, backdated recalculation, landed cost, stock closing | `stock-ledger-and-valuation` |
| Lots and serials | ＋ `lot-serial-tracking` | lot and serial masters, bundles on document lines, expiry, traceability | `serials-and-batches` |
| Quality | ＋ `quality` | inspections, templates, goals, reviews, non-conformance, actions | `quality-management` |
| Manufacturing | ＋ `manufacturing` | bills of materials, routings, work centres, work orders, operation cards, planning | `manufacturing-bom-and-routing`, `shop-floor-and-work-orders`, `production-planning` |
| Subcontracting | ＋ `subcontracting` | outward and inward subcontract orders, supplied materials, receipts | `subcontracting` |
| Service | ＋ `field-service` | maintenance plans, visits, warranty claims, installed base | `maintenance-and-field-service` |

### 2.4 Customers

| Domain | Packages | Owns | Specs |
|---|---|---|---|
| CRM | ★ core `organization-contact`, `contact*`, `pipeline*`, `deal`; ＋ `crm` | leads, deals, organisations and people, conversion, forecasting, contracts, timeline, service levels, assignment | `crm-leads-and-deals`, `crm-engagement` |
| Lead capture | ＋ `lead-capture` | web forms, ad and channel intake, enrichment with undo | `lead-capture-and-enrichment` |
| Telephony | ＋ `telephony` | providers, click-to-call, call popup, call log and recordings on any record | `telephony` |
| Campaigns | ＋ `campaigns` | audiences, email and message campaigns, newsletters, results | `marketing-campaigns` |
| Helpdesk | ★ core tasks (a ticket is a task of issue type "ticket" with a small customer-side extension), ★ `docs` (help spaces in the documents hub), ★ `knowledge-base` (the existing help centres, articles and their pages stay; a one-time import copies articles into a help space); ＋ `helpdesk` | channels, agents and teams, service levels, saved replies, satisfaction, the help read API and feeds for help sites | `helpdesk-tickets`, `helpdesk-sla-routing-and-analytics`, `helpdesk-portal-and-knowledge-base` |
| Portal | ★ core `contact-credential`, ★ `public-layout-ui`; ＋ `customer-portal` | customer and supplier sign-in, their documents, tickets, projects, addresses | `customer-and-supplier-portal` |
| Commerce connectors | ＋ `commerce-connector-<name>` | product, stock, order and fulfilment sync with outside shops and marketplaces | `commerce-connectors` |

### 2.5 People and projects

| Domain | Packages | Owns | Specs |
|---|---|---|---|
| Projects and time | ★ core projects, tasks, sprints, timer, time logs, timesheets, rates, budgets, teams; ＋ `project-costing` | templates, dependencies, recurring tasks, activity cost rates, cost and revenue roll-up, milestone billing, profitability, resource planning | `project-costing-and-billing` |
| HR core | ★ core `employee`, departments, positions, levels, skills, awards, invites; ＋ `hr-lifecycle` | reporting line and organisation chart, onboarding and separation with tasks, dated HR events (transfer, promotion), grievances, final settlement, document types with expiry | `hr-core-lifecycle` |
| Attendance and shifts | ★ timer and time logs, availability slots; ＋ `attendance`, ＋ `shifts` | attendance records, check-in log and device API, automatic attendance from check-ins and tracked time, shift templates, rosters, geofencing, overtime | `attendance-and-shifts` |
| Time off | ★ core time-off policies, requests, balances, official holidays | accrual, carry-forward and expiry jobs, encashment, compensatory time off, half days, calendars, holiday packs, screens for balances | `time-off-management` |
| Payroll | ★ core pay data and pay-run register; ＋ `payroll` | pay elements with formulas, pay structures, tax brackets and declarations, benefits, pay runs that calculate, payslips, journals, bank files | `payroll-setup`, `payroll-processing` |
| Expenses and travel | ★ core `expense*`; ＋ `expense-claims` | employee claims with approval and reimbursement, advances, travel requests, vehicle log | `expenses-and-travel` |
| Recruitment | ★ core candidates, interviews, feedback; ＋ `recruitment` | openings with feeds for career sites, applicant pipeline, interview rounds, offers, referrals | `recruitment` |
| Performance | ★ core goals, key results, KPIs; ＋ `performance-reviews` | review cycles, templates, feedback, scoring | `performance-management` |
| Learning | ＋ `learning` | training events, courses, quizzes, certificates, paid courses | `learning-management` |

### 2.6 Productivity

| Domain | Packages | Owns | Specs |
|---|---|---|---|
| Drive | ★ `docs` (documents hub: folders, files, sharing, previews, storage providers) | public links, file versions, quotas per user, team spaces, sync and network access | `drive` |
| Documents and wiki | ★ `docs`, `docs-ui`, ★ `knowledge-base` | templates, suggestions, wiki spaces as properties of the existing spaces, help spaces, public read feeds, change review, document formats | `documents-and-wiki` |
| Spreadsheets, presentations | ＋ `sheets`, ＋ `slides` (stored as drive files, co-edited on the docs collaboration server) | grid and formulas; slides and presenting | `spreadsheets`, `presentations` |
| Meetings | ★ Ever Teams meetings (media server integration); ＋ `meetings` | meeting record in Gauzy, guests, recording, transcripts and summaries, meetings on records | `meetings` |
| Mail | ★ `inbox` (mailboxes, receiving, threads, provider plugins); ＋ `mail` | mail client (compose, drafts, folders, rules, search), connected accounts, shared mailboxes | `mail` |
| Calendar | ★ core appointments, availability, event types, public booking; ＋ `calendar` | general events, recurrence, invitations, overlays, external sync, resource booking | `calendar-and-scheduling` |
| Chat | ★ `chat`, `chat-ui`, `realtime` | extensions of chat, agents and record actions in chat, administration, clients | `chat-messaging`, `chat-agents-and-record-actions`, `chat-administration-and-clients` |
| Discussions | ★ core comments, broadcasts, followers; ＋ `discussions` | spaces, long-form posts, polls, digests | `discussions` |

### 2.7 Agents, marketplace, clients

| Domain | Packages | Owns | Specs |
|---|---|---|---|
| Agents | ★ AI provider plugins, in-app assistant, MCP server (hundreds of tools), agent-kind employees; ＋ `ai-agents` | agent definitions, tool permissions, knowledge bases, runs with approvals, cost limits | `ai-agents-and-assistants` |
| App marketplace | ★ Ever Platform catalogue, publisher flow, review desk (apps.ever.co, one catalogue for every Ever product with a view per product); ★ the existing Gauzy plugin store (`registry` plugin: plugins, versions, installs, subscriptions) | ratings and reviews, automated checks, versions and channels, installs into a Gauzy tenant or server through the plugin store, paid apps and payouts, developer tools | the Ever Platform spec `marketplace-catalogue`, the Ever Platform spec `publisher-console`, the Ever Platform spec `app-installs-and-licensing` |
| Ever Teams clients | ★ Ever Teams web, mobile, desktop, extension (a separate app over the Gauzy API, keeping every screen it has today) | new client work only for projects and tasks, time tracking, timesheets, check-in and attendance, time-off requests and shifts; chat, mail, calendar, documents and meetings | the Ever Teams spec `people-self-service`, the Ever Teams spec `workspace-collaboration-clients` |

The Gauzy `marketplace` plugin is a multi-vendor goods marketplace (sellers, commissions, payouts). It is commerce,
not the app marketplace; its payout model is reused for publisher payouts.

## 3. Shared engines

A plugin that needs one of these uses it.

### 3.1 Business document engine (`business-documents`)

A registry where each plugin declares its document types (quotation, sales order, delivery, invoice, purchase
order, receipt, stock movement, work order, payslip, expense claim, …) and gets, without writing them again:

- **Numbering series** per document type, organization and period, with prefixes, tokens, padding, reset policy and
  an optional gap-free mode. Built on the existing core `sequence` service.
- **Lifecycle**: draft → confirmed → cancelled, plus document-specific states layered on top. A confirmed document
  of a new type is changed through a recorded **change set** or an **amendment** (a linked new version). Cancelling
  reverses effects through the owning engines. Existing documents (invoices, estimates, orders) keep their numbers,
  statuses, routes and today's editing; locking them after confirmation is an organization setting that starts
  off.
- **Links and flow**: every "create from" keeps a typed link (source line → target line) so the engine can roll up
  ordered, delivered, received, billed and returned quantities and amounts, enforce over- and under-fulfilment
  **tolerances**, close individual lines, and draw the document flow.
- **Totals pipeline**: lines → pricing (§3.3) → discounts → taxes → rounding → totals, the same on every
  commercial document.
- **Recurrence** (repeat a document on a schedule), **bulk creation** with a result log, **dependent drafts
  lookup**, and an **effects preview** (ledger and stock entries a draft would create).

Events: `document.<type>.confirmed|cancelled|amended|closed` through the event outbox. Posting engines subscribe.

### 3.2 Party model (core)

Customers, leads and organisations are `organization-contact` records with people under them (`contact`,
`contact-buyer`); suppliers are `organization-vendor`; employees are `employee`. Ledgers, payments, addresses,
portals and communications refer to a party as (party type, party id). No new master is introduced; a party can be
customer and supplier at once by linking the two records. Addresses are the core address book; bank details of every
party live in the one encrypted store of `banking`; links between two records of any type are core record links
(`resource_link` with a record target).

### 3.3 Money, pricing and tax kernel (core `money`, `currency`, `adjustment`, `tax-line`, `rule`; `pricing`, `tax`, `promotion`)

Exact-decimal money, currency and exchange-rate tables, the rule engine, the adjustment ledger and the tax engine
already exist for carts and orders. With the tax engine on, the platform offers them to **every** commercial
document (invoices, bills, purchase orders, point-of-sale sales) and adds rate feeds, tax accounts and withholding;
the hand-typed tax percentages on invoices stay available beside it, and with the flag off they work as today.

### 3.4 Ledger posting (`accounting`)

`accounting` is an optional plugin. It owns the chart of accounts, fiscal periods, analytic dimensions and the
general ledger. Other plugins
never insert ledger lines. They publish a document event; a **posting rule** owned by `accounting` (with account
determination by organization, party, item group, tax and warehouse) turns it into a balanced journal in the
document currency and the organization currency. Cancelling posts a reversal. Period locks, immutability of posted
journals (the default; a tenant setting switches on an editable mode), reposting, sub-ledgers for receivables and payables and the effects preview live here. With `accounting` switched
off, every other plugin keeps working as today (documents without postings).

### 3.5 Stock ledger and valuation (`inventory`, `inventory-valuation`)

The existing append-only stock movement ledger stays the source of quantities. Typing a quantity on today's
inventory screens stays possible; with the stock feature on, each typed change is also written as an adjustment
movement, and with it off the screens work as today. `inventory-valuation` adds a value layer per movement
(first-in-first-out, moving average, standard cost), backdated recalculation, landed cost and the link to §3.4.
Lots and serials attach to movements as bundles. The new stock-moving features (manufacturing, subcontracting,
point of sale, quality) write through this ledger, as returns already do.

### 3.6 Approvals and workflows (`workflows`, core approval policies)

One engine for states, transitions, conditions, approvers (role, manager chain, named user, amount bands) and
parallel or sequential steps on any record type, with an approval inbox, delegation, reminders and an audit trail.
The existing approvals (time off, equipment sharing, business trips, purchase orders and sales orders, with their
policies) stay and keep working as today; with workflows on, each is also offered as a default workflow definition
that an organization can adopt and extend, and requests made the old way stay readable and decidable. A plugin
that falls back to core request approvals files them with its own request type and registers a settler on the one
core settler registry; no new plugin builds an approval table of its own.

### 3.7 Custom fields, forms and views (`custom-fields`, `record-views`)

Field definitions, layouts and saved views are metadata on a record type, available to every plugin's lists and
forms in the Angular app. Custom fields are filterable, reportable, importable, printable and exposed in the API,
SDKs and MCP tools. Questionnaires (application questions, review templates, exit interviews, web forms) use one
question-set format of the same field types.

### 3.8 Reports and dashboards (`report-builder`, core `reports`, `dashboard`)

Each new plugin registers **report definitions** (dataset, filters, columns, group-by, chart) rather than
hand-built report pages; users can clone and change them, pivot, schedule and export. Metric cards and charts on
dashboards are report definitions too. The existing report pages, saved reports and dashboards stay as they are and
are also registered as definitions.

### 3.9 Automation and notifications (`task-automations` generalized, `inbox`)

Trigger (record event, schedule, incoming message, webhook) → conditions → actions (update, create, assign,
notify, request approval, call webhook, run an agent), with waits, branches, trial runs and run history. The
existing task automation rules keep working on the same engine. With automation on, notification channels (in-app
inbox, email, push, chat, text message) share one preference model that starts from each person's current
notification settings, which keep their meaning; date reminders of new features are rows of one reminder table,
and features add sections to one digest per person.

### 3.10 Productivity services used by business records

Files (drive), mail, calendar, meetings, chat and documents are platform services: any record can hold files, an
email thread, events, a meeting, a discussion, linked documents and links to other records through the same panels.
New public sites (careers, course catalogue, help sites, public wiki, landing pages) are built with Ever Works over
Gauzy's public read feeds and transaction endpoints; Gauzy provides the data, the feeds, the endpoints and small
built-in pages such as accepting an estimate or paying a link. Every existing public page of Gauzy (the public
invoice and estimate pages, employee and organization profiles, appointment booking, the help centre and knowledge
base) stays and keeps working.

### 3.11 Events, real time and jobs

Domain events use the event outbox and consumer registry (`<domain>.<entity>.<verb>`); the real-time channel
pushes record changes to open clients; long work runs as scheduled jobs and queue workers in the worker app, with
an in-process fallback where a small deployment has no queue.

### 3.12 AI and MCP

Each spec lists its MCP tools. Posting and irreversible tools take `preview: true` and return the effects before
committing. Agents act through the request context of a user or a service account with explicit permissions, and
their actions are marked in the audit trail.

## 4. Reuse map (what exists → what is added)

| Today | Added |
|---|---|
| Invoices and estimates are documents without accounting; two typed tax percentages; one payment per invoice | Keep the document and its API; attach numbering series, the tax engine, credit and debit notes, instalments, allocation of payments, and posting through `accounting` |
| Vendor bills exist as API-only rows; no payables process | Bills, three-way match and payables ageing on the same invoice model |
| `sequence` service (prefix, padding, reset) used by commerce only | Stays as it is for commerce and also serves as the numbering series of every document type registered with the engine; existing invoice and estimate numbers keep their current rules |
| Commerce plugins (`order`, `cart`, `pricing`, `promotion`, `fulfillment`, `returns`, `purchasing`, `inventory`, `warehouse`, `tax`, `subscription`, `entitlement`, `catalog`, `search`) are API-only | Angular UI for each, MCP tools, print templates, reports, then depth (requisitions, quotations from suppliers, blanket orders, commissions, carriers, valuation) |
| Feature codes declared and not read by guards | Each spec wires its feature code to its controllers and menu entries; before a code starts guarding routes, a migration switches it on for every tenant that already has data in that area, so nobody loses access |
| Stock quantity can be typed directly in the inventory screen | Typing stays; with the stock feature on, each typed change is also written as an adjustment movement |
| Equipment register and lending | Both stay as they are; with fixed assets on, an equipment item can be linked to an asset record that adds depreciation and disposal |
| Contacts (clients, customers, leads), pipelines, deals without amount or owner | Lead and deal depth, people under organisations in the UI, activity timeline, forecasting |
| Internal knowledge base (help centres and articles) | Stays and keeps working, its pages included; with the help portal on, a one-time import copies the articles into one help space per organization in the documents hub, with audiences, feedback and search, a read API and feeds for help sites, linked from tickets |
| Tasks with issue types | Helpdesk tickets are tasks of issue type "ticket", so every task screen, timer and view serves them |
| Integrations page and integration plugins, each with its own sync tables | The page and every plugin keep working; the integration hub adds shared sync records, one inbound log and a connector catalogue on the same page beside each plugin's own sync tables |
| Plugin store (`registry` plugin: plugins, versions, installs, plans, subscriptions) | Stays as it is; installs from the apps.ever.co catalogue go through it, and its plugin plans and subscriptions keep working |
| Public invoice and estimate links | Stay; a full customer and supplier portal is added on the existing contact credentials |
| Payment provider framework without adapters | Provider adapters as separate plugins; online payment on invoices, orders, portal and point of sale |
| Report catalogue, saved reports, dashboards | Stay as they are and also serve as the report builder's registry and storage |
| Task automation rules | Keep working; the same engine also runs rules on every record type |
| Custom fields declared in code by plugins | Keep working; user-defined fields on the same mechanism, with layouts and rules |
| One-step approval requests of five fixed types; policies without steps | Stay and work as today; with workflows on, they are also offered as default definitions of the workflow engine (multi-step, conditional, on any record), and old requests stay decidable |
| Saved views for tasks only (flag-gated) | Task views stay; the same saved-view model is offered on every list |
| Eleven fixed reports, saved report for one report type, widget dashboard | The pages stay and are also registered as report definitions; the builder adds user-built reports, charts and cards |
| Tenant export and bulk-create routes | Mapped import with validation and update mode on top |
| Timer, time logs, timesheets with one approval step | Stay the source; attendance, payroll, job costing and billing read from them |
| Time-off balances API-only; accrual fields without a job | Balances and requests keep working; with time-off policies on, screens, accrual and carry-forward jobs and encashment, with today's balances carried in as opening entries |
| Pay-run register with typed-in amounts | Typed-in runs stay; the calculating pay run writes the same register |
| Candidates with three fixed statuses | The statuses stay; a configurable pipeline, openings and offers are added |
| Goals, key results, KPIs | Feed review cycles; KPIs can be computed from platform data |
| Chat, real-time docs, inbox, meetings behind flags | Completed in Gauzy, still behind their flags (each installation and tenant switches them on); Ever Teams uses the same API |
| Appointments, availability, public booking | Stay, public booking pages included; a full calendar builds on them |
| Receiving mailboxes and reply API without a compose screen | A full mail client on the same mailboxes |
| Platform catalogue with seeded listings, publisher flow and review desk; installs into Gauzy unavailable; payment shells | Installs into tenants and servers, paid apps, reviews, automated checks |
| The MCP server's tool groups | Every spec lists its tools and checks that each calls an existing route; the AI spec sets shared rules |

## 5. Vocabulary

Use these words in specs, code, UI and docs.

| Term | Meaning |
|---|---|
| organization | a company (legal entity) inside a tenant; organizations form a tree |
| party | a customer, supplier or employee as the counterpart of a document or ledger line |
| contact / organisation contact | a customer, lead or client record; people sit under it |
| vendor | a supplier |
| item, variant | what is sold, bought, stocked or made (`product`, `product_variant`) |
| business document | a numbered record with a lifecycle (quotation, order, delivery, invoice, bill, receipt, payment, …) |
| numbering series | the rule that gives a document its number |
| document flow | the chain of linked documents from quotation to payment |
| change set, amendment | a recorded change to a confirmed document; a new linked version of it |
| ledger account, journal, posting | accounting account, balanced accounting entry, the act of writing it |
| fiscal year, period, period lock, period close | accounting calendar and its controls |
| analytic dimension | a user-defined axis on ledger lines (cost centre, project, department, …) |
| open item | an unpaid or unallocated receivable or payable |
| stock location, bin | warehouse and a place inside it |
| stock movement | one line of the stock ledger; a **stock movement document** groups lines (receipt, issue, transfer, repack) |
| valuation layer | the value attached to a stock movement |
| lot, serial unit | tracked batch; tracked single piece |
| requisition | an internal request to buy, move or make something |
| bill of materials, routing, work centre, work order, operation card | manufacturing structure, steps, place, order and per-step record |
| register, shift | a point-of-sale till and a cashier's opening-to-closing session |
| time off | leave (types, policies, balances, requests) |
| shift template, roster | a named working pattern; who works which shift when |
| check-in | a clock-in or clock-out event |
| pay element, pay structure, pay run, payslip | payroll component, an employee's set of components, a payroll execution, its result per employee |
| review cycle, goal, key result | performance management terms |
| lead, deal, pipeline, stage | CRM terms as in the existing code |
| ticket, service level policy, saved reply | helpdesk terms |
| saved view | a named list, board, calendar or timeline configuration |
| automation rule, flow | trigger, conditions and actions; a multi-step automation with waits and branches |
| custom field, form layout | user-defined field; arrangement of fields on a form |
| print template | layout used to print or render a document as PDF |
| report definition, dashboard, card | a reusable report; a page of charts and cards |
| app listing, publisher, install | marketplace terms |

## 6. Conventions every plan follows

- **Scoping:** every entity extends the tenant and organization base; records shared across organizations of a
  tenant (items, parties, chart templates) say so explicitly and carry an organization allow-list.
- **Money:** amounts use the money kernel (exact decimals with currency); every monetary document stores document
  currency, organization currency and the rate used.
- **Feature flags:** one tenant feature code per plugin (`FEATURE_<PLUGIN>`), checked by a guard on every controller
  and resolver and by the menu; sub-features as further codes. Deploy-level `GAUZY_<X>_ENABLED` only where a code
  path must be absent from a deployment. Existing codes are reused, not renamed. Every new code is off by default;
  where an existing code starts guarding routes, a migration first switches it on for every tenant that already has
  data in that area.
- **Permissions:** `<DOMAIN>_<ENTITY>_<VERB>` keys declared as plugin contributions with their default grants
  (`defaultFor`), posting and approval actions as separate keys.
- **API:** REST first (plus GraphQL where the plugin already contributes resolvers), cursor pagination, idempotency
  keys on creating and posting endpoints, bulk endpoints with per-row results.
- **UI:** Angular plugin UI, laid out for phones and installable where a feature needs the camera or offline use;
  every new list is a saved-view list and every new form honours custom fields and layouts; existing lists and forms
  keep their current layout as the default.
- **No regression:** every spec states as an acceptance criterion that with its flags off nothing changes for a
  tenant; a migration copies or adds and never deletes or locks existing data.
- **Performance budgets** (unless a spec sets stricter ones): list page under 300 ms at the 95th percentile for one
  million rows per tenant; document confirmation under 500 ms excluding asynchronous postings; reports over ten
  million ledger or stock lines served from maintained balances or snapshots, not from raw scans.
- **Named locks:** where a plan takes a named database lock, PostgreSQL uses a transaction-scoped advisory lock, which
  ends with the transaction; on MySQL a lock taken with `GET_LOCK` is released with `RELEASE_LOCK` on the same
  connection on every exit path, failures included; SQLite has a single writer and needs none.
- **Audit:** who, when, before and after for every change to a confirmed document, a posting or a setting.
