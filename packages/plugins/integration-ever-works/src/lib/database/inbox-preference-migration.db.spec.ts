/**
 * `ever_works_inbox_preference` (each person's choice of what of their Gauzy Inbox goes to Ever Works) on a real
 * SQLite file database: registered last in the plugin's migration list, idempotent (up, up again: no DDL error),
 * one row per person and tenant, tenant rows cascade with the tenant, and reversible (down drops it, up again).
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
import { DataSource } from 'typeorm';
import { EVER_WORKS_MIGRATIONS } from '../integration-ever-works.plugin';
import { CreateEverWorksInboxPreference1791000003510 } from './migrations/1791000003510-CreateEverWorksInboxPreference';

jest.setTimeout(60_000);

describe('ever_works_inbox_preference migration', () => {
	let dir: string;
	let dataSource: DataSource;
	const tenantId = randomUUID();
	const userId = randomUUID();

	const query = (sql: string, parameters?: unknown[]) => dataSource.query(sql, parameters);
	const hasTable = async () =>
		(await query(`SELECT 1 FROM "sqlite_master" WHERE "type" = 'table' AND "name" = 'ever_works_inbox_preference'`))
			.length > 0;
	const insert = (tenant: string, user: string) =>
		query(
			`INSERT INTO "ever_works_inbox_preference" ("id", "tenantId", "userId", "excludedKinds") VALUES (?, ?, ?, ?)`,
			[randomUUID(), tenant, user, '["email"]']
		);

	beforeAll(async () => {
		dir = mkdtempSync(join(tmpdir(), 'ever-works-inbox-preference-'));
	});

	afterAll(() => rmSync(dir, { recursive: true, force: true }));

	beforeEach(async () => {
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: join(dir, `${randomUUID()}.sqlite3`),
			logging: false
		});
		await dataSource.initialize();
		await query(`CREATE TABLE "tenant" ("id" varchar PRIMARY KEY NOT NULL)`);
		await query(`CREATE TABLE "organization" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar)`);
		await query(`INSERT INTO "tenant" ("id") VALUES (?)`, [tenantId]);
	});

	afterEach(async () => {
		await dataSource.destroy();
	});

	it('is the last of the plugin migrations (only registered where the plugin is on)', () => {
		expect(EVER_WORKS_MIGRATIONS[EVER_WORKS_MIGRATIONS.length - 1]).toBe(
			CreateEverWorksInboxPreference1791000003510
		);
	});

	it('creates the table once (a second run issues no failing DDL), keeps one row per person and tenant, and cascades with the tenant', async () => {
		const runner = dataSource.createQueryRunner();
		try {
			await new CreateEverWorksInboxPreference1791000003510().up(runner);
			await new CreateEverWorksInboxPreference1791000003510().up(runner);
			expect(await hasTable()).toBe(true);
			const columns = (
				(await query(`PRAGMA table_info("ever_works_inbox_preference")`)) as Array<{
					name: string;
					notnull: number;
				}>
			).map((column) => `${column.name}:${column.notnull}`);
			expect(columns).toEqual(
				expect.arrayContaining(['userId:1', 'excludedKinds:0', 'tenantId:0', 'organizationId:0'])
			);

			await insert(tenantId, userId);
			await expect(insert(tenantId, userId)).rejects.toThrow(/UNIQUE/);
			await insert(tenantId, randomUUID());

			await query('PRAGMA foreign_keys = ON');
			await query(`DELETE FROM "tenant" WHERE "id" = ?`, [tenantId]);
			expect(await query(`SELECT 1 FROM "ever_works_inbox_preference"`)).toHaveLength(0);
		} finally {
			await runner.release();
		}
	});

	it('down drops the table, and up creates it again', async () => {
		const runner = dataSource.createQueryRunner();
		try {
			await new CreateEverWorksInboxPreference1791000003510().up(runner);
			await new CreateEverWorksInboxPreference1791000003510().down(runner);
			expect(await hasTable()).toBe(false);
			await new CreateEverWorksInboxPreference1791000003510().down(runner);
			await new CreateEverWorksInboxPreference1791000003510().up(runner);
			expect(await hasTable()).toBe(true);
		} finally {
			await runner.release();
		}
	});
});
