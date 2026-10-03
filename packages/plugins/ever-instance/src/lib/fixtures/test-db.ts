import { join } from 'node:path';
import { DataSource } from 'typeorm';

/**
 * Databases the DB-backed specs run on: SQLite in memory always; Postgres and MySQL when
 * `EVER_STATS_TEST_POSTGRES_URL` / `EVER_STATS_TEST_MYSQL_URL` point at an empty, disposable database.
 */
export type TestDialect = 'better-sqlite3' | 'postgres' | 'mysql';

export const TEST_TARGETS: Array<{ name: TestDialect; url?: string }> = [
	{ name: 'better-sqlite3' },
	...(process.env['EVER_STATS_TEST_POSTGRES_URL']
		? [{ name: 'postgres' as const, url: process.env['EVER_STATS_TEST_POSTGRES_URL'] }]
		: []),
	...(process.env['EVER_STATS_TEST_MYSQL_URL'] ? [{ name: 'mysql' as const, url: process.env['EVER_STATS_TEST_MYSQL_URL'] }] : [])
];

/** The core migration that creates `ever_instance` (core holds the migrations of plugins for now). */
export function everInstanceMigration(): { up(runner: unknown): Promise<void>; down(runner: unknown): Promise<void> } {
	const { EverInstance1790000021000 } = require(join(__dirname, '../../../../../core/src/lib/database/migrations/1790000021000-EverInstance'));
	return new EverInstance1790000021000();
}

/** Postgres runs in a schema of its own, so the suites never touch tables another test left behind. */
const PG_SCHEMA = 'ever_stats_test';

export async function openTestDataSource(target: { name: TestDialect; url?: string }): Promise<DataSource> {
	if (target.name === 'better-sqlite3') {
		const sqlite = new DataSource({ type: 'better-sqlite3', database: ':memory:' });
		await sqlite.initialize();
		return sqlite;
	}
	if (target.name === 'postgres') {
		const setup = new DataSource({ type: 'postgres', url: target.url } as never);
		await setup.initialize();
		await setup.query(`CREATE SCHEMA IF NOT EXISTS "${PG_SCHEMA}"`);
		await setup.destroy();
		const pg = new DataSource({ type: 'postgres', url: target.url, schema: PG_SCHEMA, extra: { options: `-c search_path=${PG_SCHEMA}` } } as never);
		await pg.initialize();
		return pg;
	}
	const other = new DataSource({ type: target.name, url: target.url } as never);
	await other.initialize();
	return other;
}

export function q(dialect: TestDialect, name: string): string {
	return dialect === 'mysql' ? `\`${name}\`` : `"${name}"`;
}

/** Minimal `tenant`, `role` and `user` tables, with the columns the operator check reads. */
export async function createCoreTables(dataSource: DataSource, dialect: TestDialect): Promise<void> {
	const ts = dialect === 'postgres' ? 'timestamp' : dialect === 'mysql' ? 'datetime(6)' : 'datetime';
	const id = dialect === 'mysql' ? 'varchar(64)' : 'varchar';
	const bool = dialect === 'postgres' ? 'boolean' : 'tinyint';
	await dataSource.query(`CREATE TABLE IF NOT EXISTS ${q(dialect, 'tenant')} (${q(dialect, 'id')} ${id} PRIMARY KEY, ${q(dialect, 'name')} varchar(255), ${q(dialect, 'deletedAt')} ${ts} NULL)`);
	await dataSource.query(`CREATE TABLE IF NOT EXISTS ${q(dialect, 'role')} (${q(dialect, 'id')} ${id} PRIMARY KEY, ${q(dialect, 'name')} varchar(64), ${q(dialect, 'tenantId')} varchar(64))`);
	await dataSource.query(
		`CREATE TABLE IF NOT EXISTS ${q(dialect, 'user')} (${q(dialect, 'id')} ${id} PRIMARY KEY, ${q(dialect, 'email')} varchar(255), ${q(dialect, 'roleId')} varchar(64), ${q(dialect, 'tenantId')} varchar(64), ` +
			`${q(dialect, 'emailVerifiedAt')} ${ts} NULL, ${q(dialect, 'isActive')} ${bool} NULL, ${q(dialect, 'isArchived')} ${bool} NULL, ${q(dialect, 'createdAt')} ${ts} NOT NULL, ${q(dialect, 'deletedAt')} ${ts} NULL)`
	);
}

export async function dropTables(dataSource: DataSource, dialect: TestDialect, tables: string[]): Promise<void> {
	for (const table of tables) {
		await dataSource.query(`DROP TABLE IF EXISTS ${q(dialect, table)}`);
	}
}
