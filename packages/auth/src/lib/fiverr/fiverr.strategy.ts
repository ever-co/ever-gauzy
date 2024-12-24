import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-google-oauth20';
import { ConfigService, IEnvironment } from '@gauzy/config';
import passport from 'passport';

@Injectable()
export class FiverrStrategy extends PassportStrategy(Strategy, 'fiverr') {
	constructor(readonly configService: ConfigService) {
		super(config(configService));
	}

	async validate(profile, done: Function) {
		passport['_strategies'].session.role_name = '';
		try {
			try {
				const { emails } = profile;
				const user = {
					emails
				};
				done(null, user);
			} catch (err) {
				done(err, false);
			}
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
	const FIVERR_CONFIG = configService.get('fiverrConfig') as IEnvironment['fiverrConfig'];
	const { baseUrl } = configService.apiConfigOptions;

	return {
		clientID: FIVERR_CONFIG.clientId || 'disabled',
		clientSecret: FIVERR_CONFIG.clientSecret || 'disabled',
		callbackURL: `${baseUrl}/api/auth/fiverr/callback`,
		passReqToCallback: true
	};
};
