import { Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { getDocsConfig } from '../docs.config';
import {
	DOCS_INBOUND_SIGNATURE_HEADER,
	DOCS_INBOUND_SIGNATURE_TOLERANCE_MS,
	DOCS_INBOUND_TIMESTAMP_HEADER
} from '../docs.constants';
import {
	IInboundEmailAdapter,
	IInboundEmailAttachment,
	IInboundWebhookRequest,
	ParsedInboundEmail
} from './inbound-email.types';

/**
 * The reference inbound-email adapter (`07-ai-knowledge.md` §17.2): a **generic signed
 * webhook**, so a deployment can wire any ESP (or an internal relay) through a tiny shim
 * instead of waiting for a vendor-specific adapter.
 *
 * Signature scheme — HMAC-SHA256 over `"<timestamp>.<rawBody>"` keyed with
 * `GAUZY_DOCS_INBOUND_WEBHOOK_SECRET`, sent hex-encoded in `x-gauzy-docs-signature` with the
 * timestamp in `x-gauzy-docs-timestamp` (Unix seconds or milliseconds):
 *
 * ```
 * signature = hex(HMAC_SHA256(secret, `${timestamp}.${rawBody}`))
 * ```
 *
 * Hardening:
 * - **Constant-time** comparison (`timingSafeEqual`) after a length check — no early-exit oracle.
 * - **Freshness window** of 5 minutes on the timestamp; a valid HMAC with a stale timestamp fails.
 * - **Single-use signatures**: a freshness window alone is not replay protection — inside the
 *   tolerance a captured-but-valid delivery could be resubmitted without limit, and every
 *   replay creates another copy of the same attachments as new documents. Each accepted
 *   `(timestamp, signature)` pair is therefore remembered until its own freshness window
 *   expires, and a repeat is rejected. The set is bounded by that window (plus a hard entry
 *   cap) so it cannot grow without limit, and only VERIFIED signatures are recorded — an
 *   attacker cannot fill it with garbage.
 * - **Fail closed**: no secret configured ⇒ every request is rejected. Malformed input returns
 *   `false`, never an exception (an adapter must not turn a hostile body into a 500).
 *
 * Replay-store caveat: the seen-signature set is **per process**. It stops the practical
 * attack (a captured delivery resubmitted at any rate) but a deployment running several API
 * replicas behind a load balancer can still admit one replay per replica. A deployment that
 * needs cluster-wide exactly-once should bind an adapter backed by a shared cache
 * (Redis `SET NX EX <tolerance>` on the signature) — the seam is this class.
 *
 * Raw-body caveat: signature schemes are defined over the exact received bytes. When the
 * deployment does not preserve `rawBody`, this adapter falls back to `JSON.stringify(body)`,
 * which only verifies if the sender signed that same canonical form. Preserve the raw body
 * in the HTTP layer for byte-exact verification.
 */
/**
 * Hard cap on remembered signatures, so a burst of legitimate traffic cannot grow the set
 * without bound between prunes. At the 5-minute window this is far above any real inbound
 * mail rate; when it is hit the oldest entries (insertion order) are dropped first.
 */
const REPLAY_CACHE_MAX_ENTRIES = 10_000;

@Injectable()
export class GenericSignedWebhookAdapter implements IInboundEmailAdapter {
	public readonly id = 'generic-signed-webhook';

	private readonly logger = new Logger(GenericSignedWebhookAdapter.name);

	/**
	 * Signatures already accepted, mapped to the epoch-ms instant at which they may be
	 * forgotten (the end of their own freshness window). A `Map` keeps insertion order,
	 * which is what the entry-cap eviction uses.
	 */
	private readonly seenSignatures = new Map<string, number>();

	/**
	 * Verifies the HMAC signature, the freshness window, and single use.
	 *
	 * NOTE: a successful call has the side effect of consuming the signature — calling it
	 * twice for the same delivery returns `false` the second time, by design.
	 *
	 * @param request The inbound webhook request.
	 * @returns True when the request is authentic, fresh, and not a replay.
	 */
	public verifySignature(request: IInboundWebhookRequest): boolean {
		try {
			const secret = getDocsConfig().inboundWebhookSecret;
			if (!secret) {
				// Fail closed — an unsigned deployment must not accept documents.
				this.logger.warn('Inbound-email webhook secret is not configured — rejecting the request.');
				return false;
			}

			const signature = this.header(request, DOCS_INBOUND_SIGNATURE_HEADER);
			const timestamp = this.header(request, DOCS_INBOUND_TIMESTAMP_HEADER);
			if (!signature || !timestamp) {
				return false;
			}
			const signedAt = this.timestampMillis(timestamp);
			if (signedAt === null || Math.abs(Date.now() - signedAt) > DOCS_INBOUND_SIGNATURE_TOLERANCE_MS) {
				return false;
			}

			const payload = `${timestamp}.${this.rawBody(request)}`;
			const expected = createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
			const normalized = signature.trim().toLowerCase();
			if (!this.constantTimeEquals(expected, normalized)) {
				return false;
			}

			// Authenticity established — now (and only now) burn the signature. Recording
			// unverified input would let anyone fill the set with junk.
			return this.consumeSignature(`${timestamp}.${normalized}`, signedAt);
		} catch (error) {
			// A hostile body must never become a 500 — an unverifiable request is simply not verified.
			this.logger.debug(`Inbound-email signature verification failed: ${(error as Error).message}`);
			return false;
		}
	}

	/**
	 * Normalizes the generic payload shape into the canonical message.
	 *
	 * Expected body (all fields optional except `recipient`):
	 *
	 * ```jsonc
	 * {
	 *   "recipient": "docs-<token>@example.com",
	 *   "sender": "someone@example.com",
	 *   "subject": "Invoice 42",
	 *   "messageId": "<abc@mail>",
	 *   "sizeBytes": 91234,
	 *   "spf": "pass", "dkim": "pass",
	 *   "attachments": [ { "fileName": "invoice.pdf", "contentType": "application/pdf",
	 *                      "content": "<base64>" } ]
	 * }
	 * ```
	 *
	 * @param request The verified webhook request.
	 * @returns The normalized inbound message.
	 */
	public parse(request: IInboundWebhookRequest): ParsedInboundEmail {
		const body = request.body ?? {};
		const attachments: IInboundEmailAttachment[] = [];

		for (const raw of Array.isArray(body.attachments) ? body.attachments : []) {
			const content = this.decodeContent(raw?.content, raw?.encoding);
			if (!content?.length) {
				continue;
			}
			attachments.push({
				// Path separators are stripped here as well as in the storage layer — an
				// attachment name is attacker-controlled input.
				fileName: String(raw?.fileName ?? raw?.filename ?? 'attachment').replace(/[\\/]/g, '_').slice(0, 255),
				contentType: raw?.contentType ?? raw?.mimeType ?? undefined,
				sizeBytes: content.length,
				content
			});
		}

		return {
			recipient: String(body.recipient ?? body.to ?? '').trim(),
			sender: body.sender ?? body.from ?? undefined,
			subject: typeof body.subject === 'string' ? body.subject.slice(0, 255) : undefined,
			messageId: body.messageId ?? body['message-id'] ?? undefined,
			receivedAt: body.receivedAt ? new Date(body.receivedAt) : new Date(),
			sizeBytes: Number(body.sizeBytes ?? 0) || attachments.reduce((sum, item) => sum + item.sizeBytes, 0),
			spfPass: this.verdict(body.spf ?? body.spfPass),
			dkimPass: this.verdict(body.dkim ?? body.dkimPass),
			attachments,
			bodyText: typeof body.text === 'string' ? body.text : undefined
		};
	}

	/**
	 * Reads one header value case-insensitively (headers may arrive as arrays).
	 */
	private header(request: IInboundWebhookRequest, name: string): string | undefined {
		const headers = request?.headers ?? {};
		const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === name);
		const value = key ? headers[key] : undefined;
		return Array.isArray(value) ? value[0] : (value as string | undefined);
	}

	/**
	 * The exact received bytes when available, else the canonical JSON re-serialization.
	 */
	private rawBody(request: IInboundWebhookRequest): string {
		if (typeof request.rawBody === 'string') {
			return request.rawBody;
		}
		if (Buffer.isBuffer(request.rawBody)) {
			return request.rawBody.toString('utf8');
		}
		return JSON.stringify(request.body ?? {});
	}

	/**
	 * Single-use guard: records a verified signature and reports whether it is new.
	 *
	 * Expired entries are pruned on every call, so the set never holds more than one
	 * freshness window of traffic; the entry cap is the backstop for a pathological burst.
	 *
	 * @param key The `<timestamp>.<signature>` pair identifying one delivery.
	 * @param signedAt The delivery's own timestamp, in epoch ms.
	 * @returns True when the signature had not been seen (i.e. the request may proceed).
	 */
	private consumeSignature(key: string, signedAt: number): boolean {
		const now = Date.now();

		// Prune everything whose freshness window has closed — those requests are now
		// rejected by `isFresh` anyway, so remembering them buys nothing.
		for (const [seen, expiresAt] of this.seenSignatures) {
			if (expiresAt <= now) {
				this.seenSignatures.delete(seen);
			}
		}

		if (this.seenSignatures.has(key)) {
			this.logger.warn('Rejecting a replayed inbound-email webhook delivery (signature already used).');
			return false;
		}

		// Backstop: drop the oldest entries rather than grow without bound.
		while (this.seenSignatures.size >= REPLAY_CACHE_MAX_ENTRIES) {
			const oldest = this.seenSignatures.keys().next();
			if (oldest.done) {
				break;
			}
			this.seenSignatures.delete(oldest.value);
		}

		// The entry must outlive the request's own freshness window, not ours: a
		// tolerance-early (clock-skewed, future-dated) timestamp stays acceptable to the
		// freshness check until `signedAt + tolerance`, and forgetting it before then would
		// reopen the replay window.
		this.seenSignatures.set(key, Math.max(now, signedAt) + DOCS_INBOUND_SIGNATURE_TOLERANCE_MS);
		return true;
	}

	/**
	 * Parses a webhook timestamp header into epoch milliseconds.
	 *
	 * @param timestamp The raw header value (Unix seconds or milliseconds).
	 * @returns Epoch ms, or null when the value is not a usable timestamp.
	 */
	private timestampMillis(timestamp: string): number | null {
		const parsed = Number.parseInt(timestamp, 10);
		if (!Number.isFinite(parsed) || parsed <= 0) {
			return null;
		}
		// Heuristic: 10-digit values are seconds, 13-digit values are milliseconds.
		return timestamp.trim().length <= 10 ? parsed * 1000 : parsed;
	}

	/**
	 * Length-checked constant-time comparison of two hex digests.
	 */
	private constantTimeEquals(expected: string, actual: string): boolean {
		const expectedBuffer = Buffer.from(expected, 'utf8');
		const actualBuffer = Buffer.from(actual, 'utf8');
		if (expectedBuffer.length !== actualBuffer.length) {
			return false;
		}
		return timingSafeEqual(expectedBuffer, actualBuffer);
	}

	/**
	 * Decodes an attachment payload (base64 by default; `utf8`/`text` for inline text).
	 */
	private decodeContent(content: unknown, encoding?: string): Buffer | null {
		if (Buffer.isBuffer(content)) {
			return content;
		}
		if (typeof content !== 'string' || !content.length) {
			return null;
		}
		const normalized = (encoding ?? 'base64').toLowerCase();
		return Buffer.from(content, normalized === 'utf8' || normalized === 'text' ? 'utf8' : 'base64');
	}

	/**
	 * Normalizes an SPF/DKIM verdict field (`"pass"` / boolean / undefined).
	 */
	private verdict(value: unknown): boolean | undefined {
		if (typeof value === 'boolean') {
			return value;
		}
		if (typeof value === 'string') {
			return value.trim().toLowerCase() === 'pass';
		}
		return undefined;
	}
}
