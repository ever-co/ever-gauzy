import { ID } from '@gauzy/contracts';
import { MultiORMColumn, MultiORMEntity, TenantOrganizationBaseEntity } from '@gauzy/core';
import { MikroOrmInboxEmailThreadRepository } from './inbox-email.repositories';

/**
 * `inbox_email_thread` (plan 04 §2, §5.3): the messages of one conversation in one mailbox. A message joins the thread
 * of the message its `In-Reply-To` / `References` name, else the thread with the same normalized subject and a shared
 * participant within 30 days.
 */
@MultiORMEntity('inbox_email_thread', { mikroOrmRepository: () => MikroOrmInboxEmailThreadRepository })
export class InboxEmailThread extends TenantOrganizationBaseEntity {
	@MultiORMColumn()
	mailboxId!: ID;

	@MultiORMColumn({ type: 'varchar', length: 300, nullable: true })
	subjectNormalized?: string | null;

	/** JSON array of lower-case addresses. */
	@MultiORMColumn({ type: 'text', nullable: true })
	participants?: string | null;

	@MultiORMColumn({ nullable: true })
	lastMessageAt?: Date;

	@MultiORMColumn({ default: 0 })
	messageCount!: number;
}
