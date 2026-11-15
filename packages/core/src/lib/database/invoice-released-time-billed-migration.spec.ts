import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource, QueryRunner } from 'typeorm';
import { AddInvoiceReleasedTimeBilledAt1791000010600 } from './migrations/1791000010600-AddInvoiceReleasedTimeBilledAt';

/**
 * `invoice.releasedTimeBilledAt`, run for real on SQLite against a minimal fixture of the table: it arrives nullable,
 * so every existing document reads as one whose released time nobody billed again, and keeps changing status as today.
 */
describe('invoice released time billed migration on SQLite', () => {
	let dataSource: DataSource;
	let dbPath: string;

	beforeEach(async () => {
		dbPath = path.join(os.tmpdir(), `gauzy-released-time-${process.pid}-${Date.now()}-${Math.random()}.sqlite3`);
		dataSource = new DataSource({ type: 'better-sqlite3', database: dbPath, synchronize: false, logging: false });
		await dataSource.initialize();
		await dataSource.query('CREATE TABLE "invoice" ("id" varchar PRIMARY KEY NOT NULL, "status" varchar)');
		await dataSource.query(`INSERT INTO "invoice" ("id", "status") VALUES ('voided', 'VOID')`);
	});

	afterEach(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
		fs.rmSync(dbPath, { force: true });
	});

	const column = async (name: string) => {
		const columns = (await dataSource.query(`PRAGMA table_info(invoice)`)) as Array<{
			name: string;
			notnull: number;
			type: string;
		}>;
		return columns.find((it) => it.name === name);
	};

	const run = async (direction: 'up' | 'down') => {
		const queryRunner = dataSource.createQueryRunner();
		try {
			await new AddInvoiceReleasedTimeBilledAt1791000010600()[direction](queryRunner);
		} finally {
			await queryRunner.release();
		}
	};

	it('adds a nullable date, and existing documents read none', async () => {
		await run('up');

		expect(await column('releasedTimeBilledAt')).toMatchObject({ type: 'datetime', notnull: 0 });
		const [row] = await dataSource.query(`SELECT "releasedTimeBilledAt" AS "billedAt" FROM "invoice"`);
		expect(row).toEqual({ billedAt: null });
	});

	it('is a no-op when run twice, keeps the column on down, and runs up again', async () => {
		await run('up');
		await expect(run('up')).resolves.toBeUndefined();
		await run('down');
		await expect(run('up')).resolves.toBeUndefined();

		expect(await column('releasedTimeBilledAt')).toBeDefined();
	});
});

describe('invoice released time billed migration on MySQL', () => {
	it('takes a named lock MySQL accepts, adds the column, and drops it on down', async () => {
		const queries: string[] = [];
		let hasColumn = false;
		const queryRunner = {
			connection: { options: { type: 'mysql' } },
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
		} as unknown as QueryRunner;
		const migration = new AddInvoiceReleasedTimeBilledAt1791000010600();

		await migration.up(queryRunner);
		hasColumn = true;
		await migration.down(queryRunner);

		expect(migration.mysqlLockName.length).toBeLessThanOrEqual(64);
		expect(queries).toEqual([
			'SELECT GET_LOCK(?, 120) AS `acquired`',
			'ALTER TABLE `invoice` ADD COLUMN `releasedTimeBilledAt` datetime NULL',
			'SELECT RELEASE_LOCK(?)',
			'ALTER TABLE `invoice` DROP COLUMN `releasedTimeBilledAt`'
		]);
	});
});
