import { normalizeTrackerIp, resolveThrottlerTracker, UNRESOLVED_THROTTLER_TRACKER } from './tracker';

/**
 * Regression suite for GHSA-86mw-2crg-vmhc.
 *
 * The rate limiter counts attempts against whatever `getTracker()` returns. The previous
 * implementation returned `CF-Connecting-IP` unconditionally and otherwise `req.ips[0]` — the
 * leftmost `X-Forwarded-For` entry — so an attacker who varied either header got a brand-new bucket
 * on every request and the 5-per-minute login limit never fired.
 *
 * The property under test is therefore not "the tracker is correct" but "the tracker cannot be
 * CHOSEN by the client": N requests carrying N different spoofed headers must land in ONE bucket.
 */
describe('resolveThrottlerTracker', () => {
	const notBehindCloudflare = { trustCloudflareConnectingIp: false };
	const behindCloudflare = { trustCloudflareConnectingIp: true };

	/** Builds a request as Express would present it for a given socket peer and client headers. */
	const request = (ip: string, headers: Record<string, unknown> = {}) => ({
		ip,
		// Express exposes the whole forwarded chain here; under the old code `ips[0]` — i.e. the value
		// the CLIENT appended — became the bucket key.
		ips: [...(typeof headers['x-forwarded-for'] === 'string' ? [headers['x-forwarded-for'] as string] : []), ip],
		headers
	});

	it('ignores CF-Connecting-IP when the deployment is not behind Cloudflare', () => {
		const buckets = new Set<string>();

		for (let attempt = 0; attempt < 25; attempt++) {
			buckets.add(
				resolveThrottlerTracker(
					request('203.0.113.10', { 'cf-connecting-ip': `198.51.100.${attempt}` }),
					notBehindCloudflare
				)
			);
		}

		// One bucket, not 25.
		expect(buckets).toEqual(new Set(['203.0.113.10']));
	});

	it('ignores a spoofed X-Forwarded-For chain', () => {
		const buckets = new Set<string>();

		for (let attempt = 0; attempt < 25; attempt++) {
			buckets.add(
				resolveThrottlerTracker(
					request('203.0.113.10', { 'x-forwarded-for': `198.51.100.${attempt}` }),
					notBehindCloudflare
				)
			);
		}

		expect(buckets).toEqual(new Set(['203.0.113.10']));
	});

	it('honours CF-Connecting-IP only when the deployment declares it is behind Cloudflare', () => {
		const req = request('203.0.113.10', { 'cf-connecting-ip': '198.51.100.7' });

		expect(resolveThrottlerTracker(req, behindCloudflare)).toBe('198.51.100.7');
		expect(resolveThrottlerTracker(req, notBehindCloudflare)).toBe('203.0.113.10');
	});

	it('keys one Cloudflare client to one bucket across many requests', () => {
		const buckets = new Set<string>();

		for (let attempt = 0; attempt < 10; attempt++) {
			// Cloudflare pins the header; only the pod-side socket address varies.
			buckets.add(
				resolveThrottlerTracker(
					request(`10.42.0.${attempt}`, { 'cf-connecting-ip': '198.51.100.7' }),
					behindCloudflare
				)
			);
		}

		expect(buckets).toEqual(new Set(['198.51.100.7']));
	});

	it('falls back to req.ip when a trusted CF-Connecting-IP is junk rather than minting a bucket from it', () => {
		const junk = ['', '   ', 'not-an-ip', 'evil.example.com', '1.2.3', '<script>'];
		const buckets = new Set<string>();

		for (const value of junk) {
			buckets.add(
				resolveThrottlerTracker(request('203.0.113.10', { 'cf-connecting-ip': value }), behindCloudflare)
			);
		}

		expect(buckets).toEqual(new Set(['203.0.113.10']));
	});

	it('shares ONE bucket when nothing about the request can be trusted', () => {
		// Fail closed: an unattributable request must not be handed a private allowance.
		expect(resolveThrottlerTracker({ headers: {} }, notBehindCloudflare)).toBe(UNRESOLVED_THROTTLER_TRACKER);
		expect(resolveThrottlerTracker({ ip: 'unknown', headers: {} }, behindCloudflare)).toBe(
			UNRESOLVED_THROTTLER_TRACKER
		);
		expect(resolveThrottlerTracker(undefined as any, notBehindCloudflare)).toBe(UNRESOLVED_THROTTLER_TRACKER);
	});

	it('uses only the first entry of a multi-valued CF-Connecting-IP', () => {
		expect(
			resolveThrottlerTracker(
				request('10.0.0.1', { 'cf-connecting-ip': '198.51.100.7, 198.51.100.8' }),
				behindCloudflare
			)
		).toBe('198.51.100.7');
		expect(
			resolveThrottlerTracker(
				request('10.0.0.1', { 'cf-connecting-ip': ['198.51.100.7', '198.51.100.8'] }),
				behindCloudflare
			)
		).toBe('198.51.100.7');
	});
});

describe('normalizeTrackerIp', () => {
	it('collapses IPv4-mapped IPv6 so one client keeps one bucket', () => {
		expect(normalizeTrackerIp('::ffff:203.0.113.10')).toBe('203.0.113.10');
		expect(normalizeTrackerIp('::FFFF:203.0.113.10')).toBe('203.0.113.10');
		expect(normalizeTrackerIp('203.0.113.10')).toBe('203.0.113.10');
	});

	it('collapses the hex spelling of an IPv4-mapped address too', () => {
		expect(normalizeTrackerIp('::ffff:cb00:710a')).toBe('203.0.113.10');
		expect(normalizeTrackerIp('0:0:0:0:0:ffff:203.0.113.10')).toBe('203.0.113.10');
	});

	it('buckets IPv6 by canonical /64, so neither re-spelling nor rotating inside the prefix mints a bucket', () => {
		const spellings = [
			'2001:DB8::1',
			'[2001:db8::1]',
			'2001:db8:0:0::1',
			'2001:0db8:0000:0000:0000:0000:0000:0001',
			// A client choosing a different interface identifier inside its own /64 on every request.
			'2001:db8::dead:beef',
			'2001:db8:0:0:ffff:ffff:ffff:ffff',
			// A zone id names a local interface, not a different client.
			'2001:db8::1%eth0'
		];

		expect(new Set(spellings.map((value) => normalizeTrackerIp(value)))).toEqual(new Set(['2001:db8:0:0::/64']));
	});

	it('keeps different /64 prefixes apart', () => {
		expect(normalizeTrackerIp('2001:db8:0:1::1')).toBe('2001:db8:0:1::/64');
		expect(normalizeTrackerIp('2001:db8:0:2::1')).toBe('2001:db8:0:2::/64');
		expect(normalizeTrackerIp('::1')).toBe('0:0:0:0::/64');
	});

	it('strips a port from an IPv4 literal', () => {
		expect(normalizeTrackerIp('203.0.113.10:51234')).toBe('203.0.113.10');
	});

	it('rejects anything that is not an IP', () => {
		expect(normalizeTrackerIp('evil.example.com')).toBeNull();
		expect(normalizeTrackerIp('')).toBeNull();
		expect(normalizeTrackerIp('   ')).toBeNull();
		expect(normalizeTrackerIp(undefined)).toBeNull();
		expect(normalizeTrackerIp(12345)).toBeNull();
		expect(normalizeTrackerIp('999.999.999.999')).toBeNull();
	});
});
