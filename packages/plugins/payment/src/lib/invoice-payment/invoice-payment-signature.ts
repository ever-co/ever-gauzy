import { createHmac, hkdfSync, timingSafeEqual } from 'node:crypto';
import { isKnownDefaultSecret } from '@gauzy/contracts';

/**
 * The signature of the messages an organization's payment connector and the API send each other about an invoice
 * payment: the checkout the API asks for, and the notification the connector posts once the provider took the money.
 *
 * ```
 * x-gauzy-payment-timestamp: <Unix seconds>
 * x-gauzy-payment-signature: hex(HMAC_SHA256(signingSecret, `${timestamp}.${rawBody}`))
 * ```
 *
 * The signing secret is never stored. It is derived from the API's own key (`ENCRYPTION_KEY`, or `JWT_SECRET` when
 * that is unset and is not a published default), the provider registration and a version that a rotation raises.
 * A copy of the database alone therefore cannot sign, and the key never leaves the server. The registration records,
 * as non-secret configuration, which key its secret was derived from, so setting `ENCRYPTION_KEY` later does not
 * change a secret a connector already holds.
 */

export const PAYMENT_TIMESTAMP_HEADER = 'x-gauzy-payment-timestamp';
export const PAYMENT_SIGNATURE_HEADER = 'x-gauzy-payment-signature';

/** How far a message's timestamp may be from the server's clock, in seconds: a captured message is useless after. */
export const DEFAULT_SIGNATURE_TOLERANCE_SECONDS = 300;

/** Which of the API's keys a signing secret is derived from: `ENCRYPTION_KEY` or `JWT_SECRET`. */
export type SigningKeySource = 'k' | 'j';

const KEY_BYTES = 32;
const HKDF_SALT = Buffer.from('gauzy-invoice-payment', 'utf8');
const HKDF_INFO = Buffer.from('gauzy-invoice-payment-signing-v1', 'utf8');
const SECRET_PREFIX = 'gzips_';

type Env = Record<string, string | undefined>;

const isSet = (value: string | undefined): value is string => typeof value === 'string' && value.trim() !== '';

/**
 * The key a new signing secret is derived from, or null when the API has none it may use: an `ENCRYPTION_KEY` that is
 * a base64 32-byte key and not a published default, else a `JWT_SECRET` that is not a published default.
 */
export function signingKeySourceOf(env: Env = process.env): SigningKeySource | null {
	const encryptionKey = env['ENCRYPTION_KEY'];
	if (isSet(encryptionKey)) {
		const usable =
			!isKnownDefaultSecret(encryptionKey) && Buffer.from(encryptionKey.trim(), 'base64').length === KEY_BYTES;
		return usable ? 'k' : null;
	}
	const jwtSecret = env['JWT_SECRET'];
	return isSet(jwtSecret) && !isKnownDefaultSecret(jwtSecret) ? 'j' : null;
}

/** The key material of a source, or null when this process does not hold it (any more). */
function keyOf(source: SigningKeySource, env: Env): Buffer | null {
	if (source === 'k') {
		const raw = env['ENCRYPTION_KEY'];
		if (!isSet(raw) || isKnownDefaultSecret(raw)) {
			return null;
		}
		const key = Buffer.from(raw.trim(), 'base64');
		return key.length === KEY_BYTES ? key : null;
	}
	const raw = env['JWT_SECRET'];
	return isSet(raw) && !isKnownDefaultSecret(raw) ? Buffer.from(raw, 'utf8') : null;
}

/**
 * The signing secret of one provider registration, at one version.
 *
 * @returns The secret, or null when this process does not hold the key it is derived from.
 */
export function signingSecretOf(
	providerId: string,
	version: number,
	source: SigningKeySource,
	env: Env = process.env
): string | null {
	const key = keyOf(source, env);
	if (!key || !providerId || !Number.isInteger(version) || version < 1) {
		return null;
	}
	const derived = Buffer.from(hkdfSync('sha256', key, HKDF_SALT, HKDF_INFO, KEY_BYTES));
	const secret = createHmac('sha256', derived).update(`${providerId}:${version}`).digest('base64url');
	return `${SECRET_PREFIX}${secret}`;
}

/** The hex signature of a body sent at a timestamp. */
export function signatureOf(secret: string, timestamp: string, body: Buffer | string): string {
	return createHmac('sha256', secret).update(`${timestamp}.`).update(body).digest('hex');
}

/** The headers that sign a body, for a message the API sends. */
export function signedHeaders(secret: string, body: string, now: Date = new Date()): Record<string, string> {
	const timestamp = String(Math.floor(now.getTime() / 1000));
	return {
		[PAYMENT_TIMESTAMP_HEADER]: timestamp,
		[PAYMENT_SIGNATURE_HEADER]: signatureOf(secret, timestamp, body)
	};
}

/** One header's value, whatever the HTTP layer made of it. */
function headerOf(headers: Record<string, string | string[] | undefined>, name: string): string | null {
	const value = headers[name] ?? headers[name.toLowerCase()];
	const first = Array.isArray(value) ? value[0] : value;
	return typeof first === 'string' && first.trim() !== '' ? first.trim() : null;
}

/**
 * Whether a message the API received carries a valid signature, made within the tolerance of the server's clock.
 * Malformed input answers false, never throws: a hostile body must not become a server error. The comparison is
 * constant-time.
 */
export function isSignedBy(
	secret: string,
	headers: Record<string, string | string[] | undefined>,
	rawBody: Buffer | undefined,
	now: Date = new Date(),
	toleranceSeconds = DEFAULT_SIGNATURE_TOLERANCE_SECONDS
): boolean {
	const timestamp = headerOf(headers, PAYMENT_TIMESTAMP_HEADER);
	const signature = headerOf(headers, PAYMENT_SIGNATURE_HEADER);
	if (!secret || !rawBody || !timestamp || !signature || !/^\d{1,13}$/.test(timestamp)) {
		return false;
	}
	const ageSeconds = Math.abs(now.getTime() / 1000 - Number(timestamp));
	if (!Number.isFinite(ageSeconds) || ageSeconds > toleranceSeconds) {
		return false;
	}
	const expected = Buffer.from(signatureOf(secret, timestamp, rawBody), 'utf8');
	const received = Buffer.from(signature.toLowerCase(), 'utf8');
	return expected.length === received.length && timingSafeEqual(expected, received);
}
