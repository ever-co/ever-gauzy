import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource } from 'typeorm';
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
const id = (n: number) => `c0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** [n, tenantId, roleId, permission, enabled, isArchived, deletedAt] */
const ROWS: Array<[number, string, string, string, number, number, string | null]> = [
	[1, TENANT_A, ADMIN_A, 'CUSTOM_SMTP_VIEW', 1, 0, null], // default holder → gains the edit grant
	[2, TENANT_A, MANAGER_A, 'CUSTOM_SMTP_VIEW', 1, 0, null], // a tenant's own grant → gains it too
	[3, TENANT_A, EMPLOYEE_A, 'CUSTOM_SMTP_VIEW', 0, 0, null], // switched off → gains nothing
	[4, TENANT_A, ARCHIVED_A, 'CUSTOM_SMTP_VIEW', 1, 1, null], // archived grant grants nothing → nothing
	[5, TENANT_A, DELETED_A, 'CUSTOM_SMTP_VIEW', 1, 0, '2026-01-01 00:00:00'], // deleted → nothing
	[6, TENANT_A, DECIDED_A, 'CUSTOM_SMTP_VIEW', 1, 0, null],
	[7, TENANT_A, DECIDED_A, 'CUSTOM_SMTP_EDIT', 0, 0, null], // the tenant already decided → left as it is
	[8, TENANT_B, ADMIN_B, 'CUSTOM_SMTP_VIEW', 1, 0, null], // another tenant's holder → gains it in its tenant
	[9, TENANT_A, ADMIN_A, 'ORG_EMPLOYEES_VIEW', 1, 0, null] // an unrelated grant → untouched
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
		for (const referenced of ['tenant', 'role', 'user']) {
			await dataSource.query(`CREATE TABLE "${referenced}" ("id" varchar PRIMARY KEY NOT NULL)`);
		}
		await dataSource.query(`INSERT INTO "tenant" ("id") VALUES (?), (?)`, [TENANT_A, TENANT_B]);
		for (const role of [ADMIN_A, MANAGER_A, EMPLOYEE_A, ARCHIVED_A, DELETED_A, DECIDED_A, ADMIN_B]) {
			await dataSource.query(`INSERT INTO "role" ("id") VALUES (?)`, [role]);
		}
		await dataSource.query(table);
		for (const index of indexes) {
			await dataSource.query(index);
		}
		await dataSource.query(
			`CREATE UNIQUE INDEX "IDX_role_permission_unique" ON "role_permission" ("tenantId", "roleId", "permission")`
		);
		for (const [n, tenantId, roleId, permission, enabled, isArchived, deletedAt] of ROWS) {
			await dataSource.query(
				`INSERT INTO "role_permission" ("id", "tenantId", "roleId", "permission", "enabled", "isActive", "isArchived", "deletedAt")
				VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
				[id(n), tenantId, roleId, permission, enabled, isArchived, deletedAt]
			);
		}
	});

	afterEach(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
		fs.rmSync(dbPath, { force: true });
	});

	it('grants CUSTOM_SMTP_EDIT, enabled, to every live holder of CUSTOM_SMTP_VIEW in its own tenant, and to nobody else', async () => {
		await dataSource.runMigrations({ transaction: 'each' });

		expect(await dataSource.query(EDIT_GRANTS_SQL)).toEqual(
			[
				{ tenantId: TENANT_A, roleId: ADMIN_A, enabled: 1 },
				{ tenantId: TENANT_A, roleId: MANAGER_A, enabled: 1 },
				{ tenantId: TENANT_A, roleId: DECIDED_A, enabled: 0 },
				{ tenantId: TENANT_B, roleId: ADMIN_B, enabled: 1 }
			].sort((a, b) => (a.tenantId + a.roleId).localeCompare(b.tenantId + b.roleId))
		);
	});

	it('leaves every row it found exactly as it found it', async () => {
		const before = await dataSource.query(`SELECT * FROM "role_permission" ORDER BY "id"`);

		await dataSource.runMigrations({ transaction: 'each' });

		const after = await dataSource.query(`SELECT * FROM "role_permission" WHERE "id" IN (${ROWS.map(() => '?').join(', ')}) ORDER BY "id"`, ROWS.map(([n]) => id(n)));
		expect(after).toEqual(before);
	});

	it('changes nothing when it runs again', async () => {
		await dataSource.runMigrations({ transaction: 'each' });
		const once = await dataSource.query(EDIT_GRANTS_SQL);

		const queryRunner = dataSource.createQueryRunner();
		await new GrantCustomSmtpEditPermission1791000000573().up(queryRunner);
		await queryRunner.release();

		expect(await dataSource.query(EDIT_GRANTS_SQL)).toEqual(once);
	});
});
