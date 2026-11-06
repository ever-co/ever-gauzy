import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource, QueryRunner } from 'typeorm';
import { AddProjectAndMemberBillRates1791000004020 } from './migrations/1791000004020-AddProjectAndMemberBillRates';

/**
 * `organization_project.billRateValue` and `organization_project_employee.billRateValue`, run for real on SQLite
 * against minimal fixtures of the tables: both arrive nullable, so every existing project and membership reads "no
 * rate" and the time keeps being priced at the employee's own rate.
 */
describe('project and member bill rate migration on SQLite', () => {
	let dataSource: DataSource;
	let dbPath: string;

	beforeEach(async () => {
		dbPath = path.join(os.tmpdir(), `gauzy-project-rates-${process.pid}-${Date.now()}-${Math.random()}.sqlite3`);
		dataSource = new DataSource({ type: 'better-sqlite3', database: dbPath, synchronize: false, logging: false });
		await dataSource.initialize();
		await dataSource.query('CREATE TABLE "organization_project" ("id" varchar PRIMARY KEY NOT NULL)');
		await dataSource.query('CREATE TABLE "organization_project_employee" ("id" varchar PRIMARY KEY NOT NULL)');
		await dataSource.query(`INSERT INTO "organization_project" ("id") VALUES ('project')`);
		await dataSource.query(`INSERT INTO "organization_project_employee" ("id") VALUES ('membership')`);
	});

	afterEach(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
		fs.rmSync(dbPath, { force: true });
	});

	const rateColumn = async (table: string) => {
		const columns = (await dataSource.query(`PRAGMA table_info(${table})`)) as Array<{
			name: string;
			notnull: number;
			type: string;
		}>;
		return columns.find((it) => it.name === 'billRateValue');
	};

	const run = async (direction: 'up' | 'down') => {
		const queryRunner = dataSource.createQueryRunner();
		try {
			await new AddProjectAndMemberBillRates1791000004020()[direction](queryRunner);
		} finally {
			await queryRunner.release();
		}
	};

	it('adds a nullable numeric(14,2) rate to both tables, and existing rows read no rate', async () => {
		await run('up');

		for (const table of ['organization_project', 'organization_project_employee']) {
			expect(await rateColumn(table)).toMatchObject({ type: 'numeric(14,2)', notnull: 0 });
			const [row] = await dataSource.query(`SELECT "billRateValue" AS "rate" FROM "${table}"`);
			expect(row.rate).toBeNull();
		}
	});

	it('is a no-op when run twice, and keeps the columns on down', async () => {
		await run('up');
		await expect(run('up')).resolves.toBeUndefined();
		await run('down');

		expect(await rateColumn('organization_project')).toBeDefined();
	});
});

describe('project and member bill rate migration on MySQL', () => {
	it('takes a named lock MySQL accepts and adds a decimal(14,2) column to each table', async () => {
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
		const migration = new AddProjectAndMemberBillRates1791000004020();

		await migration.up(queryRunner);

		expect(migration.mysqlLockName.length).toBeLessThanOrEqual(64);
		expect(queries).toEqual([
			'SELECT GET_LOCK(?, 120) AS `acquired`',
			'ALTER TABLE `organization_project` ADD COLUMN `billRateValue` decimal(14,2) NULL',
			'ALTER TABLE `organization_project_employee` ADD COLUMN `billRateValue` decimal(14,2) NULL',
			'SELECT RELEASE_LOCK(?)'
		]);
	});
});
