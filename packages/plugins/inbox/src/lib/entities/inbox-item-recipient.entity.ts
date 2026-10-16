import { ID } from '@gauzy/contracts';
import { MultiORMColumn, MultiORMEntity, TenantOrganizationBaseEntity } from '@gauzy/core';
import { MikroOrmInboxItemRecipientRepository } from './inbox.repositories';

/**
 * `inbox_item_recipient` (plan 04 §2): one user an item is addressed to, with that user's own state.
 * Unique on `(inboxItemId, userId)`. The base `isArchived` / `archivedAt` columns are this recipient's
 * archive state; a shared mailbox item (P4) has one row per member, each with its own state.
 *
 * The date columns are typed `?: Date`, not `Date | null`: their column type comes from the design type, and
 * under this package's `strictNullChecks` a `| null` union is emitted as `Object`, which TypeORM refuses at
 * boot (see `InboxItem`).
 */
@MultiORMEntity('inbox_item_recipient', { mikroOrmRepository: () => MikroOrmInboxItemRecipientRepository })
export class InboxItemRecipient extends TenantOrganizationBaseEntity {
	@MultiORMColumn()
	inboxItemId!: ID;

	@MultiORMColumn()
	userId!: ID;

	@MultiORMColumn({ default: false })
	isRead!: boolean;

	@MultiORMColumn({ nullable: true })
	readAt?: Date;

	/** Hidden from the open tabs until then. */
	@MultiORMColumn({ nullable: true })
	snoozedUntil?: Date;

	@MultiORMColumn({ nullable: true })
	deliveredAt?: Date;
}
