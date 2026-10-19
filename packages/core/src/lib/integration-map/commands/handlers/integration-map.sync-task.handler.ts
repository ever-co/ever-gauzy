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

		// Only a missing map means the task is new. Errors from the task update below must reach the caller:
		// they used to fall into the "no map" branch and create a second task and map for the same source id.
		const integrationMap = await this._integrationMapService
			.findOneByWhereOptions({
				entity: IntegrationEntity.TASK,
				sourceId,
				integrationId,
				organizationId,
				tenantId
			})
			.catch(() => null);

		if (!integrationMap) {
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

		// Try to find the corresponding task
		const mappedTask = await this._taskService.findOneByIdString(integrationMap.gauzyId).catch(() => null);
		if (mappedTask) {
			// Update the corresponding task with the new input data
			await this._commandBus.execute(new TaskUpdateCommand(integrationMap.gauzyId, entity, triggeredEvent));
		} else {
			// The mapped task is gone: re-create it under the mapped id
			await this._commandBus.execute(
				new TaskCreateCommand({
					...entity,
					id: integrationMap.gauzyId
				})
			);
		}
		// Return the integration map
		return integrationMap;
	}
}
