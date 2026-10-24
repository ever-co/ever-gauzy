import { AuthorizationConfig, loadAuthorizationConfig, OAuthValidator } from './auth-types';

/**
 * Owner decision 7 (2026-10-22): the MCP server asks mcp-auth (introspection) whether each token is active —
 * audience, expiry, user not deactivated — and caches the answer for about 60 s. Auth is on by default; only the
 * loopback desktop mode skips it.
 *
 * Before: `OAuthValidator.validateToken` was a stub that refused every token, and the switch it obeyed was
 * `MCP_AUTHORIZATION_ENABLED` (off by default) — not `MCP_AUTH_ENABLED`, the variable the image, the k8s manifests
 * and the README set. So no bearer token was ever checked.
 */
describe('MCP server bearer token validation', () => {
	describe('loadAuthorizationConfig', () => {
		it('requires bearer tokens unless MCP_AUTH_ENABLED switches it off', () => {
			expect(loadAuthorizationConfig({}).enabled).toBe(true);
			expect(loadAuthorizationConfig({ MCP_AUTH_ENABLED: '' }).enabled).toBe(true);
			expect(loadAuthorizationConfig({ MCP_AUTH_ENABLED: 'true' }).enabled).toBe(true);
			for (const off of ['false', 'FALSE', '0', 'no', 'off']) {
				expect(loadAuthorizationConfig({ MCP_AUTH_ENABLED: off }).enabled).toBe(false);
			}
		});

		it('no longer reads MCP_AUTHORIZATION_ENABLED', () => {
			expect(loadAuthorizationConfig({ MCP_AUTHORIZATION_ENABLED: 'false' }).enabled).toBe(true);
		});

		it('introspects at the issuer by default, with the credentials it is given', () => {
			const config = loadAuthorizationConfig({
				MCP_AUTH_JWT_ISSUER: 'https://auth.example.test/',
				MCP_AUTH_INTROSPECTION_CLIENT_ID: 'mcp-server',
				MCP_AUTH_INTROSPECTION_CLIENT_SECRET: 'secret'
			});

			expect(config.introspection).toEqual({
				endpoint: 'https://auth.example.test/oauth2/introspect',
				clientId: 'mcp-server',
				clientSecret: 'secret'
			});
			expect(config.tokenValidation).toEqual({ audience: 'gauzy-mcp-api', issuer: 'https://auth.example.test' });
		});

		it('has no introspection without both credentials', () => {
			expect(
				loadAuthorizationConfig({
					MCP_AUTH_INTROSPECTION_ENDPOINT: 'https://auth.example.test/oauth2/introspect',
					MCP_AUTH_INTROSPECTION_CLIENT_ID: 'mcp-server'
				}).introspection
			).toBeUndefined();
		});

		it('reuses an answer for at most 60 seconds', () => {
			expect(loadAuthorizationConfig({}).tokenCacheTtlSeconds).toBe(60);
			expect(loadAuthorizationConfig({ MCP_AUTH_TOKEN_CACHE_TTL: '300' }).tokenCacheTtlSeconds).toBe(60);
			expect(loadAuthorizationConfig({ MCP_AUTH_TOKEN_CACHE_TTL: '10' }).tokenCacheTtlSeconds).toBe(10);
		});

		it('reads the documented scope list, written with commas or spaces', () => {
			expect(loadAuthorizationConfig({}).requiredScopes).toEqual(['mcp.read']);
			expect(loadAuthorizationConfig({ MCP_AUTH_REQUIRED_SCOPES: 'mcp.read,mcp.write' }).requiredScopes).toEqual([
				'mcp.read',
				'mcp.write'
			]);
		});

		it('keeps the default scope when the deploy passes an empty value (an unset secret)', () => {
			expect(loadAuthorizationConfig({ MCP_AUTH_REQUIRED_SCOPES: '' }).requiredScopes).toEqual(['mcp.read']);
		});
	});

	describe('OAuthValidator', () => {
		const NOW = new Date('2026-10-23T12:00:00Z').getTime();
		const ENDPOINT = 'https://auth.example.test/oauth2/introspect';

		const config: AuthorizationConfig = {
			enabled: true,
			requiredScopes: ['mcp.read'],
			authorizationServers: [],
			tokenValidation: { audience: 'gauzy-mcp-api', issuer: 'https://auth.example.test' },
			introspection: { endpoint: ENDPOINT, clientId: 'mcp-server', clientSecret: 'secret' },
			tokenCacheTtlSeconds: 60
		};

		const active = (overrides: Record<string, unknown> = {}) => ({
			active: true,
			sub: 'user-1',
			client_id: 'chatgpt-mcp-client',
			scope: 'mcp.read mcp.write',
			aud: 'gauzy-mcp-api',
			iss: 'https://auth.example.test',
			exp: Math.floor(NOW / 1000) + 900,
			...overrides
		});

		function build(answer: () => unknown, status = 200, overrides: Partial<AuthorizationConfig> = {}) {
			const fetchFn = jest.fn(async () => ({
				ok: status >= 200 && status < 300,
				status,
				json: async () => answer()
			}));
			return { validator: new OAuthValidator({ ...config, ...overrides }, fetchFn as any), fetchFn };
		}

		beforeEach(() => jest.useFakeTimers({ now: NOW }));
		afterEach(() => jest.useRealTimers());

		it('admits an active token, asking the introspection endpoint as the configured client', async () => {
			const { validator, fetchFn } = build(() => active());

			const result = await validator.validateToken('token-1', ['mcp.read']);

			expect(result).toMatchObject({
				valid: true,
				subject: 'user-1',
				clientId: 'chatgpt-mcp-client',
				scopes: ['mcp.read', 'mcp.write']
			});
			const [url, init] = fetchFn.mock.calls[0] as any[];
			expect(url).toBe(ENDPOINT);
			expect(init.method).toBe('POST');
			expect(init.headers.Authorization).toBe(`Basic ${Buffer.from('mcp-server:secret').toString('base64')}`);
			expect(new URLSearchParams(init.body).get('token')).toBe('token-1');
		});

		it.each([
			['an inactive token (revoked, expired, or its user deactivated)', { active: false }],
			['a token for another audience', { aud: 'another-api' }],
			['a token from another issuer', { iss: 'https://elsewhere.test' }],
			['a token whose expiry has passed', { exp: Math.floor(NOW / 1000) - 1 }],
			['a token with no expiry', { exp: undefined }],
			['a token with no subject', { sub: undefined }]
		])('refuses %s', async (_case, overrides) => {
			const { validator } = build(() => active(overrides));

			expect((await validator.validateToken('token-1')).valid).toBe(false);
		});

		it('refuses every token when introspection is not configured', async () => {
			const { validator, fetchFn } = build(() => active(), 200, { introspection: undefined });

			expect(await validator.validateToken('token-1')).toMatchObject({ valid: false });
			expect(fetchFn).not.toHaveBeenCalled();
		});

		it('reports a missing scope as insufficient_scope', async () => {
			const { validator } = build(() => active({ scope: 'mcp.read' }));

			expect(await validator.validateToken('token-1', ['mcp.read', 'mcp.write'])).toMatchObject({
				valid: false,
				error: 'insufficient_scope'
			});
		});

		it('reuses an answer for 60 seconds, then asks again', async () => {
			let answer = active();
			const { validator, fetchFn } = build(() => answer);

			expect((await validator.validateToken('token-1')).valid).toBe(true);
			jest.setSystemTime(NOW + 59_000);
			expect((await validator.validateToken('token-1')).valid).toBe(true);
			expect(fetchFn).toHaveBeenCalledTimes(1);

			// The user was deactivated meanwhile: the next answer after the minute says so.
			answer = { active: false } as any;
			jest.setSystemTime(NOW + 61_000);
			expect((await validator.validateToken('token-1')).valid).toBe(false);
			expect(fetchFn).toHaveBeenCalledTimes(2);
		});

		it('never reuses an answer past the token’s expiry', async () => {
			const { validator, fetchFn } = build(() => active({ exp: Math.floor(NOW / 1000) + 10 }));

			await validator.validateToken('token-1');
			jest.setSystemTime(NOW + 11_000);
			expect((await validator.validateToken('token-1')).valid).toBe(false);
			expect(fetchFn).toHaveBeenCalledTimes(2);
		});

		it('keeps each token’s answer apart', async () => {
			const { validator, fetchFn } = build(() => active());

			await validator.validateToken('token-1');
			await validator.validateToken('token-2');

			expect(fetchFn).toHaveBeenCalledTimes(2);
		});

		it('refuses, without remembering it, when the introspection call fails', async () => {
			const { validator, fetchFn } = build(() => active(), 503);

			expect((await validator.validateToken('token-1')).valid).toBe(false);
			expect((await validator.validateToken('token-1')).valid).toBe(false);
			expect(fetchFn).toHaveBeenCalledTimes(2);

			const unreachable = new OAuthValidator(config, (async () => {
				throw new Error('connect ECONNREFUSED');
			}) as any);
			expect((await unreachable.validateToken('token-1')).valid).toBe(false);
		});

		it('asks once for concurrent requests with the same token', async () => {
			const { validator, fetchFn } = build(() => active());

			const results = await Promise.all([1, 2, 3].map(() => validator.validateToken('token-1')));

			expect(results.every((result) => result.valid)).toBe(true);
			expect(fetchFn).toHaveBeenCalledTimes(1);
		});

		it('admits everything only when bearer tokens are switched off', async () => {
			const { validator, fetchFn } = build(() => ({ active: false }), 200, { enabled: false });

			expect((await validator.validateToken('anything')).valid).toBe(true);
			expect(fetchFn).not.toHaveBeenCalled();
		});
	});
});
