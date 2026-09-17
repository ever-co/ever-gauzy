# @gauzy/plugin-subscription

Ever Gauzy Platform Subscription Plugin — **plans, subscriptions, subscription items and recurring
billing**, all owned by this package and reachable over both REST and GraphQL.

## What it owns

| table | what it holds |
|---|---|
| `subscription_plan` | what can be subscribed to, and on what cadence: the billing period and interval, the trial, the setup fee, the recurring discount and the catalogue item delivered |
| `subscription` | one running agreement: the customer, the plan, the current period, the next billing instant and the payer remembered for renewals |
| `subscription_item` | the recurring line set — what each cycle bills |
| `subscription_billing` | one row per due cycle: the period, the amount, the order the cycle raised and the attempt history |

## The shape of the domain

A **plan** states a cadence (`billingPeriod` × `billingInterval`), an optional trial, an optional
setup fee and an optional recurring discount. Period arithmetic is calendar-based, so a monthly plan
billed on the 31st clamps to the last day of a shorter month instead of drifting.

A **subscription** binds a customer to a plan. Creating one writes its item set and the billing row
for the initial period, and is idempotent on `originOrderId` so a retried checkout cannot create a
second subscription for one order.

A **billing run** finds every subscription whose `nextBillingAt` has passed and bills one cycle for
each. A cycle writes exactly one `subscription_billing` row, hands the recurring lines to the order
capability through the ordinary order path — this package never writes an order, a payment or a
stock row itself — and advances the period from the **period start**, so a late run does not shift
the calendar. Billing the same period twice cannot charge twice: the unique
`(subscriptionId, periodStart)` key and the platform idempotency store both refuse the second
attempt.

A **failed cycle** records the attempt, the error and the next retry instant on the same row, and
the subscription enters dunning. The retry schedule is the platform's, not the provider's; after the
final attempt the subscription moves to `FAILED` and nothing bills it again until an operator acts.

## Money

Every amount is an exact decimal (`numeric(20,6)`) with its own ISO currency code beside it, and
every calculation runs through the platform money layer (`@gauzy/core`, `lib/money`). No amount is
ever a floating-point number.

## Boundaries

The plugin reads no other plugin's tables. Four capabilities it depends on are reached through
optional injection tokens — the catalogue (is this variant sellable on a recurring basis), pricing
(what does this variant cost per period), the order path (raise the recurring order and charge it
off-session) and the payment instruments (which stored instrument may be charged). A tenant without
one of them registered is refused with a named error rather than guessed at, and every cycle
publishes its `subscription.*` event to the platform outbox instead of calling another domain
directly.

The whole module is gated behind the **`FEATURE_SUBSCRIPTION`** feature flag, which defaults to
**off**: recurring charges need a stored instrument and an explicit business decision, and a
scheduled billing run must never fire on a tenant that did not opt in.

## Permissions

`SUBSCRIPTIONS_VIEW`, `SUBSCRIPTIONS_CREATE`, `SUBSCRIPTIONS_EDIT` and `SUBSCRIPTIONS_BILL`.

## Surfaces

- REST: `/api/subscription-plans`, `/api/subscriptions`, `/api/subscription-items`,
  `/api/subscription-billings`, each guarded by `TenantPermissionGuard` and `PermissionGuard`.
- GraphQL: the same services behind `subscriptionPlans`, `subscription`, `subscriptionItems` and
  `subscriptionBillings` queries and their mutations.

## Building

```
yarn nx build plugin-subscription
```
