import {
	OIDC_DEFAULT_DISPLAY_NAME,
	isOidcConfigured,
	isOidcEnabled,
	oidcCallbackUrlProblem,
	oidcIssuerProblem,
	parseOidcSettings
} from './auth-oidc.config';

describe('OpenID Connect plugin settings', () => {
	const configured = {
		OIDC_ISSUER: 'https://id.example.test/application/o/gauzy/',
		OIDC_CLIENT_ID: 'gauzy',
		OIDC_CLIENT_SECRET: 'not-a-placeholder'
	};

	describe('the switch', () => {
		it('is off unless OIDC_ENABLED is exactly "true", silently for unset, empty and false', () => {
			const warn = jest.fn();
			expect(isOidcEnabled({ ...configured }, warn)).toBe(false);
			expect(isOidcEnabled({ ...configured, OIDC_ENABLED: '' }, warn)).toBe(false);
			expect(isOidcEnabled({ ...configured, OIDC_ENABLED: 'false' }, warn)).toBe(false);
			expect(warn).not.toHaveBeenCalled();
			expect(isOidcEnabled({ ...configured, OIDC_ENABLED: 'true' }, warn)).toBe(true);
			expect(warn).not.toHaveBeenCalled();
		});

		it.each(['TRUE', 'True', '1', 'yes', 'on', ' true'])('stays off for OIDC_ENABLED=%j and says so once, without the value', (value) => {
			const warn = jest.fn();
			expect(isOidcEnabled({ ...configured, OIDC_ENABLED: value }, warn)).toBe(false);
			expect(warn).toHaveBeenCalledTimes(1);
			expect(warn.mock.calls[0][0]).toContain('OIDC_ENABLED must be "true" or "false"');
		});

		it('reads nothing else while it is off', () => {
			const warn = jest.fn();
			expect(isOidcEnabled({ OIDC_ISSUER: 'http://insecure.example.test' }, warn)).toBe(false);
			expect(warn).not.toHaveBeenCalled();
		});

		it('stays off when switched on without a usable configuration, naming the settings but never their values', () => {
			const warn = jest.fn();
			const secret = 'XXXXXXX';
			expect(isOidcEnabled({ OIDC_ENABLED: 'true', OIDC_ISSUER: 'http://id.example.test', OIDC_CLIENT_SECRET: secret }, warn)).toBe(false);
			expect(warn).toHaveBeenCalledTimes(1);
			const [message] = warn.mock.calls[0];
			expect(message).toContain('OIDC_ISSUER (insecure_url)');
			expect(message).toContain('OIDC_CLIENT_ID (missing)');
			expect(message).toContain('OIDC_CLIENT_SECRET (placeholder)');
			expect(message).not.toContain('id.example.test');
		});
	});

	describe('what counts as configured', () => {
		it('needs an issuer, a client id and a client secret, none of them the sample placeholder', () => {
			expect(isOidcConfigured(configured)).toBe(true);
			expect(isOidcConfigured({})).toBe(false);
			expect(isOidcConfigured({ ...configured, OIDC_ISSUER: '' })).toBe(false);
			expect(isOidcConfigured({ ...configured, OIDC_CLIENT_ID: ' ' })).toBe(false);
			expect(isOidcConfigured({ ...configured, OIDC_CLIENT_SECRET: '' })).toBe(false);
			expect(isOidcConfigured({ ...configured, OIDC_CLIENT_ID: 'XXXXXXX', OIDC_CLIENT_SECRET: 'XXXXXXX' })).toBe(false);
		});

		it('needs a usable callback URL when one is set', () => {
			expect(isOidcConfigured({ ...configured, OIDC_CALLBACK_URL: 'https://api.example.test/api/auth/oidc/callback' })).toBe(true);
			expect(isOidcConfigured({ ...configured, OIDC_CALLBACK_URL: 'not a url' })).toBe(false);
			expect(isOidcConfigured({ ...configured, OIDC_CALLBACK_URL: 'https://api.example.test/callback#fragment' })).toBe(false);
		});
	});

	describe('the issuer rule (https; http only on the local machine)', () => {
		it.each([
			['https://id.example.test', null],
			['https://id.example.test/realms/gauzy', null],
			['https://id.example.test/application/o/gauzy/', null],
			['http://localhost:9000', null],
			['http://127.0.0.1:9000/realms/dev', null],
			['http://[::1]:9000', null],
			['http://id.example.test', 'insecure_url'],
			['http://192.168.1.10:9000', 'insecure_url'],
			['ftp://id.example.test', 'invalid_url'],
			['id.example.test', 'invalid_url'],
			['https://id.example.test/?tenant=a', 'invalid_url'],
			['https://id.example.test/?', 'invalid_url'],
			['https://id.example.test/#x', 'invalid_url'],
			['https://user:pass@id.example.test', 'invalid_url']
		])('%s -> %s', (issuer, problem) => {
			expect(oidcIssuerProblem(issuer)).toBe(problem);
		});

		it('keeps the issuer exactly as configured, trailing slash included', () => {
			expect(parseOidcSettings({ ...configured, OIDC_ISSUER: '  https://id.example.test/application/o/gauzy/ ' }).issuer).toBe(
				'https://id.example.test/application/o/gauzy/'
			);
			expect(parseOidcSettings({ ...configured, OIDC_ISSUER: 'https://id.example.test' }).issuer).toBe('https://id.example.test');
		});

		it('does not use a refused issuer', () => {
			const settings = parseOidcSettings({ ...configured, OIDC_ISSUER: 'http://id.example.test' });
			expect(settings.issuer).toBe('');
			expect(settings.unusable).toEqual([{ name: 'OIDC_ISSUER', problem: 'insecure_url' }]);
		});
	});

	describe('the callback URL rule', () => {
		it.each([
			['https://api.example.test/api/auth/oidc/callback', null],
			['http://gauzy.lan:3000/api/auth/oidc/callback', null],
			['https://api.example.test/api/auth/oidc/callback?x=1', null],
			['/api/auth/oidc/callback', 'invalid_url'],
			['javascript:alert(1)', 'invalid_url'],
			['https://user:pass@api.example.test/callback', 'invalid_url'],
			['https://api.example.test/callback#', 'invalid_url']
		])('%s -> %s', (url, problem) => {
			expect(oidcCallbackUrlProblem(url)).toBe(problem);
		});

		it('is empty when unset, so the sign-in uses the default below the API base URL', () => {
			expect(parseOidcSettings(configured).callbackUrl).toBe('');
		});
	});

	describe('scopes', () => {
		it('defaults to openid email profile', () => {
			expect(parseOidcSettings(configured).scopes).toEqual(['openid', 'email', 'profile']);
		});

		it('reads spaces or commas, drops duplicates and always requests openid', () => {
			expect(parseOidcSettings({ ...configured, OIDC_SCOPES: 'email, profile  groups email' }).scopes).toEqual([
				'openid',
				'email',
				'profile',
				'groups'
			]);
			expect(parseOidcSettings({ ...configured, OIDC_SCOPES: 'openid email' }).scopes).toEqual(['openid', 'email']);
		});

		it('says so when "email" is not requested', () => {
			const warn = jest.fn();
			expect(parseOidcSettings({ ...configured, OIDC_SCOPES: 'openid profile' }, warn).scopes).toEqual(['openid', 'profile']);
			expect(warn).toHaveBeenCalledWith(expect.stringContaining('does not request "email"'));
		});
	});

	describe('display name', () => {
		it('defaults to SSO', () => {
			expect(parseOidcSettings(configured).displayName).toBe(OIDC_DEFAULT_DISPLAY_NAME);
			expect(parseOidcSettings({ ...configured, OIDC_DISPLAY_NAME: '   ' }).displayName).toBe('SSO');
		});

		it('uses a short label as configured', () => {
			expect(parseOidcSettings({ ...configured, OIDC_DISPLAY_NAME: ' Acme ID ' }).displayName).toBe('Acme ID');
		});

		it.each([['x'.repeat(41)], ['Acme\nID'], ['Acme\u0007']])('falls back to SSO for %j and says so', (value) => {
			const warn = jest.fn();
			expect(parseOidcSettings({ ...configured, OIDC_DISPLAY_NAME: value }, warn).displayName).toBe('SSO');
			expect(warn).toHaveBeenCalledWith(expect.stringContaining('OIDC_DISPLAY_NAME'));
		});
	});
});
