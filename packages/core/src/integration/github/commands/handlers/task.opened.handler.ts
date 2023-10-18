import { ICommandHandler, CommandHandler, CommandBus } from '@nestjs/cqrs';
import { IntegrationEnum } from '@gauzy/contracts';
import { RequestContext } from 'core/context';
import { IntegrationTenantService } from 'integration-tenant/integration-tenant.service';
import { GithubSyncService } from '../../github-sync.service';
import { GithubTaskOpenedCommand } from '../task.opened.command';
import { IntegrationTenantGetCommand } from 'integration-tenant/commands';

@CommandHandler(GithubTaskOpenedCommand)
export class GithubTaskOpenedCommandHandler implements ICommandHandler<GithubTaskOpenedCommand> {

	constructor(
		private readonly _commandBus: CommandBus,
		private readonly _githubSyncService: GithubSyncService,
		private readonly _integrationTenantService: IntegrationTenantService
	) { }

	/**
	 * Command handler for the `GithubTaskOpenedCommand`, responsible for processing actions when a task is opened in Gauzy.
	 *
	 * @param command - The `GithubTaskOpenedCommand` containing the task data to be processed.
	 */
	async execute(command: GithubTaskOpenedCommand) {
		const { options } = command;
		try {
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

			}

			console.log({ integration });
		} catch (error) {
			console.log('Error while retrieving github integration: %s', options);
		}
	}
}
