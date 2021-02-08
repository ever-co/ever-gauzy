import { IApiServerOptions } from '@gauzy/common';
import { ConfigService, IEnvironment } from '@gauzy/config';
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-facebook';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
	constructor(private readonly configService: ConfigService) {
		super(config(configService));
	}

	async validate(
		accessToken: string,
		refreshToken: string,
		profile: Profile,
		done: (err: any, user: any, info?: any) => void
	): Promise<any> {
		try {
			const { emails } = profile;
			const user = {
				emails,
				accessToken
			};
			done(null, user);
		} catch (err) {
			done(err, false);
		}
	}
}

export const config = (configService: ConfigService) => {
	const FACEBOOK_CONFIG = configService.get(
		'facebookConfig'
	) as IEnvironment['facebookConfig'];
	const { baseUrl } = configService.apiConfigOptions as IApiServerOptions;

	return {
		clientID: FACEBOOK_CONFIG.clientId || 'disabled',
		clientSecret: FACEBOOK_CONFIG.clientSecret || 'disabled',
		callbackURL:
			FACEBOOK_CONFIG.oauthRedirectUri ||
			`${baseUrl}/api/auth/google/callback`,
		scope: 'email',
		profileFields: ['emails', 'name']
	};
};
