import * as config from '@gauzy/config';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { MySqlDriver } from '@mikro-orm/mysql';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { ILike, LessThan, LessThanOrEqual, Like, MoreThan } from 'typeorm';
import { convertTypeORMWhereToMikroORM, processFindOperator } from './utils';

/** Pins the configured MikroORM driver read by `isMikroOrmPostgres()`. */
function withMikroOrmDriver(driver: unknown) {
	const original = config.getConfig();
	jest.spyOn(config, 'getConfig').mockReturnValue({
		...original,
		dbMikroOrmConnectionOptions: { ...original.dbMikroOrmConnectionOptions, driver }
	} as unknown as ReturnType<typeof config.getConfig>);
}

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

	afterEach(() => jest.restoreAllMocks());

	it('translates LIKE patterns', () => {
		expect(processFindOperator(Like('%Ada%'))).toEqual({ $like: '%Ada%' });
	});

	it('translates ILIKE to $ilike on PostgreSQL', () => {
		withMikroOrmDriver(PostgreSqlDriver);
		expect(processFindOperator(ILike('%Ada%'))).toEqual({ $ilike: '%Ada%' });
	});

	it.each([
		['MySQL', MySqlDriver],
		['SQLite', BetterSqliteDriver]
	])('translates ILIKE to $like on %s, which has no ILIKE', (_label, driver) => {
		withMikroOrmDriver(driver);
		expect(processFindOperator(ILike('%Ada%'))).toEqual({ $like: '%Ada%' });
	});

	it('keeps a max-only filter in a translated where clause', () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		expect(convertTypeORMWhereToMikroORM({ totalValue: LessThanOrEqual(500) } as any)).toEqual({
			totalValue: { $lte: 500 }
		});
	});
});
