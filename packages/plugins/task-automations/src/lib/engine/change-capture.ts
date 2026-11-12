import { ActionTypeEnum, BaseEntityEnum, ID, ITaskAutomationChangeEvent, ITaskAutomationFieldChange } from '@gauzy/contracts';

/** What the capture reads of an activity fact (`IActivityLogInput`, published as `ActivityLogEvent`). */
export interface ITaskActivityFact {
	entity?: string | null;
	entityId?: ID | null;
	action?: string | null;
	organizationId?: ID | null;
	tenantId?: ID | null;
	previousValues?: Array<Record<string, unknown>> | null;
	updatedValues?: Array<Record<string, unknown>> | null;
}

/** The activity log stores each changed field as a one-key object; this folds them into one record. */
function fold(values: Array<Record<string, unknown>> | null | undefined): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const entry of Array.isArray(values) ? values : []) {
		if (entry && typeof entry === 'object') Object.assign(out, entry);
	}
	return out;
}

/** A scalar as text: an id, a status value, a date (ISO); anything else is no value. */
function scalar(value: unknown): string | null {
	if (value === null || value === undefined || value === '') return null;
	if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
	if (typeof value === 'string' || typeof value === 'number') return String(value);
	if (typeof value === 'object' && 'id' in (value as object)) return scalar((value as { id?: unknown }).id);
	return null;
}

function dateText(value: unknown): string | null {
	if (value === null || value === undefined || value === '') return null;
	const date = value instanceof Date ? value : new Date(String(value));
	return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function ids(value: unknown): ID[] {
	if (!Array.isArray(value)) return [];
	return [...new Set(value.map((item) => scalar(item)).filter((id): id is string => !!id))];
}

/**
 * The change of a field the update stated, or nothing when it did not state it or the value is the same. The id
 * field and its relation are both read (`taskStatusId` or `taskStatus: { id }`), since the routes take either.
 */
function fieldChange(
	previous: Record<string, unknown>,
	updated: Record<string, unknown>,
	keys: string[],
	read: (value: unknown) => string | null = scalar
): ITaskAutomationFieldChange | undefined {
	const key = keys.find((candidate) => candidate in updated);
	if (!key) return undefined;
	const from = read(keys.map((candidate) => previous[candidate]).find((value) => value !== undefined));
	const to = read(updated[key]);
	return from === to ? undefined : { from, to };
}

/**
 * Turns the platform's activity fact of a task into the change a rule may fire on (`task_automation.task_changed`),
 * or `null` for anything else: another entity, a deletion, an update that changed none of the fields a trigger
 * looks at, a fact without its tenant or organization.
 *
 * The activity log states the fields the update carried with their values before and after (`previousValues` /
 * `updatedValues`, compared by `!==`), so a whole task sent back unchanged still names its assignees: those are
 * compared here as sets, and only the people really added or removed count.
 */
export function changeFromActivity(
	fact: ITaskActivityFact,
	context: { depth?: number; chain?: ID[]; actorUserId?: ID | null } = {}
): ITaskAutomationChangeEvent | null {
	if (!fact || fact.entity !== BaseEntityEnum.Task || !fact.entityId || !fact.tenantId || !fact.organizationId) {
		return null;
	}
	const base = {
		taskId: fact.entityId,
		tenantId: fact.tenantId,
		organizationId: fact.organizationId,
		actorUserId: context.actorUserId ?? null,
		depth: context.depth ?? 0,
		chain: [...(context.chain ?? [])]
	};
	if (fact.action === ActionTypeEnum.Created) {
		return { ...base, action: 'created', changes: {} };
	}
	if (fact.action !== ActionTypeEnum.Updated) {
		return null;
	}
	const previous = fold(fact.previousValues);
	const updated = fold(fact.updatedValues);
	const changes: ITaskAutomationChangeEvent['changes'] = {};

	const status = fieldChange(previous, updated, ['status']);
	if (status) changes.status = status;
	const taskStatusId = fieldChange(previous, updated, ['taskStatusId', 'taskStatus']);
	if (taskStatusId) changes.taskStatusId = taskStatusId;
	const priority = fieldChange(previous, updated, ['priority']);
	if (priority) changes.priority = priority;
	const taskPriorityId = fieldChange(previous, updated, ['taskPriorityId', 'taskPriority']);
	if (taskPriorityId) changes.taskPriorityId = taskPriorityId;
	const parentId = fieldChange(previous, updated, ['parentId', 'parent']);
	if (parentId) changes.parentId = parentId;
	const dueDate = fieldChange(previous, updated, ['dueDate'], dateText);
	if (dueDate) changes.dueDate = dueDate;
	if ('members' in updated) {
		const before = ids(previous['members']);
		const after = ids(updated['members']);
		const added = after.filter((id) => !before.includes(id));
		const removed = before.filter((id) => !after.includes(id));
		if (added.length) changes.membersAdded = added;
		if (removed.length) changes.membersRemoved = removed;
	}
	if (Object.keys(changes).length === 0) {
		return null;
	}
	return { ...base, action: 'updated', changes };
}

/** The field changes a change event may carry, each `{ from, to }` of text or null. */
const FIELD_CHANGES = ['status', 'taskStatusId', 'parentId', 'priority', 'taskPriorityId', 'dueDate'] as const;
/** The member lists a change event may carry, each a list of ids. */
const MEMBER_LISTS = ['membersAdded', 'membersRemoved'] as const;

const isTextOrNull = (value: unknown): boolean => value === null || value === undefined || typeof value === 'string';

/**
 * A change event's `changes` back, field by field, or `null` when one is malformed (a string where a list of ids is
 * due, a field change that is not `{ from, to }` of text): a rule must never fire on what the capture did not write.
 */
function parseChanges(raw: unknown): ITaskAutomationChangeEvent['changes'] | null {
	if (raw === undefined || raw === null) return {};
	if (typeof raw !== 'object' || Array.isArray(raw)) return null;
	const value = raw as Record<string, unknown>;
	const changes: ITaskAutomationChangeEvent['changes'] = {};
	for (const key of FIELD_CHANGES) {
		const field = value[key];
		if (field === undefined) continue;
		if (!field || typeof field !== 'object' || Array.isArray(field)) return null;
		// Both ends are stated (null for "none"): a change with an end missing is not one the capture wrote.
		if (!('from' in field) || !('to' in field)) return null;
		const { from, to } = field as Record<string, unknown>;
		if (!isTextOrNull(from) || !isTextOrNull(to)) return null;
		changes[key] = { from: (from as string | null | undefined) ?? null, to: (to as string | null | undefined) ?? null };
	}
	for (const key of MEMBER_LISTS) {
		const list = value[key];
		if (list === undefined) continue;
		if (!Array.isArray(list) || list.some((id) => typeof id !== 'string' || !id)) return null;
		changes[key] = [...list] as ID[];
	}
	return changes;
}

/** Reads a change event's payload back, or `null` when it is not one (a consumer never trusts the row's shape). */
export function parseChangeEvent(data: unknown): ITaskAutomationChangeEvent | null {
	if (!data || typeof data !== 'object') return null;
	const value = data as Partial<ITaskAutomationChangeEvent>;
	if (!value.taskId || !value.tenantId || !value.organizationId) return null;
	if (value.action !== 'created' && value.action !== 'updated') return null;
	const changes = parseChanges(value.changes);
	if (!changes) return null;
	return {
		taskId: String(value.taskId),
		tenantId: String(value.tenantId),
		organizationId: String(value.organizationId),
		action: value.action,
		changes,
		actorUserId: value.actorUserId ?? null,
		depth: Number.isFinite(Number(value.depth)) ? Number(value.depth) : 0,
		chain: Array.isArray(value.chain) ? value.chain.map(String) : []
	};
}
