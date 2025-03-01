import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AxiosResponse } from 'axios';
import { Strategy, VerifyCallback } from 'passport-oauth2';
import { firstValueFrom, map } from 'rxjs';

@Injectable()
export class MicrosoftStrategy extends PassportStrategy(Strategy, 'microsoft') {
	constructor(protected readonly configService: ConfigService, private readonly _httpService: HttpService) {
		super(parseMicrosoftConfig(configService));
	}

	/**
	 * Validates the provided tokens and retrieves the user's profile information
	 * from the Microsoft Graph API.
	 *
	 * @param accessToken - The access token for Microsoft Graph API.
	 * @param refreshToken - The refresh token (unused in this example).
	 * @param profile - The initial profile information (may be overwritten).
	 * @param done - The callback to pass either the error or the user object.
	 */
	async validated(accessToken: string, refreshToken: string, profile: any, done: VerifyCallback): Promise<void> {
		try {
			const url = `${this.configService.get<string>('microsoft.graphApiURL')}/me`;

			profile = await firstValueFrom(
				this._httpService
					.get(url, { headers: { Authorization: `Bearer ${accessToken}` } })
					.pipe(map((response: AxiosResponse<any>) => response.data))
			);

			const { userPrincipalName, displayName } = profile;
			const emails = [{ value: userPrincipalName, verified: Boolean(userPrincipalName) }];

			/** Create the user object to pass to the done callback */
			const user = {
				emails,
				displayName,
				accessToken,
				refreshToken
			};

			done(null, user);
		} catch (error) {
			done(error, false);
		}
	}
}

/**
 * Parses the Microsoft OAuth configuration using the provided ConfigService.
 *
 * Retrieves the Microsoft OAuth client ID, client secret, callback URL,
 * authorization URL, and token URL from the configuration service.
 * If any required configuration values are missing, a warning is logged and default values are applied.
 *
 * @param configService - An instance of ConfigService to access configuration values.
 * @returns An object containing the Microsoft OAuth configuration parameters.
 */
export const parseMicrosoftConfig = (configService: ConfigService): Record<string, any> => {
	// Retrieve Microsoft OAuth client ID from the configuration service; default to 'disabled' if not found.
	const clientID = configService.get<string>('microsoft.clientId');
	// Retrieve Microsoft OAuth client secret from the configuration service; default to 'disabled' if not found.
	const clientSecret = configService.get<string>('microsoft.clientSecret');
	// Retrieve Microsoft OAuth callback URL from the configuration service.
	const callbackURL = configService.get<string>('microsoft.callbackURL');

	// Log a warning if any required configuration values are missing.
	if (!clientID || !clientSecret || !callbackURL) {
		console.warn('⚠️ Microsoft OAuth configuration is incomplete. Defaulting to "disabled".');
	}

	// Retrieve the authorization URL and token URL from the configuration service.
	const authorizationURL = configService.get<string>('microsoft.authorizationURL');
	const tokenURL = configService.get<string>('microsoft.tokenURL');

	// Return the configuration object for Microsoft OAuth.
	return {
		// Authorization URL for Microsoft OAuth.
		authorizationURL,
		// Token URL where Microsoft exchanges the authorization code for an access token.
		tokenURL,
		// Use the retrieved clientID, or default to 'disabled' if not provided.
		clientID: clientID || 'disabled',
		// Use the retrieved clientSecret, or default to 'disabled' if not provided.
		clientSecret: clientSecret || 'disabled',
		// Use the retrieved callbackURL, or default to the API_BASE_URL (or localhost) plus the callback path.
		callbackURL:
			callbackURL || `${process.env.API_BASE_URL ?? 'http://localhost:3000'}/api/auth/microsoft/callback`,
		// Include the request object in the callback.
		passReqToCallback: true,
		// Specify the scope for Microsoft OAuth.
		scope: ['openid', 'profile', 'email', 'User.Read']
	};
};
