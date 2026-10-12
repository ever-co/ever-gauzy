# TypeORM ↔ MikroORM Conformance Suite

Runs the same operations/assertions against both ORM backends to catch behavioral drift between
them — pagination, ordering, tenant filtering, and soft delete, to start (see "Known gaps" below).

## Why not one test, both ORMs, in the same process?

`getORMType()`/`DB_ORM` is read at **module-import time**, not per-call, in several places:

- Every per-property entity decorator (`MultiORMColumn`, `MultiORMManyToOne`, ...) reads it inside
  the decorator closure, i.e. the moment an entity class is first `require`d, and applies **only
  one** ORM's field-level metadata (unlike `@MultiORMEntity`, which registers the class with both
  unconditionally). Once applied, that choice is permanent for the class's lifetime in the process.
- `packages/core/src/lib/core/crud/crud.service.ts` (and ~15 other modules) compute
  `const ormType = getORMType()` once at import time and never re-read it.

So a single entity class cannot carry both ORMs' field metadata at once in one process, and
`jest.resetModules()` would have to force a fresh re-import of the entire entity graph (hundreds of
files) to switch — a much bigger and more fragile undertaking than it sounds. The practical
alternative, used here: write the scenario and assertions **once**, run them as **two separate
process invocations**, each with `DB_ORM` set before Jest (and therefore the fixture entity) ever
loads:

```sh
DB_ORM=typeorm   npx nx test core --testFile=orm-conformance.spec.ts --skip-nx-cache
DB_ORM=mikro-orm npx nx test core --testFile=orm-conformance.spec.ts --skip-nx-cache
# or, to run both and fail if either does:
packages/core/src/lib/core/testing/orm-conformance/run-both-orms.sh
```

Keep `--skip-nx-cache` (as `run-both-orms.sh` does): `DB_ORM` is not part of the Nx cache key, so
without it the second command is a cache hit that replays the first run's result instead of testing
the other ORM.

`getORMType()` defaults to TypeORM when `DB_ORM` is unset, matching production, so the first line
above is also just `npx nx test core --testFile=orm-conformance.spec.ts --skip-nx-cache`.

## Why a standalone fixture entity instead of a real one (e.g. `Employee`)?

Real entities extend `TenantOrganizationBaseEntity` → `BaseEntity`, whose `id` column declares
`defaultRaw: 'gen_random_uuid()'` — a Postgres-only function. `synchronize`/schema-generation against
SQLite fails on it, which is also why `time-tracking/statistic/*.integration.spec.ts` use hand-rolled
`EntitySchema` fixtures rather than real entity classes. `OrmConformanceFixture` instead uses the
same production decorators (`MultiORMEntity`, `MultiORMColumn`) directly, with a plain
`@PrimaryKey({ type: 'uuid' })`/`@PrimaryGeneratedColumn('uuid')` pair and no Postgres-specific
default — SQLite-safe on both ORMs, while still exercising the real decorator/column-mapping code
path every production entity goes through.

## Verification

Both `npx nx test core --testFile=orm-conformance.spec.ts` runs (TypeORM and MikroORM) pass 4/4.
Mutation-tested: hardcoding the MikroORM adapter's sort direction to always `'asc'` made exactly the
ordering test fail under `DB_ORM=mikro-orm` (the other three, and the TypeORM run, stayed green) —
confirmed the suite actually detects a real behavioral divergence, then reverted before committing.

Running the full `core` suite with `DB_ORM=mikro-orm` set also confirmed this conformance suite (and
648 of the other 660 pre-existing tests) are unaffected by the global ORM switch. The 12 failures at
the time were the [tenant-isolation harness](../tenant-isolation/README.md)'s specs, which are
TypeORM-only by design; they now pin the TypeORM branch themselves, so they pass whatever `DB_ORM`
says — see that folder's README.

## Known gaps (left for later tasks per the improvement roadmap)

- Only 4 of the doc's 8 "Initial Test Targets" are covered: pagination, ordering, tenant filtering,
  soft deletion. **Relation loading, transactions, cascading, and concurrent updates** are not yet
  covered — the fixture entity has no relations at all today.
- Only one fixture entity/table; no join/relation conformance yet.
- This is `TASK 2` of the roadmap. `TASK 3` is combining this with the
  [tenant-isolation harness](../tenant-isolation/README.md) into one unified persistence-invariant
  framework, run against every supported ORM.
