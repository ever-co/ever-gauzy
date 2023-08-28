import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@gauzy/config';
import { Public } from '@gauzy/common';

@ApiTags('Hubstaff Integrations')
@Controller()
export class HubstaffAuthorizationController {
    constructor(
        private readonly _config: ConfigService
    ) { }

    /**
     * Hubstaff Integration Authorization Flow Callback
     *
     * @param code
     * @param state
     * @param res
     * @returns
     */
    @Public()
    @Get('callback')
    async hubstaffCallback(
        @Query('code') code: string,
        @Query('state') state: string,
        @Res() res: any
    ) {
        try {
            if (code) {
                return res.redirect(`${this._config.get('clientBaseUrl')}/#/pages/integrations/hubstaff?code=${code}&state=${state}`);
            }
            return res.redirect(`${this._config.get('clientBaseUrl')}/#/pages/integrations/hubstaff`);
        } catch (error) {
            return res.redirect(`${this._config.get('clientBaseUrl')}/#/pages/integrations/hubstaff`);
        }
    }
}
