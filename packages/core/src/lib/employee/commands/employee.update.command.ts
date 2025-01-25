import { ICommand } from '@nestjs/cqrs';
import { ID, IEmployeeUpdateInput } from '@gauzy/contracts';

export class EmployeeUpdateCommand implements ICommand {
	static readonly type = '[Employee] Update';

	constructor(public readonly id: ID, public readonly input: IEmployeeUpdateInput) { }
}
