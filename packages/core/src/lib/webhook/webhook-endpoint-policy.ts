import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * Which addresses the platform may post a webhook to.
 *
 * **An endpoint is a URL a tenant supplies and the platform then fetches.** Without a rule about
 * *where* it may point, a tenant user who may create a subscription can make the API issue requests
 * from inside the cluster to anywhere the cluster can reach — the cloud metadata service on
 * `169.254.169.254`, a Redis or Postgres admin port on the pod network, a service mesh's control
 * plane — and then read up to four kilobytes of each response back out through the delivery log,
 * which is a read API the same user already has. That is a full server-side request forgery with an
 * exfiltration channel attached, and the only thing that stood in its way was a check that the
 * scheme was `https:`.
 *
 * The rule here is a deny list of address ranges rather than an allow list of hosts, because an
 * allow list is not something an installation can maintain for its own partners. Everything that is
 * not globally routable is refused:
 *
 * - loopback, link-local (including the metadata address), private and carrier-grade-NAT ranges;
 * - the IPv6 equivalents, plus the unique-local and the documentation ranges, and the two
 *   transitional encodings — IPv4-mapped and 6to4 — that carry an IPv4 address inside an IPv6 one
 *   and would otherwise smuggle `127.0.0.1` past a check that only read the outer form;
 * - multicast, broadcast and the reserved space above `240.0.0.0`;
 * - a single-label hostname such as `vault` or `consul`, which can only resolve inside the cluster's
 *   own search domain, and the special-use suffixes `.local`, `.internal`, `.localhost`, `.home.arpa`
 *   and `.onion`.
 *
 * **The check runs twice, and the second time is the one that matters.** A hostname is refused at
 * creation when it is already a literal address in a refused range, which is the common mistake and
 * is worth a clear error at the moment it is made. But a hostname can resolve anywhere, and can
 * resolve somewhere different a minute later — so the endpoint is resolved again immediately before
 * each attempt, and an attempt whose host resolves into a refused range is refused there too. That
 * is what closes the rebinding case, where a name answers a public address while the subscription is
 * created and a private one when the delivery is made.
 *
 * **It can be turned off, deliberately and in one place.** An installation that genuinely posts to
 * an endpoint on its own network sets `GAUZY_WEBHOOK_ALLOW_PRIVATE_NETWORK=true`. It is off unless
 * stated, because the safe default has to be the one an installation gets without knowing this
 * document exists.
 */

/** The special-use suffixes a globally routable endpoint never carries. */
const REFUSED_SUFFIXES: readonly string[] = ['.local', '.localhost', '.internal', '.home.arpa', '.onion'];

/** Hostnames that name this machine however they are spelled. */
const REFUSED_HOSTS: readonly string[] = ['localhost', 'ip6-localhost', 'ip6-loopback'];

/**
 * Whether this installation has opted out of the rule.
 *
 * Read per call rather than captured at import, so a test can state it and so a deployment that
 * changes it does not need a different build.
 *
 * @returns True when the deny list is disabled.
 */
export function allowsPrivateNetworkEndpoints(): boolean {
	return process.env.GAUZY_WEBHOOK_ALLOW_PRIVATE_NETWORK === 'true';
}

/**
 * Reads the four octets of an IPv4 address.
 *
 * @param address The address text.
 * @returns The octets, or undefined when the text is not an IPv4 address.
 */
function octetsOf(address: string): number[] | undefined {
	if (isIP(address) !== 4) {
		return undefined;
	}

	const octets = address.split('.').map((part) => Number(part));

	return octets.length === 4 && octets.every((octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255)
		? octets
		: undefined;
}

/**
 * Whether an IPv4 address is outside the globally routable space.
 *
 * @param address The address text.
 * @returns True when the platform must not post to it.
 */
function isRefusedIPv4(address: string): boolean {
	const octets = octetsOf(address);

	if (!octets) {
		return false;
	}

	const [a, b] = octets;

	return (
		a === 0 || // "this network"
		a === 10 || // private
		a === 127 || // loopback
		(a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
		(a === 169 && b === 254) || // link-local, and the cloud metadata address with it
		(a === 172 && b >= 16 && b <= 31) || // private
		(a === 192 && b === 0) || // IETF protocol assignments and TEST-NET-1
		(a === 192 && b === 88) || // 6to4 relay anycast
		(a === 192 && b === 168) || // private
		(a === 198 && (b === 18 || b === 19)) || // benchmarking
		(a === 198 && b === 51) || // TEST-NET-2
		(a === 203 && b === 0) || // TEST-NET-3
		a >= 224 // multicast, reserved, and the broadcast address
	);
}

/**
 * Whether an IPv6 address is outside the globally routable space.
 *
 * The two transitional encodings are unwrapped first: `::ffff:127.0.0.1` and `2002:7f00:1::` both
 * carry an IPv4 address that a check reading only the outer form would wave through.
 *
 * @param address The address text.
 * @returns True when the platform must not post to it.
 */
function isRefusedIPv6(address: string): boolean {
	if (isIP(address) !== 6) {
		return false;
	}

	const normalized = address.toLowerCase().replace(/^\[|\]$/g, '').split('%')[0];

	if (normalized === '::' || normalized === '::1') {
		return true;
	}

	// IPv4-mapped and IPv4-compatible: `::ffff:a.b.c.d` and `::a.b.c.d`.
	const mapped = /^::(ffff:)?(\d{1,3}(?:\.\d{1,3}){3})$/.exec(normalized);

	if (mapped) {
		return isRefusedIPv4(mapped[2]);
	}

	// 6to4: `2002:<hex><hex>:...` embeds the IPv4 address in the two groups after the prefix.
	const sixToFour = /^2002:([0-9a-f]{1,4}):([0-9a-f]{1,4})[:.]/.exec(normalized);

	if (sixToFour) {
		const high = Number.parseInt(sixToFour[1].padStart(4, '0'), 16);
		const low = Number.parseInt(sixToFour[2].padStart(4, '0'), 16);

		return isRefusedIPv4(`${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`);
	}

	const head = Number.parseInt(normalized.split(':')[0] || '0', 16);

	return (
		(head & 0xfe00) === 0xfc00 || // unique local, fc00::/7
		(head & 0xffc0) === 0xfe80 || // link local, fe80::/10
		(head & 0xff00) === 0xff00 || // multicast, ff00::/8
		normalized.startsWith('2001:db8:') || // documentation
		normalized.startsWith('64:ff9b:') // NAT64
	);
}

/**
 * Whether a literal address is one the platform must not post to.
 *
 * @param address The address text, without brackets.
 * @returns True when it is outside the globally routable space.
 */
export function isRefusedAddress(address: string): boolean {
	return isRefusedIPv4(address) || isRefusedIPv6(address);
}

/**
 * Why an endpoint was refused, or undefined when it is allowed.
 *
 * The reason names what was wrong without naming what would have been right: an operator fixing
 * their own URL has enough, and a caller probing the platform's network learns nothing it did not
 * already supply.
 *
 * @param url The endpoint.
 * @returns The reason, or undefined.
 */
export function refusalForEndpointHost(url: URL): string | undefined {
	if (allowsPrivateNetworkEndpoints()) {
		return undefined;
	}

	const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');

	if (!host) {
		return 'A webhook endpoint must name a host.';
	}

	if (REFUSED_HOSTS.includes(host) || REFUSED_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
		return 'A webhook endpoint must name a publicly resolvable host.';
	}

	if (isIP(host)) {
		return isRefusedAddress(host)
			? 'A webhook endpoint must not address a private, loopback or link-local network.'
			: undefined;
	}

	// A single-label name can only resolve inside the cluster's own search domain, which is exactly
	// the network this rule exists to keep the platform out of.
	if (!host.includes('.')) {
		return 'A webhook endpoint must name a fully qualified host.';
	}

	return undefined;
}

/**
 * Why an endpoint's host resolves somewhere the platform must not post to, or undefined.
 *
 * This is the half that runs before each attempt. A name that answered a public address when the
 * subscription was created can answer a private one now — deliberately, which is the rebinding
 * attack, or accidentally, which is a split-horizon DNS that an operator did not think about — and
 * the static check cannot see either.
 *
 * A name that cannot be resolved at all is **not** refused here: that is an ordinary delivery
 * failure, it is already reported as one by the attempt itself, and turning it into a policy refusal
 * would tell an operator their endpoint is forbidden when it is merely down.
 *
 * @param url The endpoint.
 * @returns The reason, or undefined.
 */
export async function refusalForResolvedEndpoint(url: URL): Promise<string | undefined> {
	if (allowsPrivateNetworkEndpoints()) {
		return undefined;
	}

	const staticRefusal = refusalForEndpointHost(url);

	if (staticRefusal) {
		return staticRefusal;
	}

	const host = url.hostname.replace(/^\[|\]$/g, '');

	if (isIP(host)) {
		// Already decided above, and there is nothing to resolve.
		return undefined;
	}

	try {
		const addresses = await lookup(host, { all: true, verbatim: true });

		return addresses.some((entry) => isRefusedAddress(entry.address))
			? 'A webhook endpoint must not resolve to a private, loopback or link-local network.'
			: undefined;
	} catch {
		// Unresolvable is a delivery failure, not a policy refusal — see above.
		return undefined;
	}
}
