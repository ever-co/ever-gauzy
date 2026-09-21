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
payment-status decision computed in binary floating point). A second wave then closed the authorization
gaps a live probe found — the destructive routes every plugin controller inherited with no permission of
their own, three GraphQL fields that stated no permission at all, and two resolvers running without the
tenant guard their own route carries. **Twelve remain**, and the list is in the handover document named
below. The ones a reviewer should weigh first:

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
every property a caller depends on. Two of them do read authorization — `mutating-route-permission-check.mjs`
(no plugin controller may inherit a `CrudController` mutating route without stating its own permission) and
`authorization-probe.mjs`, which provisions a read-only principal against a running installation and asserts
both protocols refuse it — but neither reads protocol shape, refusal codes or the plugin half of the
database. Do not treat a green run as an acceptance.

## Authorization, and how to re-check it

`CrudController` declares five mutating routes with no `@Permissions` metadata, and `PermissionGuard`
answers `true` to empty metadata — so a controller that does not override a route inherits one that stands
on its class-level grant, which is the read grant. Every plugin controller now re-declares the three
destructive routes with the grant its own GraphQL mutation states. To verify that claim rather than read it:

```powershell
node tools/scripts/mutating-route-permission-check.mjs   # static: every route states a permission
node tools/scripts/authorization-probe.mjs               # live: a read-only principal is refused, twice
```

The probe creates a throwaway role and account (a read grant and nothing else), asserts `403` from
`DELETE /api/carts/:id`, `DELETE /api/carts/:id/soft` and `PUT /api/carts/:id/recover`, and asserts the
super administrator is still served. Against the build this branch shipped, the same probe showed the
read-only principal receiving `202 Accepted` from the first of those. Four pre-existing platform controllers
(`changelog`, `job-proposal`, and the two `job-search` presets — the last two declare no guard and no
permission on any route) are listed as exemptions inside the static gate rather than fixed here.

Two further divergences were found in the same pass and left as they are, each for a reason a reviewer can
weigh rather than an oversight:

- **`inventory`'s GraphQL fields are advertised but unbound.** Four packages declared their resolvers only
  in the plugin metadata rather than as module providers, so Nest never registered them and every field
  answered `Cannot return null for non-nullable field Query.<name>` with no guard running. `cart`, `order`
  and `fulfillment` were fixed (their resolvers are providers now, and registering `order`'s exposed a
  `@Resolver('OrderLineInvoice')` that had to be `OrderLine` for the field the SDL gives that type).
  `inventory` is **not** fixed: it is a composite module reaching its services through a dozen sub-modules,
  and providing the ten resolvers there fails the boot with
  `Nest can't resolve dependencies of the TenantPermissionGuard … in the InventoryModule module`. Each
  resolver has to be registered beside the sub-module that owns its service, which is a change to ten
  modules rather than one.
- **The capability gate is one-sided on REST.** Ten packages gate their GraphQL resolvers with
  `@FeatureFlag(FEATURE_GRAPHQL)` while their controllers carry only the tenant and permission guards, so a
  capability switched off still answers over REST. That is the intended asymmetry — `FEATURE_GRAPHQL` is the
  catalogue's entry for the GraphQL endpoint and its resolvers — but it means "the capability is off" is true
  of one protocol only.
- **`GET /payment-account-holders/:id` over-serves.** It returns an account holder's masked instruments under
  `PAYMENT_ACCOUNT_HOLDERS_VIEW`, where the catalogue gives instruments `PAYMENT_METHOD_TOKENS_VIEW`. GraphQL
  is the stricter surface here; narrowing the route is the fix, and weakening the resolver to match was not.

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
node tools/scripts/authorization-probe.mjs     # a read-only principal is refused, on both protocols
foreach ($g in Get-ChildItem tools/scripts/*check*.mjs) { node $g }   # the static gates
```

The desktop and server applications build from the same tree: `yarn build:package:all:prod:once` is the
strict library gate CI runs, and `npx nx build desktop`, `desktop-timer`, `agent`, `gauzy-server`,
`gauzy-api-server` and `server-mcp` each build against it once `yarn config:prod` and the matching
`config:<app>:prod` have generated the environment files (a fresh checkout has none, which is why a bare
`nx build desktop` fails on `environment.prod.ts` rather than on any source).

## Conventions this branch follows

Every table, column, endpoint, event, permission and queue name is this platform's own, written to the
naming doctrine in the design documents: concept names rather than capability names, no domain prefix
(five cart-family tables excepted), **one API surface served over two protocols** rather than a second
storefront surface, no API version segment, reuse of existing tables rather than parallel ones, and no UI.
