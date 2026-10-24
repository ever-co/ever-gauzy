import { AuthorizationConfig } from './auth-types';
import { AuthorizationMiddleware } from './authorization-middleware';

/**
 * Owner decision 7 (2026-10-22): bearer tokens are required by default, and only the loopback desktop mode skips
 * them — a caller on the server's own machine that sends no token (it then acts as the GAUZY_AUTO_LOGIN account).
 */
describe('AuthorizationMiddleware — who needs a bearer token', () => {
	const config: AuthorizationConfig = {
		enabled: true,
		requiredScopes: ['mcp.read'],
		authorizationServers: [],
		tokenValidation: { audience: 'gauzy-mcp-api' },
		introspection: {
			endpoint: 'https://auth.example.test/oauth2/introspect',
			clientId: 'mcp-server',
			clientSecret: 'secret'
		}
	};

	function run(options: { token?: string; local: boolean; validation?: Record<string, unknown> }) {
		const middleware = new AuthorizationMiddleware(config);
		const validateToken = jest.fn(async () => options.validation ?? { valid: false, error: 'Token is not active' });
		(middleware as any).validator.validateToken = validateToken;
		(middleware as any).securityLogger = { debug: jest.fn(), warn: jest.fn(), error: jest.fn() };

		const req: any = {
			path: '/sse',
			method: 'POST',
			ip: '203.0.113.7',
			headers: options.token ? { authorization: `Bearer ${options.token}` } : {},
			get: () => 'mcp.example.test'
		};
		const res: any = { setHeader: jest.fn(), status: jest.fn(() => res), json: jest.fn(), req };
		const next = jest.fn();

		const handler = middleware.createAuthorizationMiddleware({
			requiredScopes: config.requiredScopes,
			isLocalCaller: () => options.local
		});
		return { promise: handler(req, res, next), req, res, next, validateToken };
	}

	it('refuses a caller from elsewhere that sends no token', async () => {
		const { promise, res, next } = run({ local: false });
		await promise;

		expect(next).not.toHaveBeenCalled();
		expect(res.status).toHaveBeenCalledWith(401);
	});

	it('lets a caller on this machine without a token through (loopback desktop mode)', async () => {
		const { promise, res, next, validateToken } = run({ local: true });
		await promise;

		expect(next).toHaveBeenCalled();
		expect(res.status).not.toHaveBeenCalled();
		expect(validateToken).not.toHaveBeenCalled();
	});

	it('still checks a token that a caller on this machine sends', async () => {
		const { promise, res, next, validateToken } = run({ local: true, token: 'revoked' });
		await promise;

		expect(validateToken).toHaveBeenCalledWith('revoked', ['mcp.read']);
		expect(next).not.toHaveBeenCalled();
		expect(res.status).toHaveBeenCalledWith(401);
	});

	it('admits a caller from elsewhere with an active token, and records who it is', async () => {
		const { promise, req, next } = run({
			local: false,
			token: 'good',
			validation: { valid: true, subject: 'user-1', clientId: 'client-1', scopes: ['mcp.read'] }
		});
		await promise;

		expect(next).toHaveBeenCalled();
		expect(req.tokenInfo).toMatchObject({ valid: true, subject: 'user-1', clientId: 'client-1' });
	});

	it('answers 403 for a token without the required scope', async () => {
		const { promise, res } = run({
			local: false,
			token: 'narrow',
			validation: { valid: false, error: 'insufficient_scope' }
		});
		await promise;

		expect(res.status).toHaveBeenCalledWith(403);
	});
});
