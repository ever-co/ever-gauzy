import { ConfigService } from '@nestjs/config';
import { Profile } from 'passport-facebook';
import { FacebookStrategy } from './facebook.strategy';

/**
 * Facebook sign-in only signs in existing users through emails flagged `verified`
 * (AuthService.validateOAuthLoginEmail skips the others). Graph has no per-address flag, so the strategy
 * trusts the /me email the way the token sign-in (verifyFacebookToken) does, and never an empty value.
 */
describe('FacebookStrategy', () => {
	const configService = { get: () => undefined } as unknown as ConfigService;

	/**
	 * Runs `validate` the way passport-facebook does — through the verify callback the `PassportStrategy`
	 * mixin registered — and returns what reached Passport's `done`, which must be called exactly once.
	 */
	const runValidate = async (emails: Profile['emails']): Promise<{ error: any; user: any }> => {
		const strategy = new FacebookStrategy(configService);
		const calls: Array<{ error: any; user: any }> = [];
		await (strategy as any)._verify(
			'access-token',
			'refresh-token',
			{ id: '7', emails } as Profile,
			(error: any, user: any) => calls.push({ error, user })
		);
		expect(calls).toHaveLength(1);
		return calls[0];
	};

	it('marks the /me email as verified', async () => {
		const { error, user } = await runValidate([{ value: 'ada@example.com' }]);

		expect(error).toBeNull();
		expect(user).toEqual({
			emails: [{ value: 'ada@example.com', verified: true }],
			accessToken: 'access-token',
			refreshToken: 'refresh-token'
		});
	});

	it('never marks an empty email value as verified', async () => {
		const { user } = await runValidate([{ value: '' }, { value: undefined }]);

		expect(user.emails).toEqual([
			{ value: '', verified: false },
			{ value: undefined, verified: false }
		]);
	});

	it('returns an empty email list when Facebook sent no email', async () => {
		const { error, user } = await runValidate(undefined);

		expect(error).toBeNull();
		expect(user.emails).toEqual([]);
	});
});
