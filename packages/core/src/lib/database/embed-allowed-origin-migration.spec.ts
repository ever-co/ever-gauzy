import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource, QueryRunner } from 'typeorm';
import { CreateEmbedAllowedOriginTable1791000019500 } from './migrations/1791000019500-CreateEmbedAllowedOriginTable';

/**
 * `embed_allowed_origin`, run for real on SQLite (up, down, up) against minimal fixtures of the tables it references, and
 * against fake Postgres and MySQL runners for the statements each dialect gets.
 */
describe('embed_allowed_origin migration on SQLite', () => {
	let dataSource: DataSource;
	let dbPath: string;

	beforeEach(async () => {
		dbPath = path.join(os.tmpdir(), `gauzy-embed-allowed-origin-${process.pid}-${Date.now()}-${Math.random()}.sqlite3`);
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
			await new CreateEmbedAllowedOriginTable1791000019500()[direction](queryRunner);
		} finally {
			await queryRunner.release();
		}
	};

	const columns = async () =>
		((await dataSource.query('PRAGMA table_info(embed_allowed_origin)')) as Array<{ name: string }>).map((c) => c.name);

	it('creates the table with its columns and a unique origin per organization, drops it, and creates it again', async () => {
		await run('up');
		expect(await columns()).toEqual(
			expect.arrayContaining(['id', 'tenantId', 'organizationId', 'origin', 'createdByUserId', 'createdAt'])
		);
		const indexes = (await dataSource.query('PRAGMA index_list(embed_allowed_origin)')) as Array<{ name: string; unique: number }>;
		expect(indexes.find((it) => it.name === 'IDX_59724e36b5e4babd38d5b76298')?.unique).toBe(1);

		await run('down');
		expect(await columns()).toEqual([]);

		await run('up');
		await expect(run('up')).resolves.toBeUndefined();
		expect(await columns()).toContain('origin');
	});

	it('refuses the same origin twice for one organization, and takes it for another', async () => {
		await run('up');
		await dataSource.query(`INSERT INTO "organization" ("id") VALUES ('org-1'), ('org-2')`);
		const insert = (id: string, organizationId: string) =>
			dataSource.query(
				`INSERT INTO "embed_allowed_origin" ("id", "organizationId", "origin") VALUES ('${id}', '${organizationId}', 'https://app.example.com')`
			);
		await insert('a', 'org-1');

		await expect(insert('b', 'org-1')).rejects.toThrow();
		await expect(insert('c', 'org-2')).resolves.toBeDefined();
	});
});

describe('embed_allowed_origin migration on Postgres and MySQL', () => {
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

		await new CreateEmbedAllowedOriginTable1791000019500().up(queryRunner);

		expect(queries[0]).toContain('pg_advisory_xact_lock');
		expect(queries[1]).toContain('CREATE TABLE "embed_allowed_origin"');
		expect(queries).toContain('CREATE UNIQUE INDEX "IDX_59724e36b5e4babd38d5b76298" ON "embed_allowed_origin" ("organizationId", "origin")');
		expect(queries.find((q) => q.includes('"organizationId") REFERENCES "organization"'))).toContain('ON UPDATE CASCADE');
	});

	it('adds nothing when the table is there, on Postgres and MySQL', async () => {
		const postgres = runner('postgres', true);
		await new CreateEmbedAllowedOriginTable1791000019500().up(postgres.queryRunner);
		expect(postgres.queries.filter((q) => q.startsWith('CREATE'))).toEqual([]);

		const mysql = runner('mysql', true);
		await new CreateEmbedAllowedOriginTable1791000019500().up(mysql.queryRunner);
		expect(mysql.queries.filter((q) => q.startsWith('CREATE'))).toEqual([]);
	});

	it('creates the MySQL table in one statement, under a named lock it releases', async () => {
		const { queries, queryRunner } = runner('mysql', false);

		await new CreateEmbedAllowedOriginTable1791000019500().up(queryRunner);

		expect(queries[0]).toContain('GET_LOCK');
		expect(queries.filter((q) => q.startsWith('CREATE TABLE'))).toHaveLength(1);
		expect(queries[1]).toContain('UNIQUE INDEX `IDX_59724e36b5e4babd38d5b76298` (`organizationId`, `origin`)');
		expect(queries.at(-1)).toContain('RELEASE_LOCK');
	});
});
