/**
 * SSRF egress-guard helpers.
 *
 * Pure and dependency-free (uses only the global `URL`), so they are safe to bundle for both the
 * browser and Node. Use these to validate user-supplied outbound URLs (integration webhooks,
 * callbacks, …) BEFORE the server makes a request to them, to prevent Server-Side Request Forgery
 * (CWE-918) against internal services and cloud metadata endpoints.
 *
 * Note: this performs literal host/IP checks only and does NOT resolve DNS. For full protection
 * against DNS-rebinding / hostname-based SSRF, callers on the server should additionally resolve the
 * host and re-check the resolved IP at request time.
 */

const PRIVATE_IPV4_PATTERNS: RegExp[] = [
	/^0\./, // "this" network / 0.0.0.0
	/^10\./, // private (RFC 1918)
	/^127\./, // loopback
	/^169\.254\./, // link-local (incl. cloud metadata 169.254.169.254)
	/^172\.(1[6-9]|2\d|3[0-1])\./, // private (RFC 1918)
	/^192\.168\./, // private (RFC 1918)
	/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./ // CGNAT 100.64.0.0/10
];

/**
 * Whether the given hostname is a loopback / private / link-local host that must not be reachable
 * from a server-side request. Literal check only — does not resolve DNS.
 *
 * @param hostname - The hostname or IP literal to check (e.g. `parsedUrl.hostname`).
 */
export function isPrivateOrLoopbackHost(hostname: string): boolean {
	// Normalize: lowercase, strip IPv6 brackets and a single trailing root dot (`localhost.`).
	const host = (hostname || '')
		.toLowerCase()
		.replace(/^\[/, '')
		.replace(/\]$/, '')
		.replace(/\.$/, '');
	if (!host) return true;

	// Hostnames
	if (host === 'localhost' || host.endsWith('.localhost')) return true;

	// IPv6 literals (contain a colon).
	if (host.includes(':')) {
		if (host === '::1' || host === '::') return true;
		// IPv4-mapped IPv6 in dotted form, e.g. ::ffff:127.0.0.1
		const mappedDotted = host.match(/::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
		if (mappedDotted) return isPrivateIpv4(mappedDotted[1]);
		// IPv4-mapped IPv6 in hex form, e.g. ::ffff:7f00:1
		const mappedHex = host.match(/::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
		if (mappedHex) {
			const high = parseInt(mappedHex[1], 16);
			const low = parseInt(mappedHex[2], 16);
			const ipv4 = `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`;
			return isPrivateIpv4(ipv4);
		}
		// Link-local (fe80::/10) and unique-local (fc00::/7) by inspecting the first hextet.
		const firstHextet = parseInt(host.split(':')[0] || '0', 16);
		if (Number.isFinite(firstHextet)) {
			if ((firstHextet & 0xffc0) === 0xfe80) return true; // fe80::/10
			if ((firstHextet & 0xfe00) === 0xfc00) return true; // fc00::/7
		}
		return false;
	}

	// IPv4 literal
	if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) {
		return isPrivateIpv4(host);
	}
	return false;
}

/** Whether the given dotted-decimal IPv4 string falls in a private/loopback/link-local range. */
function isPrivateIpv4(ip: string): boolean {
	return PRIVATE_IPV4_PATTERNS.some((re) => re.test(ip));
}

/**
 * Returns a human-readable reason string if the given URL is NOT safe to use as a server-side
 * outbound request target (SSRF guard), or `null` if it is considered safe.
 *
 * Rejects: non-HTTPS schemes (unless `allowHttp`), embedded credentials, overly long URLs, and
 * loopback / private / link-local hosts.
 *
 * @param url - The URL to validate.
 * @param options.allowHttp - Allow plain `http:` in addition to `https:` (default `false`).
 */
export function getUnsafeOutboundUrlReason(url: string, options?: { allowHttp?: boolean }): string | null {
	if (typeof url !== 'string' || url.length === 0) return 'URL is required';
	if (url.length > 2048) return 'URL is too long (max 2048 characters)';

	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return 'Invalid URL format';
	}

	const allowHttp = options?.allowHttp === true;
	if (parsed.protocol !== 'https:' && !(allowHttp && parsed.protocol === 'http:')) {
		return 'URL must use HTTPS';
	}
	if (parsed.username || parsed.password) {
		return 'URL must not contain embedded credentials';
	}
	if (isPrivateOrLoopbackHost(parsed.hostname)) {
		return 'URL host is not allowed (loopback, private or link-local address)';
	}
	return null;
}

/**
 * Convenience guard: returns `true` if the URL is safe to use as a server-side outbound target.
 *
 * @param url - The URL to validate.
 * @param options.allowHttp - Allow plain `http:` in addition to `https:` (default `false`).
 */
export function isSafeOutboundUrl(url: string, options?: { allowHttp?: boolean }): boolean {
	return getUnsafeOutboundUrlReason(url, options) === null;
}
