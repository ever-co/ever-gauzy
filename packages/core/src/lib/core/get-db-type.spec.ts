import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { MySqlDriver } from '@mikro-orm/mysql';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { DatabaseTypeEnum } from '@gauzy/config';
import { getDBType } from './utils';

/**
 * The dialect `getDBType` reports under `DB_ORM=mikro-orm`.
 *
 * MikroORM's options name the driver **class** (`driver: BetterSqliteDriver`), and the TypeORM-shaped
 * `dbConnectionOptions` most callers pass name no driver at all. The function tested `driver instanceof …`,
 * which neither shape satisfies, so it answered Postgres for every installation: the seeder's clean step
 * sent `TRUNCATE … RESTART IDENTITY CASCADE` to SQLite and the API could not boot on MikroORM + SQLite.
 */
describe('getDBType', () => {
	const previousOrm = process.env.DB_ORM;

	afterEach(() => {
		if (previousOrm === undefined) delete process.env.DB_ORM;
		else process.env.DB_ORM = previousOrm;
	});

	describe('under MikroORM', () => {
		beforeEach(() => {
			process.env.DB_ORM = 'mikro-orm';
		});

		it.each([
			['better-sqlite3', BetterSqliteDriver, DatabaseTypeEnum.betterSqlite3],
			['postgres', PostgreSqlDriver, DatabaseTypeEnum.postgres],
			['mysql', MySqlDriver, DatabaseTypeEnum.mysql]
		])('recognises the %s driver class the configuration names', (_name, driver, expected) => {
			expect(getDBType({ driver } as any)).toBe(expected);
		});

		it('recognises a subclass of a driver', () => {
			class CustomSqliteDriver extends BetterSqliteDriver {}

			expect(getDBType({ driver: CustomSqliteDriver } as any)).toBe(DatabaseTypeEnum.betterSqlite3);
		});

		it.each([DatabaseTypeEnum.betterSqlite3, DatabaseTypeEnum.sqlite, DatabaseTypeEnum.mysql, DatabaseTypeEnum.postgres])(
			'reads TypeORM-shaped options (no driver) by the type they name: %s',
			(type) => {
				expect(getDBType({ type } as any)).toBe(type);
			}
		);

		it('falls back to Postgres only when the options name neither a driver nor a type', () => {
			expect(getDBType({} as any)).toBe(DatabaseTypeEnum.postgres);
		});
	});

	describe('under TypeORM', () => {
		beforeEach(() => {
			process.env.DB_ORM = 'typeorm';
		});

		it('reads the type the options name, as before', () => {
			expect(getDBType({ type: DatabaseTypeEnum.mysql } as any)).toBe(DatabaseTypeEnum.mysql);
		});
	});
});
