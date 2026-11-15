import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource, QueryRunner } from 'typeorm';
import { AddOrganizationTimeLogsKeepTheirRates1791000011500 } from './migrations/1791000011500-AddOrganizationTimeLogsKeepTheirRates';

/**
 * `organization.timeLogsKeepTheirRates`, run for real on SQLite against a minimal fixture of the table: it arrives
 * nullable and empty, so every existing organization keeps today's behaviour (a rate change re-prices past time).
 */
const ORGANIZATION = 'f0000000-0000-4000-8000-000000000001';

describe('organization.timeLogsKeepTheirRates migration on SQLite', () => {
	let dataSource: DataSource;
	let dbPath: string;

	beforeEach(async () => {
		dbPath = path.join(os.tmpdir(), `gauzy-keep-rates-${process.pid}-${Date.now()}-${Math.random()}.sqlite3`);
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

	const column = async () => {
		const columns = (await dataSource.query('PRAGMA table_info(organization)')) as Array<{
			name: string;
			notnull: number;
			dflt_value: string | null;
			type: string;
		}>;
		return columns.find((it) => it.name === 'timeLogsKeepTheirRates');
	};

	const run = async (direction: 'up' | 'down') => {
		const queryRunner = dataSource.createQueryRunner();
		try {
			await new AddOrganizationTimeLogsKeepTheirRates1791000011500()[direction](queryRunner);
		} finally {
			await queryRunner.release();
		}
	};

	it('adds a nullable column, empty for every existing organization', async () => {
		await run('up');

		expect(await column()).toMatchObject({ type: 'boolean', notnull: 0, dflt_value: null });
		const [existing] = await dataSource.query(
			`SELECT "timeLogsKeepTheirRates" AS "keeps" FROM "organization" WHERE "id" = ?`,
			[ORGANIZATION]
		);
		expect(existing.keeps).toBeNull();
	});

	it('is a no-op when run twice, and keeps the column on down', async () => {
		await run('up');
		await expect(run('up')).resolves.toBeUndefined();
		await run('down');

		expect(await column()).toBeDefined();
	});
});

describe('organization.timeLogsKeepTheirRates migration on MySQL', () => {
	const recording = (hasColumn: boolean) => {
		const queries: string[] = [];
		const queryRunner = {
			connection: { options: { type: 'mysql' } },
			hasTable: async () => true,
			hasColumn: async () => hasColumn,
			query: async (sql: string) => {
				queries.push(sql);
				if (sql.includes('GET_LOCK')) {
					return [{ acquired: 1 }];
				}
				return [];
			}
		} as unknown as QueryRunner;
		return { queries, queryRunner };
	};

	it('takes a named lock MySQL accepts and adds a nullable tinyint column', async () => {
		const { queries, queryRunner } = recording(false);
		const migration = new AddOrganizationTimeLogsKeepTheirRates1791000011500();

		await migration.up(queryRunner);

		expect(migration.mysqlLockName.length).toBeLessThanOrEqual(64);
		expect(queries).toEqual([
			'SELECT GET_LOCK(?, 120) AS `acquired`',
			'ALTER TABLE `organization` ADD COLUMN `timeLogsKeepTheirRates` tinyint NULL',
			'SELECT RELEASE_LOCK(?)'
		]);
	});

	it('drops the column on down', async () => {
		const { queries, queryRunner } = recording(true);

		await new AddOrganizationTimeLogsKeepTheirRates1791000011500().down(queryRunner);

		expect(queries).toEqual(['ALTER TABLE `organization` DROP COLUMN `timeLogsKeepTheirRates`']);
	});
});

describe('organization.timeLogsKeepTheirRates migration on Postgres', () => {
	it('serialises concurrent runs and adds the column only when it is missing', async () => {
		const queries: string[] = [];
		const queryRunner = {
			connection: { options: { type: 'postgres' } },
			isTransactionActive: true,
			hasTable: async () => true,
			query: async (sql: string) => {
				queries.push(sql);
				return [];
			}
		} as unknown as QueryRunner;

		await new AddOrganizationTimeLogsKeepTheirRates1791000011500().up(queryRunner);

		expect(queries).toEqual([
			'SELECT pg_advisory_xact_lock($1)',
			'ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "timeLogsKeepTheirRates" boolean'
		]);
	});
});
