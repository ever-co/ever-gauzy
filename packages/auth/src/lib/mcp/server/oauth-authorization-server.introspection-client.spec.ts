/**
 * A stand-in hash: this project's Jest setup compiles without `esModuleInterop`, so the client manager's default
 * import of `bcryptjs` would be undefined here. The comparison still tells a right secret from a wrong one.
 */
jest.mock('bcryptjs', () => ({
	__esModule: true,
	default: {
		hash: async (secret: string) => `hashed:${secret}`,
		compare: async (secret: string, hash: string) => hash === `hashed:${secret}`
	}
}));

import { OAuth2AuthorizationServer } from './oauth-authorization-server';
import { OAuth2ClientManager, oAuth2ClientManager } from './oauth-client-manager';
import { OAuth2TokenManager, TokenPayload } from './oauth-token-manager';

/**
 * Owner decision 7 (2026-10-22): the MCP server asks mcp-auth's introspection endpoint whether each token is active.
 *
 * For that answer to mean anything:
 * - only the resource server the operator registered may ask. `validateClient` lets a public client (such as the
 *   pre-registered `chatgpt-mcp-client`) through with no secret, and anyone may register a confidential client;
 * - a refresh token is not a bearer credential for the MCP server, so it is never answered as active there.
 */
describe('mcp-auth token introspection — who may ask, and about what', () => {
	const RESOURCE_SERVER = 'mcp-server';
	const SECRET = 'a-resource-server-secret-of-32-characters!';

	describe('OAuth2ClientManager.registerResourceServer', () => {
		it('registers a confidential client that authenticates with its secret, and nothing else', async () => {
			const manager = new OAuth2ClientManager();
			(manager as any).securityLogger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };

			await manager.registerResourceServer(RESOURCE_SERVER, SECRET);

			const client = await manager.validateClient(RESOURCE_SERVER, SECRET);
			expect(manager.isResourceServer(client)).toBe(true);
			expect(client).toMatchObject({ clientType: 'confidential', grantTypes: [], redirectUris: [] });
			expect(await manager.validateClient(RESOURCE_SERVER, 'wrong-secret')).toBeNull();
		});

		it('refuses a short secret, or a client id already taken', async () => {
			const manager = new OAuth2ClientManager();
			(manager as any).securityLogger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
			await manager.registerDefaultClients();

			await expect(manager.registerResourceServer(RESOURCE_SERVER, 'short')).rejects.toThrow();
			await expect(manager.registerResourceServer('chatgpt-mcp-client', SECRET)).rejects.toThrow();
		});

		it('does not count the pre-registered or self-registered clients as resource servers', async () => {
			const manager = new OAuth2ClientManager();
			(manager as any).securityLogger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
			await manager.registerDefaultClients();
			const registered = await manager.registerClient({
				client_name: 'Anyone',
				redirect_uris: ['https://anyone.test/callback']
			});

			expect(manager.isResourceServer(await manager.validateClient('chatgpt-mcp-client'))).toBe(false);
			expect(
				manager.isResourceServer(await manager.validateClient(registered.client_id, registered.client_secret))
			).toBe(false);
		});

		it('does not count a self-registered client that claims to be a resource server in its metadata', async () => {
			const manager = new OAuth2ClientManager();
			(manager as any).securityLogger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
			const registered = await manager.registerClient({
				client_name: 'Anyone',
				redirect_uris: ['https://anyone.test/callback'],
				metadata: { resource_server: true }
			});

			const client = await manager.validateClient(registered.client_id, registered.client_secret);
			expect(client).toMatchObject({ clientType: 'confidential', metadata: { resource_server: true } });
			expect(manager.isResourceServer(client)).toBe(false);
		});
	});

	describe('the introspection endpoint', () => {
		let tokenManager: OAuth2TokenManager;
		let payloads: Map<string, TokenPayload>;

		// The endpoint asks the shared client manager, which answers only the resource server registered with it
		beforeAll(async () => {
			(oAuth2ClientManager as any).securityLogger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
			await oAuth2ClientManager.registerResourceServer(RESOURCE_SERVER, SECRET);
		});

		beforeEach(() => {
			tokenManager = new OAuth2TokenManager('https://issuer.test', 'gauzy-mcp-api');
			payloads = new Map();
			(tokenManager as any).signToken = jest.fn(async (payload: TokenPayload) => {
				const handle = `token-${payloads.size + 1}`;
				payloads.set(handle, payload);
				return handle;
			});
			(tokenManager as any).securityLogger = {
				log: jest.fn(),
				warn: jest.fn(),
				error: jest.fn(),
				debug: jest.fn()
			};
		});

		afterEach(() => {
			tokenManager.destroy();
			jest.restoreAllMocks();
		});

		function build(client: Record<string, unknown> | null) {
			jest.spyOn(oAuth2ClientManager, 'validateClient').mockResolvedValue(client as any);
			const server = Object.create(OAuth2AuthorizationServer.prototype) as any;
			const errorHandler = { handleOAuthError: jest.fn(), handleStandardError: jest.fn() };
			const responseBuilder = { sendIntrospectionResponse: jest.fn() };
			Object.assign(server, {
				config: { baseUrl: 'https://auth.test', issuer: 'https://issuer.test' },
				tokenManager,
				errorHandler,
				responseBuilder,
				oAuthValidator: {
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
							: { valid: false };
					})
				},
				securityLogger: {
					log: jest.fn(),
					info: jest.fn(),
					warn: jest.fn(),
					error: jest.fn(),
					debug: jest.fn()
				},
				userInfoProvider: async (id: string) => ({ userId: id })
			});
			const introspect = (token: string, clientId = RESOURCE_SERVER) =>
				server.handleTokenIntrospection(
					{
						body: { token },
						headers: { authorization: `Basic ${Buffer.from(`${clientId}:${SECRET}`).toString('base64')}` }
					},
					{}
				);
			return { introspect, errorHandler, responseBuilder };
		}

		const resourceServer = {
			clientId: RESOURCE_SERVER,
			clientType: 'confidential',
			metadata: { resource_server: true }
		};

		const signIn = () =>
			tokenManager.generateTokenPair('user-1', 'chatgpt-mcp-client', ['mcp.read'], { includeRefreshToken: true });

		it('answers the registered resource server', async () => {
			const { accessToken } = await signIn();
			const { introspect, responseBuilder } = build(resourceServer);

			await introspect(accessToken);

			expect(responseBuilder.sendIntrospectionResponse.mock.calls[0][1]).toMatchObject({
				active: true,
				sub: 'user-1',
				aud: 'gauzy-mcp-api'
			});
		});

		it.each([
			['a public client, which needs no secret', { clientId: 'chatgpt-mcp-client', clientType: 'public' }],
			['a self-registered confidential client', { clientId: 'anyone', clientType: 'confidential', metadata: {} }],
			[
				'a self-registered confidential client claiming resource_server in its metadata',
				{ clientId: 'anyone', clientType: 'confidential', metadata: { resource_server: true } }
			]
		])('refuses %s', async (_case, client) => {
			const { accessToken } = await signIn();
			const { introspect, errorHandler, responseBuilder } = build(client);

			await introspect(accessToken, client.clientId);

			expect(responseBuilder.sendIntrospectionResponse).not.toHaveBeenCalled();
			expect(errorHandler.handleOAuthError.mock.calls[0][1]).toMatchObject({ error: 'invalid_client' });
			expect(errorHandler.handleOAuthError.mock.calls[0][2]).toBe(401);
		});

		it('never answers a refresh token as active', async () => {
			const { refreshToken } = await signIn();
			const { introspect, responseBuilder } = build(resourceServer);

			await introspect(refreshToken!);

			expect(responseBuilder.sendIntrospectionResponse.mock.calls[0][1]).toEqual({ active: false });
		});
	});
});
