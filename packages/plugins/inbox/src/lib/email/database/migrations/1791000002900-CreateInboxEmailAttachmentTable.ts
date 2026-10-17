import { MigrationInterface, QueryRunner } from 'typeorm';
import {
	baseIndexes,
	dropTableIfExists,
	InboxDialect,
	IndexSpec,
	lockMigrations
} from '../../../database/migration-helpers';
import { columnTypes, createEmailTable, EmailTableForeignKey } from '../email-table';

const TABLE = 'inbox_email_attachment';
const PREFIX = 'inbox_email_attachment';

/** The table's own columns, after the base columns, per dialect. */
export function inboxEmailAttachmentColumns(d: InboxDialect): string {
	const { varchar, uuid, bool, int, falsy, zero, nul, c } = columnTypes(d);
	return [
		`${c('emailId')} ${uuid} NOT NULL`,
		`${c('filename')} ${varchar(255)} NOT NULL`,
		`${c('contentType')} ${varchar(255)}${nul}`,
		`${c('size')} ${int} NOT NULL ${zero}`,
		`${c('sha256')} ${varchar(64)}${nul}`,
		`${c('storageKey')} ${varchar(512)} NOT NULL`,
		`${c('storageProvider')} ${varchar(32)}${nul}`,
		`${c('contentId')} ${varchar(255)}${nul}`,
		`${c('isInline')} ${bool} NOT NULL ${falsy}`,
		`${c('savedDocumentId')} ${uuid}${nul}`
	].join(', ');
}

export const INBOX_EMAIL_ATTACHMENT_INDEXES: IndexSpec[] = [
	...baseIndexes(PREFIX),
	{ name: `IDX_${PREFIX}_email`, columns: ['emailId'] }
];

export const INBOX_EMAIL_ATTACHMENT_FOREIGN_KEYS: EmailTableForeignKey[] = [
	{ name: `FK_${PREFIX}_email`, column: 'emailId', references: 'inbox_email', onDelete: 'CASCADE' }
];

/**
 * `inbox_email_attachment` (plan 04 §2, G-P4-2): the attachments and inline parts of stored messages.
 *
 * Registered only where `GAUZY_INBOX_ENABLED=true` and `GAUZY_INBOX_EMAIL_ENABLED=true` load the Inbox email plugin.
 * Idempotent on every dialect (a re-run issues no DDL and repairs what a failed run left out), serialised on
 * Postgres, reversible (`down` drops the table).
 */
export class CreateInboxEmailAttachmentTable1791000002900 implements MigrationInterface {
	name = 'CreateInboxEmailAttachmentTable1791000002900';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await createEmailTable(queryRunner, {
			table: TABLE,
			prefix: PREFIX,
			columns: inboxEmailAttachmentColumns,
			indexes: INBOX_EMAIL_ATTACHMENT_INDEXES,
			foreignKeys: INBOX_EMAIL_ATTACHMENT_FOREIGN_KEYS
		});
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await lockMigrations(queryRunner);
		await dropTableIfExists(queryRunner, TABLE);
	}
}
