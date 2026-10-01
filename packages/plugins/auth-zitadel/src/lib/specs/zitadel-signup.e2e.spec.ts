import { TEST_CLIENT_BASE_URL, TestBrowser, ZitadelTestApp, createZitadelTestApp, hashParam } from '../fixtures/zitadel-test-app';

// The first use of `jose` (an ES module that ts-jest compiles on load) and key generation can take
// longer than Jest's 5 s default on a busy machine.
jest.setTimeout(60_000);

describe('Ever Cloud confirmed sign-up (HTTP, against a mock OpenID Provider)', () => {
	let t: ZitadelTestApp;
	let browser: TestBrowser;

	afterEach(async () => {
		await t?.close();
	});

	async function signIn(subject: string, claims: Record<string, unknown> = {}): Promise<string> {
		t.issuer.nextClaims = { sub: subject, ...claims };
		return browser.follow(`${t.baseUrl}/api/auth/zitadel`, TEST_CLIENT_BASE_URL);
	}

	describe('with the sign-up path on (cloud)', () => {
		beforeEach(async () => {
			t = await createZitadelTestApp({ env: { EVER_INSTALL_SOURCE: 'cloud', ZITADEL_SIGNUP_ENABLED: 'true' } });
			browser = new TestBrowser();
		});

		it('creates nothing until the person confirms', async () => {
			const landing = await signIn('new-person', { email: 'new.person@example.test', given_name: 'New', family_name: 'Person' });
			expect(landing).toMatch(`${TEST_CLIENT_BASE_URL}/#/auth/ever-id/signup?handoff=`);
			const handoff = hashParam(landing, 'handoff');

			const details = await browser.post(`${t.baseUrl}/api/auth/zitadel/signup/details`, { handoff });
			expect(await details.json()).toEqual({ email: 'new.person@example.test', firstName: 'New', lastName: 'Person' });

			const unconfirmed = await browser.post(`${t.baseUrl}/api/auth/zitadel/signup`, { handoff, confirm: false });
			expect(unconfirmed.status).toBe(400);
			expect(t.accounts.users).toHaveLength(0);
			expect(t.gauzyAuth.registered).toHaveLength(0);
		});

		it('creates exactly one account and one sign-up link after the confirmation', async () => {
			const landing = await signIn('new-person', { email: 'new.person@example.test' });
			const handoff = hashParam(landing, 'handoff');

			const created = await browser.post(`${t.baseUrl}/api/auth/zitadel/signup`, { handoff, confirm: true, firstName: 'Ann' });
			expect(created.status).toBe(200);
			const response = await created.json();
			expect(response.total_workspaces).toBe(1);
			expect(t.gauzyAuth.registered).toEqual([{ user: { email: 'new.person@example.test', firstName: 'Ann', lastName: 'Person' } }]);
			expect(t.accounts.users).toHaveLength(1);
			expect(t.accounts.users[0].emailVerifiedAt).toBeInstanceOf(Date);
			expect(t.accounts.links).toEqual([expect.objectContaining({ linkMethod: 'signup', userId: t.accounts.users[0].id })]);

			// The key is single use.
			const replay = await browser.post(`${t.baseUrl}/api/auth/zitadel/signup`, { handoff, confirm: true });
			expect(replay.status).toBe(410);
			expect(t.accounts.users).toHaveLength(1);
		});

		it('waits for checkout without creating anything, then finishes when the person signs in with Ever ID again', async () => {
			t.gate.allowed = false;
			const landing = await signIn('buyer', { email: 'buyer@example.test' });
			const refused = await browser.post(`${t.baseUrl}/api/auth/zitadel/signup`, {
				handoff: hashParam(landing, 'handoff'),
				confirm: true
			});
			expect(refused.status).toBe(403);
			const body = await refused.json();
			expect(body.code).toBe('subscription_required');
			expect(body.checkoutUrl).toBe('https://checkout.example.test/checkout');
			expect(body.checkoutUrl).not.toMatch(/@|%40|email/);
			expect(t.accounts.users).toHaveLength(0);

			// After checkout the person signs in with Ever ID again: the confirmed sign-up resumes.
			t.gate.allowed = true;
			const back = await signIn('buyer', { email: 'buyer@example.test' });
			expect(back).toMatch(`${TEST_CLIENT_BASE_URL}/#/auth/ever-id?handoff=`);
			expect(t.accounts.users).toHaveLength(1);
			expect(t.accounts.links).toEqual([expect.objectContaining({ linkMethod: 'signup' })]);

			// And only once: a later sign-in is an ordinary linked sign-in.
			const later = await signIn('buyer', { email: 'buyer@example.test' });
			expect(later).toMatch('/#/auth/ever-id?handoff=');
			expect(t.accounts.users).toHaveLength(1);
			expect(t.gauzyAuth.registered).toHaveLength(1);
		});

		it('requires every document Gauzy currently requires before creating anything', async () => {
			const document = { documentId: 'terms', version: '2', sha256: 'a'.repeat(64), locale: 'en' };
			t.terms.required = [{ ...document, url: '/legal/terms', title: 'Terms', effectiveDate: '2026-01-01' } as never];
			const landing = await signIn('new-person', { email: 'new.person@example.test' });
			const handoff = hashParam(landing, 'handoff');

			const without = await browser.post(`${t.baseUrl}/api/auth/zitadel/signup`, { handoff, confirm: true });
			expect(without.status).toBe(400);
			expect(t.gauzyAuth.registered).toHaveLength(0);

			const accepted = await browser.post(`${t.baseUrl}/api/auth/zitadel/signup`, { handoff, confirm: true, terms: [document] });
			expect(accepted.status).toBe(200);
			expect(t.gauzyAuth.registered).toEqual([expect.objectContaining({ terms: [document] })]);
		});

		it('keeps a confirmed sign-up resumable when a step fails, and never registers twice', async () => {
			const landing = await signIn('new-person', { email: 'new.person@example.test' });
			const failOnce = jest.spyOn(t.accounts, 'link').mockRejectedValueOnce(new Error('database unavailable'));

			const failed = await browser.post(`${t.baseUrl}/api/auth/zitadel/signup`, { handoff: hashParam(landing, 'handoff'), confirm: true });
			expect(failed.status).toBe(500);
			expect(t.gauzyAuth.registered).toHaveLength(1);
			expect(t.accounts.links).toHaveLength(0);
			failOnce.mockRestore();

			// The next Ever ID sign-in finishes the sign-up with the account that already exists.
			const back = await signIn('new-person', { email: 'new.person@example.test' });
			expect(back).toMatch(`${TEST_CLIENT_BASE_URL}/#/auth/ever-id?handoff=`);
			expect(t.gauzyAuth.registered).toHaveLength(1);
			expect(t.accounts.users).toHaveLength(1);
			expect(t.accounts.links).toEqual([expect.objectContaining({ linkMethod: 'signup', userId: t.accounts.users[0].id })]);
		});

		it('answers signup_required on the token route for a person new to Gauzy', async () => {
			const idToken = await t.issuer.sign(t.issuer.idTokenClaims('teams-person', { aud: 'teams-web', azp: 'teams-web' }));
			const response = await browser.post(`${t.baseUrl}/api/auth/zitadel/token`, { id_token: idToken });
			expect(response.status).toBe(404);
			const body = await response.json();
			expect(body.code).toBe('signup_required');
			expect(body.handoff).toBeTruthy();
			expect(t.accounts.users).toHaveLength(0);
		});
	});

	describe('with the sign-up path off, or not on Ever Cloud', () => {
		it.each([
			[{ EVER_INSTALL_SOURCE: 'cloud' }],
			[{ ZITADEL_SIGNUP_ENABLED: 'true' }],
			[{ EVER_INSTALL_SOURCE: 'cloud', ZITADEL_SIGNUP_ENABLED: 'TRUE' }]
		])('never creates an account (%j)', async (env) => {
			t = await createZitadelTestApp({ env });
			browser = new TestBrowser();
			const landing = await signIn('someone', { email: 'someone@example.test' });
			expect(landing).toMatch('/#/auth/register?ever_id=1&handoff=');
			const signup = await browser.post(`${t.baseUrl}/api/auth/zitadel/signup`, { handoff: hashParam(landing, 'handoff'), confirm: true });
			expect(signup.status).toBe(404);
			expect(t.accounts.users).toHaveLength(0);

			const idToken = await t.issuer.sign(t.issuer.idTokenClaims('someone', { aud: 'teams-web', azp: 'teams-web' }));
			const token = await browser.post(`${t.baseUrl}/api/auth/zitadel/token`, { id_token: idToken });
			expect(token.status).toBe(404);
			expect((await token.json()).code).toBe('no_workspace');
		});
	});
});
