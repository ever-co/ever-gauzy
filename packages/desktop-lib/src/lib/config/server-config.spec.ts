const mockConfigs: { current: Record<string, unknown> | undefined } = { current: undefined };

jest.mock('../desktop-store', () => ({
	LocalStore: {
		getStore: jest.fn(() => mockConfigs.current),
		updateConfigSetting: jest.fn()
	}
}));

import { ServerConfig } from './server-config';

/**
 * The URLs the server apps hand out (API_BASE_URL, the web UI's API URL, "open in browser") are built
 * from the host setting, whose default is the wildcard `0.0.0.0`. That address was mapped to the
 * loopback address on Windows only; with the API now able to listen on 127.0.0.1 alone, every
 * platform maps it (Chromium also refuses to open 0.0.0.0).
 */
describe('ServerConfig URLs', () => {
	const platform = Object.getOwnPropertyDescriptor(process, 'platform');
	const setPlatform = (value: NodeJS.Platform) => Object.defineProperty(process, 'platform', { value });

	afterEach(() => {
		Object.defineProperty(process, 'platform', platform);
		mockConfigs.current = undefined;
	});

	it.each(['linux', 'darwin', 'win32'] as NodeJS.Platform[])(
		'points the default host at the loopback address on %s',
		(os) => {
			setPlatform(os);
			mockConfigs.current = { host: '0.0.0.0', port: 3000, portUi: 4200 };

			const config = new ServerConfig();

			expect(config.apiUrl).toBe('http://127.0.0.1:3000');
			expect(config.uiUrl).toBe('http://127.0.0.1:4200');
		}
	);

	it('does the same when no host was ever stored', () => {
		mockConfigs.current = { port: 3000 };

		expect(new ServerConfig().apiUrl).toBe('http://127.0.0.1:3000');
	});

	it('keeps a host the user typed (the address LAN clients use)', () => {
		mockConfigs.current = { host: '192.168.1.20', port: 3000 };

		expect(new ServerConfig().apiUrl).toBe('http://192.168.1.20:3000');
	});

	it('points a typed LAN host at the loopback address once LAN access is off, keeping the setting', () => {
		mockConfigs.current = { host: '192.168.1.20', port: 3000, portUi: 4200, lanAccess: false };

		const config = new ServerConfig();

		// The API and the web UI listen on 127.0.0.1 only: the LAN address would not reach them.
		expect(config.apiUrl).toBe('http://127.0.0.1:3000');
		expect(config.uiUrl).toBe('http://127.0.0.1:4200');
		expect(config.setting.host).toBe('192.168.1.20');
	});

	describe("localUiUrl (the time tracker's link to the web app)", () => {
		it('is the address of the web UI this app serves while its UI server runs (Gauzy Server, API Server)', () => {
			mockConfigs.current = { host: '0.0.0.0', port: 3000, portUi: 4300 };

			expect(new ServerConfig().localUiUrl(true)).toBe('http://127.0.0.1:4300');
		});

		it("is null without a running UI server: Gauzy Desktop's integrated server runs the API only", () => {
			mockConfigs.current = { isLocalServer: true, host: '0.0.0.0', port: 3000, portUi: 4200 };

			expect(new ServerConfig().localUiUrl(false)).toBeNull();
		});

		it('is null for a remote server: its web UI address is unknown', () => {
			mockConfigs.current = { isLocalServer: false, serverUrl: 'https://gauzy.example.com', portUi: 4200 };

			expect(new ServerConfig().localUiUrl(false)).toBeNull();
		});
	});
});
