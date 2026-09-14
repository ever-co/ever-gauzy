import { assertConvergesUnderRepeatedExecution, assertSideEffectFiresExactly } from './idempotency.assertions';

/**
 * Unit tests for the assertion helpers themselves — both a positive case (a genuinely idempotent
 * job passes) and a negative case (a non-idempotent job is caught), so a future change to these
 * helpers can't silently turn them into a no-op that always passes.
 */
describe('assertConvergesUnderRepeatedExecution', () => {
	it('passes for a job whose state converges after the first run', async () => {
		let applied = false;
		await assertConvergesUnderRepeatedExecution({
			run: async () => {
				applied = true;
			},
			snapshot: () => applied
		});
	});

	it('fails for a job that keeps mutating state on every run', async () => {
		let counter = 0;
		await expect(
			assertConvergesUnderRepeatedExecution({
				run: async () => {
					counter += 1;
				},
				snapshot: () => counter
			})
		).rejects.toThrow();
	});
});

describe('assertSideEffectFiresExactly', () => {
	it('passes when a dedup guard keeps a one-shot side effect to a single call', async () => {
		const sideEffect = jest.fn();
		let sent = false;
		await assertSideEffectFiresExactly({
			run: async () => {
				if (!sent) {
					sent = true;
					sideEffect();
				}
			},
			sideEffect,
			expectedCalls: 1
		});
	});

	it('fails when a side effect fires once per attempt instead of the expected count', async () => {
		const sideEffect = jest.fn();
		await expect(
			assertSideEffectFiresExactly({
				run: async () => sideEffect(),
				sideEffect,
				expectedCalls: 1
			})
		).rejects.toThrow();
	});
});
