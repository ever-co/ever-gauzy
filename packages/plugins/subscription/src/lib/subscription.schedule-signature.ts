import { createHash, createHmac, hkdfSync, timingSafeEqual } from 'node:crypto';
import { isKnownDefaultSecret } from '@gauzy/contracts';

type Env = Record<string, string | undefined>;

const HKDF_SALT = Buffer.from('gauzy:subscription-scheduled-change', 'utf8');
const HKDF_INFO = Buffer.from('subscription-scheduled-change-v1', 'utf8');

let warned = false;

/**
 * The keys a scheduled change is signed and verified with, derived from the deployment's own secrets the way the
 * account-deletion digests derive theirs: `ENCRYPTION_KEY` first, then a `JWT_SECRET` that is not a known default.
 * Verification accepts any of them, so adding `ENCRYPTION_KEY` to a deployment does not orphan a change signed before.
 *
 * @param env The environment.
 * @returns The derived keys, the one new changes are signed with first.
 */
function signingKeys(env: Env): Buffer[] {
	return [env['ENCRYPTION_KEY'], env['JWT_SECRET']]
		.filter((raw): raw is string => typeof raw === 'string' && raw.trim() !== '' && !isKnownDefaultSecret(raw))
		.map((raw) => Buffer.from(hkdfSync('sha256', Buffer.from(raw, 'utf8'), HKDF_SALT, HKDF_INFO, 32)));
}

/**
 * @param value Any JSON value.
 * @returns The value with every object's keys in order, so that a database that stores JSON with its keys reordered
 * (`jsonb`, MySQL `JSON`) hands back what was signed.
 */
function ordered(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(ordered);
	}

	if (value && typeof value === 'object' && !(value instanceof Date)) {
		return Object.fromEntries(
			Object.keys(value as Record<string, unknown>)
				.filter((key) => key !== 'signature' && (value as Record<string, unknown>)[key] !== undefined)
				.sort()
				.map((key) => [key, ordered((value as Record<string, unknown>)[key])])
		);
	}

	return value;
}

/**
 * @param subscriptionId The subscription the change is recorded on, so an entry copied onto another one does not verify.
 * @param change The recorded change, without its signature.
 * @returns What is signed: the change as stored, keys in order.
 */
function payloadOf(subscriptionId: string, change: object): string {
	return JSON.stringify(ordered(JSON.parse(JSON.stringify({ subscriptionId: String(subscriptionId), change }))));
}

/**
 * Signs a change `applyChange` schedules for the next period.
 *
 * The key the change is stored under used to be writable through a caller's metadata (SEC-B-03), so the billing run
 * trusts the lines and the quantity of a stored change only when this signature verifies: nothing a caller could put
 * there, before the key was reserved or through an instance that does not reserve it yet, carries one.
 *
 * With no usable secret configured the signature is an unkeyed SHA-256, warned once: the change still takes hold, as
 * it does with no secret anywhere else on the platform, and such a deployment has no secret to protect it with.
 *
 * @param subscriptionId The subscription the change is recorded on.
 * @param change The change, without its signature.
 * @param env The environment.
 * @returns 64 hexadecimal characters.
 */
export function signScheduledChange(subscriptionId: string, change: object, env: Env = process.env): string {
	const payload = payloadOf(subscriptionId, change);
	const [key] = signingKeys(env);

	if (!key) {
		if (!warned) {
			warned = true;
			console.warn(
				'Subscriptions: neither ENCRYPTION_KEY nor a non-default JWT_SECRET is set, so changes scheduled for the next period are signed with an unkeyed SHA-256.'
			);
		}

		return createHash('sha256').update(payload, 'utf8').digest('hex');
	}

	return createHmac('sha256', key).update(payload, 'utf8').digest('hex');
}

/**
 * @param subscriptionId The subscription the change is recorded on.
 * @param change The stored change, with the signature it carries.
 * @param env The environment.
 * @returns True when the signature is one {@link signScheduledChange} made for this change on this subscription.
 */
export function verifyScheduledChange(subscriptionId: string, change: object, env: Env = process.env): boolean {
	const signature = (change as { signature?: unknown }).signature;
	const stated = typeof signature === 'string' ? signature : '';

	if (!/^[0-9a-f]{64}$/.test(stated)) {
		return false;
	}

	const payload = payloadOf(subscriptionId, change);
	const keys = signingKeys(env);
	const expected = keys.length
		? keys.map((key) => createHmac('sha256', key).update(payload, 'utf8').digest('hex'))
		: [createHash('sha256').update(payload, 'utf8').digest('hex')];
	const given = Buffer.from(stated, 'hex');

	return expected.some((candidate) => timingSafeEqual(Buffer.from(candidate, 'hex'), given));
}
