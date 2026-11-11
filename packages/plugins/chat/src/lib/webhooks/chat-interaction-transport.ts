import { Injectable } from '@nestjs/common';
import { WebhookHeader } from '@gauzy/contracts';
import { signWebhookPayload } from '@gauzy/core';
import { DEFAULT_EGRESS_POLICY, EgressBlockedError, egressTargetRefusal, guardedRequest, IEgressPolicy, readLimitedBody, resolveAllowedAddresses } from '../egress';

/** How long one callback attempt may take, from the lookup to the last byte of the reply. */
export const CHAT_INTERACTION_TIMEOUT_MS = 5_000;
/** How much of a reply is read (a reply is a message: the post limit). */
export const CHAT_INTERACTION_REPLY_MAX_BYTES = 64 * 1024;
/** The delays before the retries of a failed callback: three retries, each signed afresh. */
export const CHAT_INTERACTION_RETRY_DELAYS_MS: readonly number[] = [2_000, 10_000, 30_000];
/** The header names a callback carries beside the platform's own `X-Signature`. */
export const CHAT_INTERACTION_HEADERS = {
	IDEMPOTENCY_KEY: 'Idempotency-Key',
	INTERACTION_ID: 'X-Interaction-Id'
} as const;
export const CHAT_INTERACTION_USER_AGENT = 'EverGauzy-Chat-Webhooks/1.0';

/** What the platform may call back: `https:` only, the web ports, public addresses (the chat egress guard's rule). */
export const CHAT_INTERACTION_EGRESS_POLICY: IEgressPolicy = { ...DEFAULT_EGRESS_POLICY, allowedProtocols: ['https:'] };

/** What one attempt did. */
export type ChatInteractionAttempt =
	| { outcome: 'delivered'; status: number; body: Buffer; contentType: string | null }
	| { outcome: 'retry'; status: number; error: string }
	| { outcome: 'refused'; status: number; error: string };

/** The headers and body of one attempt: signed now, so every retry carries a fresh timestamp and the same id. */
export function signedCallback(secret: string, interactionId: string, attempt: number, payload: unknown, now?: number): { headers: Record<string, string>; body: string } {
	const body = JSON.stringify(payload);
	const signature = signWebhookPayload(secret, body, now === undefined ? {} : { timestamp: now });
	return {
		body,
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			// An uncompressed reply: a reply that breaks off is then always seen as incomplete (`response.complete`).
			'Accept-Encoding': 'identity',
			'User-Agent': CHAT_INTERACTION_USER_AGENT,
			[WebhookHeader.SIGNATURE]: signature.header,
			[WebhookHeader.ATTEMPT]: String(attempt),
			[CHAT_INTERACTION_HEADERS.IDEMPOTENCY_KEY]: interactionId,
			[CHAT_INTERACTION_HEADERS.INTERACTION_ID]: interactionId
		}
	};
}

/**
 * Why an interaction URL may not be saved, or null: it must be an `https:` URL that the egress guard allows, and every
 * address its host resolves to now must be public (a host that does not resolve is refused too: a callback could
 * never reach it).
 */
export async function interactionUrlRefusal(value: string, policy: IEgressPolicy = CHAT_INTERACTION_EGRESS_POLICY, resolver?: (hostname: string) => Promise<string[]>): Promise<string | null> {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return 'The interaction URL is not a URL.';
	}
	if (value.length > 2048) return 'The interaction URL is too long.';
	const refusal = egressTargetRefusal(url, policy);
	if (refusal === 'scheme') return 'The interaction URL must use https.';
	if (refusal) return 'The interaction URL must name a public host (no private, loopback or link-local address).';
	try {
		await resolveAllowedAddresses(url, { policy, ...(resolver ? { resolver } : {}), signal: AbortSignal.timeout(CHAT_INTERACTION_TIMEOUT_MS) });
		return null;
	} catch (error) {
		if (error instanceof EgressBlockedError) return 'The interaction URL must name a public host (no private, loopback or link-local address).';
		return 'The host of the interaction URL could not be resolved.';
	}
}

/**
 * Posts interaction callbacks through the chat plugin's egress guard: the URL judged, every address of its host
 * public, the connection pinned to those addresses, no redirect followed, a deadline, a bounded read of the reply.
 */
@Injectable()
export class ChatInteractionTransport {
	/** Spec seam: a narrower or wider policy and a resolver without a network. */
	policy: IEgressPolicy = CHAT_INTERACTION_EGRESS_POLICY;
	resolver?: (hostname: string) => Promise<string[]>;

	async post(url: string, headers: Record<string, string>, body: string): Promise<ChatInteractionAttempt> {
		const signal = AbortSignal.timeout(CHAT_INTERACTION_TIMEOUT_MS);
		let target: URL;
		try {
			target = new URL(url);
		} catch {
			return { outcome: 'refused', status: 0, error: 'not_a_url' };
		}
		try {
			const response = await guardedRequest(target, {
				method: 'POST',
				headers: { ...headers, 'Content-Length': String(Buffer.byteLength(body)) },
				body,
				signal,
				policy: this.policy,
				...(this.resolver ? { resolver: this.resolver } : {})
			});
			const status = response.statusCode ?? 0;
			if (status >= 200 && status < 300) {
				// The reply is part of the answer: a read that fails or breaks off (the deadline, a dropped connection) is
				// retried, so the receiver can answer again under the same interaction id. A reply over the cap is read to
				// the cap and then refused as a reply (not JSON), not retried.
				let reply: Buffer;
				try {
					reply = await readLimitedBody(response, { maxBytes: CHAT_INTERACTION_REPLY_MAX_BYTES, signal });
				} catch {
					return { outcome: 'retry', status, error: signal.aborted ? 'timeout' : 'reply_unreadable' };
				}
				if (!response.complete && reply.length < CHAT_INTERACTION_REPLY_MAX_BYTES) {
					return { outcome: 'retry', status, error: signal.aborted ? 'timeout' : 'reply_unreadable' };
				}
				const contentType = response.headers['content-type'];
				return { outcome: 'delivered', status, body: reply, contentType: typeof contentType === 'string' ? contentType : null };
			}
			response.destroy();
			// A redirect is not followed (one hop): it counts as a refusal, like any other 3xx or 4xx but 408 / 429.
			if (status === 408 || status === 429 || status >= 500) return { outcome: 'retry', status, error: `http_${status}` };
			return { outcome: 'refused', status, error: `http_${status}` };
		} catch (error) {
			if (error instanceof EgressBlockedError) return { outcome: 'refused', status: 0, error: 'target_refused' };
			const name = (error as { name?: string })?.name;
			return { outcome: 'retry', status: 0, error: name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'unreachable' };
		}
	}
}
