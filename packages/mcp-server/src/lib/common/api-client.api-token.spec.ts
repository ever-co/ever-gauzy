import type { AxiosError } from 'axios';
import type { GauzyApiClient } from './api-client';
import type { AuthManager } from './auth-manager';

const API_TOKEN = `gzp_${'A1b2-C3d4_'.repeat(4)}xyz`;

const mockEnvironment = {
	baseUrl: 'http://api.test',
	apiTimeout: 1000,
	// Every debug line runs, so that the tests see everything the client could print
	debug: true,
	auth: { autoLogin: true, email: '', password: '', apiToken: API_TOKEN }
};
jest.mock('../environments/environment', () => ({ environment: mockEnvironment }));

// Every module loads its own copy of the logger here: each copy writes down what it is given
const mockPrinted: unknown[][] = [];
jest.mock('@nestjs/common', () => {
	const record = (...args: unknown[]) => {
		mockPrinted.push(args);
	};
	class RecordingLogger {
		log = record;
		warn = record;
		error = record;
		debug = record;
	}
	return { ...jest.requireActual('@nestjs/common'), Logger: RecordingLogger };
});

interface IFakeRequest {
	method: string;
	url: string;
	authorization?: string;
	body?: Record<string, unknown>;
}

interface IFakeReply {
	status: number;
	data?: unknown;
	/** The request fails before any answer, with this message, as a dropped connection does */
	networkError?: string;
}

/** The API the client talks to in a test: each test answers its requests */
let mockServer: (request: IFakeRequest) => IFakeReply;
const mockRequests: IFakeRequest[] = [];

/** Takes the place of axios' HTTP adapter: nothing leaves the process */
async function mockAdapter(config: any) {
	const { AxiosError } = jest.requireActual('axios');
	const request: IFakeRequest = {
		method: String(config.method).toUpperCase(),
		url: config.url,
		authorization: config.headers?.Authorization,
		body: config.data ? JSON.parse(config.data) : undefined
	};
	mockRequests.push(request);
	const reply = mockServer(request);
	if (reply.networkError) {
		throw new AxiosError(reply.networkError, 'ECONNRESET', config, {});
	}
	const response = { data: reply.data, status: reply.status, statusText: '', headers: {}, config, request: {} };
	if (reply.status >= 400) {
		throw new AxiosError(`Request failed with status code ${reply.status}`, 'ERR_BAD_REQUEST', config, {}, response);
	}
	return response;
}

jest.mock('axios', () => {
	const actual = jest.requireActual('axios');
	const create = (config: Record<string, unknown>) => actual.default.create({ ...config, adapter: mockAdapter });
	return { ...actual, __esModule: true, default: { ...actual.default, create } };
});

/** An access token the client reads an expiry from, `seconds` ahead */
const accessToken = (name: string, seconds = 3600) =>
	[
		Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url'),
		Buffer.from(JSON.stringify({ sub: name, exp: Math.floor(Date.now() / 1000) + seconds })).toString('base64url'),
		'signature'
	].join('.');

const USER = { id: 'token-user', tenantId: 'tenant-1', employee: { organizationId: 'organization-1' } };
const TIMER_STATUS = '/api/timesheet/timer/status';

const isExchange = (request: IFakeRequest) => request.url === '/api/auth/api-token/exchange';
const exchanges = () => mockRequests.filter(isExchange);
const callsTo = (url: string) => mockRequests.filter((request) => request.url === url);

/**
 * Starts the client as the server does, signing in at once, and waits for that sign-in to end
 */
async function startServer(): Promise<{ apiClient: GauzyApiClient; authManager: AuthManager }> {
	let loaded: { apiClient: GauzyApiClient; authManager: AuthManager };
	jest.isolateModules(() => {
		loaded = {
			apiClient: require('./api-client').apiClient,
			authManager: require('./auth-manager').authManager
		};
	});
	while (loaded.authManager.getAuthStatus().isLoginInProgress) {
		await new Promise((resolve) => setImmediate(resolve));
	}
	return loaded;
}

/** Answers the exchange with `exchange`, `/api/user/me` with the user, and anything else with `other` */
function serve(exchange: () => IFakeReply, other: (request: IFakeRequest) => IFakeReply = () => ({ status: 200 })) {
	mockServer = (request) => {
		if (isExchange(request)) {
			return exchange();
		}
		if (request.url === '/api/user/me') {
			return { status: 200, data: USER };
		}
		return other(request);
	};
}

describe('GauzyApiClient: signed in with GAUZY_API_TOKEN', () => {
	beforeEach(() => {
		mockEnvironment.auth = { autoLogin: true, email: '', password: '', apiToken: API_TOKEN };
		mockRequests.length = 0;
		mockPrinted.length = 0;
	});

	it('sends the exchanged access token with the next request', async () => {
		const exchanged = accessToken('exchanged');
		serve(() => ({ status: 200, data: { token: exchanged } }));
		const { apiClient } = await startServer();

		await apiClient.get(TIMER_STATUS);

		expect(exchanges()).toHaveLength(1);
		expect(exchanges()[0].authorization).toBeUndefined();
		expect(callsTo(TIMER_STATUS)[0].authorization).toBe(`Bearer ${exchanged}`);
	});

	it('answers a sign-in without credentials with why the token was refused', async () => {
		serve(() => ({ status: 401, data: { statusCode: 401, message: 'Unauthorized' } }));
		const { apiClient } = await startServer();

		const result = await apiClient.login();

		expect(result.success).toBe(false);
		expect(result.error).toContain('Create a new token in Settings > API Tokens');
	});

	it('keeps the answer of the login tool to a wrong password as it was', async () => {
		serve(
			() => ({ status: 401 }),
			() => ({ status: 401, data: { statusCode: 401, message: 'Unauthorized' } })
		);
		const { apiClient } = await startServer();

		const result = await apiClient.login('caller@example.com', 'wrong-password');

		expect(result).toEqual({ success: false });
	});

	describe('once the session ends', () => {
		/** Answers in turn, the last answer for good */
		const inTurn = (...replies: IFakeReply[]) => {
			let next = 0;
			return () => replies[Math.min(next++, replies.length - 1)];
		};
		const REFUSED: IFakeReply = { status: 401, data: { statusCode: 401, message: 'Unauthorized' } };
		const first = accessToken('first');
		const renewed = accessToken('renewed');

		it('exchanges the token again when the access token expired, and sends the request with the new one', async () => {
			// Inside the ten seconds the client keeps in hand, so expired already
			const expiring = accessToken('expiring', 5);
			serve(inTurn({ status: 200, data: { token: expiring } }, { status: 200, data: { token: renewed } }));
			const { apiClient } = await startServer();

			await apiClient.get(TIMER_STATUS);

			expect(exchanges()).toHaveLength(2);
			expect(callsTo(TIMER_STATUS).map((request) => request.authorization)).toEqual([`Bearer ${renewed}`]);
		});

		it('exchanges the token again once for a 401, and sends the request again with the new one', async () => {
			serve(
				inTurn({ status: 200, data: { token: first } }, { status: 200, data: { token: renewed } }),
				inTurn(REFUSED, { status: 200, data: { running: false } })
			);
			const { apiClient } = await startServer();

			await expect(apiClient.get(TIMER_STATUS)).resolves.toEqual({ running: false });

			expect(exchanges()).toHaveLength(2);
			expect(callsTo(TIMER_STATUS).map((request) => request.authorization)).toEqual([
				`Bearer ${first}`,
				`Bearer ${renewed}`
			]);
		});

		it('ends with the message to create a new token when the exchange is refused, and sends it no more', async () => {
			serve(inTurn({ status: 200, data: { token: first } }, REFUSED), () => REFUSED);
			const { apiClient, authManager } = await startServer();

			const failure = await apiClient.get<never>(TIMER_STATUS).catch((error: AxiosError) => error);
			const next = await apiClient.get<never>(TIMER_STATUS).catch((error: AxiosError) => error);

			expect(failure.message).toContain('Create a new token in Settings > API Tokens');
			expect(failure.response.status).toBe(401);
			expect(next.message).toContain('Create a new token in Settings > API Tokens');
			expect(exchanges()).toHaveLength(2);
			expect(authManager.isAuthenticated()).toBe(false);
		});

		it('does not loop when the API keeps answering 401 to a new access token', async () => {
			let issued = 0;
			serve(
				() => ({ status: 200, data: { token: accessToken(`issued-${++issued}`) } }),
				() => REFUSED
			);
			const { apiClient } = await startServer();

			await expect(apiClient.get(TIMER_STATUS)).rejects.toMatchObject({ response: { status: 401 } });

			expect(exchanges()).toHaveLength(2);
			expect(callsTo(TIMER_STATUS)).toHaveLength(2);
		});

		it('CONTROL: without a token, a 401 still renews the password sign-in with its refresh token', async () => {
			mockEnvironment.auth = {
				autoLogin: true,
				email: 'operator@example.com',
				password: 'operator-password',
				apiToken: ''
			};
			const refreshed = accessToken('refreshed');
			const timer = inTurn(REFUSED, { status: 200, data: { running: true } });
			serve(
				() => REFUSED,
				(request) => {
					if (request.url === '/api/auth/login') {
						return { status: 200, data: { token: first, refresh_token: 'refresh-1', user: { id: 'u' } } };
					}
					if (request.url === '/api/auth/refresh-token') {
						return { status: 200, data: { token: refreshed, refresh_token: 'refresh-2' } };
					}
					return timer();
				}
			);
			const { apiClient } = await startServer();

			await expect(apiClient.get(TIMER_STATUS)).resolves.toEqual({ running: true });

			expect(exchanges()).toHaveLength(0);
			expect(callsTo('/api/auth/refresh-token')[0].body).toEqual({ refresh_token: 'refresh-1' });
			expect(callsTo(TIMER_STATUS).map((request) => request.authorization)).toEqual([
				`Bearer ${first}`,
				`Bearer ${refreshed}`
			]);
		});
	});

	it('never puts the token in a log or an answer', async () => {
		// An API that quotes the token it refuses
		serve(() => ({
			status: 401,
			data: { statusCode: 401, message: `Unauthorized: ${API_TOKEN}`, token: API_TOKEN }
		}));
		const { apiClient } = await startServer();

		const answers = [await apiClient.login(), apiClient.getAuthStatus()];

		expect(mockPrinted.length).toBeGreaterThan(0);
		expect(JSON.stringify(mockPrinted)).not.toContain(API_TOKEN);
		expect(JSON.stringify(answers)).not.toContain(API_TOKEN);
	});

	it('never prints the token an error message or stack carries, from any request', async () => {
		const dropped: IFakeReply = { status: 0, networkError: `socket hang up after ${API_TOKEN}` };
		let signIns = 0;
		mockServer = (request) => {
			if (isExchange(request)) {
				return { status: 200, data: { token: accessToken('exchanged') } };
			}
			if (request.url === '/api/health') {
				return { status: 200 };
			}
			// The sign-in reads the user; the connection test's read of it fails
			if (request.url === '/api/user/me' && signIns++ === 0) {
				return { status: 200, data: USER };
			}
			return dropped;
		};
		const { apiClient } = await startServer();

		const failure = await apiClient.get<never>(TIMER_STATUS).catch((error: AxiosError) => error);
		await apiClient.testConnection();

		expect(failure.code).toBe('ECONNRESET');
		expect(callsTo('/api/user/me')).toHaveLength(2);
		expect(mockPrinted.length).toBeGreaterThan(0);
		expect(JSON.stringify(mockPrinted)).not.toContain(API_TOKEN);
	});
});
