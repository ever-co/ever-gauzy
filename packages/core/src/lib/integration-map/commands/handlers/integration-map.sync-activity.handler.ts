import { CommandHandler, ICommandHandler, CommandBus } from '@nestjs/cqrs';
import { IntegrationEntity } from '@gauzy/contracts';
import { ActivityCreateCommand, ActivityUpdateCommand } from './../../../time-tracking/activity/commands';
import { IntegrationMapSyncActivityCommand } from './../integration-map.sync-activity.command';
import { IntegrationMapSyncEntityCommand } from './../integration-map.sync-entity.command';
import { IntegrationMapService } from '../../integration-map.service';
import { RequestContext } from '../../../core/context';

@CommandHandler(IntegrationMapSyncActivityCommand)
export class IntegrationMapSyncActivityHandler
	implements ICommandHandler<IntegrationMapSyncActivityCommand> {

	constructor(
		private readonly _commandBus: CommandBus,
		private readonly _integrationMapService: IntegrationMapService
	) { }

	/**
	 * Third party activity integrated and mapped
	 *
	 * @param command
	 * @returns
	 */
	public async execute(
		command: IntegrationMapSyncActivityCommand
	) {
		const { input } = command;
		const { sourceId, organizationId, integrationId, entity } = input;
		const tenantId = RequestContext.currentTenantId();

		try {
			const activityMap = await this._integrationMapService.findOneByWhereOptions({
				entity: IntegrationEntity.ACTIVITY,
				sourceId,
				integrationId,
				organizationId,
				tenantId
			});
			await this._commandBus.execute(
				new ActivityUpdateCommand(
					Object.assign(entity, {
						id: activityMap.gauzyId,
					})
				)
			);
			return activityMap;
		} catch (error) {
			const gauzyActivity = await this._commandBus.execute(
				new ActivityCreateCommand(entity)
			);
			return await this._commandBus.execute(
				new IntegrationMapSyncEntityCommand({
					gauzyId: gauzyActivity.id,
					integrationId,
					sourceId,
					entity: IntegrationEntity.ACTIVITY,
					organizationId,
					tenantId
				})
			);
		}
	}
}
