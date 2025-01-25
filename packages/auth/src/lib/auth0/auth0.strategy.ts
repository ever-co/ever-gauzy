import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-auth0';
import { ConfigService } from '@gauzy/config';

@Injectable()
export class Auth0Strategy extends PassportStrategy(Strategy, 'auth0') {
	constructor(readonly configService: ConfigService) {
		super(parseAuth0Config(configService));
	}
}

/**
 * Generates the configuration object for Auth0 authentication.
 *
 * @param {ConfigService} configService - The configuration service instance.
 * @returns {Record<string, string>} - The Auth0 configuration object.
 * @throws {Error} If required Auth0 configuration values are missing.
 */
export const parseAuth0Config = (configService: ConfigService): Record<string, string> => {
	// Retrieve Auth0 configuration from the environment
	const auth0Config = configService.get('auth0Config');
	// Retrieve API base URL
	const { baseUrl } = configService.getConfigValue('apiConfigOptions');

	// Validate required configurations
	if (!auth0Config.clientID || !auth0Config.clientSecret || !auth0Config.domain) {
		console.warn('Auth0 configuration is missing some required values. Defaulting to "disabled".');
	}

	// Construct and return the Auth0 configuration object
	return {
		clientID: auth0Config.clientID ?? 'disabled',
		clientSecret: auth0Config.clientSecret ?? 'disabled',
		domain: auth0Config.domain ?? 'disabled',
		callbackURL: `${baseUrl ?? 'http://localhost:3000'}/api/auth/auth0/callback` // Ensure a fallback URL
	};
};
