import { Controller, Get, HttpException, HttpStatus, Logger, Query, UseGuards } from '@nestjs/common';
import { OctokitResponse, OctokitService } from '@gauzy/integration-github';
import { IGithubAppInstallInput, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, TenantPermissionGuard } from 'shared/guards';
import { Permissions } from 'shared/decorators';

@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.INTEGRATION_VIEW)
@Controller('installation')
export class GitHubIntegrationController {
    private readonly logger = new Logger('GitHubIntegrationController');

    constructor(
        private readonly _octokitService: OctokitService
    ) { }

    /**
     *
     * @param query
     * @param response
     */
    @Get('metadata')
    async getInstallationMetadata(
        @Query() query: IGithubAppInstallInput,
    ): Promise<OctokitResponse<any>> {
        try {
            const installationId = parseInt(query.installation_id);
            const metadata = await this._octokitService.getInstallationMetadata(installationId);
            console.log(metadata, 'Github Metadata');

            return metadata;
        } catch (error) {
            // Handle errors and return an appropriate error respons
            this.logger.error('Error while retrieve github installation metadata', error.message);
            throw new HttpException(`Error while retrieve github installation metadata: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
