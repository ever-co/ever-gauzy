import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt } from 'passport-jwt';
import { Strategy } from 'passport-oauth2';
import { environment } from '@gauzy/config';

@Injectable()
export class MicrosoftStrategy extends PassportStrategy(Strategy, 'microsoft') {
	constructor(protected readonly configService: ConfigService) {
		super(config(configService));
	}

	/**
	 *
	 * @param accessToken
	 * @param refresh_token
	 * @param params
	 * @param profile
	 * @param done
	 */
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

/**
 * Creates a configuration object for Microsoft OAuth based on the provided ConfigService.
 *
 * @param configService - An instance of the ConfigService to retrieve configuration values.
 * @returns An object containing Microsoft OAuth configuration.
 */
export const config = (configService: ConfigService) => ({
	/** Use appropriate configuration keys for authorization and token URLs */
	authorizationURL: <string>configService.get<string>('microsoft.authorizationURL'),

	/** The URL where Microsoft will exchange the authorization code for an access token. */
	tokenURL: <string>configService.get<string>('microsoft.tokenURL'),

	/** Retrieve Microsoft OAuth client ID from the configuration service, default to 'disabled' if not found. */
	clientID: <string>configService.get<string>('microsoft.clientId') || 'disabled',

	/** Retrieve Microsoft OAuth client secret from the configuration service, default to 'disabled' if not found. */
	clientSecret: <string>configService.get<string>('microsoft.clientSecret') || 'disabled',

	/** Retrieve Microsoft OAuth callback URL from the configuration service. */
	callbackURL: <string>configService.get<string>('microsoft.callbackURL'),

	// Pass the request object to the callback.
	passReqToCallback: true,

	/** Specify the scope for Microsoft OAuth (read user data). */
	scope: ['User.Read'],

	// JWT secret for LinkedIn OAuth.
	secretOrKey: environment.JWT_SECRET,

	// Extract JWT from the request's Authorization header as a bearer token.
	jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken()
});
