import { CommandHandler, ICommandHandler, CommandBus } from '@nestjs/cqrs';
import { IIntegrationMap, IntegrationEntity } from '@gauzy/contracts';
import { RequestContext } from '../../../core/context';
import { TaskService } from '../../../tasks/task.service';
import { TaskCreateCommand, TaskUpdateCommand } from '../../../tasks/commands';
import { IntegrationMapSyncEntityCommand } from './../integration-map.sync-entity.command';
import { IntegrationMapSyncIssueCommand } from './../integration-map.sync-issue.command';
import { IntegrationMapService } from '../../integration-map.service';

@CommandHandler(IntegrationMapSyncIssueCommand)
export class IntegrationMapSyncIssueHandler implements ICommandHandler<IntegrationMapSyncIssueCommand> {
	constructor(
		private readonly _commandBus: CommandBus,
		private readonly _integrationMapService: IntegrationMapService,
		private readonly _taskService: TaskService
	) {}

	/**
	 * Execute the IntegrationMapSyncIssueCommand to sync GitHub issues and update tasks.
	 *
	 * @param command - The IntegrationMapSyncIssueCommand containing the request data.
	 * @returns A promise that resolves to the updated integration map.
	 */
	public async execute(command: IntegrationMapSyncIssueCommand): Promise<IIntegrationMap> {
		const { triggeredEvent, request } = command;
		const { sourceId, organizationId, integrationId, entity } = request;
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
			// Try to find the corresponding task
			try {
				await this._taskService.findOneByIdString(integrationMap.gauzyId);

				// Update the corresponding task with the new input data
				await this._commandBus.execute(new TaskUpdateCommand(integrationMap.gauzyId, entity, triggeredEvent));
			} catch (error) {
				// Create a corresponding task with the new input data
				await this._commandBus.execute(
					new TaskCreateCommand({
						...entity,
						id: integrationMap.gauzyId
					})
				);
			}
			// Return the integration map
			return integrationMap;
		} catch (error) {
			// Handle errors and create a new task
			// Create a new task with the provided entity data
			const task = await this._commandBus.execute(new TaskCreateCommand(entity, triggeredEvent));

			// Create a new integration map for the issue
			return await this._commandBus.execute(
				new IntegrationMapSyncEntityCommand({
					gauzyId: task.id,
					entity: IntegrationEntity.ISSUE,
					integrationId,
					sourceId,
					organizationId,
					tenantId
				})
			);
		}
	}
}
