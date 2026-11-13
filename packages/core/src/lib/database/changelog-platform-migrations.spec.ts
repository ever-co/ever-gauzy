import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource, QueryRunner } from 'typeorm';
import { AddChangelogPlatform1791000005600 } from './migrations/1791000005600-AddChangelogPlatform';
import { SeedPlatformChangelogContent1791000005610 } from './migrations/1791000005610-SeedPlatformChangelogContent';
import { RewordPlatformChangelogEntries1791000006900 } from './migrations/1791000006900-RewordPlatformChangelogEntries';
import { platformChangelogEntryId } from './platform-changelog-entry-id';

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

	it('adds the starter entries of Ever Teams and Ever Platform, and leaves Gauzy alone', async () => {
		await run(new AddChangelogPlatform1791000005600());
		await run(new SeedPlatformChangelogContent1791000005610());

		expect(await countBy()).toEqual({ 'ever-platform': 5, 'ever-teams': 8, gauzy: 1 });
		const [teams] = await dataSource.query(
			`SELECT "id", "icon", "date", "isFeature", "imageUrl" FROM "changelog" WHERE "platform" = 'ever-teams' AND "title" = 'Sign in with Ever ID'`
		);
		// Pinned on purpose (not derived through platformChangelogEntryId), so a change to the namespace or formula fails here.
		expect(teams).toEqual({
			id: 'e6f03935-e50f-5063-9bae-cb7b50761ac9',
			icon: 'log-in-outline',
			date: '2026-10-02 00:00:00',
			isFeature: 0,
			imageUrl: ''
		});
	});

	it('is additive: a rerun, or an entry the operator already wrote, adds nothing twice', async () => {
		await run(new AddChangelogPlatform1791000005600());
		await dataSource.query(
			`INSERT INTO "changelog" ("id", "title", "date", "content", "platform") VALUES ('t1', 'Weekly time report', '2026-10-13 00:00:00', 'Edited by hand', 'ever-teams')`
		);
		await run(new SeedPlatformChangelogContent1791000005610());
		await run(new SeedPlatformChangelogContent1791000005610());
		await run(new AddChangelogPlatform1791000005600());

		expect(await countBy()).toEqual({ 'ever-platform': 5, 'ever-teams': 8, gauzy: 1 });
		const [kept] = await dataSource.query(`SELECT "content" FROM "changelog" WHERE "id" = 't1'`);
		expect(kept.content).toBe('Edited by hand');
	});

	it('cannot duplicate an entry a concurrent run already inserted under its fixed id', async () => {
		await run(new AddChangelogPlatform1791000005600());
		// What a second process that passed the title check before the first committed would meet: the id is taken.
		await dataSource.query(
			`INSERT INTO "changelog" ("id", "title", "date", "content", "platform") VALUES (?, 'Renamed meanwhile', '2026-10-12 00:00:00', 'x', 'ever-teams')`,
			[platformChangelogEntryId('ever-teams', 'Weekly time report')]
		);

		await run(new SeedPlatformChangelogContent1791000005610());

		expect(await countBy()).toEqual({ 'ever-platform': 5, 'ever-teams': 8, gauzy: 1 });
		const ids = await dataSource.query(
			`SELECT "id" FROM "changelog" WHERE "platform" = 'ever-platform' ORDER BY "id"`
		);
		expect(ids.map(({ id }: { id: string }) => id).sort()).toEqual(
			[
				'One Apps page',
				'Create your organization',
				'Account security',
				'Billing in one place',
				'One Ever ID for every app'
			]
				.map((title) => platformChangelogEntryId('ever-platform', title))
				.sort()
		);
	});

	it('drops the column on down', async () => {
		await run(new AddChangelogPlatform1791000005600());
		const queryRunner = dataSource.createQueryRunner();
		try {
			await new AddChangelogPlatform1791000005600().down(queryRunner);
			expect(await queryRunner.hasColumn('changelog', 'platform')).toBe(false);
			await expect(new AddChangelogPlatform1791000005600().down(queryRunner)).resolves.toBeUndefined();
		} finally {
			await queryRunner.release();
		}
		expect(await dataSource.query('SELECT COUNT(*) AS "n" FROM "changelog"')).toEqual([{ n: 1 }]);
	});

	it('seeds nothing on a database without the platform column', async () => {
		await run(new SeedPlatformChangelogContent1791000005610());

		expect(await dataSource.query('SELECT COUNT(*) AS "n" FROM "changelog"')).toEqual([{ n: 1 }]);
	});

	it('reverted in order, leaves only the entries it did not insert, so none reads as Gauzy news once the column is gone', async () => {
		await run(new AddChangelogPlatform1791000005600());
		await dataSource.query(
			`INSERT INTO "changelog" ("id", "title", "date", "content", "platform") VALUES ('t1', 'Written by hand', '2026-10-13 00:00:00', 'Kept', 'ever-teams')`
		);
		await run(new SeedPlatformChangelogContent1791000005610());
		expect(await countBy()).toEqual({ 'ever-platform': 5, 'ever-teams': 9, gauzy: 1 });

		const queryRunner = dataSource.createQueryRunner();
		try {
			await new SeedPlatformChangelogContent1791000005610().down(queryRunner);
			expect(await countBy()).toEqual({ 'ever-teams': 1, gauzy: 1 });
			await new AddChangelogPlatform1791000005600().down(queryRunner);
		} finally {
			await queryRunner.release();
		}
		const left = await dataSource.query('SELECT "id" FROM "changelog" ORDER BY "id"');
		expect(left.map(({ id }: { id: string }) => id)).toEqual(['g1', 't1']);
	});

	it('removes its entries on down even once the platform column is gone, and twice is harmless', async () => {
		await run(new AddChangelogPlatform1791000005600());
		await run(new SeedPlatformChangelogContent1791000005610());

		const queryRunner = dataSource.createQueryRunner();
		try {
			await new AddChangelogPlatform1791000005600().down(queryRunner);
			await new SeedPlatformChangelogContent1791000005610().down(queryRunner);
			await new SeedPlatformChangelogContent1791000005610().down(queryRunner);
		} finally {
			await queryRunner.release();
		}
		expect(await dataSource.query('SELECT "id" FROM "changelog"')).toEqual([{ id: 'g1' }]);
	});
});

describe('changelog starter entries down on Postgres and MySQL', () => {
	const STARTER_IDS = new SeedPlatformChangelogContent1791000005610().rows.map(([platform, , title]) =>
		platformChangelogEntryId(platform, title)
	);

	const runner = (type: 'postgres' | 'mysql', hasTable = true) => {
		const queries: Array<{ sql: string; params: unknown[] }> = [];
		const queryRunner = {
			connection: { options: { type } },
			hasTable: async () => hasTable,
			hasColumn: async () => true,
			query: async (sql: string, params: unknown[] = []) => {
				queries.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
				return [];
			}
		} as unknown as QueryRunner;
		return { queries, queryRunner };
	};

	it.each([
		['postgres' as const, '"changelog"', '"id"', STARTER_IDS.map((_, i) => `$${i + 1}`).join(', ')],
		['mysql' as const, '`changelog`', '`id`', STARTER_IDS.map(() => '?').join(', ')]
	])('deletes exactly the starter entries by their fixed ids on %s', async (type, table, column, placeholders) => {
		const { queries, queryRunner } = runner(type);

		await new SeedPlatformChangelogContent1791000005610().down(queryRunner);

		expect(queries).toEqual([
			{ sql: `DELETE FROM ${table} WHERE ${column} IN (${placeholders})`, params: STARTER_IDS }
		]);
		expect(STARTER_IDS).toHaveLength(13);
		expect(STARTER_IDS).toContain('e6f03935-e50f-5063-9bae-cb7b50761ac9');
	});

	it('does nothing without the changelog table', async () => {
		const { queries, queryRunner } = runner('postgres', false);

		await new SeedPlatformChangelogContent1791000005610().down(queryRunner);

		expect(queries).toEqual([]);
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
		expect(inserts).toHaveLength(13);
		expect(inserts[0].sql).toBe(
			'INSERT INTO "changelog" ("platform", "icon", "title", "date", "isFeature", "content", "learnMoreUrl", "imageUrl", "id") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT ("id") DO NOTHING'
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
		const inserts = queries.filter((sql) => sql.startsWith('INSERT INTO `changelog`'));
		expect(inserts).toHaveLength(13);
		expect(inserts[0].endsWith('ON DUPLICATE KEY UPDATE `id` = `id`')).toBe(true);
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

/**
 * The follow-up that rewords two Ever Platform entries on the databases the seed ran on with the old wording, run for
 * real on SQLite against a table with the base entity's `createdAt` / `updatedAt`, as every live table has.
 */
describe('RewordPlatformChangelogEntries on SQLite', () => {
	let dataSource: DataSource;
	let dbPath: string;
	const OLD_WORDING = 'The text the seed wrote before 2026-11-10.';

	beforeEach(async () => {
		dbPath = path.join(os.tmpdir(), `gauzy-changelog-reword-${process.pid}-${Date.now()}-${Math.random()}.sqlite3`);
		dataSource = new DataSource({ type: 'better-sqlite3', database: dbPath, synchronize: false, logging: false });
		await dataSource.initialize();
		await dataSource.query(
			`CREATE TABLE "changelog" ("id" varchar PRIMARY KEY NOT NULL, "platform" varchar NOT NULL DEFAULT 'gauzy', "title" varchar, "content" varchar NOT NULL, "learnMoreUrl" varchar, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')))`
		);
		for (const title of ['One Apps page', 'Create your organization']) {
			await dataSource.query(
				`INSERT INTO "changelog" ("id", "platform", "title", "content", "learnMoreUrl") VALUES (?, 'ever-platform', ?, ?, 'https://seeded.example.test')`,
				[platformChangelogEntryId('ever-platform', title), title, OLD_WORDING]
			);
		}
	});

	afterEach(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
		fs.rmSync(dbPath, { force: true });
	});

	const contentOf = async (title: string) =>
		(await dataSource.query(`SELECT "content", "learnMoreUrl" FROM "changelog" WHERE "title" = ?`, [title]))[0];

	it('rewords the entries nobody edited, keeps an edited one, and leaves the links alone', async () => {
		// The operator edited "Create your organization" (an edit moves updatedAt).
		await dataSource.query(
			`UPDATE "changelog" SET "content" = 'Our own text.', "updatedAt" = datetime('now', '+1 minute') WHERE "title" = 'Create your organization'`
		);
		const queryRunner = dataSource.createQueryRunner();
		try {
			await new RewordPlatformChangelogEntries1791000006900().up(queryRunner);
		} finally {
			await queryRunner.release();
		}

		const rewording = Object.fromEntries(new RewordPlatformChangelogEntries1791000006900().rows);
		expect(await contentOf('One Apps page')).toEqual({ content: rewording['One Apps page'], learnMoreUrl: 'https://seeded.example.test' });
		expect(await contentOf('Create your organization')).toEqual({ content: 'Our own text.', learnMoreUrl: 'https://seeded.example.test' });
		for (const [, content] of new RewordPlatformChangelogEntries1791000006900().rows) {
			expect(content).not.toMatch(/\b(?:ever\.co|ever\.team|gauzy\.co)\b/);
		}
	});

	it('does nothing on a database without the table', async () => {
		await dataSource.query(`DROP TABLE "changelog"`);
		const queryRunner = dataSource.createQueryRunner();
		try {
			await expect(new RewordPlatformChangelogEntries1791000006900().up(queryRunner)).resolves.toBeUndefined();
		} finally {
			await queryRunner.release();
		}
	});
});
