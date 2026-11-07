import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource, QueryRunner } from 'typeorm';
import { AddZitadelSessionRefreshToken1791000006450 } from './migrations/1791000006450-AddZitadelSessionRefreshToken';

/**
 * `zitadel_session.everRefreshTokenEncrypted`, run for real on SQLite against the table as the core `AuthZitadel`
 * migration creates it (its columns, without the foreign keys), and checked statement by statement on Postgres and
 * MySQL: one nullable column, no data step, idempotent, reversible.
 */
describe('zitadel_session.everRefreshTokenEncrypted migration on SQLite', () => {
	let dataSource: DataSource;
	let dbPath: string;

	beforeEach(async () => {
		dbPath = path.join(os.tmpdir(), `gauzy-zitadel-session-${process.pid}-${Date.now()}-${Math.random()}.sqlite3`);
		dataSource = new DataSource({ type: 'better-sqlite3', database: dbPath, synchronize: false, logging: false });
		await dataSource.initialize();
		await dataSource.query(
			`CREATE TABLE "zitadel_session" ("createdAt" datetime NOT NULL DEFAULT (datetime('now')), "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "tenantId" varchar, "sid" varchar NOT NULL, "userId" varchar NOT NULL, "accessTokenId" varchar, "refreshTokenId" varchar)`
		);
		await dataSource.query(`INSERT INTO "zitadel_session" ("id", "sid", "userId") VALUES ('s-1', 'sid-1', 'u-1')`);
	});

	afterEach(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
		fs.rmSync(dbPath, { force: true });
	});

	const column = async () => {
		const columns = (await dataSource.query('PRAGMA table_info(zitadel_session)')) as Array<{
			name: string;
			notnull: number;
			dflt_value: string | null;
			type: string;
		}>;
		return columns.find((it) => it.name === 'everRefreshTokenEncrypted');
	};

	const run = async (direction: 'up' | 'down') => {
		const queryRunner = dataSource.createQueryRunner();
		try {
			await new AddZitadelSessionRefreshToken1791000006450()[direction](queryRunner);
		} finally {
			await queryRunner.release();
		}
	};

	it('adds a nullable text column, and existing sessions keep no token', async () => {
		await run('up');

		const added = await column();
		expect(added).toMatchObject({ notnull: 0, dflt_value: null });
		expect(added.type.toLowerCase()).toBe('text');
		const [existing] = await dataSource.query(
			`SELECT "everRefreshTokenEncrypted" AS "kept" FROM "zitadel_session"`
		);
		expect(existing.kept).toBeNull();
	});

	it('is a no-op when run twice; down keeps the column on SQLite but clears every value', async () => {
		await run('up');
		await expect(run('up')).resolves.toBeUndefined();
		await dataSource.query(`UPDATE "zitadel_session" SET "everRefreshTokenEncrypted" = 'v1:k:sealed'`);

		await run('down');

		expect(await column()).toBeDefined();
		const [row] = await dataSource.query(`SELECT "everRefreshTokenEncrypted" AS "kept" FROM "zitadel_session"`);
		expect(row.kept).toBeNull();
	});

	it('does nothing where the table does not exist (the core migration has not run)', async () => {
		await dataSource.query(`DROP TABLE "zitadel_session"`);
		await expect(run('up')).resolves.toBeUndefined();
		await expect(run('down')).resolves.toBeUndefined();
	});
});

/** A query runner that records statements, for the dialects this suite cannot start. */
function recordingRunner(type: string, hasColumn: boolean, transaction = true) {
	const queries: Array<{ sql: string; parameters?: unknown[] }> = [];
	const queryRunner = {
		connection: { options: { type } },
		isTransactionActive: transaction,
		hasTable: async () => true,
		hasColumn: async () => hasColumn,
		query: async (sql: string, parameters?: unknown[]) => {
			queries.push({ sql, parameters });
			return /GET_LOCK/.test(sql) ? [{ acquired: 1 }] : [];
		}
	} as unknown as QueryRunner;
	return { queryRunner, queries };
}

describe('zitadel_session.everRefreshTokenEncrypted migration on Postgres and MySQL', () => {
	it('Postgres: an advisory lock, then one guarded ALTER; down drops the column', async () => {
		const { queryRunner, queries } = recordingRunner('postgres', false);
		const migration = new AddZitadelSessionRefreshToken1791000006450();
		await migration.up(queryRunner);
		await migration.down(queryRunner);
		expect(queries).toEqual([
			{ sql: 'SELECT pg_advisory_xact_lock($1)', parameters: [1791000006450] },
			{
				sql: 'ALTER TABLE "zitadel_session" ADD COLUMN IF NOT EXISTS "everRefreshTokenEncrypted" text',
				parameters: undefined
			},
			{
				sql: 'ALTER TABLE "zitadel_session" DROP COLUMN IF EXISTS "everRefreshTokenEncrypted"',
				parameters: undefined
			}
		]);
	});

	it('MySQL: a named lock MySQL accepts around the check and a nullable text column; down drops it', async () => {
		const migration = new AddZitadelSessionRefreshToken1791000006450();
		expect(migration.mysqlLockName.length).toBeLessThanOrEqual(64);

		const missing = recordingRunner('mysql', false);
		await migration.up(missing.queryRunner);
		expect(missing.queries.map((q) => q.sql)).toEqual([
			'SELECT GET_LOCK(?, 120) AS `acquired`',
			'ALTER TABLE `zitadel_session` ADD COLUMN `everRefreshTokenEncrypted` text NULL',
			'SELECT RELEASE_LOCK(?)'
		]);

		const present = recordingRunner('mysql', true);
		await migration.up(present.queryRunner);
		await migration.down(present.queryRunner);
		expect(present.queries.map((q) => q.sql)).toEqual([
			'SELECT GET_LOCK(?, 120) AS `acquired`',
			'SELECT RELEASE_LOCK(?)',
			'ALTER TABLE `zitadel_session` DROP COLUMN `everRefreshTokenEncrypted`'
		]);
	});

	it('refuses any other database before running a statement', async () => {
		const { queryRunner, queries } = recordingRunner('mongodb', false);
		await expect(new AddZitadelSessionRefreshToken1791000006450().up(queryRunner)).rejects.toThrow(
			'Unsupported database'
		);
		expect(queries).toEqual([]);
	});
});
