# Feature Specification: Delivery and shipping

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `delivery-and-shipping`
**Branch**: `feat/delivery-and-shipping`
**Status**: `Draft`
**Created**: 2026-11-15
**Last updated**: 2026-11-23
**Owner**: platform maintainers
**Feature flag**: `FEATURE_FULFILLMENT` and `FEATURE_RETURNS` (existing, default off; now read by every REST route too) and `FEATURE_DELIVERY_TRIPS` (new, default off)

---

## 1. Overview

The `fulfillment`, `returns` and `warehouse` plugins already ship goods through an API: shipping profiles and options, fulfilments that consume reservations and write stock movements, return shipments, returns, claims and exchanges, pack slips and carrier manifests. None has a screen, a carrier, a print or an MCP tool. This feature makes them the Delivery app of the Angular app, the MCP server and the SDKs, and adds what a delivery operation needs: **deliveries** from orders or direct, with lots, serials, scanning and inspection gates; **packing** into packages; **shipping rules** priced by value or weight bands; **consignments** booked with **carriers**; **delivery trips** with drivers, vehicles and planned routes; **dispatch notices** and a **tracking page**; **proof of delivery**; **sales returns** tied to deliveries with credit notes; **installation records**; and the delivery follow-up reports. A delivery is the existing fulfilment record; the Delivery app calls it a delivery.

Advanced capabilities: **carrier adapters as plugins** with rate shopping across carriers, labels and tracking events pushed into open screens in real time; **proof of delivery on the phone** with signature, photos and position, captured offline; **route planning** for trips with arrival times recomputed from the driver's position and sent to customers; **returns self-service** from the tracking page and the portal, approved at once within policy with a return label; **installations as tracked work**, whose labour time and cost come from tracked time; and **agents** that explain a delay, choose a carrier, plan a day's trips and draft the customer's update, always with a preview.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** a confirmed order with three lines and `FEATURE_FULFILLMENT` on, **when** a warehouse user creates a delivery for the lines due today, packs them into two packages with a preset box, asks for rates and books the cheapest quote that meets the promise date, **then** two labels print, each package has a tracking number, the consignment joins today's manifest for that carrier, and the order shows the lines shipped.
- **Given** that consignment, **when** the carrier reports "out for delivery" and later "delivered", **then** the delivery timeline shows both within a minute, the order owner's open page updates without refresh, and the customer receives "out for delivery" and "delivered" notices with the tracking link.
- **Given** twelve deliveries for tomorrow and `FEATURE_DELIVERY_TRIPS` on, **when** a dispatcher creates a trip with a van and a driver and plans the route, **then** stops are ordered, each shows distance and arrival time, the van's payload is checked, and the trip sheet prints.
- **Given** the trip in progress, **when** the driver arrives at a stop on the driver pages of the installable Gauzy web app without signal, records the recipient's name, a signature and two photos, and marks one line refused as damaged, **then** the proof is kept on the phone, synced when signal returns with its capture time, the delivery is delivered for the accepted quantity, and a return of the damaged quantity awaits receipt.
- **Given** a delivered order and self-service returns on, **when** the customer opens "return items" from the tracking page, picks one line within the 30-day window with reason "wrong size", **then** the return is approved at once, a return label is issued, and the customer receives it by email.
- **Given** a return received in the warehouse, **when** the user receives it, **then** stock goes back through the ledger into the location the reason's restock rule proposes, and, where the organization settles invoiced quantities by credit note, a credit note is issued for the invoiced quantity.
- **Given** a delivered machine requiring installation, **when** a user schedules the installation for a technician, **then** a task is assigned to the technician, the time they track on it is the installation labour, and recording the installation with the customer's signature sets the delivery's installation status to done.
- **Given** an agent with MCP access, **when** it asks why delivery D-204 is late, **then** it gets the promise date, the carrier's events, the exception "address incomplete", and a drafted customer message as a preview.

### 2.2 Edge cases & failures

- **Given** a user without `FULFILLMENTS_CREATE`, **then** creating a delivery answers `403`; with `FEATURE_FULFILLMENT` off every delivery, shipping and packing route answers `404`, and a cart's checkout still offers shipping options.
- **Given** a tenant that used the fulfilment API before this release, **when** the release migrates, **then** its feature is switched on and its calls keep working.
- **Given** a delivery whose line quantity exceeds the order line's remainder, **then** it is refused unless within the organization's over-delivery tolerance and the user holds `FULFILLMENTS_OVER_DELIVER`.
- **Given** a blocked customer, or a customer checked for credit at delivery who exceeds the limit, **then** the delivery is refused with the block reason, or kept as draft "awaiting credit release" with the approval request named.
- **Given** a line needing an outgoing inspection not yet accepted, **then** shipping is refused naming the line.
- **Given** a carrier that does not answer a rate request within 8 seconds, **then** the other quotes are shown and the slow carrier is listed as "no answer"; a booking that fails leaves the consignment unbooked with the carrier's reason.
- **Given** a tracking push whose signature fails verification, **then** it is refused and logged; the same event delivered twice is stored once.
- **Given** a delivery already on a trip that is ready, **when** a dispatcher adds it to another trip, **then** it is refused naming the first trip.
- **Given** a driver whose licence expires before the trip date, or a vehicle whose insurance has expired, **then** marking the trip ready is refused naming the date.
- **Given** a proof synced twice after a reconnect, **then** it is stored once; a proof from someone who is not the trip's driver is refused unless they hold `FULFILLMENTS_EDIT`.
- **Given** a self-service return request outside the return window, for serials never delivered to that customer, or above the auto-approval value, **then** it is refused with the reason, or kept for staff approval.
- **Given** a batch of 30 deliveries booked at once where 2 fail at the carrier, **then** 28 are booked and the result lists the 2 with the carrier's reasons.

## 3. Functional Requirements

### 3.1 Presence and the Delivery app

- **FR-1** `FEATURE_FULFILLMENT` MUST gate every fulfilment, shipping, packing, carrier and tracking route (REST and GraphQL), `FEATURE_RETURNS` every return route, and `FEATURE_DELIVERY_TRIPS` every trip, driver, vehicle and route-planning route; when off they answer `404` and menus hide them.
- **FR-2** Gating the REST routes MUST NOT cut off a tenant already using them: the release switches the feature on for each tenant that holds fulfilments, shipping options or shipping profiles.
- **FR-3** With the flags off nothing this spec adds is observable, and carts keep using shipping options at checkout as today.
- **FR-4** A user with `FULFILLMENTS_VIEW` can open Sales → Deliveries: saved-view lists (to ship, in transit, delivered, exceptions, late), a board by status and filters on warehouse, carrier, customer, promise date and trip, updated live.
- **FR-5** The delivery page MUST show header, lines with ordered, delivered, packed, installed, returned and invoiced quantities, packages, the tracking timeline, the proof of delivery, the trip and the document flow.
- **FR-6** Shipping setup pages MUST cover profiles, options with rules and bands, package presets, carrier accounts and notification templates.
- **FR-7** Default print templates MUST exist for the delivery document, packing list, package label (when no carrier label exists), trip sheet, installation record and return authorisation, in the customer's language.

### 3.2 Deliveries

- **FR-8** A user with `FULFILLMENTS_CREATE` can create deliveries from an order: all due lines, chosen lines, portions due by a date, or only reserved quantities; one delivery per order and dispatch warehouse.
- **FR-9** A delivery for a customer without an order MUST create a confirmed order of source "direct delivery" behind it, unless the customer requires an order first (`sales-order-management`).
- **FR-10** A delivery MUST carry ship-from warehouse, ship-to address and contact, buyer reference, delivery terms and place, project, and a carrier service or a trip; a stocked line created through the Delivery app needs a warehouse; a project must belong to the customer. The existing create route keeps accepting what it accepts today.
- **FR-11** Line quantities MUST stay within the order line's remainder, beyond it only up to the organization's over-delivery tolerance and with `FULFILLMENTS_OVER_DELIVER`; closed, drop-ship and no-shipping lines are not offered.
- **FR-12** Creating a delivery MUST apply the party checks of `sales-order-management`: a blocked customer is refused; a customer checked for credit at delivery who fails is kept as draft awaiting the credit decision.
- **FR-13** With lots and serials tracked (`serials-and-batches`), each line records the lots or serials it ships; reserved ones are proposed first.
- **FR-14** Scanning an item barcode on a delivery or at packing MUST add one unit to the matching line; scanning beyond the line quantity warns.
- **FR-15** A line requiring an outgoing inspection (`quality-management`) MUST NOT ship until the inspection is accepted.
- **FR-16** Each line MUST show available stock at its warehouse, the lot's stock where tracked, and the customer's own item code where one exists.
- **FR-17** Shipping (the existing ship step) writes the issue movements through the stock ledger and publishes the shipped event, from which `accounting`, when on, posts cost of goods sold.
- **FR-18** A delivery not yet shipped can be cancelled (existing rule): reservations are restored, the pack slips made by its packing (FR-23) voided, its trip stop removed, its consignment booking cancelled with the carrier; other pack slips stay as they are and can be voided by hand as today. When its consignment also carries other deliveries (FR-34), the cancelled delivery and its packages leave the consignment, the carrier booking is cancelled, and the consignment goes back to unbooked with the remaining deliveries and packages, their labels voided and the consignment marked "needs rebooking": it is booked again by a user or, where the organization rule of FR-36 chooses automatically, at once with the remaining packages; the user sees which deliveries need rebooking before confirming the cancellation, and the remaining deliveries keep their reservations, packing and trip stops.
- **FR-19** A delivery MUST show packed, delivered, invoiced, returned and installed progress derived from its lines.
- **FR-20** From a delivery a user can create an invoice by delivered quantities (through the order's invoice bridge; several deliveries of one customer invoiced together, one invoice per order), a return, a consignment, a trip stop, packing and an installation; each joins the document flow.
- **FR-21** Shipping to an internal customer MUST draft a goods receipt in the represented organization against its inter-company purchase order with the same lines, lots and serials, priced at the order price or at cost per organization setting.
- **FR-22** Where the organization sends shipment notices (organization setting, default off), the customer MUST receive a shipment notice with the delivery document and tracking link when a delivery ships, unless they opted out; with the setting off, shipping sends nothing to the customer, as today.

### 3.3 Packing

- **FR-23** A user with `FULFILLMENTS_EDIT` can pack a delivery into numbered packages, each with a preset or dimensions, gross and net weight (item weights plus tare) and contents (lines and quantities).
- **FR-24** Packed quantity MUST NOT exceed the line quantity; where the organization requires packing (organization setting, default off), a delivery cannot ship until every line is fully packed.
- **FR-25** Package presets per organization MUST hold name, inner dimensions, tare weight and maximum weight; a package over its maximum is refused.
- **FR-26** Packages can be changed until the delivery ships; cancelling the delivery voids them.
- **FR-27** A packing station view MUST support scan-to-pack, weight entry, and printing the package label and the packing list.

### 3.4 Shipping options and rules

- **FR-28** Shipping options MUST keep flat and provider-calculated prices and gain banded prices: bands by order subtotal or by total weight, each with a price; the first matching band applies; above the last band the option is not offered or priced at the last band (option setting).
- **FR-29** Eligibility MUST keep using the rule engine (region and country lists, channel, customer group, item profile); an option not eligible for the ship-to country is not offered.
- **FR-30** Quotations, orders and deliveries apply the chosen option's charge; changing the address or the lines recalculates it, and a charge no longer eligible is removed with a message.
- **FR-31** A shipping charge MUST carry a tax category and an analytic hint so tax and posting treat it like any line.

### 3.5 Carriers, consignments, rates, labels and tracking

- **FR-32** Carrier adapters MUST be plugins that register with the carrier registry for rates, booking (labels and tracking numbers), cancellation, tracking (push, poll or both), pickup requests and manifest closure; the platform ships a manual carrier (typed tracking number, uploaded label) and a sandbox carrier for tests.
- **FR-33** A user with `CARRIER_ACCOUNTS_MANAGE` can connect carrier accounts per organization (test or live, enabled services, default preset); credentials are stored encrypted in the integration settings and never returned by the API.
- **FR-34** A consignment MUST be one carrier booking for one or more deliveries to one address from one warehouse, with packages, pickup window, declared value and currency, contents description, goods or documents, and delivery terms; a delivery is in at most one active consignment.
- **FR-35** Booking MUST refuse a package without weight, a pickup window that ends before it starts or lies in the past, a zero declared value where the carrier needs one, and an address or contact the carrier requires but lacks.
- **FR-36** (advanced) Rate shopping MUST ask every enabled carrier account in parallel (8 s per carrier) for a consignment, or for estimated packages on a quotation or cart, and list quotes with price, service and expected delivery date, marking the cheapest and the fastest; an organization rule MAY choose automatically (cheapest that meets the promise date).
- **FR-37** (advanced) Booking a quote MUST store labels and tracking numbers per package, add the consignment to the day's manifest of that carrier, record the shipping cost on its deliveries (for margin), and ship the deliveries at booking or at hand-over per setting.
- **FR-38** The existing label route MUST keep its contract and use the registry; with no adapter it still answers that no label is available.
- **FR-39** (advanced) Tracking events MUST arrive by signed push (verified per adapter) or by polling (every 30 minutes for active shipments, slower after 5 days), be normalised (label created, picked up, in transit, out for delivery, delivered, exception, returned to sender), stored once, shown on the delivery timeline, advance the delivery's status, and reach open screens in real time.
- **FR-40** (advanced) A tracking exception, or a delivery still open after its promise date, MUST create an Inbox notice for the order owner (once per delivery and promise) and fire automation triggers; the customer is told per their notification preference.
- **FR-41** A user can request a carrier pickup for a warehouse's consignments of the day and close the manifest (existing submit and hand-over).
- **FR-42** Return legs (existing return shipment) MUST use the same adapters, issuing a return label for an approved return.

### 3.6 Delivery trips, drivers and vehicles

- **FR-43** A user with `DELIVERY_TRIPS_EDIT` can create a trip: date and departure, ship-from warehouse, vehicle, driver, and stops from deliveries ready to ship; a stop groups the deliveries to one address.
- **FR-44** A delivery MUST be on at most one active trip; draft and cancelled deliveries cannot be added; the delivery shows its trip.
- **FR-45** A driver MUST be an employee or a person of a transport vendor, with licence number, categories and validity dates (valid-to after valid-from); an inactive driver, or one without a licence valid on the trip date, cannot drive a trip that is made ready.
- **FR-46** A vehicle MUST be an equipment item marked as a vehicle with registration, payload weight and volume, insurance and inspection validity and odometer readings; a trip over payload or volume is warned; expired insurance or inspection refuses making the trip ready.
- **FR-47** A trip MUST move draft → ready (driver, vehicle and stops confirmed) → on route → completed, or be cancelled before it leaves; leaving needs a driver and a vehicle; completing needs every stop delivered, failed or skipped.
- **FR-48** (advanced) Route planning MUST order unlocked stops to minimize the round trip from the warehouse, keep locked stops in place, respect customer time windows, and give each stop its distance, arrival and departure (average speed and service minutes per stop), with the same route planner as field-service dispatch (`maintenance-and-field-service`); a road-distance provider MAY supply road distances; stops without a position keep their manual order and are flagged.
- **FR-49** A user can reorder, lock and re-plan stops and mark a stop visited; planned and actual distance and duration are both kept.
- **FR-50** (advanced) While a trip is on route the driver's client MUST send positions (only then); arrival times are recomputed from the position and the remaining stops plus the organization's stop delay minutes, and customers receive "on the way" and "arriving soon" notices with the live tracking link.

### 3.7 Dispatch notices and the tracking page

- **FR-51** Where the organization sends shipment notices (FR-22), starting a trip or shipping a consignment MUST send each customer who has not opted out a dispatch notice (email, and a text message when communications are configured) from the organization's template, optionally with the delivery document attached; with that setting on, starting is refused while the template is missing, naming it. With the setting off, trips and consignments send nothing to the customer, like any other shipping.
- **FR-52** A public tracking page (token link in notices) MUST show status, timeline, expected arrival, packages and, once delivered, the recipient name and time; links are revocable and expire 90 days after delivery.
- **FR-53** Each customer's notification preference (none, email, text) per event (dispatched, out for delivery, delivered, exception) MUST be honoured.

### 3.8 Proof of delivery

- **FR-54** (advanced) The trip's driver (`DELIVERY_PROOF_CAPTURE`) can record proof per stop on the driver pages of the installable Gauzy web app on a phone: recipient name, signature, photos, position and time, and per line the quantity accepted, refused or damaged with a reason; a failed stop records its reason (absent, refused, address not found) and a photo.
- **FR-55** (advanced) Proofs captured offline MUST sync later with their capture time and a client key; a repeated sync is stored once; the delivery shows capture and receipt times.
- **FR-56** A full proof MUST mark the delivery delivered (existing step); a partial or refused proof marks it delivered for the accepted quantity and creates a return of the refused and damaged quantity awaiting receipt, with no refund before receipt.
- **FR-57** Signatures and photos MUST be stored through the platform's file storage, printed on the delivery document, and shown to the customer on the tracking page as recipient and time only.

### 3.9 Sales returns

- **FR-58** A return line (existing lifecycle) can name the delivery line it returns; when it does, its quantity stays within delivered minus already returned (existing rule), and for tracked items the returned lots or serials must have been delivered to that customer. Returns whose lines name only order lines keep working as today.
- **FR-59** Receiving a return MUST put stock back through the ledger (existing), proposing the location its reason's restock rule names (sellable, quarantine or scrap); the receiving user or API caller can still choose the location and whether each line is restocked, as today, and a reason without a rule receives as today. Stock goes back at the original issue's cost when valuation is on (`stock-ledger-and-valuation`).
- **FR-60** A refundable return can settle invoiced quantities by a credit note (`invoicing-receivables-payables`) beside the existing refund, which stays available for any quantity; which one the receive dialog proposes is an organization setting that defaults to the refund, as today; the return shows which was used.
- **FR-61** Returned quantity MUST show on the delivery line, the order line (existing counters) and as the delivery's returned percentage.
- **FR-62** Return reasons (existing, governed) MUST carry the restock rule and whether the reason may be approved automatically.
- **FR-63** (advanced) With self-service on, a customer opens "return items" from the tracking page or the portal (`customer-and-supplier-portal`), picks lines and quantities within the return window, a reason and photos; within policy (window, auto-approvable reason, value under the threshold) the return is approved at once and a return label issued; otherwise it waits for staff.
- **FR-64** Exchanges and claims (existing) MUST be reachable from the delivery page and from self-service (claims for damaged or missing items with photos).

### 3.10 Installations

- **FR-65** A user with `INSTALLATIONS_EDIT` can record an installation of delivered items: scheduled and completed times, technician, items with quantities and serials, notes and the customer's signature; installed quantity cannot exceed delivered minus returned. When `maintenance-and-field-service` is installed, the installation is its service visit: schedule, technician, signature and report are the visit's, and the installation keeps the installed items.
- **FR-66** Deliveries of items marked "requires installation" MUST show installation status (pending, partly done, done) and appear in the "installations pending" view.
- **FR-67** (advanced) Scheduling an installation MUST create a task for the technician in the order's project, or the organization's installations project, or, when `maintenance-and-field-service` is installed, its service visit; time tracked on it is the installation's labour time and cost, shown on the installation and in the order's margin.
- **FR-68** A return of installed units MUST mark them uninstalled on their installation.

### 3.11 Agents, automation and real time

- **FR-69** (advanced) MCP tools MUST cover deliveries, rates and bookings, trips, proofs (read), returns and installations under the API's permissions; tools that ship, book, cancel, approve or plan take `preview: true`.
- **FR-70** (advanced) An agent can explain a delivery's delay (promise, stock, picking, carrier events), propose the carrier for a consignment (cost against promise), propose a trip plan for a day's deliveries, and draft the customer's update — each as a preview first.
- **FR-71** Delivery, tracking, trip, proof, return and installation events MUST be available to automation rules and outbound webhooks.
- **FR-72** Delivery lists, delivery pages, trip boards and the tracking page MUST update live through the real-time channel, with a refresh fallback.

### 3.12 Reports

- **FR-73** The system MUST register these report definitions with the report builder, filterable by organization, period, warehouse, carrier, customer, group and item category, exportable, respecting permissions:

| Report | Question it answers |
|---|---|
| Late order lines | Which order lines are past their requested or promised date, by how many days |
| Late orders | Which orders are late, with their open value |
| Deliveries over time | Delivered value and count by period, grouped by any dimension |
| On-time delivery | Share delivered by the promise, by carrier, warehouse and customer |
| Shipping cost | Carrier cost per package, per delivery and as a share of order value |
| Exceptions and failed stops | Tracking exceptions and failed stops by reason |
| Trip performance | Planned against actual distance, duration and stops per trip and driver |
| Returns | Returned quantity and value by reason, item and customer |
| Installations | Pending and done installations with labour time |
| Shipped volume | Packages, weight and deliveries shipped per day and warehouse |

- **FR-74** The Delivery dashboard MUST show cards (to ship today, late, in transit, exceptions, on-time rate this month) and charts (deliveries per day, on-time trend), each a report definition.

## 4. Non-Functional Requirements

- **Performance**: delivery lists P95 < 300 ms at 1 M deliveries per tenant; creating a delivery of 100 lines P95 < 800 ms including stock movements; rate shopping returns within 9 s with any carrier slow; a tracking push is visible on open screens within 5 s; route planning of 60 stops P95 < 2 s with straight-line distances; proof sync of 10 photos P95 < 5 s on a 4G link.
- **Volume**: 50,000 deliveries and 200,000 tracking events per tenant per day; trips of up to 150 stops.
- **Concurrency**: deliveries, consignments and trips are versioned (`If-Match`); one active trip and one active consignment per delivery are single-winner; bulk booking reports per row.
- **Reliability**: tracking pushes are acknowledged after storage, idempotent per carrier event; polling catches up after downtime; proofs and positions use client keys; events through the outbox.
- **Security & privacy**: carrier credentials encrypted, never returned; pushes verified per adapter; public tracking and return links carry random tokens stored hashed; driver positions are kept only during trips and deleted after 30 days; signatures and photos are personal data, exported and erased with the contact (the delivery record stays). Leaving the platform: addresses, package data and contact phone or email sent to the chosen carrier; addresses to the configured geocoding and road-distance providers; notices to customers.
- **Offline**: proof capture, stop status and positions queue on the device and sync in order with capture times.
- **Accessibility and localization**: keyboard operable lists and packing station, screen-reader labels, signature with typed alternative; every string in all locales; notices and documents in the customer's language; weights and dimensions in the organization's units.
- **Compatibility**: PostgreSQL, MySQL, SQLite; both ORMs; cloud and self-hosted; OpenAPI and SDKs regenerated.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| --- | --- |
| Delivery | The existing fulfilment: what leaves a warehouse for one order, with its lines |
| Package, package preset | A packed box of a delivery's lines; a standard box with tare and maximum weight |
| Shipping option, band | A sellable shipping choice; a price step by value or weight |
| Carrier adapter, carrier account | A plugin that talks to a carrier; an organization's connected account with it |
| Consignment | One carrier booking for deliveries to one address, with labels and tracking numbers |
| Tracking event | A normalised status report from a carrier, the driver or a user |
| Manifest | The existing per-carrier hand-over record of a day's consignments |
| Trip, stop | A vehicle's route of a day; a visit to one address with its deliveries |
| Driver, vehicle | A person allowed to drive deliveries; an equipment item used as a delivery vehicle |
| Proof of delivery | Recipient, signature, photos, position, time and line outcomes of a stop |
| Return | The existing return, now tied to delivery lines, restock rules and credit notes |
| Installation | Installed quantities and serials of a delivery, with technician task and signature |
| Tracking page | A public, tokenised view of a delivery's progress |

## 6. Out of Scope

- Pick waves, pick lists, bins, putaway and the reservation engine → `warehouse-and-stock-movements`.
- Order-side delivery schedules, reservations requests, drop-ship and credit rules → `sales-order-management`.
- Shipping rules on purchase documents and receipts from suppliers → `procurement`.
- Lot and serial masters → `serials-and-batches`; inspections → `quality-management`; stock value and cost of returns → `stock-ledger-and-valuation`; postings → `general-ledger`.
- Credit notes and invoices → `invoicing-receivables-payables`; refunds through providers → `payment-gateways`.
- Service visits, maintenance plans and warranty claims → `maintenance-and-field-service`.
- Portal pages listing a customer's deliveries → `customer-and-supplier-portal`; text message transport → `email-and-communications`; the route planner itself → shared with `maintenance-and-field-service`.
- Concrete carrier adapters beyond the manual and sandbox carriers: marketplace plugins with their own docs.

## 7. Acceptance Criteria

- [ ] **AC-1** On a fresh tenant with the flags on, an order is delivered in two packages, booked with the sandbox carrier after rate shopping, labelled, manifested and tracked to delivered, with the timeline updating live (advanced: carriers; FR-32, FR-36, FR-37, FR-39).
- [ ] **AC-2** A tenant with fulfilment rows before the release keeps API access after it; a tenant without them gets `404` until the feature is switched on (FR-1, FR-2).
- [ ] **AC-3** Banded shipping by weight prices a 7 kg order at the right band and removes an ineligible option when the country changes (FR-28, FR-29).
- [ ] **AC-4** A trip of 20 stops is planned, refused as ready for an expired licence, made ready with a valid driver, then run; arrival times update from posted positions and customers receive "arriving soon" (advanced: route planning; FR-43, FR-45, FR-48).
- [ ] **AC-5** A proof captured offline with a refused line syncs once, delivers the accepted quantity and creates a return for the refused one (advanced: proof of delivery; FR-55, FR-56).
- [ ] **AC-6** A self-service return within policy is approved at once with a return label; one outside the window is refused (advanced: self-service returns; FR-63).
- [ ] **AC-7** Receiving a return proposes the reason's location and restocks where the user confirms; with credit-note settlement chosen it issues a credit note for invoiced quantities, and with the default it refunds as today (FR-59, FR-60).
- [ ] **AC-8** An installation task collects tracked time shown as labour on the installation (advanced; FR-67).
- [ ] **AC-9** The delay-explanation tool returns causes and a drafted message without writing (advanced: agents; FR-70).
- [ ] **AC-10** A direct delivery creates its confirmed order; an internal-customer delivery drafts the receipt in the other organization (FR-9, FR-21).
- [ ] **AC-11** Packing refuses quantities above the line and overweight packages; with packing required, shipping an unpacked delivery is refused (FR-24).
- [ ] **AC-12** Every report and card of §3.12 exists as a report definition and returns correct figures on demo data.
- [ ] **AC-13** The existing fulfilment, label, return and manifest routes answer with unchanged contracts (FR-38).
- [ ] **AC-14** Works on PostgreSQL, MySQL and SQLite with both ORMs; with the flags off nothing changes (FR-3; §4).
- [ ] **AC-15** All functional requirements have a passing test (§3).
- [ ] **AC-16** For a tenant whose feature the release switched on, the existing create, ship, cancel, receive and refund calls behave as before: no customer notice, no packing requirement, no voiding of pack slips not made by packing, and the caller's restock location, restock choice and refund kept, until an organization setting says otherwise (FR-2).
- [ ] **AC-17** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today, apart from the feature codes that guard their routes, which are switched on for every tenant that holds their data (FR-1, FR-2).

## 8. Open Questions

- Gating fulfilment REST routes by `FEATURE_FULFILLMENT`: default applied — the release enables the feature for tenants that already hold fulfilment data.
- Carrier adapters are separate marketplace plugins; this feature ships the manual and sandbox carriers only.
- Route planning uses straight-line distances and average speed by default; a road-distance provider plugs into the route planner shared with field-service dispatch. Default applied.
- Driver positions are kept 30 days (default) for trip performance; shorter retention is a setting.
- Invoicing several deliveries of one customer as one invoice across orders needs multi-order invoices in `invoicing-receivables-payables`; without them one invoice per order (default applied).

## 9. Constitution Gates

- [x] I Plugin-first — extends `fulfillment`, `returns` and `warehouse`; new `fulfillment-ui` and `returns-ui`; carriers are plugins; route planning shares one route planner with field-service dispatch.
- [x] II Tenant/organization scoping — every new record scoped; public tokens resolve tenant and organization.
- [x] III Both ORMs, additive migrations — new tables and nullable columns in three dialects.
- [x] IV Default-off flag; nothing removed — flags default off; existing routes, statuses and ports kept.
- [x] V Contracts and API first — contracts in `packages/contracts`; REST first; existing GraphQL extended.
- [x] VI Permissions, privacy, security — new keys, encrypted carrier credentials, verified pushes, position retention.
- [x] VII Real-time through the event bus — outbox events, real-time hints, Inbox notices.
- [x] VIII i18n and accessibility — keys in every locale, keyboard packing, typed signature alternative.
- [x] IX Tests accompany the change — unit, e2e, contract and adapter conformance tests.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Depends on: [`../sales-order-management/spec.md`](../sales-order-management/spec.md), [`../warehouse-and-stock-movements/spec.md`](../warehouse-and-stock-movements/spec.md), [`../business-document-engine/spec.md`](../business-document-engine/spec.md)
- Works with: [`../maintenance-and-field-service/spec.md`](../maintenance-and-field-service/spec.md), [`../item-catalogue/spec.md`](../item-catalogue/spec.md), [`../access-control-and-security/spec.md`](../access-control-and-security/spec.md), [`../invoicing-receivables-payables/spec.md`](../invoicing-receivables-payables/spec.md), [`../serials-and-batches/spec.md`](../serials-and-batches/spec.md), [`../quality-management/spec.md`](../quality-management/spec.md), [`../customer-and-supplier-portal/spec.md`](../customer-and-supplier-portal/spec.md), [`../integration-hub/spec.md`](../integration-hub/spec.md), [`../inbox/spec.md`](../inbox/spec.md), [`../realtime-channel/spec.md`](../realtime-channel/spec.md)
- Code: [`packages/plugins/fulfillment/README.md`](../../../../packages/plugins/fulfillment/README.md), [`packages/plugins/returns/README.md`](../../../../packages/plugins/returns/README.md), `packages/plugins/warehouse/src/lib/pack-slip/`, `packages/plugins/warehouse/src/lib/carrier-manifest/`
