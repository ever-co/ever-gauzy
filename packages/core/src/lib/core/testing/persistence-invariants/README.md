# Unified Persistence Invariant Framework (TASK 3)

Combines TASK 1 (tenant isolation) and TASK 2 (ORM conformance) into one thing: the exact same
tenant-isolation assertion functions from
[`../tenant-isolation`](../tenant-isolation/README.md) (`assertCannotReadAcrossTenant`,
`assertCannotUpdateAcrossTenant`, `assertCannotDeleteAcrossTenant`,
`assertCannotClaimForeignRowOnWrite`, `assertListExcludesOtherTenant`, `assertCanReadOwnTenant`),
now run against a REAL `TenantAwareCrudService` subclass backed by a REAL in-memory SQLite database,
under EITHER ORM — using [`orm-conformance`](../orm-conformance/README.md)'s two-separate-processes
approach, since `DB_ORM` is fixed at module-import time for the whole process.

```
              Persistence Invariants
                       |
           +-----------+-----------+
           |                       |
   Tenant Isolation          ORM Behavior
   (TASK 1 assertions)     (TASK 2 adapters)
           |                       |
           +-----------+-----------+
                       |
              Shared Test Harness
                       |
              +--------+--------+
              |                 |
           TypeORM           MikroORM
              |                 |
              +--------+--------+
                       |
               Same Invariants
```

## Running

```sh
DB_ORM=typeorm   npx nx test core --testFile=persistence-invariant.spec.ts --skip-nx-cache
DB_ORM=mikro-orm npx nx test core --testFile=persistence-invariant.spec.ts --skip-nx-cache
# or both, failing if either does:
packages/core/src/lib/core/testing/persistence-invariants/run-both-orms.sh
```

`--skip-nx-cache` matters: `DB_ORM` is not part of the Nx cache key, so without it the second command
replays the first one's cached result instead of running under MikroORM.

## What's new here vs. reusing TASK 1/2 as-is

- **`PersistenceInvariantFixture`**: a real, dual-ORM-decorated (`MultiORMEntity`/`MultiORMColumn`/
  `MultiORMManyToOne`) entity — unlike TASK 1's in-memory fake, TASK 1's assertions now run through
  real TypeORM/MikroORM query generation, not a hand-written matcher.
- **`PersistenceInvariantTenant`**: a one-column marker entity `tenant` relates to. Required because
  `TenantAwareCrudService.findConditionsWithTenantByUser` merges `{ tenant: { id }, tenantId }` into
  every query — and a relation-shorthand where clause compiles to a real SQL JOIN. Without a matching
  row on the other side, that JOIN returns nothing, even for the caller's own tenant (confirmed while
  building this fixture — see the entity file's comments for the exact failure).
- **`PersistenceInvariantService`**: a trivial `TenantAwareCrudService` subclass, exactly like every
  real domain service (`EmployeeService`) is — so this suite exercises `TenantAwareCrudService`'s own
  logic directly, not a reimplementation of it.

## Real ORM discrepancies found while building this (see file comments for detail)

- MikroORM's `@PrimaryKey({ type: 'uuid' })` has no generator, unlike TypeORM's
  `@PrimaryGeneratedColumn('uuid')` (found in TASK 2, applies here too).
- A `@MultiORMManyToOne` relation's explicitly-named join column and its `@RelationId` mirror column
  land on two different physical columns under MikroORM's _default_ naming strategy — production
  avoids this by setting `namingStrategy: EntityCaseNamingStrategy` in
  `packages/config/src/lib/database.ts`, which this harness's `MikroORM.init()` now matches. Confirmed
  as a test-harness-configuration pitfall, not a live production bug, only because production actually
  sets that option — but it is a sharp, easy-to-hit edge for anyone building the next MikroORM harness
  in this codebase without copying that option too.

## Verification

Both ORMs pass 6/6. Mutation-tested (disabling the tenant filter in
`TenantAwareCrudService.findConditionsWithTenantByUser`) under **both** `DB_ORM=typeorm` and
`DB_ORM=mikro-orm`: multiple assertions failed as expected under each, then reverted before
committing. Full `core` suite also re-run under both `DB_ORM` values — no regressions beyond the
already-documented [tenant-isolation harness limitation](../tenant-isolation/README.md#known-gaps-left-for-later-tasks-per-the-improvement-roadmap)
(TASK 1's fake repository is TypeORM-shaped only); this suite's own tests pass in both full runs.

The list invariant was later found to be weaker than it looked. Rows used to pile up across the
file's tests, and the assertion only checked that the newest foreign id was absent — which, under
TypeORM's default page of 10 rows, stayed true with tenant filtering on the list path switched off.
Each test now starts from an empty table (`harness.clear()` in `beforeEach`), and
`assertListExcludesOtherTenant` requires every listed row to belong to the caller's tenant. The same
list-path mutation now fails the list test under both ORMs, including on a table holding six rows
per tenant.

## Known gaps / natural next steps

- Only one lean fixture entity/invariant set (tenant isolation on find/update/delete/save/list).
  TASK 2's other targets (relation loading, transactions, cascading, concurrent updates) aren't
  folded into this unified framework yet.
- TASK 1's Employee/OrganizationProject specs still use the in-memory fake, not this real-DB,
  dual-ORM harness — migrating them would need the same real-entity SQLite-compatibility work this
  fixture required (see `orm-conformance/README.md`'s note on why real entities aren't used there
  either), scoped separately per the roadmap's own "start narrow, expand later" guidance.
- Per the roadmap, the next expansion is progressively covering more entities (`Task`, `TimeLog`,
  `Timesheet`, `Invoice`, `Expense`, `Organization`, `Payment`, ...) through this same framework.
