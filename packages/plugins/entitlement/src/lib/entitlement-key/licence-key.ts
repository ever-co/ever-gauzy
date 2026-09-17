import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { DEFAULT_KEY_PREFIX_LENGTH, LicenceKeyFormat } from '../entitlement.enums';

/**
 * The key material of the domain: how a licence key is generated, how it is digested for lookup, and
 * how it is encrypted when an operator asks to be able to re-display it.
 *
 * The rules this module exists to keep are three, and they are the whole security story of an issued
 * credential:
 *
 * 1. **The plaintext leaves the service exactly once.** It is generated here, returned in the
 *    response to the issuance call, and never written to a column, a log line or an event payload.
 * 2. **The lookup column is a digest.** Validation has to find a key without scanning and without
 *    decrypting, so the digest is computed once, at issuance, and is what every later probe compares.
 * 3. **Re-display is opt-in and encrypted.** `keyCiphertext` is written only when the caller asked
 *    for a recoverable key, and even then the row is marked secret so no serializer carries it.
 */

/** The encryption algorithm, matching the platform's own at-rest encryption. */
export const KEY_ENCRYPTION_ALGORITHM = 'aes-256-gcm';

/** The alphabet the grouped and metre formats are drawn from: no `0`/`O`, no `1`/`I`/`L`. */
const UNAMBIGUOUS_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/** Session key material used when the deployment has configured none, so a single process still works. */
let sessionKey: Buffer | null = null;

/**
 * @returns The key the ciphertext column is encrypted under.
 *
 * `ENTITLEMENT_KEY_ENCRYPTION_KEY` is preferred, because a deployment may rotate the platform-wide
 * key without making every issued licence key unreadable; the platform's own `ENCRYPTION_KEY` is the
 * fallback, and a session key is the last resort so that a misconfigured installation still issues
 * keys — it simply cannot recover them after a restart, which is the same as asking for a write-only
 * key and is warned about rather than silently accepted.
 */
function encryptionKey(): Buffer {
	const configured = process.env.ENTITLEMENT_KEY_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY;

	if (configured) {
		const decoded = Buffer.from(configured, 'base64');

		if (decoded.length === 32) {
			return decoded;
		}
	}

	if (!sessionKey) {
		console.warn(
			'ENTITLEMENT_KEY_ENCRYPTION_KEY is not set to a 32-byte base64 value. Licence keys are stored under a session key, so a recoverable key cannot be re-displayed after a restart. This is not secure for production.'
		);
		sessionKey = randomBytes(32);
	}

	return sessionKey;
}

/**
 * @param format Which generator renders the key.
 * @returns A newly generated licence key, in clear. The caller returns it once and forgets it.
 */
export function generateLicenceKey(format: LicenceKeyFormat = LicenceKeyFormat.UUID): string {
	switch (format) {
		case LicenceKeyFormat.GROUPED_16:
			return group(Array.from({ length: 16 }, () => randomCharacter()).join(''), 4);
		case LicenceKeyFormat.BASE32_20:
			return group(Array.from({ length: 20 }, () => randomCharacter()).join(''), 4);
		case LicenceKeyFormat.UUID:
		default:
			return randomUUID();
	}
}

/**
 * @param plaintext The key in clear.
 * @returns Its SHA-256 digest, hex encoded: the lookup column, and the only form of the key that is
 * ever stored.
 */
export function digestLicenceKey(plaintext: string): string {
	return createHash('sha256').update(String(plaintext ?? ''), 'utf8').digest('hex');
}

/**
 * @param plaintext The key in clear.
 * @param length How many leading characters to keep.
 * @returns The display prefix, so an agent can identify a key a customer reads out without holding
 * the whole secret.
 */
export function licenceKeyPrefix(plaintext: string, length: number = DEFAULT_KEY_PREFIX_LENGTH): string {
	return String(plaintext ?? '').slice(0, Math.max(0, length));
}

/**
 * @param plaintext The key in clear.
 * @returns The encrypted form, as `{iv}:{authTag}:{ciphertext}`, all hex.
 */
export function encryptLicenceKey(plaintext: string): string {
	const iv = randomBytes(16);
	const cipher = createCipheriv(KEY_ENCRYPTION_ALGORITHM, encryptionKey(), iv);

	let encrypted = cipher.update(String(plaintext), 'utf8', 'hex');
	encrypted += cipher.final('hex');

	return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${encrypted}`;
}

/**
 * @param ciphertext The stored form.
 * @returns The key in clear.
 * @throws Error when the stored value is not in the expected shape or does not authenticate, which is
 * what makes a tampered row a refusal rather than a wrong key.
 */
export function decryptLicenceKey(ciphertext: string): string {
	const [ivHex, authTagHex, encrypted] = String(ciphertext ?? '').split(':');

	if (!ivHex || !authTagHex || !encrypted) {
		throw new Error('ENTITLEMENT_KEY_NOT_RECOVERABLE: the stored ciphertext is not in the expected format.');
	}

	const decipher = createDecipheriv(KEY_ENCRYPTION_ALGORITHM, encryptionKey(), Buffer.from(ivHex, 'hex'));
	decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

	return decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
}

/**
 * @returns One uniformly distributed character of the unambiguous alphabet.
 *
 * The byte is rejected rather than reduced when it falls in the incomplete tail of the alphabet, so
 * every character is equally likely; a modulo over the whole byte range would make the first
 * characters of the alphabet likelier than the last.
 */
function randomCharacter(): string {
	const limit = Math.floor(256 / UNAMBIGUOUS_ALPHABET.length) * UNAMBIGUOUS_ALPHABET.length;

	for (;;) {
		const byte = randomBytes(1)[0];

		if (byte < limit) {
			return UNAMBIGUOUS_ALPHABET[byte % UNAMBIGUOUS_ALPHABET.length];
		}
	}
}

/**
 * @param value The rendered key.
 * @param size The group size.
 * @returns The key in hyphen-separated groups, which is how it is printed and read out.
 */
function group(value: string, size: number): string {
	const groups: string[] = [];

	for (let index = 0; index < value.length; index += size) {
		groups.push(value.slice(index, index + size));
	}

	return groups.join('-');
}
