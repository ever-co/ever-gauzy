import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-google-oauth20';
import { ConfigService } from '@gauzy/config';
import passport from 'passport';

@Injectable()
export class FiverrStrategy extends PassportStrategy(Strategy, 'fiverr') {
	constructor(readonly configService: ConfigService) {
		super(parseFiverrConfig(configService));
	}

	/**
	 * Validates and extracts user information from Fiverr's OAuth profile.
	 *
	 * @param {any} profile - The user profile returned by Fiverr.
	 * @param {Function} done - The callback function to complete authentication.
	 */
	async validate(profile: any, done: (error: any, user?: any) => void) {
		try {
			console.log('Fiverr OAuth validate:', profile);

			// Ensure session strategy exists before modifying
			if (passport['_strategies'].session) {
				passport['_strategies'].session.role_name = '';
			}

			const { emails } = profile || {};
			const user = { emails };

			done(null, user);
		} catch (error) {
			console.error('Fiverr OAuth validation error:', error);
			done(error, false);
		}
	}
}

/**
 * Retrieves the configuration for the Fiverr OAuth strategy.
 *
 * @param {ConfigService} configService - The configuration service instance.
 * @returns {Record<string, string | boolean>} - The configuration object for Fiverr authentication.
 * @throws {Error} If required Fiverr configuration values are missing.
 */
export const parseFiverrConfig = (configService: ConfigService): Record<string, string | boolean> => {
	// Retrieve Fiverr configuration from the environment
	const fiverrConfig = configService.get('fiverrConfig');
	// Retrieve API base URL
	const { baseUrl } = configService.apiConfigOptions;

	// Validate required Fiverr configurations
	if (!fiverrConfig?.clientId || !fiverrConfig?.clientSecret) {
		console.warn('⚠️ Fiverr authentication configuration is incomplete. Defaulting to "disabled".');
	}

	return {
		clientID: fiverrConfig?.clientId ?? 'disabled',
		clientSecret: fiverrConfig?.clientSecret ?? 'disabled',
		callbackURL: `${baseUrl ?? 'http://localhost:3000'}/api/auth/fiverr/callback`, // Ensure a fallback URL
		passReqToCallback: true
	};
};
