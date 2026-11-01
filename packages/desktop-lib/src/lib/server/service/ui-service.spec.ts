/**
 * Gauzy Server's web UI learns its API URL from a script in its index.html. That script used to reach the UI only by
 * being written into the install directory, which a .deb (root-owned /opt) or an AppImage (read-only) does not allow
 * (#7735). UiService now hands it to the UI server, which inserts it as it serves the page.
 *
 * Electron cannot run here: the child process and the store are mocked.
 */
import type { EventEmitter } from 'events';

const mockSetting: { current: Record<string, unknown> } = { current: {} };
const mockChildren: Array<{ env: Record<string, unknown>; stdout: EventEmitter; stderr: EventEmitter; pid: number }> =
	[];

jest.mock('electron', () => ({ BrowserWindow: class {}, app: { isPackaged: true } }), { virtual: true });
jest.mock('../../desktop-store', () => ({
	LocalStore: { getStore: jest.fn(() => mockSetting.current), updateConfigSetting: jest.fn() }
}));
// The real decorators module loads the dialogs and the power manager; only Timeout is used here.
jest.mock('../../decorators', () => ({
	Timeout: () => (_target: unknown, _key: unknown, descriptor: unknown) => descriptor
}));
jest.mock('../utils', () => {
	const { EventEmitter } = jest.requireActual('events');
	return {
		...jest.requireActual('../utils/observer'),
		ChildProcessFactory: {
			createProcess: (_path: string, env: Record<string, unknown>) => {
				const child = { env, stdout: new EventEmitter(), stderr: new EventEmitter(), pid: 4343 };
				mockChildren.push(child);
				return child;
			}
		}
	};
});

import { buildUiRuntimeConfigScript, UI_RUNTIME_CONFIG_SCRIPT_ENV } from '../../config/ui-runtime-config';
import { UiService } from './ui-service';

describe('UiService', () => {
	const window = { isDestroyed: () => false, webContents: { send: jest.fn() } } as unknown as ConstructorParameters<
		typeof UiService
	>[2];

	/** Starts Gauzy Server's UI server and returns the child process it would run in. */
	const start = (setting: Record<string, unknown>) => {
		mockSetting.current = setting;
		const service = new UiService(
			'/app/preload/ui-server.js',
			{},
			window,
			new AbortController().signal,
			4200,
			true
		);
		const started = service.start();
		return { service, started, child: mockChildren[mockChildren.length - 1] };
	};
	const listening = (child: (typeof mockChildren)[number]) =>
		child.stdout.emit('data', Buffer.from('Listening on port 4200\n'));

	let log: jest.SpyInstance;

	beforeEach(() => {
		mockChildren.length = 0;
		log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => {
		log.mockRestore();
	});

	it('hands the UI server the runtime config script pointing at the API', async () => {
		const { started, child } = start({ host: '0.0.0.0', port: 3000, portUi: 4200 });
		listening(child);
		await started;

		expect(child.env[UI_RUNTIME_CONFIG_SCRIPT_ENV]).toBe(buildUiRuntimeConfigScript('http://127.0.0.1:3000'));
		// CONTROL: the rest of the UI server's configuration is unchanged.
		expect(child.env).toMatchObject({ isPackaged: 'true', serviceName: 'ui', UI_PORT: 4200, UI_HOST: '0.0.0.0' });
	});

	it('uses the host LAN clients reach the API at', async () => {
		const { started, child } = start({ host: '192.168.1.20', port: 3100, portUi: 4200 });
		listening(child);
		await started;

		expect(child.env[UI_RUNTIME_CONFIG_SCRIPT_ENV]).toBe(buildUiRuntimeConfigScript('http://192.168.1.20:3100'));
	});

	it('reads the settings again on restart, so a new API port reaches the UI after "Save"', async () => {
		const { service, started, child } = start({ port: 3000, portUi: 4200 });
		listening(child);
		await started;

		mockSetting.current = { port: 3200, portUi: 4200 };
		const restarted = service.restart();
		const second = mockChildren[mockChildren.length - 1];
		listening(second);
		await restarted;

		expect(second).not.toBe(child);
		expect(second.env[UI_RUNTIME_CONFIG_SCRIPT_ENV]).toBe(buildUiRuntimeConfigScript('http://127.0.0.1:3200'));
	});
});
