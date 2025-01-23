import { BadRequestException } from '@nestjs/common';
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IEmployeeAvailability } from '@gauzy/contracts';
import { RequestContext } from '../../../core/context';
import { EmployeeAvailabilityBulkCreateCommand } from '../employee-availability.bulk.create.command';
import { EmployeeAvailability } from '../../employee-availability.entity';
import { EmployeeAvailabilityCreateCommand } from '../employee-availability.create.command';

@CommandHandler(EmployeeAvailabilityBulkCreateCommand)
export class EmployeeAvailabilityBulkCreateHandler implements ICommandHandler<EmployeeAvailabilityBulkCreateCommand> {
	constructor(private readonly commandBus: CommandBus) {}

	public async execute(command: EmployeeAvailabilityBulkCreateCommand): Promise<IEmployeeAvailability[]> {
		const { input } = command;
		if (!Array.isArray(input) || input.length === 0) {
			throw new BadRequestException('Input must be a non-empty array of availability records.');
		}

		const allAvailability: IEmployeeAvailability[] = [];
		const tenantId = RequestContext.currentTenantId();

		try {
			// Process items in parallel with Promise.all
			const results = await Promise.all(
				input.map(async (item) => {
					const availability = new EmployeeAvailability({
						...item,
						tenantId
					});
					return this.commandBus.execute(new EmployeeAvailabilityCreateCommand(availability));
				})
			);
			allAvailability.push(...results);
		} catch (error) {
			throw new BadRequestException('Failed to create some availability records: ' + error.message);
		}
		return allAvailability;
	}
}
