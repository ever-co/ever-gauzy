import { createCodeChallenge, createCodeVerifier, randomBase64Url } from './pkce';

// The RFC 7636 appendix B test vector below is random text, not words.
// cspell:ignore Bjft FWFO Melhoa Haoe Sstw

describe('PKCE (RFC 7636)', () => {
	it('derives the S256 challenge of the RFC 7636 appendix B vector', () => {
		expect(createCodeChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
			'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'
		);
	});

	it('creates 43-character base64url verifiers from 32 random bytes', () => {
		const verifier = createCodeVerifier();
		expect(verifier).toHaveLength(43);
		expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
		expect(createCodeVerifier()).not.toBe(verifier);
	});

	it('never pads random values', () => {
		for (let i = 0; i < 20; i++) {
			expect(randomBase64Url(32)).not.toContain('=');
		}
	});
});
