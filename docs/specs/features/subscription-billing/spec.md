# Feature Specification: Subscription billing

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `subscription-billing`
**Branch**: `feat/subscription-billing`
**Status**: `Draft`
**Created**: 2026-11-15
**Last updated**: 2026-11-23
**Owner**: evereq
**Feature flag**: `FEATURE_SUBSCRIPTION` (existing, default off) for plans, subscriptions and billing history; `FEATURE_SUBSCRIPTION_BILLING` (existing, default off) for the scheduled billing run and automatic charges

---

## 1. Overview

An organization sells, or buys, the same thing again on a schedule. A **plan** says what recurs, at which price and
cadence; a **subscription** binds a customer (or a supplier, for what the organization pays) to plans from a start
date, with a trial, a discount, payment terms and a way to collect; every due **billing cycle** becomes exactly one
invoice (or supplier bill draft), prorated when the subscription changed inside the period, with usage charged in
arrears. This feature finishes the existing `subscription` plugin (plans, subscriptions, items, billing cycles,
proration, pause, resume, cancel, retries) which today is reachable only through the API, bills only on demand and
only through a stored payment instrument: it adds the scheduled billing run, collection by invoice and due date,
grace and suspension, supplier subscriptions, screens in the Gauzy app, MCP tools, and it joins the existing
recurring invoices for billable time (`invoice schedules`) to the same page and model. Clients: Gauzy app, customer
portal, REST and GraphQL API, SDKs, MCP server.

**Advanced capabilities.** Usage metering with idempotent events and built-in meters for tracked time and seats;
retainers that include hours and bill the overage from time logs billed exactly once; a preview of every change
with the exact credit, charge and next invoice before it is confirmed; an immutable change history; self-service
in the customer portal; revenue schedules linked to each cycle; recurring-revenue, churn and cohort analytics kept
daily; a billing forecast; and agents that prepare a run, explain an invoice and rank churn risks.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** a billing manager with the monthly plan "Support Standard" (collected by invoice, 14 days until due),
  **when** they create a subscription for a customer starting on the 10th with a 14-day trial, **then** the
  subscription shows "in trial until the 24th", nothing is invoiced, and three days before the 24th the customer
  receives the trial-ending notice.
- **Given** that subscription after its trial, **when** the hourly billing run passes the 24th in the
  organization's time zone, **then** one confirmed invoice for the first period exists with the service period on
  its line, due 14 days later, linked from the subscription's billing history, and running again creates nothing.
- **Given** an active subscription with 5 seats on the 12th of a 30-day period, **when** the manager opens "Change
  quantity" and enters 8, **then** before confirming they see the credit, the charge, the net amount for the 18
  remaining days and the next invoice; **when** they confirm, **then** exactly those amounts are billed and the
  change appears in the change history with their name.
- **Given** a plan with a usage component "API calls" (10,000 included, then per 1,000), **when** the customer's
  system reports usage events during the month (some twice), **then** each event counts once, the portal shows
  current usage and projected charge, and the next invoice carries the overage with a usage statement.
- **Given** a retainer plan "20 hours a month", **when** the team tracks 26 billable hours on the customer's
  projects, **then** the cycle invoice bills the retainer plus 6 overage hours, and those time logs can no longer
  be billed by a manual invoice or an invoice schedule.
- **Given** an invoice of a subscription unpaid after its due date, **when** the grace period of 7 days ends,
  **then** the subscription becomes suspended, an event tells entitled services, the open item stays with
  collections, and paying the invoice returns the subscription to current.
- **Given** a customer signed in to the portal, **when** they choose "Cancel", **then** they pick a reason, are
  offered the configured retention option once, and on confirmation the subscription ends at the period end and the
  team is notified.
- **Given** the organization rents software from a supplier yearly, **when** the renewal date approaches, **then**
  the owner is reminded 30 days ahead, and at renewal a supplier bill draft with the expected amount is created.
- **Given** a finance lead, **when** they open the analytics page, **then** they see monthly recurring revenue with
  its new, expansion, contraction and churned parts per month, churn rates, cohorts and the 12-month billing
  forecast, each drillable to the subscriptions behind it.

### 2.2 Edge cases & failures

- **Given** a user without `SUBSCRIPTIONS_BILL`, **when** they start a run or bill a cycle, **then** `403`; with
  `FEATURE_SUBSCRIPTION` off every route of the feature answers `404`.
- **Given** `FEATURE_SUBSCRIPTION_BILLING` off, **when** the schedule fires, **then** nothing is billed for that
  tenant; a person can still bill a cycle or start a run by hand.
- **Given** two runs overlapping, **when** both reach the same subscription and period, **then** one bills it and
  the other reports it as skipped.
- **Given** a run of 2,000 subscriptions where 15 fail (no tax regime resolved, plan item archived), **when** it
  ends, **then** 1,985 are billed, the 15 are listed with reasons and retried by the next run, and billing users
  are notified once.
- **Given** a subscription whose start date is in the future, **when** someone tries to bill it, **then** the
  request is refused naming the start date.
- **Given** a change preview shown at 10:00, **when** a colleague changes the same subscription at 10:02 and the
  first user confirms at 10:03, **then** the confirmation is refused with `409` and a fresh preview.
- **Given** an automatic charge that fails, **when** the retry schedule is exhausted, **then** the subscription is
  marked failed, nothing bills it again until a person acts, and updating the payment instrument retries at once.
- **Given** the invoice date falls in a locked accounting period, **when** the cycle is billed, **then** the invoice
  is dated on the first open day and flagged, or the cycle is held, per organization setting.
- **Given** usage reported after the cycle's invoice was confirmed, **when** it arrives, **then** it is billed as an
  adjustment line on the next invoice and marked late.
- **Given** a customer with "bill while unpaid" off and an overdue invoice, **when** the next cycle is due,
  **then** it is held and listed with its reason, and billed in order once the overdue invoice is paid.

## 3. Functional Requirements

### 3.1 Plans

| ID | Requirement |
| --- | --- |
| **FR-1** | A user with `SUBSCRIPTIONS_CREATE` can define a plan with name, code, description, currency, cadence (day, week, month, quarter or year times an interval of at least 1), optional maximum number of cycles, trial days, setup fee and recurring discount, as today; existing plans keep their meaning. |
| **FR-2** | The system MUST price a plan's recurring line by one of: the price resolved from price lists when the subscription is created and then kept; the price resolved again at each cycle; a fixed amount per period stated on the plan; or a monthly rate multiplied by the months of the period. |
| **FR-3** | A user with `SUBSCRIPTIONS_CREATE` can add components to a plan: further recurring items (add-ons) and usage components (a meter with its pricing, FR-45). |
| **FR-4** | The system MUST record, per plan and payment provider, the provider's own price reference, unique per provider, for automatic charges. |
| **FR-5** | The system MUST hold on a plan the defaults a subscription starts with: billing timing (at period start, at period end, or a number of days before the period starts), collection (charge automatically or send an invoice), calendar alignment, whether revenue is recognised over the period, and the self-service actions allowed. |
| **FR-6** | A user with `SUBSCRIPTIONS_EDIT` can create a new version of a plan with live subscriptions when its price, cadence or components change; the system MUST keep those subscriptions on their version and let such a user move selected subscriptions to the new version from a date with a preview and a customer notice; an edit through the existing plan route keeps today's effect. *(advanced)* |
| **FR-7** | The system MUST keep billing the existing subscriptions of an archived plan and, where the organization turns on refusing new subscriptions on archived plans (setting, off by default: creation behaves as today), refuse a new subscription on such a plan. |
| **FR-85** | The system MUST treat a paid plan of a plugin sold inside one installation as a plan like any other (marked with its plugin), billed, renewed, cancelled and collected the same way, and report each change of such a subscription to the plugin registry, which grants or ends access to the plugin. |

### 3.2 Subscriptions

| ID | Requirement |
| --- | --- |
| **FR-8** | A user with `SUBSCRIPTIONS_CREATE` can create a subscription for a customer with start date, optional end date, lines (plan components with quantities), currency, trial, discount (percentage or amount, for a number of cycles or without end), payment terms or days until due, analytic dimensions (a cost centre is one of them), tax treatment override, and the plan defaults of FR-5, each changeable per subscription; and a supplier subscription (FR-18) for what the organization pays on a schedule. |
| **FR-9** | The system MUST, where the organization turns on refusing mixed lines (setting, off by default), refuse a subscription whose lines do not share one cadence and one currency, naming the line that differs; with the setting off, create and update behave as today and every line bills on the subscription's cadence and currency. |
| **FR-10** | The system MUST keep the existing statuses (pending, active, paused, cancelled, expired, failed) and additionally expose whether the subscription is in trial and its collection state (current, past due, suspended). |
| **FR-11** | The system MUST charge nothing during a trial, start the first paid period when the trial ends, and let a user with `SUBSCRIPTIONS_EDIT` extend or end a trial; where the organization limits trials to one per customer and plan (setting, off by default), a further trial needs such a user's override. |
| **FR-12** | The system MUST, for a calendar-aligned subscription with a month-based cadence, start every period on the first day of a month and prorate the first partial period; otherwise periods start on the start day and a day missing in a shorter month falls on its last day. |
| **FR-13** | The system MUST keep a subscription with a future start pending and refuse to bill it before that date. |
| **FR-14** | The system MUST expire a subscription when its end date or maximum number of cycles is reached, after billing the last period it covers. |
| **FR-15** | A user with `SUBSCRIPTIONS_EDIT` can cancel a subscription at once or at the end of the current period, with an optional reason, picked from the organization's list (tags of a cancellation-reason tag type) or written freely as today, and a note; an immediate cancellation credits the unused time when proration is on; a cancellation not yet effective can be undone. |
| **FR-16** | A user with `SUBSCRIPTIONS_EDIT` can restart a cancelled, expired or failed subscription: a new period starts on the restart date on the same record, with its history kept. |
| **FR-17** | A user with `SUBSCRIPTIONS_EDIT` can pause a subscription until a date or without date and resume it; paused time is not billed, and an organization may set a maximum pause length (none by default, as today). |
| **FR-18** | The system MUST treat a supplier subscription as an obligation without a plan: supplier, own lines (item or description, quantity, expected price), cadence, start and optional end, terms, analytic dimensions and owner; no charge is ever taken, cycles create supplier bill drafts, it can be paused, resumed and cancelled, and the owner is reminded before each renewal (default 30 days for yearly, 7 otherwise); it belongs to the organization's recurring expense of that cost (created with it, or an existing recurring expense given a supplier subscription), which keeps its monthly figure in the dashboards, so a recurring cost is listed once. |
| **FR-19** | The system MUST refuse an update based on an outdated version of the subscription with `409`. |
| **FR-20** | The system MUST show a timeline per subscription: creation, trial, cycles, invoices, payments, failed charges, changes, pauses, notices sent, each with actor and time. |
| **FR-21** | The system MUST honour custom fields and saved views on plans and subscriptions. |
| **FR-22** | The system MUST import existing subscriptions with their next billing date and current period without billing past periods. |

### 3.3 Billing cycles and invoices

| ID | Requirement |
| --- | --- |
| **FR-23** | The system MUST write exactly one billing cycle per subscription and period and never bill a period twice, however often billing is attempted. |
| **FR-24** | The system MUST turn a due cycle of a customer subscription into one customer invoice linked to the cycle: directly when collection is by invoice, or through the existing order path with an automatic charge when collection is automatic; the order of an automatic cycle is also invoiced where the organization turns this on (setting, off by default, so the cycle raises its order as today). |
| **FR-25** | The system MUST put on the invoice one line per recurring line with its service period, the usage lines, proration lines, the setup fee on the first paid cycle, discounts, taxes from the tax engine, cost centre and dimensions, and a due date from the payment terms or days until due. |
| **FR-26** | The system MUST date the invoice at the period start (billing at period start), at the period end (billing at period end), or on the day it is generated the configured number of days before the period starts. |
| **FR-27** | The system MUST confirm generated invoices or leave them as drafts per subscription, and list drafts older than 3 days to billing users. |
| **FR-28** | The system MUST turn a due cycle of a supplier subscription into a supplier bill draft with the expected amount, match an incoming bill of that supplier and period to it, and flag a difference above the organization's tolerance (default 5 %). |
| **FR-29** | The system MUST, when "bill while unpaid" is off (it is on by default, as today) and an earlier invoice of the subscription is overdue, hold later cycles with the reason, and bill held cycles in order once the overdue invoices are paid. |
| **FR-30** | The system MUST set the collection state to past due when an invoice of the subscription passes its due date, and suspend or cancel the subscription when the organization's dunning policy of `payments-and-collections` reaches a level with that action (default: subscriptions collected by invoice are suspended after 7 days; subscriptions collected automatically keep today's retry path of FR-31 unless the organization adds a level for them); it returns to current when no invoice of the subscription is overdue. |
| **FR-31** | The system MUST retry a failed automatic charge on the organization's retry schedule (default the same day, then after 1, 3, 5 and 7 days), mark the subscription failed when the schedule is exhausted, and retry at once when the customer's payment instrument is replaced. |
| **FR-32** | The system MUST leave reminders and dunning of overdue subscription invoices to collections, and give it the subscription, plan, period and collection state of each such invoice. |
| **FR-33** | A user with `SUBSCRIPTIONS_BILL` can mark a cycle paid, waive it with a reason, or refund it; a refund creates a credit note and, for an automatic charge, a refund at the payment provider. |
| **FR-34** | The system MUST show per subscription its billing history (period, amount, invoice, status, attempts, held or late markers) and a calendar heat map of cycle outcomes for the last 36 months. |
| **FR-35** | The system MUST carry a proration credit to the next invoice as a negative line or issue it as a credit note at once, per organization setting (default: carried to the next invoice, as today), and bill in the subscription currency with the organization currency amounts at the invoice date's rate. |

### 3.4 Changes and proration

| ID | Requirement |
| --- | --- |
| **FR-36** | The system MUST prorate changes inside a period by day when proration is on for the organization (default on), and apply changes without credit or charge from the next period when it is off. |
| **FR-37** | A user with `SUBSCRIPTIONS_EDIT` can change plan, quantity, lines, discount or terms at once or from the next period; a plan can require that downgrades take effect only at the period end. |
| **FR-38** | The system MUST show, before any change, pause, cancellation or restart is confirmed, a preview with credit, charge, net amount, taxes, the next invoice amount and date and the effect on recurring revenue; the preview writes nothing; confirming applies exactly the previewed amounts or is refused with a new preview when the subscription changed meanwhile. *(advanced)* |
| **FR-39** | The system MUST record every change as an immutable entry: kind, values before and after, requested and effective time, actor (user, customer, agent, automation, system), amounts, reason; and report upgrades, downgrades, expansion and contraction from these entries. *(advanced)* |
| **FR-40** | The system MUST list scheduled changes of a subscription, let a user cancel one before it applies, and refuse a second scheduled change that conflicts with a pending one. |
| **FR-41** | The system MUST notify the customer of a price or plan-version change the configured number of days before it takes effect (default 30) and record the notice. *(advanced)* |

### 3.5 Usage metering *(advanced)*

| ID | Requirement |
| --- | --- |
| **FR-42** | A user with `SUBSCRIPTION_USAGE_EDIT` can define meters: code, name, unit, aggregation over the period (sum, maximum, last value, count of distinct keys) and whether the meter restarts each period. |
| **FR-43** | The system MUST accept usage events (subscription or customer, meter, quantity, time, key, attributes) singly and in bulk with per-row results, count an event with the same key once, and reject events for unknown meters or ended subscriptions with a reason. |
| **FR-44** | The system MUST provide built-in meters: tracked time (billable hours logged for the customer's projects in the period), seats (the highest or the time-weighted average number of active entitlements or portal members of the customer in the period), and a meter that automation rules can feed. |
| **FR-45** | The system MUST price a usage component per unit, with an included allowance and overage, in graduated tiers, in volume tiers or per started package of N units, with an optional minimum and maximum per period. |
| **FR-46** | The system MUST bill usage in arrears on the cycle invoice with a usage statement (per day and attribute), and show current usage and projected charge of the running period to staff and, in the portal, to the customer, updated within one minute of an event. |
| **FR-47** | The system MUST bill tracked time through the same exactly-once rule as time invoices: a time log billed by a subscription invoice cannot be billed by any other invoice until that invoice is voided. |
| **FR-48** | The system MUST notify the customer and the account owner when usage reaches 80 % and 100 % of an allowance or spending limit, and, when the plan says so, bill an interim invoice once unbilled usage exceeds an amount. |
| **FR-49** | A user with `SUBSCRIPTION_USAGE_EDIT` can void or correct usage events with a reason until the cycle's invoice is confirmed; later events and corrections are billed as adjustment lines on the next invoice. |
| **FR-50** | The system MUST support retainers: a plan includes a quantity of a meter per period, bills overage at a rate, and lets unused quantity expire or roll over up to a limit of periods. |

### 3.6 Recurring invoices for billable time

| ID | Requirement |
| --- | --- |
| **FR-51** | The system MUST keep existing invoice schedules, their runs and their API unchanged. |
| **FR-52** | The system MUST show invoice schedules and subscriptions together on one "Recurring billing" page in the Gauzy app, reached from the existing menu entry, where a user with `INVOICES_EDIT` can create, edit, pause and resume a schedule and read its run history. |
| **FR-53** | The system MUST offer quarterly and yearly cadences and an optional end day on invoice schedules. |
| **FR-54** | A user with `SUBSCRIPTIONS_CREATE` can convert an invoice schedule into a subscription with a tracked- time usage component; the schedule is paused and linked, its runs stay readable, and no period is billed twice. |
| **FR-55** | The system MUST include time priced in another currency than the subscription's by converting it at the invoice date's rate, and list the conversions on the usage statement. *(advanced)* |

### 3.7 Billing run

| ID | Requirement |
| --- | --- |
| **FR-56** | The system MUST, for tenants with `FEATURE_SUBSCRIPTION_BILLING` on and organizations that switched the scheduled run on (setting, off by default, so billing stays on demand as today), bill every hour all cycles whose billing time has passed in the organization's time zone, one run at a time per organization. |
| **FR-57** | A user with `SUBSCRIPTIONS_BILL` can start a run for an organization with an as-of date not after today and optional filters (plan, customer, subscription); the run is recorded with who started it, counts and a result per subscription (billed, failed with reason, skipped, held). |
| **FR-58** | A user with `SUBSCRIPTIONS_BILL` can preview a run: the cycles it would bill with amounts, and those it would hold or fail with reasons; a preview writes nothing. |
| **FR-59** | The system MUST refuse to process a cycle or subscription dated in the future. |
| **FR-60** | The system MUST continue a run past a failing subscription, retry failed cycles in the next run, and notify holders of `SUBSCRIPTIONS_BILL` once per run with failures. |
| **FR-61** | The system MUST, after downtime, bill missed periods in order, counting each period from its own start so that late billing never shifts the calendar. |
| **FR-62** | The system MUST, when the invoice date lies in a locked accounting period, either date the invoice on the first open day and flag it, or hold the cycle, per organization setting (default first open day). |

### 3.8 Self-service *(advanced)*

| ID | Requirement |
| --- | --- |
| **FR-63** | A signed-in portal user of a customer can see the customer's subscriptions, next invoice preview, current usage, billing history and invoices. |
| **FR-64** | The system MUST allow in the portal only the actions the plan permits: change quantity, switch between listed plans, add or remove add-ons, pause and resume, cancel, and replace the payment instrument; each with the preview of FR-38 and recorded with the customer as actor. |
| **FR-65** | The system MUST ask a cancelling customer for a reason and present the plan's retention offer (a discount for a number of cycles or a pause) once per subscription. |
| **FR-66** | A user with `SUBSCRIPTIONS_CREATE` can issue a subscribe link for a plan, a public link of the platform that expires and can be revoked; a customer who opens it, identifies and, for automatic collection, stores a payment instrument, gets the subscription created once. |

### 3.9 Revenue schedules *(advanced)*

| ID | Requirement |
| --- | --- |
| **FR-67** | The system MUST, for plans recognised over the period, create a revenue schedule spanning the service period for each confirmed cycle invoice line, adjust it on credit, refund or cancellation, and show billed, recognised and deferred amounts on the subscription. |
| **FR-68** | The system MUST do the same with expense schedules for supplier subscription bills. |

### 3.10 Analytics and reports

| Requirement | Report | Answers |
| --- | --- | --- |
| **FR-69** | Billing history | Which cycles were billed, held, failed, waived or refunded, by period, plan and customer? |
| **FR-70** | Recurring revenue *(advanced)* | Monthly recurring revenue and annual run rate per month, with new, expansion, contraction, churned and reactivated parts, by plan and currency |
| **FR-71** | Churn and retention *(advanced)* | Customer and revenue churn rates, net retention, cohorts by start month, cancellation reasons, trial conversion |
| **FR-72** | Billing forecast *(advanced)* | Expected invoices per month for 12 months from active subscriptions, scheduled changes and end dates |
| **FR-73** | Usage *(advanced)* | Usage and usage revenue by meter, customer and period; allowance used; late events |
| **FR-74** | Supplier subscriptions | Recurring spend by supplier and month, renewals due, expected against billed |

All are report definitions (filter, group, chart, schedule, export), and the analytics page shows them as cards
and charts that update when a subscription changes.

### 3.11 Settings, notices, API, agents and compatibility

| ID | Requirement |
| --- | --- |
| **FR-75** | A user with `SUBSCRIPTION_SETTINGS_EDIT` can set per organization: proration on or off, default collection and billing timing, confirm or draft invoices, bill while unpaid, retry schedule, maximum pause, notice days, cancellation reasons, locked-period handling, the scheduled run, invoicing of automatic cycles and one trial per customer and plan; every setting starts at today's behaviour (default collection: automatic for organizations that had plans before this feature, sending an invoice otherwise); grace and the suspend-or-cancel action are levels of the dunning policy of `payments-and-collections`. |
| **FR-76** | The system MUST send notices in the recipient's language through the platform's notification preferences: trial ending, upcoming renewal (yearly and longer), invoice ready, payment failed, paused, resumed, cancelled, suspended, usage thresholds, price change. |
| **FR-77** | The system MUST publish an event for every lifecycle move, cycle outcome, change, threshold and run, for automation rules, webhooks, entitlement of services and live updates of open pages. |
| **FR-78** | The system MUST offer every action through REST (and the existing GraphQL surface) with idempotency keys on creating, billing and usage calls. |
| **FR-79** | The system MUST offer MCP tools for plans, subscriptions, changes with preview, usage, runs with preview and analytics; tools that bill or change money default to preview and act with the caller's permissions. |
| **FR-80** | The system MUST let an agent explain a cycle invoice line by line (plan, period, proration, usage, discount, tax) and rank subscriptions at risk of churn by signals (failed charges, usage drop over 30 % against the previous three periods, downgrade, pause, overdue invoices), each with its evidence. *(advanced)* |
| **FR-81** | The system MUST work without a payment provider: collection by invoice needs none, and automatic collection without one is refused with a named error when a cycle would be charged, as today, with a warning in the app when it is chosen. |
| **FR-82** | The system MUST, with `FEATURE_SUBSCRIPTION` off, load no route or menu entry of the feature and leave invoice schedules as they are; with accounting off it bills without postings and skips revenue schedules. |
| **FR-83** | The system MUST keep who, when, before and after for every change to a plan, subscription, cycle, usage event and setting. |
| **FR-84** | The system MUST keep every existing route, event name, status value and stored field of the subscription plugin and of invoice schedules working as before. |

## 4. Non-Functional Requirements

- **Performance**: subscription list under 300 ms at the 95th percentile with 500,000 subscriptions per tenant; a
  run bills 10,000 cycles within 15 minutes; a change preview returns within 500 ms; usage intake accepts 500
  events per second per tenant with acknowledgement under 100 ms; analytics read from daily figures, not from raw
  history.
- **Data volume and concurrency**: 100 million usage events per tenant and year, aggregated per period; one run
  per organization at a time; optimistic versions on subscriptions.
- **Reliability**: at-least-once billing with one invoice per cycle; usage events deduplicated by key for 90 days;
  runs resume after interruption; no charge without a recorded attempt.
- **Security & privacy**: tenant and organization scoped; portal users see only their own customer's data; no card
  or bank data is stored (provider references only); usage attributes may carry personal data and follow the
  customer's retention rules; emails and provider calls are the only data leaving the platform.
- **Observability and audit**: run records, attempt history per cycle, change history, timeline, metrics for run
  duration, failures, intake lag.
- **Accessibility and localisation**: keyboard-operable screens, labelled charts with table alternatives, all
  strings in every shipped locale, notices in the recipient's language, amounts in the document currency.
- **Compatibility**: PostgreSQL, MySQL and SQLite; both ORMs; cloud and self-hosted; additive API and SDK changes.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| `SubscriptionPlan` (existing) | What can be subscribed to, on which cadence, price basis and defaults; now versioned |
| `SubscriptionPlanComponent` | A recurring item or a usage component of a plan |
| `Subscription` (existing) | One running agreement with a customer |
| `SupplierSubscription` / cycle | A recurring obligation towards a supplier and each period's expected bill |
| `SubscriptionItem` (existing) | One recurring or usage line of a subscription |
| `SubscriptionBilling` (existing) | One billing cycle: period, amount, invoice, attempts, outcome |
| `SubscriptionChange` | One immutable entry of the change history, applied or scheduled |
| `SubscriptionBillingRun` | One execution of billing with its scope and results (a platform operation) |
| `UsageMeter` | What is measured, in which unit, aggregated how |
| `UsageEvent` | One reported quantity for a meter and subscription |
| `UsagePeriodTotal` | Aggregated usage and charge of a meter in one period |
| `SubscriptionCancelReason` | An entry of the organization's cancellation reasons (a tag of the cancellation-reason tag type) |
| `SubscriptionMetricDaily` | Recurring revenue and movement figures of one day |
| `InvoiceSchedule` (existing) | A client's recurring invoice for billable time |
| Collection state | Whether the subscription's invoices are current, past due or suspended |
| Retainer | A plan that includes a quantity of a meter and bills the overage |

## 6. Out of Scope

- Repeating any other document on a schedule (fixed recurring invoices, orders, journals): `business-document-engine`.
- Invoice, credit note and supplier bill documents, their numbering and totals: `invoicing-receivables-payables`.
- Reminders, dunning levels, statements and allocation of payments: `payments-and-collections`.
- Payment provider adapters, stored instruments, hosted payment pages, provider refunds: `payment-gateways`.
- Deferred revenue and expense schedules and their postings: `budgets-and-revenue-schedules`.
- Tax calculation: `tax-engine`. Price lists: `pricing-and-promotions`.
- Portal sign-in, menu and document pages: `customer-and-supplier-portal`.
- What a subscription unlocks (entitlements, licence keys): the existing `entitlement` plugin.
- The platform's own billing of tenants for the product: the existing core billing module, unchanged.

## 7. Acceptance Criteria

- [ ] **AC-1** A plan with each price basis and timing bills the expected invoice; a calendar-aligned monthly
      subscription prorates its first period (FR-2, FR-5, FR-12).
- [ ] **AC-2** Trial, pause, resume, cancel at period end, undo, restart and expiry by end date behave as specified
      and appear on the timeline (FR-11, FR-16, FR-17).
- [ ] **AC-3** The scheduled run bills due cycles once, skips the future, holds or re-dates in a locked period,
      continues past failures and reports them; the preview run writes nothing (FR-58, FR-60, FR-62).
- [ ] **AC-4** Past due, grace, suspension or cancellation and return to current follow the invoice's payment;
      a failed automatic charge follows the retry schedule (FR-30).
- [ ] **AC-5** A supplier subscription creates bill drafts, reminds before renewal and flags a deviating bill (FR-18, FR-27, FR-28).
- [ ] **AC-6** A change preview equals what is billed after confirmation, and a stale preview is refused (advanced
      , preview and history); the change history lists every change with its actor (FR-38).
- [ ] **AC-7** Usage events are counted once, priced under each pricing model, billed in arrears with a statement;
      tracked time billed by a subscription cannot be billed elsewhere; retainer overage and roll-over are correct
      (advanced, usage) (FR-43, FR-46).
- [ ] **AC-8** An invoice schedule is managed in the Gauzy app, supports quarterly and yearly cadence and an end
      day, and converts into a subscription without double billing (FR-52, FR-53).
- [ ] **AC-9** A portal user changes quantity with a preview, cancels with a reason and a retention offer, and
      cannot do what the plan forbids (advanced, self-service) (FR-40, FR-64, FR-65).
- [ ] **AC-10** A cycle of a plan recognised over the period creates and adjusts its revenue schedule (advanced
      , revenue schedules) (FR-67).
- [ ] **AC-11** The six reports of §3.10 return figures that agree with the cycles and changes of a seeded tenant;
      recurring-revenue movements add up to the change in the total (advanced, analytics).
- [ ] **AC-12** MCP tools preview by default; the churn-risk list names the seeded signals (advanced, agents) (FR-79, FR-80).
- [ ] **AC-13** `403` without permission, `404` with the feature off, `409` on a stale version; a partial failure
      of a bulk usage call returns per-row results (FR-19, FR-82).
- [ ] **AC-14** With both flags on and every setting at its default, an existing subscription bills on demand, raises
      its order, charges, retries and fails exactly as before: no scheduled run, no invoice for its order, no
      suspension, no pause or trial limit, cancellation reasons in free text accepted, and a plan edited through the
      existing route takes effect as before (FR-56).
- [ ] **AC-15** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today, apart from the existing feature codes that now guard their routes, which the release switches on for every tenant holding their data (FR-82, FR-84).
- [ ] Works on PostgreSQL, MySQL and SQLite with both ORMs.
- [ ] Behind `FEATURE_SUBSCRIPTION` and `FEATURE_SUBSCRIPTION_BILLING`; nothing changes while they are off, and
      existing subscription and invoice-schedule suites pass unchanged.
- [ ] All functional requirements have a passing test.

## 8. Open Questions

- Default collection for new plans is "send an invoice" in organizations without plans (applied), because no payment
  provider adapter ships with the platform; automatic collection needs `payment-gateways`. Organizations that already
  have plans keep automatic collection as their default.
- Automatic collection keeps the existing path (order, charge, then invoice of the order) (applied); a direct
  charge of an invoice without an order can replace it later, with fewer documents.
- The default dunning level for subscriptions collected by invoice suspends after 7 days rather than cancelling
  (applied); automatically collected subscriptions keep their retry schedule unless the organization adds a level.
- Seats are counted from entitlements where the `entitlement` plugin is on, otherwise from the customer's portal
  members (applied).
- Supplier subscriptions are included here as obligations with bill drafts (applied); they can move to
  `procurement` as contracts later.
- Retention offers are limited to a discount or a pause (applied); free plan switches as an offer are left out.

## 9. Constitution Gates

- [x] I Plugin-first — extends the existing `subscription` plugin, adds `subscription-ui` and
      `subscription-react-ui`; the invoice-schedule additions stay in core where the schedule lives.
- [x] II Tenant/organization scoping — every new record is tenant and organization scoped; portal access is
      limited to the signed-in customer.
- [x] III Both ORMs, additive migrations — new tables and nullable or defaulted columns only, three dialects.
- [x] IV Default-off flag; nothing removed — both existing flags reused; every route, status and event kept.
- [x] V Contracts and API first; backwards compatible — additive fields and endpoints; GraphQL surface extended.
- [x] VI Permissions, privacy, security — billing, usage and settings are separate keys; no instrument data stored.
- [x] VII Real-time through the event bus — outbox events for every move; live usage and analytics through the
      platform channel.
- [x] VIII i18n and accessibility — all strings as keys; notices localised; charts with table alternatives.
- [x] IX Tests accompany the change — cycle and proration mathematics, idempotency, run behaviour, usage pricing.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Related features: [`../invoicing-receivables-payables/spec.md`](../invoicing-receivables-payables/spec.md),
  [`../payments-and-collections/spec.md`](../payments-and-collections/spec.md),
  [`../payment-gateways/spec.md`](../payment-gateways/spec.md),
  [`../budgets-and-revenue-schedules/spec.md`](../budgets-and-revenue-schedules/spec.md),
  [`../business-document-engine/spec.md`](../business-document-engine/spec.md),
  [`../customer-and-supplier-portal/spec.md`](../customer-and-supplier-portal/spec.md),
  [`../tax-engine/spec.md`](../tax-engine/spec.md)
- Existing code: `packages/plugins/subscription` (README, `subscription.types.ts`, `subscription.cycle.ts`),
  `packages/core/src/lib/invoice-schedule`, `packages/core/src/lib/invoice-item` (time billed exactly once),
  `packages/core/src/lib/feature/commerce-feature-catalogue.ts`, `apps/api/src/plugin-composition.ts`
- Related architecture: [platform architecture](../../architecture/business-suite.md) §2.2 (Subscriptions), §3.1, §3.3, §3.4
