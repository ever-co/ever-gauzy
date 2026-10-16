import { MigrationInterface, QueryRunner } from 'typeorm';
import { baseIndexes, dropTableIfExists, InboxDialect, IndexSpec, lockMigrations } from '../../../database/migration-helpers';
import { columnTypes, createEmailTable, EmailTableForeignKey } from '../email-table';

const TABLE = 'inbox_mailbox_member';
const PREFIX = 'inbox_mailbox_member';

/** The table's own columns, after the base columns, per dialect. */
export function inboxMailboxMemberColumns(d: InboxDialect): string {
	const { varchar, uuid, def, c } = columnTypes(d);
	return [
		`${c('mailboxId')} ${uuid} NOT NULL`,
		`${c('userId')} ${uuid} NOT NULL`,
		`${c('role')} ${varchar(16)} NOT NULL ${def('READER')}`
	].join(', ');
}

export const INBOX_MAILBOX_MEMBER_INDEXES: IndexSpec[] = [
	...baseIndexes(PREFIX),
	{ name: `IDX_${PREFIX}_user`, columns: ['userId'] },
	{ name: `UQ_${PREFIX}_mailbox_user`, columns: ['mailboxId', 'userId'], unique: true }
];

export const INBOX_MAILBOX_MEMBER_FOREIGN_KEYS: EmailTableForeignKey[] = [
	{ name: `FK_${PREFIX}_mailbox`, column: 'mailboxId', references: 'inbox_mailbox', onDelete: 'CASCADE' },
	{ name: `FK_${PREFIX}_user`, column: 'userId', references: 'user', onDelete: 'CASCADE' }
];

/**
 * `inbox_mailbox_member` (plan 04 §2, G-P4-2): the users of a shared mailbox; unique on `(mailboxId, userId)`.
 *
 * Registered only where `GAUZY_INBOX_ENABLED=true` and `GAUZY_INBOX_EMAIL_ENABLED=true` load the Inbox email plugin.
 * Idempotent on every dialect (a re-run issues no DDL and repairs what a failed run left out), serialised on
 * Postgres, reversible (`down` drops the table).
 */
export class CreateInboxMailboxMemberTable1791000002600 implements MigrationInterface {
	name = 'CreateInboxMailboxMemberTable1791000002600';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await createEmailTable(queryRunner, {
			table: TABLE,
			prefix: PREFIX,
			columns: inboxMailboxMemberColumns,
			indexes: INBOX_MAILBOX_MEMBER_INDEXES,
			foreignKeys: INBOX_MAILBOX_MEMBER_FOREIGN_KEYS
		});
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await lockMigrations(queryRunner);
		await dropTableIfExists(queryRunner, TABLE);
	}
}
