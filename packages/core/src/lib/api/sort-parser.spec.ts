import { ApiQueryError, SortKey } from './query-ast';
import { ApiQuerySchema } from './query-schema';
import { parseSort, parseSortFromLegacyOrder, resolveEffectiveSort } from './sort-parser';

/**
 * Ordering, asserted in both directions: what a caller may write, and what the resource's own
 * declaration contributes when the caller writes nothing.
 */

const schema: ApiQuerySchema = {
	resource: 'sample',
	sortable: ['createdAt', 'updatedAt', 'name', 'quantity'],
	defaultSort: ['-createdAt', '-id']
};

/** A schema with no declaration of its own, for the pass-through cases. */
const loose: ApiQuerySchema = { resource: 'loose' };

/** The catalogue code a call raises, or `undefined` when it does not raise. */
function codeOf(call: () => unknown): string | undefined {
	try {
		call();
		return undefined;
	} catch (error) {
		return (error as ApiQueryError).code;
	}
}

describe('parseSort', () => {
	it('reads the wire form', () => {
		expect(parseSort('-createdAt,name', schema)).toEqual([
			{ field: 'createdAt', direction: 'DESC' },
			{ field: 'name', direction: 'ASC' }
		]);
	});

	it('reads an explicit ascending marker', () => {
		expect(parseSort('+name', schema)).toEqual([{ field: 'name', direction: 'ASC' }]);
	});

	it('reads a list of tokens', () => {
		expect(parseSort(['-createdAt'], schema)).toEqual([{ field: 'createdAt', direction: 'DESC' }]);
	});

	it('reads a single connection-shaped key', () => {
		expect(parseSort({ field: 'name', direction: 'DESC' }, schema)).toEqual([{ field: 'name', direction: 'DESC' }]);
	});

	it('reads a list of connection-shaped keys, in order', () => {
		// The list form is what a GraphQL connection sends, and a sort that silently disappears here
		// would return rows in an order the caller did not ask for.
		expect(
			parseSort(
				[
					{ field: 'name', direction: 'ASC' },
					{ field: 'createdAt', direction: 'DESC' }
				],
				schema
			)
		).toEqual([
			{ field: 'name', direction: 'ASC' },
			{ field: 'createdAt', direction: 'DESC' }
		]);
	});

	it('reads the nested parameter form', () => {
		expect(parseSort({ 0: '-createdAt' }, schema)).toEqual([{ field: 'createdAt', direction: 'DESC' }]);
	});

	it('reports nothing sent as no sort', () => {
		expect(parseSort(undefined, schema)).toEqual([]);
		expect(parseSort([], schema)).toEqual([]);
		expect(parseSort('', schema)).toEqual([]);
	});

	it('refuses a field outside the allow-list and names the allowed set', () => {
		try {
			parseSort('-bogus', schema);
			throw new Error('expected the call to throw');
		} catch (error) {
			const violation = error as ApiQueryError;
			expect(violation.code).toBe('QUERY_SORT_NOT_ALLOWED');
			expect(violation.details?.allowed).toContain('name');
		}
	});

	it('refuses a connection-shaped key outside the allow-list rather than dropping it', () => {
		expect(codeOf(() => parseSort([{ field: 'bogus' }], schema))).toBe('QUERY_SORT_NOT_ALLOWED');
	});

	it('caps the number of keys', () => {
		expect(parseSort('name,createdAt,quantity', schema)).toHaveLength(3);
		expect(codeOf(() => parseSort('name,createdAt,quantity,updatedAt', schema))).toBe('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a sort nested deeper than the parameter could be', () => {
		expect(codeOf(() => parseSort([[[[['a']]]]], schema))).toBe('VALIDATION_FAILED');
	});
});

describe('resolveEffectiveSort', () => {
	it('applies the resource default when the caller asked for none', () => {
		expect(resolveEffectiveSort([], schema)).toEqual([
			{ field: 'createdAt', direction: 'DESC' },
			{ field: 'id', direction: 'DESC' }
		]);
	});

	it('keeps the caller order when there is one', () => {
		const requested: SortKey[] = [{ field: 'name', direction: 'ASC' }];
		expect(resolveEffectiveSort(requested, schema)).toEqual(requested);
	});

	it('reports no order for a resource that declares none', () => {
		expect(resolveEffectiveSort([], loose)).toEqual([]);
	});
});

describe('parseSortFromLegacyOrder', () => {
	it('maps a TypeORM-style order object', () => {
		expect(parseSortFromLegacyOrder({ createdAt: 'DESC' }, schema)).toEqual([
			{ field: 'createdAt', direction: 'DESC' }
		]);
		expect(parseSortFromLegacyOrder({ name: 'asc' }, schema)).toEqual([{ field: 'name', direction: 'ASC' }]);
	});

	it('maps a list of order objects', () => {
		expect(parseSortFromLegacyOrder([{ name: 'ASC' }, { createdAt: 'DESC' }], schema)).toEqual([
			{ field: 'name', direction: 'ASC' },
			{ field: 'createdAt', direction: 'DESC' }
		]);
	});

	it('drops a field the resource does not allow sorting by', () => {
		// The alias is forgiving here on purpose: callers of the historical parameter must not start
		// receiving errors for the order objects they have been sending for years.
		expect(parseSortFromLegacyOrder({ bogus: 'ASC' }, schema)).toEqual([]);
	});

	it('caps the keys it keeps', () => {
		expect(parseSortFromLegacyOrder({ a: 'ASC', b: 'ASC', c: 'ASC', d: 'ASC' }, loose)).toHaveLength(3);
	});

	it('reports nothing sent as no sort', () => {
		expect(parseSortFromLegacyOrder(undefined, schema)).toEqual([]);
		expect(parseSortFromLegacyOrder('nonsense', schema)).toEqual([]);
	});
});
