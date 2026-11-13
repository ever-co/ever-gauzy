import {
	findRecoveryCodeHash,
	generateRecoveryCodes,
	hashRecoveryCode,
	normalizeRecoveryCode,
	RECOVERY_CODE_COUNT
} from './recovery-codes';

describe('two-factor recovery codes', () => {
	it('generates ten distinct codes of four groups of four base32 characters (80 bits)', () => {
		const codes = generateRecoveryCodes();

		expect(codes).toHaveLength(RECOVERY_CODE_COUNT);
		expect(new Set(codes).size).toBe(RECOVERY_CODE_COUNT);
		for (const code of codes) {
			expect(code).toMatch(/^[A-Z2-7]{4}-[A-Z2-7]{4}-[A-Z2-7]{4}-[A-Z2-7]{4}$/);
		}
	});

	it('reads a code typed in lower case, with spaces or without its dashes', () => {
		expect(normalizeRecoveryCode(' abcd efgh-ijkl mnop ')).toBe('ABCDEFGHIJKLMNOP');
		expect(normalizeRecoveryCode('ABCDEFGHIJKLMNOP')).toBe('ABCDEFGHIJKLMNOP');
	});

	it('reads nothing from text that cannot be a recovery code', () => {
		expect(normalizeRecoveryCode('ABCD-EFGH')).toBe('');
		expect(normalizeRecoveryCode('ABCD-EFGH-IJKL-MNO1')).toBe('');
		expect(normalizeRecoveryCode(undefined)).toBe('');
	});

	it('hashes the code, whatever the way it was typed', () => {
		const [code] = generateRecoveryCodes();

		expect(hashRecoveryCode(code)).toMatch(/^[0-9a-f]{64}$/);
		expect(hashRecoveryCode(code.toLowerCase().replace(/-/g, ' '))).toBe(hashRecoveryCode(code));
	});

	it('finds the stored hash of a typed code, and nothing for another code', () => {
		const codes = generateRecoveryCodes();
		const hashes = codes.map(hashRecoveryCode);

		expect(findRecoveryCodeHash(hashes, codes[3].toLowerCase())).toBe(hashes[3]);
		expect(findRecoveryCodeHash(hashes, 'AAAA-AAAA-AAAA-AAAA')).toBeNull();
		expect(findRecoveryCodeHash(hashes, 'not a code')).toBeNull();
		expect(findRecoveryCodeHash([], codes[0])).toBeNull();
	});
});
