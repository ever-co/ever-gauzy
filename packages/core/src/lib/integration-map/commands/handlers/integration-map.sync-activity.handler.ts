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

		// Only a missing map means the activity is new. Errors from the update below must reach the caller:
		// they used to fall into the "no map" branch and create a second activity and map for the same source id.
		const activityMap = await this._integrationMapService
			.findOneByWhereOptions({
				entity: IntegrationEntity.ACTIVITY,
				sourceId,
				integrationId,
				organizationId,
				tenantId
			})
			.catch(() => null);

		if (!activityMap) {
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

		// A copy: the caller's entity is not ours to stamp with the Gauzy id
		await this._commandBus.execute(
			new ActivityUpdateCommand({ ...entity, id: activityMap.gauzyId })
		);
		return activityMap;
	}
}
