# Feature Specification: Customer and supplier portal

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `customer-and-supplier-portal`
**Branch**: `feat/customer-and-supplier-portal`
**Status**: `Draft`
**Created**: 2026-11-16
**Last updated**: 2026-11-23
**Owner**: evereq
**Feature flag**: `FEATURE_CUSTOMER_PORTAL` (tenant feature, default off) · the plugin loads only when
`GAUZY_CUSTOMER_PORTAL_ENABLED` is exactly `true` · it needs `FEATURE_ADVANCED_ACCESS` on · the portal assistant also
needs `FEATURE_PORTAL_ASSISTANT` and supplier onboarding `FEATURE_SUPPLIER_ONBOARDING` (both default off)

---

## 1. Overview

Today the only page a customer can open is the public link of one invoice or estimate; customer login rows exist
without any way to sign in, and inviting a client creates a separate workspace for them. This feature gives each
organization a **portal**: people of its customers and suppliers sign in at the organization's portal address and see
**their party's documents only**: quotations, orders, deliveries, invoices, payments and statements for customers;
requests for quotation, supplier quotations, purchase orders and bills for suppliers; projects, tasks and timesheets
billed to them; their addresses. Staff give access from a customer, supplier or person page through the platform's
invitations, or let people sign up; administrators of a customer or supplier manage their own colleagues. A **portal
member** is a person of the platform's party model with access to one party, whose role is the role of their
membership in that party's company account (administrator, approver, purchaser or viewer); the person signs in once
with the contact login the platform already stores, as a user of the portal type of `access-control-and-security`
linked from their person record, so its ceilings, sign-in policies, codes and audit apply. Other plugins plug their
areas and document lists into the portal shell. Clients: the portal pages of the Gauzy web app (installable on phones),
the staff pages (portal tab, settings, sign-up queue), the MCP server, the API and SDKs.

**Advanced capabilities.** **One portal for every outside role**: a person who is a customer, a supplier, an
applicant or a learner signs in once and switches role. A **portal assistant** answers "where is my order, invoice or
ticket" from the party's own records only, with links and the facts used. **Shared approval of quotations** lets several
people of a customer comment and approve before one of them signs. **Supplier self-service onboarding** turns an
application with documents into a supplier, and expiring documents come back to the supplier for renewal. Members
**reorder** from a past order, give their **own systems and agents scoped keys**, and every page updates **live**;
staff see who is reading a document right now. These requirements are marked `(advanced)`.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** an administrator who turned the portal on with the address `acme`, **when** a sales person opens the customer
  "Ruiz Logistics", chooses **Give portal access** for its person Ana with the role "Administrator", **then** Ana gets
  an invitation email in her language with a link valid 7 days; **when** she sets a password, **then** she lands on the
  portal home with cards "2 open quotations", "1 order on the way", "3 unpaid invoices, 4,120.00 EUR due".
- **Given** Ana on Invoices, **when** she selects two overdue invoices and pays, **then** the checkout of the organization's
  payment provider opens for 1,860.00 EUR; after payment both invoices show "Paid" within 5 seconds and the receipt is
  downloadable; staff see "paid from the portal by Ana Ruiz" on each invoice.
- **Given** a sent quotation, **when** Ana opens it in the portal, ticks an optional line and accepts with her drawn
  signature, **then** the quotation is accepted exactly as through its online link, an order is placed, and the order
  appears in her Orders list.
- **Given** the supplier "Nord Metals" invited to a request for quotation, **when** its member Piotr opens Requests for
  quotation, **then** he sees only requests his company was invited to, enters prices and lead times per line in his
  company's currency and submits; the buyer sees the supplier quotation at once.
- **Given** a published purchase order, **when** Piotr chooses **Create bill** after delivery, **then** the received lines
  are prefilled, he adds his invoice number and the PDF, and the bill waits in the buyer's review queue.
- **Given** a project of Ruiz Logistics where Ana is a stakeholder allowed to see time, **when** she opens Projects,
  **then** she sees open tasks, the latest project update and the approved time per week, never rates or costs; **when**
  she raises a task "Add export to CSV", **then** it is created in the project's intake status marked "raised by client"
  and the project manager is notified.
- **Given** Ana as administrator, **when** she invites her colleague Luis with the role "Viewer", **then** Luis can see
  and download invoices but cannot pay them or answer quotations; **when** she removes him, **then** his open sessions
  end within a minute.
- **Given** a person who is a customer contact and a supplier contact of the same organization, **when** she signs in,
  **then** the header offers "Ruiz Logistics, customer" and "Ruiz Logistics, supplier" and each shows its own menu.
  `(advanced)`
- **Given** the assistant on, **when** Ana asks "where is my order 1042?", **then** it answers "shipped yesterday by
  carrier, expected Thursday" with links to the order, the delivery and its tracking page. `(advanced)`

### 2.2 Edge cases & failures

- **Given** a member who changes the number in a document address to another party's document, **then** the answer is
  `404` and nothing reveals that the document exists; a guest who opens any portal page is asked to sign in.
- **Given** five wrong passwords in 15 minutes, **then** the login is locked by the credential's lockout ladder and the
  answer never says whether the address has an account; a code sign-in is refused for the same window.
- **Given** an invitation to an address already used by a staff user of the tenant, **then** it is refused naming the
  conflict; the person keeps using the internal app.
- **Given** a self sign-up from an address that matches a person of an existing customer, **then** it waits for staff
  approval with the match shown, and nothing of that customer is visible until approved.
- **Given** the last administrator of a party, **when** they try to remove themselves or their administrator role,
  **then** it is refused; staff can still change it.
- **Given** two members accepting and declining the same quotation revision at once, **then** exactly one answer is kept
  and the other member is told it was already answered.
- **Given** the payment provider failing during checkout, **then** the invoices stay unpaid, the member sees the
  provider's reason and can retry; nothing is recorded twice when the provider later reports success.
- **Given** a member suspended while a page is open, **then** the next request answers `401` and the page shows "your
  access has ended".
- **Given** `FEATURE_CUSTOMER_PORTAL` off, or access control off, **then** every portal page and route answers `404`,
  public invoice and estimate links keep working as today, and members' data stays untouched.

## 3. Functional Requirements

### 3.1 Scope, flags and compatibility

- **FR-1** The system loads only when `GAUZY_CUSTOMER_PORTAL_ENABLED` is exactly `true`, gates every route, page, menu entry, MCP tool and public endpoint with `FEATURE_CUSTOMER_PORTAL`, and refuses to switch portal sign-in on while `FEATURE_ADVANCED_ACCESS` is off, saying why.
- **FR-2** The system keeps public invoice and estimate links, estimate answers by link, the contact login rows and their staff routes, client invitations and every existing contact, vendor and address route working as today.
- **FR-3** The system uses the platform's parties, people, memberships, addresses, documents and login rows directly and copies or synchronises no party.
- **FR-4** The system only adds routes, fields and enum values; nothing existing is renamed, repurposed or removed; a tenant that has not switched the portal on keeps it off, also after any later change of the default for new tenants.

### 3.2 Portal settings

- **FR-5** A user with `PORTAL_SETTINGS_MANAGE` can set per organization the portal's address key (unique in the deployment, 3–40 lowercase letters, digits and hyphens), its name, languages, default language, terms and privacy links, support contact and the address of the organization's public site, and switch sign-in on; the portal address serves sign-in, invitations, sign-up and the signed-in areas and links to the public site, which is an Ever Works site reading the platform's public feeds (the help centre's among them, which answer even while sign-in is off).
- **FR-6** A user with `PORTAL_SETTINGS_MANAGE` can choose the sign-in methods offered (password, email code, passkey and the social providers the tenant allows) within the portal sign-in policy of access control.
- **FR-7** The portal uses the organization's branding (name, logo, colours, favicon) and, when the help centre is loaded, its portal branding settings, for every page, email and sign-in screen.
- **FR-8** The system shows a portal address per organization and, when a verified custom domain of the organization is routed to the deployment, serves the portal on that domain too.

### 3.3 Portal accounts and sign-in

- **FR-9** The system gives each portal person one account: their person record, their contact login (address, password hash, verification and reset tokens, lockout, authenticator secret) and a user of the portal type, linked from the person record and bound to the party of their active membership, whose language and time zone are the person's.
- **FR-10** A person signs in at the portal address with password, email code, passkey or an allowed social provider linked to the verified address of an existing account; social sign-in never creates an account.
- **FR-11** The system applies the portal sign-in policy of access control (second factor, password rules, lockout, sessions, networks, hours) and the contact login's lockout ladder, whichever is stricter.
- **FR-12** The system answers sign-in, code and reset requests in the same time and words whether or not an account exists, and limits them per address, network address and portal (default 10 per address per hour).
- **FR-13** A person can reset their password through an emailed link valid 60 minutes; using it ends their other sessions.
- **FR-14** A person can enrol an authenticator app or passkeys and keep recovery codes, and lists and ends their own sessions from their profile.
- **FR-15** The system refuses portal accounts on the staff sign-in page and staff accounts on the portal sign-in page, and refuses an invitation or sign-up to an address used by a staff user of the tenant.
- **FR-16** The system confines a portal user to portal routes and the portal routes of other plugins; any internal route answers `403` and any document outside their active party answers `404`.
- **FR-17** The system ends a person's portal sessions within one minute when their last membership is suspended or revoked, their party is archived or the portal is switched off.
- **FR-18** A user with `PORTAL_ACCESS_MANAGE` can send a person a sign-in or password reset email from the person's or party's page.

### 3.4 Provisioning, invitations and sign-up

- **FR-19** A user with `PORTAL_ACCESS_MANAGE` can give portal access from a customer, supplier or person page: choose existing people or add a person with name and email, choose the membership role (default the organization's default role), and optionally an end date; the contact page names this action apart from inviting the client to a workspace of their own, which keeps working as today.
- **FR-20** The system creates whatever is missing (the person under the party, the membership in the party's company account, the contact login without a password, the portal user) in one step and sends one of the platform's invitations, of the portal kind, in the person's language with a link valid 7 days to set a password or sign in by code.
- **FR-21** A user with `PORTAL_ACCESS_MANAGE` can resend, extend or cancel an invitation under the platform's invitation rules and throttles; an expired invitation answers "ask for a new invitation", a used one cannot be used again, and a portal invitation is never accepted as a workspace invitation.
- **FR-22** A user with `PORTAL_ACCESS_MANAGE` can give access to the people of up to 500 parties selected in a saved view, with a result per party (invited, already a member, refused with reason).
- **FR-23** Other plugins can ask the portal to ensure access for a document's recipient (for example a supplier invited to a request for quotation); it invites them when the organization allows it for that document kind (default on for requests for quotation, off otherwise).
- **FR-24** A user with `PORTAL_SETTINGS_MANAGE` can allow self sign-up for customers, suppliers or both (default off) and require staff approval (default on); a sign-up confirms the address by code before anything is created.
- **FR-25** The system links a confirmed sign-up whose address matches a person of a party to that person and holds it for approval with the match shown; without a match it creates an individual customer (source "portal"), or for a supplier a supplier application (FR-85) or, with onboarding off, a request that staff link to a supplier; a new party whose name equals an existing one is flagged as a possible duplicate.
- **FR-26** A user with `PORTAL_ACCESS_MANAGE` can approve a sign-up (link it to a party, choose roles) or reject it with a reason that is emailed; requests older than 30 days without a decision expire.
- **FR-27** The system sends a welcome email when a membership becomes active and gives a new member the organization's default membership role (purchaser unless changed); a person who is the party (an individual customer) administers it.

### 3.5 Members, roles and administrator self-service

- **FR-28** A user with `PORTAL_SETTINGS_MANAGE` can set, per party kind, which portal rights from the catalogue that loaded areas declare (view list, view detail, download, pay, accept, answer, create, edit, review, manage members) each membership role holds; shipped: administrators hold every right, approvers also review and approve quotations, purchasers view, download, pay, accept, answer and create, viewers view and download.
- **FR-29** The system computes a member's rights from their membership role, within the portal ceiling of access control and the areas switched on for the party; a membership role never grants an internal permission.
- **FR-30** A person can be a member of several parties (one company account, the same company as customer and as supplier, themselves as an individual customer, and the party kinds other plugins register); one membership is active at a time, the header switches it without signing in again, and every list and count shows the active party only.
- **FR-31** A member with "manage members" sees the party's members, invitations and last sign-in, invites colleagues with a role no higher than their own, changes roles within their own, suspends and removes members and cancels invitations.
- **FR-32** The system suggests to administrators the people of their party not yet invited and addresses on the party's verified domains, and sends other addresses to staff approval when the organization says so (default on).
- **FR-33** The system refuses removing or demoting the last administrator of a party by a member; staff can.
- **FR-34** An administrator or a user with `PORTAL_ACCESS_MANAGE` can give a member access until a date (for example an outside accountant), after which the membership ends by itself and the member is told 3 days before.
- **FR-35** A user with `PORTAL_ACCESS_MANAGE` can preview the portal as a member, read-only, under a banner, recorded in the audit trail.

### 3.6 Portal menu, home and areas

- **FR-36** The portal menu lists the areas whose plugin and feature are on and whose rights the member holds, by party kind: for customers Quotations, Orders, Deliveries, Invoices, Payments, Projects, Timesheets, Tickets, Subscriptions and Addresses; for suppliers Requests for quotation, Quotations, Purchase orders, Bills, Payments, Documents and Addresses; Appointments (the bookings of the party's people, with links to the booking pages) for everyone, and Newsletters when their plugin is on.
- **FR-37** A user with `PORTAL_SETTINGS_MANAGE` can reorder, rename per language and hide areas per party kind and add links to a portal page, the organization's public site or an outside address.
- **FR-38** The portal home shows cards that loaded areas contribute for the active party (open quotations, orders in progress, deliveries on the way, unpaid total and overdue count, open requests for quotation with the nearest deadline, open tickets) and the party's latest updates, each opening its list.
- **FR-39** Other plugins register their areas, rights, home cards and pages; the shell gives them the active party, the member's rights and the portal layout, and hides an area whose plugin is off.

### 3.7 Document lists and pages

- **FR-40** Each list shows only documents of the active party in the states the document's source declares visible to parties (issued or confirmed, never internal drafts; the supplier's own drafts where the source says), newest first, 25 per page, with search by number and reference, filters by status and date, and export of the visible columns.
- **FR-41** The system shows statuses with the customer-facing labels and colours the source declares (for invoices: sent, viewed, partly paid, paid, overdue, credited).
- **FR-42** A document page renders the document with its portal print template when print templates are loaded, else, for invoices, estimates and payment receipts, the platform's existing document and, for other kinds, a read-only layout of the fields the source marks visible to parties, plus the custom fields staff chose for the portal per document kind, under the field rules of the portal user type.
- **FR-43** A document page offers the PDF of the document's default print template (else the platform's existing invoice, estimate and receipt PDFs), the attachments staff marked as shared with the party, and links to related documents of the same party along the document flow (quotation, order, deliveries, invoices, payments).
- **FR-44** The system records each view and download by a member on the document's timeline (who, when) and shows staff the first and last portal view.
- **FR-45** Every list keeps the member's own saved views, filters and column choices, separate from staff views.

### 3.8 Customer documents

- **FR-46** Quotations: a member with "accept quotations" accepts or declines a sent revision from its page under the online acceptance rules of `sales-order-management` (selections, signature, optional code, expiry, latest revision only), signed in as themselves instead of by link.
- **FR-47** Orders: the list shows status and ordered, delivered, invoiced and paid progress; the page shows lines, deliveries, invoices and payments, and the loyalty points earned and the party's balance when loyalty is on.
- **FR-48** Orders: a member with "pay" pays an order's due amount (deposit or prepayment) online when the organization has a payment provider, through the checkout of `payment-gateways`.
- **FR-49** Deliveries: the list shows each delivery and shipment with carrier, tracking number, status and expected arrival, links to its public tracking page, and offers a return request where self-service returns are on.
- **FR-50** Invoices: a member with "pay" selects one or more open invoices of the active party and pays them in one checkout, allocated as the pay page of `payments-and-collections` does; a member downloads the statement of account for a period.
- **FR-51** Payments: the list shows payments received with their allocation to invoices and the receipt; members with "pay" manage the party's saved payment methods where the provider supports them.
- **FR-52** A member with the right can ask a question about a document, which opens a ticket linked to it when the helpdesk is on, else emails the document's owner.

### 3.9 Supplier documents

- **FR-53** Requests for quotation: the list shows only requests the supplier was invited to, with deadline and state; the page shows lines, files and terms and lets a member with "answer" answer or decline per line under the rules of `procurement`, prices defaulting to the supplier's currency, read-only after the deadline.
- **FR-54** Supplier quotations: the list shows the supplier's quotations including their own drafts and withdrawn ones, and a member with "answer" withdraws a live one before the request closes.
- **FR-55** Purchase orders: the list shows published orders with state and confirmation; a member with "answer" confirms an order or proposes changes per line, sends shipping notices and confirms quantities delivered to customers, under the rules of `procurement`.
- **FR-56** Bills: a member with "create" starts a bill from a purchase order with the received (else ordered) open lines prefilled, adds their invoice number, date, amounts and file, and submits it to the bill capture of `invoicing-receivables-payables`, where it waits for staff review.
- **FR-57** Bills and payments: the lists show the supplier's submitted bills (received, in review, approved, refused with reason, paid) and the payments made to them with remittance details.

### 3.10 Projects, tasks and timesheets

- **FR-58** Projects: a member sees the projects whose client is the active party and where they are a stakeholder, with status, progress, next milestone, the published project updates and, when allowed to see files, the project's shared files.
- **FR-59** A project page lists its open tasks (searchable, filterable by status and priority) and a task page shows title, description, status, priority, due date and the task comments staff marked as shared with the client; a member adds comments that staff see on the task among its comments, marked as from the client.
- **FR-60** A member with "create tasks" raises a task on an accessible project (title, description, priority, wished date, attachments); it is created in the project's intake status marked "raised by client" and the project manager is notified.
- **FR-61** The member edits or withdraws their own task while it stays in the intake status, and sees status changes made by staff.
- **FR-62** A stakeholder asked to accept a reached milestone of the billing plan accepts or rejects it with a comment, which `project-costing-and-billing` records as the client's acceptance.
- **FR-63** Timesheets: a stakeholder allowed to see time sees the time logged on the party's projects per day or week, person and task, with approval state and the invoice that billed it, and totals; never rates, costs, screenshots or activity levels.

### 3.11 Addresses, profile and party details

- **FR-64** A member with "edit addresses" lists, adds, edits and removes the party's addresses (label, billing, shipping or both, lines, city, region, postal code, country, contact name, email, phone) and sets the default billing and shipping address in the platform's address book.
- **FR-65** The system never changes documents already issued when an address changes and keeps a removed address on the documents that used it.
- **FR-66** A person edits their name, phone, language and time zone (kept on their user, as for any user), changes their email after confirming the new address by code, and changes their password.
- **FR-67** An administrator edits the party's phone, website and logo; a change of legal name or tax number becomes a request that staff accept or decline.

### 3.12 Production progress

- **FR-68** An order made to order shows, when manufacturing is loaded, its open work orders with item, planned and produced quantity and material issued per item; closed work orders are not listed.

### 3.13 Notices, real time and activity

- **FR-69** Portal pages update within 5 seconds when a document of the active party is published, changes status or is paid, through the platform push channel.
- **FR-70** The system emails members notices the areas declare (quotation sent, order confirmed, shipped, invoice issued, payment received, request for quotation, purchase order published) in their language, per member preferences by area, and groups more than 5 notices within an hour into one digest.
- **FR-71** The portal home lists the party's last 50 updates visible to the member.
- **FR-72** The system records sign-ins, views, downloads, payments, acceptances, answers and member changes once, with the portal user as actor and the party, and the audit trail and the party's timeline both read that record.

### 3.14 Staff pages

- **FR-73** Customer and supplier pages get a Portal tab listing members, roles, state, last sign-in, invitations, sign-up requests and recent activity, with the actions of FR-18, FR-19, FR-21, FR-31 and FR-35; a person's page lists their memberships.
- **FR-74** A user with `PORTAL_ACCESS_MANAGE` sees a sign-up queue with matches and possible duplicates, and decides requests singly or in bulk.
- **FR-75** A user with `PORTAL_SETTINGS_MANAGE` sees per area which document kinds are shown, their visible states and labels, chooses the custom fields shown per document kind, and switches areas per organization or per party.

### 3.15 One portal for every outside role `(advanced)`

- **FR-76** The system lets other plugins register further party kinds and their areas (applicants of `recruitment`, learners of `learning-management`), so one person signs in once and switches between all their roles from the header. `(advanced)`
- **FR-77** Each role keeps its own menu, home, notices and rights; nothing of one role is visible from another. `(advanced)`

### 3.16 Portal assistant `(advanced)`

- **FR-78** With `FEATURE_PORTAL_ASSISTANT` and an AI provider of the tenant, a member can ask questions in their language about the active party's orders, deliveries, invoices, payments, quotations, requests for quotation, tickets and projects. `(advanced)`
- **FR-79** The assistant answers only from records the member may read in the portal, cites each record with a link and the facts used, says when it does not know, and refuses questions about other parties. `(advanced)`
- **FR-80** The assistant never acts: it proposes a portal action (pay, accept, raise a ticket) that the member confirms on the action's own page. `(advanced)`
- **FR-81** The member can hand over a conversation, which opens a ticket with the conversation when the helpdesk is on, else emails the account owner; conversations are the platform's AI conversations, each answer keeps sources and the member's feedback, its cost is in the platform's AI usage, and use counts against the organization's monthly AI budget for the portal. `(advanced)`

### 3.17 Shared approval of quotations `(advanced)`

- **FR-82** A member with "accept quotations" or "review quotations" can ask colleagues of the party to review a sent quotation, which starts one of the platform's approval requests naming the reviewers and how many approvals acceptance needs. `(advanced)`
- **FR-83** Reviewers comment on the quotation or a line and approve or object; comments reach the quotation's owner live and staff answer them as comments shared with the party. `(advanced)`
- **FR-84** Acceptance stays disabled until the approvals are reached, records the approvers with the signer in the acceptance certificate, and a new revision restarts the review. `(advanced)`

### 3.18 Supplier self-service onboarding `(advanced)`

- **FR-85** With `FEATURE_SUPPLIER_ONBOARDING`, a would-be supplier applies from the portal sign-up: company, tax number, address, categories, contacts and the documents the organization requires per category, each with its expiry date. `(advanced)`
- **FR-86** A user with `SUPPLIER_ONBOARDING_REVIEW` reviews applications with checks (duplicate tax number or name, missing required documents, expired documents), asks the applicant for changes or rejects with a reason. `(advanced)`
- **FR-87** Approving creates the supplier through `procurement` with its people as members, its documents as supplier documents and a supplier role, in one step. `(advanced)`
- **FR-88** When a supplier document nears its expiry, the supplier's administrators are asked 30 and 7 days before to upload a replacement in the portal, which staff accept to replace it. `(advanced)`

### 3.19 Reorder, own keys and live presence `(advanced)`

- **FR-89** A member with "create orders" starts a new order from a past order or chosen lines at today's prices and availability, reviews it, and submits it as an order request that staff confirm; items no longer sold are listed as unavailable. `(advanced)`
- **FR-90** An administrator creates keys for their own systems or AI agents, limited to the party's portal rights (read-only by default), with an expiry (default 90 days, at most 365) and a rate, shown once and revocable; calls are audited as the party. `(advanced)`
- **FR-91** Staff with a record open see live which portal members are viewing it. `(advanced)`

### 3.20 API, MCP and extension

- **FR-92** The system exposes every portal capability through REST routes for portal sessions and staff, with cursor paging and idempotency keys on paying, accepting, answering and creating routes.
- **FR-93** The system lets plugins register document sources: a record type, the paths to its party, the states visible to parties, customer-facing labels, visible fields, print template, actions with their rights, and notices.
- **FR-94** The system protects the portal routes of other plugins with one portal guard that resolves the party from the session only.
- **FR-95** MCP tools let staff list members, invite (preview first), suspend and revoke access, and read portal activity; party-scoped tools serve the portal assistant and the party's keys.
- **FR-96** The system publishes events for invitations, sign-ups, memberships, views, downloads and portal actions, carrying ids only, for webhooks, automations and real time.

### 3.21 Reports

- **FR-97** The system adds these reports to the platform's report catalogue in a "Portal" category, listed only for tenants with `FEATURE_CUSTOMER_PORTAL` on (with it off the catalogue and report menu show exactly today's entries), for users with `PORTAL_REPORTS_VIEW`, filterable by organization, party kind and period:

  | Report | Content |
  |---|---|
  | Portal adoption | parties and members invited, active and dormant, last sign-in, per party kind |
  | Portal activity | views, downloads, payments, acceptances, answers and tasks raised per area and period |
  | Invitations and sign-ups | sent, accepted, expired, approved, rejected, time to decide |
  | Payments from the portal | count and amount paid online per period and party |
  | Assistant | questions, answered, handed over, feedback and cost |
  | Supplier onboarding | applications by state, time to approve, documents expiring |

## 4. Non-Functional Requirements

- **Performance**: portal home first paint under 1.5 s; list routes under 300 ms at the 95th percentile at one million
  documents per tenant and 50,000 per party; sign-in under 500 ms excluding the password hash; live updates within 5 s;
  assistant answer within 10 s at the 95th percentile.
- **Volume**: 200,000 portal members per tenant, 5,000 concurrent portal sessions per API node.
- **Security & privacy**: the party is resolved from the session only; every portal route has a cross-party test; only
  fields a source marks visible to parties leave; rates, costs and internal comments never do; public routes are
  rate limited; passwords and tokens hashed. Leaving the platform: invitation, welcome, code, notice and digest emails
  to members; checkout data to the tenant's payment provider; assistant prompts to the tenant's AI provider.
- **Observability**: sign-ins, refusals, invitations, actions and assistant runs audited; metrics for sign-in outcomes,
  active members, notices sent and cross-party refusals.
- **Accessibility and localisation**: portal pages keyboard operable and screen-reader labelled; every string and
  email in the portal's languages; the member's language and time zone used for dates and amounts.
- **Compatibility**: PostgreSQL, MySQL and SQLite with both ORMs; cloud and self-hosted; without payment providers,
  print templates, helpdesk or manufacturing only their part is missing; OpenAPI additive; SDKs regenerated.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| Portal settings | An organization's portal address, languages, sign-in methods, sign-up and menu choices |
| Portal account | A person's contact login and their user of the portal type, linked from the person record |
| Portal member | A person's access to one party (customer, supplier or another registered kind) with its state |
| Membership role, portal right | The role of a person's membership in a party's company account, with the rights the organization gives it; one capability an area declares |
| Invitation, sign-up request | A platform invitation of the portal kind; a self sign-up waiting for confirmation or approval |
| Portal area, menu entry | A section of the portal a plugin registers; its place and label in the menu |
| Document source | A record type registered for party lists and pages, with visible states, fields and actions |
| Shared comment | A comment on a document, task or quotation that members and staff both see |
| Quotation review | An approval request of a quotation inside the customer's organisation |
| Supplier application | A would-be supplier's request with company details and documents |
| Assistant conversation | A member's AI conversation with sources and feedback |
| Party key | A key an administrator creates for the party's own systems |
| Party change request | A legal-name or tax-number change asked by an administrator |

## 6. Out of Scope

- User types, ceilings, sign-in policies, one-time codes, passkeys, keys and the audit trail: `access-control-and-security`.
- Help centre, ticket pages, satisfaction ratings and portal branding settings: `helpdesk-portal-and-knowledge-base`.
- Online acceptance rules and signatures: `sales-order-management`; answers, confirmations, shipping notices, supplier
  documents and scorecards: `procurement`; bill review: `invoicing-receivables-payables`; pay page, statements and
  allocation: `payments-and-collections`; checkout and saved methods: `payment-gateways`.
- Tracking page and return requests: `delivery-and-shipping`; stakeholders and billing plans: `project-costing-and-billing`;
  subscription self-service: `subscription-billing`; booking and breakdown requests: `maintenance-and-field-service`;
  applicant and learner pages: `recruitment`, `learning-management`; work orders: `shop-floor-and-work-orders`.
- Public sites: Ever Works; public forms:
  `lead-capture-and-enrichment`; newsletter preferences: `marketing-campaigns`; loyalty balances:
  `point-of-sale-and-loyalty`; organisations, people and the duplicate check: `crm-leads-and-deals`; email transport:
  `email-and-communications`; print templates: `print-and-pdf-designer`; approval requests: `approval-workflows`; AI
  conversations, runs and budgets: `ai-agents-and-assistants`.

## 7. Acceptance Criteria

- [ ] **AC-1** An invited person sets a password and sees only their party's documents; another party's document answers
      `404`; an internal route answers `403`; a guest is sent to sign in (FR-18, FR-20).
- [ ] **AC-2** Password, code, passkey and linked social sign-in work; lockout, rate limits and equal answers hold; a staff
      address is refused; suspension ends sessions within a minute (FR-6, FR-10, FR-11).
- [ ] **AC-3** Staff invitations, bulk invitations, resend, expiry and cancellation behave as FR-19 to FR-22 through the
      platform's invitations, and a portal invitation is refused by the workspace invitation flow; a request for
      quotation invites a supplier without access.
- [ ] **AC-4** Self sign-up confirms by code, matches existing people, waits for approval, creates an individual customer
      without a match, and flags duplicates (FR-24, FR-25).
- [ ] **AC-5** Membership roles limit areas and actions; an administrator invites, demotes and removes colleagues but never
      the last administrator; dated access ends by itself (FR-29, FR-31, FR-33).
- [ ] **AC-6** Quotations accept with signature through the sales rules; invoices pay in one checkout and show paid live;
      deliveries link to tracking; statements download (FR-46, FR-50).
- [ ] **AC-7** A supplier answers an invited request, confirms an order and submits a bill from it to review (FR-53, FR-55, FR-56).
- [ ] **AC-8** Stakeholders see tasks, updates and time without rates; a raised task lands in the intake status; a
      milestone acceptance is recorded (FR-58, FR-60, FR-61, FR-63).
- [ ] **AC-9** Addresses change in the address book without touching issued documents; profile and party changes behave
      as FR-66 and FR-67.
- [ ] **AC-10** Notices follow preferences and group into digests; pages update live; activity shows on the party's
      timeline and the audit trail (FR-69, FR-70, FR-72).
- [ ] **AC-11** One person switches between customer, supplier and applicant roles with separate menus (advanced:
      one portal) (FR-76, FR-77).
- [ ] **AC-12** The assistant answers with links from the party's records, refuses another party's, never acts and hands
      over to a ticket (advanced: assistant; FR-79, FR-80).
- [ ] **AC-13** Acceptance waits for the required approvals and lists the approvers (advanced: shared approval; FR-82–FR-84).
- [ ] **AC-14** An approved application becomes a supplier with members and documents; an expiring document asks the
      supplier for a replacement (advanced: onboarding; FR-86, FR-87).
- [ ] **AC-15** Reorder creates an order request at today's prices; a party key is limited to the party's rights; staff see
      live viewers (advanced: reorder, keys, presence; FR-89–FR-91).
- [ ] **AC-16** The reports of FR-97 show the expected rows for a seeded tenant.
- [ ] **AC-17** Works on PostgreSQL, MySQL and SQLite with both ORMs; behind `FEATURE_CUSTOMER_PORTAL`; public links unchanged
      while the flag is off; every functional requirement has a passing test (FR-2; §4).
- [ ] **AC-18** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-1, FR-4).

## 8. Open Questions

- A portal person is a user of the portal type whose secret is the existing contact login, so one person has one login
  for the portal and the existing customer sign-in of the commerce plugins. Default applied.
- An address already used by a staff user cannot get portal access; staff use the internal app. Default applied.
- Self sign-up is off and needs approval by default; sending a document invites its recipient only for requests for
  quotation. Defaults applied.
- Custom domains are served only where the deployment routes them to the application; the path address always works.
  Default applied.
- The portal does not switch on without access control, because its ceilings are the safety net. Default applied.

## 9. Constitution Gates

- [x] I Plugin-first — new plugin pair `customer-portal`, `customer-portal-ui`; core gains a portal route guard, an
      optional port, an invitation type and shared-comment columns only.
- [x] II Tenant/organization scoping — every portal record is scoped; party resolved from the session on every read.
- [x] III Both ORMs, additive migrations — new tables on three dialects; no existing column changed.
- [x] IV Default-off flag; nothing removed — deploy switch, `FEATURE_CUSTOMER_PORTAL`; public links unchanged.
- [x] V Contracts and API first — contracts, REST and the source and area registries before pages.
- [x] VI Permissions, privacy, security — staff permissions, portal rights within ceilings, cross-party tests, data leaving listed.
- [x] VII Real-time through the event bus — portal pages and staff presence through the push channel.
- [x] VIII i18n and accessibility — strings and emails per language; keyboard and screen-reader support.
- [x] IX Tests accompany the change — per requirement, cross-party suites, dialect and ORM parity.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Builds on: [`access-control-and-security`](../access-control-and-security/spec.md),
  [`record-views-and-search`](../record-views-and-search/spec.md), [`print-and-pdf-designer`](../print-and-pdf-designer/spec.md),
  [`email-and-communications`](../email-and-communications/spec.md), [`automation-and-notifications`](../automation-and-notifications/spec.md)
- Used by: [`sales-order-management`](../sales-order-management/spec.md), [`delivery-and-shipping`](../delivery-and-shipping/spec.md),
  [`invoicing-receivables-payables`](../invoicing-receivables-payables/spec.md), [`payments-and-collections`](../payments-and-collections/spec.md),
  [`procurement`](../procurement/spec.md), [`project-costing-and-billing`](../project-costing-and-billing/spec.md),
  [`subscription-billing`](../subscription-billing/spec.md), [`subcontracting`](../subcontracting/spec.md),
  [`maintenance-and-field-service`](../maintenance-and-field-service/spec.md), `helpdesk-portal-and-knowledge-base`
- Code: `packages/core/src/lib/{contact-credential,contact-buyer,organization-contact,organization-vendor,address,public-share,invite,comment,employee-appointment}/`,
  `packages/plugins/public-layout-ui/`, `packages/ui-react/`
