import { ConfigService } from '@nestjs/config';
import { Profile } from 'passport-github2';
import { GithubStrategy, parseGithubConfig } from './github.strategy';

/**
 * GitHub sign-in only signs in existing users through emails flagged `verified`
 * (AuthService.validateOAuthLoginEmail skips the others), so the strategy must keep GitHub's own flags.
 */
describe('GithubStrategy', () => {
	const configService = { get: () => undefined } as unknown as ConfigService;

	/** GitHub's own address shape with `allRawEmails`, which the Passport profile type does not describe. */
	const rawEmails = (emails: Array<{ value: string; primary?: boolean; verified?: unknown }>): Profile['emails'] =>
		emails as unknown as Profile['emails'];

	/**
	 * Runs `validate` the way passport-github2 does (`passReqToCallback`) — through the verify callback the
	 * `PassportStrategy` mixin registered — and returns what reached Passport's `done`, which must be called
	 * exactly once.
	 */
	const runValidate = async (profile: Partial<Profile>): Promise<{ error: any; user: any }> => {
		const strategy = new GithubStrategy(configService);
		const calls: Array<{ error: any; user: any }> = [];
		await (strategy as any)._verify(
			{},
			'access-token',
			'refresh-token',
			profile as Profile,
			(error: any, user: any) => calls.push({ error, user })
		);
		expect(calls).toHaveLength(1);
		return calls[0];
	};

	const baseProfile: Partial<Profile> = {
		id: '42',
		provider: 'github',
		displayName: 'Ada Lovelace',
		username: 'ada',
		photos: [{ value: 'https://avatars.example/ada.png' }]
	};

	describe('parseGithubConfig', () => {
		it('asks passport-github2 for every raw email, so the verified and primary flags reach validate', () => {
			expect(parseGithubConfig(configService)).toEqual(expect.objectContaining({ allRawEmails: true }));
		});

		it('keeps requesting the user:email scope', () => {
			expect(parseGithubConfig(configService).scope).toEqual(expect.arrayContaining(['user:email']));
		});
	});

	describe('validate', () => {
		it('offers the verified primary address, flagged verified', async () => {
			const { error, user } = await runValidate({
				...baseProfile,
				emails: rawEmails([
					{ value: 'old@example.com', primary: false, verified: false },
					{ value: 'ada@example.com', primary: true, verified: true }
				])
			});

			expect(error).toBeNull();
			expect(user.emails).toEqual([{ value: 'ada@example.com', verified: true }]);
		});

		it('does not offer a secondary address, even a verified one, as the token sign-in does not', async () => {
			const { user } = await runValidate({
				...baseProfile,
				emails: rawEmails([
					{ value: 'former-employer@example.com', primary: false, verified: true },
					{ value: 'ada@example.com', primary: true, verified: true }
				])
			});

			expect(user.emails.map(({ value }) => value)).toEqual(['ada@example.com']);
		});

		it('never marks the primary address verified when GitHub did not flag it so', async () => {
			for (const verified of [false, undefined, 'true']) {
				const { user } = await runValidate({
					...baseProfile,
					emails: rawEmails([{ value: 'ada@example.com', primary: true, verified }])
				});

				expect(user.emails).toEqual([{ value: 'ada@example.com', verified: false }]);
			}
		});

		it('returns an empty email list when GitHub sent none', async () => {
			const { error, user } = await runValidate({ ...baseProfile, emails: undefined });

			expect(error).toBeNull();
			expect(user.emails).toEqual([]);
		});

		it('signs in a GitHub account that has no display name', async () => {
			const { error, user } = await runValidate({
				...baseProfile,
				displayName: null,
				emails: rawEmails([{ value: 'ada@example.com', primary: true, verified: true }])
			});

			expect(error).toBeNull();
			expect(user).toEqual(
				expect.objectContaining({
					firstName: '',
					lastName: undefined,
					username: 'ada',
					providerId: '42',
					provider: 'github',
					emails: [{ value: 'ada@example.com', verified: true }]
				})
			);
		});

		it('splits the display name into first and last name', async () => {
			const { user } = await runValidate({ ...baseProfile, emails: [] });

			expect(user).toEqual(expect.objectContaining({ firstName: 'Ada', lastName: 'Lovelace' }));
		});
	});

	describe('profile from the GitHub API', () => {
		it('marks the verified primary address of a real /user/emails response as verified', async () => {
			const strategy = new GithubStrategy(configService);
			const responses: Record<string, unknown> = {
				'https://api.github.com/user': { id: 42, login: 'ada', name: 'Ada Lovelace', avatar_url: 'x' },
				'https://api.github.com/user/emails': [
					{ email: 'work@example.com', primary: false, verified: true, visibility: null },
					{ email: 'ada@example.com', primary: true, verified: true, visibility: 'private' }
				]
			};
			// Stand in for the GitHub API; passport-github2 builds the profile from these two responses.
			(strategy as any)._oauth2.get = (url: string, _token: string, callback: Function) =>
				callback(null, JSON.stringify(responses[url]));

			const profile: Profile = await new Promise((resolve, reject) =>
				strategy.userProfile('access-token', (err?: Error | null, value?: any) =>
					err ? reject(err) : resolve(value)
				)
			);
			const user: any = await strategy.validate({} as any, 'access-token', 'refresh-token', profile);

			expect(user.emails).toEqual([{ value: 'ada@example.com', verified: true }]);
		});
	});
});
