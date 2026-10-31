import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource, QueryRunner } from 'typeorm';
import { AddOrganizationScreenshotCaptureAcknowledgement1791000003660 } from './migrations/1791000003660-AddOrganizationScreenshotCaptureAcknowledgement';

/**
 * The record of the screen capture acknowledgement on `organization` (issue #9872), run for real on SQLite (the demo
 * database) against a minimal fixture of `organization` and `user`: both columns arrive nullable, no existing
 * organization changes (its `allowScreenshotCapture` included), the user reference is a foreign key that clears
 * itself when the user goes, a re-run is a no-op, and `down` keeps the columns on the embedded dialect. The Postgres
 * and MySQL statements are pinned on a recording query runner.
 */
const MIGRATION = AddOrganizationScreenshotCaptureAcknowledgement1791000003660;
const ON = 'f0000000-0000-4000-8000-0000000000a1';
const OFF = 'f0000000-0000-4000-8000-0000000000a2';
const ADMIN = 'f0000000-0000-4000-8000-0000000000b1';

describe('organization screen capture acknowledgement migration on SQLite', () => {
	let dataSource: DataSource;
	let dbPath: string;

	beforeEach(async () => {
		dbPath = path.join(
			os.tmpdir(),
			`gauzy-organization-screenshot-ack-${process.pid}-${Date.now()}-${Math.random()}.sqlite3`
		);
		dataSource = new DataSource({ type: 'better-sqlite3', database: dbPath, synchronize: false, logging: false });
		await dataSource.initialize();
		await dataSource.query('CREATE TABLE "user" ("id" varchar PRIMARY KEY NOT NULL, "email" varchar)');
		await dataSource.query(
			'CREATE TABLE "organization" ("id" varchar PRIMARY KEY NOT NULL, "name" varchar NOT NULL, "allowScreenshotCapture" boolean NOT NULL DEFAULT (1))'
		);
		await dataSource.query(`INSERT INTO "user" ("id", "email") VALUES (?, 'admin@example.com')`, [ADMIN]);
		await dataSource.query(
			`INSERT INTO "organization" ("id", "name", "allowScreenshotCapture") VALUES (?, 'On', 1), (?, 'Off', 0)`,
			[ON, OFF]
		);
	});

	afterEach(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
		fs.rmSync(dbPath, { force: true });
	});

	const columns = async () =>
		(
			(await dataSource.query('PRAGMA table_info(organization)')) as Array<{
				name: string;
				notnull: number;
				dflt_value: string | null;
				type: string;
			}>
		).filter((it) => it.name.startsWith('screenshotCaptureAcknowledged'));

	const run = async (direction: 'up' | 'down') => {
		const queryRunner = dataSource.createQueryRunner();
		try {
			await new MIGRATION()[direction](queryRunner);
		} finally {
			await queryRunner.release();
		}
	};

	it('adds both columns as nullable, without a default', async () => {
		await run('up');

		const added = await columns();
		expect(added.map((it) => ({ name: it.name, type: it.type.toLowerCase(), notnull: it.notnull }))).toEqual([
			{ name: 'screenshotCaptureAcknowledgedAt', type: 'datetime', notnull: 0 },
			{ name: 'screenshotCaptureAcknowledgedByUserId', type: 'varchar', notnull: 0 }
		]);
		expect(added.every((it) => it.dflt_value === null)).toBe(true);
	});

	it('changes no existing organization: each keeps its screen capture value and has no record', async () => {
		await run('up');

		const rows = await dataSource.query(
			`SELECT "id", "allowScreenshotCapture", "screenshotCaptureAcknowledgedAt", "screenshotCaptureAcknowledgedByUserId" FROM "organization" ORDER BY "name"`
		);
		expect(rows).toEqual([
			{
				id: OFF,
				allowScreenshotCapture: 0,
				screenshotCaptureAcknowledgedAt: null,
				screenshotCaptureAcknowledgedByUserId: null
			},
			{
				id: ON,
				allowScreenshotCapture: 1,
				screenshotCaptureAcknowledgedAt: null,
				screenshotCaptureAcknowledgedByUserId: null
			}
		]);
	});

	it('references the user with a foreign key that clears itself when the user is deleted', async () => {
		await run('up');

		const [foreignKey] = await dataSource.query('PRAGMA foreign_key_list(organization)');
		expect(foreignKey).toMatchObject({
			table: 'user',
			from: 'screenshotCaptureAcknowledgedByUserId',
			to: 'id',
			on_delete: 'SET NULL'
		});

		await dataSource.query(
			`UPDATE "organization" SET "screenshotCaptureAcknowledgedAt" = datetime('now'), "screenshotCaptureAcknowledgedByUserId" = ? WHERE "id" = ?`,
			[ADMIN, ON]
		);
		await expect(
			dataSource.query(
				`UPDATE "organization" SET "screenshotCaptureAcknowledgedByUserId" = 'nobody' WHERE "id" = ?`,
				[ON]
			)
		).rejects.toThrow(/FOREIGN KEY/);

		await dataSource.query(`DELETE FROM "user" WHERE "id" = ?`, [ADMIN]);
		const [row] = await dataSource.query(
			`SELECT "screenshotCaptureAcknowledgedAt", "screenshotCaptureAcknowledgedByUserId" FROM "organization" WHERE "id" = ?`,
			[ON]
		);
		expect(row.screenshotCaptureAcknowledgedByUserId).toBeNull();
		// When it was acknowledged is history, and stays.
		expect(row.screenshotCaptureAcknowledgedAt).not.toBeNull();
	});

	it('is a no-op when run twice', async () => {
		await run('up');
		await expect(run('up')).resolves.toBeUndefined();
		expect(await columns()).toHaveLength(2);
	});

	it('keeps the columns on down (the embedded dialect keeps additive columns)', async () => {
		await run('up');
		await run('down');
		expect(await columns()).toHaveLength(2);
	});

	it('changes nothing on a database without the table', async () => {
		await dataSource.query('DROP TABLE "organization"');

		await expect(run('up')).resolves.toBeUndefined();
	});
});

/** A query runner that records what it is asked to run. */
function recordingRunner(type: 'postgres' | 'mysql', { hasColumn = false, hasForeignKey = false } = {}) {
	const queries: Array<{ sql: string; parameters?: unknown[] }> = [];
	const queryRunner = {
		connection: { options: { type } },
		isTransactionActive: true,
		hasTable: async () => true,
		hasColumn: async () => hasColumn,
		getTable: async () => ({
			foreignKeys: hasForeignKey ? [{ name: 'FK_fc68b0554abdb810ac724ee4059' }] : []
		}),
		query: async (sql: string, parameters?: unknown[]) => {
			queries.push({ sql, parameters });
			return sql.includes('GET_LOCK') ? [{ acquired: 1 }] : [];
		}
	} as unknown as QueryRunner;
	return { queries, queryRunner };
}

describe('organization screen capture acknowledgement migration on Postgres', () => {
	it('takes the advisory lock, adds the columns when missing, then the foreign key', async () => {
		const { queries, queryRunner } = recordingRunner('postgres');

		await new MIGRATION().up(queryRunner);

		expect(queries).toEqual([
			{ sql: 'SELECT pg_advisory_xact_lock($1)', parameters: [1791000003660] },
			{
				sql: 'ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "screenshotCaptureAcknowledgedAt" TIMESTAMP',
				parameters: undefined
			},
			{
				sql: 'ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "screenshotCaptureAcknowledgedByUserId" uuid',
				parameters: undefined
			},
			{
				sql: 'ALTER TABLE "organization" ADD CONSTRAINT "FK_fc68b0554abdb810ac724ee4059" FOREIGN KEY ("screenshotCaptureAcknowledgedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION',
				parameters: undefined
			}
		]);
	});

	it('does not add the foreign key twice', async () => {
		const { queries, queryRunner } = recordingRunner('postgres', { hasForeignKey: true });

		await new MIGRATION().up(queryRunner);

		expect(queries.some((query) => query.sql.includes('ADD CONSTRAINT'))).toBe(false);
	});

	it('never backfills nor touches allowScreenshotCapture', async () => {
		const { queries, queryRunner } = recordingRunner('postgres');

		await new MIGRATION().up(queryRunner);

		// (`ON UPDATE NO ACTION` is the foreign key's clause, not a statement.)
		expect(queries.some((query) => /^\s*UPDATE\b|allowScreenshotCapture/.test(query.sql))).toBe(false);
	});

	it('drops the foreign key, then the columns, on down', async () => {
		const { queries, queryRunner } = recordingRunner('postgres');

		await new MIGRATION().down(queryRunner);

		expect(queries.map((query) => query.sql)).toEqual([
			'ALTER TABLE "organization" DROP CONSTRAINT IF EXISTS "FK_fc68b0554abdb810ac724ee4059"',
			'ALTER TABLE "organization" DROP COLUMN IF EXISTS "screenshotCaptureAcknowledgedByUserId"',
			'ALTER TABLE "organization" DROP COLUMN IF EXISTS "screenshotCaptureAcknowledgedAt"'
		]);
	});
});

describe('organization screen capture acknowledgement migration on MySQL', () => {
	it('takes a named lock MySQL accepts (at most 64 characters), adds the columns, then the foreign key', async () => {
		const { queries, queryRunner } = recordingRunner('mysql');
		const migration = new MIGRATION();

		await migration.up(queryRunner);

		expect(migration.mysqlLockName.length).toBeLessThanOrEqual(64);
		expect(queries.map((query) => query.sql)).toEqual([
			'SELECT GET_LOCK(?, 120) AS `acquired`',
			'ALTER TABLE `organization` ADD COLUMN `screenshotCaptureAcknowledgedAt` datetime NULL',
			'ALTER TABLE `organization` ADD COLUMN `screenshotCaptureAcknowledgedByUserId` varchar(255) NULL',
			'ALTER TABLE `organization` ADD CONSTRAINT `FK_fc68b0554abdb810ac724ee4059` FOREIGN KEY (`screenshotCaptureAcknowledgedByUserId`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION',
			'SELECT RELEASE_LOCK(?)'
		]);
		expect(queries[0].parameters).toEqual([migration.mysqlLockName]);
	});

	it('adds nothing when the columns and the foreign key are already there', async () => {
		const { queries, queryRunner } = recordingRunner('mysql', { hasColumn: true, hasForeignKey: true });

		await new MIGRATION().up(queryRunner);

		expect(queries.map((query) => query.sql)).toEqual([
			'SELECT GET_LOCK(?, 120) AS `acquired`',
			'SELECT RELEASE_LOCK(?)'
		]);
	});

	it('releases the lock when a statement fails', async () => {
		const { queries, queryRunner } = recordingRunner('mysql');
		const query = queryRunner.query.bind(queryRunner);
		(queryRunner as { query: unknown }).query = async (sql: string, parameters?: unknown[]) => {
			if (sql.includes('ADD COLUMN')) throw new Error('boom');
			return query(sql, parameters);
		};

		await expect(new MIGRATION().up(queryRunner)).rejects.toThrow('boom');
		expect(queries.map((it) => it.sql).pop()).toBe('SELECT RELEASE_LOCK(?)');
	});

	it('drops the foreign key, then the columns, on down', async () => {
		const { queries, queryRunner } = recordingRunner('mysql', { hasColumn: true, hasForeignKey: true });

		await new MIGRATION().down(queryRunner);

		expect(queries.map((query) => query.sql)).toEqual([
			'ALTER TABLE `organization` DROP FOREIGN KEY `FK_fc68b0554abdb810ac724ee4059`',
			'ALTER TABLE `organization` DROP COLUMN `screenshotCaptureAcknowledgedByUserId`',
			'ALTER TABLE `organization` DROP COLUMN `screenshotCaptureAcknowledgedAt`'
		]);
	});
});
