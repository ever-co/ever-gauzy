import { ID, InboxEmailDirectionEnum, InboxEmailSpamVerdictEnum, InboxEmailStatusEnum } from '@gauzy/contracts';
import { MultiORMColumn, MultiORMEntity, TenantOrganizationBaseEntity } from '@gauzy/core';
import { MikroOrmInboxEmailRepository } from './inbox-email.repositories';

/**
 * `inbox_email` (plan 04 §2, §5.3): one message of one mailbox, received (`IN`) or sent from it (`OUT`). Unique on
 * `(mailboxId, messageId)`, so a provider's retry stores nothing twice; a message for several mailboxes is one row per
 * mailbox, each with its own state.
 *
 * The addresses are JSON (`sender` = `From`; the `to` / `references` names are SQL keywords, so the columns are named
 * `toAddresses` / `referenceIds`). `htmlSanitized` is sanitized on the server before it is stored; the unsanitized
 * HTML exists only in the raw message (`rawStorageKey`), which only mailbox managers may download.
 */
@MultiORMEntity('inbox_email', { mikroOrmRepository: () => MikroOrmInboxEmailRepository })
export class InboxEmail extends TenantOrganizationBaseEntity {
	@MultiORMColumn()
	mailboxId!: ID;

	@MultiORMColumn({ nullable: true })
	threadId?: ID;

	@MultiORMColumn({ type: 'varchar', length: 8, default: InboxEmailDirectionEnum.IN })
	direction!: InboxEmailDirectionEnum;

	/** RFC 5322 `Message-ID` with its angle brackets (derived from the content when the message has none). */
	@MultiORMColumn({ type: 'varchar', length: 512 })
	messageId!: string;

	@MultiORMColumn({ type: 'varchar', length: 512, nullable: true })
	inReplyTo?: string | null;

	/** JSON array of message ids. */
	@MultiORMColumn({ type: 'text', nullable: true })
	referenceIds?: string | null;

	/** JSON `{ address, name? }`. */
	@MultiORMColumn({ type: 'text', nullable: true })
	sender?: string | null;

	/** JSON arrays of `{ address, name? }`. */
	@MultiORMColumn({ type: 'text', nullable: true })
	toAddresses?: string | null;

	@MultiORMColumn({ type: 'text', nullable: true })
	ccAddresses?: string | null;

	@MultiORMColumn({ type: 'text', nullable: true })
	bccAddresses?: string | null;

	@MultiORMColumn({ type: 'text', nullable: true })
	replyToAddresses?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 500, nullable: true })
	subject?: string | null;

	@MultiORMColumn({ type: 'text', nullable: true })
	textBody?: string | null;

	@MultiORMColumn({ type: 'text', nullable: true })
	htmlSanitized?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 300, nullable: true })
	snippet?: string | null;

	/** JSON object of the allowlisted headers. */
	@MultiORMColumn({ type: 'text', nullable: true })
	headers?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 16, nullable: true })
	spf?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 16, nullable: true })
	dkim?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 16, nullable: true })
	dmarc?: string | null;

	@MultiORMColumn({ nullable: true })
	spamScore?: number;

	@MultiORMColumn({ type: 'varchar', length: 16, nullable: true })
	spamVerdict?: InboxEmailSpamVerdictEnum | null;

	@MultiORMColumn({ nullable: true })
	receivedAt?: Date;

	@MultiORMColumn({ nullable: true })
	sentAt?: Date;

	@MultiORMColumn({ nullable: true })
	sizeBytes?: number;

	/** The raw message in FileStorage (`.eml`, or `.json` when the provider delivers no MIME). */
	@MultiORMColumn({ type: 'varchar', length: 512, nullable: true })
	rawStorageKey?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 32, nullable: true })
	rawStorageProvider?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 16, default: InboxEmailStatusEnum.RECEIVED })
	status!: InboxEmailStatusEnum;

	/** The provider account the message came in through or went out through (`null`: the platform route / SMTP). */
	@MultiORMColumn({ nullable: true })
	providerAccountId?: ID;

	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	providerMessageId?: string | null;

	/** OUT: which transport sent it (`provider:<id>:<account>` or `smtp`). */
	@MultiORMColumn({ type: 'varchar', length: 120, nullable: true })
	transport?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 1000, nullable: true })
	error?: string | null;

	@MultiORMColumn({ default: 0 })
	attemptCount!: number;

	/** The inbox item the message became (IN). */
	@MultiORMColumn({ nullable: true })
	inboxItemId?: ID;
}
