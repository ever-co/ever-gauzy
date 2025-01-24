import { ALPHA_NUMERIC_CODE_LENGTH } from '@gauzy/constants';

/**
 * Generates a random alphanumeric code.
 *
 * @param length - The length of the code. Default is `ALPHA_NUMERIC_CODE_LENGTH` (6).
 * @returns A randomly generated alphanumeric code.
 */
export function generateAlphaNumericCode(length: number = ALPHA_NUMERIC_CODE_LENGTH): string {
	const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
	let code = '';

	for (let i = 0; i < length; i++) {
		const index = Math.floor(Math.random() * characters.length);
		code += characters[index];
	}

	return code;
}
