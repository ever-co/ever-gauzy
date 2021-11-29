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
	) {}

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

		const { sourceId, organizationId, integrationId, timeLog } = input;
		try {
			return await this._integrationMapService.findOneByOptions({
				where: {
					sourceId,
					entity: IntegrationEntity.TIME_LOG,
					organizationId,
					tenantId
				}
			});
		} catch (error) {
			const gauzyTimeLog = await this._commandBus.execute(
				new TimeLogCreateCommand(
					Object.assign({}, timeLog)
				)
			);
			return await this._commandBus.execute(
				new IntegrationMapSyncEntityCommand({
					gauzyId: gauzyTimeLog.id,
					integrationId,
					sourceId,
					entity: IntegrationEntity.TIME_LOG,
					organizationId,
					tenantId
				})
			);
		}
	}
}
