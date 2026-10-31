import { NetworkInterfaceInfo } from 'node:os';
import { DesktopNetworkInterfaces, listDesktopNetworkAddresses } from './desktop-network-addresses';

/** A NetworkInterfaceInfo with the fields the helper reads; the rest are filler. */
function info(address: string, family: 'IPv4' | 'IPv6', internal = false): NetworkInterfaceInfo {
	return {
		address,
		family,
		internal,
		netmask: family === 'IPv4' ? '255.255.255.0' : 'ffff:ffff:ffff:ffff::',
		mac: '00:00:00:00:00:00',
		cidr: null,
		...(family === 'IPv6' && { scopeid: 0 })
	} as NetworkInterfaceInfo;
}

const addressesOf = (interfaces: DesktopNetworkInterfaces) =>
	listDesktopNetworkAddresses(interfaces).map(({ address }) => address);

describe('listDesktopNetworkAddresses', () => {
	it('returns an empty list when the computer has no network interface', () => {
		expect(listDesktopNetworkAddresses({})).toEqual([]);
		expect(listDesktopNetworkAddresses(null as unknown as DesktopNetworkInterfaces)).toEqual([]);
		expect(listDesktopNetworkAddresses({ eth0: undefined })).toEqual([]);
	});

	it('leaves out loopback (internal) addresses', () => {
		expect(
			listDesktopNetworkAddresses({
				lo: [info('127.0.0.1', 'IPv4', true), info('::1', 'IPv6', true)]
			})
		).toEqual([]);
	});

	it('leaves out link-local addresses, which other computers cannot use in a URL', () => {
		expect(
			addressesOf({
				eth0: [info('169.254.10.20', 'IPv4'), info('fe80::1c2d:3e4f:5a6b:7c8d', 'IPv6'), info('192.168.1.20', 'IPv4')]
			})
		).toEqual(['192.168.1.20']);
	});

	it('describes each address with its interface, family and adapter kind', () => {
		expect(listDesktopNetworkAddresses({ 'Wi-Fi': [info('192.168.1.20', 'IPv4')] })).toEqual([
			{ name: 'Wi-Fi', address: '192.168.1.20', family: 'IPv4', virtual: false }
		]);
	});

	it('lists IPv4 before IPv6 and private LAN ranges before other IPv4 addresses', () => {
		expect(
			addressesOf({
				eth0: [info('2001:db8::20', 'IPv6'), info('203.0.113.7', 'IPv4'), info('10.0.0.5', 'IPv4')],
				eth1: [info('172.20.1.2', 'IPv4'), info('172.32.0.1', 'IPv4')]
			})
		).toEqual(['10.0.0.5', '172.20.1.2', '203.0.113.7', '172.32.0.1', '2001:db8::20']);
	});

	it('lists virtual machine, container and VPN adapters after the computer’s own adapters', () => {
		const addresses = listDesktopNetworkAddresses({
			'vEthernet (WSL)': [info('172.28.48.1', 'IPv4')],
			docker0: [info('172.17.0.1', 'IPv4')],
			'VirtualBox Host-Only Network': [info('192.168.56.1', 'IPv4')],
			tailscale0: [info('100.101.102.103', 'IPv4')],
			Ethernet: [info('192.168.1.20', 'IPv4'), info('fd00::20', 'IPv6')]
		});

		expect(addresses.map(({ address }) => address)).toEqual([
			'192.168.1.20',
			'fd00::20',
			'172.28.48.1',
			'172.17.0.1',
			'192.168.56.1',
			'100.101.102.103'
		]);
		expect(addresses.map(({ virtual }) => virtual)).toEqual([false, false, true, true, true, true]);
	});

	it('keeps the operating system’s order between equally good addresses', () => {
		expect(
			addressesOf({
				'Wi-Fi': [info('192.168.1.20', 'IPv4')],
				Ethernet: [info('192.168.0.30', 'IPv4')]
			})
		).toEqual(['192.168.1.20', '192.168.0.30']);
	});

	it('accepts the numeric family that Node 18.0 to 18.3 reported', () => {
		expect(
			listDesktopNetworkAddresses({
				eth0: [
					{ ...info('192.168.1.20', 'IPv4'), family: 4 } as unknown as NetworkInterfaceInfo,
					{ ...info('fd00::20', 'IPv6'), family: 6 } as unknown as NetworkInterfaceInfo
				]
			}).map(({ family }) => family)
		).toEqual(['IPv4', 'IPv6']);
	});

	it('lists an address found on two interfaces once', () => {
		expect(
			addressesOf({
				eth0: [info('192.168.1.20', 'IPv4')],
				br0: [info('192.168.1.20', 'IPv4')]
			})
		).toEqual(['192.168.1.20']);
	});

	it('reads the operating system when no interfaces are passed', () => {
		expect(Array.isArray(listDesktopNetworkAddresses())).toBe(true);
	});
});
