import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource, QueryRunner } from 'typeorm';
import { AddOrganizationDefaultBillRate1791000010000 } from './migrations/1791000010000-AddOrganizationDefaultBillRate';

/**
 * `organization.defaultBillRateValue` and `organization.defaultBillRateCurrency`, run for real on SQLite against a
 * minimal fixture of the table: both arrive nullable, so every existing organization reads "no default" and the time
 * of a member without a rate keeps having no price.
 */
describe('organization default billing rate migration on SQLite', () => {
	let dataSource: DataSource;
	let dbPath: string;

	beforeEach(async () => {
		dbPath = path.join(os.tmpdir(), `gauzy-default-rate-${process.pid}-${Date.now()}-${Math.random()}.sqlite3`);
		dataSource = new DataSource({ type: 'better-sqlite3', database: dbPath, synchronize: false, logging: false });
		await dataSource.initialize();
		await dataSource.query('CREATE TABLE "organization" ("id" varchar PRIMARY KEY NOT NULL)');
		await dataSource.query(`INSERT INTO "organization" ("id") VALUES ('organization')`);
	});

	afterEach(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
		fs.rmSync(dbPath, { force: true });
	});

	const column = async (name: string) => {
		const columns = (await dataSource.query(`PRAGMA table_info(organization)`)) as Array<{
			name: string;
			notnull: number;
			type: string;
		}>;
		return columns.find((it) => it.name === name);
	};

	const run = async (direction: 'up' | 'down') => {
		const queryRunner = dataSource.createQueryRunner();
		try {
			await new AddOrganizationDefaultBillRate1791000010000()[direction](queryRunner);
		} finally {
			await queryRunner.release();
		}
	};

	it('adds a nullable numeric(14,2) default rate and a nullable currency, and organizations read none', async () => {
		await run('up');

		expect(await column('defaultBillRateValue')).toMatchObject({ type: 'numeric(14,2)', notnull: 0 });
		expect(await column('defaultBillRateCurrency')).toMatchObject({ type: 'varchar', notnull: 0 });
		const [row] = await dataSource.query(
			`SELECT "defaultBillRateValue" AS "rate", "defaultBillRateCurrency" AS "currency" FROM "organization"`
		);
		expect(row).toEqual({ rate: null, currency: null });
	});

	it('is a no-op when run twice, and keeps the columns on down', async () => {
		await run('up');
		await expect(run('up')).resolves.toBeUndefined();
		await run('down');

		expect(await column('defaultBillRateValue')).toBeDefined();
	});
});

describe('organization default billing rate migration on MySQL', () => {
	it('takes a named lock MySQL accepts and adds both columns', async () => {
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
		const migration = new AddOrganizationDefaultBillRate1791000010000();

		await migration.up(queryRunner);

		expect(migration.mysqlLockName.length).toBeLessThanOrEqual(64);
		expect(queries).toEqual([
			'SELECT GET_LOCK(?, 120) AS `acquired`',
			'ALTER TABLE `organization` ADD COLUMN `defaultBillRateValue` decimal(14,2) NULL',
			'ALTER TABLE `organization` ADD COLUMN `defaultBillRateCurrency` varchar(255) NULL',
			'SELECT RELEASE_LOCK(?)'
		]);
	});
});
