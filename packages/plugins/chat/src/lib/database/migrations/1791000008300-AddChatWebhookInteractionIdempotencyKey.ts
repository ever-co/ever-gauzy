import { MigrationInterface, QueryRunner } from 'typeorm';
import {
	addColumnIfMissing,
	createIndexIfMissing,
	dropColumnIfExists,
	dropIndexIfExists,
	IndexSpec,
	lockMigrations
} from '../migration-helpers';

const TABLE = 'chat_webhook_interaction';
const COLUMN = 'idempotencyKey';

/**
 * One click per (tenant, message, clicker, key): the second request with a key is answered with the first one's row.
 * Partial where the dialect allows it (only keyed rows are indexed); MySQL's index takes every row, and a NULL key —
 * a client that sends none — never collides there either.
 */
export const CHAT_INTERACTION_KEY_INDEX: IndexSpec = {
	name: 'UQ_chat_webhook_interaction_idempotency_key',
	columns: ['tenantId', 'messageId', 'actorUserId', COLUMN],
	unique: true,
	where: { postgres: `"${COLUMN}" IS NOT NULL`, sqlite: `"${COLUMN}" IS NOT NULL` }
};

/**
 * `chat_webhook_interaction.idempotencyKey`: the `Idempotency-Key` a client sends with a button click (the same on
 * each retry of that click), and the unique index that makes a double click or a retry after a lost answer one
 * interaction and one callback. Nullable, no default and no backfill: every existing click stays as it is, and a
 * client that sends no key keeps one interaction per request.
 *
 * Compared case-sensitively on every dialect (`utf8mb4_bin` on MySQL). Guarded and idempotent on every dialect (serialised on Postgres; the column and the index are made only when they
 * are missing, a concurrent MySQL or SQLite run taken as done) and reversible: the index goes before the column (SQLite
 * cannot drop an indexed column).
 */
export class AddChatWebhookInteractionIdempotencyKey1791000008300 implements MigrationInterface {
	name = 'AddChatWebhookInteractionIdempotencyKey1791000008300';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await lockMigrations(queryRunner);
		await addColumnIfMissing(queryRunner, TABLE, COLUMN, {
			postgres: 'varchar(64) NULL',
			// A key is compared byte for byte, as on Postgres and SQLite: MySQL's default collations ignore letter case,
			// and would take `click-A` for `click-a` (one click for two, or a 409 for the second button).
			mysql: 'varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL',
			sqlite: 'varchar(64) NULL'
		});
		await createIndexIfMissing(queryRunner, TABLE, CHAT_INTERACTION_KEY_INDEX);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await lockMigrations(queryRunner);
		await dropIndexIfExists(queryRunner, TABLE, CHAT_INTERACTION_KEY_INDEX.name);
		await dropColumnIfExists(queryRunner, TABLE, COLUMN);
	}
}
