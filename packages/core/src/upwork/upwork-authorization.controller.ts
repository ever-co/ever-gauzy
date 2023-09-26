import { Controller, Get, HttpException, HttpStatus, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ConfigService } from '@gauzy/config';
import { IUpworkConfig, Public } from '@gauzy/common';
import { IntegrationEnum } from '@gauzy/contracts';

@ApiTags('Upwork Integrations')
@Public()
@Controller()
export class UpworkAuthorizationController {

    constructor(
        private readonly _config: ConfigService
    ) { }

    /**
    * Handle the callback from the Upwork integration.
    *
    * @param {any} query - The query parameters from the callback.
    * @param {Response} response - Express Response object.
    */
    @Get('callback')
    async upworkIntegrationCallback(
        @Query() query: any,
        @Res() response: Response
    ) {
        try {
            // Validate the input data (You can use class-validator for validation)
            if (!query || !query.oauth_token || !query.oauth_verifier) {
                throw new HttpException('Invalid query parameters', HttpStatus.BAD_REQUEST);
            }

            /** Upwork Config Options */
            const upwork = this._config.get<IUpworkConfig>('upwork') as IUpworkConfig;

            /** Construct the redirect URL with query parameters */
            const urlParams = new URLSearchParams();
            urlParams.append('oauth_token', query.oauth_token);
            urlParams.append('oauth_verifier', query.oauth_verifier);

            /** Redirect to the URL */
            return response.redirect(`${upwork.postInstallUrl}?${urlParams.toString()}`);
        } catch (error) {
            // Handle errors and return an appropriate error response
            throw new HttpException(`Failed to add ${IntegrationEnum.UPWORK} integration: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
