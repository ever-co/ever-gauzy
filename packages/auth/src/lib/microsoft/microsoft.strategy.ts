import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { AxiosResponse } from 'axios';
import { Strategy, StrategyOptionsWithRequest } from 'passport-microsoft';
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
	async validate(
		accessToken: string,
		refreshToken: string,
		profile: any,
		done: (error: any, user: any, info?: any) => void
	): Promise<void> {
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
export const parseMicrosoftConfig = (configService: ConfigService): StrategyOptionsWithRequest => {
	const { clientId, clientSecret, callbackURL, authorizationURL, tokenURL } = {
		// Retrieve the Microsoft client ID from the configuration.
		clientId: configService.get<string>('microsoft.clientId'),
		// Retrieve the Microsoft client Secret from the configuration.
		clientSecret: configService.get<string>('microsoft.clientSecret'),
		// Retrieve the callback URL from the configuration.
		callbackURL: configService.get<string>('microsoft.callbackURL'),
		// Retrieve the authorization URL from the configuration.
		authorizationURL: configService.get<string>('microsoft.authorizationURL'),
		// Retrieve the token URL from the configuration.
		tokenURL: configService.get<string>('microsoft.tokenURL')
	};

	// Log a warning if any required configuration values are missing.
	if (!clientId || !clientSecret || !callbackURL) {
		console.warn('⚠️ Microsoft OAuth configuration is incomplete. Defaulting to "disabled".');
	}

	// Return the configuration object for Microsoft OAuth.
	return {
		// Use the retrieved clientID, or default to 'disabled' if not provided.
		clientID: clientId || 'disabled',
		// Use the retrieved clientSecret, or default to 'disabled' if not provided.
		clientSecret: clientSecret || 'disabled',
		// Use the retrieved callbackURL, or default to the API_BASE_URL (or localhost) plus the callback path.
		callbackURL:
			callbackURL || `${process.env.API_BASE_URL ?? 'http://localhost:3000'}/api/auth/microsoft/callback`,
		// Authorization URL for Microsoft OAuth.
		authorizationURL,
		// Token URL where Microsoft exchanges the authorization code for an access token.
		tokenURL,
		// Include the request object in the callback.
		passReqToCallback: true,
		// Specify the scope for Microsoft OAuth.
		scope: ['openid', 'profile', 'email', 'user.read']
	};
};
