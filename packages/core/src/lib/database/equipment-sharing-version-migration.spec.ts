import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource, QueryRunner } from 'typeorm';
import { AddEquipmentSharingVersion1791000003320 } from './migrations/1791000003320-AddEquipmentSharingVersion';

/**
 * `equipment_sharing.version`, run for real on SQLite (the demo database) against a minimal fixture of the table: it
 * arrives as `NOT NULL DEFAULT 1`, existing sharings read version 1, a re-run is a no-op, and `down` keeps the column
 * on the embedded dialect. The Postgres and MySQL statements are pinned on a recording query runner.
 */
const SHARING = 'f0000000-0000-4000-8000-0000000000e1';

describe('equipment_sharing.version migration on SQLite', () => {
	let dataSource: DataSource;
	let dbPath: string;

	beforeEach(async () => {
		dbPath = path.join(
			os.tmpdir(),
			`gauzy-equipment-sharing-version-${process.pid}-${Date.now()}-${Math.random()}.sqlite3`
		);
		dataSource = new DataSource({ type: 'better-sqlite3', database: dbPath, synchronize: false, logging: false });
		await dataSource.initialize();
		await dataSource.query(
			'CREATE TABLE "equipment_sharing" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "name" varchar, "status" integer NOT NULL)'
		);
		await dataSource.query(`INSERT INTO "equipment_sharing" ("id", "name", "status") VALUES (?, 'Existing', 1)`, [
			SHARING
		]);
	});

	afterEach(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
		fs.rmSync(dbPath, { force: true });
	});

	const column = async () =>
		(
			(await dataSource.query('PRAGMA table_info(equipment_sharing)')) as Array<{
				name: string;
				notnull: number;
				dflt_value: string | null;
				type: string;
			}>
		).find((it) => it.name === 'version');

	const run = async (direction: 'up' | 'down') => {
		const queryRunner = dataSource.createQueryRunner();
		try {
			await new AddEquipmentSharingVersion1791000003320()[direction](queryRunner);
		} finally {
			await queryRunner.release();
		}
	};

	it('adds the column as NOT NULL DEFAULT 1, and existing sharings read version 1', async () => {
		await run('up');

		// SQLite type names are case-insensitive, and the bundled SQLite reports this one as `INTEGER`.
		const added = await column();
		expect({ ...added, type: added?.type.toLowerCase() }).toMatchObject({
			type: 'integer',
			notnull: 1,
			dflt_value: '1'
		});
		const [existing] = await dataSource.query(`SELECT "version" FROM "equipment_sharing" WHERE "id" = ?`, [
			SHARING
		]);
		expect(existing.version).toBe(1);

		await dataSource.query(`INSERT INTO "equipment_sharing" ("id", "status") VALUES ('new', 1)`);
		const [created] = await dataSource.query(`SELECT "version" FROM "equipment_sharing" WHERE "id" = 'new'`);
		expect(created.version).toBe(1);
	});

	it('makes a compare-and-set on the version exclusive', async () => {
		await run('up');

		const write = async (expected: number) =>
			await dataSource.query(
				`UPDATE "equipment_sharing" SET "name" = 'Edited', "version" = "version" + 1 WHERE "id" = ? AND "version" = ?`,
				[SHARING, expected]
			);
		await write(1);
		await write(1);

		const [row] = await dataSource.query(`SELECT "name", "version" FROM "equipment_sharing" WHERE "id" = ?`, [
			SHARING
		]);
		expect(row).toEqual({ name: 'Edited', version: 2 });
	});

	it('is a no-op when run twice', async () => {
		await run('up');
		await expect(run('up')).resolves.toBeUndefined();
		expect(await column()).toBeDefined();
	});

	it('keeps the column on down (the embedded dialect keeps additive columns)', async () => {
		await run('up');
		await run('down');
		expect(await column()).toBeDefined();
	});

	it('changes nothing on a database without the table', async () => {
		await dataSource.query('DROP TABLE "equipment_sharing"');

		await expect(run('up')).resolves.toBeUndefined();
	});
});

/** A query runner that records what it is asked to run. */
function recordingRunner(type: 'postgres' | 'mysql', hasColumn = false) {
	const queries: Array<{ sql: string; parameters?: unknown[] }> = [];
	const queryRunner = {
		connection: { options: { type } },
		isTransactionActive: true,
		hasTable: async () => true,
		hasColumn: async () => hasColumn,
		query: async (sql: string, parameters?: unknown[]) => {
			queries.push({ sql, parameters });
			return sql.includes('GET_LOCK') ? [{ acquired: 1 }] : [];
		}
	} as unknown as QueryRunner;
	return { queries, queryRunner };
}

describe('equipment_sharing.version migration on Postgres', () => {
	it('takes the advisory lock, then adds the column only when it is missing', async () => {
		const { queries, queryRunner } = recordingRunner('postgres');
		const migration = new AddEquipmentSharingVersion1791000003320();

		await migration.up(queryRunner);

		expect(queries).toEqual([
			{ sql: 'SELECT pg_advisory_xact_lock($1)', parameters: [1791000003320] },
			{
				sql: 'ALTER TABLE "equipment_sharing" ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 1',
				parameters: undefined
			}
		]);
	});

	it('drops the column on down', async () => {
		const { queries, queryRunner } = recordingRunner('postgres');

		await new AddEquipmentSharingVersion1791000003320().down(queryRunner);

		expect(queries.map((query) => query.sql)).toEqual([
			'ALTER TABLE "equipment_sharing" DROP COLUMN IF EXISTS "version"'
		]);
	});
});

describe('equipment_sharing.version migration on MySQL', () => {
	it('takes a named lock MySQL accepts (at most 64 characters) and adds an int column', async () => {
		const { queries, queryRunner } = recordingRunner('mysql');
		const migration = new AddEquipmentSharingVersion1791000003320();

		await migration.up(queryRunner);

		expect(migration.mysqlLockName.length).toBeLessThanOrEqual(64);
		expect(queries.map((query) => query.sql)).toEqual([
			'SELECT GET_LOCK(?, 120) AS `acquired`',
			'ALTER TABLE `equipment_sharing` ADD COLUMN `version` int NOT NULL DEFAULT 1',
			'SELECT RELEASE_LOCK(?)'
		]);
		expect(queries[0].parameters).toEqual([migration.mysqlLockName]);
	});

	it('adds nothing when the column is already there', async () => {
		const { queries, queryRunner } = recordingRunner('mysql', true);

		await new AddEquipmentSharingVersion1791000003320().up(queryRunner);

		expect(queries.map((query) => query.sql)).toEqual([
			'SELECT GET_LOCK(?, 120) AS `acquired`',
			'SELECT RELEASE_LOCK(?)'
		]);
	});
});
