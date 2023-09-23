import { Controller, Get, HttpException, HttpStatus, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@gauzy/config';
import { IGithubAppInstallInput } from '@gauzy/contracts';
import { IGithubConfig, Public } from '@gauzy/common';

@Public()
@Controller()
export class GitHubAuthorizationController {
    constructor(
        private readonly _config: ConfigService
    ) { }

    /**
     *
     * @param query
     * @param response
     */
    @Get('callback')
    async githubIntegrationPostInstallCallback(
        @Query() query: IGithubAppInstallInput,
        @Res() response: Response
    ) {
        try {
            // Validate the input data (You can use class-validator for validation)
            if (!query || !query.installation_id || !query.setup_action || !query.state) {
                throw new HttpException('Invalid installation query data', HttpStatus.BAD_REQUEST);
            }

            /** Github Config Options */
            const github = this._config.get<IGithubConfig>('github') as IGithubConfig;

            /** Construct the redirect URL with query parameters */
            const urlParams = new URLSearchParams();
            urlParams.append('installation_id', query.installation_id);
            urlParams.append('setup_action', query.setup_action);
            urlParams.append('state', query.state);

            /** Redirect to the URL */
            return response.redirect(`${github.POST_INSTALL_URL}?${urlParams.toString()}`);
        } catch (error) {
            // Handle errors and return an appropriate error response
            throw new HttpException(`Failed to add GitHub installation: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
