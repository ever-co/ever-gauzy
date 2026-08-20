import { Body, Controller, NotFoundException, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ID, IIntegrationMapSyncRepository, IOrganizationGithubRepository, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, Permissions, TenantPermissionGuard, UUIDValidationPipe, UseValidationPipe } from '@gauzy/core';
import { GithubRepositoryService } from './github-repository.service';
import { UpdateGithubRepositoryDTO } from './dto';

// Mirrors every sibling GitHub controller. Without TenantPermissionGuard the global AuthGuard does
// not require a tenant in the request context, and a tenant-less request slips past the
// cross-tenant upsert guard in TenantAwareCrudService.create() (which cannot judge ownership with
// no tenant to compare against).
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.INTEGRATION_ADD, PermissionsEnum.INTEGRATION_EDIT)
@Controller('/integration/github/repository')
export class GitHubRepositoryController {
	constructor(private readonly _githubRepositoryService: GithubRepositoryService) {}

	/**
	 * Sync a GitHub repository with Gauzy using provided data.
	 *
	 * @param entity The data needed for synchronization.
	 * @returns The synchronized integration map.
	 */
	@Post('/sync')
	async syncRepository(@Body() entity: IIntegrationMapSyncRepository): Promise<IOrganizationGithubRepository> {
		return await this._githubRepositoryService.syncGithubRepository(entity);
	}

	/**
	 * Handle an HTTP PUT request to update a GitHub repository by its unique identifier.
	 * @param id - A string representing the unique identifier of the GitHub repository.
	 * @param input - An object representing the data to update the GitHub repository with.
	 * @returns A Promise that resolves to the updated GitHub repository data.
	 */
	@Put('/:id')
	@UseValidationPipe({ whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() input: UpdateGithubRepositoryDTO
	): Promise<IOrganizationGithubRepository> {
		// Ensure that a GitHub repository with the provided identifier exists IN THE CALLER'S TENANT.
		// `findOneByIdString` throws NotFoundException when it matches nothing, so this call is the
		// check; an unknown or foreign id never reaches `create()`.
		await this._githubRepositoryService.findOneByIdString(id);

		// Attempt to update the GitHub repository using the provided data.
		return await this._githubRepositoryService.create({
			...input,
			id
		});
	}
}
