import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-auth0';
import { ConfigService, IEnvironment } from '@gauzy/config';

@Injectable()
export class Auth0Strategy extends PassportStrategy(Strategy, 'auth0') {
	constructor(readonly configService: ConfigService) {
		super(config(configService));
	}
}

/**
 *
 * @param configService
 * @returns
 */
export const config = (configService: ConfigService) => {
	const AUTH0_CONFIG = configService.get('auth0Config') as IEnvironment['auth0Config'];
	const { baseUrl } = configService.apiConfigOptions;

	return {
		clientID: AUTH0_CONFIG.clientID || 'disabled',
		clientSecret: AUTH0_CONFIG.clientSecret || 'disabled',
		domain: AUTH0_CONFIG.domain || 'disabled',
		callbackURL: `${baseUrl}/auth/auth0/callback`
	};
};
