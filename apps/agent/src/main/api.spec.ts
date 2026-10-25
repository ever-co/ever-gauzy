/**
 * The organisation settings request had no deadline: a server that accepts the connection but never answers kept it
 * pending, and every later refresh joined that pending request. It is now abandoned (and rejects) after its timeout.
 *
 * `node-fetch` is a stand-in that only settles when told to, or rejects when its signal aborts, as the real one does.
 */
type TStore = Record<string, any>;

const mockStore: TStore = {};
const mockFetch = jest.fn();

jest.mock('node-fetch', () => ({ __esModule: true, default: (...args: unknown[]) => mockFetch(...args) }));
jest.mock('electron', () => ({ screen: {} }));
jest.mock('../environments/environment', () => ({ environment: {} }), { virtual: true });
jest.mock('@gauzy/desktop-lib', () => ({
	LocalStore: { getStore: (key: string) => mockStore[key], updateAuthSetting: jest.fn() }
}));
jest.mock('@gauzy/desktop-activity', () => ({
	TimeLogSourceEnum: { DESKTOP: 'DESKTOP' },
	TimeLogType: { TRACKED: 'TRACKED' }
}));
jest.mock('@gauzy/contracts', () => ({ TaskStatusEnum: { IN_PROGRESS: 'in-progress' } }));
jest.mock('./agent-logger', () => ({
	AgentLogger: { getInstance: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }) }
}));

import { ApiService } from './api';

/** A fetch that never answers, and rejects like node-fetch when its signal aborts */
const hangingFetch = (_url: string, init: { signal?: AbortSignal }) =>
	new Promise((_resolve, reject) => {
		init.signal?.addEventListener('abort', () => {
			const error = new Error('The operation was aborted.');
			error.name = 'AbortError';
			reject(error);
		});
	});

describe('ApiService — organisation timer settings', () => {
	let api: ApiService;

	beforeEach(() => {
		jest.clearAllMocks();
		mockStore['configs'] = { serverUrl: 'https://api.example.test' };
		mockStore['auth'] = {
			token: 'token',
			user: { id: 'user-1', employee: { id: 'employee-1', organizationId: 'org-1', tenantId: 'tenant-1' } }
		};
		api = new ApiService();
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		jest.spyOn(console, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	it('reads the employee organisation from the signed-in user', async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			status: 200,
			statusText: 'OK',
			json: async () => ({ employee: { organization: { id: 'org-1', screenshotFrequency: '3' } } })
		});

		await expect(api.getOrganizationTimerSetting(30_000)).resolves.toEqual({
			id: 'org-1',
			screenshotFrequency: '3'
		});

		const [url] = mockFetch.mock.calls[0];
		expect(url).toBe('https://api.example.test/api/user/me?includeEmployee=true&includeOrganization=true');
	});

	it('abandons the request when it has not completed by the deadline', async () => {
		jest.useFakeTimers();
		mockFetch.mockImplementation(hangingFetch);

		const pending = api.getOrganizationTimerSetting(30_000);
		const rejected = expect(pending).rejects.toThrow('aborted');
		const [, init] = mockFetch.mock.calls[0];

		jest.advanceTimersByTime(29_999);
		expect(init.signal.aborted).toBe(false);
		jest.advanceTimersByTime(1);

		await rejected;
		expect(init.signal.aborted).toBe(true);
	});

	it('clears the deadline once the response arrives', async () => {
		jest.useFakeTimers();
		mockFetch.mockResolvedValue({ ok: true, status: 200, statusText: 'OK', json: async () => ({}) });

		await expect(api.getOrganizationTimerSetting(30_000)).resolves.toBeNull();

		expect(jest.getTimerCount()).toBe(0);
	});

	it('leaves requests without a timeout unbounded, as before', async () => {
		mockFetch.mockResolvedValue({ ok: true, status: 200, statusText: 'OK', json: async () => ({ id: 'x' }) });

		await api.get('/api', {});

		const [, init] = mockFetch.mock.calls[0];
		expect(init.signal).toBeUndefined();
	});
});
