// cspell:ignore sendgrid
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
 * `null` clears it; a non-secret field sent replaces its value.
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
