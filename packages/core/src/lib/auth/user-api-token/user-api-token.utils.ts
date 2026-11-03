import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { UserApiTokenExpiryEnum } from '@gauzy/contracts';

/**
 * The environment variable that turns personal API tokens on. Off unless it says otherwise, so deploying this code
 * changes nothing on any environment until an operator asks for it.
 */
export const USER_API_TOKENS_ENV = 'GAUZY_USER_API_TOKENS_ENABLED';

/**
 * Whether personal API tokens are on: the routes answer 404 and the Settings page stays hidden while they are not.
 *
 * @param value The setting's raw value (the environment variable by default).
 * @returns True only for `true`, `1`, `yes` or `on`.
 */
export function isUserApiTokensEnabled(value: string | undefined = process.env[USER_API_TOKENS_ENV]): boolean {
	return ['true', '1', 'yes', 'on'].includes(
		String(value ?? '')
			.trim()
			.toLowerCase()
	);
}

/** What a token starts with, so a leaked one is recognisable in logs and by secret scanners. */
export const USER_API_TOKEN_PREFIX = 'gzp_';

/** 256 bits from the CSPRNG. */
const SECRET_BYTES = 32;

/** The length of those bytes in base64url, without padding. */
const SECRET_LENGTH = 43;

/** The whole shape of a token. */
const TOKEN_SHAPE = new RegExp(`^${USER_API_TOKEN_PREFIX}[A-Za-z0-9_-]{${SECRET_LENGTH}}$`);

/** How many characters of a token the list shows. They reveal 48 of its 256 bits, which leaves no guess possible. */
const DISPLAY_PREFIX_LENGTH = USER_API_TOKEN_PREFIX.length + 8;

/** How many tokens a user can hold at once. Revoked and expired tokens do not count. */
export const MAX_ACTIVE_USER_API_TOKENS = 10;

/**
 * How long the access token an exchange returns lives, at most.
 *
 * Shorter than a sign-in's (`JWT_TOKEN_EXPIRATION_TIME`, a day by default) on purpose: nothing re-reads the API token
 * once it was exchanged, so this is how long a revoked token can still act through an access token it already
 * obtained. An exchange costs nothing, so a client just exchanges again.
 */
export const USER_API_TOKEN_SESSION_TTL_MS = 60 * 60 * 1000;

/** `lastUsedAt` is written at most this often per token, so that a busy token does not write on every exchange. */
export const USER_API_TOKEN_LAST_USED_RESOLUTION_MS = 60 * 1000;

/** @returns A new plain token. */
export function generateUserApiToken(): string {
	return `${USER_API_TOKEN_PREFIX}${randomBytes(SECRET_BYTES).toString('base64url')}`;
}

/**
 * Whether a value has the shape of a token at all; anything else is refused before it reaches the database.
 *
 * @param value What the caller sent.
 * @returns True for a string shaped like a token.
 */
export function isWellFormedUserApiToken(value: unknown): value is string {
	return typeof value === 'string' && TOKEN_SHAPE.test(value);
}

/**
 * The digest stored in place of the token. A plain SHA-256 is right here, unlike for a password: the input is 256
 * random bits, so there is nothing to guess and no reason to spend a slow hash on every exchange.
 *
 * @param token The plain token.
 * @returns The hex digest (64 characters).
 */
export function hashUserApiToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

/**
 * Compares two digests in constant time.
 *
 * @param stored The digest on the row.
 * @param presented The digest of what the caller sent.
 * @returns True when they are the same digest.
 */
export function userApiTokenHashesMatch(stored: string | null | undefined, presented: string): boolean {
	if (typeof stored !== 'string' || stored.length !== presented.length) {
		return false;
	}
	return timingSafeEqual(Buffer.from(stored, 'utf8'), Buffer.from(presented, 'utf8'));
}

/**
 * @param token The plain token.
 * @returns The part of it that is stored and shown: enough to tell two tokens apart, useless to anyone else.
 */
export function userApiTokenDisplayPrefix(token: string): string {
	return token.slice(0, DISPLAY_PREFIX_LENGTH);
}

/**
 * @param expiry The expiry the user chose.
 * @param now The current time.
 * @returns When a token created now stops working; null when it never does.
 */
export function resolveUserApiTokenExpiry(expiry: UserApiTokenExpiryEnum, now: Date = new Date()): Date | null {
	switch (expiry) {
		case UserApiTokenExpiryEnum.DAYS_90:
			return new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
		case UserApiTokenExpiryEnum.YEAR_1:
			return new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
		case UserApiTokenExpiryEnum.NEVER:
			return null;
		default:
			throw new Error(`Unknown API token expiry: ${expiry}`);
	}
}
