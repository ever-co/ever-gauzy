/**
 * Reusable background-job idempotency invariants (TASK 4 of the improvement roadmap: a retry,
 * queue redelivery, or duplicate event dispatch must not create duplicate side effects — "same
 * logical job -> same final state"). Two shapes of job need two different assertions:
 *
 * - A job that is idempotent BY CONSTRUCTION (a conditional bulk operation like
 *   `UPDATE ... WHERE status = 'ACTIVE'` — the second run simply matches nothing new) converges to
 *   the same state no matter how many times it runs. Use {@link assertConvergesUnderRepeatedExecution}.
 * - A job with a one-shot side effect and no natural "already done" condition (create a row, send
 *   a webhook, dispatch a notification) needs an explicit dedup guard to be retry-safe at all — it
 *   won't converge on its own. Use {@link assertSideEffectFiresExactly} to state the expected call
 *   count explicitly, whether that's "exactly once despite N attempts" (a guard exists and works) or
 *   "N times for N attempts" (documenting a found gap — see individual spec files/READMEs for cases
 *   of the latter).
 */

/**
 * Runs `run()` `times` times (>= 2) and asserts the tracked state after ALL runs equals the state
 * after just the FIRST run.
 *
 * @param run - Executes one logical attempt at the job (e.g. `handler.execute(command)`).
 * @param snapshot - Captures whatever "final state" means for this job (e.g. every row's status).
 *   Called after the first run and again after every run; must return a plain, `toEqual`-comparable
 *   value (a fresh array/object each call — do not return a mutable reference the job itself keeps
 *   mutating in place, or both snapshots will alias the same object and trivially "match").
 * @param times - Total number of executions, first run included (default 3: once, then two retries).
 */
export async function assertConvergesUnderRepeatedExecution(params: {
	run: () => Promise<unknown>;
	snapshot: () => unknown;
	times?: number;
}): Promise<void> {
	const { run, snapshot, times = 3 } = params;

	// A review finding on this PR: `times` below 2 makes the whole assertion vacuous — there is no
	// second run to converge, so it would pass for a job with NO idempotency guard at all just as
	// readily as for one that's genuinely correct. `NaN` would skip the retries the same way and
	// `Infinity` would never finish. Fail loudly instead of silently asserting nothing.
	if (!Number.isInteger(times) || times < 2) {
		throw new Error(
			`assertConvergesUnderRepeatedExecution: times must be an integer >= 2 to prove convergence, got ${times}.`
		);
	}

	await run();
	const afterFirstRun = snapshot();

	// Compared after EVERY retry, not only the last: a retry that changes the state is not made
	// idempotent by a later retry that happens to change it back.
	for (let attempt = 1; attempt < times; attempt++) {
		await run();
		expect(snapshot()).toEqual(afterFirstRun);
	}
}

/** Structural type covering both `jest.fn()` and `jest.spyOn(...)` results, whose precise generic
 *  types otherwise don't unify (a `SpyInstance` isn't assignable to `jest.Mock`). Only `.mock.calls`
 *  is needed here. */
type CallTracker = { mock: { calls: unknown[] } };

/**
 * Runs `run()` `times` times and asserts a tracked side effect fired exactly `expectedCalls` times
 * in total across all of them.
 *
 * @param run - Executes one logical attempt at the job.
 * @param sideEffect - A `jest.fn()` or `jest.spyOn(...)` standing in for the externally-visible
 *   effect (an HTTP client call, a repository `create`/`save`, an emitted event, ...).
 * @param expectedCalls - The invariant being asserted. Pass `1` to assert a dedup guard makes the
 *   side effect fire at most once no matter how many attempts; pass `times` to explicitly document
 *   that no such guard exists yet (a found gap, not an endorsement — see the calling spec's comments).
 * @param times - Total number of executions (default 2: once, then one retry/redelivery).
 */
export async function assertSideEffectFiresExactly(params: {
	run: () => Promise<unknown>;
	sideEffect: CallTracker;
	expectedCalls: number;
	times?: number;
}): Promise<void> {
	const { run, sideEffect, expectedCalls, times = 2 } = params;

	// Same reasoning as `assertConvergesUnderRepeatedExecution`: with fewer than 2 executions there is
	// no retry or redelivery at all, so `expectedCalls` would say nothing about a dedup guard (and
	// `times < 1` would trivially "prove" `expectedCalls === 0`).
	if (!Number.isInteger(times) || times < 2) {
		throw new Error(`assertSideEffectFiresExactly: times must be an integer >= 2, got ${times}.`);
	}

	// Only the calls these executions make count: a call recorded earlier (fixture setup, a previous
	// step of the same test) must not stand in for one a broken job failed to make.
	const callsBefore = sideEffect.mock.calls.length;

	for (let attempt = 0; attempt < times; attempt++) {
		await run();
	}

	expect(sideEffect.mock.calls.length - callsBefore).toBe(expectedCalls);
}
