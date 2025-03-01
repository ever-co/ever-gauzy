import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Strategy } from 'passport-twitter';

@Injectable()
export class TwitterStrategy extends PassportStrategy(Strategy, 'twitter') {
	constructor(protected readonly configService: ConfigService) {
		super(parseTwitterConfig(configService));
	}

	/**
	 * Validates and extracts user information from Twitter OAuth profile.
	 *
	 * This method is called after successful authentication with Twitter.
	 * It processes the profile data and constructs a user object.
	 *
	 * @param {string} accessToken - The OAuth access token received from Twitter.
	 * @param {string} refreshToken - The refresh token (not used in Twitter OAuth).
	 * @param {Profile} profile - The Twitter user's profile data.
	 * @param {(err: any, user?: any, info?: any) => void} done - Callback function to indicate authentication success or failure.
	 *
	 * @returns {Promise<void>} - Resolves after processing the user profile.
	 */
	async validate(
		accessToken: string,
		refreshToken: string,
		profile: any,
		done: (err: any, user: any, info?: any) => void
	): Promise<void> {
		try {
			console.log('Twitter OAuth validate:', profile);
			// Extract relevant information from the user's profile
			const { emails } = profile;

			// Construct user object
			const user = {
				emails,
				accessToken,
				refreshToken
			};

			done(null, user);
		} catch (error) {
			console.error('Error during Twitter OAuth validation:', error);
			done(error, false);
		}
	}
}

/**
 * Parses the Twitter configuration using the provided ConfigService.
 *
 * Retrieves the consumer key, consumer secret, and callback URL for Twitter OAuth from the configuration.
 * If any of these values are missing, a warning is logged and default values are applied.
 *
 * @param configService - An instance of the ConfigService to access application configuration.
 * @returns An object containing the Twitter OAuth configuration.
 */
export const parseTwitterConfig = (configService: ConfigService): Record<string, any> => {
	// Retrieve Twitter configuration values from the configuration service
	const consumerKey = configService.get<string>('twitter.consumerKey');
	const consumerSecret = configService.get<string>('twitter.consumerSecret');
	const callbackURL = configService.get<string>('twitter.callbackURL');

	// If any of the required configuration values are missing, log a warning.
	if (!consumerKey || !consumerSecret || !callbackURL) {
		console.warn('⚠️ Twitter OAuth configuration is incomplete. Defaulting to "disabled".');
	}

	// Return the configuration object for Twitter OAuth.
	return {
		// Use the retrieved consumerKey, or default to 'disabled' if not present.
		consumerKey: consumerKey || 'disabled',
		// Use the retrieved consumerSecret, or default to 'disabled' if not present.
		consumerSecret: consumerSecret || 'disabled',
		// Use the retrieved callbackURL, or default to the API_BASE_URL (or localhost) plus the callback path.
		callbackURL: callbackURL || `${process.env.API_BASE_URL ?? 'http://localhost:3000'}/api/auth/twitter/callback`,
		// Always include the email field in the Twitter OAuth response.
		includeEmail: true
	};
};
