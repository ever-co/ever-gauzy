import { MigrationInterface, QueryRunner } from 'typeorm';
import {
	ChatDialect,
	columnTypes,
	createIndexIfMissing,
	createTableIfMissing,
	dialectOf,
	dropIndexIfExists,
	dropTableIfExists,
	isColumnRaceRefusal,
	lockMigrations,
	q,
	TableSpec
} from '../migration-helpers';

/** The webhook tables, in dependency order (a webhook before its interactions). */
export const CHAT_WEBHOOK_TABLES: TableSpec[] = [
	{
		table: 'chat_webhook',
		prefix: 'chat_webhook',
		columns: (d: ChatDialect) => {
			const t = columnTypes(d);
			return [
				t.uuid('conversationId'),
				t.varchar('name', 80, true),
				t.varchar('iconUrl', 2048),
				t.varchar('interactionUrl', 2048),
				t.varchar('tokenHash', 64, true),
				t.varchar('tokenHint', 8, true),
				t.text('signingSecret'),
				t.bool('canBroadcast'),
				t.uuid('createdByEmployeeId', false),
				t.ts('revokedAt'),
				t.uuid('revokedByEmployeeId', false),
				t.ts('lastUsedAt'),
				t.int('acceptedCount'),
				t.int('rejectedCount'),
				t.int('rateLimitedCount'),
				t.int('callbackFailureCount')
			].join(', ');
		},
		indexes: [
			{ name: 'IDX_chat_webhook_conversation', columns: ['conversationId'] },
			{ name: 'UQ_chat_webhook_token_hash', columns: ['tokenHash'], unique: true }
		],
		foreignKeys: [{ name: 'FK_chat_webhook_conversation', column: 'conversationId', references: 'chat_conversation', onDelete: 'CASCADE' }]
	},
	{
		table: 'chat_webhook_interaction',
		prefix: 'chat_webhook_interaction',
		columns: (d: ChatDialect) => {
			const t = columnTypes(d);
			return [
				t.uuid('webhookId'),
				t.uuid('messageId'),
				t.uuid('conversationId'),
				t.uuid('actorEmployeeId'),
				t.uuid('actorUserId'),
				t.varchar('actionId', 255, true),
				t.varchar('blockId', 255),
				t.varchar('value', 2000),
				t.varchar('status', 16, true, 'pending'),
				t.int('attempts'),
				t.int('lastStatusCode'),
				t.varchar('lastError', 255),
				t.ts('deliveredAt'),
				t.ts('replyAppliedAt')
			].join(', ');
		},
		indexes: [
			{ name: 'IDX_chat_webhook_interaction_message', columns: ['messageId'] },
			{ name: 'IDX_chat_webhook_interaction_webhook', columns: ['webhookId'] }
		],
		foreignKeys: [
			{ name: 'FK_chat_webhook_interaction_webhook', column: 'webhookId', references: 'chat_webhook', onDelete: 'CASCADE' },
			{ name: 'FK_chat_webhook_interaction_message', column: 'messageId', references: 'chat_message', onDelete: 'CASCADE' }
		]
	}
];

/** The `chat_message` columns an app post carries, each in its dialect's spelling. */
export const CHAT_MESSAGE_WEBHOOK_COLUMNS: Array<{ name: string; type: (d: ChatDialect) => string }> = [
	{ name: 'webhookId', type: (d) => (d === 'postgres' ? 'uuid' : d === 'mysql' ? 'varchar(36) NULL' : 'varchar') },
	{ name: 'appIconUrl', type: (d) => (d === 'mysql' ? 'varchar(2048) NULL' : 'varchar(2048)') },
	{ name: 'blocks', type: (d) => (d === 'mysql' ? 'longtext NULL' : 'text') }
];

/** One post per (webhook, nonce): the sender's retry answers the first post. Partial where the dialect allows it. */
export const CHAT_MESSAGE_WEBHOOK_INDEXES = [
	{ name: 'IDX_chat_message_webhook', columns: ['webhookId'] },
	{
		name: 'UQ_chat_message_webhook_nonce',
		columns: ['webhookId', 'nonce'],
		unique: true,
		where: { postgres: '"webhookId" IS NOT NULL AND "nonce" IS NOT NULL', sqlite: '"webhookId" IS NOT NULL AND "nonce" IS NOT NULL' }
	}
];

/**
 * Chat incoming webhooks (the `chat-incoming-webhooks` spec, plan §3): `chat_webhook`, `chat_webhook_interaction`,
 * and three nullable `chat_message` columns (`webhookId`, `appIconUrl`, `blocks`) with the per-webhook nonce key.
 * Registered with the chat plugin (the tables exist whenever chat does; the routes answer only with
 * `GAUZY_CHAT_WEBHOOKS_ENABLED=true`). Idempotent on every dialect, serialised on Postgres, reversible.
 */
export class CreateChatWebhooks1791000006730 implements MigrationInterface {
	name = 'CreateChatWebhooks1791000006730';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await lockMigrations(queryRunner);
		const d = dialectOf(queryRunner);
		for (const column of CHAT_MESSAGE_WEBHOOK_COLUMNS) {
			if (await queryRunner.hasColumn('chat_message', column.name)) continue;
			try {
				// Constant identifiers and types: no value of anyone's goes into the statement.
				await queryRunner.query(`ALTER TABLE ${q(d, 'chat_message')} ADD COLUMN ${q(d, column.name)} ${column.type(d)}`);
			} catch (error) {
				// Added by another process between the check and here (MySQL and SQLite take no lock): only that refusal,
				// with the column really there now, counts as done (`isColumnRaceRefusal` is never true on Postgres).
				if (!(isColumnRaceRefusal(d, error, 'duplicate') && (await queryRunner.hasColumn('chat_message', column.name)))) throw error;
			}
		}
		for (const index of CHAT_MESSAGE_WEBHOOK_INDEXES) {
			await createIndexIfMissing(queryRunner, 'chat_message', index);
		}
		for (const spec of CHAT_WEBHOOK_TABLES) {
			await createTableIfMissing(queryRunner, spec);
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await lockMigrations(queryRunner);
		const d = dialectOf(queryRunner);
		for (const spec of [...CHAT_WEBHOOK_TABLES].reverse()) {
			await dropTableIfExists(queryRunner, spec.table);
		}
		for (const index of [...CHAT_MESSAGE_WEBHOOK_INDEXES].reverse()) {
			await dropIndexIfExists(queryRunner, 'chat_message', index.name);
		}
		for (const column of [...CHAT_MESSAGE_WEBHOOK_COLUMNS].reverse()) {
			if (!(await queryRunner.hasColumn('chat_message', column.name))) continue;
			try {
				await queryRunner.query(`ALTER TABLE ${q(d, 'chat_message')} DROP COLUMN ${q(d, column.name)}`);
			} catch (error) {
				if (!(isColumnRaceRefusal(d, error, 'missing') && !(await queryRunner.hasColumn('chat_message', column.name)))) throw error;
			}
		}
	}
}
