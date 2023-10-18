import { ICommandHandler, CommandHandler, CommandBus } from '@nestjs/cqrs';
import { IntegrationEnum } from '@gauzy/contracts';
import { RequestContext } from 'core/context';
import { arrayToObject } from 'core/utils';
import { IntegrationTenantGetCommand } from 'integration-tenant/commands';
import { GithubSyncService } from '../../github-sync.service';
import { GithubTaskOpenedCommand } from '../task.opened.command';

@CommandHandler(GithubTaskOpenedCommand)
export class GithubTaskOpenedCommandHandler implements ICommandHandler<GithubTaskOpenedCommand> {

	constructor(
		private readonly _commandBus: CommandBus,
		private readonly _githubSyncService: GithubSyncService
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
			const organizationId = options.organizationId;

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
					const issue = {
						title: task.title,
						body: task.description,
						labels: task.tags
					};
					console.log(issue);
					// await this._githubSyncService.openIssue(installation_id, issue);
				}
			}
		} catch (error) {
			console.log('Error while retrieving github integration: %s', error?.message);
		}
	}
}
