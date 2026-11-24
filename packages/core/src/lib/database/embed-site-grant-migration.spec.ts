import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource, QueryRunner } from 'typeorm';
import { CreateEmbedSiteGrantTable1791000019860 } from './migrations/1791000019860-CreateEmbedSiteGrantTable';

/**
 * `embed_site_grant`, run for real on SQLite (up, down, up) against minimal fixtures of the tables it references, and
 * against fake Postgres and MySQL runners for the statements each dialect gets.
 */
describe('embed_site_grant migration on SQLite', () => {
	let dataSource: DataSource;
	let dbPath: string;

	beforeEach(async () => {
		dbPath = path.join(os.tmpdir(), `gauzy-embed-site-grant-${process.pid}-${Date.now()}-${Math.random()}.sqlite3`);
		dataSource = new DataSource({ type: 'better-sqlite3', database: dbPath, synchronize: false, logging: false });
		await dataSource.initialize();
		await dataSource.query('PRAGMA foreign_keys = ON');
		for (const table of ['tenant', 'organization', 'user', 'employee']) {
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
			await new CreateEmbedSiteGrantTable1791000019860()[direction](queryRunner);
		} finally {
			await queryRunner.release();
		}
	};

	const columns = async () =>
		((await dataSource.query('PRAGMA table_info(embed_site_grant)')) as Array<{ name: string }>).map((c) => c.name);

	const insertGrant = (id: string, keyHash: string) =>
		dataSource.query(
			`INSERT INTO "embed_site_grant" ("id", "userId", "employeeId", "origin", "familyId", "keyHash", "expiresAt") VALUES (?, 'user-1', 'employee-1', 'https://app.example.com', 'family-1', ?, '2026-12-19 09:00:00')`,
			[id, keyHash]
		);

	it('creates the table with its columns and one row per renewal token, drops it, and creates it again', async () => {
		await run('up');
		expect(await columns()).toEqual(
			expect.arrayContaining([
				'id',
				'tenantId',
				'organizationId',
				'userId',
				'employeeId',
				'origin',
				'familyId',
				'keyHash',
				'expiresAt',
				'usedAt',
				'revokedAt',
				'createdAt'
			])
		);
		const indexes = (await dataSource.query('PRAGMA index_list(embed_site_grant)')) as Array<{
			name: string;
			unique: number;
		}>;
		expect(indexes.find((it) => it.name === 'IDX_098089ac46cc6646a7d8b07dcd')?.unique).toBe(1);
		expect(indexes.find((it) => it.name === 'IDX_bab76b4625ee97a5aee7490664')?.unique).toBe(0);

		await run('down');
		expect(await columns()).toEqual([]);

		await run('up');
		await expect(run('up')).resolves.toBeUndefined();
		expect(await columns()).toContain('keyHash');
	});

	it('refuses the same renewal token twice, and lets the grant go with its person and their employee', async () => {
		await run('up');
		await dataSource.query(`INSERT INTO "user" ("id") VALUES ('user-1')`);
		await dataSource.query(`INSERT INTO "employee" ("id") VALUES ('employee-1')`);
		await insertGrant('a', 'hash-a');

		await expect(insertGrant('b', 'hash-a')).rejects.toThrow();
		await insertGrant('c', 'hash-c');

		await dataSource.query(`DELETE FROM "employee" WHERE "id" = 'employee-1'`);
		expect(await dataSource.query(`SELECT "id" FROM "embed_site_grant"`)).toEqual([]);
	});
});

describe('embed_site_grant migration on Postgres and MySQL', () => {
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

	it('creates the table, its unique token index and the keys that cascade on Postgres', async () => {
		const { queries, queryRunner } = runner('postgres', false);

		await new CreateEmbedSiteGrantTable1791000019860().up(queryRunner);

		expect(queries[0]).toContain('pg_advisory_xact_lock');
		expect(queries[1]).toContain('CREATE TABLE "embed_site_grant"');
		expect(queries[1]).toContain('"familyId" uuid NOT NULL');
		expect(queries).toContain(
			'CREATE UNIQUE INDEX "IDX_098089ac46cc6646a7d8b07dcd" ON "embed_site_grant" ("keyHash")'
		);
		expect(queries.find((q) => q.includes('("employeeId") REFERENCES "employee"'))).toContain('ON DELETE CASCADE');
		expect(queries.find((q) => q.includes('("userId") REFERENCES "user"'))).toContain('ON DELETE CASCADE');
	});

	it('adds nothing when the table is there, on Postgres and MySQL', async () => {
		const postgres = runner('postgres', true);
		await new CreateEmbedSiteGrantTable1791000019860().up(postgres.queryRunner);
		expect(postgres.queries.filter((q) => q.startsWith('CREATE'))).toEqual([]);

		const mysql = runner('mysql', true);
		await new CreateEmbedSiteGrantTable1791000019860().up(mysql.queryRunner);
		expect(mysql.queries.filter((q) => q.startsWith('CREATE'))).toEqual([]);
	});

	it('creates the MySQL table in one statement, under a named lock MySQL accepts, which it releases', async () => {
		const { queries, queryRunner } = runner('mysql', false);

		await new CreateEmbedSiteGrantTable1791000019860().up(queryRunner);

		expect(queries[0]).toContain('GET_LOCK');
		expect(queries.filter((q) => q.startsWith('CREATE TABLE'))).toHaveLength(1);
		expect(queries[1]).toContain('UNIQUE INDEX `IDX_098089ac46cc6646a7d8b07dcd` (`keyHash`)');
		expect(queries.at(-1)).toContain('RELEASE_LOCK');
	});

	it('drops the table on down', async () => {
		const postgres = runner('postgres', true);
		await new CreateEmbedSiteGrantTable1791000019860().down(postgres.queryRunner);
		expect(postgres.queries).toEqual(['DROP TABLE IF EXISTS "embed_site_grant"']);

		const mysql = runner('mysql', true);
		await new CreateEmbedSiteGrantTable1791000019860().down(mysql.queryRunner);
		expect(mysql.queries).toEqual(['DROP TABLE IF EXISTS `embed_site_grant`']);
	});
});
