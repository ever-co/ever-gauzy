import { Body, Controller, Param, Post, Put } from '@nestjs/common';
import { ID, IIntegrationMapSyncRepository, IOrganizationGithubRepository } from '@gauzy/contracts';
import { UUIDValidationPipe, UseValidationPipe } from '@gauzy/core';
import { GithubRepositoryService } from './github-repository.service';
import { UpdateGithubRepositoryDTO } from './dto';

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
		// Ensure that a GitHub repository with the provided identifier exists.
		await this._githubRepositoryService.findOneByIdString(id);

		// Attempt to update the GitHub repository using the provided data.
		return await this._githubRepositoryService.create({
			...input,
			id
		});
	}
}
