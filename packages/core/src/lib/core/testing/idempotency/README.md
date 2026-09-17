# Background Job Idempotency Test Harness (TASK 4)

Reusable assertions for the roadmap's P1 invariant: a retried, redelivered, or duplicate-dispatched
background job must not create duplicate side effects — "same logical job → same final state." See
`idempotency.assertions.ts` for the two shapes of job and the corresponding assertion:

- **Idempotent by construction** (a conditional bulk operation, e.g.
  `UPDATE ... WHERE status = 'ACTIVE'`) → `assertConvergesUnderRepeatedExecution`: run it N
  times, assert the state after all N equals the state after just the first.
- **One-shot side effect with no natural "already done" condition** (create a row, send a webhook)
  → `assertSideEffectFiresExactly`: run it N times, assert the side effect fired an explicit
  expected number of times — which may be `1` (a guard exists and works) or `N` (no guard exists —
  used here to document a found gap, not to endorse it).

Both are unit-tested against themselves in `idempotency.assertions.spec.ts` (a passing case and a
failing case for each), so a future change to the helpers can't silently turn them into a no-op.

## Why in-process CQRS event handlers, not a real BullMQ/Redis queue

This repo's real queue (`@gauzy/scheduler`, BullMQ-backed) has no Redis/in-memory-Redis test
double anywhere in the suite — every existing queue-adjacent spec stubs the scheduler layer out
entirely at the module boundary and calls the plain class underneath directly (see
`packages/plugins/docs/src/lib/knowledge/queue/docs-processing.worker.spec.ts`). Exercising a real
BullMQ redelivery would mean standing up actual Redis infrastructure this test suite deliberately
avoids — the same "avoid a live external dependency" reasoning TASK 1–3 followed for Postgres/a
running API server. `@nestjs/cqrs` event handlers (`@EventsHandler`) are a better first slice: they
are plain classes with a `.handle(event)` method, no queue involved, and several of them perform
exactly the kind of side effect (row creation, outbound webhook) this task is about — calling
`.handle()` twice directly simulates a redelivered/duplicated event with zero extra infrastructure.

## Applied to (see individual spec files for detail)

1. **Positive control** — `packages/core/src/lib/token/commands/handlers/token-cleanup.idempotency.spec.ts`:
   `CleanupExpiredTokensHandler`/`CleanupInactiveTokensHandler` are idempotent by construction (both
   are conditional bulk `UPDATE`s scoped to `status = ACTIVE`), so a retried/redelivered cleanup job
   converges to the same end state and a retry affects zero additional rows.
2. **Found gap, fixed** — `packages/core/src/lib/employee-notification/events/handlers/employee-notification.idempotency.spec.ts`:
   `EmployeeCreateNotificationEventHandler` had **no** dedup guard at all; redelivering the same
   event created a duplicate `EmployeeNotification` row every time. Fixed in
   `EmployeeNotificationService.create()` — before creating, it looks for an IDENTICAL notification
   (same receiver, entity, entityId, type, sender, title and message, in the same tenant and
   organization) that is still unread, not archived, and was created within
   `EMPLOYEE_NOTIFICATION_REDELIVERY_WINDOW_MS` (60 s), and returns that instead of inserting again.
   Anything it cannot prove is a duplicate is inserted as before: an event without a
   `receiverEmployeeId` (a key TypeORM would silently drop from the lookup, widening it), the same
   event once the first notification was read or archived (an employee re-assigned to a task must be
   told again), the same event after the window, or a failed lookup. The window absorbs a duplicated
   event; it is not meant to merge distinct ones, and a read-then-insert does not stop two concurrent
   deliveries. The spec pins each of those cases, including the two real regressions an earlier,
   unwindowed version of this check caused (re-assignment after reading, and every mention on a task
   after the first, since `MentionService` publishes without a receiver).
3. **Found gap, fixed** — `packages/plugins/integration-zapier/src/lib/handlers/zapier-timer-started.handler.idempotency.spec.ts`:
   `ZapierWebhookService.notifyTimerStatusChanged` had the identical shape of gap as (2), but the
   side effect is an **outbound HTTP POST to a third-party system** rather than an internal DB row —
   a higher-consequence version of the same bug, since a duplicate delivery is visible to, and can be
   acted on twice by, something outside this codebase's control. Fixed with an in-process,
   time-windowed delivery-dedup cache keyed on `(subscription.id, action, timeLog.id)`, checked
   before each POST and only marked once a delivery actually succeeds (a failed attempt is never
   suppressed — it must stay free to retry). See the spec/service files for why this is
   intentionally in-process-only (protects against the redelivery scenario that's actually reachable
   today — an in-process CQRS event — not a distributed queue's at-least-once delivery).

Getting (3) into a committed spec at all required unblocking a separate, pre-existing testability
gap: `packages/plugins/integration-zapier` had **no working path to unit-test anything that imports
`@gauzy/core`**. That package's `tsconfig.json` sets `strict: true,
noPropertyAccessFromIndexSignature: true` (stricter than `packages/core`'s own settings, and
stricter than other plugins with existing `@gauzy/core`-importing specs, e.g.
`packages/plugins/ai-chat`, `packages/plugins/docs`, both `strict: false`). Under ts-jest, importing
anything that transitively reaches `packages/core/src/lib/bootstrap/index.ts` (which every
`@gauzy/core` barrel import does) re-type-checked that file under the CONSUMING package's stricter
settings and failed on ~5 plain `process.env.X` accesses unrelated to this task. Fixed at the
test-tooling layer only (`packages/plugins/integration-zapier/jest.config.ts` +
`tsconfig.spec.json`): `isolatedModules: true` on the ts-jest transform (transpile per-file instead
of type-checking the whole program — the same reason `@gauzy/core`'s own bootstrap doesn't need to
satisfy a downstream consumer's stricter flags) plus the same `transformIgnorePatterns` +
`allowJs: true` `packages/core/jest.config.ts`/`tsconfig.spec.json` already needed for the ESM-only
deps (`uuid`, ...) reached through `@gauzy/core`'s entity graph. No production code touched by this
part of the fix.

The structurally identical `integration-make-com` and `integration-sim` timer handlers share the
same webhook-duplication gap and are **not** fixed here — see Known gaps below.

## Verification

- `token-cleanup.idempotency.spec.ts`: 3/3 passing (a converge test + an explicit "retry affects
  zero rows" test per handler).
- `employee-notification.idempotency.spec.ts`: 8/8 passing, with and without `DB_ORM=mikro-orm` (the
  service's ORM is pinned to TypeORM against the in-memory repository) — a redelivered unread event
  creates exactly one row; a different entity, a read or archived first notification, an event after
  the window, a mention without a receiver, a different sender or title, and a failed lookup each
  still create their own. The read, archived, after-window, mention and sender/title cases all fail
  against the earlier unwindowed check.
- `zapier-timer-started.handler.idempotency.spec.ts`: 2/2 passing — a redelivered event sends
  exactly one webhook, and a different timeLog's event still gets its own delivery. (This test
  failed with 2 calls before the fix, confirming it actually catches the gap.)
- `idempotency.assertions.spec.ts`: 4/4 passing, proving both helpers detect a genuinely
  non-idempotent job (not just a job that happens to converge trivially).
- Full `core` suite (679/679) and the `integration-zapier` plugin suite re-run after these changes:
  no regressions.

## Known gaps / follow-ups

- `integration-make-com` and `integration-sim` have the identical webhook-duplication shape as the
  Zapier case and are not fixed — same delivery-dedup pattern should be applied there.
- This is an in-process-only first slice. A real BullMQ/Redis queue-redelivery scenario (the
  `docs-processing` pipeline, `TokenCleanupWorker`'s BullMQ wrapper itself) is deferred — those
  already have partial self-built idempotency (deterministic `jobId`s, chained-id suffixes) and
  would need either real Redis or a fairly involved BullMQ-internals mock to genuinely exercise
  "the queue redelivers this job," which is exactly the extra infrastructure cost this first slice
  was scoped to avoid.
- The Zapier webhook dedup cache is in-process/in-memory only (see the service's own comment): it
  does not survive a restart and is not shared across horizontally-scaled instances. Good enough for
  the reachable-today redelivery scenario (an in-process CQRS event), not a substitute for a
  persistent delivery-log if this ever moves onto a real retryable queue.
