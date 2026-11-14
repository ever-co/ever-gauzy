import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource, QueryRunner } from 'typeorm';
import { AddTimeLogStoredRates1791000009400 } from './migrations/1791000009400-AddTimeLogStoredRates';

const RATE_COLUMNS = [
	'billRateValue',
	'billRateCurrency',
	'payRateValue',
	'payRateCurrency',
	'projectBillRateValue',
	'projectMemberBillRateValue',
	'projectBillRateCurrency',
	'ratesStored'
];

/**
 * The rates of `time_log`, run for real on SQLite against a minimal fixture of the tables they are read from: every
 * existing log takes the rates of today and is marked, so every amount reads the same right after the migration.
 */
describe('time log stored rates migration on SQLite', () => {
	let dataSource: DataSource;
	let dbPath: string;

	beforeEach(async () => {
		dbPath = path.join(os.tmpdir(), `gauzy-stored-rates-${process.pid}-${Date.now()}-${Math.random()}.sqlite3`);
		dataSource = new DataSource({ type: 'better-sqlite3', database: dbPath, synchronize: false, logging: false });
		await dataSource.initialize();
		await dataSource.query(
			'CREATE TABLE "employee" ("id" varchar PRIMARY KEY NOT NULL, "billRateValue" numeric(14,2), ' +
				'"billRateCurrency" varchar, "payRateValue" numeric(14,2), "payRateCurrency" varchar)'
		);
		await dataSource.query(
			'CREATE TABLE "organization_project" ("id" varchar PRIMARY KEY NOT NULL, "billRateValue" numeric(14,2), ' +
				'"currency" varchar)'
		);
		await dataSource.query(
			'CREATE TABLE "organization_project_employee" ("id" varchar PRIMARY KEY NOT NULL, ' +
				'"organizationProjectId" varchar, "employeeId" varchar, "billRateValue" numeric(14,2), ' +
				'"isActive" boolean, "isArchived" boolean)'
		);
		await dataSource.query(
			'CREATE TABLE "time_log" ("id" varchar PRIMARY KEY NOT NULL, "employeeId" varchar, "projectId" varchar)'
		);
		// Marie bills 40 USD and is paid 25 EUR; Paul has no rate yet
		await dataSource.query(
			`INSERT INTO "employee" VALUES ('marie', 40, 'USD', 25, 'EUR'), ('paul', NULL, NULL, NULL, NULL)`
		);
		await dataSource.query(
			`INSERT INTO "organization_project" VALUES ('site', 90, 'EUR'), ('internal', NULL, NULL)`
		);
		// Marie's own client rate on the site, and Paul's, left on an archived membership
		await dataSource.query(
			`INSERT INTO "organization_project_employee" VALUES ('m1', 'site', 'marie', 95, 1, 0), ('m2', 'site', 'paul', 70, 1, 1)`
		);
		await dataSource.query(
			`INSERT INTO "time_log" VALUES ('marie-site', 'marie', 'site'), ('paul-site', 'paul', 'site'), ` +
				`('marie-alone', 'marie', NULL), ('marie-internal', 'marie', 'internal')`
		);
	});

	afterEach(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
		fs.rmSync(dbPath, { force: true });
	});

	const columns = async () => {
		const rows = (await dataSource.query(`PRAGMA table_info(time_log)`)) as Array<{ name: string; type: string }>;
		return rows;
	};

	const logOf = async (id: string) => {
		const [row] = await dataSource.query(`SELECT * FROM "time_log" WHERE "id" = ?`, [id]);
		return row;
	};

	const run = async (direction: 'up' | 'down') => {
		const queryRunner = dataSource.createQueryRunner();
		try {
			await new AddTimeLogStoredRates1791000009400()[direction](queryRunner);
		} finally {
			await queryRunner.release();
		}
	};

	it('adds the nullable rate columns and the marker', async () => {
		await run('up');

		const added = (await columns()).filter((column) => RATE_COLUMNS.includes(column.name));
		expect(added.map((column) => [column.name, column.type])).toEqual([
			['billRateValue', 'numeric(14,2)'],
			['billRateCurrency', 'varchar'],
			['payRateValue', 'numeric(14,2)'],
			['payRateCurrency', 'varchar'],
			['projectBillRateValue', 'numeric(14,2)'],
			['projectMemberBillRateValue', 'numeric(14,2)'],
			['projectBillRateCurrency', 'varchar'],
			['ratesStored', 'boolean']
		]);
	});

	it("gives every existing log the rates of today, the membership's only while it is current", async () => {
		await run('up');

		expect(await logOf('marie-site')).toMatchObject({
			billRateValue: 40,
			billRateCurrency: 'USD',
			payRateValue: 25,
			payRateCurrency: 'EUR',
			projectBillRateValue: 90,
			projectMemberBillRateValue: 95,
			projectBillRateCurrency: 'EUR',
			ratesStored: 1
		});
		expect(await logOf('paul-site')).toMatchObject({
			billRateValue: null,
			payRateValue: null,
			projectBillRateValue: 90,
			projectMemberBillRateValue: null,
			ratesStored: 1
		});
		expect(await logOf('marie-alone')).toMatchObject({
			billRateValue: 40,
			projectBillRateValue: null,
			projectMemberBillRateValue: null,
			projectBillRateCurrency: null,
			ratesStored: 1
		});
		expect(await logOf('marie-internal')).toMatchObject({
			projectBillRateValue: null,
			projectMemberBillRateValue: null,
			ratesStored: 1
		});
	});

	it('never refills a log that already stores its rates, and keeps the columns on down', async () => {
		await run('up');
		await dataSource.query(`UPDATE "employee" SET "billRateValue" = 50 WHERE "id" = 'marie'`);

		await run('up');
		await run('down');
		await run('up');

		expect(await logOf('marie-site')).toMatchObject({ billRateValue: 40, ratesStored: 1 });
		expect((await columns()).map((column) => column.name)).toEqual(expect.arrayContaining(RATE_COLUMNS));
	});

	it('fills, on a later run, the logs a cut-short run left without rates', async () => {
		await run('up');
		// A run that stopped after adding the columns (MySQL has no transactional DDL) left this log unfilled
		await dataSource.query(
			`UPDATE "time_log" SET "ratesStored" = NULL, "billRateValue" = NULL, "payRateValue" = NULL WHERE "id" = 'marie-alone'`
		);

		await run('up');

		expect(await logOf('marie-alone')).toMatchObject({ billRateValue: 40, payRateValue: 25, ratesStored: 1 });
		expect(await logOf('marie-site')).toMatchObject({ billRateValue: 40, projectMemberBillRateValue: 95 });
	});
});

/** A query runner that records its statements, on a database whose `time_log` has the columns given. */
function recordingRunner(type: 'mysql' | 'postgres', existingColumns: string[], transactionActive = false) {
	const queries: string[] = [];
	const queryRunner = {
		connection: { options: { type } },
		isTransactionActive: transactionActive,
		hasTable: async () => true,
		hasColumn: async (_table: string, column: string) => existingColumns.includes(column),
		query: async (sql: string) => {
			queries.push(sql);
			if (sql.includes('GET_LOCK')) {
				return [{ acquired: 1 }];
			}
			return [];
		}
	} as unknown as QueryRunner;
	return { queries, queryRunner };
}

describe('time log stored rates migration on MySQL', () => {
	it('adds the columns and fills them under a named lock MySQL accepts', async () => {
		const { queries, queryRunner } = recordingRunner('mysql', []);
		const migration = new AddTimeLogStoredRates1791000009400();

		await migration.up(queryRunner);

		expect(migration.mysqlLockName.length).toBeLessThanOrEqual(64);
		expect(queries[0]).toBe('SELECT GET_LOCK(?, 120) AS `acquired`');
		expect(queries.slice(1, 9)).toEqual([
			'ALTER TABLE `time_log` ADD COLUMN `billRateValue` decimal(14,2) NULL',
			'ALTER TABLE `time_log` ADD COLUMN `billRateCurrency` varchar(255) NULL',
			'ALTER TABLE `time_log` ADD COLUMN `payRateValue` decimal(14,2) NULL',
			'ALTER TABLE `time_log` ADD COLUMN `payRateCurrency` varchar(255) NULL',
			'ALTER TABLE `time_log` ADD COLUMN `projectBillRateValue` decimal(14,2) NULL',
			'ALTER TABLE `time_log` ADD COLUMN `projectMemberBillRateValue` decimal(14,2) NULL',
			'ALTER TABLE `time_log` ADD COLUMN `projectBillRateCurrency` varchar(255) NULL',
			'ALTER TABLE `time_log` ADD COLUMN `ratesStored` tinyint NULL'
		]);
		const fills = queries.filter((sql) => sql.startsWith('UPDATE'));
		expect(fills).toHaveLength(3);
		expect(fills[2]).toContain('`time_log`.`ratesStored` = 1');
		for (const fill of fills) {
			expect(fill).toContain('`time_log`.`ratesStored` IS NULL');
		}
		expect(queries[queries.length - 1]).toBe('SELECT RELEASE_LOCK(?)');
	});

	it('adds no column twice, and still fills the logs that store no rate yet', async () => {
		const { queries, queryRunner } = recordingRunner('mysql', RATE_COLUMNS);

		await new AddTimeLogStoredRates1791000009400().up(queryRunner);

		expect(queries.some((sql) => sql.startsWith('ALTER TABLE'))).toBe(false);
		const fills = queries.filter((sql) => sql.startsWith('UPDATE'));
		expect(fills).toHaveLength(3);
		for (const fill of fills) {
			expect(fill).toContain('`time_log`.`ratesStored` IS NULL');
		}
	});

	it('drops every column on down', async () => {
		const { queries, queryRunner } = recordingRunner('mysql', RATE_COLUMNS);

		await new AddTimeLogStoredRates1791000009400().down(queryRunner);

		expect(queries).toEqual(RATE_COLUMNS.map((column) => `ALTER TABLE \`time_log\` DROP COLUMN \`${column}\``));
	});
});

describe('time log stored rates migration on PostgreSQL', () => {
	it('runs under the advisory lock and fills the rates through joins', async () => {
		const { queries, queryRunner } = recordingRunner('postgres', [], true);

		await new AddTimeLogStoredRates1791000009400().up(queryRunner);

		expect(queries[0]).toBe('SELECT pg_advisory_xact_lock($1)');
		expect(queries.filter((sql) => sql.startsWith('ALTER TABLE'))).toHaveLength(RATE_COLUMNS.length);
		const fills = queries.filter((sql) => sql.startsWith('UPDATE'));
		expect(fills).toHaveLength(3);
		expect(fills[2]).toContain('FROM "employee"');
		expect(fills[1]).toContain('"member"."billRateValue" IS NOT NULL');
	});

	it('drops every column on down', async () => {
		const { queries, queryRunner } = recordingRunner('postgres', RATE_COLUMNS);

		await new AddTimeLogStoredRates1791000009400().down(queryRunner);

		expect(queries).toEqual(
			RATE_COLUMNS.map((column) => `ALTER TABLE "time_log" DROP COLUMN IF EXISTS "${column}"`)
		);
	});
});
