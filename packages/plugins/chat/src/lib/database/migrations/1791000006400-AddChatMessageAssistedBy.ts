import { MigrationInterface, QueryRunner } from 'typeorm';
import { dialectOf, lockMigrations, q } from '../migration-helpers';

/**
 * `chat_message.assistedBy`: the assistant a person wrote a message with (an AI client posting in their name),
 * shown beside the message. Nullable, no default: every existing message stays as it is.
 *
 * Idempotent on every dialect: the column is added only when it is missing, and dropped only when it is there.
 */
export class AddChatMessageAssistedBy1791000006400 implements MigrationInterface {
	name = 'AddChatMessageAssistedBy1791000006400';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await lockMigrations(queryRunner);
		if (await queryRunner.hasColumn('chat_message', 'assistedBy')) return;
		const d = dialectOf(queryRunner);
		try {
			// Constant identifiers, quoted for the dialect: no value of anyone's goes into the statement.
			await queryRunner.query(`ALTER TABLE ${q(d, 'chat_message')} ADD COLUMN ${q(d, 'assistedBy')} varchar(120) NULL`);
		} catch (error) {
			// Another process added it between the check and the statement (MySQL has no lock here): the column is there.
			if (!(await queryRunner.hasColumn('chat_message', 'assistedBy'))) throw error;
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await lockMigrations(queryRunner);
		if (!(await queryRunner.hasColumn('chat_message', 'assistedBy'))) return;
		const d = dialectOf(queryRunner);
		try {
			await queryRunner.query(`ALTER TABLE ${q(d, 'chat_message')} DROP COLUMN ${q(d, 'assistedBy')}`);
		} catch (error) {
			// Another process dropped it first: the column is gone, as asked.
			if (await queryRunner.hasColumn('chat_message', 'assistedBy')) throw error;
		}
	}
}
