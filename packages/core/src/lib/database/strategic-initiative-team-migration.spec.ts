import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { CreateOrganizationStrategicInitiativeTeamTable1791000000731 } from './migrations/1791000000731-CreateOrganizationStrategicInitiativeTeamTable';

/**
 * `organization_strategic_initiative_team` (G-P2-4), run for real on SQLite (the demo database) against a
 * minimal fixture of the two tables it references: one row per (initiative, team), each side cascading with
 * its row, a re-run that adds nothing, and a `down` that drops the pivot.
 */
const INITIATIVE = 'a0000000-0000-4000-8000-000000000001';
const TEAM_A = 'b0000000-0000-4000-8000-00000000000a';
const TEAM_B = 'b0000000-0000-4000-8000-00000000000b';
const TABLE = 'organization_strategic_initiative_team';

describe('CreateOrganizationStrategicInitiativeTeamTable1791000000731 on SQLite', () => {
	let dataSource: DataSource;
	let dbPath: string;

	beforeEach(async () => {
		dbPath = path.join(os.tmpdir(), `gauzy-initiative-team-${process.pid}-${Date.now()}-${Math.random()}.sqlite3`);
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: dbPath,
			migrations: [CreateOrganizationStrategicInitiativeTeamTable1791000000731],
			synchronize: false,
			logging: false
		});
		await dataSource.initialize();
		await dataSource.query('CREATE TABLE "organization_strategic_initiative" ("id" varchar PRIMARY KEY NOT NULL)');
		await dataSource.query('CREATE TABLE "organization_team" ("id" varchar PRIMARY KEY NOT NULL)');
		await dataSource.query('INSERT INTO "organization_strategic_initiative" ("id") VALUES (?)', [INITIATIVE]);
		await dataSource.query('INSERT INTO "organization_team" ("id") VALUES (?), (?)', [TEAM_A, TEAM_B]);
	});

	afterEach(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
		fs.rmSync(dbPath, { force: true });
	});

	const link = (team: string) =>
		dataSource.query(
			`INSERT INTO "${TABLE}" ("organizationStrategicInitiativeId", "organizationTeamId") VALUES (?, ?)`,
			[INITIATIVE, team]
		);
	const rows = () => dataSource.query(`SELECT * FROM "${TABLE}" ORDER BY "organizationTeamId"`);

	it('links an initiative to teams, once per team, cascading with either side', async () => {
		await dataSource.runMigrations({ transaction: 'each' });
		await dataSource.query('PRAGMA foreign_keys = ON');

		await link(TEAM_A);
		await link(TEAM_B);
		await expect(link(TEAM_A)).rejects.toThrow(/UNIQUE|PRIMARY/);
		expect(await rows()).toHaveLength(2);

		await dataSource.query('DELETE FROM "organization_team" WHERE "id" = ?', [TEAM_A]);
		expect(await rows()).toEqual([{ organizationStrategicInitiativeId: INITIATIVE, organizationTeamId: TEAM_B }]);

		await dataSource.query('DELETE FROM "organization_strategic_initiative" WHERE "id" = ?', [INITIATIVE]);
		expect(await rows()).toEqual([]);

		const indexes = (
			(await dataSource.query(`SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = ?`, [
				TABLE
			])) as {
				name: string;
			}[]
		).map((row) => row.name);
		expect(indexes).toEqual(
			expect.arrayContaining(['IDX_ffecd6e749d0dc1ce89b02e9a5', 'IDX_04e60eebe8d6ba3a336ec70770'])
		);
	});

	it('is idempotent, and reverts', async () => {
		await dataSource.runMigrations({ transaction: 'each' });
		const queryRunner = dataSource.createQueryRunner();
		try {
			await new CreateOrganizationStrategicInitiativeTeamTable1791000000731().up(queryRunner);
		} finally {
			await queryRunner.release();
		}

		await dataSource.undoLastMigration({ transaction: 'each' });
		const tables = (
			(await dataSource.query(`SELECT name FROM sqlite_master WHERE type = 'table'`)) as { name: string }[]
		).map((row) => row.name);
		expect(tables).not.toContain(TABLE);

		await dataSource.runMigrations({ transaction: 'each' });
		await link(TEAM_A);
		expect(await rows()).toHaveLength(1);
	});
});

/**
 * MySQL commits each DDL statement on its own: the pivot is created by ONE statement that carries both foreign
 * keys (a failure can no longer leave a key-less table that a re-run would skip), inside a named lock.
 */
describe('CreateOrganizationStrategicInitiativeTeamTable1791000000731 on MySQL', () => {
	let lockNames: string[] = [];
	const run = async (tableExists: boolean) => {
		const statements: string[] = [];
		lockNames = [];
		const queryRunner = {
			connection: { options: { type: 'mysql' } },
			hasTable: jest.fn(async () => {
				statements.push('hasTable');
				return tableExists;
			}),
			query: jest.fn(async (sql: string, parameters?: unknown[]) => {
				statements.push(sql);
				if (sql.startsWith('SELECT GET_LOCK')) lockNames.push(String(parameters?.[0]));
				return sql.startsWith('SELECT GET_LOCK') ? [{ acquired: 1 }] : [];
			})
		};
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		await new CreateOrganizationStrategicInitiativeTeamTable1791000000731().up(queryRunner as never);
		return statements;
	};

	afterEach(() => jest.restoreAllMocks());

	it('creates the pivot with both foreign keys in one statement, under a named lock', async () => {
		const statements = await run(false);

		expect(statements[0]).toMatch(/^SELECT GET_LOCK\(/);
		expect(statements[1]).toBe('hasTable');
		const creates = statements.filter((sql) => /^(CREATE|ALTER)/.test(sql));
		expect(creates).toHaveLength(1);
		expect(creates[0]).toContain('CONSTRAINT `FK_ffecd6e749d0dc1ce89b02e9a51` FOREIGN KEY');
		expect(creates[0]).toContain('CONSTRAINT `FK_04e60eebe8d6ba3a336ec707707` FOREIGN KEY');
		expect(statements[statements.length - 1]).toMatch(/^SELECT RELEASE_LOCK\(/);
	});

	it('names its lock within the 64 characters MySQL accepts', async () => {
		await run(true);
		expect(lockNames).toHaveLength(1);
		expect(lockNames[0].length).toBeLessThanOrEqual(64);
	});

	it('adds nothing when the pivot exists, and still releases the lock', async () => {
		const statements = await run(true);

		expect(statements.filter((sql) => /^(CREATE|ALTER)/.test(sql))).toHaveLength(0);
		expect(statements[statements.length - 1]).toMatch(/^SELECT RELEASE_LOCK\(/);
	});
});
