import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { PermissionsEnum } from '@gauzy/contracts';
import { DEFAULT_ROLE_PERMISSIONS } from '../role-permission/default-role-permissions';
import { CoreRolePermissionsReload1791000000500 } from './migrations/1791000000500-CoreRolePermissionsReload';
import { GrantChangeSelectedOrganizationPermission1791000000861 } from './migrations/1791000000861-GrantChangeSelectedOrganizationPermission';

/**
 * After ever-co/ever-gauzy#11316 a non-admin works only in the organization of their access token and moves with
 * `POST /auth/switch-organization`, which requires `CHANGE_SELECTED_ORGANIZATION`. `MANAGER` and `VIEWER` did not hold
 * it, so a manager or viewer in two organizations was stuck in one. The migration grants it to those two roles in every
 * tenant, and to nobody else; a new tenant gets the same from `DEFAULT_ROLE_PERMISSIONS`.
 *
 * The grant is old: provisioning wrote a switched-off row of it for every `MANAGER` and `VIEWER` when the tenant was
 * created, inside the onboarding request (so carrying the onboarding user as `createdByUserId`). Such a row was never
 * changed, and is switched on. A row somebody changed (`updatedByUserId`) or deleted is that tenant's decision and
 * stays as it is.
 *
 * The SQLite branch runs for real on the `role_permission` DDL the migration chain leaves behind (the last SQLite
 * rebuild of the table plus the unique index), read from those migrations' sources so the fixture cannot drift from
 * the chain — the same fixture `manager-task-setting-availability-permissions-migration.spec.ts` builds.
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

const GRANT = 'CHANGE_SELECTED_ORGANIZATION';

const TENANT_A = 'a0000000-0000-4000-8000-000000000001';
const TENANT_B = 'a0000000-0000-4000-8000-000000000002';
const TENANT_C = 'a0000000-0000-4000-8000-000000000003';
const SUPER_ADMIN_A = 'b0000000-0000-4000-8000-000000000001';
const ADMIN_A = 'b0000000-0000-4000-8000-000000000002';
const MANAGER_A = 'b0000000-0000-4000-8000-000000000003';
const EMPLOYEE_A = 'b0000000-0000-4000-8000-000000000004';
const VIEWER_A = 'b0000000-0000-4000-8000-000000000005';
const CANDIDATE_A = 'b0000000-0000-4000-8000-000000000006';
const DELETED_VIEWER_A = 'b0000000-0000-4000-8000-000000000007';
const MANAGER_B = 'b0000000-0000-4000-8000-000000000008';
const VIEWER_B = 'b0000000-0000-4000-8000-000000000009';
const VIEWER_C = 'b0000000-0000-4000-8000-000000000010';
const ONBOARDING_USER = 'd0000000-0000-4000-8000-000000000001';
const ADMIN_USER = 'd0000000-0000-4000-8000-000000000002';

/** [roleId, tenantId, name, deletedAt] — the names the migration (and the permission reload) match by. */
const ROLES: Array<[string, string, string, string | null]> = [
	[SUPER_ADMIN_A, TENANT_A, 'SUPER_ADMIN', null],
	[ADMIN_A, TENANT_A, 'ADMIN', null],
	[MANAGER_A, TENANT_A, 'MANAGER', null],
	[EMPLOYEE_A, TENANT_A, 'EMPLOYEE', null],
	[VIEWER_A, TENANT_A, 'VIEWER', null],
	[CANDIDATE_A, TENANT_A, 'CANDIDATE', null],
	[DELETED_VIEWER_A, TENANT_A, 'VIEWER', '2026-01-01 00:00:00'],
	[MANAGER_B, TENANT_B, 'MANAGER', null],
	[VIEWER_B, TENANT_B, 'VIEWER', null],
	[VIEWER_C, TENANT_C, 'VIEWER', null]
];
const id = (n: number) => `c0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** [n, tenantId, roleId, permission, enabled, deletedAt, createdByUserId, updatedByUserId] */
const ROWS: Array<[number, string, string, string, number, string | null, string | null, string | null]> = [
	// Tenant A's manager: an administrator switched the grant off → left as it is
	[1, TENANT_A, MANAGER_A, GRANT, 0, null, ONBOARDING_USER, ADMIN_USER],
	// Tenant A's viewer: written off at provisioning, inside the onboarding request, never changed → switched on
	[2, TENANT_A, VIEWER_A, GRANT, 0, null, ONBOARDING_USER, null],
	// Tenant B's manager: written off by a permission reload, with no user at all → switched on
	[3, TENANT_B, MANAGER_B, GRANT, 0, null, null, null],
	// Tenant B's viewer has no row → inserted
	// Tenant C's viewer: the row was deleted by someone → left as it is, nothing written again
	[4, TENANT_C, VIEWER_C, GRANT, 0, '2026-01-01 00:00:00', ONBOARDING_USER, ADMIN_USER],
	// Other roles' rows → untouched: only MANAGER and VIEWER gain anything
	[5, TENANT_A, EMPLOYEE_A, GRANT, 1, null, ONBOARDING_USER, null],
	[6, TENANT_A, CANDIDATE_A, GRANT, 0, null, ONBOARDING_USER, null],
	// An unrelated grant of the manager → untouched
	[7, TENANT_A, MANAGER_A, 'ORG_EMPLOYEES_VIEW', 0, null, ONBOARDING_USER, null]
];

const GRANTS_SQL = `SELECT "tenantId", "roleId", "permission", "enabled" FROM "role_permission"
	WHERE "permission" = 'CHANGE_SELECTED_ORGANIZATION' AND "deletedAt" IS NULL`;

type GrantRow = { tenantId: string; roleId: string; permission: string; enabled: number };

const sorted = (rows: GrantRow[]) =>
	[...rows].sort((a, b) =>
		(a.tenantId + a.roleId + a.permission).localeCompare(b.tenantId + b.roleId + b.permission)
	);

describe('DEFAULT_ROLE_PERMISSIONS — a new tenant’s managers and viewers may switch among their organizations', () => {
	it('lists CHANGE_SELECTED_ORGANIZATION among the defaults of MANAGER and VIEWER', () => {
		for (const name of ['MANAGER', 'VIEWER']) {
			const role = DEFAULT_ROLE_PERMISSIONS.find(({ role }) => role === name);
			expect(role.defaultEnabledPermissions).toContain(PermissionsEnum.CHANGE_SELECTED_ORGANIZATION);
		}
	});

	it('gives it to every role but CANDIDATE and INTERVIEWER, as before plus MANAGER and VIEWER', () => {
		expect(
			DEFAULT_ROLE_PERMISSIONS.filter(({ defaultEnabledPermissions }) =>
				defaultEnabledPermissions.includes(PermissionsEnum.CHANGE_SELECTED_ORGANIZATION)
			)
				.map(({ role }) => role)
				.sort()
		).toEqual(['ADMIN', 'DATA_ENTRY', 'EMPLOYEE', 'MANAGER', 'SUPER_ADMIN', 'VIEWER']);
	});
});

describe('GrantChangeSelectedOrganizationPermission1791000000861 — managers and viewers may switch among their organizations', () => {
	let dataSource: DataSource;
	let dbPath: string;

	beforeEach(async () => {
		dbPath = path.join(
			os.tmpdir(),
			`gauzy-change-selected-organization-${process.pid}-${Date.now()}-${Math.random()}.sqlite3`
		);
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: dbPath,
			migrations: [GrantChangeSelectedOrganizationPermission1791000000861],
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
		await dataSource.query(`INSERT INTO "tenant" ("id", "name") VALUES (?, 'A'), (?, 'B'), (?, 'C')`, [
			TENANT_A,
			TENANT_B,
			TENANT_C
		]);
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

	it('gives every live MANAGER and VIEWER role the grant, keeps what someone decided, and nobody else gains', async () => {
		await dataSource.runMigrations({ transaction: 'each' });

		expect(sorted(await dataSource.query(GRANTS_SQL))).toEqual(
			sorted([
				// An administrator switched it off for tenant A's managers: kept off.
				{ tenantId: TENANT_A, roleId: MANAGER_A, permission: GRANT, enabled: 0 },
				// The provisioning and reload rows are switched on, the missing one inserted.
				{ tenantId: TENANT_A, roleId: VIEWER_A, permission: GRANT, enabled: 1 },
				{ tenantId: TENANT_B, roleId: MANAGER_B, permission: GRANT, enabled: 1 },
				{ tenantId: TENANT_B, roleId: VIEWER_B, permission: GRANT, enabled: 1 },
				// The other roles' rows, as they were. Tenant C's deleted row is neither restored nor written again.
				{ tenantId: TENANT_A, roleId: EMPLOYEE_A, permission: GRANT, enabled: 1 },
				{ tenantId: TENANT_A, roleId: CANDIDATE_A, permission: GRANT, enabled: 0 }
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
		const switchedOn = new Set([id(2), id(3)]);
		expect(after).toEqual(
			before.map((row: { id: string }) => (switchedOn.has(row.id) ? { ...row, enabled: 1 } : row))
		);
	});

	it('gives nothing to a deleted role, nor to SUPER_ADMIN or ADMIN', async () => {
		await dataSource.runMigrations({ transaction: 'each' });

		for (const roleId of [DELETED_VIEWER_A, SUPER_ADMIN_A, ADMIN_A]) {
			expect(
				await dataSource.query('SELECT COUNT(*) AS "count" FROM "role_permission" WHERE "roleId" = ?', [roleId])
			).toEqual([{ count: 0 }]);
		}
	});

	it('changes nothing when it runs again', async () => {
		await dataSource.runMigrations({ transaction: 'each' });
		const once = await dataSource.query('SELECT * FROM "role_permission" ORDER BY "id"');

		const queryRunner = dataSource.createQueryRunner();
		await new GrantChangeSelectedOrganizationPermission1791000000861().up(queryRunner);
		await queryRunner.release();

		expect(await dataSource.query('SELECT * FROM "role_permission" ORDER BY "id"')).toEqual(once);
	});

	it('leaves the database as it was on down()', async () => {
		await dataSource.runMigrations({ transaction: 'each' });
		const once = await dataSource.query('SELECT * FROM "role_permission" ORDER BY "id"');

		await dataSource.undoLastMigration({ transaction: 'each' });

		expect(await dataSource.query('SELECT * FROM "role_permission" ORDER BY "id"')).toEqual(once);
	});

	/**
	 * On an upgrade where a permission reload runs before this migration, the reload reads the defaults the deployed
	 * code carries (this grant included for MANAGER and VIEWER) and writes each permission a role lacks. This runs the
	 * real reload and this migration, in their timestamp order, and checks every live manager and viewer ends up
	 * holding the grant, except the one an administrator switched off and the one somebody deleted.
	 */
	it('after a permission reload in the same upgrade, still leaves every manager and viewer holding it', async () => {
		await dataSource.destroy();
		const both = new DataSource({
			type: 'better-sqlite3',
			database: dbPath,
			migrations: [
				CoreRolePermissionsReload1791000000500,
				GrantChangeSelectedOrganizationPermission1791000000861
			],
			synchronize: false,
			logging: false
		});
		await both.initialize();
		try {
			const ran = await both.runMigrations({ transaction: 'each' });
			expect(ran.map((migration) => migration.name)).toEqual([
				'CoreRolePermissionsReload1791000000500',
				'GrantChangeSelectedOrganizationPermission1791000000861'
			]);

			const rows: GrantRow[] = await both.query(GRANTS_SQL);
			const of = (roleId: string) => rows.filter((row) => row.roleId === roleId).map(({ enabled }) => enabled);

			expect(of(MANAGER_A)).toEqual([0]);
			expect(of(VIEWER_A)).toEqual([1]);
			expect(of(MANAGER_B)).toEqual([1]);
			expect(of(VIEWER_B)).toEqual([1]);
			expect(of(VIEWER_C)).toEqual([]);
			// The candidate keeps its switched-off row; the employee keeps its default.
			expect(of(CANDIDATE_A)).toEqual([0]);
			expect(of(EMPLOYEE_A)).toEqual([1]);
		} finally {
			await both.destroy();
		}
	});
});
