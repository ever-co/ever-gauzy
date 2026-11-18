import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource, MigrationInterface, QueryRunner } from 'typeorm';
import { CreateEmbedCredentialTable1791000019400 } from './migrations/1791000019400-CreateEmbedCredentialTable';
import { AddEmbedCredentialCanAddMembers1791000019700 } from './migrations/1791000019700-AddEmbedCredentialCanAddMembers';

/**
 * `embed_credential.canAddMembers`, run for real on SQLite after the migration that creates the table: it arrives as
 * `NOT NULL DEFAULT 0`, so no existing credential starts adding members.
 */
const EXISTING = 'e0000000-0000-4000-8000-000000000001';
const CREATED_AFTER = 'e0000000-0000-4000-8000-000000000002';

describe('embed_credential.canAddMembers migration on SQLite', () => {
	let dataSource: DataSource;
	let dbPath: string;

	beforeEach(async () => {
		dbPath = path.join(
			os.tmpdir(),
			`gauzy-embed-credential-can-add-members-${process.pid}-${Date.now()}-${Math.random()}.sqlite3`
		);
		dataSource = new DataSource({ type: 'better-sqlite3', database: dbPath, synchronize: false, logging: false });
		await dataSource.initialize();
		for (const table of ['tenant', 'organization', 'user']) {
			await dataSource.query(`CREATE TABLE "${table}" ("id" varchar PRIMARY KEY NOT NULL)`);
		}
		await migrate(new CreateEmbedCredentialTable1791000019400(), 'up');
		await insertCredential(EXISTING);
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

	const run = (direction: 'up' | 'down') => migrate(new AddEmbedCredentialCanAddMembers1791000019700(), direction);

	const insertCredential = async (id: string) => {
		await dataSource.query(
			`INSERT INTO "embed_credential" ("id", "name", "keyHash", "prefix") VALUES (?, 'Portal', ?, 'gze_x')`,
			[id, `hash-${id}`]
		);
	};

	const column = async () => {
		const columns = (await dataSource.query('PRAGMA table_info(embed_credential)')) as Array<{
			name: string;
			notnull: number;
			dflt_value: string | null;
			type: string;
		}>;
		return columns.find((it) => it.name === 'canAddMembers');
	};

	const canAddMembersOf = async (id: string): Promise<number> => {
		const [row] = await dataSource.query(
			`SELECT "canAddMembers" AS "value" FROM "embed_credential" WHERE "id" = ?`,
			[id]
		);
		return row.value;
	};

	it('adds the column as NOT NULL DEFAULT 0, and an existing credential adds no member', async () => {
		await run('up');

		expect(await column()).toMatchObject({ type: 'boolean', notnull: 1, dflt_value: '0' });
		expect(await canAddMembersOf(EXISTING)).toBe(0);
	});

	it('stores a credential written without the column as one that adds no member', async () => {
		await run('up');
		await insertCredential(CREATED_AFTER);

		expect(await canAddMembersOf(CREATED_AFTER)).toBe(0);
	});

	it('is a no-op when run twice, keeps the column on down, and runs up again', async () => {
		await run('up');
		await expect(run('up')).resolves.toBeUndefined();

		await run('down');
		expect(await column()).toBeDefined();

		await expect(run('up')).resolves.toBeUndefined();
		expect(await canAddMembersOf(EXISTING)).toBe(0);
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

describe('embed_credential.canAddMembers migration on Postgres', () => {
	it('serialises concurrent runs and adds the column only when it is missing', async () => {
		const { queries, queryRunner } = scriptedRunner('postgres', { hasColumn: false });

		await new AddEmbedCredentialCanAddMembers1791000019700().up(queryRunner);

		expect(queries).toEqual([
			'SELECT pg_advisory_xact_lock($1)',
			'ALTER TABLE "embed_credential" ADD COLUMN IF NOT EXISTS "canAddMembers" boolean NOT NULL DEFAULT false'
		]);
	});

	it('changes nothing without the table', async () => {
		const { queries, queryRunner } = scriptedRunner('postgres', { hasTable: false, hasColumn: false });

		await new AddEmbedCredentialCanAddMembers1791000019700().up(queryRunner);
		await new AddEmbedCredentialCanAddMembers1791000019700().down(queryRunner);

		expect(queries).toEqual([]);
	});

	it('drops the column on down', async () => {
		const { queries, queryRunner } = scriptedRunner('postgres', { hasColumn: true });

		await new AddEmbedCredentialCanAddMembers1791000019700().down(queryRunner);

		expect(queries).toEqual(['ALTER TABLE "embed_credential" DROP COLUMN IF EXISTS "canAddMembers"']);
	});
});

describe('embed_credential.canAddMembers migration on MySQL', () => {
	it('takes a named lock MySQL accepts and adds a tinyint column', async () => {
		const { queries, queryRunner } = scriptedRunner('mysql', { hasColumn: false });
		const migration = new AddEmbedCredentialCanAddMembers1791000019700();

		await migration.up(queryRunner);

		expect(migration.mysqlLockName.length).toBeLessThanOrEqual(64);
		expect(queries).toEqual([
			'SELECT GET_LOCK(?, 120) AS `acquired`',
			'ALTER TABLE `embed_credential` ADD COLUMN `canAddMembers` tinyint NOT NULL DEFAULT 0',
			'SELECT RELEASE_LOCK(?)'
		]);
	});

	it('writes nothing when the column is already there', async () => {
		const { queries, queryRunner } = scriptedRunner('mysql', { hasColumn: true });

		await new AddEmbedCredentialCanAddMembers1791000019700().up(queryRunner);

		expect(queries).toEqual(['SELECT GET_LOCK(?, 120) AS `acquired`', 'SELECT RELEASE_LOCK(?)']);
	});

	it('drops the column under the lock on down', async () => {
		const { queries, queryRunner } = scriptedRunner('mysql', { hasColumn: true });

		await new AddEmbedCredentialCanAddMembers1791000019700().down(queryRunner);

		expect(queries).toEqual([
			'SELECT GET_LOCK(?, 120) AS `acquired`',
			'ALTER TABLE `embed_credential` DROP COLUMN `canAddMembers`',
			'SELECT RELEASE_LOCK(?)'
		]);
	});
});
