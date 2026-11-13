// cspell:ignore gzcwh gzcws
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** The prefix of a webhook URL secret: recognisable to secret scanners, and checked before any lookup. */
export const CHAT_WEBHOOK_TOKEN_PREFIX = 'gzcwh_';

/** A URL secret as it may appear in a path: the prefix and 43 base64url characters (32 random bytes). */
const TOKEN_SHAPE = /^gzcwh_[A-Za-z0-9_-]{43}$/;

/** A new URL secret (256 random bits). Shown once; only its hash is stored. */
export function newWebhookToken(): string {
	return `${CHAT_WEBHOOK_TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;
}

/** Whether a path segment can be a URL secret at all (anything else answers 404 without a lookup). */
export function isWebhookTokenShaped(value: unknown): value is string {
	return typeof value === 'string' && TOKEN_SHAPE.test(value);
}

/** The stored form of a URL secret: its SHA-256, lower-case hex (the lookup key, unique). */
export function webhookTokenHash(token: string): string {
	return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** The last characters of a URL secret, kept so a manager can tell two webhooks apart. */
export function webhookTokenHint(token: string): string {
	return token.slice(-4);
}

/** A new signing secret for interaction callbacks (256 random bits, base64url). Shown once; stored sealed. */
export function newSigningSecret(): string {
	return `gzcws_${randomBytes(32).toString('base64url')}`;
}

/** Constant-time comparison of two hex digests (equal length or not equal). */
export function sameDigest(a: string, b: string): boolean {
	const left = Buffer.from(String(a ?? ''), 'utf8');
	const right = Buffer.from(String(b ?? ''), 'utf8');
	return left.length === right.length && timingSafeEqual(left, right);
}
