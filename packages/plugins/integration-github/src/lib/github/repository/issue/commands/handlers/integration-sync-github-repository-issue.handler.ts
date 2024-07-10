import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
	IOrganizationGithubRepository,
	IOrganizationGithubRepositoryFindInput,
	IOrganizationGithubRepositoryIssue
} from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { IntegrationSyncGithubRepositoryIssueCommand } from '../integration-sync-github-repository-issue.command';
import { TypeOrmOrganizationGithubRepositoryRepository } from '../../../repository/type-orm-organization-github-repository.repository';
import { TypeOrmOrganizationGithubRepositoryIssueRepository } from '../../repository/type-orm-github-repository-issue.repository';

@CommandHandler(IntegrationSyncGithubRepositoryIssueCommand)
export class IntegrationSyncGithubRepositoryIssueCommandHandler
	implements ICommandHandler<IntegrationSyncGithubRepositoryIssueCommand>
{
	constructor(
		private readonly typeOrmOrganizationGithubRepositoryRepository: TypeOrmOrganizationGithubRepositoryRepository,
		private readonly typeOrmOrganizationGithubRepositoryIssueRepository: TypeOrmOrganizationGithubRepositoryIssueRepository
	) {}

	/**
	 * Execute a command to synchronize a GitHub repository issue and store it in the local database.
	 *
	 * @param command - The command containing input parameters for the synchronization.
	 * @returns A Promise that resolves to the synchronized organization's GitHub repository issue.
	 */
	public async execute(
		command: IntegrationSyncGithubRepositoryIssueCommand
	): Promise<IOrganizationGithubRepositoryIssue> {
		try {
			// Extract input parameters from the command
			const { input, repositoryId, issue } = command;

			// Extract relevant data from the input
			const { organizationId, integrationId } = input;
			const tenantId = RequestContext.currentTenantId() || input.tenantId;

			// Find the synced repository based on organization, tenant, and integration
			const syncedRepository = await this.findRepository({
				organizationId,
				tenantId,
				integrationId,
				repositoryId
			});

			// Extract issue details
			const { id, number } = issue;
			/** */
			try {
				return await this.typeOrmOrganizationGithubRepositoryIssueRepository.findOneByOrFail({
					issueId: id,
					issueNumber: number,
					organizationId,
					tenantId,
					repositoryId: syncedRepository.id
				});
			} catch (error) {
				// Create a new integration repository issue if it doesn't exist
				const createEntity = this.typeOrmOrganizationGithubRepositoryIssueRepository.create({
					issueId: id,
					issueNumber: number,
					organizationId,
					tenantId,
					repositoryId: syncedRepository ? syncedRepository.id : null
				});
				return await this.typeOrmOrganizationGithubRepositoryIssueRepository.save(createEntity);
			}
		} catch (error) {
			console.log('Error while syncing GitHub repository issue:', error.message);
			throw new Error('Failed to sync GitHub repository issue');
		}
	}

	/**
	 * Find a GitHub repository in the local database.
	 *
	 * @param organizationId - The organization's ID.
	 * @param tenantId - The tenant's ID.
	 * @param integrationId - The integration's ID.
	 * @param repositoryId - The GitHub repository's ID.
	 * @returns A Promise that resolves to the found organization's GitHub repository, or null if not found.
	 */
	private async findRepository({
		organizationId,
		tenantId,
		integrationId,
		repositoryId
	}: IOrganizationGithubRepositoryFindInput): Promise<IOrganizationGithubRepository | null> {
		return await this.typeOrmOrganizationGithubRepositoryRepository.findOneBy({
			organizationId,
			tenantId,
			integrationId,
			repositoryId
		});
	}
}
