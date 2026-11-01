import { IDesktopNetworkAddress } from '@gauzy/contracts';
import { networkInterfaces, NetworkInterfaceInfo } from 'node:os';

/** What `os.networkInterfaces()` returns: interface name to its addresses. */
export type DesktopNetworkInterfaces = NodeJS.Dict<NetworkInterfaceInfo[]>;

/**
 * Interface names of virtual machine, container and VPN adapters (Docker, WSL / Hyper-V, VirtualBox,
 * VMware, libvirt, Tailscale, WireGuard, ZeroTier, OpenVPN tunnels...). Their addresses are still
 * listed, after the computer's own network adapters, since another computer on the LAN usually
 * cannot reach them.
 */
export const DESKTOP_VIRTUAL_INTERFACE_PATTERNS: readonly RegExp[] = [
	/^(docker|br-|veth|virbr|vboxnet|vmnet|lxcbr|lxdbr|cni|flannel|cali|podman|bridge\d)/i,
	/^(tun|tap|utun|wg|tailscale|zt|ipsec)/i,
	/vethernet|virtualbox|vmware|hyper-v|\bwsl\b|vpn/i
];

/**
 * The computer's network addresses another computer could use to reach a server running on it,
 * best candidates first. Only the operating system is asked: no third-party service, so a public
 * address that a router holds (NAT) is not found.
 *
 * Left out: the loopback addresses (`127.0.0.1`, `::1`) and link-local addresses (`169.254.x.x`,
 * `fe80::`), which other computers on the LAN cannot use in a URL.
 *
 * Order: the computer's own adapters before virtual ones ({@link DESKTOP_VIRTUAL_INTERFACE_PATTERNS}),
 * then IPv4 before IPv6, then private LAN IPv4 ranges before other IPv4 addresses, then the order the
 * operating system reports.
 *
 * @param interfaces - Defaults to `os.networkInterfaces()`; passed in by tests.
 * @param virtualPatterns - Interface names to list last.
 */
export function listDesktopNetworkAddresses(
	interfaces: DesktopNetworkInterfaces = networkInterfaces(),
	virtualPatterns: readonly RegExp[] = DESKTOP_VIRTUAL_INTERFACE_PATTERNS
): IDesktopNetworkAddress[] {
	const seen = new Set<string>();
	const candidates: IDesktopNetworkAddress[] = [];

	for (const [name, infos] of Object.entries(interfaces ?? {})) {
		for (const info of infos ?? []) {
			const family = toAddressFamily(info?.family);
			if (!family || info.internal || !info.address || isLinkLocal(info.address, family)) {
				continue;
			}
			const address = info.address.toLowerCase();
			if (seen.has(address)) {
				continue;
			}
			seen.add(address);
			candidates.push({
				name,
				address,
				family,
				virtual: virtualPatterns.some((pattern) => pattern.test(name))
			});
		}
	}

	// Array.prototype.sort is stable: equal ranks keep the operating system's order.
	return candidates.sort((a, b) => rankAddress(a) - rankAddress(b));
}

/** Lower is better. See {@link listDesktopNetworkAddresses} for the order. */
function rankAddress({ address, family, virtual }: IDesktopNetworkAddress): number {
	const adapter = virtual ? 4 : 0;
	if (family === 'IPv6') {
		return adapter + 2;
	}
	return adapter + (isPrivateIPv4(address) ? 0 : 1);
}

/**
 * `NetworkInterfaceInfo.family` is `'IPv4'` / `'IPv6'`; Node 18.0 to 18.3 returned the numbers 4 / 6.
 */
function toAddressFamily(family: unknown): IDesktopNetworkAddress['family'] | null {
	switch (String(family)) {
		case 'IPv4':
		case '4':
			return 'IPv4';
		case 'IPv6':
		case '6':
			return 'IPv6';
		default:
			return null;
	}
}

function isLinkLocal(address: string, family: IDesktopNetworkAddress['family']): boolean {
	return family === 'IPv4' ? address.startsWith('169.254.') : /^fe[89ab][0-9a-f]:/i.test(address);
}

/** 10.0.0.0/8, 172.16.0.0/12 and 192.168.0.0/16 (RFC 1918). */
function isPrivateIPv4(address: string): boolean {
	const [first, second] = address.split('.').map(Number);
	return first === 10 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168);
}
