import {
	ID,
	ITaskAutomationAction,
	ITaskAutomationChange,
	TaskAutomationActionEnum,
	TaskAutomationRunOutcomeEnum,
	TaskAutomationStatusCategoryEnum
} from '@gauzy/contracts';
import { firstStatusOfCategory, resolveNamedPriority, resolveNamedStatus, DEFAULT_STATUS_OF_CATEGORY } from './status-categories';
import { ITaskAutomationCatalog, ITaskAutomationTaskSnapshot } from './task-snapshot';

/** The fields a rule's actions change, as the task update takes them. */
export interface ITaskAutomationTaskUpdate {
	status?: string | null;
	taskStatusId?: ID | null;
	priority?: string | null;
	taskPriorityId?: ID | null;
	memberIds?: ID[];
	tagIds?: ID[];
}

/** A notice to the task's assignees. */
export interface ITaskAutomationNotice {
	employeeIds: ID[];
	message: string | null;
	/** The action's place in the rule: a rule with two notices files two, each under an identity of its own. */
	actionIndex: number;
}

/** What a rule's actions would do to a task: one update, the notices, and a line per action. */
export interface ITaskAutomationPlan {
	update: ITaskAutomationTaskUpdate;
	notices: ITaskAutomationNotice[];
	changes: ITaskAutomationChange[];
}

const unique = (ids: readonly (string | null | undefined)[]): ID[] => [...new Set(ids.filter((id): id is string => !!id))];
const sameSet = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((id) => b.includes(id));

/**
 * Plans a rule's actions on a task (spec FR-7), in their order: each action sees what the previous ones set, a value
 * the task already has is reported as no change, and an action whose status, priority, assignee or label is not the
 * organization's is reported as failed without stopping the others. Nothing is written here.
 */
export function planActions(
	actions: readonly ITaskAutomationAction[] | null | undefined,
	task: ITaskAutomationTaskSnapshot,
	catalog: ITaskAutomationCatalog
): ITaskAutomationPlan {
	const working = {
		status: task.status ?? null,
		taskStatusId: task.taskStatusId ?? null,
		priority: task.priority ?? null,
		taskPriorityId: task.taskPriorityId ?? null,
		memberIds: unique(task.memberIds),
		tagIds: unique(task.tagIds)
	};
	const changes: ITaskAutomationChange[] = [];
	const notices: ITaskAutomationNotice[] = [];
	const known = (set: ReadonlySet<string> | undefined, ids: readonly string[]) => ({
		ok: set ? ids.filter((id) => set.has(id)) : [...ids],
		unknown: set ? ids.filter((id) => !set.has(id)) : []
	});

	for (const [actionIndex, action] of (actions ?? []).entries()) {
		switch (action?.type) {
			case TaskAutomationActionEnum.SET_STATUS: {
				let target: { value: string; id: string | null } | null = null;
				if (action.category) {
					const row = firstStatusOfCategory(action.category, task.projectId, catalog.statuses);
					target = row
						? { value: row.value ?? DEFAULT_STATUS_OF_CATEGORY[action.category], id: row.id }
						: isCategory(action.category)
							? { value: DEFAULT_STATUS_OF_CATEGORY[action.category], id: null }
							: null;
				} else if (action.status) {
					target = resolveNamedStatus(action.status, task.projectId, catalog.statuses);
				}
				if (!target) {
					changes.push({ action: action.type, field: 'status', failed: true, note: 'The status is not one of the organization.' });
					break;
				}
				// Already set only when the stored value is the target's, and so is the row where both sides name one: a task
				// whose value moved without its row (a value-only update left the old row) is set again.
				const same =
					working.status === target.value && (!target.id || !working.taskStatusId || working.taskStatusId === target.id);
				if (same) {
					changes.push({ action: action.type, field: 'status', from: working.status, to: target.value, note: 'Already set.' });
					break;
				}
				changes.push({ action: action.type, field: 'status', from: working.status, to: target.value });
				working.status = target.value;
				working.taskStatusId = target.id;
				break;
			}
			case TaskAutomationActionEnum.SET_PRIORITY: {
				const target = action.priority ? resolveNamedPriority(action.priority, task.projectId, catalog.priorities) : null;
				if (!target) {
					changes.push({ action: action.type, field: 'priority', failed: true, note: 'The priority is not one of the organization.' });
					break;
				}
				const same =
					working.priority === target.value &&
					(!target.id || !working.taskPriorityId || working.taskPriorityId === target.id);
				if (same) {
					changes.push({ action: action.type, field: 'priority', from: working.priority, to: target.value, note: 'Already set.' });
					break;
				}
				changes.push({ action: action.type, field: 'priority', from: working.priority, to: target.value });
				working.priority = target.value;
				working.taskPriorityId = target.id;
				break;
			}
			case TaskAutomationActionEnum.ADD_ASSIGNEES:
			case TaskAutomationActionEnum.SET_ASSIGNEES: {
				const named = unique(action.employeeIds ?? []);
				const { ok, unknown } = known(catalog.employeeIds, named);
				const next = action.type === TaskAutomationActionEnum.ADD_ASSIGNEES ? unique([...working.memberIds, ...ok]) : ok;
				if (unknown.length) {
					changes.push({
						action: action.type,
						field: 'members',
						failed: true,
						note: `${unknown.length} assignee(s) are not employees of the organization.`
					});
				}
				if (action.type === TaskAutomationActionEnum.SET_ASSIGNEES && unknown.length) {
					// A person named is not the organization's any more: the replacement the rule states cannot be made,
					// so the assignees stay as they are (the rule's other actions still run).
					break;
				}
				if (sameSet(next, working.memberIds)) {
					changes.push({ action: action.type, field: 'members', from: working.memberIds, to: next, note: 'Already set.' });
					break;
				}
				changes.push({ action: action.type, field: 'members', from: working.memberIds, to: next });
				working.memberIds = next;
				break;
			}
			case TaskAutomationActionEnum.ADD_LABELS:
			case TaskAutomationActionEnum.REMOVE_LABELS: {
				const named = unique(action.tagIds ?? []);
				const { ok, unknown } = known(catalog.tagIds, named);
				const next =
					action.type === TaskAutomationActionEnum.ADD_LABELS
						? unique([...working.tagIds, ...ok])
						: working.tagIds.filter((id) => !named.includes(id));
				if (unknown.length && action.type === TaskAutomationActionEnum.ADD_LABELS) {
					changes.push({ action: action.type, field: 'tags', failed: true, note: `${unknown.length} label(s) are not of the organization.` });
				}
				if (sameSet(next, working.tagIds)) {
					changes.push({ action: action.type, field: 'tags', from: working.tagIds, to: next, note: 'Already set.' });
					break;
				}
				changes.push({ action: action.type, field: 'tags', from: working.tagIds, to: next });
				working.tagIds = next;
				break;
			}
			case TaskAutomationActionEnum.NOTIFY_ASSIGNEES: {
				const message = String(action.message ?? '').trim() || null;
				if (!working.memberIds.length) {
					changes.push({ action: action.type, field: 'notice', note: 'The task has no assignee.' });
					break;
				}
				notices.push({ employeeIds: [...working.memberIds], message, actionIndex });
				changes.push({ action: action.type, field: 'notice', to: working.memberIds.length });
				break;
			}
			default:
				changes.push({ action: action?.type, failed: true, note: 'Unknown action.' } as ITaskAutomationChange);
		}
	}

	const update: ITaskAutomationTaskUpdate = {};
	if (working.status !== (task.status ?? null) || working.taskStatusId !== (task.taskStatusId ?? null)) {
		update.status = working.status;
		update.taskStatusId = working.taskStatusId;
	}
	if (working.priority !== (task.priority ?? null) || working.taskPriorityId !== (task.taskPriorityId ?? null)) {
		update.priority = working.priority;
		update.taskPriorityId = working.taskPriorityId;
	}
	if (!sameSet(working.memberIds, unique(task.memberIds))) update.memberIds = working.memberIds;
	if (!sameSet(working.tagIds, unique(task.tagIds))) update.tagIds = working.tagIds;
	return { update, notices, changes };
}

function isCategory(value: string): value is TaskAutomationStatusCategoryEnum {
	return (Object.values(TaskAutomationStatusCategoryEnum) as string[]).includes(value);
}

/** Whether a plan changes or sends anything. */
export function planHasEffect(plan: Pick<ITaskAutomationPlan, 'update' | 'notices'>): boolean {
	return Object.keys(plan.update).length > 0 || plan.notices.length > 0;
}

/** What a run of a plan records: applied, partial (some actions failed), no change, or failed. */
export function outcomeOfPlan(plan: Pick<ITaskAutomationPlan, 'update' | 'notices' | 'changes'>): TaskAutomationRunOutcomeEnum {
	const anyFailed = plan.changes.some((change) => change.failed);
	if (!planHasEffect(plan)) {
		return anyFailed ? TaskAutomationRunOutcomeEnum.FAILED : TaskAutomationRunOutcomeEnum.NO_CHANGE;
	}
	return anyFailed ? TaskAutomationRunOutcomeEnum.PARTIAL : TaskAutomationRunOutcomeEnum.APPLIED;
}
