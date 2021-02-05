import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService, IEnvironment } from '@gauzy/config';
import { Strategy } from 'passport-azure-ad-oauth2';
import { IApiServerOptions } from '@gauzy/common';

@Injectable()
export class MicrosoftStrategy extends PassportStrategy(Strategy, 'microsoft') {
	constructor(private readonly configService: ConfigService) {
		super(config(configService));
	}

	async validate(
		accessToken,
		refresh_token,
		params,
		profile,
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
	const MICROSOFT_CONFIG = configService.get(
		'microsoftConfig'
	) as IEnvironment['microsoftConfig'];
	const { baseUrl } = configService.apiConfigOptions as IApiServerOptions;

	return {
		clientID: MICROSOFT_CONFIG.clientId || 'disabled',
		clientSecret: MICROSOFT_CONFIG.clientSecret || 'disabled',
		resource: MICROSOFT_CONFIG.resource || 'disabled',
		tenant: MICROSOFT_CONFIG.tenant || 'disabled',
		useCommonEndpoint: false,
		callbackURL:
			MICROSOFT_CONFIG.callbackUrl ||
			`${baseUrl}/api/auth/microsoft/callback`
	};
};
