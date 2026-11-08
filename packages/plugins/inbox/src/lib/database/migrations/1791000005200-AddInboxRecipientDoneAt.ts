import { MigrationInterface, QueryRunner } from 'typeorm';
import { addColumnIfMissing, lockMigrations } from '../migration-helpers';

/**
 * `inbox_item_recipient.doneAt`: when a recipient marked an item done (the Inbox spec, "triage": read, unread,
 * archive, snooze, done). Nullable and additive; nothing reads it until the plugin that ships it is loaded.
 * Idempotent: a column that exists is left alone.
 */
export class AddInboxRecipientDoneAt1791000005200 implements MigrationInterface {
	name = 'AddInboxRecipientDoneAt1791000005200';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await lockMigrations(queryRunner);
		await addColumnIfMissing(queryRunner, 'inbox_item_recipient', 'doneAt', {
			postgres: 'TIMESTAMP',
			mysql: 'datetime(6) NULL',
			sqlite: 'datetime'
		});
	}

	/** Deliberate no-op: the column is nullable and inert without the plugin; a rollback keeps the data. */
	public async down(): Promise<void> {
		return;
	}
}
