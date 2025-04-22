import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-google-oauth20';

@Injectable()
export class KeycloakStrategy extends PassportStrategy(Strategy, 'keycloak') {
	constructor(protected readonly configService: ConfigService) {
		super(parseKeycloakConfig(configService));
	}

	/**
	 * Validates the provided tokens and user profile from the OAuth provider.
	 *
	 * @param request - The HTTP request object.
	 * @param accessToken - The access token from the provider.
	 * @param refreshToken - The refresh token from the provider.
	 * @param profile - The user profile information.
	 * @param done - The callback function to return the user or an error.
	 */
	async validate(
		request: any,
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
export const parseKeycloakConfig = (configService: ConfigService): Record<string, any> => {
	// Retrieve the client ID from the configuration
	const clientID = configService.get<string>('keycloak.clientId');

	// Retrieve the client secret from the configuration
	const clientSecret = configService.get<string>('keycloak.clientSecret');

	// Retrieve the realm from the configuration
	const realm = configService.get<string>('keycloak.realm');

	// Retrieve the auth server URL from the configuration
	const authServerUrl = configService.get<string>('keycloak.authServerUrl');

	// Retrieve the cookie key from the configuration
	const cookieKey = configService.get<string>('keycloak.cookieKey');

	// Validate required configurations
	if (!clientID || !clientSecret) {
		console.warn('⚠️ Keycloak authentication configuration is incomplete. Defaulting to "disabled".');
	}

	// Construct and return the Keycloak configuration object
	return {
		clientID: clientID || 'disabled',
		clientSecret: clientSecret || 'disabled',
		realm: realm,
		authServerUrl: authServerUrl,
		cookieKey: cookieKey
	};
};
