import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Strategy, VerifyCallback } from 'passport-oauth2';
import { firstValueFrom, map } from 'rxjs';
import { AxiosResponse } from 'axios';

@Injectable()
export class MicrosoftStrategy extends PassportStrategy(Strategy, 'microsoft') {
	constructor(
		protected readonly configService: ConfigService,
		private readonly _httpService: HttpService
	) {
		super(config(configService));
	}

	/**
	 *
	 * @param accessToken
	 * @param refreshToken
	 * @param profile
	 * @param done
	 */
	async validate(
		accessToken: string,
		refreshToken: string,
		profile: any,
		done: VerifyCallback,
	) {
		try {
			/** Options for making a request to the Graph API using @nestjs/axios. */
			const options = {
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			};

			/**
			 *
			 */
			const url = <string>this.configService.get<string>('microsoft.graphApiURL') + '/me';

			/**
			* Make a request to the Microsoft Graph API to get user profile information.
			* Adjust the GraphAPI URL according to your requirements.
			*/
			profile = await firstValueFrom(
				this._httpService.get(url, options).pipe(
					map((response: AxiosResponse<any, any>) => response.data)
				)
			);

			/** Extract the userPrincipalName from the profile and create an emails array. */
			const emails = [
				{ value: profile.userPrincipalName, verified: !!profile.userPrincipalName }
			];

			/** Extract displayName from the profile. */
			const displayName = profile.displayName;

			/** Create the user object to pass to the done callback */
			const user = {
				emails,
				displayName,
				accessToken,
			};

			/** Call the done callback with the user object. */
			done(null, user);
		} catch (err) {
			/** Call the done callback with the error if any. */
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

	/** */
	scope: ['openid', 'profile', 'email', "User.Read"],
});
