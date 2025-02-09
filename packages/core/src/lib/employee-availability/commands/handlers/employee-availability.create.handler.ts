import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IEmployeeAvailability } from '@gauzy/contracts';
import { RequestContext } from '../../../core/context';
import { EmployeeAvailabilityService } from '../../employee-availability.service';
import { EmployeeAvailability } from '../../employee-availability.entity';
import { EmployeeAvailabilityCreateCommand } from '../employee-availability.create.command';

@CommandHandler(EmployeeAvailabilityCreateCommand)
export class EmployeeAvailabilityCreateHandler implements ICommandHandler<EmployeeAvailabilityCreateCommand> {
	constructor(private readonly _availabilityService: EmployeeAvailabilityService) {}

	/**
	 * Handles the creation of an employee availability record.
	 *
	 * @param {EmployeeAvailabilityCreateCommand} command - The command containing employee availability details.
	 * @returns {Promise<IEmployeeAvailability>} - The newly created employee availability record.
	 * @throws {BadRequestException} - If any validation fails (e.g., missing fields, invalid dates).
	 */
	public async execute(command: EmployeeAvailabilityCreateCommand): Promise<IEmployeeAvailability> {
		const { input } = command;
		const tenantId = RequestContext.currentTenantId() ?? input.tenantId;

		return await this._availabilityService.create(new EmployeeAvailability({
			...input,
			tenantId
		}));
	}
}
