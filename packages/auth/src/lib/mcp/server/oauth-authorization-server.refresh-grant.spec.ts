import { OAuth2AuthorizationServer } from './oauth-authorization-server';
import { UserLookupUnavailableError } from './oauth-token-manager';
import { oAuth2ClientManager } from './oauth-client-manager';

/**
 * GHSA-3cgp-wmrg-4fqg, MCP OAuth residual: the refresh_token grant must hand the configured
 * `userInfoProvider` (apps/mcp-auth: active, non-archived users only) to the token manager, and
 * refuse the grant when no provider is wired rather than skip the account check.
 *
 * The server is built without its constructor (which mounts the whole Express app); only the
 * collaborators `handleRefreshTokenGrant` touches are provided.
 */
describe('OAuth2AuthorizationServer refresh_token grant', () => {
	const params = { grant_type: 'refresh_token', refresh_token: 'refresh-1', client_id: 'client-1' };

	function build(userInfoProvider?: (userId: string) => Promise<any>) {
		const server = Object.create(OAuth2AuthorizationServer.prototype) as any;
		const tokenManager = { refreshAccessToken: jest.fn() };
		const errorHandler = { handleOAuthError: jest.fn() };
		const responseBuilder = { sendTokenResponse: jest.fn() };
		Object.assign(server, {
			tokenManager,
			errorHandler,
			responseBuilder,
			securityLogger: { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
			userInfoProvider
		});
		const grant = () => server.handleRefreshTokenGrant({} as any, {} as any, params);
		return { grant, tokenManager, errorHandler, responseBuilder };
	}

	beforeEach(() => {
		jest.spyOn(oAuth2ClientManager, 'validateClient').mockResolvedValue({ clientId: 'client-1' } as any);
	});

	afterEach(() => jest.restoreAllMocks());

	it('passes a resolver backed by userInfoProvider to the token manager (positive control)', async () => {
		const userInfoProvider = jest.fn(async (userId: string) => ({ sub: userId }));
		const { grant, tokenManager, responseBuilder } = build(userInfoProvider);
		tokenManager.refreshAccessToken.mockImplementation(async (_token: string, _client: string, resolveUser) => {
			// The manager calls the resolver with the refresh token's user id.
			expect(await resolveUser('user-1')).toEqual({ sub: 'user-1' });
			return { accessToken: 'new', tokenType: 'Bearer', expiresIn: 900, scope: 'openid' };
		});

		await grant();

		expect(tokenManager.refreshAccessToken).toHaveBeenCalledWith('refresh-1', 'client-1', expect.any(Function));
		expect(userInfoProvider).toHaveBeenCalledWith('user-1');
		expect(responseBuilder.sendTokenResponse).toHaveBeenCalled();
	});

	it('answers invalid_grant when the manager refuses (deactivated user)', async () => {
		const { grant, tokenManager, errorHandler, responseBuilder } = build(async () => null);
		tokenManager.refreshAccessToken.mockResolvedValue(null);

		await grant();

		expect(responseBuilder.sendTokenResponse).not.toHaveBeenCalled();
		expect(errorHandler.handleOAuthError.mock.calls[0][1]).toMatchObject({ error: 'invalid_grant' });
	});

	it('answers a RETRYABLE 503 when the account lookup is unavailable, not invalid_grant', async () => {
		const { grant, errorHandler, responseBuilder, tokenManager } = build(async () => {
			throw new Error('database unavailable');
		});
		tokenManager.refreshAccessToken.mockRejectedValue(new UserLookupUnavailableError('user-1', new Error('db')));

		await grant();

		expect(responseBuilder.sendTokenResponse).not.toHaveBeenCalled();
		expect(errorHandler.handleOAuthError.mock.calls[0][1]).toMatchObject({ error: 'temporarily_unavailable' });
		expect(errorHandler.handleOAuthError.mock.calls[0][2]).toBe(503);
	});

	it('lets any other error reach the token endpoint handler (500)', async () => {
		const { grant, tokenManager, errorHandler } = build(async () => null);
		tokenManager.refreshAccessToken.mockRejectedValue(new Error('boom'));

		await expect(grant()).rejects.toThrow('boom');
		expect(errorHandler.handleOAuthError).not.toHaveBeenCalled();
	});

	it('fails closed, without touching the refresh token, when no userInfoProvider is configured', async () => {
		const { grant, tokenManager, errorHandler, responseBuilder } = build(undefined);

		await grant();

		expect(tokenManager.refreshAccessToken).not.toHaveBeenCalled();
		expect(responseBuilder.sendTokenResponse).not.toHaveBeenCalled();
		expect(errorHandler.handleOAuthError.mock.calls[0][2]).toBe(500);
	});
});
