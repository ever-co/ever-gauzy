import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt } from 'passport-jwt';
import { Strategy } from 'passport-linkedin-oauth2';
import { environment } from '@gauzy/config';

@Injectable()
export class LinkedinStrategy extends PassportStrategy(Strategy, 'linkedin') {
	constructor(protected readonly configService: ConfigService) {
		super(config(configService));
	}

	/**
	 *
	 * @param request
	 * @param accessToken
	 * @param refreshToken
	 * @param profile
	 * @param done
	 */
	async validate(
		request: any,
		accessToken: string,
		refreshToken: string,
		profile: any,
		done: Function
	) {
		try {
			const { emails } = profile;
			const user = {
				emails,
				accessToken
			};
			done(null, user);
		} catch (err) {
			done(err, false);
		}
	}
}

/**
 * Creates a configuration object for LinkedIn OAuth based on the provided ConfigService.
 *
 * @param configService - An instance of the ConfigService to retrieve configuration values.
 * @returns An object containing LinkedIn OAuth configuration.
 */
export const config = (configService: ConfigService) => ({
	// Retrieve LinkedIn OAuth client ID from the configuration service, default to 'disabled' if not found.
	clientID: <string>configService.get<string>('linkedin.clientId') || 'disabled',

	// Retrieve LinkedIn OAuth client secret from the configuration service, default to 'disabled' if not found.
	clientSecret: <string>configService.get<string>('linkedin.clientSecret') || 'disabled',

	// Retrieve LinkedIn OAuth callback URL from the configuration service.
	callbackURL: <string>configService.get<string>('linkedin.callbackURL'),

	// Pass the request object to the callback.
	passReqToCallback: true,

	// Specify the scope for LinkedIn OAuth (read user data and user email).
	scope: ['r_liteprofile', 'r_emailaddress'],

	// JWT secret for LinkedIn OAuth.
	secretOrKey: environment.JWT_SECRET,

	// Extract JWT from the request's Authorization header as a bearer token.
	jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken()
});
