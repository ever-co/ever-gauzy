import { parseSortOrder } from './utils';

/**
 * The custom `pagination` methods build their own queries, so a client-supplied `order` has to be
 * filtered before it reaches the ORM: only allowed columns, only ASC/DESC.
 */
describe('parseSortOrder', () => {
	const COLUMNS = ['start', 'end', 'requestDate'] as const;

	it('keeps allowed columns and normalizes the direction', () => {
		expect(parseSortOrder({ start: 'asc', end: 'DESC' }, COLUMNS)).toEqual({ start: 'ASC', end: 'DESC' });
	});

	it('keeps the client key order for multi-column sorts', () => {
		expect(Object.keys(parseSortOrder({ requestDate: 'ASC', start: 'DESC' }, COLUMNS))).toEqual([
			'requestDate',
			'start'
		]);
	});

	it('drops columns that are not allowed', () => {
		expect(parseSortOrder({ start: 'ASC', tenantId: 'ASC' }, COLUMNS)).toEqual({ start: 'ASC' });
	});

	it('drops invalid directions and non-string values', () => {
		expect(parseSortOrder({ start: 'sideways', end: { nested: 'ASC' }, requestDate: 1 }, COLUMNS)).toEqual({});
	});

	it.each([
		['undefined', undefined],
		['null', null],
		['a string', 'start'],
		['a number', 1]
	])('returns an empty order for %s', (_label, value) => {
		expect(parseSortOrder(value, COLUMNS)).toEqual({});
	});
});
