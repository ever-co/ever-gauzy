import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { PermissionsEnum } from '@gauzy/contracts';
import { DEFAULT_ROLE_PERMISSIONS } from '../role-permission/default-role-permissions';
import { CoreRolePermissionsReload1791000000500 } from './migrations/1791000000500-CoreRolePermissionsReload';
import { GrantGoalsSkillsEventTypesEditPermissions1791000000821 } from './migrations/1791000000821-GrantGoalsSkillsEventTypesEditPermissions';

/**
 * `GOALS_EDIT`, `SKILLS_EDIT` and `EVENT_TYPES_EDIT` are new, and the goal, skill and event-type routes now require
 * them. A tenant provisioned before they exist has no row for them, so without this migration its administrators and
 * managers would be refused tomorrow. The migration grants the three to the `SUPER_ADMIN`, `ADMIN` and `MANAGER` roles
 * of every tenant (owner decision 2, 2026-10-22), and to nobody else.
 *
 * The SQLite branch runs for real on the `role_permission` DDL the migration chain leaves behind (the last SQLite
 * rebuild of the table plus the unique index), read from those migrations' sources so the fixture cannot drift from
 * the chain — the same fixture `custom-smtp-edit-permission-migration.spec.ts` builds.
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

const GRANTS = ['GOALS_EDIT', 'SKILLS_EDIT', 'EVENT_TYPES_EDIT'];

const TENANT_A = 'a0000000-0000-4000-8000-000000000001';
const TENANT_B = 'a0000000-0000-4000-8000-000000000002';
const SUPER_ADMIN_A = 'b0000000-0000-4000-8000-000000000001';
const ADMIN_A = 'b0000000-0000-4000-8000-000000000002';
const MANAGER_A = 'b0000000-0000-4000-8000-000000000003';
const EMPLOYEE_A = 'b0000000-0000-4000-8000-000000000004';
const VIEWER_A = 'b0000000-0000-4000-8000-000000000005';
const DELETED_MANAGER_A = 'b0000000-0000-4000-8000-000000000006';
const ADMIN_B = 'b0000000-0000-4000-8000-000000000007';
const MANAGER_B = 'b0000000-0000-4000-8000-000000000008';
const ADMIN_USER = 'd0000000-0000-4000-8000-000000000001';

/** [roleId, tenantId, name, deletedAt] — the names the migration (and the permission reload) match by. */
const ROLES: Array<[string, string, string, string | null]> = [
	[SUPER_ADMIN_A, TENANT_A, 'SUPER_ADMIN', null],
	[ADMIN_A, TENANT_A, 'ADMIN', null],
	[MANAGER_A, TENANT_A, 'MANAGER', null],
	[EMPLOYEE_A, TENANT_A, 'EMPLOYEE', null],
	[VIEWER_A, TENANT_A, 'VIEWER', null],
	[DELETED_MANAGER_A, TENANT_A, 'MANAGER', '2026-01-01 00:00:00'],
	[ADMIN_B, TENANT_B, 'ADMIN', null],
	[MANAGER_B, TENANT_B, 'MANAGER', null]
];
const id = (n: number) => `c0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** [n, tenantId, roleId, permission, enabled, deletedAt, updatedByUserId] */
const ROWS: Array<[number, string, string, string, number, string | null, string | null]> = [
	[1, TENANT_A, ADMIN_A, 'GOALS_EDIT', 0, null, ADMIN_USER], // an administrator switched it off → left as it is
	[2, TENANT_A, MANAGER_A, 'SKILLS_EDIT', 0, null, null], // written off by a reload, nobody decided → switched on
	[3, TENANT_A, MANAGER_A, 'EVENT_TYPES_EDIT', 0, '2026-01-01 00:00:00', ADMIN_USER], // deleted by someone → left as it is
	[4, TENANT_A, EMPLOYEE_A, 'GOALS_EDIT', 1, null, ADMIN_USER], // a tenant's own grant to another role → left as it is
	[5, TENANT_A, ADMIN_A, 'ORG_EMPLOYEES_VIEW', 1, null, null] // an unrelated grant → untouched
];

const GRANTS_SQL = `SELECT "tenantId", "roleId", "permission", "enabled" FROM "role_permission"
	WHERE "permission" IN ('GOALS_EDIT', 'SKILLS_EDIT', 'EVENT_TYPES_EDIT') AND "deletedAt" IS NULL`;

type GrantRow = { tenantId: string; roleId: string; permission: string; enabled: number };

const sorted = (rows: GrantRow[]) =>
	[...rows].sort((a, b) =>
		(a.tenantId + a.roleId + a.permission).localeCompare(b.tenantId + b.roleId + b.permission)
	);

/** All three grants, switched on, for one role. */
const allOn = (tenantId: string, roleId: string): GrantRow[] =>
	GRANTS.map((permission) => ({ tenantId, roleId, permission, enabled: 1 }));

describe('DEFAULT_ROLE_PERMISSIONS — a new tenant gets the same three grants', () => {
	it('lists the three grants as the defaults of SUPER_ADMIN, ADMIN and MANAGER, so a new tenant gets the same', () => {
		const holders = (permission: PermissionsEnum) =>
			DEFAULT_ROLE_PERMISSIONS.filter(({ defaultEnabledPermissions }) =>
				defaultEnabledPermissions.includes(permission)
			)
				.map(({ role }) => role)
				.sort();

		for (const permission of GRANTS as PermissionsEnum[]) {
			expect(holders(permission)).toEqual(['ADMIN', 'MANAGER', 'SUPER_ADMIN']);
		}
	});
});

describe('GrantGoalsSkillsEventTypesEditPermissions1791000000821 — the new write grants go to administrators and managers', () => {
	let dataSource: DataSource;
	let dbPath: string;

	beforeEach(async () => {
		dbPath = path.join(
			os.tmpdir(),
			`gauzy-goals-skills-event-types-${process.pid}-${Date.now()}-${Math.random()}.sqlite3`
		);
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: dbPath,
			migrations: [GrantGoalsSkillsEventTypesEditPermissions1791000000821],
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
		await dataSource.query(
			`CREATE UNIQUE INDEX "IDX_role_permission_unique" ON "role_permission" ("tenantId", "roleId", "permission")`
		);
		for (const [n, tenantId, roleId, permission, enabled, deletedAt, updatedByUserId] of ROWS) {
			await dataSource.query(
				`INSERT INTO "role_permission" ("id", "tenantId", "roleId", "permission", "enabled", "isActive", "isArchived", "deletedAt", "updatedByUserId")
				VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?)`,
				[id(n), tenantId, roleId, permission, enabled, deletedAt, updatedByUserId]
			);
		}
	});

	afterEach(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
		fs.rmSync(dbPath, { force: true });
	});

	it('grants the three, switched on, to every live SUPER_ADMIN, ADMIN and MANAGER role in its own tenant, and to nobody else', async () => {
		await dataSource.runMigrations({ transaction: 'each' });

		expect(sorted(await dataSource.query(GRANTS_SQL))).toEqual(
			sorted([
				...allOn(TENANT_A, SUPER_ADMIN_A),
				// An administrator switched GOALS_EDIT off for this role: kept off; the other two are new.
				{ tenantId: TENANT_A, roleId: ADMIN_A, permission: 'GOALS_EDIT', enabled: 0 },
				{ tenantId: TENANT_A, roleId: ADMIN_A, permission: 'SKILLS_EDIT', enabled: 1 },
				{ tenantId: TENANT_A, roleId: ADMIN_A, permission: 'EVENT_TYPES_EDIT', enabled: 1 },
				// SKILLS_EDIT was written off by a reload and switched on; EVENT_TYPES_EDIT was deleted by someone, so
				// it is neither restored nor written again (the deleted row is filtered out of this read).
				{ tenantId: TENANT_A, roleId: MANAGER_A, permission: 'GOALS_EDIT', enabled: 1 },
				{ tenantId: TENANT_A, roleId: MANAGER_A, permission: 'SKILLS_EDIT', enabled: 1 },
				// The tenant's own grant to the employees, untouched; the employees gain nothing else.
				{ tenantId: TENANT_A, roleId: EMPLOYEE_A, permission: 'GOALS_EDIT', enabled: 1 },
				...allOn(TENANT_B, ADMIN_B),
				...allOn(TENANT_B, MANAGER_B)
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
		expect(after).toEqual(before.map((row: { id: string }) => (row.id === id(2) ? { ...row, enabled: 1 } : row)));
	});

	it('gives nothing to a deleted role', async () => {
		await dataSource.runMigrations({ transaction: 'each' });

		expect(
			await dataSource.query('SELECT COUNT(*) AS "count" FROM "role_permission" WHERE "roleId" = ?', [
				DELETED_MANAGER_A
			])
		).toEqual([{ count: 0 }]);
	});

	it('changes nothing when it runs again', async () => {
		await dataSource.runMigrations({ transaction: 'each' });
		const once = await dataSource.query('SELECT * FROM "role_permission" ORDER BY "id"');

		const queryRunner = dataSource.createQueryRunner();
		await new GrantGoalsSkillsEventTypesEditPermissions1791000000821().up(queryRunner);
		await queryRunner.release();

		expect(await dataSource.query('SELECT * FROM "role_permission" ORDER BY "id"')).toEqual(once);
	});

	/**
	 * On an upgrade where a permission reload runs before this migration, the reload reads the enum and the defaults the
	 * deployed code carries — these three included — and writes each of them for every role, switched on only for the
	 * role's defaults. This runs the real reload (`CoreRolePermissionsReload1791000000500`) and this migration, in their
	 * timestamp order, and checks the administrators and managers still end up holding all three.
	 */
	it('after a permission reload in the same upgrade, still leaves every administrator and manager holding the three', async () => {
		await dataSource.destroy();
		const both = new DataSource({
			type: 'better-sqlite3',
			database: dbPath,
			migrations: [
				CoreRolePermissionsReload1791000000500,
				GrantGoalsSkillsEventTypesEditPermissions1791000000821
			],
			synchronize: false,
			logging: false
		});
		await both.initialize();
		try {
			const ran = await both.runMigrations({ transaction: 'each' });
			expect(ran.map((migration) => migration.name)).toEqual([
				'CoreRolePermissionsReload1791000000500',
				'GrantGoalsSkillsEventTypesEditPermissions1791000000821'
			]);

			const rows: GrantRow[] = await both.query(GRANTS_SQL);
			const of = (roleId: string) =>
				sorted(rows.filter((row) => row.roleId === roleId)).map(({ permission, enabled }) => [
					permission,
					enabled
				]);

			expect(of(SUPER_ADMIN_A)).toEqual([
				['EVENT_TYPES_EDIT', 1],
				['GOALS_EDIT', 1],
				['SKILLS_EDIT', 1]
			]);
			// The administrator's decision on GOALS_EDIT is kept.
			expect(of(ADMIN_A)).toEqual([
				['EVENT_TYPES_EDIT', 1],
				['GOALS_EDIT', 0],
				['SKILLS_EDIT', 1]
			]);
			expect(of(MANAGER_A)).toEqual([
				['GOALS_EDIT', 1],
				['SKILLS_EDIT', 1]
			]);
			expect(of(ADMIN_B)).toEqual([
				['EVENT_TYPES_EDIT', 1],
				['GOALS_EDIT', 1],
				['SKILLS_EDIT', 1]
			]);
			expect(of(MANAGER_B)).toEqual([
				['EVENT_TYPES_EDIT', 1],
				['GOALS_EDIT', 1],
				['SKILLS_EDIT', 1]
			]);
			// The viewers hold the reload's switched-off rows and nothing more.
			expect(of(VIEWER_A).every(([, enabled]) => enabled === 0)).toBe(true);
		} finally {
			await both.destroy();
		}
	});
});
