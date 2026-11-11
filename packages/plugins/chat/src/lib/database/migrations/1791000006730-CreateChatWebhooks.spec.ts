import { CreateChatWebhooks1791000006730 } from './1791000006730-CreateChatWebhooks';

/** A query runner of one dialect that records its statements; `columns` are the `chat_message` columns already there. */
function runner(type: 'postgres' | 'mysql' | 'better-sqlite3', columns: string[] = []) {
	const statements: string[] = [];
	const present = new Set(columns);
	return {
		statements,
		connection: { options: { type } },
		hasColumn: jest.fn(async (_table: string, column: string) => present.has(column)),
		query: jest.fn(async (sql: string) => {
			statements.push(sql);
			return [];
		})
	};
}

describe('CreateChatWebhooks1791000006730', () => {
	it('adds the three nullable chat_message columns, the nonce key and both tables on Postgres', async () => {
		const postgres = runner('postgres');
		await new CreateChatWebhooks1791000006730().up(postgres as never);
		const sql = postgres.statements.join('\n');
		expect(postgres.statements.filter((statement) => statement.startsWith('ALTER TABLE "chat_message" ADD COLUMN'))).toEqual([
			'ALTER TABLE "chat_message" ADD COLUMN "webhookId" uuid',
			'ALTER TABLE "chat_message" ADD COLUMN "appIconUrl" varchar(2048)',
			'ALTER TABLE "chat_message" ADD COLUMN "blocks" text'
		]);
		expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "UQ_chat_message_webhook_nonce" ON "chat_message" ("webhookId", "nonce") WHERE "webhookId" IS NOT NULL AND "nonce" IS NOT NULL');
		expect(sql).toContain('CREATE TABLE IF NOT EXISTS "chat_webhook"');
		expect(sql).toContain('CREATE TABLE IF NOT EXISTS "chat_webhook_interaction"');
		expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "UQ_chat_webhook_token_hash" ON "chat_webhook" ("tokenHash")');
		expect(sql).toContain('"tokenHash" varchar(64) NOT NULL');
		expect(sql).toMatch(/FOREIGN KEY \("conversationId"\) REFERENCES "chat_conversation"\("id"\) ON DELETE CASCADE/);
	});

	it('writes each dialect its own spelling, MySQL without a partial index', async () => {
		const mysql = runner('mysql');
		await new CreateChatWebhooks1791000006730().up(mysql as never);
		expect(mysql.statements).toContain('ALTER TABLE `chat_message` ADD COLUMN `webhookId` varchar(36) NULL');
		expect(mysql.statements).toContain('ALTER TABLE `chat_message` ADD COLUMN `blocks` longtext NULL');
		expect(mysql.statements.join('\n')).toContain('CREATE UNIQUE INDEX `UQ_chat_message_webhook_nonce` ON `chat_message` (`webhookId`, `nonce`)');
		const sqlite = runner('better-sqlite3');
		await new CreateChatWebhooks1791000006730().up(sqlite as never);
		expect(sqlite.statements).toContain('ALTER TABLE "chat_message" ADD COLUMN "appIconUrl" varchar(2048)');
		expect(sqlite.statements.join('\n')).toContain('CONSTRAINT "FK_chat_webhook_interaction_message" FOREIGN KEY ("messageId") REFERENCES "chat_message" ("id") ON DELETE CASCADE');
	});

	it('adds nothing twice: a column already there is left alone', async () => {
		const again = runner('postgres', ['webhookId', 'appIconUrl', 'blocks']);
		await new CreateChatWebhooks1791000006730().up(again as never);
		expect(again.statements.some((statement) => statement.startsWith('ALTER TABLE "chat_message" ADD COLUMN'))).toBe(false);
	});

	it('takes a column another MySQL process added meanwhile as added, and raises anything else', async () => {
		const racing = runner('mysql');
		racing.hasColumn.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
		racing.query.mockRejectedValueOnce(Object.assign(new Error("Duplicate column name 'webhookId'"), { errno: 1060 }));
		await expect(new CreateChatWebhooks1791000006730().up(racing as never)).resolves.toBeUndefined();
		const failing = runner('mysql');
		failing.query.mockRejectedValueOnce(new Error('disk full'));
		await expect(new CreateChatWebhooks1791000006730().up(failing as never)).rejects.toThrow('disk full');
	});

	it('drops the tables, the indexes and the columns it added on the way down', async () => {
		const postgres = runner('postgres', ['webhookId', 'appIconUrl', 'blocks']);
		await new CreateChatWebhooks1791000006730().down(postgres as never);
		expect(postgres.statements).toEqual(
			expect.arrayContaining([
				'DROP TABLE IF EXISTS "chat_webhook_interaction"',
				'DROP TABLE IF EXISTS "chat_webhook"',
				'DROP INDEX IF EXISTS "UQ_chat_message_webhook_nonce"',
				'ALTER TABLE "chat_message" DROP COLUMN "blocks"',
				'ALTER TABLE "chat_message" DROP COLUMN "webhookId"'
			])
		);
		expect(postgres.statements.indexOf('DROP TABLE IF EXISTS "chat_webhook_interaction"')).toBeLessThan(postgres.statements.indexOf('DROP TABLE IF EXISTS "chat_webhook"'));
	});
});
