import { InboxProviderAccountScopeEnum, InboxProviderAccountStatusEnum } from '@gauzy/contracts';
import { ExportRedacted, MultiORMColumn, MultiORMEntity, TenantOrganizationBaseEntity } from '@gauzy/core';
import { MikroOrmInboxProviderAccountRepository } from './inbox-email.repositories';

/**
 * `inbox_provider_account` (plan 04 §2): a tenant's or an organization's account with an email provider (Resend,
 * Postmark, Mailgun, SendGrid, Amazon SES, a generic signed webhook). A mailbox receives through one account (or the
 * platform default); outbound mail of a scope can go through its `isDefaultOutbound` account.
 *
 * The configuration is stored in two halves: `config` (the non-secret fields, plain JSON text) and `configEncrypted`
 * (the secret fields: API keys, signing keys, the Basic-auth credential, ...; AES-256-GCM via `InboxSecretBox`, bound
 * to this row). Secrets are never returned by the API and are blanked in a tenant export.
 *
 * Only `varchar` and `text` columns carry an explicit type; dates and booleans take theirs from the design type
 * (an explicit `timestamp` breaks better-sqlite3, the demo database).
 */
@MultiORMEntity('inbox_provider_account', { mikroOrmRepository: () => MikroOrmInboxProviderAccountRepository })
export class InboxProviderAccount extends TenantOrganizationBaseEntity {
	/** The provider plugin's id (`resend`, `postmark`, ...). */
	@MultiORMColumn({ type: 'varchar', length: 32 })
	providerId!: string;

	@MultiORMColumn({ type: 'varchar', length: 120 })
	name!: string;

	@MultiORMColumn({ type: 'varchar', length: 16, default: InboxProviderAccountScopeEnum.ORGANIZATION })
	scope!: InboxProviderAccountScopeEnum;

	@MultiORMColumn({ type: 'varchar', length: 16, default: InboxProviderAccountStatusEnum.ACTIVE })
	status!: InboxProviderAccountStatusEnum;

	/** The account the scope's outbound mail goes through (one per tenant, one per organization). */
	@MultiORMColumn({ default: false })
	isDefaultOutbound!: boolean;

	/** The non-secret configuration fields, JSON. */
	@MultiORMColumn({ type: 'text', nullable: true })
	config?: string | null;

	/** The secret configuration fields, JSON sealed by `InboxSecretBox`. */
	@ExportRedacted({ blank: true })
	@MultiORMColumn({ type: 'text', nullable: true })
	configEncrypted?: string | null;

	/** The provider's capabilities when the account was saved, JSON (diagnostics). */
	@MultiORMColumn({ type: 'text', nullable: true })
	capabilities?: string | null;

	@MultiORMColumn({ nullable: true })
	lastVerifiedAt?: Date;

	@MultiORMColumn({ type: 'varchar', length: 500, nullable: true })
	lastError?: string | null;
}
