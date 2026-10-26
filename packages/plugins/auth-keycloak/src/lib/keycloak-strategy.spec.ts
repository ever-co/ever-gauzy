import * as passport from 'passport';
import { ConfigService } from '@nestjs/config';
import { KeycloakAuthGuard } from './keycloak-auth-guard';
import { KeycloakStrategy, parseKeycloakConfig } from './keycloak.strategy';

describe('Keycloak passport strategy', () => {
	const settings: Record<string, string> = {
		'keycloak.clientId': 'gauzy',
		'keycloak.clientSecret': 'secret-value',
		'keycloak.realm': 'gauzy',
		'keycloak.authServerURL': 'https://keycloak.internal.test/auth',
		'keycloak.callbackURL': 'https://api.internal.test/api/auth/keycloak/callback'
	};
	const configService = {
		get: (key: string, fallback?: string) => settings[key] ?? fallback
	} as unknown as ConfigService;

	it('registers itself on the passport singleton under the name "keycloak"', () => {
		new KeycloakStrategy(configService);
		expect((passport as unknown as { _strategy(name: string): unknown })._strategy('keycloak')).toBeDefined();
	});

	it('reads the same configuration keys as before', () => {
		expect(parseKeycloakConfig(configService)).toEqual(
			expect.objectContaining({
				clientID: 'gauzy',
				clientSecret: 'secret-value',
				realm: 'gauzy',
				authServerURL: 'https://keycloak.internal.test/auth',
				callbackURL: 'https://api.internal.test/api/auth/keycloak/callback'
			})
		);
	});

	it('still exports the guard', () => {
		expect(KeycloakAuthGuard).toBeDefined();
	});

	describe('validate, through the verify callback the PassportStrategy mixin registered', () => {
		const profile = {
			id: 'kc-42',
			name: { givenName: 'Ada', familyName: 'Lovelace' },
			emails: [{ value: 'ada@example.com', verified: true }],
			photos: [{ value: 'https://keycloak.internal.test/avatar/ada.png' }]
		};

		/**
		 * Runs the strategy the way passport-oauth2 does with `passReqToCallback`:
		 * `verify(req, accessToken, refreshToken, profile, done)`, and returns what reached `done`.
		 */
		const runVerify = async (userProfile: unknown): Promise<Array<{ error: unknown; user: unknown }>> => {
			const strategy = new KeycloakStrategy(configService);
			const calls: Array<{ error: unknown; user: unknown }> = [];
			await (strategy as any)._verify(
				{},
				'access-token',
				'refresh-token',
				userProfile,
				(error: unknown, user: unknown) => calls.push({ error, user })
			);
			return calls;
		};

		it('asks passport-oauth2 to pass the request first, which is the argument order validate declares', () => {
			// The mixin's callback takes rest parameters (arity 0), so passport-oauth2 cannot infer the order from
			// it: without this option it would call `(accessToken, refreshToken, profile, done)` and every
			// argument of `validate` would be shifted by one, the profile being the `done` function.
			expect(parseKeycloakConfig(configService)).toEqual(expect.objectContaining({ passReqToCallback: true }));

			const strategy = new KeycloakStrategy(configService) as any;
			expect(strategy._passReqToCallback).toBe(true);
			expect(strategy._verify.length).toBe(0);
		});

		it('reports the user built from the profile to passport exactly once', async () => {
			const calls = await runVerify(profile);

			expect(calls).toEqual([
				{
					error: null,
					user: {
						emails: profile.emails,
						firstName: 'Ada',
						lastName: 'Lovelace',
						picture: profile.photos[0],
						accessToken: 'access-token',
						refreshToken: 'refresh-token'
					}
				}
			]);
		});

		it('reports a profile it cannot read as one failure, not a success followed by a failure', async () => {
			const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
			try {
				const calls = await runVerify(null);

				expect(calls).toHaveLength(1);
				expect(calls[0].error).toBeInstanceOf(TypeError);
				expect(calls[0].user).toBeNull();
			} finally {
				consoleError.mockRestore();
			}
		});

		it('tolerates a profile without a name or photos', async () => {
			const calls = await runVerify({ emails: profile.emails });

			expect(calls).toEqual([
				{
					error: null,
					user: expect.objectContaining({
						emails: profile.emails,
						firstName: undefined,
						lastName: undefined,
						picture: undefined
					})
				}
			]);
		});
	});
});
