import {
	addMonths,
	boundDayOf,
	dateBoundClause,
	dayIn,
	decodeCursor,
	encodeCursor,
	filterOptionsOf,
	groupingOf,
	midnightOfDay,
	orderingOf,
	pageLimitOf,
	relativeWindow,
	relativeWindowDays,
	startOfMonthIn,
	validateFilterTree
} from './view-filters';

const A = '0b5a3f4e-6c1d-4f7a-9a52-3c2d1e0f9b8a';
const B = '7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f';
// Saturday 2026-11-07 12:30 UTC (14:30 in Sofia).
const NOW = new Date('2026-11-07T12:30:00.000Z');

describe('the filter tree', () => {
	it('keeps what can be applied and reports the rest with its place', () => {
		const { tree, invalid, paths } = validateFilterTree({
			op: 'and',
			conditions: [
				{ field: 'status', operator: 'in', values: [A, 'nope', A] },
				{ field: 'labels', operator: 'before' },
				{ field: 'colour', operator: 'in', values: [A] },
				{ field: 'dueDate', operator: 'between', from: '2026-11-01', to: 'later' },
				{ op: 'or', conditions: [{ field: 'assignees', operator: 'isEmpty' }, { field: 'createdAt', operator: 'relative', relative: { unit: 'week', direction: 'past', amount: 2 } }] },
				{ field: 'priority', operator: 'in', values: [] },
				'junk'
			]
		});
		expect(tree).toEqual({
			op: 'and',
			conditions: [
				{ field: 'status', operator: 'in', values: [A] },
				{ op: 'or', conditions: [{ field: 'assignees', operator: 'isEmpty' }, { field: 'createdAt', operator: 'relative', relative: { unit: 'week', direction: 'past', amount: 2 } }] }
			]
		});
		expect(invalid).toEqual([
			{ path: 'filter.conditions.1', field: 'labels', reason: 'unknown-operator' },
			{ path: 'filter.conditions.2', field: 'colour', reason: 'unknown-field' },
			{ path: 'filter.conditions.3', field: 'dueDate', reason: 'malformed' },
			{ path: 'filter.conditions.5', field: 'priority', reason: 'malformed' },
			{ path: 'filter.conditions.6', reason: 'unknown-field' }
		]);
		// Each kept node remembers where the caller put it, so a later report names the condition the caller wrote.
		expect(paths.get(tree!.conditions[0])).toBe('filter.conditions.0');
		expect(paths.get(tree!.conditions[1])).toBe('filter.conditions.4');
		expect(paths.get((tree!.conditions[1] as { conditions: unknown[] }).conditions[1] as never)).toBe('filter.conditions.4.conditions.1');
		expect(validateFilterTree(null)).toEqual({ tree: null, invalid: [], paths: new Map() });
		// What the route's DTO answers for a filter whose JSON does not parse: reported at the root, as malformed.
		expect(validateFilterTree({ op: 'and', conditions: null })).toEqual({ tree: null, invalid: [{ path: 'filter', reason: 'malformed' }], paths: new Map() });
		expect(validateFilterTree({ op: 'and', conditions: [{ field: 'size', operator: 'notIn', values: ['x'] }] }).tree).toBeNull();
	});

	it('counts every node against the budget and stops nesting at the depth cap, reporting the excess as malformed', () => {
		// 150 empty groups: the root and the first 99 take the budget of 100; the 51 after them are reported, not entered.
		const wide = validateFilterTree({ op: 'and', conditions: Array.from({ length: 150 }, () => ({ op: 'or', conditions: [] })) });
		expect(wide.tree).toBeNull();
		expect(wide.invalid).toHaveLength(51);
		expect(wide.invalid[0]).toEqual({ path: 'filter.conditions.99', reason: 'malformed' });
		expect(wide.invalid[50]).toEqual({ path: 'filter.conditions.149', reason: 'malformed' });
		// A chain nested twelve deep: the group at depth 9 is reported at its place and nothing below it is visited.
		let deep: Record<string, unknown> = { op: 'and', conditions: [{ field: 'status', operator: 'isEmpty' }] };
		for (let level = 0; level < 12; level += 1) deep = { op: 'and', conditions: [deep] };
		const nested = validateFilterTree(deep);
		expect(nested.tree).toBeNull();
		expect(nested.invalid).toEqual([{ path: `filter${'.conditions.0'.repeat(9)}`, reason: 'malformed' }]);
		// A condition past the budget is reported too.
		const many = validateFilterTree({ op: 'and', conditions: Array.from({ length: 101 }, () => ({ field: 'priority', operator: 'isEmpty' })) });
		expect(many.tree!.conditions).toHaveLength(99);
		expect(many.invalid).toEqual([{ path: 'filter.conditions.99', reason: 'malformed' }, { path: 'filter.conditions.100', reason: 'malformed' }]);
	});

	it('reads the options stored as an object or as JSON, the grouping and the ordering with their defaults', () => {
		expect(filterOptionsOf('{"groupBy":"status"}')).toEqual({ groupBy: 'status' });
		expect(filterOptionsOf('{oops')).toEqual({});
		expect(groupingOf('bogus', 'label')).toBe('label');
		expect(groupingOf(undefined)).toBe('none');
		expect(orderingOf(undefined)).toEqual({ field: 'createdAt', direction: 'desc' });
		expect(orderingOf({ field: 'dueDate' })).toEqual({ field: 'dueDate', direction: 'asc' });
		expect(orderingOf({ field: 'manual', direction: 'desc' })).toEqual({ field: 'manual', direction: 'desc' });
		expect(pageLimitOf(1000)).toBe(200);
		expect(pageLimitOf('x')).toBe(50);
	});
});

describe('relative windows', () => {
	it('resolve this day / week / month, the past and the future, in the caller\'s time zone', () => {
		expect(relativeWindow({ unit: 'day', direction: 'current' }, NOW, 'Europe/Sofia')).toEqual({ from: new Date('2026-11-06T22:00:00.000Z'), to: new Date('2026-11-07T22:00:00.000Z') });
		expect(relativeWindow({ unit: 'week', direction: 'current' }, NOW, 'UTC')).toEqual({ from: new Date('2026-11-02T00:00:00.000Z'), to: new Date('2026-11-09T00:00:00.000Z') });
		expect(relativeWindow({ unit: 'month', direction: 'current' }, NOW, 'Europe/Sofia')).toEqual({ from: new Date('2026-10-31T22:00:00.000Z'), to: new Date('2026-11-30T22:00:00.000Z') });
		expect(relativeWindow({ unit: 'day', direction: 'past', amount: 7 }, NOW, 'UTC')).toEqual({ from: new Date('2026-10-31T00:00:00.000Z'), to: NOW });
		expect(relativeWindow({ unit: 'month', direction: 'future', amount: 2 }, NOW, 'UTC')).toEqual({ from: NOW, to: new Date('2027-02-01T00:00:00.000Z') });
		expect(relativeWindow({ unit: 'week', direction: 'future', amount: 1 }, NOW, 'Mars/Olympus')).toEqual({ from: NOW, to: new Date('2026-11-16T00:00:00.000Z') });
		expect(startOfMonthIn(new Date('2026-03-15T00:30:00.000Z'), 'America/New_York').toISOString()).toBe('2026-03-01T05:00:00.000Z');
		expect(addMonths(new Date('2026-01-31T12:00:00.000Z'), 1, 'UTC').toISOString()).toBe('2026-02-01T00:00:00.000Z');
	});
});

describe('date-only due dates, compared by their calendar day', () => {
	// The bounds the filter editor makes of a picked day in a zone `offset` minutes east of UTC: the start of the day
	// (`after`, `before`, the lower bound of `between`) or its last instant (the upper bound of `between`).
	const startOf = (day: string, offset: number) => new Date(Date.parse(`${day}T00:00:00.000Z`) - offset * 60_000);
	const lastOf = (day: string, offset: number) => new Date(Date.parse(`${day}T00:00:00.000Z`) + 86_400_000 - offset * 60_000 - 1);
	const midnight = (day: string) => new Date(`${day}T00:00:00.000Z`);
	const UTC_MINUS_4 = -240;
	const UTC_PLUS_2 = 120;

	it('keeps the day a bound was picked as when its instant is an edge of that day, and leaves out any other', () => {
		const { tree } = validateFilterTree({
			op: 'and',
			conditions: [
				{ field: 'dueDate', operator: 'between', from: startOf('2026-11-14', UTC_MINUS_4).toISOString(), fromDay: '2026-11-14', to: lastOf('2026-11-20', UTC_MINUS_4).toISOString(), toDay: '2026-11-20' },
				// Not a calendar day (and a day for a bound "after" has not got), a day that does not exist, a day a week off.
				{ field: 'dueDate', operator: 'after', from: '2026-11-14T04:00:00.000Z', fromDay: '14/11/2026', toDay: '2026-11-14' },
				{ field: 'dueDate', operator: 'before', to: '2026-03-02T04:00:00.000Z', toDay: '2026-02-30' },
				{ field: 'dueDate', operator: 'before', to: '2026-11-14T04:00:00.000Z', toDay: '2026-11-21' },
				// A bound moved to the 15th by a client that left the 14th's day behind, and the start of a day as "between"'s end.
				{ field: 'dueDate', operator: 'after', from: startOf('2026-11-15', UTC_MINUS_4).toISOString(), fromDay: '2026-11-14' },
				{ field: 'dueDate', operator: 'between', from: startOf('2026-11-14', UTC_MINUS_4).toISOString(), to: startOf('2026-11-20', UTC_MINUS_4).toISOString(), toDay: '2026-11-20' }
			]
		});
		expect(tree?.conditions).toEqual([
			{ field: 'dueDate', operator: 'between', from: '2026-11-14T04:00:00.000Z', fromDay: '2026-11-14', to: '2026-11-21T03:59:59.999Z', toDay: '2026-11-20' },
			{ field: 'dueDate', operator: 'after', from: '2026-11-14T04:00:00.000Z' },
			{ field: 'dueDate', operator: 'before', to: '2026-03-02T04:00:00.000Z' },
			{ field: 'dueDate', operator: 'before', to: '2026-11-14T04:00:00.000Z' },
			{ field: 'dueDate', operator: 'after', from: '2026-11-15T04:00:00.000Z' },
			{ field: 'dueDate', operator: 'between', from: '2026-11-14T04:00:00.000Z', to: '2026-11-20T04:00:00.000Z' }
		]);
		expect(midnightOfDay('2026-11-14')).toBe(Date.parse('2026-11-14T00:00:00.000Z'));
		expect(midnightOfDay('2026-02-29')).toBeNull();
		expect(midnightOfDay(20261114)).toBeNull();
		// The start of the day and its last instant in the zones furthest east (UTC+14) and west (UTC−12) are edges of it.
		for (const offset of [14 * 60, UTC_PLUS_2, 0, UTC_MINUS_4, -12 * 60]) {
			expect(boundDayOf('2026-11-14', startOf('2026-11-14', offset), 'start')).toBe('2026-11-14');
			expect(boundDayOf('2026-11-14', lastOf('2026-11-14', offset), 'end')).toBe('2026-11-14');
		}
		// The next day's start and the day before's end are not, except where zones 24 hours apart meet (UTC+14 and
		// UTC−10: the 15th starts in one when the 14th starts in the other).
		for (const offset of [UTC_PLUS_2, 0, UTC_MINUS_4]) {
			expect(boundDayOf('2026-11-14', startOf('2026-11-15', offset), 'start')).toBeUndefined();
			expect(boundDayOf('2026-11-14', lastOf('2026-11-13', offset), 'end')).toBeUndefined();
		}
		expect(boundDayOf('2026-11-14', 'never', 'start')).toBeUndefined();
	});

	it('west of UTC, takes a date only of the day picked into "on or after" and keeps it out of "before"', () => {
		const from = startOf('2026-11-14', UTC_MINUS_4);
		expect(dateBoundClause('task.dueDate', '>', from, '2026-11-14', 'f0')).toEqual({
			sql: '(task.dueDate > :f0 OR task.dueDate = :f0d0)',
			params: { f0: from, f0d0: midnight('2026-11-14') }
		});
		expect(dateBoundClause('task.dueDate', '<', from, '2026-11-14', 'f0')).toEqual({
			sql: '(task.dueDate < :f0 AND task.dueDate <> :f0x0)',
			params: { f0: from, f0x0: midnight('2026-11-14') }
		});
		// Both edges of "between 14 and 20 Nov": the 14th's date only is in, the 21st's (before the 20th ends there) is out.
		expect(dateBoundClause('task.dueDate', '>=', from, '2026-11-14', 'f0a').sql).toBe('(task.dueDate >= :f0a OR task.dueDate = :f0ad0)');
		const until = lastOf('2026-11-20', UTC_MINUS_4);
		expect(dateBoundClause('task.dueDate', '<=', until, '2026-11-20', 'f0b')).toEqual({
			sql: '(task.dueDate <= :f0b AND task.dueDate <> :f0bx0)',
			params: { f0b: until, f0bx0: midnight('2026-11-21') }
		});
	});

	it('east of UTC leaves the instants alone, which already sort the date-only values; in UTC "after" gains the day', () => {
		const cases: Array<['<' | '<=' | '>' | '>=', string, Date]> = [
			['>', '2026-11-14', startOf('2026-11-14', UTC_PLUS_2)],
			['>=', '2026-11-14', startOf('2026-11-14', UTC_PLUS_2)],
			['<', '2026-11-14', startOf('2026-11-14', UTC_PLUS_2)],
			['<=', '2026-11-20', lastOf('2026-11-20', UTC_PLUS_2)],
			['<=', '2026-11-20', lastOf('2026-11-20', 14 * 60)],
			['>', '2026-11-14', startOf('2026-11-14', 14 * 60)]
		];
		for (const [comparison, day, instant] of cases) {
			expect(dateBoundClause('task.dueDate', comparison, instant, day, 'f0')).toEqual({ sql: `task.dueDate ${comparison} :f0`, params: { f0: instant } });
		}
		// "after" compares with `>`: in UTC its instant is the day's own midnight, which a date only of that day is.
		expect(dateBoundClause('task.dueDate', '>', midnight('2026-11-14'), '2026-11-14', 'f0').sql).toBe('(task.dueDate > :f0 OR task.dueDate = :f0d0)');
		expect(dateBoundClause('task.dueDate', '>=', midnight('2026-11-14'), '2026-11-14', 'f0').sql).toBe('task.dueDate >= :f0');
	});

	it('compares as the instant alone without a day, or with one that is not near it', () => {
		const from = startOf('2026-11-14', UTC_MINUS_4);
		expect(dateBoundClause('task.dueDate', '>', from, undefined, 'f0')).toEqual({ sql: 'task.dueDate > :f0', params: { f0: from } });
		expect(dateBoundClause('task.dueDate', '>', from, '2026-12-14', 'f0')).toEqual({ sql: 'task.dueDate > :f0', params: { f0: from } });
		expect(dateBoundClause('task.dueDate', '>', from, 'soon', 'f0')).toEqual({ sql: 'task.dueDate > :f0', params: { f0: from } });
	});

	it('gives the bounds of a relative window that start a day their day, and leaves a bound at now a moment', () => {
		const zone = 'America/Caracas';
		const today = relativeWindow({ unit: 'day', direction: 'current' }, NOW, zone);
		expect(relativeWindowDays({ unit: 'day', direction: 'current' }, today, zone)).toEqual({ fromDay: '2026-11-07', toDay: '2026-11-08' });
		const past = relativeWindow({ unit: 'day', direction: 'past', amount: 7 }, NOW, zone);
		expect(relativeWindowDays({ unit: 'day', direction: 'past', amount: 7 }, past, zone)).toEqual({ fromDay: '2026-10-31' });
		const next = relativeWindow({ unit: 'week', direction: 'future', amount: 1 }, NOW, 'Mars/Olympus');
		expect(relativeWindowDays({ unit: 'week', direction: 'future', amount: 1 }, next, 'Mars/Olympus')).toEqual({ toDay: '2026-11-16' });
		expect(dayIn(new Date('2026-11-14T03:59:00.000Z'), zone)).toBe('2026-11-13');
		expect(dayIn(new Date('2026-11-13T22:30:00.000Z'), 'Africa/Johannesburg')).toBe('2026-11-14');
	});
});

describe('the cursor', () => {
	it('round-trips a keyset and an offset, and reads anything else as none', () => {
		const keyset = encodeCursor({ id: A });
		expect(decodeCursor(keyset)).toEqual({ id: A });
		// The cursor names the row and nothing of its values: its size is the same for a one-word title and a long one.
		expect(keyset.length).toBeLessThan(80);
		expect(decodeCursor(encodeCursor({ id: B }))).toEqual({ id: B });
		expect(decodeCursor(encodeCursor({ o: 40 }))).toEqual({ o: 40 });
		expect(decodeCursor('not-a-cursor')).toBeNull();
		expect(decodeCursor(Buffer.from('{"id":"x"}').toString('base64url'))).toBeNull();
		expect(decodeCursor(undefined)).toBeNull();
	});
});
