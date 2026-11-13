import {
	ID,
	ITaskBulkChanges,
	ITaskBulkUpdateInput,
	ITaskBulkUpdateItem,
	ITaskBulkUpdateOutcome,
	ITaskPriority,
	ITaskSize,
	ITaskStatus,
	TASK_BULK_UPDATE_MAX,
	TaskPriorityEnum,
	TaskSizeEnum,
	TaskStatusEnum
} from '@gauzy/contracts';
import { dateOnlyOf } from '@gauzy/ui-core/common';

/** What the bulk toolbar changes. */
export type BulkAction = 'status' | 'priority' | 'size' | 'assignees' | 'labels' | 'project' | 'dueDate' | 'archive';

/** Why a bulk request cannot be sent. */
export type BulkRequestRefusal = 'empty' | 'limit' | 'no-changes';

const ENUM_VALUES: Readonly<Record<'status' | 'priority' | 'size', ReadonlySet<string>>> = {
	status: new Set(Object.values(TaskStatusEnum)),
	priority: new Set(Object.values(TaskPriorityEnum)),
	size: new Set(Object.values(TaskSizeEnum))
};

const CHANGE_KEYS: readonly (keyof ITaskBulkChanges)[] = [
	'status',
	'taskStatusId',
	'priority',
	'taskPriorityId',
	'size',
	'taskSizeId',
	'addTagIds',
	'removeTagIds',
	'setTagIds',
	'addMemberIds',
	'removeMemberIds',
	'setMemberIds',
	'projectId',
	'organizationSprintId',
	'dueDate',
	'isArchived'
];

/**
 * The changes without what the platform would refuse: a status, priority or size name that is not one of its
 * built-in values (a custom status is named by its id alone), and anything that is not a change key. The previous
 * values of a task can hold such a name (a status written by an older client), and one refused field would refuse
 * the whole undo.
 */
export function sanitizeChanges(changes: ITaskBulkChanges | null | undefined): ITaskBulkChanges {
	const result: Record<string, unknown> = {};
	for (const key of CHANGE_KEYS) {
		const value = changes?.[key];
		if (value === undefined) continue;
		if (
			(key === 'status' || key === 'priority' || key === 'size') &&
			value !== null &&
			!ENUM_VALUES[key].has(String(value))
		)
			continue;
		result[key] = value;
	}
	return result as ITaskBulkChanges;
}

/** Whether a changes object asks for anything. */
export function hasChanges(changes: ITaskBulkChanges | null | undefined): boolean {
	return !!changes && CHANGE_KEYS.some((key) => changes[key] !== undefined);
}

/** The changes that set a status: its id, and its name where it is one of the platform's values. */
export function statusChanges(status: Pick<ITaskStatus, 'id' | 'value' | 'name'>): ITaskBulkChanges {
	return sanitizeChanges({ taskStatusId: status.id as ID, status: (status.value ?? status.name) as TaskStatusEnum });
}

/** The changes that set a priority: its id, and its name where it is one of the platform's values. */
export function priorityChanges(priority: Pick<ITaskPriority, 'id' | 'value' | 'name'>): ITaskBulkChanges {
	return sanitizeChanges({
		taskPriorityId: priority.id as ID,
		priority: (priority.value ?? priority.name) as TaskPriorityEnum
	});
}

/** The changes that set a size: its id, and its name where it is one of the platform's values. */
export function sizeChanges(size: Pick<ITaskSize, 'id' | 'value' | 'name'>): ITaskBulkChanges {
	return sanitizeChanges({ taskSizeId: size.id as ID, size: (size.value ?? size.name) as TaskSizeEnum });
}

/**
 * The changes that set (or clear, with null) a due date, from the date picker's day: that calendar day in the
 * platform's date-only form (midnight UTC of it), so a reader in any zone sees the day that was picked. The end of
 * the picker's local day was a moment, which a reader east of the picker read as the next day.
 */
export function dueDateChanges(day: Date | null): ITaskBulkChanges {
	if (!day) return { dueDate: null };
	return { dueDate: dateOnlyOf(day.getFullYear(), day.getMonth(), day.getDate()) };
}

/**
 * One bulk request for the selection: `taskIds` + `changes`, each task once. Refused (nothing to send) when the
 * selection is empty, holds more than the platform takes, or the changes change nothing.
 */
export function bulkRequest(
	taskIds: readonly ID[],
	changes: ITaskBulkChanges,
	scope: { organizationId?: ID; tenantId?: ID },
	limit = TASK_BULK_UPDATE_MAX
): { request: ITaskBulkUpdateInput } | { refusal: BulkRequestRefusal } {
	const ids = [...new Set(taskIds)];
	if (!ids.length) return { refusal: 'empty' };
	if (ids.length > limit) return { refusal: 'limit' };
	const clean = sanitizeChanges(changes);
	if (!hasChanges(clean)) return { refusal: 'no-changes' };
	return { request: { ...scopeOf(scope), taskIds: ids, changes: clean } };
}

/**
 * The request that undoes an outcome: for every task that changed, its previous values as that task's changes
 * (`items`, the platform's undo form). Null when nothing changed, or nothing can be put back.
 */
export function undoRequest(
	outcome: ITaskBulkUpdateOutcome | null | undefined,
	scope: { organizationId?: ID; tenantId?: ID }
): ITaskBulkUpdateInput | null {
	const items: ITaskBulkUpdateItem[] = [];
	for (const result of outcome?.results ?? []) {
		if (!result.ok || !result.previous) continue;
		const changes = sanitizeChanges(result.previous);
		if (hasChanges(changes)) items.push({ taskId: result.taskId, changes });
	}
	return items.length ? { ...scopeOf(scope), items } : null;
}

/**
 * The tasks an undo would put back only in part: their previous status, priority or size name is not one the
 * platform's bulk route takes (an older client wrote it), so the undo restores the record (`taskStatusId`, …) and
 * leaves the name as the change set it.
 */
export function undoLosses(outcome: ITaskBulkUpdateOutcome | null | undefined): ID[] {
	const lossy: ID[] = [];
	for (const result of outcome?.results ?? []) {
		if (!result.ok || !result.previous) continue;
		const previous = result.previous as Record<string, unknown>;
		const dropped = (['status', 'priority', 'size'] as const).some(
			(key) =>
				previous[key] !== undefined && previous[key] !== null && !ENUM_VALUES[key].has(String(previous[key]))
		);
		if (dropped) lossy.push(result.taskId);
	}
	return lossy;
}

/**
 * How many of those tasks the undo did put back, in part: said to the person rather than reported as a full undo.
 * A task the undo refused is not one of them (the refusal is reported on its own).
 */
export function restoredInPart(lossy: readonly ID[], undone: ITaskBulkUpdateOutcome | null | undefined): number {
	const restored = new Set(changedTaskIds(undone).map(String));
	return lossy.filter((taskId) => restored.has(String(taskId))).length;
}

/** An outcome summed up for the toast: how many changed, and which were refused and why. */
export interface BulkSummary {
	applied: number;
	refused: number;
	refusals: Array<{ taskId: ID; error: string }>;
}

export function summarizeOutcome(outcome: ITaskBulkUpdateOutcome | null | undefined): BulkSummary {
	const results = outcome?.results ?? [];
	const refusals = results
		.filter((result) => !result.ok)
		.map((result) => ({ taskId: result.taskId, error: result.error ?? '' }));
	return {
		applied: outcome?.applied ?? results.filter((result) => result.ok).length,
		refused: outcome?.refused ?? refusals.length,
		refusals
	};
}

/** The ids of the tasks an outcome changed: the rows to read again. */
export function changedTaskIds(outcome: ITaskBulkUpdateOutcome | null | undefined): ID[] {
	return (outcome?.results ?? []).filter((result) => result.ok).map((result) => result.taskId);
}

/** The outcome of deleting tasks one by one, in the shape the toast reads. */
export function deleteOutcome(results: Array<{ taskId: ID; ok: boolean; error?: string }>): BulkSummary {
	const refusals = results
		.filter((result) => !result.ok)
		.map((result) => ({ taskId: result.taskId, error: result.error ?? '' }));
	return { applied: results.length - refusals.length, refused: refusals.length, refusals };
}

function scopeOf(scope: { organizationId?: ID; tenantId?: ID }): { organizationId?: ID; tenantId?: ID } {
	return {
		...(scope.organizationId ? { organizationId: scope.organizationId } : {}),
		...(scope.tenantId ? { tenantId: scope.tenantId } : {})
	};
}
