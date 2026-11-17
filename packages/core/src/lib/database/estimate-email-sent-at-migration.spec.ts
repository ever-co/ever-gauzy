import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource, QueryRunner } from 'typeorm';
import { AddEstimateEmailSentAt1791000019300 } from './migrations/1791000019300-AddEstimateEmailSentAt';

/**
 * `estimate_email.sentAt`, run for real on SQLite against a minimal fixture of the table: it arrives nullable, and an
 * email row written before the migration, even one that names its invoice, reads as an attempt (nothing is backfilled).
 */
const EMAIL = 'e0000000-0000-4000-8000-000000000001';
const INVOICE = 'e0000000-0000-4000-8000-000000000002';

describe('estimate_email sentAt migration on SQLite', () => {
	let dataSource: DataSource;
	let dbPath: string;

	beforeEach(async () => {
		dbPath = path.join(os.tmpdir(), `gauzy-estimate-email-sent-at-${process.pid}-${Date.now()}-${Math.random()}.sqlite3`);
		dataSource = new DataSource({ type: 'better-sqlite3', database: dbPath, synchronize: false, logging: false });
		await dataSource.initialize();
		await dataSource.query(
			'CREATE TABLE "estimate_email" ("id" varchar PRIMARY KEY NOT NULL, "email" varchar NOT NULL, "invoiceId" varchar)'
		);
		await dataSource.query(
			`INSERT INTO "estimate_email" ("id", "email", "invoiceId") VALUES (?, 'client@example.com', ?)`,
			[EMAIL, INVOICE]
		);
	});

	afterEach(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
		fs.rmSync(dbPath, { force: true });
	});

	const columns = async () =>
		(await dataSource.query('PRAGMA table_info(estimate_email)')) as Array<{
			name: string;
			notnull: number;
			dflt_value: string | null;
			type: string;
		}>;

	const run = async (direction: 'up' | 'down') => {
		const queryRunner = dataSource.createQueryRunner();
		try {
			await new AddEstimateEmailSentAt1791000019300()[direction](queryRunner);
		} finally {
			await queryRunner.release();
		}
	};

	it('adds the column as nullable, and an earlier row that names its invoice is not taken for a delivery', async () => {
		await run('up');

		expect((await columns()).filter((it) => it.name === 'sentAt')).toEqual([
			expect.objectContaining({ name: 'sentAt', type: 'datetime', notnull: 0, dflt_value: null })
		]);
		const [earlier] = await dataSource.query(`SELECT "invoiceId", "sentAt" FROM "estimate_email" WHERE "id" = ?`, [
			EMAIL
		]);
		expect(earlier).toEqual({ invoiceId: INVOICE, sentAt: null });
	});

	it('is a no-op when run twice, and keeps the column on down', async () => {
		await run('up');
		await expect(run('up')).resolves.toBeUndefined();
		await run('down');

		expect((await columns()).map((it) => it.name)).toContain('sentAt');
	});

	it('changes nothing when the table is not there', async () => {
		await dataSource.query('DROP TABLE "estimate_email"');

		await expect(run('up')).resolves.toBeUndefined();
	});
});

describe('estimate_email sentAt migration on MySQL', () => {
	function mysqlRunner(hasColumn: boolean) {
		const queries: string[] = [];
		const queryRunner = {
			connection: { options: { type: 'mysql' } },
			hasTable: async () => true,
			hasColumn: async () => hasColumn,
			query: async (sql: string) => {
				queries.push(sql);
				return sql.includes('GET_LOCK') ? [{ acquired: 1 }] : [];
			}
		} as unknown as QueryRunner;
		return { queries, queryRunner };
	}

	it('takes a named lock MySQL accepts and adds the column', async () => {
		const { queries, queryRunner } = mysqlRunner(false);
		const migration = new AddEstimateEmailSentAt1791000019300();

		await migration.up(queryRunner);

		expect(migration.mysqlLockName.length).toBeLessThanOrEqual(64);
		expect(queries).toEqual([
			'SELECT GET_LOCK(?, 120) AS `acquired`',
			'ALTER TABLE `estimate_email` ADD COLUMN `sentAt` datetime NULL',
			'SELECT RELEASE_LOCK(?)'
		]);
	});

	it('adds nothing a first run already added, and drops the column on down', async () => {
		const { queries, queryRunner } = mysqlRunner(true);

		await new AddEstimateEmailSentAt1791000019300().up(queryRunner);
		await new AddEstimateEmailSentAt1791000019300().down(queryRunner);

		expect(queries).toEqual([
			'SELECT GET_LOCK(?, 120) AS `acquired`',
			'SELECT RELEASE_LOCK(?)',
			'ALTER TABLE `estimate_email` DROP COLUMN `sentAt`'
		]);
	});
});

describe('estimate_email sentAt migration on Postgres', () => {
	it('serialises concurrent runs, adds the column only when it is missing, and drops it on down', async () => {
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

		await new AddEstimateEmailSentAt1791000019300().up(queryRunner);
		await new AddEstimateEmailSentAt1791000019300().down(queryRunner);

		expect(queries).toEqual([
			'SELECT pg_advisory_xact_lock($1)',
			'ALTER TABLE "estimate_email" ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP',
			'ALTER TABLE "estimate_email" DROP COLUMN IF EXISTS "sentAt"'
		]);
	});
});
