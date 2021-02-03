import { IApiServerOptions } from '@gauzy/common';
import { ConfigService, IEnvironment } from '@gauzy/config';
import { Injectable } from '@nestjs/common';
import { get, post, Response } from 'request';

@Injectable()
export class SocialAuthService {
	protected readonly configService: ConfigService;

	constructor() {
		this.configService = new ConfigService();
	}

	async requestFacebookRedirectUri(): Promise<{ redirectUri: string }> {
		const {
			clientId,
			oauthRedirectUri,
			state,
			loginDialogUri
		} = this.configService.get(
			'facebookConfig'
		) as IEnvironment['facebookConfig'];

		const queryParams: string[] = [
			`client_id=${clientId}`,
			`redirect_uri=${oauthRedirectUri}`,
			`state=${state}`
		];

		const redirectUri = `${loginDialogUri}?${queryParams.join('&')}`;
		return { redirectUri };
	}

	async facebookSignIn(code: string, responseRedirectUse: any): Promise<any> {
		const {
			clientId,
			oauthRedirectUri,
			clientSecret,
			accessTokenUri
		} = this.configService.get(
			'facebookConfig'
		) as IEnvironment['facebookConfig'];

		const queryParams: string[] = [
			`client_id=${clientId}`,
			`redirect_uri=${oauthRedirectUri}`,
			`client_secret=${clientSecret}`,
			`code=${code}`
		];

		const uri = `${accessTokenUri}?${queryParams.join('&')}`;
		get(uri, (error: Error, res: Response, body: any) => {
			if (error) {
				console.error(error);
				throw error;
			} else if (body.error) {
				console.error(body.error);
				throw body.error;
			}

			const { access_token } = JSON.parse(body);
			const { baseUrl } = this.configService
				.apiConfigOptions as IApiServerOptions;

			post(
				{
					url: `${baseUrl}/api/auth/facebook/token`,
					headers: {
						'Content-Type': 'application/x-www-form-urlencoded'
					},
					form: { access_token }
				},
				async (innerError: Error) => {
					if (innerError) {
						console.error(innerError);
						throw innerError;
					} else if (body.error) {
						console.error(body.error);
						throw body.error;
					}

					const redirectSuccessUrl = body.replace(
						'Found. Redirecting to ',
						''
					);
					return responseRedirectUse.redirect(redirectSuccessUrl);
				}
			);
		});
	}
}
