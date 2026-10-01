import { randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { OidcModule } from '@gauzy/auth';
import { environment } from '@gauzy/config';
import { AuthKeycloakController } from '../auth-keycloak.controller';
import { MockOidcIssuer } from '../fixtures/mock-oidc-issuer';
import { KeycloakSignInService } from '../keycloak-sign-in.service';
import { SOCIAL_SIGN_IN, SocialSignInPort } from '../social-sign-in.port';

// The first use of `jose` (an ES module that ts-jest compiles on load) and key generation can take
// longer than Jest's 5 s default on a busy machine.
jest.setTimeout(60_000);

const REALM = 'gauzy-test';
const CLIENT_ID = 'gauzy-keycloak-test';

async function freePort(): Promise<number> {
	return new Promise((resolve) => {
		const server = createServer();
		server.listen(0, '127.0.0.1', () => {
			const address = server.address();
			const port = typeof address === 'object' && address ? address.port : 0;
			server.close(() => resolve(port));
		});
	});
}

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

describe('Keycloak sign-in (HTTP, against a mock Keycloak realm)', () => {
	let issuer: MockOidcIssuer;
	let app: INestApplication;
	let baseUrl: string;
	let social: FakeSocialSignIn;
	let clientSecret: string;
	let cookie = '';

	async function start(keycloak: Record<string, string | undefined>) {
		social = new FakeSocialSignIn();
		const moduleRef = await Test.createTestingModule({
			imports: [OidcModule.forRoot({ transactionSecret: randomBytes(32).toString('hex') })],
			controllers: [AuthKeycloakController],
			providers: [
				KeycloakSignInService,
				{ provide: SOCIAL_SIGN_IN, useValue: social },
				{ provide: ConfigService, useValue: { get: (key: string) => keycloak[key] } }
			]
		}).compile();
		app = moduleRef.createNestApplication({ logger: false });
		app.setGlobalPrefix('api');
		const port = Number(new URL(baseUrl).port);
		await app.listen(port, '127.0.0.1');
	}

	function realmSettings(overrides: Record<string, string | undefined> = {}) {
		return {
			'keycloak.clientId': CLIENT_ID,
			'keycloak.clientSecret': clientSecret,
			'keycloak.realm': REALM,
			'keycloak.authServerURL': issuer.issuer.slice(0, issuer.issuer.length - `/realms/${REALM}`.length),
			'keycloak.callbackURL': `${baseUrl}/api/auth/keycloak/callback`,
			...overrides
		};
	}

	beforeEach(async () => {
		cookie = '';
		clientSecret = randomBytes(16).toString('hex');
		issuer = new MockOidcIssuer(CLIENT_ID, clientSecret, `/realms/${REALM}`);
		await issuer.start();
		baseUrl = `http://127.0.0.1:${await freePort()}`;
		await start(realmSettings());
	});

	afterEach(async () => {
		await app?.close();
		await issuer?.stop();
	});

	async function get(url: string): Promise<Response> {
		const response = await fetch(url, { redirect: 'manual', headers: cookie ? { cookie } : {} });
		const setCookie = response.headers.getSetCookie().find((value) => value.startsWith('gauzy_keycloak_txn='));
		if (setCookie) {
			cookie = setCookie.split(';')[0];
		}
		return response;
	}

	/** Start → realm → callback; returns where the callback sends the browser. */
	async function signIn(claims: Record<string, unknown>): Promise<string> {
		issuer.nextClaims = claims;
		const startResponse = await get(`${baseUrl}/api/auth/keycloak`);
		const authorize = await fetch(startResponse.headers.get('location'), { redirect: 'manual' });
		const callback = await get(authorize.headers.get('location'));
		return callback.headers.get('location');
	}

	it('reports itself enabled', async () => {
		const response = await get(`${baseUrl}/api/auth/keycloak/config`);
		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(await response.json()).toEqual({ enabled: true });
	});

	it('redirects to the realm authorize endpoint with PKCE, state and nonce', async () => {
		const response = await get(`${baseUrl}/api/auth/keycloak`);
		expect(response.status).toBe(302);
		const location = new URL(response.headers.get('location'));
		expect(location.pathname).toBe(`/realms/${REALM}/oauth/v2/authorize`);
		expect(location.searchParams.get('client_id')).toBe(CLIENT_ID);
		expect(location.searchParams.get('code_challenge_method')).toBe('S256');
		expect(location.searchParams.get('state')).toBeTruthy();
		expect(location.searchParams.get('nonce')).toBeTruthy();
		expect(location.searchParams.get('scope')).toBe('openid email profile');
		expect(location.searchParams.get('redirect_uri')).toBe(`${baseUrl}/api/auth/keycloak/callback`);
		expect(cookie).toMatch(/^gauzy_keycloak_txn=/);
	});

	it('signs a verified e-mail of an existing user in through the existing social sign-in', async () => {
		social.users.add('kc.user@example.test');
		const landing = await signIn({ sub: 'kc-1', email: 'kc.user@example.test', email_verified: true });
		expect(landing).toBe(`${environment.clientBaseUrl}/#/sign-in/success?jwt=gauzy-access-token&userId=user-1`);
		expect(social.calls).toEqual([[{ value: 'kc.user@example.test', verified: true }]]);
	});

	it('sends an unknown verified e-mail to the register page and creates nothing', async () => {
		const landing = await signIn({ sub: 'kc-2', email: 'new@example.test', email_verified: true });
		expect(landing).toBe(`${environment.clientBaseUrl}/#/auth/register`);
	});

	it('refuses an unverified e-mail without asking Gauzy to sign anyone in', async () => {
		social.users.add('kc.user@example.test');
		const landing = await signIn({ sub: 'kc-3', email: 'kc.user@example.test', email_verified: false });
		expect(landing).toBe(`${environment.clientBaseUrl}/#/auth/login?error=email_unverified`);
		expect(social.calls).toHaveLength(0);
	});

	it('refuses a callback without its transaction cookie', async () => {
		const startResponse = await get(`${baseUrl}/api/auth/keycloak`);
		const authorize = await fetch(startResponse.headers.get('location'), { redirect: 'manual' });
		cookie = '';
		const callback = await fetch(authorize.headers.get('location'), { redirect: 'manual' });
		expect(callback.headers.get('location')).toBe(`${environment.clientBaseUrl}/#/auth/login?error=sign_in_failed`);
		expect(social.calls).toHaveLength(0);
	});

	it('answers enabled:false and 404 when the realm is not configured, without contacting anything', async () => {
		await app.close();
		await start(realmSettings({ 'keycloak.realm': '' }));
		expect(await (await get(`${baseUrl}/api/auth/keycloak/config`)).json()).toEqual({ enabled: false, reason: 'unconfigured' });
		expect((await get(`${baseUrl}/api/auth/keycloak`)).status).toBe(404);
		expect(issuer.requests).toHaveLength(0);
	});

	it('treats the sample auth server URL as not configured', async () => {
		await app.close();
		await start(realmSettings({ 'keycloak.authServerURL': 'https://keycloak.example.com/auth' }));
		expect((await (await get(`${baseUrl}/api/auth/keycloak/config`)).json()).enabled).toBe(false);
	});
});
