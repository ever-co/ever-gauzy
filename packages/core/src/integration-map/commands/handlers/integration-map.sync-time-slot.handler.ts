import { CommandHandler, ICommandHandler, CommandBus } from '@nestjs/cqrs';
import { IntegrationEntity } from '@gauzy/contracts';
import { IntegrationMapSyncEntityCommand } from '../integration-map.sync-entity.command';
import { IntegrationMapSyncTimeSlotCommand } from '../integration-map.sync-time-slot.command';
import { IntegrationMapService } from '../../integration-map.service';
import { RequestContext } from '../../../core/context';
import { TimeSlotCreateCommand } from './../../../time-tracking/time-slot/commands';

@CommandHandler(IntegrationMapSyncTimeSlotCommand)
export class IntegrationMapSyncTimeSlotHandler
	implements ICommandHandler<IntegrationMapSyncTimeSlotCommand> {

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
		command: IntegrationMapSyncTimeSlotCommand
	) {
		const { input } = command;
		const { sourceId, organizationId, integrationId, timeSlot, employee } = input;
		const tenantId = RequestContext.currentTenantId();

		try {
			return await this._integrationMapService.findOneByOptions({
				where: {
					sourceId,
					entity: IntegrationEntity.TIME_SLOT,
					organizationId,
					tenantId
				}
			});
		} catch (error) {
			const { time_slot } = timeSlot;
			const gauzyTimeSlot = await this._commandBus.execute(
				new TimeSlotCreateCommand({
					employeeId: employee.gauzyId,
					startedAt: timeSlot.starts_at,
					overall: 0,
					keyboard: 0,
					mouse: 0,
					duration: 0,
					time_slot,
					organizationId
				})
			);
			return await this._commandBus.execute(
				new IntegrationMapSyncEntityCommand({
					gauzyId: gauzyTimeSlot.id,
					integrationId,
					sourceId,
					entity: IntegrationEntity.TIME_SLOT,
					organizationId
				})
			);
		}
	}
}
