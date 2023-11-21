import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Strategy } from 'passport-github2';

export const GITHUB = 'github';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, GITHUB) {
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
 * @param configService - An instance of the ConfigService to retrieve configuration values.
 * @returns An object containing GitHub OAuth configuration.
 */
export const config = (configService: ConfigService) => ({
	clientID: <string>configService.get<string>('github.clientId') || 'disabled',
	clientSecret: <string>configService.get<string>('github.clientSecret') || 'disabled',
	callbackURL: <string>configService.get<string>('github.callbackAPIUrl'),
	passReqToCallback: true,
	scope: ['read:user', 'user:email']
});
