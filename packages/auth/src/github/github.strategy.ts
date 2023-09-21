import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService, IEnvironment } from '@gauzy/config';
import { Strategy } from 'passport-github2';
import { IApiServerOptions } from '@gauzy/common';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
	constructor(private readonly configService: ConfigService) {
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
 *
 * @param configService
 * @returns
 */
export const config = (configService: ConfigService) => {
	const github = configService.get('github') as IEnvironment['github'];
	const { baseUrl } = configService.apiConfigOptions as IApiServerOptions;

	return {
		clientID: github.CLIENT_ID || 'disabled',
		clientSecret: github.CLIENT_SECRET || 'disabled',
		callbackURL: github.CALLBACK_URL || `${baseUrl}/api/auth/github/callback`,
		passReqToCallback: true,
		scope: ['user:email']
	};
};
