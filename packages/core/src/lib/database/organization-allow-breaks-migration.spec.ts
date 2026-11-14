import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource, QueryRunner } from 'typeorm';
import { AddOrganizationAllowBreaks1791000010100 } from './migrations/1791000010100-AddOrganizationAllowBreaks';

/**
 * `organization.allowBreaks`, run for real on SQLite against a minimal fixture of the table: it arrives nullable with
 * a default of 0, so every existing organization keeps refusing breaks.
 */
const ORGANIZATION = 'f0000000-0000-4000-8000-000000000018';

describe('organization.allowBreaks migration on SQLite', () => {
	let dataSource: DataSource;
	let dbPath: string;

	beforeEach(async () => {
		dbPath = path.join(os.tmpdir(), `gauzy-allow-breaks-${process.pid}-${Date.now()}-${Math.random()}.sqlite3`);
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
		return columns.find((it) => it.name === 'allowBreaks');
	};

	const run = async (direction: 'up' | 'down') => {
		const queryRunner = dataSource.createQueryRunner();
		try {
			await new AddOrganizationAllowBreaks1791000010100()[direction](queryRunner);
		} finally {
			await queryRunner.release();
		}
	};

	it('adds a nullable column defaulting to 0, and existing organizations keep breaks off', async () => {
		await run('up');

		expect(await column()).toMatchObject({ type: 'boolean', notnull: 0, dflt_value: '0' });
		const [existing] = await dataSource.query(
			`SELECT "allowBreaks" AS "allowed" FROM "organization" WHERE "id" = ?`,
			[ORGANIZATION]
		);
		expect(existing.allowed).toBe(0);
	});

	it('is a no-op when run twice, keeps the column on down, and runs up again', async () => {
		await run('up');
		await expect(run('up')).resolves.toBeUndefined();
		await run('down');
		expect(await column()).toBeDefined();

		await expect(run('up')).resolves.toBeUndefined();
		expect(await column()).toBeDefined();
	});
});

describe('organization.allowBreaks migration on MySQL', () => {
	it('takes a named lock MySQL accepts and adds a nullable tinyint column', async () => {
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
		const migration = new AddOrganizationAllowBreaks1791000010100();

		await migration.up(queryRunner);

		expect(migration.mysqlLockName.length).toBeLessThanOrEqual(64);
		expect(queries).toEqual([
			'SELECT GET_LOCK(?, 120) AS `acquired`',
			'ALTER TABLE `organization` ADD COLUMN `allowBreaks` tinyint NULL DEFAULT 0',
			'SELECT RELEASE_LOCK(?)'
		]);
	});
});

describe('organization.allowBreaks migration on Postgres', () => {
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

		await new AddOrganizationAllowBreaks1791000010100().up(queryRunner);

		expect(queries).toEqual([
			'SELECT pg_advisory_xact_lock($1)',
			'ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "allowBreaks" boolean DEFAULT false'
		]);
	});

	it('drops the column on down', async () => {
		const queries: string[] = [];
		const queryRunner = {
			connection: { options: { type: 'postgres' } },
			hasTable: async () => true,
			query: async (sql: string) => {
				queries.push(sql);
				return [];
			}
		} as unknown as QueryRunner;

		await new AddOrganizationAllowBreaks1791000010100().down(queryRunner);

		expect(queries).toEqual(['ALTER TABLE "organization" DROP COLUMN IF EXISTS "allowBreaks"']);
	});
});
