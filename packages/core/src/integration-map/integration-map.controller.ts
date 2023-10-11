import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { IIntegrationMap, IIntegrationMapSyncRepository, IIntegrationSyncedRepositoryFindInput, PermissionsEnum } from '@gauzy/contracts';
import { Permissions } from './../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { IntegrationMapService } from './integration-map.service';

@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.INTEGRATION_VIEW)
@Controller()
export class IntegrationMapController {
	constructor(
		private readonly _integrationMapService: IntegrationMapService
	) { }

	/**
	 * Sync a GitHub repository with Gauzy using provided data.
	 *
	 * @param entity The data needed for synchronization.
	 * @returns The synchronized integration map.
	 */
	@Post('github/repository-sync')
	async syncGithubRepository(
		@Body() entity: IIntegrationMapSyncRepository,
	): Promise<IIntegrationMap> {
		try {
			return await this._integrationMapService.syncGithubRepository(entity);
		} catch (error) {
			// Handle errors, e.g., return an error response.
			throw new Error('Failed to sync GitHub repository');
		}
	}

	/**
	 * GET endpoint to sync a GitHub repository based on query parameters.
	 *
	 * @param options - Query parameters for the sync operation
	 * @returns A Promise of type IIntegrationMap or false if not found
	 */
	@Get('github/repository-sync')
	async getSyncedGithubRepository(
		@Query() options: IIntegrationSyncedRepositoryFindInput,
	): Promise<IIntegrationMap | boolean> {
		try {
			return await this._integrationMapService.getSyncedGithubRepository(options);
		} catch (error) {
			// Handle errors, e.g., return an error response.
			throw new Error('Failed to get synced GitHub repository');
		}
	}
}
