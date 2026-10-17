import { deniedByEnv, isEverConnectEnabled, readEverConnectConfig, releaseVersion } from './ever-connect-config';

/**
 * The switch and the settings are read strictly: only `EVER_CONNECT_ENABLED=true` loads the module,
 * a malformed value keeps the default and is reported once without repeating it, and the install
 * source comes only from `EVER_INSTALL_SOURCE`.
 */
describe('EVER_CONNECT_ENABLED', () => {
	it.each([
		['unset', undefined, false, 0],
		['empty', '', false, 0],
		['false', 'false', false, 0],
		['true', 'true', true, 0],
		['TRUE', 'TRUE', false, 1],
		['1', '1', false, 1],
		['yes', 'yes', false, 1],
		['a typed word', 'please-on', false, 1]
	])('%s: loaded %s, %i warning(s)', (_name, value, loaded, warnings) => {
		const warn = jest.fn();
		expect(isEverConnectEnabled({ EVER_CONNECT_ENABLED: value }, warn)).toBe(loaded);
		expect(warn).toHaveBeenCalledTimes(warnings);
		for (const [message] of warn.mock.calls) {
			expect(message).not.toContain(String(value));
		}
	});
});

describe('readEverConnectConfig', () => {
	it('defaults: api.ever.co, self-hosted, long poll, nothing denied, no code, gauzy only', () => {
		const config = readEverConnectConfig({});
		expect(config).toEqual({
			apiUrl: 'https://api.ever.co',
			installSource: 'self-hosted',
			cloud: false,
			feedMode: 'longpoll',
			deny: [],
			connectCode: null,
			serves: ['gauzy'],
			version: '0.0.0',
			returnOrigin: null,
			returnUrl: null,
			returnUnusable: false,
			issuer: null,
			localPlatform: false
		});
	});

	it('cloud only from EVER_INSTALL_SOURCE=cloud, never from other signals', () => {
		expect(readEverConnectConfig({ EVER_INSTALL_SOURCE: 'cloud' }).cloud).toBe(true);
		expect(
			readEverConnectConfig({
				DEMO: 'true',
				STRIPE_SECRET_KEY: 'sk_live_x',
				CLOUD_PROVIDER: 'aws',
				IS_ELECTRON: 'true'
			}).cloud
		).toBe(false);
		const warn = jest.fn();
		expect(readEverConnectConfig({ EVER_INSTALL_SOURCE: 'Cloud' }, warn).cloud).toBe(false);
		expect(warn).toHaveBeenCalledTimes(1);
	});

	it.each([
		['https://api-stage.ever.co/', 'https://api-stage.ever.co'],
		['http://127.0.0.1:18080', 'http://127.0.0.1:18080'],
		['http://localhost:8080', 'http://localhost:8080'],
		['http://10.0.0.5', 'http://10.0.0.5'],
		['http://api.ever.co', null],
		['https://user:pass@api.ever.co', null],
		['https://api.ever.co/?x=1', null],
		['not a url', null]
	])('EVER_PLATFORM_API_URL %s gives %s (never another address; plain http warns)', (value, expected) => {
		const warn = jest.fn();
		expect(readEverConnectConfig({ EVER_PLATFORM_API_URL: value }, warn).apiUrl).toBe(expected);
		expect(warn).toHaveBeenCalledTimes(expected === null || expected.startsWith('http:') ? 1 : 0);
		for (const [message] of warn.mock.calls) {
			expect(message).not.toContain(value);
		}
	});

	it('feed mode: longpoll or interval; anything else is longpoll with one warning', () => {
		expect(readEverConnectConfig({ EVER_CONNECT_FEED_MODE: 'interval' }).feedMode).toBe('interval');
		const warn = jest.fn();
		expect(readEverConnectConfig({ EVER_CONNECT_FEED_MODE: 'websocket' }, warn).feedMode).toBe('longpoll');
		expect(warn).toHaveBeenCalledTimes(1);
	});

	it('the deny list: keys or *, case-folded; a value that is not a key is ignored with one warning', () => {
		const warn = jest.fn();
		const config = readEverConnectConfig(
			{ EVER_CONNECT_INTEGRATIONS_DENY: 'stats_link, Instance_URL,,bad key!' },
			warn
		);
		expect(config.deny).toEqual(['stats_link', 'instance_url']);
		expect(warn).toHaveBeenCalledTimes(1);
		expect(deniedByEnv(config, 'stats_link')).toBe(true);
		expect(deniedByEnv(config, 'webhooks')).toBe(false);
		expect(deniedByEnv(readEverConnectConfig({ EVER_CONNECT_INTEGRATIONS_DENY: '*' }), 'webhooks')).toBe(true);
	});

	it('the test issuer and root keys are honoured for a local or private platform address only', () => {
		const env = { EVER_PLATFORM_ISSUER: 'https://mock-platform.test' };
		expect(readEverConnectConfig({ ...env, EVER_PLATFORM_API_URL: 'http://127.0.0.1:18081' })).toMatchObject({
			issuer: 'https://mock-platform.test',
			localPlatform: true
		});
		// The egress audit's mock platform: a fixed address of a private range on its sealed network.
		expect(readEverConnectConfig({ ...env, EVER_PLATFORM_API_URL: 'http://10.231.7.252:8080' })).toMatchObject({
			issuer: 'https://mock-platform.test',
			localPlatform: true
		});
		const warn = jest.fn();
		expect(
			readEverConnectConfig({ ...env, EVER_PLATFORM_API_URL: 'https://203.0.113.10' }, warn)
		).toMatchObject({ issuer: null, localPlatform: false });
		expect(warn.mock.calls.map(([message]) => message).join(' ')).toMatch(/local or private/);
		expect(readEverConnectConfig({ ...env, EVER_PLATFORM_API_URL: 'http://192.168.1.20:8080' }).localPlatform).toBe(true);
		expect(readEverConnectConfig({ ...env, EVER_PLATFORM_API_URL: 'https://api-dev.ever.co' }).issuer).toBeNull();
	});

	it('a web app on plain http outside loopback (a private network address) is never sent', () => {
		expect(readEverConnectConfig({ CLIENT_BASE_URL: 'http://192.168.1.20:4200' })).toMatchObject({
			returnOrigin: null,
			returnUrl: null,
			returnUnusable: true
		});
		expect(readEverConnectConfig({ CLIENT_BASE_URL: 'http://127.0.0.1:4200' }).returnOrigin).toBe(
			'http://127.0.0.1:4200'
		);
	});

	it('the return address is the Ever Platform page of the web app (https, or http on a local host); nothing else', () => {
		expect(readEverConnectConfig({ CLIENT_BASE_URL: 'https://app.example.test/' })).toMatchObject({
			returnOrigin: 'https://app.example.test',
			returnUrl: 'https://app.example.test/#/pages/integrations/ever-connect'
		});
		expect(readEverConnectConfig({ CLIENT_BASE_URL: 'https://example.test/gauzy/' }).returnUrl).toBe(
			'https://example.test/gauzy/#/pages/integrations/ever-connect'
		);
		expect(readEverConnectConfig({ CLIENT_BASE_URL: 'http://localhost:4200' }).returnOrigin).toBe(
			'http://localhost:4200'
		);
		expect(readEverConnectConfig({ CLIENT_BASE_URL: 'http://app.example.test' }).returnOrigin).toBeNull();
		expect(readEverConnectConfig({ CLIENT_BASE_URL: 'https://u:p@app.example.test' }).returnOrigin).toBeNull();
	});

	it('the release: major.minor.patch of GAUZY_APP_VERSION only', () => {
		expect(releaseVersion('v111.47.0-4-gbb20466')).toBe('111.47.0');
		expect(releaseVersion('111.48.1')).toBe('111.48.1');
		expect(releaseVersion('acme-build')).toBe('0.0.0');
		expect(releaseVersion(undefined)).toBe('0.0.0');
	});

	it('the paired Teams web app: EVER_STATS_SERVES', () => {
		expect(readEverConnectConfig({ EVER_STATS_SERVES: 'gauzy,teams' }).serves).toEqual(['gauzy', 'teams']);
		expect(readEverConnectConfig({ EVER_STATS_SERVES: 'teams,other' }).serves).toEqual(['gauzy']);
	});

	it('the connect code is kept as given (checked when it is used)', () => {
		expect(readEverConnectConfig({ EVER_CONNECT_CODE: ' EVC-AAAA-BBBB-CCCC ' }).connectCode).toBe(
			'EVC-AAAA-BBBB-CCCC'
		);
	});
});
