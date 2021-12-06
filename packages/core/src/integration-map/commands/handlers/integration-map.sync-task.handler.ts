import { CommandHandler, ICommandHandler, CommandBus } from '@nestjs/cqrs';
import { IntegrationEntity } from '@gauzy/contracts';
import { IntegrationMapSyncEntityCommand } from './../integration-map.sync-entity.command';
import { IntegrationMapSyncTaskCommand } from './../integration-map.sync-task.command';
import { IntegrationMapService } from '../../integration-map.service';
import { RequestContext } from './../../../core/context';
import { TaskCreateCommand, TaskUpdateCommand } from './../../../tasks/commands';

@CommandHandler(IntegrationMapSyncTaskCommand)
export class IntegrationMapSyncTaskHandler
	implements ICommandHandler<IntegrationMapSyncTaskCommand> {

	constructor(
		private readonly _commandBus: CommandBus,
		private readonly _integrationMapService: IntegrationMapService
	) {}

	/**
	 * Third party project task integrated and mapped
	 * 
	 * @param command 
	 * @returns 
	 */
	public async execute(
		command: IntegrationMapSyncTaskCommand
	) {
		const { input } = command;
		const { sourceId, organizationId, integrationId, taskInput } = input;
		const tenantId = RequestContext.currentTenantId();

		try {
			const taskMap = await this._integrationMapService.findOneByOptions({
				where: {
					sourceId,
					entity: IntegrationEntity.TASK,
					organizationId,
					tenantId
				}
			});
			await this._commandBus.execute(
				new TaskUpdateCommand(
					Object.assign({}, taskInput, { id: taskMap.gauzyId })
				)
			);
			return taskMap;
		} catch (error) {
			const task = await this._commandBus.execute(
				new TaskCreateCommand(
					Object.assign({}, taskInput)
				)
			);
			return await this._commandBus.execute(
				new IntegrationMapSyncEntityCommand({
					gauzyId: task.id,
					integrationId,
					sourceId,
					entity: IntegrationEntity.TASK,
					organizationId
				})
			);
		}
	}
}
