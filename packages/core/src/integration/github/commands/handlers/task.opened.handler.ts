import { ICommandHandler, CommandHandler, CommandBus } from '@nestjs/cqrs';
import { IGithubCreateIssuePayload, IGithubIssueLabel, ITag, IntegrationEntity, IntegrationEnum } from '@gauzy/contracts';
import { RequestContext } from 'core/context';
import { arrayToObject } from 'core/utils';
import { OrganizationProjectService } from 'organization-project/organization-project.service';
import { IntegrationTenantGetCommand } from 'integration-tenant/commands';
import { IntegrationMapSyncEntityCommand } from 'integration-map/commands';
import { GithubSyncService } from '../../github-sync.service';
import { GithubTaskOpenedCommand } from '../task.opened.command';

@CommandHandler(GithubTaskOpenedCommand)
export class GithubTaskOpenedCommandHandler implements ICommandHandler<GithubTaskOpenedCommand> {

	constructor(
		private readonly _commandBus: CommandBus,
		private readonly _githubSyncService: GithubSyncService,
		private readonly _organizationProjectService: OrganizationProjectService
	) { }

	/**
	 * Command handler for the `GithubTaskOpenedCommand`, responsible for processing actions when a task is opened in Gauzy.
	 *
	 * @param command - The `GithubTaskOpenedCommand` containing the task data to be processed.
	 */
	async execute(command: GithubTaskOpenedCommand) {
		try {
			const { task, options } = command;
			const tenantId = RequestContext.currentTenantId() || options.tenantId;
			const { organizationId, projectId } = options;

			// Step 1: Get the GitHub integration for the organization
			const integration = await this._commandBus.execute(
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
							isArchived: false,
						},
					},
					relations: {
						settings: true,
					},
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
					// Step 4: Get the project and repository information
					const project = await this._organizationProjectService.findOneByIdString(projectId, {
						where: {
							organizationId,
							tenantId,
						},
						relations: {
							repository: true,
						},
					});

					// Step 5: Check if the project and its repository are available
					if (!!project && !!project.repository) {
						const repository = project.repository;

						// Step 6: Prepare the payload for opening the GitHub issue
						const payload: IGithubCreateIssuePayload = {
							repo: repository.name,
							owner: repository.owner,
							title: task.title,
							body: task.description,
							labels: this._mapIssueLabelPayload(task.tags),
						};

						// Step 7: Continue execution based on auto-sync label setting
						let isContinueExecution = true;
						if (!!project.isTasksAutoSyncOnLabel) {
							const syncTag = settings['sync_tag'];
							isContinueExecution = !!(
								payload.labels.find(
									(label: IGithubIssueLabel) => label.name === syncTag
								)
							);
						}

						// Step 8: If the condition allows, open the GitHub issue
						if (!isContinueExecution) {
							return;
						}

						try {
							// Step 9: Open the GitHub issue
							const issue = await this._githubSyncService.openIssue(installationId, payload);

							// Step 10: Create a mapping between the task and the GitHub issue
							return await this._commandBus.execute(
								new IntegrationMapSyncEntityCommand({
									gauzyId: task.id,
									integrationId,
									sourceId: issue.id,
									entity: IntegrationEntity.ISSUE,
									organizationId,
								})
							);
						} catch (error) {
							console.log('Error while opening a GitHub issue: %s', error?.message);
						}
					}
				}
			}
		} catch (error) {
			console.log('Error while retrieving GitHub integration: %s', error?.message);
		}
	}

	/**
	 * Map an array of tags to a simplified structure.
	 *
	 * @param tags - An array of ITag objects to be mapped.
	 * @returns An array of objects with 'name', 'color', and 'description' properties.
	 */
	private _mapIssueLabelPayload(tags: ITag[]): any[] {
		return tags.map(({ name, color, description, isSystem }) => ({
			name,
			color,
			description,
			default: isSystem
		}));
	}
}
