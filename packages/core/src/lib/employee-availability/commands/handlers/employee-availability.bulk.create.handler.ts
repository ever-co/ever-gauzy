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
		const allAvailability: IEmployeeAvailability[] = [];
		const tenantId = RequestContext.currentTenantId();

		for (const item of input) {
			let availability = new EmployeeAvailability({
				...item,
				tenantId
			});
			availability = await this.commandBus.execute(new EmployeeAvailabilityCreateCommand(availability));
			allAvailability.push(availability);
		}
		return allAvailability;
	}
}
