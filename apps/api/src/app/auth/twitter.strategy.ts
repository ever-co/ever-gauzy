import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import passport from 'passport';
import { AuthService } from './auth.service';
import { environment as env } from '@env-api/environment';

@Injectable()
export class TwitterStrategy extends PassportStrategy(Strategy, 'twitter') {
	constructor(private readonly _authService: AuthService) {
		super({
			clientID: env.twitterConfig.clientId,
			clientSecret: env.twitterConfig.clientSecret,
			callbackURL: `${env.host}:${env.port}/api/auth/twitter/callback`,
			scope: ['profile', 'manage_pages'],
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
