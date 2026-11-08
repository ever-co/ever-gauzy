# Task Breakdown: [FEATURE NAME]

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `[short-slug]`
**Plan**: `./plan.md`
**Status**: `Draft` | `Ready` | `In Progress` | `Done`
**Last updated**: YYYY-MM-DD

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind the feature flag until the last phase.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts in `packages/contracts/src/lib/<feature>.model.ts` (+ export from `index.ts`)
- [ ] **T2**. Entities in `packages/plugins/<id>/src/lib/entities/` (MultiORM decorators, tenant/organization base)
- [ ] **T3**. Migration `<timestamp>-<Name>.ts` for PostgreSQL, SQLite and MySQL; registered for both ORMs
- [ ] **T4**. Feature flag: `FeatureEnum.<X>` + toggle seed, and/or env in `@gauzy/config`

## Phase 2 — Services, endpoints, events

- [ ] **T5**. Services / CQRS commands + handlers with Jest specs
- [ ] **T6**. Controllers with DTOs, `@Permissions()`, Swagger decorators; e2e spec where the suite exists
- [ ] **T7**. Domain events on the event bus; push-channel and notification consumers

## Phase 3 — UI surfaces

- [ ] **T8**. Angular plugin UI (`packages/plugins/<id>-ui`): routes, pages, menu entry, i18n keys in every locale
- [ ] **T9** (parallel). React UI plugin or Ever Teams client (its own tasks in the Ever Teams repository)

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T10**. MCP tools in `packages/mcp-server/src/lib/tools/`
- [ ] **T11**. OpenAPI document regenerated; SDK regeneration noted for release
- [ ] **T12**. User docs (docs site) and `docs/specs/README.md` index row; spec status `Implemented`

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off; enabling it in dev shows the feature end to end.
- Constitution gates in `spec.md` §9 confirmed.
