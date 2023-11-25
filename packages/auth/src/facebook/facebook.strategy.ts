import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-facebook';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
	constructor(protected readonly configService: ConfigService) {
		super(config(configService));
	}

	/**
	 *
	 * @param accessToken
	 * @param refreshToken
	 * @param profile
	 * @param done
	 */
	async validate(
		accessToken: string,
		refreshToken: string,
		profile: Profile,
		done: (err: any, user: any, info?: any) => void
	): Promise<any> {
		try {
			const { emails } = profile;
			const user = { emails, accessToken };
			done(null, user);
		} catch (err) {
			done(err, false);
		}
	}
}

/**
 * Creates a configuration object for Facebook OAuth based on the provided ConfigService.
 *
 * @param configService - An instance of the ConfigService to retrieve configuration values.
 * @returns An object containing Facebook OAuth configuration.
 */
export const config = (configService: ConfigService) => ({
	// Retrieve Facebook OAuth client ID from the configuration service, default to 'disabled' if not found.
	clientID: <string>configService.get<string>('facebook.clientId') || 'disabled',

	// Retrieve Facebook OAuth client secret from the configuration service, default to 'disabled' if not found.
	clientSecret: <string>configService.get<string>('facebook.clientSecret') || 'disabled',

	// Retrieve Facebook OAuth callback URL from the configuration service.
	callbackURL: <string>configService.get<string>('facebook.callbackURL'),

	// Specify the scope for Facebook OAuth (in this case, only 'email').
	scope: 'email',

	// Specify the profile fields to request from Facebook (id, emails, name).
	profileFields: ['id', 'emails', 'name'],

	// Enable proof of authentication.
	enableProof: true
});
