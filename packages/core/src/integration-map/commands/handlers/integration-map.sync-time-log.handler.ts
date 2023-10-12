import { CommandHandler, ICommandHandler, CommandBus } from '@nestjs/cqrs';
import { IntegrationEntity } from '@gauzy/contracts';
import { TimeLogCreateCommand } from './../../../time-tracking/time-log/commands';
import { IntegrationMapSyncEntityCommand } from './../integration-map.sync-entity.command';
import { IntegrationMapSyncTimeLogCommand } from '../integration-map.sync-time-log.command';
import { IntegrationMapService } from '../../integration-map.service';
import { RequestContext } from '../../../core/context';

@CommandHandler(IntegrationMapSyncTimeLogCommand)
export class IntegrationMapSyncTimeLogHandler
	implements ICommandHandler<IntegrationMapSyncTimeLogCommand> {

	constructor(
		private readonly _commandBus: CommandBus,
		private readonly _integrationMapService: IntegrationMapService
	) { }

	/**
	 * Third party timeslot integrated and mapped
	 *
	 * @param command
	 * @returns
	 */
	public async execute(
		command: IntegrationMapSyncTimeLogCommand
	) {
		const { input } = command;
		const tenantId = RequestContext.currentTenantId();

		const { sourceId, organizationId, integrationId, entity } = input;
		try {
			return await this._integrationMapService.findOneByWhereOptions({
				entity: IntegrationEntity.TIME_LOG,
				sourceId,
				integrationId,
				organizationId,
				tenantId
			});
		} catch (error) {
			const gauzyTimeLog = await this._commandBus.execute(
				new TimeLogCreateCommand(entity)
			);
			return await this._commandBus.execute(
				new IntegrationMapSyncEntityCommand({
					entity: IntegrationEntity.TIME_LOG,
					gauzyId: gauzyTimeLog.id,
					sourceId,
					integrationId,
					organizationId,
					tenantId
				})
			);
		}
	}
}
