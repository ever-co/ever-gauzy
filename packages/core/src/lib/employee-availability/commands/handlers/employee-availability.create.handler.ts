import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IEmployeeAvailability } from '@gauzy/contracts';
import { RequestContext } from '../../../core/context';
import { EmployeeAvailabilityService } from '../../employee-availability.service';
import { EmployeeAvailability } from '../../employee-availability.entity';
import { EmployeeAvailabilityCreateCommand } from '../employee-availability.create.command';

@CommandHandler(EmployeeAvailabilityCreateCommand)
export class EmployeeAvailabilityCreateHandler implements ICommandHandler<EmployeeAvailabilityCreateCommand> {
	constructor(private readonly availabilityService: EmployeeAvailabilityService) {}

	/**
	 * Handles the creation of an employee availability record.
	 *
	 * @param {EmployeeAvailabilityCreateCommand} command - The command containing employee availability details.
	 * @returns {Promise<IEmployeeAvailability>} - The newly created employee availability record.
	 * @throws {BadRequestException} - If any validation fails (e.g., missing fields, invalid dates).
	 */
	public async execute(command: EmployeeAvailabilityCreateCommand): Promise<IEmployeeAvailability> {
		const { input } = command;
		const { startDate, endDate, employeeId, dayOfWeek, availabilityStatus } = input;

		if (!employeeId) {
			throw new BadRequestException('Employee ID is required.');
		}
		if (typeof dayOfWeek !== 'number' || dayOfWeek < 0 || dayOfWeek > 6) {
			throw new BadRequestException('Day of week must be a number between 0 and 6.');
		}
		if (!availabilityStatus) {
			throw new BadRequestException('Availability status is required.');
		}

		if (!startDate || !endDate) {
			throw new BadRequestException('Start date and end date are required.');
		}

		if (new Date(endDate) <= new Date(startDate)) {
			throw new BadRequestException('End date must be after start date.');
		}

		const tenantId = RequestContext.currentTenantId();

		const availability = new EmployeeAvailability({
			...input,
			tenantId
		});

		return await this.availabilityService.create(availability);
	}
}
