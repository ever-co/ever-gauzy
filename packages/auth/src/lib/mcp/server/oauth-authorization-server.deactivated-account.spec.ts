import { OAuth2AuthorizationServer } from './oauth-authorization-server';
import { OAuth2TokenManager, TokenPayload } from './oauth-token-manager';
import { oAuth2ClientManager } from './oauth-client-manager';
import { oAuth2AuthorizationCodeManager } from './oauth-authorization-code-manager';

/**
 * Owner decision 6 (2026-10-22): mcp-auth refuses sign-in and token refresh for a deactivated user or
 * employee, and revokes their existing MCP tokens at deactivation.
 *
 * Before: the authorization code was exchanged for tokens without looking at the account again, so a
 * code (or a login session) from before a deactivation still minted a 30-day refresh token;
 * introspection answered `active: true` for any well-signed token of a deactivated user; and nothing
 * ever revoked a token, so a deactivated user's tokens worked again as soon as the account was
 * re-activated, or kept working wherever they were not refreshed.
 *
 * The server is built without its constructor (which mounts the whole Express app), as in
 * `oauth-authorization-server.refresh-grant.spec.ts`. The token manager is the real one, with `jose`
 * stubbed (ESM-only): tokens are opaque handles that verify back to their payload.
 */
describe('OAuth2AuthorizationServer — deactivated accounts', () => {
	const CLIENT_ID = 'client-1';
	const USER_ID = 'user-1';

	let tokenManager: OAuth2TokenManager;
	let payloads: Map<string, TokenPayload>;

	// The client is the registered resource server, the only one the introspection endpoint answers (decision 7).
	// Marked directly: `registerResourceServer` hashes the secret with `bcryptjs`, whose default import is undefined
	// under this project's Jest setup (no `esModuleInterop`).
	beforeAll(() => {
		(oAuth2ClientManager as any).resourceServerIds.add(CLIENT_ID);
	});

	beforeEach(() => {
		tokenManager = new OAuth2TokenManager('https://issuer.test', 'https://audience.test');
		payloads = new Map();
		(tokenManager as any).signToken = jest.fn(async (payload: TokenPayload) => {
			const handle = `token-${payloads.size + 1}`;
			payloads.set(handle, payload);
			return handle;
		});
		(tokenManager as any).securityLogger = { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
		jest.spyOn(oAuth2ClientManager, 'validateClient').mockResolvedValue({
			clientId: CLIENT_ID,
			clientType: 'confidential',
			metadata: { resource_server: true }
		} as any);
	});

	afterEach(() => {
		tokenManager.destroy();
		jest.restoreAllMocks();
	});

	function build(options: {
		userInfoProvider?: (userId: string) => Promise<any>;
		inactiveUsersProvider?: (userIds: string[]) => Promise<string[]>;
	}) {
		const server = Object.create(OAuth2AuthorizationServer.prototype) as any;
		const errorHandler = {
			handleOAuthError: jest.fn(),
			handleAuthError: jest.fn(),
			handleStandardError: jest.fn()
		};
		const responseBuilder = {
			sendTokenResponse: jest.fn(),
			sendIntrospectionResponse: jest.fn(),
			sendUserInfoResponse: jest.fn()
		};
		const oAuthValidator = {
			validateToken: jest.fn(async (token: string) => {
				const payload = payloads.get(token);
				return payload
					? {
							valid: true,
							payload,
							subject: payload.sub,
							scopes: payload.scope.split(' '),
							audience: payload.aud
						}
					: { valid: false, error: 'invalid token' };
			}),
			extractBearerToken: jest.fn((req: any) => req.token)
		};
		Object.assign(server, {
			config: { baseUrl: 'https://auth.test', issuer: 'https://issuer.test', ...options },
			tokenManager,
			errorHandler,
			responseBuilder,
			oAuthValidator,
			securityLogger: { log: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
			userInfoProvider: options.userInfoProvider
		});
		return { server, errorHandler, responseBuilder };
	}

	const signIn = async (userId = USER_ID) => {
		const pair = await tokenManager.generateTokenPair(userId, CLIENT_ID, ['openid', 'profile'], {
			includeRefreshToken: true
		});
		return pair;
	};

	const introspect = (server: any, token: string) =>
		server.handleTokenIntrospection(
			{
				body: { token },
				headers: { authorization: `Basic ${Buffer.from(`${CLIENT_ID}:secret`).toString('base64')}` }
			},
			{}
		);

	describe('authorization code exchange', () => {
		const params = {
			grant_type: 'authorization_code',
			code: 'code-1',
			redirect_uri: 'https://client.test/cb',
			client_id: CLIENT_ID
		};

		let exchange: jest.SpyInstance;

		beforeEach(() => {
			const code = { userId: USER_ID, scopes: ['openid'] } as any;
			jest.spyOn(oAuth2AuthorizationCodeManager, 'checkAuthorizationCode').mockReturnValue(code);
			exchange = jest.spyOn(oAuth2AuthorizationCodeManager, 'exchangeAuthorizationCode').mockReturnValue(code);
		});

		it('positive control: an active account gets its tokens', async () => {
			const { server, responseBuilder } = build({ userInfoProvider: async (id) => ({ userId: id }) });

			await server.handleAuthorizationCodeGrant({}, {}, params);

			expect(responseBuilder.sendTokenResponse).toHaveBeenCalledTimes(1);
		});

		it('refuses a code whose user was deactivated since signing in, and revokes their tokens', async () => {
			const earlier = await signIn();
			const { server, responseBuilder, errorHandler } = build({ userInfoProvider: async () => null });

			await server.handleAuthorizationCodeGrant({}, {}, params);

			expect(responseBuilder.sendTokenResponse).not.toHaveBeenCalled();
			expect(errorHandler.handleOAuthError.mock.calls[0][1]).toMatchObject({ error: 'invalid_grant' });
			expect(errorHandler.handleOAuthError.mock.calls[0][2]).toBe(400);
			expect(tokenManager.isTokenRevoked(payloads.get(earlier.refreshToken!)!)).toBe(true);
		});

		it('answers a retryable 503, minting nothing and leaving the code unused, when the account cannot be looked up', async () => {
			const { server, responseBuilder, errorHandler } = build({
				userInfoProvider: async () => {
					throw new Error('database unavailable');
				}
			});

			await server.handleAuthorizationCodeGrant({}, {}, params);

			expect(responseBuilder.sendTokenResponse).not.toHaveBeenCalled();
			expect(errorHandler.handleOAuthError.mock.calls[0][1]).toMatchObject({ error: 'temporarily_unavailable' });
			expect(errorHandler.handleOAuthError.mock.calls[0][2]).toBe(503);
			expect(exchange).not.toHaveBeenCalled();
		});
	});

	/**
	 * The code was used up before the account lookup, so the retry the 503 asks for answered `invalid_grant` even once
	 * the database was back: the person had to sign in again. The code manager is the real one here.
	 */
	describe('authorization code exchange after a failed account lookup', () => {
		const REDIRECT_URI = 'https://client.test/cb';

		const issueCode = () =>
			oAuth2AuthorizationCodeManager.generateAuthorizationCode(CLIENT_ID, USER_ID, REDIRECT_URI, ['openid']);

		const exchangeParams = (code: string) => ({
			grant_type: 'authorization_code',
			code,
			redirect_uri: REDIRECT_URI,
			client_id: CLIENT_ID
		});

		it('keeps the code for the retry, which gets the tokens, and the code is still single-use', async () => {
			let databaseUp = false;
			const { server, responseBuilder, errorHandler } = build({
				userInfoProvider: async (id) => {
					if (!databaseUp) {
						throw new Error('database unavailable');
					}
					return { userId: id };
				}
			});
			const params = exchangeParams(issueCode());

			await server.handleAuthorizationCodeGrant({}, {}, params);
			expect(errorHandler.handleOAuthError.mock.calls[0][2]).toBe(503);

			databaseUp = true;
			await server.handleAuthorizationCodeGrant({}, {}, params);
			expect(responseBuilder.sendTokenResponse).toHaveBeenCalledTimes(1);

			await server.handleAuthorizationCodeGrant({}, {}, params);
			expect(responseBuilder.sendTokenResponse).toHaveBeenCalledTimes(1);
			expect(errorHandler.handleOAuthError.mock.calls[1][1]).toMatchObject({ error: 'invalid_grant' });
		});

		it('gives the tokens to one of two exchanges racing with the same code', async () => {
			const { server, responseBuilder, errorHandler } = build({
				userInfoProvider: async (id) => {
					await new Promise((resolve) => setImmediate(resolve));
					return { userId: id };
				}
			});
			const params = exchangeParams(issueCode());

			await Promise.all([
				server.handleAuthorizationCodeGrant({}, {}, params),
				server.handleAuthorizationCodeGrant({}, {}, params)
			]);

			expect(responseBuilder.sendTokenResponse).toHaveBeenCalledTimes(1);
			expect(errorHandler.handleOAuthError).toHaveBeenCalledTimes(1);
			expect(errorHandler.handleOAuthError.mock.calls[0][1]).toMatchObject({ error: 'invalid_grant' });
		});

		it('uses up the code of an account that can no longer sign in', async () => {
			const { server, errorHandler } = build({ userInfoProvider: async () => null });
			const code = issueCode();

			await server.handleAuthorizationCodeGrant({}, {}, exchangeParams(code));

			expect(errorHandler.handleOAuthError.mock.calls[0][1]).toMatchObject({ error: 'invalid_grant' });
			expect(oAuth2AuthorizationCodeManager.getAuthorizationCode(code)?.isUsed).toBe(true);
		});
	});

	describe('introspection', () => {
		it('positive control: an active user’s token is active', async () => {
			const { accessToken } = await signIn();
			const { server, responseBuilder } = build({ userInfoProvider: async (id) => ({ userId: id }) });

			await introspect(server, accessToken);

			expect(responseBuilder.sendIntrospectionResponse.mock.calls[0][1]).toMatchObject({
				active: true,
				sub: USER_ID
			});
		});

		it('answers inactive for a deactivated user’s token, and revokes their tokens', async () => {
			const { accessToken, refreshToken } = await signIn();
			const { server, responseBuilder } = build({ userInfoProvider: async () => null });

			await introspect(server, accessToken);

			expect(responseBuilder.sendIntrospectionResponse.mock.calls[0][1]).toEqual({ active: false });
			expect(tokenManager.isTokenRevoked(payloads.get(refreshToken!)!)).toBe(true);
		});

		it('keeps answering inactive for a revoked token after the account is re-activated', async () => {
			const { accessToken } = await signIn();
			tokenManager.revokeUserTokens(USER_ID);
			const userInfoProvider = jest.fn(async (id: string) => ({ userId: id }));
			const { server, responseBuilder } = build({ userInfoProvider });

			await introspect(server, accessToken);

			expect(responseBuilder.sendIntrospectionResponse.mock.calls[0][1]).toEqual({ active: false });
			expect(userInfoProvider).not.toHaveBeenCalled();
		});

		it('answers a retryable 503, never active, when the account cannot be looked up', async () => {
			const { accessToken } = await signIn();
			const { server, responseBuilder, errorHandler } = build({
				userInfoProvider: async () => {
					throw new Error('database unavailable');
				}
			});

			await introspect(server, accessToken);

			expect(responseBuilder.sendIntrospectionResponse).not.toHaveBeenCalled();
			expect(errorHandler.handleOAuthError.mock.calls[0][2]).toBe(503);
		});

		it('does not look up an account for a client_credentials token', async () => {
			const pair = await tokenManager.generateTokenPair(CLIENT_ID, CLIENT_ID, ['mcp.read'], {
				customClaims: { token_use: 'client_credentials' }
			});
			const userInfoProvider = jest.fn(async () => null);
			const { server, responseBuilder } = build({ userInfoProvider });

			await introspect(server, pair.accessToken);

			expect(userInfoProvider).not.toHaveBeenCalled();
			expect(responseBuilder.sendIntrospectionResponse.mock.calls[0][1]).toMatchObject({ active: true });
		});
	});

	it('userinfo refuses a revoked token', async () => {
		const { accessToken } = await signIn();
		tokenManager.revokeUserTokens(USER_ID);
		const userInfoProvider = jest.fn(async (id: string) => ({ userId: id }));
		const { server, responseBuilder, errorHandler } = build({ userInfoProvider });

		await server.handleUserInfo({ token: accessToken }, {});

		expect(responseBuilder.sendUserInfoResponse).not.toHaveBeenCalled();
		expect(errorHandler.handleAuthError.mock.calls[0][1]).toMatchObject({ error: 'invalid_token' });
		expect(userInfoProvider).not.toHaveBeenCalled();
	});

	describe('account sweep', () => {
		it('revokes the tokens of every refresh token holder the provider names, unused tokens included', async () => {
			const deactivated = await signIn('user-1');
			const active = await signIn('user-2');
			const inactiveUsersProvider = jest.fn(async (ids: string[]) => ids.filter((id) => id === 'user-1'));
			const { server } = build({ inactiveUsersProvider });

			expect(await server.revokeTokensOfInactiveAccounts()).toBe(1);

			expect(inactiveUsersProvider).toHaveBeenCalledWith(expect.arrayContaining(['user-1', 'user-2']));
			expect(tokenManager.isTokenRevoked(payloads.get(deactivated.refreshToken!)!)).toBe(true);
			expect(tokenManager.isTokenRevoked(payloads.get(deactivated.accessToken)!)).toBe(true);
			expect(tokenManager.isTokenRevoked(payloads.get(active.refreshToken!)!)).toBe(false);
		});

		it('ignores ids it did not ask about', async () => {
			await signIn('user-2');
			const { server } = build({ inactiveUsersProvider: async () => ['someone-else'] });

			expect(await server.revokeTokensOfInactiveAccounts()).toBe(0);
			expect((tokenManager as any).userRevocations.size).toBe(0);
		});

		it('revokes nothing when the lookup fails', async () => {
			const { refreshToken } = await signIn('user-1');
			const { server } = build({
				inactiveUsersProvider: async () => {
					throw new Error('database unavailable');
				}
			});

			expect(await server.revokeTokensOfInactiveAccounts()).toBe(0);
			expect(tokenManager.isTokenRevoked(payloads.get(refreshToken!)!)).toBe(false);
		});

		it('asks about at most 500 users at a time', async () => {
			for (let i = 0; i < 1201; i++) {
				await signIn(`user-${i}`);
			}
			const inactiveUsersProvider = jest.fn(async (_ids: string[]) => [] as string[]);
			const { server } = build({ inactiveUsersProvider });

			await server.revokeTokensOfInactiveAccounts();

			expect(inactiveUsersProvider.mock.calls.map(([ids]) => ids.length)).toEqual([500, 500, 201]);
		});
	});
});
