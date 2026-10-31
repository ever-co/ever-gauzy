import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { CoreRolePermissionsReload1791000000500 } from './migrations/1791000000500-CoreRolePermissionsReload';
import { GrantOrganizationContactAddDeletePermissions1791000003870 } from './migrations/1791000003870-GrantOrganizationContactAddDeletePermissions';

/**
 * `ORG_CONTACT_ADD` and `ORG_CONTACT_DELETE` are new (ever-co/ever-gauzy#5468). The routes accept them beside
 * `ORG_CONTACT_EDIT`, so no editor loses anything without this migration; it writes the rows so the roles screen
 * shows both grants on for every role that edits contacts today, and so that switching the edit grant off later
 * leaves create and delete as the tenant had them. The new grants go to exactly the live holders of the edit grant,
 * tenant by tenant, and to nobody else.
 *
 * The SQLite branch runs for real on the `role_permission` DDL the migration chain leaves behind, read from those
 * migrations' sources so the fixture cannot drift from the chain (the fixture of
 * `custom-smtp-edit-permission-migration.spec.ts`).
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

/** [roleId, tenantId, name]: the names the permission reload matches defaults by. */
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
	[1, TENANT_A, ADMIN_A, 'ORG_CONTACT_EDIT', 1, 0, null, null], // default holder → gains both grants
	[2, TENANT_A, MANAGER_A, 'ORG_CONTACT_EDIT', 1, 0, null, null], // a tenant's own grant → gains them too
	[3, TENANT_A, EMPLOYEE_A, 'ORG_CONTACT_EDIT', 0, 0, null, null], // switched off → gains nothing
	[4, TENANT_A, ARCHIVED_A, 'ORG_CONTACT_EDIT', 1, 1, null, null], // archived grant grants nothing → nothing
	[5, TENANT_A, DELETED_A, 'ORG_CONTACT_EDIT', 1, 0, '2026-01-01 00:00:00', null], // deleted → nothing
	[6, TENANT_A, DECIDED_A, 'ORG_CONTACT_EDIT', 1, 0, null, null],
	[7, TENANT_A, DECIDED_A, 'ORG_CONTACT_DELETE', 0, 0, null, ADMIN_USER], // an administrator switched it off → kept
	[8, TENANT_B, ADMIN_B, 'ORG_CONTACT_EDIT', 1, 0, null, null], // another tenant's holder → gains them in its tenant
	[9, TENANT_A, EMPLOYEE_A, 'ORG_CONTACT_VIEW', 1, 0, null, null], // the read grant alone → nothing
	[10, TENANT_A, RELOADED_A, 'ORG_CONTACT_EDIT', 1, 0, null, null],
	[11, TENANT_A, RELOADED_A, 'ORG_CONTACT_ADD', 0, 0, null, null] // written off by a reload, nobody decided → switched on
];

const grantsSql = (permission: string) =>
	`SELECT "tenantId", "roleId", "enabled" FROM "role_permission" WHERE "permission" = '${permission}' ORDER BY "tenantId", "roleId"`;

const byRole = (rows: Array<{ tenantId: string; roleId: string; enabled: number }>) =>
	[...rows].sort((a, b) => (a.tenantId + a.roleId).localeCompare(b.tenantId + b.roleId));

describe('GrantOrganizationContactAddDeletePermissions1791000003870: the new grants go to exactly the edit grant’s holders', () => {
	let dataSource: DataSource;
	let dbPath: string;

	beforeEach(async () => {
		dbPath = path.join(
			os.tmpdir(),
			`gauzy-contact-add-delete-${process.pid}-${Date.now()}-${Math.random()}.sqlite3`
		);
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: dbPath,
			migrations: [GrantOrganizationContactAddDeletePermissions1791000003870],
			synchronize: false,
			logging: false
		});
		await dataSource.initialize();

		const { table, indexes } = currentSqliteRolePermissionSchema();
		await dataSource.query('CREATE TABLE "tenant" ("id" varchar PRIMARY KEY NOT NULL, "name" varchar)');
		await dataSource.query(
			'CREATE TABLE "role" ("id" varchar PRIMARY KEY NOT NULL, "name" varchar, "tenantId" varchar)'
		);
		await dataSource.query('CREATE TABLE "user" ("id" varchar PRIMARY KEY NOT NULL)');
		await dataSource.query(`INSERT INTO "tenant" ("id", "name") VALUES (?, 'A'), (?, 'B')`, [TENANT_A, TENANT_B]);
		await dataSource.query('INSERT INTO "user" ("id") VALUES (?)', [ADMIN_USER]);
		for (const [role, tenant, name] of ROLES) {
			await dataSource.query('INSERT INTO "role" ("id", "tenantId", "name") VALUES (?, ?, ?)', [
				role,
				tenant,
				name
			]);
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

	it('grants ORG_CONTACT_ADD, enabled, to every live holder of ORG_CONTACT_EDIT in its own tenant, and to nobody else', async () => {
		await dataSource.runMigrations({ transaction: 'each' });

		expect(byRole(await dataSource.query(grantsSql('ORG_CONTACT_ADD')))).toEqual(
			byRole([
				{ tenantId: TENANT_A, roleId: ADMIN_A, enabled: 1 },
				{ tenantId: TENANT_A, roleId: MANAGER_A, enabled: 1 },
				{ tenantId: TENANT_A, roleId: DECIDED_A, enabled: 1 },
				{ tenantId: TENANT_A, roleId: RELOADED_A, enabled: 1 },
				{ tenantId: TENANT_B, roleId: ADMIN_B, enabled: 1 }
			])
		);
	});

	it('grants ORG_CONTACT_DELETE the same way, keeping the row an administrator switched off', async () => {
		await dataSource.runMigrations({ transaction: 'each' });

		expect(byRole(await dataSource.query(grantsSql('ORG_CONTACT_DELETE')))).toEqual(
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
		const once = [
			await dataSource.query(grantsSql('ORG_CONTACT_ADD')),
			await dataSource.query(grantsSql('ORG_CONTACT_DELETE'))
		];

		const queryRunner = dataSource.createQueryRunner();
		await new GrantOrganizationContactAddDeletePermissions1791000003870().up(queryRunner);
		await queryRunner.release();

		expect([
			await dataSource.query(grantsSql('ORG_CONTACT_ADD')),
			await dataSource.query(grantsSql('ORG_CONTACT_DELETE'))
		]).toEqual(once);
	});

	it('skips a grant another process inserted after its read, keeping that row as it was', async () => {
		const queryRunner = dataSource.createQueryRunner();
		const query = queryRunner.query.bind(queryRunner);
		let raced = false;
		jest.spyOn(queryRunner, 'query').mockImplementation(async (sql: string, parameters?: unknown[]) => {
			if (!raced && /^\s*INSERT/i.test(sql)) {
				raced = true;
				// Another API process grants ORG_CONTACT_ADD to ADMIN_A, switched off, between the read and the insert.
				await query(
					`INSERT INTO "role_permission" ("id", "tenantId", "roleId", "permission", "enabled", "isActive", "isArchived")
					VALUES (?, ?, ?, 'ORG_CONTACT_ADD', 0, 1, 0)`,
					[id(900), TENANT_A, ADMIN_A]
				);
			}
			return query(sql, parameters);
		});

		await new GrantOrganizationContactAddDeletePermissions1791000003870().up(queryRunner);
		await queryRunner.release();

		expect(raced).toBe(true);
		const adminAdd = await dataSource.query(
			`SELECT "id", "enabled" FROM "role_permission" WHERE "tenantId" = ? AND "roleId" = ? AND "permission" = 'ORG_CONTACT_ADD'`,
			[TENANT_A, ADMIN_A]
		);
		expect(adminAdd).toEqual([{ id: id(900), enabled: 0 }]);
		// Every other holder still gets the grant.
		expect(byRole(await dataSource.query(grantsSql('ORG_CONTACT_ADD')))).toEqual(
			byRole([
				{ tenantId: TENANT_A, roleId: ADMIN_A, enabled: 0 },
				{ tenantId: TENANT_A, roleId: MANAGER_A, enabled: 1 },
				{ tenantId: TENANT_A, roleId: DECIDED_A, enabled: 1 },
				{ tenantId: TENANT_A, roleId: RELOADED_A, enabled: 1 },
				{ tenantId: TENANT_B, roleId: ADMIN_B, enabled: 1 }
			])
		);
	});

	it('writes in batches, not one statement per role, as it runs before the API starts', async () => {
		// 600 more tenant roles that edit contacts, each with a reload-written switched-off ORG_CONTACT_DELETE row.
		const HOLDERS = 600;
		for (let n = 0; n < HOLDERS; n++) {
			const role = `e0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
			await dataSource.query('INSERT INTO "role" ("id", "tenantId", "name") VALUES (?, ?, ?)', [
				role,
				TENANT_B,
				`CUSTOM_${n}`
			]);
			await dataSource.query(
				`INSERT INTO "role_permission" ("id", "tenantId", "roleId", "permission", "enabled", "isActive", "isArchived")
				VALUES (?, ?, ?, 'ORG_CONTACT_EDIT', 1, 1, 0), (?, ?, ?, 'ORG_CONTACT_DELETE', 0, 1, 0)`,
				[id(1000 + 2 * n), TENANT_B, role, id(1001 + 2 * n), TENANT_B, role]
			);
		}
		const queryRunner = dataSource.createQueryRunner();
		const query = jest.spyOn(queryRunner, 'query');

		await new GrantOrganizationContactAddDeletePermissions1791000003870().up(queryRunner);
		await queryRunner.release();

		const statements = query.mock.calls.map(([sql]) => String(sql).trim().split(/\s+/)[0].toUpperCase());
		// One read of the holders, one of each grant's rows, and the writes of 600+ rows each way in a few batches.
		expect(statements.filter((verb) => verb === 'SELECT')).toHaveLength(3);
		expect(statements.filter((verb) => verb === 'INSERT').length).toBeLessThanOrEqual(3);
		expect(statements.filter((verb) => verb === 'UPDATE').length).toBeLessThanOrEqual(2);

		const granted = await dataSource.query(
			`SELECT "permission", COUNT(*) AS "roles" FROM "role_permission"
			WHERE "permission" IN ('ORG_CONTACT_ADD', 'ORG_CONTACT_DELETE') AND "enabled" = 1 AND "tenantId" = ?
			GROUP BY "permission" ORDER BY "permission"`,
			[TENANT_B]
		);
		expect(granted).toEqual([
			{ permission: 'ORG_CONTACT_ADD', roles: HOLDERS + 1 },
			{ permission: 'ORG_CONTACT_DELETE', roles: HOLDERS + 1 }
		]);
	});

	/**
	 * On an upgrade where a permission reload runs before this migration, the reload reads the enum the deployed code
	 * carries (the new grants included) and writes them for every role, switched on only for the role's defaults. A
	 * role a tenant granted the edit grant to would then hold switched-off rows before this migration looks. This runs
	 * the real reload and this migration, in their timestamp order.
	 */
	it('after a permission reload in the same upgrade, still switches both grants on for every holder of the edit grant', async () => {
		await dataSource.destroy();
		const both = new DataSource({
			type: 'better-sqlite3',
			database: dbPath,
			migrations: [
				CoreRolePermissionsReload1791000000500,
				GrantOrganizationContactAddDeletePermissions1791000003870
			],
			synchronize: false,
			logging: false
		});
		await both.initialize();
		try {
			const ran = await both.runMigrations({ transaction: 'each' });
			expect(ran.map((migration) => migration.name)).toEqual([
				'CoreRolePermissionsReload1791000000500',
				'GrantOrganizationContactAddDeletePermissions1791000003870'
			]);

			const expected = (decided: number) =>
				byRole([
					// ADMIN holds the edit grant by default: the reload writes the new grants switched on.
					{ tenantId: TENANT_A, roleId: ADMIN_A, enabled: 1 },
					// MANAGER holds it by the tenant's own choice: the reload writes them off, this migration switches them on.
					{ tenantId: TENANT_A, roleId: MANAGER_A, enabled: 1 },
					// Roles that do not hold the edit grant keep the reload's switched-off rows.
					{ tenantId: TENANT_A, roleId: EMPLOYEE_A, enabled: 0 },
					{ tenantId: TENANT_A, roleId: ARCHIVED_A, enabled: 0 },
					{ tenantId: TENANT_A, roleId: DELETED_A, enabled: 0 },
					{ tenantId: TENANT_A, roleId: DECIDED_A, enabled: decided },
					{ tenantId: TENANT_A, roleId: RELOADED_A, enabled: 1 },
					{ tenantId: TENANT_B, roleId: ADMIN_B, enabled: 1 }
				]);

			expect(byRole(await both.query(grantsSql('ORG_CONTACT_ADD')))).toEqual(expected(1));
			// An administrator's decision is kept.
			expect(byRole(await both.query(grantsSql('ORG_CONTACT_DELETE')))).toEqual(expected(0));
		} finally {
			await both.destroy();
		}
	});
});
