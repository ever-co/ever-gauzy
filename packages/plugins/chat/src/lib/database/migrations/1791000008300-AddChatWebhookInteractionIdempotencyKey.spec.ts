import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { isUniqueViolation } from '../../../../../../core/src/lib/core/errors/unique-violation';
import { createTableIfMissing } from '../migration-helpers';
import { CHAT_WEBHOOK_TABLES } from './1791000006730-CreateChatWebhooks';
import {
	AddChatWebhookInteractionIdempotencyKey1791000008300,
	CHAT_INTERACTION_KEY_INDEX
} from './1791000008300-AddChatWebhookInteractionIdempotencyKey';

const INDEX = 'UQ_chat_webhook_interaction_idempotency_key';

/**
 * `chat_webhook_interaction.idempotencyKey` and its unique (tenant, message, clicker, key) index: run for real on
 * SQLite against the table as `CreateChatWebhooks1791000006730` creates it (foreign keys not enforced: the tables it
 * points at are not made here), and checked statement by statement on Postgres and MySQL.
 */
describe('AddChatWebhookInteractionIdempotencyKey1791000008300 on SQLite', () => {
	let dataSource: DataSource;
	let dbPath: string;

	const run = async (direction: 'up' | 'down') => {
		const queryRunner = dataSource.createQueryRunner();
		try {
			await new AddChatWebhookInteractionIdempotencyKey1791000008300()[direction](queryRunner);
		} finally {
			await queryRunner.release();
		}
	};

	const indexes = async (): Promise<string[]> =>
		(
			(await dataSource.query(
				`SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'chat_webhook_interaction' AND name LIKE 'UQ_%'`
			)) as Array<{ name: string }>
		).map((row) => row.name);
	const columns = async (): Promise<string[]> =>
		((await dataSource.query(`PRAGMA table_info("chat_webhook_interaction")`)) as Array<{ name: string }>).map(
			(row) => row.name
		);

	let sequence = 0;
	const insert = (row: {
		tenantId?: string;
		messageId?: string;
		actorUserId?: string;
		idempotencyKey: string | null;
	}) =>
		dataSource.query(
			`INSERT INTO "chat_webhook_interaction" ("id", "tenantId", "webhookId", "messageId", "conversationId", "actorEmployeeId", "actorUserId", "actionId", "idempotencyKey") VALUES (?, ?, 'w1', ?, 'c1', 'e1', ?, 'ack', ?)`,
			[
				`i-${++sequence}`,
				row.tenantId ?? 'ten',
				row.messageId ?? 'm1',
				row.actorUserId ?? 'u1',
				row.idempotencyKey
			]
		);

	beforeEach(async () => {
		dbPath = path.join(
			os.tmpdir(),
			`gauzy-chat-interaction-key-${process.pid}-${Date.now()}-${Math.random()}.sqlite3`
		);
		dataSource = new DataSource({ type: 'better-sqlite3', database: dbPath, synchronize: false, logging: false });
		await dataSource.initialize();
		await dataSource.query('PRAGMA foreign_keys = OFF');
		const queryRunner = dataSource.createQueryRunner();
		try {
			const table = CHAT_WEBHOOK_TABLES.find((spec) => spec.table === 'chat_webhook_interaction');
			if (!table) throw new Error('CreateChatWebhooks1791000006730 no longer declares chat_webhook_interaction.');
			await createTableIfMissing(queryRunner, table);
		} finally {
			await queryRunner.release();
		}
	});

	afterEach(async () => {
		if (dataSource?.isInitialized) await dataSource.destroy();
		fs.rmSync(dbPath, { force: true });
	});

	it('adds the nullable column and the unique key; a second row of one key is refused as a unique violation', async () => {
		expect(await columns()).not.toContain('idempotencyKey');
		await run('up');
		expect(await columns()).toContain('idempotencyKey');
		expect(await indexes()).toEqual([INDEX]);
		await insert({ idempotencyKey: 'click-1' });
		const refusal = await insert({ idempotencyKey: 'click-1' }).catch((error: unknown) => error);
		expect(String((refusal as Error)?.message)).toMatch(/UNIQUE constraint failed/);
		// The error TypeORM raises is what the service's race handling recognises.
		expect(isUniqueViolation(refusal)).toBe(true);
	});

	it('admits any number of rows without a key, and the same key for another clicker, message or tenant', async () => {
		await run('up');
		await insert({ idempotencyKey: null });
		await insert({ idempotencyKey: null });
		await insert({ idempotencyKey: 'click-1' });
		await insert({ idempotencyKey: 'click-1', actorUserId: 'u2' });
		await insert({ idempotencyKey: 'click-1', messageId: 'm2' });
		await insert({ idempotencyKey: 'click-1', tenantId: 'other' });
		expect(
			(
				(await dataSource.query('SELECT COUNT(*) AS n FROM "chat_webhook_interaction"')) as Array<{ n: number }>
			)[0].n
		).toBe(6);
	});

	it('runs twice without a change, goes down (index first, then the column) twice, and up again', async () => {
		await run('up');
		await run('up');
		expect(await indexes()).toEqual([INDEX]);
		await insert({ idempotencyKey: 'click-1' });
		await run('down');
		await run('down');
		expect(await indexes()).toEqual([]);
		expect(await columns()).not.toContain('idempotencyKey');
		// The existing click stays, without its key.
		expect(
			(
				(await dataSource.query('SELECT COUNT(*) AS n FROM "chat_webhook_interaction"')) as Array<{ n: number }>
			)[0].n
		).toBe(1);
		await run('up');
		expect(await columns()).toContain('idempotencyKey');
		expect(await indexes()).toEqual([INDEX]);
	});
});

/** A query runner of one dialect that records its statements; `present` says whether the column and index exist. */
function runner(type: 'postgres' | 'mysql' | 'better-sqlite3', present = false) {
	const statements: string[] = [];
	return {
		statements,
		connection: { options: { type } },
		hasColumn: jest.fn(async () => present),
		query: jest.fn(async (sql: string) => {
			statements.push(sql);
			// The probes (`pg_indexes`, `information_schema.STATISTICS`, `sqlite_master`) answer whether the index exists.
			return present && /^SELECT 1/.test(sql) ? [{ 1: 1 }] : [];
		})
	};
}

describe('AddChatWebhookInteractionIdempotencyKey1791000008300 statements', () => {
	const ddl = (statements: string[]) => statements.filter((sql) => !sql.startsWith('SELECT'));

	it('writes each dialect its own spelling: a partial unique index on Postgres and SQLite, a plain one on MySQL', async () => {
		const postgres = runner('postgres');
		await new AddChatWebhookInteractionIdempotencyKey1791000008300().up(postgres as never);
		expect(ddl(postgres.statements)).toEqual([
			'ALTER TABLE "chat_webhook_interaction" ADD COLUMN "idempotencyKey" varchar(64) NULL',
			`CREATE UNIQUE INDEX IF NOT EXISTS "${INDEX}" ON "chat_webhook_interaction" ("tenantId", "messageId", "actorUserId", "idempotencyKey") WHERE "idempotencyKey" IS NOT NULL`
		]);
		// Serialised with the plugin's other migrations.
		expect(postgres.statements[0]).toBe('SELECT pg_advisory_xact_lock(hashtext($1))');
		const mysql = runner('mysql');
		await new AddChatWebhookInteractionIdempotencyKey1791000008300().up(mysql as never);
		expect(ddl(mysql.statements)).toEqual([
			'ALTER TABLE `chat_webhook_interaction` ADD COLUMN `idempotencyKey` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL',
			`CREATE UNIQUE INDEX \`${INDEX}\` ON \`chat_webhook_interaction\` (\`tenantId\`, \`messageId\`, \`actorUserId\`, \`idempotencyKey\`)`
		]);
		const sqlite = runner('better-sqlite3');
		await new AddChatWebhookInteractionIdempotencyKey1791000008300().up(sqlite as never);
		expect(ddl(sqlite.statements)).toEqual([
			'ALTER TABLE "chat_webhook_interaction" ADD COLUMN "idempotencyKey" varchar(64) NULL',
			`CREATE UNIQUE INDEX IF NOT EXISTS "${INDEX}" ON "chat_webhook_interaction" ("tenantId", "messageId", "actorUserId", "idempotencyKey") WHERE "idempotencyKey" IS NOT NULL`
		]);
	});

	it('changes nothing on MySQL when the column and the index are there, and drops the index before the column', async () => {
		const present = runner('mysql', true);
		await new AddChatWebhookInteractionIdempotencyKey1791000008300().up(present as never);
		expect(ddl(present.statements)).toEqual([]);
		const down = runner('postgres', true);
		await new AddChatWebhookInteractionIdempotencyKey1791000008300().down(down as never);
		expect(ddl(down.statements)).toEqual([
			`DROP INDEX IF EXISTS "${INDEX}"`,
			'ALTER TABLE "chat_webhook_interaction" DROP COLUMN "idempotencyKey"'
		]);
		const mysqlDown = runner('mysql', true);
		await new AddChatWebhookInteractionIdempotencyKey1791000008300().down(mysqlDown as never);
		expect(ddl(mysqlDown.statements)).toEqual([
			`DROP INDEX \`${INDEX}\` ON \`chat_webhook_interaction\``,
			'ALTER TABLE `chat_webhook_interaction` DROP COLUMN `idempotencyKey`'
		]);
	});

	it('takes a column another MySQL process added meanwhile as added, and raises anything else', async () => {
		const racing = runner('mysql');
		racing.hasColumn.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
		racing.query.mockImplementation(async (sql: string) => {
			racing.statements.push(sql);
			if (sql.startsWith('ALTER TABLE'))
				throw Object.assign(new Error("Duplicate column name 'idempotencyKey'"), { errno: 1060 });
			return [];
		});
		await expect(
			new AddChatWebhookInteractionIdempotencyKey1791000008300().up(racing as never)
		).resolves.toBeUndefined();
		const failing = runner('mysql');
		failing.query.mockImplementation(async (sql: string) => {
			if (sql.startsWith('ALTER TABLE')) throw new Error('disk full');
			return [];
		});
		await expect(new AddChatWebhookInteractionIdempotencyKey1791000008300().up(failing as never)).rejects.toThrow(
			'disk full'
		);
	});

	it('keys the index on the columns the service looks a repeat up by', () => {
		expect(CHAT_INTERACTION_KEY_INDEX.columns).toEqual(['tenantId', 'messageId', 'actorUserId', 'idempotencyKey']);
		expect(CHAT_INTERACTION_KEY_INDEX.unique).toBe(true);
	});
});
