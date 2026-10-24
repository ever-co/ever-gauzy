import { createHmac, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { environment } from '@gauzy/config';

/**
 * Bucket used when a request cannot be attributed to any address we are willing to trust.
 *
 * Deliberately a CONSTANT: every such request shares one bucket, so an attacker who manages to hide
 * their address is rate-limited harder, not exempted. Returning something request-derived (a random
 * value, or the raw header) would hand out a fresh bucket per request — which is the defect this
 * module exists to close (GHSA-86mw-2crg-vmhc).
 */
export const UNRESOLVED_THROTTLER_TRACKER = 'unresolved-client';

/**
 * How a request is resolved to a rate-limit bucket key.
 */
export interface ThrottlerTrackerOptions {
	/**
	 * Whether `CF-Connecting-IP` may be believed. Only true when the deployment states that every
	 * request reaches this process through Cloudflare, which is the only situation in which the
	 * header is written by something other than the client.
	 */
	readonly trustCloudflareConnectingIp: boolean;

	/**
	 * The secret shared with the Ever Teams server (`EVER_TEAMS_CLIENT_IP_SECRET`), or `null`/absent when
	 * the feature is off. With it, a request that carries a valid, recent proof (see
	 * {@link verifiedForwardedClientIp}) is counted against the browser address the Ever Teams server
	 * forwarded, instead of against the Ever Teams server's own address.
	 */
	readonly clientIpSecret?: string | null;
}

/**
 * Headers the Ever Teams server forwards the browser's address in, on the calls it makes to this API while
 * handling that browser's request (`apps/web/core/services/server/client-ip.ts` in ever-co/ever-teams). The
 * wire format must stay identical on both sides:
 *
 * - `X-Ever-Client-IP`: the address (IPv4 or IPv6)
 * - `X-Ever-Client-IP-Timestamp`: Unix seconds when it was signed
 * - `X-Ever-Client-IP-Signature`: hex HMAC-SHA256 of `<timestamp>.<address>` with the shared secret
 *
 * Node lower-cases incoming header names, hence the spelling here.
 */
export const EVER_CLIENT_IP_HEADER = 'x-ever-client-ip';
export const EVER_CLIENT_IP_TIMESTAMP_HEADER = 'x-ever-client-ip-timestamp';
export const EVER_CLIENT_IP_SIGNATURE_HEADER = 'x-ever-client-ip-signature';

/** How far (seconds, either way) a proof's timestamp may be from this server's clock. */
export const EVER_CLIENT_IP_MAX_SKEW_SECONDS = 300;

/** The shortest `EVER_TEAMS_CLIENT_IP_SECRET` accepted; a shorter one switches the feature off, as in Ever Teams. */
export const EVER_CLIENT_IP_MIN_SECRET_LENGTH = 32;

/**
 * The shared client-IP secret, or `null` when the feature is off: unset, blank, or shorter than
 * {@link EVER_CLIENT_IP_MIN_SECRET_LENGTH} characters (too short to be a real secret). Trimmed, like the
 * Ever Teams side does, so both sides sign with the same bytes.
 *
 * @param value - The configured value (`EVER_TEAMS_CLIENT_IP_SECRET`).
 * @returns The secret to verify proofs with, or `null`.
 */
export function clientIpSecretOf(value: unknown): string | null {
	const secret = typeof value === 'string' ? value.trim() : '';
	return secret.length >= EVER_CLIENT_IP_MIN_SECRET_LENGTH ? secret : null;
}

/**
 * The deployment's tracker options, read from the environment at call time: every per-client count (the
 * route throttler, the per-account sign-in control, the address recorded in an access token) resolves
 * the client through these, so they always agree on who the client is.
 *
 * @returns The options for {@link resolveThrottlerTracker}.
 */
export function throttlerTrackerOptions(): ThrottlerTrackerOptions {
	return {
		trustCloudflareConnectingIp: environment.THROTTLE_TRUST_CF_CONNECTING_IP === true,
		clientIpSecret: clientIpSecretOf(environment.EVER_TEAMS_CLIENT_IP_SECRET)
	};
}

/**
 * One header's value, only as a non-empty string. An array is refused; a header sent twice reaches us joined
 * with `, ` and then fails the checks of {@link verifiedForwardedClientIp}.
 */
function singleHeader(headers: Record<string, unknown> | undefined, name: string): string | null {
	const value = headers?.[name];
	return typeof value === 'string' && value ? value : null;
}

/**
 * The browser address the Ever Teams server forwarded, when its proof verifies.
 *
 * All of these must hold, otherwise the headers are ignored (never an error: the request is then counted
 * by the address this API sees, exactly as without the headers):
 * - the secret is configured ({@link clientIpSecretOf});
 * - each of the three headers arrived exactly once;
 * - the address is an IP literal (`net.isIP`);
 * - the timestamp is whole Unix seconds within {@link EVER_CLIENT_IP_MAX_SKEW_SECONDS} of now;
 * - the signature is the hex HMAC-SHA256 of `<timestamp>.<address>` under the secret, compared in
 *   constant time (`crypto.timingSafeEqual`, on equal-length buffers).
 *
 * The proof binds the address to a moment, not to one request: anyone who can read the Ever Teams server's
 * calls to this API could replay a header set for five minutes. That only moves the replayer into the
 * bucket of the address it names; it grants no access.
 *
 * @param req - The incoming request (only its headers are read).
 * @param secret - The shared secret (`EVER_TEAMS_CLIENT_IP_SECRET`).
 * @param nowSeconds - The current Unix time in seconds (for tests).
 * @returns The forwarded address exactly as sent, or `null`.
 */
export function verifiedForwardedClientIp(
	req: Record<string, any> | undefined,
	secret: unknown,
	nowSeconds: number = Math.floor(Date.now() / 1000)
): string | null {
	const key = clientIpSecretOf(secret);

	if (!key) {
		return null;
	}

	const headers = req?.headers;
	const ip = singleHeader(headers, EVER_CLIENT_IP_HEADER);
	const timestamp = singleHeader(headers, EVER_CLIENT_IP_TIMESTAMP_HEADER);
	const signature = singleHeader(headers, EVER_CLIENT_IP_SIGNATURE_HEADER);

	if (!ip || !timestamp || !signature || isIP(ip) === 0) {
		return null;
	}

	if (!/^\d{1,12}$/.test(timestamp) || Math.abs(nowSeconds - Number(timestamp)) > EVER_CLIENT_IP_MAX_SKEW_SECONDS) {
		return null;
	}

	// 32 bytes as hex. Anything else is refused here, since `Buffer.from(…, 'hex')` silently drops junk.
	if (!/^[0-9a-f]{64}$/i.test(signature)) {
		return null;
	}

	const expected = createHmac('sha256', key).update(`${timestamp}.${ip}`).digest();
	const provided = Buffer.from(signature, 'hex');

	if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
		return null;
	}

	return ip;
}

/**
 * Prefix an IPv6 client is bucketed by, as a count of leading 16-bit groups (4 groups = a /64).
 *
 * A single IPv6 subscriber is routinely delegated a whole /64 (2^64 addresses) and may pick any
 * source address inside it, so an exact-address bucket is a fresh bucket per request for anyone on
 * IPv6 — the same bucket-rotation defect GHSA-86mw-2crg-vmhc describes, just without a header.
 * Aggregating by /64 is the conventional unit for per-client IPv6 rate limiting.
 */
export const IPV6_TRACKER_PREFIX_GROUPS = 4;

/**
 * Expands a valid IPv6 literal into its eight 16-bit groups.
 *
 * Handles `::` compression and a trailing dotted-quad (`::ffff:1.2.3.4`, `64:ff9b::1.2.3.4`), so every
 * textual spelling of one address yields the same groups.
 *
 * @param address - An address for which `isIP()` returned 6, with any zone id already removed.
 * @returns The eight groups as numbers, or `null` if the literal cannot be expanded.
 */
function expandIPv6(address: string): number[] | null {
	let text = address;
	const tail: number[] = [];

	const dotted = /^(.*:)(\d{1,3}(?:\.\d{1,3}){3})$/.exec(text);
	if (dotted) {
		const octets = dotted[2].split('.').map(Number);
		tail.push((octets[0] << 8) | octets[1], (octets[2] << 8) | octets[3]);
		text = dotted[1].endsWith('::') ? dotted[1] : dotted[1].slice(0, -1);
	}

	const [head, rest] = text.split('::');
	const parse = (part: string | undefined) =>
		part ? part.split(':').map((group) => Number.parseInt(group, 16)) : [];
	const left = parse(head);
	const right = rest === undefined ? [] : parse(rest);
	const missing = 8 - tail.length - left.length - right.length;

	if (missing < 0 || (rest === undefined && missing !== 0)) {
		return null;
	}

	const groups = [...left, ...new Array(rest === undefined ? 0 : missing).fill(0), ...right, ...tail];
	return groups.length === 8 && groups.every((group) => Number.isInteger(group) && group >= 0 && group <= 0xffff)
		? groups
		: null;
}

/**
 * Normalises one candidate address to a comparable, genuinely-an-IP bucket string.
 *
 * Rejects anything that is not a valid IPv4/IPv6 literal, so a header carrying a hostname, an empty
 * string or arbitrary junk cannot become a bucket of its own. IPv4-mapped IPv6 — in either the
 * dotted (`::ffff:1.2.3.4`) or the hex (`::ffff:102:304`) spelling — collapses to its IPv4 form so the
 * same client keeps one bucket regardless of the socket family. Any other IPv6 address is reduced to
 * its canonical /64 prefix (see {@link IPV6_TRACKER_PREFIX_GROUPS}), which also makes equivalent
 * spellings (`2001:DB8::1`, `2001:db8:0:0::1`) land in one bucket.
 *
 * @param value - A raw address candidate (header value or `req.ip`).
 * @returns The normalised bucket string, or `null` when it is not a usable IP.
 */
export function normalizeTrackerIp(value: unknown): string | null {
	if (typeof value !== 'string') {
		return null;
	}

	// A forwarding header may legitimately carry a comma-separated chain; the first entry is the
	// one Cloudflare writes. Everything after it is untrusted regardless.
	const candidate = value.split(',')[0].trim();

	if (!candidate) {
		return null;
	}

	// Strip a bracketed IPv6 literal and any :port suffix on an IPv4 address.
	const unbracketed = candidate.startsWith('[') ? candidate.slice(1).split(']')[0] : candidate;
	const withoutPort =
		isIP(unbracketed) === 0 && unbracketed.split(':').length === 2 ? unbracketed.split(':')[0] : unbracketed;

	const family = isIP(withoutPort);

	if (family === 4) {
		return withoutPort;
	}

	if (family !== 6) {
		return null;
	}

	// A zone id (`fe80::1%eth0`) names a local interface, not a different client.
	const groups = expandIPv6(withoutPort.split('%')[0]);

	if (!groups) {
		return null;
	}

	// `::ffff:127.0.0.1` and `127.0.0.1` are the same client.
	if (groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff) {
		return [groups[6] >> 8, groups[6] & 0xff, groups[7] >> 8, groups[7] & 0xff].join('.');
	}

	const prefix = groups
		.slice(0, IPV6_TRACKER_PREFIX_GROUPS)
		.map((group) => group.toString(16))
		.join(':');
	return `${prefix}::/${IPV6_TRACKER_PREFIX_GROUPS * 16}`;
}

/**
 * Resolves the rate-limit bucket key for a request.
 *
 * The previous implementation read `CF-Connecting-IP` unconditionally and otherwise used
 * `req.ips[0]` — the LEFTMOST `X-Forwarded-For` entry, i.e. the value the client itself appended.
 * Both are client-writable on every deployment shape this repository ships, so varying either one
 * per request produced a fresh bucket per request and defeated the login throttle entirely.
 *
 * What this does instead:
 * - A browser address forwarded by the Ever Teams server is used when its HMAC proof verifies (only
 *   with `EVER_TEAMS_CLIENT_IP_SECRET` set, see {@link verifiedForwardedClientIp}). Every call that
 *   server makes reaches this API from the server's own address (behind Cloudflare: its
 *   `CF-Connecting-IP`), so without it all Ever Teams users share one bucket.
 * - `CF-Connecting-IP` is consulted ONLY when the deployment declares it is behind Cloudflare.
 * - Otherwise the bucket is `req.ip`, which Express derives from the socket address and the
 *   `trust proxy` setting, so it is only as forgeable as the operator's configured hop count.
 * - Anything that does not parse as an IP falls back to a single shared bucket rather than
 *   becoming a bucket of its own.
 *
 * @param req - The incoming request (headers + Express-resolved `ip`).
 * @param options - Deployment-level trust settings.
 * @returns The bucket key for this request.
 */
export function resolveThrottlerTracker(req: Record<string, any>, options: ThrottlerTrackerOptions): string {
	if (options.clientIpSecret) {
		const forwardedIp = normalizeTrackerIp(verifiedForwardedClientIp(req, options.clientIpSecret));

		if (forwardedIp) {
			return forwardedIp;
		}
	}

	if (options.trustCloudflareConnectingIp) {
		const header = req?.headers?.['cf-connecting-ip'];
		// Node collapses repeated headers of this kind into one comma-separated string, but be
		// defensive: an array here must not stringify into something that looks like a new bucket.
		const cloudflareIp = normalizeTrackerIp(Array.isArray(header) ? header[0] : header);

		if (cloudflareIp) {
			return cloudflareIp;
		}
	}

	return normalizeTrackerIp(req?.ip) ?? UNRESOLVED_THROTTLER_TRACKER;
}
