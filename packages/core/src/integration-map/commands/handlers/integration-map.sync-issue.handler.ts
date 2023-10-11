import { CommandHandler, ICommandHandler, CommandBus } from '@nestjs/cqrs';
import { IIntegrationMap, IntegrationEntity } from '@gauzy/contracts';
import { RequestContext } from './../../../core/context';
import { TaskCreateCommand, TaskUpdateCommand } from 'tasks/commands';
import { IntegrationMapSyncEntityCommand } from './../integration-map.sync-entity.command';
import { IntegrationMapSyncIssueCommand } from './../integration-map.sync-issue.command';
import { IntegrationMapService } from '../../integration-map.service';

@CommandHandler(IntegrationMapSyncIssueCommand)
export class IntegrationMapSyncIssueHandler implements ICommandHandler<IntegrationMapSyncIssueCommand> {

	constructor(
		private readonly _commandBus: CommandBus,
		private readonly _integrationMapService: IntegrationMapService
	) { }

	/**
	 * Execute the IntegrationMapSyncIssueCommand to sync GitHub issues and update tasks.
	 *
	 * @param command - The IntegrationMapSyncIssueCommand containing the request data.
	 * @returns A promise that resolves to the updated integration map.
	 */
	public async execute(command: IntegrationMapSyncIssueCommand): Promise<IIntegrationMap> {
		const { request } = command;
		const { sourceId, organizationId, integrationId, input } = request;
		const tenantId = RequestContext.currentTenantId() || request.tenantId;

		try {
			// Check if an integration map already exists for the issue
			const integrationMap = await this._integrationMapService.findOneByWhereOptions({
				entity: IntegrationEntity.ISSUE,
				sourceId,
				integrationId,
				organizationId,
				tenantId
			});
			// Update the corresponding task with the new input data
			await this._commandBus.execute(
				new TaskUpdateCommand(integrationMap.gauzyId, Object.assign({}, input))
			);
			// Return the integration map
			return integrationMap;
		} catch (error) {
			// Create a new task and update the integration map for the issue
			const task = await this._commandBus.execute(
				new TaskCreateCommand(input)
			);
			return await this._commandBus.execute(new IntegrationMapSyncEntityCommand({
				gauzyId: task.id,
				entity: IntegrationEntity.ISSUE,
				integrationId,
				sourceId,
				organizationId,
				tenantId
			}));
		}
	}
}
