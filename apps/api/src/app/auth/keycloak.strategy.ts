import { environment as env } from '@env-api/environment';
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-google-oauth20';
import { AuthService } from './auth.service';

@Injectable()
export class KeycloakStrategy extends PassportStrategy(Strategy, 'keycloak') {
	constructor(private readonly _authService: AuthService) {
		super({
			realm: env.keycloakConfig.realm,
			clientID: env.keycloakConfig.clientId,
			clientSecret: env.keycloakConfig.secret,
			authServerUrl: env.keycloakConfig.authServerUrl,
			cookieKey: env.keycloakConfig.cookieKey
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
