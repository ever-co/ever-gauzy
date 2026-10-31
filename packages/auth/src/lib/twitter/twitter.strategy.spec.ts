import { ConfigService } from '@nestjs/config';
import { Profile } from 'passport';
import { SocialAuthEmail } from '../social-auth-emails';
import { parseTwitterConfig, TwitterStrategy } from './twitter.strategy';

/** The user `validate` hands to Passport. */
interface SignedInUser {
	emails: SocialAuthEmail[];
	accessToken: string;
	refreshToken: string;
}

/** The parts of passport-twitter the spec drives: its OAuth 1.0a client, profile loader and verify callback. */
interface TwitterStrategyInternals {
	_oauth: {
		get: (
			url: string,
			token: string,
			tokenSecret: string,
			callback: (error: unknown, body?: string, response?: { headers: Record<string, string> }) => void
		) => void;
	};
	userProfile: (
		token: string,
		tokenSecret: string,
		params: object,
		done: (error: Error | null, profile?: Profile) => void
	) => void;
	_verify: (
		token: string,
		tokenSecret: string,
		profile: Profile,
		done: (error: unknown, user: SignedInUser) => void
	) => Promise<void>;
}

/**
 * X sign-in only signs in existing users through emails flagged `verified`
 * (AuthService.validateOAuthLoginEmail skips the others). X's `account/verify_credentials` returns an address only
 * once its holder confirmed it (null otherwise), so the address it returned is flagged verified, and nothing else.
 */
describe('TwitterStrategy', () => {
	const configService = { get: () => undefined } as unknown as ConfigService;

	const internals = (strategy: TwitterStrategy) => strategy as unknown as TwitterStrategyInternals;

	/**
	 * Runs `validate` the way passport-twitter does — through the verify callback the `PassportStrategy` mixin
	 * registered — and returns what reached Passport's `done`, which must be called exactly once.
	 */
	const runValidate = async (strategy: TwitterStrategy, profile: Partial<Profile>) => {
		const calls: Array<{ error: unknown; user: SignedInUser }> = [];
		await internals(strategy)._verify('token', 'token-secret', profile as Profile, (error, user) =>
			calls.push({ error, user })
		);
		expect(calls).toHaveLength(1);
		return calls[0];
	};

	/**
	 * Builds the profile the way passport-twitter does, from a `verify_credentials` response, and returns it with the
	 * URL passport-twitter requested.
	 */
	const loadProfile = async (strategy: TwitterStrategy, response: Record<string, unknown>) => {
		const urls: string[] = [];
		internals(strategy)._oauth.get = (url, _token, _tokenSecret, callback) => {
			urls.push(url);
			callback(null, JSON.stringify(response), { headers: {} });
		};
		const profile: Profile = await new Promise((resolve, reject) =>
			internals(strategy).userProfile('token', 'token-secret', {}, (error, value) =>
				error ? reject(error) : resolve(value)
			)
		);
		return { profile, urls };
	};

	const account = { id: 1, id_str: '1', screen_name: 'ada', name: 'Ada Lovelace', profile_image_url_https: 'x' };

	describe('parseTwitterConfig', () => {
		it('asks X for the account email', () => {
			expect(parseTwitterConfig(configService)).toEqual(expect.objectContaining({ includeEmail: true }));
		});

		it('keeps the profile on account/verify_credentials, whose email contract validate relies on', () => {
			const config = parseTwitterConfig(configService);

			expect(config).not.toHaveProperty('userProfileURL');
			expect(config).not.toHaveProperty('skipExtendedUserProfile');
		});
	});

	describe('profile from account/verify_credentials', () => {
		it('requests verify_credentials with include_email', async () => {
			const { urls } = await loadProfile(new TwitterStrategy(configService), account);

			expect(urls).toHaveLength(1);
			expect(urls[0]).toMatch(/\/1\.1\/account\/verify_credentials\.json\?/);
			expect(urls[0]).toContain('include_email=true');
		});

		it('signs in through the confirmed address X returned, flagged verified', async () => {
			const strategy = new TwitterStrategy(configService);
			const { profile } = await loadProfile(strategy, { ...account, email: 'ada@example.com' });

			const { error, user } = await runValidate(strategy, profile);

			expect(error).toBeNull();
			expect(user).toEqual({
				emails: [{ value: 'ada@example.com', verified: true }],
				accessToken: 'token',
				refreshToken: 'token-secret'
			});
		});

		it('has no address when X returned null, as it does for an unconfirmed or missing one', async () => {
			const strategy = new TwitterStrategy(configService);
			const { profile } = await loadProfile(strategy, { ...account, email: null });

			const { error, user } = await runValidate(strategy, profile);

			expect(error).toBeNull();
			expect(user.emails).toEqual([]);
		});
	});

	describe('validate', () => {
		it('never marks an empty email value as verified', async () => {
			const { user } = await runValidate(new TwitterStrategy(configService), {
				id: '1',
				emails: [{ value: '' }, { value: undefined }]
			});

			expect(user.emails).toEqual([
				{ value: '', verified: false },
				{ value: undefined, verified: false }
			]);
		});

		it('returns an empty email list when the profile has none', async () => {
			const { error, user } = await runValidate(new TwitterStrategy(configService), { id: '1' });

			expect(error).toBeNull();
			expect(user.emails).toEqual([]);
		});
	});
});
