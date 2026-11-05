import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource, QueryRunner } from 'typeorm';
import { AddOrganizationAllowEmployeesToEditOwnRates1791000004010 } from './migrations/1791000004010-AddOrganizationAllowEmployeesToEditOwnRates';

/**
 * `organization.allowEmployeesToEditOwnRates`, run for real on SQLite against a minimal fixture of the table: it
 * arrives as `NOT NULL DEFAULT 1`, so every existing organization keeps letting its employees edit their own rates.
 */
const ORGANIZATION = 'f0000000-0000-4000-8000-000000000001';

describe('organization.allowEmployeesToEditOwnRates migration on SQLite', () => {
	let dataSource: DataSource;
	let dbPath: string;

	beforeEach(async () => {
		dbPath = path.join(os.tmpdir(), `gauzy-own-rates-${process.pid}-${Date.now()}-${Math.random()}.sqlite3`);
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
		return columns.find((it) => it.name === 'allowEmployeesToEditOwnRates');
	};

	const run = async (direction: 'up' | 'down') => {
		const queryRunner = dataSource.createQueryRunner();
		try {
			await new AddOrganizationAllowEmployeesToEditOwnRates1791000004010()[direction](queryRunner);
		} finally {
			await queryRunner.release();
		}
	};

	it('adds the column as NOT NULL DEFAULT 1, and existing organizations keep allowing own rates', async () => {
		await run('up');

		expect(await column()).toMatchObject({ type: 'boolean', notnull: 1, dflt_value: '1' });
		const [existing] = await dataSource.query(
			`SELECT "allowEmployeesToEditOwnRates" AS "allowed" FROM "organization" WHERE "id" = ?`,
			[ORGANIZATION]
		);
		expect(existing.allowed).toBe(1);
	});

	it('is a no-op when run twice, and keeps the column on down', async () => {
		await run('up');
		await expect(run('up')).resolves.toBeUndefined();
		await run('down');

		expect(await column()).toBeDefined();
	});
});

describe('organization.allowEmployeesToEditOwnRates migration on MySQL', () => {
	it('takes a named lock MySQL accepts and adds a tinyint column', async () => {
		const queries: string[] = [];
		const queryRunner = {
			connection: { options: { type: 'mysql' } },
			hasTable: async () => true,
			hasColumn: async () => false,
			query: async (sql: string) => {
				queries.push(sql);
				const isLock = sql.includes('GET_LOCK');
				if (isLock) {
					return [{ acquired: 1 }];
				}
				return [];
			}
		} as unknown as QueryRunner;
		const migration = new AddOrganizationAllowEmployeesToEditOwnRates1791000004010();

		await migration.up(queryRunner);

		expect(migration.mysqlLockName.length).toBeLessThanOrEqual(64);
		expect(queries).toEqual([
			'SELECT GET_LOCK(?, 120) AS `acquired`',
			'ALTER TABLE `organization` ADD COLUMN `allowEmployeesToEditOwnRates` tinyint NOT NULL DEFAULT 1',
			'SELECT RELEASE_LOCK(?)'
		]);
	});
});
