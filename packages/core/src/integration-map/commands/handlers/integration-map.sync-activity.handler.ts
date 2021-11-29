import { CommandHandler, ICommandHandler, CommandBus } from '@nestjs/cqrs';
import { ActivityCreateCommand, ActivityUpdateCommand } from './../../../time-tracking/activity/commands';
import { IntegrationMapSyncActivityCommand } from './../integration-map.sync-activity.command';
import { IntegrationMapSyncEntityCommand } from './../integration-map.sync-entity.command';
import { IntegrationMapService } from '../../integration-map.service';
import { RequestContext } from '../../../core/context';
import { IntegrationEntity } from '@gauzy/contracts';

@CommandHandler(IntegrationMapSyncActivityCommand)
export class IntegrationMapSyncActivityHandler
	implements ICommandHandler<IntegrationMapSyncActivityCommand> {

	constructor(
		private readonly _commandBus: CommandBus,
		private readonly _integrationMapService: IntegrationMapService
	) {}

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
		const { sourceId, organizationId, integrationId, activity } = input;
		const tenantId = RequestContext.currentTenantId();

		try {
			const activityMap = await this._integrationMapService.findOneByOptions({
				where: {
					sourceId,
					entity: IntegrationEntity.ACTIVITY,
					organizationId,
					tenantId
				}
			});
			await this._commandBus.execute(
				new ActivityUpdateCommand(
					Object.assign(activity, {
						id: activityMap.gauzyId,
					})
				)
			);
			return activityMap;
		} catch (error) {
			const gauzyActivity = await this._commandBus.execute(
				new ActivityCreateCommand(
					Object.assign({}, activity)
				)
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
