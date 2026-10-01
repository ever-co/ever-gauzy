import { RequestContext } from '@gauzy/core';
import { TEST_CLIENT_BASE_URL, TestBrowser, ZitadelTestApp, createZitadelTestApp, hashParam } from '../fixtures/zitadel-test-app';
import { TestUser } from '../fixtures/in-memory-accounts';

// The first use of `jose` (an ES module that ts-jest compiles on load) and key generation can take
// longer than Jest's 5 s default on a busy machine.
jest.setTimeout(60_000);

describe('Explicit linking from Settings (HTTP, against a mock OpenID Provider)', () => {
	let t: ZitadelTestApp;
	let browser: TestBrowser;
	let me: TestUser;

	beforeEach(async () => {
		t = await createZitadelTestApp();
		browser = new TestBrowser();
		me = t.accounts.addUser({ email: 'me@example.test', tenantName: 'Mine', hash: 'password-digest' });
		jest.spyOn(RequestContext, 'currentUserId').mockImplementation(() => me.id);
	});

	afterEach(async () => {
		jest.restoreAllMocks();
		await t?.close();
	});

	/** Runs the link flow up to the settings page and returns that URL. */
	async function link(claims: Record<string, unknown> = {}): Promise<string> {
		t.issuer.nextClaims = { sub: 'my-ever-id', email: 'me@example.test', ...claims };
		const started = await browser.post(`${t.baseUrl}/api/auth/zitadel/link`, {});
		expect(started.status).toBe(200);
		const { url } = await started.json();
		expect(url).toMatch(`${t.baseUrl}/api/auth/zitadel/link/start?ticket=`);
		return browser.follow(url, TEST_CLIENT_BASE_URL);
	}

	it('requires a fresh login, then links only after the confirmation', async () => {
		const landing = await link();
		expect(t.issuer.lastAuthorizeQuery.get('prompt')).toBe('login');
		expect(t.issuer.lastAuthorizeQuery.get('max_age')).toBe('300');
		expect(landing).toMatch(`${TEST_CLIENT_BASE_URL}/#/pages/settings/connected-identities?linked=`);
		expect(t.accounts.links).toHaveLength(0);

		const key = hashParam(landing, 'linked');
		const preview = await (await browser.post(`${t.baseUrl}/api/auth/zitadel/link/preview`, { key })).json();
		expect(preview).toEqual({ everIdEmail: 'me@example.test', accountEmail: 'me@example.test', siblings: [] });

		const confirmed = await browser.post(`${t.baseUrl}/api/auth/zitadel/link/confirm`, { key });
		expect(await confirmed.json()).toEqual({ linked: [me.id] });
		expect(t.accounts.links).toEqual([expect.objectContaining({ userId: me.id, linkMethod: 'explicit' })]);
		expect(t.published).toHaveLength(1);

		const identities = await (await browser.get(`${t.baseUrl}/api/auth/zitadel/identities`)).json();
		expect(identities).toEqual([expect.objectContaining({ issuer: t.issuer.issuer, subjectMasked: '••••r-id', linkMethod: 'explicit' })]);
	});

	it('accepts an authentication 300 s old and refuses one 361 s old', async () => {
		const now = Math.floor(Date.now() / 1000);
		const fresh = await link({ auth_time: now - 300 });
		expect(fresh).toMatch('?linked=');

		const stale = await link({ auth_time: now - 361 });
		expect(stale).toBe(`${TEST_CLIENT_BASE_URL}/#/pages/settings/connected-identities?error=reauth_required`);
		expect(t.accounts.links).toHaveLength(0);
	});

	it('links a ticked same-address account only with Gauzy\'s one-time code, and never an unverified one', async () => {
		const sibling = t.accounts.addUser({ email: 'me@example.test', tenantName: 'Other' });
		t.accounts.addUser({ email: 'me@example.test', tenantName: 'Unverified', emailVerifiedAt: null });
		const key = hashParam(await link(), 'linked');

		const preview = await (await browser.post(`${t.baseUrl}/api/auth/zitadel/link/preview`, { key })).json();
		expect(preview.siblings).toEqual([{ userId: sibling.id, tenantName: 'Other' }]);

		const ask = await browser.post(`${t.baseUrl}/api/auth/zitadel/link/confirm`, { key, rows: [sibling.id] });
		expect(await ask.json()).toEqual({ code_required: true });
		expect(t.gauzyAuth.sentCodes).toEqual(['me@example.test']);
		expect(t.accounts.links).toHaveLength(0);

		const wrong = await browser.post(`${t.baseUrl}/api/auth/zitadel/link/confirm`, { key, rows: [sibling.id], code: 'NOPE00' });
		expect(wrong.status).toBe(401);
		expect(t.accounts.links).toHaveLength(0);

		const done = await browser.post(`${t.baseUrl}/api/auth/zitadel/link/confirm`, { key, rows: [sibling.id], code: t.gauzyAuth.code });
		expect((await done.json()).linked.sort()).toEqual([me.id, sibling.id].sort());
	});

	it('ignores a row id that is not an eligible same-address account', async () => {
		const stranger = t.accounts.addUser({ email: 'stranger@example.test' });
		const key = hashParam(await link(), 'linked');
		const done = await browser.post(`${t.baseUrl}/api/auth/zitadel/link/confirm`, { key, rows: [stranger.id] });
		expect(await done.json()).toEqual({ linked: [me.id] });
	});

	it('refuses a pending link of another user', async () => {
		const key = hashParam(await link(), 'linked');
		const other = t.accounts.addUser({ email: 'other@example.test' });
		jest.spyOn(RequestContext, 'currentUserId').mockImplementation(() => other.id);
		const response = await browser.post(`${t.baseUrl}/api/auth/zitadel/link/confirm`, { key });
		expect(response.status).toBe(410);
		expect(t.accounts.links).toHaveLength(0);
	});

	it('refuses an unverified Ever ID e-mail', async () => {
		const landing = await link({ email_verified: false });
		expect(landing).toBe(`${TEST_CLIENT_BASE_URL}/#/pages/settings/connected-identities?error=email_unverified`);
	});

	it('disconnects, unless it is the last way to sign in', async () => {
		await browser.post(`${t.baseUrl}/api/auth/zitadel/link/confirm`, { key: hashParam(await link(), 'linked') });
		const [identity] = await (await browser.get(`${t.baseUrl}/api/auth/zitadel/identities`)).json();

		me.hash = null;
		const refused = await browser.delete(`${t.baseUrl}/api/auth/zitadel/link/${identity.id}`);
		expect(refused.status).toBe(409);
		expect((await refused.json()).code).toBe('last_signin_method');

		me.hash = 'password-digest';
		const removed = await browser.delete(`${t.baseUrl}/api/auth/zitadel/link/${identity.id}`);
		expect(removed.status).toBe(204);
		expect(t.accounts.links).toHaveLength(0);
	});

	it('refuses a second Ever ID of the same issuer on one account', async () => {
		await browser.post(`${t.baseUrl}/api/auth/zitadel/link/confirm`, { key: hashParam(await link(), 'linked') });
		const second = hashParam(await link({ sub: 'another-ever-id' }), 'linked');
		const response = await browser.post(`${t.baseUrl}/api/auth/zitadel/link/confirm`, { key: second });
		expect(response.status).toBe(409);
	});

	it('uses a link ticket once', async () => {
		const { url } = await (await browser.post(`${t.baseUrl}/api/auth/zitadel/link`, {})).json();
		expect((await browser.get(url)).status).toBe(302);
		expect((await browser.get(url)).status).toBe(410);
	});
});
