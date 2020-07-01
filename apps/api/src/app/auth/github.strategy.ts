import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-google-oauth20';
import { environment as env } from '@env-api/environment';
import passport from 'passport';
import { AuthService } from './auth.service';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
	constructor(private readonly _authService: AuthService) {
		super({
			clientID: env.githunConfig.clientId,
			callbackURL: `${env.host}:${env.port}/api/auth/github/callback`,
			clientSecret: env.githunConfig.clientSecret,
			scope: ['profile', 'email'],
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
