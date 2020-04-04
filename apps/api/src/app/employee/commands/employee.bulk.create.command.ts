import { ICommand } from '@nestjs/cqrs';
import { EmployeeCreateInput as IEmployeeCreateInput } from '@gauzy/models';

export class EmployeeBulkCreateCommand implements ICommand {
	static readonly type = '[Employee] Register';

	constructor(public readonly input: IEmployeeCreateInput[]) {}
}
