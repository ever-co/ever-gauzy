import {
	addMonths,
	decodeCursor,
	encodeCursor,
	filterOptionsOf,
	groupingOf,
	orderingOf,
	pageLimitOf,
	relativeWindow,
	startOfMonthIn,
	validateFilterTree
} from './view-filters';

const A = '0b5a3f4e-6c1d-4f7a-9a52-3c2d1e0f9b8a';
const B = '7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f';
// Saturday 2026-11-07 12:30 UTC (14:30 in Sofia).
const NOW = new Date('2026-11-07T12:30:00.000Z');

describe('the filter tree', () => {
	it('keeps what can be applied and reports the rest with its place', () => {
		const { tree, invalid } = validateFilterTree({
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
		expect(validateFilterTree(null)).toEqual({ tree: null, invalid: [] });
		expect(validateFilterTree({ op: 'and', conditions: [{ field: 'size', operator: 'notIn', values: ['x'] }] }).tree).toBeNull();
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

describe('the cursor', () => {
	it('round-trips a keyset and an offset, and reads anything else as none', () => {
		const keyset = encodeCursor({ v: '2026-11-07T12:30:00.000Z', id: A });
		expect(decodeCursor(keyset)).toEqual({ v: '2026-11-07T12:30:00.000Z', id: A });
		expect(decodeCursor(encodeCursor({ v: null, id: B }))).toEqual({ v: null, id: B });
		expect(decodeCursor(encodeCursor({ o: 40 }))).toEqual({ o: 40 });
		expect(decodeCursor('not-a-cursor')).toBeNull();
		expect(decodeCursor(Buffer.from('{"id":"x"}').toString('base64url'))).toBeNull();
		expect(decodeCursor(undefined)).toBeNull();
	});
});
