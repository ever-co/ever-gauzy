# Tenant Isolation Test Harness

Reusable building blocks for proving that a `TenantAwareCrudService` subclass actually enforces
tenant isolation — i.e. turning "we expect every repository to enforce tenant isolation" into
something CI checks. Currently applied to `EmployeeService` and `OrganizationProjectService`; see
their `*.tenant-isolation.spec.ts` files for the reference usage.

## Why not a real database?

`CrudService`/`TenantAwareCrudService` decide which repository methods to call based on `ormType`,
read once at module load (defaults to TypeORM). `InMemoryTenantRepository` is a minimal in-memory
stand-in for that TypeORM `Repository<T>` surface — enough to drive the REAL service classes
against representative two-tenant data, without the cost/fragility of synchronizing the full
production entity graph (many relations, Postgres-specific column types) into a throwaway SQLite
database. It understands only the where-shapes `TenantAwareCrudService` itself produces (a flat FK
column, or a one-level `{ relation: { id } }` shorthand) — it is not a general TypeORM mock.

## Building blocks

- `InMemoryTenantRepository<T>` — the fake repository/"database". Construct it with the set of
  column names the real entity has (at minimum `id`, `tenantId`, `organizationId`) so
  `hasColumnWithPropertyPath` matches production behavior, then `seed()` rows directly (bypassing
  the service, since seeding IS how a test plants "another tenant's" data without trusting the
  code under test).
- `createTenantFixture()` / `createCrossTenantFixture()` — fresh tenant/organization/user ids;
  the latter gives you the standard `{ tenantA, tenantB }` attacker/victim pair.
- `asTenantUser(fixture)` — points `RequestContext` at a fixture for the test, the same way a real
  request's JWT-derived `req.user` would. Returns `{ restore }`; call it in `afterEach`.
- `assertCannotReadAcrossTenant` / `assertCannotUpdateAcrossTenant` / `assertCannotDeleteAcrossTenant`
  / `assertCannotClaimForeignRowOnWrite` / `assertListExcludesOtherTenant`, paired with
  `assertCanReadOwnTenant` as a positive control — see `tenant-isolation.assertions.ts` for the
  exact invariant each one checks (delete in particular is a silent no-op, not a thrown error —
  read the comment there before assuming otherwise).

## Adding another entity

1. `new InMemoryTenantRepository<YourEntity>(new Set([...columns your entity actually has]))`.
2. Construct the real service with the fake repo standing in for its TypeORM repository, and inert
   `{}` stand-ins for any other constructor dependency (inherited find/update/delete/save/paginate
   never touch them — only an entity-specific override might, in which case mock that dependency
   properly or test around the override, as `organization-project.service.tenant-isolation.spec.ts`
   does for `create()`).
3. Seed one own-tenant and one foreign-tenant row, `asTenantUser(tenantA)`, and run the assertions.

## Known gaps (left for later tasks per the improvement roadmap)

- No real-SQL confirmation that generated queries are correct at the ORM/SQL level (that is
  `TASK 2` — TypeORM/MikroORM conformance testing — and the eventual unified persistence-invariant
  framework in `TASK 3`).
- Only `Employee` and `OrganizationProject` are covered so far; expand to `Task`, `TimeLog`,
  `Timesheet`, `Invoice`, `Expense`, etc. following the pattern above.
- "SEARCH" and "RELATION ACCESS" invariants (e.g. a project's employee list not leaking across
  tenants through a relation) are not yet covered by a generic assertion.
