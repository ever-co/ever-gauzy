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

- [x] **T16**. `yarn nx test plugin-realtime`; `tsc --noEmit -p
  packages/plugins/realtime/tsconfig.lib.json` strict and with
  `strictNullChecks` off; `node tools/scripts/graphql-field-binding-check.mjs`
  (2026-11-10: all three clean for the plugin's files; the binding check PASSED)
- [x] **T17**. Plugin README (enable, events, routes, client recipe with `graphql-ws`), `docs/specs/README.md` status → `In Progress`/`Implemented`
- [ ] **T18**. Enable on dev; verify with a small Node script (`graphql-ws` + `ws`) that a task update is received within 1 s and that catch-up replays it
  (2026-11-10: the script is `tools/scripts/realtime-live-probe.mjs`; it needs a
  signed-in user's token, so the owner runs it. With T28 the live part rides the
  pass that runs right after the commit)

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Flag default stays off; enabling it in dev shows the stream end to end.
- Constitution gates in `spec.md` §9 confirmed.

## Follow-ups (from the plan's §15)

- [x] **T19**. Append chat facts inside the originating transaction
  (`ChatRealtime.append`, savepoint retry on a partition race);
  task/comment/document/mention/notification hints stay best effort by decision
  (plan §15.1)
- [x] **T20**. Per-connection presence (`realtime_presence`, TTL, sweep), merged
  per employee, published only on change, ordered by a per-employee revision
  (plan §15.2)
- [x] **T21**. Audience of `document.*`, `comment.*` and `task.*` hints from the parent record's read access (Docs visibility scope, the task read rule, the parent record's rule for comments), decided at delivery for live delivery and catch-up (`RealtimeAudience`; plan §9, §15.3)
- [x] **T22**. Current-membership recheck for `chat_*` events in the catch-up and the live stream (`ChatMembershipAudience`, registered through `SubscriptionCatalogue.restrictAudience`; plan §9, §15.4)
- [x] **T23**. Outbox retention that keeps the FR-3 floor, with a test of both
  bounds (plan §15.5; `RealtimeRetentionService`, off unless
  `GAUZY_REALTIME_RETENTION_ENABLED=true`)
- [x] **T24**. Commit-safe order and a safe resume position independent of the
  last live event (`safeCursor` settle window, or a commit-ordered position
  delivered in order) + a regression test of two concurrent appends committing
  out of stamp order (plan §15.6)
- [x] **T25**. `resync` from an actual retention watermark kept as the full
  (`createdAt`, `eventId`) position, not from the oldest retained row (plan
  §15.8)
- [x] **T26**. Coalesce the presence fan-out to at most one message per
  employee per 5 s (spec §4 Performance); today a change is published at once,
  only when the merged state changed
- [x] **T28**. Deliver live events right after the commit instead of on the
  next per-minute dispatch pass (spec §4: P95 under 1 s; plan §15.9;
  `EventOutboxCommitSignal` + `EventOutboxDispatchWorker.wake`, on unless
  `GAUZY_EVENT_OUTBOX_DISPATCH_ON_COMMIT=false`)
- [x] **T27**. Ever Teams `realtime-client`: resume from the catch-up's own
  `cursor` (not from streamed events), poll the catch-up while connected, apply
  a `presence.changed` only with a higher `revision`, and send a `connectionId`
  with presence at least every minute (plan §15.2, §15.6; ever-teams#5007)
