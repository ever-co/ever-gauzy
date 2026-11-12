import { TaskAutomationStatusCategoryEnum, TaskPriorityEnum, TaskStatusEnum } from '@gauzy/contracts';
import { ITaskAutomationPriorityRow, ITaskAutomationStatusRef, ITaskAutomationStatusRow } from './task-snapshot';

/** A status's place in the workflow; `cancelled` is closed but not done. */
export type TaskAutomationStatusClass = TaskAutomationStatusCategoryEnum | 'cancelled' | null;

/** The default status values of each class (`TaskStatusEnum`), for statuses without workflow flags. */
const DONE_VALUES = new Set<string>([TaskStatusEnum.DONE, TaskStatusEnum.COMPLETED, 'closed']);
const CANCELLED_VALUES = new Set<string>([TaskStatusEnum.CANCELLED, 'canceled']);
const IN_PROGRESS_VALUES = new Set<string>([
	TaskStatusEnum.IN_PROGRESS,
	TaskStatusEnum.READY_FOR_REVIEW,
	TaskStatusEnum.IN_REVIEW,
	TaskStatusEnum.BLOCKED,
	'in_progress'
]);
const TODO_VALUES = new Set<string>([TaskStatusEnum.OPEN, TaskStatusEnum.BACKLOG, 'todo', 'to-do']);

/** The status value a category falls back to when the organization has no status of it. */
export const DEFAULT_STATUS_OF_CATEGORY: Readonly<Record<TaskAutomationStatusCategoryEnum, string>> = Object.freeze({
	[TaskAutomationStatusCategoryEnum.TODO]: TaskStatusEnum.OPEN,
	[TaskAutomationStatusCategoryEnum.IN_PROGRESS]: TaskStatusEnum.IN_PROGRESS,
	[TaskAutomationStatusCategoryEnum.DONE]: TaskStatusEnum.DONE
});

const lower = (value: string | null | undefined): string => String(value ?? '').trim().toLowerCase();

/** Rows a task of `projectId` may use: the project's own, then the organization's (never another project's). */
function inScope<T extends { projectId: string | null }>(rows: readonly T[], projectId: string | null): T | undefined {
	return rows.find((row) => !!projectId && row.projectId === projectId) ?? rows.find((row) => !row.projectId);
}

/**
 * The row a reference's id names, unless it is stale: an update that set the value alone (the status route takes the
 * value without the id) leaves the old row's id behind, and the value is then what the task holds.
 */
function rowOfId<T extends { id: string; value: string | null }>(
	rows: readonly T[],
	id: string | null | undefined,
	value: string | null | undefined
): T | undefined {
	if (!id) return undefined;
	const row = rows.find((candidate) => candidate.id === id);
	if (!row) return undefined;
	return value && row.value && lower(row.value) !== lower(value) ? undefined : row;
}

/**
 * The `task_status` row a status reference names: by id (unless the value moved away from it), else by value — the
 * project's own row first (the ref's project unless one is given), then the organization's, never another project's.
 */
export function statusRowOf(
	ref: ITaskAutomationStatusRef,
	statuses: readonly ITaskAutomationStatusRow[],
	projectId: string | null = ref.projectId ?? null
): ITaskAutomationStatusRow | undefined {
	const byId = rowOfId(statuses, ref.taskStatusId, ref.status);
	if (byId) return byId;
	const value = lower(ref.status);
	if (!value) return undefined;
	return inScope(
		statuses.filter((row) => lower(row.value) === value),
		projectId
	);
}

/**
 * The class of a status: its row's workflow flags when it has any, else its value (`done`, `completed`, `closed`
 * are done; `cancelled` is closed but not done; the review and blocked statuses are in progress; `open`, `backlog`
 * are to-do). A custom status without flags has no class.
 */
export function classifyStatus(
	ref: ITaskAutomationStatusRef,
	statuses: readonly ITaskAutomationStatusRow[]
): TaskAutomationStatusClass {
	const row = statusRowOf(ref, statuses);
	if (row?.isDone) return TaskAutomationStatusCategoryEnum.DONE;
	if (row?.isInProgress) return TaskAutomationStatusCategoryEnum.IN_PROGRESS;
	if (row?.isTodo) return TaskAutomationStatusCategoryEnum.TODO;
	const value = lower(row?.value ?? ref.status);
	if (DONE_VALUES.has(value)) return TaskAutomationStatusCategoryEnum.DONE;
	if (CANCELLED_VALUES.has(value)) return 'cancelled';
	if (IN_PROGRESS_VALUES.has(value)) return TaskAutomationStatusCategoryEnum.IN_PROGRESS;
	if (TODO_VALUES.has(value)) return TaskAutomationStatusCategoryEnum.TODO;
	return null;
}

/** Done or cancelled: nothing is left to do on the task. */
export function isClosedStatus(ref: ITaskAutomationStatusRef, statuses: readonly ITaskAutomationStatusRow[]): boolean {
	const kind = classifyStatus(ref, statuses);
	return kind === TaskAutomationStatusCategoryEnum.DONE || kind === 'cancelled';
}

/** Done (not cancelled). */
export function isDoneStatus(ref: ITaskAutomationStatusRef, statuses: readonly ITaskAutomationStatusRow[]): boolean {
	return classifyStatus(ref, statuses) === TaskAutomationStatusCategoryEnum.DONE;
}

/**
 * Whether a status is one of a list. An item matches the status's id, its value or its row's value or name, without
 * regard to case: a rule may name `in-progress`, `In Progress` or the status's id.
 */
export function statusMatches(
	ref: ITaskAutomationStatusRef,
	list: readonly string[] | null | undefined,
	statuses: readonly ITaskAutomationStatusRow[]
): boolean {
	if (!list?.length) return false;
	const row = statusRowOf(ref, statuses);
	// A stale id (the value moved away from its row) is not the task's status any more.
	const ownId = rowOfId(statuses, ref.taskStatusId, ref.status) || !statuses.some((one) => one.id === ref.taskStatusId) ? ref.taskStatusId : null;
	const own = new Set([lower(ref.status), lower(ownId), lower(row?.id), lower(row?.value), lower(row?.name)].filter(Boolean));
	return list.some((item) => own.has(lower(item)));
}

/**
 * Whether a priority is one of a list (id, value or name, without regard to case). The task's row is the one its id
 * names (unless the value moved away from it), else the row of its value in its project or the organization.
 */
export function priorityMatches(
	ref: { priority: string | null; taskPriorityId: string | null; projectId?: string | null },
	list: readonly string[] | null | undefined,
	priorities: readonly ITaskAutomationPriorityRow[]
): boolean {
	if (!list?.length) return false;
	const byId = rowOfId(priorities, ref.taskPriorityId, ref.priority);
	const value = lower(ref.priority);
	const row =
		byId ??
		(value
			? inScope(
					priorities.filter((candidate) => lower(candidate.value) === value),
					ref.projectId ?? null
				)
			: undefined);
	const ownId = byId || !priorities.some((one) => one.id === ref.taskPriorityId) ? ref.taskPriorityId : null;
	const own = new Set([lower(ref.priority), lower(ownId), lower(row?.id), lower(row?.value), lower(row?.name)].filter(Boolean));
	return list.some((item) => own.has(lower(item)));
}

/**
 * The status a category stands for on a task: the first status (by `order`) of the task's project with the
 * category's flag, else the organization's, else one whose value is the category's default; `null` when the
 * organization has none, and the action then sets the default value without a `TaskStatus` row.
 */
export function firstStatusOfCategory(
	category: TaskAutomationStatusCategoryEnum,
	projectId: string | null,
	statuses: readonly ITaskAutomationStatusRow[]
): ITaskAutomationStatusRow | null {
	const flag = (row: ITaskAutomationStatusRow): boolean =>
		category === TaskAutomationStatusCategoryEnum.DONE
			? !!row.isDone
			: category === TaskAutomationStatusCategoryEnum.IN_PROGRESS
				? !!row.isInProgress
				: !!row.isTodo;
	const byOrder = (a: ITaskAutomationStatusRow, b: ITaskAutomationStatusRow) => (a.order ?? 0) - (b.order ?? 0);
	const flagged = statuses.filter(flag).sort(byOrder);
	const ofProject = projectId ? flagged.find((row) => row.projectId === projectId) : undefined;
	if (ofProject) return ofProject;
	const ofOrganization = flagged.find((row) => !row.projectId);
	if (ofOrganization) return ofOrganization;
	const fallback = DEFAULT_STATUS_OF_CATEGORY[category];
	return statusRowOf({ status: fallback, taskStatusId: null }, statuses, projectId) ?? null;
}

/**
 * The status a `SET_STATUS` names on a task of that project: a `TaskStatus` id, a value (`done`) or a name
 * (`Ready for review`), without regard to case — what saving a rule accepts. A value is preferred to a name, and the
 * project's own status to the organization's.
 */
export function resolveNamedStatus(
	status: string,
	projectId: string | null,
	statuses: readonly ITaskAutomationStatusRow[]
): { value: string; id: string | null } | null {
	const byId = statuses.find((row) => row.id === status);
	// A row without a value cannot be written (its id is no status value).
	if (byId && !byId.value) return null;
	if (byId && (!byId.projectId || byId.projectId === projectId)) return { value: byId.value as string, id: byId.id };
	// Another project's own status stands for its value here: this project's (or the organization's) row of it.
	const named = byId ? (byId.value ?? '') : status;
	const row =
		statusRowOf({ status: named, taskStatusId: null }, statuses, projectId) ??
		(byId ? undefined : statusRowByName(named, statuses, projectId));
	if (row) return row.value ? { value: row.value, id: row.id } : null;
	const value = lower(named);
	return (Object.values(TaskStatusEnum) as string[]).includes(value) ? { value, id: null } : null;
}

/** The `task_status` row a status's display name names: the project's own first, then the organization's. */
function statusRowByName(
	name: string,
	statuses: readonly ITaskAutomationStatusRow[],
	projectId: string | null
): ITaskAutomationStatusRow | undefined {
	const wanted = lower(name);
	if (!wanted) return undefined;
	return inScope(
		statuses.filter((row) => lower(row.name) === wanted),
		projectId
	);
}

/** The priority a `SET_PRIORITY` names (`high` or a `TaskPriority` id) on a task of that project. */
export function resolveNamedPriority(
	priority: string,
	projectId: string | null,
	priorities: readonly ITaskAutomationPriorityRow[]
): { value: string; id: string | null } | null {
	const byId = priorities.find((row) => row.id === priority);
	if (byId && !byId.value) return null;
	if (byId && (!byId.projectId || byId.projectId === projectId)) return { value: byId.value as string, id: byId.id };
	// Another project's own priority stands for its value here (this project's or the organization's row of it).
	const value = lower(byId ? byId.value : priority);
	const matching = priorities.filter((row) => lower(row.value) === value || (!byId && lower(row.name) === value));
	const row = inScope(matching, projectId);
	if (row) return row.value ? { value: row.value, id: row.id } : null;
	return (Object.values(TaskPriorityEnum) as string[]).includes(value) ? { value, id: null } : null;
}
