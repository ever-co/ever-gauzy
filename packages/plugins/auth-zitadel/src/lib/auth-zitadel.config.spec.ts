import { isEverHost, isZitadelEnabled, parseZitadelSettings } from './auth-zitadel.config';

describe('Ever ID plugin settings', () => {
	const base = { ZITADEL_ISSUERS: 'https://idp.example.test', ZITADEL_CLIENT_ID: 'web', ZITADEL_CLIENT_SECRET: 'secret' };

	it('loads only for ZITADEL_ENABLED=true, exactly', () => {
		expect(isZitadelEnabled({})).toBe(false);
		expect(isZitadelEnabled({ ZITADEL_ENABLED: 'false' })).toBe(false);
		for (const value of ['TRUE', '1', 'yes', 'on', ' true']) {
			expect(isZitadelEnabled({ ZITADEL_ENABLED: value })).toBe(false);
		}
		expect(isZitadelEnabled({ ZITADEL_ENABLED: 'true' })).toBe(true);
	});

	it('defaults to the safe values', () => {
		const settings = parseZitadelSettings({ ...base, API_BASE_URL: 'https://api.example.test/' });
		expect(settings).toEqual(
			expect.objectContaining({
				issuers: ['https://idp.example.test'],
				linkMode: 'explicit',
				signupEnabled: false,
				backchannelLogoutEnabled: true,
				handoffTtlSeconds: 60,
				confirmTtlSeconds: 1800,
				isCloud: false,
				callbackUrl: 'https://api.example.test/api/auth/zitadel/callback',
				secureCookies: true
			})
		);
		expect(settings.scopes).toEqual(['openid', 'profile', 'email', 'urn:zitadel:iam:user:resourceowner']);
	});

	it('reads booleans strictly and reports the rest once each', () => {
		const warnings: string[] = [];
		const settings = parseZitadelSettings({ ...base, ZITADEL_BACKCHANNEL_LOGOUT_ENABLED: 'no', ZITADEL_SIGNUP_ENABLED: '1' }, (m) =>
			warnings.push(m)
		);
		expect(settings.backchannelLogoutEnabled).toBe(true);
		expect(settings.signupEnabled).toBe(false);
		expect(warnings).toHaveLength(2);
		expect(warnings.join(' ')).not.toContain('secret');
	});

	it('keeps confirmed linking and the sign-up path to Ever Cloud', () => {
		const selfHosted = parseZitadelSettings({ ...base, ZITADEL_LINK_MODE: 'confirmed', ZITADEL_SIGNUP_ENABLED: 'true' });
		expect(selfHosted.linkMode).toBe('explicit');
		expect(selfHosted.signupEnabled).toBe(false);

		const cloud = parseZitadelSettings({ ...base, EVER_INSTALL_SOURCE: 'cloud', ZITADEL_LINK_MODE: 'confirmed', ZITADEL_SIGNUP_ENABLED: 'true' });
		expect(cloud.linkMode).toBe('confirmed');
		expect(cloud.signupEnabled).toBe(true);
	});

	it('never turns silent account creation on', () => {
		const warnings: string[] = [];
		const settings = parseZitadelSettings({ ...base, EVER_INSTALL_SOURCE: 'cloud', ZITADEL_JIT_PROVISIONING: 'true' }, (m) => warnings.push(m));
		expect(settings).not.toHaveProperty('jitProvisioning');
		expect(warnings.some((m) => m.includes('ZITADEL_JIT_PROVISIONING'))).toBe(true);
	});

	it('refuses an Ever issuer on a non-cloud install and accepts it on Ever Cloud', () => {
		const selfHosted = parseZitadelSettings({ ...base, ZITADEL_ISSUERS: 'https://auth.ever.co,https://idp.example.test' });
		expect(selfHosted.issuers).toEqual(['https://idp.example.test']);
		expect(selfHosted.everIssuersAwaitingConnect).toEqual(['https://auth.ever.co']);

		expect(parseZitadelSettings({ ...base, ZITADEL_ISSUERS: 'https://AUTH.EVER.CO./' }).issuers).toEqual([]);
		expect(parseZitadelSettings({ ...base, ZITADEL_ISSUERS: 'https://auth.ever.co', EVER_INSTALL_SOURCE: 'cloud' }).issuers).toEqual([
			'https://auth.ever.co'
		]);
	});

	it('tells Ever hosts apart by hostname only', () => {
		expect(isEverHost('https://auth.ever.co')).toBe(true);
		expect(isEverHost('https://ever.co')).toBe(true);
		expect(isEverHost('https://AUTH.EVER.CO.')).toBe(true);
		expect(isEverHost('https://ever.co.example.test')).toBe(false);
		expect(isEverHost('https://notever.co')).toBe(false);
		expect(isEverHost('not a url')).toBe(false);
	});

	it('accepts https issuers, http only on loopback, at most three', () => {
		const settings = parseZitadelSettings({
			...base,
			ZITADEL_ISSUERS: 'http://idp.example.test, http://127.0.0.1:8080, https://a.example.test/, https://b.example.test, https://c.example.test, ftp://x.test'
		});
		expect(settings.issuers).toEqual(['http://127.0.0.1:8080', 'https://a.example.test', 'https://b.example.test']);
		expect(settings.refusedIssuers.map((entry) => entry.reason)).toEqual(['insecure_url', 'too_many', 'invalid_url']);
	});

	it('never requests an organization-scoped login', () => {
		const settings = parseZitadelSettings({ ...base, ZITADEL_SCOPES: 'profile email urn:zitadel:iam:org:id:123' });
		expect(settings.scopes).toEqual(['openid', 'profile', 'email']);
	});

	it('adds the project audience scope when the project id is known', () => {
		const settings = parseZitadelSettings({ ...base, EVER_PLATFORM_PROJECT_ID: '42' });
		expect(settings.scopes).toContain('urn:zitadel:iam:org:project:id:42:aud');
	});

	it('bounds the lifetimes', () => {
		const settings = parseZitadelSettings({ ...base, ZITADEL_HANDOFF_TTL_S: '5', ZITADEL_CONFIRM_TTL_S: 'abc' });
		expect(settings.handoffTtlSeconds).toBe(60);
		expect(settings.confirmTtlSeconds).toBe(1800);
	});
});
