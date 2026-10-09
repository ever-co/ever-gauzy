import * as passport from 'passport';
import { ConfigService } from '@nestjs/config';
import { KeycloakAuthGuard } from './keycloak-auth-guard';
import { KeycloakStrategy, parseKeycloakConfig } from './keycloak.strategy';

describe('Keycloak passport strategy (moved from @gauzy/auth unchanged)', () => {
	const settings: Record<string, string> = {
		'keycloak.clientId': 'gauzy',
		'keycloak.clientSecret': 'secret-value',
		'keycloak.realm': 'gauzy',
		'keycloak.authServerURL': 'https://keycloak.internal.test/auth',
		'keycloak.callbackURL': 'https://api.internal.test/api/auth/keycloak/callback'
	};
	const configService = { get: (key: string, fallback?: string) => settings[key] ?? fallback } as unknown as ConfigService;

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
});
