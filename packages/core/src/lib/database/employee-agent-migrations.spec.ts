import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { AddEmployeeKind1791000000721 } from './migrations/1791000000721-AddEmployeeKind';
import { CreateEmployeeAgentProfileTable1791000000722 } from './migrations/1791000000722-CreateEmployeeAgentProfileTable';

/**
 * The two migrations of the agent-employee change (Gauzy ↔ Ever Works, G-P1-1), run for real on SQLite
 * (the demo database) against a minimal fixture of the tables they touch or reference.
 *
 * - `employee.kind` arrives as `NOT NULL DEFAULT 'human'` with TypeORM's index, existing rows read `human`,
 *   a re-run is a no-op, and `down` drops the index (the embedded dialect keeps the column).
 * - `employee_agent_profile` arrives with one row per employee, cascades with its employee, clears
 *   `reportsToEmployeeId` when that employee goes, and `down` drops it.
 */
const TENANT = 'a0000000-0000-4000-8000-000000000001';
const ORGANIZATION = 'b0000000-0000-4000-8000-000000000001';
const USER = 'c0000000-0000-4000-8000-000000000001';
const PERSON = 'e0000000-0000-4000-8000-000000000001';
const AGENT = 'e0000000-0000-4000-8000-000000000002';

describe('agent employee migrations on SQLite', () => {
	let dataSource: DataSource;
	let dbPath: string;

	beforeEach(async () => {
		dbPath = path.join(os.tmpdir(), `gauzy-agent-employee-${process.pid}-${Date.now()}-${Math.random()}.sqlite3`);
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: dbPath,
			migrations: [AddEmployeeKind1791000000721, CreateEmployeeAgentProfileTable1791000000722],
			synchronize: false,
			logging: false
		});
		await dataSource.initialize();
		await dataSource.query('CREATE TABLE "tenant" ("id" varchar PRIMARY KEY NOT NULL, "name" varchar)');
		await dataSource.query(
			'CREATE TABLE "organization" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "name" varchar)'
		);
		await dataSource.query('CREATE TABLE "user" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar)');
		await dataSource.query(
			'CREATE TABLE "employee" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "organizationId" varchar, "userId" varchar NOT NULL)'
		);
		await dataSource.query(`INSERT INTO "tenant" ("id", "name") VALUES (?, 'T')`, [TENANT]);
		await dataSource.query(`INSERT INTO "organization" ("id", "tenantId", "name") VALUES (?, ?, 'O')`, [
			ORGANIZATION,
			TENANT
		]);
		await dataSource.query(`INSERT INTO "user" ("id", "tenantId") VALUES (?, ?)`, [USER, TENANT]);
		await dataSource.query(
			`INSERT INTO "employee" ("id", "tenantId", "organizationId", "userId") VALUES (?, ?, ?, ?), (?, ?, ?, ?)`,
			[PERSON, TENANT, ORGANIZATION, USER, AGENT, TENANT, ORGANIZATION, USER]
		);
	});

	afterEach(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
		fs.rmSync(dbPath, { force: true });
	});

	const employeeColumns = async () =>
		(await dataSource.query('PRAGMA table_info(employee)')) as Array<{
			name: string;
			notnull: number;
			dflt_value: string | null;
			type: string;
		}>;
	const indexNames = async (table: string) =>
		(
			(await dataSource.query(`SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = ?`, [
				table
			])) as {
				name: string;
			}[]
		).map((row) => row.name);

	it('adds employee.kind as NOT NULL DEFAULT human, indexed, and every existing row is a person', async () => {
		await dataSource.runMigrations({ transaction: 'each' });

		const kind = (await employeeColumns()).find((column) => column.name === 'kind');
		expect(kind).toMatchObject({ notnull: 1, type: 'varchar(16)' });
		expect(kind.dflt_value).toContain('human');
		expect(await indexNames('employee')).toContain('IDX_bd5498b600e43bf3308fe5adc8');

		const rows = await dataSource.query('SELECT DISTINCT "kind" FROM "employee"');
		expect(rows).toEqual([{ kind: 'human' }]);

		// A row written without the column takes the default.
		await dataSource.query(
			`INSERT INTO "employee" ("id", "tenantId", "organizationId", "userId") VALUES ('e-3', ?, ?, ?)`,
			[TENANT, ORGANIZATION, USER]
		);
		expect(await dataSource.query(`SELECT "kind" FROM "employee" WHERE "id" = 'e-3'`)).toEqual([{ kind: 'human' }]);
	});

	it('is idempotent: running up twice adds nothing and fails nothing', async () => {
		await dataSource.runMigrations({ transaction: 'each' });
		const queryRunner = dataSource.createQueryRunner();
		try {
			await new AddEmployeeKind1791000000721().up(queryRunner);
			await new CreateEmployeeAgentProfileTable1791000000722().up(queryRunner);
		} finally {
			await queryRunner.release();
		}
		expect((await employeeColumns()).filter((column) => column.name === 'kind')).toHaveLength(1);
	});

	it('creates employee_agent_profile: one row per employee, cascading with it', async () => {
		await dataSource.runMigrations({ transaction: 'each' });
		await dataSource.query('PRAGMA foreign_keys = ON');

		const insert = (id: string, employeeId: string, reportsTo: string | null = null) =>
			dataSource.query(
				`INSERT INTO "employee_agent_profile" ("id", "tenantId", "organizationId", "employeeId", "source", "reportsToEmployeeId", "capabilities") VALUES (?, ?, ?, ?, 'ever_works', ?, '["code"]')`,
				[id, TENANT, ORGANIZATION, employeeId, reportsTo]
			);

		await insert('p-1', AGENT, PERSON);
		await expect(insert('p-2', AGENT)).rejects.toThrow(/UNIQUE/);

		const [profile] = await dataSource.query(`SELECT * FROM "employee_agent_profile" WHERE "id" = 'p-1'`);
		expect(profile).toMatchObject({ managedExternally: 0, isActive: 1, isArchived: 0, capabilities: '["code"]' });

		// The manager goes: the profile stays and its reportsTo is cleared.
		await dataSource.query(`DELETE FROM "employee" WHERE "id" = ?`, [PERSON]);
		expect(await dataSource.query(`SELECT "reportsToEmployeeId" FROM "employee_agent_profile"`)).toEqual([
			{ reportsToEmployeeId: null }
		]);

		// The agent goes: so does its profile.
		await dataSource.query(`DELETE FROM "employee" WHERE "id" = ?`, [AGENT]);
		expect(await dataSource.query(`SELECT * FROM "employee_agent_profile"`)).toEqual([]);

		expect(await indexNames('employee_agent_profile')).toEqual(
			expect.arrayContaining(['IDX_29e5671efd0dd4205cf33607e9', 'IDX_817ce667de185f3afdad6ba920'])
		);
	});

	it('reverts: the profile table is dropped and the kind index removed', async () => {
		await dataSource.runMigrations({ transaction: 'each' });
		await dataSource.undoLastMigration({ transaction: 'each' });
		await dataSource.undoLastMigration({ transaction: 'each' });

		const tables = (
			(await dataSource.query(`SELECT name FROM sqlite_master WHERE type = 'table'`)) as { name: string }[]
		).map((row) => row.name);
		expect(tables).not.toContain('employee_agent_profile');
		expect(await indexNames('employee')).not.toContain('IDX_bd5498b600e43bf3308fe5adc8');

		// Up again after a down works (the kept SQLite column is reused, not re-added).
		await dataSource.runMigrations({ transaction: 'each' });
		expect(await indexNames('employee')).toContain('IDX_bd5498b600e43bf3308fe5adc8');
	});
});

/**
 * On MySQL each migration takes a named lock (GET_LOCK accepts at most 64 characters), and the profile table
 * is created by ONE statement that carries its foreign keys: MySQL commits each DDL statement on its own.
 */
describe('agent employee migrations on MySQL', () => {
	const runOnMySql = async (migration: { up: (queryRunner: never) => Promise<void> }, existing: boolean) => {
		const statements: string[] = [];
		const lockNames: string[] = [];
		const queryRunner = {
			connection: { options: { type: 'mysql' } },
			hasTable: jest.fn(async () => existing),
			hasColumn: jest.fn(async () => existing),
			getTable: jest.fn(async () => ({ indices: [] })),
			query: jest.fn(async (sql: string, parameters?: unknown[]) => {
				statements.push(sql);
				if (sql.startsWith('SELECT GET_LOCK')) {
					lockNames.push(String(parameters?.[0]));
					return [{ acquired: 1 }];
				}
				return [];
			})
		};
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		await migration.up(queryRunner as never);
		return { statements, lockNames };
	};

	afterEach(() => jest.restoreAllMocks());

	it('names its locks within the 64 characters MySQL accepts', async () => {
		for (const migration of [
			new AddEmployeeKind1791000000721(),
			new CreateEmployeeAgentProfileTable1791000000722()
		]) {
			const { lockNames } = await runOnMySql(migration, true);
			expect(lockNames).toHaveLength(1);
			expect(lockNames[0].length).toBeLessThanOrEqual(64);
		}
	});

	it('creates employee_agent_profile with all its foreign keys in one statement', async () => {
		const { statements } = await runOnMySql(new CreateEmployeeAgentProfileTable1791000000722(), false);

		const ddl = statements.filter((sql) => /^(CREATE|ALTER)/.test(sql));
		expect(ddl).toHaveLength(1);
		expect(ddl[0].match(/CONSTRAINT `FK_[0-9a-f]+` FOREIGN KEY/g)).toHaveLength(7);
		expect(statements[statements.length - 1]).toMatch(/^SELECT RELEASE_LOCK/);
	});
});
