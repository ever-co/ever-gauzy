import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EmployeeService } from '../../employee.service';
import { Employee } from '@gauzy/models';
import { EmployeeGetCommand } from '../employee.get.command';

@CommandHandler(EmployeeGetCommand)
export class EmployeeGetHandler implements ICommandHandler<EmployeeGetCommand> {
	constructor(private readonly employeeService: EmployeeService) {}

	public async execute(command: EmployeeGetCommand): Promise<Employee> {
		const { input } = command;

		return await this.employeeService.findOne(input);
	}
}
