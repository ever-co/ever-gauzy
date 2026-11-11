// cspell:ignore bcher
import { expandIpv6, isPublicAddress, isRefusedHostname } from './egress-address';
import { egressTargetRefusal } from './egress-guard';

describe('isPublicAddress', () => {
	it.each([
		'0.0.0.0',
		'10.1.2.3',
		'100.64.0.1',
		'100.100.100.200',
		'127.0.0.1',
		'127.255.255.254',
		'169.254.169.254',
		'172.16.0.1',
		'172.31.255.255',
		'192.0.0.192',
		'192.0.2.1',
		'192.168.1.1',
		'198.18.0.1',
		'198.51.100.7',
		'203.0.113.9',
		'224.0.0.251',
		'255.255.255.255'
	])('refuses the IPv4 address %s', (address) => {
		expect(isPublicAddress(address)).toBe(false);
	});

	it.each([
		'::',
		'::1',
		'0:0:0:0:0:0:0:1',
		'::ffff:127.0.0.1',
		'::ffff:7f00:1',
		'0:0:0:0:0:ffff:a00:1',
		'::ffff:169.254.169.254',
		'::127.0.0.1',
		'::ffff:0:a00:1',
		'64:ff9b::10.0.0.1',
		'64:ff9b::a9fe:a9fe',
		'64:ff9b:1::a00:1',
		'2002:a00:1::1',
		'2002:7f00:1::',
		'fc00::1',
		'fd00:ec2::254',
		'fe80::1',
		'fec0::1',
		'ff02::1',
		'100::1',
		'2001::1',
		'2001:db8::1',
		'3fff::1',
		'fe80::1%eth0'
	])('refuses the IPv6 address %s', (address) => {
		expect(isPublicAddress(address)).toBe(false);
	});

	it.each(['8.8.8.8', '1.1.1.1', '93.184.215.14', '2606:4700:4700::1111', '2a00:1450:4001:80b::200e', '::ffff:8.8.8.8', '64:ff9b::808:808', '2002:808:808::1'])(
		'lets the public address %s through',
		(address) => {
			expect(isPublicAddress(address)).toBe(true);
		}
	);

	it('refuses what is not an address', () => {
		for (const value of ['', 'example.com', '1.2.3', '1.2.3.256', '::g', '1::2::3', undefined as unknown as string]) {
			expect(isPublicAddress(value)).toBe(false);
		}
	});

	it('expands IPv6 forms, a trailing IPv4 part included', () => {
		expect(expandIpv6('::ffff:10.0.0.1')).toEqual([0, 0, 0, 0, 0, 0xffff, 0x0a00, 0x0001]);
		expect(expandIpv6('2001:db8::')).toEqual([0x2001, 0xdb8, 0, 0, 0, 0, 0, 0]);
		expect(expandIpv6('1:2:3:4:5:6:7:8:9')).toBeNull();
	});
});

describe('isRefusedHostname', () => {
	it.each([
		'localhost',
		'LOCALHOST.',
		'api.localhost',
		'printer.local',
		'metadata.google.internal',
		'kubernetes',
		'redis',
		'gauzy-api.default.svc',
		'router.home.arpa',
		'1.0.0.127.in-addr.arpa',
		'site.test',
		'host.example',
		'x.invalid',
		'box.lan',
		'nas.home',
		'mail.corp',
		''
	])('refuses %s', (host) => {
		expect(isRefusedHostname(host)).toBe(true);
	});

	it.each(['example.com', 'www.example.org', 'docs.example.net', 'xn--bcher-kva.example', 'localhost.example.com'])('lets %s through to its lookup', (host) => {
		// `xn--bcher-kva.example` sits under the reserved `.example`: refused; the others are ordinary names.
		expect(isRefusedHostname(host)).toBe(host.endsWith('.example'));
	});
});

describe('egressTargetRefusal', () => {
	const refusal = (link: string) => egressTargetRefusal(new URL(link));

	it('refuses private, loopback, link-local and metadata address literals, however they are written', () => {
		expect(refusal('http://127.0.0.1/')).toBe('address');
		expect(refusal('http://2130706433/')).toBe('address');
		expect(refusal('http://0x7f.1/')).toBe('address');
		expect(refusal('http://017700000001/')).toBe('address');
		expect(refusal('http://169.254.169.254/latest/meta-data/')).toBe('address');
		expect(refusal('http://[::1]/')).toBe('address');
		expect(refusal('http://[::ffff:127.0.0.1]/')).toBe('address');
		expect(refusal('http://[fd00:ec2::254]/')).toBe('address');
		expect(refusal('http://[fe80::1]/')).toBe('address');
		expect(refusal('http://10.0.0.8:8080/')).toBe('address');
	});

	it('refuses internal names, other ports and other schemes before anything is resolved', () => {
		expect(refusal('http://localhost/')).toBe('hostname');
		expect(refusal('http://metadata.google.internal/computeMetadata/v1/')).toBe('hostname');
		expect(refusal('http://intranet/')).toBe('hostname');
		expect(refusal('https://example.com:22/')).toBe('port');
		expect(refusal('http://example.com:6379/')).toBe('port');
		expect(refusal('ftp://example.com/')).toBe('scheme');
		expect(refusal('https://user:pass@example.com/')).toBe('credentials');
	});

	it('lets public literals and ordinary names on the web ports through (their addresses are judged next)', () => {
		expect(refusal('https://example.com/')).toBeNull();
		expect(refusal('http://example.com:8080/page')).toBeNull();
		expect(refusal('https://93.184.215.14/')).toBeNull();
		expect(refusal('https://[2606:4700:4700::1111]:8443/')).toBeNull();
	});
});
