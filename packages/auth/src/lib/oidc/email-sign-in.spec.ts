import { Logger } from '@nestjs/common';
import { environment } from '@gauzy/config';
import { FakeOidcHttp, TestSigningKey, generateSigningKey, publishIssuer, randomTestSecret, signTestToken } from './fixtures/oidc-test-kit';
import { OidcClientService } from './oidc-client.service';
import { OidcDiscoveryService } from './oidc-discovery.service';
import { OidcEmailSignInFlow, OidcEmailSignInService } from './oidc-email-sign-in.service';
import { OidcJwksService } from './oidc-jwks.service';
import { OidcCookieRequest, OidcCookieResponse, OidcTransactionService } from './oidc-transaction.service';

// The first use of `jose` (an ES module that ts-jest compiles on load) and key generation can take
// longer than Jest's 5 s default on a busy machine.
jest.setTimeout(60_000);

const ISSUER = 'https://issuer.example.test';
const OTHER_ISSUER = 'https://other-issuer.example.test';
const CLIENT_ID = 'gauzy-web';
const COOKIE = 'gauzy_test_txn';

/** A browser's cookie jar for one origin: what the responses set, the next request sends. */
class Browser {
	private readonly jar = new Map<string, string>();

	readonly response: OidcCookieResponse = {
		cookie: (name: string, value: string) => this.jar.set(name, value),
		clearCookie: (name: string) => this.jar.delete(name)
	};

	request(): OidcCookieRequest {
		return { headers: {}, cookies: Object.fromEntries(this.jar) };
	}

	has(name: string): boolean {
		return this.jar.has(name);
	}

	forget(): void {
		this.jar.clear();
	}
}

describe('OidcEmailSignInService (sign-in by verified e-mail on the shared library)', () => {
	let key: TestSigningKey;
	let http: FakeOidcHttp;
	let service: OidcEmailSignInService;
	let browser: Browser;
	let tokenEndpoint: string;
	let warn: jest.SpyInstance;
	/** Claims of the ID token the issuer returns next; `nonce` is filled in from the authorize request. */
	let nextClaims: Record<string, unknown>;
	let lastNonce: string;

	const flow = (issuer = ISSUER): OidcEmailSignInFlow => ({
		config: {
			issuer,
			clientId: CLIENT_ID,
			clientSecret: 'client-secret-value',
			redirectUri: 'https://api.example.test/api/auth/test/callback',
			scopes: ['openid', 'email', 'profile']
		},
		cookieName: COOKIE,
		label: 'Test provider'
	});

	beforeAll(async () => {
		key = await generateSigningKey('ES256', 'es256');
	});

	beforeEach(() => {
		http = new FakeOidcHttp();
		tokenEndpoint = publishIssuer(http, ISSUER, [key]).token_endpoint;
		publishIssuer(http, OTHER_ISSUER, [key]);
		const now = Math.floor(Date.now() / 1000);
		nextClaims = { iss: ISSUER, aud: CLIENT_ID, sub: 'person-1', iat: now, exp: now + 300 };
		http.on(tokenEndpoint, async () => ({
			status: 200,
			data: { id_token: await signTestToken(key, { nonce: lastNonce, ...nextClaims }), access_token: 'access', token_type: 'Bearer' }
		}));
		const discovery = new OidcDiscoveryService(http as any);
		const client = new OidcClientService(discovery, new OidcJwksService(discovery, http as any), http as any);
		service = new OidcEmailSignInService(new OidcTransactionService({ transactionSecret: randomTestSecret() }), client);
		browser = new Browser();
		warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
	});

	afterEach(() => warn.mockRestore());

	/** Starts a sign-in and returns the `state` of the authorize request (its `nonce` goes into the next ID token). */
	async function start(signInFlow = flow()): Promise<string> {
		const authorize = new URL(await service.start(browser.response, signInFlow));
		lastNonce = authorize.searchParams.get('nonce');
		return authorize.searchParams.get('state');
	}

	async function complete(query: { code?: string; state?: string; error?: string }, signInFlow = flow()) {
		return service.complete(browser.request(), browser.response, signInFlow, query);
	}

	it('starts with an authorize request carrying PKCE, state, nonce and the configured scopes, and sets its own cookie', async () => {
		const authorize = new URL(await service.start(browser.response, flow()));
		expect(`${authorize.origin}${authorize.pathname}`).toBe(`${ISSUER}/oauth/v2/authorize`);
		expect(authorize.searchParams.get('client_id')).toBe(CLIENT_ID);
		expect(authorize.searchParams.get('scope')).toBe('openid email profile');
		expect(authorize.searchParams.get('code_challenge_method')).toBe('S256');
		expect(authorize.searchParams.get('state')).toBeTruthy();
		expect(authorize.searchParams.get('nonce')).toBeTruthy();
		expect(authorize.searchParams.has('login_hint')).toBe(false);
		expect(browser.has(COOKIE)).toBe(true);
	});

	it('hands back a verified e-mail address and clears the transaction cookie', async () => {
		nextClaims = { ...nextClaims, email: 'person@example.test', email_verified: true };
		const state = await start();

		await expect(complete({ code: 'code-1', state })).resolves.toEqual({ status: 'verified', email: 'person@example.test' });
		expect(browser.has(COOKIE)).toBe(false);
		expect(http.calls(tokenEndpoint)).toHaveLength(1);
	});

	it.each([
		['email_verified: false', { email: 'person@example.test', email_verified: false }],
		['no email_verified claim', { email: 'person@example.test' }],
		['email_verified as the string "true"', { email: 'person@example.test', email_verified: 'true' }],
		['no e-mail address', { email_verified: true }]
	])('refuses an address the issuer does not report verified (%s)', async (_name, claims) => {
		nextClaims = { ...nextClaims, ...claims };
		const state = await start();

		await expect(complete({ code: 'code-1', state })).resolves.toEqual({ status: 'email_unverified' });
	});

	it('refuses an ID token from another issuer', async () => {
		nextClaims = { ...nextClaims, iss: OTHER_ISSUER, email: 'person@example.test', email_verified: true };
		const state = await start();

		await expect(complete({ code: 'code-1', state })).resolves.toEqual({ status: 'failed' });
		expect(warn).toHaveBeenCalledWith('Test provider sign-in failed: issuer_rejected');
	});

	it('refuses an ID token for another client', async () => {
		nextClaims = { ...nextClaims, aud: 'another-client', email: 'person@example.test', email_verified: true };
		const state = await start();

		await expect(complete({ code: 'code-1', state })).resolves.toEqual({ status: 'failed' });
	});

	it('refuses an ID token whose nonce is not the one of this sign-in', async () => {
		const state = await start();
		lastNonce = 'a-nonce-of-another-sign-in';
		nextClaims = { ...nextClaims, email: 'person@example.test', email_verified: true };

		await expect(complete({ code: 'code-1', state })).resolves.toEqual({ status: 'failed' });
		expect(warn).toHaveBeenCalledWith('Test provider sign-in failed: nonce_mismatch');
	});

	it('refuses a callback without its transaction cookie, before any request to the issuer', async () => {
		const state = await start();
		browser.forget();

		await expect(complete({ code: 'code-1', state })).resolves.toEqual({ status: 'failed' });
		expect(http.calls(tokenEndpoint)).toHaveLength(0);
	});

	it('refuses a callback whose state does not match', async () => {
		await start();

		await expect(complete({ code: 'code-1', state: 'forged-state' })).resolves.toEqual({ status: 'failed' });
		expect(http.calls(tokenEndpoint)).toHaveLength(0);
	});

	it('accepts a transaction once', async () => {
		nextClaims = { ...nextClaims, email: 'person@example.test', email_verified: true };
		const state = await start();
		const request = browser.request();

		await expect(service.complete(request, browser.response, flow(), { code: 'code-1', state })).resolves.toEqual({
			status: 'verified',
			email: 'person@example.test'
		});
		await expect(service.complete(request, browser.response, flow(), { code: 'code-1', state })).resolves.toEqual({ status: 'failed' });
		expect(http.calls(tokenEndpoint)).toHaveLength(1);
	});

	it('refuses a transaction another issuer started, without exchanging the code', async () => {
		const state = await start(flow(OTHER_ISSUER));

		await expect(complete({ code: 'code-1', state }, flow(ISSUER))).resolves.toEqual({ status: 'failed' });
		expect(http.calls(tokenEndpoint)).toHaveLength(0);
	});

	it('reports a cancelled or refused authorization as failed without exchanging anything', async () => {
		const state = await start();

		await expect(complete({ error: 'access_denied', state })).resolves.toEqual({ status: 'failed' });
		expect(http.calls(tokenEndpoint)).toHaveLength(0);
	});

	it('sends the browser to the login page with an error code when the issuer cannot be reached', async () => {
		const unreachable = 'https://unreachable.example.test';
		http.fail(`${unreachable}/.well-known/openid-configuration`);

		const url = await service.start(browser.response, flow(unreachable));

		expect(url).toBe(`${environment.clientBaseUrl.replace(/\/+$/, '')}/#/auth/login?error=sign_in_failed`);
		expect(warn).toHaveBeenCalledWith('Test provider sign-in could not start: discovery_failed');
	});

	it('never logs a code, a token or an address', async () => {
		nextClaims = { ...nextClaims, iss: OTHER_ISSUER, email: 'person@example.test', email_verified: true };
		const state = await start();
		await complete({ code: 'secret-code-value', state });

		const logged = warn.mock.calls.map((args) => args.join(' ')).join('\n');
		expect(logged).not.toContain('secret-code-value');
		expect(logged).not.toContain('person@example.test');
		expect(logged).not.toContain(state);
	});

	it('encodes the error code of the login page URL', () => {
		expect(service.loginPageUrl('a b&c')).toMatch(/\/#\/auth\/login\?error=a%20b%26c$/);
	});
});
