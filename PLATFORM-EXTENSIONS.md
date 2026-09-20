# Platform extensions — branch notes

This branch adds a commerce capability set to Ever Gauzy: **16 plugin packages** (catalog, pricing, tax,
inventory, warehouse, cart, order, payment, promotion, fulfillment, returns, subscription, purchasing,
entitlement, marketplace, search) plus the **platform kernels** they build on — the plugin framework and
plugin-owned migrations, the contributions registry, the transactional event outbox and outbound webhooks,
the durable operation runtime, idempotency, numbering, the shared query protocol and error contract, exact
money arithmetic, the rule engine, global search, and GraphQL for every REST capability.

**Read this before merging anything here.** The branch builds, boots and passes its suites, and an
independent adversarial review of it found **defects that are not fixed**. The three worst were fixed
during the review (a GraphQL permission hole, 88 plugin resolvers missing the platform feature gate, and a
payment-status decision computed in binary floating point); **twelve remain**, and the list is in the
handover document named below. The ones a reviewer should weigh first:

- **Three writes bypass the optimistic-concurrency check.** `FulfillmentService.move()` reads a row and
  then writes an application-computed version, reachable from four routes that carry no version
  precondition; a cart line is deleted before the parent's conditional write can refuse the request; the
  stock aggregate delta is unpredicated.
- **The two kernels are ordered backwards** on the one route that carries both, so a client that lost its
  response receives a version conflict instead of the stored answer the API specification promises.
- **The REST request fingerprint does not do what its own docstrings claim**, so a re-serialised retry can
  be refused as a key reuse.
- **Money is not exact end to end**: the decimal transformer the money specification mandates does not
  exist, so amounts flow through JavaScript `number`s in several places.
- **Twenty-four of twenty-six versioned writes carry no tenant scope.**

The gates in `tools/scripts/` are green, and that is **not** evidence the above is absent: they do not read
permissions, guards, protocol shape, or the plugin half of the repository. Do not treat a green run as an
acceptance.

## Where the design lives

The programme's design documents and its handover are **not in this repository** — they sit beside the
checkout at `research/gauzy-ecommerce/docs/` (27 documents: the domain model, the database schema, the API
specification, the money/tax/pricing/inventory/order specifications, the GraphQL specification, the
naming doctrine, the rollout plan and the task breakdown) and
`docs/handoffs/HANDOVER-2026-09-20-gauzy-platform-extensions.md`. A reviewer reading only this repository
sees the code without its reasoning.

## Verifying it

The branch is developed and verified against a local installation — SQLite, `DB_ORM=typeorm`:

```powershell
npx nx reset                                   # always: a stale nx cache silently no-ops the build
npx nx build api
# boot: $env:DB_TYPE='better-sqlite3'; $env:DB_ORM='typeorm'; node dist/apps/api/main.js
node tools/scripts/graphql-surface-smoke.mjs   # one selection per declared query root field
node tools/scripts/commerce-e2e.mjs            # REST + GraphQL sweep
node tools/scripts/commerce-flow-e2e.mjs       # cross-capability proofs
foreach ($g in Get-ChildItem tools/scripts/*check*.mjs) { node $g }   # the static gates
```

## Conventions this branch follows

Every table, column, endpoint, event, permission and queue name is this platform's own, written to the
naming doctrine in the design documents: concept names rather than capability names, no domain prefix
(five cart-family tables excepted), **one API surface served over two protocols** rather than a second
storefront surface, no API version segment, reuse of existing tables rather than parallel ones, and no UI.
