import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IEmployeeAvailability } from '@gauzy/contracts';
import { RequestContext } from '../../../core/context';
import { EmployeeAvailabilityService } from '../../employee-availability.service';
import { EmployeeAvailabilityBulkCreateCommand } from '../employee-availability.bulk.create.command';
import { EmployeeAvailability } from '../../employee-availability.entity';

/**
 * Handles the bulk creation of employee availability records.
 */
@CommandHandler(EmployeeAvailabilityBulkCreateCommand)
export class EmployeeAvailabilityBulkCreateHandler implements ICommandHandler<EmployeeAvailabilityBulkCreateCommand> {
	constructor(private readonly _availabilityService: EmployeeAvailabilityService) {}

	/**
	 * Executes the bulk creation command for employee availability.
	 *
	 * @param command The command containing the list of availability records to create.
	 * @returns A promise resolving to the list of created employee availability records.
	 */
	public async execute(command: EmployeeAvailabilityBulkCreateCommand): Promise<IEmployeeAvailability[]> {
		const { input } = command;
		const tenantId = RequestContext.currentTenantId() ?? input.tenantId;

		// Prepare employee availability records with tenantId
		const employeeAvailabilities = input.map(item =>
			new EmployeeAvailability({
				...item,
				tenantId
			})
		);

		// Perform bulk insert using the availability service
		return await this._availabilityService.bulkCreate(employeeAvailabilities);
	}
}
