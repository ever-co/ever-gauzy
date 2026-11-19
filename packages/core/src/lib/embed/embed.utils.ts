import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * The environment variable that turns embed credentials on. Off unless it says otherwise: deploying this code changes
 * nothing until an operator asks for it, and while it is off every embed route answers 404.
 */
export const EMBED_TOKENS_ENV = 'GAUZY_EMBED_TOKENS_ENABLED';

/** How long an embed token lives, in seconds, when the server does not say (`GAUZY_EMBED_TOKEN_TTL_SECONDS`). */
export const EMBED_TOKEN_DEFAULT_TTL_SECONDS = 15 * 60;

/** The longest an embed token may live: a revoked credential's tokens must not outlive it by much. */
export const EMBED_TOKEN_MAX_TTL_SECONDS = 60 * 60;

/** What a credential starts with, so a leaked one is recognisable in logs and by secret scanners. */
export const EMBED_CREDENTIAL_PREFIX = 'gze_';

/** 256 bits from the CSPRNG, in base64url without padding. */
const SECRET_BYTES = 32;
const SECRET_LENGTH = 43;

/** The whole shape of a secret that starts with `prefix`. */
function secretShapeOf(prefix: string): RegExp {
	return new RegExp(`^${prefix}[A-Za-z0-9_-]{${SECRET_LENGTH}}$`);
}

/** A new secret that starts with `prefix`. */
function newSecret(prefix: string): string {
	return `${prefix}${randomBytes(SECRET_BYTES).toString('base64url')}`;
}

const CREDENTIAL_SHAPE = secretShapeOf(EMBED_CREDENTIAL_PREFIX);

/** How many characters of a credential the list shows: 48 of its 256 bits, which leaves no guess possible. */
const DISPLAY_PREFIX_LENGTH = EMBED_CREDENTIAL_PREFIX.length + 8;

/**
 * Whether embed credentials are on.
 *
 * @param value The setting's raw value (the environment variable by default).
 * @returns True only for `true`, `1`, `yes` or `on`.
 */
export function isEmbedEnabled(value: string | undefined = process.env[EMBED_TOKENS_ENV]): boolean {
	return ['true', '1', 'yes', 'on'].includes(
		String(value ?? '')
			.trim()
			.toLowerCase()
	);
}

/** How long a new embed token lives: the server's setting, within one minute and one hour. */
export function embedTokenTtlSeconds(value: string | undefined = process.env['GAUZY_EMBED_TOKEN_TTL_SECONDS']): number {
	const asked = Number(value);
	if (!Number.isFinite(asked) || asked <= 0) {
		return EMBED_TOKEN_DEFAULT_TTL_SECONDS;
	}
	return Math.min(Math.max(Math.floor(asked), 60), EMBED_TOKEN_MAX_TTL_SECONDS);
}

/** A new credential: the secret to show once, its digest to store and the prefix to list. */
export function generateEmbedCredential(): { secret: string; keyHash: string; prefix: string } {
	const secret = newSecret(EMBED_CREDENTIAL_PREFIX);
	return { secret, keyHash: hashEmbedCredential(secret), prefix: secret.slice(0, DISPLAY_PREFIX_LENGTH) };
}

/** Whether a string has the shape of a credential, before any lookup. */
export function isWellFormedEmbedCredential(value: unknown): value is string {
	return typeof value === 'string' && CREDENTIAL_SHAPE.test(value);
}

export function hashEmbedCredential(secret: string): string {
	return createHash('sha256').update(secret, 'utf8').digest('hex');
}

/** Compares two digests in constant time. */
export function embedCredentialHashesMatch(stored: string, presented: string): boolean {
	const a = Buffer.from(stored, 'hex');
	const b = Buffer.from(presented, 'hex');
	return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}
