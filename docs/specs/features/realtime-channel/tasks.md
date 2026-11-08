# Task Breakdown: Real-time channel

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `realtime-channel`
**Plan**: `./plan.md`
**Status**: `In Progress` — T1–T15 in ever-co/ever-gauzy#11681
**Last updated**: 2026-11-08

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind `GAUZY_REALTIME_ENABLED` until the last phase.

## Phase 1 — Contracts, permission, plugin skeleton

- [x] **T1**. Contracts `packages/contracts/src/lib/realtime.model.ts` (event names, hint, presence, typing, catch-up, envelope) + export from `packages/contracts/src/index.ts`
- [x] **T2**. `PermissionsEnum.REALTIME_SUBSCRIBE` in `packages/contracts/src/lib/role-permission.model.ts`; default grants in `packages/core/src/lib/role-permission/default-role-permissions.ts` (SUPER_ADMIN, ADMIN, MANAGER, EMPLOYEE)
- [x] **T3**. Plugin package `packages/plugins/realtime/` (package.json, project.json, tsconfig*.json, jest.config.ts, eslint.config.cjs, README.md, `src/index.ts`) copied from `packages/plugins/inbox/`; path alias `@gauzy/plugin-realtime` in `tsconfig.json`; dependency in `apps/api/package.json`
- [x] **T4**. `src/lib/realtime-enabled.ts` (`isRealtimeEnabled`, exact `true`) with spec
- [x] **T5**. `src/lib/realtime.plugin.ts` (`@Plugin({ imports: [RealtimeModule], migrations, extensions: { schema, resolvers } })`), `src/lib/realtime.module.ts`
- [x] **T6**. Migration `src/lib/database/migrations/1791000005100-SeedRealtimeRolePermissions.ts` + `src/lib/database/migration-helpers.ts` + `realtime-migrations.ts`
- [x] **T7**. Register in `apps/api/src/plugins.ts` (flag-gated spread) and document `GAUZY_REALTIME_ENABLED` in `.env.sample`

## Phase 2 — Catalogue, hints, signals

- [x] **T8**. `src/lib/realtime-catalogue.ts`: declares `REALTIME_STREAMED_EVENTS` + `REALTIME_SIGNAL_EVENTS` with `declareStreamedEvents` on module init (looked up through `ModuleRef`, like the Inbox)
- [x] **T9**. Core `packages/core/src/lib/event-bus/events/comment.event.ts` (`CommentEvent`) exported from `events/index.ts`; published in `CommentService.create/update/delete` (`packages/core/src/lib/comment/comment.service.ts`)
- [x] **T10**. `src/lib/realtime-hints.service.ts`: subscribes to `TaskEvent`, `CommentEvent`, `DocumentEvent` (by constructor name) on the RxJS bus and to `CreateMentionEvent`, `EmployeeCreateNotificationEvent` on the CQRS bus; builds `IRealtimeChangeHint` payloads; resolves employee → user for addressing; coalesces per aggregate per second; `EventOutboxService.append` after the fact; exported `appendHint()` for other plugins. Spec with a fake outbox.
- [x] **T11**. `src/lib/realtime-signals.service.ts`: `publishPresence`, `publishTyping` through `GraphqlPubSub.publish` with full `SubscriptionEnvelope`s (eventId, occurredAt, aggregate, tenantId, organizationId, recipientUserIds). Spec.

## Phase 3 — REST and GraphQL surface

- [x] **T12**. `src/lib/dto/{realtime-presence,realtime-typing,realtime-catch-up}.dto.ts`
- [x] **T13**. `src/lib/realtime.controller.ts`: `POST /realtime/presence`, `POST /realtime/typing` (throttled), `GET /realtime/events`, `GET /realtime/status`; guards `TenantPermissionGuard, PermissionGuard`; `@Permissions(REALTIME_SUBSCRIBE)`
- [x] **T14**. `src/lib/realtime-catch-up.service.ts`: outbox listing by catalogue names, tenant, organization (or tenant-wide) through `EventOutboxService.listOutboxRowsSince` (`createdAt` from the cursor time, ordered by `createdAt`, `eventId`), then the exact cursor in code: rows after (`after` epoch ms, `afterId` event id), compared as (`createdAt`, `eventId`), never by `sequence` (per partition); recipient filter on `payload.recipientUserIds`; answers `cursor`/`cursorId`/`hasMore`; `resync` when `after` precedes the oldest retained row; works on PostgreSQL, SQLite, MySQL (JSON filtering done in code after a bounded fetch). Spec.
- [x] **T15**. `src/lib/graphql/realtime.schema.ts` (`extend type Subscription { collaborationEvents(...) }`, plain `gql`) and `src/lib/graphql/realtime.resolver.ts` (`tenantScopedTopicStream` + envelope mapper + name validation against the catalogue); add to `GATED_PLUGIN_SCHEMAS` in `tools/scripts/graphql-field-binding-check.mjs`. Spec for the mapper and the name validation.

## Phase 4 — Verification and docs

- [ ] **T16**. `yarn nx test plugin-realtime`; `tsc --noEmit -p packages/plugins/realtime/tsconfig.lib.json` strict and with `strictNullChecks` off; `node tools/scripts/graphql-field-binding-check.mjs`
- [x] **T17**. Plugin README (enable, events, routes, client recipe with `graphql-ws`), `docs/specs/README.md` status → `In Progress`/`Implemented`
- [ ] **T18**. Enable on dev; verify with a small Node script (`graphql-ws` + `ws`) that a task update is received within 1 s and that catch-up replays it

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Flag default stays off; enabling it in dev shows the stream end to end.
- Constitution gates in `spec.md` §9 confirmed.

## Follow-ups (from the plan's §15)

- [ ] **T19**. Append chat and task/comment hints inside the originating transaction (plan §15.1)
- [ ] **T20**. Per-connection presence, merged per employee, coalesced to one message per 5 s (plan §15.2)
- [ ] **T21**. Address `document.updated` and document comment hints to the page's readers (plan §15.3)
- [ ] **T22**. Current-membership recheck for `chat_*` events in the catch-up and the live stream (plan §15.4)
- [ ] **T23**. Outbox retention that keeps the FR-3 floor, with a test of both bounds (plan §15.5)
