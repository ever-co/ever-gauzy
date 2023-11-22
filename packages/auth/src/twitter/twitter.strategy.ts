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
export const config = (config: ConfigService) => ({
	consumerKey: <string>config.get<string>('twitter.consumerKey') || 'disabled',
	consumerSecret: <string>config.get<string>('twitter.consumerSecret') || 'disabled',
	callbackURL: <string>config.get<string>('twitter.callbackURL'),
	passReqToCallback: true,
	includeEmail: true,
	secretOrKey: environment.JWT_SECRET,
	jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken()
});
