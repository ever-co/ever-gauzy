import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource, QueryRunner } from 'typeorm';
import { AddOrganizationInvoiceReminders1791000011900 } from './migrations/1791000011900-AddOrganizationInvoiceReminders';

/**
 * `organization.invoiceRemindersEnabled`, run for real on SQLite against a minimal fixture of the table: it arrives as
 * `NOT NULL DEFAULT 0`, so no existing organization starts emailing payment reminders to its clients.
 */
const ORGANIZATION = 'f0000000-0000-4000-8000-000000000001';

describe('organization.invoiceRemindersEnabled migration on SQLite', () => {
	let dataSource: DataSource;
	let dbPath: string;

	beforeEach(async () => {
		dbPath = path.join(
			os.tmpdir(),
			`gauzy-invoice-reminders-${process.pid}-${Date.now()}-${Math.random()}.sqlite3`
		);
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
		return columns.find((it) => it.name === 'invoiceRemindersEnabled');
	};

	const run = async (direction: 'up' | 'down') => {
		const queryRunner = dataSource.createQueryRunner();
		try {
			await new AddOrganizationInvoiceReminders1791000011900()[direction](queryRunner);
		} finally {
			await queryRunner.release();
		}
	};

	it('adds the column as NOT NULL DEFAULT 0, and no existing organization reminds its clients', async () => {
		await run('up');

		expect(await column()).toMatchObject({ type: 'boolean', notnull: 1, dflt_value: '0' });
		const [existing] = await dataSource.query(
			`SELECT "invoiceRemindersEnabled" AS "enabled" FROM "organization" WHERE "id" = ?`,
			[ORGANIZATION]
		);
		expect(existing.enabled).toBe(0);
	});

	it('is a no-op when run twice, and keeps the column on down', async () => {
		await run('up');
		await expect(run('up')).resolves.toBeUndefined();
		await run('down');

		expect(await column()).toBeDefined();
	});
});

describe('organization.invoiceRemindersEnabled migration on MySQL', () => {
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
		const migration = new AddOrganizationInvoiceReminders1791000011900();

		await migration.up(queryRunner);

		expect(migration.mysqlLockName.length).toBeLessThanOrEqual(64);
		expect(queries).toEqual([
			'SELECT GET_LOCK(?, 120) AS `acquired`',
			'ALTER TABLE `organization` ADD COLUMN `invoiceRemindersEnabled` tinyint NOT NULL DEFAULT 0',
			'SELECT RELEASE_LOCK(?)'
		]);
	});
});

describe('organization.invoiceRemindersEnabled migration on Postgres', () => {
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

		await new AddOrganizationInvoiceReminders1791000011900().up(queryRunner);

		expect(queries).toEqual([
			'SELECT pg_advisory_xact_lock($1)',
			'ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "invoiceRemindersEnabled" boolean NOT NULL DEFAULT false'
		]);
	});
});
