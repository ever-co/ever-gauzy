import { allowsPrivateNetworkEndpoints, isRefusedAddress, refusalForEndpointHost } from './webhook-endpoint-policy';

/**
 * Where the platform may post a webhook.
 *
 * An endpoint is a URL a tenant supplies and the platform then fetches from inside the cluster, and
 * the only rule that stood in its way was that the scheme had to be `https:`. So a tenant user who
 * may create a subscription could point one at the cloud metadata service, at a database admin port
 * on the pod network, or at a service mesh's control plane — and then read four kilobytes of each
 * response back out of the delivery log, which is a read API the same user already has.
 *
 * Every case below is an address a request from inside a cluster reaches and an attacker outside it
 * cannot. The transitional IPv6 encodings get their own case because they are how `127.0.0.1` is
 * smuggled past a check that reads only the outer form.
 */
afterEach(() => {
	delete process.env.GAUZY_WEBHOOK_ALLOW_PRIVATE_NETWORK;
});

/** The refusal for one endpoint, or undefined. */
function refusalFor(url: string): string | undefined {
	return refusalForEndpointHost(new URL(url));
}

describe('the addresses a webhook may not be posted to', () => {
	it('refuses every IPv4 range that is not globally routable', () => {
		// `169.254.169.254` is the one that matters most: it is the cloud metadata service, it answers
		// credentials, and every pod in every major cloud can reach it.
		for (const address of [
			'0.0.0.0',
			'10.1.2.3',
			'100.64.0.1',
			'127.0.0.1',
			'169.254.169.254',
			'172.16.0.1',
			'172.31.255.254',
			'192.0.0.1',
			'192.168.1.1',
			'198.18.0.1',
			'224.0.0.1',
			'255.255.255.255'
		]) {
			expect(isRefusedAddress(address)).toBe(true);
		}
	});

	it('allows an ordinary public address', () => {
		// Control: a deny list that refused everything would pass every case above and be useless.
		for (const address of ['8.8.8.8', '1.1.1.1', '93.184.216.34', '172.32.0.1', '11.0.0.1']) {
			expect(isRefusedAddress(address)).toBe(false);
		}
	});

	it('refuses the IPv6 ranges, including the two that carry an IPv4 address inside them', () => {
		for (const address of [
			'::',
			'::1',
			'fc00::1',
			'fd12:3456::1',
			'fe80::1',
			'ff02::1',
			'2001:db8::1',
			// IPv4-mapped and IPv4-compatible: the outer form is IPv6, the destination is loopback.
			'::ffff:127.0.0.1',
			'::ffff:169.254.169.254',
			'::127.0.0.1',
			// 6to4 embedding `127.0.0.1` — `7f00:0001`.
			'2002:7f00:1::1'
		]) {
			expect(isRefusedAddress(address)).toBe(true);
		}
	});

	it('allows a public IPv6 address, including a 6to4 address that embeds a public one', () => {
		// Control for the two unwrapping branches: they must decide on the embedded address rather
		// than refuse every address that uses the encoding.
		expect(isRefusedAddress('2606:4700:4700::1111')).toBe(false);
		expect(isRefusedAddress('::ffff:8.8.8.8')).toBe(false);
		// 6to4 embedding `8.8.8.8` — `0808:0808`.
		expect(isRefusedAddress('2002:808:808::1')).toBe(false);
	});
});

describe('the hosts a webhook endpoint may name', () => {
	it('refuses a literal address in a range the platform must not reach', () => {
		expect(refusalFor('https://169.254.169.254/latest/meta-data/')).toMatch(/private, loopback or link-local/);
		expect(refusalFor('https://127.0.0.1:8080/hook')).toMatch(/private, loopback or link-local/);
		expect(refusalFor('https://[::1]/hook')).toMatch(/private, loopback or link-local/);
		expect(refusalFor('https://10.0.0.5:8500/v1/kv/')).toMatch(/private, loopback or link-local/);
	});

	it('refuses the names that can only resolve inside the cluster', () => {
		// A single-label name resolves through the pod's own search domain, which is the network this
		// rule exists to keep the platform out of; the suffixes are the special-use ones.
		expect(refusalFor('https://vault/v1/secret')).toMatch(/fully qualified/);
		expect(refusalFor('https://localhost/hook')).toMatch(/publicly resolvable/);
		expect(refusalFor('https://redis.internal/hook')).toMatch(/publicly resolvable/);
		expect(refusalFor('https://printer.local/hook')).toMatch(/publicly resolvable/);
		expect(refusalFor('https://something.onion/hook')).toMatch(/publicly resolvable/);
	});

	it('allows the endpoint a partner actually runs', () => {
		// Control: the rule has to leave ordinary endpoints alone, including a port and a path, and it
		// must not be fooled by a trailing dot in the host.
		expect(refusalFor('https://hooks.partner.example/gauzy')).toBeUndefined();
		expect(refusalFor('https://hooks.partner.example:8443/gauzy?x=1')).toBeUndefined();
		expect(refusalFor('https://hooks.partner.example./gauzy')).toBeUndefined();
		expect(refusalFor('https://8.8.8.8/hook')).toBeUndefined();
	});

	it('can be turned off by an installation that means to post inside its own network', () => {
		expect(allowsPrivateNetworkEndpoints()).toBe(false);

		process.env.GAUZY_WEBHOOK_ALLOW_PRIVATE_NETWORK = 'true';

		expect(allowsPrivateNetworkEndpoints()).toBe(true);
		expect(refusalFor('https://10.0.0.5/hook')).toBeUndefined();
		// Control: the opt-out is the exact string, so a deployment that sets it to anything else —
		// `1`, `yes`, an empty value — keeps the safe default rather than silently disabling the rule.
		process.env.GAUZY_WEBHOOK_ALLOW_PRIVATE_NETWORK = '1';
		expect(allowsPrivateNetworkEndpoints()).toBe(false);
		expect(refusalFor('https://10.0.0.5/hook')).toMatch(/private, loopback or link-local/);
	});
});
