import { Controller, Get, HttpException, HttpStatus, Logger, Param, Query, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { OctokitResponse, OctokitService } from '@gauzy/integration-github';
import { IGithubRepositoryResponse, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, TenantPermissionGuard } from 'shared/guards';
import { Permissions } from 'shared/decorators';
import { TenantOrganizationBaseDTO } from 'core/dto';

@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.INTEGRATION_VIEW)
@Controller(':installation_id')
export class GitHubIntegrationController {
    private readonly logger = new Logger('GitHubIntegrationController');

    constructor(
        private readonly _octokitService: OctokitService
    ) { }

    /**
     * Retrieve installation metadata for a GitHub App installation.
     *
     * @param installation_id The installation ID for the GitHub App.
     * @param organizationId The organization ID to query for metadata.
     * @returns {Promise<OctokitResponse<any>>} A promise that resolves with the installation metadata.
     * @throws {HttpException} If the query parameters are invalid or an error occurs during retrieval.
     */
    @Get('/metadata')
    @UsePipes(new ValidationPipe({ transform: true }))
    async getGithubInstallationMetadata(
        @Param('installation_id') installation_id: number,
        @Query() query: TenantOrganizationBaseDTO,
    ): Promise<OctokitResponse<any>> {
        try {
            // Validate the input data (You can use class-validator for validation)
            if (!query || !query.organizationId) {
                throw new HttpException('Invalid query parameter', HttpStatus.BAD_REQUEST);
            }
            // Get installation metadata
            const metadata = await this._octokitService.getGithubInstallationMetadata(installation_id);
            return metadata.data;
        } catch (error) {
            // Handle errors and return an appropriate error respons
            this.logger.error('Error while retrieve github installation metadata', error.message);
            throw new HttpException(`Error while retrieve github installation metadata: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Get GitHub repositories for a specific installation.
     *
     * @param {number} installation_id - The installation ID for the GitHub App.
     * @param {TenantOrganizationBaseDTO} query - Query parameters, including organizationId.
     * @returns {Promise<OctokitResponse<any>>} A promise that resolves with the GitHub repositories.
     * @throws {HttpException} If the query parameters are invalid or if there's an error retrieving the repositories.
     */
    @Get('/repositories')
    @UsePipes(new ValidationPipe({ transform: true }))
    async getGithubRepositories(
        @Param('installation_id') installation_id: number,
        @Query() query: TenantOrganizationBaseDTO,
    ): Promise<OctokitResponse<IGithubRepositoryResponse>> {
        try {
            // Validate the input data (You can use class-validator for validation)
            if (!query || !query.organizationId) {
                throw new HttpException('Invalid query parameter', HttpStatus.BAD_REQUEST);
            }
            // Get installation repositories
            const repositories = await this._octokitService.getGithubRepositories(installation_id);
            return repositories.data;
        } catch (error) {
            // Handle errors and return an appropriate error respons
            this.logger.error('Error while retrieving GitHub installation repositories', error.message);
            throw new HttpException(`Error while retrieving GitHub installation repositories: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
