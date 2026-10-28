import { createHash, randomBytes } from 'node:crypto';

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

/**
 * SHA-256 (hex) of the normalized address. Stored with every request (it is what the per-address limit
 * counts) and kept after the deletion as the audit trail, when the clear address is cleared.
 */
export function hashAccountDeletionEmail(email: string): string {
	return createHash('sha256').update(normalizeAccountDeletionEmail(email), 'utf8').digest('hex');
}

/** SHA-256 (hex) of the client address, for the audit record. Null when there is none. */
export function hashAccountDeletionIp(ip: string | null | undefined): string | null {
	return ip ? createHash('sha256').update(ip, 'utf8').digest('hex') : null;
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
