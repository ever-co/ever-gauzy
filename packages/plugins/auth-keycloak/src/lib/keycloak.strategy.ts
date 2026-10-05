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
	 * @param _request - The HTTP request object.
	 * @param accessToken - The access token from the provider.
	 * @param refreshToken - The refresh token from the provider.
	 * @param profile - The user profile information.
	 * @param done - The callback function to return the user or an error.
	 */
	async validate(
		_request: any,
		accessToken: string,
		refreshToken: string,
		profile: any,
		done: (err: unknown, user?: unknown) => void
	): Promise<void> {
		try {
			// Destructure the profile to extract user details
			const { name, emails, photos } = profile;
			const [picture] = photos || [];

			// Construct the user object with the desired properties
			const user = {
				emails,
				firstName: name?.givenName,
				lastName: name?.familyName,
				picture,
				accessToken,
				refreshToken
			};

			// Invoke the callback with the user object
			done(null, user);
		} catch (error) {
			// In case of error, pass the error to the callback
			console.error('Error during Keycloak OAuth validation:', error);
			done(error, false);
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
		callbackURL: callbackURL || `${process.env.API_BASE_URL ?? 'http://localhost:3000'}/api/auth/keycloak/callback`
	};
};
