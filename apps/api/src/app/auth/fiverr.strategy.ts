import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-google-oauth20';
import { environment as env } from '@env-api/environment';
import passport from 'passport';
import { AuthService } from './auth.service';

@Injectable()
export class FiverrStrategy extends PassportStrategy(Strategy, 'fiverr') {
	constructor(private readonly _authService: AuthService) {
		super({
			clientID: env.fiverrConfig.clientId || 'disabled',
			clientSecret: env.fiverrConfig.clientSecret || 'disabled',
			callbackURL: `${env.host}:${env.port}/api/auth/fiverr/callback`,
			passReqToCallback: true
		});
	}

	async validate(
		profile,
		done: Function
	) {
		passport['_strategies'].session.role_name = '';
		const { emails } = profile;
		try {
			try {
				const {
					success,
					authData
				} = await this._authService.validateOAuthLoginEmail(emails);

				const user = { success, authData };

				done(null, user);
			} catch (err) {
				done(err, false);
			}
		} catch (err) {
			done(err, false);
		}
	}
}
