import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
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
	): Promise<AvailabilitySlot[]> {
		const { input } = command;
		const availabilitySlotsArray = [];

		// const employee = input[0].employeeId
		// 	? await this.employeeService.findOne(input[0].employeeId)
		// 	: null;
		// const organization = await this.organizationService.findOne(
		// 	input[0].organizationId
		// );

		const { tenantId } = RequestContext.currentUser();

		for (const o of input) {
			let availabilitySlots = new AvailabilitySlot({
				...o,
				tenantId
			});

			availabilitySlots = await this.commandBus.execute(
				new AvailabilitySlotsCreateCommand(availabilitySlots)
			);
			availabilitySlotsArray.push(availabilitySlots);
		}

		return availabilitySlotsArray;
	}
}
