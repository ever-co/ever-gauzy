import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt } from 'passport-jwt';
import { ConfigService, IEnvironment } from '@gauzy/config';
import { Strategy } from 'passport-linkedin-oauth2';
import { IApiServerOptions } from '@gauzy/common';

@Injectable()
export class LinkedinStrategy extends PassportStrategy(Strategy, 'linkedin') {
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
	const LINKEDIN_CONFIG = configService.get(
		'linkedinConfig'
	) as IEnvironment['linkedinConfig'];
	const { baseUrl } = configService.apiConfigOptions as IApiServerOptions;
	const JWT_SECRET = configService.get('JWT_SECRET') as string | number;

	return {
		clientID: LINKEDIN_CONFIG.clientId || 'disabled',
		clientSecret: LINKEDIN_CONFIG.clientSecret || 'disabled',
		callbackURL:
			LINKEDIN_CONFIG.callbackUrl ||
			`${baseUrl}/api/auth/linkedin/callback`,
		scope: ['r_liteprofile', 'r_emailaddress'],
		passReqToCallback: true,
		secretOrKey: JWT_SECRET,
		jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken()
	};
};
