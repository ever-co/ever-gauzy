import { ID, InboxMailboxMemberRoleEnum } from '@gauzy/contracts';
import { MultiORMColumn, MultiORMEntity, TenantOrganizationBaseEntity } from '@gauzy/core';
import { MikroOrmInboxMailboxMemberRepository } from './inbox-email.repositories';

/**
 * `inbox_mailbox_member` (plan 04 §2): a user of a shared (organization or team) mailbox. Each member receives the
 * mailbox's mail as their own inbox item recipient row. Unique on `(mailboxId, userId)`.
 */
@MultiORMEntity('inbox_mailbox_member', { mikroOrmRepository: () => MikroOrmInboxMailboxMemberRepository })
export class InboxMailboxMember extends TenantOrganizationBaseEntity {
	@MultiORMColumn()
	mailboxId!: ID;

	@MultiORMColumn()
	userId!: ID;

	@MultiORMColumn({ type: 'varchar', length: 16, default: InboxMailboxMemberRoleEnum.READER })
	role!: InboxMailboxMemberRoleEnum;
}
