import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-google-oauth20';
import { AuthService } from './auth.service';
import { RoleService } from '../role';
import { environment as env } from '@env-api/environment';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
	constructor(
		private readonly _authService: AuthService,
		private readonly _roleService: RoleService
	) {
		super({
			clientID: env.googleConfig.clientId,
			clientSecret: env.googleConfig.clientSecret,
			callbackURL: `${env.host}:${env.port}/api/auth/google/callback`,
			passReqToCallback: true,
			scope: ['profile', 'email']
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
