import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService, IEnvironment } from '@gauzy/config';
import { ExtractJwt } from 'passport-jwt';
import { Strategy } from 'passport-twitter';
import { IApiServerOptions } from '@gauzy/common';

@Injectable()
export class TwitterStrategy extends PassportStrategy(Strategy, 'twitter') {
	constructor(private readonly configService: ConfigService) {
		super(config(configService));
	}

	async validate(
		request: any,
		accessToken: string,
		refreshToken: string,
		profile: any,
		done: (err: any, user: any, info?: any) => void
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
	const TWITTER_CONFIG = configService.get(
		'twitterConfig'
	) as IEnvironment['twitterConfig'];
	const { baseUrl } = configService.apiConfigOptions as IApiServerOptions;
	const JWT_SECRET = configService.get('JWT_SECRET') as string | number;

	return {
		consumerKey: TWITTER_CONFIG.clientId || 'disabled',
		consumerSecret: TWITTER_CONFIG.clientSecret || 'disabled',
		callbackURL:
			TWITTER_CONFIG.callbackUrl ||
			`${baseUrl}/api/auth/twitter/callback`,
		passReqToCallback: true,
		includeEmail: true,
		secretOrKey: JWT_SECRET,
		jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken()
	};
};
