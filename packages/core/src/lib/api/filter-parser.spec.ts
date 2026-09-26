import { ApiQueryError, FilterNode } from './query-ast';
import { parseFilter, validateFilterLimits } from './filter-parser';
import { ApiQuerySchema } from './query-schema';

/**
 * The filter grammar, asserted as a grammar.
 *
 * Every case here is a row of the protocol's own limits and operator tables, and each one is
 * asserted through the public entry point rather than through an internal helper — the point of the
 * suite is that a caller cannot reach a shape these cases do not describe.
 */

const schema: ApiQuerySchema = {
	resource: 'sample',
	filterable: [
		'id',
		'name',
		'status',
		'quantity',
		'amount',
		'placedAt',
		'isActive',
		'attributes',
		'customer.name',
		'customer.contactType'
	],
	kinds: {
		id: 'ID',
		name: 'STRING',
		status: 'ENUM',
		quantity: 'NUMBER',
		amount: 'DECIMAL',
		placedAt: 'DATE',
		isActive: 'BOOLEAN',
		attributes: 'JSON',
		'customer.name': 'STRING',
		'customer.contactType': 'STRING'
	}
};

/** The catalogue code a call raises, or `undefined` when it does not raise. */
function codeOf(call: () => unknown): string | undefined {
	try {
		call();
		return undefined;
	} catch (error) {
		return (error as ApiQueryError).code;
	}
}

describe('parseFilter', () => {
	it('reads a scalar as equality and an array as membership', () => {
		expect(parseFilter({ status: 'DRAFT' }, schema)).toEqual({
			kind: 'condition',
			path: ['status'],
			op: 'eq',
			value: 'DRAFT'
		});
		expect(parseFilter({ status: ['A', 'B'] }, schema)).toEqual({
			kind: 'condition',
			path: ['status'],
			op: 'in',
			value: ['A', 'B']
		});
	});

	it('reads the wire form of a list', () => {
		expect(parseFilter({ status: { in: 'CONFIRMED,PROCESSING' } }, schema)).toEqual({
			kind: 'condition',
			path: ['status'],
			op: 'in',
			value: ['CONFIRMED', 'PROCESSING']
		});
	});

	it('accepts the filter as a JSON string', () => {
		expect(parseFilter('{"status":{"eq":"DRAFT"}}', schema)).toEqual({
			kind: 'condition',
			path: ['status'],
			op: 'eq',
			value: 'DRAFT'
		});
	});

	it('treats nothing sent as no filter', () => {
		expect(parseFilter(undefined, schema)).toBeUndefined();
		expect(parseFilter('', schema)).toBeUndefined();
	});

	it('refuses a filter that is not a filter object', () => {
		expect(codeOf(() => parseFilter('{oops', schema))).toBe('VALIDATION_FAILED');
		expect(codeOf(() => parseFilter(42, schema))).toBe('VALIDATION_FAILED');
	});

	it('reads a one-level relation path', () => {
		expect(parseFilter({ 'customer.name': { ilike: '%acme%' } }, schema)).toEqual({
			kind: 'condition',
			path: ['customer', 'name'],
			op: 'ilike',
			value: '%acme%'
		});
	});

	it('refuses a third path segment before it looks at the field name', () => {
		// A schema cannot declare a three-segment path, so reporting it as an unknown field would
		// send the caller looking for a name instead of at the shape of the query.
		expect(codeOf(() => parseFilter({ 'customer.address.city': { eq: 'x' } }, schema))).toBe(
			'QUERY_FILTER_DEPTH_EXCEEDED'
		);
	});

	it('names the allowed fields when a field is not filterable', () => {
		try {
			parseFilter({ nickname: { eq: 'x' } }, schema);
			throw new Error('expected the call to throw');
		} catch (error) {
			const violation = error as ApiQueryError;
			expect(violation.code).toBe('QUERY_UNKNOWN_FILTER_FIELD');
			expect(violation.details?.allowed).toContain('name');
		}
	});

	it('coerces a value to the field kind it is filtering', () => {
		expect(parseFilter({ quantity: { gte: '10' } }, schema)).toMatchObject({ value: 10 });
		expect(parseFilter({ isActive: { eq: 'true' } }, schema)).toMatchObject({ value: true });
		expect(parseFilter({ placedAt: { gte: '2026-01-01T00:00:00Z' } }, schema)).toMatchObject({
			value: '2026-01-01T00:00:00Z'
		});
	});

	it('keeps money a decimal string and refuses a float', () => {
		expect(parseFilter({ amount: { gte: '100.000000' } }, schema)).toMatchObject({ value: '100.000000' });
		expect(codeOf(() => parseFilter({ amount: { gte: 100.5 } }, schema))).toBe('VALIDATION_MONEY_PRECISION');
		expect(codeOf(() => parseFilter({ amount: { gte: 'abc' } }, schema))).toBe('VALIDATION_MONEY_PRECISION');
	});

	it('refuses a date that does not exist and a date in another shape', () => {
		expect(codeOf(() => parseFilter({ placedAt: { gte: '2026-02-31' } }, schema))).toBe('VALIDATION_INVALID_DATE_RANGE');
		expect(codeOf(() => parseFilter({ placedAt: { gte: '01/02/2026' } }, schema))).toBe('VALIDATION_INVALID_DATE_RANGE');
	});

	it('keeps both bounds of a range, inclusive, and refuses a reversed one', () => {
		expect(parseFilter({ placedAt: { between: '2026-01-01T00:00:00Z,2026-03-31T23:59:59Z' } }, schema)).toMatchObject({
			op: 'between',
			value: ['2026-01-01T00:00:00Z', '2026-03-31T23:59:59Z']
		});
		expect(codeOf(() => parseFilter({ placedAt: { between: '2026-03-31T00:00:00Z,2026-01-01T00:00:00Z' } }, schema))).toBe(
			'VALIDATION_INVALID_DATE_RANGE'
		);
		expect(codeOf(() => parseFilter({ placedAt: { between: '2026-01-01T00:00:00Z' } }, schema))).toBe(
			'VALIDATION_INVALID_DATE_RANGE'
		);
	});

	it('never turns a null test into a bare null', () => {
		// The value is the boolean the caller sent. The translator is what spells out IS NULL, and it
		// can only do so because the grammar never hands it a null to interpret.
		expect(parseFilter({ amount: { isNull: true } }, schema)).toMatchObject({ op: 'isNull', value: true });
		expect(parseFilter({ amount: { isNull: 'false' } }, schema)).toMatchObject({ op: 'isNull', value: false });
		expect(codeOf(() => parseFilter({ amount: { isNull: 'maybe' } }, schema))).toBe('VALIDATION_FAILED');
	});

	it('drops an operator sent with an explicit null rather than guessing', () => {
		expect(parseFilter({ status: { eq: null } }, schema)).toEqual({ kind: 'and', children: [] });
	});

	it('accepts the operators the kind allows and refuses the rest', () => {
		expect(parseFilter({ name: { contains: 'acme' } }, schema)).toMatchObject({ op: 'contains' });
		expect(parseFilter({ attributes: { contains: 'gift' } }, schema)).toMatchObject({ op: 'contains' });
		expect(codeOf(() => parseFilter({ isActive: { contains: 'x' } }, schema))).toBe('QUERY_UNSUPPORTED_OPERATOR');
		expect(codeOf(() => parseFilter({ isActive: { like: 'x' } }, schema))).toBe('QUERY_UNSUPPORTED_OPERATOR');
		expect(codeOf(() => parseFilter({ name: { gt: 'x' } }, schema))).toBe('QUERY_UNSUPPORTED_OPERATOR');
		expect(codeOf(() => parseFilter({ name: { regex: 'x' } }, schema))).toBe('QUERY_UNSUPPORTED_OPERATOR');
	});

	it('gives a field with no declared kind the operators that need no type', () => {
		const loose: ApiQuerySchema = { resource: 'loose', filterable: ['nickname'] };
		expect(parseFilter({ nickname: { eq: 'x' } }, loose)).toMatchObject({ op: 'eq' });
		expect(codeOf(() => parseFilter({ nickname: { gt: 1 } }, loose))).toBe('QUERY_UNSUPPORTED_OPERATOR');
	});

	it('combines top-level conditions with AND and keeps a group a group', () => {
		expect(
			parseFilter({ name: { eq: 'x' }, $or: [{ status: { eq: 'A' } }, { status: { eq: 'B' } }] }, schema)
		).toEqual({
			kind: 'and',
			children: [
				{ kind: 'condition', path: ['name'], op: 'eq', value: 'x' },
				{
					kind: 'or',
					children: [
						{ kind: 'condition', path: ['status'], op: 'eq', value: 'A' },
						{ kind: 'condition', path: ['status'], op: 'eq', value: 'B' }
					]
				}
			]
		} as FilterNode);
	});

	it('allows two levels of nesting and refuses a third', () => {
		expect(
			parseFilter({ $or: [{ status: { eq: 'A' }, $or: [{ name: { eq: 'x' } }] }] }, schema)
		).toBeDefined();
		expect(codeOf(() => parseFilter({ $or: [{ $or: [{ $or: [{ status: { eq: 'A' } }] }] }] }, schema))).toBe(
			'QUERY_NESTING_LIMIT_EXCEEDED'
		);
	});

	it('caps the members of one group', () => {
		const members = Array.from({ length: 21 }, (_, index) => ({ name: { eq: `n${index}` } }));
		expect(codeOf(() => parseFilter({ $or: members }, schema))).toBe('QUERY_NESTING_LIMIT_EXCEEDED');
		expect(parseFilter({ $or: members.slice(0, 20) }, schema)).toBeDefined();
	});

	it('caps the keys of one filter object', () => {
		const wide: Record<string, unknown> = {};
		for (let index = 0; index < 33; index += 1) {
			wide[`k${index}`] = { eq: 'x' };
		}
		expect(codeOf(() => parseFilter(wide, { resource: 'loose' }))).toBe('QUERY_NESTING_LIMIT_EXCEEDED');
	});

	it('caps the width of a membership list', () => {
		const wide = Array.from({ length: 201 }, (_, index) => `v${index}`).join(',');
		expect(codeOf(() => parseFilter({ name: { in: wide } }, schema))).toBe('QUERY_FILTER_DEPTH_EXCEEDED');
		const atTheCap = Array.from({ length: 200 }, (_, index) => `v${index}`).join(',');
		expect(parseFilter({ name: { in: atTheCap } }, schema)).toBeDefined();
	});

	it('refuses an empty membership test however it is spelled', () => {
		// `values.join(',')` on an empty list is how a client most often arrives here, and answering
		// it with "match the empty string" would hide the caller's mistake behind a plausible page.
		expect(codeOf(() => parseFilter({ name: { in: [] } }, schema))).toBe('VALIDATION_INVALID_ENUM');
		expect(codeOf(() => parseFilter({ name: { in: '' } }, schema))).toBe('VALIDATION_INVALID_ENUM');
		expect(codeOf(() => parseFilter({ name: { in: ',' } }, schema))).toBe('VALIDATION_INVALID_ENUM');
		expect(codeOf(() => parseFilter({ name: { nin: [] } }, schema))).toBe('VALIDATION_INVALID_ENUM');
	});

	it('treats a trailing separator as encoding rather than as a value', () => {
		expect(parseFilter({ name: { in: 'a,' } }, schema)).toMatchObject({ value: ['a'] });
		// The explicit array form has no such ambiguity, so an empty string there is a real value.
		expect(parseFilter({ name: { in: [''] } }, schema)).toMatchObject({ value: [''] });
	});
});

describe('validateFilterLimits', () => {
	it('passes a filter inside the caps', () => {
		expect(() => validateFilterLimits({ name: { eq: 'x' } }, schema)).not.toThrow();
	});

	it('refuses a path deeper than the grammar allows', () => {
		expect(codeOf(() => validateFilterLimits({ 'a.b.c': { eq: 1 } }, undefined))).toBe('QUERY_FILTER_DEPTH_EXCEEDED');
	});
});
