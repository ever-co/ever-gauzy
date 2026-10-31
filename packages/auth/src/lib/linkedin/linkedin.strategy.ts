// cspell:ignore Headerfor
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt } from 'passport-jwt';
import { Strategy } from 'passport-linkedin-oauth2';
import { InternalOAuthError } from 'passport-oauth2';
import { environment } from '@gauzy/config';
import {
	LINKEDIN_OIDC_SCOPES,
	LINKEDIN_USERINFO_URL,
	LinkedinProfile,
	parseLinkedinUserInfo
} from './linkedin-userinfo';

/**
 * The calls this strategy makes on passport-oauth2's client (node-oauth's `OAuth2`), which passport-oauth2 lets
 * subclasses use to read the member's profile.
 */
interface OAuth2ProfileClient {
	useAuthorizationHeaderforGET(useIt: boolean): void;
	get(url: string, accessToken: string, callback: (error: unknown, body?: string | Buffer) => void): void;
}

@Injectable()
export class LinkedinStrategy extends PassportStrategy(Strategy, 'linkedin') {
	/** passport-oauth2's client for LinkedIn. */
	declare protected readonly _oauth2: OAuth2ProfileClient;

	constructor(protected readonly configService: ConfigService) {
		super(parseLinkedinConfig(configService));
		// The UserInfo endpoint takes the access token in the `Authorization: Bearer` header only.
		this._oauth2.useAuthorizationHeaderforGET(true);
	}

	/**
	 * Loads the member's profile from LinkedIn's OpenID Connect UserInfo endpoint.
	 *
	 * Replaces the loader of passport-linkedin-oauth2, which reads `/v2/me` and `/v2/emailAddress`: those need the
	 * retired `r_liteprofile` and `r_emailaddress` scopes, and their address carries no verified flag.
	 *
	 * @param accessToken - The access token LinkedIn issued for the `openid profile email` scopes.
	 * @param done - Receives the profile, or the error when LinkedIn cannot be reached or answers unexpectedly.
	 */
	userProfile(accessToken: string, done: (error: Error | null, profile?: LinkedinProfile) => void): void {
		this._oauth2.get(LINKEDIN_USERINFO_URL, accessToken, (error, body) => {
			if (error) {
				return done(new InternalOAuthError('Failed to fetch the LinkedIn user info', error));
			}

			let profile: LinkedinProfile;
			try {
				profile = parseLinkedinUserInfo(String(body));
			} catch (parseError) {
				return done(new InternalOAuthError('Failed to parse the LinkedIn user info', parseError));
			}
			done(null, profile);
		});
	}

	/**
	 * Validates the provided OAuth profile and constructs a simplified user object.
	 *
	 * The profile comes from {@link userProfile}: its address is flagged verified only when LinkedIn's UserInfo
	 * response says `email_verified: true`, and sign-in matches existing accounts through verified addresses only.
	 *
	 * @param _request - The incoming request object.
	 * @param accessToken - The OAuth access token.
	 * @param refreshToken - The OAuth refresh token.
	 * @param profile - The member's profile built from the UserInfo response.
	 *
	 * Passport contract (`@nestjs/passport`'s `PassportStrategy` mixin): the returned value is the user and a
	 * thrown error is the error; the mixin reports either one to passport's `done` exactly once, so this
	 * method never calls `done` itself (doing both reported every sign-in twice: a success, then a failure).
	 *
	 * @returns The user object built from the profile.
	 */
	async validate(_request: any, accessToken: string, refreshToken: string, profile: LinkedinProfile) {
		try {
			// Create a user object with the required properties.
			const user = {
				emails: profile?.emails ?? [],
				accessToken,
				refreshToken
			};

			// The returned user is what passport authenticates.
			return user;
		} catch (error) {
			// The thrown error is what passport reports as the authentication failure.
			console.error('Error during LinkedIn OAuth validation:', error);
			throw error;
		}
	}
}

/**
 * Parses the LinkedIn OAuth configuration using the provided ConfigService.
 *
 * Retrieves the LinkedIn client ID, client secret, callback URL, and other related settings
 * from the configuration. If any required configuration is missing, a warning is logged and default values are applied.
 *
 * @param configService - An instance of the ConfigService used to access application configuration.
 * @returns An object containing the LinkedIn OAuth configuration parameters.
 */
export const parseLinkedinConfig = (configService: ConfigService): Record<string, any> => {
	const { clientId, clientSecret, callbackURL } = {
		// Retrieve the LinkedIn client ID from the configuration.
		clientId: configService.get<string>('linkedin.clientId'),
		// Retrieve the LinkedIn client Secret from the configuration.
		clientSecret: configService.get<string>('linkedin.clientSecret'),
		// Retrieve the callback URL from the configuration.
		callbackURL: configService.get<string>('linkedin.callbackURL')
	};

	// Validate required LinkedIn configurations. Log a warning if any are missing.
	if (!clientId || !clientSecret || !callbackURL) {
		console.warn('⚠️ LinkedIn OAuth configuration is incomplete. Defaulting to "disabled".');
	}

	// Return the configuration object with defaults as needed.
	return {
		// Use the retrieved clientID, or default to 'disabled' if not provided.
		clientID: clientId || 'disabled',
		// Use the retrieved clientSecret, or default to 'disabled' if not provided.
		clientSecret: clientSecret || 'disabled',
		// Use the retrieved callbackURL, or default to a constructed URL based on API_BASE_URL.
		callbackURL: callbackURL || `${process.env.API_BASE_URL ?? 'http://localhost:3000'}/api/auth/linkedin/callback`,
		// Include the request object in the OAuth callback.
		passReqToCallback: true,
		// Sign In with LinkedIn using OpenID Connect: the member's id, name, picture, and address with its verified flag.
		scope: [...LINKEDIN_OIDC_SCOPES],
		// Use the JWT secret from the environment for LinkedIn OAuth.
		secretOrKey: environment.JWT_SECRET,
		// Define how to extract the JWT from the request's Authorization header.
		jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken()
	};
};
