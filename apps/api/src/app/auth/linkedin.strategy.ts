import { Injectable } from '@angular/core';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt } from 'passport-jwt';
import { AuthService } from './auth.service';
import { environment as env } from '@env-api/environment';
import { Strategy } from 'passport-linkedin-oauth2';

@Injectable()
export class LinkedinStrategy extends PassportStrategy(Strategy, 'linkedin') {
	constructor(private readonly _authService: AuthService) {
		super({
			clientID: env.linkedinConfig.clientId,
			clientSecret: env.linkedinConfig.clientSecret,
			callbackURL: `${env.host}:${env.port}/api/auth/linkedin/callback`,
			scope: ['r_liteprofile', 'r_emailaddress'],
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
		const { emails } = profile;
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
	}
}
