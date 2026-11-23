# Feature Specification: Sales order management

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `sales-order-management`
**Branch**: `feat/sales-order-management`
**Status**: `Draft`
**Created**: 2026-11-15
**Last updated**: 2026-11-23
**Owner**: platform maintainers
**Feature flag**: `FEATURE_ORDER` (existing, now read by every order route) and `FEATURE_SALES` (new, default off) for everything this spec adds; sub-features `FEATURE_ORDER_APPROVALS`, `FEATURE_B2B_CREDIT` (existing, default off, now read), `FEATURE_BLANKET_ORDERS`, `FEATURE_SALES_COMMISSIONS` (new, default off)

---

## 1. Overview

The `order` plugin already holds a complete order back end (lines, totals versions, changes, payment and fulfilment progress, approval, the bridge to invoices, a quote sent as an estimate) with no screen and no MCP tool. This feature turns it into the Sales app of the Angular app, the MCP server and the SDKs: **quotations** with revisions, optional and alternative lines and online acceptance; **sales orders** with schedules, reservations, back-to-back and drop-ship purchasing, proformas and line close; **credit control**; the **customer master** (sales profile, groups, item restrictions, overview); **territories, sales people, partners, targets and commissions**; **blanket orders**; and the selling reports. One owner for quotations: a quotation is an order that has not been agreed yet; the core estimate stays the issued, printable copy of each revision, and every existing estimate and order-quote route keeps its contract.

Advanced capabilities: one **document flow** from deal to payment with live status on every page; **credit control as an approval request** with the facts to decide, never a silent block; **promise dates computed** from stock, supply, supplier lead times and production capacity, with the reason shown; **commissions** with plans, splits, accrual and payout statements; **quotations signed and accepted online** with options the customer chooses; **service lines sold as tracked time or milestones** that create project work and are delivered by tracked time; and **agents** that draft a quotation from an email, propose substitutions and explain a margin, always with a preview.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** a salesperson with `SALES_QUOTATIONS_EDIT` on a lead's page, **when** they create a quotation, add three items (prices filled from the lead's price list, tax from the tax engine), mark a fourth line optional and two lines as alternatives, and send it, **then** revision 1 is frozen, its PDF is issued, the lead receives an email with a link, and the quotation shows `sent` with a validity date 30 days ahead.
- **Given** that link, **when** the customer opens it, ticks the optional line, picks the second alternative, types their name and draws a signature, **then** totals are recalculated as they choose, the acceptance is recorded with the signature and a fingerprint of what they accepted, the lead becomes a customer, an order is placed with exactly the chosen lines, the deal is won, and the salesperson sees "accepted" live.
- **Given** a sent quotation, **when** the salesperson starts revision 2, **then** the customer's link says the offer is being revised; **when** revision 2 is sent, **then** revision 1 is superseded and only revision 2 can be accepted.
- **Given** a quotation the customer turned down, **when** the salesperson marks it lost with the reasons "price" and "timing" and the alternative the customer chose, **then** every revision is lost and the lost-quotations report counts it.
- **Given** a confirmed order with a line short of stock, **when** the order page loads, **then** the line shows its promise date and why ("purchase order PO-118 arriving 2 December"), and the owner is told in the Inbox when that date later moves past the requested date.
- **Given** an order whose customer would exceed their credit limit, **when** it is placed, **then** it is held for credit, the holders of the credit release permission receive an approval request with the exposure, overdue invoices and payment history, and **when** they release it once, **then** the order continues to confirmation and the timeline records the decision.
- **Given** a confirmed order, **when** a user creates purchase orders from two drop-ship lines, **then** one purchase order per supplier is drafted with the customer's shipping address, and both documents appear in the document flow.
- **Given** a confirmed order with a service line of 40 hours sold as tracked time, **when** it is confirmed, **then** a project task with a 40-hour estimate exists, and **when** 12 hours are tracked on it, **then** the line shows 12 hours delivered and can be invoiced for them.
- **Given** commission plans and a sales team split 60/40 on an order, **when** the order is invoiced and paid, **then** each person's entries become earned, and **when** the month's statements are generated and approved, **then** each person sees their own statement and the payout is requested.
- **Given** an agent connected through MCP, **when** it calls the "draft quotation from email" tool with an email text and `preview: true`, **then** it receives the matched party, items, quantities and unmatched lines without anything being written; called without preview, a draft quotation exists.

### 2.2 Edge cases & failures

- **Given** a user without `SALES_QUOTATIONS_EDIT`, **when** they call a quotation write route, **then** `403`; with `FEATURE_SALES` off every new route answers `404` and the menu hides the Sales app.
- **Given** a customer and a salesperson answering the same revision at once (accept and decline), **then** exactly one answer is recorded and the other is told the quotation was already answered.
- **Given** an expired quotation, **when** the customer tries to accept online, **then** they are told it expired and whom to contact; a user may still convert it only where the organization allows ordering from expired quotations.
- **Given** an estimate issued by an order quote before this feature was on, **when** the customer accepts it through the old estimate link, **then** the quotation is accepted and the order placed; the estimate is not converted, and where the organization converts accepted estimates the order is invoiced once instead; the link keeps answering as long as it did before, since such quotations carry no validity date.
- **Given** two users editing the same order, **when** the second saves a version older than the current one, **then** `409` with the current version; nothing is overwritten.
- **Given** an order change that lowers a line below its delivered quantity, **then** it is refused with the delivered quantity named; removing an invoiced line is refused.
- **Given** a blocked customer, **when** anyone creates a quotation, order, delivery or invoice for them, **then** it is refused with the block reason; at the block's release date the customer is unblocked by the daily job.
- **Given** a blanket order with 1,000 units agreed and a 5% allowance, **when** a call-off would bring the ordered quantity to 1,060, **then** it is refused, naming the 1,050 limit.
- **Given** reservations requested for 500 items when 300 are available and partial reservation is off, **then** nothing is reserved and the line explains the shortfall; with it on, 300 are reserved and 200 stay open.
- **Given** a batch of 40 orders invoiced in bulk, **when** 3 fail (held, closed, nothing to invoice), **then** 37 invoices exist and the result lists the 3 with their reasons.
- **Given** a closed accounting period, **when** a commission statement dated in it is approved, **then** the statement is approved and its posting is dated in the first open period by `accounting`'s period rule.
- **Given** the email transport is down, **when** a quotation is sent, **then** the revision is still issued and the quotation says the email failed, with a "send again" action.

## 3. Functional Requirements

### 3.1 Presence and the Sales app

- **FR-1** The system MUST answer every order route with `404` when `FEATURE_ORDER` is off for the tenant, and every route this spec adds with `404` when `FEATURE_SALES` or the route's sub-feature is off; menus hide what is off.
- **FR-2** With `FEATURE_SALES` off nothing this spec adds MUST be observable: no menu, screen, MCP tool, job effect or event, and the order, cart, estimate and invoice APIs answer exactly as before.
- **FR-3** A user with `ORDERS_VIEW` can open Sales → Orders: saved-view lists (list, board by status, calendar by promise date) filtered by status, customer, sales person, territory, dates and delivery, invoice and payment progress.
- **FR-4** The order page MUST show header, addresses, lines with reserved, picked, delivered, invoiced and returned quantities, totals and their versions, timeline, payments, credit lines, the open change, approvals and the flow.
- **FR-5** A user with `ORDERS_CREATE` can create an order for a customer in the app: a draft priced by price resolution and taxed by the tax engine, placed with "Place".
- **FR-6** The system MUST email the customer an order confirmation with the order PDF when an order placed in the Sales app is confirmed, unless the order or the customer opts out; orders from checkout and the other sources that exist today get the email only where the organization or channel switches it on (setting, default off), so their customers receive what they receive today; a user can send it again.
- **FR-7** Default print templates MUST exist for quotation, order confirmation, proforma and a customer's open-order statement, rendered by the print designer in the customer's language.

### 3.2 Quotations: one owner

- **FR-8** A quotation MUST be an order not yet agreed: a draft order with a quotation record (number from the `quotation` series, status, validity, revisions). It is the only owner of quotations; the core estimate is the issued copy of a revision (FR-14) and the answer channel of older links (FR-29).
- **FR-9** A user with `SALES_QUOTATIONS_EDIT` can create a quotation for a contact of type lead, customer or client; an archived or blocked contact is refused; the party's name, email and addresses are copied onto the quotation.
- **FR-10** A quotation can start blank, from a deal (linked, `crm-leads-and-deals`), from a customer, as a copy of another quotation, from a quotation marked as template, or from a standalone estimate (FR-31); it carries the campaign attribution (source, channel, campaign) of its deal, lead or web visit.
- **FR-11** Quotation lines MUST follow order-line rules: items priced by price resolution, units, quantity, line discount (percent or amount), tax from the tax engine, sections and notes, a document discount, a coupon code, a shipping charge from the shipping rules (`delivery-and-shipping`), payment term, delivery terms and terms text.
- **FR-12** A line MAY be optional (offered, not in totals until selected) or belong to an alternative group (exactly one line of the group counts, the preferred one by default); totals show the base offer and the offer with every option.
- **FR-13** A quotation MUST carry a validity date defaulting to the organization's validity days; a daily job marks a sent quotation expired when its validity passed without acceptance, and tells its owner.
- **FR-14** Sending MUST freeze the lines, selections and totals as revision N with a content fingerprint, issue the estimate copy and its PDF, email the recipient a link to the online page, and mark any earlier sent revision superseded. A failed email leaves the revision issued and says so.
- **FR-15** Starting a revision MUST withdraw the sent revision from online acceptance until the next one is sent; a lost or accepted quotation cannot be revised (an accepted one changes through order changes); an expired one can.
- **FR-16** A user can compare two revisions: lines added, removed or changed, and the difference in totals.
- **FR-17** When a quotation's total or largest line discount exceeds the organization's thresholds, sending MUST first obtain approval through a platform approval request; the quotation shows who must decide.
- **FR-18** A user can mark a sent, viewed, declined or expired quotation lost with one or more lost reasons, optional chosen alternatives and a note; all its revisions become lost; refused once accepted; the deal is told.
- **FR-19** The lost reasons and the chosen alternatives of a quotation MUST be the organization's lists of `crm-leads-and-deals` (lost reasons and chosen alternatives, maintained there by `CRM_SETTINGS_EDIT`), shared by deals and quotations: reasons that apply to deals apply to quotations; an inactive reason cannot be chosen; a reason in use can be deactivated, not deleted. Without that feature a quotation is marked lost with a note only.
- **FR-20** Quotations and orders MAY recur on a schedule through the document engine's recurrence; each occurrence is a new draft linked to its origin.

### 3.3 Online acceptance

- **FR-21** (advanced) The online quotation page (token link, no sign-in) MUST show the revision with the organization's branding, lines, options, alternatives and totals, recalculate totals on the server as the customer chooses, and record views (first, last, count), shown live to the owner.
- **FR-22** (advanced) The customer can accept with their selections by typing their name and drawing or typing a signature; the system records signer, email, time, network address, client, signature image and the fingerprint of revision plus selections, and adds an acceptance certificate page to the PDF. Where the organization requires it, a one-time code sent to the recipient address must be entered first.
- **FR-23** (advanced) The customer can decline with a reason, or ask a question that reaches the owner's Inbox as a comment on the quotation; the owner's reply is emailed back with the link.
- **FR-24** Links MUST be revocable, expire with the quotation, and be rate limited; a revoked or unknown token answers "not found" without telling which.
- **FR-25** Accepting (online, or recorded by a user with `SALES_QUOTATIONS_EDIT` with a note or an uploaded signed copy) MUST check that the revision is the latest sent and unchanged, keep only the selected lines on the draft, recompute totals and place the order, which then passes approval, credit control and payment like any order. A quotation with no stocked line MAY be accepted and invoiced in one step.
- **FR-26** Online acceptance of an expired quotation MUST be refused; a user may convert it only where the organization allows ordering from expired quotations, and the order records that it did.
- **FR-27** When the party is a lead, placing the order MUST turn the contact into a customer (same record), recorded on its timeline; missing data the documents require (billing address, tax number where the tax engine needs one) is listed for the user to complete first.
- **FR-28** A revision MUST hold one answer: of concurrent answers the first is kept, the second is told.

### 3.4 Routing the core estimate

- **FR-29** The estimate API and Accounting → Estimates MUST keep working unchanged for standalone estimates; an estimate that is a quotation's issued copy shows the quotation number and opens the quotation.
- **FR-30** An answer to an issued copy through the existing estimate email link MUST be applied to the quotation (acceptance with unchanged selections, or decline). The estimate itself is not converted; where the organization's "convert accepted estimates" setting is on, the accepted quotation's order is invoiced at once instead, so the organization still gets one invoice on acceptance, linked to the order.
- **FR-31** A user with `SALES_QUOTATIONS_EDIT` and `ESTIMATES_VIEW` can convert a standalone estimate into a quotation: items with a product become item lines, others priced text lines; the estimate becomes revision 0, superseded.
- **FR-32** The order quote routes (send, accept, decline) MUST keep their contracts and act on the quotation: send issues a revision, accept accepts the latest revision with unchanged selections, decline declines it.

### 3.5 Sales orders

- **FR-33** An order MUST carry customer, buyer reference and its date, order date, requested date (header and line), billing and shipping address from the address book, dispatch warehouse per line, payment term, delivery terms and named place, project and analytic dimensions, sales team and partner, channel and currency.
- **FR-34** A buyer reference already used on a live order of the same customer MUST be accepted as today, warned, or refused, per the organization setting (default: accepted, with a warning in the Sales app).
- **FR-35** A requested date before the order date and a buyer reference date after it MUST be refused; a shippable line without a requested date takes the order's requested date, else the order date, and is refused only where the organization requires a requested date (setting, default off).
- **FR-36** The order MUST show reserved, picked, delivered, invoiced, paid and returned progress per line and as percentages, with saved views "to deliver", "to invoice" and "to deliver and invoice".
- **FR-37** A user with `ORDERS_EDIT` can hold a confirmed order with a reason and optional release date (no new delivery, reservation or invoice while held) and resume it; resuming runs credit control again (FR-68).
- **FR-38** A user can close the remaining quantity of a line or of the order, which releases its reservations and lets the order complete; a closed line can be reopened until the order is archived.
- **FR-39** Lines that need no shipping and are not tracked service lines MUST count as delivered at confirmation.
- **FR-40** Changing a confirmed order MUST go through an order change: quantity, price, date, added or removed lines. A quantity below what is delivered, invoiced, picked or bought for the line is refused; a delivered, invoiced, purchased or production-requested line cannot be removed; changes are refused on held, closed, completed or cancelled orders; a price change needs `SALES_PRICE_OVERRIDE` only where the organization restricts price edits (setting, default off), otherwise `ORDERS_EDIT` as today; reservations follow the new quantities.
- **FR-41** A user can split a line into dated portions, by hand or generated from a first date, an interval and a count; the portions cannot exceed the line quantity; the line promise is the earliest open portion; deliveries can be created for the portions due by a date.
- **FR-42** A user can request an advance (percent or amount) as a payment request (`payments-and-collections`); the order shows the advance as not requested, requested, partly paid or paid from its payment ledger.
- **FR-43** From an order a user can create a delivery (`delivery-and-shipping`), an invoice by ordered or delivered quantities per the item's billing policy or by amount, a payment request, a project (FR-95), a maintenance plan (`maintenance-and-field-service`), a requisition (FR-59), purchase orders (FR-57) and a production request (FR-60); each result joins the document flow. Bulk creation over a selection reports a result per order.
- **FR-44** An invoice from an order MUST exclude quantities already invoiced, returned or credited and refuse quantities beyond the order's tolerance.
- **FR-45** A user with `ORDERS_EDIT` can issue a proforma for an order (remaining lines, chosen lines or an amount; quantities optionally hidden), numbered from the `proforma` series of the document engine (`business-document-engine`, which must be on), as a PDF, emailed, with sent date and recipient recorded; a proforma never creates a receivable or a posting; cancelling it changes nothing else.
- **FR-46** A user can print or email a customer's open-order statement (open lines, promised dates, values).
- **FR-47** Routing a placed order to approval by value MUST be read under `FEATURE_ORDER_APPROVALS` and the organization threshold; approvers come from the approval engine's default definition for sales orders. The existing request-approval route and the approve route (which confirms a placed order) keep answering under `FEATURE_ORDER` as today, whatever `FEATURE_ORDER_APPROVALS` says.

### 3.6 Line entry, guards, bundles and units

- **FR-48** Entering an item MUST fill price, currency and unit conversion, discount and free items from price resolution (`pricing-and-promotions`), tax from the tax engine, description and warehouse (line, then customer, then item default); holders of `SALES_MARGIN_VIEW` also see unit cost and margin per line and in total.
- **FR-49** Each line MUST show stock at its warehouse and across the organization: on hand, reserved, available, incoming and projected, with a warning when short.
- **FR-50** Entry guards (returns and claims excepted): a discount above the item's or organization's maximum, a price below the minimum (price-list guard rails; cost or last purchase price where the setting is on) without `SALES_PRICE_OVERRIDE`, a zero quantity or negative price where not allowed, a price list not valid for the ship-to region, and an item outside the party's allowed items (FR-75) MUST be refused; the same item twice is warned or refused per setting.
- **FR-51** A bundle item MUST expand into its components (definition in `item-catalogue`) for availability, reservation, picking and delivery while its price stays on the bundle line; the bundle price is editable only where the setting allows.
- **FR-52** A line MAY be entered in a sales unit; the stock-unit quantity follows the item's conversion and is editable only where the setting allows.
- **FR-53** Lines MUST show and print the customer's own item code when one exists (`item-catalogue` owns the codes).

### 3.7 Reservation, purchasing and production

- **FR-54** With the setting on, confirming an order MUST request reservations for its stocked lines from the reservation engine (`warehouse-and-stock-movements`); otherwise a user requests them per line (warehouse, quantity, lots or serials where tracked); partial reservation follows the setting.
- **FR-55** A user can release a line's reservation; cancelling, closing or reducing a line MUST release what is no longer needed; drop-ship, service and customer-material lines are never reserved; bundles reserve per component.
- **FR-56** Goods of an open order line that come back on a return MAY be reserved again for it (setting).
- **FR-57** A user with `ORDERS_EDIT` and `PURCHASE_ORDERS_CREATE` can create purchase orders from chosen lines, one per supplier (the item's preferred supplier or one chosen), for the quantity not yet requested or ordered, in the supplier's currency, price and terms (`procurement`); both sides link line to line.
- **FR-58** A line marked "delivered by supplier" names a supplier: it is not reserved or delivered from stock, its purchase order is flagged drop-ship with the customer's address, and its delivered quantity follows the supplier's confirmed delivery; the supplier can change until the purchase order is sent.
- **FR-59** A user can raise a requisition for short lines, for the shortfall net of open requisitions and purchase orders (`procurement` owns requisitions).
- **FR-60** A user can request production for chosen lines; with manufacturing installed this creates the production documents (`production-planning`), and the line shows planned and produced quantities.
- **FR-61** A user can create a pick list for an order's due lines (`warehouse-and-stock-movements`); the order shows its picked percentage and picking beyond 100% is refused.
- **FR-62** A contact MAY be internal, representing another organization of the tenant (one per represented organization); confirming an order to it MUST draft a purchase order in that organization, linked both ways; cancelling either side flags the other for review.

### 3.8 Credit control and blocking

- **FR-63** The credit limit MUST resolve to the contact's limit when set, else the nearest customer group's up the tree, else the organization default; with none set, credit control does not apply; zero means every on-account order needs approval. Credit control runs only where the organization has set a credit check stage (order or delivery; default none), so limits already stored on contacts hold no order until the organization chooses to check them.
- **FR-64** Exposure MUST be open receivables (when invoicing is on) plus confirmed orders not yet invoiced other than this order, plus this order's uninvoiced amount once, in organization currency; at a delivery check, when this order is already confirmed and uninvoiced, it is counted once (a 60 order against a 100 limit with no other exposure is 60); an order paid in full at checkout is not checked.
- **FR-65** A second check MUST compare overdue receivables with the party's overdue threshold (contact, group, organization default).
- **FR-66** (advanced) An order failing a check MUST be placed and held for credit, never refused silently: an approval request goes to holders of `SALES_CREDIT_RELEASE` with the exposure, overdue items, payment history and the order; the salesperson sees the hold, the reason and who decides.
- **FR-67** (advanced) The approver can release the order once, raise the party's limit (`CONTACT_CREDITS_EDIT`), ask for an advance (the order is released when it is paid) or reject (the order stays held until cancelled); every decision is in the order timeline and the party's credit history, one history with the invoice credit reviews of `invoicing-receivables-payables`.
- **FR-68** Credit control MUST run again when a held order resumes, when a change raises its value, and, for parties checked at delivery, when a delivery is created instead of at placement.
- **FR-69** A blocked contact MUST be refused for new quotations, orders, deliveries and invoices with the reason; a block MAY stop only some of these (ordering, deliveries, invoicing, payments to the party) and MAY carry a release date at which a daily job lifts it; who blocked and why is recorded. Customer blocks and supplier holds are one platform record (`procurement`).
- **FR-70** With `FEATURE_B2B_CREDIT` on, an order placed by a company's buyer MUST respect the buyer's per-order and per-period spending limits: above the approval threshold an approval request goes to the company's approver buyers; above the limit the order is refused.

### 3.9 Customers and groups

- **FR-71** Sales → Customers MUST open the existing contact page with its existing fields, the commerce fields stored on it today (channel, status, price list, tax exemption, category, regime and number, credit limit and use, payment term, currency, default addresses, marketing consent), its address book with roles, a company's buyers, and the sales profile; customers MAY be numbered from a `customer` series (setting).
- **FR-72** The sales profile MUST hold territory, account manager, default team and partner, commission plan, delivery terms, required document chain, credit check stage (order, delivery, none), overdue threshold, our supplier number at the customer and the internal flag; each value not set comes from the group, then the organization.
- **FR-73** Customer groups MUST form a tree; besides price list and discount (existing) a group holds default payment term, territory, credit limit and overdue threshold for members that set none; moving a customer re-resolves the inherited values and re-checks its held orders.
- **FR-74** Industry and market segment MUST be tag types on contacts, usable as filters and report dimensions.
- **FR-75** A user with `SALES_CUSTOMERS_EDIT` can restrict what a customer or group may buy with an allow list or a deny list of items, categories or tags; entry enforces it (FR-50).
- **FR-76** The customer overview MUST answer, for a chosen period: how much the customer bought and how that moves; what is in progress (quotations, orders, deliveries and invoices to raise); how much credit is used and left; what they owe and how late they pay (only to `INVOICES_VIEW` holders, when invoicing is on); the hours tracked and projects run for them where projects exist; and their latest documents of each kind.
- **FR-77** A delivery for a customer requiring an order MUST be refused without one; an invoice for a customer requiring a delivery MUST be refused for undelivered goods.

### 3.10 Territories, sales people, partners and targets

- **FR-78** A user with `SALES_TEAMS_EDIT` can maintain a territory tree (group and leaf territories, each optionally served by an organization team whose managers manage it), used on customers, quotations, orders, pricing rules and reports.
- **FR-79** A sales person MUST be one employee (an employee is at most one sales person), with a default commission plan and an enabled flag; sales people are grouped by the organization's teams; disabling a person who owns open quotations or orders requires reassigning them first (the system lists them).
- **FR-80** A sales partner MUST be a contact with a partner profile: type, territory, commission plan, unique referral code and optional public profile (logo, description, website) in the organization's public partner list (a public read feed); a referral code on a quotation or order, or carried from a web visit, sets its partner.
- **FR-81** Quotations and orders MUST carry a sales team: people with shares summing to 100%, no disabled or repeated person; defaulted from the customer's default team; frozen at confirmation.
- **FR-82** Targets MUST be set per territory, sales person or partner and fiscal period, optionally per item category, as amount or quantity, spread over months by monthly weights (even, or weights summing to 100); attainment counts confirmed orders or invoices (setting) net of returns and shows as the progress of a goal KPI in Goals.

### 3.11 Commissions

- **FR-83** (advanced) A commission plan MUST define a base rate, optional tiers (by target attainment or by amount bands in the period), per-category overrides, the earning event (order confirmed, invoiced or paid) and whether returns and credit notes claw back.
- **FR-84** (advanced) Each commissionable line of a confirmed order MUST accrue one entry per team member and partner (share × rate × commissionable amount), frozen at confirmation; an entry is earned at the plan's event, reduced by returns and credits where clawback applies, and reversed by cancellation.
- **FR-85** (advanced) A user with `SALES_COMMISSIONS_EDIT` can generate payout statements per person and period from earned entries; a statement is approved (`SALES_COMMISSIONS_APPROVE`), paid (a party payout through the organization's payment provider, or a pay element handed to payroll when payroll is on), printed, and visible to the person as their own statement.
- **FR-86** (advanced) Accrued, earned and paid commission MUST be published as document events so that `accounting`, when on, posts them; with it off, statements work the same.
- **FR-87** Commission rates MUST be 0–100%; a line can be made not commissionable; the commissionable amount and the total commission show on the order to holders of `SALES_COMMISSIONS_VIEW`.

### 3.12 Blanket orders

- **FR-88** With `FEATURE_BLANKET_ORDERS` on, a user can record a blanket order with a customer (validity period, currency, price list, lines with agreed price and quantity); it is numbered, confirmed, active until it expires or is closed, and can be reopened before expiry.
- **FR-89** A quotation or order line MAY call off a blanket line: it takes the agreed price and raises the ordered quantity; beyond the agreed quantity plus the organization allowance it is refused; a cancelled or reduced call-off gives the quantity back.

### 3.13 Delivery terms and settings

- **FR-90** Delivery terms MUST be a per-organization list seeded with the standard international trade-term codes and editable; quotations, orders, deliveries and purchase documents carry a code and a named place, printed.
- **FR-91** Sales settings per organization MUST hold every default and rule this spec names (validity, ordering from expired quotations, buyer-reference uniqueness, required requested date, duplicate items, zero quantity, negative prices, price edit, bundle price, stock-unit edit, reservation on confirm, partial reservation, blanket allowance, credit stage, required document chain, confirmation emails for existing order sources, earning event, approval thresholds, signature code, proforma template), changed only with `SALES_SETTINGS_EDIT` and audited. Every rule that refuses, holds or requires something defaults to what the order plugin accepts today, so no existing order path is refused until an organization tightens it.

### 3.14 Document flow, promise dates, service lines

- **FR-92** (advanced) Quotation, order, delivery, invoice and payment pages MUST show the document flow from the deal to the last payment or return: each linked document with number, status, amount and progress, updated live; a user sees the documents they may read and a count of the others.
- **FR-93** (advanced) A line's promise date MUST be computed on entry and again when stock or supply changes: from available stock (plus pick and dispatch days), else incoming purchase orders and transfers, else the preferred supplier's lead time, else production capacity when manufacturing is installed; the reason is shown with the date. The computed date is the line's promised date; on a confirmed order every move is recorded as an order change in the order's history.
- **FR-94** (advanced) When a promise moves past the requested date, the order owner MUST get an Inbox notice and the order joins the "at risk" view; the customer is told only when a user chooses to.
- **FR-95** (advanced) A service line MAY be sold as tracked time or as milestones: confirmation creates or links a project with a task per line (estimate = hours) or per milestone; tracked time on the task, or the milestone's completion, becomes the line's delivered quantity, which invoicing follows (`project-costing-and-billing` owns rates).

### 3.15 Agents, automation and real time

- **FR-96** (advanced) MCP tools MUST cover quotations, orders, customers, blanket orders and commissions under the API's permissions; every tool that sends, places, confirms, cancels or approves takes `preview: true`.
- **FR-97** (advanced) An agent can draft a quotation from an email or message: the tool returns the matched party, items, quantities, requested date and the unmatched text with a confidence per line, and writes a draft only when called without preview.
- **FR-98** (advanced) An agent can propose substitutions for short or restricted lines (alternative items with availability, price and margin difference) and explain the margin of an order or quotation (cost basis, discounts, promotions and price-list effects per line) as text and a structured breakdown.
- **FR-99** Quotation, order, credit and commission events MUST be available to automation rules and outbound webhooks.
- **FR-100** Lists and pages of quotations, orders, customers and statements MUST update live through the real-time channel, with a refresh fallback.

### 3.16 Reports

- **FR-101** The system MUST register the report definitions below with the report builder, filterable by organization, period, customer, group, territory, sales person, partner, item and category, exportable, and respecting permissions (margins only with `SALES_MARGIN_VIEW`).
- **FR-102** The Sales dashboard MUST show cards (open quotation value, quotation win rate over 90 days, open order value, late lines, credit holds open, commission earned this month) and charts (confirmed order value by week, top customers by margin, promise reliability), each a report definition.

| Report | Question it answers |
|---|---|
| Address list by party | Every address and person of chosen customers, suppliers or partners |
| Stock of bundle components | Which bundle components can be packed from stock now |
| New and repeat customers | New versus repeat customers and their sales by period and territory |
| Credit used and available per customer | Limit, exposure, overdue and available credit per customer |
| Prices per customer and item | What each customer pays per item: list, rule, last price |
| Contacts with no order yet | Customers with no order at all |
| Contacts with no order in a period | Customers with no order or invoice for N days |
| Sold lines | Every sold line: item, customer, price, date |
| Lost quotations by reason | Lost quotations grouped by reason or chosen alternative |
| Order instalments | Instalments of orders: paid, due, overdue, next due |
| Order lines short of stock | Order lines short of stock with no requisition or purchase order |
| Quotation and order value over time | Value by period, grouped by any dimension |
| Sales by dimension | Value or quantity per item, category, customer, group, territory, person, project over time |
| Orders to deliver and invoice | Open quantities and amounts, with days late |
| Commission per person and partner | Commission per person or partner: accrued, earned, paid |
| Targets against achieved sales | Target versus achieved per territory, person or partner and month |
| Sales per person and partner | What each person's or partner's share of documents amounted to |
| Value per territory and stage | Quotation, order and invoice value per territory |
| Quotation outcomes by source and owner | Quotations sent, accepted, lost, expired, by source and owner |

## 4. Non-Functional Requirements

- **Performance**: order and quotation lists P95 < 300 ms at 1 M orders per tenant; online totals recalculation P95 < 500 ms for 200 lines; credit check P95 < 200 ms; promise dates for 50 lines P95 < 400 ms; document flow P95 < 400 ms for chains of 200 documents; placing an order P95 < 500 ms excluding asynchronous postings; reports over more than 10 M lines served from maintained sales facts, refreshed within 1 minute of a change.
- **Volume**: 20 M order lines and 2 M quotations per tenant; 10,000 commission entries per statement run.
- **Concurrency**: every write states the version it read (`If-Match`); answers to a revision, call-offs on a blanket line and reservation requests are single-winner; bulk actions report per row.
- **Reliability**: events through the event outbox (at least once, deduplicated per consumer); jobs (expiry, unblock, promise refresh, commission earning) are idempotent and catch up after downtime.
- **Security & privacy**: tenant and organization scoped; public links carry a random token stored hashed; signatures and network addresses are personal data, exported and erased with the contact; leaving the platform: quotation, confirmation, proforma and statement emails to the addresses users choose.
- **Auditability**: who, when, before and after for every change to a sent quotation, a confirmed order, a credit decision, a profile, a plan and a statement.
- **Accessibility and localization**: keyboard operable, screen-reader labels, a typed alternative to the drawn signature; every string in all shipped locales; documents in the customer's language and currency.
- **Compatibility**: PostgreSQL, MySQL, SQLite; both ORMs; cloud and self-hosted; OpenAPI and SDKs regenerated.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| --- | --- |
| Quotation | An order not yet agreed, with its own number, validity, status and revisions |
| Quotation revision | A frozen offer: lines, selections, totals, fingerprint, issued copy, answer and signature |
| Issued copy | The core estimate created for a revision: PDF, finance lists, older answer links |
| Lost reason | An organization's reason for losing a quotation |
| Order / order line | Existing records, extended with requested dates, options, supplier, service mode, unit, team |
| Delivery schedule portion | A dated part of a line's quantity |
| Proforma | A numbered, printable request for payment with no ledger effect |
| Sales profile | Sales defaults of a contact, a customer group or the organization |
| Item restriction | Which items a customer or group may or may not buy |
| Territory, sales person, sales partner | Selling structure trees and the partner profile of a contact |
| Sales team share | A person's share of a document |
| Target, monthly weights | A goal per period and its spread over months |
| Commission plan, entry, statement | Rules, the per-line accrual, the payout document |
| Blanket order | An agreement of prices and quantities called off by orders |
| Delivery terms | Trade-term code and named place |
| Credit hold | An order held for credit, with its approval request |
| Promise | A computed date with its reason |

## 6. Out of Scope

- Deliveries, packing, shipping rules and charges, sales returns → `delivery-and-shipping`.
- Invoices, credit notes, receivables and ageing → `invoicing-receivables-payables`; payments and payment requests → `payments-and-collections`.
- Price lists, pricing rules, promotions, coupons and guard-rail definitions → `pricing-and-promotions`; tax → `tax-engine`.
- The reservation engine, pick lists and bins → `warehouse-and-stock-movements`.
- Purchase orders, requisitions, supplier quotations, purchase-side blanket orders and supplier item restrictions → `procurement`.
- Production documents → `production-planning`; inward subcontracting for customers → `subcontracting`.
- Leads, deals, deal stages, the lead and deal funnel → `crm-leads-and-deals`, `crm-forecasting-and-analytics`.
- Numbering series, lifecycle, links, tolerances and recurrence → `business-document-engine`; approval routing → `approval-workflows`; print designer → `print-and-pdf-designer`; report builder → `report-builder-and-dashboards`.
- Party types and party ledger accounts → `general-ledger`; customer item codes, bundles and units → `item-catalogue`; project billing rates → `project-costing-and-billing`.
- Portal pages listing a customer's documents → `customer-and-supplier-portal`; lost reason and chosen alternative lists → `crm-leads-and-deals`.

## 7. Acceptance Criteria

- [ ] **AC-1** On a fresh tenant with `FEATURE_SALES` on, a user creates a quotation for a lead, sends it, accepts it online with an option and an alternative chosen and a signature, and sees an order with exactly those lines, the lead turned customer and the acceptance certificate in the PDF (advanced: online acceptance; FR-13, FR-21, FR-22).
- [ ] **AC-2** Revision 2 supersedes revision 1; revision 1's link refuses acceptance; the revision diff lists changes (FR-14–FR-16, FR-28).
- [ ] **AC-3** An estimate issued as a quotation's copy and answered through the existing estimate link places the order; the estimate itself is not converted, so with the organization's "convert accepted estimates" setting off no invoice is created and with it on the order is invoiced once; a standalone estimate answered through its link is converted as today (FR-29, FR-30).
- [ ] **AC-4** Order quote routes and estimate routes answer with unchanged contracts (contract tests green) (FR-29, FR-32).
- [ ] **AC-5** A lost quotation with two reasons appears in "Lost quotations by reason" grouped by reason (FR-18, FR-19).
- [ ] **AC-6** An order over the credit limit is held, an approval request carries the exposure, a one-time release confirms the order, and both appear in the timeline (advanced: credit control; FR-66, FR-67).
- [ ] **AC-7** A blocked customer is refused for a quotation, an order and a delivery; the release date lifts the block (FR-69).
- [ ] **AC-8** A line short of stock shows a promise from an incoming purchase order with the reason; moving that purchase order's date past the requested date sends the owner an Inbox notice (advanced: promise dates; FR-93, FR-94).
- [ ] **AC-9** Back-to-back and drop-ship lines create one purchase order per supplier, linked line to line (FR-57, FR-58).
- [ ] **AC-10** A tracked-time service line creates a task; tracked hours become delivered quantity and are invoiced (advanced: service lines; FR-95).
- [ ] **AC-11** A 60/40 team split accrues, earns on payment, appears on approved statements visible to each person, and claws back on a return (advanced: commissions; FR-83, FR-85, FR-86).
- [ ] **AC-12** A blanket order refuses a call-off beyond quantity plus allowance and gives back quantity on cancel (FR-88, FR-89).
- [ ] **AC-13** The document flow of an order shows deal, quotation revisions, order, deliveries, invoices, payments and returns, and updates live when a delivery ships (advanced: document flow; FR-92).
- [ ] **AC-14** The quotation-from-email tool returns a preview that writes nothing; without preview it writes a draft; the margin tool explains a discounted line (advanced: agents; FR-96, FR-97).
- [ ] **AC-15** Every report and card of §3.16 exists as a report definition and returns correct figures on the demo data set.
- [ ] **AC-16** Proforma, order confirmation and open-order statement print and email in the customer's language (FR-7, FR-46).
- [ ] **AC-17** Concurrent accept and decline of one revision keep exactly one answer (FR-28).
- [ ] **AC-18** Works on PostgreSQL, MySQL and SQLite with both ORMs; with `FEATURE_SALES` off nothing changes (FR-2; §4).
- [ ] **AC-19** All functional requirements have a passing test (§3).
- [ ] **AC-20** With `FEATURE_SALES` on and the sales settings at their defaults, every existing order path answers as before: a checkout order with a repeated buyer reference, no requested date or a contact with a stored credit limit is placed and confirmed as today and gets no new email; a manager with `ORDERS_EDIT` changes a line price through an order change; `POST /orders/:id/approve` confirms a placed order with `FEATURE_ORDER_APPROVALS` off; an estimate issued by an order quote before the feature was on still answers through its link, and an organization that converts accepted estimates still gets an invoice (FR-30, FR-47).
- [ ] **AC-21** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today, apart from the feature codes that guard their routes, which are switched on for every tenant that holds their data (FR-1, FR-2).

## 8. Open Questions

- Quotation owner: the `order` plugin's quotation, with the core estimate as issued copy (applied).
- `FEATURE_ORDER` is now read by the routes (default: wire it, as for all commerce codes; a migration switches it on for every tenant that already has order data, and every tenant without a stored toggle for it gets it on, so no tenant loses a route, also one that has not created its first order yet; release note names it).
- The contact's `creditLimit` comment says null means "no credit facility"; nothing reads it today. Default applied: null inherits from group and organization, and no limit anywhere means no credit check.
- Direct edits of an issued copy through the estimate API stay allowed and do not change the offer (default); issued copies may be locked later.
- Commission payout default: a party payout through the payment provider; payroll hand-off only when payroll is on.
- Sales masters (territories, people, partners, commissions, blanket orders) live in the `order` plugin as sub-modules (default); a separate plugin later if it grows.

## 9. Constitution Gates

- [x] I Plugin-first — extends `packages/plugins/order`; new `order-ui`; core gets only additive hooks.
- [x] II Tenant/organization scoping — every new record has tenant and organization; queries tenant-aware.
- [x] III Both ORMs, additive migrations — new tables and nullable columns, three dialects, forward-only.
- [x] IV Default-off flag; nothing removed — `FEATURE_SALES` and sub-features off; all existing routes kept.
- [x] V Contracts and API first — contracts in `packages/contracts`; REST first, GraphQL where the plugin has it.
- [x] VI Permissions, privacy, security — new `SALES_*` permissions, hashed public tokens, signatures as personal data.
- [x] VII Real-time through the event bus — outbox events, real-time change hints, Inbox notices.
- [x] VIII i18n and accessibility — keys in every locale, typed signature alternative, keyboard operable.
- [x] IX Tests accompany the change — unit, e2e and contract tests per task.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Depends on: [`../business-document-engine/spec.md`](../business-document-engine/spec.md), [`../pricing-and-promotions/spec.md`](../pricing-and-promotions/spec.md), [`../tax-engine/spec.md`](../tax-engine/spec.md), [`../access-control-and-security/spec.md`](../access-control-and-security/spec.md) (links and one-time codes)
- Works with: [`../delivery-and-shipping/spec.md`](../delivery-and-shipping/spec.md), [`../invoicing-receivables-payables/spec.md`](../invoicing-receivables-payables/spec.md), [`../warehouse-and-stock-movements/spec.md`](../warehouse-and-stock-movements/spec.md), [`../procurement/spec.md`](../procurement/spec.md), [`../crm-leads-and-deals/spec.md`](../crm-leads-and-deals/spec.md), [`../approval-workflows/spec.md`](../approval-workflows/spec.md), [`../inbox/spec.md`](../inbox/spec.md), [`../realtime-channel/spec.md`](../realtime-channel/spec.md), [`../task-automations/spec.md`](../task-automations/spec.md)
- Code: [`packages/plugins/order/README.md`](../../../../packages/plugins/order/README.md), `packages/plugins/order/src/lib/order-invoicing/order-invoicing.service.ts`, `packages/core/src/lib/invoice/`, `packages/core/src/lib/organization-contact/organization-contact.entity.ts`
