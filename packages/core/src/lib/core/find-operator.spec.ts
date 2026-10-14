import {
	And,
	Any,
	ArrayContainedBy,
	ArrayContains,
	ArrayOverlap,
	Between,
	Equal,
	ILike,
	In,
	IsNull,
	LessThan,
	LessThanOrEqual,
	Like,
	MoreThan,
	MoreThanOrEqual,
	Not,
	Raw
} from 'typeorm';
import { convertTypeORMWhereToMikroORM, processFindOperator } from './utils';

/**
 * The translation a read depends on when the installation runs `DB_ORM=mikro-orm`.
 *
 * Every case here is a predicate the platform actually writes. What makes them worth pinning is the
 * shape of the failure they used to have: an operator the converter did not know was answered with
 * `{}`, and an empty condition on a property is not a narrower read — it is *no condition at all*.
 * So a sweep predicated on `LessThan(expiresAt)` selected every row, a search predicated on
 * `Like('%term%')` matched everything, and an effective-date range returned rates that are not in
 * force. Each of those reads succeeded, returned rows, and was wrong, which is the failure that
 * costs the most to find because nothing reports it.
 *
 * The last two cases are the other half of the same rule: an operator that genuinely cannot be
 * translated raises, because telling the caller by returning every row is not telling the caller.
 */
describe('the operators a predicate is built from', () => {
	it('translates every comparison TypeORM can express', () => {
		expect(processFindOperator(Equal(3))).toEqual({ $eq: 3 });
		expect(processFindOperator(MoreThan(3))).toEqual({ $gt: 3 });
		expect(processFindOperator(MoreThanOrEqual(3))).toEqual({ $gte: 3 });
		expect(processFindOperator(LessThan(3))).toEqual({ $lt: 3 });
		expect(processFindOperator(LessThanOrEqual(3))).toEqual({ $lte: 3 });
		expect(processFindOperator(Between(1, 5))).toEqual({ $gte: 1, $lte: 5 });
		expect(processFindOperator(In([1, 2]))).toEqual({ $in: [1, 2] });
		// `Any([...])` is `= ANY(array)`, which is the membership question `$in` asks.
		expect(processFindOperator(Any([1, 2]))).toEqual({ $in: [1, 2] });
		expect(processFindOperator(IsNull())).toBeNull();
	});

	it('translates the text and array operators a search and a facet are built from', () => {
		// The caller's value already carries its own wildcards, in both ORMs.
		expect(processFindOperator(Like('%term%'))).toEqual({ $like: '%term%' });
		expect(processFindOperator(ILike('%term%'))).toEqual({ $ilike: '%term%' });
		expect(processFindOperator(ArrayContains(['a']))).toEqual({ $contains: ['a'] });
		expect(processFindOperator(ArrayContainedBy(['a']))).toEqual({ $contained: ['a'] });
		expect(processFindOperator(ArrayOverlap(['a']))).toEqual({ $overlap: ['a'] });
	});

	it('negates a scalar with $ne and a condition with $not', () => {
		expect(processFindOperator(Not(IsNull()))).toEqual({ $ne: null });
		expect(processFindOperator(Not('DRAFT'))).toEqual({ $ne: 'DRAFT' });
		// `{ $ne: { $in: [...] } }` compares the column against an object and matches nothing, which
		// is why a child that translated to a condition is negated rather than compared.
		expect(processFindOperator(Not(In(['A', 'B'])))).toEqual({ $not: { $in: ['A', 'B'] } });
		expect(processFindOperator(Not(Like('%x%')))).toEqual({ $not: { $like: '%x%' } });
	});

	it('keeps a falsy value a value rather than turning it into a null check', () => {
		// `operator.value || null` read `Not(0)`, `Not(false)` and `Not('')` as `IS NOT NULL`, which
		// is a different question and one that is true for very nearly every row.
		expect(processFindOperator(Not(0))).toEqual({ $ne: 0 });
		expect(processFindOperator(Not(false))).toEqual({ $ne: false });
		expect(processFindOperator(Not(''))).toEqual({ $ne: '' });
	});

	it('folds several conditions on one property into the one object MikroORM reads', () => {
		// `And(a, b)` is two conditions on one property, and MikroORM spells that as one object
		// carrying both rather than as a list.
		expect(processFindOperator(And(MoreThanOrEqual(1), LessThanOrEqual(5)))).toEqual({ $gte: 1, $lte: 5 });
	});

	it('refuses an operator it cannot translate instead of widening the read', () => {
		// `Raw` is a SQL fragment the other ORM never sees. Answering it without the predicate would
		// return every row, so the caller is told — and told what to do about it.
		expect(() => processFindOperator(Raw((alias) => `${alias} > 0`))).toThrow(/UNSUPPORTED_FIND_OPERATOR/);
		expect(() => processFindOperator(Raw((alias) => `${alias} > 0`))).toThrow(/every row/);
	});

	it('translates the operators inside a whole where clause, at every depth', () => {
		const converted = convertTypeORMWhereToMikroORM({
			status: In(['ACTIVE']),
			startsAt: LessThanOrEqual(new Date('2026-03-01T00:00:00Z')),
			endsAt: Not(IsNull()),
			organization: { name: Like('Ever%') }
		} as any) as Record<string, any>;

		expect(converted['status']).toEqual({ $in: ['ACTIVE'] });
		expect(converted['startsAt']).toEqual({ $lte: new Date('2026-03-01T00:00:00Z') });
		expect(converted['endsAt']).toEqual({ $ne: null });
		// Control: a nested relation condition is converted too, so a predicate on a joined property
		// is not the one that silently widens.
		expect(converted['organization']).toEqual({ name: { $like: 'Ever%' } });
	});
});
