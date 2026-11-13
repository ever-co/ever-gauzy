import { AuthorizationConfig, loadAuthorizationConfig, OAuthValidator } from './auth-types';

/**
 * A token granted collaboration scopes alone (`chat:read`, no `mcp.read`) is admitted for the collaboration tools only.
 * That admission met any required scope list, so a token short of an operator's own `MCP_AUTH_REQUIRED_SCOPES`
 * (`mcp.admin`, say) reached the collaboration tools anyway. It now applies only while the required scopes are the
 * default: scopes an operator requires are always required.
 */
describe('OAuthValidator — admission on collaboration scopes alone', () => {
	const NOW = new Date('2026-11-08T00:00:00Z').getTime();
	const saved = { ...process.env };
	const base: AuthorizationConfig = {
		enabled: true,
		requiredScopes: ['mcp.read'],
		authorizationServers: [],
		tokenValidation: { audience: 'gauzy-mcp-api', issuer: 'https://auth.example.test' },
		introspection: {
			endpoint: 'https://auth.example.test/oauth2/introspect',
			clientId: 'mcp-server',
			clientSecret: 'secret'
		},
		tokenCacheTtlSeconds: 60
	};
	/** A validator whose introspection answers an active token holding these scopes */
	const validator = (scope: string, config: Partial<AuthorizationConfig>) =>
		new OAuthValidator({ ...base, ...config }, (async () => ({
			ok: true,
			status: 200,
			json: async () => ({
				active: true,
				sub: 'user-1',
				client_id: 'c',
				scope,
				aud: 'gauzy-mcp-api',
				iss: 'https://auth.example.test',
				exp: Math.floor(NOW / 1000) + 900
			})
		})) as any);
	/** The configuration a deployment gets from these variables */
	const deployed = (env: Record<string, string>) => {
		const { requiredScopes, collaborationOnlyAdmission } = loadAuthorizationConfig(env);
		return { requiredScopes, collaborationOnlyAdmission };
	};

	beforeEach(() => {
		jest.useFakeTimers({ now: NOW });
		process.env['GAUZY_MCP_TOOLS_CHAT'] = 'true';
		delete process.env['GAUZY_MCP_TOOLS_DOCS'];
	});
	afterEach(() => {
		jest.useRealTimers();
		process.env = { ...saved };
	});

	it('allows it only while the operator sets no required scopes (an empty value is an unset secret)', () => {
		expect(deployed({})).toEqual({ requiredScopes: ['mcp.read'], collaborationOnlyAdmission: true });
		expect(deployed({ MCP_AUTH_REQUIRED_SCOPES: '' })).toEqual({
			requiredScopes: ['mcp.read'],
			collaborationOnlyAdmission: true
		});
		expect(deployed({ MCP_AUTH_REQUIRED_SCOPES: 'mcp.read,mcp.write' })).toEqual({
			requiredScopes: ['mcp.read', 'mcp.write'],
			collaborationOnlyAdmission: false
		});
		expect(deployed({ MCP_AUTH_REQUIRED_SCOPES: 'mcp.read' })).toEqual({
			requiredScopes: ['mcp.read'],
			collaborationOnlyAdmission: false
		});
		expect(deployed({ MCP_REQUIRED_SCOPES: 'mcp.admin' })).toEqual({
			requiredScopes: ['mcp.admin'],
			collaborationOnlyAdmission: false
		});
	});

	/** A blank value used to leave the required scopes empty, and an empty list is checked by no token at all. */
	it('reads a blank or delimiter-only value as unset, never as "no scope required"', () => {
		for (const blank of [' ', ',', ' , ']) {
			expect(deployed({ MCP_AUTH_REQUIRED_SCOPES: blank })).toEqual({
				requiredScopes: ['mcp.read'],
				collaborationOnlyAdmission: true
			});
		}
		// Nor does it hide the other variable's list.
		expect(deployed({ MCP_AUTH_REQUIRED_SCOPES: ' ', MCP_REQUIRED_SCOPES: 'mcp.admin' })).toEqual({
			requiredScopes: ['mcp.admin'],
			collaborationOnlyAdmission: false
		});
	});

	it('admits chat:read alone against the default required scopes, for the collaboration tools only', async () => {
		const config = deployed({});
		expect(await validator('chat:read', config).validateToken('t', config.requiredScopes)).toMatchObject({
			valid: true,
			collaborationOnly: true,
			scopes: ['chat:read']
		});
	});

	it("never admits a token short of an operator's required scopes", async () => {
		const strict = deployed({ MCP_AUTH_REQUIRED_SCOPES: 'mcp.admin' });
		expect(await validator('chat:write', strict).validateToken('t', strict.requiredScopes)).toMatchObject({
			valid: false,
			error: 'insufficient_scope'
		});
		expect(await validator('mcp.read chat:write', strict).validateToken('t', strict.requiredScopes)).toMatchObject({
			valid: false,
			error: 'insufficient_scope'
		});
		// The default value, stated by the operator, is the operator's requirement too.
		const stated = deployed({ MCP_AUTH_REQUIRED_SCOPES: 'mcp.read' });
		expect(await validator('chat:read', stated).validateToken('t', stated.requiredScopes)).toMatchObject({
			valid: false,
			error: 'insufficient_scope'
		});
		// And a configuration that does not say it allows the admission does not.
		expect(await validator('chat:read', {}).validateToken('t', ['mcp.read'])).toMatchObject({
			valid: false,
			error: 'insufficient_scope'
		});
	});

	it('never answers a caller asking for more than the default with less', async () => {
		const config = deployed({});
		expect(await validator('chat:read', config).validateToken('t', ['mcp.read', 'mcp.write'])).toMatchObject({
			valid: false,
			error: 'insufficient_scope'
		});
	});

	it('keeps refusing a token with neither the required scopes nor a scope of an enabled group', async () => {
		const config = deployed({});
		for (const scope of ['openid profile', 'docs:write', 'chat:admin']) {
			expect(await validator(scope, config).validateToken('t', config.requiredScopes)).toMatchObject({
				valid: false,
				error: 'insufficient_scope'
			});
		}
	});

	it('does not mark a token that holds the required scopes', async () => {
		const config = deployed({});
		const result = await validator('mcp.read chat:read', config).validateToken('t', config.requiredScopes);
		expect(result.valid).toBe(true);
		expect(result.collaborationOnly).toBeUndefined();
	});
});
