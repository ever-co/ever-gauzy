import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * How far a signature's timestamp may be from now, in seconds.
 *
 * A receiver rejects anything older, which is what bounds the window in which a captured request
 * could be replayed. The platform's own inbound path uses the same window.
 */
export const WEBHOOK_SIGNATURE_TOLERANCE_SECONDS = 300;

/**
 * A signature, ready to be sent.
 */
export interface IWebhookSignature {
	/** Unix seconds the payload was signed at. */
	timestamp: number;
	/** The `X-Signature` value: `t=<unix-seconds>,v1=<hex hmac-sha256>`. */
	header: string;
}

/**
 * Signs a payload.
 *
 * The signed string is `<unix-seconds>.<raw body>`, and the signature is the lower-case hex HMAC of
 * that string under the subscription's secret. The timestamp is inside the signed string, so a
 * receiver replaying a captured body with a fresh timestamp cannot produce a valid signature.
 *
 * During a rotation the endpoint accepts either secret, so the header carries two `v1` values: the
 * new one first, and the previous one while its grace window lasts. The receiver accepts the message
 * if any of them verifies, which is what makes a rotation possible without an outage.
 *
 * @param secret The subscription's current secret.
 * @param body The exact bytes being sent, before any parsing.
 * @param options Timestamp override and the previous secret during a rotation.
 * @returns The timestamp and the header value.
 */
export function signWebhookPayload(
	secret: string,
	body: string,
	options: { timestamp?: number; previousSecret?: string } = {}
): IWebhookSignature {
	const timestamp = options.timestamp ?? Math.floor(Date.now() / 1000);
	const signed = `${timestamp}.${body}`;
	const signatures = [hmacSha256Hex(secret, signed)];

	if (options.previousSecret) {
		signatures.push(hmacSha256Hex(options.previousSecret, signed));
	}

	return {
		timestamp,
		header: `t=${timestamp},${signatures.map((signature) => `v1=${signature}`).join(',')}`
	};
}

/**
 * Verifies a signature against the body that was received.
 *
 * The comparison is constant-time, and every `v1` the header carries is tried, so a message signed
 * during a rotation verifies under either secret.
 *
 * @param secret The shared secret.
 * @param body The raw body as received, before any parsing.
 * @param header The `X-Signature` value.
 * @param options Tolerance window and clock override.
 * @returns True when the signature is valid and inside the window.
 */
export function verifyWebhookSignature(
	secret: string,
	body: string,
	header: string,
	options: { toleranceSeconds?: number; now?: number } = {}
): boolean {
	if (!secret || !header) {
		return false;
	}

	const parts = header.split(',').map((part) => part.trim());
	const timestampPart = parts.find((part) => part.startsWith('t='));
	const signatures = parts.filter((part) => part.startsWith('v1=')).map((part) => part.slice(3));

	if (!timestampPart || signatures.length === 0) {
		return false;
	}

	const timestamp = Number(timestampPart.slice(2));

	if (!Number.isFinite(timestamp)) {
		return false;
	}

	const now = options.now ?? Math.floor(Date.now() / 1000);
	const tolerance = options.toleranceSeconds ?? WEBHOOK_SIGNATURE_TOLERANCE_SECONDS;

	if (Math.abs(now - timestamp) > tolerance) {
		return false;
	}

	const expected = hmacSha256Hex(secret, `${timestamp}.${body}`);

	return signatures.some((signature) => equalsInConstantTime(expected, signature));
}

/**
 * The hex HMAC-SHA256 of a payload under a secret.
 *
 * @param secret The shared secret.
 * @param payload The string to sign.
 * @returns The lower-case hex digest.
 */
function hmacSha256Hex(secret: string, payload: string): string {
	return createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
}

/**
 * Compares two hex digests without leaking where they differ.
 *
 * @param expected The digest the platform computed.
 * @param received The digest the caller presented.
 * @returns True when they are equal.
 */
function equalsInConstantTime(expected: string, received: string): boolean {
	if (!received || received.length !== expected.length) {
		return false;
	}

	return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(received, 'hex'));
}
