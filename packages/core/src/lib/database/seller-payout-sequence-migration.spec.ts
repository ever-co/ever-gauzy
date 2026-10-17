import { DataSource, QueryRunner } from 'typeorm';
import { SeedSellerPayoutSequence1791000000790 } from './migrations/1791000000790-SeedSellerPayoutSequence';

/**
 * Q7-W3 — `SELLER_PAYOUT` numbering series for every organization.
 *
 * `SellerPayoutService.allocateNumber` draws from `SequenceService.allocate('SELLER_PAYOUT')`, a series no path
 * created, so every organization's first payout failed with 404. Run for real on SQLite (the demo database)
 * against the `sequence` table as the SQLite migrations shape it (incl. the unique index the guard mirrors);
 * Postgres and MySQL are checked by the statements they are sent.
 */
const ZERO = '00000000-0000-0000-0000-000000000000';
const TENANT = '7a0c4b1e-0000-4000-8000-000000000001';
const ORG_A = '7a0c4b1e-0000-4000-8000-0000000000a1';
const ORG_B = '7a0c4b1e-0000-4000-8000-0000000000b1';
const ORG_DELETED = '7a0c4b1e-0000-4000-8000-0000000000d1';

const DDL: readonly string[] = [
	`CREATE TABLE "organization" ("id" varchar PRIMARY KEY NOT NULL, "deletedAt" datetime, "tenantId" varchar, "name" varchar NOT NULL)`,
	`CREATE TABLE "channel" ("id" varchar PRIMARY KEY NOT NULL, "deletedAt" datetime, "tenantId" varchar, "organizationId" varchar, "code" varchar NOT NULL, "isDefault" boolean NOT NULL DEFAULT (0), "orderNumberPrefix" varchar(16), "orderNumberPadding" integer NOT NULL DEFAULT (6))`,
	`CREATE TABLE "sequence" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "deletedAt" datetime, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "tenantId" varchar, "organizationId" varchar, "key" varchar NOT NULL, "prefix" varchar, "padding" integer NOT NULL DEFAULT (1), "nextValue" integer NOT NULL DEFAULT (1), "step" integer NOT NULL DEFAULT (1), "resetPolicy" varchar NOT NULL DEFAULT ('NEVER'), "lastResetAt" datetime, "description" varchar, "channelId" varchar)`,
	`CREATE UNIQUE INDEX "UQ_sequence_org_key_no_channel" ON "sequence" (COALESCE("organizationId", '${ZERO}'), "key") WHERE "channelId" IS NULL AND "deletedAt" IS NULL`
];

describe('SeedSellerPayoutSequence1791000000790 on SQLite', () => {
	let dataSource: DataSource;
	const migration = new SeedSellerPayoutSequence1791000000790();

	beforeEach(async () => {
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			synchronize: false,
			logging: false
		});
		await dataSource.initialize();
		for (const statement of DDL) {
			await dataSource.query(statement);
		}
		for (const [id, deletedAt] of [
			[ORG_A, null],
			[ORG_B, null],
			[ORG_DELETED, '2026-01-01 00:00:00']
		]) {
			await dataSource.query(
				`INSERT INTO "organization" ("id", "tenantId", "name", "deletedAt") VALUES (?, ?, ?, ?)`,
				[id, TENANT, `Organization ${id.slice(-2)}`, deletedAt]
			);
		}
	});

	afterEach(async () => {
		jest.restoreAllMocks();
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
	});

	const run = async (direction: 'up' | 'down') => {
		const queryRunner = dataSource.createQueryRunner();
		try {
			await migration[direction](queryRunner);
		} finally {
			await queryRunner.release();
		}
	};

	const series = async () =>
		dataSource.query(
			`SELECT "organizationId", "tenantId", "prefix", "padding", "nextValue", "step", "resetPolicy", "channelId"
			 FROM "sequence" WHERE "key" = 'SELLER_PAYOUT' ORDER BY "organizationId"`
		);

	it('seeds one organization-wide SP- series per live organization, none for a deleted one', async () => {
		await run('up');

		expect(await series()).toEqual([
			{
				organizationId: ORG_A,
				tenantId: TENANT,
				prefix: 'SP-',
				padding: 6,
				nextValue: 1,
				step: 1,
				resetPolicy: 'NEVER',
				channelId: null
			},
			{
				organizationId: ORG_B,
				tenantId: TENANT,
				prefix: 'SP-',
				padding: 6,
				nextValue: 1,
				step: 1,
				resetPolicy: 'NEVER',
				channelId: null
			}
		]);
	});

	it('takes the padding of the organization’s default channel, as 0520 does for every series', async () => {
		await dataSource.query(
			`INSERT INTO "channel" ("id", "tenantId", "organizationId", "code", "isDefault", "orderNumberPadding") VALUES ('c1', ?, ?, 'DEFAULT', 1, 4)`,
			[TENANT, ORG_A]
		);

		await run('up');

		const rows = await series();
		expect(rows.find((row: any) => row.organizationId === ORG_A)).toMatchObject({ padding: 4, prefix: 'SP-' });
		expect(rows.find((row: any) => row.organizationId === ORG_B)).toMatchObject({ padding: 6 });
	});

	it('keeps an operator’s own SELLER_PAYOUT series and writes nothing twice', async () => {
		await dataSource.query(
			`INSERT INTO "sequence" ("id", "tenantId", "organizationId", "key", "prefix", "padding", "nextValue") VALUES ('own', ?, ?, 'SELLER_PAYOUT', 'PAY-', 4, 42)`,
			[TENANT, ORG_A]
		);

		await run('up');
		await run('up');

		const rows = await series();
		expect(rows).toHaveLength(2);
		expect(rows.find((row: any) => row.organizationId === ORG_A)).toMatchObject({ prefix: 'PAY-', nextValue: 42 });
	});

	it('down removes only the series nobody used or changed', async () => {
		await run('up');
		// ORG_A numbered a payout; ORG_B's series is as seeded.
		await dataSource.query(
			`UPDATE "sequence" SET "nextValue" = 3 WHERE "organizationId" = ? AND "key" = 'SELLER_PAYOUT'`,
			[ORG_A]
		);
		await dataSource.query(
			`INSERT INTO "sequence" ("id", "tenantId", "organizationId", "key", "prefix", "padding", "nextValue") VALUES ('order', ?, ?, 'ORDER', 'SO-', 6, 1)`,
			[TENANT, ORG_B]
		);

		await run('down');

		expect(await series()).toEqual([expect.objectContaining({ organizationId: ORG_A, nextValue: 3 })]);
		await expect(dataSource.query(`SELECT "key" FROM "sequence" WHERE "key" = 'ORDER'`)).resolves.toEqual([
			{ key: 'ORDER' }
		]);
	});

	it('down keeps a series an operator deactivated, re-padded, described or wrote since (Greptile #10911)', async () => {
		const ORG_C = '7a0c4b1e-0000-4000-8000-0000000000c1';
		const ORG_D = '7a0c4b1e-0000-4000-8000-0000000000e1';
		for (const id of [ORG_C, ORG_D]) {
			await dataSource.query(`INSERT INTO "organization" ("id", "tenantId", "name") VALUES (?, ?, ?)`, [
				id,
				TENANT,
				id
			]);
		}
		await run('up');
		const edit = (set: string, organizationId: string) =>
			dataSource.query(`UPDATE "sequence" SET ${set} WHERE "organizationId" = ? AND "key" = 'SELLER_PAYOUT'`, [
				organizationId
			]);
		await edit(`"isActive" = 0`, ORG_A);
		await edit(`"padding" = 8`, ORG_B);
		await edit(`"description" = 'Payouts'`, ORG_C);
		await edit(`"updatedAt" = datetime('now', '+1 minute')`, ORG_D);

		await run('down');

		expect((await series()).map((row: any) => row.organizationId)).toEqual([ORG_A, ORG_B, ORG_C, ORG_D]);
	});

	it('down removes a series padded like the organization’s default channel, as seeded', async () => {
		await dataSource.query(
			`INSERT INTO "channel" ("id", "tenantId", "organizationId", "code", "isDefault", "orderNumberPadding") VALUES ('c1', ?, ?, 'DEFAULT', 1, 4)`,
			[TENANT, ORG_A]
		);
		await run('up');

		await run('down');

		expect(await series()).toEqual([]);
	});

	it('skips, without failing the boot, when the sequence table is not there yet', async () => {
		await dataSource.query(`DROP TABLE "sequence"`);

		await expect(run('up')).resolves.toBeUndefined();
		await expect(run('down')).resolves.toBeUndefined();
	});
});

describe('SeedSellerPayoutSequence1791000000790 statements on Postgres and MySQL', () => {
	beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));
	afterEach(() => jest.restoreAllMocks());

	function fakeRunner(type: 'postgres' | 'mysql') {
		const queries: Array<{ sql: string; parameters?: unknown[] }> = [];
		const queryRunner = {
			connection: { options: { type } },
			isTransactionActive: true,
			hasTable: async () => true,
			hasColumn: async () => true,
			query: async (sql: string, parameters?: unknown[]) => {
				queries.push({ sql, parameters });
				if (sql.includes('GET_LOCK')) {
					return [{ acquired: 1 }];
				}
				if (/FROM .organization. WHERE .deletedAt. IS NULL ORDER BY/.test(sql)) {
					return [{ id: ORG_A }];
				}
				return [];
			}
		} as unknown as QueryRunner;
		return { queryRunner, queries };
	}

	it('Postgres: takes the advisory lock first, keeps $n placeholders and a true literal', async () => {
		const { queryRunner, queries } = fakeRunner('postgres');

		await new SeedSellerPayoutSequence1791000000790().up(queryRunner);

		expect(queries[0]).toEqual({ sql: 'SELECT pg_advisory_xact_lock($1)', parameters: [1791000000790] });
		const insert = queries.find((query) => query.sql.startsWith('INSERT INTO "sequence"'));
		expect(insert?.sql).toContain('$9');
		expect(insert?.parameters).toEqual([
			expect.any(String),
			'SELLER_PAYOUT',
			'SP-',
			6,
			1,
			1,
			'NEVER',
			ORG_A,
			'SELLER_PAYOUT'
		]);
		expect(queries.find((query) => query.sql.includes('"channel"'))?.sql).toContain('"isDefault" = true');
	});

	it('MySQL: runs under a named lock MySQL accepts, with backticks and ? placeholders', async () => {
		const { queryRunner, queries } = fakeRunner('mysql');
		const migration = new SeedSellerPayoutSequence1791000000790();

		await migration.up(queryRunner);

		expect(migration.mysqlLockName.length).toBeLessThanOrEqual(64);
		expect(queries[0].sql).toBe('SELECT GET_LOCK(?, 120) AS `acquired`');
		expect(queries[queries.length - 1].sql).toBe('SELECT RELEASE_LOCK(?)');
		const insert = queries.find((query) => query.sql.startsWith('INSERT INTO `sequence`'));
		expect(insert?.sql).not.toMatch(/\$\d|"/);
		expect(insert?.parameters).toHaveLength(9);

		queries.length = 0;
		await migration.down(queryRunner);
		const deletion = queries.find((query) => query.sql.startsWith('DELETE FROM `sequence`'));
		expect(deletion?.sql).not.toMatch(/\$\d|"/);
		expect(deletion?.parameters).toEqual(['SELLER_PAYOUT', 'SP-', 1, 1, 'NEVER', 6]);
		expect(deletion?.sql).toContain('`createdAt` = `updatedAt`');
	});
});
