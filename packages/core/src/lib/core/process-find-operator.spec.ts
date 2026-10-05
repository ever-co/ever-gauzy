import { defineConfig, resetConfig } from '@gauzy/config';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { MySqlDriver } from '@mikro-orm/mysql';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { ILike, LessThan, LessThanOrEqual, Like, MoreThan } from 'typeorm';
import { convertTypeORMWhereToMikroORM, processFindOperator } from './utils';

/**
 * Configures the MikroORM driver that `isMikroOrmPostgres()` reads, through the config API itself.
 *
 * Not `jest.spyOn(config, 'getConfig')`: `@gauzy/config` re-exports it through `export *`, which
 * compiles to a non-configurable getter, so the spy threw "Cannot redefine property: getConfig" and
 * these cases never reached an assertion.
 */
async function withMikroOrmDriver(driver: unknown): Promise<void> {
	await defineConfig({ dbMikroOrmConnectionOptions: { driver } } as Parameters<typeof defineConfig>[0]);
}

/**
 * `paginate` / `findAll` translate TypeORM FindOperators for MikroORM. Untranslated operators used to
 * become `{}`, which MikroORM treats as no condition, so the filter silently matched every row.
 */
describe('processFindOperator', () => {
	beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));

	afterEach(() => {
		resetConfig();
		jest.restoreAllMocks();
	});

	it('translates the comparison operators', () => {
		expect(processFindOperator(LessThanOrEqual(10))).toEqual({ $lte: 10 });
		expect(processFindOperator(LessThan(10))).toEqual({ $lt: 10 });
		expect(processFindOperator(MoreThan(10))).toEqual({ $gt: 10 });
	});

	it('translates LIKE patterns', () => {
		expect(processFindOperator(Like('%Ada%'))).toEqual({ $like: '%Ada%' });
	});

	it('translates ILIKE to $ilike on PostgreSQL', async () => {
		await withMikroOrmDriver(PostgreSqlDriver);
		expect(processFindOperator(ILike('%Ada%'))).toEqual({ $ilike: '%Ada%' });
	});

	it.each([
		['MySQL', MySqlDriver],
		['SQLite', BetterSqliteDriver]
	])('translates ILIKE to $like on %s, which has no ILIKE', async (_label, driver) => {
		await withMikroOrmDriver(driver);
		expect(processFindOperator(ILike('%Ada%'))).toEqual({ $like: '%Ada%' });
	});

	it('keeps a max-only filter in a translated where clause', () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		expect(convertTypeORMWhereToMikroORM({ totalValue: LessThanOrEqual(500) } as any)).toEqual({
			totalValue: { $lte: 500 }
		});
	});
});
