import { createHash, randomBytes } from 'node:crypto';
import {
	TEST_CLIENT_BASE_URL,
	TestBrowser,
	ZitadelTestApp,
	createZitadelTestApp,
	hashParam
} from '../fixtures/zitadel-test-app';

jest.setTimeout(60_000);

const provisionKey = () => randomBytes(32).toString('base64url');

/**
 * A sign-in started to confirm a workspace Ever asked this installation to create
 * (`GET /api/auth/zitadel?provision=<key>`): the key rides in the signed transaction cookie only, the
 * callback links nothing and signs nobody in, and the confirmation page gets two opaque keys; the
 * verified identity (never the token) is kept server-side for `ZITADEL_HANDOFF_READER`. A sign-in
 * without the key is unchanged.
 */
describe('Ever ID sign-in that confirms a workspace from Ever', () => {
	let t: ZitadelTestApp;
	let browser: TestBrowser;

	beforeEach(async () => {
		t = await createZitadelTestApp();
		browser = new TestBrowser();
	});

	afterEach(async () => {
		await t?.close();
	});

	async function signIn(query: string, claims: Record<string, unknown>): Promise<string> {
		t.issuer.nextClaims = claims;
		return browser.follow(`${t.baseUrl}/api/auth/zitadel${query}`, TEST_CLIENT_BASE_URL);
	}

	it('leads to the confirmation page with the provisioning key and a one-time sign-in key, nothing else in a URL', async () => {
		const key = provisionKey();
		const start = await browser.get(`${t.baseUrl}/api/auth/zitadel?provision=${key}`);
		const authorize = new URL(start.headers.get('location'));
		expect(authorize.searchParams.has('login_hint')).toBe(false);
		expect(authorize.searchParams.has('prompt')).toBe(false);
		expect(authorize.toString()).not.toContain(key);

		t.issuer.nextClaims = { sub: 'person-p', email: 'owner@acme.example', given_name: 'Ada', family_name: 'Owner' };
		const location = await browser.follow(authorize.toString(), TEST_CLIENT_BASE_URL);
		expect(location.startsWith(`${TEST_CLIENT_BASE_URL}/#/auth/ever-connect/provision?`)).toBe(true);
		expect(hashParam(location, 'provision')).toBe(key);
		const handoff = hashParam(location, 'handoff');
		expect(handoff).toMatch(/^[A-Za-z0-9_-]{43}$/);
		for (const url of browser.locations) {
			expect(url).not.toMatch(/@|%40|eyJ[A-Za-z0-9_-]{10,}|login_hint|person-p/);
		}

		// The verified identity, not the token; read without using it up.
		expect(await t.handoffs.peek(handoff)).toEqual({
			issuer: t.issuer.issuer,
			subject: 'person-p',
			email: 'owner@acme.example',
			givenName: 'Ada',
			familyName: 'Owner',
			provisionKeyHash: createHash('sha256').update(key).digest('hex'),
			signedInAt: expect.any(Number)
		});
		expect(JSON.stringify(await t.handoffs.peek(handoff))).not.toMatch(/eyJ/);
		expect(await t.handoffs.peek(handoff)).not.toBeNull();
		// Nothing was linked and nobody was signed in.
		expect(t.accounts.links).toEqual([]);
		expect(t.published).toEqual([]);

		expect(await t.handoffs.consume(handoff)).toMatchObject({ subject: 'person-p' });
		expect(await t.handoffs.consume(handoff)).toBeNull();
		expect(await t.handoffs.peek(handoff)).toBeNull();
	});

	it('a linked identity is not signed in to its workspaces on this path', async () => {
		const user = t.accounts.addUser({ email: 'owner@acme.example', tenantName: 'Existing' });
		await t.accounts.link([user], { issuer: t.issuer.issuer, subject: 'person-q' }, 'explicit');
		const location = await signIn(`?provision=${provisionKey()}`, { sub: 'person-q', email: 'owner@acme.example' });
		expect(location).toContain('#/auth/ever-connect/provision?');
		expect(hashParam(location, 'handoff')).toBeTruthy();
	});

	it('signIn uses the hand-off up and answers a workspace sign-in key for a user linked to that same Ever ID only', async () => {
		const location = await signIn(`?provision=${provisionKey()}`, { sub: 'person-r', email: 'owner@acme.example' });
		const handoff = hashParam(location, 'handoff');
		const stranger = t.accounts.addUser({ email: 'someone@acme.example', tenantName: 'Other' });
		expect(await t.handoffs.signIn(handoff, stranger.id)).toBeNull();

		const second = hashParam(
			await signIn(`?provision=${provisionKey()}`, { sub: 'person-r', email: 'owner@acme.example' }),
			'handoff'
		);
		const owner = t.accounts.addUser({ email: 'owner@acme.example', tenantName: 'Acme' });
		await t.accounts.link([owner], { issuer: t.issuer.issuer, subject: 'person-r' }, 'provisioned');
		const signInKey = await t.handoffs.signIn(second, owner.id);
		expect(signInKey).toMatch(/^[A-Za-z0-9_-]{43}$/);
		expect(await t.handoffs.peek(second)).toBeNull();
		// The existing hand-off route redeems it once, into the new workspace.
		const redeemed = await browser.post(`${t.baseUrl}/api/auth/zitadel/handoff`, { handoff: signInKey });
		expect(redeemed.status).toBe(200);
		const record = await redeemed.json();
		expect(record.kind).toBe('workspaces');
		expect(record.response.workspaces.map((w: { user: { id: string } }) => w.user.id)).toEqual([owner.id]);
	});

	it('an unverified e-mail: the error page, nothing kept', async () => {
		const location = await signIn(`?provision=${provisionKey()}`, {
			sub: 'person-s',
			email: 'owner@acme.example',
			email_verified: false
		});
		expect(location).toBe(`${TEST_CLIENT_BASE_URL}/#/auth/ever-id?error=email_unverified`);
	});

	it('a malformed key is refused before the issuer is asked', async () => {
		const before = t.issuer.requests.length;
		const start = await browser.get(`${t.baseUrl}/api/auth/zitadel?provision=not-a-key`);
		expect(t.issuer.requests.length).toBe(before);
		expect(start.headers.get('location')).toBe(`${TEST_CLIENT_BASE_URL}/#/auth/ever-id?error=sign_in_failed`);
	});

	it('a sign-in without the key is unchanged (redirect kept, workspaces hand-off)', async () => {
		const user = t.accounts.addUser({ email: 'person-t@example.test', tenantName: 'One' });
		await t.accounts.link([user], { issuer: t.issuer.issuer, subject: 'person-t' }, 'explicit');
		const location = await signIn('?redirect=/pages/dashboard', {
			sub: 'person-t',
			email: 'person-t@example.test'
		});
		expect(location.startsWith(`${TEST_CLIENT_BASE_URL}/#/auth/ever-id?handoff=`)).toBe(true);
		const redeemed = await browser.post(`${t.baseUrl}/api/auth/zitadel/handoff`, {
			handoff: hashParam(location, 'handoff')
		});
		expect((await redeemed.json()).response.redirect).toBe('/pages/dashboard');
	});

	it('the hand-off is stored under a digest of its key, with the digest of the provisioning key only', async () => {
		const key = provisionKey();
		const location = await signIn(`?provision=${key}`, { sub: 'person-u', email: 'owner@acme.example' });
		const handoff = hashParam(location, 'handoff');
		const stored = JSON.stringify([...(t.cache as unknown as { entries: Map<string, unknown> }).entries]);
		expect(stored).not.toContain(handoff);
		expect(stored).not.toContain(key);
		expect(stored).toContain(createHash('sha256').update(key).digest('hex'));
	});
});
