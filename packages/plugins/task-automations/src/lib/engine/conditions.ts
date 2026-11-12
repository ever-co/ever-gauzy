import {
	ITaskAutomationCondition,
	ITaskAutomationConditionResult,
	TaskAutomationConditionEnum
} from '@gauzy/contracts';
import { classifyStatus, isClosedStatus, isDoneStatus, priorityMatches, statusMatches } from './status-categories';
import { ITaskAutomationCatalog, ITaskAutomationTaskSnapshot } from './task-snapshot';

const values = (condition: ITaskAutomationCondition): string[] => (condition.values ?? []).map(String);

/**
 * One condition on the task a rule acts on (spec FR-6). An unknown condition fails, so a rule saved by a newer
 * version is never applied on a guess.
 */
export function evaluateCondition(
	condition: ITaskAutomationCondition,
	task: ITaskAutomationTaskSnapshot,
	catalog: Pick<ITaskAutomationCatalog, 'statuses' | 'priorities'>
): ITaskAutomationConditionResult {
	const result = (passed: boolean, detail?: string): ITaskAutomationConditionResult => ({
		type: condition.type,
		passed,
		...(detail ? { detail } : {})
	});
	const statusLabel = task.status ?? task.taskStatusId ?? 'no status';
	switch (condition.type) {
		case TaskAutomationConditionEnum.STATUS_IS:
			return result(statusMatches(task, values(condition), catalog.statuses), `status ${statusLabel}`);
		case TaskAutomationConditionEnum.STATUS_IS_NOT:
			return result(!statusMatches(task, values(condition), catalog.statuses), `status ${statusLabel}`);
		case TaskAutomationConditionEnum.STATUS_CATEGORY_IS: {
			const kind = classifyStatus(task, catalog.statuses);
			return result(!!kind && values(condition).includes(kind), `status category ${kind ?? 'none'}`);
		}
		case TaskAutomationConditionEnum.IS_OPEN:
			return result(!isClosedStatus(task, catalog.statuses), `status ${statusLabel}`);
		case TaskAutomationConditionEnum.IS_DONE:
			return result(isDoneStatus(task, catalog.statuses), `status ${statusLabel}`);
		case TaskAutomationConditionEnum.PRIORITY_IS:
			return result(
				priorityMatches(task, values(condition), catalog.priorities),
				`priority ${task.priority ?? task.taskPriorityId ?? 'none'}`
			);
		case TaskAutomationConditionEnum.HAS_LABEL:
			return result(values(condition).some((id) => task.tagIds.includes(id)), `${task.tagIds.length} label(s)`);
		case TaskAutomationConditionEnum.NOT_HAS_LABEL:
			return result(!values(condition).some((id) => task.tagIds.includes(id)), `${task.tagIds.length} label(s)`);
		case TaskAutomationConditionEnum.IS_ASSIGNED:
			return result(task.memberIds.length > 0, `${task.memberIds.length} assignee(s)`);
		case TaskAutomationConditionEnum.IS_UNASSIGNED:
			return result(task.memberIds.length === 0, `${task.memberIds.length} assignee(s)`);
		case TaskAutomationConditionEnum.ASSIGNEE_IS:
			return result(values(condition).some((id) => task.memberIds.includes(id)), `${task.memberIds.length} assignee(s)`);
		case TaskAutomationConditionEnum.IS_SUBTASK:
			return result(!!task.parentId, task.parentId ? 'has a parent' : 'no parent');
		case TaskAutomationConditionEnum.IS_NOT_SUBTASK:
			return result(!task.parentId, task.parentId ? 'has a parent' : 'no parent');
		case TaskAutomationConditionEnum.TITLE_CONTAINS: {
			const text = String(condition.text ?? '').trim().toLowerCase();
			return result(!!text && String(task.title ?? '').toLowerCase().includes(text));
		}
		default:
			return result(false, 'unknown condition');
	}
}

/** All of a rule's conditions (none: the rule applies). Every condition is evaluated, so a dry run shows each one. */
export function evaluateConditions(
	conditions: readonly ITaskAutomationCondition[] | null | undefined,
	task: ITaskAutomationTaskSnapshot,
	catalog: Pick<ITaskAutomationCatalog, 'statuses' | 'priorities'>
): { passed: boolean; results: ITaskAutomationConditionResult[] } {
	const results = (conditions ?? []).map((condition) => evaluateCondition(condition, task, catalog));
	return { passed: results.every((one) => one.passed), results };
}
