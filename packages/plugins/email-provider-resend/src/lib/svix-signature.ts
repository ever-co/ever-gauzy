// cspell:ignore svix whsec
import { createHmac, timingSafeEqual } from 'node:crypto';

/** The headers a Svix-signed webhook carries (Resend signs its webhooks with Svix). */
export const SVIX_ID_HEADER = 'svix-id';
export const SVIX_TIMESTAMP_HEADER = 'svix-timestamp';
export const SVIX_SIGNATURE_HEADER = 'svix-signature';

/** How far a signature's timestamp may be from now (Svix's own tolerance). */
export const SVIX_TOLERANCE_SECONDS = 300;

/** The signing key of a `whsec_<base64>` secret (the bytes, not the text). */
function keyOf(secret: string): Buffer | null {
	const text = secret.trim();
	const encoded = text.startsWith('whsec_') ? text.slice('whsec_'.length) : text;
	if (!encoded || !/^[A-Za-z0-9+/=_-]+$/.test(encoded)) return null;
	const key = Buffer.from(encoded.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
	return key.length >= 16 ? key : null;
}

/** The base64 HMAC-SHA256 of `<id>.<timestamp>.<body>` under the secret (what the sender puts in `v1,`). */
export function svixSignature(secret: string, id: string, timestamp: string, body: string): string {
	const key = keyOf(secret);
	if (!key) throw new Error('The webhook signing secret is not a whsec_ key.');
	return createHmac('sha256', key).update(`${id}.${timestamp}.${body}`, 'utf8').digest('base64');
}

/**
 * Verifies a Svix signature: `svix-signature` holds one or more space-separated `v1,<base64>` values (several during a
 * secret rotation), over `<svix-id>.<svix-timestamp>.<raw body>`; the timestamp must be within 5 minutes. Constant-time
 * compare. Answers `false` for anything malformed (never throws).
 */
export function verifySvixSignature(
	secret: string,
	headers: { id?: string; timestamp?: string; signature?: string },
	body: string,
	now = Math.floor(Date.now() / 1000)
): boolean {
	try {
		const { id, timestamp, signature } = headers;
		if (!secret || !id || !timestamp || !signature) return false;
		if (!/^\d{1,12}$/.test(timestamp) || Math.abs(now - Number(timestamp)) > SVIX_TOLERANCE_SECONDS) return false;
		const expected = Buffer.from(svixSignature(secret, id, timestamp, body), 'utf8');
		return signature
			.split(/\s+/)
			.map((part) => part.trim())
			.filter((part) => part.startsWith('v1,'))
			.some((part) => {
				const presented = Buffer.from(part.slice(3), 'utf8');
				return presented.length === expected.length && timingSafeEqual(presented, expected);
			});
	} catch {
		return false;
	}
}
