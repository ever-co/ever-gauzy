# Background Job Idempotency Test Harness (TASK 4)

Reusable assertions for the roadmap's P1 invariant: a retried, redelivered, or duplicate-dispatched
background job must not create duplicate side effects — "same logical job → same final state." See
`idempotency.assertions.ts` for the two shapes of job and the corresponding assertion:

- **Idempotent by construction** (a conditional bulk operation, e.g.
  `UPDATE ... WHERE status = 'ACTIVE'`) → {@link assertConvergesUnderRepeatedExecution}: run it N
  times, assert the state after all N equals the state after just the first.
- **One-shot side effect with no natural "already done" condition** (create a row, send a webhook)
  → {@link assertSideEffectFiresExactly}: run it N times, assert the side effect fired an explicit
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
2. **Negative control / found gap** — `packages/core/src/lib/employee-notification/events/handlers/employee-notification.idempotency.spec.ts`:
   `EmployeeCreateNotificationEventHandler` has **no** dedup guard at all. Redelivering the same
   event creates a duplicate `EmployeeNotification` row every time. The spec documents this actual,
   current behavior (a passing test asserting reality) rather than asserting the desired one — it
   does **not** fix it.

## Found but NOT covered by an automated test in this PR: Zapier/Make.com/Sim webhook duplication

`ZapierTimerStartedHandler` → `ZapierWebhookService.notifyTimerStatusChanged`
(`packages/plugins/integration-zapier/src/lib/handlers/zapier-timer-started.handler.ts`) has the
identical shape of gap as (2) above, but the side effect is an **outbound HTTP POST to a
third-party system** rather than an internal DB row — a higher-consequence version of the same
bug, since a duplicate delivery is visible to, and can be acted on twice by, something outside this
codebase's control. The structurally identical `integration-make-com` and `integration-sim` timer
handlers share the same gap.

This was NOT turned into a committed spec because **`packages/plugins/integration-zapier` currently
has no working path to unit-test anything that imports `@gauzy/core`**: that package's
`tsconfig.json` sets `strict: true, noPropertyAccessFromIndexSignature: true` (stricter than
`packages/core`'s own settings, and stricter than other plugins with existing `@gauzy/core`-importing
specs, e.g. `packages/plugins/ai-chat`, `packages/plugins/docs`, both `strict: false`). Under
ts-jest, importing anything that transitively reaches `packages/core/src/lib/bootstrap/index.ts`
(which every `@gauzy/core` barrel import does) re-type-checks that file under the CONSUMING
package's stricter settings and fails on ~5 plain `process.env.X` accesses that violate
`noPropertyAccessFromIndexSignature` — unrelated to anything this task changed, and not confidently
scoped to "just those 5 lines" without checking the rest of that module's large transitive import
graph (`AppModule`, `BootstrapModule`, the full Nest app wiring) for the same issue. Fixing the
zapier package's testability (either relaxing its test-time tsconfig or auditing/fixing
`bootstrap/index.ts` for index-signature safety) is real, valuable, and separately scoped — not
folded into this test-only task.

## Verification

- `token-cleanup.idempotency.spec.ts`: 3/3 passing (a converge test + an explicit "retry affects
  zero rows" test per handler).
- `employee-notification.idempotency.spec.ts`: 1/1 passing, confirming (via a real duplicate
  `EmployeeCreateNotificationEventHandler.handle()` call) that two identical rows are created for
  one logical event.
- `idempotency.assertions.spec.ts`: 4/4 passing, proving both helpers detect a genuinely
  non-idempotent job (not just a job that happens to converge trivially).
- Full `core` suite re-run after these additions: no regressions.

## Known gaps / follow-ups

- Fix the two found gaps: add a dedup guard to `EmployeeCreateNotificationEventHandler` (e.g. a
  unique constraint or an "already notified for this input" lookup) and to the Zapier/Make.com/Sim
  webhook handlers (e.g. a delivery-dedup key derived from `(subscription.id, timeLog.id, action)`
  checked before each POST). Neither fix is in this PR — see the notes above.
- Resolve `integration-zapier`'s testability blocker so the Zapier case above can get a real,
  committed regression test.
- This is an in-process-only first slice. A real BullMQ/Redis queue-redelivery scenario (the
  `docs-processing` pipeline, `TokenCleanupWorker`'s BullMQ wrapper itself) is deferred — those
  already have partial self-built idempotency (deterministic `jobId`s, chained-id suffixes) and
  would need either real Redis or a fairly involved BullMQ-internals mock to genuinely exercise
  "the queue redelivers this job," which is exactly the extra infrastructure cost this first slice
  was scoped to avoid.
