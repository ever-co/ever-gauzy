import { ICommand } from '@nestjs/cqrs';
import { IEmployeeAvailabilityCreateInput } from '@gauzy/contracts';

export class EmployeeAvailabilityBulkCreateCommand implements ICommand {
	static readonly type = '[Employee Availability Bulk] Create';

	constructor(public readonly input: IEmployeeAvailabilityCreateInput[]) {}
}
