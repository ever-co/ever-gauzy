import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IAvailabilitySlot } from '@gauzy/contracts';
import { AvailabilitySlotsBulkCreateCommand } from '../availability-slots.bulk.create.command';
import { AvailabilitySlot } from '../../availability-slots.entity';
import { RequestContext } from '../../../core/context';
import { AvailabilitySlotsCreateCommand } from '../availability-slots.create.command';

@CommandHandler(AvailabilitySlotsBulkCreateCommand)
export class AvailabilitySlotsBulkCreateHandler
	implements ICommandHandler<AvailabilitySlotsBulkCreateCommand> {
	constructor(private readonly commandBus: CommandBus) {}

	public async execute(
		command: AvailabilitySlotsBulkCreateCommand
	): Promise<IAvailabilitySlot[]> {
		
		const { input } = command;
		const allAvailabilitySlots: IAvailabilitySlot[] = [];
		const tenantId = RequestContext.currentTenantId();

		for (const item of input) {
			let availabilitySlots = new AvailabilitySlot({
				...item,
				tenantId
			});
			availabilitySlots = await this.commandBus.execute(
				new AvailabilitySlotsCreateCommand(availabilitySlots)
			);
			allAvailabilitySlots.push(availabilitySlots);
		}
		return allAvailabilitySlots;
	}
}
