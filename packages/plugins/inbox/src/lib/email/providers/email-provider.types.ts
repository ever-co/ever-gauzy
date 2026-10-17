// cspell:ignore softfail temperror permerror dmarc sendgrid
import {
	ID,
	IEmailProviderCapabilities,
	IEmailProviderConfigSchema,
	IInboxProviderAccountCheck,
	InboxProviderAccountScopeEnum
} from '@gauzy/contracts';

/**
 * The provider plugin contract (plan 04 §5.2). Every email provider — Resend, Postmark, Mailgun, SendGrid, Amazon
 * SES, the built-in generic signed webhook — is a plugin that registers one of these with the
 * `EmailProviderRegistry` (token `INBOX_EMAIL_PROVIDER_REGISTRY`) at bootstrap. A provider plugin needs no UI: the
 * Settings → Inbox → Providers form is rendered from its `configSchema`.
 */

/** A provider account's configuration, decrypted: its public fields and its secrets, by field. */
export type ProviderConfig = Record<string, unknown>;

/** The account an inbound request or a send is for, with its decrypted configuration. */
export interface IProviderAccountContext {
	/** `null` for the platform account (`/inbound/generic/platform`, configured from the environment). */
	id: ID | null;
	providerId: string;
	tenantId: ID | null;
	organizationId: ID | null;
	scope: InboxProviderAccountScopeEnum | null;
	config: ProviderConfig;
}

/** The transport-neutral view of a provider's webhook request (never the framework's request object). */
export interface IInboundWebhookRequest {
	/** Lower-cased header names. */
	headers: Record<string, string | string[] | undefined>;
	/** The parsed body (JSON or form). */
	body: unknown;
	/** The exact received bytes, which signatures are computed over (captured globally by the API). */
	rawBody?: Buffer;
	/** The query string, parsed. */
	query: Record<string, unknown>;
	/** The request's own URL path and query, as received (some providers sign it). */
	url: string;
}

/** An address of a message. */
export interface IInboundEmailAddress {
	address: string;
	name?: string;
}

/** One attachment of an inbound message. */
export interface IParsedInboundAttachment {
	filename: string;
	/** The sender's claim; the bytes are sniffed regardless. */
	contentType?: string;
	size: number;
	content: Buffer;
	/** `Content-ID` of an inline part (referenced from the HTML as `cid:`). */
	contentId?: string;
	isInline?: boolean;
}

/** An authentication verdict the provider reports. */
export type InboundAuthVerdict = 'pass' | 'fail' | 'softfail' | 'neutral' | 'none' | 'temperror' | 'permerror';

/**
 * The normalized message every provider's `parse` produces (the docs plugin's `ParsedInboundEmail`, extended per
 * plan 04 §5.2).
 */
export interface ParsedInboundEmail {
	/** The RFC 5322 `Message-ID` (with angle brackets), the idempotency key per mailbox. */
	messageId?: string;
	/** The provider's own id of the message. */
	providerMessageId?: string;
	from?: IInboundEmailAddress;
	to: IInboundEmailAddress[];
	cc: IInboundEmailAddress[];
	replyTo: IInboundEmailAddress[];
	/**
	 * The envelope recipients (`RCPT TO`) when the provider reports them. When present they alone decide the
	 * mailboxes a message is for; otherwise `To` and `Cc` do.
	 */
	envelopeRecipients: string[];
	envelopeFrom?: string;
	subject?: string;
	text?: string;
	html?: string;
	inReplyTo?: string;
	references: string[];
	/** Header name (lower-case) → value. Only an allowlist is kept on the stored message. */
	headers: Record<string, string>;
	/** The message's own `Date`. */
	sentAt?: Date;
	receivedAt: Date;
	sizeBytes: number;
	spf?: InboundAuthVerdict;
	dkim?: InboundAuthVerdict;
	dmarc?: InboundAuthVerdict;
	/** The provider's spam score, when it reports one (higher is more likely spam). */
	spamScore?: number;
	/**
	 * Why the provider wants the message held in the quarantine whatever its spam verdict (a failed virus scan:
	 * `virus`); a manager decides on its release.
	 */
	hold?: string;
	attachments: IParsedInboundAttachment[];
	/** The raw MIME, when the provider delivers it (stored as the message's `.eml`). */
	raw?: Buffer;
}

/**
 * What a verified delivery is known by, for single use: the pipeline marks it used before it stores the delivery, and
 * releases the mark when storing fails, so a provider's retry of the same signed request is not refused.
 */
export interface IInboundDeliveryIdentity {
	/** The delivery's identity: the signature that verified and its timestamp (or the provider's event id). */
	fingerprint: string;
	/** How long the mark must last (at least the signature's freshness window). */
	ttlMs: number;
}

/** The inbound half of a provider (plan 04 §5.2). */
export interface IInboundEmailProvider {
	/**
	 * Proves the request comes from the provider, for this account. Throws when it does not (the route answers 401).
	 * There is no "accept unsigned" mode: a provider that cannot verify a request must refuse it. Answers the delivery's
	 * identity, which the pipeline makes single use (a replay answers 401).
	 */
	verify(request: IInboundWebhookRequest, account: IProviderAccountContext): Promise<IInboundDeliveryIdentity | void>;
	/** The messages the request carries (fetching them from the provider's API when the webhook is metadata only). */
	parse(request: IInboundWebhookRequest, account: IProviderAccountContext): Promise<ParsedInboundEmail[]>;
	/**
	 * The webhook URL to paste into the provider, when it is not the plain account URL (Postmark's carries the
	 * account's Basic-auth credential). `account.config` is decrypted, secrets included.
	 */
	webhookUrl?(baseUrl: string, account: IProviderAccountContext): string;
}

/** An email provider plugin. */
export interface IEmailProviderPlugin {
	/** Lower-case, unique: `resend`, `postmark`, `mailgun`, `sendgrid`, `ses`, `generic`, ... */
	readonly id: string;
	readonly displayName: string;
	readonly description?: string;
	readonly capabilities: IEmailProviderCapabilities;
	readonly configSchema: IEmailProviderConfigSchema;
	readonly inbound?: IInboundEmailProvider;
	/**
	 * A nodemailer transport (a custom transport object, or transport options) that sends through the provider's API,
	 * for the transport seam of `@gauzy/core` (plan 04 §5.5).
	 */
	createTransport?(account: IProviderAccountContext): unknown;
	/** "Test connection": checks the account's credentials with the provider. Never throws a secret. */
	verifyAccount?(account: IProviderAccountContext): Promise<Omit<IInboxProviderAccountCheck, 'checkedAt'>>;
}

/** The registry provider plugins register with (token `INBOX_EMAIL_PROVIDER_REGISTRY`). */
export interface IEmailProviderRegistry {
	register(provider: IEmailProviderPlugin): void;
	unregister(id: string): void;
	get(id: string): IEmailProviderPlugin | undefined;
	list(): IEmailProviderPlugin[];
}
