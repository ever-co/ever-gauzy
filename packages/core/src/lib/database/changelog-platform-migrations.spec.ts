import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource, QueryRunner } from 'typeorm';
import { AddChangelogPlatform1791000005600 } from './migrations/1791000005600-AddChangelogPlatform';
import { SeedPlatformChangelogContent1791000005610 } from './migrations/1791000005610-SeedPlatformChangelogContent';

/**
 * `changelog.platform` and the starter entries of the other Ever products, run for real on SQLite against a
 * minimal fixture of the table that already holds Gauzy's entries, as every live database does.
 */
describe('changelog platform migrations on SQLite', () => {
	let dataSource: DataSource;
	let dbPath: string;

	beforeEach(async () => {
		dbPath = path.join(
			os.tmpdir(),
			`gauzy-changelog-platform-${process.pid}-${Date.now()}-${Math.random()}.sqlite3`
		);
		dataSource = new DataSource({ type: 'better-sqlite3', database: dbPath, synchronize: false, logging: false });
		await dataSource.initialize();
		await dataSource.query(
			`CREATE TABLE "changelog" ("id" varchar PRIMARY KEY NOT NULL, "icon" varchar, "title" varchar, "date" datetime NOT NULL, "content" varchar NOT NULL, "isFeature" boolean, "learnMoreUrl" varchar, "imageUrl" varchar)`
		);
		await dataSource.query(
			`INSERT INTO "changelog" ("id", "icon", "title", "date", "content", "isFeature") VALUES ('g1', 'grid-outline', 'Custom dashboards', '2026-07-20 00:00:00', 'Build your own dashboards.', 0)`
		);
	});

	afterEach(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
		fs.rmSync(dbPath, { force: true });
	});

	const run = async (migration: { up(queryRunner: QueryRunner): Promise<void> }) => {
		const queryRunner = dataSource.createQueryRunner();
		try {
			await migration.up(queryRunner);
		} finally {
			await queryRunner.release();
		}
	};

	const countBy = async () =>
		Object.fromEntries(
			(
				(await dataSource.query(
					'SELECT "platform", COUNT(*) AS "n" FROM "changelog" GROUP BY "platform" ORDER BY "platform"'
				)) as Array<{ platform: string; n: number }>
			).map(({ platform, n }) => [platform, Number(n)])
		);

	it('files every existing entry under Gauzy, and new rows default to Gauzy', async () => {
		await run(new AddChangelogPlatform1791000005600());

		expect(await countBy()).toEqual({ gauzy: 1 });
		await dataSource.query(
			`INSERT INTO "changelog" ("id", "title", "date", "content") VALUES ('g2', 'Later', '2026-11-01 00:00:00', 'x')`
		);
		expect(await countBy()).toEqual({ gauzy: 2 });
	});

	it('adds the starter entries of Ever Teams, Ever Works and Ever Platform, and leaves Gauzy alone', async () => {
		await run(new AddChangelogPlatform1791000005600());
		await run(new SeedPlatformChangelogContent1791000005610());

		expect(await countBy()).toEqual({ 'ever-platform': 5, 'ever-teams': 8, 'ever-works': 5, gauzy: 1 });
		const [teams] = await dataSource.query(
			`SELECT "icon", "date", "isFeature", "imageUrl" FROM "changelog" WHERE "platform" = 'ever-teams' AND "title" = 'Sign in with Ever ID'`
		);
		expect(teams).toEqual({ icon: 'log-in-outline', date: '2026-10-02 00:00:00', isFeature: 0, imageUrl: '' });
	});

	it('is additive: a rerun, or an entry the operator already wrote, adds nothing twice', async () => {
		await run(new AddChangelogPlatform1791000005600());
		await dataSource.query(
			`INSERT INTO "changelog" ("id", "title", "date", "content", "platform") VALUES ('t1', 'Weekly time report', '2026-10-13 00:00:00', 'Edited by hand', 'ever-teams')`
		);
		await run(new SeedPlatformChangelogContent1791000005610());
		await run(new SeedPlatformChangelogContent1791000005610());
		await run(new AddChangelogPlatform1791000005600());

		expect(await countBy()).toEqual({ 'ever-platform': 5, 'ever-teams': 8, 'ever-works': 5, gauzy: 1 });
		const [kept] = await dataSource.query(`SELECT "content" FROM "changelog" WHERE "id" = 't1'`);
		expect(kept.content).toBe('Edited by hand');
	});

	it('seeds nothing on a database without the platform column', async () => {
		await run(new SeedPlatformChangelogContent1791000005610());

		expect(await dataSource.query('SELECT COUNT(*) AS "n" FROM "changelog"')).toEqual([{ n: 1 }]);
	});
});

describe('changelog platform column on Postgres and MySQL', () => {
	const runner = (type: 'postgres' | 'mysql') => {
		const queries: string[] = [];
		const queryRunner = {
			connection: { options: { type } },
			isTransactionActive: true,
			hasTable: async () => true,
			hasColumn: async () => false,
			query: async (sql: string) => {
				queries.push(sql.replace(/\s+/g, ' ').trim());
				return sql.includes('GET_LOCK') ? [{ acquired: 1 }] : [];
			}
		} as unknown as QueryRunner;
		return { queries, queryRunner };
	};

	it('adds the column with its Gauzy default on Postgres, idempotently and under a lock', async () => {
		const { queries, queryRunner } = runner('postgres');
		await new AddChangelogPlatform1791000005600().up(queryRunner);

		expect(queries).toEqual([
			'SELECT pg_advisory_xact_lock($1)',
			`ALTER TABLE "changelog" ADD COLUMN IF NOT EXISTS "platform" character varying(50) NOT NULL DEFAULT 'gauzy'`
		]);
	});

	it('adds the column on MySQL inside a named lock', async () => {
		const { queries, queryRunner } = runner('mysql');
		await new AddChangelogPlatform1791000005600().up(queryRunner);

		expect(queries).toEqual([
			'SELECT GET_LOCK(?, 120) AS `acquired`',
			"ALTER TABLE `changelog` ADD COLUMN `platform` varchar(50) NOT NULL DEFAULT 'gauzy'",
			'SELECT RELEASE_LOCK(?)'
		]);
	});

	it('inserts the starter entries with Postgres placeholders and dates', async () => {
		const queries: Array<{ sql: string; params: unknown[] }> = [];
		const queryRunner = {
			connection: { options: { type: 'postgres' } },
			hasTable: async () => true,
			hasColumn: async () => true,
			query: async (sql: string, params: unknown[] = []) => {
				queries.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
				return [];
			}
		} as unknown as QueryRunner;
		await new SeedPlatformChangelogContent1791000005610().up(queryRunner);

		const inserts = queries.filter(({ sql }) => sql.startsWith('INSERT'));
		expect(inserts).toHaveLength(18);
		expect(inserts[0].sql).toBe(
			'INSERT INTO "changelog" ("platform", "icon", "title", "date", "isFeature", "content", "learnMoreUrl", "imageUrl", "id") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)'
		);
		expect(inserts[0].params.slice(0, 5)).toEqual([
			'ever-teams',
			'gift-outline',
			"What's new and About",
			new Date('2026-11-08T00:00:00.000Z'),
			false
		]);
	});
});

describe('changelog starter entries on MySQL', () => {
	it('checks and inserts inside a named lock, so two booting processes cannot add an entry twice', async () => {
		const queries: string[] = [];
		const queryRunner = {
			connection: { options: { type: 'mysql' } },
			hasTable: async () => true,
			hasColumn: async () => true,
			query: async (sql: string) => {
				queries.push(sql.replace(/\s+/g, ' ').trim());
				return sql.includes('GET_LOCK') ? [{ acquired: 1 }] : [];
			}
		} as unknown as QueryRunner;
		await new SeedPlatformChangelogContent1791000005610().up(queryRunner);

		expect(queries[0]).toBe('SELECT GET_LOCK(?, 120) AS `acquired`');
		expect(queries[queries.length - 1]).toBe('SELECT RELEASE_LOCK(?)');
		expect(queries.filter((sql) => sql.startsWith('INSERT INTO `changelog`'))).toHaveLength(18);
	});

	it('refuses to seed without the lock', async () => {
		const queryRunner = {
			connection: { options: { type: 'mysql' } },
			hasTable: async () => true,
			hasColumn: async () => true,
			query: async (sql: string) => (sql.includes('GET_LOCK') ? [{ acquired: 0 }] : [])
		} as unknown as QueryRunner;

		await expect(new SeedPlatformChangelogContent1791000005610().up(queryRunner)).rejects.toThrow(
			'Could not acquire the MySQL migration lock gauzy:migration:1791000005610.'
		);
	});
});
