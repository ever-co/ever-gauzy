import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
	constructor(protected readonly configService: ConfigService) {
		super(config(configService));
	}

	async validate(
		request: any,
		accessToken: string,
		refreshToken: string,
		profile: any,
		done: VerifyCallback
	) {
		try {
			const { name, emails, photos } = profile;
			const [picture] = photos;

			const user = {
				emails,
				firstName: name.givenName,
				lastName: name.familyName,
				picture: picture,
				accessToken
			};
			done(null, user);
		} catch (err) {
			done(err, false);
		}
	}
}

/**
 * Creates a configuration object for Google OAuth based on the provided ConfigService.
 *
 * @param config - An instance of the ConfigService to retrieve configuration values.
 * @returns An object containing Google OAuth configuration.
 */
export const config = (configService: ConfigService) => ({
	// Retrieve Google OAuth client ID from the configuration service, default to 'disabled' if not found.
	clientID: <string>configService.get<string>('google.clientId') || 'disabled',

	// Retrieve Google OAuth client secret from the configuration service, default to 'disabled' if not found.
	clientSecret: <string>configService.get<string>('google.clientSecret') || 'disabled',

	// Retrieve Google OAuth callback URL from the configuration service.
	callbackURL: <string>configService.get<string>('google.callbackURL'),

	// Pass the request object to the callback.
	passReqToCallback: true,

	// Specify the scope for Google OAuth (read user data and user email).
	scope: ['email', 'profile']
});
