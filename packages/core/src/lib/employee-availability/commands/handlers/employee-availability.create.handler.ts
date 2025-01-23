import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IEmployeeAvailability } from '@gauzy/contracts';
import { RequestContext } from '../../../core/context';
import { EmployeeAvailabilityService } from '../../employee-availability.service';
import { EmployeeAvailability } from '../../employee-availability.entity';
import { EmployeeAvailabilityCreateCommand } from '../employee-availability.create.command';
import { BadRequestException } from '@nestjs/common';

@CommandHandler(EmployeeAvailabilityCreateCommand)
export class EmployeeAvailabilityCreateHandler implements ICommandHandler<EmployeeAvailabilityCreateCommand> {
	constructor(private readonly availabilityService: EmployeeAvailabilityService) {}

	public async execute(command: EmployeeAvailabilityCreateCommand): Promise<IEmployeeAvailability> {
		const { input } = command;
		const { startDate, endDate } = input;
		if (!startDate || !endDate) {
			throw new BadRequestException('Start date and end date are required.');
		}
		const tenantId = RequestContext.currentTenantId();

		const availability = new EmployeeAvailability({
			...input,
			tenantId
		});

		return await this.availabilityService.create(availability);
	}
}
