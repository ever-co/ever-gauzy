import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource, QueryRunner } from 'typeorm';
import { AddOrganizationDiscardTimerSettings1791000010200 } from './migrations/1791000010200-AddOrganizationDiscardTimerSettings';

/**
 * `organization.allowDiscardTimer` and `organization.discardTimerWithinMinutes`, run for real on SQLite against a
 * minimal fixture of the table: every existing organization lets its members discard a running timer, with no limit.
 */
const ORGANIZATION = 'f0000000-0000-4000-8000-000000000001';

interface ColumnInfo {
	name: string;
	notnull: number;
	dflt_value: string | null;
	type: string;
}

describe('organization discard timer settings migration on SQLite', () => {
	let dataSource: DataSource;
	let dbPath: string;

	beforeEach(async () => {
		dbPath = path.join(os.tmpdir(), `gauzy-discard-timer-${process.pid}-${Date.now()}-${Math.random()}.sqlite3`);
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

	/** The column as SQLite describes it, its declared type in lower case (SQLite reports `integer` as `INTEGER`). */
	const column = async (name: string): Promise<ColumnInfo | undefined> => {
		const columns = (await dataSource.query('PRAGMA table_info(organization)')) as ColumnInfo[];
		const found = columns.find((it) => it.name === name);
		if (!found) {
			return undefined;
		}
		return { ...found, type: found.type.toLowerCase() };
	};

	const run = async (direction: 'up' | 'down') => {
		const queryRunner = dataSource.createQueryRunner();
		try {
			await new AddOrganizationDiscardTimerSettings1791000010200()[direction](queryRunner);
		} finally {
			await queryRunner.release();
		}
	};

	it('adds both columns as nullable, the switch on by default and no limit, for existing organizations too', async () => {
		await run('up');

		expect(await column('allowDiscardTimer')).toMatchObject({ type: 'boolean', notnull: 0, dflt_value: '1' });
		expect(await column('discardTimerWithinMinutes')).toMatchObject({
			type: 'integer',
			notnull: 0,
			dflt_value: null
		});
		const [existing] = await dataSource.query(
			`SELECT "allowDiscardTimer" AS "allowed", "discardTimerWithinMinutes" AS "limit" FROM "organization" WHERE "id" = ?`,
			[ORGANIZATION]
		);
		expect(existing).toEqual({ allowed: 1, limit: null });
	});

	it('is a no-op when run twice, keeps the columns on down, and runs up again', async () => {
		await run('up');
		await expect(run('up')).resolves.toBeUndefined();
		await run('down');

		expect(await column('allowDiscardTimer')).toBeDefined();
		expect(await column('discardTimerWithinMinutes')).toBeDefined();
		await expect(run('up')).resolves.toBeUndefined();
	});
});

describe('organization discard timer settings migration on MySQL', () => {
	it('takes a named lock MySQL accepts and adds a nullable tinyint and a nullable int', async () => {
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
		const migration = new AddOrganizationDiscardTimerSettings1791000010200();

		await migration.up(queryRunner);

		expect(migration.mysqlLockName.length).toBeLessThanOrEqual(64);
		expect(queries).toEqual([
			'SELECT GET_LOCK(?, 120) AS `acquired`',
			'ALTER TABLE `organization` ADD COLUMN `allowDiscardTimer` tinyint NULL DEFAULT 1',
			'ALTER TABLE `organization` ADD COLUMN `discardTimerWithinMinutes` int NULL',
			'SELECT RELEASE_LOCK(?)'
		]);
	});

	it('drops only the columns that are there on down', async () => {
		const queries: string[] = [];
		const queryRunner = {
			connection: { options: { type: 'mysql' } },
			hasTable: async () => true,
			hasColumn: async (_table: string, name: string) => name === 'allowDiscardTimer',
			query: async (sql: string) => {
				queries.push(sql);
				return [];
			}
		} as unknown as QueryRunner;

		await new AddOrganizationDiscardTimerSettings1791000010200().down(queryRunner);

		expect(queries).toEqual(['ALTER TABLE `organization` DROP COLUMN `allowDiscardTimer`']);
	});
});

describe('organization discard timer settings migration on Postgres', () => {
	it('serialises concurrent runs and adds each column only when it is missing', async () => {
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

		await new AddOrganizationDiscardTimerSettings1791000010200().up(queryRunner);

		expect(queries).toEqual([
			'SELECT pg_advisory_xact_lock($1)',
			'ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "allowDiscardTimer" boolean DEFAULT true',
			'ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "discardTimerWithinMinutes" integer'
		]);
	});

	it('drops both columns on down', async () => {
		const queries: string[] = [];
		const queryRunner = {
			connection: { options: { type: 'postgres' } },
			hasTable: async () => true,
			query: async (sql: string) => {
				queries.push(sql);
				return [];
			}
		} as unknown as QueryRunner;

		await new AddOrganizationDiscardTimerSettings1791000010200().down(queryRunner);

		expect(queries).toEqual([
			'ALTER TABLE "organization" DROP COLUMN IF EXISTS "allowDiscardTimer"',
			'ALTER TABLE "organization" DROP COLUMN IF EXISTS "discardTimerWithinMinutes"'
		]);
	});
});
