import { createHash, createHmac, hkdfSync, timingSafeEqual } from 'crypto';
import { isKnownDefaultSecret } from '@gauzy/contracts';

/**
 * How a gift card's second factor is stored and checked.
 *
 * ## The forms
 *
 * * **Keyed, `h1:<source>:<kid>:<mac>`** — what every write stores (review R2-G30b). `<mac>` is
 *   `HMAC-SHA256(key, sha256hex(pin))`, 64 lowercase hex characters; `<source>` names the secret the key was derived
 *   from (`k` `ENCRYPTION_KEY`, `j` `JWT_SECRET`); `<kid>` is the first 8 hex characters of `HMAC-SHA256(key, "kid")`,
 *   so a digest made under another value of that secret is recognised as such rather than read as a wrong PIN.
 *   A PIN is a few digits: an unkeyed digest of one is reversed from a database dump by trying them all, a keyed one
 *   is not without the server's secret.
 * * **Legacy, `sha256hex(pin)`** — what R2-G30 (`HashGiftCardPins1791000000785`) left: 64 hexadecimal characters.
 *   Verification still accepts it (logged once) until `KeyGiftCardPinDigests1791000000786` converts it — the keyed
 *   form is an HMAC over this very digest, so the conversion needs no plaintext — or until the card verifies and is
 *   upgraded on the spot.
 *
 * ## The key
 *
 * Derived for this one purpose with HKDF-SHA256, as the platform derives its other storage keys
 * (`@gauzy/plugin-ever-instance`), from the first of:
 *
 * 1. `ENCRYPTION_KEY` — the platform's at-rest secret;
 * 2. `JWT_SECRET` — when it is not a value published in the repository.
 *
 * Neither is ever a constant of this source: with no usable secret configured there is no key, writes fall back to
 * the legacy digest (warned once) and the migration converts nothing, so nothing is keyed under a value an attacker
 * could read here. The secret a digest was made under must stay what it is: changing `ENCRYPTION_KEY` (or
 * `JWT_SECRET`, for a `j` digest) leaves the cards keyed under the old value unverifiable until their PIN is set
 * again — the same rule as every value the platform encrypts at rest. A card keyed under `JWT_SECRET` is keyed again
 * under `ENCRYPTION_KEY` the next time it verifies, once that is configured.
 */

/** The environment the key is derived from; `process.env` unless a caller states one. */
type Env = Record<string, string | undefined>;

/** The secret a keyed digest was made under: `k` ENCRYPTION_KEY, `j` JWT_SECRET. */
export type GiftCardPinKeySource = 'k' | 'j';

/** The version prefix of the keyed form. */
export const GIFT_CARD_PIN_KEYED_PREFIX = 'h1:';

const KEYED_FORM = /^h1:([kj]):([0-9a-f]{8}):([0-9a-f]{64})$/;
const LEGACY_FORM = /^[0-9a-f]{64}$/i;
const HKDF_SALT = Buffer.from('gauzy:gift-card-pin', 'utf8');
const HKDF_INFO = Buffer.from('gift-card-pin-v1', 'utf8');

const isSet = (value: string | undefined): value is string => typeof value === 'string' && value.trim() !== '';

/** What has been warned about already, so each warning is logged once per process. */
const warned = new Set<string>();

function warnOnce(key: string, message: string): void {
	if (!warned.has(key)) {
		warned.add(key);
		console.warn(message);
	}
}

/**
 * @param env The environment.
 * @returns The secret the next digest is keyed under, or `null` when no usable secret is configured.
 */
export function preferredGiftCardPinKeySource(env: Env = process.env): GiftCardPinKeySource | null {
	if (isSet(env['ENCRYPTION_KEY']) && !isKnownDefaultSecret(env['ENCRYPTION_KEY'])) {
		return 'k';
	}

	if (isSet(env['JWT_SECRET']) && !isKnownDefaultSecret(env['JWT_SECRET'])) {
		return 'j';
	}

	return null;
}

/**
 * @param source The secret to derive from.
 * @param env The environment.
 * @returns The 32-byte key of this purpose, or `null` when that secret is not configured (or is a published one).
 */
function keyOf(source: GiftCardPinKeySource, env: Env): Buffer | null {
	const raw = source === 'k' ? env['ENCRYPTION_KEY'] : env['JWT_SECRET'];

	if (!isSet(raw) || isKnownDefaultSecret(raw)) {
		return null;
	}

	return Buffer.from(hkdfSync('sha256', Buffer.from(raw, 'utf8'), HKDF_SALT, HKDF_INFO, 32));
}

/** @returns The identifier of a key: 8 hex characters, never the key. */
function kidOf(key: Buffer): string {
	return createHmac('sha256', key).update('kid').digest('hex').slice(0, 8);
}

/**
 * The unkeyed digest of a PIN: SHA-256 of the PIN as stated (no trimming, no case folding), lowercase hex. It is the
 * legacy stored form and the input of the keyed one.
 *
 * @param pin The PIN as the caller stated it.
 * @returns Its digest, 64 lowercase hexadecimal characters.
 */
export function hashGiftCardPin(pin: string): string {
	return createHash('sha256').update(String(pin)).digest('hex');
}

/**
 * Whether a stored value is a legacy, unkeyed digest (64 hexadecimal characters, either case). A plaintext PIN of 64
 * hexadecimal characters cannot be told from one.
 *
 * @param value The stored value.
 * @returns True for the legacy form.
 */
export function isGiftCardPinDigest(value: unknown): boolean {
	return typeof value === 'string' && LEGACY_FORM.test(value);
}

/**
 * @param value The stored value.
 * @returns True for the keyed form, `h1:…`.
 */
export function isKeyedGiftCardPin(value: unknown): boolean {
	return typeof value === 'string' && KEYED_FORM.test(value);
}

/**
 * Keys a legacy digest: the conversion the migration makes, and the last step of every write.
 *
 * @param digest A legacy digest, `sha256hex(pin)`.
 * @param env The environment.
 * @returns The keyed form, or `null` when no usable secret is configured.
 */
export function keyGiftCardPinDigest(digest: string, env: Env = process.env): string | null {
	const source = preferredGiftCardPinKeySource(env);
	const key = source ? keyOf(source, env) : null;

	if (!source || !key) {
		return null;
	}

	const mac = createHmac('sha256', key).update(String(digest).toLowerCase()).digest('hex');

	return `${GIFT_CARD_PIN_KEYED_PREFIX}${source}:${kidOf(key)}:${mac}`;
}

/**
 * The `gift_card.pin` value a write stores for a PIN a caller stated.
 *
 * - absent (`undefined`): nothing to write, the stored value is left alone;
 * - `null` or an empty string: the card carries no second factor (`null`) - an empty value never was one, since the
 *   check treats a falsy column as "no PIN";
 * - anything else: its keyed digest, or - with no usable secret configured - its legacy digest (warned once).
 *
 * @param pin The PIN as the caller stated it.
 * @param env The environment.
 * @returns The value to store, or `undefined` when nothing is to be written.
 */
export function storedGiftCardPin(pin: unknown, env: Env = process.env): string | null | undefined {
	if (pin === undefined) {
		return undefined;
	}

	if (pin === null || pin === '') {
		return null;
	}

	return storedFromDigest(hashGiftCardPin(String(pin)), env);
}

/**
 * The value a write stores for a digest an internal caller already holds (`GiftCardService.issue`'s `pinHash`): a
 * keyed digest is kept, a legacy one is keyed, anything else is read as a PIN.
 *
 * @param value The digest, or a PIN.
 * @param env The environment.
 * @returns The value to store.
 */
export function storedGiftCardPinFromDigest(value: string, env: Env = process.env): string {
	if (isKeyedGiftCardPin(value)) {
		return value;
	}

	return storedFromDigest(isGiftCardPinDigest(value) ? value.toLowerCase() : hashGiftCardPin(value), env);
}

function storedFromDigest(digest: string, env: Env): string {
	const keyed = keyGiftCardPinDigest(digest, env);

	if (keyed) {
		return keyed;
	}

	warnOnce(
		'unkeyed-write',
		'Gift-card PINs are stored as an unkeyed SHA-256 digest because neither ENCRYPTION_KEY nor a non-default ' +
			'JWT_SECRET is configured. Set ENCRYPTION_KEY: a short PIN digested without a key is recovered from a ' +
			'database dump by trying every PIN.'
	);

	return digest;
}

/** The outcome of a PIN check. */
export interface IGiftCardPinVerification {
	/** Whether the presented PIN matches. */
	readonly matches: boolean;
	/**
	 * The value the card should store instead, when it matched under a form that is no longer the preferred one (a
	 * legacy digest, or a digest keyed under `JWT_SECRET` once `ENCRYPTION_KEY` is configured).
	 */
	readonly upgrade?: string;
}

/**
 * Checks a presented PIN against the stored value, in constant time over the digests.
 *
 * @param presented The PIN the caller presented.
 * @param stored The stored value.
 * @param env The environment.
 * @returns Whether it matches, and the value to store instead when the stored form should be upgraded.
 */
export function verifyGiftCardPin(
	presented: string | undefined | null,
	stored: string,
	env: Env = process.env
): IGiftCardPinVerification {
	if (presented === undefined || presented === null || presented === '' || !stored) {
		return { matches: false };
	}

	const digest = hashGiftCardPin(String(presented));
	const keyed = KEYED_FORM.exec(stored);

	if (keyed) {
		const [, source, kid, mac] = keyed;
		const key = keyOf(source as GiftCardPinKeySource, env);

		if (!key || kidOf(key) !== kid) {
			warnOnce(
				`key-missing-${source}-${kid}`,
				`A gift-card PIN is keyed under ${source === 'k' ? 'ENCRYPTION_KEY' : 'JWT_SECRET'} (key id ${kid}), ` +
					'which this process does not have: the secret is unset or was changed. Such a card cannot verify ' +
					'until its PIN is set again.'
			);

			return { matches: false };
		}

		const matches = equalHex(createHmac('sha256', key).update(digest).digest('hex'), mac);
		const preferred = preferredGiftCardPinKeySource(env);

		return matches && preferred && preferred !== source
			? { matches, upgrade: keyGiftCardPinDigest(digest, env) ?? undefined }
			: { matches };
	}

	if (isGiftCardPinDigest(stored)) {
		warnOnce(
			'legacy-read',
			'A gift-card PIN is still stored as an unkeyed SHA-256 digest. It verifies, and is keyed on its next ' +
				'successful check; KeyGiftCardPinDigests1791000000786 keys them all once a secret is configured.'
		);

		const matches = equalHex(digest, stored.toLowerCase());

		return matches ? { matches, upgrade: keyGiftCardPinDigest(digest, env) ?? undefined } : { matches };
	}

	// Neither form: a plaintext PIN that predates R2-G30 and its migration. It is never compared as stated.
	return { matches: false };
}

/** Compares two lowercase hex strings of the same expected length in constant time over their bytes. */
function equalHex(left: string, right: string): boolean {
	const a = Buffer.from(left, 'hex');
	const b = Buffer.from(right, 'hex');

	return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}
