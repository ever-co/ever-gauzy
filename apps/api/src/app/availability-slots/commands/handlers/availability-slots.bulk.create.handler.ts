import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { AvailabilitySlotsBulkCreateCommand } from '../availability-slots.bulk.create.command';
import { AvailabilitySlots } from '../../availability-slots.entity';
import { AvailabilitySlotsService } from '../../availability-slots.service';
import { EmployeeService } from '../../../employee/employee.service';
import { OrganizationService } from '../../../organization/organization.service';

@CommandHandler(AvailabilitySlotsBulkCreateCommand)
export class AvailabilitySlotsBulkCreateHandler
	implements ICommandHandler<AvailabilitySlotsBulkCreateCommand> {
	constructor(
		private readonly availabilitySlotsService: AvailabilitySlotsService,
		private readonly employeeService: EmployeeService,
		private readonly organizationService: OrganizationService
	) {}

	public async execute(
		command: AvailabilitySlotsBulkCreateCommand
	): Promise<AvailabilitySlots[]> {
		const { input } = command;
		const availabilitySlotsArray = [];

		const employee = input[0].employeeId
			? await this.employeeService.findOne(input[0].employeeId)
			: null;
		const organization = await this.organizationService.findOne(
			input[0].organizationId
		);

		for (let o of input) {
			const availabilitySlots = new AvailabilitySlots();

			availabilitySlots.employee = employee;
			availabilitySlots.organization = organization;
			availabilitySlots.allDay = o.allDay || false;
			availabilitySlots.startTime = o.startTime;
			availabilitySlots.endTime = o.endTime;
			availabilitySlots.type = o.type;

			availabilitySlotsArray.push(availabilitySlots);
		}

		return await this.availabilitySlotsService.createBulk(
			availabilitySlotsArray
		);
	}
}
