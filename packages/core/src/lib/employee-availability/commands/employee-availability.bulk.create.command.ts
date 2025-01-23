import { ICommand } from '@nestjs/cqrs';
import { IEmployeeAvailabilityCreateInput } from '@gauzy/contracts';

export class EmployeeAvailabilityBulkCreateCommand implements ICommand {
	static readonly type = '[Employee Bulk Availability ] Create';

	constructor(public readonly input: IEmployeeAvailabilityCreateInput[]) {}
}
