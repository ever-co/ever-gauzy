import { Controller, Get, HttpException, HttpStatus, Logger, Param, Query, Req, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { Request } from 'express';
import { OctokitResponse, OctokitService } from '@gauzy/integration-github';
import { IGithubIssue, IGithubRepositoryResponse, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, TenantPermissionGuard } from 'shared/guards';
import { Permissions } from 'shared/decorators';
import { TenantOrganizationBaseDTO } from 'core/dto';

@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.INTEGRATION_VIEW)
@Controller(':integrationId')
export class GitHubIntegrationController {
    private readonly logger = new Logger('GitHubIntegrationController');

    constructor(
        private readonly _octokitService: OctokitService
    ) { }

    /**
     * Get GitHub installation metadata for a specific integration.
     *
     * This endpoint allows you to retrieve metadata associated with a GitHub installation for a given integration.
     *
     * @param {Request} request - The HTTP request object.
     * @param {TenantOrganizationBaseDTO} query - Query parameters, including organizationId.
     * @returns {Promise<OctokitResponse<any> | void>} A promise that resolves with the GitHub installation metadata.
     * @throws {HttpException} If the query parameters are invalid or if there's an error retrieving the metadata.
     */
    @Get('/metadata')
    @UsePipes(new ValidationPipe({ transform: true }))
    async getGithubInstallationMetadata(
        @Req() request: Request,
        @Query() query: TenantOrganizationBaseDTO,
    ): Promise<OctokitResponse<any> | void> {
        try {
            // Validate the input data (You can use class-validator for validation)
            if (!query || !query.organizationId) {
                throw new HttpException('Invalid query parameter', HttpStatus.BAD_REQUEST);
            }

            // Check if the request contains integration settings
            const settings = request['integration']?.settings;
            if (!settings || !settings.installation_id) {
                throw new HttpException('Invalid request parameter: Missing or unauthorized integration', HttpStatus.UNAUTHORIZED);
            }

            const installation_id = request['integration']['settings']['installation_id'];
            if (installation_id) {
                // Get installation metadata
                const metadata = await this._octokitService.getInstallationMetadata(installation_id);
                return metadata.data;
            }

            throw new HttpException('Invalid query parameter', HttpStatus.BAD_REQUEST);
        } catch (error) {
            // Handle errors and return an appropriate error response
            this.logger.error('Error while retrieve github installation metadata', error.message);
            throw new HttpException(`Error while retrieve github installation metadata: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Get GitHub repositories associated with a specific GitHub App installation within a given organization.
     *
     * This endpoint allows you to retrieve a list of GitHub repositories associated with a GitHub App installation within a specific organization.
     *
     * @param {Request} request - The HTTP request object.
     * @param {TenantOrganizationBaseDTO} query - Query parameters containing organization information.
     * @returns {Promise<OctokitResponse<IGithubRepositoryResponse>>} A promise that resolves with the GitHub repositories.
     * @throws {HttpException} If the query parameters are invalid or if there's an error retrieving the repositories.
     */
    @Get('/repositories')
    @UsePipes(new ValidationPipe({ transform: true }))
    async getGithubRepositories(
        @Req() request: Request,
        @Query() query: TenantOrganizationBaseDTO,
    ): Promise<OctokitResponse<IGithubRepositoryResponse> | void> {
        try {
            // Validate the input data (You can use class-validator for validation)
            if (!query || !query.organizationId) {
                throw new HttpException('Invalid query parameter', HttpStatus.BAD_REQUEST);
            }

            // Check if the request contains integration settings
            const settings = request['integration']?.settings;
            if (!settings || !settings.installation_id) {
                throw new HttpException('Invalid request parameter: Missing or unauthorized integration', HttpStatus.UNAUTHORIZED);
            }

            const installation_id = request['integration']['settings']['installation_id'];
            if (installation_id) {
                // Get installation repositories
                const repositories = await this._octokitService.getRepositories(installation_id);
                return repositories.data;
            }

            throw new HttpException('Invalid request parameter', HttpStatus.UNAUTHORIZED);
        } catch (error) {
            // Handle errors and return an appropriate error response
            this.logger.error('Error while retrieving GitHub installation repositories', error.message);
            throw new HttpException(`Error while retrieving GitHub installation repositories: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Get GitHub repository issues for a specific GitHub App installation within a given organization, owner, and repository.
     *
     * This endpoint allows you to retrieve issues associated with a GitHub repository for a GitHub App installation within a specific organization.
     *
     * @param {Request} request - The HTTP request object.
     * @param {TenantOrganizationBaseDTO} query - Query parameters containing organization information.
     * @param {string} owner - The owner (username or organization) of the repository.
     * @param {string} repo - The name of the repository.
     * @returns {Promise<OctokitResponse<IGithubIssue>>} A promise that resolves with the GitHub repository issues.
     * @throws {HttpException} If the query parameters are invalid or if there's an error retrieving the issues.
     */
    @Get('/:owner/:repo/issues')
    @UsePipes(new ValidationPipe({ transform: true }))
    async getGithubRepositoryIssues(
        @Req() request: Request,
        @Query() query: TenantOrganizationBaseDTO,
        @Param('owner') owner: string,
        @Param('repo') repo: string,
    ): Promise<OctokitResponse<IGithubIssue[]> | void> {
        try {
            // Validate the input data (You can use class-validator for validation)
            if (!query || !query.organizationId) {
                throw new HttpException('Invalid query parameter', HttpStatus.BAD_REQUEST);
            }

            // Check if the request contains integration settings
            const settings = request['integration']?.settings;
            if (!settings || !settings.installation_id) {
                throw new HttpException('Invalid request parameter: Missing or unauthorized integration', HttpStatus.UNAUTHORIZED);
            }

            const installation_id = request['integration']['settings']['installation_id'];
            if (installation_id) {
                // Get installation repositories
                const issues = await this._octokitService.getRepositoryIssues(installation_id, { owner, repo });
                return issues.data;
            }

            throw new HttpException('Invalid request parameter', HttpStatus.UNAUTHORIZED);
        } catch (error) {
            // Handle errors and return an appropriate error response
            this.logger.error('Error while retrieving GitHub installation repository issues', error.message);
            throw new HttpException(`Error while retrieving GitHub installation repository issues: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
