import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { AvailabilitySlotsCreateCommand } from '../availability-slots.create.command';
import { AvailabilitySlots } from '../../availability-slots.entity';
import { AvailabilitySlotsService } from '../../availability-slots.service';
import { EmployeeService } from '../../../employee/employee.service';
import { OrganizationService } from '../../../organization/organization.service';

@CommandHandler(AvailabilitySlotsCreateCommand)
export class AvailabilitySlotsCreateHandler
	implements ICommandHandler<AvailabilitySlotsCreateCommand> {
	constructor(
		private readonly availabilitySlotsService: AvailabilitySlotsService,
		private readonly employeeService: EmployeeService,
		private readonly organizationService: OrganizationService
	) {}

	public async execute(
		command: AvailabilitySlotsCreateCommand
	): Promise<AvailabilitySlots> {
		const { input } = command;

		const availabilitySlots = new AvailabilitySlots();
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
