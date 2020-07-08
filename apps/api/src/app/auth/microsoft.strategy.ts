import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { AuthService } from './auth.service';
import { environment as env } from '@env-api/environment';
import passport from 'passport';

@Injectable()
export class MicrosoftStrategy extends PassportStrategy(Strategy, 'microsoft') {
	constructor(private readonly _authService: AuthService) {
		super({
			clientID: env.microsoftConfig.clientId || 'disabled',
			clientSecret: env.microsoftConfig.clientSecret || 'disabled',
			callbackURL: `${env.host}:${env.port}/api/auth/microsoft/callback`,
			scope: ['profile', 'offline_access'],
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
