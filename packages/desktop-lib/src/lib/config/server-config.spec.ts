const mockConfigs: { current: Record<string, unknown> | undefined } = { current: undefined };

jest.mock('../desktop-store', () => ({
	LocalStore: {
		getStore: jest.fn(() => mockConfigs.current),
		updateConfigSetting: jest.fn()
	}
}));

import { IReadWriteFile } from '../interfaces';
import { ServerConfig } from './server-config';
import { applyUiRuntimeConfig } from './ui-runtime-config';

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

/**
 * Gauzy Server writes the web UI's API URL into the install directory's index.html. A .deb install (root-owned
 * /opt/Gauzy Server) or an AppImage (read-only mount) cannot be written to: `read()` answers undefined there, and
 * `update()` threw "Cannot read properties of undefined (reading 'replace')", which stopped the setup (#7735). The UI
 * server now inserts the URL as it serves the page, so the file is only a fallback.
 */
describe('ServerConfig.update', () => {
	const INDEX = '<html><body><ga-app></ga-app></body></html>';

	/** A file stub: `content` is what `read()` answers (undefined: the directory is not writable). */
	const file = (content: string | undefined): jest.Mocked<IReadWriteFile> => ({
		hasDirectoryAccess: content !== undefined,
		read: jest.fn(() => content),
		write: jest.fn()
	});

	let warn: jest.SpyInstance;
	let error: jest.SpyInstance;

	beforeEach(() => {
		mockConfigs.current = { host: '0.0.0.0', port: 3000, portUi: 4200 };
		warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
		error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => {
		mockConfigs.current = undefined;
		warn.mockRestore();
		error.mockRestore();
	});

	it('skips a UI directory it cannot write to, with a warning instead of an error', () => {
		const readOnly = file(undefined);

		expect(() => new ServerConfig(readOnly).update()).not.toThrow();

		expect(readOnly.write).not.toHaveBeenCalled();
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('not writable'));
	});

	it('CONTROL: still writes the API URL into a writable install', () => {
		const writable = file(INDEX);

		new ServerConfig(writable).update();

		expect(writable.write).toHaveBeenCalledWith(applyUiRuntimeConfig(INDEX, 'http://127.0.0.1:3000'));
	});

	it('leaves the file untouched when it already points at the API', () => {
		const current = file(applyUiRuntimeConfig(INDEX, 'http://127.0.0.1:3000'));

		new ServerConfig(current).update();

		expect(current.write).not.toHaveBeenCalled();
	});

	it('logs any other failure instead of stopping the start, since the UI server adds the URL anyway', () => {
		const broken = file(INDEX);
		broken.read.mockImplementation(() => {
			throw new Error('EIO');
		});

		expect(() => new ServerConfig(broken).update()).not.toThrow();

		expect(broken.write).not.toHaveBeenCalled();
		expect(error).toHaveBeenCalled();
	});

	it('does nothing without a file (Gauzy API Server and the services)', () => {
		expect(() => new ServerConfig().update()).not.toThrow();
	});
});
