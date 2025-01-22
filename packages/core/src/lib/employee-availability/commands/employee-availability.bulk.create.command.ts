import { ICommand } from '@nestjs/cqrs';
import { IEmployeeAvailabilityCreateInput } from '@gauzy/contracts';

export class EmployeeAvailabilityBulkCreateCommand implements ICommand {
	static readonly type = '[Employee Bulk Availability ] Register';

	constructor(public readonly input: IEmployeeAvailabilityCreateInput[]) {}
}
