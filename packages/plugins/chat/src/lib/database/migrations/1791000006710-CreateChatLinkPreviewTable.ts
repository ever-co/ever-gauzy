import { MigrationInterface, QueryRunner } from 'typeorm';
import { ChatDialect, columnTypes, createTableIfMissing, dropTableIfExists, lockMigrations, TableSpec } from '../migration-helpers';

/** `chat_link_preview`: the cache of link previews (the chat spec FR-20, plan §3), one row per tenant and link. */
export const CHAT_LINK_PREVIEW_TABLE: TableSpec = {
	table: 'chat_link_preview',
	prefix: 'chat_link_preview',
	columns: (d: ChatDialect) => {
		const t = columnTypes(d);
		return [t.varchar('urlHash', 64, true), t.requiredText('url'), t.varchar('status', 16, true, 'pending'), t.text('data'), t.ts('fetchedAt')].join(
			', '
		);
	},
	indexes: [{ name: 'UQ_chat_link_preview_tenant_url_hash', columns: ['tenantId', 'urlHash'], unique: true }],
	foreignKeys: []
};

/**
 * The link preview cache. Additive: a new table and nothing else, so every existing row stays as it is. Registered
 * only with the plugin (`GAUZY_CHAT_ENABLED=true`), whether previews are on or not (the table is empty while they are
 * off); idempotent, serialised on Postgres, written for PostgreSQL, MySQL and SQLite; reversible (the table is dropped,
 * and a dropped cache is only fetched again).
 */
export class CreateChatLinkPreviewTable1791000006710 implements MigrationInterface {
	name = 'CreateChatLinkPreviewTable1791000006710';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await lockMigrations(queryRunner);
		await createTableIfMissing(queryRunner, CHAT_LINK_PREVIEW_TABLE);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await lockMigrations(queryRunner);
		await dropTableIfExists(queryRunner, CHAT_LINK_PREVIEW_TABLE.table);
	}
}
