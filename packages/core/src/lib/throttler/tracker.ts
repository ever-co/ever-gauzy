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
 * Normalises one candidate address to a comparable, genuinely-an-IP string.
 *
 * Rejects anything that is not a valid IPv4/IPv6 literal, so a header carrying a hostname, an empty
 * string or arbitrary junk cannot become a bucket of its own. IPv4-mapped IPv6 (`::ffff:1.2.3.4`)
 * collapses to its IPv4 form so the same client keeps one bucket regardless of the socket family.
 *
 * @param value - A raw address candidate (header value or `req.ip`).
 * @returns The normalised address, or `null` when it is not a usable IP.
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

	if (isIP(withoutPort) === 0) {
		return null;
	}

	// `::ffff:127.0.0.1` and `127.0.0.1` are the same client.
	const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(withoutPort);
	return (mapped ? mapped[1] : withoutPort).toLowerCase();
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
