import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Strategy } from 'passport-twitter';
import { ExtractJwt } from 'passport-jwt';
import { environment } from '@gauzy/config';

@Injectable()
export class TwitterStrategy extends PassportStrategy(Strategy, 'twitter') {
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
		done: (err: any, user: any, info?: any) => void
	) {
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
 * Creates a configuration object for Twitter OAuth based on the provided ConfigService.
 *
 * @param configService - An instance of the ConfigService to retrieve configuration values.
 * @returns An object containing Twitter OAuth configuration.
 */
export const config = (configService: ConfigService) => ({
	// Retrieve Twitter OAuth consumer key from the configuration service, default to 'disabled' if not found.
	consumerKey: <string>configService.get<string>('twitter.consumerKey') || 'disabled',

	// Retrieve Twitter OAuth consumer secret from the configuration service, default to 'disabled' if not found.
	consumerSecret: <string>configService.get<string>('twitter.consumerSecret') || 'disabled',

	// Retrieve Twitter OAuth callback URL from the configuration service.
	callbackURL: <string>configService.get<string>('twitter.callbackURL'),

	// Pass the request object to the callback.
	passReqToCallback: true,

	// Include email in the Twitter OAuth response.
	includeEmail: true,

	// JWT secret for Twitter OAuth.
	secretOrKey: environment.JWT_SECRET,

	// Extract JWT from the request's Authorization header as a bearer token.
	jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken()
});
