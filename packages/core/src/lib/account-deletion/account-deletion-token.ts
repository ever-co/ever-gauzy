import { createHash, createHmac, hkdfSync, randomBytes } from 'node:crypto';
import { isKnownDefaultSecret } from '@gauzy/contracts';

/** Bytes of randomness in a deletion token (256 bits). */
export const ACCOUNT_DELETION_TOKEN_BYTES = 32;

/** Default lifetime of a deletion link, in minutes. */
export const ACCOUNT_DELETION_DEFAULT_TTL_MINUTES = 30;

/** Bounds for `ACCOUNT_DELETION_TOKEN_TTL_MINUTES`: short enough that a forwarded email goes stale quickly. */
export const ACCOUNT_DELETION_MIN_TTL_MINUTES = 5;
export const ACCOUNT_DELETION_MAX_TTL_MINUTES = 60;

/** Deletion emails sent for one address per {@link ACCOUNT_DELETION_EMAIL_WINDOW_MS}; further requests are dropped. */
export const ACCOUNT_DELETION_MAX_REQUESTS_PER_EMAIL = 3;
export const ACCOUNT_DELETION_EMAIL_WINDOW_MS = 60 * 60 * 1000;

/** The shape every token we issue has: base64url of {@link ACCOUNT_DELETION_TOKEN_BYTES} bytes. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/**
 * A new deletion token: 256 random bits, base64url (43 characters, no padding). It is only ever sent in
 * the email; the database keeps {@link hashAccountDeletionToken} of it.
 */
export function generateAccountDeletionToken(): string {
	return randomBytes(ACCOUNT_DELETION_TOKEN_BYTES).toString('base64url');
}

/**
 * SHA-256 (hex) of a token. A plain hash is enough: the token has 256 bits of entropy, so it cannot be
 * guessed from the hash, and the hash lets the lookup be a plain indexed equality.
 */
export function hashAccountDeletionToken(token: string): string {
	return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** True when `token` has the shape of a token we issue, so junk never reaches the database. */
export function isWellFormedAccountDeletionToken(token: unknown): token is string {
	return typeof token === 'string' && TOKEN_PATTERN.test(token);
}

/** The address as the deletion flow compares it: trimmed and lower-cased. */
export function normalizeAccountDeletionEmail(email: string): string {
	return (email || '').trim().toLowerCase();
}

/** The environment the digest key is derived from; `process.env` unless a caller states one. */
type Env = Record<string, string | undefined>;

const HKDF_SALT = Buffer.from('gauzy:account-deletion', 'utf8');
const HKDF_INFO = Buffer.from('account-deletion-digest-v1', 'utf8');

/** Each warning once per process. */
const warned = new Set<string>();

/**
 * The keys the address and client-address digests are made with, the one new digests use first.
 *
 * An unkeyed SHA-256 of an address is matched against any list of known addresses, and one of an IPv4 client address
 * is reversed by trying all 2^32 of them. The digests are therefore keyed (HMAC-SHA256) with a key derived for this one
 * purpose with HKDF-SHA256, as the platform derives its other storage keys, from `ENCRYPTION_KEY`, or from `JWT_SECRET`
 * when that is not a value published in the repository. Both candidates are returned, so a row keyed under
 * `JWT_SECRET` is still found once `ENCRYPTION_KEY` is configured.
 *
 * @param env The environment.
 * @returns The keys, the preferred first; none when no usable secret is configured.
 */
function digestKeys(env: Env): Buffer[] {
	return [env['ENCRYPTION_KEY'], env['JWT_SECRET']]
		.filter((raw): raw is string => typeof raw === 'string' && raw.trim() !== '' && !isKnownDefaultSecret(raw))
		.map((raw) => Buffer.from(hkdfSync('sha256', Buffer.from(raw, 'utf8'), HKDF_SALT, HKDF_INFO, 32)));
}

/** SHA-256 (hex) of a value: the legacy stored form, and what the keyed form is computed over. */
function sha256(value: string): string {
	return createHash('sha256').update(value, 'utf8').digest('hex');
}

/** HMAC-SHA256 (hex) of a legacy digest: 64 characters, like the legacy form, so the columns keep their size. */
function keyed(key: Buffer, digest: string): string {
	return createHmac('sha256', key).update(digest, 'utf8').digest('hex');
}

/**
 * The digest of the normalized address stored with every request: what the per-address limit counts and what one
 * live link per address is found by, kept after the deletion as the audit trail once the clear address is cleared.
 *
 * Keyed (see {@link digestKeys}); the HMAC is taken over the legacy SHA-256 so that rows written before can be keyed
 * later without the address. With no usable secret configured it is the legacy unkeyed SHA-256, warned once: the
 * per-address limit cannot work without some digest.
 *
 * @param email The address.
 * @param env The environment.
 * @returns 64 hexadecimal characters.
 */
export function hashAccountDeletionEmail(email: string, env: Env = process.env): string {
	const digest = sha256(normalizeAccountDeletionEmail(email));
	const [key] = digestKeys(env);

	if (!key) {
		if (!warned.has('email')) {
			warned.add('email');
			console.warn(
				'Account deletion: neither ENCRYPTION_KEY nor a non-default JWT_SECRET is set, so request addresses are stored as unkeyed SHA-256 digests.'
			);
		}

		return digest;
	}

	return keyed(key, digest);
}

/**
 * Every digest a stored request of this address may carry: keyed under each configured secret, and the legacy
 * unkeyed one rows written before keying carry. The per-address limit and the one-live-link rule look rows up by all
 * of them, so neither resets when the digest changes.
 *
 * @param email The address.
 * @param env The environment.
 * @returns The distinct digests, the one new requests are stored under first.
 */
export function accountDeletionEmailHashes(email: string, env: Env = process.env): string[] {
	const digest = sha256(normalizeAccountDeletionEmail(email));

	return [...new Set([hashAccountDeletionEmail(email, env), ...digestKeys(env).map((key) => keyed(key, digest)), digest])];
}

/**
 * The name of the per-address lock that serialises issuing a link: the unkeyed SHA-256 of the normalized address.
 * It must not depend on the deployment's secret, or two instances that hold different ones for a moment (a rolling
 * deploy that adds `ENCRYPTION_KEY`) would lock different names for the same address. It is never stored: a
 * Postgres advisory lock keeps a number derived from it, a MySQL named lock keeps it only while held.
 *
 * @param email The address.
 * @returns 64 hexadecimal characters.
 */
export function accountDeletionAddressLockKey(email: string): string {
	return sha256(normalizeAccountDeletionEmail(email));
}

/**
 * The digest of the client address for the audit record, keyed as {@link hashAccountDeletionEmail} is. Unlike the
 * address's, it is not recorded at all when no usable secret is configured: nothing depends on it, and an unkeyed
 * digest of an IPv4 address is reversed in seconds (the rule `TermsAcceptanceService` follows for its IP digest).
 *
 * @param ip The client address.
 * @param env The environment.
 * @returns 64 hexadecimal characters, or null when there is no address or no key.
 */
export function hashAccountDeletionIp(ip: string | null | undefined, env: Env = process.env): string | null {
	const [key] = digestKeys(env);

	return ip && key ? keyed(key, sha256(ip)) : null;
}

/**
 * The lifetime of a deletion link in minutes: `ACCOUNT_DELETION_TOKEN_TTL_MINUTES` when it is a number,
 * clamped to [{@link ACCOUNT_DELETION_MIN_TTL_MINUTES}, {@link ACCOUNT_DELETION_MAX_TTL_MINUTES}], otherwise
 * {@link ACCOUNT_DELETION_DEFAULT_TTL_MINUTES}.
 */
export function accountDeletionTtlMinutes(env: NodeJS.ProcessEnv = process.env): number {
	const value = Number.parseInt(env['ACCOUNT_DELETION_TOKEN_TTL_MINUTES'] ?? '', 10);
	if (!Number.isFinite(value)) {
		return ACCOUNT_DELETION_DEFAULT_TTL_MINUTES;
	}
	return Math.min(ACCOUNT_DELETION_MAX_TTL_MINUTES, Math.max(ACCOUNT_DELETION_MIN_TTL_MINUTES, value));
}

/**
 * The link the email carries: the confirmation page with the token in the URL fragment, so it never
 * reaches a server log, a proxy or a `Referer` header.
 *
 * - `https://app.example.com/delete-account/confirm` → `…/confirm#token=<token>`
 * - `https://gauzy.example.com/#/auth/delete-account/confirm` (hash routing, the route already lives in the
 *   fragment) → `…/confirm?token=<token>`, still inside the fragment.
 *
 * Any fragment query the page URL already had is kept.
 */
export function buildAccountDeletionLink(confirmUrl: string, token: string): string {
	const encoded = encodeURIComponent(token);
	const hashIndex = confirmUrl.indexOf('#');
	if (hashIndex === -1) {
		return `${confirmUrl}#token=${encoded}`;
	}
	const fragment = confirmUrl.slice(hashIndex + 1);
	return `${confirmUrl}${fragment.includes('?') ? '&' : '?'}token=${encoded}`;
}

/**
 * The address shown on the confirmation page: first character of the local part, then `***`, then the
 * domain (`j***@example.com`). Enough for the owner to recognise it, little for anyone else.
 */
export function maskAccountDeletionEmail(email: string): string {
	const normalized = normalizeAccountDeletionEmail(email);
	const at = normalized.lastIndexOf('@');
	if (at <= 0) {
		return '***';
	}
	return `${normalized[0]}***${normalized.slice(at)}`;
}
