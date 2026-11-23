# Feature Specification: Payment gateways

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `payment-gateways`
**Branch**: `feat/payment-gateways`
**Status**: `Draft`
**Created**: 2026-11-16
**Last updated**: 2026-11-23
**Owner**: evereq
**Feature flag**: `FEATURE_PAYMENT_GATEWAY` (existing code, default off, depends on `FEATURE_PAYMENT`) · the
gateway modules load only when `GAUZY_PAYMENT_GATEWAYS_ENABLED` is exactly `true` · each provider adapter plugin has
its own `PAYMENT_PROVIDER_<KEY>_ENABLED` · provider callback routes are never hidden by the tenant feature

---

## 1. Overview

Today the payment plugin has a provider registry per organization (test mode, currencies, countries, methods,
availability rules; credentials kept in the integration settings), payment collections for orders and carts, sessions
(one attempt per provider, off-session with a saved instrument), append-only captures, refunds with approval, a provider
callback log with a replay guard and reprocessing, and saved instruments under a party's account at a provider. All of it
is API-only and **no adapter talks to a provider**: the one working online path is the signed connector an organization
runs itself, offered on a public invoice page. This feature adds the **adapter contract** and ships the
signed connector and a sandbox as the first adapters; **checkout** for anything payable (invoices, pay links, orders and
carts, subscription cycles, forms, register sales) as a hosted page, an embedded form, a redirect, a wallet, a phone
prompt or a card terminal, with result pages; **provider callbacks** turned into session, capture, refund, dispute and
instrument states; **saved instruments and mandates**; **merchant-initiated charges** for subscriptions and instalments;
**refunds** through providers; **disputes**; and **payouts and settlements**, where a marketplace seller payout keeps
its own record and approval in the goods marketplace. Recording and allocating the money stays with
`payments-and-collections`. Clients: the Angular app, Gauzy's public pages, sites built with Ever Works through the
checkout endpoints, the MCP server and the SDKs.

**Advanced capabilities.** **Routing rules** pick a provider per currency, country, amount, method and
channel, prefer the cheapest by its fee table and **fail over** on a retryable decline; saved cards stay valid through
**network tokens and automatic updater notices**; a dispute gets an **evidence pack assembled from the records**
(invoice, delivery, tracked time, messages, accepted terms) for a person to submit before the deadline; and **decline
insights** explain failure spikes by provider, method and reason to people and agents. Marked `(advanced)`.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** an administrator with `PAYMENT_PROVIDERS_CREATE`, **when** they add a card account through its adapter in test
  mode with currencies, clearing bank account and default for EUR invoices, **then** the credentials are checked, the
  account shows "verified, test mode", and its secrets are never shown again.
- **Given** a customer on an invoice's pay link, **when** they pay by card on the hosted page, **then** they land on the
  success page, the session is captured once and `payments-and-collections` records and allocates the payment.
- **Given** a customer who pays by bank redirect and closes the browser, **when** the provider confirms an hour later,
  **then** the payment is recorded from the callback alone.
- **Given** a subscriber with a saved card or an active debit mandate, **when** the billing run charges a cycle, **then**
  the charge runs off-session, and a soft decline is retried on `subscription-billing`'s schedule.
- **Given** a clerk with `REFUNDS_CREATE`, **when** they refund 30.00 of a 100.00 card payment, **then** the provider refund
  runs, succeeds on the callback, and 70.00 remains refundable.
- **Given** a register with a card terminal, **when** the cashier starts a terminal payment, **then** the sale is marked
  paid when the provider reports it.
- **Given** a chargeback, **when** the finance user opens it, **then** an evidence pack with the invoice, delivery
  confirmation, accepted terms and the customer's messages waits for review before the deadline. `(advanced)`
- **Given** routing "EUR cards → account A, else B; fail over", **when** A fails a saved-card charge with a provider
  fault, **then** it is tried once at B and the attempt chain shows on the session. `(advanced)`

### 2.2 Edge cases & failures

- **Given** a user without the permission, **then** the routes answer `403`; with the feature off the new routes answer
  `404`, the signed invoice connector and the provider registry behave as today, and callbacks are still recorded.
- **Given** a checkout in a currency no enabled account of the channel accepts, **then** it is refused before the customer
  leaves, naming the currencies offered.
- **Given** an amount below the provider's minimum or above a mobile prompt's per-request limit, **then** the first is
  refused and the second is split into several prompts with their total shown before sending.
- **Given** a callback with a bad signature, **then** it is kept in the callback log as failed and nothing changes; the
  same callback delivered twice is acknowledged and processed once.
- **Given** a capture reported after the session was cancelled, **then** the money is recorded and a person is asked to
  refund or accept it.
- **Given** a refund above what remains captured, **then** it is refused; above the creator's limit it waits for approval.
- **Given** a provider unreachable at checkout, **then** the payer sees the other methods, or a retry message.
- **Given** an expired or revoked instrument, **then** off-session charges are refused before the provider is called.

## 3. Functional Requirements

### 3.1 Scope, flags and compatibility

- **FR-1** The system loads this feature only when `GAUZY_PAYMENT_GATEWAYS_ENABLED` is exactly `true` and gates every new
  route, menu entry and MCP tool with `FEATURE_PAYMENT_GATEWAY`, a tenant feature that depends on `FEATURE_PAYMENT`;
  off, the new routes answer `404`.
- **FR-2** The system keeps the provider registry, collections, sessions, captures, refunds, callback log, saved
  instruments and the signed invoice connector working as today, and never hides a provider callback route behind a
  tenant feature.
- **FR-3** The system never receives, stores or logs card numbers, security codes or full bank account numbers; a
  payload carrying them is refused as today.
- **FR-4** The system hands every captured, refunded or reversed amount to `payments-and-collections` to record and
  allocate; without it, invoice payments are recorded as the signed connector does today.
- **FR-5** The system only adds routes, fields and values to existing contracts; nothing is renamed or removed.

### 3.2 Provider accounts

- **FR-6** A user with `PAYMENT_PROVIDERS_CREATE` can add a provider account through a loaded adapter: label,
  credentials (stored in the integration settings, never returned), test mode, currencies, countries, methods, channels
  (invoices and pay links, order checkout, register, subscriptions, forms, portal) and display order.
- **FR-7** The system checks credentials with the provider on save and on demand, shows the result and the mode the keys
  belong to, and refuses live keys on an account in test mode and the reverse.
- **FR-8** A user with `PAYMENT_PROVIDERS_EDIT` can map an account to the organization's clearing cash or bank account,
  mark it default per channel and currency, set the description shown at checkout and on the payer's statement, and set
  its fee table (fixed plus percent per method and region).
- **FR-9** The system lets one organization hold several accounts of one adapter (per currency or business line) and
  resolves the account for a checkout by channel, currency, then default.
- **FR-10** The system refuses a checkout, request or charge in a currency the chosen account does not accept, and
  enforces the provider's minimum and maximum amounts per currency that the adapter declares.
- **FR-11** The system keeps availability rules on accounts as today (rule rows by amount, currency, country, party
  group) and shows the reason an account was not offered.
- **FR-12** The system lists loaded adapters with their methods, capabilities and currencies before credentials are asked,
  and lists them with their accounts' health in the integration hub's one connector catalogue when that feature is on.
- **FR-13** A user with `PAYMENT_PROVIDERS_DELETE` can retire an account: it stops being offered, its sessions,
  instruments and history stay, and callbacks for it keep being processed.

### 3.3 Adapters

- **FR-14** The system defines one adapter contract for: checkout session (hosted page, embedded form, redirect,
  wallet, bank redirect, phone prompt, terminal), authorise, capture (full, partial), void, off-session charge, refund
  (full, partial), saving an instrument or mandate, callback verification and parsing, status query, payouts and
  settlement reports; an adapter declares which it supports.
- **FR-15** The system ships the existing signed connector as an adapter (an organization-hosted service holding the
  provider keys) and a sandbox adapter that simulates success, decline, delayed confirmation, dispute and refund.
- **FR-16** The system loads provider adapters as separate plugins, each off unless its switch is on, so a deployment
  carries only the adapters it uses.
- **FR-17** The system converts amounts to and from each provider's smallest unit by currency precision, and keeps the
  provider's own references on sessions, captures, refunds, disputes and payouts.
- **FR-18** The system queries an adapter for a session's status when a callback is late (after 15 minutes, then hourly
  for 24 hours) for adapters that support it, and settles the session from the answer.
- **FR-19** The system logs every provider call (outcome, duration, redacted bodies) in the integration call log.

### 3.4 Checkout

- **FR-20** The system offers a checkout contract to other features: payable source (type and id), party, amount,
  currency, lines or items chosen, description, channel, return addresses, allowed methods, and whether to save the
  instrument; it answers the methods available and, after the choice, the address, form data or prompt to show.
- **FR-21** The system creates one collection per payable source and amount, and one session per attempt; a new attempt
  for the same source supersedes an open one without double charging.
- **FR-22** The system provides hosted result pages (paid, pending, failed, cancelled) in the payer's language with the
  organization's branding and a link back to the source, used when the caller gives no return address.
- **FR-23** The system lets `payments-and-collections`' pay page, the invoice public page, the existing order checkout, subscribe
  links and the portal start a checkout; the Angular public invoice page gains the Pay button where a provider is set.
- **FR-24** The system lets a hosted form of `lead-capture-and-enrichment` or a page of another feature take a payment of
  a fixed amount or an amount from a submitted field, returning the checkout address to send the visitor to; amounts
  must be positive.
- **FR-25** The system offers an embedded payment form component for the Angular app, the portal and Gauzy's public
  pages that loads the provider's own fields, so card data goes from the browser to the provider only; sites built with
  Ever Works send the payer to the hosted page or redirect address the checkout answers.
- **FR-26** The system sends a phone payment prompt for adapters that support it, splits an amount above the
  per-request limit into several prompts, and matches the provider's result to the prompt by a single-use secret when the
  provider does not sign its callbacks.
- **FR-27** A user with `PAYMENT_TERMINALS_MANAGE` can pair card terminals with a register or location; a terminal
  payment shows its progress on the register and can be cancelled before the card is presented.
- **FR-28** The system expires an unpaid checkout after its provider's window (default 24 hours), releases its
  reservation, and lets the payer start again.
- **FR-29** The system shows the payer only the methods of accounts available for that channel, currency, country and
  amount, ordered by the organization's display order or by routing (FR-66).
- **FR-30** The system marks test-mode payments everywhere and never hands them on as real money.

### 3.5 Provider callbacks

- **FR-31** The system receives provider callbacks on one public route per account, stores each before judging it (as
  today), verifies its signature, and maps its type through the adapter to a platform outcome; unknown types are
  ignored, not failed.
- **FR-32** The system processes each callback once by the provider's event id, in the background, and answers the
  provider at once.
- **FR-33** The system applies outcomes to sessions, captures, refunds, disputes, instruments, mandates and payouts in
  order of the provider's event time, ignoring an older state after a newer one.
- **FR-34** A user with `PAYMENT_CALLBACKS_REPROCESS` can reprocess a failed or ignored callback from the screen; a
  processed one needs the existing force option.
- **FR-35** The system alerts payment administrators when callbacks of an account fail five times in a row or stop for
  24 hours while sessions are open.
- **FR-36** The system publishes money events (FR-78) so ledgers, orders, subscriptions and automations react to them.

### 3.6 Authorisation and capture

- **FR-37** The system lets an account capture at once or authorise first, per channel; an authorised session is
  captured in full or in parts within the provider's window, by a person with `PAYMENT_SESSIONS_CAPTURE` or
  automatically on an event the channel names (order shipped, service delivered).
- **FR-38** The system voids authorisations uncaptured at the window's end and tells the source's owner.
- **FR-39** The system keeps captures append-only and the collection's rule (captured plus cancelled never above
  authorised, refunded never above captured) on every change.

### 3.7 Saved instruments and mandates

- **FR-40** The system saves an instrument when the payer agrees at checkout, in the portal or through a set-up session,
  keeping only the provider's reference, kind, brand, last four, expiry and holder name.
- **FR-41** The system supports bank debit mandates: a set-up flow at the provider, mandate states (pending, active,
  failed, cancelled), and charges only on active mandates, with the provider's earliest charge date shown.
- **FR-42** A party in the portal and a user with `PAYMENT_METHOD_TOKENS_EDIT` can list, set the default, replace and
  revoke instruments; revoking also removes the instrument at the provider where supported.
- **FR-43** The system marks instruments expiring in 30 days, asks the party once to update them, and expires them at the
  end of their month.
- **FR-44** The system publishes "instrument replaced" when a party replaces an instrument used by subscriptions or
  instalment plans, so they retry at once.
- **FR-45** The system records the payer's consent to future charges (text, time, channel, scope) with the instrument.
- **FR-46** The system keeps one account per party, provider and organization, as today.

### 3.8 Merchant-initiated charges

- **FR-47** The system charges a saved instrument off-session for a subscription cycle, an instalment, an order or a
  payment request when its owner feature asks, with the original consent reference and an idempotency key.
- **FR-48** The system classifies declines as retryable, needs the payer, or final, from the adapter's codes, and tells
  the caller which; retry schedules belong to the caller.
- **FR-49** The system sends the payer a secure link to complete a charge that needs their confirmation, and completes the
  charge when they do.
- **FR-50** The system can create provider-managed recurring plans for adapters that require them, mirroring the
  subscription's price reference that `subscription-billing` keeps, and forwards their callbacks to the subscription.
- **FR-51** The system refuses off-session charges on expired, revoked or failed instruments before calling the provider.

### 3.9 Refunds

- **FR-52** A user with `REFUNDS_CREATE` can refund a captured payment in full or in part from the payment, the order, the
  invoice or the subscription cycle, up to what remains captured, with a governed reason.
- **FR-53** The system runs approved refunds through the original account's adapter, states pending until the provider
  confirms, and marks failed refunds with the provider's reason for a person to retry or pay out otherwise.
- **FR-54** The system keeps the existing approval above a limit (`REFUNDS_APPROVE`) and never lets the creator approve
  their own refund.
- **FR-55** The system hands each succeeded refund to `payments-and-collections` as money out allocated to the credit it
  repays.

### 3.10 Disputes

- **FR-56** The system records disputes the provider reports (inquiry, chargeback, pre-arbitration) on the capture: amount,
  reason, evidence deadline, state and outcome.
- **FR-57** The system alerts payment administrators and the source's owner when a dispute opens and 3 days before its
  deadline, and holds a delivery or service not yet fulfilled for an order under dispute when the organization chooses.
- **FR-58** A user with `PAYMENT_DISPUTES_MANAGE` can accept a dispute or submit evidence (files and text) through the
  adapter before the deadline.
- **FR-59** The system hands lost disputes and their fees to `payments-and-collections` and the ledger as reversals.

### 3.11 Payouts and settlements

- **FR-60** The system imports each account's settlement payouts (arrival date, amount, currency, status) with their lines
  (captures, refunds, fees, dispute amounts, adjustments) from the adapter, daily and on callbacks.
- **FR-61** The system matches payout lines to captures and refunds, shows unmatched lines, and publishes each payout for
  `banking-and-reconciliation` to match the bank line and for the ledger to post fees; a provider's report on a
  marketplace seller's settlement goes to the marketplace's seller settlement with its difference.
- **FR-62** The system pays out to a party's bank instrument at a provider (seller payouts, employee reimbursements,
  refunds to bank) when the owning feature asks, with a payout state and the provider's reference; a seller payout stays
  the marketplace's payout record and receives the provider's reference, transfer and outcome.
- **FR-63** The system requires `PAYMENT_PAYOUTS_APPROVE` from a person other than the requester for payouts above the
  organization's limit; a seller payout already approved in the marketplace is not approved a second time.
- **FR-64** The system reads an account's available and pending balance where the adapter can.
- **FR-65** The system computes the expected fee of each capture from the account's fee table and flags payouts whose
  fees differ by more than 1 %.
- **FR-83** The system records a settlement that an outside sales channel reports through a commerce connection (amount,
  arrival date, order, refund, fee and adjustment lines) as a payout of that connection in the same payout and line
  model as provider settlements, so bank matching and fee posting treat it alike; recording the same settlement twice
  changes nothing.

### 3.12 Routing and failover `(advanced)`

- **FR-66** A user with `PAYMENT_ROUTING_MANAGE` can define routing rules (conditions on channel, currency, country,
  amount band, method, party group; an ordered list of accounts), tried in order, with a fallback rule.
- **FR-67** The system picks, among the accounts a rule allows, the one with the lowest expected fee when the rule asks for
  cost-aware choice, and shows the choice and its reason on the session.
- **FR-68** The system retries an off-session charge declined as retryable by a provider fault (not by the payer's bank)
  once at the next account of the rule, with a new idempotency key linked to the first, never for final declines.
- **FR-69** The system takes an account out of routing for 10 minutes after 5 provider faults in 2 minutes and tells the
  administrators.

### 3.13 Instruments that stay valid `(advanced)`

- **FR-70** The system stores network tokens for cards where the adapter offers them and charges with them, keeping the
  displayed brand and last four.
- **FR-71** The system applies card updater notices (new expiry, new last four, closed account) from the adapter to the
  instrument, records each change, and publishes "instrument replaced" for closed ones replaced by the party.
- **FR-72** The system reports how many charges updater notices and network tokens saved per period.

### 3.14 Dispute evidence packs `(advanced)`

- **FR-73** The system assembles an evidence pack for a dispute from the records linked to the payment: invoice and
  order PDFs, delivery or shipment confirmation, tracked time and its approvals for services, accepted terms with time and
  address, the customer's messages and the refund policy.
- **FR-74** A user with `PAYMENT_DISPUTES_MANAGE` reviews, edits and orders the pack, which is never submitted without them,
  and the assistant drafts the summary text from the pack's facts only.
- **FR-75** The system records the outcome per reason and evidence kind and reports win rates by both.

### 3.15 Decline insights `(advanced)`

- **FR-76** The system groups failed attempts by account, method, country, reason and bank response hourly, flags a rise
  above twice the 7-day rate, notifies the administrators with the group and its probable cause, and exposes the same to
  agents.

### 3.16 API, events, agents and reports

- **FR-77** The system exposes every capability through REST with GraphQL reads; checkout, charge, refund and payout
  routes take idempotency keys.
- **FR-78** The system publishes events with ids and amounts only for checkout completed, session authorised, captured,
  failed, voided, refunded, disputed, instrument saved, expiring, replaced and revoked, payout paid and failed, and
  settlement reported.
- **FR-79** The system offers MCP tools to list accounts and adapters, start a checkout link, read sessions and payments,
  refund and capture (preview first), list and answer disputes (preview), list payouts and read decline insights; an
  agent never approves a refund or payout it requested.
- **FR-80** The system lets `point-of-sale-and-loyalty`, `subscription-billing`, `payments-and-collections`,
  `sales-order-management`, `commerce-connectors`, `learning-management`, the marketplace and the plugin registry (plugin plans sold inside one
  installation as subscription plans) use checkout, charges, refunds and payouts through one in-process contract.
- **FR-81** The system keeps all provider amounts in exact decimals with their currency and the organization currency
  amount at the rate of the capture day.
- **FR-82** The system registers these report definitions:

  | Report | Answers |
  |---|---|
  | Online payments | attempts, captures and amounts per account, method, channel and outcome |
  | Declines | failed attempts by reason, method, country and account; retry and failover results |
  | Refunds | refunds by reason, account, approver and state |
  | Disputes | disputes by reason, outcome, amount, deadline and evidence kind |
  | Payouts and fees | payouts with lines, expected and actual fees, unmatched lines |
  | Saved instruments | instruments by kind and state, expiring, updated by notices |

## 4. Non-Functional Requirements

- **Performance**: checkout methods within 300 ms P95; sessions within 2 s P95 besides the provider's time; callbacks
  acknowledged within 200 ms and applied within 5 s P95; 100 callbacks per second per API instance.
- **Volume**: 10 million sessions and 20 million callbacks per tenant per year; 500 accounts per tenant.
- **Reliability**: callbacks stored before processing and deduplicated; status queries settle late callbacks; no capture
  recorded twice; charges idempotent per key.
- **Security & privacy**: no card or full bank data on the platform; credentials in integration settings, never
  returned; signatures verified; result pages expose only the payer's own checkout. Leaves the platform: amounts,
  currency, payer name, email and billing address to the chosen provider; evidence packs when a person submits them.
- **Auditability**: who, when, before and after for accounts, routing rules, refunds, captures, dispute answers and payouts.
- **Accessibility and localisation**: result pages and embedded forms in the payer's language, keyboard operable.
- **Compatibility**: PostgreSQL, MySQL, SQLite; both ORMs; cloud and self-hosted, with or without a queue; OpenAPI
  additive; SDKs regenerated.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| Provider account | The existing provider registration, now with adapter, channels, clearing account, defaults and fees |
| Adapter | A plugin that speaks to one provider through the platform's contract |
| Checkout | A payer's attempt to pay one payable source, built from a collection and its sessions |
| Session, capture | One attempt at one provider; money actually taken (existing) |
| Callback | A provider's notification, stored before it is judged (existing log) |
| Saved instrument, mandate | A party's card, wallet or bank reference at a provider; a debit authorisation on it |
| Terminal | A card reader paired with a register or location |
| Refund | Money returned through the provider (existing) |
| Dispute, evidence pack | A payer's challenge reported by the provider; the documents answering it |
| Payout, settlement line | Money moved by the provider to the organization or a party; its components (a seller payout is the marketplace's record) |
| Routing rule | Which accounts serve which payments, in which order, with failover |

## 6. Out of Scope

- Recording payments, allocation, pay links and requests, dunning, receivable disputes: `payments-and-collections`.
- Subscription cycles, retry schedules and provider price references: `subscription-billing`.
- Matching bank lines and statements: `banking-and-reconciliation`. Ledger postings: `general-ledger`.
- The register selling screen: `point-of-sale-and-loyalty`. Form design:
  `lead-capture-and-enrichment`. Seller payout records, their approval and seller settlements: the `marketplace`
  plugin. Paid marketplace apps and publisher payouts: the Ever Platform spec `app-installs-and-licensing`.

## 7. Acceptance Criteria

- [ ] **AC-1** A provider account through the sandbox adapter is verified, mapped to a clearing account and defaulted per
      channel and currency; secrets never come back (FR-8, FR-31).
- [ ] **AC-2** An invoice paid through its pay link on the hosted page is captured once, recorded and allocated by
      `payments-and-collections`; a late bank-redirect callback alone records it (FR-22, FR-23).
- [ ] **AC-3** The signed connector works as an adapter exactly as today's invoice connector (FR-15).
- [ ] **AC-4** Currency, minimum and maximum checks refuse before the payer leaves; a phone prompt splits above its limit (FR-10, FR-26).
- [ ] **AC-5** Duplicate and out-of-order callbacks change state once and in event order; a bad signature changes nothing (FR-32, FR-33).
- [ ] **AC-6** Authorise then capture in parts works; uncaptured authorisations are voided at the window's end (FR-37, FR-38).
- [ ] **AC-7** A saved card and a direct debit mandate are set up, charged off-session for a subscription cycle, and an
      expired instrument is refused before the provider is called (FR-41, FR-47).
- [ ] **AC-8** A partial refund runs through the provider, needs approval above the limit, and never exceeds the capture (FR-53, FR-54).
- [ ] **AC-9** A dispute opens with its deadline, alerts, and is answered with a pack assembled from records (advanced:
      evidence packs) (FR-57, FR-73–FR-75).
- [ ] **AC-10** Settlement payouts import with lines, match captures, flag fee differences and reach bank matching; a
      marketplace-approved seller payout runs once at the provider, with no second approval, and its outcome lands on the
      seller payout; a channel settlement recorded twice through a commerce connection gives one payout (FR-83).
- [ ] **AC-11** Routing picks the cheapest allowed account and fails over once on a provider fault, never on a final
      decline (advanced: routing; FR-67, FR-68).
- [ ] **AC-12** Updater notices change expiry and last four; network tokens are used for charges (advanced; FR-70–FR-72).
- [ ] **AC-13** A decline spike raises an insight with its group (advanced: decline insights; FR-76).
- [ ] **AC-14** The six reports of FR-82 return correct figures on seeded data.
- [ ] **AC-15** Feature off: `404` on new routes; callbacks still recorded; the signed connector behaves as before; works
      on PostgreSQL, MySQL and SQLite with both ORMs; every functional requirement has a passing test (FR-1, FR-2).
- [ ] **AC-16** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-1).

## 8. Open Questions

- Provider adapters for named providers ship as separate plugins after the sandbox and signed connector.
  Default applied: first one card acquirer, one bank debit, one wallet or phone payment.
- Automatic capture on an order event is off by default per channel. Default applied.
- Failover retries only off-session charges, never a payer in a checkout. Default applied.
- Disputed orders are not held automatically. Default applied: the organization opts in.

## 9. Constitution Gates

- [x] I Plugin-first — gateway modules in the existing `payment` plugin; adapters as separate plugins; UI in the payment
      UI plugins.
- [x] II Tenant/organization scoping — accounts, sessions, instruments, disputes, payouts and rules are scoped; public
      pages resolve one checkout by token.
- [x] III Both ORMs, additive migrations — new tables and nullable columns on three dialects.
- [x] IV Default-off flag; nothing removed — deploy switch, `FEATURE_PAYMENT_GATEWAY`, adapter switches; the registry,
      the connector and the callback intake stay.
- [x] V Contracts and API first — adapter and checkout contracts, REST and GraphQL reads before screens.
- [x] VI Permissions, privacy, security — permission keys, two-person refunds and payouts, no card data, signed callbacks.
- [x] VII Real-time through the event bus — outbox events; checkout and terminal progress on the push channel.
- [x] VIII i18n and accessibility — result pages and forms in the payer's language, keys in every locale.
- [x] IX Tests accompany the change — sandbox adapter scenarios, callback ordering, both ORMs and dialects.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Works with: [`payments-and-collections`](../payments-and-collections/spec.md),
  [`subscription-billing`](../subscription-billing/spec.md), [`banking-and-reconciliation`](../banking-and-reconciliation/spec.md),
  [`point-of-sale-and-loyalty`](../point-of-sale-and-loyalty/spec.md), [`integration-hub`](../integration-hub/spec.md),
  [`email-and-communications`](../email-and-communications/spec.md)
- Code: `packages/plugins/payment/src/lib/{payment-provider,payment-collection,payment-session,payment-capture,refund,
  payment-webhook-event,payment-account-holder,payment-method-token,invoice-payment}`, `packages/core/src/lib/{payment,
  payment-account-holder,payment-method-token,payment-instrument,rule}`,
  `packages/plugins/marketplace/src/lib/{seller-payout,seller-settlement}`
