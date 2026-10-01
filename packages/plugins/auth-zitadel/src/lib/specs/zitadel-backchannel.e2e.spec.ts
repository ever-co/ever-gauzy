import { BACKCHANNEL_LOGOUT_EVENT } from '@gauzy/auth';
import { TEST_CLIENT_BASE_URL, TEST_CLIENT_ID, TestBrowser, ZitadelTestApp, createZitadelTestApp } from '../fixtures/zitadel-test-app';

// The first use of `jose` (an ES module that ts-jest compiles on load) and key generation can take
// longer than Jest's 5 s default on a busy machine.
jest.setTimeout(60_000);

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

	it('ends only the sessions of that identity provider session', async () => {
		expect(t.sessions.recorded.map((row) => row.sid).sort()).toEqual(['session-1', 'session-2']);
		const response = await post(logoutClaims());
		expect(response.status).toBe(200);
		expect(t.sessions.ended).toEqual(['session-1']);
		expect(t.sessions.recorded.map((row) => row.sid)).toEqual(['session-2']);
	});

	it('refuses a replayed jti', async () => {
		expect((await post(logoutClaims())).status).toBe(200);
		expect((await post(logoutClaims())).status).toBe(400);
		expect(t.sessions.ended).toEqual(['session-1']);
	});

	it('ends every Ever ID session of the linked accounts for a token naming only the subject', async () => {
		const response = await post(logoutClaims({ sid: undefined }));
		expect(response.status).toBe(200);
		expect(t.sessions.ended).toEqual([]);
		expect(t.sessions.recorded).toEqual([]);
	});

	it('answers 503 when the sessions cannot be ended, and accepts the same logout again', async () => {
		t.sessions.failNextEnd = true;
		expect((await post(logoutClaims())).status).toBe(503);
		expect((await post(logoutClaims())).status).toBe(200);
		expect(t.sessions.ended).toEqual(['session-1']);
	});

	it.each([
		['older than 300 s', { iat: Math.floor(Date.now() / 1000) - 301 }],
		['without a session id or subject', { sid: undefined, sub: undefined }],
		['with a nonce', { nonce: 'n' }],
		['without the logout event', { events: {} }],
		['for another client', { aud: 'teams-web' }]
	])('refuses a token %s and revokes nothing', async (_name, overrides) => {
		const response = await post(logoutClaims({ jti: `jti-${_name}`, ...overrides }));
		expect(response.status).toBe(400);
		expect(t.sessions.ended).toHaveLength(0);
	});

	it('answers 404 when back-channel logout is switched off', async () => {
		await t.close();
		t = await createZitadelTestApp({ env: { ZITADEL_BACKCHANNEL_LOGOUT_ENABLED: 'false' } });
		browser = new TestBrowser();
		expect((await post(logoutClaims())).status).toBe(404);
	});
});
