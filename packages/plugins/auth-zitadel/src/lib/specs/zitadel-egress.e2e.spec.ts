import * as net from 'node:net';
import { TEST_CLIENT_BASE_URL, TestBrowser, ZitadelTestApp, createZitadelTestApp } from '../fixtures/zitadel-test-app';

// The first use of `jose` (an ES module that ts-jest compiles on load) and key generation can take
// longer than Jest's 5 s default on a busy machine.
jest.setTimeout(60_000);

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1']);

/**
 * Records every outbound TCP connection attempt of the process and blocks those that would leave the
 * machine, so a test can prove which hosts the plugin tries to reach (and that it reaches nothing
 * else) without any real network traffic.
 */
function recordConnections(): { attempts: string[]; external: string[] } {
	const attempts: string[] = [];
	const external: string[] = [];
	const original = net.Socket.prototype.connect;
	jest.spyOn(net.Socket.prototype, 'connect').mockImplementation(function (this: net.Socket, ...args: unknown[]) {
		const first = args[0] as { host?: string; port?: number } | number | string;
		const host = typeof first === 'object' && first ? first.host ?? 'localhost' : typeof args[1] === 'string' ? (args[1] as string) : 'localhost';
		const port = typeof first === 'object' && first ? first.port : first;
		attempts.push(`${host}:${port}`);
		if (!LOOPBACK.has(String(host))) {
			external.push(`${host}:${port}`);
			process.nextTick(() => this.destroy(new Error('Outbound connection blocked by the test')));
			return this;
		}
		return (original as (...a: unknown[]) => net.Socket).apply(this, args);
	} as never);
	return { attempts, external };
}

describe('Outbound calls of the Ever ID plugin', () => {
	let t: ZitadelTestApp;
	let browser: TestBrowser;

	afterEach(async () => {
		jest.restoreAllMocks();
		await t?.close();
	});

	it('loaded but unconfigured: answers 404 everywhere but /config and makes no outbound call', async () => {
		t = await createZitadelTestApp({ issuers: () => '' });
		browser = new TestBrowser();
		const spy = recordConnections();

		expect(await (await browser.get(`${t.baseUrl}/api/auth/zitadel/config`)).json()).toEqual({ enabled: false, reason: 'unconfigured' });
		for (const path of ['', '/callback?code=x&state=y', '/link/start?ticket=xxxxxxxxxxxxxxxxxxxx', '/identities']) {
			expect((await browser.get(`${t.baseUrl}/api/auth/zitadel${path}`)).status).toBe(404);
		}
		for (const path of ['/handoff', '/confirm', '/signup', '/token', '/backchannel-logout']) {
			expect((await browser.post(`${t.baseUrl}/api/auth/zitadel${path}`, {})).status).toBe(404);
		}
		expect(spy.external).toEqual([]);
		expect(t.issuer.requests).toEqual([]);
	});

	it('an Ever issuer on a non-cloud install without Ever Connect is refused and never contacted', async () => {
		t = await createZitadelTestApp({ issuers: () => 'https://auth.ever.co' });
		browser = new TestBrowser();
		const spy = recordConnections();

		expect(await (await browser.get(`${t.baseUrl}/api/auth/zitadel/config`)).json()).toEqual({
			enabled: false,
			reason: 'ever_issuer_requires_connect'
		});
		expect((await browser.get(`${t.baseUrl}/api/auth/zitadel`)).status).toBe(404);
		expect(spy.external).toEqual([]);
		expect(t.settings.everIssuersAwaitingConnect).toEqual(['https://auth.ever.co']);
	});

	it('positive control: the same issuer on Ever Cloud is contacted, so the recorder does see egress', async () => {
		t = await createZitadelTestApp({ issuers: () => 'https://auth.ever.co', env: { EVER_INSTALL_SOURCE: 'cloud' } });
		browser = new TestBrowser();
		const spy = recordConnections();

		expect((await (await browser.get(`${t.baseUrl}/api/auth/zitadel/config`)).json()).enabled).toBe(true);
		expect(spy.external).toEqual([]);
		await browser.get(`${t.baseUrl}/api/auth/zitadel`);
		expect(spy.external).toEqual(['auth.ever.co:443']);
	});

	it('an issuer on any other host stays allowed on a non-cloud install', async () => {
		t = await createZitadelTestApp({ issuers: () => 'https://idp.example.test' });
		browser = new TestBrowser();
		expect((await (await browser.get(`${t.baseUrl}/api/auth/zitadel/config`)).json()).issuer).toBe('https://idp.example.test');
	});

	it('loaded and configured, nobody signs in: no call to the issuer', async () => {
		t = await createZitadelTestApp();
		browser = new TestBrowser();
		const spy = recordConnections();
		await browser.get(`${t.baseUrl}/api/auth/zitadel/config`);
		expect(t.issuer.requests).toEqual([]);
		expect(spy.external).toEqual([]);
	});

	it('one sign-in: the server only calls the issuer\'s discovery, key set and token endpoints', async () => {
		t = await createZitadelTestApp();
		browser = new TestBrowser();
		const spy = recordConnections();
		t.issuer.nextClaims = { sub: 'egress-person' };
		await browser.follow(`${t.baseUrl}/api/auth/zitadel`, TEST_CLIENT_BASE_URL);

		const serverCalls = t.issuer.requests.filter((request) => request.path !== '/oauth/v2/authorize');
		expect(new Set(serverCalls.map((request) => request.path))).toEqual(
			new Set(['/.well-known/openid-configuration', '/oauth/v2/keys', '/oauth/v2/token'])
		);
		expect(spy.external).toEqual([]);
	});
});
