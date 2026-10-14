import { FindOperator } from 'typeorm';
import { LIKE_OPERATOR } from '@gauzy/core';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, applyPageWindow, liveWindowConditions, searchConditions } from './predicate.helper';

/**
 * The shapes the tax listings hand to the dual-ORM base.
 *
 * These are assertions about the *predicate*, not about a database: what matters is that every
 * condition is built from operators `processFindOperator` can translate, because the alternative — a
 * `Raw()` SQL fragment — was answered on MikroORM as no condition at all, and a listing with no
 * validity window returns rates that are not in force. A `raw` operator reaching the converter now
 * raises instead, so a regression here is a failed request rather than a wrong answer; either way the
 * assertion below is that none is produced.
 */

/** A row with the columns these helpers narrow on, standing in for a rate or a regime. */
interface IWindowedRow {
	isActive?: boolean;
	countryCode?: string;
	code?: string;
	name?: string;
	startsAt?: Date;
	endsAt?: Date;
}

/** The operator kinds `processFindOperator` translates; anything else has no MikroORM equivalent. */
const TRANSLATABLE = [
	'isNull',
	'not',
	'in',
	'any',
	'equal',
	'between',
	'moreThanOrEqual',
	'moreThan',
	'lessThanOrEqual',
	'lessThan',
	'like',
	'ilike',
	'arrayContains',
	'arrayContainedBy',
	'arrayOverlap',
	'and'
];

/** @returns Every operator used anywhere in a set of conditions. */
function operatorsOf(conditions: Array<Record<string, unknown>>): FindOperator<unknown>[] {
	return conditions.flatMap((condition) =>
		Object.values(condition).filter((value): value is FindOperator<unknown> => value instanceof FindOperator)
	);
}

describe('liveWindowConditions — the validity window, in operators both ORMs translate', () => {
	const liveAt = new Date('2026-01-15T12:00:00.000Z');

	it('expands the two open bounds into the four combinations, carrying the rest of the filter', () => {
		// `(startsAt IS NULL OR startsAt <= t) AND (endsAt IS NULL OR endsAt > t)` has no single-object
		// spelling in either ORM, so it is handed over as a disjunction. The array form is OR on TypeORM
		// and `$or` on MikroORM, and `TenantAwareCrudService` spreads the tenant scope into each element,
		// so the disjunction does not widen the read past the caller's tenant.
		const conditions = liveWindowConditions<IWindowedRow>({ isActive: true, countryCode: 'CA' }, liveAt) as Array<
			Record<string, unknown>
		>;

		expect(conditions).toHaveLength(4);
		for (const condition of conditions) {
			expect(condition.isActive).toBe(true);
			expect(condition.countryCode).toBe('CA');
		}

		const pairs = conditions.map((condition) => [
			(condition.startsAt as FindOperator<unknown>).type,
			(condition.endsAt as FindOperator<unknown>).type
		]);
		expect(pairs).toEqual([
			['isNull', 'isNull'],
			['isNull', 'moreThan'],
			['lessThanOrEqual', 'isNull'],
			['lessThanOrEqual', 'moreThan']
		]);
	});

	it('uses a half-open window, so two rates that abut never both apply and never leave a gap', () => {
		// `startsAt <= t` and `endsAt > t`: the instant a rate ends is the first instant it is no longer
		// charged, and a successor starting at that same instant is in force for it.
		const conditions = liveWindowConditions<IWindowedRow>({}, liveAt) as Array<Record<string, unknown>>;
		const bounded = conditions[3];

		expect((bounded.startsAt as FindOperator<unknown>).type).toBe('lessThanOrEqual');
		expect((bounded.startsAt as FindOperator<unknown>).value).toBe(liveAt);
		expect((bounded.endsAt as FindOperator<unknown>).type).toBe('moreThan');
		expect((bounded.endsAt as FindOperator<unknown>).value).toBe(liveAt);
	});

	it('produces no operator the MikroORM converter cannot translate', () => {
		const conditions = liveWindowConditions<IWindowedRow>({ isActive: true }, liveAt) as Array<Record<string, unknown>>;

		for (const operator of operatorsOf(conditions)) {
			expect(TRANSLATABLE).toContain(operator.type);
			expect(operator.type).not.toBe('raw');
		}
	});
});

describe('searchConditions — free text, in operators both ORMs translate', () => {
	it('matches the term against every named column, keeping the rest of the filter', () => {
		const conditions = searchConditions<IWindowedRow>({ isActive: true }, ['code', 'name'], 'vat') as Array<
			Record<string, unknown>
		>;

		expect(conditions).toHaveLength(2);
		expect(conditions[0].isActive).toBe(true);
		expect(conditions[1].isActive).toBe(true);
		expect(Object.keys(conditions[0])).toContain('code');
		expect(Object.keys(conditions[1])).toContain('name');
	});

	it('takes the dialect branch `LIKE_OPERATOR` already decided, and wraps the term in wildcards', () => {
		// Postgres's `LIKE` is case-sensitive and MySQL's and SQLite's are not, so the operator has to
		// differ for the three dialects to answer the same question. `LIKE_OPERATOR` is the platform's
		// one decision and is read rather than restated.
		const [first] = searchConditions<IWindowedRow>({}, ['code'], 'vat') as Array<Record<string, unknown>>;
		const operator = first.code as FindOperator<unknown>;

		expect(operator.type).toBe(LIKE_OPERATOR === 'ILIKE' ? 'ilike' : 'like');
		expect(operator.value).toBe('%vat%');
		expect(TRANSLATABLE).toContain(operator.type);
	});
});

describe('applyPageWindow — one page size, and `skip` in the spelling the base reads', () => {
	it('states a page size when the caller states none', () => {
		// Leaving `take` undefined meant ten rows on TypeORM and the whole table on MikroORM, from a
		// public GraphQL field — two different answers to the same query depending on deployment.
		const options = applyPageWindow<object>({}, {});

		expect(options.take).toBe(DEFAULT_PAGE_SIZE);
		expect(options.skip).toBe(1);
	});

	it('clamps a page size to the maximum and refuses a non-positive one', () => {
		expect(applyPageWindow<object>({}, { limit: 10_000 }).take).toBe(MAX_PAGE_SIZE);
		expect(applyPageWindow<object>({}, { limit: 0 }).take).toBe(DEFAULT_PAGE_SIZE);
		expect(applyPageWindow<object>({}, { limit: -5 }).take).toBe(1);
		expect(applyPageWindow<object>({}, { limit: Number.NaN }).take).toBe(DEFAULT_PAGE_SIZE);
	});

	it('prefers the offset spelling limit over the cursor spelling page size', () => {
		expect(applyPageWindow<object>({}, { limit: 5, first: 50 }).take).toBe(5);
		expect(applyPageWindow<object>({}, { first: 50 }).take).toBe(50);
	});

	it('translates a row offset into the one-based page number the base multiplies', () => {
		// `skip` is a page number on this platform — both ORM arms compute `take * (skip - 1)` — and the
		// resolvers used to assign the row offset straight to it: `offset: 20` with no limit asked for row
		// 190 on TypeORM and computed `undefined * 19` on MikroORM.
		expect(applyPageWindow<object>({}, { limit: 10, offset: 0 }).skip).toBe(1);
		expect(applyPageWindow<object>({}, { limit: 10, offset: 10 }).skip).toBe(2);
		expect(applyPageWindow<object>({}, { limit: 10, offset: 40 }).skip).toBe(5);
		// An offset inside a page resolves to the start of that page rather than being multiplied.
		expect(applyPageWindow<object>({}, { limit: 10, offset: 45 }).skip).toBe(5);
		expect(applyPageWindow<object>({}, { limit: 10, offset: -1 }).skip).toBe(1);
	});
});
