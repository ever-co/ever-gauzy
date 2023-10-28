import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IOrganizationGithubRepository, IOrganizationGithubRepositoryFindInput, IOrganizationGithubRepositoryIssue } from '@gauzy/contracts';
import { RequestContext } from 'core/context';
import { IntegrationSyncGithubRepositoryIssueCommand } from '../integration-sync-github-repository-issue.command';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationGithubRepositoryIssue } from './../../github-repository-issue.entity';
import { OrganizationGithubRepository } from './../../../github-repository.entity';

@CommandHandler(IntegrationSyncGithubRepositoryIssueCommand)
export class IntegrationSyncGithubRepositoryIssueCommandHandler implements ICommandHandler<IntegrationSyncGithubRepositoryIssueCommand> {

	constructor(
		@InjectRepository(OrganizationGithubRepository)
		private readonly organizationGithubRepositoryRepository: Repository<OrganizationGithubRepository>,

		@InjectRepository(OrganizationGithubRepositoryIssue)
		private readonly organizationGithubRepositoryIssueRepository: Repository<OrganizationGithubRepositoryIssue>,
	) { }

	/**
	 * Execute a command to synchronize a GitHub repository issue and store it in the local database.
	 *
	 * @param command - The command containing input parameters for the synchronization.
	 * @returns A Promise that resolves to the synchronized organization's GitHub repository issue.
	 */
	public async execute(command: IntegrationSyncGithubRepositoryIssueCommand): Promise<IOrganizationGithubRepositoryIssue> {
		try {
			// Extract input parameters from the command
			const { input, repository, issue } = command;

			// Extract relevant data from the input
			const { organizationId, integrationId } = input;
			const tenantId = RequestContext.currentTenantId() || input.tenantId;

			// Find the synced repository based on organization, tenant, and integration
			const syncedRepository = await this.findRepository({
				organizationId,
				tenantId,
				integrationId,
				repositoryId: repository.id
			});
			// Extract issue details
			const { sourceId, number } = issue;

			/** */
			try {
				return await this.organizationGithubRepositoryIssueRepository.findOneByOrFail({
					issueId: sourceId,
					issueNumber: number,
					organizationId,
					tenantId,
					repositoryId: syncedRepository.id
				});
			} catch (error) {
				// Create a new integration repository issue if it doesn't exist
				const createEntity = this.organizationGithubRepositoryIssueRepository.create({
					issueId: sourceId,
					issueNumber: number,
					organizationId,
					tenantId,
					repositoryId: syncedRepository ? syncedRepository.id : null
				});
				return await this.organizationGithubRepositoryIssueRepository.save(createEntity);
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
		return this.organizationGithubRepositoryRepository.findOneBy({
			organizationId,
			tenantId,
			integrationId,
			repositoryId,
		});
	}
}
