import { MigrationInterface, QueryRunner } from 'typeorm';
import { createIndexIfMissing, lockMigrations } from '../migration-helpers';

/**
 * `inbox_item_recipient (tenantId, userId, createdAt)`: the index the mention twin lookup walks — a receiver's
 * recipient rows of the last ten minutes, read under the mention lock — so the lookup stays a range scan as the
 * recipient history grows. Additive and idempotent: an index that exists is left alone.
 */
export class AddInboxRecipientUserCreatedAtIndex1791000005250 implements MigrationInterface {
	name = 'AddInboxRecipientUserCreatedAtIndex1791000005250';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await lockMigrations(queryRunner);
		await createIndexIfMissing(queryRunner, 'inbox_item_recipient', {
			name: 'IDX_inbox_item_recipient_tenant_user_created',
			columns: ['tenantId', 'userId', 'createdAt']
		});
	}

	/** Deliberate no-op: the index is inert without the plugin; a rollback keeps it. */
	public async down(): Promise<void> {
		return;
	}
}
