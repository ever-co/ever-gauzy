import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { GithubRepositoryStatusEnum, IOrganizationGithubRepository } from '@gauzy/contracts';
import { RequestContext } from '../../../../core/context';
import { GithubRepositoryService } from './../../repository/github-repository.service';
import { IntegrationSyncGithubRepositoryCommand } from '../integration-sync-github-repository.command';

@CommandHandler(IntegrationSyncGithubRepositoryCommand)
export class IntegrationSyncGithubRepositoryCommandHandler
	implements ICommandHandler<IntegrationSyncGithubRepositoryCommand>
{
	constructor(private readonly _githubRepositoryService: GithubRepositoryService) {}

	/**
	 * Execute a synchronization of a GitHub repository for an integration.
	 *
	 * @param command - The command containing synchronization details.
	 * @returns A promise that resolves to the integrated GitHub repository.
	 */
	public async execute(command: IntegrationSyncGithubRepositoryCommand): Promise<IOrganizationGithubRepository> {
		// Extract input parameters from the command
		const { input } = command;
		const { repository, organizationId, integrationId } = input;
		const tenantId = RequestContext.currentTenantId() || input.tenantId;

		// Destructure the repository object for better readability
		const { id: repositoryId, full_name, name, owner, open_issues_count } = repository;
		const status: GithubRepositoryStatusEnum = repository.status || GithubRepositoryStatusEnum.SYNCING;

		try {
			/**
			 * Find an integration repository based on repository, integration, organization, and tenant.
			 *
			 * @returns A promise that resolves to the integration repository if found.
			 */
			const integrationRepository = await this._githubRepositoryService.findOneByWhereOptions({
				repositoryId,
				integrationId,
				organizationId,
				tenantId
			});
			/**
			 * Update an integration repository with the provided details.
			 *
			 * @returns A promise that resolves to the updated integration repository.
			 */
			return await this._githubRepositoryService.create({
				id: integrationRepository.id,
				name: name,
				fullName: full_name,
				owner: owner.login,
				issuesCount: open_issues_count,
				private: repository.private,
				status,
				repositoryId,
				integrationId,
				organizationId,
				tenantId
			});
		} catch (error) {
			/**
			 * Create or update an integration repository with the provided details.
			 *
			 * @returns A promise that resolves to the created or updated integration repository.
			 */
			return await this._githubRepositoryService.create({
				name: name,
				fullName: full_name,
				owner: owner.login,
				issuesCount: open_issues_count,
				private: repository.private,
				status,
				repositoryId,
				integrationId,
				organizationId,
				tenantId
			});
		}
	}
}
