import { createHmac, timingSafeEqual } from 'crypto';

/** Header GitHub signs every App webhook delivery with. */
export const GITHUB_SIGNATURE_HEADER = 'x-hub-signature-256';

/**
 * Verify GitHub's `X-Hub-Signature-256` header against the raw request bytes.
 *
 * The scheme is `sha256=<hex hmac>`, where the HMAC is SHA-256 over the EXACT body GitHub sent,
 * keyed by the webhook secret configured in the GitHub App. Implemented here rather than through
 * `@octokit/webhooks`' `verifyAndReceive` so a bad signature produces a clean 403 instead of the
 * `AggregateError` that receiver turns failures into, and so the check is unit-testable without a
 * Probot instance.
 *
 * Two properties matter and are easy to lose:
 *
 * - **The raw bytes, never a re-serialization.** `JSON.stringify(request.body)` is not what GitHub
 *   hashed: key order, whitespace, number formatting and unicode escaping all survive the wire but
 *   not a parse/re-serialize round trip. The caller must pass `request.rawBody` (captured globally
 *   by `captureRawBody` in the API bootstrap).
 * - **Constant-time comparison, with a length check first.** `timingSafeEqual` throws on unequal
 *   lengths, so the length is compared in the clear (it leaks nothing — the digest length is fixed).
 *
 * @param payload - The raw request body bytes, exactly as received.
 * @param header - The value of the `x-hub-signature-256` request header.
 * @param secret - The webhook secret configured in the GitHub App (`GAUZY_GITHUB_WEBHOOK_SECRET`).
 * @returns `true` only when the header is a well-formed `sha256=` signature that matches.
 */
export function verifyGithubWebhookSignature(payload: Buffer, header: string, secret: string): boolean {
	if (!secret || !header || !payload?.length) {
		return false;
	}

	const separator = header.indexOf('=');
	if (separator < 0) {
		return false;
	}
	const scheme = header.slice(0, separator);
	// Lower-cased because hex is case-insensitive and this is a normalization, not a relaxation:
	// the digest still has to match byte for byte after it.
	const candidate = header
		.slice(separator + 1)
		.trim()
		.toLowerCase();
	if (scheme !== 'sha256' || !/^[0-9a-f]+$/.test(candidate)) {
		return false;
	}

	const expected = createHmac('sha256', secret).update(payload).digest('hex');
	const a = Buffer.from(candidate, 'utf8');
	const b = Buffer.from(expected, 'utf8');
	return a.length === b.length && timingSafeEqual(a, b);
}
