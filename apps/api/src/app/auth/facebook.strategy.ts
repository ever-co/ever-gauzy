import { Injectable } from '@nestjs/common';
import { use } from 'passport';
import { environment as env } from '@env-api/environment';
import { Provider, AuthService } from './auth.service';
import { RoleService } from '../role/role.service';
import { User, RolesEnum } from '@gauzy/models';

const FacebookTokenStrategy = require('passport-facebook-token');

@Injectable()
export class FacebookStrategy {
	constructor(
		private readonly _authService: AuthService,
		private readonly _roleService: RoleService
	) {
		this.init();
	}

	private init(): void {
		const { clientId, clientSecret, oauthRedirectUri } = env.facebookConfig;
		use(
			'facebook',
			new FacebookTokenStrategy(
				{
					clientID: clientId,
					clientSecret: clientSecret,
					callbackURL: oauthRedirectUri,
					profileFields: ['email']
				},
				async (
					accessToken: string,
					refreshToken: string,
					profile: any,
					done: Function
				) => {
					const { emails } = profile;

					try {
						const {
							success,
							authData
						} = await this._authService.validateOAuthLoginEmail(
							emails
						);

						const user = { success, authData };

						done(null, user);
					} catch (err) {
						done(err, false);
					}
				}
			)
		);
	}
}
