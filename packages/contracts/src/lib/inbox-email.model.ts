// cspell:ignore sendgrid dmarc
import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';

/**
 * Email for the Gauzy Inbox (`@gauzy/plugin-inbox`, plan 04 §5, Phase 4): mailboxes, the inbound pipeline and the
 * email provider plugins (Resend, Postmark, Mailgun, SendGrid, Amazon SES, ...). Off unless both
 * `GAUZY_INBOX_ENABLED` and `GAUZY_INBOX_EMAIL_ENABLED` are exactly `true`.
 */

/** Who a provider account belongs to: the whole tenant, or one organization. */
export enum InboxProviderAccountScopeEnum {
	TENANT = 'TENANT',
	ORGANIZATION = 'ORGANIZATION'
}

export enum InboxProviderAccountStatusEnum {
	ACTIVE = 'ACTIVE',
	/** The last connection test failed (`lastError`); inbound and outbound still try it. */
	ERROR = 'ERROR',
	/** Switched off by an admin: no inbound is accepted for it and nothing is sent through it. */
	DISABLED = 'DISABLED'
}

/** What a provider plugin can do. */
export interface IEmailProviderCapabilities {
	/** Receives mail (a webhook, or a fetch the webhook triggers). */
	inbound: boolean;
	/** Sends mail through its API (the transport seam, plan 04 §5.5). */
	outbound: boolean;
	/** Receives for an organization's own domain. */
	customDomains: boolean;
	/** Reads an existing mailbox (IMAP, Gmail, Microsoft 365; P5). */
	connectedMailbox?: boolean;
}

/**
 * One field of a provider account's configuration: the subset of JSON Schema the Settings → Inbox → Providers form
 * renders. A `writeOnly` field is a secret: it is stored encrypted and never returned (the answer says only that it
 * is set). A `generated` field is a secret the server creates when it is left empty (for example the Basic-auth
 * credential Postmark's webhook URL carries); it is shown once, in the answer that created it.
 */
export interface IEmailProviderConfigProperty {
	type: 'string' | 'boolean' | 'number' | 'integer';
	title?: string;
	description?: string;
	enum?: Array<string | number>;
	default?: string | number | boolean;
	/** Rendering and validation hints (`textarea` is a multi-line string, for example a public key). */
	format?: 'uri' | 'email' | 'hostname' | 'textarea';
	writeOnly?: boolean;
	generated?: boolean;
	minLength?: number;
	maxLength?: number;
	pattern?: string;
	minimum?: number;
	maximum?: number;
}

/** A provider account's configuration form (an object of fields). */
export interface IEmailProviderConfigSchema {
	type: 'object';
	properties: Record<string, IEmailProviderConfigProperty>;
	required?: string[];
}

/** A registered provider plugin, as `GET /api/inbox/providers` answers it. */
export interface IEmailProviderDescriptor {
	/** `resend`, `postmark`, `mailgun`, `sendgrid`, `ses`, `generic`, ... */
	id: string;
	displayName: string;
	description?: string;
	capabilities: IEmailProviderCapabilities;
	configSchema: IEmailProviderConfigSchema;
}

/** A provider account (`inbox_provider_account`), as the API answers it: never a secret. */
export interface IInboxProviderAccount extends IBasePerTenantAndOrganizationEntityModel {
	providerId: string;
	name: string;
	scope: InboxProviderAccountScopeEnum;
	status: InboxProviderAccountStatusEnum;
	/** The account the scope's outbound mail goes through (plan 04 §5.5, steps 2 and 3). */
	isDefaultOutbound: boolean;
	/** The configuration's non-secret fields. */
	config: Record<string, unknown>;
	/** The secret fields that have a value. */
	secretsSet: string[];
	capabilities?: IEmailProviderCapabilities | null;
	lastVerifiedAt?: Date | null;
	lastError?: string | null;
	/** The URL to paste into the provider (null for a provider without inbound). */
	webhookUrl?: string | null;
}

/** `POST /api/inbox/provider-accounts`. */
export interface IInboxProviderAccountCreateInput {
	providerId: string;
	name: string;
	/** Defaults to `ORGANIZATION` (the organization of the request). */
	scope?: InboxProviderAccountScopeEnum;
	organizationId?: ID;
	config?: Record<string, unknown>;
	isDefaultOutbound?: boolean;
}

/**
 * `PATCH /api/inbox/provider-accounts/:id`. In `config`, a secret field left out or sent empty keeps its value, and
 * `null` clears it (a `generated` secret is then generated anew and answered once, in `oneTimeSecrets`: a rotation);
 * a non-secret field sent replaces its value.
 */
export interface IInboxProviderAccountUpdateInput {
	name?: string;
	config?: Record<string, unknown>;
	status?: InboxProviderAccountStatusEnum.ACTIVE | InboxProviderAccountStatusEnum.DISABLED;
	isDefaultOutbound?: boolean;
}

/** What creating an account answers: the account, and the secrets the server generated, shown this once. */
export interface IInboxProviderAccountCreated extends IInboxProviderAccount {
	/** Generated secrets by field (empty when none), and the webhook URL that carries them, if it does. */
	oneTimeSecrets: Record<string, string>;
	oneTimeWebhookUrl?: string | null;
}

/** `POST /api/inbox/provider-accounts/:id/verify` ("Test connection"). */
export interface IInboxProviderAccountCheck {
	ok: boolean;
	/** Human-readable, never a secret. */
	message?: string;
	checkedAt: Date | string;
	details?: Record<string, unknown>;
}

/**
 * The injection token of `@gauzy/plugin-inbox`'s email provider registry, present when the Inbox email features
 * are on. A provider plugin injects it with `@Optional() @Inject(…)` and registers itself at bootstrap; when the
 * Inbox email features are off the token is absent and the plugin stays idle.
 */
export const INBOX_EMAIL_PROVIDER_REGISTRY = 'INBOX_EMAIL_PROVIDER_REGISTRY';

// ---------------------------------------------------------------- mailboxes (plan 04 §2, §5.1)

/** How a mailbox receives. */
export enum InboxMailboxKindEnum {
	/** An address on the platform domain (`GAUZY_INBOX_DOMAIN`), received by the platform route. */
	PLATFORM = 'PLATFORM',
	/** An address on an organization's own, verified domain, received through a provider account. */
	CUSTOM_DOMAIN = 'CUSTOM_DOMAIN',
	/** A platform address the user forwards an existing mailbox to (no DNS change). */
	FORWARDING = 'FORWARDING',
	/** An existing mailbox Gauzy reads (IMAP, Gmail, Microsoft 365; P5). */
	CONNECTED = 'CONNECTED'
}

/** Whose mailbox it is. */
export enum InboxMailboxOwnerTypeEnum {
	EMPLOYEE = 'EMPLOYEE',
	ORGANIZATION = 'ORGANIZATION',
	TEAM = 'TEAM'
}

export enum InboxMailboxPurposeEnum {
	INBOX = 'INBOX',
	/** Reserved: docs capture moving onto mailboxes later (plan 04 §5.1). */
	DOCS_CAPTURE = 'DOCS_CAPTURE'
}

export enum InboxMailboxDomainStatusEnum {
	PENDING = 'PENDING',
	VERIFIED = 'VERIFIED',
	FAILED = 'FAILED'
}

/** A user's role in a shared (organization or team) mailbox. */
export enum InboxMailboxMemberRoleEnum {
	READER = 'READER',
	MANAGER = 'MANAGER'
}

/** A mailbox (`inbox_mailbox`), as the API answers it: never its inbound secret or verification token. */
export interface IInboxMailbox extends IBasePerTenantAndOrganizationEntityModel {
	address: string;
	displayName?: string | null;
	kind: InboxMailboxKindEnum;
	ownerType: InboxMailboxOwnerTypeEnum;
	ownerEmployeeId?: ID | null;
	ownerTeamId?: ID | null;
	purpose: InboxMailboxPurposeEnum;
	/** `null`: the platform default (the platform route on `GAUZY_INBOX_DOMAIN`). */
	providerAccountId?: ID | null;
	senderAllowlist?: string[];
	domain?: string | null;
	domainStatus?: InboxMailboxDomainStatusEnum | null;
	isDefault?: boolean;
	autoProvisioned?: boolean;
	lastMessageAt?: Date | null;
	messageCount?: number;
	settings?: Record<string, unknown> | null;
}

// ---------------------------------------------------------------- email (plan 04 §2, §5.3, §5.5)

export enum InboxEmailDirectionEnum {
	IN = 'IN',
	OUT = 'OUT'
}

export enum InboxEmailStatusEnum {
	/** Stored by the webhook; the worker has not processed it yet. */
	RECEIVED = 'RECEIVED',
	/** Claimed by a worker. */
	PROCESSING = 'PROCESSING',
	/** Processed: sanitized, threaded, an inbox item created. */
	PROCESSED = 'PROCESSED',
	/** Held as spam: no inbox item until a mailbox manager releases it. */
	QUARANTINED = 'QUARANTINED',
	FAILED = 'FAILED',
	/** Outbound, being sent. */
	QUEUED = 'QUEUED',
	SENT = 'SENT'
}

export enum InboxEmailSpamVerdictEnum {
	HAM = 'ham',
	SUSPECT = 'suspect',
	SPAM = 'spam'
}

/** An address of a stored message. */
export interface IInboxEmailAddress {
	address: string;
	name?: string;
}

/** An attachment of a stored message (metadata; the bytes are downloaded through the API). */
export interface IInboxEmailAttachment {
	id: ID;
	emailId: ID;
	filename: string;
	contentType?: string | null;
	size: number;
	sha256?: string | null;
	contentId?: string | null;
	isInline: boolean;
	savedDocumentId?: ID | null;
}

/** A stored message (`inbox_email`), as the API answers it. `htmlSanitized` is sanitized on the server. */
export interface IInboxEmail extends IBasePerTenantAndOrganizationEntityModel {
	mailboxId: ID;
	threadId?: ID | null;
	direction: InboxEmailDirectionEnum;
	messageId: string;
	inReplyTo?: string | null;
	references: string[];
	from?: IInboxEmailAddress | null;
	to: IInboxEmailAddress[];
	cc: IInboxEmailAddress[];
	bcc: IInboxEmailAddress[];
	replyTo: IInboxEmailAddress[];
	subject?: string | null;
	textBody?: string | null;
	htmlSanitized?: string | null;
	snippet?: string | null;
	headers?: Record<string, string> | null;
	spf?: string | null;
	dkim?: string | null;
	dmarc?: string | null;
	spamScore?: number | null;
	spamVerdict?: InboxEmailSpamVerdictEnum | null;
	receivedAt?: Date | null;
	sentAt?: Date | null;
	sizeBytes?: number | null;
	status: InboxEmailStatusEnum;
	providerMessageId?: string | null;
	error?: string | null;
	inboxItemId?: ID | null;
	attachments?: IInboxEmailAttachment[];
}

/** `POST /api/inbox/emails/:id/reply`. Sent from the mailbox's address, in the message's thread. */
export interface IInboxEmailReplyInput {
	text: string;
	/** Also to the original `To` / `Cc` (minus the mailbox itself). */
	replyAll?: boolean;
	cc?: string[];
}

/** `POST /api/inbox/emails/:id/forward`. */
export interface IInboxEmailForwardInput {
	to: string[];
	text?: string;
	/** Defaults to `true`. */
	includeAttachments?: boolean;
}

/** What the provider webhook answers (202). */
export interface IInboxInboundResult {
	/** Messages stored for a mailbox (one per mailbox a message is for). */
	accepted: number;
	/** Messages that were already stored for that mailbox (a provider's retry). */
	duplicates: number;
	/** Recipients that are no active mailbox of this account, and messages over the size cap. */
	dropped: number;
}

// ---------------------------------------------------------------- mailbox management (plan 04 §3, §5.1, G-P4-1)

/** `POST /api/inbox/mailboxes`. */
export interface IInboxMailboxCreateInput {
	ownerType: InboxMailboxOwnerTypeEnum;
	/** EMPLOYEE mailboxes. */
	ownerEmployeeId?: ID;
	/** TEAM mailboxes. */
	ownerTeamId?: ID;
	/** Defaults to PLATFORM (an address on `GAUZY_INBOX_DOMAIN`). */
	kind?: InboxMailboxKindEnum.PLATFORM | InboxMailboxKindEnum.CUSTOM_DOMAIN | InboxMailboxKindEnum.FORWARDING;
	/**
	 * The address's local part: chosen for a custom domain; for a platform address the name part (`support` of
	 * `support.<orgSlug>@…`), allocated from the owner when left out.
	 */
	localPart?: string;
	/** CUSTOM_DOMAIN: the organization's domain (verified by a DNS TXT record before it receives). */
	domain?: string;
	displayName?: string;
	/** Required for a custom domain; `null` / left out = the platform route. */
	providerAccountId?: ID | null;
	senderAllowlist?: string[];
	organizationId?: ID;
	isDefault?: boolean;
	/** FORWARDING: the existing address that forwards to this one (shown in the instructions). */
	forwardFrom?: string;
}

/** `PATCH /api/inbox/mailboxes/:id`. */
export interface IInboxMailboxUpdateInput {
	displayName?: string | null;
	isActive?: boolean;
	senderAllowlist?: string[];
	providerAccountId?: ID | null;
	isDefault?: boolean;
	/** Free settings (P4c: `everWorksAgentId`). */
	settings?: Record<string, unknown> | null;
}

/** The DNS record that proves a custom domain (`POST /api/inbox/mailboxes/:id/verify`). */
export interface IInboxMailboxDomainVerification {
	recordType: 'TXT';
	recordName: string;
	recordValue: string;
	status: InboxMailboxDomainStatusEnum;
	message?: string;
}

/** A mailbox's relay secret, answered once (`POST /api/inbox/mailboxes/:id/rotate-secret`). */
export interface IInboxMailboxSecret {
	address: string;
	inboundSecret: string;
}

/** `PUT /api/inbox/mailboxes/:id/members`. */
export interface IInboxMailboxMemberInput {
	userId: ID;
	role?: InboxMailboxMemberRoleEnum;
}

export interface IInboxMailboxMember {
	userId: ID;
	role: InboxMailboxMemberRoleEnum;
}

/** `POST /api/inbox/mailboxes/provision`: create what is missing now. */
export interface IInboxMailboxProvisionInput {
	organizationId?: ID;
	/** A mailbox for every active (human) employee of the organization that has none. */
	employees?: boolean;
	/** The organization's default mailbox (`inbox.<orgSlug>@…`) when it has none. */
	defaultOrganizationMailbox?: boolean;
}

export interface IInboxMailboxProvisionResult {
	created: IInboxMailbox[];
	/** Owners that already had a mailbox. */
	existing: number;
}

/** An organization's email settings (`GET / PUT /api/inbox/mailboxes/settings`). */
export interface IInboxOrganizationEmailSettings {
	organizationId: ID;
	/** Create a mailbox for every new employee (agents never get one). */
	autoProvisionEmployees: boolean;
}

/**
 * One address namespace for every inbound address of the platform (plan 04 §5.1): the Inbox provides this token,
 * and the Docs plugin asks it before it takes a custom capture address (the Inbox asks the Docs table in turn).
 */
export const INBOUND_ADDRESS_NAMESPACE = 'INBOUND_ADDRESS_NAMESPACE';

export interface IInboundAddressNamespace {
	/** Whether an inbound address (lower-case, no `+tag`) is already taken. */
	isTaken(address: string): Promise<boolean>;
}
