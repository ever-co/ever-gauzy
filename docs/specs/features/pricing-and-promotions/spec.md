# Feature Specification: Pricing and promotions

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `pricing-and-promotions`
**Branch**: `feat/pricing-and-promotions`
**Status**: `Draft`
**Created**: 2026-11-15
**Last updated**: 2026-11-23
**Owner**: platform maintainers
**Feature flag**: `FEATURE_PRICING`, `FEATURE_PROMOTION` (existing tenant features, default on; from now on read by
a guard on every pricing and promotion route and by the menu), `FEATURE_PRICE_TIERS`, `FEATURE_MULTI_CURRENCY`,
`FEATURE_GIFT_CARDS` (existing, default off, now read) and `FEATURE_PRICING_RULES` (new, default off: every
behaviour this spec adds)

---

## 1. Overview

What an item costs, for whom, and why. Price lists with quantity tiers, derived and cost-plus prices, tax-inclusive
preferences, exchange rates, a price resolution with a one-line explanation, promotions with automatic and coupon
offers, campaign budgets, usage limits and gift cards already exist in the API, with no screen. This feature gives
them screens and completes them: selling and buying price lists with country, customer and supplier scope, item
prices per unit, a default list chain, pricing rules (discounts, special prices, margins,
free items, slabs, transaction-level and cumulative rules) applied and removed on every commercial document through
one pricing call, coupon-only rules, discount and minimum-price guards with an override permission, and price
stickiness along a document flow. Clients: the Gauzy Angular app, the REST and GraphQL API, the MCP server and SDKs;
the existing cart, orders, quotations, invoices, purchase orders and the register of `point-of-sale-and-loyalty` all
price a basket the same way.

**Advanced capabilities.** Every price can answer "why this price": a full trace of the candidate lists and why
each was not chosen, the rules that applied or were excluded and why, the guards that fired, and the price history of the
item. A simulation tool prices any basket for any customer and date, compares a draft list with the live one, and
replays the last 90 days of sales against a draft to show the revenue and margin it would have produced. An AI agent
proposes price changes as a draft list with that preview and never activates it; a nightly margin-leak sweep finds
lines sold below cost, discounts beyond their cap and rules that stack further than intended, and reports them in
the Inbox and through MCP. Price and rule changes reach open registers and carts through the real-time channel, and
a basket close to a rule's threshold receives a nudge ("add 2 more to get 10 % off").

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** a pricing manager with `PRICE_LISTS_CREATE`, **when** they create the selling list "Wholesale EU" in
  euro for the customer group "Resellers" and the region "Europe", add tiered prices for the beans (1–9 at 12.00,
  10+ at 10.80), and activate it, **then** a reseller in Germany ordering 12 bags is priced 10.80, a reseller in
  Canada is priced from the default list, and the explanation names both decisions.
- **Given** a customer with a list of their own, **when** an order is priced for them, **then** their list wins over
  their group's list, which wins over the channel's, which wins over the organization's default list.
- **Given** a pricing rule "10 % off coffee for resellers from 20 units, valid in December", **when** an order line
  of 25 bags is entered, **then** the line shows the rule and the discount; **when** the quantity is lowered to 15,
  **then** the rule is removed from the line and the line shows "add 5 more to get 10 % off".
- **Given** a rule "buy 3 get 1 free, every 3 units", **when** 7 units are ordered, **then** two free units are
  added as a free line marked with the rule; with the rounding "down" and 5 units, one free unit is added.
- **Given** a slab promotion for the group "Retail partners" (2 % from 1,000.00, 4 % from 5,000.00, 6 % from
  10,000.00 on the document total), **when** a partner's order totals 6,200.00, **then** 4 % is applied to the
  document; overlapping slabs are refused when saved.
- **Given** a coupon-only rule and a generated batch of 500 single-use codes, **when** a customer enters a code at
  checkout, **then** the discount applies, the code's use is counted when the order is placed and given back when
  the order is cancelled.
- **Given** a buying list for the supplier "Roastery Ltd" with 5 % off every item of the group "Coffee", **when** a
  purchase order to that supplier is priced, **then** each coffee line is priced 5 % under the supplier's term price
  and names the list.
- **Given** a guard "never sell below cost: block" and a salesperson without `PRICING_GUARD_OVERRIDE`, **when** they
  type a rate under the item's cost on a quotation, **then** the line is flagged and confirming is refused with the
  cost basis named; a manager with the override can confirm, and the override is recorded.
- **Given** a pricing manager who opens **Why this price** on an invoice line, **then** they see each candidate
  list with its outcome, each rule with applied or excluded and the reason, each guard, the tax inclusivity and the
  final amount, and the price history of the item on that list.
- **Given** a draft list with 8 % higher prices for tea, **when** the manager runs **Impact on the last 90 days**,
  **then** they see per item and in total the revenue and margin the sold quantities would have produced under the
  draft, before activating anything.
- **Given** an AI agent with `PRICE_LISTS_SIMULATE` and `PRODUCT_PRICES_EDIT`, **when** it asks to raise prices of
  items whose margin is under 25 %, **then** it receives a proposal as a draft list with the impact preview, and only
  a person with `PRICE_LISTS_EDIT` can activate it.
- **Given** the nightly margin-leak sweep, **when** yesterday's orders contain three lines sold below cost because
  two rules stacked, **then** holders of `PRICING_INSIGHTS_VIEW` receive one Inbox item listing them with the rules
  involved.

### 2.2 Edge cases & failures

- **Given** a user without the permission of a route, **then** they receive `403`; with `FEATURE_PRICING_RULES` off,
  every route this spec adds answers `404` and its screens are hidden, while existing routes behave as before.
- **Given** two `OVERRIDE` lists of equal priority eligible for one context, **then** resolution refuses with the
  names of both lists instead of choosing one.
- **Given** a list in another currency than the document, **when** no exchange rate exists for the date, **then** the
  list is skipped with the notice "no rate" and the next candidate wins.
- **Given** a document flagged "ignore pricing rules", **then** no automatic rule applies and a coupon is refused with
  that reason; list prices still apply.
- **Given** a coupon whose last use is being redeemed by two checkouts at once, **then** exactly one succeeds; the
  other receives "coupon limit reached".
- **Given** a price changed while a quotation is open, **when** the quotation becomes an order and rate stickiness is
  set to "warn", **then** the order keeps the quotation's rate and shows the warning; set to "block", a changed rate
  is refused unless the user holds the override.
- **Given** two pricing managers editing one price row, **then** the outdated save is refused with `409`.
- **Given** a bulk price upload where 12 of 3,000 rows name unknown items, **then** 2,988 rows are written and the
  result names the 12 rows and why.
- **Given** an impact simulation over more than 100,000 lines, **then** it runs in the background and the manager is
  notified when it is ready.
- **Given** an id of another organization or tenant, **then** every route answers `404`.

## 3. Functional Requirements

### 3.1 Access, gates and screens

- **FR-1** The system MUST check `FEATURE_PRICING` on every pricing route and `FEATURE_PROMOTION` on every promotion,
  coupon and campaign route and on their menu entries; `FEATURE_GIFT_CARDS` on gift card routes, `FEATURE_PRICE_TIERS`
  on tier authoring and `FEATURE_MULTI_CURRENCY` on lists and prices in a currency other than the organization's.
- **FR-2** The system MUST switch on, when these checks are introduced, `FEATURE_GIFT_CARDS`, `FEATURE_PRICE_TIERS`
  and `FEATURE_MULTI_CURRENCY` for every tenant that already holds a gift card, a tiered price or a foreign-currency
  price, so no tenant loses a capability it uses.
- **FR-3** The system MUST answer `404` on every route this spec adds, and hide its screens, unless
  `FEATURE_PRICING_RULES` is on; existing routes keep their behaviour while it is off, and price resolution (carts,
  subscription prices, the existing resolve route) answers exactly as today: the list chain, group discount, country
  check, fallback and unit independence of FR-7 to FR-10 and the checks of FR-13 and FR-40 apply only with it on.
- **FR-4** A user with the existing view permissions can open screens for price lists, prices (a grid per list with
  tiers and windows), price preferences, exchange rates, promotions, coupons and coupon batches, campaigns and
  budgets, gift cards with their ledger, and usage of each promotion.

### 3.2 Price lists

- **FR-5** A user with `PRICE_LISTS_CREATE` can create a selling or buying list with a name, code, currency, type
  (combining or overriding), priority, validity window, status and tax inclusivity.
- **FR-6** A user with `PRICE_LISTS_EDIT` can limit a selling list to a channel, a region (and so its countries), a
  customer group, and a buying list to a supplier.
- **FR-7** The system MUST treat a list whose region excludes the document's delivery country as not eligible, and
  MUST warn on a document whose chosen list does not cover its delivery country.
- **FR-8** A user with `PRICE_LISTS_EDIT` can mark a list "unit independent": its price for the stock unit applies to
  any unit through the item's conversion; otherwise a price applies to its own unit only.
- **FR-9** The system MUST choose the selling list of a document in this order: a list named on the document, the
  customer's own list, the customer group's list, the channel's list, the organization's default selling list; and
  the buying list: named on the document, the supplier's list, the default buying list. A customer group's discount
  percentage (stored on the group) applies to the chosen selling price as a named step of the explanation.
- **FR-10** The system MUST, when the chosen list has no price for an item and the organization setting allows it,
  fall back to the default list of the same direction, and say so in the explanation.
- **FR-11** A user with `PRICE_LISTS_EDIT` can copy a list (with or without its prices, with an optional percentage
  and rounding), and a derived list re-derives when its base list changes.

### 3.3 Item prices

- **FR-12** A user with `PRODUCT_PRICES_EDIT` can set a price per variant, unit, currency and list with quantity
  tiers, validity window, a note and a reference. On a buying list a price derives from the supplier's term price
  (an amount or percentage off it); the supplier's own prices, pack sizes and lead times are its supplier terms
  (`procurement`).
- **FR-13** The system MUST warn on a quantity that is not a multiple of the item's order multiple on a selling
  document (`item-catalogue`), or of the supplier term's pack size on a buying document, naming the next valid
  quantity; it refuses such a quantity only when the organization setting asks for it (off by default).
- **FR-14** A user with `PRODUCT_PRICES_EDIT` can set a price as a fixed amount, a percentage off another price, or a
  markup on cost or on the list price (amount or percentage), with a price ending (round to a multiple).
- **FR-15** A user with `PRODUCT_PRICES_BULK_EDIT` can upload or change prices in bulk with a preview and a result
  per row; rows that fail never block the others.
- **FR-16** The system MUST, when the organization setting allows it, create a missing price on the document's list
  from a confirmed document's rate, and update an existing price from it when the rate differs (always, only when
  higher, only when lower); off by default, and each write names the document.
- **FR-17** (advanced) The system MUST keep a history of every price change (old and new value, who, when,
  source: person, bulk, document, import, AI proposal) and show it on the item and on the list.

### 3.4 Price resolution and explanation

- **FR-18** The system MUST price a whole basket in one call for a context (organization, direction, currency,
  date, customer or supplier, channel, region and delivery country, stock location, document list, quantities and
  units) and answer per line the unit price, the list, the discounts with the rule of each, free lines, taxes'
  inclusivity and the total, and the same answer for the same context.
- **FR-19** The system MUST convert prices of another currency at the exchange rate valid on the document date,
  skipping a list without a rate with a notice.
- **FR-20** The system MUST refuse resolution, naming both lists, when two overriding lists of equal priority are
  eligible.
- **FR-21** (advanced) A user with `PRODUCT_PRICES_VIEW` can open "why this price" for any line: each candidate
  list with eligible or not and the reason, the winner, each rule applied or excluded with the reason, each guard,
  the conversion and rounding steps, and the final amount; the same trace is available through the API and MCP.
- **FR-22** (advanced) A user with `PRICE_LISTS_SIMULATE` can price a basket for any customer, date, channel
  and currency, and compare a draft list or rule with the live state line by line.
- **FR-23** (advanced) A user with `PRICING_INSIGHTS_VIEW` can replay the last 7 to 365 days of order lines
  against a draft list or rule and see per item, group and in total the revenue, discount and margin difference;
  more than 100,000 lines run in the background with a notification.

### 3.5 Pricing rules

- **FR-24** A user with `PROMOTIONS_CREATE` can create a pricing rule that applies without a code, on selling or
  buying documents, with a priority and a validity window.
- **FR-25** A pricing rule MUST be able to match on items, item groups, brands, collections, customers, customer
  groups, regions, channels, campaigns, sales people, price list, stock location, quantity and amount bands (in the
  stock unit), weekdays and hours, and any condition the rule engine supports, combined with and/or.
- **FR-26** A pricing rule MUST be able to set a special price, a discount percentage, a discount amount, a margin
  over cost or list price, or free items, on each matching line or on the document total.
- **FR-27** A user with `PROMOTIONS_EDIT` can give a rule a mixed condition across several items (the band counts
  the matching lines together) and a cumulative condition (the band counts the customer's confirmed purchases of the
  matching items within a window of days, plus the current document).
- **FR-28** A free-item rule MUST be able to give the same or another item, a fixed quantity or "every N units"
  repeatedly, round the free quantity down, to nearest or up, and give the free line a rate of zero or a set rate;
  the free line is marked with the rule.
- **FR-29** The system MUST refuse "every N units" on a rule with a mixed condition.
- **FR-30** A user with `PROMOTIONS_EDIT` can set whether rules may stack (combinable, stacking group), whether a
  discount applies to the price after earlier discounts or to the list price, and a maximum combined discount.
- **FR-31** A user with `PROMOTIONS_EDIT` can lock a rule's discount so that a manual line discount beyond it is
  refused unless the user holds `PRICING_GUARD_OVERRIDE`.
- **FR-32** The system MUST apply and remove rules on every pricing call as items, quantities, units, customer or
  date change, record on each line the rules applied, and report every rule excluded with the reason.
- **FR-33** The system MUST skip all automatic rules and refuse coupons on a document flagged "ignore pricing rules",
  while list prices still apply.
- **FR-34** (advanced) The system MUST return a nudge for each rule the basket misses by no more than the
  rule's nudge threshold (default 20 % of its band), naming what to add.

### 3.6 Promotions, slabs and coupons

- **FR-35** A user with `PROMOTIONS_CREATE` can create a slab promotion: one promotion with bands of quantity or
  amount, each with its discount, special price or free items, for many customers, groups, regions, channels or
  suppliers at once; the system MUST refuse overlapping bands unless stacking is allowed.
- **FR-36** The system MUST keep the existing promotion types, actions, allocation, limits per promotion and per
  customer, campaign budgets, funding, return policy and per-exclusion notices unchanged.
- **FR-37** A user with `PROMOTIONS_CREATE` can make a rule coupon-only; a user with `COUPONS_CREATE` can create
  single codes or generated batches with their own limits, window and an optional customer.
- **FR-38** The system MUST count a coupon's use when the order or document is confirmed and give it back when it is
  cancelled, and only one of two concurrent uses of the last allowance succeeds.
- **FR-39** A user with `PROMOTIONS_VIEW` can see per promotion and coupon batch the uses, discount given, revenue of
  the documents, remaining budget and the top exclusion reasons.

### 3.7 Guards and rate stickiness

- **FR-40** The system MUST check every line of a document being saved or confirmed against: the item's maximum
  discount, the price's maximum discount and minimum margin, and the cost floor (valuation rate when
  `stock-ledger-and-valuation` is on, else the last purchase price, else the variant's unit cost).
- **FR-41** A user with `PRICING_SETTINGS_EDIT` can set each guard to off, warn or block, per organization and
  direction (every guard off by default, so documents save and confirm as today until a guard is set); internal
  customers and non-stock items skip the cost floor.
- **FR-42** A user with `PRICING_GUARD_OVERRIDE` can confirm a line that a blocking guard refuses; the system MUST
  record who overrode which guard, on which line, and the values.
- **FR-43** A user with `PRICING_SETTINGS_EDIT` can require that a line's rate stays the same along a document flow
  (quotation, order, delivery, invoice) with warn or block (off by default); the system MUST compare each line with
  its source line and report a difference.

### 3.8 Exchange rates and preferences

- **FR-44** A user with `EXCHANGE_RATES_EDIT` can maintain rates per currency pair with a valid-from instant; the
  rate valid on a date is the latest one before it.
- **FR-45** A user with `PRODUCT_PRICES_EDIT` can set tax-inclusive or exclusive presentation per currency, region or
  channel, applied when neither the price nor its list says.

### 3.9 Gift cards

- **FR-46** A user with `GIFT_CARDS_ISSUE` can issue a gift card with an amount, currency, expiry and optional
  customer; a user with `GIFT_CARDS_VIEW` can look up a card and its ledger; adjustments and cancellations need
  `GIFT_CARDS_EDIT` and a reason.

### 3.10 Agents, insights and real time

- **FR-47** (advanced) An AI agent or user with `PRICE_LISTS_SIMULATE` and `PRODUCT_PRICES_EDIT` can ask for
  price change proposals against a goal (target margin, rounding, a price move by group); the system MUST write them
  only into a new draft list with the FR-23 impact attached, and only a user with `PRICE_LISTS_EDIT` can activate it.
- **FR-48** (advanced) The system MUST scan confirmed documents nightly, and on demand, for lines below cost,
  below minimum margin, above maximum discount or stacked beyond the combined cap, record each finding once, and
  send holders of `PRICING_INSIGHTS_VIEW` one Inbox item per run.
- **FR-49** (advanced) A user with `PRICING_INSIGHTS_VIEW` can acknowledge or resolve a finding with a note;
  resolved findings stay in the report.
- **FR-50** (advanced) The system MUST push list activations, price changes and rule changes to open
  registers, carts and documents through the real-time channel within 2 seconds, so they re-price on their next call.
- **FR-51** The system MUST publish `pricing.price_list.activated`, `pricing.price_list.changed`,
  `pricing.price.changed`, `promotion.promotion.changed` and `pricing.margin_leak.found` through the event outbox.
- **FR-52** (advanced) The MCP server MUST offer tools to price a basket, explain a price, simulate a list,
  replay impact, propose price changes, list margin leaks, list and create promotions and coupon batches, validate a
  coupon and read a gift card balance; writing tools accept `preview: true` and save nothing then.

### 3.11 Reports

- **FR-53** The system MUST provide these reports as report definitions with filters and CSV and spreadsheet export:

| Report | Answers |
|---|---|
| Price list coverage | items without a price on a list, and prices expiring within N days |
| Price changes | every price change in a period with who, source and old and new value |
| Promotion performance | uses, discount given, document revenue and budget per promotion and coupon batch |
| Discounts given | discount amount by rule, customer, item group and salesperson |
| Guard overrides | every override with user, guard, line and values |
| Margin leaks (advanced) | findings by kind, rule, item and status |

## 4. Non-Functional Requirements

- **Performance**: pricing a 50-line basket P95 < 150 ms with 200 active rules and 50 lists per organization;
  explanation P95 < 300 ms; impact replay of 100,000 lines < 2 min; list screens P95 < 300 ms at 1 million prices.
- **Correctness**: exact decimals with currency precision; identical answers for identical contexts; one rounding
  boundary per line; coupon and budget limits safe under concurrency.
- **Reliability**: the leak sweep and impact jobs resume and record each finding once; price history is append-only.
- **Security & privacy**: tenant and organization scoped; AI proposals send aggregated prices and margins only to the
  organization's configured AI provider; overrides audited.
- **Observability**: per-call metrics (lines priced, rules evaluated, latency); override and price history.
- **Accessibility and localization**: keyboard-operable grids and dialogs; translation keys in every locale; amounts
  in the user's locale format.
- **Compatibility**: PostgreSQL, MySQL, SQLite; both ORMs; additive migrations; cloud and self-hosted.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| Price list | A named, scoped, time-boxed set of selling or buying prices (existing) |
| Item price | The price of a variant in a unit, currency and list, with tiers (existing) |
| Price resolution | The answer to "what does this cost here and now", with its explanation |
| Pricing rule | A promotion that applies without a code to matching lines or documents |
| Promotion, slab | An offer with conditions, actions, limits and budget (existing); a band of an offer |
| Coupon | A code that grants a promotion (existing) |
| Campaign | A window and budget that groups promotions (existing) |
| Gift card | Stored value with an append-only ledger (existing) |
| Guard | A check of a line's discount, margin or cost floor, with its action |
| Guard override | A recorded decision to confirm a line a guard blocks |
| Price change | An entry of the price history |
| Price proposal | A draft list produced by an agent or user from a goal, with its impact |
| Margin leak | A recorded line sold below a floor or beyond a cap |
| Exchange rate, price preference | Currency conversion and tax-inclusivity presentation (existing) |

## 6. Out of Scope

- Loyalty programmes and points → `point-of-sale-and-loyalty`; coupons and gift cards at the register →
  `point-of-sale-and-loyalty`.
- Tax rates, tax categories and tax-inclusive calculation → `tax-engine`.
- Supplier terms (supplier codes, supplier prices, pack sizes, lead times) and purchase agreements → `procurement`;
  exchange-rate feeds and revaluation → `general-ledger`.
- Valuation rates → `stock-ledger-and-valuation`; document lines, flows and their storage →
  `business-document-engine` and each document's spec.
- Item master data → `item-catalogue`; campaign audiences and sends → `marketing-campaigns`.
- Prices per lot or batch → `serials-and-batches`.

## 7. Acceptance Criteria

- [ ] **AC-1** A selling list scoped to a group and a region wins only for that group and region; the chain customer → group
      → channel → default chooses the list; a missing price falls back when allowed (FR-6, FR-9).
- [ ] **AC-2** Tiers, order multiples and supplier pack sizes, markup on cost and price endings resolve as specified; bulk
      upload reports failed rows (FR-12–FR-14).
- [ ] **AC-3** Rules match on item, group, brand, customer, quantity and amount bands, cumulative windows and hours; free-item
      rules with "every N" and rounding add marked free lines; slabs refuse overlaps (FR-25–FR-27).
- [ ] **AC-4** Rules are applied and removed as quantities change; "ignore pricing rules" skips them and refuses coupons (FR-32, FR-33).
- [ ] **AC-5** Coupon uses are counted on confirmation, returned on cancellation, safe under concurrency (FR-38).
- [ ] **AC-6** Guards warn or block per setting; an override is recorded; rate stickiness warns or blocks along the flow (FR-41–FR-43).
- [ ] **AC-7** Why this price (advanced): the trace names every candidate list, rule and guard with reasons (FR-21).
- [ ] **AC-8** Simulation and impact (advanced): a draft compares line by line and replays 90 days with totals (FR-22, FR-23).
- [ ] **AC-9** Agents (advanced): a proposal lands as a draft list with impact and cannot be activated by the agent (FR-47).
- [ ] **AC-10** Margin leaks (advanced): the sweep records each finding once and sends one Inbox item per run (FR-48, FR-49).
- [ ] **AC-11** Real time (advanced): an activated list re-prices an open register within 2 seconds (FR-50).
- [ ] **AC-12** The six reports of FR-53 run with filters and export.
- [ ] **AC-13** Existing routes answer `404` when their feature is off; tenants with gift cards, tiers or foreign prices keep
      them; new routes answer `404` with `FEATURE_PRICING_RULES` off (FR-1–FR-3).
- [ ] **AC-14** Works on PostgreSQL, MySQL and SQLite with both ORMs; every functional requirement has a passing test (§4).
- [ ] **AC-15** With `FEATURE_PRICING_RULES` off, a cart, a subscription price and the existing resolve route give the
      same prices as before for a customer with their own list and a group with a discount; with it on and no guard,
      stickiness or pack setting saved, documents save and confirm as before (pack and multiple differences warn only) (FR-3).
- [ ] **AC-16** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today, apart from the feature codes that guard their routes, which are switched on for every tenant that holds their data (FR-1, FR-2).

## 8. Open Questions

- Gating tiers, multi-currency and gift cards changes behaviour for tenants that did not use them; default: wire the
  checks with the data-driven switch-on of FR-2.
- Discount base for stacked rules: default "after earlier discounts", the current behaviour of the promotion engine.
- Pricing rule priority range: default the existing integer priority (higher wins).
- Nudge threshold default: 20 % of the band, per rule.
- Special-price rules never delete prices, so removing a rule needs no item price first; default applied.

## 9. Constitution Gates

- [x] I Plugin-first — changes in the existing `pricing` and `promotion` plugins; screens in new `pricing-ui` and
      `promotion-ui` plugins.
- [x] II Tenant/organization scoping — every record and resolution is tenant and organization scoped.
- [x] III Both ORMs, additive migrations — new tables and nullable columns, tri-dialect.
- [x] IV Default-off flag; nothing removed — `FEATURE_PRICING_RULES` off; existing types, actions and routes kept;
      FR-2 keeps capabilities tenants use.
- [x] V Contracts and API first — contracts in `@gauzy/contracts`; one pricing call for every document.
- [x] VI Permissions, privacy, security — permission per action; override audited; AI proposals cannot activate.
- [x] VII Real-time through the event bus — outbox events and real-time pushes (FR-50, FR-51).
- [x] VIII i18n and accessibility — keys in every locale; accessible grids.
- [x] IX Tests accompany the change.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md) · Builds on: `../item-catalogue/`; used by
  `../sales-order-management/`, `../procurement/`, `../invoicing-receivables-payables/`,
  `../point-of-sale-and-loyalty/`; uses `../business-document-engine/`, `../realtime-channel/`, `../inbox/`,
  `../ai-agents-and-assistants/`, `../report-builder-and-dashboards/`
- Code: `packages/plugins/pricing`, `packages/plugins/promotion`, `packages/core/src/lib/rule`,
  `packages/core/src/lib/adjustment`, `apps/api/src/plugin-composition.ts`
