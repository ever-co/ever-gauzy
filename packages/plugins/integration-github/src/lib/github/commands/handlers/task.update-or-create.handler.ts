import { ICommandHandler, CommandHandler, CommandBus } from '@nestjs/cqrs';
import {
	IGithubIssueCreateOrUpdatePayload,
	IGithubIssue,
	IGithubIssueLabel,
	ITag,
	IntegrationEntity,
	IntegrationEnum,
	IOrganizationProject,
	IIntegrationTenant
} from '@gauzy/contracts';
import {
	IntegrationMapService,
	IntegrationMapSyncEntityCommand,
	IntegrationTenantGetCommand,
	OrganizationProjectService,
	RequestContext
} from '@gauzy/core';
import { arrayToObject } from '@gauzy/utils';
import { GithubRepositoryIssueService } from './../../repository/issue/github-repository-issue.service';
import { IntegrationSyncGithubRepositoryIssueCommand } from '../../repository/issue/commands';
import { GithubSyncService } from '../../github-sync.service';
import { GithubTaskUpdateOrCreateCommand } from '../task.update-or-create.command';

@CommandHandler(GithubTaskUpdateOrCreateCommand)
export class GithubTaskUpdateOrCreateCommandHandler implements ICommandHandler<GithubTaskUpdateOrCreateCommand> {
	constructor(
		private readonly _commandBus: CommandBus,
		private readonly _githubSyncService: GithubSyncService,
		private readonly _organizationProjectService: OrganizationProjectService,
		private readonly _integrationMapService: IntegrationMapService,
		private readonly _githubRepositoryIssueService: GithubRepositoryIssueService
	) {}

	/**
	 * Command handler for the `GithubTaskUpdateOrCreateCommand`, responsible for processing actions when a task is opened in Gauzy.
	 *
	 * @param command - The `GithubTaskUpdateOrCreateCommand` containing the task data to be processed.
	 */
	async execute(command: GithubTaskUpdateOrCreateCommand) {
		try {
			const { task, options } = command;
			const tenantId = RequestContext.currentTenantId() || options.tenantId;
			const { organizationId, projectId } = options;

			// Step 1: Get the GitHub integration for the organization
			const integration: IIntegrationTenant = await this._commandBus.execute(
				new IntegrationTenantGetCommand({
					where: {
						name: IntegrationEnum.GITHUB,
						organizationId,
						tenantId,
						isActive: true,
						isArchived: false,
						integration: {
							provider: IntegrationEnum.GITHUB,
							isActive: true,
							isArchived: false
						}
					},
					relations: {
						settings: true
					}
				})
			);

			// Step 2: Check if the integration and its settings are available
			if (!!integration && !!integration.settings) {
				const integrationId = integration.id;

				// Convert settings array to an object for easier access
				const settings = arrayToObject(integration.settings, 'settingsName', 'settingsValue');
				const installationId = settings['installation_id'];

				// Step 3: Ensure that installation ID is available
				if (!!installationId) {
					try {
						// Step 4: Get the project and repository information
						const project = await this._organizationProjectService.findOneByIdString(projectId, {
							where: {
								organizationId,
								tenantId,
								isActive: true,
								isArchived: false,
								customFields: {
									repository: {
										organizationId,
										tenantId,
										hasSyncEnabled: true,
										isActive: true,
										isArchived: false
									}
								}
							},
							relations: {
								customFields: { repository: true }
							}
						});

						// Step 5: Check if the project and its repository are available
						if (!!project && !!project.customFields['repository']) {
							const repository = project.customFields['repository'];

							// Step 6: Prepare the payload for opening the GitHub issue
							const payload: IGithubIssueCreateOrUpdatePayload = {
								repo: repository.name,
								owner: repository.owner,
								title: task.title,
								body: task.description,
								labels: this._mapIssueLabelPayload(task.tags || [])
							};
							const syncTag = settings['sync_tag']; // Check if the issue should be synchronized for this project

							// Step 7: Continue execution based on auto-sync label setting
							if (!!this.shouldSyncIssue(project, payload.labels, syncTag)) {
								try {
									// Check if an integration map already exists for the issue
									const integrationMap = await this._integrationMapService.findOneByWhereOptions({
										entity: IntegrationEntity.ISSUE,
										gauzyId: task.id,
										integrationId,
										organizationId,
										tenantId,
										isActive: true,
										isArchived: false
									});

									try {
										/** */
										const syncIssue =
											await this._githubRepositoryIssueService.findOneByWhereOptions({
												organizationId,
												tenantId,
												repositoryId: repository.id,
												issueId: parseInt(integrationMap.sourceId)
											});
										payload.issue_number = syncIssue.issueNumber;
										await this._githubSyncService.createOrUpdateIssue(installationId, payload);
									} catch (error) {
										console.log('Error while getting synced issue', error?.message);
									}
								} catch (error) {
									// Step 9: Open the GitHub issue
									const issue: IGithubIssue = await this._githubSyncService.createOrUpdateIssue(
										installationId,
										payload
									);

									// Step 10: Synchronized GitHub repository issue.
									const { repositoryId } = repository;
									await this._commandBus.execute(
										new IntegrationSyncGithubRepositoryIssueCommand(
											{
												tenantId,
												organizationId,
												integrationId
											},
											repositoryId,
											issue
										)
									);

									// Step 11: Create a mapping between the task and the GitHub issue
									return await this._commandBus.execute(
										new IntegrationMapSyncEntityCommand({
											gauzyId: task.id,
											integrationId,
											sourceId: issue.id.toString(),
											entity: IntegrationEntity.ISSUE,
											organizationId,
											tenantId
										})
									);
								}
							}
						}
					} catch (error) {
						console.log('Project Not Found: %s', error.message);
					}
				}
			}
		} catch (error) {
			// Handle errors gracefully, for example, log them
			console.log('Error while getting synced issue', error?.message);
		}
	}

	/**
	 * Determines whether an issue should be synchronized based on project settings.
	 *
	 * @param project - The project configuration.
	 * @param issue - The GitHub issue to be synchronized.
	 * @returns A boolean indicating whether the issue should be synchronized.
	 */
	private shouldSyncIssue(project: IOrganizationProject, labels: IGithubIssueLabel[] = [], syncTag: string): boolean {
		if (!project || !project.isTasksAutoSync) {
			return false;
		}
		return !!labels.find((label) => label.name.trim() === syncTag.trim());
	}

	/**
	 * Map an array of tags to a simplified structure.
	 *
	 * @param tags - An array of ITag objects to be mapped.
	 * @returns An array of objects with 'name', 'color', and 'description' properties.
	 */
	private _mapIssueLabelPayload(tags: ITag[] = []): any[] {
		return tags.map(({ name, color, description, isSystem }) => ({
			name,
			color,
			description,
			default: isSystem
		}));
	}
}
