import { createHmac } from 'node:crypto';
import { environment } from '@gauzy/config';
import {
	clientIpSecretOf,
	EVER_CLIENT_IP_HEADER,
	EVER_CLIENT_IP_SIGNATURE_HEADER,
	EVER_CLIENT_IP_TIMESTAMP_HEADER,
	normalizeTrackerIp,
	resolveThrottlerTracker,
	throttlerTrackerOptions,
	UNRESOLVED_THROTTLER_TRACKER,
	verifiedForwardedClientIp
} from './tracker';

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

/**
 * Owner decision 16 (Ever Teams rate limiting): the Ever Teams server makes every call to this API for its
 * users, so without help all of them reach the API from ONE address and share every per-address limit.
 * With `EVER_TEAMS_CLIENT_IP_SECRET` set on both sides it forwards the browser's address with an HMAC proof
 * (ever-co/ever-teams `apps/web/core/services/server/client-ip.ts`). The property under test: the
 * forwarded address is believed only with a valid, recent proof. Anything else is ignored, never minted
 * into a bucket of its own, and never turned into an error.
 */
describe('verifiedForwardedClientIp (address forwarded by Ever Teams)', () => {
	const SECRET = 'spec-secret-0123456789abcdef-0123456789';
	const NOW = 1761300000;

	/** The three headers exactly as the Ever Teams side builds them (`signClientIp`). */
	const proof = (ip: string, timestamp: number | string = NOW, secret = SECRET) => ({
		[EVER_CLIENT_IP_HEADER]: ip,
		[EVER_CLIENT_IP_TIMESTAMP_HEADER]: String(timestamp),
		[EVER_CLIENT_IP_SIGNATURE_HEADER]: createHmac('sha256', secret).update(`${timestamp}.${ip}`).digest('hex')
	});

	it('pins the wire format with a fixed vector (hex HMAC-SHA256 of "<timestamp>.<ip>")', () => {
		const headers = {
			'x-ever-client-ip': '203.0.113.10',
			'x-ever-client-ip-timestamp': '1761300000',
			'x-ever-client-ip-signature': 'cc41074a2ae2a863b3e6fee83dd744b5605c5203ed68609c65b4a60d412bab11'
		};

		expect(verifiedForwardedClientIp({ headers }, SECRET, NOW)).toBe('203.0.113.10');
	});

	it('accepts IPv4 and IPv6 addresses signed up to 300 seconds either side of now', () => {
		expect(verifiedForwardedClientIp({ headers: proof('198.51.100.7') }, SECRET, NOW)).toBe('198.51.100.7');
		expect(verifiedForwardedClientIp({ headers: proof('2001:db8::1') }, SECRET, NOW)).toBe('2001:db8::1');
		expect(verifiedForwardedClientIp({ headers: proof('198.51.100.7', NOW - 300) }, SECRET, NOW)).toBe(
			'198.51.100.7'
		);
		expect(verifiedForwardedClientIp({ headers: proof('198.51.100.7', NOW + 300) }, SECRET, NOW)).toBe(
			'198.51.100.7'
		);
	});

	it('refuses a proof signed more than 300 seconds away from now', () => {
		expect(verifiedForwardedClientIp({ headers: proof('198.51.100.7', NOW - 301) }, SECRET, NOW)).toBeNull();
		expect(verifiedForwardedClientIp({ headers: proof('198.51.100.7', NOW + 301) }, SECRET, NOW)).toBeNull();
	});

	it('refuses a signature made with another secret, or over another address or timestamp', () => {
		const otherSecret = proof('198.51.100.7', NOW, 'another-secret-0123456789abcdef-0123456');
		const signedForOther = { ...proof('198.51.100.8'), [EVER_CLIENT_IP_HEADER]: '198.51.100.7' };
		const otherMoment = { ...proof('198.51.100.7'), [EVER_CLIENT_IP_TIMESTAMP_HEADER]: String(NOW - 1) };

		expect(verifiedForwardedClientIp({ headers: otherSecret }, SECRET, NOW)).toBeNull();
		expect(verifiedForwardedClientIp({ headers: signedForOther }, SECRET, NOW)).toBeNull();
		expect(verifiedForwardedClientIp({ headers: otherMoment }, SECRET, NOW)).toBeNull();
	});

	it('refuses a malformed signature without comparing it', () => {
		const valid = proof('198.51.100.7');
		const signature = valid[EVER_CLIENT_IP_SIGNATURE_HEADER];

		for (const malformed of ['', 'zz', signature.slice(0, 62), `${signature}00`, `${signature.slice(0, 62)}zz`]) {
			const headers = { ...valid, [EVER_CLIENT_IP_SIGNATURE_HEADER]: malformed };

			expect(verifiedForwardedClientIp({ headers }, SECRET, NOW)).toBeNull();
		}
	});

	it('refuses an address that is not an IP, a non-numeric timestamp, or a missing or repeated header', () => {
		const valid = proof('198.51.100.7');
		const without = (name: string) => {
			const headers: Record<string, unknown> = { ...valid };
			delete headers[name];
			return { headers };
		};

		expect(verifiedForwardedClientIp({ headers: proof('evil.example.com') }, SECRET, NOW)).toBeNull();
		expect(verifiedForwardedClientIp({ headers: proof('198.51.100.7, 198.51.100.8') }, SECRET, NOW)).toBeNull();
		expect(verifiedForwardedClientIp({ headers: proof('198.51.100.7', `${NOW}.5`) }, SECRET, NOW)).toBeNull();
		expect(verifiedForwardedClientIp({ headers: proof('198.51.100.7', `-${NOW}`) }, SECRET, NOW)).toBeNull();
		expect(
			verifiedForwardedClientIp({ headers: { ...valid, [EVER_CLIENT_IP_HEADER]: ['198.51.100.7'] } }, SECRET, NOW)
		).toBeNull();
		for (const name of [EVER_CLIENT_IP_HEADER, EVER_CLIENT_IP_TIMESTAMP_HEADER, EVER_CLIENT_IP_SIGNATURE_HEADER]) {
			expect(verifiedForwardedClientIp(without(name), SECRET, NOW)).toBeNull();
		}
		expect(verifiedForwardedClientIp({}, SECRET, NOW)).toBeNull();
		expect(verifiedForwardedClientIp(undefined, SECRET, NOW)).toBeNull();
	});

	it('ignores the headers entirely while the secret is unset, blank or shorter than 32 characters', () => {
		const short = 'x'.repeat(31);

		expect(verifiedForwardedClientIp({ headers: proof('198.51.100.7', NOW, short) }, short, NOW)).toBeNull();
		expect(verifiedForwardedClientIp({ headers: proof('198.51.100.7') }, undefined, NOW)).toBeNull();
		expect(verifiedForwardedClientIp({ headers: proof('198.51.100.7') }, null, NOW)).toBeNull();
		expect(verifiedForwardedClientIp({ headers: proof('198.51.100.7') }, '   ', NOW)).toBeNull();
	});

	it('trims the secret the way the Ever Teams side does', () => {
		expect(verifiedForwardedClientIp({ headers: proof('198.51.100.7') }, ` ${SECRET}\n`, NOW)).toBe(
			'198.51.100.7'
		);
	});
});

describe('clientIpSecretOf', () => {
	it('switches the feature off for an unset, blank or short secret', () => {
		expect(clientIpSecretOf(undefined)).toBeNull();
		expect(clientIpSecretOf('')).toBeNull();
		expect(clientIpSecretOf(' '.repeat(40))).toBeNull();
		expect(clientIpSecretOf('x'.repeat(31))).toBeNull();
		expect(clientIpSecretOf(42)).toBeNull();
	});

	it('returns the trimmed secret from 32 characters on', () => {
		expect(clientIpSecretOf('x'.repeat(32))).toBe('x'.repeat(32));
		expect(clientIpSecretOf(`  ${'y'.repeat(40)}  `)).toBe('y'.repeat(40));
	});
});

describe('resolveThrottlerTracker with the address forwarded by Ever Teams', () => {
	const SECRET = 'spec-secret-0123456789abcdef-0123456789';
	const TEAMS_SERVER = '203.0.113.50';
	const withSecret = { trustCloudflareConnectingIp: false, clientIpSecret: SECRET };
	const behindCloudflareWithSecret = { trustCloudflareConnectingIp: true, clientIpSecret: SECRET };

	/** A call of the Ever Teams server for the browser at `browserIp`, signed now with `secret`. */
	const fromTeams = (browserIp: string, secret = SECRET, extraHeaders: Record<string, unknown> = {}) => {
		const timestamp = Math.floor(Date.now() / 1000);
		const signature = createHmac('sha256', secret).update(`${timestamp}.${browserIp}`).digest('hex');

		return {
			ip: TEAMS_SERVER,
			headers: {
				...extraHeaders,
				[EVER_CLIENT_IP_HEADER]: browserIp,
				[EVER_CLIENT_IP_TIMESTAMP_HEADER]: String(timestamp),
				[EVER_CLIENT_IP_SIGNATURE_HEADER]: signature
			}
		};
	};

	it('counts two browsers behind the one Ever Teams server in two buckets', () => {
		expect(resolveThrottlerTracker(fromTeams('198.51.100.1'), withSecret)).toBe('198.51.100.1');
		expect(resolveThrottlerTracker(fromTeams('198.51.100.2'), withSecret)).toBe('198.51.100.2');
	});

	it('prefers the verified forwarded address over CF-Connecting-IP, which names the Ever Teams server', () => {
		const req = fromTeams('198.51.100.1', SECRET, { 'cf-connecting-ip': TEAMS_SERVER });

		expect(resolveThrottlerTracker(req, behindCloudflareWithSecret)).toBe('198.51.100.1');
	});

	it('normalises the forwarded address like any other (IPv6 by /64, IPv4-mapped to IPv4)', () => {
		expect(resolveThrottlerTracker(fromTeams('2001:db8::1'), withSecret)).toBe('2001:db8:0:0::/64');
		expect(resolveThrottlerTracker(fromTeams('::ffff:198.51.100.1'), withSecret)).toBe('198.51.100.1');
	});

	it('falls back to the normal client address when the proof does not verify', () => {
		const forged = fromTeams('198.51.100.1', 'another-secret-0123456789abcdef-0123456', {
			'cf-connecting-ip': '192.0.2.9'
		});

		expect(resolveThrottlerTracker(forged, withSecret)).toBe(TEAMS_SERVER);
		expect(resolveThrottlerTracker(forged, behindCloudflareWithSecret)).toBe('192.0.2.9');
	});

	it('cannot be used to mint a bucket per request without the secret', () => {
		const buckets = new Set<string>();

		for (let attempt = 0; attempt < 25; attempt++) {
			const guess = `attacker-guess-${attempt}-0123456789abcdef-0123`;

			buckets.add(resolveThrottlerTracker(fromTeams(`198.51.100.${attempt}`, guess), withSecret));
		}

		expect(buckets).toEqual(new Set([TEAMS_SERVER]));
	});

	it('ignores even a valid proof while the feature is off', () => {
		const req = fromTeams('198.51.100.1');

		expect(resolveThrottlerTracker(req, { trustCloudflareConnectingIp: false })).toBe(TEAMS_SERVER);
		expect(resolveThrottlerTracker(req, { trustCloudflareConnectingIp: false, clientIpSecret: null })).toBe(
			TEAMS_SERVER
		);
	});
});

describe('throttlerTrackerOptions', () => {
	const originalTrustCf = environment.THROTTLE_TRUST_CF_CONNECTING_IP;
	const originalSecret = environment.EVER_TEAMS_CLIENT_IP_SECRET;

	afterEach(() => {
		environment.THROTTLE_TRUST_CF_CONNECTING_IP = originalTrustCf;
		environment.EVER_TEAMS_CLIENT_IP_SECRET = originalSecret;
	});

	it('reads the deployment settings at call time', () => {
		environment.THROTTLE_TRUST_CF_CONNECTING_IP = true;
		environment.EVER_TEAMS_CLIENT_IP_SECRET = ` ${'s'.repeat(32)} `;
		expect(throttlerTrackerOptions()).toEqual({
			trustCloudflareConnectingIp: true,
			clientIpSecret: 's'.repeat(32)
		});

		environment.THROTTLE_TRUST_CF_CONNECTING_IP = false;
		environment.EVER_TEAMS_CLIENT_IP_SECRET = 'too-short';
		expect(throttlerTrackerOptions()).toEqual({ trustCloudflareConnectingIp: false, clientIpSecret: null });

		environment.EVER_TEAMS_CLIENT_IP_SECRET = undefined;
		expect(throttlerTrackerOptions()).toEqual({ trustCloudflareConnectingIp: false, clientIpSecret: null });
	});
});
