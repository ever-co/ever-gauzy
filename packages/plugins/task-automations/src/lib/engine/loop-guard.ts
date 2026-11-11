import { ID, TASK_AUTOMATION_LIMITS } from '@gauzy/contracts';

/**
 * Why a rule must not run on a change (spec FR-12), or `null` when it may.
 *
 * - `depth`: the change was made by a rule that a rule's change set off (more hops than `TASK_AUTOMATION_LIMITS.maxDepth`);
 * - `own-change`: the rule is one of those that led to the change, so running it again could only undo or repeat itself.
 */
export function loopGuardReason(
	ruleId: ID,
	depth: number | null | undefined,
	chain: readonly ID[] | null | undefined,
	maxDepth: number = TASK_AUTOMATION_LIMITS.maxDepth
): 'depth' | 'own-change' | null {
	if ((depth ?? 0) > maxDepth) return 'depth';
	if ((chain ?? []).includes(ruleId)) return 'own-change';
	return null;
}

/**
 * The marker a rule's changes carry (on the system actor of its request context): the rules that led to them, this
 * one last, and their depth — one more than the change the rule ran on.
 */
export interface ITaskAutomationActorMarker {
	ruleId: ID;
	ruleName: string;
	runId: ID;
	depth: number;
	chain: ID[];
}

export function nextMarker(
	rule: { id: ID; name: string },
	runId: ID,
	depth: number | null | undefined,
	chain: readonly ID[] | null | undefined
): ITaskAutomationActorMarker {
	return {
		ruleId: rule.id,
		ruleName: rule.name,
		runId,
		depth: (depth ?? 0) + 1,
		chain: [...(chain ?? []).filter((id) => id !== rule.id), rule.id]
	};
}

/** Whether automations changed a task too often lately to change it again (spec FR-13). */
export function isRateLimited(recentChanges: number, limit: number = TASK_AUTOMATION_LIMITS.rateLimitChanges): boolean {
	return recentChanges >= limit;
}
