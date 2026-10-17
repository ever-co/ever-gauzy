import { MigrationInterface, QueryRunner } from 'typeorm';
import {
	baseIndexes,
	dropTableIfExists,
	InboxDialect,
	IndexSpec,
	lockMigrations
} from '../../../database/migration-helpers';
import { columnTypes, createEmailTable, EmailTableForeignKey } from '../email-table';

const TABLE = 'inbox_email_thread';
const PREFIX = 'inbox_email_thread';

/** The table's own columns, after the base columns, per dialect. */
export function inboxEmailThreadColumns(d: InboxDialect): string {
	const { varchar, uuid, ts, int, zero, nul, c } = columnTypes(d);
	return [
		`${c('mailboxId')} ${uuid} NOT NULL`,
		`${c('subjectNormalized')} ${varchar(300)}${nul}`,
		`${c('participants')} text${nul}`,
		`${c('lastMessageAt')} ${ts}${nul}`,
		`${c('messageCount')} ${int} NOT NULL ${zero}`
	].join(', ');
}

export const INBOX_EMAIL_THREAD_INDEXES: IndexSpec[] = [
	...baseIndexes(PREFIX),
	{ name: `IDX_${PREFIX}_mailbox_subject`, columns: ['mailboxId', 'subjectNormalized'] },
	{ name: `IDX_${PREFIX}_mailbox_last`, columns: ['mailboxId', 'lastMessageAt'] }
];

export const INBOX_EMAIL_THREAD_FOREIGN_KEYS: EmailTableForeignKey[] = [
	{ name: `FK_${PREFIX}_mailbox`, column: 'mailboxId', references: 'inbox_mailbox', onDelete: 'CASCADE' }
];

/**
 * `inbox_email_thread` (plan 04 §2, §5.3, G-P4-2): the conversations of a mailbox.
 *
 * Registered only where `GAUZY_INBOX_ENABLED=true` and `GAUZY_INBOX_EMAIL_ENABLED=true` load the Inbox email plugin.
 * Idempotent on every dialect (a re-run issues no DDL and repairs what a failed run left out), serialised on
 * Postgres, reversible (`down` drops the table).
 */
export class CreateInboxEmailThreadTable1791000002700 implements MigrationInterface {
	name = 'CreateInboxEmailThreadTable1791000002700';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await createEmailTable(queryRunner, {
			table: TABLE,
			prefix: PREFIX,
			columns: inboxEmailThreadColumns,
			indexes: INBOX_EMAIL_THREAD_INDEXES,
			foreignKeys: INBOX_EMAIL_THREAD_FOREIGN_KEYS
		});
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await lockMigrations(queryRunner);
		await dropTableIfExists(queryRunner, TABLE);
	}
}
