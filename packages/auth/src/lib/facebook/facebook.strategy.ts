import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-facebook';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
	constructor(readonly configService: ConfigService) {
		super(parseFacebookConfig(configService));
	}

	/**
	 * Validates and extracts user information from Facebook OAuth profile.
	 *
	 * This method is called after successful authentication with Facebook.
	 * It processes the profile data and constructs a user object.
	 *
	 * @param {string} accessToken - The OAuth access token received from Facebook.
	 * @param {string} refreshToken - The refresh token (not used in Facebook OAuth).
	 * @param {Profile} profile - The Facebook user's profile data.
	 * @param {(err: any, user?: any, info?: any) => void} done - Callback function to indicate authentication success or failure.
	 *
	 * @returns {Promise<void>} - Resolves after processing the user profile.
	 */
	async validate(
		accessToken: string,
		refreshToken: string,
		profile: Profile,
		done: (err: any, user?: any, info?: any) => void
	): Promise<void> {
		try {
			console.log('Facebook OAuth validate:', profile);
			// Extract relevant information from the user's profile
			const { emails } = profile;

			// Construct user object
			const user = {
				emails,
				accessToken,
				refreshToken
			};

			// Pass the user object to the callback to indicate successful authentication
			done(null, user);
		} catch (error) {
			console.error('Error during Facebook OAuth validation:', error);
			done(error, false);
		}
	}
}

/**
 * Generates the configuration object for Facebook OAuth authentication.
 *
 * @param {ConfigService} configService - The configuration service instance.
 * @returns {Record<string, any>} - The Facebook OAuth configuration object.
 * @throws {Error} If required Facebook OAuth configuration values are missing.
 */
export const parseFacebookConfig = (configService: ConfigService): Record<string, any> => {
	const clientID = configService.get<string>('facebook.clientId');
	const clientSecret = configService.get<string>('facebook.clientSecret');
	const callbackURL = configService.get<string>('facebook.callbackURL');

	if (!clientID || !clientSecret || !callbackURL) {
		console.warn('⚠️ Facebook OAuth configuration is incomplete. Defaulting to "disabled".');
	}

	return {
		clientID: clientID || 'disabled',
		clientSecret: clientSecret || 'disabled',
		callbackURL: callbackURL || `${process.env.API_BASE_URL ?? 'http://localhost:3000'}/api/auth/facebook/callback`,
		scope: ['email'],
		profileFields: ['id', 'emails', 'name'],
		enableProof: true
	};
};
