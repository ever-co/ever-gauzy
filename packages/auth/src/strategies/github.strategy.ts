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
}

export const config = (configService: ConfigService) => {
	const GITHUB_CONFIG = configService.get(
		'githubConfig'
	) as IEnvironment['githubConfig'];
	const { baseUrl } = configService.apiConfigOptions as IApiServerOptions;

	return {
		clientID: GITHUB_CONFIG.clientId || 'disabled',
		clientSecret: GITHUB_CONFIG.clientSecret || 'disabled',
		callbackURL: `${baseUrl}/api/auth/github/callback`,
		passReqToCallback: true,
		scope: ['user:email']
	};
};
