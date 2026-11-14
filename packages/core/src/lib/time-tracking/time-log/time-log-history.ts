import { ActionTypeEnum, ID, IActivityLogUpdatedValues, TimeLogChangeKindEnum } from '@gauzy/contracts';

/**
 * The fields of a time log its history records: what a person can change on an entry. Everything else (slots,
 * `editedAt`, `isEdited`, `version`, the timer's own `isRunning`) follows from these and is left out.
 */
export const TIME_LOG_HISTORY_FIELDS = [
	'startedAt',
	'stoppedAt',
	'employeeId',
	'projectId',
	'taskId',
	'organizationContactId',
	'organizationTeamId',
	'description',
	'isBillable'
] as const;

export type TimeLogHistoryField = (typeof TIME_LOG_HISTORY_FIELDS)[number];

/** The derived field written beside a start or an end, so a reader sees "2 h -> 5 h" without recomputing it. */
export const DURATION_FIELD = 'duration';

/** The field of a status change (the status of the entry's timesheet). */
export const STATUS_FIELD = 'status';

/** The fields that point at another record, whose name is kept beside the id so the history stays readable. */
export const TIME_LOG_REFERENCE_FIELDS = [
	'employeeId',
	'projectId',
	'taskId',
	'organizationContactId',
	'organizationTeamId'
] as const;

export type TimeLogReferenceField = (typeof TIME_LOG_REFERENCE_FIELDS)[number];

/** The fields each kind of change is made of. `CREATED` and `DELETED` are actions, not fields. */
export const TIME_LOG_KIND_FIELDS: Readonly<Partial<Record<TimeLogChangeKindEnum, readonly string[]>>> = {
	[TimeLogChangeKindEnum.TIME]: ['startedAt', 'stoppedAt'],
	[TimeLogChangeKindEnum.TASK]: ['taskId'],
	[TimeLogChangeKindEnum.PROJECT]: ['projectId', 'organizationContactId'],
	[TimeLogChangeKindEnum.MEMBER]: ['employeeId'],
	[TimeLogChangeKindEnum.BILLABLE]: ['isBillable'],
	[TimeLogChangeKindEnum.NOTES]: ['description'],
	[TimeLogChangeKindEnum.STATUS]: [STATUS_FIELD]
};

/** A value as the history stores it: dates as ISO strings, nothing undefined. */
export type TimeLogHistoryValue = string | number | boolean | null;

/** The tracked values of an entry at one moment. */
export type TimeLogHistoryValues = Partial<Record<TimeLogHistoryField | typeof DURATION_FIELD, TimeLogHistoryValue>>;

/** One change of an entry, before it becomes an activity log row. */
export interface TimeLogHistoryChange {
	action: ActionTypeEnum;
	updatedFields: string[];
	previousValues: IActivityLogUpdatedValues[];
	updatedValues: IActivityLogUpdatedValues[];
}

/** An entry as the history reads it: any object carrying some of the tracked fields. */
export type TimeLogHistorySource = Partial<Record<TimeLogHistoryField, unknown>>;

/**
 * The value of one field as the history stores it. Dates (or date strings) of the two time fields become ISO
 * strings so that a value read back compares equal to the one written; a missing value is `null`.
 *
 * @param field The tracked field.
 * @param value Its value on the entry or in the request.
 */
export function historyValue(field: TimeLogHistoryField, value: unknown): TimeLogHistoryValue {
	if (value === undefined || value === null) {
		return null;
	}
	// A form that clears the notes sends '' where the stored row holds null: the same "nothing".
	const isBlankText = typeof value === 'string' && value.trim() === '';
	if (isBlankText) {
		return null;
	}
	const isTimeField = field === 'startedAt' || field === 'stoppedAt';
	if (isTimeField) {
		const time = new Date(value as string | number | Date);
		if (Number.isNaN(time.getTime())) {
			return null;
		}
		return time.toISOString();
	}
	if (typeof value === 'boolean' || typeof value === 'number') {
		return value;
	}
	return String(value);
}

/**
 * The duration in whole seconds between a start and an end as the history stores them, or `null` when either is
 * missing.
 */
export function historyDuration(startedAt: TimeLogHistoryValue, stoppedAt: TimeLogHistoryValue): number | null {
	const hasBoth = typeof startedAt === 'string' && typeof stoppedAt === 'string';
	if (!hasBoth) {
		return null;
	}
	const seconds = Math.round((new Date(stoppedAt).getTime() - new Date(startedAt).getTime()) / 1000);
	return seconds;
}

/**
 * The tracked values of an entry, with its duration.
 *
 * @param entry The entry (a time log, or a time log with an update applied).
 */
export function timeLogHistoryValues(entry: TimeLogHistorySource): TimeLogHistoryValues {
	const values: TimeLogHistoryValues = {};
	for (const field of TIME_LOG_HISTORY_FIELDS) {
		values[field] = historyValue(field, entry[field]);
	}
	values[DURATION_FIELD] = historyDuration(values.startedAt, values.stoppedAt);
	return values;
}

/** `[{ field: value }, ...]`, the shape the activity log keeps values in. */
function asValueList(values: TimeLogHistoryValues, fields: readonly string[]): IActivityLogUpdatedValues[] {
	return fields.map((field) => ({ [field]: values[field] }) as unknown as IActivityLogUpdatedValues);
}

/** The fields of `values` that hold something. */
function filledFields(values: TimeLogHistoryValues): string[] {
	return Object.keys(values).filter((field) => values[field] !== null && values[field] !== undefined);
}

/**
 * An entry added by hand: every field it was written with, nothing before.
 *
 * @param created The entry as written.
 */
export function createdChange(created: TimeLogHistorySource): TimeLogHistoryChange {
	const values = timeLogHistoryValues(created);
	const fields = filledFields(values);
	return {
		action: ActionTypeEnum.Created,
		updatedFields: fields,
		previousValues: [],
		updatedValues: asValueList(values, fields)
	};
}

/**
 * An entry deleted: every field it held, nothing after.
 *
 * @param deleted The entry as it was before the deletion.
 */
export function deletedChange(deleted: TimeLogHistorySource): TimeLogHistoryChange {
	const values = timeLogHistoryValues(deleted);
	const fields = filledFields(values);
	return {
		action: ActionTypeEnum.Deleted,
		updatedFields: fields,
		previousValues: asValueList(values, fields),
		updatedValues: []
	};
}

/**
 * An entry edited: the tracked fields whose value differs, with the duration when the start or the end moved.
 * `null` when the edit changed none of them (a save with the same values records nothing).
 *
 * @param before The entry as stored before the edit.
 * @param after The entry with the edit applied.
 */
export function updatedChange(before: TimeLogHistorySource, after: TimeLogHistorySource): TimeLogHistoryChange | null {
	const previous = timeLogHistoryValues(before);
	const next = timeLogHistoryValues(after);
	const fields: string[] = TIME_LOG_HISTORY_FIELDS.filter((field) => previous[field] !== next[field]);
	if (fields.length === 0) {
		return null;
	}
	const timeMoved = fields.includes('startedAt') || fields.includes('stoppedAt');
	const durationChanged = timeMoved && previous[DURATION_FIELD] !== next[DURATION_FIELD];
	if (durationChanged) {
		fields.push(DURATION_FIELD);
	}
	return {
		action: ActionTypeEnum.Updated,
		updatedFields: fields,
		previousValues: asValueList(previous, fields),
		updatedValues: asValueList(next, fields)
	};
}

/**
 * The status of an entry's timesheet changed. `null` when it did not.
 *
 * @param previousStatus The timesheet's status before.
 * @param status The status after.
 */
export function statusChange(previousStatus: string | null | undefined, status: string): TimeLogHistoryChange | null {
	const before = previousStatus ?? null;
	if (before === status) {
		return null;
	}
	return {
		action: ActionTypeEnum.Updated,
		updatedFields: [STATUS_FIELD],
		previousValues: [{ [STATUS_FIELD]: before } as unknown as IActivityLogUpdatedValues],
		updatedValues: [{ [STATUS_FIELD]: status } as unknown as IActivityLogUpdatedValues]
	};
}

/**
 * The kinds of change a history row belongs to.
 *
 * @param action The row's action.
 * @param updatedFields The row's changed fields.
 */
export function timeLogChangeKinds(
	action: ActionTypeEnum,
	updatedFields: readonly string[] = []
): TimeLogChangeKindEnum[] {
	if (action === ActionTypeEnum.Created) {
		return [TimeLogChangeKindEnum.CREATED];
	}
	if (action === ActionTypeEnum.Deleted) {
		return [TimeLogChangeKindEnum.DELETED];
	}
	const kinds: TimeLogChangeKindEnum[] = [];
	for (const [kind, fields] of Object.entries(TIME_LOG_KIND_FIELDS)) {
		const touched = fields.some((field) => updatedFields.includes(field));
		if (touched) {
			kinds.push(kind as TimeLogChangeKindEnum);
		}
	}
	return kinds;
}

/**
 * The ids a change points at, per reference field, so their names can be looked up in one read per table.
 *
 * @param changes The changes about to be recorded.
 */
export function referencedIds(changes: readonly TimeLogHistoryChange[]): Map<TimeLogReferenceField, Set<ID>> {
	const ids = new Map<TimeLogReferenceField, Set<ID>>();
	for (const field of TIME_LOG_REFERENCE_FIELDS) {
		ids.set(field, new Set<ID>());
	}
	for (const change of changes) {
		for (const entry of [...change.previousValues, ...change.updatedValues]) {
			for (const field of TIME_LOG_REFERENCE_FIELDS) {
				const value = (entry as Record<string, unknown>)[field];
				if (typeof value === 'string' && value.length > 0) {
					ids.get(field).add(value);
				}
			}
		}
	}
	return ids;
}

/**
 * The names of the records a list of values points at, in the activity log's "entities" shape:
 * `[{ taskId: { id, name } }]`. A record whose name is unknown keeps its id with a `null` name.
 *
 * @param values The previous or the updated values of a change.
 * @param names Every name found, by id.
 */
export function referencedEntities(
	values: readonly IActivityLogUpdatedValues[],
	names: ReadonlyMap<ID, string>
): IActivityLogUpdatedValues[] {
	const entities: IActivityLogUpdatedValues[] = [];
	for (const entry of values) {
		for (const field of TIME_LOG_REFERENCE_FIELDS) {
			const id = (entry as Record<string, unknown>)[field];
			if (typeof id === 'string' && id.length > 0) {
				entities.push({ [field]: { id, name: names.get(id) ?? null } } as IActivityLogUpdatedValues);
			}
		}
	}
	return entities;
}
