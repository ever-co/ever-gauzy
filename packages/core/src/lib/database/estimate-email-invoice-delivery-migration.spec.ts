import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource, QueryRunner } from 'typeorm';
import { AddEstimateEmailInvoiceDelivery1791000011910 } from './migrations/1791000011910-AddEstimateEmailInvoiceDelivery';

/**
 * `estimate_email.invoiceId` and `estimate_email.languageCode`, run for real on SQLite against a minimal fixture of the
 * table: both arrive nullable, with the index the payment reminders read an invoice's emails through, and an email sent
 * before the migration records no invoice.
 */
const EMAIL = 'e0000000-0000-4000-8000-000000000001';

describe('estimate_email invoice delivery migration on SQLite', () => {
	let dataSource: DataSource;
	let dbPath: string;

	beforeEach(async () => {
		dbPath = path.join(
			os.tmpdir(),
			`gauzy-estimate-email-delivery-${process.pid}-${Date.now()}-${Math.random()}.sqlite3`
		);
		dataSource = new DataSource({ type: 'better-sqlite3', database: dbPath, synchronize: false, logging: false });
		await dataSource.initialize();
		await dataSource.query(
			'CREATE TABLE "estimate_email" ("id" varchar PRIMARY KEY NOT NULL, "email" varchar NOT NULL)'
		);
		await dataSource.query(`INSERT INTO "estimate_email" ("id", "email") VALUES (?, 'client@example.com')`, [
			EMAIL
		]);
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

	const indexes = async () =>
		((await dataSource.query('PRAGMA index_list(estimate_email)')) as Array<{ name: string }>).map((it) => it.name);

	const run = async (direction: 'up' | 'down') => {
		const queryRunner = dataSource.createQueryRunner();
		try {
			await new AddEstimateEmailInvoiceDelivery1791000011910()[direction](queryRunner);
		} finally {
			await queryRunner.release();
		}
	};

	it('adds both columns as nullable, with the index, and an earlier email records no invoice', async () => {
		await run('up');

		const added = (await columns()).filter((it) => ['invoiceId', 'languageCode'].includes(it.name));
		expect(added).toEqual([
			expect.objectContaining({ name: 'invoiceId', type: 'varchar', notnull: 0, dflt_value: null }),
			expect.objectContaining({ name: 'languageCode', type: 'varchar', notnull: 0, dflt_value: null })
		]);
		expect(await indexes()).toContain('IDX_estimate_email_invoice');
		const [earlier] = await dataSource.query(
			`SELECT "invoiceId", "languageCode" FROM "estimate_email" WHERE "id" = ?`,
			[EMAIL]
		);
		expect(earlier).toEqual({ invoiceId: null, languageCode: null });
	});

	it('is a no-op when run twice, and keeps the columns on down', async () => {
		await run('up');
		await expect(run('up')).resolves.toBeUndefined();
		await run('down');

		expect((await columns()).map((it) => it.name)).toEqual(expect.arrayContaining(['invoiceId', 'languageCode']));
	});
});

describe('estimate_email invoice delivery migration on MySQL', () => {
	it('takes a named lock MySQL accepts, adds both columns and the index', async () => {
		const queries: string[] = [];
		const queryRunner = {
			connection: { options: { type: 'mysql' } },
			hasTable: async () => true,
			hasColumn: async () => false,
			getTable: async () => ({ indices: [] }),
			query: async (sql: string) => {
				queries.push(sql);
				return sql.includes('GET_LOCK') ? [{ acquired: 1 }] : [];
			}
		} as unknown as QueryRunner;
		const migration = new AddEstimateEmailInvoiceDelivery1791000011910();

		await migration.up(queryRunner);

		expect(migration.mysqlLockName.length).toBeLessThanOrEqual(64);
		expect(queries).toEqual([
			'SELECT GET_LOCK(?, 120) AS `acquired`',
			'ALTER TABLE `estimate_email` ADD COLUMN `invoiceId` varchar(36) NULL',
			'ALTER TABLE `estimate_email` ADD COLUMN `languageCode` varchar(255) NULL',
			'CREATE INDEX `IDX_estimate_email_invoice` ON `estimate_email` (`invoiceId`)',
			'SELECT RELEASE_LOCK(?)'
		]);
	});

	it('adds nothing a first run already added', async () => {
		const queries: string[] = [];
		const queryRunner = {
			connection: { options: { type: 'mysql' } },
			hasTable: async () => true,
			hasColumn: async () => true,
			getTable: async () => ({ indices: [{ name: 'IDX_estimate_email_invoice' }] }),
			query: async (sql: string) => {
				queries.push(sql);
				return sql.includes('GET_LOCK') ? [{ acquired: 1 }] : [];
			}
		} as unknown as QueryRunner;

		await new AddEstimateEmailInvoiceDelivery1791000011910().up(queryRunner);

		expect(queries).toEqual(['SELECT GET_LOCK(?, 120) AS `acquired`', 'SELECT RELEASE_LOCK(?)']);
	});
});

describe('estimate_email invoice delivery migration on Postgres', () => {
	it('serialises concurrent runs and adds the columns and the index only when they are missing', async () => {
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

		await new AddEstimateEmailInvoiceDelivery1791000011910().up(queryRunner);

		expect(queries).toEqual([
			'SELECT pg_advisory_xact_lock($1)',
			'ALTER TABLE "estimate_email" ADD COLUMN IF NOT EXISTS "invoiceId" uuid',
			'ALTER TABLE "estimate_email" ADD COLUMN IF NOT EXISTS "languageCode" character varying',
			'CREATE INDEX IF NOT EXISTS "IDX_estimate_email_invoice" ON "estimate_email" ("invoiceId")'
		]);
	});
});
