import { TokenPurposeEnum, verifyPurposeToken } from '@gauzy/core';
import { TestBrowser, ZitadelTestApp, createZitadelTestApp } from '../fixtures/zitadel-test-app';

// The first use of `jose` (an ES module that ts-jest compiles on load) and key generation can take
// longer than Jest's 5 s default on a busy machine.
jest.setTimeout(60_000);

describe('Token route for first-party clients (HTTP, against a mock OpenID Provider)', () => {
	let t: ZitadelTestApp;
	let browser: TestBrowser;

	beforeEach(async () => {
		t = await createZitadelTestApp();
		browser = new TestBrowser();
		const user = t.accounts.addUser({ email: 'teams.user@example.test', tenantName: 'Team' });
		await t.accounts.link([user], { issuer: t.issuer.issuer, subject: 'teams-user' }, 'explicit');
	});

	afterEach(async () => {
		await t?.close();
	});

	async function post(body: Record<string, unknown>) {
		return browser.post(`${t.baseUrl}/api/auth/zitadel/token`, body);
	}

	it('answers the workspace list for an allow-listed client\'s ID token', async () => {
		const idToken = await t.issuer.sign(t.issuer.idTokenClaims('teams-user', { aud: 'teams-web', azp: 'teams-web' }));
		const response = await post({ id_token: idToken });
		expect(response.status).toBe(200);
		expect((await response.json()).total_workspaces).toBe(1);
	});

	it.each([
		['a foreign audience', { aud: 'someone-else', azp: 'someone-else' }],
		['an operator client of another instance', { aud: ['teams-web', 'inst-1234'], azp: 'inst-1234' }],
		['this product\'s own web client', { aud: 'gauzy-web-test', azp: 'gauzy-web-test' }],
		['an expired token', { aud: 'teams-web', exp: Math.floor(Date.now() / 1000) - 600 }],
		['an unverified e-mail', { aud: 'teams-web', email_verified: false }],
		['another issuer', { aud: 'teams-web', iss: 'http://127.0.0.1:1' }]
	])('refuses %s with 401', async (_name, claims) => {
		const idToken = await t.issuer.sign(t.issuer.idTokenClaims('teams-user', claims));
		const response = await post({ id_token: idToken });
		expect(response.status).toBe(401);
	});

	it('refuses a tampered signature', async () => {
		const idToken = await t.issuer.sign(t.issuer.idTokenClaims('teams-user', { aud: 'teams-web' }));
		const [header, payload] = idToken.split('.');
		const response = await post({ id_token: `${header}.${payload}.${'A'.repeat(86)}` });
		expect(response.status).toBe(401);
	});

	it('accepts a JWT access token of an allow-listed client for an existing link only, without a userinfo call', async () => {
		const now = Math.floor(Date.now() / 1000);
		const accessToken = await t.issuer.sign({
			iss: t.issuer.issuer,
			sub: 'teams-user',
			aud: ['project-id', 'teams-web'],
			client_id: 'teams-web',
			iat: now,
			exp: now + 300
		});
		const linked = await post({ access_token: accessToken });
		expect(linked.status).toBe(200);

		const unknown = await t.issuer.sign({ iss: t.issuer.issuer, sub: 'nobody', aud: 'teams-web', client_id: 'teams-web', iat: now, exp: now + 300 });
		const refused = await post({ access_token: unknown });
		expect(refused.status).toBe(401);
		expect((await refused.json()).code).toBe('id_token_required');

		const foreign = await t.issuer.sign({ iss: t.issuer.issuer, sub: 'teams-user', aud: ['teams-web'], client_id: 'inst-99', iat: now, exp: now + 300 });
		expect((await post({ access_token: foreign })).status).toBe(401);

		// A token minted for another resource does not open Gauzy, even when an allowed client asked for it.
		const otherResource = await t.issuer.sign({
			iss: t.issuer.issuer,
			sub: 'teams-user',
			aud: ['other-resource'],
			azp: 'teams-web',
			client_id: 'teams-web',
			iat: now,
			exp: now + 300
		});
		expect((await post({ access_token: otherResource })).status).toBe(401);

		expect(t.issuer.requests.some((request) => request.path.includes('userinfo'))).toBe(false);
	});

	it('refuses opaque tokens', async () => {
		expect((await post({ access_token: 'opaque-access-token' })).status).toBe(401);
		expect((await post({})).status).toBe(401);
	});

	it('refuses an access token whose subject is not text', async () => {
		const now = Math.floor(Date.now() / 1000);
		const accessToken = await t.issuer.sign({ iss: t.issuer.issuer, sub: 42 as never, aud: 'teams-web', iat: now, exp: now + 300 });
		expect((await post({ access_token: accessToken })).status).toBe(401);
	});

	it('hands out workspace tokens that expire with the session binding window (15 minutes), not after a day', async () => {
		const idToken = await t.issuer.sign(t.issuer.idTokenClaims('teams-user', { aud: 'teams-web', azp: 'teams-web' }));
		const { workspaces } = await (await post({ id_token: idToken })).json();
		const payload = verifyPurposeToken<{ userId: string }>(workspaces[0].token, TokenPurposeEnum.WORKSPACE_SIGNIN, {
			requiredClaims: ['userId', 'email']
		});
		expect(payload.exp - payload.iat).toBeLessThanOrEqual(15 * 60);
	});

	describe('confirmed links (Ever Cloud)', () => {
		beforeEach(async () => {
			await t.close();
			t = await createZitadelTestApp({ env: { EVER_INSTALL_SOURCE: 'cloud', ZITADEL_LINK_MODE: 'confirmed' } });
			browser = new TestBrowser();
		});

		async function teamsIdToken(subject: string, email: string) {
			return t.issuer.sign(t.issuer.idTokenClaims(subject, { aud: 'teams-web', azp: 'teams-web', email }));
		}

		it('sends the code with the requesting app\'s branding (display fields only)', async () => {
			t.accounts.addUser({ email: 'branded@example.test' });
			const response = await post({
				id_token: await teamsIdToken('branded', 'branded@example.test'),
				appName: 'Ever Teams',
				appLogo: 'https://teams.example.test/logo.png',
				appSignature: 'The Ever Teams team',
				appLink: 'https://teams.example.test',
				companyName: 'Ever',
				companyLink: 'http://ever.example.test',
				appMagicSignUrl: 'https://elsewhere.example.test/magic'
			});
			expect(response.status).toBe(200);
			expect(await response.json()).toEqual({ confirm_required: true, handoff: expect.any(String) });
			expect(t.gauzyAuth.sentCodes).toEqual(['branded@example.test']);
			// No https: the company link is left to Gauzy's default; the magic link is never taken from a request.
			expect(t.gauzyAuth.sentInputs).toEqual([
				{
					appName: 'Ever Teams',
					appLogo: 'https://teams.example.test/logo.png',
					appSignature: 'The Ever Teams team',
					appLink: 'https://teams.example.test/',
					companyName: 'Ever'
				}
			]);
		});

		it('sends the code with Gauzy\'s own branding when the app sends none', async () => {
			t.accounts.addUser({ email: 'plain@example.test' });
			expect((await post({ id_token: await teamsIdToken('plain', 'plain@example.test') })).status).toBe(200);
			expect(t.gauzyAuth.sentInputs).toEqual([{}]);
		});

		it('answers the confirmation of a key from the token route with each workspace\'s team list', async () => {
			const one = t.accounts.addUser({ email: 'teams.person@example.test', tenantName: 'One' });
			const two = t.accounts.addUser({ email: 'teams.person@example.test', tenantName: 'Two' });
			const { handoff } = await (await post({ id_token: await teamsIdToken('teams-person', 'teams.person@example.test') })).json();

			const confirmed = await browser.post(`${t.baseUrl}/api/auth/zitadel/confirm`, { handoff, code: t.gauzyAuth.code });
			expect(confirmed.status).toBe(200);
			const response = await confirmed.json();
			expect(response.total_workspaces).toBe(2);
			const teamsByUser = Object.fromEntries(
				response.workspaces.map((workspace: { user: { id: string }; current_teams: unknown }) => [workspace.user.id, workspace.current_teams])
			);
			expect(teamsByUser).toEqual({
				[one.id]: [{ team_id: `team-of-${one.id}`, team_name: 'Team' }],
				[two.id]: [{ team_id: `team-of-${two.id}`, team_name: 'Team' }]
			});
			expect(t.gauzyAuth.teamRequests).toEqual([true]);
		});
	});
});
