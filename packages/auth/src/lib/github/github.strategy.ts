import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { Profile, Strategy } from 'passport-github2';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
	constructor(protected readonly configService: ConfigService) {
		super(parseGithubConfig(configService));
	}

	/**
	 * Validate user profile after OAuth2 authentication.
	 * @param _request - The Express request object.
	 * @param _accessToken - The access token obtained from the OAuth2 provider.
	 * @param _refreshToken - The refresh token obtained from the OAuth2 provider.
	 * @param profile - The user's profile information obtained from the OAuth2 provider.
	 * @param done - Passport callback function to indicate success or failure.
	 */
	async validate(
		_request: Request,
		_accessToken: string,
		_refreshToken: string,
		profile: Profile,
		done: (error: any, user: any, info?: any) => void
	) {
		try {
			// Extract relevant information from the user's profile
			const { id: providerId, provider, emails, displayName, username, photos } = profile;

			// Extract first name and last name from the display name
			const [firstName, lastName] = displayName.split(' ');

			// Extract the user's profile picture
			const [photo] = photos;

			// Construct user object
			const user = {
				emails,
				firstName,
				lastName,
				username,
				picture: photo?.value,
				providerId,
				provider
			};

			// Pass the user object to the callback to indicate successful authentication
			done(null, user);
		} catch (error) {
			// Pass the error to the callback to indicate authentication failure
			console.error('Error during Github OAuth validation:', error);
			done(error, false);
		}
	}
}

/**
 * Parses the GitHub OAuth configuration using the provided ConfigService.
 *
 * Retrieves the GitHub client ID, client secret, callback URL, user agent, and additional parameters
 * from the configuration. If any required configuration is missing, a warning is logged and defaults are applied.
 *
 * @param configService - An instance of the ConfigService to access application configuration.
 * @returns An object containing the GitHub OAuth configuration.
 */
export const parseGithubConfig = (configService: ConfigService): Record<string, any> => {
	// Retrieve the GitHub client ID from the configuration.
	const clientID = configService.get<string>('github.clientId');
	// Retrieve the GitHub client secret from the configuration.
	const clientSecret = configService.get<string>('github.clientSecret');
	// Retrieve the GitHub callback URL from the configuration.
	const callbackURL = configService.get<string>('github.callbackURL');

	// Log a warning if any of the required configuration values are missing.
	if (!clientID || !clientSecret || !callbackURL) {
		console.warn('⚠️ GitHub OAuth configuration is incomplete. Defaulting to "disabled".');
	}

	// Return the GitHub OAuth configuration object.
	return {
		// Use the retrieved clientID, or default to 'disabled' if not provided.
		clientID: clientID || 'disabled',
		// Use the retrieved clientSecret, or default to 'disabled' if not provided.
		clientSecret: clientSecret || 'disabled',
		// Use the retrieved callbackURL, or default to the API_BASE_URL (or localhost) plus the callback path.
		callbackURL: callbackURL || `${process.env.API_BASE_URL ?? 'http://localhost:3000'}/api/auth/github/callback`,
		// Include the request object in the callback.
		passReqToCallback: true,
		// Specify the scope for GitHub OAuth (read user data and user email).
		scope: ['read:user', 'user:email'],
		// Retrieve the GitHub user agent from the configuration.
		userAgent: <string>configService.get<string>('github.userAgent')
	};
};
