import { ID, ITask, ITaskBulkChanges, ITaskBulkUpdateInput, ITaskBulkUpdateItem, ITaskUpdateInput, TASK_BULK_UPDATE_MAX } from '@gauzy/contracts';

/** What went wrong with the request as a whole, before any task is touched. */
export class BulkUpdateRequestError extends Error {
	constructor(readonly code: 'BULK_UPDATE_EMPTY' | 'BULK_UPDATE_AMBIGUOUS' | 'BULK_LIMIT_EXCEEDED' | 'BULK_UPDATE_NO_CHANGES', message: string) {
		super(message);
	}
}

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

/** Whether a changes object asks for anything. */
export function hasChanges(changes: ITaskBulkChanges | null | undefined): boolean {
	if (!changes) return false;
	return CHANGE_KEYS.some((key) => changes[key] !== undefined);
}

function uniqueIds(ids: readonly ID[] | undefined): ID[] {
	return [...new Set((ids ?? []).map((id) => String(id)))];
}

/**
 * The request as a list of items: `taskIds` + `changes` (one change for many tasks) or `items` (a change per
 * task, which is how an undo sends the previous values back). Exactly one of the two forms, at most the limit,
 * each task once.
 */
export function normalizeBulkUpdate(input: ITaskBulkUpdateInput): ITaskBulkUpdateItem[] {
	const hasList = Array.isArray(input.taskIds) && input.taskIds.length > 0;
	const hasItems = Array.isArray(input.items) && input.items.length > 0;
	if (hasList && hasItems) {
		throw new BulkUpdateRequestError('BULK_UPDATE_AMBIGUOUS', 'Send either taskIds with changes, or items; not both.');
	}
	if (!hasList && !hasItems) {
		throw new BulkUpdateRequestError('BULK_UPDATE_EMPTY', 'Nothing to change: send taskIds with changes, or items.');
	}
	const items: ITaskBulkUpdateItem[] = hasList
		? uniqueIds(input.taskIds).map((taskId) => ({ taskId, changes: input.changes ?? {} }))
		: dedupeItems(input.items ?? []);
	if (items.length > TASK_BULK_UPDATE_MAX) {
		throw new BulkUpdateRequestError('BULK_LIMIT_EXCEEDED', `A bulk update takes at most ${TASK_BULK_UPDATE_MAX} tasks.`);
	}
	if (items.some((item) => !hasChanges(item.changes))) {
		throw new BulkUpdateRequestError('BULK_UPDATE_NO_CHANGES', 'Every item needs at least one change.');
	}
	return items;
}

function dedupeItems(items: readonly ITaskBulkUpdateItem[]): ITaskBulkUpdateItem[] {
	const byId = new Map<string, ITaskBulkUpdateItem>();
	for (const item of items) {
		const taskId = String(item.taskId);
		// The last change stated for a task wins, as if the earlier ones had been applied and overwritten.
		byId.set(taskId, { taskId, changes: { ...(byId.get(taskId)?.changes ?? {}), ...item.changes } });
	}
	return [...byId.values()];
}

/** What `changesToUpdate` answers: the update to run, and the previous values that undo it. */
export interface IBulkChangeApplication {
	update: Partial<ITaskUpdateInput>;
	previous: ITaskBulkChanges;
}

type TaskRow = Pick<ITask, 'id' | 'status' | 'priority' | 'size' | 'projectId' | 'organizationSprintId' | 'dueDate' | 'tags' | 'members'> & {
	taskStatusId?: ID | null;
	taskPriorityId?: ID | null;
	taskSizeId?: ID | null;
	isArchived?: boolean;
};

/**
 * One task's changes as the update the single route runs, with the previous values of every field touched in
 * the same changes shape (so an undo is the same request with `previous` as the changes). Tag and member sets
 * are computed from the task as it is now: `add` and `remove` become the full list, `set` replaces it.
 */
export function changesToUpdate(task: TaskRow, changes: ITaskBulkChanges): IBulkChangeApplication {
	const update: Partial<ITaskUpdateInput> & Record<string, unknown> = {};
	const previous: ITaskBulkChanges = {};

	const scalar = <K extends keyof ITaskBulkChanges>(key: K, current: unknown) => {
		if (changes[key] === undefined) return;
		(previous as Record<string, unknown>)[key] = current ?? null;
		update[key] = changes[key] as never;
	};
	scalar('status', task.status);
	scalar('taskStatusId', task.taskStatusId);
	scalar('priority', task.priority);
	scalar('taskPriorityId', task.taskPriorityId);
	scalar('size', task.size);
	scalar('taskSizeId', task.taskSizeId);
	scalar('projectId', task.projectId);
	scalar('organizationSprintId', task.organizationSprintId);
	scalar('dueDate', task.dueDate);
	scalar('isArchived', task.isArchived ?? false);

	const currentTags = uniqueIds((task.tags ?? []).map((tag) => tag.id).filter((id): id is ID => !!id));
	const nextTags = nextSet(currentTags, changes.setTagIds, changes.addTagIds, changes.removeTagIds);
	if (nextTags) {
		previous.setTagIds = currentTags;
		update.tags = nextTags.map((id) => ({ id })) as never;
	}
	const currentMembers = uniqueIds((task.members ?? []).map((member) => member.id).filter((id): id is ID => !!id));
	const nextMembers = nextSet(currentMembers, changes.setMemberIds, changes.addMemberIds, changes.removeMemberIds);
	if (nextMembers) {
		previous.setMemberIds = currentMembers;
		update.members = nextMembers.map((id) => ({ id })) as never;
	}
	return { update, previous };
}

/** The new id list, or null when the changes do not touch it. */
function nextSet(current: ID[], set?: ID[], add?: ID[], remove?: ID[]): ID[] | null {
	if (set !== undefined) return uniqueIds(set);
	if (add === undefined && remove === undefined) return null;
	const removed = new Set(uniqueIds(remove));
	return uniqueIds([...current.filter((id) => !removed.has(String(id))), ...(add ?? [])]);
}
