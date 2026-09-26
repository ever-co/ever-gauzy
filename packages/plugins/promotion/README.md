# @gauzy/plugin-promotion

The promotion domain of the platform: campaigns and their budgets, promotions and the actions that
describe their effect, the coupons that grant them, the redemption ledger the limits are checked
against, and gift cards with their own balance ledger.

## What the package owns

| table | what it is |
|---|---|
| `campaign` | a window and a budget; it holds no rules of its own |
| `campaign_budget` | the spend or usage ceiling of one campaign |
| `campaign_budget_usage` | consumption of that ceiling for one value of its attribute |
| `promotion` | the offer: its type, its window, its limits and its counters |
| `promotion_action` | what the promotion does — a percentage, an amount, a free item, free shipping |
| `coupon` | a redeemable code belonging to a promotion, with its own limits and window |
| `promotion_usage` | one application of a promotion: reserved, registered or reverted |
| `gift_card` | a stored-value instrument |
| `gift_card_transaction` | the append-only ledger the card balance is derived from |

## What it deliberately does not own

* **Conditions.** A promotion's eligibility is an ordered set of `rule` rows with owner type
  `PROMOTION`, and an action's target and buy selection are rows with owner type `PROMOTION_ACTION`.
  The kernel rule engine evaluates them; this package contributes no condition column and no second
  evaluator, because two definitions of what "matches" means is how a promotion comes to fire in the
  cart and not at checkout.
* **Money.** The money a promotion moves is recorded in the kernel `adjustment` ledger as rows of
  type `PROMOTION` (or `SHIPPING_DISCOUNT`, or `GIFT_CARD` for a stored-value redemption). This
  package writes those rows through the kernel service and never holds a discount total of its own.
* **Prices.** A promotion discounts the price the pricing domain resolved, which is why the plugin
  declares `dependsOn: ['pricing']`.

## The rules the package enforces

* **Budget is consumed by one conditional statement, never by read-compare-write.** Two concurrent
  checkouts cannot both consume the last unit of a campaign budget: the increment carries its own
  ceiling in its `WHERE` clause, and zero affected rows means the promotion is dropped from the
  evaluation. A budget split by attribute gates on its per-value row and advances the parent in the
  same transaction.
* **A gift-card balance is derived, not stored as truth.** Every change writes exactly one ledger row
  and stores the balance beside it, in that order, so the ledger can always be replayed; a correction
  is an `ADJUST` row and never an edit.
* **A redemption is reserved before the money moves, and registered without counting twice.** The
  reservation is what makes the limits and the budgets safe during checkout; registration only
  changes the status, so a replayed checkout cannot double-count.
* **Every exclusion is reported.** An evaluation returns notices naming why a promotion did not
  apply. A promotion that silently does nothing is the defect an operator cannot diagnose.
* **Money is exact.** Every monetary column is `numeric(20,6)` with a sibling ISO-4217 currency
  column, allocations use the largest-remainder split so the parts sum back to the whole, and no
  service does arithmetic inline on a rounded value.

## Layout

```
src/lib/<aggregate>/          one folder per aggregate root
    <aggregate>.entity.ts     the table, its relations and its indexes
    <aggregate>.service.ts    the domain rules of that aggregate
    <aggregate>.controller.ts the REST surface: one controller per entity, one API surface
    dto/                      request shapes, validated
    repository/               the TypeORM and MikroORM repository pair
src/lib/migrations/           the package's own migration set
src/lib/graphql/              the SDL fragment, the type definitions and the resolvers
src/lib/promotion.permissions.ts  the permission catalogue this package contributes
src/lib/promotion.features.ts     the feature flags it contributes
src/lib/promotion.settings.ts     the settings it reads
```

## Migrations

The package owns `1791000000260-CreatePromotionTables`, hand-written for Postgres, MySQL and SQLite
with a true inverse `down()`.

Four columns carry no database-level foreign key on purpose: `promotion_usage.orderId`,
`promotion_usage.cartId`, `gift_card.orderId` and `gift_card_transaction.orderId` are identifiers into
the order and cart tables, which are created by packages that load after this one. The programme's
migration rule is that a constraint is added by the set that owns its target, so these are constrained
by the order and cart sets rather than ahead of their tables. Every other reference in the set —
including the ones into the kernel `channel`, `contact_group` and `organization_contact` tables — is
constrained here, with the `onDelete` policy the schema specification fixes for its relation kind.
