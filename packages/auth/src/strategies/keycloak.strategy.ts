import { ConfigService, environment as env, IEnvironment } from '@gauzy/config';
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-google-oauth20';

@Injectable()
export class KeycloakStrategy extends PassportStrategy(Strategy, 'keycloak') {
	constructor(private readonly configService: ConfigService) {
		super(config(configService));
	}

	async validate(
		request: any,
		accessToken: string,
		refreshToken: string,
		profile,
		done: Function
	) {
		try {
			const { name, emails, photos } = profile;
			const [picture] = photos;

			const user = {
				emails,
				firstName: name.givenName,
				lastName: name.familyName,
				picture: picture,
				accessToken
			};
			done(null, user);
		} catch (err) {
			done(err, false);
		}
	}
}

export const config = (configService: ConfigService) => {
	const KEYCLOAK_CONFIG = configService.get(
		'keycloakConfig'
	) as IEnvironment['keycloakConfig'];
	return {
		clientID: KEYCLOAK_CONFIG.clientId || 'disabled',
		clientSecret: KEYCLOAK_CONFIG.secret || 'disabled',
		realm: KEYCLOAK_CONFIG.realm,
		authServerUrl: KEYCLOAK_CONFIG.authServerUrl,
		cookieKey: KEYCLOAK_CONFIG.cookieKey
	};
};
