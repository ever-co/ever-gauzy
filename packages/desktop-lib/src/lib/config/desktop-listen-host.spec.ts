import {
	DESKTOP_ALL_INTERFACES_HOST,
	DESKTOP_LOOPBACK_HOST,
	isDesktopLanAccessEnabled,
	resolveDesktopListenHost,
	toReachableDesktopUrl
} from './desktop-listen-host';

/**
 * Owner decision 8 (2026-10-22): the API that Gauzy Desktop and the Desktop Timer run locally listens
 * on 127.0.0.1 only; Gauzy Server (and Gauzy API Server) keep listening on the network, as an explicit
 * setting that existing installs find switched on.
 *
 * Before, every launcher passed API_HOST=0.0.0.0, so the integrated server of a Gauzy Desktop install,
 * seeded with `admin@ever.co` / `admin`, accepted sign-ins from anyone on the same network.
 */
describe('resolveDesktopListenHost', () => {
	describe('Gauzy Desktop integrated server (no LAN access allowed)', () => {
		it('listens on the loopback address', () => {
			expect(resolveDesktopListenHost(undefined, false)).toBe(DESKTOP_LOOPBACK_HOST);
			expect(DESKTOP_LOOPBACK_HOST).toBe('127.0.0.1');
		});

		it('ignores a stored lanAccess: true (no setting can open it to the network)', () => {
			expect(resolveDesktopListenHost({ lanAccess: true }, false)).toBe(DESKTOP_LOOPBACK_HOST);
		});
	});

	describe('Gauzy Server and Gauzy API Server (LAN access allowed)', () => {
		it('CONTROL: an install from before the setting keeps listening on every interface', () => {
			expect(resolveDesktopListenHost({}, true)).toBe(DESKTOP_ALL_INTERFACES_HOST);
			expect(resolveDesktopListenHost(undefined, true)).toBe('0.0.0.0');
		});

		it('listens on every interface when the setting is on', () => {
			expect(resolveDesktopListenHost({ lanAccess: true }, true)).toBe(DESKTOP_ALL_INTERFACES_HOST);
		});

		it('treats a null value (the settings page default before it is touched) as on', () => {
			expect(resolveDesktopListenHost({ lanAccess: null }, true)).toBe(DESKTOP_ALL_INTERFACES_HOST);
		});

		it('listens on the loopback address once the user turns LAN access off', () => {
			expect(resolveDesktopListenHost({ lanAccess: false }, true)).toBe(DESKTOP_LOOPBACK_HOST);
		});
	});
});

describe('isDesktopLanAccessEnabled', () => {
	it('is off only for an explicit false', () => {
		expect(isDesktopLanAccessEnabled({ lanAccess: false })).toBe(false);
		expect(isDesktopLanAccessEnabled({ lanAccess: true })).toBe(true);
		expect(isDesktopLanAccessEnabled({})).toBe(true);
		expect(isDesktopLanAccessEnabled(null)).toBe(true);
	});
});

describe('toReachableDesktopUrl', () => {
	it('points a URL built from the wildcard host at the loopback address', () => {
		expect(toReachableDesktopUrl('http://0.0.0.0')).toBe('http://127.0.0.1');
		expect(toReachableDesktopUrl('http://0.0.0.0:3000')).toBe('http://127.0.0.1:3000');
		expect(toReachableDesktopUrl('https://0.0.0.0/api')).toBe('https://127.0.0.1/api');
	});

	it('keeps any other host as typed (a LAN address or a name)', () => {
		expect(toReachableDesktopUrl('http://192.168.1.20:3000')).toBe('http://192.168.1.20:3000');
		expect(toReachableDesktopUrl('http://gauzy.lan')).toBe('http://gauzy.lan');
		expect(toReachableDesktopUrl('http://0.0.0.0.example.com')).toBe('http://0.0.0.0.example.com');
	});
});
