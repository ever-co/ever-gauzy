import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EmployeeService } from '../../employee.service';
import { Employee } from '@gauzy/models';
import { EmployeeBulkCreateCommand } from '../employee.bulk.create.command';

@CommandHandler(EmployeeBulkCreateCommand)
export class EmployeeBulkCreateHandler
	implements ICommandHandler<EmployeeBulkCreateCommand> {
	constructor(private readonly employeeService: EmployeeService) {}

	public async execute(
		command: EmployeeBulkCreateCommand
	): Promise<Employee[]> {
		const { input } = command;

		return await this.employeeService.createBulk(input);
	}
}
