import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource, QueryRunner } from 'typeorm';
import { AddEmailSentRetryColumns1791000019950 } from './migrations/1791000019950-AddEmailSentRetryColumns';

/**
 * The retry columns of `email_sent`, run for real on SQLite against a minimal fixture of the table: they arrive
 * nullable with no default, and an email filed before the migration, even a failed one, has no retry due (nothing is
 * backfilled), so deploying the migration sends no old email.
 */
const FAILED_EMAIL = 'e0000000-0000-4000-8000-000000000001';
const SENT_EMAIL = 'e0000000-0000-4000-8000-000000000002';
const NEW_COLUMNS = ['retryCount', 'nextRetryAt', 'lastErrorCode'];

describe('email_sent retry columns migration on SQLite', () => {
	let dataSource: DataSource;
	let dbPath: string;

	beforeEach(async () => {
		dbPath = path.join(os.tmpdir(), `gauzy-email-sent-retry-${process.pid}-${Date.now()}-${Math.random()}.sqlite3`);
		dataSource = new DataSource({ type: 'better-sqlite3', database: dbPath, synchronize: false, logging: false });
		await dataSource.initialize();
		await dataSource.query(
			'CREATE TABLE "email_sent" ("id" varchar PRIMARY KEY NOT NULL, "name" varchar, "content" varchar, "email" varchar NOT NULL, "status" varchar, "emailTemplateId" varchar NOT NULL)'
		);
		await dataSource.query(
			`INSERT INTO "email_sent" ("id", "name", "content", "email", "status", "emailTemplateId") VALUES (?, NULL, NULL, 'ada@example.test', 'FAILED', 't'), (?, 'Welcome', '<p>Welcome</p>', 'bob@example.test', 'SENT', 't')`,
			[FAILED_EMAIL, SENT_EMAIL]
		);
	});

	afterEach(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
		fs.rmSync(dbPath, { force: true });
	});

	const columns = async () =>
		(await dataSource.query('PRAGMA table_info(email_sent)')) as Array<{
			name: string;
			notnull: number;
			dflt_value: string | null;
			type: string;
		}>;

	const run = async (direction: 'up' | 'down') => {
		const queryRunner = dataSource.createQueryRunner();
		try {
			await new AddEmailSentRetryColumns1791000019950()[direction](queryRunner);
		} finally {
			await queryRunner.release();
		}
	};

	it('adds the three columns as nullable with no default, and backfills nothing', async () => {
		await run('up');

		expect((await columns()).filter((it) => NEW_COLUMNS.includes(it.name))).toEqual([
			expect.objectContaining({
				name: 'retryCount',
				type: expect.stringMatching(/^integer$/i),
				notnull: 0,
				dflt_value: null
			}),
			expect.objectContaining({
				name: 'nextRetryAt',
				type: expect.stringMatching(/^datetime$/i),
				notnull: 0,
				dflt_value: null
			}),
			expect.objectContaining({
				name: 'lastErrorCode',
				type: expect.stringMatching(/^varchar$/i),
				notnull: 0,
				dflt_value: null
			})
		]);
		const rows = await dataSource.query(
			`SELECT "id", "status", "content", "retryCount", "nextRetryAt", "lastErrorCode" FROM "email_sent" ORDER BY "id"`
		);
		expect(rows).toEqual([
			{
				id: FAILED_EMAIL,
				status: 'FAILED',
				content: null,
				retryCount: null,
				nextRetryAt: null,
				lastErrorCode: null
			},
			{
				id: SENT_EMAIL,
				status: 'SENT',
				content: '<p>Welcome</p>',
				retryCount: null,
				nextRetryAt: null,
				lastErrorCode: null
			}
		]);
	});

	it('runs up, down and up again: a no-op the second time, and the columns kept on down', async () => {
		await run('up');
		await expect(run('up')).resolves.toBeUndefined();
		await run('down');
		expect((await columns()).map((it) => it.name)).toEqual(expect.arrayContaining(NEW_COLUMNS));
		await expect(run('up')).resolves.toBeUndefined();

		const names = (await columns()).map((it) => it.name);
		expect(names.filter((name) => NEW_COLUMNS.includes(name))).toEqual(NEW_COLUMNS);
		expect(await dataSource.query(`SELECT COUNT(*) AS "count" FROM "email_sent"`)).toEqual([{ count: 2 }]);
	});

	it('changes nothing when the table is not there', async () => {
		await dataSource.query('DROP TABLE "email_sent"');

		await expect(run('up')).resolves.toBeUndefined();
		await expect(run('down')).resolves.toBeUndefined();
	});
});

describe('email_sent retry columns migration on MySQL', () => {
	function mysqlRunner(existing: string[]) {
		const queries: string[] = [];
		const queryRunner = {
			connection: { options: { type: 'mysql' } },
			hasTable: async () => true,
			hasColumn: async (_table: string, column: string) => existing.includes(column),
			query: async (sql: string) => {
				queries.push(sql);
				return sql.includes('GET_LOCK') ? [{ acquired: 1 }] : [];
			}
		} as unknown as QueryRunner;
		return { queries, queryRunner };
	}

	it('takes a named lock MySQL accepts and adds the columns', async () => {
		const { queries, queryRunner } = mysqlRunner([]);
		const migration = new AddEmailSentRetryColumns1791000019950();

		await migration.up(queryRunner);

		expect(migration.mysqlLockName.length).toBeLessThanOrEqual(64);
		expect(queries).toEqual([
			'SELECT GET_LOCK(?, 120) AS `acquired`',
			'ALTER TABLE `email_sent` ADD COLUMN `retryCount` int NULL',
			'ALTER TABLE `email_sent` ADD COLUMN `nextRetryAt` datetime NULL',
			'ALTER TABLE `email_sent` ADD COLUMN `lastErrorCode` varchar(255) NULL',
			'SELECT RELEASE_LOCK(?)'
		]);
	});

	it('adds only what a first run left out, and drops the columns on down', async () => {
		const { queries, queryRunner } = mysqlRunner(['retryCount', 'nextRetryAt']);

		await new AddEmailSentRetryColumns1791000019950().up(queryRunner);
		await new AddEmailSentRetryColumns1791000019950().down(queryRunner);

		expect(queries).toEqual([
			'SELECT GET_LOCK(?, 120) AS `acquired`',
			'ALTER TABLE `email_sent` ADD COLUMN `lastErrorCode` varchar(255) NULL',
			'SELECT RELEASE_LOCK(?)',
			'ALTER TABLE `email_sent` DROP COLUMN `retryCount`',
			'ALTER TABLE `email_sent` DROP COLUMN `nextRetryAt`'
		]);
	});

	it('releases its lock when a statement fails', async () => {
		const { queries, queryRunner } = mysqlRunner([]);
		const failing = queryRunner as unknown as { query: (sql: string) => Promise<unknown> };
		const query = failing.query;
		failing.query = async (sql: string) => {
			if (sql.startsWith('ALTER')) throw new Error('lock wait timeout');
			return query(sql);
		};

		await expect(new AddEmailSentRetryColumns1791000019950().up(queryRunner)).rejects.toThrow('lock wait timeout');
		expect(queries[queries.length - 1]).toBe('SELECT RELEASE_LOCK(?)');
	});
});

describe('email_sent retry columns migration on Postgres', () => {
	it('serialises concurrent runs, adds the columns only when they are missing, and drops them on down', async () => {
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

		await new AddEmailSentRetryColumns1791000019950().up(queryRunner);
		await new AddEmailSentRetryColumns1791000019950().down(queryRunner);

		expect(queries).toEqual([
			'SELECT pg_advisory_xact_lock($1)',
			'ALTER TABLE "email_sent" ADD COLUMN IF NOT EXISTS "retryCount" integer',
			'ALTER TABLE "email_sent" ADD COLUMN IF NOT EXISTS "nextRetryAt" TIMESTAMP',
			'ALTER TABLE "email_sent" ADD COLUMN IF NOT EXISTS "lastErrorCode" character varying',
			'ALTER TABLE "email_sent" DROP COLUMN IF EXISTS "retryCount"',
			'ALTER TABLE "email_sent" DROP COLUMN IF EXISTS "nextRetryAt"',
			'ALTER TABLE "email_sent" DROP COLUMN IF EXISTS "lastErrorCode"'
		]);
	});

	it('refuses a database it was not written for before running anything', async () => {
		const query = jest.fn();
		const queryRunner = {
			connection: { options: { type: 'mssql' } },
			hasTable: async () => true,
			query
		} as unknown as QueryRunner;

		await expect(new AddEmailSentRetryColumns1791000019950().up(queryRunner)).rejects.toThrow(
			'Unsupported database'
		);
		expect(query).not.toHaveBeenCalled();
	});
});
