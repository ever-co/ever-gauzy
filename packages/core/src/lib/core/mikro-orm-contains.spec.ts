import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { MySqlDriver } from '@mikro-orm/mysql';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { isMikroOrmPostgres, mikroOrmContains } from './utils';

/**
 * MikroORM emits `$ilike` verbatim as `ILIKE`, which MySQL and SQLite reject.
 */
describe('mikroOrmContains', () => {
	it('uses $ilike on PostgreSQL', () => {
		expect(mikroOrmContains('Ada', true)).toEqual({ $ilike: '%Ada%' });
	});

	it('uses $like on MySQL / SQLite, whose LIKE is already case-insensitive', () => {
		expect(mikroOrmContains('Ada', false)).toEqual({ $like: '%Ada%' });
	});
});

/**
 * `dbMikroOrmConnectionOptions.driver` is configured as the driver class, not an instance.
 */
describe('isMikroOrmPostgres', () => {
	it('recognizes the PostgreSQL driver class', () => {
		expect(isMikroOrmPostgres(PostgreSqlDriver)).toBe(true);
	});

	it.each([
		['MySQL', MySqlDriver],
		['SQLite', BetterSqliteDriver]
	])('recognizes the %s driver class', (_label, driver) => {
		expect(isMikroOrmPostgres(driver)).toBe(false);
	});

	it('falls back to PostgreSQL for a missing or unknown driver, like getDBType()', () => {
		// `undefined` would trigger the default (read from the config), so pass explicit values
		expect(isMikroOrmPostgres(null)).toBe(true);
		expect(isMikroOrmPostgres(class UnknownDriver {})).toBe(true);
	});
});
