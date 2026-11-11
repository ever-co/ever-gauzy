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

/** The `task_status` row a status reference names: by id, else by value. */
export function statusRowOf(
	ref: ITaskAutomationStatusRef,
	statuses: readonly ITaskAutomationStatusRow[],
	projectId: string | null = null
): ITaskAutomationStatusRow | undefined {
	if (ref.taskStatusId) {
		const byId = statuses.find((row) => row.id === ref.taskStatusId);
		if (byId) return byId;
	}
	const value = lower(ref.status);
	if (!value) return undefined;
	const matching = statuses.filter((row) => lower(row.value) === value);
	return matching.find((row) => row.projectId === projectId) ?? matching.find((row) => !row.projectId) ?? matching[0];
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
	const own = new Set([lower(ref.status), lower(ref.taskStatusId), lower(row?.id), lower(row?.value), lower(row?.name)].filter(Boolean));
	return list.some((item) => own.has(lower(item)));
}

/** Whether a priority is one of a list (id, value or name, without regard to case). */
export function priorityMatches(
	ref: { priority: string | null; taskPriorityId: string | null },
	list: readonly string[] | null | undefined,
	priorities: readonly ITaskAutomationPriorityRow[]
): boolean {
	if (!list?.length) return false;
	const row = ref.taskPriorityId ? priorities.find((candidate) => candidate.id === ref.taskPriorityId) : undefined;
	const own = new Set([lower(ref.priority), lower(ref.taskPriorityId), lower(row?.value), lower(row?.name)].filter(Boolean));
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

/** The status a `SET_STATUS` names (`done` or a `TaskStatus` id) on a task of that project. */
export function resolveNamedStatus(
	status: string,
	projectId: string | null,
	statuses: readonly ITaskAutomationStatusRow[]
): { value: string; id: string | null } | null {
	const byId = statuses.find((row) => row.id === status);
	if (byId) return { value: byId.value ?? status, id: byId.id };
	const row = statusRowOf({ status, taskStatusId: null }, statuses, projectId);
	if (row) return { value: row.value ?? status, id: row.id };
	const value = lower(status);
	return (Object.values(TaskStatusEnum) as string[]).includes(value) ? { value, id: null } : null;
}

/** The priority a `SET_PRIORITY` names (`high` or a `TaskPriority` id) on a task of that project. */
export function resolveNamedPriority(
	priority: string,
	projectId: string | null,
	priorities: readonly ITaskAutomationPriorityRow[]
): { value: string; id: string | null } | null {
	const byId = priorities.find((row) => row.id === priority);
	if (byId) return { value: byId.value ?? priority, id: byId.id };
	const value = lower(priority);
	const matching = priorities.filter((row) => lower(row.value) === value || lower(row.name) === value);
	const row = matching.find((candidate) => candidate.projectId === projectId) ?? matching.find((candidate) => !candidate.projectId) ?? matching[0];
	if (row) return { value: row.value ?? value, id: row.id };
	return (Object.values(TaskPriorityEnum) as string[]).includes(value) ? { value, id: null } : null;
}
