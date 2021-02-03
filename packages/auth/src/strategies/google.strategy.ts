import { ConfigService, IEnvironment } from '@gauzy/config';
import { IApiServerOptions } from '@gauzy/common';
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
	constructor(private readonly configService: ConfigService) {
		super(config(configService));
	}

	async validate(
		request: any,
		accessToken: string,
		refreshToken: string,
		profile: any,
		done: VerifyCallback
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
	const GOOGLE_CONFIG = configService.get(
		'googleConfig'
	) as IEnvironment['googleConfig'];
	const { baseUrl } = configService.apiConfigOptions as IApiServerOptions;

	return {
		clientID: GOOGLE_CONFIG.clientId || 'disabled',
		clientSecret: GOOGLE_CONFIG.clientSecret || 'disabled',
		callbackURL: `${baseUrl}/api/auth/google/callback`,
		passReqToCallback: true,
		scope: ['email', 'profile']
	};
};
