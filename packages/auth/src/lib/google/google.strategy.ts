import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
	constructor(protected readonly configService: ConfigService) {
		super(parseGoogleConfig(configService));
	}

	/**
	 * Validates the OAuth profile and constructs a simplified user object.
	 *
	 * @param request - The incoming request object.
	 * @param accessToken - The OAuth access token.
	 * @param refreshToken - The OAuth refresh token.
	 * @param profile - The user profile provided by the OAuth provider.
	 * @param done - The callback to be invoked with the result.
	 * @returns A Promise that resolves once validation is complete.
	 */
	async validate(
		request: any,
		accessToken: string,
		refreshToken: string,
		profile: any,
		done: VerifyCallback
	): Promise<void> {
		try {
			// Destructure name, emails, and photos from the profile with default values.
			const { name, emails, photos } = profile;
			const { givenName, familyName } = name;

			// Safely extract the first photo as the picture if available.
			const picture = Array.isArray(photos) && photos.length > 0 ? photos[0] : null;

			// Construct a user object with the necessary properties.
			const user = {
				emails,
				firstName: givenName,
				lastName: familyName,
				picture,
				accessToken
			};

			// Invoke the callback with the user object.
			done(null, user);
		} catch (error) {
			// If an error occurs, pass the error to the callback.
			console.error('Error during Google OAuth validation:', error);
			done(error, false);
		}
	}
}

/**
 * Parses the Google OAuth configuration using the provided ConfigService.
 *
 * Retrieves the Google client ID, client secret, and callback URL from the configuration.
 * If any required configuration is missing, a warning is logged and default values are applied.
 *
 * @param configService - An instance of ConfigService to access application configuration.
 * @returns An object containing the Google OAuth configuration parameters.
 */
export const parseGoogleConfig = (configService: ConfigService): Record<string, any> => {
	// Retrieve Google OAuth client ID from the configuration service, default to 'disabled' if not found.
	const clientID = configService.get<string>('google.clientId');
	// Retrieve Google OAuth client secret from the configuration service, default to 'disabled' if not found.
	const clientSecret = configService.get<string>('google.clientSecret');
	// Retrieve Google OAuth callback URL from the configuration service.
	const callbackURL = configService.get<string>('google.callbackURL');

	// Log a warning if any of the required configuration values are missing.
	if (!clientID || !clientSecret || !callbackURL) {
		console.warn('⚠️ Google OAuth configuration is incomplete. Defaulting to "disabled".');
	}

	// Return the Google OAuth configuration object.
	return {
		// Use the retrieved clientID, or default to 'disabled' if not provided.
		clientID: clientID || 'disabled',
		// Use the retrieved clientSecret, or default to 'disabled' if not provided.
		clientSecret: clientSecret || 'disabled',
		// Use the retrieved callbackURL, or default to the API_BASE_URL (or localhost) plus the callback path.
		callbackURL: callbackURL || `${process.env.API_BASE_URL ?? 'http://localhost:3000'}/api/auth/google/callback`,
		// Include the request object in the callback.
		passReqToCallback: true,
		// Specify the scope for Google OAuth (request email and profile information).
		scope: ['email', 'profile']
	};
};
