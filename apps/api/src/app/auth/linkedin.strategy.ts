import { Injectable } from '@angular/core';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { AuthService } from './auth.service';
import { environment as env } from '@env-api/environment';
import passport from 'passport';

@Injectable()
export class LinkedinStrategy extends PassportStrategy(Strategy, 'linkedin') {
	constructor(private readonly _authService: AuthService) {
		super({
			clientID: env.linkedinConfig.clientId,
			clientSecret: env.linkedinConfig.clientSecret,
			callbackURL: `${env.host}:${env.port}/api/auth/linkedin/callback`,
			scope: ['r_emailaddress', 'r_liteprofile'],
			passReqToCallback: true,
			secretOrKey: env.JWT_SECRET,
			jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken()
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
