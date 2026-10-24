import { OAuth2AuthorizationServer } from './oauth-authorization-server';

/**
 * The login form hands its request to the configured authenticator, so apps/mcp-auth can count failed attempts per
 * account the way the Gauzy API's login does, and tells the user when the account is blocked instead of answering
 * "server error".
 *
 * The server is built without its constructor (which mounts the whole Express app); only the collaborators
 * `handleLogin` touches are provided.
 */
describe('OAuth2AuthorizationServer login form — an account with too many failed attempts', () => {
	function build(authenticateUser: (credentials: any) => Promise<any>) {
		const server = Object.create(OAuth2AuthorizationServer.prototype) as any;
		Object.assign(server, {
			config: {
				loginEndpoint: '/oauth2/login',
				authorizationEndpoint: '/oauth2/authorize',
				baseUrl: 'https://auth.example.com'
			},
			securityLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
			authenticateUser
		});
		const req = {
			body: { email: 'someone@example.com', password: 'guess' },
			headers: {},
			cookies: {},
			ip: '203.0.113.9'
		};
		const res = { redirect: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn() };
		return { login: () => server.handleLogin(req, res), req, res };
	}

	it('hands the authenticator the form submission', async () => {
		const authenticateUser = jest.fn(async () => null);
		const { login, req, res } = build(authenticateUser);

		await login();

		expect(authenticateUser).toHaveBeenCalledWith({
			email: 'someone@example.com',
			password: 'guess',
			request: req
		});
		expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('error=invalid_credentials'));
	});

	it('answers too_many_attempts when the authenticator refuses with a 429', async () => {
		const blocked = Object.assign(new Error('Too many failed attempts for this account.'), {
			getStatus: () => 429
		});
		const { login, res } = build(async () => {
			throw blocked;
		});

		await login();

		expect(res.redirect).toHaveBeenCalledWith(
			`/oauth2/login?error=too_many_attempts&return_url=${encodeURIComponent('/oauth2/authorize')}`
		);
	});

	it('still answers server_error for any other failure', async () => {
		const { login, res } = build(async () => {
			throw new Error('database down');
		});

		await login();

		expect(res.redirect).toHaveBeenCalledWith('/oauth2/login?error=server_error');
	});

	it('says why on the form', () => {
		const server = Object.create(OAuth2AuthorizationServer.prototype) as any;
		expect(server.getErrorMessage('too_many_attempts')).toMatch(/too many failed sign-in attempts/i);
	});
});
