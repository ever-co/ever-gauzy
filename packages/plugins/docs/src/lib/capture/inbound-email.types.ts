/**
 * The provider-agnostic inbound-email seam of `07-ai-knowledge.md` §17.2.
 *
 * The plugin never speaks a specific ESP's dialect. It defines this adapter contract and
 * ships ONE reference implementation (`generic-signed-webhook.adapter.ts`); a Mailgun /
 * SendGrid / Postmark / SES adapter is a few lines in an integration plugin and is bound
 * through the `DOCS_INBOUND_EMAIL_ADAPTER` token.
 */

import { IDocumentInboundAddress } from '@gauzy/contracts';

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

/** DI token for {@link IInboundAddressResolver}. */
export const DOCS_INBOUND_ADDRESS_RESOLVER = 'DOCS_INBOUND_ADDRESS_RESOLVER';

/**
 * The two questions the delivery path asks about a recipient — "whose address is this?" and
 * "is this sender allowed?" — plus a delivery counter.
 *
 * Deliberately a token-bound seam, mirroring {@link IInboundEmailAdapter}, rather than a direct
 * dependency on `InboundAddressService`. Two reasons:
 *
 * 1. **Storage stays out of the delivery path.** The delivery path should not know or care that
 *    addresses live in a table; swapping the store is a rebind of one token.
 * 2. **It keeps the service testable.** Importing the concrete service pulls in the entity, and
 *    the entity pulls in the MikroORM repository, whose base class is undefined under jest —
 *    a pre-existing limitation that is why no spec in this package loads an entity.
 */
export interface IInboundAddressResolver {
	/**
	 * Resolves a recipient to its armed address row.
	 *
	 * @returns `null` for anything not armed — unknown, inactive, or an unverified custom domain —
	 * so the caller can answer with the same 404 it gives an unknown route.
	 */
	resolveByAddress(recipient?: string): Promise<IDocumentInboundAddress | null>;
	/** Whether the sender passes this address's allowlist. Empty allowlist ⇒ always true. */
	isSenderAllowed(row: IDocumentInboundAddress, sender?: string): boolean;
	/** Records a successful delivery. Best-effort — must never fail an accepted message. */
	recordDelivery(row: IDocumentInboundAddress): Promise<void>;
}
