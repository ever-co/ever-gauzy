import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** What a report link's token starts with, so that a leaked one is recognisable in logs and by secret scanners. */
export const SAVED_REPORT_TOKEN_PREFIX = 'gsr_';

/** 256 bits from the CSPRNG: nothing to guess. */
const SECRET_BYTES = 32;

/** The length of those bytes in base64url, without padding. */
const SECRET_LENGTH = 43;

/** The whole shape of a token. */
const TOKEN_SHAPE = new RegExp(`^${SAVED_REPORT_TOKEN_PREFIX}[A-Za-z0-9_-]{${SECRET_LENGTH}}$`);

/** @returns A new plain token for a report link. */
export function generateSavedReportToken(): string {
	return `${SAVED_REPORT_TOKEN_PREFIX}${randomBytes(SECRET_BYTES).toString('base64url')}`;
}

/**
 * Whether a value has the shape of a link token at all: anything else is answered without reading the database.
 *
 * @param value What the link carried.
 */
export function isWellFormedSavedReportToken(value: unknown): value is string {
	return typeof value === 'string' && TOKEN_SHAPE.test(value);
}

/**
 * The digest stored in place of the token. A plain SHA-256 is enough: the input is 256 random bits, so there is nothing
 * to guess and no reason for a slow hash at every opening of the link.
 *
 * @param token The plain token.
 * @returns The hex digest (64 characters).
 */
export function hashSavedReportToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

/**
 * Compares two digests in constant time, so the answer time does not tell how much of a guess matched.
 *
 * @param stored The digest read from the database.
 * @param presented The digest of the token the link carried.
 */
export function savedReportTokenHashesMatch(stored: string | null | undefined, presented: string): boolean {
	if (!stored) {
		return false;
	}
	const storedBytes = Buffer.from(stored, 'utf8');
	const presentedBytes = Buffer.from(presented, 'utf8');
	if (storedBytes.length !== presentedBytes.length) {
		return false;
	}
	return timingSafeEqual(storedBytes, presentedBytes);
}
