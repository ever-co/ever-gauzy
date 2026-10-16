import { MigrationInterface, QueryRunner } from 'typeorm';
import {
	baseIndexes,
	dropTableIfExists,
	InboxDialect,
	IndexSpec,
	lockMigrations
} from '../../../database/migration-helpers';
import { columnTypes, createEmailTable, EmailTableForeignKey } from '../email-table';

const TABLE = 'inbox_email';
const PREFIX = 'inbox_email';

/** The table's own columns, after the base columns, per dialect. */
export function inboxEmailColumns(d: InboxDialect): string {
	const { varchar, uuid, ts, int, float, longText, zero, nul, def, c } = columnTypes(d);
	return [
		`${c('mailboxId')} ${uuid} NOT NULL`,
		`${c('threadId')} ${uuid}${nul}`,
		`${c('direction')} ${varchar(8)} NOT NULL ${def('IN')}`,
		`${c('messageId')} ${varchar(512)} NOT NULL`,
		`${c('inReplyTo')} ${varchar(512)}${nul}`,
		`${c('referenceIds')} text${nul}`,
		`${c('sender')} text${nul}`,
		`${c('toAddresses')} text${nul}`,
		`${c('ccAddresses')} text${nul}`,
		`${c('bccAddresses')} text${nul}`,
		`${c('replyToAddresses')} text${nul}`,
		`${c('subject')} ${varchar(500)}${nul}`,
		`${c('textBody')} ${longText}${nul}`,
		`${c('htmlSanitized')} ${longText}${nul}`,
		`${c('snippet')} ${varchar(300)}${nul}`,
		`${c('headers')} text${nul}`,
		`${c('spf')} ${varchar(16)}${nul}`,
		`${c('dkim')} ${varchar(16)}${nul}`,
		`${c('dmarc')} ${varchar(16)}${nul}`,
		`${c('spamScore')} ${float}${nul}`,
		`${c('spamVerdict')} ${varchar(16)}${nul}`,
		`${c('receivedAt')} ${ts}${nul}`,
		`${c('sentAt')} ${ts}${nul}`,
		`${c('sizeBytes')} ${int}${nul}`,
		`${c('rawStorageKey')} ${varchar(512)}${nul}`,
		`${c('rawStorageProvider')} ${varchar(32)}${nul}`,
		`${c('status')} ${varchar(16)} NOT NULL ${def('RECEIVED')}`,
		`${c('providerAccountId')} ${uuid}${nul}`,
		`${c('providerMessageId')} ${varchar(255)}${nul}`,
		`${c('transport')} ${varchar(120)}${nul}`,
		`${c('error')} ${varchar(1000)}${nul}`,
		`${c('attemptCount')} ${int} NOT NULL ${zero}`,
		`${c('inboxItemId')} ${uuid}${nul}`
	].join(', ');
}

export const INBOX_EMAIL_INDEXES: IndexSpec[] = [
	...baseIndexes(PREFIX),
	// A provider's retry stores nothing twice.
	{ name: `UQ_${PREFIX}_mailbox_message`, columns: ['mailboxId', 'messageId'], unique: true },
	{ name: `IDX_${PREFIX}_thread`, columns: ['threadId'] },
	{ name: `IDX_${PREFIX}_status`, columns: ['status', 'updatedAt'] },
	{ name: `IDX_${PREFIX}_mailbox_received`, columns: ['mailboxId', 'receivedAt'] },
	{ name: `IDX_${PREFIX}_in_reply_to`, columns: ['mailboxId', 'inReplyTo'] }
];

export const INBOX_EMAIL_FOREIGN_KEYS: EmailTableForeignKey[] = [
	{ name: `FK_${PREFIX}_mailbox`, column: 'mailboxId', references: 'inbox_mailbox', onDelete: 'CASCADE' },
	{ name: `FK_${PREFIX}_thread`, column: 'threadId', references: 'inbox_email_thread', onDelete: 'SET NULL' }
];

/**
 * `inbox_email` (plan 04 §2, §5.3, G-P4-2): the messages of a mailbox, received and sent; unique on
 * `(mailboxId, messageId)`.
 *
 * Registered only where `GAUZY_INBOX_ENABLED=true` and `GAUZY_INBOX_EMAIL_ENABLED=true` load the Inbox email plugin.
 * Idempotent on every dialect (a re-run issues no DDL and repairs what a failed run left out), serialised on
 * Postgres, reversible (`down` drops the table).
 */
export class CreateInboxEmailTable1791000002800 implements MigrationInterface {
	name = 'CreateInboxEmailTable1791000002800';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await createEmailTable(queryRunner, {
			table: TABLE,
			prefix: PREFIX,
			columns: inboxEmailColumns,
			indexes: INBOX_EMAIL_INDEXES,
			foreignKeys: INBOX_EMAIL_FOREIGN_KEYS
		});
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await lockMigrations(queryRunner);
		await dropTableIfExists(queryRunner, TABLE);
	}
}
