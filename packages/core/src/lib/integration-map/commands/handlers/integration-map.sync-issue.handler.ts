import { CommandHandler, ICommandHandler, CommandBus } from '@nestjs/cqrs';
import { IIntegrationMap, IntegrationEntity } from '@gauzy/contracts';
import { RequestContext } from '../../../core/context';
import { TaskService } from '../../../tasks/task.service';
import { TaskCreateCommand, TaskUpdateCommand } from '../../../tasks/commands';
import { IntegrationMapSyncEntityCommand } from './../integration-map.sync-entity.command';
import { IntegrationMapSyncIssueCommand } from './../integration-map.sync-issue.command';
import { IntegrationMapService } from '../../integration-map.service';
import { nullIfNotFound } from './null-if-not-found';

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

		// Only a missing map means the issue is new. Errors from the task update below must reach the caller:
		// they used to fall into the "no map" branch and create a second task and map for the same source id.
		const integrationMap = await this._integrationMapService
			.findOneByWhereOptions({
				entity: IntegrationEntity.ISSUE,
				sourceId,
				integrationId,
				organizationId,
				tenantId
			})
			.catch(nullIfNotFound);

		if (!integrationMap) {
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

		// Try to find the corresponding task
		const mappedTask = await this._taskService.findOneByIdString(integrationMap.gauzyId).catch(nullIfNotFound);
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
