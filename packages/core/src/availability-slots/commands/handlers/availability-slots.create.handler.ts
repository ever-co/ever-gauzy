import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { In } from 'typeorm';
import { pluck } from 'underscore';
import { AvailabilityMergeType, IAvailabilitySlot } from '@gauzy/contracts';
import { AvailabilitySlotsCreateCommand } from '../availability-slots.create.command';
import { AvailabilitySlot } from '../../availability-slots.entity';
import { AvailabilitySlotsService } from '../../availability-slots.service';
import { GetConflictAvailabilitySlotsCommand } from '../get-conflict-availability-slots.command';
import { RequestContext } from './../../../core/context';

@CommandHandler(AvailabilitySlotsCreateCommand)
export class AvailabilitySlotsCreateHandler
	implements ICommandHandler<AvailabilitySlotsCreateCommand> {
	constructor(
		private readonly availabilitySlotsService: AvailabilitySlotsService,
		private readonly commandBus: CommandBus
	) {}

	public async execute(
		command: AvailabilitySlotsCreateCommand
	): Promise<IAvailabilitySlot> {
		const { input, insertType } = command;
		const { organizationId, employeeId, startTime, endTime, type } = input;
		const tenantId = RequestContext.currentTenantId();
				
		const conflicts: IAvailabilitySlot[] = await this.commandBus.execute(
			new GetConflictAvailabilitySlotsCommand({
				employeeId,
				startTime,
				endTime,
				type,
				tenantId,
				organizationId
			})
		);

		if (insertType === AvailabilityMergeType.SKIP) {
			return;
		}

		if (conflicts.length > 0) {
			if (insertType === AvailabilityMergeType.MERGE) {
				const startTimes = conflicts.map((item) =>
					new Date(item.startTime).getTime()
				);
				const endTimes = conflicts.map((item) =>
					new Date(item.endTime).getTime()
				);
				input.startTime = new Date(
					Math.min(new Date(input.startTime).getTime(), ...startTimes)
				);
				input.endTime = new Date(
					Math.max(new Date(input.endTime).getTime(), ...endTimes)
				);
			}
			await this.availabilitySlotsService.delete({
				id: In(pluck(conflicts, 'id'))
			});
		}

		const availabilitySlots = new AvailabilitySlot({
			...input,
			tenantId
		});
		
		return await this.availabilitySlotsService.create(availabilitySlots);
	}
}
