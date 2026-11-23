# Feature Specification: Point of sale and loyalty

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `point-of-sale-and-loyalty`
**Branch**: `feat/point-of-sale-and-loyalty`
**Status**: `Draft`
**Created**: 2026-11-15
**Last updated**: 2026-11-23
**Owner**: platform maintainers
**Feature flag**: `FEATURE_POINT_OF_SALE` and `FEATURE_LOYALTY` (new tenant features, default off); the plugins load
only when `GAUZY_POINT_OF_SALE_ENABLED` / `GAUZY_LOYALTY_ENABLED` is exactly `true`

---

## 1. Overview

Selling in a shop and rewarding customers for coming back. A **register** belongs to a store (an existing merchant)
and a stock location and says how it sells: the items its sales channel publishes, price list, payment methods,
receipts and behaviours. A cashier opens a **shift** with a float, sells on a full-screen selling screen (search,
scan, customer, discounts, coupons, gift cards, loyalty, split payments, change), returns past sales, records cash in
and out, and closes the shift by counting each payment method. Every sale is an order of the existing order back
end, paid through the existing payments, priced by the pricing call of `pricing-and-promotions`, and moves stock
through the stock ledger; the register keeps no copy of any of them. **Loyalty programmes** give points on sales
from any channel, with tiers, earning rules, campaigns, expiry and redemption, in an append-only points ledger per
member. Clients: the register as an installable screen of the Gauzy web app, administration screens in the Gauzy
Angular app, the REST and GraphQL API, the MCP server and SDKs.

**Advanced capabilities.** The register is offline-first: it keeps selling without a connection, from a local pack of
items, prices, rules and receipt numbers, and replays its sales safely when the connection returns, each sale once.
A sale is one order from the till to the ledger. Closing a shift
consolidates into accounting through one document event. A cashier's shift is linked to their tracked time and
attendance, so sales per worked hour come for free. Prices, rules and stock reach open registers in real time.
Loyalty earns on online orders, the register, other orders and paid invoices alike, tiers feed customer groups that
pricing rules target, points expire by rule with reminders, and campaigns multiply earning in a window. MCP tools let
an agent read shifts and members, adjust points with a preview, simulate a campaign's cost, and find cash and
discount anomalies per cashier.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** a store manager with `POS_REGISTERS_EDIT`, **when** they create the register "Front till" for the store
  "City" with location "City shop floor", the list "Retail", cash (default) and card terminal, receipts on 80 mm
  paper, and assign two cashiers, **then** only those cashiers can open it and it sells only from that location.
- **Given** a cashier with `POS_SELL`, **when** they open a shift on "Front till" with a float of 150.00, **then** the
  shift opens, their timer starts on the store's project, and the selling screen shows the filtered items with live
  stock.
- **Given** an open shift, **when** the cashier scans two coffees and a mug, attaches loyalty member "Ana", enters a
  coupon, and takes 20.00 on a gift card and the rest in cash with 50.00 tendered, **then** the receipt prints with
  the change, the order is completed and paid, stock leaves the shop floor, the coupon and the gift card are used,
  and Ana's points appear as earned.
- **Given** the connection drops, **when** the cashier keeps selling for an hour, **then** sales complete with local
  receipt numbers and cash or card-terminal payments, coupons, gift cards and point redemption are offered only
  online, and when the connection returns every sale reaches the server once, with the shift totals updated.
- **Given** a customer returning a mug bought yesterday, **when** the cashier scans the receipt and refunds to the
  original card, **then** a return is recorded on the original sale, the mug returns to stock, the promotion use and
  Ana's points are reversed in proportion, and the drawer total drops.
- **Given** a closing cashier, **when** they count 412.30 in cash against an expected 412.80, **then** the shift
  closes because the difference is within the register's 1.00 limit, the timer stops, the closing is confirmed and
  the accounting plugin posts it, and the manager sees the report.
- **Given** a loyalty manager with `LOYALTY_PROGRAMMES_EDIT`, **when** they create "Coffee club" (1 point per 1.00,
  100 points = 5.00, points expire 12 months after earning, tiers Silver from 0 and Gold from 500.00 spent in 12
  months with ×1.5 earning), **then** customers are enrolled automatically on their first purchase and a Gold member
  earns 15 points on 10.00 on an online order, at a register or on a paid invoice.
- **Given** a campaign "Double points on beans in December", **when** Ana buys beans on 10 December, **then** she
  earns twice the base points on the beans line only, and her statement names the campaign.
- **Given** an AI agent with `POS_REPORTS_VIEW`, **when** it asks for anomalies of the last 30 days, **then** it lists
  cashiers whose voids, returns without receipt, drawer openings without sale or discount overrides are far above
  their peers', with the shifts concerned.

### 2.2 Edge cases & failures

- **Given** a user without `POS_SELL` or not assigned to the register, **when** they open a shift, **then** it is
  refused; with `FEATURE_POINT_OF_SALE` off every register route answers `404` and the screens are hidden.
- **Given** an open shift on a register, **when** a second cashier tries to open one there, or the same cashier on
  another register, **then** it is refused naming the open shift.
- **Given** a device that replays a batch it already sent, **then** each sale answers "duplicate" with its order and
  nothing is recorded twice.
- **Given** a sale made offline at a price that changed meanwhile, **then** it is recorded at the price charged, with
  a notice of the difference; it is never repriced.
- **Given** an offline sale of the last unit sold online elsewhere, **then** the sale is recorded, the location goes
  negative under the register's policy, and the stock manager is notified.
- **Given** a device offline for longer than the register's limit (default 72 hours) or over its offline amount limit,
  **then** new offline sales are refused until it reconnects.
- **Given** a shift whose device still holds unsent sales, **when** the cashier closes, **then** closing waits for
  them, or a supervisor closes it with the missing count recorded.
- **Given** a counted difference above the limit, **then** the shift stays in closing until a user with
  `POS_SHIFT_CLOSE_APPROVE` accepts it with a reason.
- **Given** a return of more than was sold, a serial not on the original sale, or a refund method not allowed in
  returns, **then** it is refused with the reason.
- **Given** a redemption above the member's balance or above the programme's share of the total, **then** it is
  refused; earned points already redeemed cannot be reversed below zero (the shortfall is recorded).

## 3. Functional Requirements

### 3.1 Access and gates

- **FR-1** The system MUST answer `404` on every register route unless `FEATURE_POINT_OF_SALE` is on, and on every
  loyalty route unless `FEATURE_LOYALTY` is on, and hide their screens; with the deployment flags not exactly `true`
  the plugins are not loaded.
- **FR-2** A user with `POS_REGISTERS_VIEW` reads registers, `POS_REGISTERS_EDIT` changes them, `POS_SELL` operates a
  register, `POS_RETURN` returns with a receipt, `POS_RETURN_WITHOUT_RECEIPT` without, `POS_CASH_MOVEMENT` records cash
  in and out, `POS_SHIFT_CLOSE_APPROVE` accepts differences and closes others' shifts, `POS_REPORTS_VIEW` reads
  reports, `POS_DEVICES_MANAGE` enrols and revokes devices; others receive `403`.
- **FR-3** A user with `LOYALTY_PROGRAMMES_VIEW` reads programmes, `LOYALTY_PROGRAMMES_EDIT` changes them,
  `LOYALTY_MEMBERS_VIEW` reads members and ledgers, `LOYALTY_POINTS_ADJUST` adjusts points; others receive `403`.

### 3.2 Registers

- **FR-4** A user with `POS_REGISTERS_EDIT` can create a register with a name, code, store, sales channel, stock
  location, currency, price list (else the channel's), walk-in customer, receipt and email templates, campaign,
  project, and the cashiers allowed with each one's default register.
- **FR-5** A user with `POS_REGISTERS_EDIT` can narrow the items the register's sales channel publishes to item
  groups or collections and customers to customer groups (items restricted for an attached customer's group are not
  sold), hide unavailable items and images, and add an item at once when a search finds exactly one.
- **FR-6** A user with `POS_REGISTERS_EDIT` can decide whether a register's sales move and check stock, whether
  automatic pricing rules apply, which edits a cashier may make (rate, line or sale discount), whether a sale may stay
  part-paid, how totals round, whether receipts print at once, and what an unfinished sale becomes (ask, park, drop).
- **FR-7** A user with `POS_REGISTERS_EDIT` can set payment methods (cash, card terminal, a connected payment
  provider, payment link, gift card, loyalty points, customer credit) with exactly one default, whether each is
  allowed in returns, opens the drawer and is counted at closing; a register without a default is refused.
- **FR-8** A user with `POS_REGISTERS_EDIT` can set the offline policy (allowed, maximum hours, maximum sale amount,
  maximum offline total) and the negative-stock policy (allow, warn, block) of the register.
- **FR-9** A user with `POS_REGISTERS_EDIT` can choose which custom fields of a sale the checkout shows and requires,
  and which item fields the search uses.
- **FR-10** The system MUST refuse disabling or deleting a register with an open shift, and a register whose
  payment method has no ledger mapping when `accounting` is on reports it as a setup warning.

### 3.3 Shifts and cash

- **FR-11** A user with `POS_SELL` assigned to a register can open a shift with an opening amount per counted method;
  the system MUST refuse a second open shift on the register, a second for the cashier, and a negative amount.
- **FR-12** (advanced) The system MUST start the cashier's timer on the register's project when a shift opens
  and stop it when it closes, and record an attendance check-in and check-out when `attendance-and-shifts` is on.
- **FR-13** A user with `POS_CASH_MOVEMENT` can record pay-ins, pay-outs, safe drops and expenses with an amount, a
  method and a reason during a shift; each prints a slip, and an expense is also recorded as an expense of the
  organization (category, optional supplier) linked to the shift.
- **FR-14** A user with `POS_SELL` can switch cashier on an open shift's device with a personal code; each sale
  records the cashier who made it.
- **FR-15** A user with `POS_SELL` can close their shift by entering the counted amount of each counted method
  (optionally by denomination, optionally without seeing the expected amount); the system MUST compute expected,
  counted and difference per method.
- **FR-16** The system MUST close a shift whose differences are within the register's limit, and keep it closing until
  a user with `POS_SHIFT_CLOSE_APPROVE` accepts the difference with a reason otherwise.
- **FR-17** The system MUST refuse to close a shift while its devices report unsent sales, unless a user with
  `POS_SHIFT_CLOSE_APPROVE` closes it, recording the count missing; late sales attach to the closed shift.
- **FR-18** The system MUST show on the closing the sales, returns, taxes, discounts, payments per method, cash
  movements, gift cards sold and redeemed, points redeemed and receipt numbers voided.

### 3.4 Selling

- **FR-19** A user with `POS_SELL` can find items by search over the register's fields, by barcode scan (the lookup
  of `item-catalogue`, including case barcodes), by group filter and by favourites, with stock of the register's
  location shown.
- **FR-20** A user with `POS_SELL` can add, change quantity and remove lines with the keyboard, the on-screen keypad
  or a scanner; a template asks for its variant, a bundle sells as one line with its components moved from stock.
- **FR-21** The system MUST price every change of the sale through the pricing call of `pricing-and-promotions` for
  the register's context (list, customer, channel, location, date and hour), showing applied rules and nudges.
- **FR-22** A user with `POS_SELL` can edit a rate or give a line or sale discount only where the register allows;
  guards of `pricing-and-promotions` warn or block, and `PRICING_GUARD_OVERRIDE` overrides.
- **FR-23** A user with `POS_SELL` can find a customer by name, phone, email or loyalty card, create one, or sell to
  the walk-in customer; a customer outside the register's customer groups is not offered.
- **FR-24** The system MUST check stock of the register's location on adding a line and on completion when the
  register asks for it, counting components of bundles and quantities of unsent sales of the device.
- **FR-25** A user with `POS_SELL` can park a sale and resume it on the same register, and see recent sales of the
  shift with their status.
- **FR-26** The system MUST record a completed sale as one completed order of the register's channel, marked as a
  register sale, with the register, shift, cashier, device and receipt number, and record its stock movements from
  the register's location through the stock ledger.

### 3.5 Payment

- **FR-27** A user with `POS_SELL` can take several payments on one sale, by keypad or quick amounts, see the amount
  left and the change, and the system MUST refuse payments above the total except cash, whose excess is change.
- **FR-28** The system MUST record each payment through the existing payments: cash and card terminal (with its
  reference) as captured payments, a connected provider through `payment-gateways`, a payment link sent by message
  that completes the sale when paid.
- **FR-29** A user with `POS_SELL` can take a gift card as payment (balance checked, redeemed on completion) and sell
  a gift card item, which issues the card when the sale completes.
- **FR-30** A user with `POS_SELL` can apply coupon codes; the system MUST validate them for the sale and count their
  use on completion, and refuse them on a register that ignores pricing rules.
- **FR-31** A user with `POS_SELL` can leave part of the total unpaid only when the register allows partial payment
  and a named customer is attached; the remainder stays outstanding on the order.
- **FR-32** A user with `POS_SELL` can issue an invoice for a sale on request, or always, per the register's
  invoice policy, through the order's invoice; consolidated per customer at closing when the policy says so.

### 3.6 Receipts

- **FR-33** The system MUST print a receipt from the register's print template on completion when set, and let a user
  with `POS_SELL` reprint (marked "copy"), email it with the register's email template, or show a QR code that
  opens the receipt through a signed, revocable link.
- **FR-34** A user with `POS_SELL` can search past sales of the store by receipt number, customer, date or amount and
  filter by status (completed, returned, partly returned, unsent).
- **FR-35** The system MUST number receipts per register without gaps in use; numbers reserved by a device and not
  used are reported as voided at closing.

### 3.7 Returns

- **FR-36** A user with `POS_RETURN` can return lines of a past sale found by receipt number, scan or customer, up to
  the quantity not yet returned; serials must belong to the original sale.
- **FR-37** The system MUST record a register return as a return of the original order through the existing returns
  back end (requested, approved, received and refunded at once), move the goods back into the register's location,
  revert promotion uses by their return policy and reverse loyalty points in proportion.
- **FR-38** The system MUST refund to the original payment method where it is allowed in returns (provider refunds
  through `payment-gateways`), else to a method the register allows in returns, and refuse a refund above the paid
  amount.
- **FR-39** A user with `POS_RETURN_WITHOUT_RECEIPT` can return an item without its sale at the current price to a
  method the register allows; the return records the reason.

### 3.8 Offline selling and sync (advanced)

- **FR-40** (advanced) The register MUST be installable from the browser and start without a connection once
  it has been opened online on that device.
- **FR-41** (advanced) A user with `POS_DEVICES_MANAGE` can enrol a device for a register and revoke it; a
  revoked device can no longer send sales and its unsent sales are listed for review.
- **FR-42** (advanced) The system MUST give an enrolled device a pack of the register's sellable items,
  barcodes, prices for the register's context, the pricing rules that can run offline, payment methods, cashier
  codes and a block of receipt numbers, and refresh it by changes only.
- **FR-43** (advanced) The register MUST, without a connection, complete sales paid in cash, card terminal or
  other methods marked offline-capable, priced with the pack's rules, numbered from its block; coupons, gift cards,
  points and customer search need a connection.
- **FR-44** (advanced) The system MUST accept a device's sales, returns, cash movements, shift openings and
  closings in the order the device made them, each exactly once by its device-made id, and answer each with its
  outcome (recorded, duplicate, recorded with notices, refused with reason).
- **FR-45** (advanced) The system MUST record an offline sale at the amounts charged, with its device time and
  arrival time, notices for price differences, stock shortfalls and clock skew above 5 minutes, and never reprice it.
- **FR-46** (advanced) The register MUST show how many sales wait to be sent and since when, and the system MUST
  notify the store manager when a device has unsent sales older than one hour while its shift is closing.

### 3.9 Real time and accounting

- **FR-47** (advanced) The system MUST push price, rule, item and stock changes of the register's context to
  open registers through the real-time channel within 2 seconds, and refresh the pack of offline devices.
- **FR-48** (advanced) A user with `POS_REPORTS_VIEW` can watch a live dashboard of open shifts, sales so far
  per register and hour, devices offline and unsent sales.
- **FR-49** The system MUST, on shift closing, confirm one closing document with totals by tax, discount, payment
  method, cash difference, gift card and points, and publish it through the event outbox for `general-ledger` to post;
  with `accounting` off nothing is posted and everything else works.
- **FR-50** The system MUST never post a register sale twice: the closing names the sales it covers, and sales that
  arrive after closing are covered by a correction closing.

### 3.10 Loyalty programmes

- **FR-51** A user with `LOYALTY_PROGRAMMES_EDIT` can create a programme with a name, validity, currency, eligible
  customers (customer groups, regions, channels), earning rate, redemption value, minimum redemption, maximum share
  of a total paid with points, rounding, and automatic or manual enrolment.
- **FR-52** A user with `LOYALTY_PROGRAMMES_EDIT` can define tiers by spend or points over a rolling window, with an
  earning multiplier and an optional customer group; the lowest tier MUST start at zero.
- **FR-53** (advanced) The system MUST place a member in the tier their window qualifies them for, daily and
  after each earning, keep them in the tier's customer group so pricing rules can target it, and record each change;
  it adds and removes only the group memberships it made itself, so customers a user put into that group stay.
- **FR-54** A user with `LOYALTY_PROGRAMMES_EDIT` can choose the channels that earn: orders of chosen sales channels
  (online ones included), register sales, other orders, paid invoices; and exclude items, groups or a document.
- **FR-55** A user with `LOYALTY_PROGRAMMES_EDIT` can set expiry: a number of days after earning, the end of a
  period, after a number of days of inactivity, or never.
- **FR-56** (advanced) A user with `LOYALTY_PROGRAMMES_EDIT` can add bonus rules: a multiplier or fixed points
  on matching items, groups, customers, weekdays or totals, inside a promotion campaign's window, with a priority.

### 3.11 Points ledger

- **FR-57** The system MUST keep per member an append-only ledger of earned, redeemed, expired, adjusted, reversed,
  reserved and released points, each with its source document and the balance after it.
- **FR-58** The system MUST earn points when a sale completes, an order completes or an invoice is fully paid, on the
  net amount after discounts and points redemption, once per document.
- **FR-59** The system MUST consume redeemed points from the earliest-expiring earned entries and record which.
- **FR-60** The system MUST expire points by the programme's rule daily, and send a reminder through the member's
  notification preferences a configurable number of days before (default 14).
- **FR-61** The system MUST reverse points in proportion when a document is returned or cancelled, and record a
  shortfall instead of a negative balance when the points were already redeemed.
- **FR-62** A user with `LOYALTY_POINTS_ADJUST` can add or remove points with a reason; the system MUST record who.
- **FR-63** The system MUST keep each member's balance equal to the sum of their ledger and the customer's cached
  balance equal to the sum over their programmes, checked nightly with differences reported; a customer whose cached
  balance is not zero when first enrolled gets that balance as an opening adjustment in the ledger, so no balance
  held before the feature is lost.

### 3.12 Redemption

- **FR-64** A user with `POS_SELL`, or a customer at the checkout of a cart, can redeem points as part of a payment:
  the value is points times the redemption value, recorded as a loyalty adjustment of the document.
- **FR-65** The system MUST refuse redemption above the balance, below the minimum, above the programme's share of the
  total or on an excluded document.
- **FR-66** The system MUST reserve points redeemed in an open cart and release them when the cart expires or is
  abandoned.
- **FR-71** A user with `LOYALTY_MEMBERS_VIEW` and `ORG_PAYMENT_ADD_EDIT` can redeem a member's points while recording
  a payment of the member's open invoice or order, under the limits of FR-65; the value settles part of the document
  as a loyalty adjustment, and points earned on it follow FR-58.

### 3.13 Reports and agents

- **FR-67** The system MUST provide these reports as report definitions with filters (store, register, cashier,
  period, programme) and CSV and spreadsheet export:

| Report | Answers |
|---|---|
| Register sales | sales, returns, discounts and taxes per store, register, shift, cashier and hour |
| Payments by method | totals per payment method, register and day, with change given |
| Shift closings | expected, counted and difference per method and shift, with approvals |
| Item sales by register | quantities and amounts per item and register |
| Sales per worked hour (advanced) | sales per cashier divided by their tracked shift time |
| Loyalty activity | points earned, redeemed, expired and adjusted per programme and period |
| Points liability | outstanding points and their value per programme, with expiry buckets |
| Members by tier | members, spend and movements between tiers |

- **FR-68** (advanced) The MCP server MUST offer tools to read register status, a shift summary, a sale by
  receipt, a loyalty member with balance and statement, to adjust points and simulate a bonus campaign's cost over a
  past period (both with `preview: true`), and to list cash and discount anomalies per cashier.
- **FR-69** (advanced) The system MUST flag weekly, per store, cashiers whose voids, returns without receipt,
  drawer openings without sale, discount overrides or cash differences exceed three times the store's median, and
  send holders of `POS_REPORTS_VIEW` one Inbox item.
- **FR-70** The system MUST publish `pos.shift.opened`, `pos.shift.closed`, `pos.sale.recorded`,
  `loyalty.points.earned`, `loyalty.points.redeemed`, `loyalty.points.expiring` and `loyalty.member.tier_changed`
  through the event outbox for automations and webhooks.

## 4. Non-Functional Requirements

- **Performance**: adding a scanned line < 100 ms on the device (pack lookup) and < 300 ms P95 online including the
  pricing call; completing a sale online P95 < 800 ms; sync of 500 sales < 30 s; pack of 20,000 items < 10 MB and its
  change refresh < 2 s.
- **Reliability**: no sale lost or duplicated across disconnects, crashes or replays; the device keeps unsent sales
  in durable browser storage; the server answers a replay identically.
- **Security & privacy**: device credentials revocable; cashier codes stored hashed; the pack holds no customer data
  beyond the walk-in customer and recent loyalty members of the store when the register allows it; tenant and
  organization scoped; receipts sent only to addresses the customer gives.
- **Observability**: shift, sync and device logs; metrics for sync lag, offline duration and closing differences.
- **Accessibility and localization**: keyboard-only selling, large touch targets, screen-reader labels, receipt
  languages and number formats per register.
- **Compatibility**: PostgreSQL, MySQL, SQLite; both ORMs; additive migrations; cloud and self-hosted; the register
  runs in current desktop and tablet browsers.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| Register | A till of a store with its location, prices, payment methods and behaviours |
| Register device | A browser enrolled to sell on a register, online or offline |
| Shift | A cashier's session on a register from opening to closing |
| Cash movement | Money put in or taken out of a drawer during a shift |
| Shift closing | The count per method, its differences and the summary sent to accounting |
| Register sale | An order made at a register, with its receipt number and device facts |
| Register pack | What a device needs to sell offline |
| Loyalty programme, tier | Earning and redemption terms; a level of membership with its multiplier |
| Earning rule | A base or bonus rule for points, optionally in a campaign window |
| Member | A customer enrolled in a programme with balance and tier |
| Points entry | One append-only line of a member's ledger |

## 6. Out of Scope

- Pricing rules, coupons and gift cards themselves → `pricing-and-promotions`; payment provider adapters and card
  terminals → `payment-gateways`; payment allocation → `payments-and-collections`.
- Journals from closings and points liability postings → `general-ledger`; stock locations and negative-stock
  handling beyond a register's policy → `warehouse-and-stock-movements`.
- Order lifecycle and customer-group item restrictions → `sales-order-management`; return documents →
  `delivery-and-shipping`; attendance records → `attendance-and-shifts`.
- Receipt template design → `print-and-pdf-designer`; custom fields → `custom-fields-and-forms`; campaign audiences
  and sends → `marketing-campaigns`.

## 7. Acceptance Criteria

- [ ] **AC-1** A register with filters, list, methods and cashiers sells only to and from what it allows (FR-4, FR-7, FR-9).
- [ ] **AC-2** Opening refuses a second shift; closing within the limit closes, above it waits for approval (FR-11, FR-17).
- [ ] **AC-3** A sale with coupon, gift card, cash and change becomes one completed, paid order with stock moved, the coupon
      and card used and points earned (FR-26, FR-29).
- [ ] **AC-4** A return by receipt refunds to the original method, restocks and reverses the promotion use and the points (FR-37, FR-38).
- [ ] **AC-5** Offline (advanced): sales complete offline; a replayed batch records each sale once; an offline sale keeps
      its charged price; limits stop offline selling (FR-43–FR-45).
- [ ] **AC-6** Time (advanced): opening and closing start and stop the cashier's timer; the sales per hour report uses it (FR-12).
- [ ] **AC-7** Real time (advanced): a price change reaches an open register within 2 seconds (FR-47, FR-48).
- [ ] **AC-8** Closing confirms one closing document event; no sale is posted twice; late sales get a correction closing (FR-49, FR-50).
- [ ] **AC-9** Loyalty: tiers, channels, bonus campaign, expiry with reminder, proportional reversal and redemption limits
      behave as specified; tier membership updates the customer group (FR-55, FR-56, FR-58).
- [ ] **AC-10** Agents (advanced): MCP point adjustment and campaign simulation with `preview: true` change nothing; the
      weekly anomaly flag lists outliers (FR-68).
- [ ] **AC-11** The eight reports of FR-67 run with filters and export.
- [ ] **AC-12** Every route answers `404` with its feature off; nothing loads without the deployment flags (FR-1).
- [ ] **AC-13** Works on PostgreSQL, MySQL and SQLite with both ORMs; every functional requirement has a passing test (§4).
- [ ] **AC-14** With `FEATURE_POINT_OF_SALE` and `FEATURE_LOYALTY` off nothing changes: orders, payments, returns,
      invoices, expenses, contact pages, contact groups and each customer's cached loyalty balance behave and read as
      today; enrolling a customer with a cached balance keeps that balance; a tier's group keeps the members added by
      hand (FR-1).
- [ ] **AC-15** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-1).

## 8. Open Questions

- Seeding a "Cashier" role with `POS_SELL` and `POS_RETURN`; default: no new role, documented role recipe.
- Customers in the offline pack; default: only recent loyalty members of the store, and only when the register allows.
- Earning on paid invoices without an order; default: on, per programme channel setting.
- Posting per sale or per shift summary; default: summary per closing, the choice belongs to `general-ledger`.
- Offline gift card redemption with a risk limit; default: not allowed offline.

## 9. Constitution Gates

- [x] I Plugin-first — new `point-of-sale` and `loyalty` plugins with Angular `-ui` plugins (register page included).
- [x] II Tenant/organization scoping — every record tenant and organization scoped; devices bound to one register.
- [x] III Both ORMs, additive migrations — new tables only, tri-dialect.
- [x] IV Default-off flag; nothing removed — tenant features off, deployment flags off; existing back ends unchanged.
- [x] V Contracts and API first — sync, pack, shift and loyalty contracts in `@gauzy/contracts` before UI.
- [x] VI Permissions, privacy, security — permission per action; device revocation; hashed codes; limited pack data.
- [x] VII Real-time through the event bus — outbox events and real-time pushes (FR-47, FR-70).
- [x] VIII i18n and accessibility — keys in every locale; keyboard-only selling.
- [x] IX Tests accompany the change.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md) · Uses: `../item-catalogue/`,
  `../pricing-and-promotions/`, `../sales-order-management/`, `../payments-and-collections/`,
  `../warehouse-and-stock-movements/`, `../general-ledger/`, `../realtime-channel/`, `../inbox/`
- Code: `packages/plugins/{order,payment,promotion,returns,inventory}`, `packages/core/src/lib/{channel,merchant}`,
  `packages/core/src/lib/organization-contact` (`loyaltyPoints`)
