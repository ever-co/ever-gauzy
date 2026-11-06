import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { PermissionsEnum } from '@gauzy/contracts';
import { DEFAULT_ROLE_PERMISSIONS } from '../role-permission/default-role-permissions';
import { GrantChangeOwnRatesPermission1791000004030 } from './migrations/1791000004030-GrantChangeOwnRatesPermission';

/**
 * Changing one's own rates needs CHANGE_OWN_RATES, which a new tenant's SUPER_ADMIN and ADMIN roles get by default
 * and the migration gives to those two roles of every existing tenant, so admins keep changing their own rates. A row
 * a tenant administrator decided stays as it is; a switched-off row nobody changed (a permission reload in the same
 * upgrade) is switched on.
 *
 * The SQLite branch runs for real on the `role_permission` DDL the migration chain leaves behind, read from the last
 * SQLite rebuild of the table, as the other permission migration specs build it.
 */
const LAST_SQLITE_ROLE_PERMISSION_MIGRATION = '1740811220961-AlterBaseEntityAddDeletedByUserIdColumn.ts';

function currentSqliteRolePermissionSchema(): { table: string; indexes: string[] } {
	const source = fs.readFileSync(path.join(__dirname, 'migrations', LAST_SQLITE_ROLE_PERMISSION_MIGRATION), 'utf8');
	const up = source.slice(
		source.indexOf('public async sqliteUpQueryRunner'),
		source.indexOf('public async sqliteDownQueryRunner')
	);
	const tables = up.match(/CREATE TABLE "temporary_role_permission" \([^`]*\)/g) ?? [];
	const table = tables[tables.length - 1].replace('"temporary_role_permission"', '"role_permission"');
	const indexes = up.match(/CREATE INDEX "[^"]+" ON "role_permission" \([^)]*\)/g) ?? [];
	return { table, indexes: [...new Set(indexes)] };
}

const TENANT_A = 'a0000000-0000-4000-8000-000000000001';
const TENANT_B = 'a0000000-0000-4000-8000-000000000002';
const SUPER_ADMIN_A = 'b0000000-0000-4000-8000-000000000001';
const ADMIN_A = 'b0000000-0000-4000-8000-000000000002';
const MANAGER_A = 'b0000000-0000-4000-8000-000000000003';
const EMPLOYEE_A = 'b0000000-0000-4000-8000-000000000004';
const DELETED_ADMIN_A = 'b0000000-0000-4000-8000-000000000005';
const SUPER_ADMIN_B = 'b0000000-0000-4000-8000-000000000006';
const ADMIN_B = 'b0000000-0000-4000-8000-000000000007';
const ADMIN_USER = 'd0000000-0000-4000-8000-000000000001';

/** [roleId, tenantId, name, deletedAt] */
const ROLES: Array<[string, string, string, string | null]> = [
	[SUPER_ADMIN_A, TENANT_A, 'SUPER_ADMIN', null],
	[ADMIN_A, TENANT_A, 'ADMIN', null],
	[MANAGER_A, TENANT_A, 'MANAGER', null],
	[EMPLOYEE_A, TENANT_A, 'EMPLOYEE', null],
	[DELETED_ADMIN_A, TENANT_A, 'ADMIN', '2026-01-01 00:00:00'],
	[SUPER_ADMIN_B, TENANT_B, 'SUPER_ADMIN', null],
	[ADMIN_B, TENANT_B, 'ADMIN', null]
];

const id = (n: number) => `c0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** [n, tenantId, roleId, enabled, updatedByUserId] rows of CHANGE_OWN_RATES that exist before the migration. */
const ROWS: Array<[number, string, string, number, string | null]> = [
	// A permission reload wrote it switched off and nobody changed it → switched on
	[1, TENANT_B, ADMIN_B, 0, null],
	// A tenant administrator switched it off → kept off
	[2, TENANT_B, SUPER_ADMIN_B, 0, ADMIN_USER],
	// Another role's reload row → untouched
	[3, TENANT_A, EMPLOYEE_A, 0, null]
];

const GRANTS_SQL = `SELECT "tenantId", "roleId", "enabled" FROM "role_permission"
	WHERE "permission" = 'CHANGE_OWN_RATES' AND "deletedAt" IS NULL`;

type GrantRow = { tenantId: string; roleId: string; enabled: number };

const sorted = (rows: GrantRow[]) =>
	[...rows].sort((a, b) => (a.tenantId + a.roleId).localeCompare(b.tenantId + b.roleId));

describe('DEFAULT_ROLE_PERMISSIONS — CHANGE_OWN_RATES', () => {
	it('gives a new tenant the grant on SUPER_ADMIN and ADMIN, and on no other role', () => {
		const holders = DEFAULT_ROLE_PERMISSIONS.filter(({ defaultEnabledPermissions }) =>
			defaultEnabledPermissions.includes(PermissionsEnum.CHANGE_OWN_RATES)
		);

		expect(holders.map(({ role }) => role).sort()).toEqual(['ADMIN', 'SUPER_ADMIN']);
	});
});

describe('GrantChangeOwnRatesPermission1791000004030 — existing admins keep changing their own rates', () => {
	let dataSource: DataSource;
	let dbPath: string;

	beforeEach(async () => {
		dbPath = path.join(os.tmpdir(), `gauzy-change-own-rates-${process.pid}-${Date.now()}-${Math.random()}.sqlite3`);
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: dbPath,
			migrations: [GrantChangeOwnRatesPermission1791000004030],
			synchronize: false,
			logging: false
		});
		await dataSource.initialize();

		const { table, indexes } = currentSqliteRolePermissionSchema();
		await dataSource.query('CREATE TABLE "tenant" ("id" varchar PRIMARY KEY NOT NULL, "name" varchar)');
		await dataSource.query(
			'CREATE TABLE "role" ("id" varchar PRIMARY KEY NOT NULL, "name" varchar, "tenantId" varchar, "deletedAt" datetime)'
		);
		await dataSource.query('CREATE TABLE "user" ("id" varchar PRIMARY KEY NOT NULL)');
		await dataSource.query(`INSERT INTO "tenant" ("id", "name") VALUES (?, 'A'), (?, 'B')`, [TENANT_A, TENANT_B]);
		await dataSource.query('INSERT INTO "user" ("id") VALUES (?)', [ADMIN_USER]);
		for (const [role, tenant, name, deletedAt] of ROLES) {
			await dataSource.query('INSERT INTO "role" ("id", "tenantId", "name", "deletedAt") VALUES (?, ?, ?, ?)', [
				role,
				tenant,
				name,
				deletedAt
			]);
		}
		await dataSource.query(table);
		for (const index of indexes) {
			await dataSource.query(index);
		}
		for (const [n, tenantId, roleId, enabled, updatedByUserId] of ROWS) {
			await dataSource.query(
				`INSERT INTO "role_permission" ("id", "tenantId", "roleId", "permission", "enabled", "isActive", "isArchived", "updatedByUserId")
				VALUES (?, ?, ?, 'CHANGE_OWN_RATES', ?, 1, 0, ?)`,
				[id(n), tenantId, roleId, enabled, updatedByUserId]
			);
		}
	});

	afterEach(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
		fs.rmSync(dbPath, { force: true });
	});

	const expected = sorted([
		{ tenantId: TENANT_A, roleId: SUPER_ADMIN_A, enabled: 1 },
		{ tenantId: TENANT_A, roleId: ADMIN_A, enabled: 1 },
		{ tenantId: TENANT_A, roleId: EMPLOYEE_A, enabled: 0 },
		{ tenantId: TENANT_B, roleId: SUPER_ADMIN_B, enabled: 0 },
		{ tenantId: TENANT_B, roleId: ADMIN_B, enabled: 1 }
	]);

	it('gives every live SUPER_ADMIN and ADMIN role the grant, keeps what an administrator decided, and nobody else gains', async () => {
		await dataSource.runMigrations({ transaction: 'each' });

		expect(sorted(await dataSource.query(GRANTS_SQL))).toEqual(expected);
	});

	it('changes nothing when it runs again', async () => {
		const migration = new GrantChangeOwnRatesPermission1791000004030();
		const queryRunner = dataSource.createQueryRunner();
		try {
			await migration.up(queryRunner);
			await migration.up(queryRunner);
		} finally {
			await queryRunner.release();
		}

		expect(sorted(await dataSource.query(GRANTS_SQL))).toEqual(expected);
	});
});
