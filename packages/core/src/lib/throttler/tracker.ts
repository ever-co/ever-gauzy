import { isIP } from 'node:net';

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
