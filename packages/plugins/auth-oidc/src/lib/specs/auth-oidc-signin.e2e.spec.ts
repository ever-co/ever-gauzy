import { randomBytes } from 'node:crypto';
import { AddressInfo } from 'node:net';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { OidcHttpService, OidcModule } from '@gauzy/auth';
import { environment } from '@gauzy/config';
// The OIDC library's own test kit (an in-process issuer: discovery, key set, token endpoint). Test-only, so it is
// read from the library's sources rather than exported by `@gauzy/auth`.
import {
	FakeOidcHttp,
	TestSigningKey,
	discoveryDocumentFor,
	generateSigningKey,
	publishIssuer,
	signTestToken
} from '../../../../../auth/src/lib/oidc/fixtures/oidc-test-kit';
import { AuthOidcSettings, parseOidcSettings } from '../auth-oidc.config';
import { AuthOidcController } from '../auth-oidc.controller';
import { AuthOidcSignInService, OIDC_CALLBACK_PATH, OIDC_TRANSACTION_COOKIE } from '../auth-oidc-sign-in.service';
import { AUTH_OIDC_SETTINGS } from '../auth-oidc.tokens';
import { SOCIAL_SIGN_IN, SocialSignInPort } from '../social-sign-in.port';

// The first use of `jose` (an ES module that ts-jest compiles on load) and key generation can take
// longer than Jest's 5 s default on a busy machine.
jest.setTimeout(60_000);

const ISSUER = 'https://id.example.test';
const OTHER_ISSUER = 'https://other-id.example.test';
const CLIENT_ID = 'gauzy-oidc-test';
const CALLBACK = 'https://api.example.test/api/auth/oidc/callback';

/** Gauzy's social sign-in: a verified e-mail of an existing user signs in, anything else registers. */
class FakeSocialSignIn implements SocialSignInPort {
	readonly users = new Set<string>();
	readonly calls: Array<Array<{ value: string; verified: boolean }>> = [];

	async validateOAuthLoginEmail(emails: Array<{ value: string; verified: boolean }>) {
		this.calls.push(emails);
		const match = emails.find((email) => email.verified && this.users.has(email.value));
		return { success: !!match, authData: { jwt: match ? 'gauzy-access-token' : null, userId: match ? 'user-1' : null } };
	}

	async routeRedirect(success: boolean, auth: { jwt: string; userId: string }, res: unknown) {
		const target = success
			? `${environment.clientBaseUrl}/#/sign-in/success?jwt=${auth.jwt}&userId=${auth.userId}`
			: `${environment.clientBaseUrl}/#/auth/register`;
		(res as { redirect(url: string): void }).redirect(target);
	}
}

describe('OpenID Connect sign-in (HTTP, against an in-process OpenID Provider)', () => {
	let key: TestSigningKey;
	let http: FakeOidcHttp;
	let app: INestApplication;
	let baseUrl: string;
	let social: FakeSocialSignIn;
	let clientSecret: string;
	let cookie = '';
	/** Claims of the ID token the provider issues next; `nonce` comes from the authorize request. */
	let nextClaims: Record<string, unknown>;
	let lastNonce: string;

	const loginPage = (reason: string) => `${environment.clientBaseUrl.replace(/\/+$/, '')}/#/auth/login?error=${reason}`;

	function settings(env: Record<string, string> = {}): AuthOidcSettings {
		return parseOidcSettings({
			OIDC_ISSUER: ISSUER,
			OIDC_CLIENT_ID: CLIENT_ID,
			OIDC_CLIENT_SECRET: clientSecret,
			OIDC_CALLBACK_URL: CALLBACK,
			OIDC_DISPLAY_NAME: 'Acme ID',
			...env
		});
	}

	/** Answers the provider's token endpoint with an ID token signed by its key. */
	function serveTokens(issuer: string, tokenEndpoint: string): void {
		http.on(tokenEndpoint, async () => ({
			status: 200,
			data: {
				id_token: await signTestToken(key, { iss: issuer, aud: CLIENT_ID, nonce: lastNonce, ...nextClaims }),
				access_token: 'provider-access-token',
				token_type: 'Bearer'
			}
		}));
	}

	async function start(oidcSettings: AuthOidcSettings) {
		social = new FakeSocialSignIn();
		const moduleRef = await Test.createTestingModule({
			imports: [OidcModule.forRoot({ transactionSecret: randomBytes(32).toString('hex') })],
			controllers: [AuthOidcController],
			providers: [
				AuthOidcSignInService,
				{ provide: AUTH_OIDC_SETTINGS, useValue: oidcSettings },
				{ provide: SOCIAL_SIGN_IN, useValue: social }
			]
		})
			.overrideProvider(OidcHttpService)
			.useValue(http)
			.compile();
		app = moduleRef.createNestApplication({ logger: false });
		app.setGlobalPrefix('api');
		await app.listen(0, '127.0.0.1');
		baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
	}

	beforeAll(async () => {
		key = await generateSigningKey('RS256', 'provider-rs256');
	});

	beforeEach(async () => {
		cookie = '';
		lastNonce = '';
		clientSecret = randomBytes(16).toString('hex');
		const now = Math.floor(Date.now() / 1000);
		nextClaims = { sub: 'person-1', iat: now, exp: now + 300 };
		http = new FakeOidcHttp();
		serveTokens(ISSUER, publishIssuer(http, ISSUER, [key]).token_endpoint);
		publishIssuer(http, OTHER_ISSUER, [key]);
		await start(settings());
	});

	afterEach(async () => {
		await app?.close();
	});

	async function get(url: string): Promise<Response> {
		const response = await fetch(url, { redirect: 'manual', headers: cookie ? { cookie } : {} });
		const setCookie = response.headers.getSetCookie().find((value) => value.startsWith(`${OIDC_TRANSACTION_COOKIE}=`));
		if (setCookie) {
			cookie = setCookie.split(';')[0];
		}
		return response;
	}

	/** Starts a sign-in and returns the authorize URL the browser is sent to. */
	async function authorize(): Promise<URL> {
		const response = await get(`${baseUrl}/api/auth/oidc`);
		const location = new URL(response.headers.get('location'));
		lastNonce = location.searchParams.get('nonce');
		return location;
	}

	/** Start → provider (consents at once) → callback; returns where the callback sends the browser. */
	async function signIn(claims: Record<string, unknown>): Promise<string> {
		nextClaims = { ...nextClaims, ...claims };
		const state = (await authorize()).searchParams.get('state');
		const callback = await get(`${baseUrl}${OIDC_CALLBACK_PATH}?code=provider-code&state=${encodeURIComponent(state)}`);
		return callback.headers.get('location');
	}

	it('reports itself enabled, with the button label', async () => {
		const response = await get(`${baseUrl}/api/auth/oidc/config`);
		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(await response.json()).toEqual({ enabled: true, displayName: 'Acme ID' });
	});

	it('redirects to the provider authorize endpoint with PKCE, state and nonce, and sets its own HttpOnly cookie', async () => {
		const response = await get(`${baseUrl}/api/auth/oidc`);
		expect(response.status).toBe(302);
		expect(response.headers.get('cache-control')).toBe('no-store');
		const location = new URL(response.headers.get('location'));
		expect(`${location.origin}${location.pathname}`).toBe(`${ISSUER}/oauth/v2/authorize`);
		expect(location.searchParams.get('client_id')).toBe(CLIENT_ID);
		expect(location.searchParams.get('response_type')).toBe('code');
		expect(location.searchParams.get('code_challenge_method')).toBe('S256');
		expect(location.searchParams.get('code_challenge')).toBeTruthy();
		expect(location.searchParams.get('state')).toBeTruthy();
		expect(location.searchParams.get('nonce')).toBeTruthy();
		expect(location.searchParams.get('scope')).toBe('openid email profile');
		expect(location.searchParams.get('redirect_uri')).toBe(CALLBACK);
		const setCookie = response.headers.getSetCookie().find((value) => value.startsWith(`${OIDC_TRANSACTION_COOKIE}=`));
		expect(setCookie).toMatch(/HttpOnly/i);
		expect(setCookie).toMatch(/SameSite=Lax/i);
		expect(setCookie).toMatch(/Path=\/api\/auth/);
	});

	it('signs a verified e-mail of an existing user in through the existing social sign-in', async () => {
		social.users.add('person@example.test');
		const landing = await signIn({ email: 'person@example.test', email_verified: true });

		expect(landing).toBe(`${environment.clientBaseUrl}/#/sign-in/success?jwt=gauzy-access-token&userId=user-1`);
		expect(social.calls).toEqual([[{ value: 'person@example.test', verified: true }]]);
		const [exchange] = http.calls(`${ISSUER}/oauth/v2/token`);
		expect(exchange.headers['Authorization']).toMatch(/^Basic /);
		expect(exchange.form).toEqual(expect.objectContaining({ grant_type: 'authorization_code', code: 'provider-code', redirect_uri: CALLBACK }));
	});

	it('sends an unknown verified e-mail to the register page and creates nothing', async () => {
		const landing = await signIn({ email: 'new@example.test', email_verified: true });
		expect(landing).toBe(`${environment.clientBaseUrl}/#/auth/register`);
	});

	it('refuses an unverified e-mail without asking Gauzy to sign anyone in', async () => {
		social.users.add('person@example.test');
		const landing = await signIn({ email: 'person@example.test', email_verified: false });
		expect(landing).toBe(loginPage('email_unverified'));
		expect(social.calls).toHaveLength(0);
	});

	it('refuses an ID token from another issuer', async () => {
		social.users.add('person@example.test');
		const landing = await signIn({ iss: OTHER_ISSUER, email: 'person@example.test', email_verified: true });
		expect(landing).toBe(loginPage('sign_in_failed'));
		expect(social.calls).toHaveLength(0);
	});

	it('refuses an ID token whose nonce belongs to another sign-in', async () => {
		social.users.add('person@example.test');
		nextClaims = { ...nextClaims, email: 'person@example.test', email_verified: true };
		const state = (await authorize()).searchParams.get('state');
		lastNonce = 'nonce-of-another-sign-in';

		const callback = await get(`${baseUrl}${OIDC_CALLBACK_PATH}?code=provider-code&state=${encodeURIComponent(state)}`);

		expect(callback.headers.get('location')).toBe(loginPage('sign_in_failed'));
		expect(social.calls).toHaveLength(0);
	});

	it('refuses a callback without its transaction cookie, before any request to the provider', async () => {
		const state = (await authorize()).searchParams.get('state');
		cookie = '';

		const callback = await get(`${baseUrl}${OIDC_CALLBACK_PATH}?code=provider-code&state=${encodeURIComponent(state)}`);

		expect(callback.headers.get('location')).toBe(loginPage('sign_in_failed'));
		expect(http.calls(`${ISSUER}/oauth/v2/token`)).toHaveLength(0);
		expect(social.calls).toHaveLength(0);
	});

	it('sends a cancelled sign-in back to the login page', async () => {
		const state = (await authorize()).searchParams.get('state');

		const callback = await get(`${baseUrl}${OIDC_CALLBACK_PATH}?error=access_denied&state=${encodeURIComponent(state)}`);

		expect(callback.headers.get('location')).toBe(loginPage('sign_in_failed'));
		expect(http.calls(`${ISSUER}/oauth/v2/token`)).toHaveLength(0);
	});

	it('works with an issuer published with a trailing slash (Authentik and others)', async () => {
		await app.close();
		const issuer = 'https://id.example.test/application/o/gauzy/';
		const document = { ...discoveryDocumentFor('https://id.example.test/application/o/gauzy'), issuer };
		http.on('https://id.example.test/application/o/gauzy/.well-known/openid-configuration', { status: 200, data: document });
		http.on(document.jwks_uri, { status: 200, data: { keys: [key.publicJwk] } });
		serveTokens(issuer, document.token_endpoint);
		await start(settings({ OIDC_ISSUER: issuer }));
		social.users.add('person@example.test');

		const landing = await signIn({ email: 'person@example.test', email_verified: true });

		expect(landing).toBe(`${environment.clientBaseUrl}/#/sign-in/success?jwt=gauzy-access-token&userId=user-1`);
	});

	it('uses <API_BASE_URL>/api/auth/oidc/callback when no callback URL is set', async () => {
		await app.close();
		await start(settings({ OIDC_CALLBACK_URL: '' }));

		const location = await authorize();

		expect(location.searchParams.get('redirect_uri')).toBe(`${environment.baseUrl.replace(/\/+$/, '')}/api/auth/oidc/callback`);
	});

	it('answers enabled:false and 404 when it is not configured, without contacting anything', async () => {
		await app.close();
		http = new FakeOidcHttp();
		await start(settings({ OIDC_ISSUER: 'http://id.example.test' }));

		expect(await (await get(`${baseUrl}/api/auth/oidc/config`)).json()).toEqual({ enabled: false, reason: 'unconfigured' });
		expect((await get(`${baseUrl}/api/auth/oidc`)).status).toBe(404);
		expect((await get(`${baseUrl}${OIDC_CALLBACK_PATH}?code=x&state=y`)).status).toBe(404);
		expect(http.requests).toHaveLength(0);
	});
});
