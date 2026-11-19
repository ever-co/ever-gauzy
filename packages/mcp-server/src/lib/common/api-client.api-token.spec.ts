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

	it('never puts the token in a log or an answer', async () => {
		serve(() => ({ status: 401, data: { statusCode: 401, message: 'Unauthorized' } }));
		const { apiClient } = await startServer();

		const answers = [await apiClient.login(), apiClient.getAuthStatus()];

		expect(mockPrinted.length).toBeGreaterThan(0);
		expect(JSON.stringify(mockPrinted)).not.toContain(API_TOKEN);
		expect(JSON.stringify(answers)).not.toContain(API_TOKEN);
	});
});
