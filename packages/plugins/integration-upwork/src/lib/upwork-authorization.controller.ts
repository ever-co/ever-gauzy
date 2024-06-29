import { Controller, Get, HttpException, HttpStatus, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ConfigService } from '@gauzy/config';
import { IntegrationEnum } from '@gauzy/contracts';
import { IUpworkConfig, Public, createQueryParamsString } from '@gauzy/common';

@ApiTags('Upwork Integrations')
@Public()
@Controller('/integrations/upwork')
export class UpworkAuthorizationController {
	constructor(private readonly _config: ConfigService) {}

	/**
	 * Handle the callback from the Upwork integration.
	 *
	 * @param {any} query - The query parameters from the callback.
	 * @param {Response} response - Express Response object.
	 */
	@Get('callback')
	async upworkIntegrationCallback(@Query() query: any, @Res() response: Response) {
		try {
			// Validate the input data (You can use class-validator for validation)
			if (!query || !query.oauth_token || !query.oauth_verifier) {
				throw new HttpException('Invalid query parameters', HttpStatus.BAD_REQUEST);
			}

			/** Upwork Config Options */
			const upwork = this._config.get<IUpworkConfig>('upwork') as IUpworkConfig;

			// Convert query params object to string
			const queryParamsString = createQueryParamsString({
				oauth_token: query.oauth_token,
				oauth_verifier: query.oauth_verifier
			});

			// Combine upwork post install URL with query params
			const url = [upwork.postInstallUrl, queryParamsString].filter(Boolean).join('?');

			/** Redirect to the URL */
			return response.redirect(url);
		} catch (error) {
			// Handle errors and return an appropriate error response
			throw new HttpException(
				`Failed to add ${IntegrationEnum.UPWORK} integration: ${error.message}`,
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}
}
