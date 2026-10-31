import { ConfigService } from '@nestjs/config';
import { InternalOAuthError } from 'passport-oauth2';
import { SocialAuthEmail } from '../social-auth-emails';
import { LINKEDIN_USERINFO_URL, LinkedinProfile, LinkedinUserInfo, parseLinkedinUserInfo } from './linkedin-userinfo';
import { LinkedinStrategy, parseLinkedinConfig } from './linkedin.strategy';

/** The user `validate` hands to Passport. */
interface SignedInUser {
	emails: SocialAuthEmail[];
	accessToken: string;
	refreshToken: string;
}

/** The parts of passport-oauth2 the spec drives: the HTTP layer of its client, and the verify callback. */
interface LinkedinStrategyInternals {
	_oauth2: {
		_request: (
			method: string,
			url: string,
			headers: Record<string, string>,
			body: string,
			accessToken: string | null,
			callback: (error: unknown, body?: string) => void
		) => void;
	};
	_verify: (
		request: object,
		accessToken: string,
		refreshToken: string,
		profile: LinkedinProfile,
		done: (error: unknown, user: SignedInUser) => void
	) => Promise<void>;
}

/**
 * LinkedIn sign-in only signs in existing users through emails flagged `verified`
 * (AuthService.validateOAuthLoginEmail skips the others). The strategy reads the member from LinkedIn's
 * OpenID Connect UserInfo endpoint and keeps LinkedIn's own `email_verified` flag.
 */
describe('LinkedinStrategy', () => {
	const configService = { get: () => undefined } as unknown as ConfigService;

	const internals = (strategy: LinkedinStrategy) => strategy as unknown as LinkedinStrategyInternals;

	const userInfo = (claims: Partial<LinkedinUserInfo> = {}): LinkedinUserInfo => ({
		sub: 'member-7f3a',
		name: 'Ada Lovelace',
		given_name: 'Ada',
		family_name: 'Lovelace',
		picture: 'https://media.licdn.example/ada.png',
		locale: { country: 'GB', language: 'en' },
		email: 'ada@example.com',
		email_verified: true,
		...claims
	});

	/** A GET request the strategy sent through passport-oauth2's client. */
	interface SentRequest {
		method: string;
		url: string;
		headers: Record<string, string>;
		accessToken: string | null;
	}

	/**
	 * Builds the strategy with LinkedIn's API replaced at the HTTP layer of passport-oauth2's client, so the
	 * request the strategy builds (URL, bearer header) is what the test sees.
	 */
	const strategyAnswering = (respond: () => { error?: unknown; body?: string }) => {
		const strategy = new LinkedinStrategy(configService);
		const requests: SentRequest[] = [];
		internals(strategy)._oauth2._request = (method, url, headers, _body, accessToken, callback) => {
			requests.push({ method, url, headers, accessToken });
			const { error, body } = respond();
			callback(error ?? null, body);
		};
		return { strategy, requests };
	};

	/** Loads the profile the way passport-oauth2 does after the code exchange. */
	const loadProfile = (strategy: LinkedinStrategy): Promise<LinkedinProfile> =>
		new Promise((resolve, reject) =>
			strategy.userProfile('access-token', (error, profile) => (error ? reject(error) : resolve(profile)))
		);

	/**
	 * Runs `validate` the way passport-oauth2 does (`passReqToCallback`) — through the verify callback the
	 * `PassportStrategy` mixin registered — and returns what reached Passport's `done`, which must be called
	 * exactly once.
	 */
	const runValidate = async (strategy: LinkedinStrategy, profile: LinkedinProfile) => {
		const calls: Array<{ error: unknown; user: SignedInUser }> = [];
		await internals(strategy)._verify({}, 'access-token', 'refresh-token', profile, (error, user) =>
			calls.push({ error, user })
		);
		expect(calls).toHaveLength(1);
		return calls[0];
	};

	/** Signs in end to end from a UserInfo response: profile loading, then `validate`. */
	const signIn = async (claims: Partial<LinkedinUserInfo>) => {
		const { strategy } = strategyAnswering(() => ({ body: JSON.stringify(userInfo(claims)) }));
		return runValidate(strategy, await loadProfile(strategy));
	};

	describe('parseLinkedinConfig', () => {
		it('asks for the OpenID Connect scopes, not the retired r_liteprofile and r_emailaddress', () => {
			const { scope } = parseLinkedinConfig(configService);

			expect(scope).toEqual(['openid', 'profile', 'email']);
		});

		it('keeps the "disabled" defaults and the default callback URL when nothing is configured', () => {
			expect(parseLinkedinConfig(configService)).toEqual(
				expect.objectContaining({
					clientID: 'disabled',
					clientSecret: 'disabled',
					callbackURL: expect.stringMatching(/\/api\/auth\/linkedin\/callback$/),
					passReqToCallback: true
				})
			);
		});

		it('uses the configured client and callback URL', () => {
			const settings: Record<string, string> = {
				'linkedin.clientId': 'client-id',
				'linkedin.clientSecret': 'client-secret',
				'linkedin.callbackURL': 'https://api.example.com/api/auth/linkedin/callback'
			};
			const configured = { get: (key: string) => settings[key] } as unknown as ConfigService;

			expect(parseLinkedinConfig(configured)).toEqual(
				expect.objectContaining({
					clientID: 'client-id',
					clientSecret: 'client-secret',
					callbackURL: 'https://api.example.com/api/auth/linkedin/callback'
				})
			);
		});
	});

	describe('userProfile', () => {
		it('reads the UserInfo endpoint with the access token as a bearer token, never in the URL', async () => {
			const { strategy, requests } = strategyAnswering(() => ({ body: JSON.stringify(userInfo()) }));

			await loadProfile(strategy);

			expect(requests).toHaveLength(1);
			expect(requests[0]).toEqual(
				expect.objectContaining({ method: 'GET', url: LINKEDIN_USERINFO_URL, accessToken: null })
			);
			expect(requests[0].headers.Authorization).toBe('Bearer access-token');
		});

		it('builds the Passport profile from the UserInfo response', async () => {
			const { strategy } = strategyAnswering(() => ({ body: JSON.stringify(userInfo()) }));

			expect(await loadProfile(strategy)).toEqual(
				expect.objectContaining({
					provider: 'linkedin',
					id: 'member-7f3a',
					displayName: 'Ada Lovelace',
					name: { givenName: 'Ada', familyName: 'Lovelace' },
					emails: [{ value: 'ada@example.com', verified: true }],
					photos: [{ value: 'https://media.licdn.example/ada.png' }]
				})
			);
		});

		it('fails the sign-in when LinkedIn refuses the request', async () => {
			const { strategy } = strategyAnswering(() => ({ error: { statusCode: 403, data: '{"status":403}' } }));

			await expect(loadProfile(strategy)).rejects.toBeInstanceOf(InternalOAuthError);
		});

		it('fails the sign-in on a response that is not JSON or has no subject', async () => {
			for (const body of ['<html>', JSON.stringify({ email: 'ada@example.com', email_verified: true })]) {
				const { strategy } = strategyAnswering(() => ({ body }));

				await expect(loadProfile(strategy)).rejects.toBeInstanceOf(InternalOAuthError);
			}
		});
	});

	describe('sign-in', () => {
		it('offers the address flagged verified when LinkedIn verified it', async () => {
			const { error, user } = await signIn({ email_verified: true });

			expect(error).toBeNull();
			expect(user).toEqual({
				emails: [{ value: 'ada@example.com', verified: true }],
				accessToken: 'access-token',
				refreshToken: 'refresh-token'
			});
		});

		it('never marks the address verified when LinkedIn did not flag it so', async () => {
			for (const emailVerified of [false, undefined, 'true' as unknown as boolean]) {
				const { error, user } = await signIn({ email_verified: emailVerified });

				expect(error).toBeNull();
				expect(user.emails).toEqual([{ value: 'ada@example.com', verified: false }]);
			}
		});

		it('returns an empty email list when LinkedIn sent no address', async () => {
			const { error, user } = await signIn({ email: undefined, email_verified: undefined });

			expect(error).toBeNull();
			expect(user.emails).toEqual([]);
		});
	});

	describe('parseLinkedinUserInfo', () => {
		it('accepts a parsed response and keeps it as the raw profile', () => {
			const json = userInfo({ name: undefined });
			const profile = parseLinkedinUserInfo(json);

			expect(profile.displayName).toBe('Ada Lovelace');
			expect(profile._json).toBe(json);
			expect(JSON.parse(profile._raw)).toEqual(json);
		});

		it('has no photo when LinkedIn sent no picture', () => {
			expect(parseLinkedinUserInfo(userInfo({ picture: undefined })).photos).toEqual([]);
		});
	});
});
