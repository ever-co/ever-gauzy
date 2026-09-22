import { DEFAULT_TRUST_PROXY, resolveTrustProxy } from './trust-proxy';

/**
 * Regression suite for GHSA-86mw-2crg-vmhc.
 *
 * `app.set('trust proxy', true)` was hardcoded, which makes Express resolve `req.ip` to the leftmost
 * (client-written) `X-Forwarded-For` entry. That address is what the rate limiter counts against, so
 * the limiter could be reset at will. The setting is now operator-configurable and defaults to a
 * single hop.
 */
describe('resolveTrustProxy', () => {
	let warn: jest.SpyInstance;

	beforeEach(() => {
		warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
	});

	afterEach(() => {
		warn.mockRestore();
	});

	it('defaults to trusting exactly one hop, not the whole chain', () => {
		expect(DEFAULT_TRUST_PROXY).toBe(1);
		expect(resolveTrustProxy(undefined)).toBe(1);
		expect(resolveTrustProxy('')).toBe(1);
		expect(resolveTrustProxy('   ')).toBe(1);
		// The vulnerable value must never be what an unconfigured deployment gets.
		expect(resolveTrustProxy(undefined)).not.toBe(true);
	});

	it('reads a hop count', () => {
		expect(resolveTrustProxy('0')).toBe(0);
		expect(resolveTrustProxy('2')).toBe(2);
		expect(resolveTrustProxy(' 3 ')).toBe(3);
	});

	it('reads the booleans, and announces the unsafe one', () => {
		expect(resolveTrustProxy('false')).toBe(false);
		expect(warn).not.toHaveBeenCalled();

		expect(resolveTrustProxy('TRUE')).toBe(true);
		expect(warn).toHaveBeenCalledTimes(1);
		expect(String(warn.mock.calls[0][0])).toContain('TRUST_PROXY=true');
	});

	it('reads a list of trusted proxies or presets', () => {
		expect(resolveTrustProxy('loopback')).toEqual(['loopback']);
		expect(resolveTrustProxy('10.0.0.0/8, 192.168.1.180 ,uniquelocal')).toEqual([
			'10.0.0.0/8',
			'192.168.1.180',
			'uniquelocal'
		]);
	});

	it('does not read a partially numeric value as a hop count', () => {
		// `Number.parseInt('1abc')` is 1; silently trusting one hop because of a typo would be worse
		// than treating the value as a proxy list and letting Express reject it loudly.
		expect(resolveTrustProxy('1abc')).toEqual(['1abc']);
	});
});
