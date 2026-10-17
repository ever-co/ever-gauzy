import {
	ID,
	InboxMailboxDomainStatusEnum,
	InboxMailboxKindEnum,
	InboxMailboxOwnerTypeEnum,
	InboxMailboxPurposeEnum
} from '@gauzy/contracts';
import { ExportRedacted, MultiORMColumn, MultiORMEntity, TenantOrganizationBaseEntity } from '@gauzy/core';
import { MikroOrmInboxMailboxRepository } from './inbox-email.repositories';

/**
 * `inbox_mailbox` (plan 04 §2, §5.1): an address mail is received for — an employee's, an organization's (several
 * per organization) or a team's. The address is lower-case and unique across the whole deployment: mail is routed by
 * its recipient address alone, so two rows with one address would make the receiving tenant depend on row order.
 *
 * `providerAccountId` names the provider account the mailbox receives through; `null` is the platform default (the
 * platform route on `GAUZY_INBOX_DOMAIN`). Mail for the mailbox is accepted only from that account.
 *
 * Only `varchar` and `text` columns carry an explicit type (an explicit `timestamp` breaks better-sqlite3).
 */
@MultiORMEntity('inbox_mailbox', { mikroOrmRepository: () => MikroOrmInboxMailboxRepository })
export class InboxMailbox extends TenantOrganizationBaseEntity {
	@MultiORMColumn({ type: 'varchar', length: 320 })
	address!: string;

	@MultiORMColumn({ type: 'varchar', length: 200, nullable: true })
	displayName?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 16, default: InboxMailboxKindEnum.PLATFORM })
	kind!: InboxMailboxKindEnum;

	@MultiORMColumn({ type: 'varchar', length: 16 })
	ownerType!: InboxMailboxOwnerTypeEnum;

	@MultiORMColumn({ nullable: true })
	ownerEmployeeId?: ID;

	@MultiORMColumn({ nullable: true })
	ownerTeamId?: ID;

	@MultiORMColumn({ type: 'varchar', length: 16, default: InboxMailboxPurposeEnum.INBOX })
	purpose!: InboxMailboxPurposeEnum;

	@MultiORMColumn({ nullable: true })
	providerAccountId?: ID;

	/** scrypt digest of a per-mailbox relay secret (generic and forwarding mailboxes). */
	@ExportRedacted({ blank: true })
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	inboundSecretHash?: string | null;

	/** JSON array of addresses and `@domain`s; empty = any sender. */
	@MultiORMColumn({ type: 'text', nullable: true })
	senderAllowlist?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 253, nullable: true })
	domain?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 16, nullable: true })
	domainStatus?: InboxMailboxDomainStatusEnum | null;

	/** The value published at `_gauzy-inbox.<domain>` to prove the organization controls the domain. */
	@ExportRedacted({ blank: true })
	@MultiORMColumn({ type: 'varchar', length: 128, nullable: true })
	domainVerificationToken?: string | null;

	@MultiORMColumn({ default: false })
	isDefault!: boolean;

	@MultiORMColumn({ default: false })
	autoProvisioned!: boolean;

	@MultiORMColumn({ nullable: true })
	lastMessageAt?: Date;

	@MultiORMColumn({ default: 0 })
	messageCount!: number;

	/** JSON object (P4c: `everWorksAgentId`). */
	@MultiORMColumn({ type: 'text', nullable: true })
	settings?: string | null;
}
