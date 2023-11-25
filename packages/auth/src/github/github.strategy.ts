import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { OAuth2StrategyOptionsWithoutRequiredURLs, Profile, Strategy } from 'passport-github2';
import { Request } from 'express';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
	constructor(protected readonly configService: ConfigService) {
		super(config(configService));
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

			/** */
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
		} catch (err) {

			// Pass the error to the callback to indicate authentication failure
			done(err, false);
		}
	}
}

/**
 * Creates a configuration object for GitHub OAuth based on the provided ConfigService.
 *
 * @param config - An instance of the ConfigService to retrieve configuration values.
 * @returns An object containing GitHub OAuth configuration.
 */
export const config = (configService: ConfigService) => ({
	// Retrieve GitHub OAuth client ID from the configuration service, default to 'disabled' if not found.
	clientID: <string>configService.get<string>('github.clientId') || 'disabled',

	// Retrieve GitHub OAuth client secret from the configuration service, default to 'disabled' if not found.
	clientSecret: <string>configService.get<string>('github.clientSecret') || 'disabled',

	// Retrieve GitHub OAuth callback URL from the configuration service.
	callbackURL: <string>configService.get<string>('github.callbackURL'),

	// Pass the request object to the callback.
	passReqToCallback: true,

	// Specify the scope for GitHub OAuth (read user data and user email).
	scope: ['read:user', 'user:email'],

	// Retrieve the User Agent from the configuration service.
	userAgent: <string>configService.get<string>('github.userAgent'),
} as OAuth2StrategyOptionsWithoutRequiredURLs);
