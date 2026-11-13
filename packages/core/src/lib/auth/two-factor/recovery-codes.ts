import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { encodeBase32 } from './totp';

/**
 * Single-use recovery codes, for a person who lost the phone with their authenticator app.
 *
 * Each code holds 80 random bits (sixteen base32 characters, shown as four groups of four), so storing only its
 * SHA-256 is enough: like a personal API token, it cannot be guessed back from the hash.
 */

/** How many codes are handed out at once. */
export const RECOVERY_CODE_COUNT = 10;

/** Characters of a code, without its dashes. */
const RECOVERY_CODE_LENGTH = 16;

/** Characters of each group shown between dashes. */
const RECOVERY_CODE_GROUP = 4;

/** 80 bits make sixteen base32 characters exactly. */
const RECOVERY_CODE_BYTES = 10;

/**
 * New recovery codes, all distinct, formatted for people (`ABCD-EFGH-IJKL-MNOP`).
 *
 * @param count How many.
 */
export function generateRecoveryCodes(count: number = RECOVERY_CODE_COUNT): string[] {
	const codes = new Set<string>();
	while (codes.size < count) {
		const characters = encodeBase32(randomBytes(RECOVERY_CODE_BYTES));
		const groups = characters.match(new RegExp(`.{${RECOVERY_CODE_GROUP}}`, 'g')) ?? [];
		codes.add(groups.join('-'));
	}
	return [...codes];
}

/**
 * The sixteen characters of a typed code, upper-cased and without spaces or dashes; empty when it cannot be a code.
 *
 * @param input What the person typed.
 */
export function normalizeRecoveryCode(input: string | null | undefined): string {
	const characters = String(input ?? '')
		.toUpperCase()
		.replace(/[\s-]/g, '');
	const isCode = new RegExp(`^[A-Z2-7]{${RECOVERY_CODE_LENGTH}}$`).test(characters);
	if (!isCode) {
		return '';
	}
	return characters;
}

/**
 * The SHA-256 (hex) stored for a code.
 *
 * @param code The code, as handed out or as typed.
 */
export function hashRecoveryCode(code: string): string {
	return createHash('sha256').update(normalizeRecoveryCode(code)).digest('hex');
}

/**
 * The stored hash a typed code matches, or null. Every stored hash is compared, in constant time.
 *
 * @param hashes The hashes of the codes still unused.
 * @param input What the person typed.
 */
export function findRecoveryCodeHash(hashes: readonly string[], input: string | null | undefined): string | null {
	const typed = normalizeRecoveryCode(input);
	if (!typed) {
		return null;
	}
	const candidate = Buffer.from(hashRecoveryCode(typed), 'hex');
	let found: string | null = null;
	for (const hash of hashes) {
		const stored = Buffer.from(hash, 'hex');
		const isSameLength = stored.length === candidate.length;
		if (isSameLength && timingSafeEqual(stored, candidate)) {
			found = hash;
		}
	}
	return found;
}
