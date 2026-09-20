import { UnauthorizedException } from '@nestjs/common';
import { ProviderEnum } from '@gauzy/contracts';
import {
	ISocialAuthClientsConfig,
	resolveSocialAuthClients,
	TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
} from '@gauzy/config';
import { firstValueFrom, Observable, of, throwError } from 'rxjs';
import { DataSource, EntitySchema, Repository } from 'typeorm';
import { normalizeSocialIdentity, SOCIAL_AUTH_FAILED_MESSAGE, verifySocialAccessToken } from './verify-oauth-tokens';

/**
 * GHSA-58x4-7mw9-gmqg — social sign-in accepted ANY provider access token.
 *
 * The verifiers only checked that the token worked against the provider's user-info API: never
 * which OAuth client it was issued to, never whether the email was verified, and never whether an
 * email came back at all. Each rejection below is paired with a CONTROL: either the provider
 * response that the pre-fix verifier turned into a sign-in, or (for the missing-email variant) the
 * real ORM query that then matched every user.
 */

type Route = { method: 'get' | 'post'; url: string | RegExp; respond: (config: any, body?: any) => Observable<any> };

function mockHttp(routes: Route[]) {
	const calls: Array<{ method: string; url: string; body?: any; config?: any }> = [];
	const handle = (method: 'get' | 'post') =>
		jest.fn((url: string, a?: any, b?: any) => {
			const body = method === 'post' ? a : undefined;
			const config = method === 'post' ? b : a;
			calls.push({ method, url, body, config });
			const route = routes.find(
				(r) => r.method === method && (typeof r.url === 'string' ? r.url === url : r.url.test(url))
			);
			return route
				? route.respond(config, body)
				: throwError(() => Object.assign(new Error('404'), { status: 404 }));
		});
	return { http: { get: handle('get'), post: handle('post') } as any, calls };
}

const ok = (data: any) => () => of({ data, status: 200 });
const fail =
	(status = 404) =>
	() =>
		throwError(() => Object.assign(new Error(`Request failed with status code ${status}`), { status }));

const CLIENTS: ISocialAuthClientsConfig = {
	google: { clientIds: ['gauzy-google.apps.googleusercontent.com', 'teams-google.apps.googleusercontent.com'] },
	github: {
		apps: [
			{ clientId: 'gauzy-gh', clientSecret: 'gauzy-gh-secret' },
			{ clientId: 'teams-gh', clientSecret: 'teams-gh-secret' }
		]
	},
	facebook: { apps: [{ clientId: '1111', clientSecret: 'fb-secret' }] }
};

async function expectRejected(promise: Promise<unknown>) {
	let error: unknown;
	try {
		await promise;
	} catch (e) {
		error = e;
	}
	expect(error).toBeInstanceOf(UnauthorizedException);
	// Generic: provider error text is never echoed back.
	expect((error as UnauthorizedException).message).toBe(SOCIAL_AUTH_FAILED_MESSAGE);
}

describe('verifySocialAccessToken (GHSA-58x4-7mw9-gmqg)', () => {
	describe('Google', () => {
		const tokeninfo = (data: any): Route => ({
			method: 'post',
			url: 'https://oauth2.googleapis.com/tokeninfo',
			respond: ok(data)
		});

		it('accepts a token issued to an allowed client with a verified email', async () => {
			const { http, calls } = mockHttp([
				tokeninfo({
					aud: 'teams-google.apps.googleusercontent.com',
					sub: '1234',
					email: 'Victim@Ever.co',
					email_verified: 'true'
				})
			]);
			await expect(verifySocialAccessToken(http, ProviderEnum.GOOGLE, 'ya29.token', CLIENTS)).resolves.toEqual({
				provider: ProviderEnum.GOOGLE,
				id: '1234',
				email: 'victim@ever.co',
				rawEmail: 'Victim@Ever.co'
			});
			// The access token travels in the POST body, never in the URL.
			expect(calls[0].url).not.toContain('ya29.token');
			expect(calls[0].body).toContain('access_token=ya29.token');
		});

		it('accepts a match on azp', async () => {
			const { http } = mockHttp([
				tokeninfo({
					aud: 'something-else',
					azp: 'gauzy-google.apps.googleusercontent.com',
					sub: '1',
					email: 'a@b.co',
					email_verified: true
				})
			]);
			await expect(verifySocialAccessToken(http, ProviderEnum.GOOGLE, 't', CLIENTS)).resolves.toMatchObject({
				id: '1'
			});
		});

		it('rejects a token issued to another app — CONTROL: the pre-fix userinfo call returned the victim', async () => {
			const foreign = {
				aud: 'evil-app.apps.googleusercontent.com',
				azp: 'evil-app.apps.googleusercontent.com',
				sub: '1',
				email: 'victim@ever.co',
				email_verified: 'true'
			};
			const { http } = mockHttp([
				tokeninfo(foreign),
				{
					method: 'get',
					url: /oauth2\/v1\/userinfo/,
					respond: ok({ id: '1', email: 'victim@ever.co', verified_email: true })
				}
			]);

			// CONTROL: the pre-fix verifier (userinfo only) took this token at face value.
			const { data } = await firstValueFrom<any>(
				http.get('https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=t')
			);
			expect((data as any).email).toBe('victim@ever.co');

			await expectRejected(verifySocialAccessToken(http, ProviderEnum.GOOGLE, 't', CLIENTS));
		});

		it.each([['false'], [false], [undefined]])('rejects email_verified=%p', async (emailVerified) => {
			const { http } = mockHttp([
				tokeninfo({
					aud: 'gauzy-google.apps.googleusercontent.com',
					sub: '1',
					email: 'victim@ever.co',
					email_verified: emailVerified
				})
			]);
			await expectRejected(verifySocialAccessToken(http, ProviderEnum.GOOGLE, 't', CLIENTS));
		});

		it('fails closed when no Google client is configured', async () => {
			const { http } = mockHttp([
				tokeninfo({
					aud: 'gauzy-google.apps.googleusercontent.com',
					sub: '1',
					email: 'a@b.co',
					email_verified: 'true'
				})
			]);
			await expectRejected(
				verifySocialAccessToken(http, ProviderEnum.GOOGLE, 't', { ...CLIENTS, google: { clientIds: [] } })
			);
			expect(http.post).not.toHaveBeenCalled();
		});
	});

	describe('GitHub', () => {
		const user = {
			method: 'get' as const,
			url: 'https://api.github.com/user',
			respond: ok({ id: 42, login: 'victim' })
		};
		const emails = (list: any[]): Route => ({
			method: 'get',
			url: 'https://api.github.com/user/emails',
			respond: ok(list)
		});

		it('accepts a token of an allowed app with a primary, verified email', async () => {
			const { http, calls } = mockHttp([
				{ method: 'post', url: 'https://api.github.com/applications/gauzy-gh/token', respond: fail(404) },
				{
					method: 'post',
					url: 'https://api.github.com/applications/teams-gh/token',
					respond: ok({ user: { id: 42 } })
				},
				user,
				emails([
					{ email: 'old@ever.co', primary: false, verified: true },
					{ email: 'victim@ever.co', primary: true, verified: true }
				])
			]);
			await expect(verifySocialAccessToken(http, ProviderEnum.GITHUB, 'gho_x', CLIENTS)).resolves.toMatchObject({
				id: '42',
				email: 'victim@ever.co'
			});
			// Each app is introspected with its OWN credentials.
			const introspections = calls.filter((c) => c.method === 'post');
			expect(introspections.map((c) => c.config.auth)).toEqual([
				{ username: 'gauzy-gh', password: 'gauzy-gh-secret' },
				{ username: 'teams-gh', password: 'teams-gh-secret' }
			]);
		});

		it('rejects a personal access token — CONTROL: /user and /user/emails accepted it', async () => {
			const { http } = mockHttp([
				// GitHub answers 404 for a token not issued to the app (a PAT or another app's token).
				{ method: 'post', url: /\/applications\/.*\/token$/, respond: fail(404) },
				user,
				emails([{ email: 'victim@ever.co', primary: true, verified: true }])
			]);

			// CONTROL: the pre-fix verifier only read these two endpoints, which work for any token.
			const { data } = await firstValueFrom<any>(http.get('https://api.github.com/user/emails', {}));
			expect((data as any[]).find((e) => e.primary).email).toBe('victim@ever.co');

			await expectRejected(verifySocialAccessToken(http, ProviderEnum.GITHUB, 'ghp_pat', CLIENTS));
		});

		it('rejects an unverified primary email (attacker sets the victim address on their own account)', async () => {
			const { http } = mockHttp([
				{
					method: 'post',
					url: 'https://api.github.com/applications/gauzy-gh/token',
					respond: ok({ user: { id: 42 } })
				},
				user,
				emails([{ email: 'victim@ever.co', primary: true, verified: false }])
			]);
			await expectRejected(verifySocialAccessToken(http, ProviderEnum.GITHUB, 'gho_x', CLIENTS));
		});

		it('rejects when the introspected user differs from /user', async () => {
			const { http } = mockHttp([
				{
					method: 'post',
					url: 'https://api.github.com/applications/gauzy-gh/token',
					respond: ok({ user: { id: 7 } })
				},
				user,
				emails([{ email: 'victim@ever.co', primary: true, verified: true }])
			]);
			await expectRejected(verifySocialAccessToken(http, ProviderEnum.GITHUB, 'gho_x', CLIENTS));
		});

		it('fails closed when no GitHub app is configured', async () => {
			const { http } = mockHttp([user, emails([{ email: 'victim@ever.co', primary: true, verified: true }])]);
			await expectRejected(
				verifySocialAccessToken(http, ProviderEnum.GITHUB, 'gho_x', { ...CLIENTS, github: { apps: [] } })
			);
			expect(http.get).not.toHaveBeenCalled();
		});
	});

	describe('Facebook', () => {
		const debug = (data: any): Route => ({
			method: 'get',
			url: 'https://graph.facebook.com/debug_token',
			respond: ok({ data })
		});
		const me = (data: any): Route => ({ method: 'get', url: 'https://graph.facebook.com/me', respond: ok(data) });

		it('accepts a valid token of an allowed app and asks /me for the email explicitly', async () => {
			const { http, calls } = mockHttp([
				debug({ is_valid: true, app_id: '1111', user_id: '99' }),
				me({ id: '99', email: 'victim@ever.co' })
			]);
			await expect(verifySocialAccessToken(http, ProviderEnum.FACEBOOK, 'EAAB', CLIENTS)).resolves.toMatchObject({
				id: '99',
				email: 'victim@ever.co'
			});
			expect(calls[0].config.params).toEqual({ input_token: 'EAAB', access_token: '1111|fb-secret' });
			expect(calls[1].config.params).toEqual({ fields: 'id,email' });
		});

		it.each([
			['another app', { is_valid: true, app_id: '2222', user_id: '99' }],
			['an invalid token', { is_valid: false, app_id: '1111', user_id: '99' }]
		])('rejects a token of %s', async (_label, data) => {
			const { http } = mockHttp([debug(data), me({ id: '99', email: 'victim@ever.co' })]);
			await expectRejected(verifySocialAccessToken(http, ProviderEnum.FACEBOOK, 'EAAB', CLIENTS));
		});

		it('rejects a /me response without an email (public_profile only)', async () => {
			const { http } = mockHttp([
				debug({ is_valid: true, app_id: '1111', user_id: '99' }),
				me({ id: '99', name: 'Attacker' })
			]);
			await expectRejected(verifySocialAccessToken(http, ProviderEnum.FACEBOOK, 'EAAB', CLIENTS));
		});
	});

	it.each([[ProviderEnum.TWITTER], ['unknown-provider' as ProviderEnum]])(
		'rejects provider %s without calling out',
		async (provider) => {
			const { http } = mockHttp([]);
			await expectRejected(verifySocialAccessToken(http, provider, 'token', CLIENTS));
			expect(http.get).not.toHaveBeenCalled();
			expect(http.post).not.toHaveBeenCalled();
		}
	);

	it('maps a provider outage to the same generic 401', async () => {
		const { http } = mockHttp([
			{ method: 'post', url: 'https://oauth2.googleapis.com/tokeninfo', respond: fail(500) }
		]);
		await expectRejected(verifySocialAccessToken(http, ProviderEnum.GOOGLE, 't', CLIENTS));
	});
});

describe('normalizeSocialIdentity (GHSA-58x4-7mw9-gmqg)', () => {
	it.each([
		['no email', { id: '1' }],
		['an empty email', { id: '1', email: '  ' }],
		['a non-email', { id: '1', email: 'not-an-email' }],
		['no id', { email: 'a@b.co' }],
		['an empty id', { id: '', email: 'a@b.co' }],
		['a zero id', { id: 0, email: 'a@b.co' }],
		['an object id', { id: { $ne: null }, email: 'a@b.co' }],
		['nothing', undefined]
	])('rejects %s', (_label, raw: any) => {
		expect(() => normalizeSocialIdentity(ProviderEnum.GITHUB, raw)).toThrow(UnauthorizedException);
	});

	it('stringifies numeric ids and lowercases the email', () => {
		expect(normalizeSocialIdentity(ProviderEnum.GITHUB, { id: 42, email: ' Victim@Ever.CO ' })).toEqual({
			provider: ProviderEnum.GITHUB,
			id: '42',
			email: 'victim@ever.co',
			rawEmail: 'Victim@Ever.CO'
		});
	});

	/**
	 * Why the guard exists: with the shipped `undefined: 'ignore'` setting, the pre-fix sign-in query
	 * `find({ where: [{ email: undefined, isActive: true, isArchived: false }] })` has no email
	 * predicate at all. Against a real database it returns EVERY active user.
	 */
	describe('against a real better-sqlite3 database', () => {
		const UserSchema = new EntitySchema({
			name: 'SocialSpecUser',
			tableName: 'social_spec_user',
			columns: {
				id: { primary: true, type: 'varchar' },
				email: { type: 'varchar' },
				isActive: { type: 'boolean' },
				isArchived: { type: 'boolean' }
			}
		});
		let dataSource: DataSource;
		let users: Repository<any>;

		beforeAll(async () => {
			dataSource = new DataSource({
				type: 'better-sqlite3',
				database: ':memory:',
				entities: [UserSchema],
				synchronize: true,
				logging: false,
				invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
			});
			await dataSource.initialize();
			users = dataSource.getRepository('SocialSpecUser');
			await users.save([
				{ id: 'super-admin', email: 'admin@ever.co', isActive: true, isArchived: false },
				{ id: 'victim', email: 'victim@ever.co', isActive: true, isArchived: false },
				{ id: 'attacker', email: 'attacker@evil.co', isActive: true, isArchived: false }
			]);
		});

		afterAll(async () => {
			await dataSource?.destroy();
		});

		it('CONTROL: the pre-fix Facebook path (no email) matched every user', async () => {
			// The pre-fix verifier spread `/me` (no `fields=email`) into the identity: email undefined.
			const preFixIdentity: any = { id: '99', name: 'Attacker', provider: ProviderEnum.FACEBOOK };
			const matched = await users.find({
				where: [{ email: preFixIdentity.email, isActive: true, isArchived: false }]
			});
			expect(matched.map((u) => u.id).sort()).toEqual(['attacker', 'super-admin', 'victim']);
		});

		it('the normaliser stops that identity before any query, and a verified one matches one user', async () => {
			expect(() => normalizeSocialIdentity(ProviderEnum.FACEBOOK, { id: '99' })).toThrow(UnauthorizedException);

			const identity = normalizeSocialIdentity(ProviderEnum.FACEBOOK, { id: '99', email: 'Victim@Ever.co' });
			const matched = await users.find({
				where: [identity.email, identity.rawEmail].map((email) => ({
					email,
					isActive: true,
					isArchived: false
				}))
			});
			expect(matched.map((u) => u.id)).toEqual(['victim']);
		});
	});
});

describe('resolveSocialAuthClients', () => {
	it("defaults to Gauzy's own OAuth apps and appends the extra first-party clients", () => {
		const clients = resolveSocialAuthClients({
			GOOGLE_CLIENT_ID: 'gauzy-google',
			GAUZY_GITHUB_OAUTH_CLIENT_ID: 'gauzy-gh',
			GAUZY_GITHUB_OAUTH_CLIENT_SECRET: 'gauzy-gh-secret',
			FACEBOOK_CLIENT_ID: '1111',
			FACEBOOK_CLIENT_SECRET: 'fb-secret',
			GAUZY_SOCIAL_AUTH_GOOGLE_CLIENT_IDS: 'teams-google, gauzy-google ,',
			GAUZY_SOCIAL_AUTH_GITHUB_APPS: 'teams-gh:teams:secret:with:colons,broken',
			GAUZY_SOCIAL_AUTH_FACEBOOK_APPS: '2222:fb2-secret'
		});
		expect(clients).toEqual({
			google: { clientIds: ['gauzy-google', 'teams-google'] },
			github: {
				apps: [
					{ clientId: 'gauzy-gh', clientSecret: 'gauzy-gh-secret' },
					{ clientId: 'teams-gh', clientSecret: 'teams:secret:with:colons' }
				]
			},
			facebook: {
				apps: [
					{ clientId: '1111', clientSecret: 'fb-secret' },
					{ clientId: '2222', clientSecret: 'fb2-secret' }
				]
			}
		});
	});

	it('is empty (fail closed) when nothing or only template placeholders are configured', () => {
		expect(
			resolveSocialAuthClients({
				GOOGLE_CLIENT_ID: 'XXXXXXX',
				GAUZY_GITHUB_OAUTH_CLIENT_ID: 'XXXXXXX',
				GAUZY_GITHUB_OAUTH_CLIENT_SECRET: 'XXXXXXX',
				FACEBOOK_CLIENT_ID: '',
				FACEBOOK_CLIENT_SECRET: ''
			})
		).toEqual({ google: { clientIds: [] }, github: { apps: [] }, facebook: { apps: [] } });
	});
});
