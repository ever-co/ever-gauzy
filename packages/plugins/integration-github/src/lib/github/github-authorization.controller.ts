import { Controller, Get, HttpException, HttpStatus, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { IGithubIntegrationConfig, Public } from '@gauzy/common';
import { ConfigService } from '@gauzy/config';
import { IGithubAppInstallInput } from '@gauzy/contracts';

@Controller('/integration/github')
export class GitHubAuthorizationController {
	constructor(private readonly _config: ConfigService) {}

	/**
	 *
	 * @param query
	 * @param response
	 */
	@Public()
	@Get('/callback')
	async githubIntegrationPostInstallCallback(@Query() query: IGithubAppInstallInput, @Res() response: Response) {
		try {
			// Validate the input data (You can use class-validator for validation)
			if (!query || !query.installation_id || !query.setup_action || !query.state) {
				throw new HttpException('Invalid github callback query data', HttpStatus.BAD_REQUEST);
			}

			/** Github Config Options */
			const { postInstallUrl } = this._config.get<IGithubIntegrationConfig>('github') as IGithubIntegrationConfig;

			/** Construct the redirect URL with query parameters */
			const urlParams = new URLSearchParams();
			urlParams.append('installation_id', query.installation_id);
			urlParams.append('setup_action', query.setup_action);

			/** Redirect to the URL */
			if (query.state.startsWith('http')) {
				return response.redirect(`${query.state}?${urlParams.toString()}`);
			} else {
				return response.redirect(`${postInstallUrl}?${urlParams.toString()}`);
			}
		} catch (error) {
			// Handle errors and return an appropriate error response
			throw new HttpException(
				`Failed to add GitHub installation: ${error.message}`,
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}
}
