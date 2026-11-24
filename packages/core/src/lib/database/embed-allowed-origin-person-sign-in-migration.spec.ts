import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource, MigrationInterface, QueryRunner } from 'typeorm';
import { CreateEmbedAllowedOriginTable1791000019500 } from './migrations/1791000019500-CreateEmbedAllowedOriginTable';
import { AddEmbedAllowedOriginAllowPersonSignIn1791000019840 } from './migrations/1791000019840-AddEmbedAllowedOriginAllowPersonSignIn';

/**
 * `embed_allowed_origin.allowPersonSignIn`, run for real on SQLite after the migration that creates the table: it
 * arrives as `NOT NULL DEFAULT 0`, so no site allowed before lets people sign in from it.
 */
const EXISTING = 'e0000000-0000-4000-8000-000000000001';
const CREATED_AFTER = 'e0000000-0000-4000-8000-000000000002';

describe('embed_allowed_origin.allowPersonSignIn migration on SQLite', () => {
	let dataSource: DataSource;
	let dbPath: string;

	beforeEach(async () => {
		dbPath = path.join(
			os.tmpdir(),
			`gauzy-embed-allowed-origin-person-sign-in-${process.pid}-${Date.now()}-${Math.random()}.sqlite3`
		);
		dataSource = new DataSource({ type: 'better-sqlite3', database: dbPath, synchronize: false, logging: false });
		await dataSource.initialize();
		for (const table of ['tenant', 'organization', 'user']) {
			await dataSource.query(`CREATE TABLE "${table}" ("id" varchar PRIMARY KEY NOT NULL)`);
		}
		await migrate(new CreateEmbedAllowedOriginTable1791000019500(), 'up');
		await insertOrigin(EXISTING);
	});

	afterEach(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
		fs.rmSync(dbPath, { force: true });
	});

	const migrate = async (migration: MigrationInterface, direction: 'up' | 'down') => {
		const queryRunner = dataSource.createQueryRunner();
		try {
			await migration[direction](queryRunner);
		} finally {
			await queryRunner.release();
		}
	};

	const run = (direction: 'up' | 'down') =>
		migrate(new AddEmbedAllowedOriginAllowPersonSignIn1791000019840(), direction);

	const insertOrigin = async (id: string) => {
		await dataSource.query(`INSERT INTO "embed_allowed_origin" ("id", "origin") VALUES (?, ?)`, [
			id,
			`https://${id}.example`
		]);
	};

	const column = async () => {
		const columns = (await dataSource.query('PRAGMA table_info(embed_allowed_origin)')) as Array<{
			name: string;
			notnull: number;
			dflt_value: string | null;
			type: string;
		}>;
		return columns.find((it) => it.name === 'allowPersonSignIn');
	};

	const allowPersonSignInOf = async (id: string): Promise<number> => {
		const [row] = await dataSource.query(
			`SELECT "allowPersonSignIn" AS "value" FROM "embed_allowed_origin" WHERE "id" = ?`,
			[id]
		);
		return row.value;
	};

	it('adds the column as NOT NULL DEFAULT 0, and a site allowed before keeps sign-in off', async () => {
		await run('up');

		expect(await column()).toMatchObject({ type: 'boolean', notnull: 1, dflt_value: '0' });
		expect(await allowPersonSignInOf(EXISTING)).toBe(0);
	});

	it('stores a site written without the column with sign-in off', async () => {
		await run('up');
		await insertOrigin(CREATED_AFTER);

		expect(await allowPersonSignInOf(CREATED_AFTER)).toBe(0);
	});

	it('is a no-op when run twice, keeps the column on down, and runs up again', async () => {
		await run('up');
		await expect(run('up')).resolves.toBeUndefined();

		await run('down');
		expect(await column()).toBeDefined();

		await expect(run('up')).resolves.toBeUndefined();
		expect(await allowPersonSignInOf(EXISTING)).toBe(0);
	});
});

/** A query runner that records the statements it is given, answering the checks as the arguments say. */
function scriptedRunner(type: 'postgres' | 'mysql', state: { hasTable?: boolean; hasColumn: boolean }) {
	const queries: string[] = [];
	const queryRunner = {
		connection: { options: { type } },
		isTransactionActive: true,
		hasTable: async () => state.hasTable !== false,
		hasColumn: async () => state.hasColumn,
		query: async (sql: string) => {
			queries.push(sql);
			const isLock = sql.includes('GET_LOCK');
			if (isLock) {
				return [{ acquired: 1 }];
			}
			return [];
		}
	} as unknown as QueryRunner;
	return { queries, queryRunner };
}

describe('embed_allowed_origin.allowPersonSignIn migration on Postgres', () => {
	it('serialises concurrent runs and adds the column only when it is missing', async () => {
		const { queries, queryRunner } = scriptedRunner('postgres', { hasColumn: false });

		await new AddEmbedAllowedOriginAllowPersonSignIn1791000019840().up(queryRunner);

		expect(queries).toEqual([
			'SELECT pg_advisory_xact_lock($1)',
			'ALTER TABLE "embed_allowed_origin" ADD COLUMN IF NOT EXISTS "allowPersonSignIn" boolean NOT NULL DEFAULT false'
		]);
	});

	it('changes nothing without the table', async () => {
		const { queries, queryRunner } = scriptedRunner('postgres', { hasTable: false, hasColumn: false });

		await new AddEmbedAllowedOriginAllowPersonSignIn1791000019840().up(queryRunner);
		await new AddEmbedAllowedOriginAllowPersonSignIn1791000019840().down(queryRunner);

		expect(queries).toEqual([]);
	});

	it('drops the column on down', async () => {
		const { queries, queryRunner } = scriptedRunner('postgres', { hasColumn: true });

		await new AddEmbedAllowedOriginAllowPersonSignIn1791000019840().down(queryRunner);

		expect(queries).toEqual(['ALTER TABLE "embed_allowed_origin" DROP COLUMN IF EXISTS "allowPersonSignIn"']);
	});
});

describe('embed_allowed_origin.allowPersonSignIn migration on MySQL', () => {
	it('takes a named lock MySQL accepts and adds a tinyint column', async () => {
		const { queries, queryRunner } = scriptedRunner('mysql', { hasColumn: false });
		const migration = new AddEmbedAllowedOriginAllowPersonSignIn1791000019840();

		await migration.up(queryRunner);

		expect(migration.mysqlLockName.length).toBeLessThanOrEqual(64);
		expect(queries).toEqual([
			'SELECT GET_LOCK(?, 120) AS `acquired`',
			'ALTER TABLE `embed_allowed_origin` ADD COLUMN `allowPersonSignIn` tinyint NOT NULL DEFAULT 0',
			'SELECT RELEASE_LOCK(?)'
		]);
	});

	it('writes nothing when the column is already there', async () => {
		const { queries, queryRunner } = scriptedRunner('mysql', { hasColumn: true });

		await new AddEmbedAllowedOriginAllowPersonSignIn1791000019840().up(queryRunner);

		expect(queries).toEqual(['SELECT GET_LOCK(?, 120) AS `acquired`', 'SELECT RELEASE_LOCK(?)']);
	});

	it('drops the column under the lock on down', async () => {
		const { queries, queryRunner } = scriptedRunner('mysql', { hasColumn: true });

		await new AddEmbedAllowedOriginAllowPersonSignIn1791000019840().down(queryRunner);

		expect(queries).toEqual([
			'SELECT GET_LOCK(?, 120) AS `acquired`',
			'ALTER TABLE `embed_allowed_origin` DROP COLUMN `allowPersonSignIn`',
			'SELECT RELEASE_LOCK(?)'
		]);
	});
});
