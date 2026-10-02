import { join } from 'node:path';
import { DataSource } from 'typeorm';

/**
 * Databases the `*.db.spec.ts` suites run on: SQLite in memory always; Postgres and MySQL when
 * `EVER_STATS_TEST_POSTGRES_URL` / `EVER_STATS_TEST_MYSQL_URL` point at an empty, disposable database
 * (the CI job sets the Postgres one).
 */
export type TestDialect = 'better-sqlite3' | 'postgres' | 'mysql';

export const TEST_TARGETS: Array<{ name: TestDialect; url?: string }> = [
	{ name: 'better-sqlite3' },
	...(process.env['EVER_STATS_TEST_POSTGRES_URL'] ? [{ name: 'postgres' as const, url: process.env['EVER_STATS_TEST_POSTGRES_URL'] }] : []),
	...(process.env['EVER_STATS_TEST_MYSQL_URL'] ? [{ name: 'mysql' as const, url: process.env['EVER_STATS_TEST_MYSQL_URL'] }] : [])
];

const MIGRATIONS = join(__dirname, '../../../../../core/src/lib/database/migrations');

/** The two core migrations of the plugin, in order. */
export function statsMigrations(): Array<{ name: string; up(runner: unknown): Promise<void>; down(runner: unknown): Promise<void> }> {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const { EverInstance1790000021000 } = require(join(MIGRATIONS, '1790000021000-EverInstance'));
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const { EverStatsReport1790000021100 } = require(join(MIGRATIONS, '1790000021100-EverStatsReport'));
	return [new EverInstance1790000021000(), new EverStatsReport1790000021100()];
}

export const PLUGIN_TABLES = ['ever_stats_lease', 'ever_stats_report', 'ever_instance'];
export const CORE_TABLES = [
	'tenant',
	'organization',
	'role',
	'user',
	'employee',
	'organization_team',
	'task',
	'organization_project',
	'organization_contact',
	'integration_tenant',
	'invoice',
	'payment',
	'time_log'
];

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

export async function dropTables(dataSource: DataSource, dialect: TestDialect, tables: string[]): Promise<void> {
	for (const table of tables) {
		await dataSource.query(`DROP TABLE IF EXISTS ${q(dialect, table)}`);
	}
}

export async function migrateUp(dataSource: DataSource): Promise<void> {
	const runner = dataSource.createQueryRunner();
	try {
		for (const migration of statsMigrations()) {
			await migration.up(runner);
		}
	} finally {
		await runner.release();
	}
}

/**
 * The core tables the collector and the operator check read, with the columns they read plus the
 * personal and business fields a real database holds (so the canary can seed them).
 */
export async function createCoreTables(dataSource: DataSource, d: TestDialect): Promise<void> {
	const t = (name: string) => q(d, name);
	const id = d === 'mysql' ? 'varchar(64)' : 'varchar(64)';
	const ts = d === 'postgres' ? 'timestamp' : d === 'mysql' ? 'datetime(6)' : 'datetime';
	const bool = d === 'postgres' ? 'boolean' : 'tinyint';
	const money = d === 'postgres' ? 'numeric' : d === 'mysql' ? 'decimal(20,4)' : 'numeric';
	const text = 'varchar(255)';
	const common = `${t('id')} ${id} PRIMARY KEY, ${t('tenantId')} ${id} NULL, ${t('isActive')} ${bool} NULL, ${t('isArchived')} ${bool} NULL, ${t('createdAt')} ${ts} NULL, ${t('deletedAt')} ${ts} NULL`;
	const tables: Record<string, string> = {
		tenant: `${t('id')} ${id} PRIMARY KEY, ${t('name')} ${text}, ${t('createdAt')} ${ts} NULL, ${t('deletedAt')} ${ts} NULL`,
		organization: `${common}, ${t('name')} ${text}, ${t('taxId')} ${text}, ${t('website')} ${text}`,
		role: `${t('id')} ${id} PRIMARY KEY, ${t('name')} ${text}, ${t('tenantId')} ${id} NULL`,
		user: `${common}, ${t('email')} ${text}, ${t('firstName')} ${text}, ${t('lastName')} ${text}, ${t('roleId')} ${id} NULL, ${t('lastLoginAt')} ${ts} NULL`,
		employee: `${common}, ${t('userId')} ${id} NULL`,
		organization_team: `${common}, ${t('name')} ${text}`,
		task: `${common}, ${t('title')} ${text}`,
		organization_project: `${common}, ${t('name')} ${text}`,
		organization_contact: `${common}, ${t('name')} ${text}, ${t('primaryEmail')} ${text}, ${t('address')} ${text}`,
		integration_tenant: `${common}, ${t('name')} ${text}`,
		invoice: `${common}, ${t('invoiceNumber')} ${text}, ${t('currency')} ${text} NULL, ${t('totalValue')} ${money} NULL, ${t('isEstimate')} ${bool} NULL, ${t('invoiceDate')} ${ts} NULL`,
		payment: `${common}, ${t('note')} ${text}, ${t('currency')} ${text} NULL, ${t('amount')} ${money} NULL, ${t('paymentDate')} ${ts} NULL`,
		time_log: `${common}, ${t('description')} ${text}, ${t('startedAt')} ${ts} NULL, ${t('stoppedAt')} ${ts} NULL`
	};
	for (const [name, columns] of Object.entries(tables)) {
		await dataSource.query(`CREATE TABLE IF NOT EXISTS ${t(name)} (${columns})`);
	}
}

/** Inserts one row; `values` maps column → value. */
export async function insert(dataSource: DataSource, d: TestDialect, table: string, values: Record<string, unknown>): Promise<void> {
	const columns = Object.keys(values);
	const marks = columns.map((_, i) => (d === 'postgres' ? `$${i + 1}` : '?')).join(', ');
	await dataSource.query(
		`INSERT INTO ${q(d, table)} (${columns.map((c) => q(d, c)).join(', ')}) VALUES (${marks})`,
		Object.values(values).map((v) => (typeof v === 'boolean' && d !== 'postgres' ? (v ? 1 : 0) : v))
	);
}

/**
 * Gauzy's `StatsService.getGlobalStats()` over the test tables: plain counts of rows that are not
 * deleted, outside any tenant (what the real service returns when no request is active).
 */
export function globalStatsOver(dataSource: DataSource, d: TestDialect) {
	const n = async (table: string, where = '') =>
		Number((await dataSource.query(`SELECT COUNT(*) AS n FROM ${q(d, table)} WHERE ${q(d, 'deletedAt')} IS NULL${where}`))[0].n);
	return {
		getGlobalStats: async () => ({
			tenants: await n('tenant'),
			organizations: await n('organization'),
			employees: await n('employee'),
			teams: await n('organization_team'),
			tasks: await n('task'),
			users: {
				count: await n('user'),
				lastMonthActiveUsers: await n('user', ` AND ${q(d, 'lastLoginAt')} IS NOT NULL`)
			}
		})
	};
}
