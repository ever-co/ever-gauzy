// cspell:ignore localdomain
import { BlockList, isIP } from 'node:net';

/**
 * Which addresses and host names an outbound request of the chat plugin may reach: public ones only.
 *
 * The server makes such a request for someone else's input (a link a person posted, a callback an integration named),
 * so it must never reach what only the server can reach: loopback, the private networks, link-local addresses (the cloud metadata
 * service at 169.254.169.254 among them), the carrier-grade NAT range, and the special-purpose ranges of IPv4 and IPv6
 * that are never a public web site. IPv6 is judged as strictly: only global unicast (`2000::/3`) outside its
 * special-purpose blocks passes, and an IPv6 address that carries an IPv4 one (IPv4-mapped, NAT64, 6to4) is judged by
 * that IPv4 address, since a gateway turns it into a connection there.
 *
 * Not the platform's `isPrivateOrLoopbackHost` (`@gauzy/utils`): that one judges a URL literal before any lookup and
 * lets through multicast, documentation, Teredo and the full spellings of an IPv4-mapped address. This one judges every
 * address a host resolves to, so it refuses everything it does not know to be public.
 */

/** The IPv4 ranges that are not public (IANA special-purpose registry). */
const IPV4_NOT_PUBLIC: ReadonlyArray<[string, number]> = [
	['0.0.0.0', 8], // "this" network
	['10.0.0.0', 8], // private
	['100.64.0.0', 10], // shared address space (carrier-grade NAT; one cloud's metadata service is in it)
	['127.0.0.0', 8], // loopback
	['169.254.0.0', 16], // link-local: the cloud metadata service 169.254.169.254
	['172.16.0.0', 12], // private
	['192.0.0.0', 24], // IETF protocol assignments
	['192.0.2.0', 24], // documentation
	['192.88.99.0', 24], // 6to4 relay anycast (deprecated)
	['192.168.0.0', 16], // private
	['198.18.0.0', 15], // benchmarking (a common cluster range in practice)
	['198.51.100.0', 24], // documentation
	['203.0.113.0', 24], // documentation
	['224.0.0.0', 4], // multicast
	['240.0.0.0', 4] // reserved, the limited broadcast address included
];

const IPV4_BLOCKS = new BlockList();
for (const [network, prefix] of IPV4_NOT_PUBLIC) {
	IPV4_BLOCKS.addSubnet(network, prefix, 'ipv4');
}

/**
 * Whether an IP address (no brackets) is a public unicast address an outbound request may connect to. Anything that is not a
 * well-formed address, and any address with a zone id (`fe80::1%eth0`), is not.
 */
export function isPublicAddress(address: string): boolean {
	const ip = String(address ?? '').trim();
	if (!ip || ip.includes('%')) return false;
	const version = isIP(ip);
	if (version === 4) return !IPV4_BLOCKS.check(ip, 'ipv4');
	if (version !== 6) return false;
	const groups = expandIpv6(ip.toLowerCase());
	if (!groups) return false;
	const [g0, g1, g2, g3, g4, g5, g6, g7] = groups;
	// IPv4-mapped `::ffff:a.b.c.d`: a connection to the IPv4 address.
	if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0xffff) {
		return isPublicAddress(ipv4Of(g6, g7));
	}
	// NAT64 well-known prefix `64:ff9b::/96`: a DNS64 network's way to a public IPv4 site, judged by that address.
	if (g0 === 0x64 && g1 === 0xff9b && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) {
		return isPublicAddress(ipv4Of(g6, g7));
	}
	// 6to4 `2002::/16`: the IPv4 address follows the prefix.
	if (g0 === 0x2002) {
		return isPublicAddress(ipv4Of(g1, g2));
	}
	// Everything else must be global unicast (`2000::/3`): this leaves out `::`, `::1`, the IPv4-compatible and
	// IPv4-translated forms, the NAT64 local-use prefix, discard-only `100::/64`, unique-local `fc00::/7` (one cloud's
	// IPv6 metadata service is in it), link-local `fe80::/10`, site-local `fec0::/10` and multicast `ff00::/8`.
	if ((g0 & 0xe000) !== 0x2000) return false;
	// IETF protocol assignments `2001::/23` (Teredo, benchmarking, ORCHID among them) and documentation `2001:db8::/32`.
	if (g0 === 0x2001 && (g1 <= 0x01ff || g1 === 0x0db8)) return false;
	// Documentation `3fff::/20`.
	if (g0 === 0x3fff && (g1 & 0xf000) === 0) return false;
	return true;
}

/**
 * The host names that never name a public site: `localhost`, a single label (an intranet name, a cluster's service
 * name) and the special-use or internal-only suffixes. Judged before any lookup, so such a name is never even resolved.
 */
const REFUSED_SUFFIXES = [
	'localhost',
	'local',
	'localdomain',
	'internal',
	'intranet',
	'private',
	'lan',
	'home',
	'corp',
	'svc',
	'home.arpa',
	'arpa',
	'test',
	'example',
	'invalid',
	'onion'
];

/** Whether a URL's host name (lower case, IPv6 in brackets or not) is one an outbound request never reaches by name. */
export function isRefusedHostname(hostname: string): boolean {
	const host = String(hostname ?? '')
		.trim()
		.toLowerCase()
		.replace(/^\[|\]$/g, '')
		.replace(/\.$/, '');
	if (!host) return true;
	// An address literal is judged by `isPublicAddress`, not by name.
	if (isIP(host)) return false;
	if (!host.includes('.')) return true;
	return REFUSED_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

/** The dotted IPv4 address two 16-bit groups hold. */
function ipv4Of(high: number, low: number): string {
	return `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`;
}

/**
 * The eight 16-bit groups of an IPv6 address (lower case, no brackets, no zone): `::` expanded, a trailing dotted IPv4
 * part (`::ffff:10.0.0.1`) read as the last two groups. `null` for anything that does not parse.
 */
export function expandIpv6(address: string): number[] | null {
	let text = address;
	const dotted = /^(.*:)(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(text);
	if (dotted) {
		const octets = dotted.slice(2, 6).map(Number);
		if (octets.some((octet) => octet > 255)) return null;
		text = `${dotted[1]}${((octets[0] << 8) | octets[1]).toString(16)}:${((octets[2] << 8) | octets[3]).toString(16)}`;
	}
	const halves = text.split('::');
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
	if (halves.length === 1) return head.length === 8 ? head : null;
	const missing = 8 - head.length - tail.length;
	if (missing < 1) return null;
	return [...head, ...new Array<number>(missing).fill(0), ...tail];
}
