import { TaskPriorityEnum, TaskStatusEnum } from '@gauzy/contracts';
import { LinearIssue, LinearIssueUpdateInput, LinearStateType, LinearWorkflowState } from '../client/linear-api.client';

/** The kinds of Linear workflow state, in the order a reverse lookup prefers them. */
export const LINEAR_STATE_TYPES: readonly LinearStateType[] = ['started', 'completed', 'canceled', 'backlog', 'unstarted', 'triage'];

/** The task status each kind of Linear state becomes unless the mapping says otherwise. */
export const DEFAULT_STATE_MAP: Record<LinearStateType, string> = {
	triage: TaskStatusEnum.OPEN,
	backlog: TaskStatusEnum.BACKLOG,
	unstarted: TaskStatusEnum.OPEN,
	started: TaskStatusEnum.IN_PROGRESS,
	completed: TaskStatusEnum.COMPLETED,
	canceled: TaskStatusEnum.CANCELLED
};

/** The mapping's state map with the defaults under it; unknown keys and non-string values are dropped. */
export function parseStateMap(json: string | null | undefined): Record<LinearStateType, string> {
	const result = { ...DEFAULT_STATE_MAP };
	if (!json) return result;
	let parsed: unknown;
	try {
		parsed = JSON.parse(json);
	} catch {
		return result;
	}
	if (!parsed || typeof parsed !== 'object') return result;
	for (const type of LINEAR_STATE_TYPES) {
		const value = (parsed as Record<string, unknown>)[type];
		if (typeof value === 'string' && value.trim()) result[type] = value.trim();
	}
	return result;
}

/** A state map as stored: only the entries that differ from the defaults, or null when none does. */
export function serializeStateMap(input: Partial<Record<string, string>> | null | undefined): string | null {
	if (!input) return null;
	const kept: Partial<Record<LinearStateType, string>> = {};
	for (const type of LINEAR_STATE_TYPES) {
		const value = input[type];
		if (typeof value === 'string' && value.trim() && value.trim() !== DEFAULT_STATE_MAP[type]) kept[type] = value.trim();
	}
	return Object.keys(kept).length ? JSON.stringify(kept) : null;
}

/** The task status of a Linear state kind. */
export function taskStatusOf(type: LinearStateType | null | undefined, stateMap: Record<LinearStateType, string>): string {
	return (type && stateMap[type]) || DEFAULT_STATE_MAP.unstarted;
}

/** The Linear state kind a task status maps back to (the first kind, in preference order, that names it), or null. */
export function stateTypeOfStatus(status: string | null | undefined, stateMap: Record<LinearStateType, string>): LinearStateType | null {
	if (!status) return null;
	const wanted = status.trim().toLowerCase();
	for (const type of LINEAR_STATE_TYPES) {
		if (stateMap[type].toLowerCase() === wanted) return type;
	}
	return null;
}

/** The Linear workflow state a task status should move an issue to: the team's first state of the mapped kind. */
export function linearStateFor(status: string | null | undefined, states: readonly LinearWorkflowState[], stateMap: Record<LinearStateType, string>): LinearWorkflowState | null {
	const type = stateTypeOfStatus(status, stateMap);
	if (!type) return null;
	return states.find((state) => state.type === type) ?? null;
}

/** Linear's 1–4 priority as a task priority; 0 (none) is null. */
export function taskPriorityOf(priority: number | null | undefined): TaskPriorityEnum | null {
	switch (priority) {
		case 1:
			return TaskPriorityEnum.URGENT;
		case 2:
			return TaskPriorityEnum.HIGH;
		case 3:
			return TaskPriorityEnum.MEDIUM;
		case 4:
			return TaskPriorityEnum.LOW;
		default:
			return null;
	}
}

/** A task priority as Linear's number (0 = none). */
export function linearPriorityOf(priority: string | null | undefined): number {
	switch (priority) {
		case TaskPriorityEnum.URGENT:
			return 1;
		case TaskPriorityEnum.HIGH:
			return 2;
		case TaskPriorityEnum.MEDIUM:
			return 3;
		case TaskPriorityEnum.LOW:
			return 4;
		default:
			return 0;
	}
}

/** A Linear calendar date (`YYYY-MM-DD`) as a date at midnight UTC, or null. */
export function dueDateOf(dueDate: string | null | undefined): Date | null {
	if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return null;
	const date = new Date(`${dueDate}T00:00:00.000Z`);
	return Number.isNaN(date.getTime()) ? null : date;
}

/** A date as Linear's calendar date, or null. */
export function linearDueDateOf(date: Date | string | null | undefined): string | null {
	if (!date) return null;
	const value = typeof date === 'string' ? new Date(date) : date;
	return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
}

/** The task fields an issue sets (the rest — project, members, tags, parent — is the sync's to resolve). */
export function taskFieldsOf(issue: LinearIssue, stateMap: Record<LinearStateType, string>) {
	return {
		title: issue.title?.trim() || issue.identifier,
		description: issue.description ?? null,
		status: taskStatusOf(issue.state?.type, stateMap),
		priority: taskPriorityOf(issue.priority),
		dueDate: dueDateOf(issue.dueDate)
	};
}

/** What a task sends back to its issue: the fields the mapping covers, the state by kind. */
export function issueUpdateOf(
	task: { title?: string | null; description?: string | null; status?: string | null; priority?: string | null; dueDate?: Date | string | null },
	states: readonly LinearWorkflowState[],
	stateMap: Record<LinearStateType, string>
): LinearIssueUpdateInput {
	const input: LinearIssueUpdateInput = {};
	if (task.title?.trim()) input.title = task.title.trim();
	if (task.description !== undefined) input.description = task.description ?? null;
	const state = linearStateFor(task.status, states, stateMap);
	if (state) input.stateId = state.id;
	input.priority = linearPriorityOf(task.priority);
	if (task.dueDate !== undefined) input.dueDate = linearDueDateOf(task.dueDate);
	return input;
}

/** The newest `updatedAt` among the issues (the watermark the next incremental import starts after). */
export function watermarkOf(issues: readonly Pick<LinearIssue, 'updatedAt'>[], current: string | null | undefined): string | null {
	let latest = current ?? null;
	for (const issue of issues) {
		if (issue.updatedAt && (!latest || issue.updatedAt > latest)) latest = issue.updatedAt;
	}
	return latest;
}
