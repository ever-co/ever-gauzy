import {
	buildOtpauthUrl,
	decodeBase32,
	encodeBase32,
	generateTotpSecret,
	hotp,
	matchingTimeStep,
	normalizeTotpCode,
	timeStepAt,
	totpAt
} from './totp';

/** The secret of the RFC 4226 and RFC 6238 test vectors: the ASCII string "12345678901234567890". */
const RFC_SECRET = Buffer.from('12345678901234567890', 'ascii');
const RFC_SECRET_BASE32 = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

describe('TOTP (RFC 6238 over RFC 4226)', () => {
	describe('base32', () => {
		it('encodes the RFC secret as authenticator apps expect it', () => {
			expect(encodeBase32(RFC_SECRET)).toBe(RFC_SECRET_BASE32);
		});

		it('decodes what it encodes, ignoring case, spaces and padding', () => {
			expect(decodeBase32('gezd gnbv gy3t qojq gezd gnbv gy3t qojq====')).toEqual(RFC_SECRET);
		});

		it('refuses a character outside the base32 alphabet', () => {
			expect(() => decodeBase32('GEZD1')).toThrow();
		});
	});

	it('computes the HOTP values of RFC 4226 appendix D', () => {
		const expected = [
			'755224',
			'287082',
			'359152',
			'969429',
			'338314',
			'254676',
			'287922',
			'162583',
			'399871',
			'520489'
		];

		expect(expected.map((_, counter) => hotp(RFC_SECRET, counter))).toEqual(expected);
	});

	it('computes the six-digit TOTP values of RFC 6238 appendix B (SHA-1)', () => {
		const vectors: Array<[number, string]> = [
			[59, '287082'],
			[1111111109, '081804'],
			[1111111111, '050471'],
			[1234567890, '005924'],
			[2000000000, '279037'],
			[20000000000, '353130']
		];

		for (const [seconds, code] of vectors) {
			expect(totpAt(RFC_SECRET_BASE32, seconds * 1000)).toBe(code);
		}
	});

	it('counts 30-second steps from the Unix epoch', () => {
		expect(timeStepAt(59_000)).toBe(1);
		expect(timeStepAt(60_000)).toBe(2);
	});

	describe('matchingTimeStep', () => {
		const now = 1111111111 * 1000;
		const current = timeStepAt(now);

		it('answers the step of the current code', () => {
			expect(matchingTimeStep(RFC_SECRET_BASE32, totpAt(RFC_SECRET_BASE32, now), now)).toBe(current);
		});

		it('accepts the codes of the step just before and just after, for clocks up to 30 s apart', () => {
			const before = totpAt(RFC_SECRET_BASE32, now - 30_000);
			const after = totpAt(RFC_SECRET_BASE32, now + 30_000);

			expect(matchingTimeStep(RFC_SECRET_BASE32, before, now)).toBe(current - 1);
			expect(matchingTimeStep(RFC_SECRET_BASE32, after, now)).toBe(current + 1);
		});

		it('refuses a code two steps away', () => {
			const old = totpAt(RFC_SECRET_BASE32, now - 60_000);

			expect(matchingTimeStep(RFC_SECRET_BASE32, old, now)).toBeNull();
		});

		it('refuses a wrong code and anything that is not six digits', () => {
			expect(matchingTimeStep(RFC_SECRET_BASE32, '000000', now)).toBeNull();
			expect(matchingTimeStep(RFC_SECRET_BASE32, '05047', now)).toBeNull();
			expect(matchingTimeStep(RFC_SECRET_BASE32, 'abcdef', now)).toBeNull();
		});

		it('accepts a code typed with a space in the middle', () => {
			expect(matchingTimeStep(RFC_SECRET_BASE32, '050 471', now)).toBe(current);
		});
	});

	it('normalizes a typed code to its six digits, or nothing', () => {
		expect(normalizeTotpCode(' 123 456 ')).toBe('123456');
		expect(normalizeTotpCode('123-456')).toBe('123456');
		expect(normalizeTotpCode('12345')).toBe('');
		expect(normalizeTotpCode(undefined)).toBe('');
	});

	it('generates a fresh 160-bit secret each time', () => {
		const first = generateTotpSecret();
		const second = generateTotpSecret();

		expect(first).toMatch(/^[A-Z2-7]{32}$/);
		expect(decodeBase32(first)).toHaveLength(20);
		expect(second).not.toBe(first);
	});

	it('builds the otpauth address authenticator apps read from a QR code', () => {
		const url = buildOtpauthUrl({
			secret: RFC_SECRET_BASE32,
			accountName: 'marie@example.com',
			issuer: 'Ever Teams'
		});

		expect(url).toBe(
			'otpauth://totp/Ever%20Teams:marie%40example.com?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&issuer=Ever%20Teams&algorithm=SHA1&digits=6&period=30'
		);
	});

	it('keeps a colon out of the label, where it would split issuer and account', () => {
		const url = buildOtpauthUrl({ secret: RFC_SECRET_BASE32, accountName: 'a@b.c', issuer: 'Acme: Time' });

		expect(url.startsWith('otpauth://totp/Acme%20Time:a%40b.c?')).toBe(true);
	});
});
