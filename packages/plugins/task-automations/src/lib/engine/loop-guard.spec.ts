import { TASK_AUTOMATION_LIMITS } from '@gauzy/contracts';
import { isRateLimited, loopGuardReason, nextMarker } from './loop-guard';

describe('loop guard', () => {
	it('lets a person’s change and an automation’s change through, and stops a change two hops deep', () => {
		expect(loopGuardReason('rule-a', 0, [])).toBeNull();
		expect(loopGuardReason('rule-b', 1, ['rule-a'])).toBeNull();
		expect(loopGuardReason('rule-a', 2, ['rule-a', 'rule-b'])).toBe('depth');
		expect(loopGuardReason('rule-c', 2, ['rule-a', 'rule-b'])).toBe('depth');
	});

	it('never runs a rule on a change it caused', () => {
		expect(loopGuardReason('rule-a', 1, ['rule-a'])).toBe('own-change');
	});

	it('the ping-pong of two rules that undo each other stops after one round', () => {
		// A person moves the task (depth 0): rule A runs and makes a depth-1 change.
		expect(loopGuardReason('rule-a', 0, [])).toBeNull();
		const afterA = nextMarker({ id: 'rule-a', name: 'A' }, 'run-1', 0, []);
		expect(afterA).toEqual({ ruleId: 'rule-a', ruleName: 'A', runId: 'run-1', depth: 1, chain: ['rule-a'] });
		// Rule B runs on A's change and makes a depth-2 change.
		expect(loopGuardReason('rule-b', afterA.depth, afterA.chain)).toBeNull();
		const afterB = nextMarker({ id: 'rule-b', name: 'B' }, 'run-2', afterA.depth, afterA.chain);
		expect(afterB.depth).toBe(2);
		expect(afterB.chain).toEqual(['rule-a', 'rule-b']);
		// Nothing runs on B's change.
		expect(loopGuardReason('rule-a', afterB.depth, afterB.chain)).toBe('depth');
	});

	it('keeps a rule once in the chain', () => {
		expect(nextMarker({ id: 'rule-a', name: 'A' }, 'run', 1, ['rule-a']).chain).toEqual(['rule-a']);
	});

	it('limits the automated changes of a task', () => {
		expect(isRateLimited(TASK_AUTOMATION_LIMITS.rateLimitChanges - 1)).toBe(false);
		expect(isRateLimited(TASK_AUTOMATION_LIMITS.rateLimitChanges)).toBe(true);
		expect(isRateLimited(3, 3)).toBe(true);
	});
});
