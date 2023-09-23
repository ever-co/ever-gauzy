import { Controller, Get, HttpException, HttpStatus, Logger, Param, Query, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { OctokitResponse, OctokitService } from '@gauzy/integration-github';
import { PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, TenantPermissionGuard } from 'shared/guards';
import { Permissions } from 'shared/decorators';
import { TenantOrganizationBaseDTO } from 'core/dto';

@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.INTEGRATION_VIEW)
@Controller()
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

    @Get(':installation_id/metadata')
    @UsePipes(new ValidationPipe({ transform: true }))
    async getInstallationMetadata(
        @Param('installation_id') installation_id: number,
        @Query() query: TenantOrganizationBaseDTO,
    ): Promise<OctokitResponse<any>> {
        try {
            // Validate the input data (You can use class-validator for validation)
            if (!query || !query.organizationId) {
                throw new HttpException('Invalid installation query parameter', HttpStatus.BAD_REQUEST);
            }
            // Get installation metadata
            const metadata = await this._octokitService.getInstallationMetadata(installation_id);
            return metadata.data;
        } catch (error) {
            // Handle errors and return an appropriate error respons
            this.logger.error('Error while retrieve github installation metadata', error.message);
            throw new HttpException(`Error while retrieve github installation metadata: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
