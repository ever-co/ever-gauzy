import { MigrationInterface, QueryRunner } from 'typeorm';
import { addColumnIfMissing, dropColumnIfExists, lockMigrations } from '../migration-helpers';

/**
 * `chat_message.attachmentNames`: the names of a message's files at its send (or last edit), one per line — what a
 * message of files only reads as in previews, notifications and the search index. Nullable, no default and no
 * backfill: an existing message stays as it is (its files keep their names in the files pane).
 *
 * Idempotent on every dialect: the column is added only when it is missing, and dropped only when it is there.
 */
export class AddChatMessageAttachmentNames1791000007320 implements MigrationInterface {
	name = 'AddChatMessageAttachmentNames1791000007320';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await lockMigrations(queryRunner);
		await addColumnIfMissing(queryRunner, 'chat_message', 'attachmentNames', { postgres: 'text NULL', mysql: 'longtext NULL', sqlite: 'text NULL' });
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await lockMigrations(queryRunner);
		await dropColumnIfExists(queryRunner, 'chat_message', 'attachmentNames');
	}
}
