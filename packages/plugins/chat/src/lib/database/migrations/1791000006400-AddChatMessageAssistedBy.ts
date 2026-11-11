import { MigrationInterface, QueryRunner } from 'typeorm';
import { ChatDialect, dialectOf, lockMigrations, q } from '../migration-helpers';

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
			// Another process added it between the check and the statement (MySQL and SQLite take no lock here):
			// only that refusal, with the column really there now, counts as done. Anything else is raised as it is.
			if (!(isColumnRaceRefusal(d, error, 'duplicate') && (await queryRunner.hasColumn('chat_message', 'assistedBy')))) throw error;
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await lockMigrations(queryRunner);
		if (!(await queryRunner.hasColumn('chat_message', 'assistedBy'))) return;
		const d = dialectOf(queryRunner);
		try {
			await queryRunner.query(`ALTER TABLE ${q(d, 'chat_message')} DROP COLUMN ${q(d, 'assistedBy')}`);
		} catch (error) {
			// Another process dropped it first: only that refusal, with the column really gone, counts as done.
			if (!(isColumnRaceRefusal(d, error, 'missing') && !(await queryRunner.hasColumn('chat_message', 'assistedBy')))) throw error;
		}
	}
}

/**
 * Whether an `ALTER TABLE` was refused because a concurrent run already made the change: MySQL's duplicate column
 * (1060) / can't drop a missing one (1091), SQLite's `duplicate column name` / `no such column`. Never on Postgres:
 * `lockMigrations` serializes the runs there, and a refused statement aborts the transaction, so the error is
 * raised as it is (a re-check would only fail with 25P02 and hide it).
 */
export function isColumnRaceRefusal(dialect: ChatDialect, error: unknown, kind: 'duplicate' | 'missing'): boolean {
	const failure = error as { errno?: unknown; code?: unknown; message?: unknown; driverError?: { errno?: unknown; code?: unknown } } | null;
	const message = String(failure?.message ?? '');
	if (dialect === 'mysql') {
		const codes = [failure?.errno, failure?.code, failure?.driverError?.errno, failure?.driverError?.code].map((code) => String(code ?? ''));
		return kind === 'duplicate'
			? codes.includes('1060') || codes.includes('ER_DUP_FIELDNAME')
			: codes.includes('1091') || codes.includes('ER_CANT_DROP_FIELD_OR_KEY');
	}
	if (dialect === 'sqlite') {
		return kind === 'duplicate' ? /duplicate column name/i.test(message) : /no such column/i.test(message);
	}
	return false;
}
