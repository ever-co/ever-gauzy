import { IApiServerOptions } from '@gauzy/common';
import { ConfigService, IEnvironment } from '@gauzy/config';
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-auth0';

@Injectable()
export class Auth0Strategy extends PassportStrategy(Strategy, 'auth0') {
	constructor(private readonly configService: ConfigService) {
		super(config(configService));
	}
}

export const config = (configService: ConfigService) => {
	const AUTH0_CONFIG = configService.get(
		'auth0Config'
	) as IEnvironment['auth0Config'];
	const { baseUrl } = configService.apiConfigOptions as IApiServerOptions;

	return {
		clientID: AUTH0_CONFIG.clientID || 'disabled',
		clientSecret: AUTH0_CONFIG.clientSecret || 'disabled',
		domain: AUTH0_CONFIG.domain || 'disabled',
		callbackURL: `${baseUrl}/auth/auth0/callback`
	};
};
