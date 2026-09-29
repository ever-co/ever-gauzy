// cspell:words SAVEPOINT KEYNAME
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { AddRolePermissionUniqueIndex1790000017000 } from './migrations/1790000017000-AddRolePermissionUniqueIndex';

/**
 * `role_permission` becomes unique on (tenantId, roleId, permission), after its duplicates are
 * removed without taking a permission away from any role.
 *
 * The SQLite branch runs for real, on the `role_permission` DDL the migration chain leaves behind
 * (the last SQLite rebuild of the table, in the `deletedByUserId` migration), read from that
 * migration's source so the fixture cannot drift from the chain. MySQL and Postgres need a server,
 * so their branches run against stub query runners that check the statements issued and simulate
 * what the server answers; the Postgres branch was also run against a real PostgreSQL 16.
 */
const LAST_SQLITE_ROLE_PERMISSION_MIGRATION = '1740811220961-AlterBaseEntityAddDeletedByUserIdColumn.ts';
const INDEX = 'IDX_role_permission_unique';

/** The `role_permission` CREATE TABLE and its indexes exactly as the migration chain leaves them. */
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
const ROLE_A = 'b0000000-0000-4000-8000-000000000001';
const ROLE_B = 'b0000000-0000-4000-8000-000000000002';
const id = (n: number) => `c0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** [id, tenantId, roleId, permission, enabled, isActive, isArchived, deletedAt, createdAt] */
type Row = [number, string | null, string, string, number | null, number, number, string | null, string];

/**
 * One duplicate group per rule of the order the migration keeps rows in, plus rows it must not
 * touch. `KEPT` lists the one row each group must end with.
 */
const ROWS: Row[] = [
	// Only the NEWEST of three copies is enabled: keep it, or the role loses the permission.
	[1, TENANT_A, ROLE_A, 'P1', 0, 1, 0, null, '2026-01-01 00:00:00'],
	[2, TENANT_A, ROLE_A, 'P1', 0, 1, 0, null, '2026-01-02 00:00:00'],
	[3, TENANT_A, ROLE_A, 'P1', 1, 1, 0, null, '2026-01-03 00:00:00'],
	// Nothing enabled: keep the oldest.
	[5, TENANT_A, ROLE_A, 'P2', 0, 1, 0, null, '2026-02-02 00:00:00'],
	[4, TENANT_A, ROLE_A, 'P2', 0, 1, 0, null, '2026-02-01 00:00:00'],
	// An older ARCHIVED enabled row grants nothing; the live enabled one does.
	[6, TENANT_A, ROLE_A, 'P3', 1, 1, 1, null, '2026-03-01 00:00:00'],
	[7, TENANT_A, ROLE_A, 'P3', 1, 1, 0, null, '2026-03-02 00:00:00'],
	// An older SOFT-DELETED enabled row is invisible to the app; keep the row it can see.
	[8, TENANT_A, ROLE_A, 'P4', 1, 1, 0, '2026-04-05 00:00:00', '2026-04-01 00:00:00'],
	[9, TENANT_A, ROLE_A, 'P4', 0, 1, 0, null, '2026-04-02 00:00:00'],
	// Same createdAt: keep the smallest id.
	[11, TENANT_A, ROLE_A, 'P5', 1, 1, 0, null, '2026-05-01 00:00:00'],
	[10, TENANT_A, ROLE_A, 'P5', 1, 1, 0, null, '2026-05-01 00:00:00'],
	// An older INACTIVE enabled row grants nothing; the active one does.
	[12, TENANT_A, ROLE_A, 'P6', 1, 0, 0, null, '2026-06-01 00:00:00'],
	[13, TENANT_A, ROLE_A, 'P6', 1, 1, 0, null, '2026-06-02 00:00:00'],
	// Not duplicates: same permission for another role, and in another tenant.
	[20, TENANT_A, ROLE_B, 'P1', 0, 1, 0, null, '2026-01-01 00:00:00'],
	[21, TENANT_B, ROLE_A, 'P1', 1, 1, 0, null, '2026-01-01 00:00:00'],
	// A NULL tenant never violates a unique index, so these copies stay.
	[30, null, ROLE_A, 'P1', 0, 1, 0, null, '2026-01-01 00:00:00'],
	[31, null, ROLE_A, 'P1', 0, 1, 0, null, '2026-01-02 00:00:00']
];
const KEPT = [3, 4, 7, 9, 10, 13, 20, 21, 30, 31].map(id).sort();

/** Permissions a role is actually granted: what `RolePermissionService.checkRolePermission` counts. */
const GRANTS_SQL = `SELECT DISTINCT "tenantId", "roleId", "permission" FROM "role_permission"
	WHERE "enabled" = 1 AND "isActive" = 1 AND "isArchived" = 0 AND "deletedAt" IS NULL
	ORDER BY "tenantId", "roleId", "permission"`;

describe('AddRolePermissionUniqueIndex (SQLite)', () => {
	let dbPath: string;
	let dataSource: DataSource;

	const insert = (tenantId: string | null, roleId: string, permission: string, rowId: string) =>
		dataSource.query(
			`INSERT INTO "role_permission" ("id", "tenantId", "roleId", "permission") VALUES (?, ?, ?, ?)`,
			[rowId, tenantId, roleId, permission]
		);

	const indexNames = async (): Promise<string[]> =>
		(
			await dataSource.query(
				`SELECT "name" FROM "sqlite_master" WHERE "type" = 'index' AND "tbl_name" = 'role_permission' AND "sql" IS NOT NULL ORDER BY "name"`
			)
		).map((index: { name: string }) => index.name);

	const ids = async (): Promise<string[]> =>
		(await dataSource.query(`SELECT "id" FROM "role_permission" ORDER BY "id"`)).map(
			(row: { id: string }) => row.id
		);

	beforeEach(async () => {
		dbPath = path.join(
			os.tmpdir(),
			`gauzy-role-permission-unique-${process.pid}-${Date.now()}-${Math.random()}.sqlite3`
		);
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: dbPath,
			migrations: [AddRolePermissionUniqueIndex1790000017000],
			synchronize: false,
			logging: false
		});
		await dataSource.initialize();

		const { table, indexes } = currentSqliteRolePermissionSchema();
		for (const referenced of ['tenant', 'role', 'user']) {
			await dataSource.query(`CREATE TABLE "${referenced}" ("id" varchar PRIMARY KEY NOT NULL)`);
		}
		await dataSource.query(`INSERT INTO "tenant" ("id") VALUES (?), (?)`, [TENANT_A, TENANT_B]);
		await dataSource.query(`INSERT INTO "role" ("id") VALUES (?), (?)`, [ROLE_A, ROLE_B]);
		await dataSource.query(table);
		for (const index of indexes) {
			await dataSource.query(index);
		}
		for (const [n, tenantId, roleId, permission, enabled, isActive, isArchived, deletedAt, createdAt] of ROWS) {
			await dataSource.query(
				`INSERT INTO "role_permission" ("id", "tenantId", "roleId", "permission", "enabled", "isActive", "isArchived", "deletedAt", "createdAt")
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				[id(n), tenantId, roleId, permission, enabled, isActive, isArchived, deletedAt, createdAt]
			);
		}
	});

	afterEach(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
		fs.rmSync(dbPath, { force: true });
	});

	it('control: before the migration the table accepts a duplicate', async () => {
		await expect(insert(TENANT_A, ROLE_A, 'P2', id(99))).resolves.toBeDefined();
	});

	it('keeps exactly one row per group, choosing the one that grants the permission', async () => {
		const grantsBefore = await dataSource.query(GRANTS_SQL);

		await dataSource.runMigrations({ transaction: 'each' });

		expect(await ids()).toEqual(KEPT);
		// No role gained or lost a permission.
		expect(await dataSource.query(GRANTS_SQL)).toEqual(grantsBefore);
	});

	it('then refuses a duplicate, but not a copy with a NULL tenant', async () => {
		await dataSource.runMigrations({ transaction: 'each' });

		await expect(insert(TENANT_A, ROLE_A, 'P2', id(99))).rejects.toThrow(/UNIQUE constraint failed/);
		await expect(insert(null, ROLE_A, 'P1', id(98))).resolves.toBeDefined();
		// Another role or tenant may still hold the same permission.
		await expect(insert(TENANT_B, ROLE_B, 'P2', id(97))).resolves.toBeDefined();
	});

	it('adds only the unique index, and running it again changes nothing', async () => {
		const indexesBefore = await indexNames();

		await dataSource.runMigrations({ transaction: 'each' });
		expect(await indexNames()).toEqual([...indexesBefore, INDEX].sort());

		const queryRunner = dataSource.createQueryRunner();
		await queryRunner.startTransaction();
		await new AddRolePermissionUniqueIndex1790000017000().up(queryRunner);
		await queryRunner.commitTransaction();
		await queryRunner.release();

		expect(await indexNames()).toEqual([...indexesBefore, INDEX].sort());
		expect(await ids()).toEqual(KEPT);
	});

	it('leaves the table untouched when its transaction is rolled back', async () => {
		const queryRunner = dataSource.createQueryRunner();
		await queryRunner.startTransaction();
		await new AddRolePermissionUniqueIndex1790000017000().up(queryRunner);
		await queryRunner.rollbackTransaction();
		await queryRunner.release();

		expect(await ids()).toEqual(ROWS.map(([n]) => id(n)).sort());
		expect(await indexNames()).not.toContain(INDEX);
	});

	it('reverting drops the unique index and nothing else', async () => {
		const indexesBefore = await indexNames();
		await dataSource.runMigrations({ transaction: 'each' });

		await dataSource.undoLastMigration({ transaction: 'each' });

		expect(await indexNames()).toEqual(indexesBefore);
		expect(await ids()).toEqual(KEPT);
		await expect(insert(TENANT_A, ROLE_A, 'P2', id(99))).resolves.toBeDefined();
	});
});

/** A stub query runner: records every statement, answers from `respond`. */
function stubRunner(type: 'mysql' | 'postgres', respond: (sql: string) => unknown) {
	const statements: string[] = [];
	const runner = {
		connection: { options: { type } },
		isTransactionActive: true,
		query: async (sql: string) => {
			statements.push(sql.replace(/\s+/g, ' ').trim());
			return respond(sql);
		}
	};
	return { runner: runner as any, statements };
}

/** The error a driver throws when a unique index cannot be built over duplicate rows. */
const duplicateError = (code: string) => Object.assign(new Error('duplicate key'), { code });

describe('AddRolePermissionUniqueIndex (MySQL)', () => {
	/** A MySQL stub: `built` says whether the index exists, `duplicates` whether the build fails. */
	const mysql = (state: { built: boolean; duplicates: boolean }) =>
		stubRunner('mysql', (sql) => {
			if (sql.includes('information_schema')) {
				return state.built ? [{ INDEX_NAME: INDEX }] : [];
			}
			if (sql.startsWith('CREATE UNIQUE INDEX')) {
				if (state.duplicates) {
					throw duplicateError('ER_DUP_ENTRY');
				}
				state.built = true;
			}
			if (sql.startsWith('DROP INDEX')) {
				state.built = false;
			}
			if (sql.startsWith('DELETE')) {
				state.duplicates = false;
				return { records: [], affected: 2 };
			}
			return [];
		});

	it('builds the index directly when there are no duplicates, without reading for them', async () => {
		const state = { built: false, duplicates: false };
		const { runner, statements } = mysql(state);

		await new AddRolePermissionUniqueIndex1790000017000().up(runner);

		expect(statements.filter((sql) => !sql.includes('information_schema'))).toEqual([
			'CREATE UNIQUE INDEX `IDX_role_permission_unique` ON `role_permission` (`tenantId`, `roleId`, `permission`)'
		]);
		expect(state.built).toBe(true);
	});

	it('removes duplicates and builds again when the first build hits one', async () => {
		const state = { built: false, duplicates: true };
		const { runner, statements } = mysql(state);

		await new AddRolePermissionUniqueIndex1790000017000().up(runner);

		const issued = statements.filter((sql) => !sql.includes('information_schema'));
		expect(issued.map((sql) => sql.split(' ').slice(0, 2).join(' '))).toEqual([
			'CREATE UNIQUE',
			'DELETE FROM',
			'CREATE UNIQUE'
		]);
		// MySQL reads a double-quoted name as a string: `ORDER BY "createdAt"` would silently sort by a
		// constant. Every identifier must reach it in backticks.
		for (const sql of issued) {
			expect(sql).not.toContain('"');
		}
		expect(issued[1]).toContain(
			'ROW_NUMBER() OVER ( PARTITION BY `tenantId`, `roleId`, `permission` ORDER BY CASE WHEN `deletedAt` IS NOT NULL THEN 2'
		);
		expect(state.built).toBe(true);
	});

	it('does nothing when the index is already there (a retry after a crash)', async () => {
		const { runner, statements } = mysql({ built: true, duplicates: false });

		await new AddRolePermissionUniqueIndex1790000017000().up(runner);

		expect(statements.filter((sql) => !sql.includes('information_schema'))).toEqual([]);
	});

	it('counts a build lost to another process as done', async () => {
		const state = { built: false, duplicates: false };
		const { runner } = stubRunner('mysql', (sql) => {
			if (sql.includes('information_schema')) {
				return state.built ? [{ INDEX_NAME: INDEX }] : [];
			}
			if (sql.startsWith('CREATE UNIQUE INDEX')) {
				state.built = true; // the other process's build lands first
				throw duplicateError('ER_DUP_KEYNAME');
			}
			return [];
		});

		await expect(new AddRolePermissionUniqueIndex1790000017000().up(runner)).resolves.toBeUndefined();
	});

	it('reverting drops the index when present, and is a no-op otherwise', async () => {
		const present = mysql({ built: true, duplicates: false });
		await new AddRolePermissionUniqueIndex1790000017000().down(present.runner);
		expect(present.statements).toContain('DROP INDEX `IDX_role_permission_unique` ON `role_permission`');

		const absent = mysql({ built: false, duplicates: false });
		await new AddRolePermissionUniqueIndex1790000017000().down(absent.runner);
		expect(absent.statements.some((sql) => sql.startsWith('DROP'))).toBe(false);
	});
});

describe('AddRolePermissionUniqueIndex (Postgres)', () => {
	/** A Postgres stub; `index` is what `pg_index` reports for the index name, if anything. */
	const postgres = (state: { index?: { valid: boolean; unique: boolean }; duplicates: boolean }) =>
		stubRunner('postgres', (sql) => {
			if (sql.includes('"pg_index"')) {
				return state.index ? [state.index] : [];
			}
			if (sql.startsWith('CREATE UNIQUE INDEX')) {
				if (state.duplicates) {
					throw duplicateError('23505');
				}
				state.index = { valid: true, unique: true };
			}
			if (sql.startsWith('DELETE')) {
				state.duplicates = false;
				return { records: [], affected: 2 };
			}
			return [];
		});

	const withoutLookups = (statements: string[]) => statements.filter((sql) => !sql.includes('"pg_index"'));

	it('locks writers out first, then builds under a savepoint', async () => {
		const { runner, statements } = postgres({ duplicates: false });

		await new AddRolePermissionUniqueIndex1790000017000().up(runner);

		expect(withoutLookups(statements)).toEqual([
			`SET LOCAL lock_timeout = '5s'`,
			`LOCK TABLE "role_permission" IN SHARE ROW EXCLUSIVE MODE`,
			`SAVEPOINT "role_permission_unique"`,
			`CREATE UNIQUE INDEX "${INDEX}" ON "role_permission" ("tenantId", "roleId", "permission")`,
			`RELEASE SAVEPOINT "role_permission_unique"`
		]);
	});

	it('rolls the failed build back to the savepoint, removes duplicates and builds again', async () => {
		const { runner, statements } = postgres({ duplicates: true });

		await new AddRolePermissionUniqueIndex1790000017000().up(runner);

		expect(withoutLookups(statements).map((sql) => sql.split(' ').slice(0, 2).join(' '))).toEqual([
			'SET LOCAL',
			'LOCK TABLE',
			'SAVEPOINT "role_permission_unique"',
			'CREATE UNIQUE',
			'ROLLBACK TO',
			'DELETE FROM',
			'SAVEPOINT "role_permission_unique"',
			'CREATE UNIQUE',
			'RELEASE SAVEPOINT'
		]);
	});

	it('does nothing, and takes no lock, when the index already exists', async () => {
		const { runner, statements } = postgres({ index: { valid: true, unique: true }, duplicates: false });

		await new AddRolePermissionUniqueIndex1790000017000().up(runner);

		expect(withoutLookups(statements)).toEqual([]);
	});

	it('refuses an INVALID index of that name instead of recording the migration as done', async () => {
		const { runner } = postgres({ index: { valid: false, unique: true }, duplicates: false });

		await expect(new AddRolePermissionUniqueIndex1790000017000().up(runner)).rejects.toThrow(
			/not a valid unique index.*DROP INDEX CONCURRENTLY/
		);
	});

	it('does not swallow an error that is not a duplicate key', async () => {
		const { runner } = stubRunner('postgres', (sql) => {
			if (sql.startsWith('CREATE UNIQUE INDEX')) {
				throw Object.assign(new Error('canceling statement due to lock timeout'), { code: '55P03' });
			}
			return [];
		});

		await expect(new AddRolePermissionUniqueIndex1790000017000().up(runner)).rejects.toThrow(/lock timeout/);
	});

	it('reverting drops only the index, without queueing behind a long transaction', async () => {
		const { runner, statements } = postgres({ index: { valid: true, unique: true }, duplicates: false });

		await new AddRolePermissionUniqueIndex1790000017000().down(runner);

		expect(statements).toEqual([`SET LOCAL lock_timeout = '5s'`, `DROP INDEX IF EXISTS "${INDEX}"`]);
	});
});
