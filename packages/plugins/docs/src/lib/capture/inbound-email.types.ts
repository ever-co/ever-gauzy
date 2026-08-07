/**
 * The provider-agnostic inbound-email seam of `07-ai-knowledge.md` §17.2.
 *
 * The plugin never speaks a specific ESP's dialect. It defines this adapter contract and
 * ships ONE reference implementation (`generic-signed-webhook.adapter.ts`); a Mailgun /
 * SendGrid / Postmark / SES adapter is a few lines in an integration plugin and is bound
 * through the `DOCS_INBOUND_EMAIL_ADAPTER` token.
 */

/** DI token the inbound-email controller resolves its adapter through. */
export const DOCS_INBOUND_EMAIL_ADAPTER = 'DOCS_INBOUND_EMAIL_ADAPTER';

/**
 * The transport-neutral view of an inbound webhook request. Deliberately NOT `express.Request`
 * so adapters stay unit-testable and the seam does not leak the HTTP framework.
 */
export interface IInboundWebhookRequest {
	/** Lower-cased header map. */
	headers: Record<string, string | string[] | undefined>;
	/** The parsed JSON/form body. */
	body: any;
	/**
	 * The exact bytes received, when the deployment captures them. Signature schemes are
	 * defined over the raw body; adapters fall back to a canonical re-serialization and MUST
	 * document that fallback (see the reference adapter).
	 */
	rawBody?: string | Buffer;
}

/** One attachment carried by an inbound message. */
export interface IInboundEmailAttachment {
	fileName: string;
	/** The sender's claim — the upload gauntlet sniffs the bytes regardless. */
	contentType?: string;
	sizeBytes: number;
	content: Buffer;
}

/** The normalized inbound message every adapter produces. */
export interface ParsedInboundEmail {
	/** Recipient address the message was delivered to (`docs-<token>@<domain>`). */
	recipient: string;
	/** Envelope sender. */
	sender?: string;
	subject?: string;
	/** Provider message id, used for idempotency. */
	messageId?: string;
	receivedAt?: Date;
	/** Total message size in bytes, as reported by the provider. */
	sizeBytes?: number;
	/** SPF/DKIM verdicts — both must pass (§17.2) when the provider reports them. */
	spfPass?: boolean;
	dkimPass?: boolean;
	/** The importable payload. Attachments-only intake: the body is discarded by default. */
	attachments: IInboundEmailAttachment[];
	/** Plain-text body, kept ONLY when the org enables `importBodyAsNote`. */
	bodyText?: string;
}

/**
 * A provider adapter: verify first, parse second. `verifySignature` must be cheap, must not
 * mutate the request, and must return `false` (never throw) on any malformed input.
 */
export interface IInboundEmailAdapter {
	/** Stable adapter id, reported in the webhook response for operability. */
	readonly id: string;
	/** Whether the request carries a valid provider signature. */
	verifySignature(request: IInboundWebhookRequest): boolean;
	/** Normalizes a verified request into the canonical message shape. */
	parse(request: IInboundWebhookRequest): ParsedInboundEmail | Promise<ParsedInboundEmail>;
}
