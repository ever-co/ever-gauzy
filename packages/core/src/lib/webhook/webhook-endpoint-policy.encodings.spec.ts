import { isRefusedAddress, refusalForEndpointHost } from './webhook-endpoint-policy';

/**
 * Every spelling of a refused address is refused (R1-03 / R7-02 of the #10254 review).
 *
 * **The defect.** The WHATWG `URL` parser normalises an IPv6 host before the policy ever sees it:
 * `https://[::ffff:127.0.0.1]/` reaches the policy as `[::ffff:7f00:1]`, the hex form. The mapped-address
 * test only matched the dotted form, the fallback read the first group as `0`, and the address was
 * **allowed** — at creation and again at delivery, where a literal address is not resolved. Node's `fetch`
 * then connected to `127.0.0.1`. The same hole let through `[::ffff:a9fe:a9fe]` (the cloud metadata
 * service), `[::ffff:a00:1]` (the pod network) and the IPv4-compatible `[::7f00:1]`.
 *
 * **What the fix is held to.** The policy reads an address as its bytes, not as text: an IPv6 address is
 * parsed into its eight groups whatever its spelling, an embedded IPv4 address is checked as the IPv4
 * address it is, and IPv6 is otherwise allowed only inside the global unicast space `2000::/3`, minus the
 * special-purpose blocks inside it. Every table is checked through `new URL(...)`, because the URL parser
 * is what decides the spelling the policy receives — `2130706433`, `0x7f.1` and `0177.0.0.1` all arrive as
 * `127.0.0.1` — and through `isRefusedAddress` directly, because that is the spelling a resolver answers.
 *
 * Each refusal table has a control table beside it: a rule that refused every IPv6 literal would pass the
 * first and fail the second.
 */

const LOOPBACK_REFUSAL = /private, loopback or link-local/;

describe('a literal endpoint host is refused in every spelling of a refused address', () => {
	it.each([
		// IPv4-mapped, in the dotted spelling an operator types and the hex one the URL parser produces.
		['https://[::ffff:127.0.0.1]/hook', 'mapped loopback, dotted'],
		['https://[::ffff:7f00:1]/hook', 'mapped loopback, hex'],
		['https://[0:0:0:0:0:ffff:7f00:1]/hook', 'mapped loopback, uncompressed'],
		['https://[::ffff:169.254.169.254]/latest/meta-data/', 'mapped metadata service, dotted'],
		['https://[::ffff:a9fe:a9fe]/latest/meta-data/', 'mapped metadata service, hex'],
		['https://[::ffff:a00:1]/', 'mapped 10.0.0.1'],
		['https://[::ffff:c0a8:101]/', 'mapped 192.168.1.1'],
		['https://[::ffff:0:0]/', 'mapped 0.0.0.0'],
		// IPv4-compatible (deprecated) and IPv4-translated.
		['https://[::7f00:1]/', 'IPv4-compatible loopback'],
		['https://[::a9fe:a9fe]/', 'IPv4-compatible metadata service'],
		['https://[::ffff:0:7f00:1]/', 'IPv4-translated loopback'],
		// Unspecified and loopback, every spelling.
		['https://[::]/', 'unspecified'],
		['https://[0:0:0:0:0:0:0:0]/', 'unspecified, uncompressed'],
		['https://[::1]/', 'loopback'],
		['https://[0:0:0:0:0:0:0:1]/', 'loopback, uncompressed'],
		// NAT64, well-known and local-use prefixes: a NAT64 gateway turns these into the embedded IPv4.
		['https://[64:ff9b::7f00:1]/', 'NAT64 loopback'],
		['https://[64:ff9b::a9fe:a9fe]/', 'NAT64 metadata service'],
		['https://[64:ff9b::808:808]/', 'NAT64 of a public address'],
		['https://[64:ff9b:1::a00:1]/', 'NAT64 local-use prefix'],
		// 6to4 embedding a refused address, Teredo, and the special blocks inside 2000::/3.
		['https://[2002:a9fe:a9fe::1]/', '6to4 of the metadata service'],
		['https://[2002:c0a8:101::1]/', '6to4 of 192.168.1.1'],
		['https://[2001:0:4136:e378:8000:63bf:3fff:fdd2]/', 'Teredo'],
		['https://[2001:db8::1]/', 'documentation'],
		['https://[3fff::1]/', 'documentation (RFC 9637)'],
		['https://[2001:2::1]/', 'benchmarking'],
		['https://[2001:10::1]/', 'ORCHID'],
		['https://[2001:20::1]/', 'ORCHIDv2'],
		// Outside the global unicast space.
		['https://[fc00::1]/', 'unique local'],
		['https://[fdff:ffff::1]/', 'unique local, top of the range'],
		['https://[fe80::1]/', 'link-local'],
		['https://[febf::1]/', 'link-local, top of the range'],
		['https://[fec0::1]/', 'site-local (deprecated)'],
		['https://[ff02::1]/', 'multicast'],
		['https://[100::1]/', 'discard-only'],
		['https://[4000::1]/', 'reserved'],
		// IPv4 in the spellings the URL parser accepts and normalises.
		['https://2130706433/', 'decimal loopback'],
		['https://0x7f000001/', 'hex loopback'],
		['https://0177.0.0.1/', 'octal loopback'],
		['https://0x7f.1/', 'short hex loopback'],
		['https://127.1/', 'short loopback'],
		['https://017700000001/', 'octal whole-number loopback'],
		['https://169.254.43518/', 'short metadata service'],
		['https://0/', 'zero'],
		['https://0.0.0.0/', 'this network'],
		['https://192.0.2.1/', 'TEST-NET-1'],
		['https://198.51.100.7/', 'TEST-NET-2'],
		['https://203.0.113.9/', 'TEST-NET-3'],
		['https://192.88.99.1/', '6to4 relay anycast'],
		['https://240.0.0.1/', 'reserved']
	])('refuses %s (%s)', (url) => {
		expect(refusalForEndpointHost(new URL(url))).toMatch(LOOPBACK_REFUSAL);
	});

	it.each([
		['https://[2606:4700:4700::1111]/', 'public IPv6'],
		['https://[2a00:1450:4001:80b::200e]/', 'public IPv6'],
		['https://[::ffff:808:808]/', 'mapped public IPv4, hex'],
		['https://[::ffff:8.8.8.8]/', 'mapped public IPv4, dotted'],
		['https://[2002:808:808::1]/', '6to4 of a public IPv4'],
		['https://134744072/', 'decimal 8.8.8.8'],
		['https://8.8.8.8/', 'public IPv4'],
		['https://203.0.114.1/', 'beside TEST-NET-3'],
		['https://198.51.101.1/', 'beside TEST-NET-2'],
		['https://192.88.100.1/', 'beside the 6to4 relay']
	])('allows %s (%s) — control', (url) => {
		expect(refusalForEndpointHost(new URL(url))).toBeUndefined();
	});
});

describe('a resolved address is refused in every spelling a resolver can answer', () => {
	it.each([
		'::ffff:7f00:1',
		'::ffff:127.0.0.1',
		'0:0:0:0:0:ffff:a9fe:a9fe',
		'::FFFF:A9FE:A9FE',
		'::7f00:1',
		'64:ff9b::7f00:1',
		'fe80::1%eth0',
		'::',
		'::1',
		'fd00::1',
		'0.0.0.0',
		'127.0.0.1',
		'169.254.169.254'
	])('refuses %s', (address) => {
		expect(isRefusedAddress(address)).toBe(true);
	});

	it.each(['2606:4700:4700::1111', '::ffff:808:808', '8.8.8.8', '2002:808:808::1'])('allows %s — control', (address) => {
		expect(isRefusedAddress(address)).toBe(false);
	});
});
