import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Strategy } from 'passport-github2';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
	constructor(protected readonly configService: ConfigService) {
		super(config(configService));
	}

	async validate(
		request: any,
		accessToken: string,
		refreshToken: string,
		profile: any,
		done: (err: any, user: any, info?: any) => void
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
	scope: ['read:user', 'user:email']
});
