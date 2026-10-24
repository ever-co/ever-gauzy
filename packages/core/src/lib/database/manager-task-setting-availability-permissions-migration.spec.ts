import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { PermissionsEnum } from '@gauzy/contracts';
import { DEFAULT_ROLE_PERMISSIONS } from '../role-permission/default-role-permissions';
import { CoreRolePermissionsReload1791000000500 } from './migrations/1791000000500-CoreRolePermissionsReload';
import { GrantManagerTaskSettingAndAvailabilityPermissions1791000000841 } from './migrations/1791000000841-GrantManagerTaskSettingAndAvailabilityPermissions';

/**
 * Owner decision 2(b) (2026-10-23): the task-setting writes (`ORG_TASK_SETTING`) and the availability-slot,
 * appointment and invitation writes (`EMPLOYEE_AVAILABILITY_CREATE` / `_UPDATE` / `_DELETE`) are gated now, and
 * `MANAGER` held none of the four by default. The migration grants them to the `MANAGER` role of every tenant, and to
 * nobody else; a new tenant gets the same from `DEFAULT_ROLE_PERMISSIONS`.
 *
 * Unlike the grants of `...821`, these four are old: provisioning wrote a switched-off row of each for every
 * `MANAGER` when the tenant was created, inside the onboarding request (so carrying the onboarding user as
 * `createdByUserId`). Such a row was never changed, and is switched on. A row somebody changed (`updatedByUserId`) or
 * deleted is that tenant's decision and stays as it is.
 *
 * The SQLite branch runs for real on the `role_permission` DDL the migration chain leaves behind (the last SQLite
 * rebuild of the table plus the unique index), read from those migrations' sources so the fixture cannot drift from
 * the chain — the same fixture `goals-skills-event-types-edit-permissions-migration.spec.ts` builds.
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

const GRANTS = [
	'ORG_TASK_SETTING',
	'EMPLOYEE_AVAILABILITY_CREATE',
	'EMPLOYEE_AVAILABILITY_UPDATE',
	'EMPLOYEE_AVAILABILITY_DELETE'
];

const TENANT_A = 'a0000000-0000-4000-8000-000000000001';
const TENANT_B = 'a0000000-0000-4000-8000-000000000002';
const SUPER_ADMIN_A = 'b0000000-0000-4000-8000-000000000001';
const ADMIN_A = 'b0000000-0000-4000-8000-000000000002';
const MANAGER_A = 'b0000000-0000-4000-8000-000000000003';
const EMPLOYEE_A = 'b0000000-0000-4000-8000-000000000004';
const VIEWER_A = 'b0000000-0000-4000-8000-000000000005';
const DELETED_MANAGER_A = 'b0000000-0000-4000-8000-000000000006';
const MANAGER_B = 'b0000000-0000-4000-8000-000000000007';
const ONBOARDING_USER = 'd0000000-0000-4000-8000-000000000001';
const ADMIN_USER = 'd0000000-0000-4000-8000-000000000002';

/** [roleId, tenantId, name, deletedAt] — the names the migration (and the permission reload) match by. */
const ROLES: Array<[string, string, string, string | null]> = [
	[SUPER_ADMIN_A, TENANT_A, 'SUPER_ADMIN', null],
	[ADMIN_A, TENANT_A, 'ADMIN', null],
	[MANAGER_A, TENANT_A, 'MANAGER', null],
	[EMPLOYEE_A, TENANT_A, 'EMPLOYEE', null],
	[VIEWER_A, TENANT_A, 'VIEWER', null],
	[DELETED_MANAGER_A, TENANT_A, 'MANAGER', '2026-01-01 00:00:00'],
	[MANAGER_B, TENANT_B, 'MANAGER', null]
];
const id = (n: number) => `c0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** [n, tenantId, roleId, permission, enabled, deletedAt, createdByUserId, updatedByUserId] */
const ROWS: Array<[number, string, string, string, number, string | null, string | null, string | null]> = [
	// Tenant A's manager: an administrator switched ORG_TASK_SETTING off → left as it is
	[1, TENANT_A, MANAGER_A, 'ORG_TASK_SETTING', 0, null, ONBOARDING_USER, ADMIN_USER],
	// written off at provisioning, inside the onboarding request, never changed → switched on
	[2, TENANT_A, MANAGER_A, 'EMPLOYEE_AVAILABILITY_CREATE', 0, null, ONBOARDING_USER, null],
	// deleted by someone → left as it is
	[3, TENANT_A, MANAGER_A, 'EMPLOYEE_AVAILABILITY_DELETE', 0, '2026-01-01 00:00:00', ONBOARDING_USER, ADMIN_USER],
	// no row for EMPLOYEE_AVAILABILITY_UPDATE → inserted
	// Tenant B's manager: all four written off by a permission reload, with no user at all → switched on
	[4, TENANT_B, MANAGER_B, 'ORG_TASK_SETTING', 0, null, null, null],
	[5, TENANT_B, MANAGER_B, 'EMPLOYEE_AVAILABILITY_CREATE', 0, null, null, null],
	[6, TENANT_B, MANAGER_B, 'EMPLOYEE_AVAILABILITY_UPDATE', 0, null, null, null],
	[7, TENANT_B, MANAGER_B, 'EMPLOYEE_AVAILABILITY_DELETE', 0, null, null, null],
	// Another role's rows, switched off at provisioning → untouched: only MANAGER gains anything
	[8, TENANT_A, VIEWER_A, 'ORG_TASK_SETTING', 0, null, ONBOARDING_USER, null],
	[9, TENANT_A, EMPLOYEE_A, 'EMPLOYEE_AVAILABILITY_CREATE', 1, null, ONBOARDING_USER, null],
	// An unrelated grant of the manager → untouched
	[10, TENANT_A, MANAGER_A, 'ORG_EMPLOYEES_VIEW', 0, null, ONBOARDING_USER, null]
];

const GRANTS_SQL = `SELECT "tenantId", "roleId", "permission", "enabled" FROM "role_permission"
	WHERE "permission" IN ('ORG_TASK_SETTING', 'EMPLOYEE_AVAILABILITY_CREATE', 'EMPLOYEE_AVAILABILITY_UPDATE',
		'EMPLOYEE_AVAILABILITY_DELETE') AND "deletedAt" IS NULL`;

type GrantRow = { tenantId: string; roleId: string; permission: string; enabled: number };

const sorted = (rows: GrantRow[]) =>
	[...rows].sort((a, b) =>
		(a.tenantId + a.roleId + a.permission).localeCompare(b.tenantId + b.roleId + b.permission)
	);

describe('DEFAULT_ROLE_PERMISSIONS — a new tenant’s managers get the same four grants', () => {
	it('lists ORG_TASK_SETTING and the three availability writes among the defaults of MANAGER', () => {
		const manager = DEFAULT_ROLE_PERMISSIONS.find(({ role }) => role === 'MANAGER');

		expect(manager.defaultEnabledPermissions).toEqual(expect.arrayContaining(GRANTS as PermissionsEnum[]));
	});

	it('leaves the availability read, which the manager never held, out', () => {
		const manager = DEFAULT_ROLE_PERMISSIONS.find(({ role }) => role === 'MANAGER');

		expect(manager.defaultEnabledPermissions).not.toContain(PermissionsEnum.EMPLOYEE_AVAILABILITY_READ);
	});

	it('gives ORG_TASK_SETTING to SUPER_ADMIN, ADMIN and MANAGER, and to no other role', () => {
		expect(
			DEFAULT_ROLE_PERMISSIONS.filter(({ defaultEnabledPermissions }) =>
				defaultEnabledPermissions.includes(PermissionsEnum.ORG_TASK_SETTING)
			)
				.map(({ role }) => role)
				.sort()
		).toEqual(['ADMIN', 'MANAGER', 'SUPER_ADMIN']);
	});
});

describe('GrantManagerTaskSettingAndAvailabilityPermissions1791000000841 — the managers get the task-setting and availability writes', () => {
	let dataSource: DataSource;
	let dbPath: string;

	beforeEach(async () => {
		dbPath = path.join(
			os.tmpdir(),
			`gauzy-manager-task-setting-availability-${process.pid}-${Date.now()}-${Math.random()}.sqlite3`
		);
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: dbPath,
			migrations: [GrantManagerTaskSettingAndAvailabilityPermissions1791000000841],
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
		await dataSource.query('INSERT INTO "user" ("id") VALUES (?), (?)', [ONBOARDING_USER, ADMIN_USER]);
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
		await dataSource.query(
			`CREATE UNIQUE INDEX "IDX_role_permission_unique" ON "role_permission" ("tenantId", "roleId", "permission")`
		);
		for (const [n, tenantId, roleId, permission, enabled, deletedAt, createdByUserId, updatedByUserId] of ROWS) {
			await dataSource.query(
				`INSERT INTO "role_permission" ("id", "tenantId", "roleId", "permission", "enabled", "isActive", "isArchived", "deletedAt", "createdByUserId", "updatedByUserId")
				VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?, ?)`,
				[id(n), tenantId, roleId, permission, enabled, deletedAt, createdByUserId, updatedByUserId]
			);
		}
	});

	afterEach(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
		fs.rmSync(dbPath, { force: true });
	});

	it('gives every live MANAGER role the four, keeps what someone decided, and nobody else gains', async () => {
		await dataSource.runMigrations({ transaction: 'each' });

		expect(sorted(await dataSource.query(GRANTS_SQL))).toEqual(
			sorted([
				// An administrator switched ORG_TASK_SETTING off for tenant A's managers: kept off. The provisioning
				// row is switched on, the missing one inserted, the deleted one neither restored nor written again.
				{ tenantId: TENANT_A, roleId: MANAGER_A, permission: 'ORG_TASK_SETTING', enabled: 0 },
				{ tenantId: TENANT_A, roleId: MANAGER_A, permission: 'EMPLOYEE_AVAILABILITY_CREATE', enabled: 1 },
				{ tenantId: TENANT_A, roleId: MANAGER_A, permission: 'EMPLOYEE_AVAILABILITY_UPDATE', enabled: 1 },
				// The other roles' rows, as they were
				{ tenantId: TENANT_A, roleId: VIEWER_A, permission: 'ORG_TASK_SETTING', enabled: 0 },
				{ tenantId: TENANT_A, roleId: EMPLOYEE_A, permission: 'EMPLOYEE_AVAILABILITY_CREATE', enabled: 1 },
				// Tenant B's reload rows, all four switched on
				...GRANTS.map((permission) => ({ tenantId: TENANT_B, roleId: MANAGER_B, permission, enabled: 1 }))
			])
		);
	});

	it('changes no row it found, except the switched-off ones nobody changed', async () => {
		const before = await dataSource.query('SELECT * FROM "role_permission" ORDER BY "id"');

		await dataSource.runMigrations({ transaction: 'each' });

		const after = await dataSource.query(
			`SELECT * FROM "role_permission" WHERE "id" IN (${ROWS.map(() => '?').join(', ')}) ORDER BY "id"`,
			ROWS.map(([n]) => id(n))
		);
		const switchedOn = new Set([id(2), id(4), id(5), id(6), id(7)]);
		expect(after).toEqual(
			before.map((row: { id: string }) => (switchedOn.has(row.id) ? { ...row, enabled: 1 } : row))
		);
	});

	it('gives nothing to a deleted role, nor to SUPER_ADMIN or ADMIN', async () => {
		await dataSource.runMigrations({ transaction: 'each' });

		for (const roleId of [DELETED_MANAGER_A, SUPER_ADMIN_A, ADMIN_A]) {
			expect(
				await dataSource.query('SELECT COUNT(*) AS "count" FROM "role_permission" WHERE "roleId" = ?', [roleId])
			).toEqual([{ count: 0 }]);
		}
	});

	it('changes nothing when it runs again', async () => {
		await dataSource.runMigrations({ transaction: 'each' });
		const once = await dataSource.query('SELECT * FROM "role_permission" ORDER BY "id"');

		const queryRunner = dataSource.createQueryRunner();
		await new GrantManagerTaskSettingAndAvailabilityPermissions1791000000841().up(queryRunner);
		await queryRunner.release();

		expect(await dataSource.query('SELECT * FROM "role_permission" ORDER BY "id"')).toEqual(once);
	});

	/**
	 * On an upgrade where a permission reload runs before this migration, the reload reads the defaults the deployed
	 * code carries (these four included for MANAGER) and writes each permission a role lacks. This runs the real reload
	 * and this migration, in their timestamp order, and checks every live manager still ends up holding the four,
	 * except the grant an administrator switched off and the one somebody deleted.
	 */
	it('after a permission reload in the same upgrade, still leaves every manager holding the four', async () => {
		await dataSource.destroy();
		const both = new DataSource({
			type: 'better-sqlite3',
			database: dbPath,
			migrations: [
				CoreRolePermissionsReload1791000000500,
				GrantManagerTaskSettingAndAvailabilityPermissions1791000000841
			],
			synchronize: false,
			logging: false
		});
		await both.initialize();
		try {
			const ran = await both.runMigrations({ transaction: 'each' });
			expect(ran.map((migration) => migration.name)).toEqual([
				'CoreRolePermissionsReload1791000000500',
				'GrantManagerTaskSettingAndAvailabilityPermissions1791000000841'
			]);

			const rows: GrantRow[] = await both.query(GRANTS_SQL);
			const of = (roleId: string) =>
				sorted(rows.filter((row) => row.roleId === roleId)).map(({ permission, enabled }) => [
					permission,
					enabled
				]);

			expect(of(MANAGER_A)).toEqual([
				['EMPLOYEE_AVAILABILITY_CREATE', 1],
				['EMPLOYEE_AVAILABILITY_UPDATE', 1],
				['ORG_TASK_SETTING', 0]
			]);
			expect(of(MANAGER_B)).toEqual([
				['EMPLOYEE_AVAILABILITY_CREATE', 1],
				['EMPLOYEE_AVAILABILITY_DELETE', 1],
				['EMPLOYEE_AVAILABILITY_UPDATE', 1],
				['ORG_TASK_SETTING', 1]
			]);
			// The viewers hold switched-off rows of the four and nothing more.
			expect(of(VIEWER_A).every(([, enabled]) => enabled === 0)).toBe(true);
		} finally {
			await both.destroy();
		}
	});
});
