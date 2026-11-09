import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { createTableIfMissing } from '../migration-helpers';
import { CHAT_TABLES } from './1791000006100-CreateChatTables';
import { ScopeChatDirectKeyToOrganization1791000006600 } from './1791000006600-ScopeChatDirectKeyToOrganization';

const OLD = 'UQ_chat_conversation_direct_key';
const NEW = 'UQ_chat_conversation_organization_direct_key';

/**
 * `chat_conversation.directKey` unique per organization, run for real on SQLite against the table as
 * `CreateChatTables1791000006100` creates it (foreign keys not enforced: there is no tenant or organization table
 * here), and checked statement by statement on Postgres and MySQL.
 */
describe('ScopeChatDirectKeyToOrganization1791000006600 on SQLite', () => {
	let dataSource: DataSource;
	let dbPath: string;

	const run = async (direction: 'up' | 'down') => {
		const queryRunner = dataSource.createQueryRunner();
		try {
			await new ScopeChatDirectKeyToOrganization1791000006600()[direction](queryRunner);
		} finally {
			await queryRunner.release();
		}
	};

	const indexes = async (): Promise<string[]> =>
		(
			(await dataSource.query(
				`SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'chat_conversation' AND name LIKE 'UQ_%'`
			)) as Array<{ name: string }>
		)
			.map((row) => row.name)
			.sort();

	let sequence = 0;
	const insert = (organizationId: string | null, directKey: string | null) =>
		dataSource.query(
			`INSERT INTO "chat_conversation" ("id", "tenantId", "organizationId", "kind", "directKey") VALUES (?, 'ten', ?, 'direct', ?)`,
			[`c-${++sequence}`, organizationId, directKey]
		);

	beforeEach(async () => {
		dbPath = path.join(os.tmpdir(), `gauzy-chat-direct-key-${process.pid}-${Date.now()}-${Math.random()}.sqlite3`);
		dataSource = new DataSource({ type: 'better-sqlite3', database: dbPath, synchronize: false, logging: false });
		await dataSource.initialize();
		await dataSource.query('PRAGMA foreign_keys = OFF');
		const queryRunner = dataSource.createQueryRunner();
		try {
			for (const spec of CHAT_TABLES.filter((table) =>
				['chat_category', 'chat_conversation'].includes(table.table)
			)) {
				await createTableIfMissing(queryRunner, spec);
			}
		} finally {
			await queryRunner.release();
		}
	});

	afterEach(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
		fs.rmSync(dbPath, { force: true });
	});

	it('starts from the per-tenant key: the same people cannot have a conversation in a second organization', async () => {
		expect(await indexes()).toEqual([OLD]);
		await insert('org-a', 'k1');
		await expect(insert('org-b', 'k1')).rejects.toThrow(/UNIQUE constraint failed/);
	});

	it('makes the key unique per organization, keeping every existing row', async () => {
		await insert('org-a', 'k1');
		await insert('org-a', null);
		await run('up');

		expect(await indexes()).toEqual([NEW]);
		await insert('org-b', 'k1');
		await insert('org-a', null);
		await expect(insert('org-a', 'k1')).rejects.toThrow(/UNIQUE constraint failed/);
		const [{ count }] = await dataSource.query(`SELECT COUNT(*) AS "count" FROM "chat_conversation"`);
		expect(Number(count)).toBe(4);
	});

	it('is a no-op when run twice', async () => {
		await run('up');
		await expect(run('up')).resolves.toBeUndefined();
		expect(await indexes()).toEqual([NEW]);
	});

	it('goes back to the per-tenant key, and refuses — changing nothing — while two organizations share a key', async () => {
		await run('up');
		await insert('org-a', 'k1');
		await insert('org-b', 'k1');
		await expect(run('down')).rejects.toThrow(/UNIQUE constraint failed/);
		expect(await indexes()).toEqual([NEW]);

		await dataSource.query(`DELETE FROM "chat_conversation" WHERE "organizationId" = 'org-b'`);
		await run('down');
		expect(await indexes()).toEqual([OLD]);
		await expect(run('down')).resolves.toBeUndefined();
	});
});

/** A query runner of one dialect that records its statements and answers the index probes from a set. */
function runner(type: 'postgres' | 'mysql', present: string[]) {
	const statements: string[] = [];
	const indexes = new Set(present);
	return {
		statements,
		indexes,
		connection: { options: { type } },
		query: jest.fn(async (sql: string, parameters?: unknown[]) => {
			if (sql.includes('information_schema.STATISTICS') || sql.includes('pg_indexes')) {
				return indexes.has(String(parameters?.[1])) ? [{ exists: 1 }] : [];
			}
			statements.push(sql);
			const created = sql.match(/CREATE UNIQUE INDEX (?:IF NOT EXISTS )?[`"](\w+)[`"]/);
			if (created) indexes.add(created[1]);
			const dropped = sql.match(/DROP INDEX (?:IF EXISTS )?[`"](\w+)[`"]/);
			if (dropped) indexes.delete(dropped[1]);
			return [];
		})
	};
}

describe('ScopeChatDirectKeyToOrganization1791000006600 on Postgres and MySQL', () => {
	it('creates the per-organization index before it drops the per-tenant one, under the migration lock (Postgres)', async () => {
		const postgres = runner('postgres', [OLD]);
		await new ScopeChatDirectKeyToOrganization1791000006600().up(postgres as never);
		expect(postgres.statements).toEqual([
			'SELECT pg_advisory_xact_lock(hashtext($1))',
			`CREATE UNIQUE INDEX IF NOT EXISTS "${NEW}" ON "chat_conversation" ("tenantId", "organizationId", "directKey") WHERE "directKey" IS NOT NULL`,
			`DROP INDEX IF EXISTS "${OLD}"`
		]);
		await new ScopeChatDirectKeyToOrganization1791000006600().down(postgres as never);
		expect(postgres.statements.slice(3)).toEqual([
			'SELECT pg_advisory_xact_lock(hashtext($1))',
			`CREATE UNIQUE INDEX IF NOT EXISTS "${OLD}" ON "chat_conversation" ("tenantId", "directKey") WHERE "directKey" IS NOT NULL`,
			`DROP INDEX IF EXISTS "${NEW}"`
		]);
	});

	it('creates and drops each index once on MySQL (no partial index, no IF [NOT] EXISTS), and nothing when run twice', async () => {
		const mysql = runner('mysql', [OLD]);
		await new ScopeChatDirectKeyToOrganization1791000006600().up(mysql as never);
		expect(mysql.statements).toEqual([
			'CREATE UNIQUE INDEX `' + NEW + '` ON `chat_conversation` (`tenantId`, `organizationId`, `directKey`)',
			'DROP INDEX `' + OLD + '` ON `chat_conversation`'
		]);
		expect([...mysql.indexes]).toEqual([NEW]);
		await new ScopeChatDirectKeyToOrganization1791000006600().up(mysql as never);
		expect(mysql.statements).toHaveLength(2);

		await new ScopeChatDirectKeyToOrganization1791000006600().down(mysql as never);
		expect(mysql.statements.slice(2)).toEqual([
			'CREATE UNIQUE INDEX `' + OLD + '` ON `chat_conversation` (`tenantId`, `directKey`)',
			'DROP INDEX `' + NEW + '` ON `chat_conversation`'
		]);
	});

	it('takes an index another process dropped between the probe and the statement as dropped (MySQL)', async () => {
		const racing = runner('mysql', [NEW, OLD]);
		racing.query.mockImplementation(async (sql: string, parameters?: unknown[]) => {
			if (sql.includes('information_schema.STATISTICS')) {
				const name = String(parameters?.[1]);
				const probes = racing.query.mock.calls.filter(
					([statement, values]) =>
						String(statement).includes('STATISTICS') && (values as unknown[])?.[1] === name
				).length;
				// Present at the first probe, gone at the re-check.
				return racing.indexes.has(name) && probes === 1 ? [{ exists: 1 }] : [];
			}
			if (sql.startsWith('DROP INDEX'))
				throw Object.assign(
					new Error("Can't DROP 'UQ_chat_conversation_direct_key'; check that column/key exists"),
					{ errno: 1091 }
				);
			return [];
		});
		await expect(new ScopeChatDirectKeyToOrganization1791000006600().up(racing as never)).resolves.toBeUndefined();
	});
});
