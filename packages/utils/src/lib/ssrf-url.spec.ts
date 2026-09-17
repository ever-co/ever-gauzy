import { getUnsafeOutboundUrlReason, isPrivateOrLoopbackHost } from './ssrf-url';

/**
 * `isPrivateOrLoopbackHost` is the shared host-class predicate behind the Make.com and Zapier webhook
 * guards and the AI-provider base-URL guard. These cases pin the IPv6 forms that carry an IPv4
 * address inside them, which a gateway turns back into a connection to that IPv4 address.
 */
describe('isPrivateOrLoopbackHost', () => {
	it.each([
		// NAT64 well-known prefix 64:ff9b::/96 (RFC 6052), in the shapes the URL parser and a resolver produce.
		['NAT64 loopback, compressed hex', '[64:ff9b::7f00:1]'],
		['NAT64 loopback, dotted tail', '64:ff9b::127.0.0.1'],
		['NAT64 cloud metadata', '64:ff9b::a9fe:a9fe'],
		['NAT64 RFC 1918, fully expanded', '0064:ff9b:0000:0000:0000:0000:0a00:0001'],
		// 6to4 2002::/16 (RFC 3056): the IPv4 address follows the prefix.
		['6to4 loopback', '[2002:7f00:1::]'],
		['6to4 cloud metadata', '2002:a9fe:a9fe::1'],
		['6to4 RFC 1918', '2002:c0a8:0101:0:0:0:0:1'],
		// Pre-existing forms, kept green.
		['IPv6 loopback', '[::1]'],
		['IPv4-mapped loopback', '::ffff:127.0.0.1'],
		['unique-local', 'fc00::1'],
		['link-local', 'fe80::1']
	])('refuses %s (%s)', (_label, host) => {
		expect(isPrivateOrLoopbackHost(host)).toBe(true);
	});

	it.each([
		['NAT64 of a public address', '64:ff9b::5db8:d70e'],
		['6to4 of a public address', '2002:5db8:d70e::1'],
		['a public IPv6 address', '2606:4700:4700::1111'],
		['a prefix that only looks like NAT64 (local-use 64:ff9b:1::/48 is not the /96)', '64:ff9b:1::7f00:1'],
		['malformed IPv6 with two compressions', '2002::7f00::1']
	])('does not refuse %s (%s)', (_label, host) => {
		expect(isPrivateOrLoopbackHost(host)).toBe(false);
	});

	it('refuses an embedded private IPv4 address through the URL guard too', () => {
		expect(getUnsafeOutboundUrlReason('https://[64:ff9b::169.254.169.254]/latest/meta-data/')).not.toBeNull();
		expect(getUnsafeOutboundUrlReason('https://[2002:a00:1::]/hook')).not.toBeNull();
		expect(getUnsafeOutboundUrlReason('https://[2002:5db8:d70e::1]/hook')).toBeNull();
	});
});
