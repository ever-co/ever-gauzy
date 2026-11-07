import {
	ID,
	ITaskViewFilterCondition,
	ITaskViewFilterGroup,
	ITaskViewFilterOptions,
	ITaskViewInvalidFilter,
	ITaskViewOrdering,
	ITaskViewRelativeDate,
	TaskViewFilterField,
	TaskViewFilterOperator,
	TaskViewGroupBy
} from '@gauzy/contracts';
import { addDays, isKnownTimeZone, startOfDayIn, startOfWeekIn, zoneOffsetMinutes } from '../built-in-views';

export const TASK_VIEW_FILTER_FIELDS: readonly TaskViewFilterField[] = ['status', 'priority', 'size', 'labels', 'assignees', 'project', 'team', 'sprint', 'dueDate', 'createdAt', 'updatedAt'];
export const TASK_VIEW_DATE_FIELDS: readonly TaskViewFilterField[] = ['dueDate', 'createdAt', 'updatedAt'];
export const TASK_VIEW_RECORD_OPERATORS: readonly TaskViewFilterOperator[] = ['in', 'notIn', 'isEmpty', 'isNotEmpty'];
export const TASK_VIEW_DATE_OPERATORS: readonly TaskViewFilterOperator[] = ['before', 'after', 'between', 'relative', 'isEmpty', 'isNotEmpty'];
export const TASK_VIEW_GROUPINGS: readonly TaskViewGroupBy[] = ['none', 'status', 'priority', 'size', 'project', 'sprint', 'assignee', 'team', 'label'];
export const TASK_VIEW_ORDER_FIELDS = ['createdAt', 'updatedAt', 'dueDate', 'title', 'manual'] as const;
/** The most tasks a page carries, and the most a manual ordering sorts. */
export const TASK_VIEW_PAGE_MAX = 200;
export const TASK_VIEW_PAGE_DEFAULT = 50;
export const TASK_VIEW_MANUAL_ORDER_MAX = 5000;
/** The most conditions one tree may hold (nested ones counted). */
export const TASK_VIEW_FILTER_MAX_CONDITIONS = 100;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isFilterGroup(value: unknown): value is ITaskViewFilterGroup {
	return !!value && typeof value === 'object' && Array.isArray((value as ITaskViewFilterGroup).conditions);
}

/** The `filterOptions` of a view as an object (the column may hold its JSON as text on SQLite), or nothing. */
export function filterOptionsOf(raw: unknown): ITaskViewFilterOptions {
	let value: unknown = raw;
	if (typeof raw === 'string' && raw.trim()) {
		try {
			value = JSON.parse(raw);
		} catch {
			value = null;
		}
	}
	return value && typeof value === 'object' && !Array.isArray(value) ? (value as ITaskViewFilterOptions) : {};
}

/** What validating a tree answered: the tree with only what can be applied, and what could not. */
export interface IValidatedFilter {
	tree: ITaskViewFilterGroup | null;
	invalid: ITaskViewInvalidFilter[];
}

/**
 * Keeps of a tree what the platform can apply — a known field, an operator the field takes, well-formed values —
 * and reports the rest with its place in the tree, so a client can show the condition as invalid and remove it.
 */
export function validateFilterTree(tree: unknown): IValidatedFilter {
	const invalid: ITaskViewInvalidFilter[] = [];
	let budget = TASK_VIEW_FILTER_MAX_CONDITIONS;
	const group = (value: unknown, path: string): ITaskViewFilterGroup | null => {
		if (!isFilterGroup(value)) {
			invalid.push({ path, reason: 'malformed' });
			return null;
		}
		const op = (value as ITaskViewFilterGroup).op === 'or' ? 'or' : 'and';
		const conditions: Array<ITaskViewFilterCondition | ITaskViewFilterGroup> = [];
		(value as ITaskViewFilterGroup).conditions.forEach((entry, index) => {
			const at = `${path}.conditions.${index}`;
			if (budget <= 0) {
				invalid.push({ path: at, reason: 'malformed' });
				return;
			}
			if (isFilterGroup(entry)) {
				const nested = group(entry, at);
				if (nested && nested.conditions.length) conditions.push(nested);
				return;
			}
			budget -= 1;
			const condition = validateCondition(entry, at, invalid);
			if (condition) conditions.push(condition);
		});
		return { op, conditions };
	};
	const result = tree === null || tree === undefined ? null : group(tree, 'filter');
	return { tree: result && result.conditions.length ? result : null, invalid };
}

function validateCondition(entry: unknown, path: string, invalid: ITaskViewInvalidFilter[]): ITaskViewFilterCondition | null {
	const raw = entry as Partial<ITaskViewFilterCondition> | null;
	const field = raw?.field as TaskViewFilterField | undefined;
	if (!field || !TASK_VIEW_FILTER_FIELDS.includes(field)) {
		invalid.push({ path, field: typeof raw?.field === 'string' ? raw.field : undefined, reason: 'unknown-field' });
		return null;
	}
	const operator = raw?.operator as TaskViewFilterOperator | undefined;
	const allowed = TASK_VIEW_DATE_FIELDS.includes(field) ? TASK_VIEW_DATE_OPERATORS : TASK_VIEW_RECORD_OPERATORS;
	if (!operator || !allowed.includes(operator)) {
		invalid.push({ path, field, reason: 'unknown-operator' });
		return null;
	}
	const condition: ITaskViewFilterCondition = { field, operator };
	if (operator === 'in' || operator === 'notIn') {
		const values = Array.isArray(raw?.values) ? raw!.values!.map(String).filter((id) => UUID.test(id)) : [];
		if (!values.length) {
			invalid.push({ path, field, reason: 'malformed' });
			return null;
		}
		condition.values = [...new Set(values)] as ID[];
	} else if (operator === 'before' || operator === 'after' || operator === 'between') {
		const from = operator === 'before' ? undefined : instantOf(raw?.from);
		const to = operator === 'after' ? undefined : instantOf(raw?.to);
		if ((operator !== 'before' && !from) || (operator !== 'after' && !to)) {
			invalid.push({ path, field, reason: 'malformed' });
			return null;
		}
		if (from) condition.from = from;
		if (to) condition.to = to;
	} else if (operator === 'relative') {
		const relative = raw?.relative;
		const unit = relative?.unit;
		const direction = relative?.direction;
		const amount = relative?.amount === undefined ? 1 : Number(relative.amount);
		if (!relative || !['day', 'week', 'month'].includes(String(unit)) || !['current', 'past', 'future'].includes(String(direction)) || !Number.isInteger(amount) || amount < 1 || amount > 366) {
			invalid.push({ path, field, reason: 'malformed' });
			return null;
		}
		condition.relative = { unit: unit as ITaskViewRelativeDate['unit'], direction: direction as ITaskViewRelativeDate['direction'], amount };
	}
	return condition;
}

function instantOf(value: unknown): string | undefined {
	if (typeof value !== 'string' || !value.trim()) return undefined;
	const time = Date.parse(value);
	return Number.isFinite(time) ? new Date(time).toISOString() : undefined;
}

// ---------------------------------------------------------------- relative windows in the caller's time zone

/** The start of the calendar month holding `at` in the time zone, as an instant. */
export function startOfMonthIn(at: Date, timeZone: string): Date {
	const offset = zoneOffsetMinutes(at, timeZone);
	const local = new Date(at.getTime() + offset * 60_000);
	return startOfDayIn(new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1, 12) - offset * 60_000), timeZone);
}

/** The start of the month `months` after (or before) the one holding `at`, in the time zone. */
export function addMonths(at: Date, months: number, timeZone: string): Date {
	const offset = zoneOffsetMinutes(at, timeZone);
	const local = new Date(at.getTime() + offset * 60_000);
	return startOfDayIn(new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + months, 1, 12) - offset * 60_000), timeZone);
}

/** The instants a relative date names at `now`: `[from, to)`. */
export function relativeWindow(relative: ITaskViewRelativeDate, now: Date, timeZone?: string | null): { from: Date; to: Date } {
	const zone = isKnownTimeZone(timeZone) ? (timeZone as string) : 'UTC';
	const amount = Math.max(1, Number(relative.amount) || 1);
	const startOf = (at: Date) => (relative.unit === 'day' ? startOfDayIn(at, zone) : relative.unit === 'week' ? startOfWeekIn(at, zone) : startOfMonthIn(at, zone));
	const shift = (at: Date, units: number) => (relative.unit === 'day' ? addDays(at, units, zone) : relative.unit === 'week' ? addDays(at, 7 * units, zone) : addMonths(at, units, zone));
	const start = startOf(now);
	if (relative.direction === 'current') return { from: start, to: shift(start, 1) };
	if (relative.direction === 'past') return { from: shift(start, -amount), to: now };
	return { from: now, to: shift(start, amount + 1) };
}

// ---------------------------------------------------------------- the ordering and the cursor

export function orderingOf(value: unknown): ITaskViewOrdering {
	const raw = value as Partial<ITaskViewOrdering> | null | undefined;
	const field = (TASK_VIEW_ORDER_FIELDS as readonly string[]).includes(String(raw?.field)) ? (raw!.field as ITaskViewOrdering['field']) : 'createdAt';
	const direction = raw?.direction === 'asc' ? 'asc' : raw?.direction === 'desc' ? 'desc' : field === 'dueDate' || field === 'title' ? 'asc' : 'desc';
	return { field, direction };
}

export function groupingOf(value: unknown, fallback: unknown = 'none'): TaskViewGroupBy {
	const pick = (candidate: unknown) => (TASK_VIEW_GROUPINGS.includes(candidate as TaskViewGroupBy) ? (candidate as TaskViewGroupBy) : null);
	return pick(value) ?? pick(fallback) ?? 'none';
}

/** A keyset cursor: the sort value and the id of the last row of the page; or an offset, for a manual ordering. */
export interface IViewCursor {
	v?: string | null;
	id?: string;
	o?: number;
}

export function encodeCursor(cursor: IViewCursor): string {
	return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

/** The cursor a client sent back, or null for none or one that is not ours (a page from the start then). */
export function decodeCursor(value: unknown): IViewCursor | null {
	if (typeof value !== 'string' || !value.trim()) return null;
	try {
		const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as IViewCursor;
		if (!parsed || typeof parsed !== 'object') return null;
		if (typeof parsed.o === 'number' && Number.isInteger(parsed.o) && parsed.o >= 0) return { o: parsed.o };
		if (typeof parsed.id === 'string' && UUID.test(parsed.id)) return { v: parsed.v === null || parsed.v === undefined ? null : String(parsed.v), id: parsed.id };
		return null;
	} catch {
		return null;
	}
}

export function pageLimitOf(value: unknown): number {
	const limit = Number(value);
	return Number.isInteger(limit) && limit > 0 ? Math.min(limit, TASK_VIEW_PAGE_MAX) : TASK_VIEW_PAGE_DEFAULT;
}
