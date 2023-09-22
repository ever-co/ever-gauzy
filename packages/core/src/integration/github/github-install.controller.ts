
import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@gauzy/config';
import { IGithubAppInstallInput } from '@gauzy/contracts';
import { IGithubConfig, Public } from '@gauzy/common';

@Public()
@Controller()
export class GitHubPostInstallController {
    constructor(
        private readonly _config: ConfigService
    ) { }

    /**
     *
     * @param query
     * @param response
     */
    @Get('app-install')
    async appInstallCallback(
        @Query() query: IGithubAppInstallInput,
        @Res() response: Response
    ) {
        /** Github Config Options */
        const github = this._config.get<IGithubConfig>('github') as IGithubConfig;
        try {
            /**  */
            const urlParams = new URLSearchParams();
            urlParams.append('installation_id', query.installation_id);
            urlParams.append('setup_action', query.setup_action);
            urlParams.append('state', query.state);

            /** Redirected to the UI */
            return response.redirect(`${github.POST_INSTALL_URL}?${urlParams.toString()}`);
        } catch (error) {
            return response.redirect(`${github.POST_INSTALL_URL}`);
        }
    }
}
