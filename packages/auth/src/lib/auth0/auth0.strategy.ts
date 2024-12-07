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
 * Generates the configuration object for Auth0 authentication.
 *
 * @param configService - The `ConfigService` instance used to access environment-specific configurations.
 * @returns {object} - The configuration object for Auth0, including client ID, client secret, domain, and callback URL.
 */
export const config = (configService: ConfigService) => {
    const AUTH0_CONFIG = configService.get('auth0Config') as IEnvironment['auth0Config'];
    const { baseUrl } = configService.apiConfigOptions;

    return {
        clientID: AUTH0_CONFIG.clientID || 'disabled', // Auth0 Client ID or default value
        clientSecret: AUTH0_CONFIG.clientSecret || 'disabled', // Auth0 Client Secret or default value
        domain: AUTH0_CONFIG.domain || 'disabled', // Auth0 Domain or default value
        callbackURL: `${baseUrl}/auth/auth0/callback` // Constructed callback URL
    };
};
