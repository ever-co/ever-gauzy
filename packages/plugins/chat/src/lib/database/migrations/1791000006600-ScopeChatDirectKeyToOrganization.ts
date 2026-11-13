import { MigrationInterface, QueryRunner } from 'typeorm';
import { createIndexIfMissing, dropIndexIfExists, IndexSpec, lockMigrations } from '../migration-helpers';

/**
 * The key `CreateChatTables1791000006100` gave direct and group conversations: unique per tenant, so two people had
 * one conversation in the whole tenant, and once they had it in one organization they could not talk in another.
 */
export const CHAT_DIRECT_KEY_PER_TENANT: IndexSpec = {
	name: 'UQ_chat_conversation_direct_key',
	columns: ['tenantId', 'directKey'],
	unique: true,
	where: { postgres: '"directKey" IS NOT NULL', sqlite: '"directKey" IS NOT NULL' }
};

/** The key per organization: the same people have one conversation in each organization they share. */
export const CHAT_DIRECT_KEY_PER_ORGANIZATION: IndexSpec = {
	name: 'UQ_chat_conversation_organization_direct_key',
	columns: ['tenantId', 'organizationId', 'directKey'],
	unique: true,
	where: { postgres: '"directKey" IS NOT NULL', sqlite: '"directKey" IS NOT NULL' }
};

/**
 * `chat_conversation.directKey` is unique per organization: the unique index (`tenantId`, `directKey`) is replaced by
 * (`tenantId`, `organizationId`, `directKey`), which `ChatConversationService.direct` looks up.
 *
 * No data step: every row the per-tenant index admits, the per-organization index admits too, so the new index is
 * created first and the old one dropped after it — the key is never unguarded. An index is all that changes, so SQLite
 * needs no table rebuild (it has `CREATE UNIQUE INDEX … WHERE` and `DROP INDEX IF EXISTS`). MySQL has no partial index:
 * the index is created there without the predicate, and a NULL key stays admitted any number of times.
 *
 * Idempotent on every dialect: an index is created only when it is missing and dropped only when it is there.
 * `down` restores the per-tenant index first, which the database refuses while the same people have a conversation in
 * two organizations of a tenant; the migration then changes nothing, and the rows are left for a person to settle.
 */
export class ScopeChatDirectKeyToOrganization1791000006600 implements MigrationInterface {
	name = 'ScopeChatDirectKeyToOrganization1791000006600';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await lockMigrations(queryRunner);
		await createIndexIfMissing(queryRunner, 'chat_conversation', CHAT_DIRECT_KEY_PER_ORGANIZATION);
		await dropIndexIfExists(queryRunner, 'chat_conversation', CHAT_DIRECT_KEY_PER_TENANT.name);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await lockMigrations(queryRunner);
		await createIndexIfMissing(queryRunner, 'chat_conversation', CHAT_DIRECT_KEY_PER_TENANT);
		await dropIndexIfExists(queryRunner, 'chat_conversation', CHAT_DIRECT_KEY_PER_ORGANIZATION.name);
	}
}
