import { ILike, LessThan, LessThanOrEqual, Like, MoreThan } from 'typeorm';
import { convertTypeORMWhereToMikroORM, isMikroOrmPostgres, processFindOperator } from './utils';

/**
 * `paginate` / `findAll` translate TypeORM FindOperators for MikroORM. Untranslated operators used to
 * become `{}`, which MikroORM treats as no condition, so the filter silently matched every row.
 */
describe('processFindOperator', () => {
	it('translates the comparison operators', () => {
		expect(processFindOperator(LessThanOrEqual(10))).toEqual({ $lte: 10 });
		expect(processFindOperator(LessThan(10))).toEqual({ $lt: 10 });
		expect(processFindOperator(MoreThan(10))).toEqual({ $gt: 10 });
	});

	it('translates LIKE and ILIKE patterns', () => {
		expect(processFindOperator(Like('%Ada%'))).toEqual({ $like: '%Ada%' });
		expect(processFindOperator(ILike('%Ada%'))).toEqual(
			isMikroOrmPostgres() ? { $ilike: '%Ada%' } : { $like: '%Ada%' }
		);
	});

	it('keeps a max-only filter in a translated where clause', () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		expect(convertTypeORMWhereToMikroORM({ totalValue: LessThanOrEqual(500) } as any)).toEqual({
			totalValue: { $lte: 500 }
		});
	});
});
