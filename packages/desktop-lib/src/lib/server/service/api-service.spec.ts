/**
 * Owner decision 8 (2026-10-22): the API Gauzy Desktop runs locally listens on 127.0.0.1 only; Gauzy
 * Server and Gauzy API Server listen on the network unless their LAN access setting is off.
 *
 * Before, `setApiConfig()` always passed API_HOST=0.0.0.0, overriding whatever the launcher set, so
 * every desktop app accepted connections from the whole network.
 *
 * Electron cannot run here: the child process, the store and the notices are mocked.
 */
const mockSetting: { current: Record<string, unknown> } = { current: {} };
const mockChildren: Array<{ env: Record<string, unknown>; stdout: any; stderr: any; pid: number }> = [];
const mockRecordSeed = jest.fn();
const mockRecordPublishedPasswords = jest.fn();

jest.mock('electron', () => ({ BrowserWindow: class {}, app: { isPackaged: false } }), { virtual: true });
jest.mock('../../desktop-store', () => ({
	LocalStore: { getStore: jest.fn(() => mockSetting.current), updateConfigSetting: jest.fn() }
}));
// The real decorators module loads the dialogs and the power manager; only Timeout is used here.
jest.mock('../../decorators', () => ({
	Timeout: () => (_target: unknown, _key: unknown, descriptor: unknown) => descriptor
}));
jest.mock('../../desktop-sign-in-notices', () => ({
	DesktopSignInNotices: {
		recordSeed: (...args: unknown[]) => mockRecordSeed(...args),
		recordPublishedPasswords: (...args: unknown[]) => mockRecordPublishedPasswords(...args)
	}
}));
jest.mock('../utils', () => {
	const { EventEmitter } = jest.requireActual('events');
	return {
		...jest.requireActual('../utils/observer'),
		ChildProcessFactory: {
			createProcess: (_path: string, env: Record<string, unknown>) => {
				const child = { env, stdout: new EventEmitter(), stderr: new EventEmitter(), pid: 4242 };
				mockChildren.push(child);
				return child;
			}
		}
	};
});

import { ApiService } from './api-service';

describe('ApiService', () => {
	const window = { isDestroyed: () => false, webContents: { send: jest.fn() } } as any;
	const launcherEnv = { DB_TYPE: 'better-sqlite3', DEMO_SUPER_ADMIN_PASSWORD: 'generated-super-admin-1' };

	/** Starts the service and returns the child process the API would run in. */
	const start = (allowLanAccess: boolean, setting: Record<string, unknown>) => {
		mockSetting.current = setting;
		const service = new ApiService(
			'/app/api/main.js',
			launcherEnv,
			window,
			new AbortController().signal,
			allowLanAccess
		);
		const started = service.start();
		return { service, started, child: mockChildren[mockChildren.length - 1] };
	};
	const listening = (child: (typeof mockChildren)[number]) =>
		child.stdout.emit('data', Buffer.from('Listening at http://127.0.0.1:3000/api\n'));

	let log: jest.SpyInstance;
	let error: jest.SpyInstance;

	beforeEach(() => {
		mockChildren.length = 0;
		mockRecordSeed.mockReset();
		mockRecordPublishedPasswords.mockReset();
		log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
		error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => {
		log.mockRestore();
		error.mockRestore();
	});

	describe('listen address', () => {
		it('Gauzy Desktop: 127.0.0.1, even with a stored lanAccess: true', async () => {
			const { started, child } = start(false, { lanAccess: true, port: 3000 });
			listening(child);
			await started;

			expect(child.env.API_HOST).toBe('127.0.0.1');
		});

		it('CONTROL, server apps: an install from before the setting keeps 0.0.0.0', async () => {
			const { started, child } = start(true, { port: 3000 });
			listening(child);
			await started;

			expect(child.env.API_HOST).toBe('0.0.0.0');
		});

		it('server apps: 127.0.0.1 once LAN access is turned off', async () => {
			const { started, child } = start(true, { lanAccess: false, port: 3000 });
			listening(child);
			await started;

			expect(child.env.API_HOST).toBe('127.0.0.1');
		});

		it('reads the setting again on restart, so turning LAN access off applies after "Save"', async () => {
			const { service, started, child } = start(true, { port: 3000 });
			listening(child);
			await started;
			expect(child.env.API_HOST).toBe('0.0.0.0');

			mockSetting.current = { port: 3000, lanAccess: false };
			const restarted = service.restart();
			const second = mockChildren[mockChildren.length - 1];
			listening(second);
			await restarted;

			expect(second).not.toBe(child);
			expect(second.env.API_HOST).toBe('127.0.0.1');
		});

		it('gives the API a base URL it can be reached at, not the wildcard host', async () => {
			const { started, child } = start(false, { host: '0.0.0.0', port: 3000 });
			listening(child);
			await started;

			expect(child.env.API_BASE_URL).toBe('http://127.0.0.1:3000');
		});

		it('server apps: a LAN host setting gives a loopback base URL once LAN access is off', async () => {
			const { started, child } = start(true, { host: '192.168.1.20', lanAccess: false, port: 3000 });
			listening(child);
			await started;

			expect(child.env.API_HOST).toBe('127.0.0.1');
			expect(child.env.API_BASE_URL).toBe('http://127.0.0.1:3000');
		});

		it('CONTROL, server apps: a LAN host setting is kept while LAN access is on', async () => {
			const { started, child } = start(true, { host: '192.168.1.20', port: 3000 });
			listening(child);
			await started;

			expect(child.env.API_BASE_URL).toBe('http://192.168.1.20:3000');
		});

		it('Gauzy Desktop: a stored LAN host still gives a loopback base URL', async () => {
			const { started, child } = start(false, { host: '192.168.1.20', port: 3000 });
			listening(child);
			await started;

			expect(child.env.API_BASE_URL).toBe('http://127.0.0.1:3000');
		});
	});

	describe('what the API reports', () => {
		it('records a finished seed before start() resolves, with the env the API ran with', async () => {
			const { started, child } = start(false, { port: 3000 });
			child.stdout.emit(
				'data',
				Buffer.from('Database Default Seed Completed\nListening at http://127.0.0.1:3000/api\n')
			);
			await started;

			expect(mockRecordSeed).toHaveBeenCalledTimes(1);
			expect(mockRecordSeed.mock.calls[0][0]).toMatchObject({
				DEMO_SUPER_ADMIN_PASSWORD: 'generated-super-admin-1',
				API_HOST: '127.0.0.1'
			});
		});

		it('finds the seed line when it is split across two chunks, and records it once', async () => {
			const { started, child } = start(false, { port: 3000 });
			child.stdout.emit('data', Buffer.from('Database Default Se'));
			child.stdout.emit('data', Buffer.from('ed Completed\n'));
			child.stdout.emit('data', Buffer.from('more output\n'));
			listening(child);
			await started;

			expect(mockRecordSeed).toHaveBeenCalledTimes(1);
		});

		it('records nothing for an existing database', async () => {
			const { started, child } = start(false, { port: 3000 });
			child.stdout.emit('data', Buffer.from('Found 3 users in DB\n'));
			listening(child);
			await started;

			expect(mockRecordSeed).not.toHaveBeenCalled();
			expect(mockRecordPublishedPasswords).not.toHaveBeenCalled();
		});

		it('records the accounts reported on stderr as still using a published password', async () => {
			const { started, child } = start(true, { port: 3000 });
			listening(child);
			await started;
			// stderr may arrive after "Listening at" on stdout.
			child.stderr.emit('data', Buffer.from(' INSECURE ACCOUNTS: admin@ever.co, employee@ever.co \n'));

			expect(mockRecordPublishedPasswords).toHaveBeenCalledTimes(1);
			expect(mockRecordPublishedPasswords).toHaveBeenCalledWith(['admin@ever.co', 'employee@ever.co']);
		});
	});
});
