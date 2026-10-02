import { TokenPurposeEnum, verifyPurposeToken } from '@gauzy/core';
import { manualPause } from '../fixtures/in-memory-accounts';
import { TEST_CLIENT_BASE_URL, TestBrowser, ZitadelTestApp, createZitadelTestApp, hashParam } from '../fixtures/zitadel-test-app';

// The first use of `jose` (an ES module that ts-jest compiles on load) and key generation can take
// longer than Jest's 5 s default on a busy machine.
jest.setTimeout(60_000);

/**
 * No URL of the flow may carry an e-mail address, the test person's name or subject, a JWT or a login
 * hint. (The authorization code and `state` are random values; only these known values are looked for.)
 */
function expectNoPersonalDataInUrls(urls: string[]): void {
	for (const url of urls) {
		expect(url).not.toMatch(/@|%40/);
		expect(url).not.toMatch(/person-[a-z]/i);
		expect(url).not.toMatch(/Test|Person/);
		expect(url).not.toMatch(/login_hint/);
		expect(url).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/);
	}
}

describe('Ever ID sign-in (HTTP, against a mock OpenID Provider)', () => {
	let t: ZitadelTestApp;
	let browser: TestBrowser;

	afterEach(async () => {
		await t?.close();
	});

	async function signIn(subject: string, claims: Record<string, unknown> = {}): Promise<string> {
		t.issuer.nextClaims = { sub: subject, ...claims };
		return browser.follow(`${t.baseUrl}/api/auth/zitadel`, TEST_CLIENT_BASE_URL);
	}

	describe('explicit link mode (self-hosted default)', () => {
		beforeEach(async () => {
			t = await createZitadelTestApp();
			browser = new TestBrowser();
		});

		it('reports its configuration', async () => {
			const response = await browser.get(`${t.baseUrl}/api/auth/zitadel/config`);
			expect(response.status).toBe(200);
			expect(response.headers.get('cache-control')).toBe('no-store');
			expect(await response.json()).toEqual({
				enabled: true,
				issuer: t.issuer.issuer,
				link_modes: ['explicit'],
				jit: false,
				signup: false
			});
		});

		it('starts with PKCE, state and nonce in a signed HttpOnly cookie, and no personal data in the URL', async () => {
			const response = await browser.get(`${t.baseUrl}/api/auth/zitadel?redirect=/pages/dashboard`);
			expect(response.status).toBe(302);
			const location = new URL(response.headers.get('location'));
			expect(`${location.origin}${location.pathname}`).toBe(`${t.issuer.issuer}/oauth/v2/authorize`);
			expect(location.searchParams.get('code_challenge_method')).toBe('S256');
			expect(location.searchParams.get('code_challenge')).toHaveLength(43);
			expect(location.searchParams.get('state')).toBeTruthy();
			expect(location.searchParams.get('nonce')).toBeTruthy();
			expect(location.searchParams.get('client_id')).toBe('gauzy-web-test');
			expect(location.searchParams.get('scope')).toContain('openid');
			expect(location.searchParams.has('login_hint')).toBe(false);
			const cookie = response.headers.getSetCookie().find((value) => value.startsWith('ever_zitadel_txn='));
			expect(cookie).toMatch(/HttpOnly/);
			expect(cookie).toMatch(/SameSite=Lax/);
			expect(cookie).toMatch(/Path=\/api\/auth/);
			expectNoPersonalDataInUrls([response.headers.get('location')]);
		});

		it('signs a linked identity in to every linked workspace with one-time hand-off keys', async () => {
			const user1 = t.accounts.addUser({ email: 'person-a@example.test', tenantName: 'One' });
			const user2 = t.accounts.addUser({ email: 'person-a@example.test', tenantName: 'Two' });
			const user3 = t.accounts.addUser({ email: 'person-a@example.test', tenantName: 'Three' });
			await t.accounts.link([user1, user2, user3], { issuer: t.issuer.issuer, subject: 'person-a' }, 'explicit');

			const landing = await signIn('person-a');
			expect(landing).toMatch(`${TEST_CLIENT_BASE_URL}/#/auth/ever-id?handoff=`);
			const handoff = hashParam(landing, 'handoff');

			const redeemed = await browser.post(`${t.baseUrl}/api/auth/zitadel/handoff`, { handoff });
			expect(redeemed.status).toBe(200);
			const record = await redeemed.json();
			expect(record.kind).toBe('workspaces');
			expect(record.response.total_workspaces).toBe(3);
			expect(record.response.confirmed_email).toBe('person-a@example.test');
			for (const workspace of record.response.workspaces) {
				const payload = verifyPurposeToken<{ userId: string; email: string }>(workspace.token, TokenPurposeEnum.WORKSPACE_SIGNIN, {
					requiredClaims: ['userId', 'email']
				});
				expect([user1.id, user2.id, user3.id]).toContain(payload.userId);
			}
			expect(t.sessions.recorded.map((row) => row.sid)).toEqual(['sid-person-a', 'sid-person-a', 'sid-person-a']);

			// The key works once.
			const replay = await browser.post(`${t.baseUrl}/api/auth/zitadel/handoff`, { handoff });
			expect(replay.status).toBe(410);
			expectNoPersonalDataInUrls(browser.locations);
		});

		it('refuses an unverified e-mail and writes nothing', async () => {
			t.accounts.addUser({ email: 'person-b@example.test' });
			const landing = await signIn('person-b', { email: 'person-b@example.test', email_verified: false });
			expect(landing).toBe(`${TEST_CLIENT_BASE_URL}/#/auth/ever-id?error=email_unverified`);
			expect(t.accounts.links).toHaveLength(0);
		});

		it('never links by e-mail: an equal verified address gets the register page and zero links', async () => {
			t.accounts.addUser({ email: 'person-c@example.test' });
			const landing = await signIn('person-c', { email: 'person-c@example.test' });
			expect(landing).toMatch(`${TEST_CLIENT_BASE_URL}/#/auth/register?ever_id=1&handoff=`);
			expect(t.accounts.links).toHaveLength(0);
			expect(t.gauzyAuth.sentCodes).toHaveLength(0);

			const prefill = await (await browser.post(`${t.baseUrl}/api/auth/zitadel/handoff`, { handoff: hashParam(landing, 'handoff') })).json();
			expect(prefill).toEqual({ kind: 'register', prefill: { email: 'person-c@example.test', firstName: 'Test', lastName: 'Person' } });
			expectNoPersonalDataInUrls(browser.locations);
		});

		it('does not offer the cloud-only options on a self-hosted install', async () => {
			await t.close();
			t = await createZitadelTestApp({ env: { ZITADEL_LINK_MODE: 'confirmed', ZITADEL_SIGNUP_ENABLED: 'true' } });
			const config = await (await browser.get(`${t.baseUrl}/api/auth/zitadel/config`)).json();
			expect(config.link_modes).toEqual(['explicit']);
			expect(config.signup).toBe(false);
		});

		it('returns to the login page when the person cancels at the issuer', async () => {
			t.issuer.authorizeError = 'access_denied';
			const landing = await signIn('person-d');
			expect(landing).toBe(`${TEST_CLIENT_BASE_URL}/#/auth/ever-id?error=cancelled`);
		});

		it('refuses a callback without its transaction cookie', async () => {
			const start = await browser.get(`${t.baseUrl}/api/auth/zitadel`);
			const authorize = await fetch(start.headers.get('location'), { redirect: 'manual' });
			const callback = authorize.headers.get('location');
			const stranger = new TestBrowser();
			const response = await stranger.get(callback);
			expect(response.headers.get('location')).toBe(`${TEST_CLIENT_BASE_URL}/#/auth/ever-id?error=sign_in_failed`);
		});
	});

	describe('confirmed link mode (Ever Cloud)', () => {
		beforeEach(async () => {
			t = await createZitadelTestApp({ env: { EVER_INSTALL_SOURCE: 'cloud', ZITADEL_LINK_MODE: 'confirmed' } });
			browser = new TestBrowser();
		});

		it('sends Gauzy\'s own code and links only after it is entered', async () => {
			const user = t.accounts.addUser({ email: 'person-e@example.test', tenantName: 'Acme' });
			const landing = await signIn('person-e', { email: 'PERSON-E@example.test' });
			expect(landing).toMatch(`${TEST_CLIENT_BASE_URL}/#/auth/ever-id/confirm?handoff=`);
			expect(t.gauzyAuth.sentCodes).toEqual(['person-e@example.test']);
			expect(t.accounts.links).toHaveLength(0);

			const handoff = hashParam(landing, 'handoff');
			const wrong = await browser.post(`${t.baseUrl}/api/auth/zitadel/confirm`, { handoff, code: 'WRONG1' });
			expect(wrong.status).toBe(401);
			expect(t.accounts.links).toHaveLength(0);

			const right = await browser.post(`${t.baseUrl}/api/auth/zitadel/confirm`, { handoff, code: t.gauzyAuth.code });
			expect(right.status).toBe(200);
			const response = await right.json();
			expect(response.total_workspaces).toBe(1);
			expect(t.accounts.links).toEqual([expect.objectContaining({ userId: user.id, linkMethod: 'confirmed' })]);
			expectNoPersonalDataInUrls(browser.locations);
		});

		it('discards the confirmation after five wrong codes', async () => {
			t.accounts.addUser({ email: 'person-f@example.test' });
			const landing = await signIn('person-f', { email: 'person-f@example.test' });
			const handoff = hashParam(landing, 'handoff');
			const statuses: number[] = [];
			for (let attempt = 0; attempt < 5; attempt++) {
				statuses.push((await browser.post(`${t.baseUrl}/api/auth/zitadel/confirm`, { handoff, code: `BAD${attempt}` })).status);
			}
			expect(statuses).toEqual([401, 401, 401, 401, 410]);
			expect(await t.store.get('confirm', handoff)).toBeNull();
			// A sixth try within the minute is refused by the per-key limit before anything is looked up.
			const late = await browser.post(`${t.baseUrl}/api/auth/zitadel/confirm`, { handoff, code: t.gauzyAuth.code });
			expect(late.status).toBe(429);
			expect(t.accounts.links).toHaveLength(0);
		});

		it('answers 409 handoff_busy while another attempt checks a code for the key, and keeps the key valid', async () => {
			const user = t.accounts.addUser({ email: 'person-i@example.test' });
			const handoff = hashParam(await signIn('person-i', { email: 'person-i@example.test' }), 'handoff');
			const pause = manualPause();
			t.gauzyAuth.beforeCheck = pause.wait;

			const first = browser.post(`${t.baseUrl}/api/auth/zitadel/confirm`, { handoff, code: 'WRONG1' });
			await pause.reached;
			const busy = await browser.post(`${t.baseUrl}/api/auth/zitadel/confirm`, { handoff, code: t.gauzyAuth.code });
			expect(busy.status).toBe(409);
			expect(busy.headers.get('retry-after')).toBe('2');
			expect(await busy.json()).toEqual(expect.objectContaining({ code: 'handoff_busy', retryAfter: 2 }));
			pause.release();
			expect((await first).status).toBe(401);

			// The busy answer cost no attempt and the key still works.
			const right = await browser.post(`${t.baseUrl}/api/auth/zitadel/confirm`, { handoff, code: t.gauzyAuth.code });
			expect(right.status).toBe(200);
			expect(t.accounts.links).toEqual([expect.objectContaining({ userId: user.id, linkMethod: 'confirmed' })]);
			// Used up now: 410, not 409.
			expect((await browser.post(`${t.baseUrl}/api/auth/zitadel/confirm`, { handoff, code: t.gauzyAuth.code })).status).toBe(410);
		});

		it('answers 409 handoff_busy while the key is held, without spending an attempt', async () => {
			t.accounts.addUser({ email: 'person-j@example.test' });
			const handoff = hashParam(await signIn('person-j', { email: 'person-j@example.test' }), 'handoff');
			expect(await t.store.hold('confirm', handoff)).toBe(true);
			expect((await browser.post(`${t.baseUrl}/api/auth/zitadel/confirm`, { handoff, code: 'WRONG1' })).status).toBe(409);
			await t.store.release('confirm', handoff);
			expect(await t.store.get('confirm', handoff)).toEqual(expect.objectContaining({ attempts: 0 }));
		});

		it('keeps the browser answers without team lists', async () => {
			t.accounts.addUser({ email: 'person-k@example.test' });
			const handoff = hashParam(await signIn('person-k', { email: 'person-k@example.test' }), 'handoff');
			const right = await browser.post(`${t.baseUrl}/api/auth/zitadel/confirm`, { handoff, code: t.gauzyAuth.code });
			expect(right.status).toBe(200);
			const response = await right.json();
			expect(response.workspaces[0].current_teams).toBeUndefined();
			expect(t.gauzyAuth.teamRequests).toEqual([false]);
			expect(t.gauzyAuth.sentInputs).toEqual([{}]);
		});

		it('never offers an unverified account for a confirmed link', async () => {
			t.accounts.addUser({ email: 'person-g@example.test', emailVerifiedAt: null });
			const landing = await signIn('person-g', { email: 'person-g@example.test' });
			expect(landing).toMatch('/#/auth/register?ever_id=1&handoff=');
			expect(t.gauzyAuth.sentCodes).toHaveLength(0);
		});
	});

	describe('organization sign-in rules', () => {
		beforeEach(async () => {
			t = await createZitadelTestApp();
			browser = new TestBrowser();
		});

		it('moves a workspace whose organization is filtered, or requires company sign-in, to the blocked list', async () => {
			const open = t.accounts.addUser({ email: 'person-h@example.test', tenantName: 'Open' });
			const filtered = t.accounts.addUser({ email: 'person-h@example.test', tenantName: 'Filtered' });
			const enforced = t.accounts.addUser({ email: 'person-h@example.test', tenantName: 'Enforced' });
			await t.accounts.link([open, filtered, enforced], { issuer: t.issuer.issuer, subject: 'person-h' }, 'explicit');
			t.accounts.organizations.push(
				{ tenantId: filtered.tenantId, everOrgId: 'org-filtered', ssoEnforced: false } as never,
				{ tenantId: enforced.tenantId, everOrgId: 'org-enforced', ssoEnforced: true } as never
			);

			const landing = await signIn('person-h', {
				'urn:ever:orgs_filtered': [{ id: 'org-filtered', handle: 'filtered', reason: 'sso_required' }, { org_id: 'ignored' }]
			});
			const record = await (await browser.post(`${t.baseUrl}/api/auth/zitadel/handoff`, { handoff: hashParam(landing, 'handoff') })).json();
			expect(record.response.workspaces.map((w: { user: { id: string } }) => w.user.id)).toEqual([open.id]);
			expect(record.response.blocked_workspaces).toEqual(
				expect.arrayContaining([
					{ tenantId: filtered.tenantId, tenantName: 'Filtered', reason: 'sso_required' },
					{ tenantId: enforced.tenantId, tenantName: 'Enforced', reason: 'sso_enforced' }
				])
			);
		});
	});
});
