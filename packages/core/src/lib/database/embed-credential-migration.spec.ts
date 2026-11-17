import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource, QueryRunner } from 'typeorm';
import { CreateEmbedCredentialTable1791000019400 } from './migrations/1791000019400-CreateEmbedCredentialTable';

/**
 * `embed_credential`, run for real on SQLite (up, down, up) against minimal fixtures of the tables it references, and
 * against fake Postgres and MySQL runners for the statements each dialect gets.
 */
describe('embed_credential migration on SQLite', () => {
	let dataSource: DataSource;
	let dbPath: string;

	beforeEach(async () => {
		dbPath = path.join(os.tmpdir(), `gauzy-embed-credential-${process.pid}-${Date.now()}-${Math.random()}.sqlite3`);
		dataSource = new DataSource({ type: 'better-sqlite3', database: dbPath, synchronize: false, logging: false });
		await dataSource.initialize();
		for (const table of ['tenant', 'organization', 'user']) {
			await dataSource.query(`CREATE TABLE "${table}" ("id" varchar PRIMARY KEY NOT NULL)`);
		}
	});

	afterEach(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
		fs.rmSync(dbPath, { force: true });
	});

	const run = async (direction: 'up' | 'down') => {
		const queryRunner = dataSource.createQueryRunner();
		try {
			await new CreateEmbedCredentialTable1791000019400()[direction](queryRunner);
		} finally {
			await queryRunner.release();
		}
	};

	const columns = async () =>
		((await dataSource.query('PRAGMA table_info(embed_credential)')) as Array<{ name: string }>).map((c) => c.name);

	it('creates the table with its columns and a unique key hash, drops it, and creates it again', async () => {
		await run('up');
		expect(await columns()).toEqual(
			expect.arrayContaining(['id', 'tenantId', 'organizationId', 'name', 'keyHash', 'prefix', 'lastUsedAt', 'revokedAt'])
		);
		const indexes = (await dataSource.query('PRAGMA index_list(embed_credential)')) as Array<{ name: string; unique: number }>;
		expect(indexes.find((it) => it.name === 'IDX_63ba086fc9ac6b49ef0b541b19')?.unique).toBe(1);

		await run('down');
		expect(await columns()).toEqual([]);

		await run('up');
		await expect(run('up')).resolves.toBeUndefined();
		expect(await columns()).toContain('keyHash');
	});

	it('refuses a second row with the same key hash', async () => {
		await run('up');
		const insert = (id: string) =>
			dataSource.query(`INSERT INTO "embed_credential" ("id", "name", "keyHash", "prefix") VALUES ('${id}', 'n', 'same', 'gze_x')`);
		await insert('a');

		await expect(insert('b')).rejects.toThrow();
	});
});

describe('embed_credential migration on Postgres and MySQL', () => {
	const runner = (type: 'postgres' | 'mysql', hasTable: boolean) => {
		const queries: string[] = [];
		const queryRunner = {
			connection: { options: { type } },
			isTransactionActive: true,
			hasTable: async () => hasTable,
			query: async (sql: string) => {
				queries.push(sql.replace(/\s+/g, ' ').trim());
				return sql.includes('GET_LOCK') ? [{ acquired: 1 }] : [];
			}
		} as unknown as QueryRunner;
		return { queries, queryRunner };
	};

	it('creates the table, its indexes and the organization key that cascades on Postgres', async () => {
		const { queries, queryRunner } = runner('postgres', false);

		await new CreateEmbedCredentialTable1791000019400().up(queryRunner);

		expect(queries[0]).toContain('pg_advisory_xact_lock');
		expect(queries[1]).toContain('CREATE TABLE "embed_credential"');
		expect(queries).toContain('CREATE UNIQUE INDEX "IDX_63ba086fc9ac6b49ef0b541b19" ON "embed_credential" ("keyHash")');
		expect(queries.find((q) => q.includes('"organizationId") REFERENCES "organization"'))).toContain('ON UPDATE CASCADE');
	});

	it('adds nothing when the table is there, on Postgres and MySQL', async () => {
		const postgres = runner('postgres', true);
		await new CreateEmbedCredentialTable1791000019400().up(postgres.queryRunner);
		expect(postgres.queries.filter((q) => q.startsWith('CREATE'))).toEqual([]);

		const mysql = runner('mysql', true);
		await new CreateEmbedCredentialTable1791000019400().up(mysql.queryRunner);
		expect(mysql.queries.filter((q) => q.startsWith('CREATE'))).toEqual([]);
	});

	it('creates the MySQL table in one statement, under a named lock it releases', async () => {
		const { queries, queryRunner } = runner('mysql', false);

		await new CreateEmbedCredentialTable1791000019400().up(queryRunner);

		expect(queries[0]).toContain('GET_LOCK');
		expect(queries.filter((q) => q.startsWith('CREATE TABLE'))).toHaveLength(1);
		expect(queries[1]).toContain('UNIQUE INDEX `IDX_63ba086fc9ac6b49ef0b541b19` (`keyHash`)');
		expect(queries.at(-1)).toContain('RELEASE_LOCK');
	});
});
