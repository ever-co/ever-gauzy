import { sanitizeRichHtml } from '../core/html-sanitizer';

/**
 * The task fields the task integrations (Linear, Asana, Trello) keep in sync both ways, and the three-way merge an
 * inbound apply runs on them: the value both sides last agreed on (what the provider sent the last time the item was
 * applied), the task's value now, and the provider's value now.
 *
 * - Changed only by the provider: the provider's value is applied.
 * - Changed only on the platform: the task keeps its value (the provider never had it; an outbound mapping sends it).
 * - Changed on both sides to the same value: nothing to decide.
 * - Changed on both sides to different values: a conflict. The provider wins for the fields it syncs (the spec's
 *   proposed policy) and the task's value is kept in the conflict record, so a manager can restore it.
 *
 * With no agreed value yet (an item applied before conflicts were recorded, or a task re-created), the provider's
 * value is applied as before and becomes the agreed one.
 */

/** The synced fields, in the order a conflict list shows them. */
export const SYNCED_TASK_FIELDS = ['title', 'description', 'status', 'priority', 'dueDate'] as const;

export type SyncedTaskField = (typeof SYNCED_TASK_FIELDS)[number];

/** A synced field's value as it is compared and stored: text (a due date as an ISO date-time to the second), or null. */
export type SyncedTaskValues = Record<SyncedTaskField, string | null>;

/** What a task or an item carries of the synced fields. */
export interface SyncedTaskFieldsInput {
	title?: string | null;
	description?: string | null;
	status?: string | null;
	priority?: string | null;
	dueDate?: Date | string | null;
}

/** One field changed on both sides to different values. */
export interface SyncedFieldConflict {
	field: SyncedTaskField;
	/** The value both sides last agreed on. */
	synced: string | null;
	/** The task's value, replaced by the provider's. */
	platform: string | null;
	/** The provider's value, now the task's. */
	external: string | null;
}

/** The outcome of a merge: the fields the task keeps (left out of the write) and the conflicts to record. */
export interface SyncedFieldsMerge {
	keepPlatform: SyncedTaskField[];
	conflicts: SyncedFieldConflict[];
}

function text(value: string | null | undefined): string | null {
	if (value === null || value === undefined) return null;
	const trimmed = String(value).trim();
	return trimmed ? trimmed : null;
}

/** A due date to the second (MySQL keeps no milliseconds), as an ISO date-time; null when absent or unreadable. */
function instant(value: Date | string | null | undefined): string | null {
	if (value === null || value === undefined || value === '') return null;
	const date = value instanceof Date ? value : new Date(value);
	const time = date.getTime();
	if (Number.isNaN(time)) return null;
	return new Date(Math.floor(time / 1000) * 1000).toISOString();
}

/**
 * The synced fields of a task or an item, as compared and stored. A description is taken in the form the task
 * store keeps it (`TaskService` passes it through `sanitizeRichHtml`, which is idempotent): a provider's raw text and
 * the task's saved copy of it then compare equal, and a stored conflict value matches the task's.
 */
export function syncedValuesOf(input: SyncedTaskFieldsInput): SyncedTaskValues {
	return {
		title: text(input.title),
		description: text(typeof input.description === 'string' ? sanitizeRichHtml(input.description) : input.description),
		status: text(input.status),
		priority: text(input.priority),
		dueDate: instant(input.dueDate)
	};
}

/** Whether two values of a field are the same: statuses and priorities by name whatever the case, the rest exactly. */
export function sameSyncedValue(field: SyncedTaskField, a: string | null, b: string | null): boolean {
	if (a === null || b === null) return a === b;
	if (field === 'status' || field === 'priority') return a.toLowerCase() === b.toLowerCase();
	return a === b;
}

/** Reads a stored set of agreed values (JSON); null when there is none or it is unreadable. */
export function parseSyncedValues(json: string | null | undefined): SyncedTaskValues | null {
	if (!json) return null;
	try {
		const parsed = JSON.parse(json) as Partial<Record<SyncedTaskField, unknown>> | null;
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
		const values = {} as SyncedTaskValues;
		for (const field of SYNCED_TASK_FIELDS) {
			const value = parsed[field];
			values[field] = typeof value === 'string' ? value : null;
		}
		return values;
	} catch {
		return null;
	}
}

/**
 * The three-way merge of one item's synced fields. `synced` is what both sides last agreed on (null: nothing yet),
 * `platform` the task's values now (null: no task yet), `external` the provider's values now.
 */
export function mergeSyncedFields(synced: SyncedTaskValues | null, platform: SyncedTaskValues | null, external: SyncedTaskValues): SyncedFieldsMerge {
	const merge: SyncedFieldsMerge = { keepPlatform: [], conflicts: [] };
	if (!synced || !platform) return merge;
	for (const field of SYNCED_TASK_FIELDS) {
		const platformChanged = !sameSyncedValue(field, platform[field], synced[field]);
		if (!platformChanged) continue;
		const externalChanged = !sameSyncedValue(field, external[field], synced[field]);
		if (!externalChanged) {
			merge.keepPlatform.push(field);
			continue;
		}
		if (sameSyncedValue(field, platform[field], external[field])) continue;
		merge.conflicts.push({ field, synced: synced[field], platform: platform[field], external: external[field] });
	}
	return merge;
}

/** The task columns each synced field is written through (a status and a priority carry their row's id too). */
export const SYNCED_TASK_COLUMNS: Record<SyncedTaskField, readonly string[]> = {
	title: ['title'],
	description: ['description'],
	status: ['status', 'taskStatusId'],
	priority: ['priority', 'taskPriorityId'],
	dueDate: ['dueDate']
};

/** The task's own columns of a field, to write back when its value is restored (`null` for an empty one). */
export function taskPatchOf(task: Record<string, unknown>, field: SyncedTaskField): Record<string, unknown> {
	const patch: Record<string, unknown> = {};
	for (const column of SYNCED_TASK_COLUMNS[field]) {
		const value = task[column];
		patch[column] = value instanceof Date ? value.toISOString() : value ?? null;
	}
	return patch;
}

/** A task write without the fields the task keeps: an inbound apply leaves them as they are. */
export function withoutKeptFields<T extends Record<string, unknown>>(entity: T, keepPlatform: readonly SyncedTaskField[]): T {
	if (!keepPlatform.length) return entity;
	const result: Record<string, unknown> = { ...entity };
	for (const field of keepPlatform) {
		for (const column of SYNCED_TASK_COLUMNS[field]) delete result[column];
	}
	return result as T;
}
