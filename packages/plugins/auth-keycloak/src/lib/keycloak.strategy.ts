import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, StrategyOptions } from 'passport-keycloak-oauth2-oidc';

@Injectable()
export class KeycloakStrategy extends PassportStrategy(Strategy, 'keycloak') {
	constructor(protected readonly configService: ConfigService) {
		super(parseKeycloakConfig(configService));
	}

	/**
	 * Validates the provided tokens and user profile from the OAuth provider.
	 *
	 * Passport contract (`@nestjs/passport`'s `PassportStrategy` mixin): the returned value is the user and a
	 * thrown error is the error; the mixin reports either one to passport's `done` exactly once, so this
	 * method never calls `done` itself (doing both reported every sign-in twice: a success, then a failure).
	 *
	 * The request comes first because `parseKeycloakConfig` sets `passReqToCallback`. Without it,
	 * passport-oauth2 calls the verify callback as `(accessToken, refreshToken, profile, done)` — the mixin's
	 * callback takes rest parameters, so its arity cannot tell passport otherwise — and every argument here
	 * would be shifted by one, the profile being the `done` function.
	 *
	 * @param _request - The HTTP request object.
	 * @param accessToken - The access token from the provider.
	 * @param refreshToken - The refresh token from the provider.
	 * @param profile - The user profile information.
	 * @returns The user object built from the profile.
	 */
	async validate(_request: any, accessToken: string, refreshToken: string, profile: any) {
		try {
			// Destructure the profile to extract user details
			const { name, emails, photos } = profile;
			const [picture] = photos || [];

			// Construct the user object with the desired properties; the returned user is what passport authenticates.
			return {
				emails,
				firstName: name?.givenName,
				lastName: name?.familyName,
				picture,
				accessToken,
				refreshToken
			};
		} catch (error) {
			// The thrown error is what passport reports as the authentication failure.
			console.error('Error during Keycloak OAuth validation:', error);
			throw error;
		}
	}
}

/**
 * Parses and returns the Keycloak configuration from the provided ConfigService.
 *
 * @param configService - The configuration service instance.
 * @returns A Keycloak configuration object.
 */
export const parseKeycloakConfig = (configService: ConfigService): StrategyOptions => {
	const { clientId, clientSecret, realm, authServerURL, cookieKey, callbackURL } = {
		// Retrieve the Keycloak client ID from the configuration.
		clientId: configService.get<string>('keycloak.clientId'),
		// Retrieve the Keycloak client Secret from the configuration.
		clientSecret: configService.get<string>('keycloak.clientSecret'),
		// Retrieve the Keycloak realm from the configuration.
		realm: configService.get<string>('keycloak.realm'),
		// Retrieve the Keycloak auth server URL from the configuration.
		authServerURL: configService.get<string>('keycloak.authServerURL', 'https://keycloak.example.com/auth'),
		// Retrieve the Keycloak cookie key from the configuration.
		cookieKey: configService.get<string>('keycloak.cookieKey'),
		// Retrieve the callback URL from the configuration.
		callbackURL: configService.get<string>('keycloak.callbackURL')
	};

	if (!clientId || !clientSecret) {
		console.warn('⚠️ Keycloak authentication configuration is incomplete. Defaulting to "disabled".');
	}

	return {
		clientID: clientId || 'disabled',
		clientSecret: clientSecret || 'disabled',
		realm,
		authServerURL,
		cookieKey,
		callbackURL: callbackURL || `${process.env.API_BASE_URL ?? 'http://localhost:3000'}/api/auth/keycloak/callback`,
		// Hand the request to `validate` as its first argument (see KeycloakStrategy.validate).
		passReqToCallback: true
	};
};
