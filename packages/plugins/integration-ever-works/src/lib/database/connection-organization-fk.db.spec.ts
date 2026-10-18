/**
 * Review finding F59: the tenant's Ever Works connection survives the deletion of the organization it was
 * connected from (`organizationId` becomes NULL), on a real SQLite file database, through the plugin's own
 * migration list as the platform runs it (TypeORM's executor, one transaction per migration), and through
 * direct `up`/`down` calls with foreign keys on.
 *
 * The Postgres and MySQL branches issue catalog-probed DDL; the probe-driven cases at the end pin what they
 * send for each state a run can find (fresh, done, cut off half-way).
 */
// The module graph (controllers, services, core) is not needed for the migration list.
jest.mock('../ever-works.module', () => ({
	EverWorksModule: class {},
	EVER_WORKS_ENTITIES: [],
	EVER_WORKS_SUBSCRIBERS: []
}));

import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataSource, QueryRunner } from 'typeorm';
import { EVER_WORKS_MIGRATIONS } from '../integration-ever-works.plugin';
import { AlterEverWorksConnectionOrganizationForeignKey1791000003100 as AlterOrganizationForeignKey } from './migrations/1791000003100-AlterEverWorksConnectionOrganizationForeignKey';
import { CreateEverWorksConnection1791000001100 } from './migrations/1791000001100-CreateEverWorksConnection';
import { CreateEverWorksSyncTables1791000001300 } from './migrations/1791000001300-CreateEverWorksSyncTables';

jest.setTimeout(60_000);

describe('ever_works_connection organization foreign key (F59)', () => {
	let dir: string;
	let dataSource: DataSource;

	const tenantId = randomUUID();
	const fromOrganization = randomUUID();
	const mappedOrganization = randomUUID();

	const query = (sql: string, parameters?: unknown[]) => dataSource.query(sql, parameters);
	const connectionRow = async (id: string) =>
		(await query(`SELECT * FROM "ever_works_connection" WHERE "id" = ?`, [id]))[0] as
			Record<string, unknown> | undefined;
	const organizationRule = async () =>
		(
			(await query(`PRAGMA foreign_key_list("ever_works_connection")`)) as Array<{
				table: string;
				on_delete: string;
			}>
		).find((fk) => fk.table === 'organization')?.on_delete;
	const tenantRule = async () =>
		(
			(await query(`PRAGMA foreign_key_list("ever_works_connection")`)) as Array<{
				table: string;
				on_delete: string;
			}>
		).find((fk) => fk.table === 'tenant')?.on_delete;
	const schema = async () => ({
		columns: (
			(await query(`PRAGMA table_info("ever_works_connection")`)) as Array<{
				name: string;
				type: string;
				notnull: number;
			}>
		).map((c) => `${c.name}:${c.type}:${c.notnull}`),
		indexes: (
			(await query(
				`SELECT "sql" FROM "sqlite_master" WHERE "type" = 'index' AND "tbl_name" = 'ever_works_connection' AND "sql" IS NOT NULL ORDER BY "name"`
			)) as Array<{
				sql: string;
			}>
		).map((i) => i.sql)
	});
	const insertConnection = async (organizationId: string) => {
		const id = randomUUID();
		await query(
			`INSERT INTO "ever_works_connection" ("id", "tenantId", "organizationId", "apiBaseUrl", "ewTenantId", "apiKeyEncrypted", "feedCursor", "leaseOwner")
			VALUES (?, ?, ?, 'https://ew.example.test/api', 'ew-tenant', 'v1:cipher', 'cursor-42', 'worker-1')`,
			[id, tenantId, organizationId]
		);
		return id;
	};
	const withRunner = async (work: (runner: QueryRunner) => Promise<void>) => {
		const runner = dataSource.createQueryRunner();
		try {
			await work(runner);
		} finally {
			await runner.release();
		}
	};

	beforeAll(async () => {
		dir = mkdtempSync(join(tmpdir(), 'ever-works-fk-'));
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: join(dir, 'gauzy.sqlite'),
			migrations: [...EVER_WORKS_MIGRATIONS]
		});
		await dataSource.initialize();
		await query(`CREATE TABLE "tenant" ("id" varchar PRIMARY KEY NOT NULL, "name" varchar)`);
		await query(
			`CREATE TABLE "organization" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "name" varchar)`
		);
		// The platform's run: every plugin migration, oldest first, each in its own transaction.
		await dataSource.runMigrations({ transaction: 'each' });
	});

	afterAll(async () => {
		if (dataSource?.isInitialized) await dataSource.destroy();
		rmSync(dir, { recursive: true, force: true });
	});

	beforeEach(async () => {
		await query(`DELETE FROM "ever_works_connection"`);
		await query(`DELETE FROM "organization"`);
		await query(`DELETE FROM "tenant"`);
		await query(`INSERT INTO "tenant" ("id", "name") VALUES (?, 'T')`, [tenantId]);
		await query(`INSERT INTO "organization" ("id", "tenantId", "name") VALUES (?, ?, 'A'), (?, ?, 'B')`, [
			fromOrganization,
			tenantId,
			mappedOrganization,
			tenantId
		]);
	});

	it('deleting the organization the connection was made from keeps the connection, with organizationId NULL', async () => {
		const id = await insertConnection(fromOrganization);

		await query(`DELETE FROM "organization" WHERE "id" = ?`, [fromOrganization]);

		const row = await connectionRow(id);
		expect(row).toBeDefined();
		expect(row).toMatchObject({
			organizationId: null,
			tenantId,
			apiKeyEncrypted: 'v1:cipher',
			feedCursor: 'cursor-42',
			leaseOwner: 'worker-1'
		});
		expect(await organizationRule()).toBe('SET NULL');
	});

	it('a deleted tenant still takes its connection with it', async () => {
		const id = await insertConnection(fromOrganization);

		await query(`DELETE FROM "tenant" WHERE "id" = ?`, [tenantId]);

		expect(await connectionRow(id)).toBeUndefined();
		expect(await tenantRule()).toBe('CASCADE');
	});

	it('a re-run issues no DDL and leaves every column, index and row as they are', async () => {
		const id = await insertConnection(fromOrganization);
		const before = await schema();
		expect(
			before.indexes.some(
				(sql) => sql.includes('UQ_ever_works_connection_active_tenant') && sql.includes('WHERE')
			)
		).toBe(true);
		expect(before.columns).toEqual(
			expect.arrayContaining([
				expect.stringMatching(/^leaseOwner:/),
				expect.stringMatching(/^resyncRequestedAt:/)
			])
		);

		const sent: string[] = [];
		await withRunner(async (runner) => {
			// better-sqlite3 hands out one shared query runner: the recorder is removed again afterwards.
			const spy = jest.spyOn(runner, 'query');
			try {
				await new AlterOrganizationForeignKey().up(runner);
				sent.push(...spy.mock.calls.map((call) => String(call[0])));
			} finally {
				spy.mockRestore();
			}
		});

		expect(sent.filter((sql) => /^\s*(CREATE|DROP|ALTER|INSERT)/i.test(sql))).toEqual([]);
		expect(await schema()).toEqual(before);
		expect(await connectionRow(id)).toMatchObject({ organizationId: fromOrganization });
	});

	it('down puts CASCADE back, and up → down → up ends in the same schema (foreign keys on)', async () => {
		const after = await schema();
		expect((await query(`PRAGMA foreign_keys`))[0]).toEqual({ foreign_keys: 1 });

		await withRunner((runner) => new AlterOrganizationForeignKey().down(runner));
		expect(await organizationRule()).toBe('CASCADE');
		expect(await schema()).toEqual(after);
		const doomed = await insertConnection(fromOrganization);
		await query(`DELETE FROM "organization" WHERE "id" = ?`, [fromOrganization]);
		expect(await connectionRow(doomed)).toBeUndefined();

		await withRunner((runner) => new AlterOrganizationForeignKey().up(runner));
		expect(await organizationRule()).toBe('SET NULL');
		expect(await schema()).toEqual(after);
		const kept = await insertConnection(mappedOrganization);
		await query(`DELETE FROM "organization" WHERE "id" = ?`, [mappedOrganization]);
		expect(await connectionRow(kept)).toMatchObject({ organizationId: null });
	});

	it("TypeORM's revert of the last plugin migration is this one, and the run after it re-applies it", async () => {
		await dataSource.undoLastMigration({ transaction: 'each' });
		expect(await organizationRule()).toBe('CASCADE');
		const pending = await dataSource.runMigrations({ transaction: 'each' });
		expect(pending.map((m) => m.name)).toEqual(['AlterEverWorksConnectionOrganizationForeignKey1791000003100']);
		expect(await organizationRule()).toBe('SET NULL');
	});

	it('a table that references the connection stops a direct run with foreign keys on, before any change', async () => {
		await withRunner((runner) => new AlterOrganizationForeignKey().down(runner));
		await query(
			`CREATE TABLE "ever_works_dependent" ("id" varchar PRIMARY KEY NOT NULL, "connectionId" varchar REFERENCES "ever_works_connection" ("id") ON DELETE CASCADE)`
		);
		try {
			await withRunner(async (runner) => {
				await expect(new AlterOrganizationForeignKey().up(runner)).rejects.toThrow(
					'ever_works_dependent reference ever_works_connection'
				);
			});
			expect(await organizationRule()).toBe('CASCADE');
		} finally {
			await query(`DROP TABLE "ever_works_dependent"`);
			await withRunner((runner) => new AlterOrganizationForeignKey().up(runner));
		}
		expect(await organizationRule()).toBe('SET NULL');
	});

	it('the migration list keeps the plugin order (the connection table exists before it is altered)', () => {
		expect(EVER_WORKS_MIGRATIONS.indexOf(AlterOrganizationForeignKey)).toBeGreaterThan(
			EVER_WORKS_MIGRATIONS.indexOf(CreateEverWorksSyncTables1791000001300)
		);
		expect(EVER_WORKS_MIGRATIONS.indexOf(CreateEverWorksConnection1791000001100)).toBe(0);
	});
});

describe('ever_works_connection organization foreign key on Postgres and MySQL (probe-driven)', () => {
	/** A query runner for `type` whose catalog probe answers `keys`; records every statement. */
	function runner(type: 'postgres' | 'mysql', keys: Array<{ name: string; rule: string }>) {
		const sent: string[] = [];
		const queryRunner = {
			connection: { options: { type } },
			hasTable: async () => true,
			query: async (sql: string) => {
				sent.push(sql.replace(/\s+/g, ' ').trim());
				if (/^\s*SELECT\s+(c\.|rc\.)/i.test(sql)) return keys;
				return [];
			}
		} as unknown as QueryRunner;
		return { queryRunner, ddl: () => sent.filter((sql) => /^(ALTER|CREATE|DROP)/.test(sql)) };
	}
	const FK = 'FK_ever_works_connection_organization';

	it('Postgres: CASCADE is replaced by SET NULL inside the transaction, under a lock timeout', async () => {
		const { queryRunner, ddl } = runner('postgres', [{ name: FK, rule: 'c' }]);
		await new AlterOrganizationForeignKey().up(queryRunner);
		expect(ddl()).toEqual([
			`ALTER TABLE "ever_works_connection" DROP CONSTRAINT "${FK}"`,
			`ALTER TABLE "ever_works_connection" ADD CONSTRAINT "${FK}" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		]);
	});

	it('Postgres: an install whose key has another name (synchronize) is converted, and a done one is left alone', async () => {
		const other = runner('postgres', [{ name: 'FK_6f3b1f4bd0c2', rule: 'c' }]);
		await new AlterOrganizationForeignKey().up(other.queryRunner);
		expect(other.ddl()[0]).toBe(`ALTER TABLE "ever_works_connection" DROP CONSTRAINT "FK_6f3b1f4bd0c2"`);
		expect(other.ddl()[1]).toContain(`ADD CONSTRAINT "${FK}"`);

		const done = runner('postgres', [{ name: FK, rule: 'n' }]);
		await new AlterOrganizationForeignKey().up(done.queryRunner);
		expect(done.ddl()).toEqual([]);
	});

	it('Postgres: down puts CASCADE back', async () => {
		const { queryRunner, ddl } = runner('postgres', [{ name: FK, rule: 'n' }]);
		await new AlterOrganizationForeignKey().down(queryRunner);
		expect(ddl()[1]).toContain('ON DELETE CASCADE');
	});

	it('MySQL: drop then add; a run cut off after the drop only adds; a done one issues nothing', async () => {
		const fresh = runner('mysql', [{ name: FK, rule: 'CASCADE' }]);
		await new AlterOrganizationForeignKey().up(fresh.queryRunner);
		expect(fresh.ddl()).toEqual([
			`ALTER TABLE \`ever_works_connection\` DROP FOREIGN KEY \`${FK}\``,
			`ALTER TABLE \`ever_works_connection\` ADD CONSTRAINT \`${FK}\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		]);

		const cut = runner('mysql', []);
		await new AlterOrganizationForeignKey().up(cut.queryRunner);
		expect(cut.ddl()).toEqual([fresh.ddl()[1]]);

		const done = runner('mysql', [{ name: FK, rule: 'SET NULL' }]);
		await new AlterOrganizationForeignKey().up(done.queryRunner);
		expect(done.ddl()).toEqual([]);

		const down = runner('mysql', [{ name: FK, rule: 'SET NULL' }]);
		await new AlterOrganizationForeignKey().down(down.queryRunner);
		expect(down.ddl()[1]).toContain('ON DELETE CASCADE');
	});

	it('MySQL: the API and the worker migrating at once — a statement the other process already made is accepted', async () => {
		/** Probes answer in turn (the last answer repeats); DDL fails as listed. */
		const racing = (probes: Array<Array<{ name: string; rule: string }>>, failures: Record<string, Error>) => {
			const answers = [...probes];
			const sent: string[] = [];
			const queryRunner = {
				connection: { options: { type: 'mysql' } },
				hasTable: async () => true,
				query: async (sql: string) => {
					const text = sql.replace(/\s+/g, ' ').trim();
					sent.push(text);
					if (text.startsWith('SELECT rc.')) return answers.length > 1 ? answers.shift() : answers[0];
					const failure = Object.entries(failures).find(([start]) => text.startsWith(start));
					if (failure) throw failure[1];
					return [];
				}
			} as unknown as QueryRunner;
			return { queryRunner, sent };
		};
		const gone = Object.assign(new Error("Can't DROP 'FK_ever_works_connection_organization'"), {
			code: 'ER_CANT_DROP_FIELD_OR_KEY'
		});
		const duplicate = Object.assign(new Error('Duplicate foreign key constraint name'), { code: 'ER_FK_DUP_NAME' });

		// The other process dropped the old key and added the new one between this one's probe and its statements.
		const lost = racing([[{ name: FK, rule: 'CASCADE' }], [{ name: FK, rule: 'SET NULL' }]], {
			'ALTER TABLE `ever_works_connection` DROP': gone,
			'ALTER TABLE `ever_works_connection` ADD': duplicate
		});
		await expect(new AlterOrganizationForeignKey().up(lost.queryRunner)).resolves.toBeUndefined();

		// A failure the catalog does not explain still fails the migration.
		const real = racing([[{ name: FK, rule: 'CASCADE' }]], {
			'ALTER TABLE `ever_works_connection` DROP': new Error('lock wait timeout')
		});
		await expect(new AlterOrganizationForeignKey().up(real.queryRunner)).rejects.toThrow('lock wait timeout');
		const noKey = racing([[]], { 'ALTER TABLE `ever_works_connection` ADD': new Error('no such table') });
		await expect(new AlterOrganizationForeignKey().up(noKey.queryRunner)).rejects.toThrow('no such table');
	});
});
