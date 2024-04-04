import {
	Controller,
	Post,
	Body,
	UseGuards,
	HttpException,
	HttpStatus,
	HttpCode,
	Logger,
	Param,
	Req
} from '@nestjs/common';
import { Request } from 'express';
import { IIntegrationTenant, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, TenantPermissionGuard } from '../../shared/guards';
import { Permissions } from '../../shared/decorators';
import { UseValidationPipe } from '../../shared/pipes';
import { GithubSyncService } from './github-sync.service';
import { ProcessGithubIssueSyncDTO } from './dto';

@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.INTEGRATION_VIEW)
@Controller(':integrationId')
export class GitHubSyncController {
	private readonly logger = new Logger('GitHubSyncController');

	constructor(private readonly _githubSyncService: GithubSyncService) { }

	/**
	 * Handle an HTTP POST request to manually synchronize GitHub issues and labels.
	 *
	 * @param body - The request body containing data for synchronization.
	 * @returns An HTTP response with the result of the synchronization.
	 */
	@Post('/manual-sync/issues')
	@HttpCode(HttpStatus.CREATED)
	@UseValidationPipe()
	async syncGithubIssuesAndLabels(
		@Param('integrationId') integrationId: IIntegrationTenant['id'],
		@Req() request: Request,
		@Body() input: ProcessGithubIssueSyncDTO
	) {
		try {
			// Validate the input data (You can use class-validator for validation)
			if (!input || !input.organizationId) {
				throw new HttpException('Invalid sync issues & labels request parameters', HttpStatus.BAD_REQUEST);
			}

			// Call a service method to perform manual synchronization of GitHub issues and labels
			return await this._githubSyncService.manualSyncGithubIssues(integrationId, input, request);
		} catch (error) {
			// Handle errors and return an appropriate error response
			this.logger.error('Error while github sync issues and labels', error.message);
			throw new HttpException(
				`Error while github sync issues and labels: ${error.message}`,
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}

	/**
	 * Handle an HTTP POST request to automatically synchronize GitHub issues.
	 *
	 * @param body - The request body containing data for synchronization.
	 * @returns An HTTP response with the result of the synchronization.
	 */
	@Post('/auto-sync/issues')
	@HttpCode(HttpStatus.CREATED)
	@UseValidationPipe()
	async autoSyncGithubIssues(
		@Param('integrationId') integrationId: IIntegrationTenant['id'],
		@Req() request: Request,
		@Body() input: ProcessGithubIssueSyncDTO
	) {
		try {
			// Validate the input data (You can use class-validator for validation)
			if (!input || !input.organizationId) {
				throw new HttpException('Invalid sync issues & labels request parameters', HttpStatus.BAD_REQUEST);
			}
			return await this._githubSyncService.autoSyncGithubIssues(integrationId, input, request);
		} catch (error) {
			// Handle errors and return an appropriate error response
			this.logger.error(`Error while github sync issues and labels`, error.message);
			throw new HttpException(
				`Error while github sync issues and labels: ${error.message}`,
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}
}
