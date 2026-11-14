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
import { addDays, dayIn, isKnownTimeZone, startOfDayIn, startOfWeekIn, zoneOffsetMinutes } from '../built-in-views';

export { dayIn };

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
/** The most nodes one tree may hold — conditions and groups, nested ones counted — and how deep it may nest. */
export const TASK_VIEW_FILTER_MAX_CONDITIONS = 100;
export const TASK_VIEW_FILTER_MAX_DEPTH = 8;

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

/** What validating a tree answered: the tree with only what can be applied, what could not, and where each kept node was. */
export interface IValidatedFilter {
	tree: ITaskViewFilterGroup | null;
	invalid: ITaskViewInvalidFilter[];
	/** The place of each kept node in the tree the caller sent, so a later report names the condition the caller wrote. */
	paths: Map<ITaskViewFilterCondition | ITaskViewFilterGroup, string>;
}

/**
 * Keeps of a tree what the platform can apply — a known field, an operator the field takes, well-formed values —
 * and reports the rest with its place in the tree, so a client can show the condition as invalid and remove it.
 *
 * Every node costs one of the budget, a group as much as a condition, and a group nested deeper than
 * `TASK_VIEW_FILTER_MAX_DEPTH` is reported as malformed and not entered: a tree of many empty groups, or one
 * nested without end, is bounded by the budget and the depth rather than by the call stack.
 */
export function validateFilterTree(tree: unknown): IValidatedFilter {
	const invalid: ITaskViewInvalidFilter[] = [];
	const paths = new Map<ITaskViewFilterCondition | ITaskViewFilterGroup, string>();
	let budget = TASK_VIEW_FILTER_MAX_CONDITIONS;
	const group = (value: unknown, path: string, depth: number): ITaskViewFilterGroup | null => {
		if (!isFilterGroup(value) || depth > TASK_VIEW_FILTER_MAX_DEPTH || budget <= 0) {
			invalid.push({ path, reason: 'malformed' });
			return null;
		}
		budget -= 1;
		const op = value.op === 'or' ? 'or' : 'and';
		const conditions: Array<ITaskViewFilterCondition | ITaskViewFilterGroup> = [];
		value.conditions.forEach((entry, index) => {
			const at = `${path}.conditions.${index}`;
			if (isFilterGroup(entry)) {
				const nested = group(entry, at, depth + 1);
				if (nested && nested.conditions.length) conditions.push(nested);
				return;
			}
			if (budget <= 0) {
				invalid.push({ path: at, reason: 'malformed' });
				return;
			}
			budget -= 1;
			const condition = validateCondition(entry, at, invalid);
			if (condition) {
				paths.set(condition, at);
				conditions.push(condition);
			}
		});
		const kept: ITaskViewFilterGroup = { op, conditions };
		paths.set(kept, path);
		return kept;
	};
	const result = tree === null || tree === undefined ? null : group(tree, 'filter', 0);
	return { tree: result && result.conditions.length ? result : null, invalid, paths };
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
		// A day that is not a calendar day, or not the day its instant is an edge of, is left out: the bound compares as its
		// instant. "Before" stops at the start of its day; "between" runs to the last instant of its last day.
		const fromDay = from ? boundDayOf(raw?.fromDay, from, 'start') : undefined;
		const toDay = to ? boundDayOf(raw?.toDay, to, operator === 'before' ? 'start' : 'end') : undefined;
		if (fromDay) condition.fromDay = fromDay;
		if (toDay) condition.toDay = toDay;
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

// ---------------------------------------------------------------- date-only values, compared by their calendar day

/**
 * The fields that may hold a date only: a calendar day with no time of day, kept as midnight UTC of that day
 * (`2026-11-14T00:00:00.000Z`) — what the integrations and the bulk toolbar write for a due date. `createdAt` and
 * `updatedAt` are always moments, so their midnights stay moments.
 */
export const TASK_VIEW_DATE_ONLY_FIELDS: readonly TaskViewFilterField[] = ['dueDate'];

const DAY_MS = 86_400_000;
const CALENDAR_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Midnight UTC of a calendar day (`2026-11-14`) in milliseconds, or null for anything else (`2026-02-30` included). */
export function midnightOfDay(value: unknown): number | null {
	const match = typeof value === 'string' ? CALENDAR_DAY.exec(value) : null;
	if (!match) return null;
	const [year, month, day] = [Number(match[1]), Number(match[2]) - 1, Number(match[3])];
	const date = new Date(Date.UTC(year, month, day));
	return date.getUTCFullYear() === year && date.getUTCMonth() === month && date.getUTCDate() === day ? date.getTime() : null;
}

/** How far a day's start in a real zone lies from its UTC midnight: 14 hours before (UTC+14), 12 after (UTC−12). */
const EAST_MOST_MS = 14 * 3_600_000;
const WEST_MOST_MS = 12 * 3_600_000;

/**
 * The day a bound was picked as, when it is a calendar day and its instant is that day's edge in some real zone: its
 * start (`edge: 'start'`, for `after`, `before` and the lower bound of `between`) between 14 hours before the day's UTC
 * midnight and 12 hours after it, or its last instant (`'end'`, the upper bound of `between`) within a minute before
 * the next day starts there. A day the instant is not an edge of — another week, or the day before the one a bound
 * was moved to — is left out, so the bound compares as its instant.
 */
export function boundDayOf(day: unknown, instant: string | Date, edge: 'start' | 'end'): string | undefined {
	const midnight = midnightOfDay(day);
	const at = new Date(instant).getTime();
	if (midnight === null || !Number.isFinite(at)) return undefined;
	const start = edge === 'start' ? midnight : midnight + DAY_MS;
	const earliest = start - EAST_MOST_MS - (edge === 'start' ? 0 : 60_000);
	const latest = start + WEST_MOST_MS;
	const near = edge === 'start' ? at >= earliest && at <= latest : at >= earliest && at < latest;
	return near ? (day as string) : undefined;
}

export type DateComparison = '<' | '<=' | '>' | '>=';

function holds(value: number, comparison: DateComparison, bound: number): boolean {
	switch (comparison) {
		case '<':
			return value < bound;
		case '<=':
			return value <= bound;
		case '>':
			return value > bound;
		default:
			return value >= bound;
	}
}

/**
 * One bound of a date condition as SQL. The instant is compared as before (`column > :key`). When the bound carries the
 * calendar day it stands for, a value that is a date only (exactly midnight UTC) is compared with that day instead: a
 * lower bound (`>`, `>=`) takes the day's own midnight and later ones, `<` the midnights before the day, `<=` the
 * day's own midnight and earlier ones. The two readings differ only on the midnights between the instant and the
 * day's own midnight, at most one for a real zone: it is added (`OR column = …`) or taken out (`AND column <> …`).
 * Plain comparisons with bound dates only, so the clause reads the same on Postgres, MySQL and SQLite.
 *
 * West of UTC, "on or after 14 Nov" picked in UTC−4 is `> 2026-11-14T04:00Z`, which misses a due date of 14 Nov
 * (`2026-11-14T00:00Z`): the clause adds that midnight. East of UTC the instant already sorts the midnights right.
 */
export function dateBoundClause(column: string, comparison: DateComparison, instant: Date, day: string | undefined, key: string): { sql: string; params: Record<string, Date> } {
	const sql = `${column} ${comparison} :${key}`;
	const params: Record<string, Date> = { [key]: instant };
	const { added, removed } = dateBoundAdjustments(comparison, instant, day);
	if (!added.length && !removed.length) return { sql, params };
	const kept = [sql];
	removed.forEach((at, index) => {
		params[`${key}x${index}`] = at;
		kept.push(`${column} <> :${key}x${index}`);
	});
	const taken = added.map((at, index) => {
		params[`${key}d${index}`] = at;
		return `${column} = :${key}d${index}`;
	});
	const instantPart = kept.length > 1 && taken.length ? `(${kept.join(' AND ')})` : kept.join(' AND ');
	return { sql: `(${[instantPart, ...taken].join(' OR ')})`, params };
}

/**
 * The date-only values (midnights UTC) where comparing a bound's instant and comparing its calendar day disagree:
 * the ones the day takes and the instant does not (`added`), and the reverse (`removed`). Empty without a day, or
 * with one more than a day from the instant. `dateBoundClause` writes them as SQL; a caller building another query
 * syntax (MikroORM's) reads them here.
 */
export function dateBoundAdjustments(comparison: DateComparison, instant: Date, day: string | undefined): { added: Date[]; removed: Date[] } {
	const added: Date[] = [];
	const removed: Date[] = [];
	const midnight = day === undefined ? null : midnightOfDay(day);
	const at = instant.getTime();
	if (midnight === null || !Number.isFinite(at) || at < midnight - DAY_MS || at >= midnight + 2 * DAY_MS) return { added, removed };
	// "After" a picked day means on or after it ("is on or after"), so a date only of that very day is in.
	const byDay: DateComparison = comparison === '>' ? '>=' : comparison;
	for (let candidate = midnight - 2 * DAY_MS; candidate <= midnight + 3 * DAY_MS; candidate += DAY_MS) {
		const asInstant = holds(candidate, comparison, at);
		const asDay = holds(candidate, byDay, midnight);
		if (asDay && !asInstant) added.push(new Date(candidate));
		if (asInstant && !asDay) removed.push(new Date(candidate));
	}
	return { added, removed };
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

/**
 * The calendar days the bounds of a relative window start, in the zone the window was resolved in. A bound at the
 * start of a day has one; a bound at `now` (the end of "the past …", the start of "the next …") has none and stays a
 * moment for every value.
 */
export function relativeWindowDays(relative: ITaskViewRelativeDate | undefined, window: { from: Date; to: Date }, timeZone?: string | null): { fromDay?: string; toDay?: string } {
	if (!relative) return {};
	const zone = isKnownTimeZone(timeZone) ? (timeZone as string) : 'UTC';
	return {
		...(relative.direction === 'future' ? {} : { fromDay: dayIn(window.from, zone) }),
		...(relative.direction === 'past' ? {} : { toDay: dayIn(window.to, zone) })
	};
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

/**
 * A keyset cursor: the id of the last row of the page (its sort value is read from the row when the next page is
 * asked for, so the cursor's size never depends on a title); or an offset, for a manual ordering.
 */
export interface IViewCursor {
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
		if (typeof parsed.id === 'string' && UUID.test(parsed.id)) return { id: parsed.id };
		return null;
	} catch {
		return null;
	}
}

export function pageLimitOf(value: unknown): number {
	const limit = Number(value);
	return Number.isInteger(limit) && limit > 0 ? Math.min(limit, TASK_VIEW_PAGE_MAX) : TASK_VIEW_PAGE_DEFAULT;
}
