import { BACKCHANNEL_LOGOUT_EVENT } from '@gauzy/auth';
import { TEST_CLIENT_BASE_URL, TEST_CLIENT_ID, TestBrowser, ZitadelTestApp, createZitadelTestApp } from '../fixtures/zitadel-test-app';

// The first use of `jose` (an ES module that ts-jest compiles on load) and key generation can take
// longer than Jest's 5 s default on a busy machine.
jest.setTimeout(60_000);

/** The first-party client the test app lists in `ZITADEL_ALLOWED_AUDIENCES`. */
const FORWARDING_CLIENT_ID = 'teams-web';

describe('Back-channel logout (HTTP, against a mock OpenID Provider)', () => {
	let t: ZitadelTestApp;
	let browser: TestBrowser;

	beforeEach(async () => {
		t = await createZitadelTestApp();
		browser = new TestBrowser();
		const user = t.accounts.addUser({ email: 'person@example.test' });
		await t.accounts.link([user], { issuer: t.issuer.issuer, subject: 'person' }, 'explicit');
		t.issuer.nextClaims = { sub: 'person', sid: 'session-1' };
		await browser.follow(`${t.baseUrl}/api/auth/zitadel`, TEST_CLIENT_BASE_URL);
		t.sessions.recorded.push({ sid: 'session-2', userId: user.id });
	});

	afterEach(async () => {
		await t?.close();
	});

	function logoutClaims(overrides: Record<string, unknown> = {}) {
		return {
			iss: t.issuer.issuer,
			aud: TEST_CLIENT_ID,
			iat: Math.floor(Date.now() / 1000),
			jti: 'jti-1',
			sid: 'session-1',
			sub: 'person',
			events: { [BACKCHANNEL_LOGOUT_EVENT]: {} },
			...overrides
		};
	}

	async function post(claims: Record<string, unknown>) {
		return browser.postForm(`${t.baseUrl}/api/auth/zitadel/backchannel-logout`, { logout_token: await t.issuer.sign(claims) });
	}

	// A first-party client listed in ZITADEL_ALLOWED_AUDIENCES forwards the logout token the identity
	// provider sent to it; that token names the forwarding client, and passes exactly the same checks.
	describe.each([
		['issued to this product', TEST_CLIENT_ID],
		['forwarded by an allowed first-party client', FORWARDING_CLIENT_ID]
	])('a logout token %s', (_name, audience) => {
		it('ends only the sessions of that identity provider session', async () => {
			expect(t.sessions.recorded.map((row) => row.sid).sort()).toEqual(['session-1', 'session-2']);
			const response = await post(logoutClaims({ aud: audience }));
			expect(response.status).toBe(200);
			expect(t.sessions.ended).toEqual(['session-1']);
			expect(t.sessions.recorded.map((row) => row.sid)).toEqual(['session-2']);
		});

		it('is refused when replayed', async () => {
			expect((await post(logoutClaims({ aud: audience }))).status).toBe(200);
			expect((await post(logoutClaims({ aud: audience }))).status).toBe(400);
			expect(t.sessions.ended).toEqual(['session-1']);
		});

		it('ends every Ever ID session of the linked accounts when it names only the subject', async () => {
			const response = await post(logoutClaims({ aud: audience, sid: undefined }));
			expect(response.status).toBe(200);
			expect(t.sessions.ended).toEqual([]);
			expect(t.sessions.recorded).toEqual([]);
		});

		it('answers 503 when the sessions cannot be ended, and is accepted again (remembered only after success)', async () => {
			t.sessions.failNextEnd = true;
			expect((await post(logoutClaims({ aud: audience }))).status).toBe(503);
			expect((await post(logoutClaims({ aud: audience }))).status).toBe(200);
			expect(t.sessions.ended).toEqual(['session-1']);
		});

		it.each([
			['older than 300 s', { iat: Math.floor(Date.now() / 1000) - 301 }],
			['issued in the future', { iat: Math.floor(Date.now() / 1000) + 600 }],
			['without a jti', { jti: undefined }],
			['without a session id or subject', { sid: undefined, sub: undefined }],
			['with a nonce', { nonce: 'n' }],
			['without the logout event', { events: {} }],
			['from another issuer', { iss: 'http://127.0.0.1:1' }]
		])('is refused %s, and revokes nothing', async (name, overrides) => {
			const response = await post(logoutClaims({ aud: audience, jti: `jti-${name}`, ...overrides }));
			expect(response.status).toBe(400);
			expect(t.sessions.ended).toHaveLength(0);
			expect(t.sessions.recorded).toHaveLength(2);
		});

		it('is refused with a signature that is not the issuer\'s', async () => {
			const token = await t.issuer.sign(logoutClaims({ aud: audience }));
			const [header, payload] = token.split('.');
			const response = await browser.postForm(`${t.baseUrl}/api/auth/zitadel/backchannel-logout`, {
				logout_token: `${header}.${payload}.${'A'.repeat(86)}`
			});
			expect(response.status).toBe(400);
			expect(t.sessions.ended).toHaveLength(0);
		});
	});

	it.each([
		['a client that is not allowed', { aud: 'someone-else' }],
		['an operator client of another instance', { aud: ['inst-1234'] }]
	])('refuses a token for %s and revokes nothing', async (_name, overrides) => {
		const response = await post(logoutClaims(overrides));
		expect(response.status).toBe(400);
		expect(t.sessions.ended).toHaveLength(0);
	});

	it('accepts only its own client when no other first-party client is allowed', async () => {
		await t.close();
		t = await createZitadelTestApp({ env: { ZITADEL_ALLOWED_AUDIENCES: '' } });
		browser = new TestBrowser();
		t.sessions.recorded.push({ sid: 'session-1', userId: 'user-1' });
		expect((await post(logoutClaims({ aud: FORWARDING_CLIENT_ID }))).status).toBe(400);
		expect((await post(logoutClaims({ aud: TEST_CLIENT_ID, jti: 'jti-2' }))).status).toBe(200);
		expect(t.sessions.ended).toEqual(['session-1']);
	});

	it('answers 404 when back-channel logout is switched off', async () => {
		await t.close();
		t = await createZitadelTestApp({ env: { ZITADEL_BACKCHANNEL_LOGOUT_ENABLED: 'false' } });
		browser = new TestBrowser();
		expect((await post(logoutClaims())).status).toBe(404);
		expect((await post(logoutClaims({ aud: FORWARDING_CLIENT_ID, jti: 'jti-2' }))).status).toBe(404);
	});
});
