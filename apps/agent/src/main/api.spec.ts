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

/** Let promise continuations run (fake timers stop `setTimeout`-based waits) */
const flushMicrotasks = async () => {
	for (let i = 0; i < 20; i++) {
		await Promise.resolve();
	}
};

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

	it('bounds a 401 whose token refresh never answers, and gives the refresh its own deadline', async () => {
		jest.useFakeTimers();
		mockStore['auth'].refreshToken = 'refresh';
		mockFetch.mockImplementation((url: string) =>
			url.endsWith('/api/auth/refresh-token')
				? new Promise(() => undefined)
				: Promise.resolve({ ok: false, status: 401, statusText: 'Unauthorized', text: async () => 'expired' })
		);

		const pending = api.getOrganizationTimerSetting(30_000);
		const rejected = expect(pending).rejects.toThrow('timed out');
		await flushMicrotasks();
		const [refreshUrl, refreshInit] = mockFetch.mock.calls[1];
		expect(refreshUrl).toBe('https://api.example.test/api/auth/refresh-token');

		jest.advanceTimersByTime(30_000);
		await rejected;
		expect(refreshInit.signal.aborted).toBe(true);
	});

	it('gives the retry after a token refresh only what is left of the deadline', async () => {
		jest.useFakeTimers();
		mockStore['auth'].refreshToken = 'refresh';
		let refreshed: (response: unknown) => void = () => undefined;
		mockFetch
			.mockResolvedValueOnce({ ok: false, status: 401, statusText: 'Unauthorized', text: async () => 'expired' })
			.mockImplementationOnce(() => new Promise((resolve) => (refreshed = resolve)))
			.mockImplementationOnce(hangingFetch);

		const pending = api.getOrganizationTimerSetting(30_000);
		const rejected = expect(pending).rejects.toThrow('aborted');
		await flushMicrotasks();
		jest.advanceTimersByTime(20_000);
		refreshed({ ok: true, status: 200, statusText: 'OK', json: async () => ({ token: 'fresh' }) });
		await flushMicrotasks();
		const [retryUrl, retryInit] = mockFetch.mock.calls[2];
		expect(retryUrl).toContain('/api/user/me');

		jest.advanceTimersByTime(9_999);
		expect(retryInit.signal.aborted).toBe(false);
		jest.advanceTimersByTime(1);
		await rejected;
	});

	it('leaves requests without a timeout unbounded, as before', async () => {
		mockFetch.mockResolvedValue({ ok: true, status: 200, statusText: 'OK', json: async () => ({ id: 'x' }) });

		await api.get('/api', {});

		const [, init] = mockFetch.mock.calls[0];
		expect(init.signal).toBeUndefined();
	});
});
