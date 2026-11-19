import type { AuthManager } from './auth-manager';
import type { runWithAuthKey as RunWithAuthKey } from './auth-context';

const API_TOKEN = `gzp_${'A1b2-C3d4_'.repeat(4)}xyz`;

const mockEnvironment = {
	// Every debug line runs, so that the tests see everything the manager could print
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

/** An access token the manager reads an expiry from, `seconds` ahead */
const accessToken = (name: string, seconds = 3600) =>
	[
		Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url'),
		Buffer.from(JSON.stringify({ sub: name, exp: Math.floor(Date.now() / 1000) + seconds })).toString('base64url'),
		'signature'
	].join('.');

/** What axios throws for an answer with this status */
const httpError = (status: number) =>
	Object.assign(new Error(`Request failed with status code ${status}`), {
		response: { status, data: { statusCode: status } }
	});

const EXCHANGED = accessToken('exchanged');
const SIGNED_IN = accessToken('signed-in');

/** A stand-in for the API client: it answers the exchange with `exchange`, and writes down every request */
function fakeApi(exchange: () => unknown) {
	const requests: Array<{ method: string; url: string; body?: unknown }> = [];
	return {
		requests,
		post: async (url: string, body?: unknown) => {
			requests.push({ method: 'POST', url, body });
			if (url === '/api/auth/api-token/exchange') {
				return exchange();
			}
			return { token: SIGNED_IN, refresh_token: 'refresh', user: { id: 'password-user' } };
		},
		get: async (url: string) => {
			requests.push({ method: 'GET', url });
			return { id: 'token-user', tenantId: 'tenant-1', employee: { organizationId: 'organization-1' } };
		}
	};
}

const urls = (api: ReturnType<typeof fakeApi>) => api.requests.map((request) => request.url);

/** A new AuthManager with its own auth context, as a fresh server start has */
function startServer(api: ReturnType<typeof fakeApi>): { authManager: AuthManager; runWithAuthKey: typeof RunWithAuthKey } {
	let loaded: { authManager: AuthManager; runWithAuthKey: typeof RunWithAuthKey };
	jest.isolateModules(() => {
		const authManager: AuthManager = require('./auth-manager').AuthManager.getInstance();
		authManager.setApiClient(api);
		loaded = { authManager, runWithAuthKey: require('./auth-context').runWithAuthKey };
	});
	return loaded;
}

describe('AuthManager: signing in with GAUZY_API_TOKEN', () => {
	beforeEach(() => {
		mockEnvironment.auth = { autoLogin: true, email: '', password: '', apiToken: API_TOKEN };
		mockPrinted.length = 0;
	});

	it('signs in at start by exchanging the token, with no email or password', async () => {
		const api = fakeApi(() => ({ token: EXCHANGED }));
		const { authManager } = startServer(api);

		expect(await authManager.initialize()).toBe(true);

		expect(api.requests[0]).toEqual({
			method: 'POST',
			url: '/api/auth/api-token/exchange',
			body: { token: API_TOKEN }
		});
		expect(urls(api)).toEqual(['/api/auth/api-token/exchange', '/api/user/me']);
		expect(authManager.getAccessToken()).toBe(EXCHANGED);
		expect(authManager.getUserId()).toBe('token-user');
		expect(authManager.getDefaultParams()).toEqual({ tenantId: 'tenant-1', organizationId: 'organization-1' });
		expect(authManager.getAuthStatus()).toMatchObject({ isAuthenticated: true, hasRefreshToken: false });
	});

	it('uses the token over an email and a password set as well', async () => {
		mockEnvironment.auth = {
			autoLogin: true,
			email: 'operator@example.com',
			password: 'operator-password',
			apiToken: API_TOKEN
		};
		const api = fakeApi(() => ({ token: EXCHANGED }));
		const { authManager } = startServer(api);

		await authManager.initialize();

		expect(urls(api)).not.toContain('/api/auth/login');
		expect(authManager.getAccessToken()).toBe(EXCHANGED);
	});

	it('keeps the login tool on the email and password it names', async () => {
		const api = fakeApi(() => ({ token: EXCHANGED }));
		const { authManager } = startServer(api);

		expect(await authManager.login('caller@example.com', 'caller-password')).toBe(true);

		expect(urls(api)).toEqual(['/api/auth/login', '/api/user/me']);
		expect(authManager.getAccessToken()).toBe(SIGNED_IN);
		expect(authManager.getApiTokenError()).toBeNull();
	});

	it('says to create a new token when the API refuses it, and sends it no more', async () => {
		const api = fakeApi(() => {
			throw httpError(401);
		});
		const { authManager } = startServer(api);

		expect(await authManager.initialize()).toBe(false);
		expect(await authManager.login()).toBe(false);

		expect(urls(api)).toEqual(['/api/auth/api-token/exchange']);
		expect(authManager.getApiTokenError()).toBe(
			'The Gauzy API token was refused: it was revoked, it expired, or this server does not know it. ' +
				'Create a new token in Settings > API Tokens of the Gauzy web app, ' +
				'put it in GAUZY_API_TOKEN and restart the MCP server.'
		);
		expect(JSON.stringify(mockPrinted)).toContain('Create a new token in Settings > API Tokens');
	});

	it('says that personal API tokens are off when the exchange route answers 404', async () => {
		const api = fakeApi(() => {
			throw httpError(404);
		});
		const { authManager } = startServer(api);

		expect(await authManager.initialize()).toBe(false);

		expect(authManager.getApiTokenError()).toBe(
			'Personal API tokens are off on this Gauzy server. ' +
				'Its administrator turns them on with GAUZY_USER_API_TOKENS_ENABLED=true.'
		);
		// The administrator may turn them on without this server restarting: the token is tried again when asked
		expect(await authManager.login()).toBe(false);
		expect(urls(api)).toEqual(['/api/auth/api-token/exchange', '/api/auth/api-token/exchange']);
	});

	it('says why an exchange failed when the API could not judge the token', async () => {
		const api = fakeApi(() => {
			throw new Error('connect ECONNREFUSED 127.0.0.1:3000');
		});
		const { authManager } = startServer(api);

		await authManager.initialize();

		expect(authManager.getApiTokenError()).toBe(
			'Could not exchange the Gauzy API token: connect ECONNREFUSED 127.0.0.1:3000'
		);
	});

	describe('as the auto-login account of the HTTP and WebSocket transports (#11261)', () => {
		it('is shared with a caller on this machine, and with no one else', async () => {
			const api = fakeApi(() => ({ token: EXCHANGED }));
			const { authManager, runWithAuthKey } = startServer(api);
			await authManager.initialize();

			const local = runWithAuthKey('session-local', () => authManager.getAccessToken(), { sharesAutoLogin: true });
			const remote = runWithAuthKey('session-remote', () => authManager.getAccessToken(), {
				sharesAutoLogin: false
			});

			expect(local).toBe(EXCHANGED);
			expect(remote).toBeNull();
		});

		it('is not exchanged for a caller from elsewhere that names no credentials', async () => {
			const api = fakeApi(() => ({ token: EXCHANGED }));
			const { authManager, runWithAuthKey } = startServer(api);

			const signedIn = await runWithAuthKey('session-remote', () => authManager.login(), {
				sharesAutoLogin: false
			});

			expect(signedIn).toBe(false);
			expect(api.requests).toEqual([]);
		});

		it('tells a caller from elsewhere nothing about the token', async () => {
			const api = fakeApi(() => {
				throw httpError(401);
			});
			const { authManager, runWithAuthKey } = startServer(api);
			await authManager.initialize();

			const told = runWithAuthKey('session-remote', () => authManager.getApiTokenError(), {
				sharesAutoLogin: false
			});

			expect(told).toBeNull();
		});
	});

	describe('once the access token expires or the API answers 401', () => {
		/** Answers the exchanges in turn, the last one for good */
		const inTurn = (...answers: Array<() => unknown>) => {
			let next = 0;
			return () => answers[Math.min(next++, answers.length - 1)]();
		};
		// Inside the ten seconds the manager keeps in hand, so expired already
		const EXPIRING = accessToken('expiring', 5);
		const RENEWED = accessToken('renewed');

		it('exchanges the token again when the access token expires, without a restart', async () => {
			const api = fakeApi(inTurn(() => ({ token: EXPIRING }), () => ({ token: RENEWED })));
			const { authManager } = startServer(api);
			await authManager.initialize();

			expect(authManager.isAuthenticated()).toBe(false);
			expect(await authManager.ensureValidToken()).toBe(true);

			expect(urls(api)).toEqual(['/api/auth/api-token/exchange', '/api/user/me', '/api/auth/api-token/exchange']);
			expect(authManager.getAccessToken()).toBe(RENEWED);
			expect(authManager.getUserId()).toBe('token-user');
		});

		it('exchanges the token again for a 401, which renews the session through refreshToken', async () => {
			const api = fakeApi(inTurn(() => ({ token: EXCHANGED }), () => ({ token: RENEWED })));
			const { authManager } = startServer(api);
			await authManager.initialize();

			expect(await authManager.refreshToken()).toBe(true);

			expect(urls(api)).not.toContain('/api/auth/refresh-token');
			expect(authManager.getAccessToken()).toBe(RENEWED);
		});

		it('ends the sign-in when the API refuses the token, and sends it no more', async () => {
			const api = fakeApi(
				inTurn(
					() => ({ token: EXCHANGED }),
					() => {
						throw httpError(401);
					}
				)
			);
			const { authManager } = startServer(api);
			await authManager.initialize();

			expect(await authManager.refreshToken()).toBe(false);
			expect(await authManager.ensureValidToken()).toBe(false);
			expect(await authManager.refreshToken()).toBe(false);

			expect(urls(api).filter((url) => url === '/api/auth/api-token/exchange')).toHaveLength(2);
			expect(authManager.getAuthStatus()).toMatchObject({ isAuthenticated: false, hasToken: false });
			expect(authManager.getAccessToken()).toBeNull();
			expect(authManager.getApiTokenError()).toContain('Create a new token in Settings > API Tokens');
		});

		it('keeps the session when an exchange fails without a refusal, and tries again when asked', async () => {
			const api = fakeApi(
				inTurn(
					() => ({ token: EXPIRING }),
					() => {
						throw new Error('connect ECONNREFUSED 127.0.0.1:3000');
					},
					() => ({ token: RENEWED })
				)
			);
			const { authManager } = startServer(api);
			await authManager.initialize();

			expect(await authManager.ensureValidToken()).toBe(false);
			expect(await authManager.ensureValidToken()).toBe(true);

			expect(authManager.getAccessToken()).toBe(RENEWED);
			expect(authManager.getApiTokenError()).toBeNull();
		});

		it('renews the account a caller on this machine shares, and not for a caller from elsewhere', async () => {
			const api = fakeApi(inTurn(() => ({ token: EXPIRING }), () => ({ token: RENEWED })));
			const { authManager, runWithAuthKey } = startServer(api);
			await authManager.initialize();

			const remote = await runWithAuthKey('session-remote', () => authManager.refreshToken(), {
				sharesAutoLogin: false
			});
			const local = await runWithAuthKey('session-local', () => authManager.ensureValidToken(), {
				sharesAutoLogin: true
			});

			expect(remote).toBe(false);
			expect(local).toBe(true);
			expect(urls(api).filter((url) => url === '/api/auth/api-token/exchange')).toHaveLength(2);
			expect(authManager.getAccessToken()).toBe(RENEWED);
		});
	});

	it('never puts the token in a log, an error or the auth status', async () => {
		const answers = [
			() => ({ token: EXCHANGED }),
			() => {
				throw httpError(404);
			},
			() => {
				throw new Error(`echoed ${API_TOKEN}`);
			},
			() => {
				throw httpError(401);
			}
		];
		const seen: unknown[] = [];

		for (const answer of answers) {
			const { authManager } = startServer(fakeApi(answer));
			await authManager.initialize();
			seen.push(authManager.getAuthStatus(), authManager.getApiTokenError());
		}

		expect(mockPrinted.length).toBeGreaterThan(0);
		expect(JSON.stringify(mockPrinted)).not.toContain(API_TOKEN);
		expect(JSON.stringify(seen)).not.toContain(API_TOKEN);
	});
});
