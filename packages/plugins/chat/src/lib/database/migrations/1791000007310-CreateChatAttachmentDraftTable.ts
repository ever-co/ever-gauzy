import { MigrationInterface, QueryRunner } from 'typeorm';
import { ChatDialect, columnTypes, createTableIfMissing, dropTableIfExists, lockMigrations, TableSpec } from '../migration-helpers';

/**
 * `chat_attachment_draft`: the files uploaded for a message that no message carries yet (one row per document, its
 * uploader's). The sweep reads them oldest first (`IDX_chat_attachment_draft_created`). No foreign key to `document`:
 * the row is written the moment the upload inserts its document, apart from the upload's own transaction (on
 * PostgreSQL a key could not see that row before it commits); a row whose document is gone is dropped by the sweep.
 */
export const CHAT_ATTACHMENT_DRAFT_TABLE: TableSpec = {
	table: 'chat_attachment_draft',
	prefix: 'chat_attachment_draft',
	columns: (d: ChatDialect) => {
		const t = columnTypes(d);
		return [t.uuid('documentId'), t.uuid('userId')].join(', ');
	},
	indexes: [
		{ name: 'UQ_chat_attachment_draft_document', columns: ['documentId'], unique: true },
		{ name: 'IDX_chat_attachment_draft_user', columns: ['tenantId', 'userId'] },
		{ name: 'IDX_chat_attachment_draft_created', columns: ['createdAt'] }
	],
	foreignKeys: []
};

/**
 * The draft uploads of chat (the Chat spec, FR-19: an upload a message never carried does not stay forever).
 * Additive: a new table, empty — only uploads stored from now on are recorded, so no existing file is ever swept.
 * Registered only with the plugin (`GAUZY_CHAT_ENABLED=true`); idempotent, serialised on Postgres, written for
 * PostgreSQL, MySQL and SQLite; reversible (the table is dropped, and the files it named stay as private documents
 * of their uploaders, as every upload did before).
 */
export class CreateChatAttachmentDraftTable1791000007310 implements MigrationInterface {
	name = 'CreateChatAttachmentDraftTable1791000007310';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await lockMigrations(queryRunner);
		await createTableIfMissing(queryRunner, CHAT_ATTACHMENT_DRAFT_TABLE);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await lockMigrations(queryRunner);
		await dropTableIfExists(queryRunner, CHAT_ATTACHMENT_DRAFT_TABLE.table);
	}
}
