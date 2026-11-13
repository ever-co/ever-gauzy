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

/** A status, priority or size record a change names by its id, as the bulk update reads it to check and name it. */
export interface IBulkChangeRecord {
	id: ID;
	name?: string | null;
	value?: string | null;
	tenantId?: ID | null;
	organizationId?: ID | null;
}

/**
 * The record ids a change can carry: the record each names, the name it goes with, and whether a record named alone
 * gives the task its name. A status does not: the clients read a task's status by its record (`taskStatusId`), and a
 * status named by its record alone has always left the status text as it was. A priority and a size do: the clients
 * that read them by their name (Ever Teams, the platform's priority and size filters) would otherwise keep showing
 * the one the task had, since a team's own priority or size cannot be named (the route takes only the platform's).
 */
export const BULK_RECORD_FIELDS = [
	{ idField: 'taskStatusId', nameField: 'status', code: 'TASK_STATUS_NOT_FOUND', label: 'status', takesName: false },
	{ idField: 'taskPriorityId', nameField: 'priority', code: 'TASK_PRIORITY_NOT_FOUND', label: 'priority', takesName: true },
	{ idField: 'taskSizeId', nameField: 'size', code: 'TASK_SIZE_NOT_FOUND', label: 'size', takesName: true }
] as const;

export type BulkRecordField = (typeof BULK_RECORD_FIELDS)[number]['idField'];

/** The records the items name, per id field, keyed by their id in lower case. */
export type BulkChangeRecords = Readonly<Record<BulkRecordField, ReadonlyMap<string, IBulkChangeRecord>>>;

/** How a record id is keyed: uuids compare case-insensitively (Postgres answers them in lower case). */
export const recordKey = (id: ID): string => String(id).toLowerCase();

/** The record ids the items name, per id field, each once; `null` clears and names none. */
export function recordIdsOf(items: readonly ITaskBulkUpdateItem[]): Record<BulkRecordField, ID[]> {
	const ids = {} as Record<BulkRecordField, ID[]>;
	for (const { idField } of BULK_RECORD_FIELDS) {
		const named = items.map((item) => item.changes?.[idField]).filter((id): id is ID => typeof id === 'string' && id.length > 0);
		ids[idField] = [...new Map(named.map((id) => [recordKey(id), id])).values()];
	}
	return ids;
}

/**
 * Why a task may not take the records its change names, or null when it may. A record must be one the task's
 * organization may take: its own, the tenant's shared one (no organization), or a platform default (no tenant). A
 * record of another organization or tenant, or an id that names none, reads as not found (as the chat card's check
 * answers), so the answer tells nothing about other organizations. The first record refused is named.
 */
export function recordRefusalOf(
	changes: ITaskBulkChanges,
	records: BulkChangeRecords,
	scope: { tenantId: ID | null | undefined; organizationId: ID | null | undefined }
): string | null {
	const same = (first: ID | null | undefined, second: ID | null | undefined) => !!first && !!second && recordKey(first) === recordKey(second);
	for (const { idField, code, label } of BULK_RECORD_FIELDS) {
		const id = changes[idField];
		if (id === undefined || id === null) continue;
		const record = records[idField].get(recordKey(id));
		const inTenant = !!record && (!record.tenantId || same(record.tenantId, scope.tenantId));
		const inOrganization = !!record && (!record.organizationId || same(record.organizationId, scope.organizationId));
		if (!inTenant || !inOrganization) {
			return `${code}: ${idField} names no ${label} of this organization.`;
		}
	}
	return null;
}

/** The name a task holds for a record, as the task page writes it: its value, else its name. */
function recordNameOf(record: IBulkChangeRecord | undefined): string | undefined {
	return (record?.value ?? '').trim() || (record?.name ?? '').trim() || undefined;
}

/**
 * The changes with the name of a priority or size named by its record alone (`taskPriorityId` without `priority`):
 * the record's, as the task page writes it, so the task shows the record it now has. A name sent beside the record is
 * kept as sent (an undo puts back exactly the name the task held), and a record cleared (`null`) leaves the name.
 * An undo that names the record alone gets the record's name back (see `previousWithoutRecordNames`).
 */
export function withRecordNames(changes: ITaskBulkChanges, records: BulkChangeRecords): ITaskBulkChanges {
	let named: ITaskBulkChanges | null = null;
	for (const { idField, nameField, takesName } of BULK_RECORD_FIELDS) {
		const id = changes[idField];
		if (!takesName || id === undefined || id === null || changes[nameField] !== undefined) continue;
		const name = recordNameOf(records[idField].get(recordKey(id)));
		if (name === undefined) continue;
		named = { ...(named ?? changes), [nameField]: name } as ITaskBulkChanges;
	}
	return named ?? changes;
}

/**
 * The previous values without a priority's or size's name that the record beside it gives back: when the record the
 * task held names it exactly so (its value, else its name), the undo puts the name back by the record alone (see
 * `withRecordNames`). A name its record does not give back stays: the task had no record, or its text no longer
 * matches the record's (renamed since, or written without it). A client that must leave a name out (a team's own,
 * which the route refuses) can then tell a full undo from a partial one by whether a name is left out at all.
 */
export function previousWithoutRecordNames(previous: ITaskBulkChanges, records: BulkChangeRecords): ITaskBulkChanges {
	let trimmed: Record<string, unknown> | null = null;
	for (const { idField, nameField, takesName } of BULK_RECORD_FIELDS) {
		const id = previous[idField];
		const name = previous[nameField];
		if (!takesName || typeof id !== 'string' || !id || typeof name !== 'string') continue;
		if (recordNameOf(records[idField].get(recordKey(id))) !== name) continue;
		trimmed = trimmed ?? { ...previous };
		delete trimmed[nameField];
	}
	return (trimmed as ITaskBulkChanges | null) ?? previous;
}

/** The relation each record id is stored through: a single task update can name a record by either. */
const RECORD_RELATIONS: Readonly<Record<BulkRecordField, 'taskStatus' | 'taskPriority' | 'taskSize'>> = {
	taskStatusId: 'taskStatus',
	taskPriorityId: 'taskPriority',
	taskSizeId: 'taskSize'
};

/** The record a relation names: its id, null when the relation is cleared, undefined when it names none. */
function relationRecordOf(value: unknown): ID | null | undefined {
	if (value === null) return null;
	const id = value && typeof value === 'object' ? (value as { id?: unknown }).id : undefined;
	return typeof id === 'string' && id ? id : undefined;
}

/** What `recordChangesOfUpdate` answers. */
export interface IUpdateRecordChanges<T> {
	/** The update as it is saved: a record named both by its id and by its relation names one record in both. */
	update: T;
	/** The records the update moves the task to, each with the name sent beside it, in the bulk changes shape. */
	changes: ITaskBulkChanges;
	/** The record each field the update names is saved with (null: cleared); a field it does not name keeps the task's. */
	named: Partial<Record<BulkRecordField, ID | null>>;
}

/** Whether two record ids name the same record, none being one too (no record, or a cleared one). */
function sameRecord(first: ID | null | undefined, second: ID | null | undefined): boolean {
	if (!first || !second) return !first && !second;
	return recordKey(first) === recordKey(second);
}

/**
 * The status, priority and size records a single task update (`PUT /tasks/:id`) moves the task to, in the changes
 * shape the bulk update judges (`recordRefusalOf`) and names (`withRecordNames`), each with the name sent beside it.
 * A record is named by its id (`taskPriorityId`) or by its relation (`taskPriority: { id }`). The record the task
 * already holds is no change (a client sends the whole task back), and neither is a record cleared (`null`).
 *
 * A body can name a record both ways, and differently: a client that sends the whole task back with a new id beside
 * the relation it read (or a `null` relation, the task holding none), or a new relation beside the id it read. The
 * save takes the one that changes the task's record, except that it keeps an object relation over a new id, which was
 * lost. So the update is answered naming in both places the one that changes the task's record, and the relation's
 * when both do, as the save takes it.
 *
 * @param update The update as it was sent.
 * @param held The records the task holds.
 */
export function recordChangesOfUpdate<T extends object>(update: T, held: Partial<Record<BulkRecordField, ID | null>>): IUpdateRecordChanges<T> {
	const body = update as Record<string, unknown>;
	let saved: Record<string, unknown> | null = null;
	const changes: Record<string, unknown> = {};
	const named: Partial<Record<BulkRecordField, ID | null>> = {};
	for (const { idField, nameField } of BULK_RECORD_FIELDS) {
		const relation = RECORD_RELATIONS[idField];
		const byId = body[idField] as ID | null | undefined;
		const byRelation = relationRecordOf(body[relation]);
		let record = byRelation === undefined ? byId : byRelation;
		if (byRelation !== undefined && byId !== undefined && !sameRecord(byId, byRelation)) {
			// A copy whose fields are replaced, never changed in place: the caller's update (and its relations) stays as sent.
			saved = saved ?? { ...body };
			if (sameRecord(byRelation, held[idField])) {
				// The relation as the task holds it, sent back with the task: the id beside it is the change.
				record = byId;
				saved[relation] = byId === null ? null : { id: byId };
			} else {
				saved[idField] = byRelation;
			}
		}
		if (record === undefined) continue;
		named[idField] = record;
		if (record === null || sameRecord(record, held[idField])) continue;
		changes[idField] = record;
		if (body[nameField] !== undefined) changes[nameField] = body[nameField];
	}
	return { update: (saved ?? update) as T, changes: changes as ITaskBulkChanges, named };
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
