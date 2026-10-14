import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { CoreRolePermissionsReload1791000000500 } from './migrations/1791000000500-CoreRolePermissionsReload';
import { GrantCustomSmtpEditPermission1791000000573 } from './migrations/1791000000573-GrantCustomSmtpEditPermission';

/**
 * `CUSTOM_SMTP_EDIT` is new, and the routes that write SMTP settings now require it. A tenant provisioned
 * before it exists has no row for it, so without this migration every role that saves SMTP settings today —
 * under `CUSTOM_SMTP_VIEW`, the only grant the family had — would be refused tomorrow. The migration grants the
 * edit grant to exactly the roles that hold the read grant, tenant by tenant, and to nobody else.
 *
 * The SQLite branch runs for real on the `role_permission` DDL the migration chain leaves behind (the last
 * SQLite rebuild of the table plus the unique index), read from those migrations' sources so the fixture cannot
 * drift from the chain — the same fixture `role-permission-unique-migration.spec.ts` builds.
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
const ADMIN_A = 'b0000000-0000-4000-8000-000000000001';
const MANAGER_A = 'b0000000-0000-4000-8000-000000000002';
const EMPLOYEE_A = 'b0000000-0000-4000-8000-000000000003';
const ARCHIVED_A = 'b0000000-0000-4000-8000-000000000004';
const DELETED_A = 'b0000000-0000-4000-8000-000000000005';
const DECIDED_A = 'b0000000-0000-4000-8000-000000000006';
const ADMIN_B = 'b0000000-0000-4000-8000-000000000007';
const RELOADED_A = 'b0000000-0000-4000-8000-000000000008';
const ADMIN_USER = 'd0000000-0000-4000-8000-000000000001';

/** [roleId, tenantId, name] — the names the permission reload matches defaults by. */
const ROLES: Array<[string, string, string]> = [
	[ADMIN_A, TENANT_A, 'ADMIN'],
	[MANAGER_A, TENANT_A, 'MANAGER'],
	[EMPLOYEE_A, TENANT_A, 'EMPLOYEE'],
	[ARCHIVED_A, TENANT_A, 'VIEWER'],
	[DELETED_A, TENANT_A, 'DATA_ENTRY'],
	[DECIDED_A, TENANT_A, 'INTERVIEWER'],
	[ADMIN_B, TENANT_B, 'ADMIN'],
	[RELOADED_A, TENANT_A, 'CANDIDATE']
];
const id = (n: number) => `c0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** [n, tenantId, roleId, permission, enabled, isArchived, deletedAt, updatedByUserId] */
const ROWS: Array<[number, string, string, string, number, number, string | null, string | null]> = [
	[1, TENANT_A, ADMIN_A, 'CUSTOM_SMTP_VIEW', 1, 0, null, null], // default holder → gains the edit grant
	[2, TENANT_A, MANAGER_A, 'CUSTOM_SMTP_VIEW', 1, 0, null, null], // a tenant's own grant → gains it too
	[3, TENANT_A, EMPLOYEE_A, 'CUSTOM_SMTP_VIEW', 0, 0, null, null], // switched off → gains nothing
	[4, TENANT_A, ARCHIVED_A, 'CUSTOM_SMTP_VIEW', 1, 1, null, null], // archived grant grants nothing → nothing
	[5, TENANT_A, DELETED_A, 'CUSTOM_SMTP_VIEW', 1, 0, '2026-01-01 00:00:00', null], // deleted → nothing
	[6, TENANT_A, DECIDED_A, 'CUSTOM_SMTP_VIEW', 1, 0, null, null],
	[7, TENANT_A, DECIDED_A, 'CUSTOM_SMTP_EDIT', 0, 0, null, ADMIN_USER], // an administrator switched it off → left as it is
	[8, TENANT_B, ADMIN_B, 'CUSTOM_SMTP_VIEW', 1, 0, null, null], // another tenant's holder → gains it in its tenant
	[9, TENANT_A, ADMIN_A, 'ORG_EMPLOYEES_VIEW', 1, 0, null, null], // an unrelated grant → untouched
	[10, TENANT_A, RELOADED_A, 'CUSTOM_SMTP_VIEW', 1, 0, null, null],
	[11, TENANT_A, RELOADED_A, 'CUSTOM_SMTP_EDIT', 0, 0, null, null] // written off by a reload, nobody decided → switched on
];

const EDIT_GRANTS_SQL = `SELECT "tenantId", "roleId", "enabled" FROM "role_permission" WHERE "permission" = 'CUSTOM_SMTP_EDIT' ORDER BY "tenantId", "roleId"`;

describe('GrantCustomSmtpEditPermission1791000000573 — the write grant goes to exactly the read grant’s holders', () => {
	let dataSource: DataSource;
	let dbPath: string;

	beforeEach(async () => {
		dbPath = path.join(os.tmpdir(), `gauzy-custom-smtp-edit-${process.pid}-${Date.now()}-${Math.random()}.sqlite3`);
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: dbPath,
			migrations: [GrantCustomSmtpEditPermission1791000000573],
			synchronize: false,
			logging: false
		});
		await dataSource.initialize();

		const { table, indexes } = currentSqliteRolePermissionSchema();
		await dataSource.query('CREATE TABLE "tenant" ("id" varchar PRIMARY KEY NOT NULL, "name" varchar)');
		await dataSource.query('CREATE TABLE "role" ("id" varchar PRIMARY KEY NOT NULL, "name" varchar, "tenantId" varchar)');
		await dataSource.query('CREATE TABLE "user" ("id" varchar PRIMARY KEY NOT NULL)');
		await dataSource.query(`INSERT INTO "tenant" ("id", "name") VALUES (?, 'A'), (?, 'B')`, [TENANT_A, TENANT_B]);
		await dataSource.query('INSERT INTO "user" ("id") VALUES (?)', [ADMIN_USER]);
		for (const [role, tenant, name] of ROLES) {
			await dataSource.query('INSERT INTO "role" ("id", "tenantId", "name") VALUES (?, ?, ?)', [role, tenant, name]);
		}
		await dataSource.query(table);
		for (const index of indexes) {
			await dataSource.query(index);
		}
		await dataSource.query(
			`CREATE UNIQUE INDEX "IDX_role_permission_unique" ON "role_permission" ("tenantId", "roleId", "permission")`
		);
		for (const [n, tenantId, roleId, permission, enabled, isArchived, deletedAt, updatedByUserId] of ROWS) {
			await dataSource.query(
				`INSERT INTO "role_permission" ("id", "tenantId", "roleId", "permission", "enabled", "isActive", "isArchived", "deletedAt", "updatedByUserId")
				VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`,
				[id(n), tenantId, roleId, permission, enabled, isArchived, deletedAt, updatedByUserId]
			);
		}
	});

	afterEach(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
		fs.rmSync(dbPath, { force: true });
	});

	const byRole = (rows: Array<{ tenantId: string; roleId: string; enabled: number }>) =>
		[...rows].sort((a, b) => (a.tenantId + a.roleId).localeCompare(b.tenantId + b.roleId));

	it('grants CUSTOM_SMTP_EDIT, enabled, to every live holder of CUSTOM_SMTP_VIEW in its own tenant, and to nobody else', async () => {
		await dataSource.runMigrations({ transaction: 'each' });

		expect(byRole(await dataSource.query(EDIT_GRANTS_SQL))).toEqual(
			byRole([
				{ tenantId: TENANT_A, roleId: ADMIN_A, enabled: 1 },
				{ tenantId: TENANT_A, roleId: MANAGER_A, enabled: 1 },
				{ tenantId: TENANT_A, roleId: DECIDED_A, enabled: 0 },
				{ tenantId: TENANT_A, roleId: RELOADED_A, enabled: 1 },
				{ tenantId: TENANT_B, roleId: ADMIN_B, enabled: 1 }
			])
		);
	});

	it('changes no row it found, except one a reload wrote switched off that nobody decided', async () => {
		const before = await dataSource.query('SELECT * FROM "role_permission" ORDER BY "id"');

		await dataSource.runMigrations({ transaction: 'each' });

		const after = await dataSource.query(
			`SELECT * FROM "role_permission" WHERE "id" IN (${ROWS.map(() => '?').join(', ')}) ORDER BY "id"`,
			ROWS.map(([n]) => id(n))
		);
		expect(after).toEqual(before.map((row: { id: string }) => (row.id === id(11) ? { ...row, enabled: 1 } : row)));
	});

	it('changes nothing when it runs again', async () => {
		await dataSource.runMigrations({ transaction: 'each' });
		const once = await dataSource.query(EDIT_GRANTS_SQL);

		const queryRunner = dataSource.createQueryRunner();
		await new GrantCustomSmtpEditPermission1791000000573().up(queryRunner);
		await queryRunner.release();

		expect(await dataSource.query(EDIT_GRANTS_SQL)).toEqual(once);
	});

	/**
	 * Greptile on #10563: on an upgrade where a permission reload runs before this migration, the reload reads the
	 * enum the deployed code carries — CUSTOM_SMTP_EDIT included — and writes the new value for every role, switched
	 * on only for the role's defaults. A role a tenant granted the read grant to would then hold a switched-off
	 * write-grant row before this migration looks, and skipping it would lock that role out of saving. This runs the
	 * real reload (`CoreRolePermissionsReload1791000000500`) and this migration, in their timestamp order.
	 */
	it('after a permission reload in the same upgrade, still leaves every holder of the read grant able to write', async () => {
		await dataSource.destroy();
		const both = new DataSource({
			type: 'better-sqlite3',
			database: dbPath,
			migrations: [CoreRolePermissionsReload1791000000500, GrantCustomSmtpEditPermission1791000000573],
			synchronize: false,
			logging: false
		});
		await both.initialize();
		try {
			const ran = await both.runMigrations({ transaction: 'each' });
			expect(ran.map((migration) => migration.name)).toEqual([
				'CoreRolePermissionsReload1791000000500',
				'GrantCustomSmtpEditPermission1791000000573'
			]);

			expect(byRole(await both.query(EDIT_GRANTS_SQL))).toEqual(
				byRole([
					// ADMIN holds the read grant by default: the reload writes the write grant switched on.
					{ tenantId: TENANT_A, roleId: ADMIN_A, enabled: 1 },
					// MANAGER holds the read grant by the tenant's own choice: the reload writes the write grant switched
					// off, and this migration switches it on — the case the review found.
					{ tenantId: TENANT_A, roleId: MANAGER_A, enabled: 1 },
					// Roles that do not hold the read grant keep the reload's switched-off row.
					{ tenantId: TENANT_A, roleId: EMPLOYEE_A, enabled: 0 },
					{ tenantId: TENANT_A, roleId: ARCHIVED_A, enabled: 0 },
					{ tenantId: TENANT_A, roleId: DELETED_A, enabled: 0 },
					// An administrator's decision is kept.
					{ tenantId: TENANT_A, roleId: DECIDED_A, enabled: 0 },
					{ tenantId: TENANT_A, roleId: RELOADED_A, enabled: 1 },
					{ tenantId: TENANT_B, roleId: ADMIN_B, enabled: 1 }
				])
			);
		} finally {
			await both.destroy();
		}
	});
});
