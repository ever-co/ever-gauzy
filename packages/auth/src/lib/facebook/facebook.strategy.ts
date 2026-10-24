import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, StrategyOptions } from 'passport-facebook';

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
	 *
	 * Passport contract (`@nestjs/passport`'s `PassportStrategy` mixin): the returned value is the user and a
	 * thrown error is the error; the mixin reports either one to passport's `done` exactly once, so this
	 * method never calls `done` itself (doing both reported every sign-in twice: a success, then a failure).
	 *
	 * @returns The user object built from the profile.
	 */
	async validate(accessToken: string, refreshToken: string, profile: Profile) {
		try {
			// Extract relevant information from the user's profile
			const { emails } = profile;

			// Construct user object
			const user = {
				// Graph has no per-address verified flag, so the /me email is trusted the way the token sign-in
				// (verifyFacebookToken) trusts it. An empty value is never marked verified.
				emails: (emails ?? []).map(({ value }) => ({ value, verified: Boolean(value) })),
				accessToken,
				refreshToken
			};

			// The returned user is what passport authenticates
			return user;
		} catch (error) {
			console.error('Error during Facebook OAuth validation:', error);
			throw error;
		}
	}
}

/**
 * Generates the configuration object for Facebook OAuth authentication.
 *
 * @param {ConfigService} configService - The configuration service instance.
 * @returns {StrategyOption} - The Facebook OAuth configuration object.
 */
export const parseFacebookConfig = (configService: ConfigService): StrategyOptions => {
	const { clientId, clientSecret, callbackURL } = {
		clientId: configService.get<string>('facebook.clientId'),
		clientSecret: configService.get<string>('facebook.clientSecret'),
		callbackURL: configService.get<string>('facebook.callbackURL')
	};

	if (!clientId || !clientSecret || !callbackURL) {
		console.warn('⚠️ Facebook OAuth configuration is incomplete. Defaulting to "disabled".');
	}

	return {
		clientID: clientId || 'disabled',
		clientSecret: clientSecret || 'disabled',
		callbackURL: callbackURL || `${process.env.API_BASE_URL ?? 'http://localhost:3000'}/api/auth/facebook/callback`,
		profileFields: ['id', 'emails', 'name'],
		scope: ['email'],
		enableProof: true
	};
};
