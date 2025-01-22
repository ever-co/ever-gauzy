import { Controller, Get, HttpException, HttpStatus, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { IHubstaffConfig, Public, buildQueryString } from '@gauzy/utils';
import { ConfigService } from '@gauzy/config';
import { IntegrationEnum } from '@gauzy/contracts';

@ApiTags('Hubstaff Integrations')
@Public()
@Controller('/integration/hubstaff')
export class HubstaffAuthorizationController {
	constructor(private readonly _config: ConfigService) {}

	/**
	 * Handle the callback from the Hubstaff integration.
	 *
	 * @param {any} query - The query parameters from the callback.
	 * @param {Response} response - Express Response object.
	 */
	@Get('/callback')
	async hubstaffIntegrationCallback(@Query() query: any, @Res() response: Response) {
		try {
			// Validate the input data (You can use class-validator for validation)
			if (!query || !query.code || !query.state) {
				throw new HttpException('Invalid query parameters', HttpStatus.BAD_REQUEST);
			}

			/** Hubstaff Config Options */
			const hubstaff = this._config.get<IHubstaffConfig>('hubstaff') as IHubstaffConfig;

			// Convert query params object to string
			const queryParamsString = buildQueryString({
				code: query.code,
				state: query.state
			});

			// Combine hubstaff post install URL with query params
			const url = [hubstaff.postInstallUrl, queryParamsString].filter(Boolean).join('?');

			/** Redirect to the URL */
			return response.redirect(url);
		} catch (error) {
			// Handle errors and return an appropriate error response
			throw new HttpException(
				`Failed to add ${IntegrationEnum.HUBSTAFF} integration: ${error.message}`,
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}
}
