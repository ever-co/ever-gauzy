import { ICommandHandler, CommandHandler, CommandBus } from '@nestjs/cqrs';
import { IGithubIssueLabel, ITag, IntegrationEnum } from '@gauzy/contracts';
import { RequestContext } from 'core/context';
import { arrayToObject } from 'core/utils';
import { IntegrationTenantGetCommand } from 'integration-tenant/commands';
import { GithubSyncService } from '../../github-sync.service';
import { GithubTaskOpenedCommand } from '../task.opened.command';
import { OrganizationProjectService } from 'organization-project/organization-project.service';

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
			/** */
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
							isArchived: false
						},
					},
					relations: {
						settings: true
					}
				})
			);
			if (!!integration && !!integration.settings) {
				// Convert settings array to an object
				const settings = arrayToObject(integration.settings, 'settingsName', 'settingsValue');
				const installation_id = settings['installation_id'];
				if (!!installation_id) {
					try {
						/** */
						const project = await this._organizationProjectService.findOneByIdString(projectId, {
							where: {
								organizationId,
								tenantId
							},
							relations: {
								repository: true
							}
						});
						if (!!project && !!project.repository) {
							const repository = project.repository;
							const payload = {
								repo: repository.name,
								owner: repository.owner,
								title: task.title,
								body: task.description,
								labels: this._mapIssueLabelPayload(task.tags),
							};
							try {
								let isContinueExecution = true;
								if (!!project.isTasksAutoSyncOnLabel) {
									const sync_tag = settings['sync_tag'];
									isContinueExecution = !!(payload.labels.find(
										(label: IGithubIssueLabel) => label.name === sync_tag
									));
								}
								if (!isContinueExecution) {
									return;
								}
								const issue = await this._githubSyncService.openIssue(installation_id, payload);
								console.log(issue);
							} catch (error) {
								console.log('Error while opening github issue: %s', error?.message);
							}
						}
					} catch (error) {
						console.log('Error while getting github repository issue: %s', error?.message);
					}
				}
			}
		} catch (error) {
			console.log('Error while retrieving github integration: %s', error?.message);
		}
	}

	/**
	 * Map an array of tags to a simplified structure.
	 *
	 * @param tags - An array of ITag objects to be mapped.
	 * @returns An array of objects with 'name', 'color', and 'description' properties.
	 */
	private _mapIssueLabelPayload(tags: ITag[]): any[] {
		return tags.map(({ name, color, description }) => ({
			name,
			color,
			description
		}));
	}
}
