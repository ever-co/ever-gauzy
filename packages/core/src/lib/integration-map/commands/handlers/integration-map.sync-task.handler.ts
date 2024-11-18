import { CommandHandler, ICommandHandler, CommandBus } from '@nestjs/cqrs';
import { IntegrationEntity } from '@gauzy/contracts';
import { TaskService } from '../../../tasks/task.service';
import { IntegrationMapSyncEntityCommand } from './../integration-map.sync-entity.command';
import { IntegrationMapSyncTaskCommand } from './../integration-map.sync-task.command';
import { IntegrationMapService } from '../../integration-map.service';
import { RequestContext } from './../../../core/context';
import { TaskCreateCommand, TaskUpdateCommand } from './../../../tasks/commands';

@CommandHandler(IntegrationMapSyncTaskCommand)
export class IntegrationMapSyncTaskHandler implements ICommandHandler<IntegrationMapSyncTaskCommand> {
	constructor(
		private readonly _commandBus: CommandBus,
		private readonly _integrationMapService: IntegrationMapService,
		private readonly _taskService: TaskService
	) {}

	/**
	 * Third party project task integrated and mapped
	 *
	 * @param command
	 * @returns
	 */
	public async execute(command: IntegrationMapSyncTaskCommand) {
		const { triggeredEvent, input } = command;
		const { sourceId, organizationId, integrationId, entity } = input;
		const tenantId = RequestContext.currentTenantId() || input.tenantId;

		try {
			// Check if an integration map already exists for the issue
			const integrationMap = await this._integrationMapService.findOneByWhereOptions({
				entity: IntegrationEntity.TASK,
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
					entity: IntegrationEntity.TASK,
					integrationId,
					sourceId,
					organizationId,
					tenantId
				})
			);
		}
	}
}
