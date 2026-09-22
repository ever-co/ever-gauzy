import { resolveCorpPolicy } from './index';

/**
 * Regression suite for the Cross-Origin-Resource-Policy override added alongside the
 * `NODE_ENV=production` compose default (GHSA-chm8-2ggf-pgjq residual).
 *
 * Two failure modes this guards:
 * - helmet THROWS while initializing on an unknown policy string, so a typo in `CORP_POLICY` would
 *   stop the API from booting at all — the old `as` cast asserted the type without checking it;
 * - the production default must stay `same-site` (so app.gauzy.co can embed API-served assets while
 *   third-party origins cannot), while a deployment that serves API and web app from two different
 *   sites — `*.onrender.com` is a public suffix, so its subdomains are cross-site — can opt out.
 */
describe('resolveCorpPolicy', () => {
	it('defaults to same-site in production and cross-origin elsewhere', () => {
		expect(resolveCorpPolicy(undefined, true)).toBe('same-site');
		expect(resolveCorpPolicy(undefined, false)).toBe('cross-origin');
		expect(resolveCorpPolicy('', true)).toBe('same-site');
		expect(resolveCorpPolicy('   ', true)).toBe('same-site');
	});

	it.each([['same-origin'], ['same-site'], ['cross-origin']])('honours the valid override %p', (policy) => {
		expect(resolveCorpPolicy(policy, true)).toBe(policy);
	});

	it('normalises case and surrounding whitespace', () => {
		expect(resolveCorpPolicy('  Cross-Origin  ', true)).toBe('cross-origin');
	});

	it('falls back to the environment default on an invalid value instead of letting helmet throw', () => {
		const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
		try {
			expect(resolveCorpPolicy('cross_origin', true)).toBe('same-site');
			expect(resolveCorpPolicy('anything-else', false)).toBe('cross-origin');
			expect(warn).toHaveBeenCalled();
		} finally {
			warn.mockRestore();
		}
	});
});
