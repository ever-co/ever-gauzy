import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource, QueryRunner } from 'typeorm';
import { AddOrganizationDurationRounding1791000010800 } from './migrations/1791000010800-AddOrganizationDurationRounding';

/**
 * `organization.durationRoundingInterval` and `organization.durationRoundingDirection`, run for real on SQLite against a
 * minimal fixture of the table: both arrive nullable with no default, so every existing organization rounds nothing.
 */
const ORGANIZATION = 'f0000000-0000-4000-8000-000000000001';

const COLUMNS = ['durationRoundingInterval', 'durationRoundingDirection'];

describe('organization duration rounding migration on SQLite', () => {
	let dataSource: DataSource;
	let dbPath: string;

	beforeEach(async () => {
		dbPath = path.join(
			os.tmpdir(),
			`gauzy-duration-rounding-${process.pid}-${Date.now()}-${Math.random()}.sqlite3`
		);
		dataSource = new DataSource({ type: 'better-sqlite3', database: dbPath, synchronize: false, logging: false });
		await dataSource.initialize();
		await dataSource.query(
			'CREATE TABLE "organization" ("id" varchar PRIMARY KEY NOT NULL, "name" varchar NOT NULL)'
		);
		await dataSource.query(`INSERT INTO "organization" ("id", "name") VALUES (?, 'Existing')`, [ORGANIZATION]);
	});

	afterEach(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
		fs.rmSync(dbPath, { force: true });
	});

	const columns = async () => {
		const rows = (await dataSource.query('PRAGMA table_info(organization)')) as Array<{
			name: string;
			notnull: number;
			dflt_value: string | null;
			type: string;
		}>;
		// SQLite may report a declared type in upper case (`INTEGER`): compare it in lower case.
		return rows
			.filter((row) => COLUMNS.includes(row.name))
			.map((row) => ({ ...row, type: row.type.toLowerCase() }));
	};

	const run = async (direction: 'up' | 'down') => {
		const queryRunner = dataSource.createQueryRunner();
		try {
			await new AddOrganizationDurationRounding1791000010800()[direction](queryRunner);
		} finally {
			await queryRunner.release();
		}
	};

	it('adds both columns nullable with no default, and existing organizations round nothing', async () => {
		await run('up');

		expect(await columns()).toEqual([
			expect.objectContaining({
				name: 'durationRoundingInterval',
				type: 'integer',
				notnull: 0,
				dflt_value: null
			}),
			expect.objectContaining({
				name: 'durationRoundingDirection',
				type: 'varchar',
				notnull: 0,
				dflt_value: null
			})
		]);
		const [existing] = await dataSource.query(
			`SELECT "durationRoundingInterval" AS "interval", "durationRoundingDirection" AS "direction" FROM "organization" WHERE "id" = ?`,
			[ORGANIZATION]
		);
		expect(existing).toEqual({ interval: null, direction: null });
	});

	it('stores a rule once the columns exist', async () => {
		await run('up');

		await dataSource.query(
			`UPDATE "organization" SET "durationRoundingInterval" = 15, "durationRoundingDirection" = 'UP' WHERE "id" = ?`,
			[ORGANIZATION]
		);
		const [saved] = await dataSource.query(
			`SELECT "durationRoundingInterval" AS "interval", "durationRoundingDirection" AS "direction" FROM "organization" WHERE "id" = ?`,
			[ORGANIZATION]
		);
		expect(saved).toEqual({ interval: 15, direction: 'UP' });
	});

	it('is a no-op when run twice, keeps the columns on down, and runs up again after down', async () => {
		await run('up');
		await expect(run('up')).resolves.toBeUndefined();
		await run('down');

		expect(await columns()).toHaveLength(2);
		await expect(run('up')).resolves.toBeUndefined();
	});
});

/** A query runner that records its statements, for the dialects this suite cannot run. */
const recordingQueryRunner = (type: 'mysql' | 'postgres', queries: string[], hasColumn: boolean): QueryRunner =>
	({
		connection: { options: { type } },
		isTransactionActive: true,
		hasTable: async () => true,
		hasColumn: async () => hasColumn,
		query: async (sql: string) => {
			queries.push(sql);
			const isLock = sql.includes('GET_LOCK');
			if (isLock) {
				return [{ acquired: 1 }];
			}
			return [];
		}
	}) as unknown as QueryRunner;

describe('organization duration rounding migration on MySQL', () => {
	it('takes a named lock MySQL accepts and adds a nullable int and a nullable varchar', async () => {
		const queries: string[] = [];
		const migration = new AddOrganizationDurationRounding1791000010800();

		await migration.up(recordingQueryRunner('mysql', queries, false));

		expect(migration.mysqlLockName.length).toBeLessThanOrEqual(64);
		expect(queries).toEqual([
			'SELECT GET_LOCK(?, 120) AS `acquired`',
			'ALTER TABLE `organization` ADD COLUMN `durationRoundingInterval` int NULL',
			'ALTER TABLE `organization` ADD COLUMN `durationRoundingDirection` varchar(255) NULL',
			'SELECT RELEASE_LOCK(?)'
		]);
	});

	it('adds nothing when the columns exist, and drops both on down', async () => {
		const upQueries: string[] = [];
		const downQueries: string[] = [];
		const migration = new AddOrganizationDurationRounding1791000010800();

		await migration.up(recordingQueryRunner('mysql', upQueries, true));
		await migration.down(recordingQueryRunner('mysql', downQueries, true));

		expect(upQueries).toEqual(['SELECT GET_LOCK(?, 120) AS `acquired`', 'SELECT RELEASE_LOCK(?)']);
		expect(downQueries).toEqual([
			'ALTER TABLE `organization` DROP COLUMN `durationRoundingInterval`',
			'ALTER TABLE `organization` DROP COLUMN `durationRoundingDirection`'
		]);
	});
});

describe('organization duration rounding migration on Postgres', () => {
	it('serialises concurrent runs and adds each column only when it is missing', async () => {
		const queries: string[] = [];

		await new AddOrganizationDurationRounding1791000010800().up(recordingQueryRunner('postgres', queries, false));

		expect(queries).toEqual([
			'SELECT pg_advisory_xact_lock($1)',
			'ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "durationRoundingInterval" integer',
			'ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "durationRoundingDirection" character varying'
		]);
	});

	it('drops both columns on down', async () => {
		const queries: string[] = [];

		await new AddOrganizationDurationRounding1791000010800().down(recordingQueryRunner('postgres', queries, true));

		expect(queries).toEqual([
			'ALTER TABLE "organization" DROP COLUMN IF EXISTS "durationRoundingInterval"',
			'ALTER TABLE "organization" DROP COLUMN IF EXISTS "durationRoundingDirection"'
		]);
	});
});
