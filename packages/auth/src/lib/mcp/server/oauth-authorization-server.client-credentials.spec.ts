import { OAuth2AuthorizationServer } from './oauth-authorization-server';
import { oAuth2ClientManager } from './oauth-client-manager';

/**
 * `grant_type=client_credentials&client_id=chatgpt-mcp-client` returned a signed access token for the client's
 * scopes: `validateClient` lets a public client through without a secret, and the grant checked neither the client's
 * type nor its registered grant types. Dynamic registration, open to anyone, could also ask for the grant.
 *
 * The server is built without its constructor (which mounts the whole Express app); only the collaborators the
 * handlers touch are provided.
 */
describe('OAuth2AuthorizationServer client_credentials grant', () => {
	const client = (overrides: Record<string, unknown>) => ({
		clientId: 'client-1',
		clientType: 'confidential',
		grantTypes: ['client_credentials'],
		scopes: ['mcp.read', 'mcp.write'],
		...overrides
	});

	function build() {
		const server = Object.create(OAuth2AuthorizationServer.prototype) as any;
		const tokenManager = {
			generateTokenPair: jest.fn(async () => ({
				accessToken: 'token',
				tokenType: 'Bearer',
				expiresIn: 900,
				scope: 'mcp.read'
			}))
		};
		const errorHandler = { handleOAuthError: jest.fn(), handleStandardError: jest.fn() };
		const responseBuilder = { sendTokenResponse: jest.fn(), sendClientRegistrationResponse: jest.fn() };
		Object.assign(server, {
			tokenManager,
			errorHandler,
			responseBuilder,
			securityLogger: { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
		});
		const grant = () =>
			server.handleClientCredentialsGrant({} as any, {} as any, {
				grant_type: 'client_credentials',
				client_id: 'client-1',
				scope: 'mcp.read'
			});
		const register = (body: unknown) => server.handleClientRegistration({ body } as any, {} as any);
		return { grant, register, tokenManager, errorHandler, responseBuilder };
	}

	afterEach(() => jest.restoreAllMocks());

	it('issues a token to a confidential client registered for the grant (positive control)', async () => {
		jest.spyOn(oAuth2ClientManager, 'validateClient').mockResolvedValue(client({}) as any);
		const { grant, tokenManager, responseBuilder } = build();

		await grant();

		expect(tokenManager.generateTokenPair).toHaveBeenCalled();
		expect(responseBuilder.sendTokenResponse).toHaveBeenCalled();
	});

	it.each([
		[
			'a public client, which presents no secret',
			{ clientType: 'public', grantTypes: ['authorization_code', 'refresh_token'] }
		],
		['a public client that lists the grant', { clientType: 'public', grantTypes: ['client_credentials'] }],
		['a confidential client not registered for the grant', { grantTypes: ['authorization_code', 'refresh_token'] }],
		['a confidential client whose grant types were kept as a bare string', { grantTypes: 'client_credentials' }]
	])('refuses %s with unauthorized_client', async (_label, overrides) => {
		jest.spyOn(oAuth2ClientManager, 'validateClient').mockResolvedValue(client(overrides) as any);
		const { grant, tokenManager, errorHandler } = build();

		await grant();

		expect(tokenManager.generateTokenPair).not.toHaveBeenCalled();
		expect(errorHandler.handleOAuthError).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ error: 'unauthorized_client' }),
			400
		);
	});

	it.each([
		['as a list', ['client_credentials']],
		['as a bare string, which registerClient would keep as sent', 'client_credentials']
	])('is not available through dynamic registration, asked for %s', async (_label, grantTypes) => {
		const registerClient = jest.spyOn(oAuth2ClientManager, 'registerClient');
		const { register, errorHandler } = build();

		await register({
			client_name: 'anyone',
			client_type: 'confidential',
			redirect_uris: ['https://example.com/callback'],
			grant_types: grantTypes
		});

		expect(registerClient).not.toHaveBeenCalled();
		expect(errorHandler.handleStandardError).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ code: 'invalid_client_metadata', statusCode: 400 })
		);
	});

	it('still registers a client for the authorization code flow', async () => {
		const registerClient = jest
			.spyOn(oAuth2ClientManager, 'registerClient')
			.mockResolvedValue({ client_id: 'new-client' } as any);
		const { register, responseBuilder } = build();

		await register({ client_name: 'app', redirect_uris: ['https://example.com/callback'] });

		expect(registerClient).toHaveBeenCalled();
		expect(responseBuilder.sendClientRegistrationResponse).toHaveBeenCalled();
	});
});
