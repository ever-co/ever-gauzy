import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource, QueryRunner } from 'typeorm';
import { AddEmployeePayRate1791000004300 } from './migrations/1791000004300-AddEmployeePayRate';

/**
 * `employee.payRateValue` and `employee.payRateCurrency`, run for real on SQLite against a minimal fixture of the
 * table: both arrive nullable, so every existing employee reads "no pay rate" and what they are owed stays priced at
 * their billing rate.
 */
describe('employee pay rate migration on SQLite', () => {
	let dataSource: DataSource;
	let dbPath: string;

	beforeEach(async () => {
		dbPath = path.join(os.tmpdir(), `gauzy-pay-rate-${process.pid}-${Date.now()}-${Math.random()}.sqlite3`);
		dataSource = new DataSource({ type: 'better-sqlite3', database: dbPath, synchronize: false, logging: false });
		await dataSource.initialize();
		await dataSource.query('CREATE TABLE "employee" ("id" varchar PRIMARY KEY NOT NULL)');
		await dataSource.query(`INSERT INTO "employee" ("id") VALUES ('employee')`);
	});

	afterEach(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
		fs.rmSync(dbPath, { force: true });
	});

	const column = async (name: string) => {
		const columns = (await dataSource.query(`PRAGMA table_info(employee)`)) as Array<{
			name: string;
			notnull: number;
			type: string;
		}>;
		return columns.find((it) => it.name === name);
	};

	const run = async (direction: 'up' | 'down') => {
		const queryRunner = dataSource.createQueryRunner();
		try {
			await new AddEmployeePayRate1791000004300()[direction](queryRunner);
		} finally {
			await queryRunner.release();
		}
	};

	it('adds a nullable numeric(14,2) pay rate and a nullable currency, and existing employees read none', async () => {
		await run('up');

		expect(await column('payRateValue')).toMatchObject({ type: 'numeric(14,2)', notnull: 0 });
		expect(await column('payRateCurrency')).toMatchObject({ type: 'varchar', notnull: 0 });
		const [row] = await dataSource.query(
			`SELECT "payRateValue" AS "rate", "payRateCurrency" AS "currency" FROM "employee"`
		);
		expect(row).toEqual({ rate: null, currency: null });
	});

	it('is a no-op when run twice, and keeps the columns on down', async () => {
		await run('up');
		await expect(run('up')).resolves.toBeUndefined();
		await run('down');

		expect(await column('payRateValue')).toBeDefined();
	});
});

describe('employee pay rate migration on MySQL', () => {
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
		const migration = new AddEmployeePayRate1791000004300();

		await migration.up(queryRunner);

		expect(migration.mysqlLockName.length).toBeLessThanOrEqual(64);
		expect(queries).toEqual([
			'SELECT GET_LOCK(?, 120) AS `acquired`',
			'ALTER TABLE `employee` ADD COLUMN `payRateValue` decimal(14,2) NULL',
			'ALTER TABLE `employee` ADD COLUMN `payRateCurrency` varchar(255) NULL',
			'SELECT RELEASE_LOCK(?)'
		]);
	});
});
