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
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const { EverInstance1790000021000 } = require(join(__dirname, '../../../../../core/src/lib/database/migrations/1790000021000-EverInstance'));
	return new EverInstance1790000021000();
}

export async function openTestDataSource(target: { name: TestDialect; url?: string }): Promise<DataSource> {
	const dataSource = new DataSource(
		target.name === 'better-sqlite3'
			? { type: 'better-sqlite3', database: ':memory:' }
			: ({ type: target.name, url: target.url } as never)
	);
	await dataSource.initialize();
	return dataSource;
}

export function q(dialect: TestDialect, name: string): string {
	return dialect === 'mysql' ? `\`${name}\`` : `"${name}"`;
}

/** Minimal `tenant`, `role` and `user` tables, as far as the operator check reads them. */
export async function createCoreTables(dataSource: DataSource, dialect: TestDialect): Promise<void> {
	const ts = dialect === 'postgres' ? 'timestamp' : dialect === 'mysql' ? 'datetime(6)' : 'datetime';
	const id = dialect === 'mysql' ? 'varchar(64)' : 'varchar';
	await dataSource.query(`CREATE TABLE IF NOT EXISTS ${q(dialect, 'tenant')} (${q(dialect, 'id')} ${id} PRIMARY KEY, ${q(dialect, 'name')} varchar(255), ${q(dialect, 'deletedAt')} ${ts} NULL)`);
	await dataSource.query(`CREATE TABLE IF NOT EXISTS ${q(dialect, 'role')} (${q(dialect, 'id')} ${id} PRIMARY KEY, ${q(dialect, 'name')} varchar(64), ${q(dialect, 'tenantId')} varchar(64))`);
	await dataSource.query(
		`CREATE TABLE IF NOT EXISTS ${q(dialect, 'user')} (${q(dialect, 'id')} ${id} PRIMARY KEY, ${q(dialect, 'email')} varchar(255), ${q(dialect, 'roleId')} varchar(64), ${q(dialect, 'tenantId')} varchar(64), ${q(dialect, 'createdAt')} ${ts} NOT NULL, ${q(dialect, 'deletedAt')} ${ts} NULL)`
	);
}

export async function dropTables(dataSource: DataSource, dialect: TestDialect, tables: string[]): Promise<void> {
	for (const table of tables) {
		await dataSource.query(`DROP TABLE IF EXISTS ${q(dialect, table)}`);
	}
}
