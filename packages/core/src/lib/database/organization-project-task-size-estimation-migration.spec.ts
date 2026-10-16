import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource, QueryRunner } from 'typeorm';
import { AddOrganizationProjectTaskSizeEstimation1791000000747 } from './migrations/1791000000747-AddOrganizationProjectTaskSizeEstimation';

/**
 * `organization_project.isTaskSizeEstimationEnabled`, run for real on SQLite (the demo database) against a minimal
 * fixture of the table: it arrives as `NOT NULL DEFAULT 1`, existing projects read enabled, a re-run is a no-op,
 * and `down` keeps the column on the embedded dialect.
 */
const PROJECT = 'f0000000-0000-4000-8000-000000000001';

describe('organization_project.isTaskSizeEstimationEnabled migration on SQLite', () => {
	let dataSource: DataSource;
	let dbPath: string;

	beforeEach(async () => {
		dbPath = path.join(
			os.tmpdir(),
			`gauzy-task-size-estimation-${process.pid}-${Date.now()}-${Math.random()}.sqlite3`
		);
		dataSource = new DataSource({ type: 'better-sqlite3', database: dbPath, synchronize: false, logging: false });
		await dataSource.initialize();
		await dataSource.query(
			'CREATE TABLE "organization_project" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "name" varchar NOT NULL)'
		);
		await dataSource.query(`INSERT INTO "organization_project" ("id", "name") VALUES (?, 'Existing')`, [PROJECT]);
	});

	afterEach(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
		fs.rmSync(dbPath, { force: true });
	});

	const column = async () =>
		(
			(await dataSource.query('PRAGMA table_info(organization_project)')) as Array<{
				name: string;
				notnull: number;
				dflt_value: string | null;
				type: string;
			}>
		).find((it) => it.name === 'isTaskSizeEstimationEnabled');

	const run = async (direction: 'up' | 'down') => {
		const queryRunner = dataSource.createQueryRunner();
		try {
			await new AddOrganizationProjectTaskSizeEstimation1791000000747()[direction](queryRunner);
		} finally {
			await queryRunner.release();
		}
	};

	it('adds the column as NOT NULL DEFAULT 1, and existing projects read enabled', async () => {
		await run('up');

		expect(await column()).toMatchObject({ type: 'boolean', notnull: 1, dflt_value: '1' });
		const [existing] = await dataSource.query(
			`SELECT "isTaskSizeEstimationEnabled" AS "enabled" FROM "organization_project" WHERE "id" = ?`,
			[PROJECT]
		);
		expect(existing.enabled).toBe(1);

		await dataSource.query(`INSERT INTO "organization_project" ("id", "name") VALUES ('new', 'New')`);
		const [created] = await dataSource.query(
			`SELECT "isTaskSizeEstimationEnabled" AS "enabled" FROM "organization_project" WHERE "id" = 'new'`
		);
		expect(created.enabled).toBe(1);
	});

	it('is a no-op when run twice', async () => {
		await run('up');
		await expect(run('up')).resolves.toBeUndefined();
		expect(await column()).toBeDefined();
	});

	it('keeps the column on down (the embedded dialect keeps additive columns)', async () => {
		await run('up');
		await run('down');
		expect(await column()).toBeDefined();
	});
});

describe('organization_project.isTaskSizeEstimationEnabled migration on MySQL', () => {
	it('takes a named lock MySQL accepts (at most 64 characters) and adds a tinyint column', async () => {
		const queries: Array<{ sql: string; parameters?: unknown[] }> = [];
		const queryRunner = {
			connection: { options: { type: 'mysql' } },
			hasTable: async () => true,
			hasColumn: async () => false,
			query: async (sql: string, parameters?: unknown[]) => {
				queries.push({ sql, parameters });
				return sql.includes('GET_LOCK') ? [{ acquired: 1 }] : [];
			}
		} as unknown as QueryRunner;
		const migration = new AddOrganizationProjectTaskSizeEstimation1791000000747();

		await migration.up(queryRunner);

		expect(migration.mysqlLockName.length).toBeLessThanOrEqual(64);
		expect(queries.map((query) => query.sql)).toEqual([
			'SELECT GET_LOCK(?, 120) AS `acquired`',
			'ALTER TABLE `organization_project` ADD COLUMN `isTaskSizeEstimationEnabled` tinyint NOT NULL DEFAULT 1',
			'SELECT RELEASE_LOCK(?)'
		]);
		expect(queries[0].parameters).toEqual([migration.mysqlLockName]);
	});
});
