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
			clientID: env.fiverrConfig.clientId,
			callbackURL: `${env.host}:${env.port}/api/auth/fiverr/callback`,
			clientSecret: env.fiverrConfig.clientSecret,
			passReqToCallback: true
		});
	}

	async validate(
		request: any,
		accessToken: string,
		refreshToken: string,
		profile,
		done: Function
	) {
		const role = passport['_strategies'].session.role_name;
		passport['_strategies'].session.role_name = '';
		const { emails, username } = profile;
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
