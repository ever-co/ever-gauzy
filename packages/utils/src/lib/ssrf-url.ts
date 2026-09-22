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
	/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // CGNAT 100.64.0.0/10
	// Special-purpose ranges (RFC 6890) that are never legitimate public destinations but do get used
	// for internal networks in practice; benchmarking space in particular is a common cluster CIDR.
	/^192\.0\.0\./, // IETF protocol assignments 192.0.0.0/24
	/^192\.0\.2\./, // documentation TEST-NET-1 192.0.2.0/24
	/^198\.1[89]\./, // benchmarking 198.18.0.0/15
	/^198\.51\.100\./, // documentation TEST-NET-2 198.51.100.0/24
	/^203\.0\.113\./, // documentation TEST-NET-3 203.0.113.0/24
	/^2(2[4-9]|3\d)\./, // multicast 224.0.0.0/4
	/^(24\d|25[0-5])\./ // reserved 240.0.0.0/4, including the limited broadcast address
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
			if ((firstHextet & 0xffc0) === 0xfec0) return true; // fec0::/10 (deprecated site-local)
			if ((firstHextet & 0xfe00) === 0xfc00) return true; // fc00::/7
		}
		// Translation prefixes that carry an IPv4 address inside the IPv6 one. A DNS64/NAT64 gateway or
		// a 6to4 relay turns these into a connection to that IPv4 address, so they are judged by it.
		const groups = expandIpv6(host);
		if (groups) {
			// NAT64 well-known prefix 64:ff9b::/96 (RFC 6052): the IPv4 address is the last 32 bits.
			if (groups[0] === 0x64 && groups[1] === 0xff9b && groups.slice(2, 6).every((h) => h === 0)) {
				return isPrivateIpv4(ipv4FromGroups(groups[6], groups[7]));
			}
			// NAT64 local-use prefix 64:ff9b:1::/48 (RFC 8215): judged by the embedded IPv4 address as well.
			if (groups[0] === 0x64 && groups[1] === 0xff9b && groups[2] === 1) {
				return isPrivateIpv4(ipv4FromGroups(groups[6], groups[7]));
			}
			// Deprecated IPv4-compatible form ::a.b.c.d (RFC 4291 §2.5.5.1): the first 96 bits are zero and
			// the address is the IPv4 one, so `[::7f00:1]` is loopback.
			if (groups.slice(0, 6).every((h) => h === 0)) {
				return isPrivateIpv4(ipv4FromGroups(groups[6], groups[7]));
			}
			// 6to4 2002::/16 (RFC 3056): the IPv4 address is the 32 bits right after the prefix.
			if (groups[0] === 0x2002) {
				return isPrivateIpv4(ipv4FromGroups(groups[1], groups[2]));
			}
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

/** Dotted-decimal IPv4 address from two 16-bit groups. */
function ipv4FromGroups(high: number, low: number): string {
	return `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`;
}

/**
 * Expand an IPv6 literal (brackets already stripped, lower-case) into its eight 16-bit groups.
 *
 * Handles `::` compression and a trailing dotted IPv4 part (`64:ff9b::10.0.0.1`), and drops a zone
 * id (`fe80::1%eth0`). Returns `null` for anything that is not a well-formed IPv6 literal, so a
 * caller only ever acts on a real address.
 *
 * @param host - The IPv6 literal.
 * @returns The eight groups, or `null` when `host` does not parse.
 */
function expandIpv6(host: string): number[] | null {
	let address = host.split('%')[0];

	// A trailing dotted IPv4 part stands for the last two groups.
	const dotted = address.match(/^(.*:)(\d{1,3}(?:\.\d{1,3}){3})$/);
	if (dotted) {
		const octets = dotted[2].split('.').map(Number);
		if (octets.some((octet) => octet > 255)) return null;
		address =
			dotted[1] + ((octets[0] << 8) | octets[1]).toString(16) + ':' + ((octets[2] << 8) | octets[3]).toString(16);
	}

	const halves = address.split('::');
	if (halves.length > 2) return null;
	const parse = (part: string): number[] | null => {
		if (part === '') return [];
		const groups = part.split(':');
		if (groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) return null;
		return groups.map((group) => parseInt(group, 16));
	};
	const head = parse(halves[0]);
	const tail = halves.length === 2 ? parse(halves[1]) : [];
	if (!head || !tail) return null;

	if (halves.length === 1) {
		return head.length === 8 ? head : null;
	}
	const missing = 8 - head.length - tail.length;
	if (missing < 1) return null;
	return [...head, ...new Array<number>(missing).fill(0), ...tail];
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
