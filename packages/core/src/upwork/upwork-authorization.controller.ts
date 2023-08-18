import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@gauzy/config';
import { Public } from '@gauzy/common';

@ApiTags('Upwork Integrations')
@Controller()
export class UpworkAuthorizationController {

    constructor(
        private readonly _config: ConfigService
    ) { }

    /**
     * Upwork Integration Authorization Flow Callback
     *
     * @param oauth_token
     * @param oauth_verifier
     * @param res
     * @returns
     */
    @Public()
    @Get('callback')
    async upworkCallback(
        @Query('oauth_token') oauth_token: string,
        @Query('oauth_verifier') oauth_verifier: string,
        @Res() res: any
    ) {
        try {
            if (oauth_token && oauth_verifier) {
                return res.redirect(`${this._config.get('clientBaseUrl')}/#/pages/integrations/upwork?oauth_token=${oauth_token}&oauth_verifier=${oauth_verifier}`);
            }
            return res.redirect(`${this._config.get('clientBaseUrl')}/#/pages/integrations/upwork`);
        } catch (error) {
            return res.redirect(`${this._config.get('clientBaseUrl')}/#/pages/integrations/upwork`);
        }
    }
}
