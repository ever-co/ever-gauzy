import { randomInt } from 'node:crypto';
import { ALPHA_NUMERIC_CODE_LENGTH } from '@gauzy/constants';

/**
 * Generates a cryptographically secure random alphanumeric code.
 *
 * Uses `crypto.randomInt()` (a cryptographically secure PRNG) instead of `Math.random()` to prevent
 * predictability attacks on security-sensitive codes (e.g., magic login codes,
 * invite codes, verification codes).
 *
 * @param length - The length of the code. Default is `ALPHA_NUMERIC_CODE_LENGTH` (8).
 * @returns A randomly generated alphanumeric code.
 */
export function generateAlphaNumericCode(length: number = ALPHA_NUMERIC_CODE_LENGTH): string {
	const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
	let code = '';

	for (let i = 0; i < length; i++) {
		const index = randomInt(characters.length);
		code += characters[index];
	}

	return code;
}
