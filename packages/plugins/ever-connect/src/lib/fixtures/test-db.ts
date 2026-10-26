import { join } from 'node:path';
import { DataSource } from 'typeorm';

/**
 * Databases the `*.db.spec.ts` suites run on: SQLite in memory always; Postgres and MySQL when
 * `EVER_CONNECT_TEST_POSTGRES_URL` / `EVER_CONNECT_TEST_MYSQL_URL` (or the statistics suites'
 * `EVER_STATS_TEST_POSTGRES_URL` / `EVER_STATS_TEST_MYSQL_URL`) point at an empty, disposable database.
 */
export type TestDialect = 'better-sqlite3' | 'postgres' | 'mysql';

const pgUrl = process.env['EVER_CONNECT_TEST_POSTGRES_URL'] || process.env['EVER_STATS_TEST_POSTGRES_URL'];
const mysqlUrl = process.env['EVER_CONNECT_TEST_MYSQL_URL'] || process.env['EVER_STATS_TEST_MYSQL_URL'];

export const TEST_TARGETS: Array<{ name: TestDialect; url?: string }> = [
	{ name: 'better-sqlite3' },
	...(pgUrl ? [{ name: 'postgres' as const, url: pgUrl }] : []),
	...(mysqlUrl ? [{ name: 'mysql' as const, url: mysqlUrl }] : [])
];

const MIGRATIONS = join(__dirname, '../../../../../core/src/lib/database/migrations');

type Migration = { name: string; up(runner: unknown): Promise<void>; down(runner: unknown): Promise<void> };

/** The core migrations the plugin needs, in order: `ever_instance`, then the six Ever Platform tables. */
export function connectMigrations(): Migration[] {
	const { EverInstance1790000021000 } = require(join(MIGRATIONS, '1790000021000-EverInstance'));
	const { EverConnect1790000021200 } = require(join(MIGRATIONS, '1790000021200-EverConnect'));
	return [new EverInstance1790000021000(), new EverConnect1790000021200()];
}

export const PLUGIN_TABLES = [
	'ever_connect_connection',
	'ever_connect_link',
	'ever_connect_integration',
	'ever_connect_policy',
	'ever_connect_audit',
	'ever_connect_lookup_cache',
	'ever_instance'
];

export const CORE_TABLES = [
	'tenant',
	'organization',
	'role',
	'user',
	'user_organization',
	'integration',
	'integration_type',
	'integration_integration_type',
	'integration_tenant',
	'integration_setting'
];

/** Postgres runs in a schema of its own, so the suites never touch tables another test left behind. */
const PG_SCHEMA = 'ever_connect_test';

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
		const pg = new DataSource({
			type: 'postgres',
			url: target.url,
			schema: PG_SCHEMA,
			extra: { options: `-c search_path=${PG_SCHEMA}` }
		} as never);
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
		for (const migration of connectMigrations()) {
			await migration.up(runner);
		}
	} finally {
		await runner.release();
	}
}

/**
 * The core tables the plugin reads and writes, with the columns it uses (Gauzy's real tables have
 * more; these are enough to prove the statements on each database).
 */
export async function createCoreTables(dataSource: DataSource, d: TestDialect): Promise<void> {
	const t = (name: string) => q(d, name);
	const id = 'varchar(64)';
	const ts = d === 'postgres' ? 'timestamp' : d === 'mysql' ? 'datetime(6)' : 'datetime';
	const bool = d === 'postgres' ? 'boolean' : 'tinyint';
	const text = 'varchar(255)';
	const now =
		d === 'better-sqlite3' ? "(datetime('now'))" : d === 'mysql' ? 'CURRENT_TIMESTAMP(6)' : 'CURRENT_TIMESTAMP';
	const flags = `${t('isActive')} ${bool} NULL, ${t('isArchived')} ${bool} NULL, ${t('createdAt')} ${ts} NULL DEFAULT ${now}, ${t('updatedAt')} ${ts} NULL DEFAULT ${now}, ${t('deletedAt')} ${ts} NULL`;
	const tables: Record<string, string> = {
		tenant: `${t('id')} ${id} PRIMARY KEY, ${t('name')} ${text}, ${t('createdAt')} ${ts} NULL, ${t('deletedAt')} ${ts} NULL`,
		organization: `${t('id')} ${id} PRIMARY KEY, ${t('tenantId')} ${id} NULL, ${t('name')} ${text}, ${flags}`,
		role: `${t('id')} ${id} PRIMARY KEY, ${t('name')} ${text}, ${t('tenantId')} ${id} NULL`,
		user: `${t('id')} ${id} PRIMARY KEY, ${t('tenantId')} ${id} NULL, ${t('email')} ${text}, ${t('roleId')} ${id} NULL, ${t('emailVerifiedAt')} ${ts} NULL, ${flags}`,
		user_organization: `${t('id')} ${id} PRIMARY KEY, ${t('tenantId')} ${id} NULL, ${t('organizationId')} ${id} NULL, ${t('userId')} ${id} NULL, ${flags}`,
		integration: `${t('id')} ${id} PRIMARY KEY, ${t('name')} ${text} NOT NULL UNIQUE, ${t('provider')} ${text}, ${t('imgSrc')} ${text}, ${t('redirectUrl')} ${text}, ${t('isComingSoon')} ${bool} NULL, ${t('isPaid')} ${bool} NULL, ${t('order')} integer NULL, ${flags}`,
		integration_type: `${t('id')} ${id} PRIMARY KEY, ${t('name')} ${text} NOT NULL UNIQUE`,
		integration_integration_type: `${t('integrationId')} ${id} NOT NULL, ${t('integrationTypeId')} ${id} NOT NULL, PRIMARY KEY (${t('integrationId')}, ${t('integrationTypeId')})`,
		integration_tenant: `${t('id')} ${id} PRIMARY KEY, ${t('tenantId')} ${id} NULL, ${t('organizationId')} ${id} NULL, ${t('name')} ${text} NOT NULL, ${t('integrationId')} ${id} NULL, ${flags}`,
		integration_setting: `${t('id')} ${id} PRIMARY KEY, ${t('tenantId')} ${id} NULL, ${t('organizationId')} ${id} NULL, ${t('settingsName')} ${text} NOT NULL, ${t('settingsValue')} ${text} NOT NULL, ${t('integrationId')} ${id} NOT NULL, ${flags}`
	};
	for (const [name, columns] of Object.entries(tables)) {
		await dataSource.query(`CREATE TABLE IF NOT EXISTS ${t(name)} (${columns})`);
	}
}

/** Inserts one row; `values` maps column → value. */
export async function insert(
	dataSource: DataSource,
	d: TestDialect,
	table: string,
	values: Record<string, unknown>
): Promise<void> {
	const columns = Object.keys(values);
	const marks = columns.map((_, i) => (d === 'postgres' ? `$${i + 1}` : '?')).join(', ');
	await dataSource.query(
		`INSERT INTO ${q(d, table)} (${columns.map((c) => q(d, c)).join(', ')}) VALUES (${marks})`,
		Object.values(values).map((v) => (typeof v === 'boolean' && d !== 'postgres' ? (v ? 1 : 0) : v))
	);
}

/** A tenant with one organization, a super admin (member of it) and an employee. */
export interface SeededTenant {
	tenantId: string;
	organizationId: string;
	superAdminId: string;
	employeeId: string;
}

export async function seedTenant(
	dataSource: DataSource,
	d: TestDialect,
	prefix: string,
	createdAt: string,
	email: string
): Promise<SeededTenant> {
	const { randomUUID } = await import('node:crypto');
	const tenantId = randomUUID();
	const organizationId = randomUUID();
	const superAdminRole = randomUUID();
	const employeeRole = randomUUID();
	const superAdminId = randomUUID();
	const employeeId = randomUUID();
	await insert(dataSource, d, 'tenant', { id: tenantId, name: `${prefix} tenant`, createdAt });
	await insert(dataSource, d, 'organization', {
		id: organizationId,
		tenantId,
		name: `${prefix} organization`,
		isActive: true,
		isArchived: false
	});
	await insert(dataSource, d, 'role', { id: superAdminRole, name: 'SUPER_ADMIN', tenantId });
	await insert(dataSource, d, 'role', { id: employeeRole, name: 'EMPLOYEE', tenantId });
	await insert(dataSource, d, 'user', {
		id: superAdminId,
		tenantId,
		email,
		roleId: superAdminRole,
		emailVerifiedAt: createdAt,
		isActive: true,
		isArchived: false,
		createdAt
	});
	await insert(dataSource, d, 'user', {
		id: employeeId,
		tenantId,
		email: `employee.${email}`,
		roleId: employeeRole,
		isActive: true,
		isArchived: false,
		createdAt
	});
	for (const userId of [superAdminId, employeeId]) {
		await insert(dataSource, d, 'user_organization', {
			id: randomUUID(),
			tenantId,
			organizationId,
			userId,
			isActive: true,
			isArchived: false
		});
	}
	return { tenantId, organizationId, superAdminId, employeeId };
}
