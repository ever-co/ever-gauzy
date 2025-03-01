import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt } from 'passport-jwt';
import { Strategy } from 'passport-linkedin-oauth2';
import { environment } from '@gauzy/config';

@Injectable()
export class LinkedinStrategy extends PassportStrategy(Strategy, 'linkedin') {
	constructor(protected readonly configService: ConfigService) {
		super(parseLinkedinConfig(configService));
	}

	/**
	 * Validates the provided OAuth profile and constructs a simplified user object.
	 *
	 * This function extracts the user's email(s) from the OAuth profile and combines it
	 * with the access token. If validation succeeds, the user object is passed to the callback.
	 * Otherwise, the error is forwarded to the callback.
	 *
	 * @param request - The incoming request object.
	 * @param accessToken - The OAuth access token.
	 * @param refreshToken - The OAuth refresh token.
	 * @param profile - The user profile returned by the OAuth provider.
	 * @param done - The callback to be invoked with either an error or the user object.
	 * @returns A promise that resolves when the validation process is complete.
	 */
	async validate(
		request: any,
		accessToken: string,
		refreshToken: string,
		profile: any,
		done: Function
	): Promise<void> {
		try {
			// Extract emails from the OAuth profile.
			const { emails } = profile;

			// Create a user object with the required properties.
			const user = {
				emails,
				accessToken,
				refreshToken
			};

			// Invoke the callback with no error and the constructed user.
			done(null, user);
		} catch (error) {
			// If an error occurs, pass the error to the callback.
			console.error('Error during LinkedIn OAuth validation:', error);
			done(error, false);
		}
	}
}

/**
 * Parses the LinkedIn OAuth configuration using the provided ConfigService.
 *
 * Retrieves the LinkedIn client ID, client secret, callback URL, and other related settings
 * from the configuration. If any required configuration is missing, a warning is logged and default values are applied.
 *
 * @param configService - An instance of the ConfigService used to access application configuration.
 * @returns An object containing the LinkedIn OAuth configuration parameters.
 */
export const parseLinkedinConfig = (configService: ConfigService): Record<string, any> => {
	// Retrieve LinkedIn OAuth client ID from the configuration service, default to 'disabled' if not found.
	const clientID = configService.get<string>('linkedin.clientId');
	// Retrieve LinkedIn OAuth client secret from the configuration service, default to 'disabled' if not found.
	const clientSecret = configService.get<string>('linkedin.clientSecret');
	// Retrieve LinkedIn OAuth callback URL from the configuration service.
	const callbackURL = configService.get<string>('linkedin.callbackURL');

	// Validate required LinkedIn configurations. Log a warning if any are missing.
	if (!clientID || !clientSecret || !callbackURL) {
		console.warn('⚠️ LinkedIn OAuth configuration is incomplete. Defaulting to "disabled".');
	}

	// Return the configuration object with defaults as needed.
	return {
		// Use the retrieved clientID, or default to 'disabled' if not provided.
		clientID: clientID || 'disabled',
		// Use the retrieved clientSecret, or default to 'disabled' if not provided.
		clientSecret: clientSecret || 'disabled',
		// Use the retrieved callbackURL, or default to a constructed URL based on API_BASE_URL.
		callbackURL: callbackURL || `${process.env.API_BASE_URL ?? 'http://localhost:3000'}/api/auth/linkedin/callback`,
		// Include the request object in the OAuth callback.
		passReqToCallback: true,
		// Specify the scope for LinkedIn OAuth (for reading basic profile and email).
		scope: ['r_liteprofile', 'r_emailaddress'],
		// Use the JWT secret from the environment for LinkedIn OAuth.
		secretOrKey: environment.JWT_SECRET,
		// Define how to extract the JWT from the request's Authorization header.
		jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken()
	};
};
