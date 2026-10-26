import { lookup as lookupWithCallback, LookupAddress, LookupOptions } from 'node:dns';
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
 * - every IPv6 address outside the global unicast space `2000::/3` and the special-purpose blocks
 *   inside it, and the transitional encodings that carry an IPv4 address inside an IPv6 one —
 *   IPv4-mapped, IPv4-compatible, IPv4-translated, NAT64 and 6to4 — which would otherwise smuggle
 *   `127.0.0.1` past a check that only read the outer form. An address is read as its bytes, not as
 *   text: the URL parser hands the policy `[::ffff:7f00:1]` for `[::ffff:127.0.0.1]`;
 * - multicast, broadcast and the reserved space above `240.0.0.0`;
 * - a single-label hostname such as `vault` or `consul`, which can only resolve inside the cluster's
 *   own search domain, and the special-use suffixes `.local`, `.internal`, `.localhost`, `.home.arpa`
 *   and `.onion`.
 *
 * **The check runs three times, and the last one is the one that matters.** A hostname is refused at
 * creation when it is already a literal address in a refused range, which is the common mistake and
 * is worth a clear error at the moment it is made. But a hostname can resolve anywhere, and can
 * resolve somewhere different a minute later — so the endpoint is resolved again immediately before
 * each attempt ({@link refusalForResolvedEndpoint}), which turns the ordinary case into a clear refusal
 * without a connection. That check alone does not close rebinding, though: the HTTP client resolves
 * the name again when it connects, and a name with a zero TTL can answer a public address to the
 * check and a private one to the connection. So the connection's own lookup applies the rule too
 * ({@link pinnedWebhookLookup}): the address that is checked is the address the socket connects to.
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

/** The reason a host that resolves into a refused range is refused, wherever it is decided. */
const RESOLVED_REFUSAL = 'A webhook endpoint must not resolve to a private, loopback or link-local network.';

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
 * The IPv4 ranges that are not globally routable, as `[network, prefix length]`.
 *
 * Exact blocks of the IANA special-purpose registry rather than whole `/16`s, so a public address
 * beside a documentation block is not refused with it.
 */
const REFUSED_IPV4_RANGES: ReadonlyArray<readonly [string, number]> = [
	['0.0.0.0', 8], // "this network", and 0.0.0.0 — which connects to the local host
	['10.0.0.0', 8], // private
	['100.64.0.0', 10], // carrier-grade NAT
	['127.0.0.0', 8], // loopback
	['169.254.0.0', 16], // link-local, and the cloud metadata address with it
	['172.16.0.0', 12], // private
	['192.0.0.0', 24], // IETF protocol assignments
	['192.0.2.0', 24], // TEST-NET-1
	['192.88.99.0', 24], // 6to4 relay anycast
	['192.168.0.0', 16], // private
	['198.18.0.0', 15], // benchmarking
	['198.51.100.0', 24], // TEST-NET-2
	['203.0.113.0', 24], // TEST-NET-3
	['224.0.0.0', 4], // multicast
	['240.0.0.0', 4] // reserved, and the broadcast address
];

/**
 * The special-purpose blocks inside the IPv6 global unicast space `2000::/3`, as `[network, prefix]`.
 *
 * Everything outside `2000::/3` is refused wholesale (see {@link isRefusedIPv6Groups}); these are the
 * blocks inside it that are not globally reachable either. 6to4 (`2002::/16`) is not here: it embeds an
 * IPv4 address, and is decided by that address.
 */
const REFUSED_IPV6_RANGES: ReadonlyArray<readonly [string, number]> = [
	['2001::', 32], // Teredo — the client's IPv4 address travels inside, obfuscated
	['2001:2::', 48], // benchmarking
	['2001:10::', 28], // ORCHID (deprecated)
	['2001:20::', 28], // ORCHIDv2
	['2001:db8::', 32], // documentation
	['3fff::', 20] // documentation (RFC 9637)
];

/**
 * Reads an IPv4 address as an unsigned 32-bit number.
 *
 * Only the canonical dotted-quad spelling is accepted, which is the one a resolver answers and the one
 * the WHATWG URL parser normalises every other spelling to (`2130706433`, `0x7f.1`, `0177.0.0.1`).
 *
 * @param address The address text.
 * @returns The number, or undefined when the text is not an IPv4 address.
 */
function ipv4ToNumber(address: string): number | undefined {
	if (isIP(address) !== 4) {
		return undefined;
	}

	const octets = address.split('.').map((part) => Number(part));

	if (octets.length !== 4 || !octets.every((octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255)) {
		return undefined;
	}

	return ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0;
}

/**
 * Whether a 32-bit IPv4 address is outside the globally routable space.
 *
 * @param value The address as an unsigned 32-bit number.
 * @returns True when the platform must not post to it.
 */
function isRefusedIPv4Number(value: number): boolean {
	return REFUSED_IPV4_RANGES.some(([network, prefix]) => {
		const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;

		return ((value & mask) >>> 0) === ((ipv4ToNumber(network) as number) & mask) >>> 0;
	});
}

/**
 * Whether an IPv4 address is outside the globally routable space.
 *
 * @param address The address text.
 * @returns True when the platform must not post to it.
 */
function isRefusedIPv4(address: string): boolean {
	const value = ipv4ToNumber(address);

	return value !== undefined && isRefusedIPv4Number(value);
}

/**
 * Reads an IPv6 address as its eight 16-bit groups, whatever its spelling.
 *
 * Compression (`::`), leading zeros, either letter case, a trailing dotted IPv4 (`::ffff:127.0.0.1`), a
 * zone (`fe80::1%eth0`) and surrounding brackets all read to the same eight numbers — which is the point:
 * the policy decides on the address, not on how it happened to be written. The WHATWG URL parser hands
 * the policy `[::ffff:7f00:1]` for `[::ffff:127.0.0.1]`, and a check that read the text matched only one
 * of the two.
 *
 * @param address The address text.
 * @returns The groups, or undefined when the text is not an IPv6 address.
 */
function ipv6Groups(address: string): number[] | undefined {
	const text = address.replace(/^\[|\]$/g, '').split('%')[0].toLowerCase();

	if (isIP(text) !== 6) {
		return undefined;
	}

	let body = text;
	const tail: number[] = [];
	const dotted = /(\d{1,3}(?:\.\d{1,3}){3})$/.exec(body);

	if (dotted) {
		const value = ipv4ToNumber(dotted[1]);

		if (value === undefined) {
			return undefined;
		}

		tail.push(value >>> 16, value & 0xffff);
		body = body.slice(0, -dotted[1].length);

		// `::ffff:` leaves a trailing separator, `::` leaves the compression marker intact.
		if (body.endsWith(':') && !body.endsWith('::')) {
			body = body.slice(0, -1);
		}
	}

	const [head, rest] = body.includes('::') ? body.split('::') : [body, undefined];
	const parse = (part: string): number[] => (part ? part.split(':').map((group) => Number.parseInt(group, 16)) : []);
	const front = parse(head);
	const back = rest === undefined ? [] : parse(rest);
	const missing = 8 - front.length - back.length - tail.length;

	if (rest === undefined ? missing !== 0 : missing < 0) {
		return undefined;
	}

	const groups = [...front, ...new Array(rest === undefined ? 0 : missing).fill(0), ...back, ...tail];

	return groups.length === 8 && groups.every((group) => Number.isInteger(group) && group >= 0 && group <= 0xffff)
		? groups
		: undefined;
}

/**
 * Whether the first `prefix` bits of two group lists agree.
 *
 * @param groups The address.
 * @param network The network.
 * @param prefix The prefix length in bits.
 * @returns True when the address is inside the network.
 */
function inIPv6Range(groups: number[], network: number[], prefix: number): boolean {
	for (let bit = 0; bit < prefix; bit += 16) {
		const width = Math.min(16, prefix - bit);
		const mask = (0xffff << (16 - width)) & 0xffff;
		const index = bit / 16;

		if ((groups[index] & mask) !== (network[index] & mask)) {
			return false;
		}
	}

	return true;
}

/**
 * Whether an IPv6 address, as its groups, is outside the globally routable space.
 *
 * The encodings that carry an IPv4 address are decided by that address — IPv4-mapped `::ffff:0:0/96`
 * and 6to4 `2002::/16` — or refused outright when they only exist on a local network: IPv4-compatible
 * `::/96` (deprecated, never routed, and the home of `::` and `::1`), IPv4-translated `::ffff:0:0:0/96`,
 * and NAT64 (`64:ff9b::/96`, `64:ff9b:1::/48`), whose gateway turns the embedded address into a
 * connection on the gateway's own network.
 *
 * Every other address is allowed only inside the global unicast space `2000::/3`, minus the
 * special-purpose blocks in {@link REFUSED_IPV6_RANGES}: an allow range rather than a deny list, so a block
 * nobody thought of — unique local, link local, site local, multicast, discard-only, reserved — is
 * refused by default rather than by remembering it.
 *
 * @param groups The address as eight 16-bit groups.
 * @returns True when the platform must not post to it.
 */
function isRefusedIPv6Groups(groups: number[]): boolean {
	const firstFive = groups.slice(0, 5).every((group) => group === 0);

	// IPv4-mapped, `::ffff:a.b.c.d`: the destination is the embedded IPv4 address.
	if (firstFive && groups[5] === 0xffff) {
		return isRefusedIPv4Number(((groups[6] << 16) | groups[7]) >>> 0);
	}

	// IPv4-compatible `::a.b.c.d` (with `::` and `::1` inside it) and IPv4-translated `::ffff:0:a.b.c.d`.
	const firstFour = groups.slice(0, 4).every((group) => group === 0);

	if ((firstFive && groups[5] === 0) || (firstFour && groups[4] === 0xffff && groups[5] === 0)) {
		return true;
	}

	// 6to4, `2002:aabb:ccdd::/48`: the destination's relay is the embedded IPv4 address.
	if (groups[0] === 0x2002) {
		return isRefusedIPv4Number(((groups[1] << 16) | groups[2]) >>> 0);
	}

	// Outside the global unicast space: NAT64, unique local, link local, multicast, reserved.
	if ((groups[0] & 0xe000) !== 0x2000) {
		return true;
	}

	return REFUSED_IPV6_RANGES.some(([network, prefix]) =>
		inIPv6Range(groups, ipv6Groups(network) as number[], prefix)
	);
}

/**
 * Whether an IPv6 address is outside the globally routable space.
 *
 * @param address The address text.
 * @returns True when the platform must not post to it.
 */
function isRefusedIPv6(address: string): boolean {
	const groups = ipv6Groups(address);

	return groups !== undefined && isRefusedIPv6Groups(groups);
}

/**
 * Whether a literal address is one the platform must not post to.
 *
 * @param address The address text, with or without brackets.
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

		return addresses.some((entry) => isRefusedAddress(entry.address)) ? RESOLVED_REFUSAL : undefined;
	} catch {
		// Unresolvable is a delivery failure, not a policy refusal — see above.
		return undefined;
	}
}

/**
 * The failure of a connection the policy refused at connect time.
 *
 * Distinct from every transport error, so the delivery path can record it as what it is — an endpoint
 * that is unreachable by policy, dead-lettered rather than retried — instead of as a receiver that is down.
 */
export class WebhookEndpointRefusedError extends Error {
	readonly code = 'WEBHOOK_ENDPOINT_REFUSED';

	constructor(message: string = RESOLVED_REFUSAL) {
		super(message);
		this.name = 'WebhookEndpointRefusedError';
	}
}

/**
 * The DNS lookup a webhook connection resolves its host with, the policy applied to its answer.
 *
 * 🛑 **This is what closes DNS rebinding** (R1-04 / R7-07 of the #10254 review). The check before an attempt
 * resolves the host and decides on that answer; the HTTP client then resolves it again when it connects,
 * and a name with a zero TTL can answer a public address to the first question and `10.x` or
 * `169.254.169.254` to the second. Handed to the socket as its `lookup`, this function makes the answer the
 * socket connects to the answer the policy decided on: one resolution, checked, then used.
 *
 * A host whose answer contains any refused address is refused — not just filtered — because a name that
 * mixes a public and a private answer is either misconfigured or an attack, and picking the public one would
 * leave the outcome to the order of the answers. It honours both shapes Node asks in: one address, or every
 * address when `all` is set (Node's happy-eyeballs connect asks for all of them).
 *
 * @param hostname The host the socket is about to connect to.
 * @param options What the socket asked for.
 * @param callback Node's lookup callback.
 */
export function pinnedWebhookLookup(
	hostname: string,
	options: LookupOptions,
	callback: (error: NodeJS.ErrnoException | null, address?: string | LookupAddress[], family?: number) => void
): void {
	lookupWithCallback(hostname, { ...options, all: true, verbatim: true }, (error, addresses) => {
		if (error) {
			callback(error);
			return;
		}

		const answers = (addresses ?? []) as LookupAddress[];

		if (!allowsPrivateNetworkEndpoints() && answers.some((entry) => isRefusedAddress(entry.address))) {
			callback(new WebhookEndpointRefusedError());
			return;
		}

		if (answers.length === 0) {
			callback(Object.assign(new Error(`getaddrinfo ENOTFOUND ${hostname}`), { code: 'ENOTFOUND' }));
			return;
		}

		if (options?.all) {
			callback(null, answers);
			return;
		}

		callback(null, answers[0].address, answers[0].family);
	});
}
