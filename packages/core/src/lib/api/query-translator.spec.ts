import { ApiQuery, ApiQueryError, FilterNode } from './query-ast';
import { toFindManyOptions, toMikroOrmFindOptions, toMikroOrmWhere, toWhereClause } from './query-translator';

/**
 * The translator writes caller-named paths into the option objects both engines read: filter paths,
 * sort fields, selected fields and expanded relations. Without a resource declaration every one of them
 * is caller input, so a segment that names the prototype chain must never be written through.
 */

/** A query with nothing in it but what a case sets. */
function query(overrides: Partial<ApiQuery> = {}): ApiQuery {
	return {
		resource: 'sample',
		sort: [],
		page: { mode: 'OFFSET', number: 1, limit: 10 },
		expand: [],
		withDeleted: false,
		context: {},
		legacy: false,
		...overrides
	};
}

/** One condition on a path. */
function condition(path: string[], value: unknown = 'x'): FilterNode {
	return { kind: 'condition', path, op: 'eq', value };
}

/** @returns The error a call raises, or undefined when it does not raise. */
function errorOf(call: () => unknown): ApiQueryError | undefined {
	try {
		call();
		return undefined;
	} catch (error) {
		return error as ApiQueryError;
	}
}

afterEach(() => {
	// Belt and braces: a failure below must not leak into the rest of the run.
	delete (Object.prototype as Record<string, unknown>)['polluted'];
	delete (Object.prototype as Record<string, unknown>)['$eq'];
});

describe('the translator — paths it writes, as before', () => {
	it('nests a relation path and merges two conditions on one relation', () => {
		const filter: FilterNode = {
			kind: 'and',
			children: [condition(['customer', 'name'], 'Ada'), condition(['customer', 'city'], 'Paris')]
		};

		expect(toMikroOrmWhere(filter)).toEqual({
			$and: [{ customer: { name: { $eq: 'Ada' } } }, { customer: { city: { $eq: 'Paris' } } }]
		});
		expect(Object.keys((toWhereClause(filter) as Record<string, Record<string, unknown>>)['customer'])).toEqual([
			'name',
			'city'
		]);
	});

	it('nests sort, selection and expansion paths', () => {
		const options = toFindManyOptions(
			query({
				sort: [{ field: 'customer.name', direction: 'ASC' }],
				fields: { paths: ['id', 'customer.name'] },
				expand: ['customer.address']
			})
		);

		expect(options.order).toEqual({ customer: { name: 'ASC' } });
		expect(options.select).toEqual({ id: true, customer: { name: true } });
		expect(options.relations).toEqual({ customer: { address: true } });
	});

	it('writes `constructor` and `prototype` as ordinary own keys', () => {
		// Neither is a key an assignment refuses to create, so neither is refused: they are written as the
		// field names they are, and nothing is written on `Object`.
		const options = toFindManyOptions(query({ fields: { paths: ['constructor', 'prototype.name'] } }));

		expect(Object.prototype.hasOwnProperty.call(options.select, 'constructor')).toBe(true);
		expect(options.select).toEqual({ constructor: true, prototype: { name: true } });
		expect((Object as unknown as Record<string, unknown>)['prototype']).toBe(Object.prototype);
	});
});

describe('the translator — `__proto__` is refused wherever a path is written', () => {
	it.each([
		['a filter on the TypeORM path', () => toWhereClause(condition(['__proto__', 'polluted']))],
		['a filter on the MikroORM path', () => toMikroOrmWhere(condition(['__proto__', 'polluted']))],
		['a filter that ends in it', () => toWhereClause(condition(['customer', '__proto__']))],
		['a sort field', () => toFindManyOptions(query({ sort: [{ field: '__proto__.polluted', direction: 'ASC' }] }))],
		['a selected field', () => toFindManyOptions(query({ fields: { paths: ['__proto__.polluted'] } }))],
		['an expanded relation', () => toFindManyOptions(query({ expand: ['__proto__.polluted'] }))],
		[
			'a sort field on the MikroORM path',
			() => toMikroOrmFindOptions(query({ sort: [{ field: '__proto__.polluted', direction: 'DESC' }] }))
		]
	])('refuses %s, and leaves Object.prototype untouched', (_label, call) => {
		const error = errorOf(call);

		expect(error).toBeInstanceOf(ApiQueryError);
		expect(error?.code).toBe('VALIDATION_FAILED');
		expect(error?.status).toBe(400);
		expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
		expect(({} as Record<string, unknown>)['$eq']).toBeUndefined();
	});

	it('refuses rather than skipping, so a filter condition is never silently dropped', () => {
		// Dropping the condition would widen the result to rows the caller did not ask for.
		const filter: FilterNode = {
			kind: 'and',
			children: [condition(['status'], 'OPEN'), condition(['__proto__', 'polluted'])]
		};

		expect(errorOf(() => toWhereClause(filter))?.code).toBe('VALIDATION_FAILED');
		expect(errorOf(() => toMikroOrmWhere(filter))?.code).toBe('VALIDATION_FAILED');
	});
});
