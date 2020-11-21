import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { AvailabilitySlotsCreateCommand } from '../availability-slots.create.command';
import { AvailabilitySlot } from '../../availability-slots.entity';
import { AvailabilitySlotsService } from '../../availability-slots.service';
import { EmployeeService } from '../../../employee/employee.service';
import { OrganizationService } from '../../../organization/organization.service';
import { GetConflictAvailabilitySlotsCommand } from '../get-conflict-availability-slots.command';
import { In } from 'typeorm';
import { pluck } from 'underscore';

@CommandHandler(AvailabilitySlotsCreateCommand)
export class AvailabilitySlotsCreateHandler
	implements ICommandHandler<AvailabilitySlotsCreateCommand> {
	constructor(
		private readonly availabilitySlotsService: AvailabilitySlotsService,
		private readonly employeeService: EmployeeService,
		private readonly organizationService: OrganizationService,
		private readonly commandBus: CommandBus
	) {}

	public async execute(
		command: AvailabilitySlotsCreateCommand
	): Promise<AvailabilitySlot> {
		const { input } = command;

		const conflicts: AvailabilitySlot[] = await this.commandBus.execute(
			new GetConflictAvailabilitySlotsCommand({
				employeeId: input.employeeId,
				startTime: input.startTime,
				endTime: input.endTime,
				type: input.type
			})
		);

		if (conflicts.length > 0) {
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
			await this.availabilitySlotsService.delete({
				id: In(pluck(conflicts, 'id'))
			});
		}

		console.log(conflicts);

		const availabilitySlots = new AvailabilitySlot();
		const employee = input.employeeId
			? await this.employeeService.findOne(input.employeeId)
			: null;
		const organization = await this.organizationService.findOne(
			input.organizationId
		);

		availabilitySlots.employee = employee;
		availabilitySlots.organization = organization;
		availabilitySlots.allDay = input.allDay || false;
		availabilitySlots.startTime = input.startTime;
		availabilitySlots.endTime = input.endTime;
		availabilitySlots.type = input.type;

		return await this.availabilitySlotsService.create(availabilitySlots);
	}
}
